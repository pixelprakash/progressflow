import { z } from 'zod';
import {
  AnnotationTool,
  AssessmentKind,
  AssessorType,
  AttachmentKind,
  CaptureIssue,
  Language,
  PerformanceLevel,
  TranscriptStatus,
  UserRole,
} from './enums.js';

/**
 * Core entities. Every entity carries a client-generatable UUID `id`,
 * `createdAt`/`updatedAt` ISO timestamps, and a soft-delete `deletedAt`
 * so the sync engine can move rows in either direction without server-
 * generated keys on the write path.
 */

const base = {
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().default(null),
};

export const School = z.object({
  ...base,
  name: z.string().min(1).max(160),
  district: z.string().max(120).default(''),
});
export type School = z.infer<typeof School>;

export const User = z.object({
  ...base,
  schoolId: z.string().uuid(),
  role: UserRole,
  displayName: z.string().min(1).max(120),
  /** E.164, teachers only (phone-OTP auth). */
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/)
    .nullable()
    .default(null),
  languagePref: Language.default('en'),
});
export type User = z.infer<typeof User>;

export const Klass = z.object({
  ...base,
  schoolId: z.string().uuid(),
  teacherId: z.string().uuid(),
  name: z.string().min(1).max(80), // "Class 7-B"
  grade: z.number().int().min(1).max(12),
  section: z.string().regex(/^[A-Z]$/),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/), // "2026-27"
});
export type Klass = z.infer<typeof Klass>;

export const Student = z.object({
  ...base,
  schoolId: z.string().uuid(),
  displayName: z.string().min(1).max(120),
  /** Short code a student types to open their portal / peer-review form. */
  joinCode: z.string().regex(/^[A-Z0-9]{6}$/),
  guardianName: z.string().max(120).default(''),
  /** Roll number as written on the artwork; the scanner matches on it. */
  rollNo: z.string().max(20).default(''),
});
export type Student = z.infer<typeof Student>;

export const Enrollment = z.object({
  ...base,
  klassId: z.string().uuid(),
  studentId: z.string().uuid(),
});
export type Enrollment = z.infer<typeof Enrollment>;

export const Assignment = z.object({
  ...base,
  klassId: z.string().uuid(),
  rubricId: z.string().uuid(),
  title: z.string().min(1).max(160),
  medium: z.string().max(80).default(''), // "Still life — pencil"
  dueOn: z.string().date().nullable().default(null),
});
export type Assignment = z.infer<typeof Assignment>;

export const ConsentRecord = z.object({
  ...base,
  studentId: z.string().uuid(),
  guardianName: z.string().min(1).max(120),
  /** What the guardian consented to (media capture, sharing with admin, etc). */
  scope: z.array(z.string()).min(1),
  grantedAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable().default(null),
});
export type ConsentRecord = z.infer<typeof ConsentRecord>;

// ---------------------------------------------------------------------------
// Assessment aggregate (F1 scoring, F2 media/voice, F3 peer/self)
// ---------------------------------------------------------------------------

export const Assessment = z.object({
  ...base,
  assignmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  assessorType: AssessorType,
  /** User id for teacher, student id for self/peer. */
  assessorId: z.string().uuid(),
  kind: AssessmentKind.default('regular'),
  /** Teacher's free-text note about this submission. */
  note: z.string().max(4000).default(''),
  submittedAt: z.string().datetime().nullable().default(null),
  /** Server-set once accepted; used only for observability, not conflict logic. */
  serverSyncedAt: z.string().datetime().nullable().default(null),
});
export type Assessment = z.infer<typeof Assessment>;

export const CriterionScore = z.object({
  ...base,
  assessmentId: z.string().uuid(),
  criterionKey: z.string().max(40),
  level: PerformanceLevel,
  note: z.string().max(500).default(''),
});
export type CriterionScore = z.infer<typeof CriterionScore>;

