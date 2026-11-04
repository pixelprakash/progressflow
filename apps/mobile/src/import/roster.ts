import JSZip from 'jszip';
import { Buffer } from 'buffer';

/**
 * Reads a class list from a spreadsheet (.xlsx), Word document (.docx), CSV or
 * plain text, and returns names with roll numbers. Pure TypeScript with no React
 * Native imports so it runs under Node for tests. Old binary .xls / .doc files
 * are not readable; the caller tells the teacher to "Save as" .xlsx or .csv.
 */

export interface ParsedStudent {
  name: string;
  /** null when the file has no roll column; the caller numbers them. */
  rollNo: string | null;
}

export interface ParsedRoster {
  students: ParsedStudent[];
  /** Rows that had no usable name. */
  skipped: number;
  format: 'csv' | 'xlsx' | 'docx' | 'text';
}

export class UnreadableFile extends Error {
  constructor(public reason: 'legacy' | 'empty' | 'unknown') {
    super(reason);
  }
}

const NAME_HEAD = /^(student'?s?\s*)?(full\s*)?name$|^name\b|^student$/i;
const FIRST_HEAD = /^first\s*name$|^given\s*name$/i;
const LAST_HEAD = /^(last|sur|family)\s*name$/i;
const ROLL_HEAD = /roll|reg(istration)?\b|admission|\badm\b|\bpin\b|student\s*id|^id$|enrol/i;
const SERIAL_HEAD = /^(s\.?\s?no\.?|sr\.?\s?no\.?|serial|#|no\.?)$/i;

const clean = (v: string) => v.replace(/\s+/g, ' ').trim();
const isNumberish = (v: string) => /^\d{1,6}$/.test(v);

export function normaliseRoll(v: string): string {
  const r = clean(v);
  return /^\d+$/.test(r) ? r.replace(/^0+(?=\d)/, '') : r;
}

/** Minimal CSV: quotes, commas / semicolons / tabs, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].reduce((best, d) =>
    first.split(d).length > first.split(best).length ? d : best,
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => clean(c) !== ''));
}

/** "12 Ananya M", "12. Ananya M", "Ananya M - 12", "Ananya M" */
export function parseLine(line: string): ParsedStudent | null {
  const l = clean(line);
  if (!l) return null;
  const lead = /^(\d{1,6})[\s.,:)\-–]+(.+)$/.exec(l);
  if (lead) return { rollNo: normaliseRoll(lead[1]!), name: lead[2]! };
  const trail = /^(.+?)[\s,:\-–]+(\d{1,6})$/.exec(l);
  if (trail) return { name: trail[1]!, rollNo: normaliseRoll(trail[2]!) };
  return { name: l, rollNo: null };
}

/** Works out which columns hold the name and the roll number. */
export function rowsToStudents(rows: string[][]): { students: ParsedStudent[]; skipped: number } {
  const grid = rows.map((r) => r.map(clean));
  if (!grid.length) return { students: [], skipped: 0 };

  let nameCol = -1;
  let rollCol = -1;
  let firstCol = -1;
  let lastCol = -1;
  let start = 0;

  const head = grid[0]!;
  head.forEach((h, i) => {
    if (FIRST_HEAD.test(h)) firstCol = i;
    else if (LAST_HEAD.test(h)) lastCol = i;
    else if (nameCol < 0 && NAME_HEAD.test(h)) nameCol = i;
    else if (ROLL_HEAD.test(h) && rollCol < 0) rollCol = i;
  });
  if (rollCol < 0) rollCol = head.findIndex((h) => SERIAL_HEAD.test(h));
  const hasHeader = nameCol >= 0 || firstCol >= 0;
  if (hasHeader) start = 1;

  if (!hasHeader) {
    // No header: the column that is mostly numbers is the roll, the one with the most letters is the name.
    const width = Math.max(...grid.map((r) => r.length));
    const stats = Array.from({ length: width }, (_, c) => {
      const cells = grid.map((r) => r[c] ?? '').filter(Boolean);
      return {
        nums: cells.filter(isNumberish).length,
        words: cells.filter((v) => /\p{L}{2,}/u.test(v)).length,
      };
    });
    nameCol = stats.reduce((b, st, i) => (st.words > (stats[b]?.words ?? -1) ? i : b), 0);
    if (!stats[nameCol] || stats[nameCol]!.words === 0)
      return { students: [], skipped: grid.length };
    const numCol = stats.reduce((b, st, i) => (st.nums > (stats[b]?.nums ?? -1) ? i : b), 0);
    if (numCol !== nameCol && (stats[numCol]?.nums ?? 0) >= grid.length / 2) rollCol = numCol;
    // A single column of "12 Ananya M" lines: parse each line.
    if (width === 1) {
      const students: ParsedStudent[] = [];
      let skipped = 0;
      for (const r of grid) {
        const p = parseLine(r[0] ?? '');
        if (p && /\p{L}/u.test(p.name)) students.push(p);
        else skipped++;
      }
      return { students, skipped };
    }
  }

  const students: ParsedStudent[] = [];
  let skipped = 0;
  for (const r of grid.slice(start)) {
    const name =
      firstCol >= 0
        ? clean(`${r[firstCol] ?? ''} ${lastCol >= 0 ? (r[lastCol] ?? '') : ''}`)
        : (r[nameCol] ?? '');
    if (!name || !/\p{L}/u.test(name)) {
      if (r.some(Boolean)) skipped++;
      continue;
    }
    const roll = rollCol >= 0 ? (r[rollCol] ?? '') : '';
    students.push({ name, rollNo: roll ? normaliseRoll(roll) : null });
  }
  return { students, skipped };
}

// ---- xlsx -------------------------------------------------------------------

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

const textOf = (xml: string) =>
  [...xml.matchAll(/<(?:w:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:w:)?t>/g)]
    .map((m) => decodeXml(m[1]!))
    .join('');

const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of /^[A-Z]+/.exec(ref)?.[0] ?? 'A') n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

