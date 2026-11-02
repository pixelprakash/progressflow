import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { StudentPortal } from '@progressflow/shared';
import { ApiError, api } from '../api';

interface Session {
  portal: StudentPortal | null;
  loading: boolean;
  /** Re-read the portal (after a review is sent, for example). */
  refresh: () => Promise<void>;
  login: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  /** A request answered 401: drop back to the sign-in screen. */
  expire: () => void;
}

const Ctx = createContext<Session | null>(null);

export function StudentSession({ children }: { children: ReactNode }) {
  const [portal, setPortal] = useState<StudentPortal | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setPortal(await api.get<StudentPortal>('/v1/student/portal'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setPortal(null);
      else throw e;
    }
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<Session>(
    () => ({
      portal,
      loading,
      refresh,
      login: async (code) => {
        await api.post('/v1/student/login', { code });
        await refresh();
      },
      logout: async () => {
        await api.post('/v1/student/logout').catch(() => {});
        setPortal(null);
      },
      expire: () => setPortal(null),
    }),
    [portal, loading, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudent(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStudent outside StudentSession');
  return v;
}
