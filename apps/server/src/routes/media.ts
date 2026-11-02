import { Router } from 'express';
import express from 'express';
import { MEDIA_KINDS } from '@progressflow/shared';
import type { MediaKind } from '@progressflow/shared';
import { prisma } from '../db.js';
import { fail, requireTeacher } from '../auth/middleware.js';
import { describe, read, save } from '../services/media.js';

export const mediaRouter = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Storage key for media the signed-in teacher owns (from the DB, never from the client). */
async function keyFor(teacherId: string, kind: MediaKind, id: string): Promise<string | null> {
  const owned = { assignment: { klass: { teacherId } } };
  if (kind === 'page') {
    const p = await prisma.artworkPhoto.findFirst({
      where: { id, deletedAt: null, assessment: owned },
    });
    return p?.storageKey ?? null;
  }
  if (kind === 'voice') {
    // For voice the id in the URL is the submission (assessment) id.
    const v = await prisma.voiceNote.findFirst({
      where: { assessmentId: id, deletedAt: null, assessment: owned },
    });
    return v?.storageKey ?? null;
  }
  const a = await prisma.feedbackAttachment.findFirst({
    where: { id, deletedAt: null, assessment: owned },
  });
  return a?.storageKey ?? null;
}

function parse(kind: string, id: string): kind is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(kind) && UUID.test(id);
}

mediaRouter.put(
  '/media/:kind/:id',
  requireTeacher,
  express.raw({ type: () => true, limit: '40mb' }),
  async (req, res) => {
    const { kind, id } = req.params as { kind: string; id: string };
    if (!parse(kind, id) || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return fail(res, 400, 'invalid', 'bad media request');
    }
    const key = await keyFor(req.teacherId!, kind, id);
    if (!key) return fail(res, 404, 'not_found', 'push the submission before its media');
    await save(key, req.body);
    res.json({ ok: true });
  },
);

mediaRouter.get('/media/:kind/:id', requireTeacher, async (req, res) => {
  const { kind, id } = req.params as { kind: string; id: string };
  if (!parse(kind, id)) return fail(res, 400, 'invalid', 'bad media request');
  const key = await keyFor(req.teacherId!, kind, id);
  if (!key) return fail(res, 404, 'not_found', 'no such media');
  try {
    const { type, inline } = describe(key);
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', inline ? 'inline' : 'attachment');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(await read(key));
  } catch {
    fail(res, 404, 'not_found', 'file has not been uploaded yet');
  }
});
