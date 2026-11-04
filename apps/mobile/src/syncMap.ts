import type { SyncCriterion, SyncPushBody, SyncSubmission, SyncType } from '@progressflow/shared';
import type { AppData, Submission } from './domain';

/**
 * Pure mapping from the phone's local data to the sync payload — no React
 * Native imports, so it is unit-testable in Node. Server side: routes/sync.ts.
 */

export const extOf = (uri: string, fallback: string) => {
  const m = /\.([A-Za-z0-9]{1,5})(?:\?|$)/.exec(uri);
  return (m?.[1] ?? fallback).toLowerCase();
};

export function toSyncSubmission(s: Submission): SyncSubmission {
  const pageIds = new Set(s.pages.map((p) => p.id));
  return {
    id: s.id,
    studentId: s.studentId,
    kind: s.kind,
    completedAt: s.completedAt ?? null,
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

const cut = (v: string, n: number) => v.slice(0, n);

/** The teacher's assessment types, trimmed to what the server accepts. Empty = the defaults. */
export function toSyncTypes(data: AppData): SyncType[] {
  return (data.types ?? []).map((t) => ({
    id: t.id,
    ...(t.label?.trim() ? { label: cut(t.label.trim(), 60) } : {}),
  }));
}

/** The teacher's rubric, trimmed to what the server accepts; null = the standard four. */
export function toSyncRubric(data: AppData): SyncCriterion[] | null {
  if (!data.rubric?.length) return null;
  return data.rubric.map((g) => ({
    key: g.key,
    name: cut(g.name, 80),
    icon: cut(g.icon, 60),
    color: /^#[0-9A-Fa-f]{6}$/.test(g.color) ? g.color : '#2E5AAC',
    tagline: cut(g.tagline, 200),
    askStudent: cut(g.askStudent, 300),
    lookFor: g.lookFor
      .slice(0, 6)
      .map((l) => ({ title: cut(l.title, 80), text: cut(l.text, 400) })),
    levels: {
      1: cut(g.levels[1], 400),
      2: cut(g.levels[2], 400),
      3: cut(g.levels[3], 400),
      4: cut(g.levels[4], 400),
    },
  }));
}

export function toPush(data: AppData, only: ReadonlySet<string> | null): SyncPushBody {
  return {
    types: toSyncTypes(data),
    rubric: toSyncRubric(data),
    deleted: {
      classes: data.deleted?.classes ?? [],
      students: data.deleted?.students ?? [],
      submissions: data.deleted?.submissions ?? [],
    },
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
