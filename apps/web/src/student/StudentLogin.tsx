import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api';
import { LanguageSwitch, useLang } from '../i18n';
import { useStudent } from './session';

export function StudentLogin() {
  const { t } = useLang();
  const { login } = useStudent();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(code);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t('sp.tooMany') : t('sp.badCode'));
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="auth-card student" onSubmit={(e) => void submit(e)} noValidate>
        <div className="row between">
          <strong>ProgressFlow</strong>
          <LanguageSwitch />
        </div>
        <h1>{t('sp.openTitle')}</h1>
        <p>{t('sp.codeHelp')}</p>
        <label>
          {t('sp.code')}
          <input
            className="codebox"
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value
                  .replace(/[^a-zA-Z0-9]/g, '')
                  .toUpperCase()
                  .slice(0, 6),
              )
            }
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={error ? 'code-error' : undefined}
            inputMode="text"
          />
        </label>
        {error && (
          <p id="code-error" className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary big" disabled={busy || code.length !== 6}>
          {t('sp.open')}
        </button>
        <p className="small">
          <Link to="/">←</Link>
        </p>
      </form>
    </main>
  );
}
