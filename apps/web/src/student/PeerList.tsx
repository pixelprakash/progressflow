import { Link } from 'react-router-dom';
import type { PeerCandidate } from '@progressflow/shared';
import { useApi } from '../data';
import { useLang } from '../i18n';
import { useStudent } from './session';

export function PeerList() {
  const { t } = useLang();
  const { expire } = useStudent();
  const { data, loading } = useApi<PeerCandidate[]>('/v1/student/peer', expire);
  return (
    <>
      <p>
        <Link to="/student">← {t('sp.backHome')}</Link>
      </p>
      <h1>{t('rv.choose')}</h1>
      <p className="notice">
        {t('rv.anon')} {t('rv.kind')}
      </p>
      {loading && <p className="muted">{t('common.loading')}</p>}
      {data && data.length === 0 && <p>{t('rv.noPeerWork')}</p>}
      <section className="grid">
        {data?.map((c) => (
          <Link key={c.id} to={`/student/peer/${c.id}`} className="card peer-card">
            {c.pages[0] && <img src={`/v1/media/page/${c.pages[0].id}`} alt="" loading="lazy" />}
            <span className="btn-link">{t('rv.review')}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
