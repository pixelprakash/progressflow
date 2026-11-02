# Student portal, reviews and languages

## What students can do

Students open the portal (`/student` on the web app, any phone browser) with the
6-character **join code** on their record. A teacher sees every code on the class
page of the dashboard, can print them, and can replace one at any time.

- **My work**: their own scans with the teacher's markup, scores, note, voice
  message and attachments, plus a progress chart.
- **Self-review**: rate the four rubric criteria, then answer three questions
  (what went well, what to change, how sure they are). Afterwards their scores are
  shown next to the teacher's.
- **Peer review**: only for pieces the teacher has opened for classmates. The
  reviewer sees the images and nothing else, rates the criteria and answers two
  questions. The author sees the feedback only after the teacher approves it, and
  never sees who wrote it.

## Privacy rules (enforced on the server, covered by `test/e2e-student.ts`)

- A student session can only read that student's own work. The student id always
  comes from the session, never from the request.
- Student and teacher sessions are different token types; neither works on the
  other's routes.
- Peer reviewers can load only the page images of a piece that is open for review
  in their own class, not the author's name, scores, voice note or attachments.
- Join-code sign-in is rate-limited; a replaced code stops working immediately.
- **Known limit:** if a child wrote their name on the drawing, classmates will see
  it. The teacher is told this where they switch sharing on.

## Languages

English, Hindi and Telugu across the student portal, the teacher dashboard and the
phone app. One dictionary in `packages/shared/src/i18n/`; `en.ts` is the source and
`hi.ts` / `te.ts` are typed against it, so a missing string will not compile.
`npm run test:i18n` also checks placeholders and catches untranslated text.

**The Hindi and Telugu are drafts written without a native-speaker review.** Have
teachers read them before classroom use, especially the rubric descriptors, which
are the words students judge their work by.

Not translated: the public project page, server error messages, and anything a
teacher types.
