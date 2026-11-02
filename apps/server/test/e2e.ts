/**
 * End-to-end check against a running server (npm run dev:db && npm run dev:server):
 *   npx tsx test/e2e.ts
 */
import { randomUUID } from 'node:crypto';
import { demoData } from '../../mobile/src/demo';
import { toPush } from '../../mobile/src/syncMap';
import type {
  AuthResponse,
  ClassDetail,
  Overview,
  SubmissionDetail,
  SyncPushResponse,
} from '@progressflow/shared';

const BASE = process.env.API ?? 'http://localhost:4000';
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};

async function call(
  path: string,
  init: RequestInit & { token?: string; cookie?: string; json?: unknown } = {},
) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.cookie) headers.cookie = init.cookie;
  if (init.json !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* binary or empty */
  }
  return { status: res.status, body, res, raw: text };
}

const suffix = String(Date.now()).slice(-8);
const phoneA = `+9190${suffix}`.slice(0, 13);
const phoneB = `+9191${suffix}`.slice(0, 13);
const reg = (phone: string, name: string) =>
  call('/v1/auth/register', {
    method: 'POST',
    json: { name, school: 'Test School', phone, password: 'correct horse 9', language: 'te' },
  });

// --- auth ---------------------------------------------------------------
const a = await reg(phoneA, 'Teacher A');
check('register teacher A', a.status === 201);
const A = a.body as AuthResponse;
check('duplicate phone rejected', (await reg(phoneA, 'Again')).status === 409);
check(
  'short password rejected',
  (
    await call('/v1/auth/register', {
      method: 'POST',
      json: { name: 'X Y', school: 'S S', phone: '+919000000099', password: 'short' },
    })
  ).status === 400,
);
check(
  'wrong password rejected',
  (
    await call('/v1/auth/login', {
      method: 'POST',
      json: { phone: phoneA, password: 'nope nope nope' },
    })
  ).status === 401,
);
check(
  'unknown phone rejected',
  (
    await call('/v1/auth/login', {
      method: 'POST',
      json: { phone: '+919000011122', password: 'whatever 123' },
    })
  ).status === 401,
);
check('overview needs auth', (await call('/v1/overview')).status === 401);
check(
  'garbage token rejected',
  (await call('/v1/overview', { token: 'abc.def.ghi' })).status === 401,
);

const web = await call('/v1/auth/login', {
  method: 'POST',
  json: { phone: phoneA, password: 'correct horse 9', cookie: true },
});
const setCookie = web.res.headers.get('set-cookie') ?? '';
check(
  'web login sets httpOnly cookie',
  /pf_session=/.test(setCookie) && /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie),
);
const cookie = setCookie.split(';')[0]!;
check('cookie authenticates /me', (await call('/v1/me', { cookie })).status === 200);

// --- push demo data + one rich submission ---------------------------------
const demo = demoData();
const klass = demo.classes.find((c) => c.grade === 7 && c.section === 'B')!;
const student = demo.students.find((s) => s.classId === klass.id)!;
const pageId = randomUUID(),
  subId = randomUUID(),
  attImg = randomUUID(),
  attLink = randomUUID();
const now = new Date().toISOString();
demo.submissions.push({
  id: subId,
  studentId: student.id,
  kind: 'portfolio',
  createdAt: now,
  updatedAt: now,
  note: 'Great shading on the left.',
  pages: [
    {
      id: pageId,
      uri: 'file:///x/p.jpg',
      width: 1200,
      height: 1600,
      quality: { score: 0.9, issues: [], sharpness: 2.4, brightness: 180 },
    },
  ],
  scores: { composition: 4, colour_theory: 3, technical_skill: 4, conceptual_depth: 3 },
  strokes: {
    [pageId]: [
      {
        tool: 'circle',
        color: '#E53935',
        width: 4,
        points: [
          [0.2, 0.2],
          [0.5, 0.5],
        ],
      },
    ],
  },
  voice: { uri: 'file:///x/v.m4a', durationMs: 4200, language: 'te' },
  attachments: [
    { id: attImg, kind: 'image', title: 'ref.jpg', uri: 'file:///x/ref.jpg' },
    { id: attLink, kind: 'link', title: 'Hatching tutorial', url: 'https://example.org/hatching' },
  ],
});
const body = toPush(demo, null);
const p1 = await call('/v1/sync/push', { method: 'POST', token: A.token, json: body });
const r1 = p1.body as SyncPushResponse;
check(
  'push accepted',
  p1.status === 200 && r1.accepted.length === demo.submissions.length,
  `accepted=${r1.accepted?.length}`,
);
check(
  'server asks for page/voice/attachment media',
  r1.mediaWanted.pages.includes(pageId) &&
    r1.mediaWanted.voice.includes(subId) &&
    r1.mediaWanted.attachments.some((x) => x.id === attImg),
);

const jpg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);
const put = (kind: string, id: string, ext: string, buf: Buffer, token = A.token) =>
  call(`/v1/media/${kind}/${id}?ext=${ext}`, {
    method: 'PUT',
    token,
    body: buf,
    headers: { 'content-type': 'application/octet-stream' },
  });
