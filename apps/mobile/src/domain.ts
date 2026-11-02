import type {
  AnnotationStroke,
  AssessmentKind,
  AttachmentKind,
  CaptureQuality,
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
  kind: AssessmentKind;
  createdAt: string;
  updatedAt: string;
  pages: Page[];
  scores: Partial<Record<string, PerformanceLevel>>;
  /** Annotation strokes per page id. */
  strokes: Record<string, AnnotationStroke[]>;
  voice: VoiceClip | null;
  attachments: Attachment[];
  note: string;
}

export interface AppData {
  /** True while the classes are the built-in sample data. */
  sample?: boolean;
  classes: ClassRoom[];
  students: RosterStudent[];
  submissions: Submission[];
}

export const KIND_META: Record<AssessmentKind, { label: string; hint: string; icon: string }> = {
  sketch: { label: 'Sketch', hint: 'Quick draft or study', icon: 'pencil-outline' },
  regular: {
    label: 'Regular check',
    hint: 'Routine class assessment',
    icon: 'clipboard-check-outline',
  },
  progress: { label: 'Progress check', hint: 'Compare with earlier work', icon: 'chart-line' },
  portfolio: {
    label: 'Portfolio piece',
    hint: 'Finished, best-work piece',
    icon: 'folder-star-outline',
  },
};

export function compositeScore(scores: Submission['scores']): number | null {
  const v = Object.values(scores).filter((n): n is PerformanceLevel => n !== undefined);
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
