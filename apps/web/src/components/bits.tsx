import { Link } from 'react-router-dom';
import { RUBRIC_GUIDES } from '@progressflow/shared';
import type { Scores, SubmissionSummary } from '@progressflow/shared';
import { KIND_LABEL, fmt, fmtDate } from '../data';

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

/** Four horizontal bars on the 1–4 scale, one per rubric criterion. */
export function CriterionBars({ scores }: { scores: Scores }) {
  return (
    <div className="bars">
      {RUBRIC_GUIDES.map((g) => {
        const v = scores[g.key];
        return (
          <div key={g.key} className="bar-row">
            <span className="bar-name">{g.name}</span>
            <span className="bar-track" aria-hidden>
              <span
                className="bar-fill"
                style={{ width: v === undefined ? 0 : `${(v / 4) * 100}%`, background: g.color }}
              />
            </span>
            <span className="bar-val">{fmt(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SubmissionCard({
  s,
  showStudent = true,
}: {
  s: SubmissionSummary;
  showStudent?: boolean;
}) {
  const waiting = s.pageCount > 0 && Object.keys(s.scores).length < RUBRIC_GUIDES.length;
  return (
    <Link to={`/submissions/${s.id}`} className="card sub-card">
      <div className="thumb">
        {s.coverPageId ? (
          <img src={`/v1/media/page/${s.coverPageId}`} alt="" loading="lazy" />
        ) : (
          <span className="muted small">No photo</span>
        )}
      </div>
      <div className="sub-meta">
        <strong>{showStudent ? s.studentName : KIND_LABEL[s.kind]}</strong>
        <span className="muted small">
          {showStudent ? `${KIND_LABEL[s.kind]} · ` : ''}
          {s.classLabel} · {fmtDate(s.createdAt)}
        </span>
        <span className="row gap">
          {s.average !== null ? (
            <span className="pill">{fmt(s.average)} avg</span>
          ) : (
            <span className="pill warn">not scored</span>
          )}
          {waiting && <span className="pill warn">to evaluate</span>}
          {s.pageCount > 1 && <span className="pill">{s.pageCount} images</span>}
        </span>
      </div>
    </Link>
  );
}

export function Loading({ error, loading }: { error: string; loading: boolean }) {
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  return loading ? <p className="muted">Loading…</p> : null;
}
