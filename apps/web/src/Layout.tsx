import { NavLink, Outlet } from 'react-router-dom';
import type { Overview } from '@progressflow/shared';
import { useAuth } from './auth';
import { useApi } from './data';

export function Layout() {
  const { user, logout } = useAuth();
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
            Overview
          </NavLink>
          <p className="nav-h">Classes</p>
          {data?.classes.map((c) => (
            <NavLink key={c.id} to={`/classes/${c.id}`}>
              Class {c.label}
              {c.waiting > 0 && (
                <span className="dot" title={`${c.waiting} to evaluate`}>
                  {c.waiting}
                </span>
              )}
            </NavLink>
          ))}
          {data && data.classes.length === 0 && <span className="muted small pad">None yet</span>}
        </nav>
        <div className="side-foot">
          <div className="who">
            <strong>{user?.name}</strong>
            <span className="muted small">{user?.school}</span>
          </div>
          <button className="ghost" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {loading && !data ? <p className="muted">Loading…</p> : <Outlet context={data} />}
      </main>
    </div>
  );
}
