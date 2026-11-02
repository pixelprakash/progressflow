/**
 * Offline-first local store — INTERFACE ONLY (Spike 1).
 *
 * ProgressFlow must work with no connectivity: the teacher scores a full class,
 * photographs and annotates work, records voice notes — all written locally and
 * synced later. This interface is what the rest of the app codes against so the
 * spike can swap the implementation without touching feature code.
 *
 * Candidates to evaluate (ROADMAP.md §5):
 *   1. PowerSync      — hosted sync service + SQLite; Postgres-native.
 *   2. WatermelonDB   — SQLite + custom sync adapter against /v1/sync.
 *   3. Custom         — expo-sqlite + a hand-written change log.
 *
 * Decision criteria: write latency on low-end Android, conflict handling
 * (teacher score must win), binary/media handling, bundle size, maintenance.
 */
import type { SyncChange } from '@progressflow/shared';

export interface LocalRecord {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalStore {
  /** Read one record by id from a synced table. */
  get<T extends LocalRecord>(table: string, id: string): Promise<T | null>;

  /** Query records with a simple equality filter. */
  query<T extends LocalRecord>(table: string, where?: Partial<T>): Promise<T[]>;

  /** Upsert locally and mark the row dirty for the next sync. */
  put<T extends LocalRecord>(table: string, record: T): Promise<void>;

  /** Soft-delete locally and mark dirty. */
  remove(table: string, id: string): Promise<void>;

  /** Everything changed locally since it was last pushed. */
  pendingChanges(): Promise<SyncChange[]>;

  /** Apply a batch pulled from the server (no dirty flag). */
  applyRemote(changes: SyncChange[]): Promise<void>;

  /** Opaque cursor bookkeeping for the sync loop. */
  getCursor(): Promise<string | null>;
  setCursor(cursor: string): Promise<void>;
}

/** Placeholder so imports resolve before the spike picks an implementation. */
export const localStore: LocalStore = new Proxy({} as LocalStore, {
  get() {
    throw new Error('LocalStore not implemented yet — see Spike 1 (ROADMAP.md §5).');
  },
});
