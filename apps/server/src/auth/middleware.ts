import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import { verifyToken } from './token.js';

export const SESSION_COOKIE = 'pf_session';

declare module 'express-serve-static-core' {
  interface Request {
    teacherId?: string;
  }
}

export function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

/** Accepts `Authorization: Bearer <jwt>` (phone) or the httpOnly session cookie (web). */
export async function requireTeacher(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : (req.cookies as Record<string, string | undefined> | undefined)?.[SESSION_COOKIE];
  const id = token ? await verifyToken(token) : null;
  if (!id) return fail(res, 401, 'unauthenticated', 'sign in required');

  const user = await prisma.user.findFirst({
    where: { id, role: 'teacher', deletedAt: null },
    select: { id: true },
  });
  if (!user) return fail(res, 401, 'unauthenticated', 'sign in required');
  req.teacherId = user.id;
  next();
}