check('upload page', (await put('page', pageId, 'jpg', jpg)).status === 200);
check('upload voice', (await put('voice', subId, 'm4a', Buffer.from('fake-audio'))).status === 200);
check('upload attachment', (await put('attachment', attImg, 'jpg', jpg)).status === 200);
check(
  'upload for unknown id refused',
  (await put('page', randomUUID(), 'jpg', jpg)).status === 404,
);

const p2 = (await call('/v1/sync/push', { method: 'POST', token: A.token, json: body }))
  .body as SyncPushResponse;
check(
  're-push is idempotent and media no longer wanted',
  p2.accepted.length === demo.submissions.length &&
    p2.mediaWanted.pages.length === 0 &&
    p2.mediaWanted.voice.length === 0 &&
    p2.mediaWanted.attachments.length === 0,
);

const stale = toPush(demo, new Set([subId]));
stale.submissions[0]!.updatedAt = '2020-01-01T00:00:00.000Z';
const p3 = (await call('/v1/sync/push', { method: 'POST', token: A.token, json: stale }))
  .body as SyncPushResponse;
check('stale edit is skipped (last write wins)', p3.skipped.includes(subId));

// edit: remove the link attachment and the voice note, push again
demo.submissions.find((s) => s.id === subId)!.attachments = demo.submissions
  .find((s) => s.id === subId)!
  .attachments.filter((x) => x.id !== attLink);
demo.submissions.find((s) => s.id === subId)!.voice = null;
demo.submissions.find((s) => s.id === subId)!.updatedAt = new Date(Date.now() + 1000).toISOString();
await call('/v1/sync/push', {
  method: 'POST',
  token: A.token,
  json: toPush(demo, new Set([subId])),
});

// --- dashboard reads ----------------------------------------------------------
const ov = (await call('/v1/overview', { token: A.token })).body as Overview;
check(
  'overview counts',
  ov.counts.classes === 6 &&
    ov.counts.students === 25 &&
    ov.counts.submissions === demo.submissions.length,
  JSON.stringify(ov.counts),
);
const c7b = ov.classes.find((c) => c.label === '7-B')!;
check(
  'class 7-B averages computed',
  c7b.average !== null && c7b.criterionAverages.composition !== undefined,
  `avg=${c7b.average}`,
);
const cd = (await call(`/v1/classes/${klass.id}`, { token: A.token })).body as ClassDetail;
check(
  'class detail has roster + monthly trend',
  cd.students.length === 5 && cd.trend.length >= 3,
  `trend=${cd.trend.length}`,
);
const sd = (await call(`/v1/submissions/${subId}`, { token: A.token })).body as SubmissionDetail;
check(
  'submission detail: page, stroke, note',
  sd.pages.length === 1 && sd.pages[0]!.strokes.length === 1 && sd.note.startsWith('Great'),
);
check(
  'removed voice + link no longer returned',
  sd.voice === null && sd.attachments.length === 1 && sd.attachments[0]!.kind === 'image',
);
const img = await call(`/v1/media/page/${pageId}`, { cookie });
check(
  'page image served via cookie, inline jpeg',
  img.status === 200 &&
    img.res.headers.get('content-type') === 'image/jpeg' &&
    img.res.headers.get('content-disposition') === 'inline',
);

// --- isolation between teachers ---------------------------------------------------
const B = (await (await reg(phoneB, 'Teacher B')).body) as AuthResponse;
check(
  'teacher B sees empty dashboard',
  ((await call('/v1/overview', { token: B.token })).body as Overview).counts.submissions === 0,
);
check(
  'B cannot read A submission',
  (await call(`/v1/submissions/${subId}`, { token: B.token })).status === 404,
);
check(
  'B cannot read A class',
  (await call(`/v1/classes/${klass.id}`, { token: B.token })).status === 404,
);
check(
  'B cannot read A media',
  (await call(`/v1/media/page/${pageId}`, { token: B.token })).status === 404,
);
check(
  'B cannot upload over A media',
  (await put('page', pageId, 'jpg', Buffer.from('evil'), B.token)).status === 404,
);
check(
  'B cannot push into A class id',
  (
    await call('/v1/sync/push', {
      method: 'POST',
      token: B.token,
      json: { classes: body.classes.slice(0, 1), students: [], submissions: [] },
    })
  ).status === 403,
);
check(
  'B cannot push A student into own class',
  (
    await call('/v1/sync/push', {
      method: 'POST',
      token: B.token,
      json: {
        classes: [{ id: randomUUID(), grade: 6, section: 'A', assignment: 'x' }],
        students: [{ ...body.students[0]!, classId: body.classes[0]!.id }],
        submissions: [],
      },
    })
  ).status === 403,
);
const img2 = await call(`/v1/media/page/${pageId}`, { cookie });
check('A media unchanged after B attempt', img2.raw.length === img.raw.length);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
