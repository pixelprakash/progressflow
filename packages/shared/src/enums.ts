import { z } from 'zod';

/** Languages ProgressFlow supports for UI and voice transcription. */
export const Language = z.enum(['en', 'hi', 'te']);
export type Language = z.infer<typeof Language>;

/** BCP-47 codes passed to Google Cloud Speech-to-Text. */
export const SPEECH_LANGUAGE_CODES: Record<Language, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
};

export const UserRole = z.enum(['teacher', 'student', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

/** Who produced an assessment. Drives F3 (peer/self) vs teacher scoring. */
export const AssessorType = z.enum(['teacher', 'self', 'peer']);
export type AssessorType = z.infer<typeof AssessorType>;

/** Rubric performance levels. Four levels, from the four-component framework. */
export const PERFORMANCE_LEVELS = [1, 2, 3, 4] as const;
export const PerformanceLevel = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type PerformanceLevel = z.infer<typeof PerformanceLevel>;

/** Lifecycle of an async Google Speech transcription job. */
export const TranscriptStatus = z.enum([
  'pending', // audio uploaded, job not yet started
  'processing', // long-running recognize in flight
  'done',
  'failed',
]);
export type TranscriptStatus = z.infer<typeof TranscriptStatus>;

/** Per-record sync state on the device (never sent to the server). */
export const SyncState = z.enum(['dirty', 'syncing', 'synced', 'conflict']);
export type SyncState = z.infer<typeof SyncState>;

export const AnnotationTool = z.enum(['circle', 'highlight', 'arrow', 'freehand']);
export type AnnotationTool = z.infer<typeof AnnotationTool>;

/**
 * Kind of formative evidence a submission represents. Lets the teacher and the
 * progress views separate quick sketches from portfolio pieces.
 */
export const AssessmentKind = z.enum(['sketch', 'regular', 'progress', 'portfolio']);
export type AssessmentKind = z.infer<typeof AssessmentKind>;

/**
 * The id of a teacher's assessment type. Built-ins are 'assignment', 'exam1', 'exam2',
 * 'quarterly', 'sketch', 'progress', 'portfolio' (and legacy 'regular'); a teacher can add
 * their own, so on the wire it is any short id. Names live in `TeacherConfig.types`.
 */
export const AssessmentKindId = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/);
export type AssessmentKindId = z.infer<typeof AssessmentKindId>;

/** What a teacher can attach to feedback besides the voice note. */
export const AttachmentKind = z.enum(['image', 'file', 'link', 'note']);
export type AttachmentKind = z.infer<typeof AttachmentKind>;

/** Why a scan was flagged for retake. Drives the retake prompt on the device. */
export const CaptureIssue = z.enum([
  'blurry',
  'low_resolution',
  'too_dark',
  'overexposed',
  'tilted_or_cropped',
  'orientation_mismatch',
]);
export type CaptureIssue = z.infer<typeof CaptureIssue>;
