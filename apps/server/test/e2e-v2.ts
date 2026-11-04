/**
 * Version 2 sync: teacher-defined assessment types, custom rubric, the Save status and
 * deletions. Needs a running server and database (npm run dev:db && npm run dev:server):
 *   npm run test:e2e:v2
 */
import { randomUUID } from 'node:crypto';
import { demoData } from '../../mobile/src/demo';
import { toPush } from '../../mobile/src/syncMap';
import type { AppData } from '../../mobile/src/domain';
import type {
  AuthResponse,
  ClassDetail,
  Overview,
  SyncPushBody,
  SyncPushResponse,
  TeacherConfig,
} from '@progressflow/shared';

const BASE = process.env.API ?? 'http://localhost:4000';
let failed = 0;
let count = 0;
const check = (name: string, ok: boolean, extra = '') => {
  count++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};

async function call(
  path: string,
  init: RequestInit & { token?: string; cookie?: string; json?: unknown; body?: BodyInit } = {},
) {
  const headers: Record<string, string> = {};
  if (init.cookie) headers.cookie = init.cookie;
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.json !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method: init.method,
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
  return { status: res.status, body, setCookie: res.headers.get('set-cookie') ?? '' };
}

const suffix = String(Date.now()).slice(-8);
const register = async (prefix: string, name: string) => {
  const r = await call('/v1/auth/register', {
    method: 'POST',
    json: {
      name,
      school: 'Test School',
      phone: `+91${prefix}${suffix}`.slice(0, 13),
      password: 'correct horse 9',
      language: 'en',
    },
  });
  return r.body as AuthResponse;
};
const A = await register('92', 'Teacher A');
const B = await register('93', 'Teacher B');
const push = (token: string, body: unknown) =>
  call('/v1/sync/push', { method: 'POST', token, json: body });
const overview = async (token: string) => (await call('/v1/overview', { token })).body as Overview;

// --- a small class with one saved and one unsaved submission ----------------
const demo = demoData();
const klass = demo.classes.find((c) => c.grade === 7 && c.section === 'B')!;
const roster = demo.students.filter((s) => s.classId === klass.id);
const [s1, s2] = roster as [(typeof roster)[0], (typeof roster)[0]];
const now = new Date().toISOString();
const sub = (
  studentId: string,
  kind: string,
  completedAt: string | null,
  scores: Record<string, 1 | 2 | 3 | 4>,
) => ({
  id: randomUUID(),
  studentId,
  kind,
  createdAt: now,
  updatedAt: now,
  completedAt,
  pages: [{ id: randomUUID(), width: 1200, height: 1600, quality: null }],
  scores,
  strokes: {},
  voice: null,
  attachments: [],
  note: '',
});
const saved = sub(s1.id, 'exam1', now, { composition: 3, colour_theory: 4 });
const unsaved = sub(s2.id, 't_abcd1234', null, { composition: 2 });

const data: AppData = {
  classes: [klass],
  students: roster,
  submissions: [],
};
const base = toPush(data, null);
const first = await push(A.token, { ...base, submissions: [saved, unsaved] });
check('a push with custom kinds and Save status is accepted', first.status === 200);
check('both submissions accepted', (first.body as SyncPushResponse).accepted.length === 2);

const cd = (await call(`/v1/classes/${klass.id}`, { token: A.token })).body as ClassDetail;
const byId = new Map(cd.submissions.map((s) => [s.id, s]));
check('a built-in new type passes through', byId.get(saved.id)?.kind === 'exam1');
check('a teacher-made type passes through', byId.get(unsaved.id)?.kind === 't_abcd1234');
check(
  'Save status is kept',
  byId.get(saved.id)?.saved === true && byId.get(unsaved.id)?.saved === false,
);
check(
  'only the unsaved piece is waiting',
  cd.summary.waiting === 1,
  `waiting=${cd.summary.waiting}`,
);

const bad = await push(A.token, { ...base, submissions: [{ ...unsaved, kind: 'has spaces' }] });
check('a kind with spaces is rejected', bad.status === 400);

// --- types and rubric -------------------------------------------------------
const types = [
  { id: 'exam1', label: 'Unit test' },
  { id: 't_abcd1234', label: 'Field trip' },
  { id: 'assignment' },
];
const criterion = (key: string, name: string) => ({
  key,
  name,
  icon: 'star-outline',
  color: '#2E5AAC',
  tagline: '',
  askStudent: '',
  lookFor: [],
  levels: { 1: 'a', 2: 'b', 3: 'c', 4: 'd' },
});
const rubric = [criterion('composition', 'Layout'), criterion('c_texture1', 'Texture')];
const withCfg = await push(A.token, { ...base, submissions: [], types, rubric });
check('types and a custom rubric are accepted', withCfg.status === 200);
const cfg = (await call('/v1/config', { token: A.token })).body as TeacherConfig;
check(
  'config returns the types in order',
  cfg.types.map((t) => t.id).join() === 'exam1,t_abcd1234,assignment',
);
check(
  'config returns the labels',
  cfg.types[0]?.label === 'Unit test' && cfg.types[2]?.label === undefined,
);
check('config returns the rubric', cfg.rubric?.length === 2 && cfg.rubric[1]?.name === 'Texture');
const cd2 = (await call(`/v1/classes/${klass.id}`, { token: A.token })).body as ClassDetail;
check(
  'a criterion removed from the rubric leaves the averages',
  !('colour_theory' in cd2.summary.criterionAverages) &&
    'composition' in cd2.summary.criterionAverages,
  JSON.stringify(cd2.summary.criterionAverages),
);
const badRubric = await push(A.token, {
  ...base,
  submissions: [],
  rubric: [{ ...criterion('Bad Key', 'x') }],
});
check('a malformed rubric is rejected', badRubric.status === 400);
const reset = await push(A.token, {
  classes: base.classes,
  students: base.students,
  submissions: [],
  rubric: null,
});
const cfg2 = (await call('/v1/config', { token: A.token })).body as TeacherConfig;
check('rubric null resets to the standard four', reset.status === 200 && cfg2.rubric === null);
const omitted = await push(A.token, {
  classes: base.classes,
  students: base.students,
  submissions: [],
});
const cfg3 = (await call('/v1/config', { token: A.token })).body as TeacherConfig;
check('omitting types leaves them unchanged', omitted.status === 200 && cfg3.types.length === 3);
check(
  'a second teacher has no config',
  ((await call('/v1/config', { token: B.token })).body as TeacherConfig).types.length === 0,
);

