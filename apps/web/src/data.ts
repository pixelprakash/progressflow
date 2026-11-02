import { useEffect, useState } from 'react';
import type { TKey } from '@progressflow/shared';
import { ApiError, api } from './api';
import { useAuth } from './auth';

/** Loads a dashboard endpoint; a 401 anywhere means the session ended, so go back to sign-in. */
export function useApi<T>(
  path: string,
  onUnauthorized?: () => void,
): { data: T | null; error: string; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
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
        if (e instanceof ApiError && e.status === 401) (onUnauthorized ?? (() => void logout()))();
        else setError(e instanceof Error ? e.message : 'error');
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line
  }, [path, logout, tick]);

  return { data, error, loading, reload: () => setTick((n) => n + 1) };
}

export const kindKey = (kind: string) => `kind.${kind}` as TKey;
export const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toFixed(1);
