# Backlog

Seed for the GitHub project board. Grouped by phase; each item traces to a
feature (F1–F5) or component (C1–C4). Copy these into issues.

## Phase 0 — Foundations (now → ~12 Sep)

- [x] Monorepo scaffold (workspaces, TS strict, ESLint, Prettier)
- [x] `apps/server` skeleton: Express + Prisma + config + health routes
- [x] `apps/mobile` skeleton: Expo app boots, pings server
- [x] `packages/shared`: enums, entities, rubric, sync envelope, API DTOs
- [x] `infra/docker-compose.yml`: Postgres + MinIO
- [x] Prisma schema for the full data model
- [x] CI: lint + typecheck + prisma generate
- [ ] **Spike 1 — offline sync** (docs/spike-1-offline-sync.md) — 3 days, blocks everything
- [ ] Spike 2 — Skia annotation over a photo, export flattened PNG — 1 day
- [ ] Spike 3 — Google Speech with real Telugu classroom audio — 1 day
- [ ] Design system: colour/type/spacing finalised, base components
- [ ] Rubric authoring sessions with 2–3 educators → real descriptors + exemplars
- [ ] Consent flow + DPDP note reviewed with mentor
- [ ] Register Apple Developer + Google Play accounts
- [ ] Install Xcode + JDK 17 on the build machine

## Phase 1 — Core app + F1 (15 Sep → 10 Oct)

- [~] Auth: local PIN accounts built (docs/auth.md); Firebase phone-OTP still open, profile + language pref done
- [~] Class management: classes by grade/section + add student built; bulk-add and join codes still open
- [ ] Assignment creation
- [ ] **F1** rubric list → pick assignment + student → tap-to-rate → save (offline)  · C1
- [ ] Rubric descriptors + exemplar images visible on the rating screen  · C1
- [ ] Sync engine hardened: retry queue, conflict rules, sync-status UI
- [ ] Server REST: rubrics (read), assessments (upsert), media sign-URL

## Phase 2 — F2 + F3 → prototype (13 Oct → 31 Oct)

- [~] **F2** camera capture (ML Kit scanner, quality checks, roll/name match) — built, needs device testing; compression + queued upload still open  · C2
- [~] **F2** annotation: circle / highlight / arrow / freehand + undo + show/hide — built on react-native-svg (not Skia), needs device testing; flattened export still open  · C2
- [ ] **F2** voice record (hi/te/en) + queued upload  · C2
- [ ] **F2** server: audio → Google Speech async → transcript + status  · C2
- [ ] **F2** transcript display + teacher correction; audio always retained  · C2
- [ ] **F3** student sign-in via join code  · C3
- [ ] **F3** guided multi-step review form on the teacher's rubric  · C3
- [ ] **F3** responses recorded + visible to teacher  · C3
- [ ] 31 Oct: end-to-end demo (photo → annotate → Telugu voice note → self-assessment)

## Phase 3 — F4 + F5 (3 Nov → 21 Nov)

- [ ] `ProgressSnapshot` computation on assessment write  · C4
- [ ] **F4** teacher dashboard: per-student history + growth curves + class view  · C4
- [ ] **F4** "export for parents" PDF/summary per student  · C4
- [ ] **F5** student portal: artwork timeline + feedback + personal curve  · C4
- [ ] Notifications: "new feedback from your teacher"

## Phase 4 — Testing & hardening (24 Nov → 12 Dec)

- [ ] Recruit 3–5 teachers + 20+ students; schedule October
- [ ] Instrument assessment-time-per-student (target: halved)
- [ ] Teacher satisfaction survey (target: 4/5)
- [ ] Low-end Android performance pass
- [ ] Trilingual UI + accessibility review
- [ ] Security review: encryption, signed URLs, auth, consent enforcement

## Phase 5 — Ship & document (15 Dec → end of month)

- [ ] EAS production builds → TestFlight + Google Play beta
- [ ] Open-source repo: README, setup, architecture, licence
- [ ] Implementation guide for educators
- [ ] Data + write-up support for the research paper

## Deferred (not MVP)

- AI vision analysis of artwork (MobileNet) — Phase 1.5 only if ahead, else Phase 2
- Proactive pattern detection / intervention flags — Phase 2
- Per-class rubric customisation (if MVP uses one shared set)
