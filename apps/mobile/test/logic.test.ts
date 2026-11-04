import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { t as translate, localizedGuides } from '@progressflow/shared';
import type { TKey } from '@progressflow/shared';
import { analyse, classStats, compare, studentStats } from '../src/analytics';
import { demoData } from '../src/demo';
import type { AppData } from '../src/domain';
import { compositeScore, isSaved } from '../src/domain';
import {
  UnreadableFile,
  parseRosterBase64,
  parseRosterText,
  planImport,
} from '../src/import/roster';
import { classReport, studentReport } from '../src/reports/model';
import type { ReportEnv } from '../src/reports/model';
import { renderCsv, renderDocx, renderHtml, renderXlsx } from '../src/reports/render';
import { toServerKind } from '../src/syncMap';
import { matchRoster } from '../src/capture/match';

/** Logic that does not need a phone: roster import, analytics, report files. Run: npm run test:mobile */

const here = __dirname;
const fx = (f: string) => readFileSync(join(here, 'fixtures', f));
let checks = 0;
const ok = (cond: unknown, msg: string) => {
  assert.ok(cond, msg);
  checks++;
};
const eq = <T>(a: T, b: T, msg: string) => {
  assert.deepEqual(a, b, msg);
  checks++;
};

async function roster() {
  const x = await parseRosterBase64(fx('class.xlsx').toString('base64'), 'class.xlsx');
  eq(x.format, 'xlsx', 'xlsx detected');
  eq(
    x.students.map((s) => s.name),
    ['Aarav Kumar', 'Diya Sharma', 'అనన్య రెడ్డి', 'प्रिया सिंह', 'Rohan P'],
    'xlsx names incl. Telugu and Hindi, blank row dropped, first sheet only',
  );
  eq(
    x.students.map((s) => s.rollNo),
    ['12', '3', '7', '21', '3'],
    'xlsx rolls from the Roll column, not Sl No',
  );

  const nh = await parseRosterBase64(fx('noheader.xlsx').toString('base64'), 'noheader.xlsx');
  eq(
    nh.students,
    [
      { name: 'Kavya P', rollNo: '1' },
      { name: 'Rahul M', rollNo: '2' },
      { name: 'Sana Q', rollNo: '3' },
    ],
    'xlsx without header: numbers are rolls, text is names',
  );

  const tb = await parseRosterBase64(fx('table.docx').toString('base64'), 'table.docx');
  eq(tb.format, 'docx', 'docx detected');
  eq(
    tb.students.map((s) => `${s.rollNo}:${s.name}`),
    ['5:Isha K', '6:Aditya R', '7:Farah H'],
    'docx table: Name and Roll headers beat the No column',
  );

  const ln = await parseRosterBase64(fx('lines.docx').toString('base64'), 'lines.docx');
  eq(
    ln.students.map((s) => `${s.rollNo}:${s.name}`),
    ['1:Manoj Y', '2:Varun T', '3:Sana Q'],
    'docx lines "1. Name"; the "Students" heading is not a student',
  );

  const q = await parseRosterBase64(fx('quoted.csv').toString('base64'), 'quoted.csv');
  eq(
    q.students,
    [
      { name: 'Ananya, M.', rollNo: '1' },
      { name: 'Kabir J', rollNo: '2' },
      { name: 'Sneha "Sam" R', rollNo: '3' },
    ],
    'csv: quotes, embedded comma, leading zero stripped',
  );
  const sc = parseRosterText(fx('semi.csv').toString('utf8'));
  eq(sc.students.length, 2, 'semicolon delimiter');
  const nm = parseRosterText(fx('names.txt').toString('utf8'));
  eq(
    nm.students.map((s) => s.rollNo),
    [null, null, null],
    'plain names have no roll',
  );

  await assert.rejects(
    () =>
      parseRosterBase64(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2]).toString('base64'), 'old.xls'),
    (e) => e instanceof UnreadableFile && e.reason === 'legacy',
  );
  checks++;
  await assert.rejects(
    () => parseRosterBase64(Buffer.from('').toString('base64'), 'empty.csv'),
    (e) => e instanceof UnreadableFile,
  );
  checks++;

  const plan = planImport(
    [
      { name: 'A', rollNo: '1' },
      { name: 'B', rollNo: null },
      { name: 'C', rollNo: '1' },
      { name: 'D', rollNo: null },
    ],
    ['1', '2'],
  );
  eq(
    plan.add.map((s) => `${s.rollNo}:${s.name}`),
    ['3:B', '4:D'],
    'unnumbered students get the next free numbers',
  );
  eq(
    plan.duplicates.map((s) => s.name),
    ['A', 'C'],
    'rolls already in the class are reported, not overwritten',
  );
}

function sampleEnv(): ReportEnv {
  return {
    t: (k: TKey, v) => translate('en', k, v),
    lang: 'en',
    criteria: localizedGuides('en'),
    kindLabel: (id) => id,
    fmtDate: (iso) => iso.slice(0, 10),
    teacher: { name: 'Test Teacher', school: 'Test School' },
    now: new Date('2026-11-04T10:00:00Z'),
  };
}

