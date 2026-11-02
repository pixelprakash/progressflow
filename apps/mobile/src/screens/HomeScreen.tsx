import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { classLabel, sortClasses } from '../domain';
import { GUIDES } from '../rubricContent';
import { useAuth } from '../auth';
import { newId, useStore } from '../store';
import { theme } from '../theme';
import { Btn, Chip, Header, Icon, IconBtn, Sheet } from '../components/ui';
import { WebAccount } from '../components/WebAccount';

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** The teacher's classes, grouped by grade, one card per section. */
export function HomeScreen({ onOpenClass }: { onOpenClass: (id: string) => void }) {
  const { data, addClass, loadSample } = useStore();
  const { current, logout } = useAuth();
  const [profile, setProfile] = useState(false);
  const [adding, setAdding] = useState(false);
  const [grade, setGrade] = useState(6);
  const [section, setSection] = useState('A');

  const classes = sortClasses(data.classes);
  const grades = [...new Set(classes.map((c) => c.grade))];

  const stats = (classId: string) => {
    const ids = new Set(data.students.filter((st) => st.classId === classId).map((st) => st.id));
    const waiting = data.submissions.filter(
      (sub) =>
        ids.has(sub.studentId) &&
        sub.pages.length > 0 &&
        Object.keys(sub.scores).length < GUIDES.length,
    ).length;
    return { students: ids.size, waiting };
  };

  function create() {
    if (data.classes.some((c) => c.grade === grade && c.section === section)) {
      Alert.alert('Already added', `Class ${grade}-${section} is already in your list.`);
      return;
    }
    const first = data.classes[0];
    addClass({
      id: newId(),
      grade,
      section,
      assignment: first?.assignment ?? 'Still life — pencil',
    });
    setAdding(false);
  }

  return (
    <View style={s.root}>
      <Header
        title="ProgressFlow"
        subtitle={current ? `${current.name} · ${current.school}` : 'Your classes'}
        right={
          <IconBtn icon="account-circle-outline" label="Account" onPress={() => setProfile(true)} />
        }
      />
      <ScrollView contentContainerStyle={s.content}>
        {data.sample ? (
          <View style={s.demo}>
            <Icon name="information-outline" size={18} color={theme.color.warning} />
            <Text style={s.demoText}>
              Sample classes with made-up students. Tap a class to scan its artwork.
            </Text>
          </View>
        ) : null}

        {classes.length === 0 && (
          <View style={s.empty}>
            <Icon name="school-outline" size={40} color={theme.color.textMuted} />
            <Text style={s.grade}>No classes yet</Text>
            <Text style={s.meta}>
              Add a class, then add its students. Or look around with sample classes first.
            </Text>
            <Btn
              label="Try sample classes"
              icon="flask-outline"
              kind="ghost"
              onPress={loadSample}
            />
          </View>
        )}

        {grades.map((g) => (
          <View key={g} style={{ gap: theme.space.sm }}>
            <Text style={s.grade}>Class {g}</Text>
            <View style={s.sections}>
              {classes
                .filter((c) => c.grade === g)
                .map((c) => {
                  const st = stats(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      style={s.card}
                      onPress={() => onOpenClass(c.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Class ${classLabel(c)}`}
                    >
                      <Text style={s.label}>{classLabel(c)}</Text>
                      <Text style={s.meta}>
                        {st.students} {st.students === 1 ? 'student' : 'students'}
                      </Text>
                      {st.waiting > 0 ? (
                        <View style={s.badge}>
                          <Text style={s.badgeText}>{st.waiting} to evaluate</Text>
                        </View>
                      ) : (
                        <Text style={s.meta}> </Text>
                      )}
                    </Pressable>
                  );
                })}
            </View>
          </View>
        ))}

        <Btn label="Add class" icon="plus" kind="outline" onPress={() => setAdding(true)} />
      </ScrollView>

      <Sheet visible={profile} onClose={() => setProfile(false)} title="Your account">
        {current && (
          <>
            <Text style={s.grade}>{current.name}</Text>
            <Text style={s.meta}>{current.school}</Text>
            <Text style={s.meta}>{current.phone}</Text>
            <Text style={s.meta}>
              Data stays on this phone. The app locks itself after 5 minutes away.
            </Text>
          </>
        )}
        <WebAccount />
        <Btn
          label="Log out"
          icon="logout"
          kind="outline"
          onPress={() => {
            setProfile(false);
            logout();
          }}
        />
      </Sheet>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a class">
        <Text style={s.meta}>Grade</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {GRADES.map((g) => (
            <Chip key={g} label={String(g)} selected={grade === g} onPress={() => setGrade(g)} />
          ))}
        </ScrollView>
        <Text style={s.meta}>Section</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {SECTIONS.map((x) => (
            <Chip key={x} label={x} selected={section === x} onPress={() => setSection(x)} />
          ))}
        </ScrollView>
        <Btn label={`Add Class ${grade}-${section}`} icon="check" onPress={create} />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.md, gap: theme.space.lg, paddingBottom: theme.space.xl * 2 },
  demo: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: theme.color.warningBg,
    borderRadius: theme.radius.sm,
    padding: 10,
  },
  demoText: { flex: 1, fontSize: 13, color: theme.color.text },
  empty: {
    alignItems: 'center',
    gap: 8,
    padding: theme.space.lg,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
  },
  grade: { fontSize: 20, fontWeight: '700', color: theme.color.text },
  sections: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  card: {
    width: '48%',
    minHeight: 112,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
  },
  label: { fontSize: 30, fontWeight: '800', color: theme.color.primary },
  meta: { fontSize: 13, color: theme.color.textMuted },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.warningBg,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: theme.color.warning },
});
