import { Router } from 'express';
import type { AnnotationStroke, CaptureQuality, Language } from '@progressflow/shared';
import type {
  ClassDetail,
  ClassSummary,
  Overview,
  Scores,
  StudentDetail,
  StudentRow,
  SubmissionDetail,
  SubmissionSummary,
  TimePoint,
} from '@progressflow/shared';
import { RUBRIC_GUIDES } from '@progressflow/shared';
import { prisma } from '../db.js';
import { fail, requireTeacher } from '../auth/middleware.js';

/** Read-only views for the web dashboard. Everything is scoped to the signed-in teacher. */
export const dashboardRouter = Router();
dashboardRouter.use(requireTeacher);

const CRITERIA = RUBRIC_GUIDES.map((g) => g.key);
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
    where: { deletedAt: null, assignment: { klass: { teacherId } } },
    include: {
      criterionScores: { where: { deletedAt: null } },
      photos: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      assignment: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return { klasses, assessments };
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
    const scores: Scores = Object.fromEntries(
      a.criterionScores.map((s) => [s.criterionKey, s.level]),
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
        scores,
        average: mean(Object.values(scores)),
        pageCount: a.photos.length,
        coverPageId: a.photos[0]?.id ?? null,
      },
    ];
  });
}

const isWaiting = (s: SubmissionSummary) =>
  s.pageCount > 0 && Object.keys(s.scores).length < CRITERIA.length;

function criterionMeans(subs: SubmissionSummary[]): Scores {
  const out: Scores = {};
  for (const key of CRITERIA) {
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

function classSummary(k: Loaded['klasses'][number], subs: SubmissionSummary[]): ClassSummary {
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
    criterionAverages: criterionMeans(mine),
    average: avg === null ? null : round(avg),
  };
}

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
    },
    average: avg === null ? null : round(avg),
    classes: d.klasses.map((k) => classSummary(k, subs)),
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
      scores: criterionMeans(group),
      average: round(mean(group.map((g) => g.average!))!),
    }));

  const out: ClassDetail = {
    summary: classSummary(k, all),
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
  const out: SubmissionDetail = {
    summary,
    note: full.note,
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
