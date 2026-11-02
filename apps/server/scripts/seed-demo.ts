/**
 * Dev only: creates a demo teacher on a LOCAL server and pushes the sample
 * classes through the real sync API, so the web dashboard has data to show.
 *   npx tsx scripts/seed-demo.ts [folder-with-jpegs]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { demoData } from '../../mobile/src/demo';
import { toPush } from '../../mobile/src/syncMap';
import type { AuthResponse, SyncPushResponse } from '@progressflow/shared';

const BASE = process.env.API ?? 'http://localhost:4000';
if (!/localhost|127\.0\.0\.1/.test(BASE))
  throw new Error('seed-demo only runs against a local server');

const PHONE = '+919999900001';
const PASSWORD = 'demo-password-1';
const post = async (path: string, json: unknown, token?: string) =>
  fetch(BASE + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(json),
  });

let res = await post('/v1/auth/login', { phone: PHONE, password: PASSWORD });
if (res.status === 401) {
  await post('/v1/auth/register', {
    name: 'Demo Teacher',
    school: 'Demo Government High School',
    phone: PHONE,
    password: PASSWORD,
    language: 'te',
  });
  res = await post('/v1/auth/login', { phone: PHONE, password: PASSWORD });
}
const auth = (await res.json()) as AuthResponse;

const data = demoData();
const dir = process.argv[2];
const images = dir
  ? readdirSync(dir)
      .filter((f) => /\.jpe?g$/i.test(f))
      .sort()
  : [];
const files = new Map<string, Buffer>();

// Give the first scored submissions of class 7-B a photo, markup and a note.
data.submissions.slice(0, images.length).forEach((s, i) => {
  const pageId = `f0000000-0000-4000-8000-0000000000${String(i + 1).padStart(2, '0')}`;
  s.pages = [
    {
      id: pageId,
      uri: 'x.jpg',
      width: 2000,
      height: 2800,
      quality: { score: 1, issues: [], sharpness: 2.5, brightness: 190 },
    },
  ];
  s.strokes = {
    [pageId]: [
      {
        tool: 'circle',
        color: '#E53935',
        width: 4,
        points: [
          [0.15, 0.4],
          [0.55, 0.75],
        ],
      },
      {
        tool: 'arrow',
        color: '#1E88E5',
        width: 4,
        points: [
          [0.8, 0.3],
          [0.62, 0.5],
        ],
      },
      {
        tool: 'highlight',
        color: '#FBC02D',
        width: 18,
        points: [
          [0.1, 0.07],
          [0.5, 0.07],
        ],
      },
    ],
  };
  s.note = 'Shading on the left is stronger — carry it across the whole piece.';
  files.set(pageId, readFileSync(join(dir!, images[i]!)));
});

const pushRes = await post('/v1/sync/push', toPush(data, null), auth.token);
if (!pushRes.ok) throw new Error(`push failed: ${pushRes.status} ${await pushRes.text()}`);
const push = (await pushRes.json()) as SyncPushResponse;
for (const id of push.mediaWanted.pages) {
  const r = await fetch(`${BASE}/v1/media/page/${id}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${auth.token}` },
    body: files.get(id),
  });
  if (!r.ok) throw new Error(`upload ${id}: ${r.status}`);
}
console.log(
  `seeded: ${push.accepted.length} submissions, ${files.size} photos\nsign in with  mobile 9999900001  password ${PASSWORD}`,
);
