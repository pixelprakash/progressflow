import { z } from 'zod';
import { AnnotationStroke, CaptureQuality } from './entities.js';
import { AssessmentKind, AttachmentKind, Language, PerformanceLevel } from './enums.js';

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
  kind: AssessmentKind,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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

export const SyncPushBody = z.object({
  classes: z.array(SyncClass).max(200),
  students: z.array(SyncStudent).max(5000),
  submissions: z.array(SyncSubmission).max(100),
});
export type SyncPushBody = z.infer<typeof SyncPushBody>;

export interface MediaWanted {
  pages: string[];
  voice: string[];
  attachments: { id: string; ext: string }[];
}

export interface SyncPushResponse {
  accepted: string[];
  /** Submissions the server already had in a newer version. */
  skipped: string[];
  mediaWanted: MediaWanted;
  serverTime: string;
}

export const MEDIA_KINDS = ['page', 'voice', 'attachment'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