/** Result of the on-device capture checks (blur, resolution, light, framing). */
export const CaptureQuality = z.object({
  /** 0..1, higher is better. Below the retake threshold the app asks for a retake. */
  score: z.number().min(0).max(1),
  issues: z.array(CaptureIssue),
  /** Laplacian variance ÷ luminance variance on a downscaled copy (focus measure). */
  sharpness: z.number().nonnegative(),
  /** Mean luminance 0..255. */
  brightness: z.number().min(0).max(255),
});
export type CaptureQuality = z.infer<typeof CaptureQuality>;

export const ArtworkPhoto = z.object({
  ...base,
  assessmentId: z.string().uuid(),
  storageKey: z.string(), // key in Firebase Storage / MinIO
  thumbKey: z.string().nullable().default(null),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  quality: CaptureQuality.nullable().default(null),
  /** Local file URI while the upload is still queued on the device. */
  localUri: z.string().nullable().default(null),
});
export type ArtworkPhoto = z.infer<typeof ArtworkPhoto>;

export const AnnotationStroke = z.object({
  tool: AnnotationTool,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().positive(),
  /** Normalised 0..1 points relative to the photo, so it renders at any size. */
  points: z.array(z.tuple([z.number(), z.number()])).min(1),
});
export type AnnotationStroke = z.infer<typeof AnnotationStroke>;

export const Annotation = z.object({
  ...base,
  photoId: z.string().uuid(),
  strokes: z.array(AnnotationStroke),
  /** Storage key of the flattened photo+markup PNG, generated on save. */
  flattenedKey: z.string().nullable().default(null),
});
export type Annotation = z.infer<typeof Annotation>;

export const VoiceNote = z.object({
  ...base,
  assessmentId: z.string().uuid(),
  storageKey: z.string(),
  localUri: z.string().nullable().default(null),
  durationMs: z.number().int().nonnegative(),
  language: Language,
  transcriptStatus: TranscriptStatus.default('pending'),
  transcript: z.string().default(''),
  transcriptConfidence: z.number().min(0).max(1).nullable().default(null),
  /** Teacher-corrected transcript, if edited. Audio is always the fallback. */
  transcriptEdited: z.string().nullable().default(null),
});
export type VoiceNote = z.infer<typeof VoiceNote>;

/** Reference material or a note the teacher attaches to feedback for a student. */
export const FeedbackAttachment = z.object({
  ...base,
  assessmentId: z.string().uuid(),
  kind: AttachmentKind,
  /** Display name: file name, link title, or first words of a note. */
  title: z.string().max(160).default(''),
  /** `image`/`file`: storage key. `link`: the URL. `note`: unused. */
  storageKey: z.string().nullable().default(null),
  url: z.string().url().nullable().default(null),
  text: z.string().max(2000).default(''),
  /** Local file URI while the upload is still queued on the device. */
  localUri: z.string().nullable().default(null),
});
export type FeedbackAttachment = z.infer<typeof FeedbackAttachment>;

/** One guided peer/self-review answer (F3). */
export const ReviewResponse = z.object({
  ...base,
  assessmentId: z.string().uuid(),
  promptKey: z.string().max(60),
  /** e.g. "yes" | "partly" | "not_yet" for scale prompts. */
  choice: z.string().max(40).nullable().default(null),
  text: z.string().max(500).default(''),
});
export type ReviewResponse = z.infer<typeof ReviewResponse>;

/** Materialised growth points for F4/F5 curves. Recomputed on assessment write. */
export const ProgressSnapshot = z.object({
  ...base,
  studentId: z.string().uuid(),
  klassId: z.string().uuid(),
  criterionKey: z.string().max(40),
  /** ISO week or month bucket, e.g. "2026-10". */
  period: z.string(),
  meanLevel: z.number().min(1).max(4),
  sampleSize: z.number().int().positive(),
});
export type ProgressSnapshot = z.infer<typeof ProgressSnapshot>;
