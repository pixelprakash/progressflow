// Vercel serverless entry. Runs the compiled Express app (built by `npm run build`).
import { createApp } from '../dist/app.js';
import { ensureDefaultRubric } from '../dist/services/rubric.js';

const app = createApp();
let ready;

export default async function handler(req, res) {
  // Seed the default rubric once per warm instance; retry on the next request if it failed.
  ready ??= ensureDefaultRubric().catch((e) => {
    ready = undefined;
    throw e;
  });
  await ready;
  return app(req, res);
}
