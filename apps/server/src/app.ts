import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { logger } from './logger.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { healthRouter } from './routes/health.js';
import { mediaRouter } from './routes/media.js';
import { syncRouter } from './routes/sync.js';

const here = dirname(fileURLToPath(import.meta.url));
const WEB_DIST = resolve(here, '../../web/dist');

export function createApp() {
  const app = express();

  // Behind a host's proxy (Vercel, Render, Fly): trust it for the client IP, or the
  // login rate limit would see every user as the same address.
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { 'img-src': ["'self'", 'blob:', 'data:'], 'media-src': ["'self'", 'blob:'] },
      },
    }),
  );
  // Same-origin by default (web is served by this server or proxied in dev).
  if (config.WEB_ORIGIN) app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.use('/', healthRouter);
  // The phone sends the full snapshot of changed submissions, so allow a larger body here.
  app.use('/v1/sync', express.json({ limit: '8mb' }));
  app.use('/v1', express.json({ limit: '256kb' }));
  app.use('/v1', authRouter);
  app.use('/v1', syncRouter);
  app.use('/v1', mediaRouter);
  app.use('/v1', dashboardRouter);

  app.use('/v1', (_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'no such route' } });
  });

  if (existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(resolve(WEB_DIST, 'index.html')));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error({ err }, 'unhandled error');
      res.status(500).json({ error: { code: 'internal', message: 'unexpected error' } });
    },
  );

  return app;
}
