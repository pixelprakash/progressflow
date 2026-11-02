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
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import type { AppData, ClassRoom, RosterStudent, Submission } from './domain';
import { demoData, migrate } from './demo';

/**
 * Local persistence: one JSON file in the app's document directory, media files
 * beside it. A stand-in until Spike 1 chooses the sync layer — all screens go
 * through this context, so swapping it later touches only this file.
 */

const BASE = `${FileSystem.documentDirectory ?? ''}progressflow/`;

// Folder of the signed-in teacher; set by StoreProvider before any screen can use it.
let activeRoot = BASE;

const EMPTY: AppData = { classes: [], students: [], submissions: [] };

/** Folder holding the signed-in teacher's files (state.json, media). */
export const dataRoot = () => activeRoot;

export const newId = () => Crypto.randomUUID();

export async function persistMedia(srcUri: string, folder: string, ext: string): Promise<string> {
  const dir = `${activeRoot}${folder}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${newId()}.${ext}`;
  await FileSystem.copyAsync({ from: srcUri, to: dest });
  return dest;
}

interface Store {
  ready: boolean;
  data: AppData;
  /** Replace an empty account with the sample classes, for trying the app. */
  loadSample: () => void;
  addClass: (c: ClassRoom) => void;
  addStudent: (s: RosterStudent) => void;
  addSubmissions: (subs: Submission[]) => void;
  updateSubmission: (id: string, patch: (s: Submission) => Submission) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ dataDir, children }: { dataDir: string; children: ReactNode }) {
  const root = `${BASE}${dataDir}`;
  const stateFile = `${root}state.json`;
  activeRoot = root;
  const [data, setData] = useState<AppData>({ classes: [], students: [], submissions: [] });
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await FileSystem.makeDirectoryAsync(root, { intermediates: true });
        const info = await FileSystem.getInfoAsync(stateFile);
        setData(
          info.exists ? migrate(JSON.parse(await FileSystem.readAsStringAsync(stateFile))) : EMPTY,
        );
      } catch {
        setData(EMPTY);
      }
      setReady(true);
    })();
  }, []);

  const persist = useCallback((next: AppData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      FileSystem.writeAsStringAsync(stateFile, JSON.stringify(next)).catch(() => {});
    }, 300);
  }, []);

  const apply = useCallback(
    (fn: (d: AppData) => AppData) =>
      setData((prev) => {
        const next = fn(prev);
        persist(next);
        return next;
      }),
    [persist],
  );

  const value = useMemo<Store>(
    () => ({
      ready,
      data,
      loadSample: () => apply((d) => (d.classes.length === 0 ? demoData(newId) : d)),
      addClass: (c) => apply((d) => ({ ...d, classes: [...d.classes, c] })),
      addStudent: (st) => apply((d) => ({ ...d, students: [...d.students, st] })),
      addSubmissions: (subs) => apply((d) => ({ ...d, submissions: [...d.submissions, ...subs] })),
      updateSubmission: (id, patch) =>
        apply((d) => ({
          ...d,
          submissions: d.submissions.map((s) =>
            s.id === id ? { ...patch(s), updatedAt: new Date().toISOString() } : s,
          ),
        })),
    }),
    [ready, data, apply],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
