/**
 * Student portal, self-review and peer-review checks against a running server:
 *   npx tsx test/e2e-student.ts
 */
import { randomUUID } from 'node:crypto';
import { demoData } from '../../mobile/src/demo';
import { toPush } from '../../mobile/src/syncMap';
import type {
  AuthResponse, ClassDetail, Overview, PeerCandidate, StudentPortal, SubmissionDetail, SyncPushResponse,
} from '@progressflow/shared';

const BASE = process.env.API ?? 'http://localhost:4000';
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};

async function call(path: string, o: { method?: string; token?: string; cookie?: string; json?: unknown; body?: Buffer } = {}) {
  const headers: Record<string, string> = {};
  if (o.token) headers.authorization = `Bearer ${o.token}`;
  if (o.cookie) headers.cookie = o.cookie;
  if (o.json !== undefined) headers['content-type'] = 'application/json';
  if (o.body) headers['content-type'] = 'application/octet-stream';
  const res = await fetch(BASE + path, { method: o.method ?? (o.json !== undefined || o.body ? 'POST' : 'GET'), headers, body: o.json !== undefined ? JSON.stringify(o.json) : o.body });
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* binary */ }
  return { status: res.status, body, res, raw: text };
}

const suffix = String(Date.now()).slice(-8);
const phone = `+9192${suffix}`.slice(0, 13);
const reg = await call('/v1/auth/register', { json: { name: 'Teacher S', school: 'Test School', phone, password: 'correct horse 9', language: 'hi' } });
const T = reg.body as AuthResponse;
const web = await call('/v1/auth/login', { json: { phone, password: 'correct horse 9', cookie: true } });
const teacherCookie = (web.res.headers.get('set-cookie') ?? '').split(';')[0]!;

// ---- data: class 7-B with an author, a reviewer, a third student; plus a student in 7-A
const demo = demoData();
const k7b = demo.classes.find((c) => c.grade === 7 && c.section === 'B')!;
const k7a = demo.classes.find((c) => c.grade === 7 && c.section === 'A')!;
const [author, reviewer, third] = demo.students.filter((s) => s.classId === k7b.id);
const outsider = demo.students.find((s) => s.classId === k7a.id)!;
const mkPiece = (studentId: string, label: string) => {
  const pageId = randomUUID(); const id = randomUUID(); const now = new Date().toISOString();
  return {
    pageId, sub: {
      id, studentId, kind: 'portfolio' as const, createdAt: now, updatedAt: now, note: `Note for ${label}`,
      pages: [{ id: pageId, uri: 'x.jpg', width: 1000, height: 1400, quality: null }],
      scores: { composition: 4, colour_theory: 3, technical_skill: 4, conceptual_depth: 3 },
      strokes: {}, voice: { uri: 'v.m4a', durationMs: 3000, language: 'te' as const }, attachments: [{ id: randomUUID(), kind: 'note' as const, title: 'tip', text: 'secret tip' }], note2: '',
    },
  };
};
const a = mkPiece(author!.id, 'author'); const r = mkPiece(reviewer!.id, 'reviewer');
demo.submissions.push(a.sub as never, r.sub as never);
const push = (await call('/v1/sync/push', { token: T.token, json: toPush(demo, null) })).body as SyncPushResponse;
const jpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
for (const p of [a, r]) {
  const up = await call(`/v1/media/page/${p.pageId}?ext=jpg`, { method: 'PUT', token: T.token, body: jpg });
  check('setup: page uploaded', up.status === 200, `status=${up.status} ${up.raw.slice(0, 100)}`);
}
await call(`/v1/media/voice/${a.sub.id}?ext=m4a`, { method: 'PUT', token: T.token, body: Buffer.from('audio') });
check('setup: data pushed', push.accepted.includes(a.sub.id) && push.accepted.includes(r.sub.id));

