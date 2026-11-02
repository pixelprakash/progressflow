# ProgressFlow — Build Roadmap

Mobile formative-assessment system for art & design educators.
Grant: ₹99,000 · 6 months · MVP on TestFlight + Google Play by December 2026.

Derived from `Startup_pitch_deck_Ganesh_Kumar_Malthurkar_guide_V2`.

---

## 1. What we are building (scope lock)

Five MVP features, each traced to a research component:

| # | Feature | Component | One-line definition |
|---|---------|-----------|---------------------|
| F1 | Visual rubric & quick scoring | C1 | Pre-built rubrics on the phone; teacher taps to rate. |
| F2 | Photo + annotation + voice | C2 | Photograph work, mark it up, record a voice note, auto-transcribe, auto-link to student. Works offline. |
| F3 | Peer & self-assessment | C3 | Guided student forms on the teacher's rubric; every response recorded. |
| F4 | Teacher progress dashboard | C4 | Score history + growth curves per student; export for parent conferences. |
| F5 | Student progress portal | C4 | Student sees own artwork, feedback, and a personal growth curve. |

**Explicitly out of MVP scope** (do not build now):
- AI vision analysis of artwork (MobileNet) — Phase 1.5 *only if* time permits, otherwise Phase 2.
- Proactive pattern detection / intervention flags — Phase 2.
- Anything not on the F1–F5 list.

**Non-negotiable requirements:**
- Offline-first. Feedback happens during class, on low-end Android phones, with poor connectivity.
- Trilingual voice: Hindi, Telugu, English.
- Student media is minors' data → encryption at rest, explicit consent, India DPDP Act 2023 compliance.
- Single codebase, both app stores.

---

## 2. Target architecture

```
progressflow/                 (monorepo)
├── apps/
│   ├── mobile/               React Native (Expo dev client), TypeScript
│   └── server/               Node.js + Express + Prisma, TypeScript
├── packages/
│   └── shared/               Shared types, rubric schema, validation (zod)
├── infra/
│   └── docker-compose.yml    Local Postgres + MinIO (S3-compatible) for dev
└── docs/
```

**Stack (from the deck, with implementation choices):**

| Layer | Choice | Notes |
|-------|--------|-------|
| Mobile | React Native + Expo (dev client, prebuild) | Expo supports camera, Skia, background upload, SQLite. Bare RN only if a native module forces it. |
| Local DB / offline | **WatermelonDB** (SQLite) or **PowerSync** + Postgres | Biggest technical risk — spike this in week 1. See §5. |
| Drawing / annotation | `@shopify/react-native-skia` over a captured photo | Export flattened PNG + store stroke data as JSON. |
| Audio | `expo-av` record → local queue → upload | Never block the teacher on network. |
| Backend | Node.js + Express + **Prisma** ORM | REST for rubrics, media, scoring, sync. |
| Primary DB | PostgreSQL | Source of truth; per-tenant (school) isolation. |
| Media storage | Firebase Storage (prod) / MinIO (local) | Signed upload URLs; client compresses before upload. |
| Speech-to-text | Google Cloud Speech-to-Text v2 (async, long-running) | `hi-IN`, `te-IN`, `en-IN`. Server-side call; store transcript + confidence + audio ref. |
| Auth | Firebase Auth — phone OTP for teachers; teacher-provisioned codes for students | Low friction; no email required in schools. |
| Push / notifications | Expo Notifications | Deferred to Phase 3. |
| CI | GitHub Actions | Lint + typecheck + test on PR; EAS build on tag. |
| Builds | Expo EAS Build | Avoids needing full local Xcode/Android Studio for every build. |

**Core data model (first draft):**

```
School ─┬─ User (teacher | student, role, language_pref)
        ├─ Class ──┬─ Enrollment ── Student
        │          └─ Assignment (title, medium, due)
        ├─ Rubric ──┬─ Criterion (name, weight, order)
        │           └─ PerformanceDescriptor (criterion, level 1-4, text, exemplar_image)
        └─ Assessment (assignment, student, assessor_type: teacher|self|peer, assessor_id, submitted_at, synced_at)
              ├─ CriterionScore (criterion, level, note)
              ├─ ArtworkPhoto (uri, thumb_uri, width, height)
              ├─ Annotation (photo, strokes_json, flattened_uri)
              ├─ VoiceNote (audio_uri, duration, language, transcript, transcript_status)
              └─ PeerPrompt response fields (guided form answers)

ProgressSnapshot (student, criterion, period, mean_score)   ← materialized for F4/F5 curves
ConsentRecord (student, guardian_name, granted_at, scope)
```

