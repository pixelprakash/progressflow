import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Prisma } from '@prisma/client';
import { RUBRIC_GUIDES, ReviewSubmitBody, StudentLoginBody } from '@progressflow/shared';
import type {
  AnnotationStroke,
  PeerCandidate,
  ReviewAnswer,
  ReviewView,
  Scores,
  StudentPiece,
  StudentPortal,
  StudentProfile,
  TimePoint,
} from '@progressflow/shared';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { kindLabeller } from '../services/kinds.js';
import { STUDENT_COOKIE, fail, requireStudent } from '../auth/middleware.js';
import { STUDENT_TTL_S, signToken } from '../auth/token.js';

/** Everything a student can do. Nothing here accepts a student id from the client: it always comes from the session. */
export const studentRouter = Router();

const CRITERIA = RUBRIC_GUIDES.length;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (n: number) => Math.round(n * 100) / 100;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15 * config.RATE_LIMIT_MULTIPLIER,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'too many attempts, try again later' } },
});

type Enrolled = {
  id: string;
  displayName: string;
  rollNo: string;
  enrollments: { klass: { id: string; grade: number; section: string; teacherId: string } }[];
};

async function loadStudent(id: string): Promise<Enrolled | null> {
  return prisma.student.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      displayName: true,
      rollNo: true,
      enrollments: {
        where: { deletedAt: null, klass: { deletedAt: null } },
        select: {
          klass: { select: { id: true, grade: true, section: true, teacherId: true } },
        },
      },
    },
  });
}

const profileOf = (s: Enrolled): StudentProfile => ({
  id: s.id,
  name: s.displayName,
  rollNo: s.rollNo,
  classLabel: s.enrollments[0]
    ? `${s.enrollments[0].klass.grade}-${s.enrollments[0].klass.section}`
    : '',
});

studentRouter.post('/student/login', loginLimiter, async (req, res) => {
  const body = StudentLoginBody.safeParse(req.body);
  if (!body.success) return fail(res, 401, 'bad_code', 'that code did not work');

  const found = await prisma.student.findFirst({
    where: {
      joinCode: body.data.code,
      deletedAt: null,
      enrollments: { some: { deletedAt: null, klass: { deletedAt: null } } },
    },
    select: { id: true },
  });
  if (!found) return fail(res, 401, 'bad_code', 'that code did not work');

  const t = await signToken(found.id, STUDENT_TTL_S, 'student');
  res.cookie(STUDENT_COOKIE, t.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: STUDENT_TTL_S * 1000,
    path: '/',
  });
  res.json({ student: profileOf((await loadStudent(found.id))!) });
});

studentRouter.post('/student/logout', (_req, res) => {
  res.clearCookie(STUDENT_COOKIE, { path: '/' });
  res.json({ ok: true });
});

type ReviewRow = Prisma.AssessmentGetPayload<{
  include: { criterionScores: true; reviewResponses: true };
}>;

function reviewView(r: ReviewRow, byName?: string): ReviewView {
  const scores: Scores = Object.fromEntries(
    r.criterionScores.filter((s) => !s.deletedAt).map((s) => [s.criterionKey, s.level]),
  );
  const answers: ReviewAnswer[] = r.reviewResponses
    .filter((a) => !a.deletedAt)
    .map((a) => ({
      promptKey: a.promptKey,
      choice: (a.choice as ReviewAnswer['choice']) ?? null,
      text: a.text,
    }));
  return {
    id: r.id,
    scores,
    answers,
    createdAt: r.createdAt.toISOString(),
    approved: r.approved,
    ...(byName ? { byName } : {}),
  };
}

