import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384;
const KEYLEN = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEYLEN, { N, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // Always do the work, so unknown accounts take as long as wrong passwords.
  const parts = stored?.split('$') ?? [];
  const valid = parts.length === 4 && parts[0] === 'scrypt';
  const salt = valid ? Buffer.from(parts[2]!, 'base64') : randomBytes(16);
  const expected = valid ? Buffer.from(parts[3]!, 'base64') : Buffer.alloc(KEYLEN);
  const actual = await derive(password, salt);
  return valid && expected.length === actual.length && timingSafeEqual(expected, actual);
}
