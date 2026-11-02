import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LEVEL_LABELS, RUBRIC_GUIDES } from '@progressflow/shared';
import type { PerformanceLevel, SubmissionDetail } from '@progressflow/shared';
import { KIND_LABEL, fmt, fmtDate, useApi } from '../data';
import { Loading } from '../components/bits';
import { AnnotatedImage } from '../components/AnnotatedImage';

const LANG: Record<string, string> = { en: 'English', hi: 'हिन्दी', te: 'తెలుగు' };

export function SubmissionPage() {
  const { id } = useParams();
  const { data, error, loading } = useApi<SubmissionDetail>(`/v1/submissions/${id}`);
  const [idx, setIdx] = useState(0);
  if (!data) return <Loading error={error} loading={loading} />;
  const { summary: s } = data;
  const page = data.pages[Math.min(idx, data.pages.length - 1)];

  return (
    <>
      <p className="crumbs">
        <Link to="/">Overview</Link> /{' '}
        <Link to={`/classes/${s.classId}`}>Class {s.classLabel}</Link> /{' '}
        <Link to={`/students/${s.studentId}`}>{s.studentName}</Link>
      </p>
      <h1>{s.studentName}</h1>
      <p className="muted">
        {KIND_LABEL[s.kind]} · {fmtDate(s.createdAt)} · average {fmt(s.average)}
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
              />
              {data.pages.length > 1 && (
                <div className="thumbs">
                  {data.pages.map((p, i) => (
                    <button
                      key={p.id}
                      className={i === idx ? 'on' : ''}
                      onClick={() => setIdx(i)}
                      aria-label={`Image ${i + 1}`}
                    >
                      <img src={`/v1/media/page/${p.id}`} alt="" />
                    </button>
                  ))}
                </div>
              )}
              {page.quality && (
                <p className="muted small">
                  Capture: {page.width}×{page.height}px · sharpness {page.quality.sharpness} ·
                  brightness {page.quality.brightness}
                </p>
              )}
            </>
          ) : (
            <div className="card empty">
              <p className="muted">No photo for this record.</p>
            </div>
          )}
        </section>

        <section>
          <h2>Rubric</h2>
          {RUBRIC_GUIDES.map((g) => {
            const level = s.scores[g.key] as PerformanceLevel | undefined;
            return (
              <div key={g.key} className="card crit" style={{ borderLeftColor: g.color }}>
                <div className="row between">
                  <strong>{g.name}</strong>
                  <span className="pill">
                    {level ? `${level} · ${LEVEL_LABELS[level]}` : 'Not scored'}
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
              </div>
            );
          })}

          {data.voice && (
            <div className="card">
              <h2>Voice note</h2>
              <audio controls preload="none" src={`/v1/media/voice/${data.voice.mediaId}`} />
              <p className="muted small">
                {LANG[data.voice.language] ?? data.voice.language} ·{' '}
                {Math.round(data.voice.durationMs / 1000)} s · transcript not available yet
              </p>
            </div>
          )}

          {(data.attachments.length > 0 || data.note) && (
            <div className="card">
              <h2>For the student</h2>
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
    </>
  );
}
