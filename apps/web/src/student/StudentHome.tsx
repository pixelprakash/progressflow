import { Link } from 'react-router-dom';
import { kindText, fmt } from '../data';
import { useLang } from '../i18n';
import { GrowthChart } from '../components/GrowthChart';
import { useStudent } from './session';

export function StudentHome() {
  const { portal } = useStudent();
  const { t, fmtDate } = useLang();
  if (!portal) return null;
  const { student, pieces } = portal;
  const needSelf = pieces.filter((p) => !p.self && p.pages.length > 0);

  return (
    <>
      <h1>{t('sp.hello', { name: student.name })}</h1>
      <p className="muted">
        {t('sp.classLine', { label: student.classLabel, roll: student.rollNo })}
      </p>

      <section aria-labelledby="todo" className="card">
        <h2 id="todo">{t('sp.todo')}</h2>
        {needSelf.length === 0 && portal.peerAvailable === 0 && <p>{t('sp.allDone')}</p>}
        <ul className="todo">
          {needSelf.map((p) => (
            <li key={p.id}>
              <Link className="btn-link" to={`/student/review/${p.id}`}>
                {t('sp.todoSelf')} · {kindText(t, p.kind)}, {fmtDate(p.createdAt)}
              </Link>
            </li>
          ))}
          {portal.peerAvailable > 0 && (
            <li>
              <Link className="btn-link" to="/student/peer">
                {t('sp.todoPeer')} ({portal.peerAvailable})
              </Link>
            </li>
          )}
        </ul>
      </section>

      <h2>{t('sp.myWork')}</h2>
      {pieces.length === 0 ? (
        <p className="muted">{t('sp.noWork')}</p>
      ) : (
        <section className="grid">
          {pieces.map((p) => (
            <Link key={p.id} to={`/student/work/${p.id}`} className="card sub-card">
              <div className="thumb">
                {p.pages[0] ? (
                  <img src={`/v1/media/page/${p.pages[0].id}`} alt="" loading="lazy" />
                ) : (
                  <span className="muted small">{t('common.noPhoto')}</span>
                )}
              </div>
              <div className="sub-meta">
                <strong>{kindText(t, p.kind)}</strong>
                <span className="muted small">{fmtDate(p.createdAt)}</span>
                <span className="row gap">
                  {p.average !== null ? (
                    <span className="pill">
                      {fmt(p.average)} {t('common.avg')}
                    </span>
                  ) : (
                    <span className="pill warn">{t('common.notScored')}</span>
                  )}
                  {p.self && <span className="pill">✓ {t('rv.review')}</span>}
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}

      <section className="card" style={{ marginTop: '1.5rem' }} aria-labelledby="prog">
        <h2 id="prog">{t('sp.myProgress')}</h2>
        {portal.history.length > 0 ? (
          <GrowthChart points={portal.history} label={t('sp.myProgress')} />
        ) : (
          <p className="muted">{t('sp.progressNone')}</p>
        )}
      </section>
    </>
  );
}
