# ProgressFlow

Mobile support system for art & design educators — an evidence-based formative
assessment framework, built from a mixed-methods study of 70 art educators in
Telangana.

- **Grant:** ₹99,000 · 6 months · MVP on TestFlight + Google Play by December 2026
- **Lead:** Ganesh Kumar Malthurkar (PhD Scholar, Department of Design, IIT Hyderabad)
- **Mentor:** Prof. Deepak John Mathew

See [ROADMAP.md](ROADMAP.md) for scope, phases, budget mapping, and risks.

## Repository layout

```
apps/
  mobile/     React Native (Expo) app — teachers score, photograph, annotate, record voice
  server/     Node.js + Express + Prisma REST API and sync backend
packages/
  shared/     Domain model: enums, entity + rubric schemas (zod), sync envelope, API DTOs
infra/
  docker-compose.yml   Local Postgres + MinIO
docs/
```

## Prerequisites

- Node.js 20+ (`.nvmrc` pins 22)
- Docker (for local Postgres + MinIO)
- For device builds later: Xcode 15+ (iOS), JDK 17 + Android Studio (Android), or Expo EAS

## Getting started

```bash
npm install
npm run build:shared

# 1. local services
npm run db:up

# 2. server
cp apps/server/.env.example apps/server/.env
npm run db:migrate          # first run creates the schema
npm run seed -w @progressflow/server
npm run dev:server          # http://localhost:4000/healthz

# 3. mobile (separate terminal)
npm run dev:mobile          # scan the QR with Expo Go / a dev client
```

## Current status

Phase 0 — foundations. Skeleton runs; the offline-sync engine (Spike 1) is the
next and highest-risk task. See [docs/spike-1-offline-sync.md](docs/spike-1-offline-sync.md).

## Scripts (root)

| Command | Does |
|---|---|
| `npm run build:shared` | Compile `@progressflow/shared` |
| `npm run db:up` / `db:down` | Start / stop Postgres + MinIO |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run dev:server` | Run the API with reload |
| `npm run dev:mobile` | Start the Expo dev server |
| `npm run typecheck` | Typecheck every workspace |
| `npm run lint` / `format` | ESLint / Prettier |

## Licence

To be released open-source (MIT) as a grant deliverable. Student data handling
follows India's DPDP Act 2023 — see [docs/architecture.md](docs/architecture.md).
