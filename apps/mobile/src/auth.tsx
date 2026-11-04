import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { Language, TKey } from '@progressflow/shared';

/**
 * Local teacher accounts (offline-first). The PIN hash lives in the platform
 * keystore (SecureStore); the profile is a small JSON file. This locks the app
 * and separates teachers sharing a phone — it is NOT server authentication.
 * The phone number can be confirmed with a one-time code (src/otp.ts); that proves
 * the number only and is what allows a forgotten PIN to be reset without erasing data.
 */

export interface Teacher {
  id: string;
  name: string;
  school: string;
  /** E.164, e.g. +919876543210 */
  phone: string;
  language: Language;
  /** True once the phone number was confirmed with a one-time code. */
  phoneVerified?: boolean;
  /** Folder under progressflow/ holding this teacher's data ('' = first-release data). */
  dataDir: string;
  createdAt: string;
}

export interface RegisterInput {
  name: string;
  school: string;
  /** 10-digit Indian mobile number. */
  mobile: string;
  language: Language;
  pin: string;
  /** The number was confirmed with a code before registering. */
  verified?: boolean;
}

/** A failed sign-in carries a dictionary key (and a number to put in it); the screen translates it. */
export type LoginResult = { ok: true } | { ok: false; key: TKey; n?: number };

const BASE = `${FileSystem.documentDirectory ?? ''}progressflow/`;
const ACCOUNTS_FILE = `${BASE}accounts.json`;
const SESSION_FILE = `${BASE}session.json`;
const AUTO_LOCK_MS = 5 * 60 * 1000;
const MAX_FREE_TRIES = 5;

export const MOBILE_RE = /^[6-9]\d{9}$/;
export const PIN_RE = /^\d{4,6}$/;

export function weakPin(pin: string): boolean {
  return /^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin);
}

const keyOf = (prefix: string, id: string) => `${prefix}_${id.replace(/-/g, '')}`;

async function hashPin(pin: string, salt: string): Promise<string> {
  let h = `${salt}:${pin}`;
  for (let i = 0; i < 1000; i++) {
    h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, h + salt);
  }
  return h;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists ? (JSON.parse(await FileSystem.readAsStringAsync(path)) as T) : null;
  } catch {
    return null;
  }
}

interface Auth {
  loading: boolean;
  accounts: Teacher[];
  current: Teacher | null;
  register: (input: RegisterInput) => Promise<void>;
  login: (id: string, pin: string) => Promise<LoginResult>;
  logout: () => void;
  /** After the phone number was proved with a code: sets a new PIN, clears the lock-out and signs in. */
  resetPin: (id: string, pin: string) => Promise<void>;
  /** Records that the number was confirmed (for accounts that skipped it at registration). */
  markVerified: (id: string) => Promise<void>;
  /** Erases the account AND its data from this phone. */
  removeAccount: (id: string) => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Teacher[]>([]);
  const [current, setCurrent] = useState<Teacher | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const currentRef = useRef<Teacher | null>(null);
  currentRef.current = current;

