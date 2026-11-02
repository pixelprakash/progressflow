import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, Language, TeacherProfile } from '@progressflow/shared';
import { ApiError, api } from './api';

interface Auth {
  user: TeacherProfile | null;
  loading: boolean;
  login: (mobile: string, password: string) => Promise<void>;
  register: (v: {
    name: string;
    school: string;
    mobile: string;
    password: string;
    language: Language;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TeacherProfile>('/v1/me')
      .then(setUser)
      .catch((e: unknown) => {
        if (!(e instanceof ApiError && e.status === 401)) console.error(e);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (mobile: string, password: string) => {
    const r = await api.post<AuthResponse>('/v1/auth/login', {
      phone: `+91${mobile}`,
      password,
      cookie: true,
    });
    setUser(r.user);
  }, []);

  const register: Auth['register'] = useCallback(async (v) => {
    await api.post('/v1/auth/register', {
      name: v.name,
      school: v.school,
      phone: `+91${v.mobile}`,
      password: v.password,
      language: v.language,
    });
    const r = await api.post<AuthResponse>('/v1/auth/login', {
      phone: `+91${v.mobile}`,
      password: v.password,
      cookie: true,
    });
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/v1/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAuth outside AuthProvider');
  return a;
}