Everything a teacher creates in class gets a client-generated UUID and a `synced_at IS NULL` state until the server confirms it.

---

## 3. Timeline — six phases

Today: **27 Aug 2026**. Hard checkpoint: **working prototype at the 31 October review.**

### Phase 0 — Foundations (Weeks 1–2, now → ~12 Sep)
Goal: a running skeleton and every high-risk decision spiked.

- [ ] Monorepo scaffold (pnpm workspaces or Turborepo), TypeScript strict, ESLint + Prettier, Husky pre-commit.
- [ ] `apps/server`: Express + Prisma + Postgres via docker-compose; health route; first migration.
- [ ] `apps/mobile`: Expo dev client boots on a real Android device and iOS simulator.
- [ ] **Spike 1 — offline sync** (§5). Decide WatermelonDB vs PowerSync vs custom. Time-box: 3 days.
- [ ] **Spike 2 — Skia annotation** over a photo, export flattened PNG. Time-box: 1 day.
- [ ] **Spike 3 — Google Speech** with a real Telugu classroom audio clip; check accuracy + latency + cost. Time-box: 1 day.
- [ ] GitHub Actions: lint + typecheck + test on PR.
- [ ] Design system: colours, type scale, spacing, component primitives (large tap targets — teachers rate one-handed).
- [ ] **Content: rubric authoring with educators.** Sit with 2–3 of the 70 educators and finalise the middle-school rubric set (composition, colour theory, technical skill, conceptual depth) with real performance descriptors + exemplar images. This is a dependency for F1 and cannot be rushed later.
- [ ] Consent flow + DPDP compliance note reviewed with faculty mentor.

**Exit criteria:** app boots offline, writes a record locally, syncs it to Postgres when back online. Rubric content v1 exists.

### Phase 1 — Core app + F1 (Weeks 3–6, ~15 Sep → 10 Oct)
- [ ] Auth: teacher phone-OTP sign-in; profile with language preference.
- [ ] Class & student management: create class, add students (bulk), student codes.
- [ ] Assignment creation.
- [ ] **F1 — Visual rubric & quick scoring**: rubric list → pick assignment + student → tap to rate each criterion → save. Fully offline. Exemplar images and descriptors visible.
- [ ] Sync engine hardened: conflict rules (last-write-wins per field; teacher score wins over stale), retry queue, sync status UI.
- [ ] Server REST: rubrics (read), assessments (create/upsert), media sign-URL.

**Exit criteria:** a teacher can score a full class offline; scores appear on the server dashboard-side later.

### Phase 2 — F2 + F3 → prototype (Weeks 7–10, ~13 Oct → 31 Oct)
- [ ] **F2 — Photo + annotation + voice**
  - [ ] Camera capture, on-device compression, local storage, queued upload.
  - [ ] Skia annotation: circle / highlight / arrow / freehand; undo; save strokes + flattened image.
  - [ ] Voice: record in hi/te/en, local playback, queued upload.
  - [ ] Server: receive audio → Google Speech async → store transcript + status; mobile polls/receives transcript.
  - [ ] Everything auto-linked to the student + assignment.
- [ ] **F3 — Peer & self-assessment**
  - [ ] Student sign-in via code.
  - [ ] Guided multi-step form on the teacher's rubric (Yes / Partly / Not yet + one free-text strength).
  - [ ] Responses recorded, visible to teacher.

**Exit criteria (31 Oct review): a teacher photographs a piece, annotates it, leaves a Telugu voice note that transcribes, and a student completes a self-assessment — all demoable on a phone.**

### Phase 3 — F4 + F5 (November, ~3 Nov → 21 Nov)
- [ ] `ProgressSnapshot` computation (server job or on-write aggregation).
- [ ] **F4 — Teacher dashboard**: per-student score history, growth curves per criterion, class overview, "needs reteaching" reading of the data.
- [ ] Export for parents: generate a clean PDF/summary per student (scores over time + selected artwork + feedback).
- [ ] **F5 — Student portal**: own artwork timeline, teacher feedback, personal growth curve — framed as trajectory, not grades.
- [ ] Notifications: "new feedback from your teacher."

**Exit criteria:** growth over a semester is visible and exportable for both audiences.

