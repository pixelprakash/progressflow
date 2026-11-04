import { compositeScore } from './domain';
import type { Submission } from './domain';

/**
 * The numbers behind the student charts and the reports. Pure functions over
 * the phone's own data, so they can be tested in Node.
 *
 * Marks are 1–4. A "scored" submission has at least one mark on a criterion in
 * the current rubric.
 */

export interface SeriesPoint {
  id: string;
  t: number;
  v: number;
  kind: string;
}

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

const sd = (xs: number[]): number | null => {
  const m = mean(xs);
  return m === null || xs.length < 2
    ? null
    : Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

export const byDate = (subs: Submission[]) =>
  [...subs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const isScored = (s: Submission, keys: readonly string[]) =>
  compositeScore(s.scores, keys) !== null;

export interface CriterionStats {
  key: string;
  series: SeriesPoint[];
  mean: number | null;
  first: number | null;
  last: number | null;
  /** last − first; null with fewer than two marks. */
  change: number | null;
}

export interface StudentStats {
  scored: Submission[];
  overall: SeriesPoint[];
  mean: number | null;
  first: number | null;
  latest: number | null;
  change: number | null;
  criteria: CriterionStats[];
}

export function studentStats(subs: Submission[], keys: readonly string[]): StudentStats {
  const scored = byDate(subs).filter((s) => isScored(s, keys));
  const overall: SeriesPoint[] = scored.map((s) => ({
    id: s.id,
    t: new Date(s.createdAt).getTime(),
    v: compositeScore(s.scores, keys) ?? 0,
    kind: s.kind,
  }));
  const criteria = keys.map<CriterionStats>((key) => {
    const series = scored.flatMap((s) => {
      const v = s.scores[key];
      return v === undefined
        ? []
        : [{ id: s.id, t: new Date(s.createdAt).getTime(), v, kind: s.kind }];
    });
    const first = series[0]?.v ?? null;
    const last = series[series.length - 1]?.v ?? null;
    return {
      key,
      series,
      mean: mean(series.map((p) => p.v)),
      first,
      last,
      change: series.length > 1 && first !== null && last !== null ? last - first : null,
    };
  });
  const vs = overall.map((p) => p.v);
  return {
    scored,
    overall,
    mean: mean(vs),
    first: vs[0] ?? null,
    latest: vs[vs.length - 1] ?? null,
    change: vs.length > 1 ? vs[vs.length - 1]! - vs[0]! : null,
    criteria,
  };
}

export interface ClassStats {
  /** Every student's overall mean (null if they have no scored work). */
  perStudent: Map<string, number | null>;
  criterionMean: Record<string, number | null>;
  overallMean: number | null;
  assessed: number;
}

export function classStats(
  studentIds: string[],
  submissions: Submission[],
  keys: readonly string[],
): ClassStats {
  const perStudent = new Map<string, number | null>();
  const perCrit: Record<string, number[]> = Object.fromEntries(
    keys.map((k) => [k, [] as number[]]),
  );
  for (const id of studentIds) {
    const st = studentStats(
      submissions.filter((s) => s.studentId === id),
      keys,
    );
    perStudent.set(id, st.mean);
    for (const c of st.criteria) if (c.mean !== null) perCrit[c.key]!.push(c.mean);
  }
  const means = [...perStudent.values()].filter((v): v is number => v !== null);
  return {
    perStudent,
    criterionMean: Object.fromEntries(keys.map((k) => [k, mean(perCrit[k]!)])),
    overallMean: mean(means),
    assessed: means.length,
  };
}

export interface Comparison {
  rows: { key: string; student: number | null; klass: number | null; diff: number | null }[];
  /** 1 = highest in the class; null if the student has no scored work. */
  rank: number | null;
  of: number;
  /** Share of the class the student is at or above, 0–100. */
  percentile: number | null;
  overallDiff: number | null;
}

export function compare(stats: StudentStats, studentId: string, cls: ClassStats): Comparison {
  const rows = stats.criteria.map((c) => {
    const klass = cls.criterionMean[c.key] ?? null;
    return {
      key: c.key,
      student: c.mean,
      klass,
      diff: c.mean !== null && klass !== null ? c.mean - klass : null,
    };
  });
  const mine = cls.perStudent.get(studentId) ?? null;
  const all = [...cls.perStudent.values()].filter((v): v is number => v !== null);
  return {
    rows,
    rank: mine === null ? null : 1 + all.filter((v) => v > mine).length,
    of: all.length,
    percentile:
      mine === null || !all.length
        ? null
        : Math.round((all.filter((v) => v <= mine).length / all.length) * 100),
    overallDiff: mine !== null && cls.overallMean !== null ? mine - cls.overallMean : null,
  };
}

/** Round a mean to the nearest performance level, 1–4. */
export const levelOf = (v: number): 1 | 2 | 3 | 4 =>
  Math.min(4, Math.max(1, Math.round(v))) as 1 | 2 | 3 | 4;

export interface Analysis {
  /** criterion key → assessment kind → mean mark. */
  matrix: Record<string, Record<string, number | null>>;
  kinds: string[];
  strongest: string | null;
  weakest: string | null;
  mostImproved: string | null;
  /** Standard deviation of the overall marks; low = steady. */
  spread: number | null;
}

export function analyse(subs: Submission[], keys: readonly string[]): Analysis {
  const scored = byDate(subs).filter((s) => isScored(s, keys));
  const kinds = [...new Set(scored.map((s) => s.kind))];
  const matrix = Object.fromEntries(
    keys.map((k) => [
      k,
      Object.fromEntries(
        kinds.map((kind) => [
          kind,
          mean(
            scored
              .filter((s) => s.kind === kind)
              .flatMap((s) => (s.scores[k] === undefined ? [] : [s.scores[k]!])),
          ),
        ]),
      ),
    ]),
  );
  const st = studentStats(subs, keys);
  const withMean = st.criteria.filter((c) => c.mean !== null);
  const best = [...withMean].sort((a, b) => b.mean! - a.mean!)[0];
  const worst = [...withMean].sort((a, b) => a.mean! - b.mean!)[0];
  // Only name a strongest / weakest when they actually differ.
  const distinct = best && worst && best.mean !== worst.mean;
  const improved = [...st.criteria]
    .filter((c) => c.change !== null && c.change > 0)
    .sort((a, b) => b.change! - a.change!)[0];
  return {
    matrix,
    kinds,
    strongest: distinct ? best.key : null,
    weakest: distinct ? worst.key : null,
    mostImproved: improved?.key ?? null,
    spread: sd(st.overall.map((p) => p.v)),
  };
}