// ---- join codes
const cd = (await call(`/v1/classes/${k7b.id}`, { cookie: teacherCookie })).body as ClassDetail;
const codeOf = (id: string) => cd.students.find((s) => s.id === id)!.joinCode;
const cdA = (await call(`/v1/classes/${k7a.id}`, { cookie: teacherCookie })).body as ClassDetail;
check('teacher sees 6-character join codes', cd.students.every((s) => /^[A-Z0-9]{6}$/.test(s.joinCode)));

// ---- student login
const login = (code: string) => call('/v1/student/login', { json: { code } });
check('wrong code rejected', (await login('ZZZZZZ')).status === 401);
check('malformed code rejected', (await login('abc')).status === 401);
const mkSession = async (code: string) => {
  const res = await login(code.toLowerCase()); // typed in lower case on a phone
  return { status: res.status, cookie: (res.res.headers.get('set-cookie') ?? '').split(';')[0]!, raw: res.res.headers.get('set-cookie') ?? '' };
};
const A = await mkSession(codeOf(author!.id));
check('code login works (case-insensitive) and sets httpOnly cookie', A.status === 200 && /HttpOnly/i.test(A.raw) && /pf_student=/.test(A.raw));
const R = await mkSession(codeOf(reviewer!.id));
const Th = await mkSession(codeOf(third!.id));
const O = await mkSession(cdA.students.find((s) => s.id === outsider.id)!.joinCode);

// ---- separation of sessions
check('student cookie cannot read teacher overview', (await call('/v1/overview', { cookie: A.cookie })).status === 401);
check('student cookie cannot read teacher /me', (await call('/v1/me', { cookie: A.cookie })).status === 401);
check('teacher cookie cannot read student portal', (await call('/v1/student/portal', { cookie: teacherCookie })).status === 401);
check('teacher bearer cannot read student portal', (await call('/v1/student/portal', { token: T.token })).status === 401);
check('student cannot upload media', (await call(`/v1/media/page/${a.pageId}?ext=jpg`, { method: 'PUT', cookie: A.cookie, body: jpg })).status === 401);

// ---- portal only shows own work
const portalA = (await call('/v1/student/portal', { cookie: A.cookie })).body as StudentPortal;
const portalR = (await call('/v1/student/portal', { cookie: R.cookie })).body as StudentPortal;
check('author portal: only own pieces, includes the new one', portalA.pieces.some((p) => p.id === a.sub.id) && !portalA.pieces.some((p) => p.id === r.sub.id));
check('reviewer portal does not contain the author piece', !portalR.pieces.some((p) => p.id === a.sub.id) && portalR.pieces.some((p) => p.id === r.sub.id));
check('portal profile is the signed-in student', portalA.student.id === author!.id && portalA.student.classLabel === '7-B');
check('portal never contains other students ids', !JSON.stringify(portalA).includes(reviewer!.id));

// ---- media scope
const m1 = await call(`/v1/media/page/${a.pageId}`, { cookie: A.cookie });
check('author reads own page', m1.status === 200, `status=${m1.status} ${m1.raw.slice(0, 120)}`);
check('author reads own voice note', (await call(`/v1/media/voice/${a.sub.id}`, { cookie: A.cookie })).status === 200);
check("classmate cannot read author's page (not open)", (await call(`/v1/media/page/${a.pageId}`, { cookie: R.cookie })).status === 404);
check("student in another class cannot read page", (await call(`/v1/media/page/${a.pageId}`, { cookie: O.cookie })).status === 404);

