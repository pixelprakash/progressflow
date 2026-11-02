import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { theme } from '../theme';

export interface Series {
  key: string;
  color: string;
  points: { t: number; v: number }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Time-scaled growth lines on the 1–4 performance scale. */
export function GrowthChart({
  series,
  width,
  height = 200,
}: {
  series: Series[];
  width: number;
  height?: number;
}) {
  const padL = 30,
    padR = 14,
    padT = 12,
    padB = 26;
  const all = series.flatMap((s) => s.points.map((p) => p.t));
  if (!all.length || width < 60) return null;
  const t0 = Math.min(...all);
  const t1 = Math.max(...all);
  const x = (t: number) =>
    t1 === t0 ? width / 2 : padL + ((t - t0) / (t1 - t0)) * (width - padL - padR);
  const y = (v: number) => padT + (1 - (v - 1) / 3) * (height - padT - padB);
  const dates = [...new Set(all)].sort((a, b) => a - b);

  return (
    <Svg width={width} height={height}>
      {[1, 2, 3, 4].map((v) => (
        <Line
          key={v}
          x1={padL}
          x2={width - padR}
          y1={y(v)}
          y2={y(v)}
          stroke={theme.color.border}
          strokeWidth={1}
        />
      ))}
      {[1, 2, 3, 4].map((v) => (
        <SvgText
          key={`l${v}`}
          x={padL - 8}
          y={y(v) + 4}
          fontSize={11}
          fill={theme.color.textMuted}
          textAnchor="end"
        >
          {v}
        </SvgText>
      ))}
      {dates.map((t) => {
        const d = new Date(t);
        return (
          <SvgText
            key={t}
            x={x(t)}
            y={height - 8}
            fontSize={11}
            fill={theme.color.textMuted}
            textAnchor="middle"
          >
            {`${d.getDate()} ${MONTHS[d.getMonth()]}`}
          </SvgText>
        );
      })}
      {series.map((s) => (
        <Polyline
          key={s.key}
          points={s.points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {series.flatMap((s) =>
        s.points.map((p) => (
          <Circle key={`${s.key}${p.t}`} cx={x(p.t)} cy={y(p.v)} r={4} fill={s.color} />
        )),
      )}
    </Svg>
  );
}
