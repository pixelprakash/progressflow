import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LoginBody, RegisterBody } from '@progressflow/shared';
import type { AuthResponse, Language, TeacherProfile } from '@progressflow/shared';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { MOBILE_TTL_S, WEB_TTL_S, signToken } from '../auth/token.js';
import { SESSION_COOKIE, fail, requireTeacher } from '../auth/middleware.js';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'too many attempts, try again later' } },
});

function profile(u: {
  id: string;
  displayName: string;
  phone: string | null;
  languagePref: string;
  school: { name: string };
}): TeacherProfile {
  return {
    id: u.id,
    name: u.displayName,
    school: u.school.name,
    phone: u.phone ?? '',
    language: u.languagePref as Language,
  };
}

authRouter.post('/auth/register', limiter, async (req, res) => {
  const body = RegisterBody.safeParse(req.body);
  if (!body.success)
    return fail(
      res,
      400,
      'invalid',
      'check the form: name, school, +91 mobile, password of 8+ characters',
    );

  if (await prisma.user.findUnique({ where: { phone: body.data.phone } })) {
    return fail(res, 409, 'phone_in_use', 'an account with this mobile number already exists');
  }
  const passwordHash = await hashPassword(body.data.password);
  const user = await prisma.user.create({
    data: {
      role: 'teacher',
      displayName: body.data.name,
      phone: body.data.phone,
      languagePref: body.data.language,
      passwordHash,
      school: { create: { name: body.data.school } },
    },
    include: { school: true },
  });
  const t = await signToken(user.id, MOBILE_TTL_S);
  const out: AuthResponse = { ...t, user: profile(user) };
  res.status(201).json(out);
});

authRouter.post('/auth/login', limiter, async (req, res) => {
  const body = LoginBody.safeParse(req.body);
  if (!body.success) return fail(res, 400, 'invalid', 'enter your mobile number and password');

  const user = await prisma.user.findFirst({
    where: { phone: body.data.phone, role: 'teacher', deletedAt: null },
    include: { school: true },
  });
  const ok = await verifyPassword(body.data.password, user?.passwordHash ?? null);
  if (!user || !ok) return fail(res, 401, 'bad_credentials', 'wrong mobile number or password');

  const t = await signToken(user.id, body.data.cookie ? WEB_TTL_S : MOBILE_TTL_S);
  if (body.data.cookie) {
    res.cookie(SESSION_COOKIE, t.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
      maxAge: WEB_TTL_S * 1000,
      path: '/',
    });
  }
  const out: AuthResponse = { ...t, user: profile(user) };
  res.json(out);
});

authRouter.post('/auth/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireTeacher, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.teacherId! },
    include: { school: true },
  });
  res.json(profile(user));
});
