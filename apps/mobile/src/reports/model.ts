import type { CriterionGuide, TKey, Vars } from '@progressflow/shared';
import { levelLabel } from '@progressflow/shared';
import type { Language } from '@progressflow/shared';
import { analyse, classStats, compare, levelOf, studentStats } from '../analytics';
import { classLabel, compositeScore, isSaved } from '../domain';
import type { AppData, ClassRoom, RosterStudent } from '../domain';

/**
 * A report as plain data: headings, tables, a few charts. The renderers turn it
 * into PDF (HTML), Word, Excel or CSV, so all four always say the same thing.
 * Text arrives already translated.
 */

export type Cell = string | number | null;

export interface Table {
  head: string[];
  rows: Cell[][];
  /** Summary rows shown under the body, e.g. the class average. */
  foot?: Cell[][];
  /** Column indexes that hold 1–4 marks (shown to one decimal). */
  marks?: number[];
}

export interface BarChart {
  type: 'bars';
  title: string;
  labels: string[];
  series: { name: string; color: string; values: (number | null)[] }[];
}

export interface LineChart {
  type: 'line';
  title: string;
  /** One label per point on the x axis. */
  labels: string[];
  series: { name: string; color: string; values: (number | null)[] }[];
}

export type Chart = BarChart | LineChart;

export interface Section {
  heading: string;
  paragraphs?: string[];
  table?: Table;
  chart?: Chart;
}

export interface ReportDoc {
  title: string;
  subtitle: string;
  meta: [string, string][];
  sections: Section[];
  /** Wide tables read better on a landscape page. */
  landscape: boolean;
  /** Used for the file name. */
  slug: string;
}

export interface ReportEnv {
  t: (key: TKey, vars?: Vars) => string;
  lang: Language;
  criteria: CriterionGuide[];
  kindLabel: (id: string) => string;
  /** "12 Nov 2026" in the app language. */
  fmtDate: (iso: string) => string;
  teacher: { name: string; school: string } | null;
  now: Date;
}

const round1 = (v: number | null): number | null => (v === null ? null : Math.round(v * 10) / 10);
const signed = (v: number | null): string =>
  v === null ? '–' : `${v > 0 ? '+' : ''}${(Math.round(v * 10) / 10).toFixed(1)}`;

export const fileSlug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'report';

function metaBase(env: ReportEnv): [string, string][] {
  const m: [string, string][] = [];
  if (env.teacher) {
    m.push([env.t('rep.teacher'), env.teacher.name]);
    if (env.teacher.school) m.push([env.t('rep.school'), env.teacher.school]);
  }
  m.push([env.t('rep.date'), env.fmtDate(env.now.toISOString())]);
  return m;
}

const critHead = (env: ReportEnv) => env.criteria.map((c) => c.name);