  const saveSession = useCallback(async (id: string | null) => {
    try {
      if (id) {
        await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify({ id, at: Date.now() }));
      } else {
        await FileSystem.deleteAsync(SESSION_FILE, { idempotent: true });
      }
    } catch {
      /* a missing session file only means signing in again */
    }
  }, []);

  useEffect(() => {
    (async () => {
      await FileSystem.makeDirectoryAsync(BASE, { intermediates: true }).catch(() => {});
      const list = (await readJson<Teacher[]>(ACCOUNTS_FILE)) ?? [];
      setAccounts(list);
      const session = await readJson<{ id: string; at: number }>(SESSION_FILE);
      if (session && Date.now() - session.at < AUTO_LOCK_MS) {
        setCurrent(list.find((t) => t.id === session.id) ?? null);
      }
      setLoading(false);
    })();
  }, []);

  // Lock again after the app has been away for a while (minors' data on the phone).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        const id = currentRef.current?.id;
        if (id) void saveSession(id);
      } else if (state === 'active') {
        const away = backgroundedAt.current;
        backgroundedAt.current = null;
        if (away !== null && Date.now() - away > AUTO_LOCK_MS && currentRef.current) {
          setCurrent(null);
          void saveSession(null);
        }
      }
    });
    return () => sub.remove();
  }, [saveSession]);

  const persistAccounts = useCallback(async (list: Teacher[]) => {
    setAccounts(list);
    await FileSystem.writeAsStringAsync(ACCOUNTS_FILE, JSON.stringify(list));
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      const id = Crypto.randomUUID();
      const salt = Crypto.randomUUID();
      const hash = await hashPin(input.pin, salt);
      await SecureStore.setItemAsync(keyOf('pf_pin', id), JSON.stringify({ salt, hash }));

      // The first teacher on a phone that already holds first-release data adopts it.
      const legacy = (await FileSystem.getInfoAsync(`${BASE}state.json`)).exists;
      const adopt = legacy && !accounts.some((a) => a.dataDir === '');
      const teacher: Teacher = {
        id,
        name: input.name.trim(),
        school: input.school.trim(),
        phone: `+91${input.mobile}`,
        language: input.language,
        phoneVerified: !!input.verified,
        dataDir: adopt ? '' : `accounts/${id}/`,
        createdAt: new Date().toISOString(),
      };
      await persistAccounts([...accounts, teacher]);
      await saveSession(id);
      setCurrent(teacher);
    },
    [accounts, persistAccounts, saveSession],
  );

  const login = useCallback(
    async (id: string, pin: string): Promise<LoginResult> => {
      const teacher = accounts.find((t) => t.id === id);
      if (!teacher) return { ok: false, key: 'm.web.errApp' };

      const lockKey = keyOf('pf_lock', id);
      const lock = JSON.parse(
        (await SecureStore.getItemAsync(lockKey)) ?? '{"fails":0,"until":0}',
      ) as {
        fails: number;
        until: number;
      };
      if (lock.until > Date.now()) {
        return {
          ok: false,
          key: 'm.auth.errLocked',
          n: Math.ceil((lock.until - Date.now()) / 1000),
        };
      }

      const stored = JSON.parse(
        (await SecureStore.getItemAsync(keyOf('pf_pin', id))) ?? 'null',
      ) as {
        salt: string;
        hash: string;
      } | null;
      if (stored && (await hashPin(pin, stored.salt)) === stored.hash) {
        await SecureStore.deleteItemAsync(lockKey);
        await saveSession(id);
        setCurrent(teacher);
        return { ok: true };
      }

      const fails = lock.fails + 1;
      const wait = fails >= MAX_FREE_TRIES ? Math.min(900, 30 * 2 ** (fails - MAX_FREE_TRIES)) : 0;
      await SecureStore.setItemAsync(
        lockKey,
        JSON.stringify({ fails, until: Date.now() + wait * 1000 }),
      );
      return wait
        ? { ok: false, key: 'm.auth.errWrongLocked', n: wait }
        : { ok: false, key: 'm.auth.errWrong', n: MAX_FREE_TRIES - fails };
    },
    [accounts, saveSession],
  );

  const resetPin = useCallback(
    async (id: string, pin: string) => {
      const teacher = accounts.find((t) => t.id === id);
      if (!teacher) return;
      const salt = Crypto.randomUUID();
      await SecureStore.setItemAsync(
        keyOf('pf_pin', id),
        JSON.stringify({ salt, hash: await hashPin(pin, salt) }),
      );
      await SecureStore.deleteItemAsync(keyOf('pf_lock', id)).catch(() => {});
      const updated = { ...teacher, phoneVerified: true };
      await persistAccounts(accounts.map((a) => (a.id === id ? updated : a)));
      await saveSession(id);
      setCurrent(updated);
    },
    [accounts, persistAccounts, saveSession],
  );

  const markVerified = useCallback(
    async (id: string) => {
      const updated = accounts.map((a) => (a.id === id ? { ...a, phoneVerified: true } : a));
      await persistAccounts(updated);
      setCurrent((c) => (c && c.id === id ? { ...c, phoneVerified: true } : c));
    },
    [accounts, persistAccounts],
  );

  const logout = useCallback(() => {
    setCurrent(null);
    void saveSession(null);
  }, [saveSession]);

  const removeAccount = useCallback(
    async (id: string) => {
      const teacher = accounts.find((t) => t.id === id);
      if (!teacher) return;
      const root = `${BASE}${teacher.dataDir}`;
      for (const part of ['state.json', 'artworks', 'voice', 'attachments']) {
        await FileSystem.deleteAsync(`${root}${part}`, { idempotent: true }).catch(() => {});
      }
      if (teacher.dataDir) await FileSystem.deleteAsync(root, { idempotent: true }).catch(() => {});
      await SecureStore.deleteItemAsync(keyOf('pf_pin', id)).catch(() => {});
      await SecureStore.deleteItemAsync(keyOf('pf_lock', id)).catch(() => {});
      await persistAccounts(accounts.filter((t) => t.id !== id));
      setCurrent(null);
      await saveSession(null);
    },
    [accounts, persistAccounts, saveSession],
  );

  const value = useMemo<Auth>(
    () => ({
      loading,
      accounts,
      current,
      register,
      login,
      logout,
      resetPin,
      markVerified,
      removeAccount,
    }),
    [loading, accounts, current, register, login, logout, resetPin, markVerified, removeAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAuth outside AuthProvider');
  return a;
}