/** Pieces of classmates that a student may be asked to review: open, not theirs, not reviewed by them yet. */
async function openForPeer(studentId: string, classIds: string[]) {
  return prisma.assessment.findMany({
    where: {
      assessorType: 'teacher',
      deletedAt: null,
      peerOpen: true,
      studentId: { not: studentId },
      assignment: { klassId: { in: classIds } },
      reviews: { none: { assessorType: 'peer', assessorId: studentId, deletedAt: null } },
      photos: { some: { deletedAt: null } },
    },
    include: { photos: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
}

studentRouter.get('/student/portal', requireStudent, async (req, res) => {
  const me = (await loadStudent(req.studentId!))!;
  const classIds = me.enrollments.map((e) => e.klass.id);

  const pieces = await prisma.assessment.findMany({
    where: { studentId: me.id, assessorType: 'teacher', deletedAt: null },
    include: {
      criterionScores: { where: { deletedAt: null } },
      photos: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { annotations: { where: { deletedAt: null }, take: 1 } },
      },
      voiceNotes: { where: { deletedAt: null }, take: 1 },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      reviewResponses: true,
      reviews: {
        where: { deletedAt: null },
        include: { criterionScores: true, reviewResponses: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const kindFor = await kindLabeller(me.enrollments[0]?.klass.teacherId);
  const out: StudentPiece[] = pieces.map((p) => {
    const scores: Scores = Object.fromEntries(
      p.criterionScores.map((s) => [s.criterionKey, s.level]),
    );
    const mySelf = p.reviews.find((r) => r.assessorType === 'self' && r.assessorId === me.id);
    return {
      id: p.id,
      kind: kindFor(p.kind),
      createdAt: p.createdAt.toISOString(),
      pages: p.photos.map((x) => ({
        id: x.id,
        width: x.width,
        height: x.height,
        strokes: (x.annotations[0]?.strokes ?? []) as unknown as AnnotationStroke[],
      })),
      scores,
      average: mean(Object.values(scores)),
      note: p.note,
      voice: p.voiceNotes[0]
        ? {
            durationMs: p.voiceNotes[0].durationMs,
            language: p.voiceNotes[0].language as 'en' | 'hi' | 'te',
            mediaId: p.id,
          }
        : null,
      attachments: p.attachments.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        url: a.url,
        text: a.text,
      })),
      self: mySelf ? reviewView(mySelf) : null,
      // Classmates' feedback only once the teacher has approved it, and never with a name.
      peers: p.reviews
        .filter((r) => r.assessorType === 'peer' && r.approved)
        .map((r) => reviewView(r)),
    };
  });

  const history: TimePoint[] = [...out]
    .filter((p) => p.average !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((p) => ({ t: p.createdAt, scores: p.scores, average: round(p.average!) }));

  const portal: StudentPortal = {
    student: profileOf(me),
    pieces: out,
    history,
    peerAvailable: (await openForPeer(me.id, classIds)).length,
  };
  res.json(portal);
});

studentRouter.get('/student/peer', requireStudent, async (req, res) => {
  const me = (await loadStudent(req.studentId!))!;
  const open = await openForPeer(
    me.id,
    me.enrollments.map((e) => e.klass.id),
  );
  const out: PeerCandidate[] = open.map((a) => ({
    id: a.id,
    pages: a.photos.map((p) => ({ id: p.id, width: p.width, height: p.height })),
  }));
  res.json(out);
});

studentRouter.post('/student/reviews', requireStudent, async (req, res) => {
  const body = ReviewSubmitBody.safeParse(req.body);
  if (!body.success) return fail(res, 400, 'invalid', 'check the form and try again');
  const { kind, submissionId, scores, answers } = body.data;
  const me = (await loadStudent(req.studentId!))!;
  const classIds = me.enrollments.map((e) => e.klass.id);

  // Both kinds need written answers, so a review is never just numbers.
  const needed = kind === 'self' ? ['worked', 'change'] : ['works', 'suggest'];
  const hasText = (k: string) => (answers.find((a) => a.promptKey === k)?.text ?? '').length > 0;
  if (!needed.every(hasText)) return fail(res, 400, 'needs_text', 'please answer each question');

  const piece = await prisma.assessment.findFirst({
    where: {
      id: submissionId,
      assessorType: 'teacher',
      deletedAt: null,
      ...(kind === 'self'
        ? { studentId: me.id }
        : { peerOpen: true, studentId: { not: me.id }, assignment: { klassId: { in: classIds } } }),
    },
  });
  if (!piece) return fail(res, 404, 'not_found', 'no such piece to review');

  try {
    const created = await prisma.assessment.create({
      data: {
        assignmentId: piece.assignmentId,
        studentId: piece.studentId, // the author: the review is *about* their work
        assessorType: kind,
        assessorId: me.id,
        ofAssessmentId: piece.id,
        kind: piece.kind,
        // peer reviews wait for the teacher; a student's own review is theirs to see immediately
        approved: kind === 'self',
        submittedAt: new Date(),
        criterionScores: {
          create: Object.entries(scores).map(([criterionKey, level]) => ({ criterionKey, level })),
        },
        reviewResponses: {
          create: answers.map((a) => ({ promptKey: a.promptKey, choice: a.choice, text: a.text })),
        },
      },
    });
    res.status(201).json({ id: created.id, pendingApproval: kind === 'peer' });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002')
      return fail(res, 409, 'already_reviewed', 'you already reviewed this');
    throw e;
  }
});

export { CRITERIA };
