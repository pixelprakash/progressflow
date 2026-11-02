import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
export const UPLOAD_DIR = resolve(config.UPLOAD_DIR ?? `${repoRoot}/.data/uploads`);

/** Resolve a stored key to a path, refusing anything that escapes the upload dir. */
export function pathFor(storageKey: string): string {
  const p = resolve(UPLOAD_DIR, storageKey);
  if (!p.startsWith(UPLOAD_DIR + sep)) throw new Error('bad storage key');
  return p;
}

export async function exists(storageKey: string): Promise<boolean> {
  try {
    return (await stat(pathFor(storageKey))).isFile();
  } catch {
    return false;
  }
}

export async function save(storageKey: string, data: Buffer): Promise<void> {
  const p = pathFor(storageKey);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, data);
}

export const read = (storageKey: string) => readFile(pathFor(storageKey));

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  pdf: 'application/pdf',
};
const INLINE = new Set(['image/jpeg', 'image/png', 'image/webp', 'audio/mp4', 'audio/mpeg']);

export function describe(storageKey: string): { type: string; inline: boolean } {
  const ext = storageKey.split('.').pop()?.toLowerCase() ?? '';
  const type = TYPES[ext] ?? 'application/octet-stream';
  return { type, inline: INLINE.has(type) };
}
