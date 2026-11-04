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
import type { CriterionGuide } from '@progressflow/shared';
import type {
  AppData,
  AssessmentType,
  ClassRoom,
  InboxItem,
  Prefs,
  RosterStudent,
  Submission,
} from './domain';
import { DEFAULT_PREFS, isSaved } from './domain';
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

/** Every file a submission owns on the phone. */
const filesOf = (s: Submission): string[] => [
  ...s.pages.map((p) => p.uri),
  ...(s.voice ? [s.voice.uri] : []),
  ...s.attachments.flatMap((a) => (a.uri ? [a.uri] : [])),
];

/** Best effort: a file that is already gone is fine. Removing a child's work must really remove it. */
function deleteFiles(uris: string[]) {
  for (const uri of uris) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

/** Like `persistMedia`, then removes the source (a camera shot sitting in the cache folder). */
export async function moveMedia(srcUri: string, folder: string, ext: string): Promise<string> {
  const dest = await persistMedia(srcUri, folder, ext);
  FileSystem.deleteAsync(srcUri, { idempotent: true }).catch(() => {});
  return dest;
}

interface Store {
  ready: boolean;
  data: AppData;
  /** Replace an empty account with the sample classes, for trying the app. */
  loadSample: () => void;
  addClass: (c: ClassRoom) => void;
  updateClass: (id: string, patch: Partial<Omit<ClassRoom, 'id'>>) => void;
  /** Removes the class with its students, their work and any unsorted photos. */
  deleteClass: (id: string) => void;
  addStudent: (s: RosterStudent) => void;
  addStudents: (list: RosterStudent[]) => void;
  updateStudent: (id: string, patch: Partial<Omit<RosterStudent, 'id' | 'classId'>>) => void;
  /** Removes the student and all their work. */
  deleteStudent: (id: string) => void;
  addSubmissions: (subs: Submission[]) => void;
  updateSubmission: (id: string, patch: (s: Submission) => Submission) => void;
  /** Marks the evaluation saved; any later edit makes it unsaved again. */
  completeSubmission: (id: string) => void;
  deleteSubmission: (id: string) => void;
  /** Moves all work filed under one assessment type to another (when a type is deleted). */
  moveKind: (from: string, to: string) => void;
  addInbox: (items: InboxItem[]) => void;
  updateInbox: (id: string, patch: Partial<InboxItem>) => void;
  /** Drops photos from the inbox; `deleteFiles` also erases the image files. */
  removeInbox: (ids: string[], deleteFiles: boolean) => void;
  setTypes: (types: AssessmentType[]) => void;
  setRubric: (rubric: CriterionGuide[] | null) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ dataDir, children }: { dataDir: string; children: ReactNode }) {
  const root = `${BASE}${dataDir}`;
  const stateFile = `${root}state.json`;
  activeRoot = root;
  const [data, setData] = useState<AppData>({ classes: [], students: [], submissions: [] });
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest data for actions that must read it before changing it (file clean-up).
  const dataRef = useRef<AppData>(data);
  dataRef.current = data;

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
      updateClass: (id, patch) =>
        apply((d) => ({
          ...d,
          classes: d.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteClass: (id) => {
        const d = dataRef.current;
        const gone = new Set(d.students.filter((st) => st.classId === id).map((st) => st.id));
        deleteFiles([
          ...d.submissions.filter((x) => gone.has(x.studentId)).flatMap(filesOf),
          ...(d.inbox ?? []).filter((i) => i.classId === id).map((i) => i.uri),
        ]);
        apply((cur) => ({
          ...cur,
          classes: cur.classes.filter((c) => c.id !== id),
          students: cur.students.filter((st) => st.classId !== id),
          submissions: cur.submissions.filter((x) => !gone.has(x.studentId)),
          inbox: (cur.inbox ?? []).filter((i) => i.classId !== id),
        }));
      },
      addStudent: (st) => apply((d) => ({ ...d, students: [...d.students, st] })),
      addStudents: (list) => apply((d) => ({ ...d, students: [...d.students, ...list] })),
      updateStudent: (id, patch) =>
        apply((d) => ({
          ...d,
          students: d.students.map((st) => (st.id === id ? { ...st, ...patch } : st)),
        })),
      deleteStudent: (id) => {
        deleteFiles(dataRef.current.submissions.filter((x) => x.studentId === id).flatMap(filesOf));
        apply((d) => ({
          ...d,
          students: d.students.filter((st) => st.id !== id),
          submissions: d.submissions.filter((x) => x.studentId !== id),
        }));
      },
      addSubmissions: (subs) => apply((d) => ({ ...d, submissions: [...d.submissions, ...subs] })),
      updateSubmission: (id, patch) =>
        apply((d) => ({
          ...d,
          submissions: d.submissions.map((s) =>
            s.id === id ? { ...patch(s), updatedAt: new Date().toISOString() } : s,
          ),
        })),
      completeSubmission: (id) =>
        apply((d) => {
          const now = new Date().toISOString();
          return {
            ...d,
            submissions: d.submissions.map((s) =>
              s.id === id ? { ...s, updatedAt: now, completedAt: now } : s,
            ),
          };
        }),
      deleteSubmission: (id) => {
        const sub = dataRef.current.submissions.find((x) => x.id === id);
        if (sub) deleteFiles(filesOf(sub));
        apply((d) => ({ ...d, submissions: d.submissions.filter((x) => x.id !== id) }));
      },
      moveKind: (from, to) =>
        apply((d) => {
          const now = new Date().toISOString();
          return {
            ...d,
            submissions: d.submissions.map((s) =>
              s.kind !== from
                ? s
                : { ...s, kind: to, updatedAt: now, completedAt: isSaved(s) ? now : s.completedAt },
            ),
          };
        }),
      addInbox: (items) => apply((d) => ({ ...d, inbox: [...(d.inbox ?? []), ...items] })),
      updateInbox: (id, patch) =>
        apply((d) => ({
          ...d,
          inbox: (d.inbox ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      removeInbox: (ids, erase) => {
        const set = new Set(ids);
        if (erase)
          deleteFiles((dataRef.current.inbox ?? []).filter((i) => set.has(i.id)).map((i) => i.uri));
        apply((d) => ({ ...d, inbox: (d.inbox ?? []).filter((i) => !set.has(i.id)) }));
      },
      setTypes: (types) => apply((d) => ({ ...d, types })),
      setRubric: (rubric) => apply((d) => ({ ...d, rubric: rubric ?? undefined })),
      setPrefs: (patch) =>
        apply((d) => ({ ...d, prefs: { ...DEFAULT_PREFS, ...d.prefs, ...patch } })),
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
