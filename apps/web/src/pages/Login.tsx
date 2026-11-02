import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Language } from '@progressflow/shared';
import { useAuth } from '../auth';

const MOBILE_RE = /^[6-9]\d{9}$/;

export function Login() {
  const { login, register } = useAuth();
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
    const problem = !MOBILE_RE.test(mobile)
      ? 'Enter a 10-digit Indian mobile number.'
      : mode === 'register' && name.trim().length < 2
        ? 'Enter your name.'
        : mode === 'register' && school.trim().length < 2
          ? 'Enter your school.'
          : mode === 'register' && password.length < 8
            ? 'Use a password of at least 8 characters.'
            : mode === 'register' && password !== confirm
              ? 'The two passwords do not match.'
              : mode === 'login' && !password
                ? 'Enter your password.'
                : '';
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      if (mode === 'login') await login(mobile, password);
      else await register({ name: name.trim(), school: school.trim(), mobile, password, language });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={(e) => void submit(e)} noValidate>
        <div className="brand">
          <span className="logo" aria-hidden>
            ↗
          </span>
          <h1>ProgressFlow</h1>
          <p className="muted">Teacher dashboard — formative assessment for art &amp; design</p>
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
            Sign in
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
            Create account
          </button>
        </div>

        {mode === 'register' && (
          <>
            <label>
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label>
              School
              <input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                autoComplete="organization"
              />
            </label>
          </>
        )}
        <label>
          Mobile number
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
          Password
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
              Confirm password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              Voice-note language
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="te">తెలుగు</option>
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
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <p className="muted small">
          {mode === 'login'
            ? 'Use the same mobile number and password you set up for the ProgressFlow app, then sync from your phone to see your classes here.'
            : 'This web account is also what the phone app signs in with to sync your classes.'}
        </p>
      </form>
    </main>
  );
}