// --- what a student sees of a teacher's own type ----------------------------
const joinOf = async (id: string) =>
  ((await call(`/v1/classes/${klass.id}`, { token: A.token })).body as ClassDetail).students.find(
    (s) => s.id === id,
  )!.joinCode;
const studentSession = (
  await call('/v1/student/login', { method: 'POST', json: { code: await joinOf(s2.id) } })
).setCookie.split(';')[0]!;
const portal = (await call('/v1/student/portal', { cookie: studentSession })).body as {
  pieces: { kind: string }[];
};
check(
  "a student sees the teacher's label for a type the teacher made",
  portal.pieces[0]?.kind === 'Field trip',
  String(portal.pieces[0]?.kind),
);

// --- deletions --------------------------------------------------------------
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const upload = (token: string, id: string) =>
  call(`/v1/media/page/${id}?ext=jpg`, { method: 'PUT', token, body: jpg });
const pageOf = (s: typeof saved) => s.pages[0]!.id;
check('photo uploaded', (await upload(A.token, pageOf(saved))).status < 300);
check(
  'photo readable',
  (await call(`/v1/media/page/${pageOf(saved)}`, { token: A.token })).status === 200,
);

const stolen: SyncPushBody['deleted'] = {
  classes: [klass.id],
  students: [s1.id, s2.id],
  submissions: [saved.id, unsaved.id],
};
const attack = await push(B.token, { classes: [], students: [], submissions: [], deleted: stolen });
check("another teacher's delete request is ignored, not an error", attack.status === 200);
const afterAttack = await overview(A.token);
check(
  'their classes, students and work are untouched',
  afterAttack.counts.classes === 1 &&
    afterAttack.counts.students === roster.length &&
    afterAttack.counts.submissions === 2,
);
check(
  'their photo is untouched',
  (await call(`/v1/media/page/${pageOf(saved)}`, { token: A.token })).status === 200,
);

const delOne = await push(A.token, {
  classes: [],
  students: [],
  submissions: [],
  deleted: { classes: [], students: [], submissions: [saved.id] },
});
check(
  'a deleted submission is acknowledged',
  (delOne.body as SyncPushResponse).deleted?.submissions[0] === saved.id,
);
check(
  'the submission is gone from the dashboard',
  (await overview(A.token)).counts.submissions === 1,
);
check(
  'its photo is erased from storage',
  (await call(`/v1/media/page/${pageOf(saved)}`, { token: A.token })).status === 404,
);

const code = (
  (await call(`/v1/classes/${klass.id}`, { token: A.token })).body as ClassDetail
).students.find((s) => s.id === s2.id)!.joinCode;
check(
  'the student can sign in to the portal',
  (await call('/v1/student/login', { method: 'POST', json: { code } })).status === 200,
);
await push(A.token, {
  classes: [],
  students: [],
  submissions: [],
  deleted: { classes: [], students: [s2.id], submissions: [] },
});
const ov2 = await overview(A.token);
check('a deleted student leaves the roster', ov2.counts.students === roster.length - 1);
check('their work goes with them', ov2.counts.submissions === 0);
check(
  'their portal code stops working',
  (await call('/v1/student/login', { method: 'POST', json: { code } })).status === 401,
);

await push(A.token, {
  classes: [],
  students: [],
  submissions: [],
  deleted: { classes: [klass.id], students: [], submissions: [] },
});
const ov3 = await overview(A.token);
check(
  'a deleted class leaves the dashboard',
  ov3.counts.classes === 0 && ov3.counts.students === 0,
);
check(
  'its page is a 404',
  (await call(`/v1/classes/${klass.id}`, { token: A.token })).status === 404,
);
const again = await push(A.token, {
  classes: [],
  students: [],
  submissions: [],
  deleted: { classes: [klass.id], students: [], submissions: [saved.id] },
});
check('deleting the same things again is harmless', again.status === 200);
const recreated = await push(A.token, { ...base, submissions: [] });
check(
  'a class pushed again after deletion comes back',
  recreated.status === 200 && (await overview(A.token)).counts.classes === 1,
);

console.log(`\n${count} checks`);
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
