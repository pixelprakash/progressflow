import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { theme } from '../theme';

/** Charts for the student and class views. All on the 1–4 performance scale. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BAND = ['#FDECEA', '#FFF4E0', '#E6F4E7', '#DCEBFA']; // levels 1–4, light to strong
const INK = theme.color.text;
const MUTED = theme.color.textMuted;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ---- trend ------------------------------------------------------------------

export interface TrendSeries {
  key: string;
  color: string;
  /** The heavy line (overall). */
  heavy?: boolean;
  points: { t: number; v: number }[];
}

/**
 * Marks over time. Horizontal bands are the four levels, so a line sitting in
 * the pale-green band reads as "Proficient" without needing the legend.
 */
export function TrendChart({
  series,
  width,
  height = 220,
  bandLabels,
}: {
  series: TrendSeries[];
  width: number;
  height?: number;
  /** Level names for the right-hand axis, 1–4. */
  bandLabels?: string[];
}) {
  const padL = 12,
    padR = bandLabels ? 74 : 16,
    padT = 14,
    padB = 28;
  const all = series.flatMap((s) => s.points.map((p) => p.t));
  if (!all.length || width < 80) return null;
  const t0 = Math.min(...all);
  const t1 = Math.max(...all);
  const x = (t: number) =>
    t1 === t0
      ? padL + (width - padL - padR) / 2
      : padL + ((t - t0) / (t1 - t0)) * (width - padL - padR);
  const y = (v: number) => padT + (1 - (v - 0.5) / 4) * (height - padT - padB);
  const dates = [...new Set(all)].sort((a, b) => a - b);
  // Keep the date labels from overlapping on a narrow screen.
  const step = Math.ceil(dates.length / Math.max(1, Math.floor((width - padL - padR) / 52)));
  const heavy = series.filter((s) => s.heavy);
  const light = series.filter((s) => !s.heavy);

  return (
    <Svg width={width} height={height}>
      {[1, 2, 3, 4].map((lv) => (
        <G key={lv}>
          <Rect
            x={padL}
            y={y(lv + 0.5)}
            width={width - padL - padR}
            height={y(lv - 0.5) - y(lv + 0.5)}
            fill={BAND[lv - 1]}
          />
          <SvgText x={width - padR + 8} y={y(lv) + 4} fontSize={11} fill={MUTED}>
            {bandLabels ? clip(bandLabels[lv - 1] ?? String(lv), 11) : String(lv)}
          </SvgText>
        </G>
      ))}
      {dates.map((t, i) =>
        i % step === 0 || i === dates.length - 1 ? (
          <SvgText key={t} x={x(t)} y={height - 8} fontSize={11} fill={MUTED} textAnchor="middle">
            {`${new Date(t).getDate()} ${MONTHS[new Date(t).getMonth()]}`}
          </SvgText>
        ) : null,
      )}
      {[...light, ...heavy].map((s) => (
        <G key={s.key}>
          {s.points.length > 1 && (
            <Polyline
              points={s.points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={s.heavy ? 4 : 2}
              strokeOpacity={s.heavy ? 1 : 0.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {s.points.map((p) => (
            <Circle
              key={p.t}
              cx={x(p.t)}
              cy={y(p.v)}
              r={s.heavy ? 5.5 : 3}
              fill={s.heavy ? '#fff' : s.color}
              stroke={s.color}
              strokeWidth={s.heavy ? 3 : 0}
            />
          ))}
        </G>
      ))}
      {heavy.flatMap((s) =>
        s.points.map((p, i) =>
          i === s.points.length - 1 || i === 0 ? (
            <SvgText
              key={`v${p.t}`}
              x={x(p.t)}
              y={y(p.v) - 11}
              fontSize={12}
              fontWeight="700"
              fill={INK}
              textAnchor="middle"
            >
              {p.v.toFixed(1)}
            </SvgText>
          ) : null,
        ),
      )}
    </Svg>
  );
}

// ---- compare ----------------------------------------------------------------

export interface CompareRow {
  key: string;
  label: string;
  color: string;
  student: number | null;
  klass: number | null;
}

/** Student bar against a class-average marker, one row per criterion. */
export function CompareBars({
  rows,
  width,
  studentLabel,
  classLabel,
}: {
  rows: CompareRow[];
  width: number;
  studentLabel: string;
  classLabel: string;
}) {
  const rowH = 46;
  const trackX = 0;
  const trackW = width - 44;
  const px = (v: number) => trackX + ((v - 0) / 4) * trackW;
  const height = rows.length * rowH + 30;
  return (
    <View>
      <Svg width={width} height={height}>
        {[1, 2, 3, 4].map((v) => (
          <G key={v}>
            <Line
              x1={px(v)}
              x2={px(v)}
              y1={0}
              y2={rows.length * rowH}
              stroke={theme.color.border}
              strokeDasharray="3 4"
            />
            <SvgText
              x={px(v)}
              y={rows.length * rowH + 16}
              fontSize={11}
              fill={MUTED}
              textAnchor="middle"
            >
              {v}
            </SvgText>
          </G>
        ))}
        {rows.map((r, i) => {
          const top = i * rowH;
          return (
            <G key={r.key}>
              <SvgText x={0} y={top + 14} fontSize={13} fontWeight="600" fill={INK}>
                {clip(r.label, 26)}
              </SvgText>
              <Rect
                x={trackX}
                y={top + 22}
                width={trackW}
                height={12}
                rx={6}
                fill={theme.color.surface}
              />
              {r.student !== null && (
                <Rect
                  x={trackX}
                  y={top + 22}
                  width={Math.max(8, px(r.student))}
                  height={12}
                  rx={6}
                  fill={r.color}
                />
              )}
              {r.klass !== null && (
                <G>
                  <Line
                    x1={px(r.klass)}
                    x2={px(r.klass)}
                    y1={top + 17}
                    y2={top + 39}
                    stroke={INK}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                </G>
              )}
              <SvgText
                x={width}
                y={top + 33}
                fontSize={13}
                fontWeight="700"
                fill={INK}
                textAnchor="end"
              >
                {r.student === null ? '–' : r.student.toFixed(1)}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: theme.color.primary }]} />
          <Text style={s.legendText}>{studentLabel}</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.swatch, { width: 4, height: 16, backgroundColor: INK }]} />
          <Text style={s.legendText}>{classLabel}</Text>
        </View>
      </View>
    </View>
  );
}

// ---- radar ------------------------------------------------------------------

export interface RadarAxis {
  key: string;
  label: string;
  value: number | null;
  /** Second shape, e.g. the latest assessment against the overall average. */
  value2?: number | null;
}

/** Spider chart of marks per criterion: the shape of the student's whole practice. */
export function Radar({
  axes,
  size,
  color = theme.color.primary,
}: {
  axes: RadarAxis[];
  size: number;
  color?: string;
}) {
  const n = axes.length;
  if (n < 3) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 46;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) =>
    [cx + Math.cos(ang(i)) * R * (v / 4), cy + Math.sin(ang(i)) * R * (v / 4)] as const;
  const shape = (pick: (a: RadarAxis) => number | null | undefined) =>
    axes.map((a, i) => pt(i, Math.max(0, pick(a) ?? 0)).join(',')).join(' ');
  return (
    <Svg width={size} height={size}>
      {[1, 2, 3, 4].map((lv) => (
        <Polygon
          key={lv}
          points={axes.map((_, i) => pt(i, lv).join(',')).join(' ')}
          fill={lv === 4 ? '#F7F9FD' : 'none'}
          stroke={theme.color.border}
          strokeWidth={1}
        />
      ))}
      {axes.map((a, i) => (
        <Line
          key={a.key}
          x1={cx}
          y1={cy}
          x2={pt(i, 4)[0]}
          y2={pt(i, 4)[1]}
          stroke={theme.color.border}
        />
      ))}
      <Polygon
        points={shape((a) => a.value)}
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {axes.some((a) => a.value2 !== undefined) && (
        <Polygon
          points={shape((a) => a.value2)}
          fill="none"
          stroke={INK}
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinejoin="round"
        />
      )}
      {axes.map((a, i) =>
        a.value === null ? null : (
          <Circle
            key={`d${a.key}`}
            cx={pt(i, a.value)[0]}
            cy={pt(i, a.value)[1]}
            r={4.5}
            fill={color}
          />
        ),
      )}
      {axes.map((a, i) => {
        const [lx, ly] = [cx + Math.cos(ang(i)) * (R + 20), cy + Math.sin(ang(i)) * (R + 20)];
        const anchor =
          Math.abs(Math.cos(ang(i))) < 0.2 ? 'middle' : Math.cos(ang(i)) > 0 ? 'start' : 'end';
        return (
          <SvgText
            key={`t${a.key}`}
            x={lx}
            y={ly + 4}
            fontSize={12}
            fontWeight="600"
            fill={INK}
            textAnchor={anchor}
          >
            {clip(a.label, 14)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ---- ring -------------------------------------------------------------------

/** A single number as a dial: the overall mark out of 4. */
export function Ring({
  value,
  size = 120,
  caption,
  color = theme.color.primary,
}: {
  value: number | null;
  size?: number;
  caption: string;
  color?: string;
}) {
  const r = size / 2 - 10;
  const c = size / 2;
  const frac = value === null ? 0 : Math.min(1, Math.max(0, value / 4));
  const arc = (f: number) => {
    const a = -Math.PI / 2 + f * 2 * Math.PI * 0.999;
    const [x, y] = [c + r * Math.cos(a), c + r * Math.sin(a)];
    return `M ${c} ${c - r} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}`;
  };
  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} fill="none" stroke={theme.color.surface} strokeWidth={12} />
        {frac > 0 && (
          <Path d={arc(frac)} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
        )}
        <SvgText x={c} y={c + 8} fontSize={26} fontWeight="800" fill={INK} textAnchor="middle">
          {value === null ? '–' : value.toFixed(1)}
        </SvgText>
      </Svg>
      <Text style={s.legendText}>{caption}</Text>
    </View>
  );
}

// ---- heatmap ----------------------------------------------------------------

const lerp = (a: number, b: number, f: number) => Math.round(a + (b - a) * f);
export function heatColor(v: number): string {
  const f = Math.min(1, Math.max(0, (v - 1) / 3));
  // pale blue → strong blue
  return `rgb(${lerp(230, 46, f)},${lerp(237, 90, f)},${lerp(249, 172, f)})`;
}

/** Criterion × assessment type grid; the darker the cell, the higher the mean mark. */
export function Heatmap({
  rows,
  cols,
  values,
}: {
  rows: { key: string; label: string; color: string }[];
  cols: { key: string; label: string }[];
  values: Record<string, Record<string, number | null>>;
}) {
  return (
    <View style={{ gap: 4 }}>
      <View style={s.hmRow}>
        <View style={s.hmLabel} />
        {cols.map((c) => (
          <Text key={c.key} style={s.hmHead} numberOfLines={2}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.key} style={s.hmRow}>
          <View style={[s.hmLabel, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <View style={[s.dot, { backgroundColor: r.color }]} />
            <Text style={s.hmLabelText} numberOfLines={2}>
              {r.label}
            </Text>
          </View>
          {cols.map((c) => {
            const v = values[r.key]?.[c.key] ?? null;
            return (
              <View
                key={c.key}
                style={[
                  s.hmCell,
                  { backgroundColor: v === null ? theme.color.surface : heatColor(v) },
                ]}
              >
                <Text style={[s.hmValue, { color: v !== null && v > 2.8 ? '#fff' : INK }]}>
                  {v === null ? '–' : v.toFixed(1)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 16, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 16, height: 10, borderRadius: 3 },
  legendText: { fontSize: 13, color: MUTED },
  hmRow: { flexDirection: 'row', gap: 4, alignItems: 'stretch' },
  hmLabel: { width: 96, justifyContent: 'center' },
  hmLabelText: { flex: 1, fontSize: 13, fontWeight: '600', color: INK },
  hmHead: { flex: 1, fontSize: 12, fontWeight: '700', color: MUTED, textAlign: 'center' },
  hmCell: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hmValue: { fontSize: 14, fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
