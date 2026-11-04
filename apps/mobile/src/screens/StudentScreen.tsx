import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { levelLabel } from '@progressflow/shared';
import type { TKey } from '@progressflow/shared';
import { analyse, byDate, classStats, compare, levelOf, studentStats } from '../analytics';
import { compositeScore, isSaved } from '../domain';
import { useKinds, useRubric } from '../hooks';
import { useLang } from '../lang';
import { useStore } from '../store';
import { theme } from '../theme';
import { KindBar } from '../components/KindBar';
import { CompareBars, Heatmap, Radar, Ring, TrendChart } from '../components/charts';
import { ExportSheet, useReportEnv } from '../components/ExportSheet';
import { Header, Icon, IconBtn } from '../components/ui';
import { studentReport } from '../reports/model';

type Tab = 'progress' | 'compare' | 'holistic' | 'analysis';
const TABS: { id: Tab; icon: string; label: TKey; hint: TKey }[] = [
  { id: 'progress', icon: 'chart-line', label: 'm.stu.tab.progress', hint: 'm.stu.hint.progress' },
  {
    id: 'compare',
    icon: 'compare-horizontal',
    label: 'm.stu.tab.compare',
    hint: 'm.stu.hint.compare',
  },
  { id: 'holistic', icon: 'radar', label: 'm.stu.tab.holistic', hint: 'm.stu.hint.holistic' },
  {
    id: 'analysis',
    icon: 'chart-box-outline',
    label: 'm.stu.tab.analysis',
    hint: 'm.stu.hint.analysis',
  },
];

const arrow = (v: number | null) => (v === null ? '' : v > 0.05 ? '▲' : v < -0.05 ? '▼' : '●');
const arrowColor = (v: number | null) =>
  v === null
    ? theme.color.textMuted
    : v > 0.05
      ? theme.color.success
      : v < -0.05
        ? theme.color.danger
        : theme.color.textMuted;
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;

