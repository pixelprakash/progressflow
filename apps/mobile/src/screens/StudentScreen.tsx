import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { AssessmentKind } from '@progressflow/shared';
import { KIND_META, compositeScore, shortDate } from '../domain';
import { GUIDES } from '../rubricContent';
import { useStore } from '../store';
import { theme } from '../theme';
import { Chip, Header, Icon } from '../components/ui';
import { GrowthChart } from '../components/GrowthChart';

/** Time-based progress and portfolio for one student. */
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
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<AssessmentKind | 'all'>('all');
  const student = data.students.find((x) => x.id === studentId);
  if (!student) return null;

  const all = data.submissions
    .filter((x) => x.studentId === studentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const shown = all.filter((x) => filter === 'all' || x.kind === filter);
  const scoredSubs = shown.filter((x) => compositeScore(x.scores) !== null);

  const series = GUIDES.map((g) => ({
    key: g.key,
    color: g.color,
    points: scoredSubs.flatMap((x) => {
      const v = x.scores[g.key];
      return v === undefined ? [] : [{ t: new Date(x.createdAt).getTime(), v }];
    }),
  }));
  const first = scoredSubs[0] ? compositeScore(scoredSubs[0].scores) : null;
  const last = scoredSubs.length ? compositeScore(scoredSubs[scoredSubs.length - 1]!.scores) : null;

  return (
    <View style={s.root}>
      <Header
        title={student.name}
        subtitle={`Roll ${student.rollNo} · ${all.length} submissions`}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={s.content}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          {(Object.keys(KIND_META) as AssessmentKind[]).map((k) => (
            <Chip
              key={k}
              label={KIND_META[k].label}
              icon={KIND_META[k].icon}
              selected={filter === k}
              onPress={() => setFilter(k)}
            />
          ))}
        </ScrollView>

        <View style={s.card}>
          <Text style={s.title}>Progress over time</Text>
          {scoredSubs.length === 0 ? (
            <Text style={s.meta}>No scored work yet for this filter.</Text>
          ) : (
            <>
              {first !== null && last !== null && scoredSubs.length > 1 && (
                <Text style={s.summary}>
                  Average {first.toFixed(1)} → {last.toFixed(1)} across {scoredSubs.length}{' '}
                  assessments
                </Text>
              )}
              <GrowthChart series={series} width={width - theme.space.md * 4} />
              <View style={s.legend}>
                {GUIDES.map((g) => (
                  <View key={g.key} style={s.legendItem}>
                    <Icon name={g.icon} size={18} color={g.color} />
                    <Text style={s.meta}>{g.name}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        <Text style={s.title}>Portfolio</Text>
        <View style={s.grid}>
          {[...shown].reverse().map((sub) => {
            const avg = compositeScore(sub.scores);
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
                    <Icon name={KIND_META[sub.kind].icon} size={36} color={theme.color.textMuted} />
                  </View>
                )}
                <View style={{ padding: 8, gap: 2 }}>
                  <Text style={s.tileTitle}>{KIND_META[sub.kind].label}</Text>
                  <Text style={s.meta}>
                    {shortDate(sub.createdAt)}
                    {avg !== null ? ` · ${avg.toFixed(1)}` : ' · not scored'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl * 2 },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.color.text },
  summary: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.primary },
  meta: { fontSize: 13, color: theme.color.textMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', gap: 4, alignItems: 'center' },
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
