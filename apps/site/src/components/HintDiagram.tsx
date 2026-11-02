import type { ReactElement } from 'react';

/**
 * The little diagrams from the app's rubric hints. No text inside them: the
 * list next to each one says the same thing at a readable size.
 */
const ink = { stroke: 'var(--fg)', fill: 'none', strokeWidth: 1.6 } as const;
const paper = { fill: 'var(--bg)', stroke: 'var(--fg)', strokeWidth: 1.6 } as const;

function hsl(h: number, l: number): string {
  const s = 0.62;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
/** Five steps from light to dark grey. */
const grey = (i: number) => {
  const v = Math.round(238 - i * 46)
    .toString(16)
    .padStart(2, '0');
  return `#${v}${v}${v}`;
};

function wedge(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}

const DIAGRAMS: Record<string, { title: string; body: ReactElement }> = {
  composition: {
    title: 'A rectangle divided into thirds, with a circle on one of the four crossing points',
    body: (
      <g>
        <rect x="50" y="14" width="180" height="120" {...paper} />
        {[1, 2].map((i) => (
          <g key={i} {...ink} strokeDasharray="4 4" strokeWidth={1}>
            <line x1={50 + 60 * i} y1="14" x2={50 + 60 * i} y2="134" />
            <line x1="50" y1={14 + 40 * i} x2="230" y2={14 + 40 * i} />
          </g>
        ))}
        <circle cx="170" cy="54" r="15" fill="var(--fg)" />
      </g>
    ),
  },
  colour_theory: {
    title: 'A twelve-colour wheel next to a strip of five greys from light to dark',
    body: (
      <g>
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d={wedge(80, 74, 22, 58, (i * Math.PI) / 6, ((i + 1) * Math.PI) / 6)}
            fill={hsl(i * 30, 0.55)}
          />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={158 + i * 22}
            y="46"
            width="22"
            height="56"
            fill={grey(i)}
            stroke="var(--fg)"
            strokeWidth=".6"
          />
        ))}
      </g>
    ),
  },
  technical_skill: {
    title:
      'Four squares of pencil shading, from patchy on the left to smooth and even on the right',
    body: (
      <g>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={14 + i * 66} y="22" width="58" height="104" {...paper} strokeWidth={1.2} />
            {Array.from({ length: 4 + i * 4 }, (_, j) => (
              <line
                key={j}
                x1={18 + i * 66}
                y1={28 + j * (88 / (4 + i * 4))}
                x2={68 + i * 66}
                y2={22 + j * (88 / (4 + i * 4)) + 14}
                {...ink}
                strokeWidth={0.9}
                opacity={0.8}
              />
            ))}
          </g>
        ))}
      </g>
    ),
  },
  conceptual_depth: {
    title: 'Three boxes joined by arrows: idea, choices, artwork',
    body: (
      <g>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={12 + i * 92}
              y="52"
              width="68"
              height="46"
              fill={i === 2 ? 'var(--fg)' : 'var(--bg)'}
              stroke="var(--fg)"
              strokeWidth="1.6"
            />
            {i < 2 && (
              <path
                d={`M ${82 + i * 92} 75 H ${102 + i * 92} M ${96 + i * 92} 69 L ${102 + i * 92} 75 L ${96 + i * 92} 81`}
                {...ink}
              />
            )}
          </g>
        ))}
      </g>
    ),
  },
};

export function HintDiagram({ kind }: { kind: string }) {
  const d = DIAGRAMS[kind];
  if (!d) return null;
  return (
    <svg viewBox="0 0 280 148" role="img" aria-label={d.title}>
      <title>{d.title}</title>
      {d.body}
    </svg>
  );
}
