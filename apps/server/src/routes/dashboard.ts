import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { AnnotationStroke, CaptureQuality, Language, ReviewView } from '@progressflow/shared';
import type {
  ClassDetail,
  ClassSummary,
  Overview,
  Scores,
  StudentDetail,
  StudentRow,
  SubmissionDetail,
  SubmissionSummary,
  TeacherConfig,
  TimePoint,
} from '@progressflow/shared';
import { RUBRIC_GUIDES, SyncCriterion, SyncType } from '@progressflow/shared';
import { prisma } from '../db.js';
import { fail, requireTeacher } from '../auth/middleware.js';

/** Read-only views for the web dashboard. Everything is scoped to the signed-in teacher. */
export const dashboardRouter = Router();
dashboardRouter.use(requireTeacher);

const DEFAULT_CRITERIA = RUBRIC_GUIDES.map((g) => g.key);

/** What the teacher synced from the phone: their assessment types and rubric. */
async function configOf(teacherId: string): Promise<TeacherConfig> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: teacherId },
    select: { settings: true },
  });
  const raw = (user.settings ?? {}) as { types?: unknown; rubric?: unknown };
  const types = SyncType.array().safeParse(raw.types);
  const rubric = SyncCriterion.array().min(1).safeParse(raw.rubric);
  return { types: types.success ? types.data : [], rubric: rubric.success ? rubric.data : null };
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (n: number) => Math.round(n * 100) / 100;

