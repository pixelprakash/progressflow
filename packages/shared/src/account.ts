import { z } from 'zod';
import { AnnotationStroke, CaptureQuality } from './entities.js';
import { AssessmentKindId, AttachmentKind, Language, PerformanceLevel } from './enums.js';

/**
 * Teacher account + snapshot sync contract (phone/web <-> server).
 *
 * The phone is the writer. It pushes whole classes, students and the
 * submissions that changed since its last push; the server stores them in the
 * relational model and the web dashboard reads from there. Conflicts are
 * last-write-wins per submission on `updatedAt` (the web is read-only for now).
 * This replaces the generic table envelope in sync.ts as the Spike 1 direction.
 */

const phone = z.string().regex(/^\+[1-9]\d{6,14}$/);

export const RegisterBody = z.object({
  name: z.string().trim().min(2).max(120),
  school: z.string().trim().min(2).max(160),
  phone,
  password: z.string().min(8).max(128),
  language: Language.default('en'),
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const LoginBody = z.object({
  phone,
  password: z.string().min(1).max(128),
  /** Web sets this to also receive an httpOnly session cookie. */
  cookie: z.boolean().default(false),
});
export type LoginBody = z.infer<typeof LoginBody>;

export interface TeacherProfile {
  id: string;
  name: string;
  school: string;
  phone: string;
  language: Language;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: TeacherProfile;
}

// --- snapshot sync ---------------------------------------------------------

export const SyncClass = z.object({
  id: z.string().uuid(),
  grade: z.number().int().min(1).max(12),
  section: z.string().regex(/^[A-Z]$/),
  assignment: z.string().max(160),
});

export const SyncStudent = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
  name: z.string().min(1).max(120),
  rollNo: z.string().max(20),
});

export const SyncSubmission = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  kind: AssessmentKindId,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** When the teacher pressed Save on the evaluation; null if never saved. */
  completedAt: z.string().datetime().nullable().default(null),
  note: z.string().max(4000),
  scores: z.record(PerformanceLevel),
  pages: z.array(
    z.object({
      id: z.string().uuid(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      quality: CaptureQuality.nullable(),
    }),
  ),
  /** Strokes keyed by page id. */
  strokes: z.record(z.array(AnnotationStroke)),
  voice: z.object({ durationMs: z.number().int().nonnegative(), language: Language }).nullable(),
  attachments: z.array(
    z.object({
      id: z.string().uuid(),
      kind: AttachmentKind,
      title: z.string().max(160),
      url: z.string().max(2000).nullable(),
      text: z.string().max(2000).nullable(),
      /** File extension of the uploaded media, for image/file attachments. */
      ext: z
        .string()
        .regex(/^[a-z0-9]{1,5}$/)
        .nullable(),
    }),
  ),
});
export type SyncSubmission = z.infer<typeof SyncSubmission>;

/** A teacher's own assessment type: the id is stored on submissions, the label is what they see. */
export const SyncType = z.object({
  id: AssessmentKindId,
  /** Absent for a built-in type that has not been renamed. */
  label: z.string().trim().min(1).max(60).optional(),
});
export type SyncType = z.infer<typeof SyncType>;

/** One criterion of the teacher's rubric, as they edited it on the phone. */
export const SyncCriterion = z.object({
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .max(40),
  name: z.string().trim().min(1).max(80),
  icon: z.string().max(60),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  tagline: z.string().max(200),
  askStudent: z.string().max(300),
  lookFor: z.array(z.object({ title: z.string().max(80), text: z.string().max(400) })).max(6),
  levels: z.object({
    1: z.string().max(400),
    2: z.string().max(400),
    3: z.string().max(400),
    4: z.string().max(400),
  }),
});
export type SyncCriterion = z.infer<typeof SyncCriterion>;

/** Things the teacher deleted on the phone since the last push. Unknown or foreign ids are ignored. */
export const SyncDeleted = z.object({
  classes: z.array(z.string().uuid()).max(200).default([]),
  students: z.array(z.string().uuid()).max(5000).default([]),
  submissions: z.array(z.string().uuid()).max(5000).default([]),
});
export type SyncDeleted = z.infer<typeof SyncDeleted>;

export const SyncPushBody = z.object({
  classes: z.array(SyncClass).max(200),
  students: z.array(SyncStudent).max(5000),
  submissions: z.array(SyncSubmission).max(100),
  /** The teacher's assessment types, in order. Omitted = unchanged. */
  types: z.array(SyncType).max(30).optional(),
  /** The teacher's rubric. `null` = back to the standard four; omitted = unchanged. */
  rubric: z.array(SyncCriterion).min(1).max(8).nullable().optional(),
  deleted: SyncDeleted.default({}),
});
export type SyncPushBody = z.infer<typeof SyncPushBody>;

export interface MediaWanted {
  pages: string[];
  voice: string[];
  attachments: { id: string; ext: string }[];
}

export interface SyncPushResponse {
  /** Ids from `deleted` that are now gone on the server (or were never there). */
  deleted?: SyncDeleted;
  accepted: string[];
  /** Submissions the server already had in a newer version. */
  skipped: string[];
  mediaWanted: MediaWanted;
  serverTime: string;
}

export const MEDIA_KINDS = ['page', 'voice', 'attachment'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
