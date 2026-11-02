import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { levelLabel } from '@progressflow/shared';
import type { PerformanceLevel } from '@progressflow/shared';
import { LANGUAGE_NAMES } from '@progressflow/shared';
import { fmt, kindKey } from '../data';
import { useLang } from '../i18n';
import { AnnotatedImage } from '../components/AnnotatedImage';
import { Answers } from '../components/Answers';
import { useStudent } from './session';

export function StudentPiece() {
  const { id } = useParams();
  const { portal } = useStudent();
  const { t, lang, guides, fmtDate } = useLang();
  const [idx, setIdx] = useState(0);
  const piece = portal?.pieces.find((p) => p.id === id);
  if (!portal) return null;
  if (!piece)
    return (
      <p>
        {t('common.error')} <Link to="/student">{t('sp.backHome')}</Link>
      </p>
    );
  const page = piece.pages[Math.min(idx, piece.pages.length - 1)];
  const self = piece.self;

  return (
    <>
      <p>
        <Link to="/student">← {t('sp.backHome')}</Link>
      </p>
      <h1>{t(kindKey(piece.kind))}</h1>
      <p className="muted">
        {fmtDate(piece.createdAt)} · {t('common.average')} {fmt(piece.average)}
      </p>

      {page && (
        <>
          <AnnotatedImage
            key={page.id}
            src={`/v1/media/page/${page.id}`}
            width={page.width}
            height={page.height}
            strokes={page.strokes}
            alt={t(kindKey(piece.kind))}
          />
          {piece.pages.length > 1 && (
            <div className="thumbs">
              {piece.pages.map((p, i) => (
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
        </>
      )}

      <h2>{self ? t('sp.compare') : t('sp.teacherScores')}</h2>
      {guides.map((g) => {
        const level = piece.scores[g.key] as PerformanceLevel | undefined;
        const mine = self?.scores[g.key] as PerformanceLevel | undefined;
        return (
          <div key={g.key} className="card crit" style={{ borderLeftColor: g.color }}>
            <strong>{g.name}</strong>
            <div className="compare">
              {mine !== undefined && (
                <span className="pill">
                  {t('sp.you')}: {mine} · {levelLabel(lang, mine)}
                </span>
              )}
              <span className="pill">
                {t('sp.teacher')}:{' '}
                {level ? `${level} · ${levelLabel(lang, level)}` : t('common.notScored')}
              </span>
            </div>
            {level && <p className="small">{g.levels[level]}</p>}
          </div>
        );
      })}

      {(piece.note || piece.voice || piece.attachments.length > 0) && (
        <section className="card">
          <h2>{t('sp.teacherFeedback')}</h2>
          {piece.note && (
            <>
              <h3>{t('sp.teacherNote')}</h3>
              <p className="note">{piece.note}</p>
            </>
          )}
          {piece.voice && (
            <>
              <h3>{t('sp.voice')}</h3>
              <audio controls preload="none" src={`/v1/media/voice/${piece.voice.mediaId}`} />
              <p className="muted small">{LANGUAGE_NAMES[piece.voice.language]}</p>
            </>
          )}
          {piece.attachments.length > 0 && (
            <>
              <h3>{t('sp.links')}</h3>
              <ul className="atts">
                {piece.attachments.map((a) => (
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
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>{t('sp.myReview')}</h2>
        {self ? (
          <Answers kind="self" answers={self.answers} />
        ) : (
          <Link className="btn-link" to={`/student/review/${piece.id}`}>
            {t('sp.reviewNow')}
          </Link>
        )}
      </section>

      <section className="card">
        <h2>{t('sp.fromClassmates')}</h2>
        {piece.peers.length === 0 && <p className="muted">{t('sp.fromClassmatesNone')}</p>}
        {piece.peers.map((r) => (
          <article key={r.id} className="peer-review">
            <strong>{t('sp.anonymous')}</strong>
            <Answers kind="peer" answers={r.answers} />
          </article>
        ))}
      </section>
    </>
  );
}
