import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('progressflow-media'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  SPEECH_MODEL: z.string().default('long'),
  JWT_SECRET: z.string().min(8),
  UPLOAD_DIR: z.string().optional(),
  /** Only needed if the web app is served from a different origin than the API. */
  WEB_ORIGIN: z.string().url().optional(),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

if (config.NODE_ENV === 'production' && config.JWT_SECRET.startsWith('dev-only')) {
  console.error('JWT_SECRET must be set to a real secret in production.');
  process.exit(1);
}
export const isDev = config.NODE_ENV === 'development';
