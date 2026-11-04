import { Link } from 'react-router-dom';
import type { Scores, SubmissionSummary } from '@progressflow/shared';
import { fmt } from '../data';
import { useTeacher } from '../teacher';
import { useLang } from '../i18n';

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
  const { guides } = useTeacher();
  return (
    <div className="bars">
      {guides.map((g) => {
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
  const { t, fmtDate } = useLang();
  const { kindLabel } = useTeacher();
  const waiting = s.pageCount > 0 && !s.saved;
  return (
    <Link to={`/submissions/${s.id}`} className="card sub-card">
      <div className="thumb">
        {s.coverPageId ? (
          <img src={`/v1/media/page/${s.coverPageId}`} alt="" loading="lazy" />
        ) : (
          <span className="muted small">{t('common.noPhoto')}</span>
        )}
      </div>
      <div className="sub-meta">
        <strong>{showStudent ? s.studentName : kindLabel(s.kind)}</strong>
        <span className="muted small">
          {showStudent ? `${kindLabel(s.kind)} · ` : ''}
          {s.classLabel} · {fmtDate(s.createdAt)}
        </span>
        <span className="row gap">
          {s.average !== null ? (
            <span className="pill">
              {fmt(s.average)} {t('common.avg')}
            </span>
          ) : (
            <span className="pill warn">{t('common.notScored')}</span>
          )}
          {waiting && <span className="pill warn">{t('sub.toEvaluate')}</span>}
          {s.pageCount > 1 && <span className="pill">{t('sub.images', { n: s.pageCount })}</span>}
        </span>
      </div>
    </Link>
  );
}

export function Loading({ error, loading }: { error: string; loading: boolean }) {
  const { t } = useLang();
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  return loading ? <p className="muted">{t('common.loading')}</p> : null;
}