// ---- self review
const ok4 = { composition: 3, colour_theory: 2, technical_skill: 3, conceptual_depth: 2 };
const selfBody = (over: object = {}) => ({ kind: 'self', submissionId: a.sub.id, scores: ok4, answers: [{ promptKey: 'worked', text: 'my shading' }, { promptKey: 'change', text: 'more contrast' }, { promptKey: 'sure', choice: 'partly', text: '' }], ...over });
check('self review: missing a criterion rejected', (await call('/v1/student/reviews', { cookie: A.cookie, json: selfBody({ scores: { composition: 3 } }) })).status === 400);
check('self review: level out of range rejected', (await call('/v1/student/reviews', { cookie: A.cookie, json: selfBody({ scores: { ...ok4, composition: 9 } }) })).status === 400);
check('self review: unknown prompt rejected', (await call('/v1/student/reviews', { cookie: A.cookie, json: selfBody({ answers: [{ promptKey: 'hack', text: 'x' }] }) })).status === 400);
check('self review: empty answers rejected', (await call('/v1/student/reviews', { cookie: A.cookie, json: selfBody({ answers: [{ promptKey: 'worked', text: '' }, { promptKey: 'change', text: '' }] }) })).status === 400);
check('self review: text over 500 chars rejected', (await call('/v1/student/reviews', { cookie: A.cookie, json: selfBody({ answers: [{ promptKey: 'worked', text: 'x'.repeat(501) }, { promptKey: 'change', text: 'y' }] }) })).status === 400);
check("cannot self-review someone else's piece", (await call('/v1/student/reviews', { cookie: R.cookie, json: { ...selfBody(), submissionId: a.sub.id } })).status === 404);
check('self review accepted', (await call('/v1/student/reviews', { cookie: A.cookie, json: selfBody() })).status === 201);
check('self review: second attempt refused', (await call('/v1/student/reviews', { cookie: A.cookie, json: selfBody() })).status === 409);
const portalA2 = (await call('/v1/student/portal', { cookie: A.cookie })).body as StudentPortal;
check('portal now shows my self review', portalA2.pieces.find((p) => p.id === a.sub.id)?.self?.scores.composition === 3);
const detail0 = (await call(`/v1/submissions/${a.sub.id}`, { cookie: teacherCookie })).body as SubmissionDetail;
check("teacher sees the student's self review", detail0.reviews.self?.scores.composition === 3 && detail0.reviews.self.answers.some((x) => x.text === 'my shading'));
const ov0 = (await call('/v1/overview', { cookie: teacherCookie })).body as Overview;
check('self review does not count as a submission', ov0.counts.submissions === demo.submissions.length);

// ---- peer review
const peerBody = (id = a.sub.id) => ({ kind: 'peer', submissionId: id, scores: ok4, answers: [{ promptKey: 'works', text: 'nice shading' }, { promptKey: 'suggest', text: 'add a shadow' }] });
check('nothing open yet: peer list is empty', ((await call('/v1/student/peer', { cookie: R.cookie })).body as PeerCandidate[]).length === 0);
check('cannot peer-review a piece that is not open', (await call('/v1/student/reviews', { cookie: R.cookie, json: peerBody() })).status === 404);
check('student cannot open a piece for peers', (await call(`/v1/submissions/${a.sub.id}/peer-open`, { cookie: A.cookie, json: { open: true } })).status === 401);
check('teacher opens the piece', (await call(`/v1/submissions/${a.sub.id}/peer-open`, { cookie: teacherCookie, json: { open: true } })).status === 200);
const list = (await call('/v1/student/peer', { cookie: R.cookie })).body as PeerCandidate[];
check('reviewer now sees the open piece', list.length === 1 && list[0]!.id === a.sub.id);
check('peer list leaks no names, scores or notes', !/Note for|studentId|secret tip|"scores"|byName|displayName/.test(JSON.stringify(list)));
check('author does not get their own piece to review', ((await call('/v1/student/peer', { cookie: A.cookie })).body as PeerCandidate[]).length === 0);
check('outsider (other class) sees nothing open', ((await call('/v1/student/peer', { cookie: O.cookie })).body as PeerCandidate[]).length === 0);
check('reviewer can now view the open page image', (await call(`/v1/media/page/${a.pageId}`, { cookie: R.cookie })).status === 200);
check("reviewer still cannot hear the author's voice note", (await call(`/v1/media/voice/${a.sub.id}`, { cookie: R.cookie })).status === 404);
check('outsider still cannot view the open page', (await call(`/v1/media/page/${a.pageId}`, { cookie: O.cookie })).status === 404);
check('author cannot peer-review their own piece', (await call('/v1/student/reviews', { cookie: A.cookie, json: peerBody() })).status === 404);
check('outsider cannot peer-review', (await call('/v1/student/reviews', { cookie: O.cookie, json: peerBody() })).status === 404);
check('peer review needs written answers', (await call('/v1/student/reviews', { cookie: R.cookie, json: { ...peerBody(), answers: [{ promptKey: 'works', text: 'ok' }] } })).status === 400);
const pr = await call('/v1/student/reviews', { cookie: R.cookie, json: peerBody() });
check('peer review accepted, pending approval', pr.status === 201 && (pr.body as { pendingApproval: boolean }).pendingApproval === true);
check('peer review: second attempt refused', (await call('/v1/student/reviews', { cookie: R.cookie, json: peerBody() })).status === 409);
check('reviewed piece leaves the reviewer list', ((await call('/v1/student/peer', { cookie: R.cookie })).body as PeerCandidate[]).length === 0);
const third1 = (await call('/v1/student/peer', { cookie: Th.cookie })).body as PeerCandidate[];
check('a different classmate can still review it', third1.length === 1);

