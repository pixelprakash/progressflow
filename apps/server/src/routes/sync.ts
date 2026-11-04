import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { SyncPushBody } from '@progressflow/shared';
import type { MediaWanted, SyncPushResponse, SyncSubmission } from '@progressflow/shared';
import { prisma } from '../db.js';
import { fail, requireTeacher } from '../auth/middleware.js';
import { academicYear, derivedUuid } from '../services/ids.js';
import { exists, remove } from '../services/media.js';
import { DEFAULT_RUBRIC_ID } from '../services/rubric.js';

/**
 * Snapshot push from the phone (see account.ts in @progressflow/shared).
 * Every id in the payload is checked against the signed-in teacher before it is
 * written, so one teacher can never overwrite another's rows.
 */
export const syncRouter = Router();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const joinCode = () =>
  Array.from(randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

class Forbidden extends Error {}

syncRouter.post('/sync/push', requireTeacher, async (req, res) => {
  const body = SyncPushBody.safeParse(req.body);
  if (!body.success) return fail(res, 400, 'invalid', 'sync payload is malformed');
  const teacherId = req.teacherId!;
  const { classes, students, submissions, deleted } = body.data;

  const teacher = await prisma.user.findUniqueOrThrow({ where: { id: teacherId } });
  const accepted: string[] = [];
  const skipped: string[] = [];
  const purge: string[] = [];

  try {
    await prisma.$transaction(
      async (tx) => {
        // --- deletions first, so a class that was deleted and re-created ends up alive ----
        purge.push(...(await applyDeletions(tx, teacherId, deleted)));

        // --- the teacher's own types and rubric -------------------------------------------
        if (body.data.types !== undefined || body.data.rubric !== undefined) {
          const settings = { ...((teacher.settings ?? {}) as Record<string, unknown>) };
          if (body.data.types !== undefined) settings.types = body.data.types;
          if (body.data.rubric !== undefined) {
            if (body.data.rubric === null) delete settings.rubric;
            else settings.rubric = body.data.rubric;
          }
          await tx.user.update({
            where: { id: teacherId },
            data: { settings: settings as Prisma.InputJsonValue },
          });
        }

        // --- classes --------------------------------------------------------
        for (const c of classes) {
          const found = await tx.klass.findUnique({ where: { id: c.id } });
          if (found && found.teacherId !== teacherId) throw new Forbidden(`class ${c.id}`);
          await tx.klass.upsert({
            where: { id: c.id },
            create: {
              id: c.id,
              schoolId: teacher.schoolId,
              teacherId,
              name: `Class ${c.grade}-${c.section}`,
              grade: c.grade,
              section: c.section,
              academicYear: academicYear(),
            },
            update: {
              name: `Class ${c.grade}-${c.section}`,
              grade: c.grade,
              section: c.section,
              deletedAt: null,
            },
          });
          const assignmentId = derivedUuid('assignment', c.id);
          await tx.assignment.upsert({
            where: { id: assignmentId },
            create: {
              id: assignmentId,
              klassId: c.id,
              rubricId: DEFAULT_RUBRIC_ID,
              title: c.assignment,
            },
            update: { title: c.assignment, deletedAt: null },
          });
        }

        // The teacher's classes (including ones pushed earlier) bound everything below.
        const mine = new Set(
          (
            await tx.klass.findMany({ where: { teacherId, deletedAt: null }, select: { id: true } })
          ).map((k) => k.id),
        );

        // --- students -------------------------------------------------------
        for (const s of students) {
          if (!mine.has(s.classId)) throw new Forbidden(`class ${s.classId}`);
          const found = await tx.student.findUnique({
            where: { id: s.id },
            include: { enrollments: { include: { klass: true } } },
          });
          if (found && !found.enrollments.some((e) => e.klass.teacherId === teacherId)) {
            throw new Forbidden(`student ${s.id}`);
          }
          if (found) {
            await tx.student.update({
              where: { id: s.id },
              data: { displayName: s.name, rollNo: s.rollNo, deletedAt: null },
            });
          } else {
            await tx.student.create({
              data: {
                id: s.id,
                schoolId: teacher.schoolId,
                displayName: s.name,
                rollNo: s.rollNo,
                joinCode: joinCode(),
              },
            });
          }
          await tx.enrollment.upsert({
            where: { klassId_studentId: { klassId: s.classId, studentId: s.id } },
            create: {
              id: derivedUuid('enrollment', s.classId, s.id),
              klassId: s.classId,
              studentId: s.id,
            },
            update: { deletedAt: null },
          });
        }

        // --- submissions ----------------------------------------------------
        for (const sub of submissions) {
          const enrollment = await tx.enrollment.findFirst({
            where: {
              studentId: sub.studentId,
              deletedAt: null,
              klass: { teacherId, deletedAt: null },
            },
          });
          if (!enrollment) throw new Forbidden(`student ${sub.studentId}`);

          const existing = await tx.assessment.findUnique({
            where: { id: sub.id },
            include: { assignment: { include: { klass: true } } },
          });
          if (existing && existing.assignment.klass.teacherId !== teacherId)
            throw new Forbidden(`submission ${sub.id}`);
          if (existing && existing.updatedAt.getTime() > new Date(sub.updatedAt).getTime()) {
            skipped.push(sub.id);
            continue;
          }
          await writeSubmission(tx, teacherId, derivedUuid('assignment', enrollment.klassId), sub);
          accepted.push(sub.id);
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (e) {
    if (e instanceof Forbidden) return fail(res, 403, 'forbidden', `not yours: ${e.message}`);
    throw e;
  }

  // Erased work must not linger in storage; a file that is already gone is fine.
  await Promise.all(purge.map((key) => remove(key).catch(() => {})));

  const mediaWanted = await missingMedia(
    teacherId,
    submissions.filter((s) => accepted.includes(s.id)),
  );
  const out: SyncPushResponse = {
    deleted,
    accepted,
    skipped,
    mediaWanted,
    serverTime: new Date().toISOString(),
  };
  res.json(out);
});

type Tx = Prisma.TransactionClient;

/**
 * Soft-deletes what the teacher deleted on the phone and returns the storage keys of the
 * photos, recordings and attachments to erase. Only rows under this teacher's classes are
 * touched; an id that belongs to someone else, or to nothing, is quietly ignored.
 */
async function applyDeletions(
  tx: Tx,
  teacherId: string,
  del: { classes: string[]; students: string[]; submissions: string[] },
): Promise<string[]> {
  const now = new Date();
  const assessmentIds = new Set<string>();

  // Classes: the class, its assignments and enrollments, its students and all their work.
  const ownedClasses = del.classes.length
    ? await tx.klass.findMany({
        where: { id: { in: del.classes }, teacherId },
        select: { id: true, enrollments: { select: { studentId: true } } },
      })
    : [];
  const studentIds = new Set(del.students);
  for (const k of ownedClasses) for (const e of k.enrollments) studentIds.add(e.studentId);

  // Students: only those enrolled in one of this teacher's classes.
  const ownedStudents = studentIds.size
    ? await tx.student.findMany({
        where: {
          id: { in: [...studentIds] },
          enrollments: { some: { klass: { teacherId } } },
        },
        select: { id: true },
      })
    : [];
  const ownedStudentIds = ownedStudents.map((s) => s.id);

  if (ownedStudentIds.length) {
    const theirs = await tx.assessment.findMany({
      where: {
        deletedAt: null,
        assignment: { klass: { teacherId } },
        OR: [{ studentId: { in: ownedStudentIds } }, { assessorId: { in: ownedStudentIds } }],
      },
      select: { id: true },
    });
    theirs.forEach((a) => assessmentIds.add(a.id));
    await tx.enrollment.updateMany({
      where: { studentId: { in: ownedStudentIds }, klass: { teacherId } },
      data: { deletedAt: now },
    });
    await tx.student.updateMany({
      where: { id: { in: ownedStudentIds } },
      data: { deletedAt: now },
    });
  }

  if (ownedClasses.length) {
    const ids = ownedClasses.map((k) => k.id);
    const inClass = await tx.assessment.findMany({
      where: { deletedAt: null, assignment: { klassId: { in: ids } } },
      select: { id: true },
    });
    inClass.forEach((a) => assessmentIds.add(a.id));
    await tx.assignment.updateMany({ where: { klassId: { in: ids } }, data: { deletedAt: now } });
    await tx.enrollment.updateMany({ where: { klassId: { in: ids } }, data: { deletedAt: now } });
    await tx.klass.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now } });
  }

  // Submissions, and any self or peer reviews written about them.
  if (del.submissions.length) {
    const mine = await tx.assessment.findMany({
      where: {
        id: { in: del.submissions },
        assessorType: 'teacher',
        assignment: { klass: { teacherId } },
      },
      select: { id: true, reviews: { select: { id: true } } },
    });
    for (const a of mine) {
      assessmentIds.add(a.id);
      a.reviews.forEach((r) => assessmentIds.add(r.id));
    }
  }

  if (assessmentIds.size === 0) return [];
  const ids = [...assessmentIds];
  const photos = await tx.artworkPhoto.findMany({ where: { assessmentId: { in: ids } } });
  const voices = await tx.voiceNote.findMany({ where: { assessmentId: { in: ids } } });
  const files = await tx.feedbackAttachment.findMany({
    where: { assessmentId: { in: ids }, storageKey: { not: null } },
  });
  await tx.artworkPhoto.updateMany({
    where: { assessmentId: { in: ids } },
    data: { deletedAt: now },
  });
  await tx.voiceNote.updateMany({ where: { assessmentId: { in: ids } }, data: { deletedAt: now } });
  await tx.feedbackAttachment.updateMany({
    where: { assessmentId: { in: ids } },
    data: { deletedAt: now },
  });
  await tx.assessment.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now } });
  return [
    ...photos.map((p) => p.storageKey),
    ...voices.map((v) => v.storageKey),
    ...files.flatMap((f) => (f.storageKey ? [f.storageKey] : [])),
  ];
}

