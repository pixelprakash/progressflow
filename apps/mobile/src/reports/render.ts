import JSZip from 'jszip';
import type { BarChart, Cell, Chart, LineChart, ReportDoc, Table } from './model';

/** Turns a `ReportDoc` into a file's contents. No React Native imports: testable in Node. */

export type ReportFormat = 'pdf' | 'docx' | 'xlsx' | 'csv';

export const FORMAT_INFO: Record<ReportFormat, { ext: string; mime: string; uti: string }> = {
  pdf: { ext: 'pdf', mime: 'application/pdf', uti: 'com.adobe.pdf' },
  docx: {
    ext: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    uti: 'org.openxmlformats.wordprocessingml.document',
  },
  xlsx: {
    ext: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uti: 'org.openxmlformats.spreadsheetml.sheet',
  },
  csv: { ext: 'csv', mime: 'text/csv', uti: 'public.comma-separated-values-text' },
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** XML 1.0 forbids most control characters; names pasted from other apps sometimes carry them. */
const xmlSafe = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const isMark = (t: Table, col: number) => t.marks?.includes(col) ?? false;

function show(c: Cell, mark: boolean): string {
  if (c === null) return '–';
  if (typeof c === 'number') return mark ? c.toFixed(1) : String(c);
  return c;
}

// ---- CSV --------------------------------------------------------------------

const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** UTF-8 with a byte-order mark so Excel opens Hindi and Telugu correctly. */
export function renderCsv(doc: ReportDoc): string {
  const lines: string[] = [csvCell(doc.title), csvCell(doc.subtitle)];
  for (const [k, v] of doc.meta) lines.push([k, v].map(csvCell).join(','));
  for (const sec of doc.sections) {
    lines.push('', csvCell(sec.heading));
    for (const p of sec.paragraphs ?? []) lines.push(csvCell(p));
    if (sec.table) {
      const t = sec.table;
      lines.push(t.head.map(csvCell).join(','));
      for (const r of [...t.rows, ...(t.foot ?? [])])
        lines.push(r.map((c, i) => csvCell(show(c, isMark(t, i)))).join(','));
    }
    if (sec.chart) {
      const c = sec.chart;
      lines.push(['', ...c.series.map((s) => s.name)].map(csvCell).join(','));
      c.labels.forEach((l, i) =>
        lines.push(
          [
            l,
            ...c.series.map((s) =>
              s.values[i] === null || s.values[i] === undefined ? '' : String(s.values[i]),
            ),
          ]
            .map(csvCell)
            .join(','),
        ),
      );
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ---- HTML (for PDF) ---------------------------------------------------------

function barsSvg(c: BarChart): string {
  const W = 640;
  const H = 240;
  const pl = 34;
  const pb = 56;
  const pt = 14;
  const n = c.labels.length;
  const group = (W - pl - 10) / Math.max(1, n);
  const bw = Math.min(34, (group - 12) / Math.max(1, c.series.length));
  const y = (v: number) => pt + (1 - v / 4) * (H - pt - pb);
  const grid = [0, 1, 2, 3, 4]
    .map(
      (v) =>
        `<line x1="${pl}" x2="${W - 6}" y1="${y(v)}" y2="${y(v)}" stroke="#DADCE0"/><text x="${pl - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#5B5B5B">${v}</text>`,
    )
    .join('');
  const bars = c.labels
    .map((label, i) => {
      const gx = pl + i * group + group / 2 - (bw * c.series.length) / 2;
      const rects = c.series
        .map((s, j) => {
          const v = s.values[i];
          if (v === null || v === undefined) return '';
          return `<rect x="${gx + j * bw}" y="${y(v)}" width="${bw - 2}" height="${y(0) - y(v)}" rx="2" fill="${s.color}"/><text x="${gx + j * bw + (bw - 2) / 2}" y="${y(v) - 3}" font-size="10" text-anchor="middle" fill="#1A1A1A">${v.toFixed(1)}</text>`;
        })
        .join('');
      return `${rects}<text x="${pl + i * group + group / 2}" y="${H - pb + 16}" font-size="11" text-anchor="middle" fill="#1A1A1A">${esc(label.length > 16 ? label.slice(0, 15) + '…' : label)}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(c.title)}">${grid}${bars}</svg>${legend(c)}`;
}

function lineSvg(c: LineChart): string {
  const W = 640;
  const H = 240;
  const pl = 34;
  const pb = 40;
  const pt = 14;
  const pr = 14;
  const n = c.labels.length;
  const x = (i: number) => (n <= 1 ? W / 2 : pl + (i / (n - 1)) * (W - pl - pr));
  const y = (v: number) => pt + (1 - (v - 1) / 3) * (H - pt - pb);
  const grid = [1, 2, 3, 4]
    .map(
      (v) =>
        `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="#DADCE0"/><text x="${pl - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#5B5B5B">${v}</text>`,
    )
    .join('');
  const xs = c.labels
    .map(
      (l, i) =>
        `<text x="${x(i)}" y="${H - 14}" font-size="10" text-anchor="middle" fill="#5B5B5B">${esc(l)}</text>`,
    )
    .join('');
  const lines = c.series
    .map((s, si) => {
      const pts = s.values.flatMap((v, i) => (v === null ? [] : [[x(i), y(v)] as const]));
      const heavy = si === 0;
      return `<polyline fill="none" stroke="${s.color}" stroke-width="${heavy ? 3.5 : 2}" ${heavy ? '' : 'stroke-dasharray="5 3"'} points="${pts.map((p) => p.join(',')).join(' ')}"/>${pts
        .map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="${heavy ? 4 : 2.5}" fill="${s.color}"/>`)
        .join('')}`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(c.title)}">${grid}${xs}${lines}</svg>${legend(c)}`;
}

const legend = (c: Chart) =>
  `<p class="legend">${c.series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</p>`;

function htmlTable(t: Table): string {
  const row = (r: Cell[], tag: 'td' | 'th', cls = '') =>
    `<tr${cls ? ` class="${cls}"` : ''}>${r
      .map(
        (c, i) =>
          `<${tag}${typeof c === 'number' ? ' class="num"' : ''}>${esc(show(c, isMark(t, i)))}</${tag}>`,
      )
      .join('')}</tr>`;
  return `<table><thead>${row(t.head as Cell[], 'th')}</thead><tbody>${t.rows.map((r) => row(r, 'td')).join('')}${(t.foot ?? []).map((r) => row(r, 'td', 'foot')).join('')}</tbody></table>`;
}

export function renderHtml(doc: ReportDoc, lang: string): string {
  const sections = doc.sections
    .map(
      (s) =>
        `<section><h2>${esc(s.heading)}</h2>${(s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}${s.table ? htmlTable(s.table) : ''}${s.chart ? (s.chart.type === 'bars' ? barsSvg(s.chart) : lineSvg(s.chart)) : ''}</section>`,
    )
    .join('');
  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@page { size: A4 ${doc.landscape ? 'landscape' : 'portrait'}; margin: 14mm; }
body { font-family: -apple-system, Roboto, 'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Telugu', sans-serif; color: #1A1A1A; font-size: 12px; line-height: 1.45; }
h1 { font-size: 24px; margin: 0; }
.sub { color: #5B5B5B; margin: 2px 0 12px; font-size: 14px; }
h2 { font-size: 15px; margin: 18px 0 6px; border-bottom: 2px solid #2E5AAC; padding-bottom: 3px; color: #2E5AAC; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; margin: 0; }
dt { color: #5B5B5B; } dd { margin: 0; font-weight: 600; }
table { border-collapse: collapse; width: 100%; margin: 6px 0; }
th, td { border: 1px solid #DADCE0; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #E6EDF9; font-weight: 700; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
tr.foot td { background: #F4F5F7; font-weight: 700; }
section { break-inside: avoid-page; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; margin: 2px 0 0; font-size: 11px; color: #5B5B5B; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; }
</style></head><body>
<h1>${esc(doc.title)}</h1><p class="sub">${esc(doc.subtitle)}</p>
<dl>${doc.meta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
${sections}
</body></html>`;
}

// ---- DOCX -------------------------------------------------------------------

const W_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const run = (text: string, o: { bold?: boolean; size?: number; color?: string } = {}) =>
  `<w:r><w:rPr>${o.bold ? '<w:b/><w:bCs/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : ''}</w:rPr><w:t xml:space="preserve">${esc(xmlSafe(text))}</w:t></w:r>`;

const para = (inner: string, o: { after?: number; before?: number } = {}) =>
  `<w:p><w:pPr><w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 80}"/></w:pPr>${inner}</w:p>`;

function docxTable(t: Table, widthTwips: number): string {
  const cols = t.head.length;
  const w = Math.floor(widthTwips / cols);
  const border = (c: string) =>
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((e) => `<w:${e} w:val="single" w:sz="4" w:space="0" w:color="${c}"/>`)
      .join('');
  const cell = (c: Cell, i: number, o: { head?: boolean; foot?: boolean }) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.head ? '<w:shd w:val="clear" w:color="auto" w:fill="E6EDF9"/>' : o.foot ? '<w:shd w:val="clear" w:color="auto" w:fill="F4F5F7"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/>${typeof c === 'number' ? '<w:jc w:val="right"/>' : ''}</w:pPr>${run(show(c, isMark(t, i)), { bold: o.head || o.foot, size: 20 })}</w:p></w:tc>`;
  const row = (r: Cell[], o: { head?: boolean; foot?: boolean } = {}) =>
    `<w:tr>${o.head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${r.map((c, i) => cell(c, i, o)).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${w * cols}" w:type="dxa"/><w:tblBorders>${border('DADCE0')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${row(t.head, { head: true })}${t.rows.map((r) => row(r)).join('')}${(t.foot ?? []).map((r) => row(r, { foot: true })).join('')}</w:tbl>${para('', { after: 60 })}`;
}

/** A chart as a small table of numbers: Word has no drawing we can build without images. */
function chartTable(c: Chart): Table {
  return {
    head: ['', ...c.series.map((s) => s.name)],
    rows: c.labels.map((l, i) => [l, ...c.series.map((s) => s.values[i] ?? null)]),
    marks: c.series.map((_, i) => i + 1),
  };
}

export async function renderDocx(doc: ReportDoc): Promise<string> {
  const page = doc.landscape ? { w: 16838, h: 11906 } : { w: 11906, h: 16838 };
  const inner = page.w - 2 * 1000;
  const body = [
    para(run(doc.title, { bold: true, size: 40 }), { after: 40 }),
    para(run(doc.subtitle, { size: 26, color: '5B5B5B' }), { after: 160 }),
    ...doc.meta.map(([k, v]) =>
      para(run(`${k}: `, { color: '5B5B5B', size: 22 }) + run(v, { bold: true, size: 22 }), {
        after: 20,
      }),
    ),
    ...doc.sections.flatMap((s) => [
      para(run(s.heading, { bold: true, size: 28, color: '2E5AAC' }), { before: 280, after: 80 }),
      ...(s.paragraphs ?? []).map((p) => para(run(p, { size: 22 }))),
      ...(s.table ? [docxTable(s.table, inner)] : []),
      ...(s.chart ? [docxTable(chartTable(s.chart), inner)] : []),
    ]),
  ].join('');
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${body}<w:sectPr><w:pgSz w:w="${page.w}" w:h="${page.h}"${doc.landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
}

// ---- XLSX -------------------------------------------------------------------

const colName = (i: number) => {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Sheet names: 31 characters, none of []:*?/\ , unique. */
function sheetNames(titles: string[]): string[] {
  const used = new Set<string>();
  return titles.map((raw, i) => {
    const base =
      raw
        .replace(/[[\]:*?/\\]/g, ' ')
        .trim()
        .slice(0, 28) || `Sheet${i + 1}`;
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${base.slice(0, 26)} ${n++}`;
    used.add(name.toLowerCase());
    return name;
  });
}

// Style ids: 0 plain, 1 bold header on blue, 2 number 0.0, 3 bold, 4 title, 5 bold on grey (footer), 6 bold number on grey
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6EDF9"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F5F7"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function xlsxCell(c: Cell, ref: string, style: number, markStyle: number): string {
  if (c === null || c === '') return style ? `<c r="${ref}" s="${style}"/>` : '';
  if (typeof c === 'number') return `<c r="${ref}" s="${markStyle}"><v>${c}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(xmlSafe(c))}</t></is></c>`;
}

function sheetXml(
  rows: {
    cells: Cell[];
    kind: 'title' | 'plain' | 'bold' | 'head' | 'body' | 'foot';
    marks?: number[];
  }[],
): string {
  const widths: number[] = [];
  const data = rows
    .map((r, ri) => {
      const cells = r.cells
        .map((c, ci) => {
          widths[ci] = Math.max(widths[ci] ?? 8, Math.min(40, String(c ?? '').length + 2));
          const isMarkCol = r.marks?.includes(ci) ?? false;
          const style = { title: 4, plain: 0, bold: 3, head: 1, body: 0, foot: 5 }[r.kind];
          // Marks show as 0.0; whole-number counts and rolls keep the plain style.
          const markStyle = r.kind === 'foot' ? (isMarkCol ? 6 : 5) : isMarkCol ? 2 : 0;
          return xlsxCell(c, `${colName(ci)}${ri + 1}`, style, markStyle);
        })
        .join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join('');
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${data}</sheetData></worksheet>`;
}

export async function renderXlsx(doc: ReportDoc): Promise<string> {
  type R = Parameters<typeof sheetXml>[0][number];
  const first: R[] = [
    { cells: [doc.title], kind: 'title' },
    { cells: [doc.subtitle], kind: 'plain' },
    ...doc.meta.map<R>(([k, v]) => ({ cells: [k, v], kind: 'plain' })),
  ];
  const sheets: { name: string; rows: R[] }[] = [];
  const tableRows = (t: Table): R[] => [
    { cells: t.head, kind: 'head' },
    ...t.rows.map<R>((cells) => ({ cells, kind: 'body', marks: t.marks })),
    ...(t.foot ?? []).map<R>((cells) => ({ cells, kind: 'foot', marks: t.marks })),
  ];
  for (const sec of doc.sections) {
    const rows: R[] = [{ cells: [sec.heading], kind: 'bold' }];
    for (const p of sec.paragraphs ?? []) rows.push({ cells: [p], kind: 'plain' });
    if (sec.table) rows.push(...tableRows(sec.table));
    if (sec.chart) rows.push(...tableRows(chartTable(sec.chart)));
    // Paragraph-only sections ride along on the first sheet.
    if (!sec.table && !sec.chart) first.push({ cells: [], kind: 'plain' }, ...rows);
    else sheets.push({ name: sec.heading, rows });
  }
  const all = [{ name: doc.title, rows: first }, ...sheets];
  const names = sheetNames(all.map((s) => s.name));

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${all.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(xmlSafe(n))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${all.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${all.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file('xl/styles.xml', STYLES);
  all.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)));
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
}
