import { createApp } from './app.js';
import { config } from './config.js';
import { disconnect } from './db.js';
import { logger } from './logger.js';
import { ensureDefaultRubric } from './services/rubric.js';

await ensureDefaultRubric();
const app = createApp();
const server = app.listen(config.PORT, () => {
  logger.info(`progressflow-server listening on :${config.PORT} (${config.NODE_ENV})`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close();
  await disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
