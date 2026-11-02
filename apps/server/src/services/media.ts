import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { config } from '../config.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
export const UPLOAD_DIR = resolve(config.UPLOAD_DIR ?? `${repoRoot}/.data/uploads`);

/** Resolve a stored key to a path, refusing anything that escapes the upload dir. */
export function pathFor(storageKey: string): string {
  const p = resolve(UPLOAD_DIR, storageKey);
  if (!p.startsWith(UPLOAD_DIR + sep)) throw new Error('bad storage key');
  return p;
}

/**
 * Two storage drivers behind the same three functions:
 *  - S3-compatible object storage when S3_ACCESS_KEY and S3_SECRET_KEY are set
 *    (Cloudflare R2, AWS S3, Supabase, MinIO). Required on serverless hosts.
 *  - The local disk otherwise (development).
 * The bucket stays private: every read goes through the API's ownership check.
 */
export const usingS3 = Boolean(config.S3_ACCESS_KEY && config.S3_SECRET_KEY);

let s3: S3Client | undefined;
const client = () =>
  (s3 ??= new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: config.S3_ACCESS_KEY!, secretAccessKey: config.S3_SECRET_KEY! },
    // R2, MinIO and others don't accept the SDK's newer default checksums
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  }));

export async function exists(storageKey: string): Promise<boolean> {
  if (usingS3) {
    try {
      await client().send(new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: storageKey }));
      return true;
    } catch {
      return false;
    }
  }
  try {
    return (await stat(pathFor(storageKey))).isFile();
  } catch {
    return false;
  }
}

export async function save(storageKey: string, data: Buffer): Promise<void> {
  if (usingS3) {
    await client().send(
      new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: storageKey,
        Body: data,
        ContentType: describe(storageKey).type,
      }),
    );
    return;
  }
  const p = pathFor(storageKey);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, data);
}

export async function read(storageKey: string): Promise<Buffer> {
  if (usingS3) {
    const out = await client().send(
      new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: storageKey }),
    );
    return Buffer.from(await out.Body!.transformToByteArray());
  }
  return readFile(pathFor(storageKey));
}

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
