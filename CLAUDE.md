# ProgressFlow — working notes for Claude

## What this is

Mobile formative-assessment app for art & design educators. Grant-funded, 6-month
MVP (Aug–Dec 2026). Scope and phases: [ROADMAP.md](ROADMAP.md).

## Layout

- `packages/shared` — domain model (zod schemas + types). **Source of truth.**
  Changes here ripple to both apps; update `prisma/schema.prisma` to match.
- `apps/server` — Express + Prisma + Postgres. ESM, `type: module`, `.js` import
  specifiers required (NodeNext).
- `apps/mobile` — Expo (SDK 52, new architecture). Plain `App.tsx` entry, no
  expo-router yet.
- `apps/web` — teacher dashboard and student portal (Vite + React), served by the API in prod.
  All text goes through `packages/shared/src/i18n` (en/hi/te): no hardcoded strings.
- `apps/site` — public project page (static). Plain CSS, no Tailwind; keep it WCAG 2.2 AA.
- `infra/docker-compose.yml` — Postgres + MinIO for local dev.

## Conventions

- TypeScript strict everywhere; `noUncheckedIndexedAccess` is on.
- Every synced entity: client-minted `id` (uuid), `createdAt`, `updatedAt`,
  nullable `deletedAt`. No server-generated keys on the write path.
- Validate all request bodies with the zod schemas from `@progressflow/shared`.
- Prisma schema and `packages/shared/src/entities.ts` must stay in step.

## Non-negotiables (from the research)

- Offline-first. Never block the teacher on the network.
- Trilingual voice: Hindi, Telugu, English.
- Minors' data — consent + encryption + access control (DPDP Act 2023).

## Current phase

Phase 0. Next task is **Spike 1** (offline sync) —
[docs/spike-1-offline-sync.md](docs/spike-1-offline-sync.md). Don't start F1–F5
feature work until the sync direction is chosen.

Exception (2 Nov 2026, owner's call): the capture → review → rubric → annotate →
feedback UI in `apps/mobile` was built ahead of Spike 1 to get a testable APK.
It persists through `apps/mobile/src/store.tsx` (JSON file stand-in). Spike 1
replaces that file only; screens must not touch storage directly.

Sync direction was chosen on 3 Nov 2026: snapshot push, phone is the only
writer (docs/web-and-sync.md). The old table-envelope sketch is superseded.

The mobile app uses native modules, so it needs a dev/EAS build, not Expo Go —
see [docs/build-apk.md](docs/build-apk.md).

Mobile app, 4 Nov 2026 (owner's call, still ahead of Spike 1; all in `store.tsx`):
- Capture is batch-first and **original by default**: `BatchCaptureScreen` (expo-camera, no
  cropping or filters) → inbox → `InboxScreen` reads names (ML Kit, header first) and files
  papers on student profiles. The ML Kit document scanner is an opt-in mode and may enhance.
- Assessment types (`AppData.types`) and the rubric (`AppData.rubric`) are teacher-editable.
  `Submission.kind` is a free string; `syncMap.toServerKind` folds it to the server's four kinds
  until the server learns teacher-defined types. Custom criterion keys sync as-is.
- `Submission.completedAt` is set by the Save button (device-only for now, not synced).
- Reports (PDF/Word/Excel/CSV) are built in `src/reports/` from one neutral model; roster import
  in `src/import/roster.ts`; chart maths in `src/analytics.ts`. Logic tests: `npm run test:mobile`.
- Deleting a class/student/submission erases its files on the phone but is **not** propagated to
  the server (snapshot push only adds/updates).

## Common commands

```bash
npm run build:shared          # after editing packages/shared
npm run db:up && npm run db:migrate
npm run dev:server            # :4000
npm run dev:mobile
npm run typecheck             # all workspaces
npm run test:mobile           # roster import, analytics, report files, name matching
npm run build:apk             # local Android APK (see docs/build-apk.md)
npm run dev:db && npm run dev:server && npm run dev:web   # see docs/web-and-sync.md
```
