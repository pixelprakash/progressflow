import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KIND_META, classLabel, compositeScore, initials, shortDate } from '../domain';
import { GUIDES } from '../rubricContent';
import { newId, useStore } from '../store';
import { theme } from '../theme';
import { Btn, Header, Icon, Sheet } from '../components/ui';

export function ClassScreen({
  classId,
  onBack,
  onScan,
  onGallery,
  onOpenSubmission,
  onOpenStudent,
}: {
  classId: string;
  onBack: () => void;
  onScan: () => void;
  onGallery: () => void;
  onOpenSubmission: (id: string) => void;
  onOpenStudent: (id: string) => void;
}) {
  const { data, addStudent } = useStore();
  const klass = data.classes.find((c) => c.id === classId);
  const roster = data.students.filter((st) => st.classId === classId);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRoll, setNewRoll] = useState('');
  const nameOf = (id: string) => data.students.find((s) => s.id === id)?.name ?? '—';
  const rosterIds = new Set(roster.map((st) => st.id));
  const toScore = data.submissions
    .filter((s) => rosterIds.has(s.studentId))
    .filter((s) => s.pages.length > 0 && Object.keys(s.scores).length < GUIDES.length)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <View style={s.root}>
      <Header
        title={klass ? `Class ${classLabel(klass)}` : 'Class'}
        subtitle={klass?.assignment}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={s.content}>
        {data.sample ? (
          <View style={s.demo}>
            <Icon name="information-outline" size={18} color={theme.color.warning} />
            <Text style={s.demoText}>
              Sample class with made-up students. Past scores exist for Class 7-B only.
            </Text>
          </View>
        ) : null}

        <Btn label="Scan artwork" icon="scanner" onPress={onScan} />
        <Btn
          label="Import from gallery"
          icon="image-multiple-outline"
          kind="outline"
          onPress={onGallery}
        />

        {toScore.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Waiting for your evaluation</Text>
            {toScore.map((sub) => (
              <Pressable
                key={sub.id}
                style={s.row}
                onPress={() => onOpenSubmission(sub.id)}
                accessibilityRole="button"
              >
                <View style={[s.avatar, { backgroundColor: theme.color.warningBg }]}>
                  <Icon name={KIND_META[sub.kind].icon} size={20} color={theme.color.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{nameOf(sub.studentId)}</Text>
                  <Text style={s.meta}>
                    {KIND_META[sub.kind].label} · {sub.pages.length}{' '}
                    {sub.pages.length === 1 ? 'image' : 'images'} · {shortDate(sub.createdAt)}
                  </Text>
                </View>
                <Icon name="chevron-right" color={theme.color.textMuted} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>Students</Text>
          {roster.map((st) => {
            const subs = data.submissions
              .filter((x) => x.studentId === st.id)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            const latest = subs[subs.length - 1];
            const avg = latest ? compositeScore(latest.scores) : null;
            return (
              <Pressable
                key={st.id}
                style={s.row}
                onPress={() => onOpenStudent(st.id)}
                accessibilityRole="button"
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials(st.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{st.name}</Text>
                  <Text style={s.meta}>
                    Roll {st.rollNo} ·{' '}
                    {subs.length === 0
                      ? 'No work yet'
                      : `${subs.length} ${subs.length === 1 ? 'submission' : 'submissions'}`}
                  </Text>
                </View>
                {avg !== null && <Text style={s.avg}>{avg.toFixed(1)}</Text>}
                <Icon name="chevron-right" color={theme.color.textMuted} />
              </Pressable>
            );
          })}
          <Btn
            label="Add student"
            icon="account-plus-outline"
            kind="ghost"
            onPress={() => {
              setNewName('');
              setNewRoll(
                String(Math.max(0, ...roster.map((x) => parseInt(x.rollNo, 10) || 0)) + 1),
              );
              setAdding(true);
            }}
          />
        </View>
      </ScrollView>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a student">
        <TextInput
          style={s.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="Name, e.g. Aarav K."
          placeholderTextColor={theme.color.textMuted}
        />
        <TextInput
          style={s.input}
          value={newRoll}
          onChangeText={setNewRoll}
          placeholder="Roll number"
          placeholderTextColor={theme.color.textMuted}
          keyboardType="number-pad"
        />
        <Btn
          label="Add student"
          icon="check"
          disabled={!newName.trim() || !newRoll.trim()}
          onPress={() => {
            const roll = newRoll.trim().replace(/^0+(?=\d)/, '');
            if (roster.some((x) => x.rollNo === roll)) {
              Alert.alert(
                'Roll number in use',
                `Another student in this class already has roll ${roll}.`,
              );
              return;
            }
            addStudent({ id: newId(), classId, name: newName.trim(), rollNo: roll });
            setAdding(false);
          }}
        />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl * 2 },
  demo: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: theme.color.warningBg,
    borderRadius: theme.radius.sm,
    padding: 10,
  },
  demoText: { flex: 1, fontSize: 13, color: theme.color.text },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: 4,
  },
  cardTitle: {
    fontSize: theme.font.title - 4,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 4,
  },
  input: {
    minHeight: 52,
    backgroundColor: '#fff',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: 12,
    fontSize: theme.font.body,
    color: theme.color.text,
  },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: theme.color.primary },
  name: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  meta: { fontSize: 13, color: theme.color.textMuted },
  avg: { fontSize: 18, fontWeight: '700', color: theme.color.primary },
});
