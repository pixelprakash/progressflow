import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';

const key = new TextEncoder().encode(config.JWT_SECRET);

export const WEB_TTL_S = 12 * 60 * 60;
export const MOBILE_TTL_S = 90 * 24 * 60 * 60;
export const STUDENT_TTL_S = 8 * 60 * 60;

export type TokenType = 'teacher' | 'student';

export async function signToken(
  userId: string,
  ttlSeconds: number,
  typ: TokenType = 'teacher',
): Promise<{ token: string; expiresAt: string }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = await new SignJWT({ typ })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export async function verifyToken(token: string): Promise<{ id: string; typ: TokenType } | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    // tokens issued before the type claim existed were teacher tokens
    return { id: payload.sub, typ: payload.typ === 'student' ? 'student' : 'teacher' };
  } catch {
    return null;
  }
}