async function writeSubmission(
  tx: Tx,
  teacherId: string,
  assignmentId: string,
  sub: SyncSubmission,
) {
  const updatedAt = new Date(sub.updatedAt);
  const data = {
    assignmentId,
    studentId: sub.studentId,
    assessorType: 'teacher' as const,
    assessorId: teacherId,
    kind: sub.kind,
    completedAt: sub.completedAt ? new Date(sub.completedAt) : null,
    note: sub.note,
    submittedAt: new Date(sub.createdAt),
    updatedAt,
    deletedAt: null,
  };
  await tx.assessment.upsert({
    where: { id: sub.id },
    create: { id: sub.id, createdAt: new Date(sub.createdAt), ...data },
    update: data,
  });

  // scores
  const keys = Object.keys(sub.scores);
  for (const key of keys) {
    await tx.criterionScore.upsert({
      where: { assessmentId_criterionKey: { assessmentId: sub.id, criterionKey: key } },
      create: {
        id: derivedUuid('score', sub.id, key),
        assessmentId: sub.id,
        criterionKey: key,
        level: sub.scores[key]!,
        updatedAt,
      },
      update: { level: sub.scores[key]!, updatedAt, deletedAt: null },
    });
  }
  await tx.criterionScore.deleteMany({
    where: { assessmentId: sub.id, criterionKey: { notIn: keys } },
  });

  // photos + annotations
  for (const p of sub.pages) {
    const found = await tx.artworkPhoto.findUnique({
      where: { id: p.id },
      include: { assessment: true },
    });
    if (found && found.assessmentId !== sub.id) throw new Forbidden(`page ${p.id}`);
    const photo = {
      assessmentId: sub.id,
      storageKey: `${teacherId}/page/${p.id}.jpg`,
      width: p.width,
      height: p.height,
      quality: (p.quality ?? undefined) as Prisma.InputJsonValue | undefined,
      updatedAt,
      deletedAt: null,
    };
    await tx.artworkPhoto.upsert({
      where: { id: p.id },
      create: { id: p.id, ...photo },
      update: photo,
    });
    const annId = derivedUuid('annotation', p.id);
    const strokes = (sub.strokes[p.id] ?? []) as unknown as Prisma.InputJsonValue;
    await tx.annotation.upsert({
      where: { id: annId },
      create: { id: annId, photoId: p.id, strokes, updatedAt },
      update: { strokes, updatedAt, deletedAt: null },
    });
  }
  const pageIds = sub.pages.map((p) => p.id);
  await tx.artworkPhoto.updateMany({
    where: { assessmentId: sub.id, id: { notIn: pageIds }, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  // voice
  const voiceId = derivedUuid('voice', sub.id);
  if (sub.voice) {
    const v = {
      assessmentId: sub.id,
      storageKey: `${teacherId}/voice/${sub.id}.m4a`,
      durationMs: sub.voice.durationMs,
      language: sub.voice.language,
      updatedAt,
      deletedAt: null,
    };
    await tx.voiceNote.upsert({ where: { id: voiceId }, create: { id: voiceId, ...v }, update: v });
  } else {
    await tx.voiceNote.updateMany({
      where: { assessmentId: sub.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  // attachments
  for (const a of sub.attachments) {
    const found = await tx.feedbackAttachment.findUnique({ where: { id: a.id } });
    if (found && found.assessmentId !== sub.id) throw new Forbidden(`attachment ${a.id}`);
    const att = {
      assessmentId: sub.id,
      kind: a.kind,
      title: a.title,
      url: a.url,
      text: a.text ?? '',
      storageKey: a.ext ? `${teacherId}/attachment/${a.id}.${a.ext}` : null,
      updatedAt,
      deletedAt: null,
    };
    await tx.feedbackAttachment.upsert({
      where: { id: a.id },
      create: { id: a.id, ...att },
      update: att,
    });
  }
  await tx.feedbackAttachment.updateMany({
    where: {
      assessmentId: sub.id,
      id: { notIn: sub.attachments.map((a) => a.id) },
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });
}

async function missingMedia(teacherId: string, subs: SyncSubmission[]): Promise<MediaWanted> {
  const wanted: MediaWanted = { pages: [], voice: [], attachments: [] };
  for (const s of subs) {
    for (const p of s.pages)
      if (!(await exists(`${teacherId}/page/${p.id}.jpg`))) wanted.pages.push(p.id);
    if (s.voice && !(await exists(`${teacherId}/voice/${s.id}.m4a`))) wanted.voice.push(s.id);
    for (const a of s.attachments) {
      if (a.ext && !(await exists(`${teacherId}/attachment/${a.id}.${a.ext}`))) {
        wanted.attachments.push({ id: a.id, ext: a.ext });
      }
    }
  }
  return wanted;
}
