import { Link, useParams } from 'react-router-dom';
import type { ClassDetail } from '@progressflow/shared';
import { fmt } from '../data';
import { useApi } from '../data';
import { CriterionBars, Loading, Stat, SubmissionCard } from '../components/bits';
import { GrowthChart, Sparkline } from '../components/GrowthChart';

export function ClassPage() {
  const { id } = useParams();
  const { data, error, loading } = useApi<ClassDetail>(`/v1/classes/${id}`);
  if (!data) return <Loading error={error} loading={loading} />;
  const { summary: c } = data;

  return (
    <>
      <p className="crumbs">
        <Link to="/">Overview</Link> / Class {c.label}
      </p>
      <h1>Class {c.label}</h1>
      <p className="muted">{c.assignment}</p>

      <section className="stats">
        <Stat label="Students" value={c.studentCount} />
        <Stat label="Submissions" value={c.submissionCount} />
        <Stat label="To evaluate" value={c.waiting} />
        <Stat label="Average level" value={fmt(c.average)} hint="of 4" />
      </section>

      <section className="card">
        <h2>Class average by criterion</h2>
        <CriterionBars scores={c.criterionAverages} />
      </section>
      <section className="card" style={{ marginTop: '1rem' }}>
        <h2>Class trend</h2>
        <GrowthChart points={data.trend} label={`Class ${c.label} average by month`} />
      </section>

      <h2>Students</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Roll</th>
              <th>Name</th>
              <th>Submissions</th>
              <th>First → latest</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => {
              const delta =
                s.firstAverage !== null && s.latestAverage !== null
                  ? s.latestAverage - s.firstAverage
                  : null;
              return (
                <tr key={s.id}>
                  <td>{s.rollNo}</td>
                  <td>
                    <Link to={`/students/${s.id}`}>{s.name}</Link>
                  </td>
                  <td>{s.submissionCount}</td>
                  <td>
                    {fmt(s.firstAverage)} → {fmt(s.latestAverage)}{' '}
                    {delta !== null && s.submissionCount > 1 && (
                      <span className={delta > 0 ? 'up' : delta < 0 ? 'down' : 'muted'}>
                        {delta > 0 ? '▲' : delta < 0 ? '▼' : '●'} {Math.abs(delta).toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td>
                    <Sparkline values={s.history.map((h) => h.average)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.submissions.length > 0 && (
        <>
          <h2>Submissions</h2>
          <section className="grid">
            {data.submissions.map((s) => (
              <SubmissionCard key={s.id} s={s} />
            ))}
          </section>
        </>
      )}
    </>
  );
}
