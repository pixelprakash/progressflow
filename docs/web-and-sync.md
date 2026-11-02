# Web dashboard, accounts and sync

## Decision (3 Nov 2026): Spike 1 direction

Snapshot sync, phone as the only writer. The phone pushes whole classes,
students and the submissions that changed (`POST /v1/sync/push`), then uploads
photos, voice notes and attachments the server says it lacks
(`PUT /v1/media/:kind/:id`). Last write wins per submission on `updatedAt`.
The web dashboard is read-only, so there is nothing to merge.

Contract: `packages/shared/src/account.ts` (+ `dashboard.ts` for web reads).
Phone side: `apps/mobile/src/sync.tsx`, mapping in `syncMap.ts`.
Server side: `apps/server/src/routes/{auth,sync,media,dashboard}.ts`.
The generic table envelope in `sync.ts` is unused and superseded.

Not built: pulling data *down* to a new phone, and editing from the web.

## Run it (no Docker needed)

```bash
npm run dev:db        # real PostgreSQL on :5433 (embedded-postgres), data in .data/pg
npm run prisma:deploy -w @progressflow/server    # first time only
npm run dev:server    # API on :4000
npm run dev:web       # teacher dashboard on :5173 (proxies /v1 to :4000)
npm run dev:site      # project page on :5174
npm run test:e2e      # 31 checks against the running server
```

Production: `npm run build:web`, then the API server serves `apps/web/dist` on
the same origin. The session is an httpOnly cookie, so keep it same-origin.

Demo data for local use only: `npx tsx apps/server/scripts/seed-demo.ts <folder-of-jpegs>`
creates mobile `9999900001`, password `demo-password-1`.

## Linking a phone

Account sheet → Web account → server address, mobile number, password.
Over USB: `adb reverse tcp:4000 tcp:4000` and use `http://localhost:4000`.
Plain http is only accepted for localhost and private networks.
The Android build allows cleartext traffic for this; switch it off
(`usesCleartextTraffic` in `app.json`) for anything released.

## Security notes

- scrypt password hashes; JWT in an httpOnly, SameSite=Lax cookie (12 h) for web,
  bearer token (90 d) for the phone; login/register rate-limited.
- Every id in a push is checked against the signed-in teacher before it is
  written; media is looked up by DB row, never by a client-supplied path.
- Uploads are served `nosniff`; only images and audio are shown inline.
- Not done: HTTPS termination, token revocation, an audit log, encryption at rest.