async function load(teacherId: string) {
  const klasses = await prisma.klass.findMany({
    where: { teacherId, deletedAt: null },
    include: {
      assignments: { where: { deletedAt: null }, take: 1 },
      enrollments: { where: { deletedAt: null }, include: { student: true } },
    },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }],
  });
  const assessments = await prisma.assessment.findMany({
    where: { deletedAt: null, assessorType: 'teacher', assignment: { klass: { teacherId } } },
    include: {
      criterionScores: { where: { deletedAt: null } },
      photos: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      assignment: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const config = await configOf(teacherId);
  const criteria = config.rubric ? config.rubric.map((c) => c.key) : DEFAULT_CRITERIA;
  return { klasses, assessments, criteria };
}

type Loaded = Awaited<ReturnType<typeof load>>;

function summaries(d: Loaded): SubmissionSummary[] {
  const classOf = new Map(d.klasses.map((k) => [k.id, k]));
  const student = new Map(
    d.klasses.flatMap((k) => k.enrollments.map((e) => [e.studentId, { s: e.student, k }] as const)),
  );
  return d.assessments.flatMap((a) => {
    const info = student.get(a.studentId);
    const k = info?.k ?? classOf.get(a.assignment.klassId);
    if (!info || !k) return [];
    // Marks for a criterion the teacher has since removed stay stored but are not shown or averaged.
    const scores: Scores = Object.fromEntries(
      a.criterionScores
        .filter((s) => d.criteria.includes(s.criterionKey))
        .map((s) => [s.criterionKey, s.level]),
    );
    return [
      {
        id: a.id,
        studentId: a.studentId,
        studentName: info.s.displayName,
        classId: k.id,
        classLabel: `${k.grade}-${k.section}`,
        kind: a.kind,
        createdAt: a.createdAt.toISOString(),
        saved: !!a.completedAt && a.completedAt.getTime() >= a.updatedAt.getTime(),
        scores,
        average: mean(Object.values(scores)),
        pageCount: a.photos.length,
        coverPageId: a.photos[0]?.id ?? null,
      },
    ];
  });
}

/** Photographed but the teacher has not pressed Save on the evaluation. */
const isWaiting = (s: SubmissionSummary) => s.pageCount > 0 && !s.saved;

function criterionMeans(subs: SubmissionSummary[], criteria: string[]): Scores {
  const out: Scores = {};
  for (const key of criteria) {
    const m = mean(subs.flatMap((s) => (s.scores[key] === undefined ? [] : [s.scores[key]!])));
    if (m !== null) out[key] = round(m);
  }
  return out;
}

function points(subs: SubmissionSummary[]): TimePoint[] {
  return subs
    .filter((s) => s.average !== null)
    .map((s) => ({ t: s.createdAt, scores: s.scores, average: round(s.average!) }));
}

function classSummary(
  k: Loaded['klasses'][number],
  subs: SubmissionSummary[],
  criteria: string[],
): ClassSummary {
  const mine = subs.filter((s) => s.classId === k.id);
  const avg = mean(mine.flatMap((s) => (s.average === null ? [] : [s.average])));
  return {
    id: k.id,
    grade: k.grade,
    section: k.section,
    label: `${k.grade}-${k.section}`,
    assignment: k.assignments[0]?.title ?? '',
    studentCount: k.enrollments.length,
    submissionCount: mine.length,
    waiting: mine.filter(isWaiting).length,
    criterionAverages: criterionMeans(mine, criteria),
    average: avg === null ? null : round(avg),
  };
}

dashboardRouter.get('/config', async (req, res) => {
  res.json(await configOf(req.teacherId!));
});

dashboardRouter.get('/overview', async (req, res) => {
  const d = await load(req.teacherId!);
  const subs = summaries(d);
  const avg = mean(subs.flatMap((s) => (s.average === null ? [] : [s.average])));
  const out: Overview = {
    counts: {
      classes: d.klasses.length,
      students: d.klasses.reduce((n, k) => n + k.enrollments.length, 0),
      submissions: subs.length,
      waiting: subs.filter(isWaiting).length,
      pendingReviews: await prisma.assessment.count({
        where: {
          assessorType: 'peer',
          approved: false,
          deletedAt: null,
          assignment: { klass: { teacherId: req.teacherId! } },
        },
      }),
    },
    average: avg === null ? null : round(avg),
    classes: d.klasses.map((k) => classSummary(k, subs, d.criteria)),
    recent: [...subs].reverse().slice(0, 8),
  };
  res.json(out);
});

dashboardRouter.get('/classes/:id', async (req, res) => {
  const d = await load(req.teacherId!);
  const k = d.klasses.find((x) => x.id === req.params.id);
  if (!k) return fail(res, 404, 'not_found', 'no such class');
  const all = summaries(d);
  const subs = all.filter((s) => s.classId === k.id);

  const students: StudentRow[] = k.enrollments
    .map((e) => {
      const mine = subs.filter((s) => s.studentId === e.studentId);
      const scored = mine.filter((s) => s.average !== null);
      return {
        id: e.studentId,
        name: e.student.displayName,
        rollNo: e.student.rollNo,
        submissionCount: mine.length,
        latestAverage: scored.length ? round(scored[scored.length - 1]!.average!) : null,
        firstAverage: scored.length ? round(scored[0]!.average!) : null,
        history: points(mine),
        joinCode: e.student.joinCode,
      };
    })
    .sort((a, b) => (parseInt(a.rollNo, 10) || 0) - (parseInt(b.rollNo, 10) || 0));

  const byMonth = new Map<string, SubmissionSummary[]>();
  for (const s of subs) {
    if (s.average === null) continue;
    const key = s.createdAt.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), s]);
  }
  const trend: TimePoint[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, group]) => ({
      t: `${month}-15T00:00:00.000Z`,
      scores: criterionMeans(group, d.criteria),
      average: round(mean(group.map((g) => g.average!))!),
    }));

  const out: ClassDetail = {
    summary: classSummary(k, all, d.criteria),
    students,
    trend,
    submissions: [...subs].reverse(),
  };
  res.json(out);
});

dashboardRouter.get('/students/:id', async (req, res) => {
  const d = await load(req.teacherId!);
  const k = d.klasses.find((c) => c.enrollments.some((e) => e.studentId === req.params.id));
  const st = k?.enrollments.find((e) => e.studentId === req.params.id)?.student;
  if (!k || !st) return fail(res, 404, 'not_found', 'no such student');
  const subs = summaries(d).filter((s) => s.studentId === st.id);
  const out: StudentDetail = {
    student: {
      id: st.id,
      name: st.displayName,
      rollNo: st.rollNo,
      classId: k.id,
      classLabel: `${k.grade}-${k.section}`,
    },
    history: points(subs),
    submissions: [...subs].reverse(),
  };
  res.json(out);
});

