# Spike 1 — Offline sync engine

**Status:** not started · **Owner:** project lead · **Time-box:** 3 days
**Blocks:** F1–F5. Nothing else in Phase 1 should start until the direction is chosen.

## Why this is the first spike

"Works offline" is a hard requirement from the research: 50+ students, two periods
a week, low-resource classrooms with poor connectivity. If sync is wrong, every
feature inherits the problem. Getting it right (or picking the right library) now
is cheaper than retrofitting in November.

## The question

Which approach gives us reliable offline writes + a correct merge, on low-end
Android, with acceptable effort to build and maintain?

| Option | What it is | Watch for |
|---|---|---|
| **PowerSync** | Hosted sync service; SQLite on device, streams from Postgres | Cost; hosted dependency; fits our Postgres well |
| **WatermelonDB** | SQLite ORM + bring-your-own sync adapter against `/v1/sync` | We write the server merge logic; mature, offline-proven |
| **Custom** | `expo-sqlite` + hand-written change log + `/v1/sync` | Most control, most code, most bugs |

## Acceptance criteria for the spike

1. Create a `CriterionScore` with the device in airplane mode → it persists across
   an app restart.
2. Reconnect → the row reaches Postgres via `/v1/sync/push`.
3. Two devices edit the same `Assessment`'s different fields offline → after both
   sync, no data is lost (per-field LWW).
4. A `self` assessment and a `teacher` assessment touch the same `CriterionScore`
   → the teacher value wins regardless of timestamp order.
5. Measured write latency for a single score on a mid-range Android (< ₹12k phone
   or an equivalent emulator profile): note the number.
6. Media rows (`ArtworkPhoto`, `VoiceNote`) sync their metadata; the binary goes
   through the signed-URL upload queue, not the sync envelope.

## Deliverables

- A working implementation of `apps/mobile/src/data/localStore.ts`.
- The real `/v1/sync/push` + `/v1/sync/pull` handlers in `apps/server/src/routes/sync.ts`.
- A short decision note appended here: choice, why, latency numbers, risks carried forward.
- If a library is chosen: it's added to `package.json` and the `newArchEnabled`
  compatibility is confirmed.

## Contract (already defined)

See `packages/shared/src/sync.ts` — `SyncChange`, `SyncPushRequest`,
`SyncPullResponse`, `SyncConflict`, and `SYNC_TABLES` (dependency order).
