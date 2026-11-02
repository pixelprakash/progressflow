import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_NAMES } from '@progressflow/shared';
import type { Language } from '@progressflow/shared';
import { classLabel, sortClasses } from '../domain';
import { useAuth } from '../auth';
import { useLang } from '../lang';
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
  const { t, lang, setLang, guides } = useLang();
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
        Object.keys(sub.scores).length < guides.length,
    ).length;
    return { students: ids.size, waiting };
  };

  function create() {
    if (data.classes.some((c) => c.grade === grade && c.section === section)) {
      Alert.alert(t('m.home.dupTitle'), t('m.home.dupBody', { label: `${grade}-${section}` }));
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
        subtitle={current ? `${current.name} · ${current.school}` : t('m.home.classes')}
        right={
          <IconBtn
            icon="account-circle-outline"
            label={t('m.home.account')}
            onPress={() => setProfile(true)}
          />
        }
      />
      <ScrollView contentContainerStyle={s.content}>
        {data.sample ? (
          <View style={s.demo}>
            <Icon name="information-outline" size={18} color={theme.color.warning} />
            <Text style={s.demoText}>{t('m.home.sampleBanner')}</Text>
          </View>
        ) : null}

        {classes.length === 0 && (
          <View style={s.empty}>
            <Icon name="school-outline" size={40} color={theme.color.textMuted} />
            <Text style={s.grade}>{t('m.home.noClasses')}</Text>
            <Text style={s.meta}>{t('m.home.noClassesBody')}</Text>
            <Btn
              label={t('m.home.sample')}
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
                      accessibilityLabel={t('common.class', { label: classLabel(c) })}
                    >
                      <Text style={s.label}>{classLabel(c)}</Text>
                      <Text style={s.meta}>{t('m.home.students', { n: st.students })}</Text>
                      {st.waiting > 0 ? (
                        <View style={s.badge}>
                          <Text style={s.badgeText}>{t('ov.waiting', { n: st.waiting })}</Text>
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

        <Btn
          label={t('m.home.addClass')}
          icon="plus"
          kind="outline"
          onPress={() => setAdding(true)}
        />
      </ScrollView>

      <Sheet visible={profile} onClose={() => setProfile(false)} title={t('m.home.yourAccount')}>
        {current && (
          <>
            <Text style={s.grade}>{current.name}</Text>
            <Text style={s.meta}>{current.school}</Text>
            <Text style={s.meta}>{current.phone}</Text>
            <Text style={s.meta}>{t('m.home.autoLock')}</Text>
          </>
        )}
        <Text style={s.meta}>{t('m.home.appLang')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(Object.keys(LANGUAGE_NAMES) as Language[]).map((l) => (
            <Chip
              key={l}
              label={LANGUAGE_NAMES[l]}
              selected={lang === l}
              onPress={() => setLang(l)}
            />
          ))}
        </View>
        <WebAccount />
        <Btn
          label={t('m.home.logout')}
          icon="logout"
          kind="outline"
          onPress={() => {
            setProfile(false);
            logout();
          }}
        />
      </Sheet>

      <Sheet visible={adding} onClose={() => setAdding(false)} title={t('m.home.addClassTitle')}>
        <Text style={s.meta}>{t('m.home.grade')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {GRADES.map((g) => (
            <Chip key={g} label={String(g)} selected={grade === g} onPress={() => setGrade(g)} />
          ))}
        </ScrollView>
        <Text style={s.meta}>{t('m.home.section')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {SECTIONS.map((x) => (
            <Chip key={x} label={x} selected={section === x} onPress={() => setSection(x)} />
          ))}
        </ScrollView>
        <Btn
          label={t('m.home.addNamed', { label: `${grade}-${section}` })}
          icon="check"
          onPress={create}
        />
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
