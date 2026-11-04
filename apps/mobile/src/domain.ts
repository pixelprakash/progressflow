import type {
  AnnotationStroke,
  AttachmentKind,
  CaptureQuality,
  CriterionGuide,
  Language,
  PerformanceLevel,
} from '@progressflow/shared';

/** Device-side shapes. Persisted by `store.tsx` until Spike 1 picks the sync layer. */

export interface ClassRoom {
  id: string;
  /** School grade, e.g. 7. */
  grade: number;
  /** Section letter, e.g. "B". */
  section: string;
  /** What the class is currently working on. */
  assignment: string;
}

export const classLabel = (c: Pick<ClassRoom, 'grade' | 'section'>) => `${c.grade}-${c.section}`;

export const sortClasses = (cs: ClassRoom[]) =>
  [...cs].sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));

export interface RosterStudent {
  id: string;
  classId: string;
  name: string;
  rollNo: string;
}

export interface Page {
  id: string;
  uri: string;
  width: number;
  height: number;
  quality: CaptureQuality | null;
}

export interface VoiceClip {
  uri: string;
  durationMs: number;
  language: Language;
}

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  title: string;
  uri?: string;
  url?: string;
  text?: string;
}

export interface Submission {
  id: string;
  studentId: string;
  /** Id of an `AssessmentType`: built-in ('assignment', 'exam1'…) or one the teacher made. */
  kind: string;
  createdAt: string;
  updatedAt: string;
  /** Set when the teacher presses Save on the evaluation; cleared by later edits (updatedAt moves past it). */
  completedAt?: string | null;
  pages: Page[];
  scores: Partial<Record<string, PerformanceLevel>>;
  /** Annotation strokes per page id. */
  strokes: Record<string, AnnotationStroke[]>;
  voice: VoiceClip | null;
  attachments: Attachment[];
  note: string;
}

/** A photo captured in a batch and not yet matched to a student. */
export interface InboxItem {
  id: string;
  classId: string;
  uri: string;
  width: number;
  height: number;
  createdAt: string;
  /** Filled in by the sorting pass. */
  quality?: CaptureQuality | null;
  /** Student the sorting pass suggested, if it found one. */
  guessId?: string | null;
  /** 0–1; how sure the sorting pass was. */
  guessConfidence?: number;
  /** True once the sorting pass has looked at it. */
  sorted?: boolean;
}

/** A kind of assessment the teacher can file work under. `label` overrides the built-in name. */
export interface AssessmentType {
  id: string;
  label?: string;
}

export interface Prefs {
  /** 'scan' finds the page edges and crops, with no filters; 'original' keeps the camera photo whole. */
  captureMode: 'original' | 'scan';
}

export interface AppData {
  /** True while the classes are the built-in sample data. */
  sample?: boolean;
  classes: ClassRoom[];
  students: RosterStudent[];
  submissions: Submission[];
  /** Photos waiting to be sorted onto students. */
  inbox?: InboxItem[];
  /** The teacher's assessment types, in the order they chose. Absent = the defaults. */
  types?: AssessmentType[];
  /** The teacher's own rubric. Absent = the built-in four criteria. */
  rubric?: CriterionGuide[];
  prefs?: Prefs;
  /** Ids deleted on the phone that the server has not been told about yet. */
  deleted?: Tombstones;
}

export interface Tombstones {
  classes: string[];
  students: string[];
  submissions: string[];
}

export const noTombstones = (d: Tombstones | undefined): number =>
  d ? d.classes.length + d.students.length + d.submissions.length : 0;

/** Built-in assessment types: the id is what is stored; the name comes from the dictionary. */
export const BUILTIN_TYPE_ICONS: Record<string, string> = {
  assignment: 'clipboard-check-outline',
  exam1: 'file-document-edit-outline',
  exam2: 'file-document-edit-outline',
  quarterly: 'calendar-star',
  sketch: 'pencil-outline',
  progress: 'chart-line',
  portfolio: 'folder-star-outline',
};

export const DEFAULT_TYPES: AssessmentType[] = [
  { id: 'assignment' },
  { id: 'exam1' },
  { id: 'exam2' },
  { id: 'quarterly' },
  { id: 'sketch' },
  { id: 'progress' },
  { id: 'portfolio' },
];

export const isBuiltinType = (id: string) => id in BUILTIN_TYPE_ICONS;
export const typeIcon = (id: string) => BUILTIN_TYPE_ICONS[id] ?? 'tag-outline';

export const DEFAULT_PREFS: Prefs = { captureMode: 'scan' };

/** An evaluation counts as saved when the teacher pressed Save and has not changed it since. */
export const isSaved = (s: Pick<Submission, 'completedAt' | 'updatedAt'>) =>
  !!s.completedAt && s.completedAt >= s.updatedAt;

/** Mean of the marks given. Pass the rubric's keys to ignore marks for criteria since removed. */
export function compositeScore(
  scores: Submission['scores'],
  keys?: readonly string[],
): number | null {
  const v = Object.entries(scores)
    .filter(([k, n]) => n !== undefined && (!keys || keys.includes(k)))
    .map(([, n]) => n as PerformanceLevel);
  return v.length ? v.reduce<number>((a, b) => a + b, 0) / v.length : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
