import { createHash } from 'node:crypto';

/** Stable UUID derived from its inputs (v5-style), so repeated pushes hit the same rows. */
export function derivedUuid(...parts: string[]): string {
  const h = createHash('sha1').update(parts.join('\u0000')).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

/** Indian academic year starts in June: Nov 2026 -> "2026-27". */
export function academicYear(d = new Date()): string {
  const y = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}