dashboardRouter.get('/submissions/:id', async (req, res) => {
  const d = await load(req.teacherId!);
  const summary = summaries(d).find((s) => s.id === req.params.id);
  if (!summary) return fail(res, 404, 'not_found', 'no such submission');

  const full = await prisma.assessment.findUniqueOrThrow({
    where: { id: summary.id },
    include: {
      photos: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { annotations: { where: { deletedAt: null } } },
      },
      voiceNotes: { where: { deletedAt: null }, take: 1 },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
    },
  });
  const reviewRows = await prisma.assessment.findMany({
    where: { ofAssessmentId: summary.id, deletedAt: null },
    include: { criterionScores: true, reviewResponses: true },
    orderBy: { createdAt: 'asc' },
  });
  const reviewers = await prisma.student.findMany({
    where: { id: { in: reviewRows.map((r) => r.assessorId) } },
    select: { id: true, displayName: true },
  });
  const nameOf = new Map(reviewers.map((s) => [s.id, s.displayName]));
  const view = (r: (typeof reviewRows)[number]): ReviewView => ({
    id: r.id,
    scores: Object.fromEntries(r.criterionScores.map((s) => [s.criterionKey, s.level])),
    answers: r.reviewResponses.map((a) => ({
      promptKey: a.promptKey,
      choice: (a.choice as ReviewView['answers'][number]['choice']) ?? null,
      text: a.text,
    })),
    createdAt: r.createdAt.toISOString(),
    approved: r.approved,
    byName: nameOf.get(r.assessorId) ?? '',
  });
  const self = reviewRows.find((r) => r.assessorType === 'self');

  const out: SubmissionDetail = {
    summary,
    note: full.note,
    peerOpen: full.peerOpen,
    reviews: {
      self: self ? view(self) : null,
      peers: reviewRows.filter((r) => r.assessorType === 'peer').map(view),
    },
    pages: full.photos.map((p) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      quality: (p.quality ?? null) as CaptureQuality | null,
      strokes: (p.annotations[0]?.strokes ?? []) as unknown as AnnotationStroke[],
    })),
    voice: full.voiceNotes[0]
      ? {
          durationMs: full.voiceNotes[0].durationMs,
          language: full.voiceNotes[0].language as Language,
          mediaId: full.id,
        }
      : null,
    attachments: full.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      url: a.url,
      text: a.text,
      ext: a.storageKey?.split('.').pop() ?? null,
    })),
  };
  res.json(out);
});

// --- teacher actions on student reviews and join codes --------------------------

const owned = (teacherId: string) => ({ assignment: { klass: { teacherId, deletedAt: null } } });

/** Open or close a piece for classmates to review. */
dashboardRouter.post('/submissions/:id/peer-open', async (req, res) => {
  const body = z.object({ open: z.boolean() }).safeParse(req.body);
  if (!body.success) return fail(res, 400, 'invalid', 'send { open: true | false }');
  const found = await prisma.assessment.findFirst({
    where: {
      id: req.params.id,
      assessorType: 'teacher',
      deletedAt: null,
      ...owned(req.teacherId!),
    },
    select: { id: true },
  });
  if (!found) return fail(res, 404, 'not_found', 'no such submission');
  await prisma.assessment.update({ where: { id: found.id }, data: { peerOpen: body.data.open } });
  res.json({ ok: true, open: body.data.open });
});

/** Approve (or hide again) a classmate's review. The author sees it only while approved. */
dashboardRouter.post('/reviews/:id/approve', async (req, res) => {
  const body = z.object({ approved: z.boolean() }).safeParse(req.body);
  if (!body.success) return fail(res, 400, 'invalid', 'send { approved: true | false }');
  const found = await prisma.assessment.findFirst({
    where: { id: req.params.id, assessorType: 'peer', deletedAt: null, ...owned(req.teacherId!) },
    select: { id: true },
  });
  if (!found) return fail(res, 404, 'not_found', 'no such review');
  await prisma.assessment.update({
    where: { id: found.id },
    data: { approved: body.data.approved },
  });
  res.json({ ok: true, approved: body.data.approved });
});

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

/** Replace a student's join code; the old one stops working at once. */
dashboardRouter.post('/students/:id/join-code', async (req, res) => {
  const found = await prisma.student.findFirst({
    where: {
      id: req.params.id,
      deletedAt: null,
      enrollments: {
        some: { deletedAt: null, klass: { teacherId: req.teacherId!, deletedAt: null } },
      },
    },
    select: { id: true },
  });
  if (!found) return fail(res, 404, 'not_found', 'no such student');
  for (let i = 0; i < 5; i++) {
    try {
      const s = await prisma.student.update({
        where: { id: found.id },
        data: { joinCode: newCode() },
        select: { joinCode: true },
      });
      return res.json({ joinCode: s.joinCode });
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e; // collided with another code: try again
    }
  }
  return fail(res, 500, 'internal', 'could not make a new code, try again');
});