function analytics(data: AppData) {
  const keys = localizedGuides('en').map((g) => g.key);
  const c7b = data.classes.find((c) => c.grade === 7 && c.section === 'B')!;
  const roster = data.students.filter((s) => s.classId === c7b.id);
  const aarav = roster[0]!;
  const st = studentStats(
    data.submissions.filter((s) => s.studentId === aarav.id),
    keys,
  );
  eq(st.scored.length, 4, 'four scored submissions for Aarav');
  eq([st.first, st.latest], [2, 3.5], 'first 2.0, latest 3.5');
  eq(st.change, 1.5, 'overall change');
  const cls = classStats(
    roster.map((s) => s.id),
    data.submissions,
    keys,
  );
  eq(cls.assessed, 2, 'only two of five students have work');
  const cmp = compare(st, aarav.id, cls);
  eq([cmp.rank, cmp.of], [2, 2], 'Aarav (mean 2.75) ranks below Diya (2.88)');
  eq(cmp.percentile, 50, 'percentile: at or above half the class');
  const an = analyse(
    data.submissions.filter((s) => s.studentId === aarav.id),
    keys,
  );
  eq(an.kinds.length, 4, 'four assessment kinds seen');
  ok(an.strongest !== null && an.weakest !== null, 'strongest and weakest named');
  eq(
    compositeScore({ composition: 4, colour_theory: 2, gone: 1 }, ['composition', 'colour_theory']),
    3,
    'removed criteria are ignored in the average',
  );
  ok(
    isSaved({ completedAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }),
    'saved when completedAt >= updatedAt',
  );
  ok(
    !isSaved({ completedAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-03T00:00:00Z' }),
    'edit after save = unsaved',
  );
  ok(!isSaved({ completedAt: null, updatedAt: '2026-01-03T00:00:00Z' }), 'never saved');
  eq(toServerKind('exam1'), 'regular', 'exam files as regular on the server');
  eq(toServerKind('portfolio'), 'portfolio', 'core kinds pass through');
}

function matching(data: AppData) {
  const c7b = data.classes.find((c) => c.grade === 7 && c.section === 'B')!;
  const r = data.students.filter((s) => s.classId === c7b.id); // Aarav 1, Diya 2, Ishaan 3, Meera 4, Rohan 5
  eq(matchRoster('Name: Diya S.\nRoll No: 2', r).studentId, r[1]!.id, 'roll + name agree');
  eq(matchRoster('Name: Diya S.\nRoll No: 2', r).via, 'both', 'both signals');
  eq(matchRoster('ROLL NO. 04', r).studentId, r[3]!.id, 'leading zero on the paper');
  eq(matchRoster('PIN: 5', r).studentId, r[4]!.id, 'PIN works as a roll number');
  eq(matchRoster('Reg No 3 Ishan', r).studentId, r[2]!.id, 'roll beats a near-miss name');
  eq(matchRoster('Meera', r).via, 'name', 'name alone');
  eq(matchRoster('a drawing of a tree 7 8 9', r).studentId, null, 'no match for artwork text');
  eq(matchRoster('Said 3 apples', r).studentId, null, '"Said 3" is not an ID number');
}

async function reports(data: AppData) {
  const env = sampleEnv();
  const c7b = data.classes.find((c) => c.grade === 7 && c.section === 'B')!;
  const aarav = data.students.find((s) => s.classId === c7b.id)!;
  const cdoc = classReport(data, c7b, env);
  const sdoc = studentReport(data, aarav, c7b, env);
  eq(cdoc.sections[0]!.table!.rows.length, 5, 'class report has a row per student');
  ok(cdoc.sections[0]!.table!.foot![0]![1] === 'Class average', 'class average footer');
  ok(
    sdoc.sections.some((s) => s.chart?.type === 'line'),
    'student report has a progress line',
  );
  ok(
    sdoc.sections.some((s) => s.chart?.type === 'bars'),
    'student report compares with the class',
  );

  const out = join(here, '..', '.test-out');
  mkdirSync(out, { recursive: true });
  for (const [name, doc] of [
    ['class', cdoc],
    ['student', sdoc],
  ] as const) {
    const csv = renderCsv(doc);
    ok(csv.startsWith('﻿') && csv.includes('\r\n'), `${name} csv has BOM and CRLF`);
    const html = renderHtml(doc, 'en');
    ok(html.includes('<table>') && html.includes('<svg'), `${name} html has tables and charts`);
    writeFileSync(join(out, `${name}.csv`), csv);
    writeFileSync(join(out, `${name}.html`), html);
    writeFileSync(join(out, `${name}.docx`), Buffer.from(await renderDocx(doc), 'base64'));
    writeFileSync(join(out, `${name}.xlsx`), Buffer.from(await renderXlsx(doc), 'base64'));
  }
  // A name that would break naive XML or CSV.
  const nasty = { ...sdoc, title: 'A & B <x> "q", \u0001z', slug: 'nasty' };
  writeFileSync(join(out, 'nasty.docx'), Buffer.from(await renderDocx(nasty), 'base64'));
  writeFileSync(join(out, 'nasty.xlsx'), Buffer.from(await renderXlsx(nasty), 'base64'));
  checks += 2;
}

async function main() {
  const data = demoData();
  await roster();
  analytics(data);
  matching(data);
  await reports(data);
  console.log(`mobile logic: ${checks} checks passed`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
