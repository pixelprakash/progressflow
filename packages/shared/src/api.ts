import { z } from 'zod';
import { Language } from './enums.js';

/** REST DTOs that aren't part of the sync envelope. */

export const HealthResponse = z.object({
  status: z.literal('ok'),
  service: z.literal('progressflow-server'),
  version: z.string(),
  time: z.string().datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

// --- auth (teacher phone OTP) ---------------------------------------------

export const RequestOtpBody = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
});
export type RequestOtpBody = z.infer<typeof RequestOtpBody>;

export const VerifyOtpBody = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  code: z.string().regex(/^\d{6}$/),
});
export type VerifyOtpBody = z.infer<typeof VerifyOtpBody>;

export const AuthTokenResponse = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  userId: z.string().uuid(),
});
export type AuthTokenResponse = z.infer<typeof AuthTokenResponse>;

// --- media upload --------------------------------------------------------

export const SignUploadBody = z.object({
  /** "photo" | "audio" | "flattened" */
  kind: z.enum(['photo', 'audio', 'flattened']),
  contentType: z.string(),
  assessmentId: z.string().uuid(),
});
export type SignUploadBody = z.infer<typeof SignUploadBody>;

export const SignUploadResponse = z.object({
  uploadUrl: z.string().url(),
  storageKey: z.string(),
  /** Header the client must echo back on the PUT. */
  requiredHeaders: z.record(z.string()),
});
export type SignUploadResponse = z.infer<typeof SignUploadResponse>;

// --- transcription ------------------------------------------------------

export const TranscribeBody = z.object({
  voiceNoteId: z.string().uuid(),
  storageKey: z.string(),
  language: Language,
});
export type TranscribeBody = z.infer<typeof TranscribeBody>;

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