/** One student: four views of their marks, then their portfolio. */
export function StudentScreen({
  studentId,
  onBack,
  onOpen,
}: {
  studentId: string;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const { data } = useStore();
  const { t, lang, shortDate } = useLang();
  const criteria = useRubric();
  const kinds = useKinds();
  const makeEnv = useReportEnv();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('progress');
  const [filter, setFilter] = useState('');
  const [hidden, setHidden] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const student = data.students.find((x) => x.id === studentId);
  const klass = data.classes.find((c) => c.id === student?.classId);

  const keys = useMemo(() => criteria.map((c) => c.key), [criteria]);
  const all = useMemo(
    () => byDate(data.submissions.filter((x) => x.studentId === studentId)),
    [data.submissions, studentId],
  );
  const shown = all.filter((x) => !filter || x.kind === filter);
  const stats = useMemo(() => studentStats(shown, keys), [shown, keys]);
  const cls = useMemo(() => {
    const ids = data.students.filter((x) => x.classId === student?.classId).map((x) => x.id);
    const idSet = new Set(ids);
    return classStats(
      ids,
      data.submissions.filter((x) => idSet.has(x.studentId) && (!filter || x.kind === filter)),
      keys,
    );
  }, [data.students, data.submissions, student?.classId, filter, keys]);
  if (!student) return null;

  const cmp = compare(stats, studentId, cls);
  const an = analyse(shown, keys);
  const chartW = width - theme.space.md * 4;
  const nameOf = (k: string) => criteria.find((c) => c.key === k)?.name ?? k;
  const band = (v: number | null) => (v === null ? '–' : levelLabel(lang, levelOf(v)));
  const bandLabels = [1, 2, 3, 4].map((l) => levelLabel(lang, l));

  const Empty = () => <Text style={s.meta}>{t('m.stu.noScored')}</Text>;

  const progress = (
    <>
      <View style={s.kpis}>
        <Ring value={stats.latest} size={112} caption={t('m.stu.latest')} />
        <View style={s.kpiGrid}>
          <Kpi
            label={t('m.stu.first')}
            value={stats.first === null ? '–' : stats.first.toFixed(1)}
          />
          <Kpi
            label={t('m.stu.change')}
            value={stats.change === null ? '–' : `${arrow(stats.change)} ${signed(stats.change)}`}
            color={arrowColor(stats.change)}
          />
          <Kpi label={t('m.stu.assessed')} value={String(stats.scored.length)} />
          <Kpi label={t('m.stu.level')} value={band(stats.latest)} small />
        </View>
      </View>
      <Text style={s.sub}>{t('m.stu.showLines')}</Text>
      <View style={s.legend}>
        {criteria.map((g) => {
          const off = hidden.includes(g.key);
          return (
            <Pressable
              key={g.key}
              onPress={() => setHidden((h) => (off ? h.filter((x) => x !== g.key) : [...h, g.key]))}
              style={[s.legendItem, off && { opacity: 0.4 }]}
              accessibilityRole="switch"
              accessibilityState={{ checked: !off }}
              accessibilityLabel={g.name}
            >
              <Icon name={g.icon} size={18} color={g.color} />
              <Text style={s.legendText}>{g.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <TrendChart
        width={chartW}
        bandLabels={bandLabels}
        series={[
          ...stats.criteria
            .filter((c) => !hidden.includes(c.key))
            .map((c) => ({
              key: c.key,
              color: criteria.find((g) => g.key === c.key)?.color ?? theme.color.primary,
              points: c.series,
            })),
          { key: 'overall', color: theme.color.text, heavy: true, points: stats.overall },
        ]}
      />
      <Text style={s.sub}>{t('m.stu.each')}</Text>
      {[...stats.scored].reverse().map((sub) => {
        const v = compositeScore(sub.scores, keys) ?? 0;
        return (
          <Pressable
            key={sub.id}
            style={s.eachRow}
            onPress={() => onOpen(sub.id)}
            accessibilityRole="button"
          >
            <Icon name={kinds.icon(sub.kind)} color={theme.color.textMuted} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.eachTitle}>
                {kinds.label(sub.kind)} · {shortDate(sub.createdAt)}
              </Text>
              <View style={s.track}>
                <View style={[s.fill, { width: `${(v / 4) * 100}%` }]} />
              </View>
            </View>
            <Text style={s.eachVal}>{v.toFixed(1)}</Text>
          </Pressable>
        );
      })}
    </>
  );

  const comparison =
    cls.assessed < 2 ? (
      <Text style={s.meta}>{t('m.stu.cmp.need')}</Text>
    ) : (
      <>
        <View style={s.kpiGrid}>
          <Kpi
            label={t('m.stu.cmp.rank')}
            value={cmp.rank === null ? '–' : t('m.stu.cmp.of', { rank: cmp.rank, of: cmp.of })}
          />
          <Kpi
            label={t('m.stu.cmp.diff')}
            value={
              cmp.overallDiff === null
                ? '–'
                : `${arrow(cmp.overallDiff)} ${signed(cmp.overallDiff)}`
            }
            color={arrowColor(cmp.overallDiff)}
          />
        </View>
        {cmp.percentile !== null && (
          <Text style={s.summary}>{t('m.stu.cmp.percentile', { n: cmp.percentile })}</Text>
        )}
        <CompareBars
          width={chartW}
          studentLabel={student.name}
          classLabel={t('m.stu.cmp.class')}
          rows={cmp.rows.map((r) => ({
            key: r.key,
            label: nameOf(r.key),
            color: criteria.find((g) => g.key === r.key)?.color ?? theme.color.primary,
            student: r.student,
            klass: r.klass,
          }))}
        />
        {cmp.rows
          .filter((r) => r.diff !== null && Math.abs(r.diff) >= 0.5)
          .map((r) => (
            <Text key={r.key} style={[s.callout, { borderLeftColor: arrowColor(r.diff) }]}>
              {t(r.diff! > 0 ? 'm.stu.cmp.above' : 'm.stu.cmp.below', {
                name: nameOf(r.key),
                n: Math.abs(r.diff!).toFixed(1),
              })}
            </Text>
          ))}
      </>
    );

  const latestSub = stats.scored[stats.scored.length - 1];
  const holistic = (
    <>
      <View style={{ alignItems: 'center' }}>
        <Radar
          size={Math.min(chartW, 330)}
          axes={stats.criteria.map((c) => ({
            key: c.key,
            label: nameOf(c.key),
            value: c.mean,
            ...(latestSub && stats.scored.length > 1
              ? { value2: latestSub.scores[c.key] ?? null }
              : {}),
          }))}
        />
      </View>
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: theme.color.primary }]} />
          <Text style={s.legendText}>{t('m.stu.hol.avg')}</Text>
        </View>
        {stats.scored.length > 1 && (
          <View style={s.legendItem}>
            <View
              style={[
                s.swatch,
                {
                  backgroundColor: 'transparent',
                  borderWidth: 2,
                  borderColor: theme.color.text,
                  borderStyle: 'dashed',
                },
              ]}
            />
            <Text style={s.legendText}>{t('m.stu.hol.latest')}</Text>
          </View>
        )}
      </View>
      <View style={s.kpiGrid}>
        <Kpi label={t('m.stu.overall')} value={stats.mean === null ? '–' : stats.mean.toFixed(1)} />
        <Kpi label={t('m.stu.level')} value={band(stats.mean)} small />
      </View>
      {stats.criteria.map((c) => {
        const g = criteria.find((x) => x.key === c.key);
        return (
          <View key={c.key} style={s.critRow}>
            <Icon name={g?.icon ?? 'circle-outline'} color={g?.color} />
            <Text style={[s.eachTitle, { flex: 1 }]}>{nameOf(c.key)}</Text>
            <Text style={s.chip}>{band(c.mean)}</Text>
            <Text style={s.eachVal}>{c.mean === null ? '–' : c.mean.toFixed(1)}</Text>
          </View>
        );
      })}
    </>
  );

  const analysis = (
    <>
      <Text style={s.sub}>{t('m.stu.an.heat')}</Text>
      <Heatmap
        rows={criteria.map((g) => ({ key: g.key, label: g.name, color: g.color }))}
        cols={an.kinds.map((k) => ({ key: k, label: kinds.label(k) }))}
        values={an.matrix}
      />
      <View style={s.callouts}>
        {an.strongest && (
          <Callout
            icon="arrow-up-bold-circle-outline"
            color={theme.color.success}
            text={t('rep.strongest', { name: nameOf(an.strongest) })}
          />
        )}
        {an.weakest && (
          <Callout
            icon="target"
            color={theme.color.warning}
            text={t('rep.focus', { name: nameOf(an.weakest) })}
          />
        )}
        {an.mostImproved && (
          <Callout
            icon="trending-up"
            color={theme.color.primary}
            text={t('m.stu.an.improved', { name: nameOf(an.mostImproved) })}
          />
        )}
        {an.spread !== null && (
          <Callout
            icon={an.spread < 0.35 ? 'equal' : 'swap-vertical'}
            color={theme.color.textMuted}
            text={t(an.spread < 0.35 ? 'm.stu.an.steady' : 'm.stu.an.varied')}
          />
        )}
      </View>
      <Text style={s.sub}>{t('m.stu.an.change')}</Text>
      {stats.criteria.map((c) => (
        <View key={c.key} style={s.critRow}>
          <Text style={[s.eachTitle, { flex: 1 }]}>{nameOf(c.key)}</Text>
          <Text style={s.meta}>
            {c.first === null ? '–' : c.first} → {c.last === null ? '–' : c.last}
          </Text>
          <Text style={[s.delta, { color: arrowColor(c.change) }]}>
            {c.change === null ? '' : `${arrow(c.change)} ${signed(c.change)}`}
          </Text>
        </View>
      ))}
    </>
  );

  return (
    <View style={s.root}>
      <Header
        title={student.name}
        subtitle={`${t('common.roll', { n: student.rollNo })} · ${t('m.class.subs', { n: all.length })}`}
        onBack={onBack}
        right={
          <IconBtn
            icon="file-export-outline"
            label={t('m.stu.report')}
            onPress={() => setExporting(true)}
          />
        }
      />
      <ScrollView contentContainerStyle={s.content}>
        <KindBar all selected={filter} onSelect={setFilter} padded={false} />

        <View style={s.tabs}>
          {TABS.map((x) => (
            <Pressable
              key={x.id}
              style={[s.tab, tab === x.id && s.tabOn]}
              onPress={() => setTab(x.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === x.id }}
            >
              <Icon name={x.icon} size={22} color={tab === x.id ? '#fff' : theme.color.primary} />
              <Text style={[s.tabText, tab === x.id && { color: '#fff' }]}>{t(x.label)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.title}>{t(TABS.find((x) => x.id === tab)!.label)}</Text>
          <Text style={s.meta}>{t(TABS.find((x) => x.id === tab)!.hint)}</Text>
          {stats.scored.length === 0 ? (
            <Empty />
          ) : tab === 'progress' ? (
            progress
          ) : tab === 'compare' ? (
            comparison
          ) : tab === 'holistic' ? (
            holistic
          ) : (
            analysis
          )}
        </View>

        <Text style={s.title}>{t('stu.portfolio')}</Text>
        <View style={s.grid}>
          {[...shown].reverse().map((sub) => {
            const avg = compositeScore(sub.scores, keys);
            const p = sub.pages[0];
            return (
              <Pressable
                key={sub.id}
                style={s.tile}
                onPress={() => onOpen(sub.id)}
                accessibilityRole="button"
              >
                {p ? (
                  <Image source={{ uri: p.uri }} style={s.img} resizeMode="cover" />
                ) : (
                  <View style={[s.img, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Icon name={kinds.icon(sub.kind)} size={36} color={theme.color.textMuted} />
                  </View>
                )}
                <View style={{ padding: 8, gap: 2 }}>
                  <Text style={s.tileTitle}>{kinds.label(sub.kind)}</Text>
                  <Text style={s.meta}>
                    {shortDate(sub.createdAt)}
                    {avg !== null ? ` · ${avg.toFixed(1)}` : ` · ${t('common.notScored')}`}
                    {isSaved(sub) ? ' ✓' : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ExportSheet
        visible={exporting}
        onClose={() => setExporting(false)}
        title={t('rep.exportStudent')}
        build={() => studentReport(data, student, klass, makeEnv())}
      />
    </View>
  );
}

function Kpi({
  label,
  value,
  color,
  small,
}: {
  label: string;
  value: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text
        style={[s.kpiValue, small && { fontSize: 16 }, color ? { color } : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function Callout({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <View style={s.calloutRow}>
      <Icon name={icon} size={22} color={color} />
      <Text style={s.calloutText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl * 2 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    width: '48.5%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.color.primary,
    backgroundColor: '#fff',
  },
  tabOn: { backgroundColor: theme.color.primary },
  tabText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.color.primary },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.color.text },
  sub: { fontSize: 14, fontWeight: '700', color: theme.color.text, marginTop: 8 },
  summary: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.primary },
  meta: { fontSize: 13, color: theme.color.textMuted },
  kpis: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md },
  kpiGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: '#fff',
    borderRadius: theme.radius.sm,
    padding: 10,
    gap: 2,
  },
  kpiLabel: { fontSize: 12, color: theme.color.textMuted, fontWeight: '600' },
  kpiValue: { fontSize: 22, fontWeight: '800', color: theme.color.text },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
  },
  legendText: { fontSize: 13, color: theme.color.text, fontWeight: '600' },
  swatch: { width: 18, height: 10, borderRadius: 3 },
  eachRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  eachTitle: { fontSize: 15, fontWeight: '600', color: theme.color.text },
  eachVal: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.color.primary,
    minWidth: 34,
    textAlign: 'right',
  },
  track: { height: 8, borderRadius: 4, backgroundColor: '#fff', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: theme.color.primary },
  critRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  chip: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.primary,
    backgroundColor: theme.color.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  callout: {
    fontSize: 14,
    color: theme.color.text,
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 10,
  },
  callouts: { gap: 8, marginTop: 4 },
  calloutRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  calloutText: { flex: 1, fontSize: 14, color: theme.color.text },
  delta: { fontSize: 14, fontWeight: '800', minWidth: 62, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  tile: {
    width: '48%',
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  img: { width: '100%', height: 130, backgroundColor: theme.color.border },
  tileTitle: { fontSize: 15, fontWeight: '700', color: theme.color.text },
});
