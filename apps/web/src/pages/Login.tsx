import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LANGUAGE_NAMES } from '@progressflow/shared';
import type { Language, TKey } from '@progressflow/shared';
import { useAuth } from '../auth';
import { LanguageSwitch, useLang } from '../i18n';

const MOBILE_RE = /^[6-9]\d{9}$/;

export function Login() {
  const { login, register } = useAuth();
  const { t } = useLang();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const reg = mode === 'register';
    const problem: TKey | '' = !MOBILE_RE.test(mobile)
      ? 'login.err.mobile'
      : reg && name.trim().length < 2
        ? 'login.err.name'
        : reg && school.trim().length < 2
          ? 'login.err.school'
          : reg && password.length < 8
            ? 'login.err.pwShort'
            : reg && password !== confirm
              ? 'login.err.pwMatch'
              : !reg && !password
                ? 'login.err.pwEmpty'
                : '';
    setError(problem ? t(problem) : '');
    if (problem) return;
    setBusy(true);
    try {
      if (mode === 'login') await login(mobile, password);
      else await register({ name: name.trim(), school: school.trim(), mobile, password, language });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={(e) => void submit(e)} noValidate>
        <div className="row between">
          <span />
          <LanguageSwitch />
        </div>
        <div className="brand">
          <span className="logo" aria-hidden>
            ↗
          </span>
          <h1>ProgressFlow</h1>
          <p className="muted">{t('login.tagline')}</p>
        </div>

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            {t('login.tab.signIn')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            {t('login.tab.create')}
          </button>
        </div>

        {mode === 'register' && (
          <>
            <label>
              {t('login.name')}
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label>
              {t('login.school')}
              <input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                autoComplete="organization"
              />
            </label>
          </>
        )}
        <label>
          {t('login.mobile')}
          <span className="phone">
            <span className="prefix">+91</span>
            <input
              value={mobile}
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel-national"
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
            />
          </span>
        </label>
        <label>
          {t('login.password')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {mode === 'register' && (
          <>
            <label>
              {t('login.confirm')}
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              {t('login.voiceLang')}
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                {(Object.keys(LANGUAGE_NAMES) as Language[]).map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_NAMES[l]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? t('login.wait')
            : mode === 'login'
              ? t('login.tab.signIn')
              : t('login.tab.create')}
        </button>
        <p className="muted small">{mode === 'login' ? t('login.helpIn') : t('login.helpReg')}</p>
        <p className="small">
          <Link to="/student">{t('login.studentLink')}</Link>
        </p>
      </form>
    </main>
  );
}
