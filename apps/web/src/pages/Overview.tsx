import { Link, useOutletContext } from 'react-router-dom';
import type { Overview as OverviewData } from '@progressflow/shared';
import { fmt } from '../data';
import { useLang } from '../i18n';
import { CriterionBars, Stat, SubmissionCard } from '../components/bits';

export function Overview() {
  const o = useOutletContext<OverviewData | null>();
  const { t } = useLang();
  if (!o) return null;

  if (o.counts.classes === 0) {
    return (
      <>
        <h1>{t('ov.welcome')}</h1>
        <div className="card empty">
          <h2>{t('ov.noClasses')}</h2>
          <p>{t('ov.noClassesBody')}</p>
          <ol>
            <li>{t('ov.step1')}</li>
            <li>{t('ov.step2')}</li>
            <li>{t('ov.step3')}</li>
          </ol>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{t('ov.title')}</h1>
      <section className="stats">
        <Stat label={t('ov.classes')} value={o.counts.classes} />
        <Stat label={t('ov.students')} value={o.counts.students} />
        <Stat label={t('ov.submissions')} value={o.counts.submissions} />
        <Stat label={t('ov.toEvaluate')} value={o.counts.waiting} hint={t('ov.toEvaluateHint')} />
        {o.counts.pendingReviews > 0 && (
          <Stat
            label={t('ov.pending')}
            value={o.counts.pendingReviews}
            hint={t('ov.pendingHint')}
          />
        )}
        <Stat label={t('ov.avgLevel')} value={fmt(o.average)} hint={t('ov.avgHint')} />
      </section>

      <h2>{t('ov.classes')}</h2>
      <section className="grid">
        {o.classes.map((c) => (
          <Link key={c.id} to={`/classes/${c.id}`} className="card class-card">
            <div className="row between">
              <span className="class-label">{c.label}</span>
              {c.waiting > 0 && (
                <span className="pill warn">{t('ov.waiting', { n: c.waiting })}</span>
              )}
            </div>
            <span className="muted small">
              {t('ov.classLine', {
                students: c.studentCount,
                subs: c.submissionCount,
                assignment: c.assignment,
              })}
            </span>
            <CriterionBars scores={c.criterionAverages} />
          </Link>
        ))}
      </section>

      {o.recent.length > 0 && (
        <>
          <h2>{t('ov.recent')}</h2>
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
