import { NavLink, Outlet } from 'react-router-dom';
import type { Overview } from '@progressflow/shared';
import { useAuth } from './auth';
import { useApi } from './data';
import { LanguageSwitch, useLang } from './i18n';

export function Layout() {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const { data, error, loading } = useApi<Overview>('/v1/overview');

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand-row">
          <span className="logo" aria-hidden>
            ↗
          </span>
          <strong>ProgressFlow</strong>
        </div>
        <nav aria-label="Main">
          <NavLink to="/" end>
            {t('nav.overview')}
          </NavLink>
          <p className="nav-h">{t('nav.classes')}</p>
          {data?.classes.map((c) => (
            <NavLink key={c.id} to={`/classes/${c.id}`}>
              {t('common.class', { label: c.label })}
              {c.waiting > 0 && (
                <span className="dot" title={t('ov.waiting', { n: c.waiting })}>
                  {c.waiting}
                </span>
              )}
            </NavLink>
          ))}
          {data && data.classes.length === 0 && (
            <span className="muted small pad">{t('nav.none')}</span>
          )}
        </nav>
        <div className="side-foot">
          <LanguageSwitch />
          <div className="who">
            <strong>{user?.name}</strong>
            <span className="muted small">{user?.school}</span>
          </div>
          <button className="ghost" onClick={() => void logout()}>
            {t('common.signOut')}
          </button>
        </div>
      </aside>
      <main className="main">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {loading && !data ? (
          <p className="muted">{t('common.loading')}</p>
        ) : (
          <Outlet context={data} />
        )}
      </main>
    </div>
  );
}