async function readXlsx(zip: JSZip): Promise<string[][]> {
  const shared: string[] = [];
  const sst = await zip.file('xl/sharedStrings.xml')?.async('string');
  if (sst) for (const si of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(si[1]!));

  // First sheet in workbook order, via the relationships file.
  let path = 'xl/worksheets/sheet1.xml';
  const wb = await zip.file('xl/workbook.xml')?.async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  const rid = wb ? /<sheet\b[^>]*\br:id="([^"]+)"/.exec(wb)?.[1] : undefined;
  if (rid && rels) {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)]
      .map((m) => m[0])
      .find((r) => new RegExp(`\\bId="${rid}"`).test(r));
    const target = rel ? /\bTarget="([^"]+)"/.exec(rel)?.[1] : undefined;
    if (target) path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  }
  const sheet = await zip.file(path)?.async('string');
  if (!sheet) throw new UnreadableFile('unknown');

  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]!;
      const body = cm[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? '';
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let v = '';
      if (type === 's') v = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') v = textOf(body);
      else if (raw !== undefined) v = decodeXml(raw);
      // Whole numbers come back as "12" (not "12.0"), floats are left as written.
      row[ref ? colIndex(ref) : row.length] = v;
    }
    rows.push(Array.from(row, (c) => c ?? ''));
  }
  return rows.filter((r) => r.some((c) => clean(c) !== ''));
}

// ---- docx -------------------------------------------------------------------

async function readDocx(zip: JSZip): Promise<{ rows: string[][]; lines: string[] }> {
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new UnreadableFile('unknown');
  const paragraphText = (p: string) => clean(textOf(p.replace(/<w:tab\/>/g, '<w:t> </w:t>')));

  const rows: string[][] = [];
  for (const tr of xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)) {
    const cells = [...tr[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((tc) =>
      clean(
        [...tc[0].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((p) => paragraphText(p[0])).join(' '),
      ),
    );
    if (cells.some(Boolean)) rows.push(cells);
  }
  const outside = xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, '');
  const lines = [...outside.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map((p) => paragraphText(p[0]))
    .filter(Boolean);
  return { rows, lines };
}

// ---- entry points -----------------------------------------------------------

function fromLines(lines: string[]): { students: ParsedStudent[]; skipped: number } {
  const students: ParsedStudent[] = [];
  let skipped = 0;
  for (const line of lines) {
    const p = parseLine(line);
    if (p && /\p{L}/u.test(p.name)) students.push(p);
    else skipped++;
  }
  // A list where most lines carry a number: lines without one are headings ("Class 8-A list"), not students.
  const numbered = students.filter((x) => x.rollNo !== null).length;
  if (numbered >= 2 && numbered >= students.length / 2) {
    const kept = students.filter((x) => x.rollNo !== null);
    return { students: kept, skipped: skipped + students.length - kept.length };
  }
  return { students, skipped };
}

export function parseRosterText(text: string): ParsedRoster {
  const rows = parseCsv(text);
  const multiColumn = rows.some((r) => r.length > 1);
  const r = multiColumn ? rowsToStudents(rows) : fromLines(rows.map((x) => x[0] ?? ''));
  if (!r.students.length) throw new UnreadableFile('empty');
  return { ...r, format: multiColumn ? 'csv' : 'text' };
}

/** `fileName` only helps to give a better error for the old binary formats. */
export async function parseRosterBase64(base64: string, fileName: string): Promise<ParsedRoster> {
  const bytes = Buffer.from(base64, 'base64');
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) {
    // Old .xls / .doc files (OLE2) and PDFs are binary; say so instead of showing garbage.
    const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf;
    const pdf = bytes.subarray(0, 4).toString('latin1') === '%PDF';
    if (ole || pdf || /\.(xls|doc|pdf)$/i.test(fileName)) throw new UnreadableFile('legacy');
    return parseRosterText(bytes.toString('utf8'));
  }
  const zip = await JSZip.loadAsync(bytes);
  if (zip.file('xl/workbook.xml')) {
    const r = rowsToStudents(await readXlsx(zip));
    if (!r.students.length) throw new UnreadableFile('empty');
    return { ...r, format: 'xlsx' };
  }
  if (zip.file('word/document.xml')) {
    const { rows, lines } = await readDocx(zip);
    const fromTable = rows.length ? rowsToStudents(rows) : { students: [], skipped: 0 };
    const r = fromTable.students.length ? fromTable : fromLines(lines);
    if (!r.students.length) throw new UnreadableFile('empty');
    return { ...r, format: 'docx' };
  }
  throw new UnreadableFile('unknown');
}

/**
 * Gives every student a roll number: the file's own where present, otherwise the
 * next free number. Rolls already in the class, or repeated in the file, are
 * reported as duplicates and left out.
 */
export function planImport(
  parsed: ParsedStudent[],
  existingRolls: string[],
): { add: { name: string; rollNo: string }[]; duplicates: ParsedStudent[] } {
  const taken = new Set(existingRolls);
  let next = Math.max(0, ...existingRolls.map((r) => parseInt(r, 10) || 0)) + 1;
  const add: { name: string; rollNo: string }[] = [];
  const duplicates: ParsedStudent[] = [];
  for (const p of parsed) {
    let roll = p.rollNo;
    if (roll === null) {
      while (taken.has(String(next))) next++;
      roll = String(next++);
    }
    if (taken.has(roll)) {
      duplicates.push(p);
      continue;
    }
    taken.add(roll);
    add.push({ name: p.name, rollNo: roll });
  }
  return { add, duplicates };
}
