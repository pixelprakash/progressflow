import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { theme } from '../theme';

/** Small teaching diagrams for each rubric criterion ("visual hints"). */

const W = 280;
const H = 150;

function hslHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function wedge(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}

export function HintDiagram({ kind }: { kind: string }) {
  const ink = theme.color.text;
  const soft = theme.color.textMuted;

  if (kind === 'composition') {
    const x0 = 70,
      y0 = 12,
      w = 140,
      h = 100;
    return (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={x0} y={y0} width={w} height={h} fill="#F4F5F7" stroke={ink} strokeWidth={1.5} />
        {[1, 2].map((i) => (
          <G key={i}>
            <Line
              x1={x0 + (w * i) / 3}
              y1={y0}
              x2={x0 + (w * i) / 3}
              y2={y0 + h}
              stroke={soft}
              strokeDasharray="4 3"
            />
            <Line
              x1={x0}
              y1={y0 + (h * i) / 3}
              x2={x0 + w}
              y2={y0 + (h * i) / 3}
              stroke={soft}
              strokeDasharray="4 3"
            />
          </G>
        ))}
        {[1, 2].flatMap((i) =>
          [1, 2].map((j) => (
            <Circle
              key={`${i}${j}`}
              cx={x0 + (w * i) / 3}
              cy={y0 + (h * j) / 3}
              r={4}
              fill={theme.color.primary}
              opacity={0.4}
            />
          )),
        )}
        <Circle cx={x0 + (w * 2) / 3} cy={y0 + h / 3} r={14} fill={theme.color.primary} />
        <SvgText x={W / 2} y={H - 8} fontSize={12} fill={soft} textAnchor="middle">
          Strong subjects sit near the thirds — not dead centre, not lost in a corner
        </SvgText>
      </Svg>
    );
  }

  if (kind === 'colour_theory') {
    const cx = 85,
      cy = 62,
      n = 12;
    return (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {Array.from({ length: n }, (_, i) => (
          <Path
            key={i}
            d={wedge(cx, cy, 22, 55, (i * 2 * Math.PI) / n, ((i + 1) * 2 * Math.PI) / n)}
            fill={hslHex(i * 30, 75, 52)}
          />
        ))}
        <Line
          x1={cx + 38 * Math.cos(0)}
          y1={cy}
          x2={cx - 38}
          y2={cy}
          stroke="#fff"
          strokeWidth={3}
        />
        <Circle cx={cx + 38} cy={cy} r={6} fill="none" stroke="#fff" strokeWidth={3} />
        <Circle cx={cx - 38} cy={cy} r={6} fill="none" stroke="#fff" strokeWidth={3} />
        <G>
          {[0, 1, 2, 3, 4].map((i) => (
            <Rect
              key={i}
              x={170 + i * 20}
              y={30}
              width={20}
              height={36}
              fill={hslHex(220, 15, 90 - i * 20)}
            />
          ))}
          <SvgText x={220} y={84} fontSize={12} fill={ink} textAnchor="middle">
            Tonal range
          </SvgText>
          <SvgText x={220} y={100} fontSize={11} fill={soft} textAnchor="middle">
            (pencil work: judge light → dark)
          </SvgText>
        </G>
        <SvgText x={cx} y={H - 8} fontSize={12} fill={soft} textAnchor="middle">
          Opposites contrast, neighbours harmonise
        </SvgText>
      </Svg>
    );
  }

  if (kind === 'technical_skill') {
    return (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {[0, 1, 2, 3].map((i) => (
          <G key={i}>
            <Rect
              x={20 + i * 64}
              y={14}
              width={56}
              height={70}
              fill="#fff"
              stroke={ink}
              strokeWidth={1.2}
            />
            {Array.from({ length: 3 + i * 3 }, (_, j) => (
              <Line
                key={j}
                x1={24 + i * 64}
                y1={20 + j * (60 / (3 + i * 3))}
                x2={72 + i * 64}
                y2={14 + j * (60 / (3 + i * 3)) + 12}
                stroke={ink}
                strokeWidth={0.9}
                opacity={0.75}
              />
            ))}
          </G>
        ))}
        <SvgText x={48} y={100} fontSize={11} fill={soft} textAnchor="middle">
          patchy
        </SvgText>
        <SvgText x={240} y={100} fontSize={11} fill={soft} textAnchor="middle">
          smooth, even
        </SvgText>
        <SvgText x={W / 2} y={H - 22} fontSize={12} fill={soft} textAnchor="middle">
          Look for control of pressure, even shading,
        </SvgText>
        <SvgText x={W / 2} y={H - 8} fontSize={12} fill={soft} textAnchor="middle">
          believable form and clean edges
        </SvgText>
      </Svg>
    );
  }

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {['Idea', 'Choices', 'Artwork'].map((t, i) => (
        <G key={t}>
          <Rect
            x={14 + i * 92}
            y={34}
            width={76}
            height={44}
            rx={10}
            fill={i === 2 ? theme.color.primary : theme.color.primarySoft}
          />
          <SvgText
            x={52 + i * 92}
            y={61}
            fontSize={13}
            fontWeight="bold"
            fill={i === 2 ? '#fff' : ink}
            textAnchor="middle"
          >
            {t}
          </SvgText>
          {i < 2 ? (
            <Path
              d={`M ${92 + i * 92} 56 L ${104 + i * 92} 56 M ${99 + i * 92} 51 L ${104 + i * 92} 56 L ${99 + i * 92} 61`}
              stroke={ink}
              strokeWidth={2}
              fill="none"
            />
          ) : null}
        </G>
      ))}
      <SvgText x={W / 2} y={H - 22} fontSize={12} fill={soft} textAnchor="middle">
        Can you trace the choices back to an idea?
      </SvgText>
      <SvgText x={W / 2} y={H - 8} fontSize={12} fill={soft} textAnchor="middle">
        Ask the student what they wanted to show.
      </SvgText>
    </Svg>
  );
}
