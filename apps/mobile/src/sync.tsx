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
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { AuthResponse, MediaWanted, SyncPushResponse } from '@progressflow/shared';
import { MOBILE_RE, useAuth } from './auth';
import { noTombstones } from './domain';
import type { AppData } from './domain';
import { dataRoot, useStore } from './store';
import { toPush, toSyncRubric, toSyncTypes } from './syncMap';
import { isPrivateHost, parseHttpUrl } from './url';

/**
 * Pushes classes, students and changed submissions (plus their photos, voice
 * notes and attachments) to the teacher's web account, so they show on the
 * laptop dashboard. Offline-first: nothing here blocks the teacher — failures
 * just leave things pending and retry. The phone stays the only writer.
 */

export type SyncStatus = 'unlinked' | 'idle' | 'syncing' | 'offline' | 'signin' | 'error';

interface Config {
  serverUrl: string;
  token: string;
  name: string;
}

interface SyncFile {
  /** submission id -> updatedAt that the server has */
  synced: Record<string, string>;
  /** fingerprint of classes+students last pushed */
  meta: string;
  lastSyncAt: string | null;
}

export interface LinkInput {
  serverUrl: string;
  mode: 'login' | 'register';
  mobile: string;
  password: string;
}

interface Sync {
  linked: boolean;
  serverUrl: string;
  accountName: string;
  status: SyncStatus;
  message: string;
  pending: number;
  lastSyncAt: string | null;
  /** Resolves to an error message, or null on success. */
  link: (input: LinkInput) => Promise<string | null>;
  unlink: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<Sync | null>(null);
const BATCH = 20;
const EMPTY_FILE: SyncFile = { synced: {}, meta: '', lastSyncAt: null };

const keyOf = (id: string) => `pf_sync_${id.replace(/-/g, '')}`;

function fingerprint(d: AppData): string {
  const s = JSON.stringify([
    d.classes,
    d.students.map((x) => [x.id, x.classId, x.name, x.rollNo]),
    toSyncTypes(d),
    toSyncRubric(d),
  ]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function http<T>(
  url: string,
  init: RequestInit & { token?: string; json?: unknown },
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: init.method ?? 'POST',
      signal: ctrl.signal,
      headers: {
        ...(init.json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
    const text = await res.text();
    const body = text ? (JSON.parse(text) as { error?: { message?: string } }) : {};
    if (!res.ok)
      throw new HttpError(res.status, body.error?.message ?? `Server said ${res.status}`);
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { current: teacher } = useAuth();
  const { data, ready, clearDeleted } = useStore();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [file, setFile] = useState<SyncFile>(EMPTY_FILE);
  const [status, setStatus] = useState<SyncStatus>('unlinked');
  const [message, setMessage] = useState('');
  const running = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const fileRef = useRef(file);
  fileRef.current = file;

  const syncPath = () => `${dataRoot()}sync.json`;

  useEffect(() => {
    if (!teacher || !ready) return;
    (async () => {
      const raw = await SecureStore.getItemAsync(keyOf(teacher.id)).catch(() => null);
      const c = raw ? (JSON.parse(raw) as Config) : null;
      setCfg(c);
      setStatus(c ? 'idle' : 'unlinked');
      try {
        const info = await FileSystem.getInfoAsync(syncPath());
        if (info.exists)
          setFile(JSON.parse(await FileSystem.readAsStringAsync(syncPath())) as SyncFile);
      } catch {
        /* start fresh */
      }
    })();
  }, [teacher, ready]);

  const saveFile = useCallback(async (f: SyncFile) => {
    fileRef.current = f;
    setFile(f);
    await FileSystem.writeAsStringAsync(syncPath(), JSON.stringify(f)).catch(() => {});
  }, []);

  const changed = useCallback(
    (d: AppData, f: SyncFile) => d.submissions.filter((s) => f.synced[s.id] !== s.updatedAt),
    [],
  );
  const metaChanged = useCallback((d: AppData, f: SyncFile) => f.meta !== fingerprint(d), []);

  const pending = useMemo(
    () =>
      cfg
        ? changed(data, file).length +
          (metaChanged(data, file) ? 1 : 0) +
          noTombstones(data.deleted)
        : 0,
    [cfg, data, file, changed, metaChanged],
  );

  const syncNow = useCallback(async () => {
    if (!cfg || running.current) return;
    running.current = true;
    setStatus('syncing');
    setMessage('');
    try {
      let f = fileRef.current;
      const d = dataRef.current;
      const todo = changed(d, f);
      const meta = fingerprint(d);
      const needMeta = f.meta !== meta;
      const needDeletes = noTombstones(d.deleted) > 0;
      if (todo.length === 0 && !needMeta && !needDeletes) {
        setStatus('idle');
        return;
      }

      const batches: (typeof todo)[] = [];
      for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
      if (batches.length === 0) batches.push([]);

      for (const [bi, batch] of batches.entries()) {
        const payload = toPush(d, new Set(batch.map((s) => s.id)));
        if (bi > 0) {
          payload.classes = [];
          payload.students = [];
          delete payload.types;
          delete payload.rubric;
          payload.deleted = { classes: [], students: [], submissions: [] };
        }
        const res = await http<SyncPushResponse>(`${cfg.serverUrl}/v1/sync/push`, {
          token: cfg.token,
          json: payload,
        });

        if (bi === 0 && res.deleted) clearDeleted(res.deleted);
        const failed = await uploadMedia(cfg, batch, res.mediaWanted);
        const synced = { ...f.synced };
        for (const s of batch) {
          if ([...res.accepted, ...res.skipped].includes(s.id) && !failed.has(s.id))
            synced[s.id] = s.updatedAt;
        }
        f = { synced, meta: bi === 0 ? meta : f.meta, lastSyncAt: new Date().toISOString() };
        await saveFile(f);
        if (failed.size > 0) throw new Error('m.web.msgMedia');
      }
      setStatus('idle');
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        setStatus('signin');
        setMessage('m.web.msgExpired');
      } else if (e instanceof HttpError) {
        setStatus('error');
        setMessage(e.message);
      } else if (e instanceof Error && e.message === 'm.web.msgMedia') {
        setStatus('error');
        setMessage(e.message);
      } else {
        setStatus('offline');
        setMessage('m.web.msgOffline');
      }
    } finally {
      running.current = false;
    }
  }, [cfg, changed, saveFile, clearDeleted]);

  // Auto-sync: shortly after changes, and retry when offline/erroring.
  useEffect(() => {
    if (!cfg || pending === 0 || status === 'syncing' || status === 'signin') return;
    const wait = status === 'offline' || status === 'error' ? 60_000 : 4_000;
    const t = setTimeout(() => void syncNow(), wait);
    return () => clearTimeout(t);
  }, [cfg, pending, status, syncNow]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  const link = useCallback(
    async (input: LinkInput): Promise<string | null> => {
      if (!teacher) return 'm.web.errApp';
      const p = parseHttpUrl(input.serverUrl, true);
      if (!p) return 'm.web.errUrl';
      if (p.scheme === 'http' && !isPrivateHost(p.host)) return 'm.web.errHttps';
      if (!MOBILE_RE.test(input.mobile)) return 'login.err.mobile';
      if (input.password.length < 8) return 'login.err.pwShort';
      try {
        const phone = `+91${input.mobile}`;
        if (input.mode === 'register') {
          await http(`${p.url}/v1/auth/register`, {
            json: {
              name: teacher.name,
              school: teacher.school,
              phone,
              password: input.password,
              language: teacher.language,
            },
          });
        }
        const r = await http<AuthResponse>(`${p.url}/v1/auth/login`, {
          json: { phone, password: input.password },
        });
        const c: Config = { serverUrl: p.url, token: r.token, name: r.user.name };
        await SecureStore.setItemAsync(keyOf(teacher.id), JSON.stringify(c));
        setCfg(c);
        setStatus('idle');
        setMessage('');
        return null;
      } catch (e) {
        if (e instanceof HttpError) return e.message;
        return 'm.web.errUnreach';
      }
    },
    [teacher],
  );

  const unlink = useCallback(async () => {
    if (teacher) await SecureStore.deleteItemAsync(keyOf(teacher.id)).catch(() => {});
    setCfg(null);
    setStatus('unlinked');
    setMessage('');
    await saveFile(EMPTY_FILE);
  }, [teacher, saveFile]);

  const value = useMemo<Sync>(
    () => ({
      linked: !!cfg,
      serverUrl: cfg?.serverUrl ?? '',
      accountName: cfg?.name ?? '',
      status,
      message,
      pending,
      lastSyncAt: file.lastSyncAt,
      link,
      unlink,
      syncNow,
    }),
    [cfg, status, message, pending, file.lastSyncAt, link, unlink, syncNow],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): Sync {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSync outside SyncProvider');
  return s;
}

/** Uploads the media the server asked for. Returns ids of submissions where something failed. */
async function uploadMedia(
  cfg: Config,
  batch: AppData['submissions'],
  wanted: MediaWanted,
): Promise<Set<string>> {
  const failed = new Set<string>();
  const put = async (kind: string, id: string, uri: string, ext: string, owner: string) => {
    try {
      const r = await FileSystem.uploadAsync(
        `${cfg.serverUrl}/v1/media/${kind}/${id}?ext=${ext}`,
        uri,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            authorization: `Bearer ${cfg.token}`,
            'content-type': 'application/octet-stream',
          },
        },
      );
      if (r.status !== 200) failed.add(owner);
    } catch {
      failed.add(owner);
    }
  };

  for (const s of batch) {
    for (const p of s.pages)
      if (wanted.pages.includes(p.id)) await put('page', p.id, p.uri, 'jpg', s.id);
    if (s.voice && wanted.voice.includes(s.id)) await put('voice', s.id, s.voice.uri, 'm4a', s.id);
    for (const a of s.attachments) {
      const w = wanted.attachments.find((x) => x.id === a.id);
      if (w && a.uri) await put('attachment', a.id, a.uri, w.ext, s.id);
    }
  }
  return failed;
}
