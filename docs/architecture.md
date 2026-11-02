# Architecture

## Shape

```
┌─────────────────────┐        HTTPS / REST         ┌──────────────────────┐
│  Expo app (mobile)  │  ───────────────────────▶   │  Express API server  │
│                     │  ◀───────────────────────   │                      │
│  SQLite (offline)   │      /v1/sync push+pull      │  Prisma → PostgreSQL │
│  local media queue  │  ───── signed upload ─────▶  │  signed URL issuer   │
└─────────────────────┘                             └───────────┬──────────┘
                                                                │
                        ┌───────────────────────────────────────┼───────────────┐
                        ▼                                       ▼               ▼
              Firebase Storage / MinIO            Google Cloud Speech     Firebase Auth
              (artwork, audio, flattened)         (hi-IN / te-IN / en-IN) (teacher phone OTP)
```

## Principles

1. **Offline-first.** The phone's SQLite is the working copy. Every user action
   writes locally first and syncs opportunistically. The server is the durable
   source of truth and the cross-device merge point — never a blocker for the
   teacher mid-class.
2. **No server-generated keys on the write path.** Clients mint UUIDs so a record
   created offline has a stable identity forever.
3. **Media never blocks feedback.** Photos and audio are captured to local files
   and uploaded from a queue. A failed or slow upload never loses a voice note;
   the audio itself is always retained even if transcription fails.
4. **AI is input, the teacher decides.** Optional vision analysis (Phase 1.5/2)
   only ever pre-fills a score the teacher can change.

## Conflict resolution

Last-write-wins per field, keyed on `updatedAt`. One carve-out: a teacher's
`CriterionScore` always wins over a `self` / `peer` write to the same row.
Full rules land with Spike 1 — see [spike-1-offline-sync.md](spike-1-offline-sync.md).

## Data protection (DPDP Act 2023)

- Student media is minors' data. Guardian consent is captured (`ConsentRecord`)
  before any capture and enforced server-side.
- Media is stored under per-school prefixes; access is via short-lived signed
  URLs only.
- Encryption at rest (storage-provider managed) + TLS in transit.
- Data export and deletion per student supported for the "export for parents"
  feature and for consent revocation.
- A full security pass happens in Phase 4 (`/security-review`).

## Environments

| | Local | Staging | Production |
|---|---|---|---|
| DB | docker Postgres | managed Postgres | managed Postgres |
| Media | MinIO | Firebase Storage | Firebase Storage |
| Auth | stub / test numbers | Firebase Auth | Firebase Auth |
| Builds | Expo Go / dev client | EAS preview | EAS production → stores |
