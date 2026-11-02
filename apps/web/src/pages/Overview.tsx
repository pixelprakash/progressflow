import { Link, useOutletContext } from 'react-router-dom';
import type { Overview as OverviewData } from '@progressflow/shared';
import { fmt } from '../data';
import { CriterionBars, Stat, SubmissionCard } from '../components/bits';

export function Overview() {
  const o = useOutletContext<OverviewData | null>();
  if (!o) return null;

  if (o.counts.classes === 0) {
    return (
      <>
        <h1>Welcome</h1>
        <div className="card empty">
          <h2>No classes here yet</h2>
          <p>Your classes appear after the ProgressFlow phone app syncs.</p>
          <ol>
            <li>Open the app on your phone and tap the account icon.</li>
            <li>
              Choose <strong>Web account</strong> and sign in with this mobile number and password.
            </li>
            <li>
              Tap <strong>Sync now</strong>. Scans, scores, markup and voice notes will show up
              here.
            </li>
          </ol>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Overview</h1>
      <section className="stats">
        <Stat label="Classes" value={o.counts.classes} />
        <Stat label="Students" value={o.counts.students} />
        <Stat label="Submissions" value={o.counts.submissions} />
        <Stat label="To evaluate" value={o.counts.waiting} hint="photographed, not fully scored" />
        <Stat label="Average level" value={fmt(o.average)} hint="of 4, all scored work" />
      </section>

      <h2>Classes</h2>
      <section className="grid">
        {o.classes.map((c) => (
          <Link key={c.id} to={`/classes/${c.id}`} className="card class-card">
            <div className="row between">
              <span className="class-label">{c.label}</span>
              {c.waiting > 0 && <span className="pill warn">{c.waiting} to evaluate</span>}
            </div>
            <span className="muted small">
              {c.studentCount} students · {c.submissionCount} submissions · {c.assignment}
            </span>
            <CriterionBars scores={c.criterionAverages} />
          </Link>
        ))}
      </section>

      {o.recent.length > 0 && (
        <>
          <h2>Recent submissions</h2>
          <section className="grid">
            {o.recent.map((s) => (
              <SubmissionCard key={s.id} s={s} />
            ))}
          </section>
        </>
      )}
    </>
  );
}