export function classReport(data: AppData, klass: ClassRoom, env: ReportEnv): ReportDoc {
  const { t, criteria } = env;
  const keys = criteria.map((c) => c.key);
  const roster = data.students
    .filter((s) => s.classId === klass.id)
    .sort((a, b) => (parseInt(a.rollNo, 10) || 0) - (parseInt(b.rollNo, 10) || 0));
  const ids = new Set(roster.map((s) => s.id));
  const subs = data.submissions.filter((s) => ids.has(s.studentId));
  const cls = classStats(
    roster.map((s) => s.id),
    subs,
    keys,
  );

  const body = roster.map((st) => {
    const stats = studentStats(
      subs.filter((x) => x.studentId === st.id),
      keys,
    );
    return [
      st.rollNo,
      st.name,
      stats.scored.length,
      ...stats.criteria.map((c) => round1(c.mean)),
      round1(stats.mean),
      stats.mean === null ? '–' : levelLabel(env.lang, levelOf(stats.mean)),
      stats.change === null ? '–' : signed(stats.change),
    ] as Cell[];
  });
  // Columns: 0 roll, 1 name, 2 count, 3.. criteria, then overall
  const critCols = criteria.map((_, i) => 3 + i);
  const overallCol = 3 + criteria.length;

  const summary: Section = {
    heading: t('rep.classSummary'),
    table: {
      head: [
        t('rep.roll'),
        t('rep.student'),
        t('rep.assessments'),
        ...critHead(env),
        t('rep.overall'),
        t('rep.level'),
        t('rep.change'),
      ],
      rows: body,
      foot: [
        [
          '',
          t('rep.classAverage'),
          '',
          ...keys.map((k) => round1(cls.criterionMean[k] ?? null)),
          round1(cls.overallMean),
          cls.overallMean === null ? '–' : levelLabel(env.lang, levelOf(cls.overallMean)),
          '',
        ],
      ],
      marks: [...critCols, overallCol],
    },
  };

  const kinds = [
    ...new Set(subs.filter((s) => keys.some((k) => s.scores[k] !== undefined)).map((s) => s.kind)),
  ];
  const byKind: Section | null = kinds.length
    ? {
        heading: t('rep.byType'),
        table: {
          head: [t('rep.type'), t('rep.assessments'), ...critHead(env), t('rep.overall')],
          rows: kinds.map((kind) => {
            const ofKind = subs.filter(
              (s) => s.kind === kind && compositeScore(s.scores, keys) !== null,
            );
            const avg = (k: string) => {
              const vs = ofKind.flatMap((s) => (s.scores[k] === undefined ? [] : [s.scores[k]!]));
              return vs.length ? round1(vs.reduce((a, b) => a + b, 0) / vs.length) : null;
            };
            const all = ofKind.map((s) => compositeScore(s.scores, keys)!);
            return [
              env.kindLabel(kind),
              ofKind.length,
              ...keys.map(avg),
              round1(all.reduce((a, b) => a + b, 0) / all.length),
            ] as Cell[];
          }),
          marks: [...keys.map((_, i) => 2 + i), 2 + keys.length],
        },
      }
    : null;

  const pending = subs.filter((s) => s.pages.length > 0 && !isSaved(s)).length;

  const chart: Section = {
    heading: t('rep.classAverageByCriterion'),
    chart: {
      type: 'bars',
      title: t('rep.classAverageByCriterion'),
      labels: criteria.map((c) => c.name),
      series: [
        {
          name: t('rep.classAverage'),
          color: '#2E5AAC',
          values: keys.map((k) => round1(cls.criterionMean[k] ?? null)),
        },
      ],
    },
  };

  const label = classLabel(klass);
  return {
    title: t('rep.classTitle', { label }),
    subtitle: klass.assignment,
    meta: [
      [t('rep.class'), label],
      ...metaBase(env),
      [t('rep.students'), String(roster.length)],
      [t('rep.assessed'), String(cls.assessed)],
      [t('rep.classAverage'), cls.overallMean === null ? '–' : cls.overallMean.toFixed(1)],
      [t('rep.waiting'), String(pending)],
    ],
    sections: [summary, ...(byKind ? [byKind] : []), ...(cls.assessed ? [chart] : [])],
    landscape: true,
    slug: fileSlug(`class-${label}`),
  };
}