### Phase 4 — Testing & hardening (~24 Nov → 12 Dec)
- [ ] Field test with 3–5 teachers + 20+ students (recruit now, schedule in October).
- [ ] Instrument: assessment time per student (target: halved), teacher satisfaction survey (target: 4/5).
- [ ] Bug triage, offline-edge-case fixes, low-end Android performance pass.
- [ ] Accessibility + trilingual UI review.
- [ ] Security review: encryption at rest, signed URLs, auth, consent enforcement, `/security-review`.

### Phase 5 — Ship & document (~15 Dec → end of month)
- [ ] EAS production builds → **TestFlight** + **Google Play** closed/beta track.
- [ ] Open-source the repo on GitHub with a real README, setup guide, architecture doc, licence.
- [ ] Implementation guide for educators.
- [ ] Data + write-up support for the research paper.

---

## 4. Budget mapping (₹99,000)

| Line | Amount | Covers |
|------|--------|--------|
| Full-stack development | ₹45,000 (45%) | Phases 0–5 backend + mobile core, sync engine, F1–F5. |
| UI/UX design & frontend | ₹20,000 (20%) | Design system, screens, annotation UX, dashboards. |
| Optional AI vision | ₹16,000 (16%) | **Hold.** Release only after F1–F5 are demoable and the Oct 31 checkpoint is met. |
| Infrastructure & services | ₹12,000 (12%) | Postgres/hosting, Firebase Storage, Google Speech API, EAS, Play Console ($25), Apple Developer ($99/yr). |
| Research & user testing | ₹6,000 (6%) | Phase 4 field testing, participant compensation, travel. |

Note: Apple Developer Program (~₹8,300/yr) + Google Play one-time (~₹2,100) come out of the infra line — budget them in week 1.

---

## 5. Top risks & how to retire them early

| Risk | Impact | Retire it by |
|------|--------|--------------|
| **Offline sync complexity** | Could sink the timeline. | Spike 1 in Phase 0. Prefer a library (PowerSync or WatermelonDB) over hand-rolled. Keep the model sync-friendly: per-field timestamps, UUIDs, soft deletes, no server-generated IDs on the write path. |
| **Telugu / Hindi STT accuracy or cost** | F2 core value depends on it. | Spike 3 with real classroom audio. Fallback: allow teacher to correct transcript; store audio regardless so a bad transcript never loses the feedback. |
| **Solo dev until 4 hires land** | Everything slower; bus factor 1. | Front-load architecture + decisions the lead owns. Recruit full-stack dev first, junior UI second. Write the docs as you go so onboarding is days not weeks. |
| **No full Xcode locally; Java 11 (Android needs 17)** | Can't build locally. | Use EAS Build from day 1; install Xcode + JDK 17 before Phase 2 device testing. |
| **School access for field testing** | Phase 4 blocked. | Faculty mentor to confirm 3–5 teachers and schedule visits during October. |
| **Scope creep from AI vision** | Eats the MVP. | It is explicitly Phase 1.5/2. Gate it behind the Oct 31 checkpoint. |
| **Minors' data / DPDP Act** | Legal + ethical blocker to shipping. | Consent flow in Phase 0; encryption + access control reviewed in Phase 4 security pass. |

---

## 6. Do this now (first working session)

1. `mkdir` monorepo, `git init`, push to GitHub (private for now).
2. Scaffold `apps/server` (Express + Prisma), `apps/mobile` (Expo), `packages/shared`.
3. `infra/docker-compose.yml` with Postgres + MinIO; first Prisma migration for the §2 model.
4. Get the Expo dev client running on Ganesh's own Android phone.
5. Start **Spike 1 (offline sync)** — nothing else matters until this direction is chosen.
6. Book the rubric-authoring sessions with educators.
7. Register Apple Developer + Google Play accounts (lead time on approval).
8. Create the GitHub project board from the Phase 0 / Phase 1 checklists above.

---

## 7. Open decisions (resolve in week 1)

- [ ] Sync: PowerSync vs WatermelonDB vs custom?
- [ ] Expo managed-with-dev-client vs bare React Native?
- [ ] Package manager: pnpm vs npm workspaces?
- [ ] Hosting for server + Postgres: Railway / Render / Fly.io / self-host?
- [ ] Is one shared rubric set enough for MVP, or per-class customisation needed?
- [ ] Student auth: class code only, or code + name/PIN?
- [ ] Analytics for the "assessment time halved" metric — in-app timing vs observed?
