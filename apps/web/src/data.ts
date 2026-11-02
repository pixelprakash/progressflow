import { useEffect, useState } from 'react';
import { ApiError, api } from './api';
import { useAuth } from './auth';

/** Loads a dashboard endpoint; a 401 anywhere means the session ended, so go back to sign-in. */
export function useApi<T>(path: string): { data: T | null; error: string; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    api
      .get<T>(path)
      .then((d) => live && setData(d))
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401) void logout();
        else setError(e instanceof Error ? e.message : 'Something went wrong');
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [path, logout]);

  return { data, error, loading };
}

export const KIND_LABEL: Record<string, string> = {
  sketch: 'Sketch',
  regular: 'Regular check',
  progress: 'Progress check',
  portfolio: 'Portfolio piece',
};

export const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toFixed(1);

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