export function studentReport(
  data: AppData,
  student: RosterStudent,
  klass: ClassRoom | undefined,
  env: ReportEnv,
): ReportDoc {
  const { t, criteria } = env;
  const keys = criteria.map((c) => c.key);
  const mine = data.submissions.filter((s) => s.studentId === student.id);
  const stats = studentStats(mine, keys);
  const roster = klass ? data.students.filter((s) => s.classId === klass.id) : [student];
  const ids = new Set(roster.map((s) => s.id));
  const cls = classStats(
    roster.map((s) => s.id),
    data.submissions.filter((s) => ids.has(s.studentId)),
    keys,
  );
  const cmp = compare(stats, student.id, cls);
  const an = analyse(mine, keys);
  const nameOf = (k: string) => criteria.find((c) => c.key === k)?.name ?? k;

  const paragraphs: string[] = [];
  if (stats.mean === null) paragraphs.push(t('rep.noScores'));
  else {
    paragraphs.push(
      t('rep.summaryOverall', {
        avg: stats.mean.toFixed(1),
        level: levelLabel(env.lang, levelOf(stats.mean)),
        n: stats.scored.length,
      }),
    );
    if (stats.change !== null)
      paragraphs.push(
        t(
          stats.change > 0
            ? 'rep.summaryUp'
            : stats.change < 0
              ? 'rep.summaryDown'
              : 'rep.summaryFlat',
          {
            from: (stats.first ?? 0).toFixed(1),
            to: (stats.latest ?? 0).toFixed(1),
          },
        ),
      );
    if (an.strongest) paragraphs.push(t('rep.strongest', { name: nameOf(an.strongest) }));
    if (an.weakest) paragraphs.push(t('rep.focus', { name: nameOf(an.weakest) }));
    if (cmp.rank !== null && cmp.of > 1)
      paragraphs.push(t('rep.rankLine', { rank: cmp.rank, of: cmp.of }));
  }

  const critTable: Section = {
    heading: t('rep.byCriterion'),
    table: {
      head: [
        t('rep.criterion'),
        t('rep.average'),
        t('rep.latest'),
        t('rep.change'),
        t('rep.classAverage'),
      ],
      rows: stats.criteria.map((c) => [
        nameOf(c.key),
        round1(c.mean),
        c.last,
        c.change === null ? '–' : signed(c.change),
        round1(cls.criterionMean[c.key] ?? null),
      ]),
      marks: [1, 2, 4],
    },
  };

  const compareChart: Section | null =
    stats.mean === null
      ? null
      : {
          heading: t('rep.vsClass'),
          chart: {
            type: 'bars',
            title: t('rep.vsClass'),
            labels: criteria.map((c) => c.name),
            series: [
              {
                name: student.name,
                color: '#2E5AAC',
                values: stats.criteria.map((c) => round1(c.mean)),
              },
              {
                name: t('rep.classAverage'),
                color: '#9AA0A6',
                values: keys.map((k) => round1(cls.criterionMean[k] ?? null)),
              },
            ],
          },
        };

  const progressChart: Section | null =
    stats.overall.length < 2
      ? null
      : {
          heading: t('rep.progress'),
          chart: {
            type: 'line',
            title: t('rep.progress'),
            labels: stats.overall.map((p) => env.fmtDate(new Date(p.t).toISOString())),
            series: [
              {
                name: t('rep.overall'),
                color: '#1A1A1A',
                values: stats.overall.map((p) => round1(p.v)),
              },
              ...stats.criteria.map((c, i) => ({
                name: nameOf(c.key),
                color: criteria[i]!.color,
                values: stats.scored.map((s) => s.scores[c.key] ?? null),
              })),
            ],
          },
        };

  const history: Section = {
    heading: t('rep.history'),
    table: {
      head: [t('rep.date'), t('rep.type'), ...critHead(env), t('rep.overall'), t('rep.status')],
      rows: [...mine]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((s) => [
          env.fmtDate(s.createdAt),
          env.kindLabel(s.kind),
          ...keys.map((k) => s.scores[k] ?? null),
          round1(compositeScore(s.scores, keys)),
          isSaved(s) ? t('rep.saved') : t('rep.notSaved'),
        ]),
      marks: [...keys.map((_, i) => 2 + i), 2 + keys.length],
    },
  };

  const notes = mine
    .flatMap((s) => {
      const lines = [
        ...(s.note.trim() ? [s.note.trim()] : []),
        ...s.attachments.filter((a) => a.kind === 'note' && a.text).map((a) => a.text!.trim()),
      ];
      return lines.map((l) => `${env.fmtDate(s.createdAt)} · ${env.kindLabel(s.kind)}: ${l}`);
    })
    .slice(0, 40);
  const notesSection: Section | null = notes.length
    ? { heading: t('rep.notes'), paragraphs: notes }
    : null;

  const label = klass ? classLabel(klass) : '';
  return {
    title: student.name,
    subtitle: t('rep.studentSubtitle'),
    meta: [
      [t('rep.roll'), student.rollNo],
      ...(klass ? ([[t('rep.class'), label]] as [string, string][]) : []),
      ...metaBase(env),
      [t('rep.assessments'), String(stats.scored.length)],
      [t('rep.overall'), stats.mean === null ? '–' : stats.mean.toFixed(1)],
    ],
    sections: [
      { heading: t('rep.summary'), paragraphs },
      critTable,
      ...(progressChart ? [progressChart] : []),
      ...(compareChart ? [compareChart] : []),
      history,
      ...(notesSection ? [notesSection] : []),
    ],
    landscape: false,
    slug: fileSlug(`${student.name}-${label}`),
  };
}
