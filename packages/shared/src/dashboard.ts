import type { AnnotationStroke, CaptureQuality } from './entities.js';
import type { AssessmentKind, AttachmentKind, Language } from './enums.js';
import type { ReviewView } from './student.js';

/** Read-only dashboard responses (server -> web). Scores are criterion key -> level 1..4. */

export type Scores = Record<string, number>;

export interface SubmissionSummary {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  classLabel: string;
  kind: AssessmentKind;
  createdAt: string;
  scores: Scores;
  average: number | null;
  pageCount: number;
  /** First page id, for a thumbnail. */
  coverPageId: string | null;
}

export interface ClassSummary {
  id: string;
  grade: number;
  section: string;
  label: string;
  assignment: string;
  studentCount: number;
  submissionCount: number;
  waiting: number;
  /** Mean level per criterion across the class's scored submissions. */
  criterionAverages: Scores;
  average: number | null;
}

export interface Overview {
  counts: {
    classes: number;
    students: number;
    submissions: number;
    waiting: number;
    pendingReviews: number;
  };
  average: number | null;
  classes: ClassSummary[];
  recent: SubmissionSummary[];
}

export interface TimePoint {
  t: string;
  scores: Scores;
  average: number;
}

export interface StudentRow {
  id: string;
  name: string;
  rollNo: string;
  submissionCount: number;
  latestAverage: number | null;
  firstAverage: number | null;
  history: TimePoint[];
  /** The code this student types to open their portal. */
  joinCode: string;
}

export interface ClassDetail {
  summary: ClassSummary;
  students: StudentRow[];
  /** Class mean per criterion by month. */
  trend: TimePoint[];
  submissions: SubmissionSummary[];
}

export interface StudentDetail {
  student: { id: string; name: string; rollNo: string; classId: string; classLabel: string };
  history: TimePoint[];
  submissions: SubmissionSummary[];
}

export interface SubmissionDetail {
  summary: SubmissionSummary;
  note: string;
  /** Opened for classmates to review. */
  peerOpen: boolean;
  reviews: { self: ReviewView | null; peers: ReviewView[] };
  pages: {
    id: string;
    width: number;
    height: number;
    quality: CaptureQuality | null;
    strokes: AnnotationStroke[];
  }[];
  voice: { durationMs: number; language: Language; mediaId: string } | null;
  attachments: {
    id: string;
    kind: AttachmentKind;
    title: string;
    url: string | null;
    text: string;
    ext: string | null;
  }[];
}
