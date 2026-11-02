import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StudentDetail } from '@progressflow/shared';
import { KIND_LABEL, fmt, useApi } from '../data';
import { Loading, Stat, SubmissionCard } from '../components/bits';
import { GrowthChart } from '../components/GrowthChart';

export function StudentPage() {
  const { id } = useParams();
  const { data, error, loading } = useApi<StudentDetail>(`/v1/students/${id}`);
  const [kind, setKind] = useState<string>('all');
  if (!data) return <Loading error={error} loading={loading} />;

  const subs = data.submissions.filter((s) => kind === 'all' || s.kind === kind);
  const points = data.history.filter(
    (_, i) =>
      kind === 'all' ||
      data.submissions.filter((s) => s.average !== null).reverse()[i]?.kind === kind,
  );
  const first = points[0]?.average ?? null;
  const last = points[points.length - 1]?.average ?? null;

  return (
    <>
      <p className="crumbs">
        <Link to="/">Overview</Link> /{' '}
        <Link to={`/classes/${data.student.classId}`}>Class {data.student.classLabel}</Link> /{' '}
        {data.student.name}
      </p>
      <h1>{data.student.name}</h1>
      <p className="muted">
        Roll {data.student.rollNo} · Class {data.student.classLabel}
      </p>

      <section className="stats">
        <Stat label="Submissions" value={data.submissions.length} />
        <Stat label="First average" value={fmt(first)} />
        <Stat label="Latest average" value={fmt(last)} />
        <Stat
          label="Change"
          value={
            first !== null && last !== null && points.length > 1
              ? `${last - first >= 0 ? '+' : ''}${(last - first).toFixed(1)}`
              : '—'
          }
        />
      </section>

      <div className="chips" role="group" aria-label="Filter by type">
        {['all', 'sketch', 'regular', 'progress', 'portfolio'].map((k) => (
          <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
            {k === 'all' ? 'All' : KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <section className="card">
        <h2>Progress over time</h2>
        <GrowthChart points={points} label={`${data.student.name} progress over time`} />
      </section>

      <h2>Portfolio</h2>
      {subs.length === 0 ? (
        <p className="muted">Nothing for this filter.</p>
      ) : (
        <section className="grid">
          {subs.map((s) => (
            <SubmissionCard key={s.id} s={s} showStudent={false} />
          ))}
        </section>
      )}
    </>
  );
}
