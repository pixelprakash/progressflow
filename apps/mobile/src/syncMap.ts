import type { SyncPushBody, SyncSubmission } from '@progressflow/shared';
import type { AppData, Submission } from './domain';

/**
 * Pure mapping from the phone's local data to the sync payload — no React
 * Native imports, so it is unit-testable in Node. Server side: routes/sync.ts.
 */

export const extOf = (uri: string, fallback: string) => {
  const m = /\.([A-Za-z0-9]{1,5})(?:\?|$)/.exec(uri);
  return (m?.[1] ?? fallback).toLowerCase();
};

/**
 * The server stores four kinds. Core ones pass through; assignment, exams, quarterly
 * and anything the teacher invented are filed as 'regular' there until the server
 * learns the teacher's own types.
 */
export function toServerKind(kind: string): SyncSubmission['kind'] {
  return kind === 'sketch' || kind === 'progress' || kind === 'portfolio' ? kind : 'regular';
}

export function toSyncSubmission(s: Submission): SyncSubmission {
  const pageIds = new Set(s.pages.map((p) => p.id));
  return {
    id: s.id,
    studentId: s.studentId,
    kind: toServerKind(s.kind),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    note: s.note,
    scores: Object.fromEntries(
      Object.entries(s.scores).flatMap(([k, v]) => (v === undefined ? [] : [[k, v]])),
    ),
    pages: s.pages.map((p) => ({ id: p.id, width: p.width, height: p.height, quality: p.quality })),
    strokes: Object.fromEntries(
      Object.entries(s.strokes).filter(([pageId]) => pageIds.has(pageId)),
    ),
    voice: s.voice ? { durationMs: s.voice.durationMs, language: s.voice.language } : null,
    attachments: s.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      url: a.url ?? null,
      text: a.text ?? null,
      ext: a.uri ? extOf(a.uri, 'bin') : null,
    })),
  };
}

export function toPush(data: AppData, only: ReadonlySet<string> | null): SyncPushBody {
  return {
    classes: data.classes.map((c) => ({
      id: c.id,
      grade: c.grade,
      section: c.section,
      assignment: c.assignment,
    })),
    students: data.students.map((s) => ({
      id: s.id,
      classId: s.classId,
      name: s.name,
      rollNo: s.rollNo,
    })),
    submissions: data.submissions
      .filter((s) => only === null || only.has(s.id))
      .map(toSyncSubmission),
  };
}
