import { useState } from 'react';
import type { AnnotationStroke } from '@progressflow/shared';
import { useLang } from '../i18n';

/** Artwork with the teacher's markup on top. The switch hides the markup without losing it. */
export function AnnotatedImage({
  src,
  width,
  height,
  strokes,
  alt,
}: {
  src: string;
  width: number;
  height: number;
  strokes: AnnotationStroke[];
  alt: string;
}) {
  const { t } = useLang();
  const [show, setShow] = useState(true);
  const head = Math.min(width, height) * 0.035;

  return (
    <div className="annotated">
      <div className="frame" style={{ aspectRatio: `${width} / ${height}` }}>
        <img src={src} alt={alt} />
        {show && strokes.length > 0 && (
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
            {strokes.map((s, i) => (
              <Mark key={i} s={s} w={width} h={height} head={head} />
            ))}
          </svg>
        )}
      </div>
      {strokes.length > 0 ? (
        <label className="switch">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          <span>{show ? t('sub.markShown') : t('sub.markHidden')}</span>
          <small>{t('sub.marks', { n: strokes.length })}</small>
        </label>
      ) : (
        <p className="muted small">{t('sub.noMarks')}</p>
      )}
    </div>
  );
}

function Mark({ s, w, h, head }: { s: AnnotationStroke; w: number; h: number; head: number }) {
  const P = s.points.map(([px, py]) => [px * w, py * h] as const);
  const a = P[0];
  const b = P[P.length - 1];
  if (!a || !b) return null;
  const common = {
    stroke: s.color,
    strokeWidth: s.width,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (s.tool === 'circle') {
    return (
      <ellipse
        cx={(a[0] + b[0]) / 2}
        cy={(a[1] + b[1]) / 2}
        rx={Math.abs(b[0] - a[0]) / 2}
        ry={Math.abs(b[1] - a[1]) / 2}
        fill="none"
        {...common}
      />
    );
  }
  if (s.tool === 'arrow') {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const p1 = [b[0] - head * Math.cos(ang - 0.45), b[1] - head * Math.sin(ang - 0.45)];
    const p2 = [b[0] - head * Math.cos(ang + 0.45), b[1] - head * Math.sin(ang + 0.45)];
    return (
      <>
        <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} />
        <polygon points={`${b.join(',')} ${p1.join(',')} ${p2.join(',')}`} fill={s.color} />
      </>
    );
  }
  return (
    <polyline
      points={P.map((p) => p.join(',')).join(' ')}
      fill="none"
      opacity={s.tool === 'highlight' ? 0.35 : 1}
      {...common}
    />
  );
}
