import { z } from 'zod';

/**
 * Sync envelope — the contract for the offline-first engine (Spike 1).
 *
 * The device pushes a batch of changed rows and pulls everything updated since
 * its last cursor. Conflict resolution is last-write-wins **per field** using
 * `updatedAt`, with one carve-out: a teacher `CriterionScore` always beats a
 * non-teacher write to the same row. Keep this file in step with whichever
 * library wins the spike (PowerSync / WatermelonDB / custom).
 */

/** Tables that participate in sync, in dependency order (parents first). */
export const SYNC_TABLES = [
  'schools',
  'users',
  'students',
  'klasses',
  'enrollments',
  'rubrics',
  'assignments',
  'consent_records',
  'assessments',
  'criterion_scores',
  'artwork_photos',
  'annotations',
  'voice_notes',
  'feedback_attachments',
  'review_responses',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export const ChangeOp = z.enum(['upsert', 'delete']);
export type ChangeOp = z.infer<typeof ChangeOp>;

export const SyncChange = z.object({
  table: z.enum(SYNC_TABLES),
  op: ChangeOp,
  /** Full row for upsert; `{ id }` for delete. Validated per-table server-side. */
  row: z.record(z.unknown()),
  /** Client's updatedAt for this row; the tiebreak key. */
  updatedAt: z.string().datetime(),
});
export type SyncChange = z.infer<typeof SyncChange>;

export const SyncPushRequest = z.object({
  deviceId: z.string().uuid(),
  /** Opaque cursor from the last successful pull; null on first sync. */
  since: z.string().nullable(),
  changes: z.array(SyncChange).max(500),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequest>;

export const SyncConflict = z.object({
  table: z.enum(SYNC_TABLES),
  id: z.string().uuid(),
  reason: z.string(),
  /** The row the server kept, so the client can reconcile its local copy. */
  serverRow: z.record(z.unknown()),
});
export type SyncConflict = z.infer<typeof SyncConflict>;

export const SyncPullResponse = z.object({
  changes: z.array(SyncChange),
  conflicts: z.array(SyncConflict),
  /** Cursor to pass as `since` next time. */
  cursor: z.string(),
  hasMore: z.boolean(),
});
export type SyncPullResponse = z.infer<typeof SyncPullResponse>;
