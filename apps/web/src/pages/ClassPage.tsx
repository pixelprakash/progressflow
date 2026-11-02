import { Link, useParams } from 'react-router-dom';
import type { ClassDetail } from '@progressflow/shared';
import { api } from '../api';
import { fmt, useApi } from '../data';
import { useLang } from '../i18n';
import { CriterionBars, Loading, Stat, SubmissionCard } from '../components/bits';
import { GrowthChart, Sparkline } from '../components/GrowthChart';

export function ClassPage() {
  const { id } = useParams();
  const { t } = useLang();
  const { data, error, loading, reload } = useApi<ClassDetail>(`/v1/classes/${id}`);
  if (!data) return <Loading error={error} loading={loading} />;
  const { summary: c } = data;
  const portalUrl = `${location.origin}/student`;

  async function newCode(studentId: string, name: string) {
    if (!window.confirm(t('cls.newCodeConfirm', { name }))) return;
    await api.post(`/v1/students/${studentId}/join-code`, {});
    reload();
  }

  return (
    <>
      <p className="crumbs">
        <Link to="/">{t('cls.crumb')}</Link> / {t('common.class', { label: c.label })}
      </p>
      <h1>{t('common.class', { label: c.label })}</h1>
      <p className="muted">{c.assignment}</p>

      <section className="stats">
        <Stat label={t('ov.students')} value={c.studentCount} />
        <Stat label={t('ov.submissions')} value={c.submissionCount} />
        <Stat label={t('ov.toEvaluate')} value={c.waiting} />
        <Stat label={t('ov.avgLevel')} value={fmt(c.average)} hint={t('common.of4')} />
      </section>

      <section className="card">
        <h2>{t('cls.avgByCriterion')}</h2>
        <CriterionBars scores={c.criterionAverages} />
      </section>
      <section className="card" style={{ marginTop: '1rem' }}>
        <h2>{t('cls.trend')}</h2>
        <GrowthChart points={data.trend} label={t('cls.trend')} />
      </section>

      <h2>{t('cls.students')}</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('cls.colRoll')}</th>
              <th>{t('cls.colName')}</th>
              <th>{t('cls.colSubs')}</th>
              <th>{t('cls.colRange')}</th>
              <th>{t('cls.colTrend')}</th>
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

      <section className="card printable" style={{ marginTop: '1.5rem' }}>
        <div className="row between">
          <h2>{t('cls.codesTitle')}</h2>
          <button className="ghost noprint" onClick={() => window.print()}>
            {t('cls.print')}
          </button>
        </div>
        <p className="muted small">{t('cls.codesHelp', { url: portalUrl })}</p>
        <table className="codes">
          <thead>
            <tr>
              <th>{t('cls.colRoll')}</th>
              <th>{t('cls.colName')}</th>
              <th>{t('cls.colCode')}</th>
              <th className="noprint" />
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.id}>
                <td>{s.rollNo}</td>
                <td>{s.name}</td>
                <td>
                  <code className="joincode">{s.joinCode}</code>
                </td>
                <td className="noprint">
                  <button className="ghost" onClick={() => void newCode(s.id, s.name)}>
                    {t('cls.newCode')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.submissions.length > 0 && (
        <>
          <h2>{t('cls.submissions')}</h2>
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
