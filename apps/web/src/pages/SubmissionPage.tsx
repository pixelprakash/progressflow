import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LANGUAGE_NAMES, levelLabel } from '@progressflow/shared';
import type { PerformanceLevel, ReviewView, SubmissionDetail } from '@progressflow/shared';
import { api } from '../api';
import { fmt, useApi } from '../data';
import { useTeacher } from '../teacher';
import { useLang } from '../i18n';
import { Loading } from '../components/bits';
import { Answers } from '../components/Answers';
import { AnnotatedImage } from '../components/AnnotatedImage';

export function SubmissionPage() {
  const { id } = useParams();
  const { t, lang, fmtDate } = useLang();
  const { guides, kindLabel } = useTeacher();
  const { data, error, loading, reload } = useApi<SubmissionDetail>(`/v1/submissions/${id}`);
  const [idx, setIdx] = useState(0);
  if (!data) return <Loading error={error} loading={loading} />;
  const { summary: s } = data;
  const page = data.pages[Math.min(idx, data.pages.length - 1)];

  const act = async (path: string, body: unknown) => {
    await api.post(path, body);
    reload();
  };

  return (
    <>
      <p className="crumbs">
        <Link to="/">{t('cls.crumb')}</Link> /{' '}
        <Link to={`/classes/${s.classId}`}>{t('common.class', { label: s.classLabel })}</Link> /{' '}
        <Link to={`/students/${s.studentId}`}>{s.studentName}</Link>
      </p>
      <h1>{s.studentName}</h1>
      <p className="muted">
        {kindLabel(s.kind)} · {fmtDate(s.createdAt)} · {t('common.average')} {fmt(s.average)}
      </p>

      <div className="two sub-layout">
        <section>
          {page ? (
            <>
              <AnnotatedImage
                key={page.id}
                src={`/v1/media/page/${page.id}`}
                width={page.width}
                height={page.height}
                strokes={page.strokes}
                alt={s.studentName}
              />
              {data.pages.length > 1 && (
                <div className="thumbs">
                  {data.pages.map((p, i) => (
                    <button
                      key={p.id}
                      className={i === idx ? 'on' : ''}
                      onClick={() => setIdx(i)}
                      aria-label={`${i + 1}`}
                    >
                      <img src={`/v1/media/page/${p.id}`} alt="" />
                    </button>
                  ))}
                </div>
              )}
              {page.quality && (
                <p className="muted small">
                  {t('sub.capture', {
                    w: page.width,
                    h: page.height,
                    sharp: page.quality.sharpness,
                    light: page.quality.brightness,
                  })}
                </p>
              )}
            </>
          ) : (
            <div className="card empty">
              <p className="muted">{t('sub.noPhoto')}</p>
            </div>
          )}
        </section>

        <section>
          <h2>{t('sub.rubric')}</h2>
          {guides.map((g) => {
            const level = s.scores[g.key] as PerformanceLevel | undefined;
            const mine = data.reviews.self?.scores[g.key];
            return (
              <div key={g.key} className="card crit" style={{ borderLeftColor: g.color }}>
                <div className="row between">
                  <strong>{g.name}</strong>
                  <span className="pill">
                    {level ? `${level} · ${levelLabel(lang, level)}` : t('common.notScored')}
                  </span>
                </div>
                <div className="steps" aria-hidden>
                  {[1, 2, 3, 4].map((n) => (
                    <i
                      key={n}
                      style={{
                        background: level !== undefined && n <= level ? g.color : undefined,
                      }}
                    />
                  ))}
                </div>
                <p className="small">{level ? g.levels[level] : g.tagline}</p>
                {mine !== undefined && (
                  <p className="small muted">
                    {t('sub.theyScored')}: {mine}
                    {level !== undefined && mine !== level
                      ? ` (${mine > level ? '▲' : '▼'} ${Math.abs(mine - level)})`
                      : ''}
                  </p>
                )}
              </div>
            );
          })}

          {data.voice && (
            <div className="card">
              <h2>{t('sub.voice')}</h2>
              <audio controls preload="none" src={`/v1/media/voice/${data.voice.mediaId}`} />
              <p className="muted small">
                {t('sub.voiceMeta', {
                  lang: LANGUAGE_NAMES[data.voice.language] ?? data.voice.language,
                  s: Math.round(data.voice.durationMs / 1000),
                })}
              </p>
            </div>
          )}

          {(data.attachments.length > 0 || data.note) && (
            <div className="card">
              <h2>{t('sub.forStudent')}</h2>
              {data.note && <p className="note">{data.note}</p>}
              <ul className="atts">
                {data.attachments.map((a) => (
                  <li key={a.id}>
                    {a.kind === 'image' && (
                      <a href={`/v1/media/attachment/${a.id}`} target="_blank" rel="noreferrer">
                        <img src={`/v1/media/attachment/${a.id}`} alt={a.title} />
                      </a>
                    )}
                    {a.kind === 'file' && (
                      <a href={`/v1/media/attachment/${a.id}`} download>
                        {a.title}
                      </a>
                    )}
                    {a.kind === 'link' && a.url && /^https?:\/\//i.test(a.url) && (
                      <a href={a.url} target="_blank" rel="noreferrer noopener">
                        {a.title}
                      </a>
                    )}
                    {a.kind === 'note' && <span>{a.text}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <h2>{t('sub.reviews')}</h2>
      <section className="card">
        <label className="switch">
          <input
            type="checkbox"
            checked={data.peerOpen}
            onChange={(e) =>
              void act(`/v1/submissions/${s.id}/peer-open`, { open: e.target.checked })
            }
          />
          <span>{t('sub.shareForPeer')}</span>
        </label>
        <p className="muted small">{t('sub.shareHelp')}</p>
      </section>

      <section className="card" style={{ marginTop: '1rem' }}>
        <h3>{t('sub.selfReview')}</h3>
        {data.reviews.self ? (
          <Answers kind="self" answers={data.reviews.self.answers} />
        ) : (
          <p className="muted">{t('sub.noSelf')}</p>
        )}
      </section>

      <section className="card" style={{ marginTop: '1rem' }}>
        <h3>{t('sub.peerReviews')}</h3>
        {data.reviews.peers.length === 0 && <p className="muted">{t('sub.noPeer')}</p>}
        {data.reviews.peers.map((r: ReviewView) => (
          <article key={r.id} className="peer-review">
            <div className="row between gap">
              <strong>{t('sub.by', { name: r.byName ?? '' })}</strong>
              <span className={`pill ${r.approved ? '' : 'warn'}`}>
                {r.approved ? t('sub.approved') : t('sub.pendingApproval')}
              </span>
            </div>
            <Answers kind="peer" answers={r.answers} />
            <button
              className={r.approved ? 'ghost' : 'primary'}
              onClick={() => void act(`/v1/reviews/${r.id}/approve`, { approved: !r.approved })}
            >
              {r.approved ? t('sub.hide') : t('sub.approve')}
            </button>
          </article>
        ))}
      </section>
    </>
  );
}
