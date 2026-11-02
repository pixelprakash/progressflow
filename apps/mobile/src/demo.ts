import type { AppData, ClassRoom, RosterStudent, Submission } from './domain';

/** Sample classes so the app is usable on first launch. Replaced by server data after Phase 1. */

const cid = (n: number) => `e0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const sidOf = (n: number) => `b0000000-0000-4000-8000-0000000${String(n).padStart(5, '0')}`;

const ASSIGNMENT = 'Still life — pencil';

export type IdGen = () => string;

/** Pure-JS v4 UUID, for callers without a crypto source (tests). The app passes expo-crypto's. */
const fallbackUuid: IdGen = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });

const CLASSES: [number, string, string[]][] = [
  [6, 'A', ['Ananya M.', 'Kabir J.', 'Sneha R.', 'Vikram D.']],
  [6, 'B', ['Pooja N.', 'Arjun L.', 'Zoya F.', 'Dev C.']],
  [7, 'A', ['Lakshmi V.', 'Harsh B.', 'Nisha G.', 'Tarun S.']],
  [7, 'B', ['Aarav K.', 'Diya S.', 'Ishaan R.', 'Meera T.', 'Rohan P.']],
  [8, 'A', ['Kavya P.', 'Rahul M.', 'Sana Q.', 'Varun T.']],
  [8, 'B', ['Isha K.', 'Aditya R.', 'Farah H.', 'Manoj Y.']],
];

/** Class 7-B keeps the ids the first release used, so saved work still lines up. */
export const CLASS_7B_ID = cid(4);
const LEGACY_7B_STUDENT = (i: number) => `b0000000-0000-4000-8000-00000000000${i + 1}`;

function build(mk: IdGen | null): { classes: ClassRoom[]; students: RosterStudent[] } {
  const classes: ClassRoom[] = [];
  const students: RosterStudent[] = [];
  let n = 100;
  CLASSES.forEach(([grade, section, names], ci) => {
    const classId = mk ? mk() : cid(ci + 1);
    classes.push({ id: classId, grade, section, assignment: ASSIGNMENT });
    names.forEach((name, i) => {
      const is7B = classId === CLASS_7B_ID;
      students.push({
        id: mk ? mk() : is7B ? LEGACY_7B_STUDENT(i) : sidOf(n++),
        classId,
        name,
        rollNo: String(i + 1),
      });
    });
  });
  return { classes, students };
}

function past(
  id: string,
  studentId: string,
  date: string,
  kind: Submission['kind'],
  s: [number, number, number, number],
): Submission {
  const [c, col, t, k] = s as [1 | 2 | 3 | 4, 1 | 2 | 3 | 4, 1 | 2 | 3 | 4, 1 | 2 | 3 | 4];
  return {
    id,
    studentId,
    kind,
    createdAt: date,
    updatedAt: date,
    pages: [],
    scores: { composition: c, colour_theory: col, technical_skill: t, conceptual_depth: k },
    strokes: {},
    voice: null,
    attachments: [],
    note: '',
  };
}

/**
 * Sample classes with ids minted per install. Fixed ids would collide on the
 * server the moment a second teacher tried the samples.
 */
export function demoData(mk: IdGen = fallbackUuid): AppData {
  const base = build(mk);
  const c7b = base.classes.find((c) => c.grade === 7 && c.section === 'B')!;
  const st = base.students.filter((x) => x.classId === c7b.id);
  const [aarav, diya] = [st[0]!.id, st[1]!.id];
  return {
    ...base,
    sample: true,
    submissions: [
      past(mk(), aarav, '2026-08-12T09:00:00.000Z', 'sketch', [2, 2, 2, 2]),
      past(mk(), aarav, '2026-09-09T09:00:00.000Z', 'regular', [3, 2, 3, 2]),
      past(mk(), aarav, '2026-10-07T09:00:00.000Z', 'progress', [3, 3, 3, 3]),
      past(mk(), aarav, '2026-10-21T09:00:00.000Z', 'portfolio', [4, 3, 4, 3]),
      past(mk(), diya, '2026-08-12T09:00:00.000Z', 'sketch', [3, 3, 2, 3]),
      past(mk(), diya, '2026-10-07T09:00:00.000Z', 'progress', [3, 4, 3, 3]),
    ],
  };
}

/**
 * Older saves (first release) had one class and no `classes` list. Move that
 * single roster into Class 7-B, add the other sample classes, keep all work.
 */
export function migrate(raw: unknown): AppData {
  const d = raw as Partial<AppData> | null;
  if (d && Array.isArray(d.classes) && Array.isArray(d.students) && Array.isArray(d.submissions)) {
    return { ...(d as AppData), sample: d.sample ?? true };
  }
  const base = build(null);
  const old = (d?.students ?? []) as Omit<RosterStudent, 'classId'>[];
  const oldIds = new Set(old.map((s) => s.id));
  return {
    sample: true,
    classes: base.classes,
    students: [
      ...old.map((s) => ({ ...s, classId: CLASS_7B_ID })),
      ...base.students.filter((s) => !oldIds.has(s.id)),
    ],
    submissions: d?.submissions ?? [],
  };
}
