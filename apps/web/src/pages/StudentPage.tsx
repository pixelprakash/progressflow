import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StudentDetail } from '@progressflow/shared';
import { fmt, kindKey, useApi } from '../data';
import { useLang } from '../i18n';
import { Loading, Stat, SubmissionCard } from '../components/bits';
import { GrowthChart } from '../components/GrowthChart';

export function StudentPage() {
  const { id } = useParams();
  const { t } = useLang();
  const { data, error, loading } = useApi<StudentDetail>(`/v1/students/${id}`);
  const [kind, setKind] = useState<string>('all');
  if (!data) return <Loading error={error} loading={loading} />;

  const subs = data.submissions.filter((s) => kind === 'all' || s.kind === kind);
  const scoredAll = data.submissions.filter((s) => s.average !== null).reverse();
  const points = data.history.filter((_, i) => kind === 'all' || scoredAll[i]?.kind === kind);
  const first = points[0]?.average ?? null;
  const last = points[points.length - 1]?.average ?? null;

  return (
    <>
      <p className="crumbs">
        <Link to="/">{t('cls.crumb')}</Link> /{' '}
        <Link to={`/classes/${data.student.classId}`}>
          {t('common.class', { label: data.student.classLabel })}
        </Link>{' '}
        / {data.student.name}
      </p>
      <h1>{data.student.name}</h1>
      <p className="muted">
        {t('common.roll', { n: data.student.rollNo })} ·{' '}
        {t('common.class', { label: data.student.classLabel })}
      </p>

      <section className="stats">
        <Stat label={t('ov.submissions')} value={data.submissions.length} />
        <Stat label={t('stu.first')} value={fmt(first)} />
        <Stat label={t('stu.latest')} value={fmt(last)} />
        <Stat
          label={t('stu.change')}
          value={
            first !== null && last !== null && points.length > 1
              ? `${last - first >= 0 ? '+' : ''}${(last - first).toFixed(1)}`
              : '—'
          }
        />
      </section>

      <div className="chips" role="group">
        {['all', 'sketch', 'regular', 'progress', 'portfolio'].map((k) => (
          <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
            {k === 'all' ? t('common.all') : t(kindKey(k))}
          </button>
        ))}
      </div>

      <section className="card">
        <h2>{t('stu.history')}</h2>
        {points.length ? (
          <GrowthChart points={points} label={t('stu.history')} />
        ) : (
          <p className="muted">{t('common.notScored')}</p>
        )}
      </section>

      <h2>{t('stu.portfolio')}</h2>
      {subs.length === 0 ? (
        <p className="muted">{t('stu.nothing')}</p>
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
