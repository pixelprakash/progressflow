import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import { verifyToken } from './token.js';
import type { TokenType } from './token.js';

export const SESSION_COOKIE = 'pf_session';
export const STUDENT_COOKIE = 'pf_student';

declare module 'express-serve-static-core' {
  interface Request {
    teacherId?: string;
    studentId?: string;
  }
}

export function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

function tokenFrom(req: Request, cookie: string): string | undefined {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return (req.cookies as Record<string, string | undefined> | undefined)?.[cookie];
}

async function identify(req: Request, typ: TokenType, cookie: string): Promise<string | null> {
  const token = tokenFrom(req, cookie);
  const v = token ? await verifyToken(token) : null;
  // The type check is what keeps a student session out of teacher routes and the reverse.
  return v && v.typ === typ ? v.id : null;
}

/** Accepts `Authorization: Bearer <jwt>` (phone) or the httpOnly session cookie (web). */
export async function requireTeacher(req: Request, res: Response, next: NextFunction) {
  const id = await identify(req, 'teacher', SESSION_COOKIE);
  if (!id) return fail(res, 401, 'unauthenticated', 'sign in required');

  const user = await prisma.user.findFirst({
    where: { id, role: 'teacher', deletedAt: null },
    select: { id: true },
  });
  if (!user) return fail(res, 401, 'unauthenticated', 'sign in required');
  req.teacherId = user.id;
  next();
}

/** A student signed in with their join code. Must still be enrolled in a live class. */
export async function requireStudent(req: Request, res: Response, next: NextFunction) {
  const id = await identify(req, 'student', STUDENT_COOKIE);
  if (!id) return fail(res, 401, 'unauthenticated', 'sign in required');

  const student = await prisma.student.findFirst({
    where: {
      id,
      deletedAt: null,
      enrollments: { some: { deletedAt: null, klass: { deletedAt: null } } },
    },
    select: { id: true },
  });
  if (!student) return fail(res, 401, 'unauthenticated', 'sign in required');
  req.studentId = student.id;
  next();
}

/** Either kind of session; used by routes both may call (reading media). */
export async function requireActor(req: Request, res: Response, next: NextFunction) {
  if (await identify(req, 'teacher', SESSION_COOKIE)) return requireTeacher(req, res, next);
  if (await identify(req, 'student', STUDENT_COOKIE)) return requireStudent(req, res, next);
  return fail(res, 401, 'unauthenticated', 'sign in required');
}