const authorBefore = (await call('/v1/student/portal', { cookie: A.cookie })).body as StudentPortal;
check('author cannot see the pending peer review', authorBefore.pieces.find((p) => p.id === a.sub.id)!.peers.length === 0);
const d1 = (await call(`/v1/submissions/${a.sub.id}`, { cookie: teacherCookie })).body as SubmissionDetail;
const pending = d1.reviews.peers[0]!;
check('teacher sees it pending, with the reviewer name', d1.peerOpen && pending.approved === false && pending.byName === reviewer!.name);
check('overview counts it as pending', ((await call('/v1/overview', { cookie: teacherCookie })).body as Overview).counts.pendingReviews >= 1);
check('student cannot approve reviews', (await call(`/v1/reviews/${pending.id}/approve`, { cookie: A.cookie, json: { approved: true } })).status === 401);
check('teacher approves', (await call(`/v1/reviews/${pending.id}/approve`, { cookie: teacherCookie, json: { approved: true } })).status === 200);
const authorAfter = (await call('/v1/student/portal', { cookie: A.cookie })).body as StudentPortal;
const shown = authorAfter.pieces.find((p) => p.id === a.sub.id)!.peers;
check('author now sees the approved review', shown.length === 1 && shown[0]!.answers.some((x) => x.text === 'nice shading'));
check('approved review is anonymous', !/byName|assessorId|Student|reviewer/i.test(JSON.stringify(shown)) && !JSON.stringify(authorAfter).includes(reviewer!.id));
await call(`/v1/reviews/${pending.id}/approve`, { cookie: teacherCookie, json: { approved: false } });
check('hiding it again removes it from the author', ((await call('/v1/student/portal', { cookie: A.cookie })).body as StudentPortal).pieces.find((p) => p.id === a.sub.id)!.peers.length === 0);

// ---- another teacher cannot touch any of this
const B = (await (await call('/v1/auth/register', { json: { name: 'Teacher B', school: 'Other School', phone: `+9193${suffix}`.slice(0, 13), password: 'correct horse 9', language: 'en' } })).body) as AuthResponse;
check("teacher B cannot open teacher A's piece", (await call(`/v1/submissions/${a.sub.id}/peer-open`, { token: B.token, json: { open: false } })).status === 404);
check("teacher B cannot approve teacher A's review", (await call(`/v1/reviews/${pending.id}/approve`, { token: B.token, json: { approved: true } })).status === 404);
check("teacher B cannot reset teacher A's student code", (await call(`/v1/students/${author!.id}/join-code`, { token: B.token, json: {} })).status === 404);

// ---- join code reset
const oldCode = codeOf(author!.id);
const reset = (await call(`/v1/students/${author!.id}/join-code`, { cookie: teacherCookie, json: {} })).body as { joinCode: string };
check('new code is different and well-formed', reset.joinCode !== oldCode && /^[A-Z0-9]{6}$/.test(reset.joinCode));
check('old code stops working', (await login(oldCode)).status === 401);
check('new code works', (await login(reset.joinCode)).status === 200);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
