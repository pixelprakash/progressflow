import type { TimePoint } from '@progressflow/shared';
import { useLang } from '../i18n';

const W = 720;
const H = 280;
const PAD = { l: 36, r: 16, t: 14, b: 34 };

/** Time-scaled lines for the four criteria on the 1–4 performance scale. */
export function GrowthChart({ points, label }: { points: TimePoint[]; label: string }) {
  const { guides, lang } = useLang();
  if (points.length === 0) return null;
  const ts = points.map((p) => new Date(p.t).getTime());
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const x = (t: number) =>
    t1 === t0 ? W / 2 : PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - 1) / 3) * (H - PAD.t - PAD.b);
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'en' ? 'en-IN' : lang === 'hi' ? 'hi-IN' : 'te-IN', {
      day: 'numeric',
      month: 'short',
    });

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {[1, 2, 3, 4].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.l - 10} y={y(v) + 4} textAnchor="end" className="tick">
              {v}
            </text>
          </g>
        ))}
        {points.map((p) => (
          <text
            key={p.t}
            x={x(new Date(p.t).getTime())}
            y={H - 10}
            textAnchor="middle"
            className="tick"
          >
            {day(p.t)}
          </text>
        ))}
        {guides.map((g) => {
          const pts = points.flatMap((p) =>
            p.scores[g.key] === undefined
              ? []
              : [[x(new Date(p.t).getTime()), y(p.scores[g.key]!)] as const],
          );
          return (
            <g key={g.key} stroke={g.color} fill={g.color}>
              <polyline
                points={pts.map((q) => q.join(',')).join(' ')}
                fill="none"
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={4.5} stroke="none" />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        {guides.map((g) => (
          <span key={g.key}>
            <i style={{ background: g.color }} />
            {g.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="muted">—</span>;
  const w = 80;
  const h = 24;
  const pts = values.map(
    (v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - 1) / 3) * (h - 4)}`,
  );
  return (
    <svg width={w} height={h} className="spark" aria-hidden>
      <polyline
        points={pts.join(' ')}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
