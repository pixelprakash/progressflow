/**
 * Local Postgres for development without Docker (embedded-postgres runs real
 * PostgreSQL binaries). Data lives in <repo>/.data/pg and survives restarts.
 *   npm run dev:db
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const databaseDir = resolve(root, '.data/pg');
const PORT = 5433;

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'progressflow',
  password: 'progressflow',
  port: PORT,
  persistent: true,
});

if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('progressflow');
} catch {
  /* already exists */
}
console.log(
  `postgres ready: postgresql://progressflow:progressflow@localhost:${PORT}/progressflow`,
);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
