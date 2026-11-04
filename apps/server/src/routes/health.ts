import { Router } from 'express';
import type { HealthResponse } from '@progressflow/shared';
import { prisma } from '../db.js';
import { probe } from '../services/media.js';

export const healthRouter = Router();

healthRouter.get('/healthz', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'progressflow-server',
    version: process.env.npm_package_version ?? '0.0.0',
    time: new Date().toISOString(),
  };
  res.json(body);
});

/** Readiness: also checks the database connection. */
healthRouter.get('/readyz', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up', storage: await probe() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});
