import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_NAMES } from '@progressflow/shared';
import type { Language } from '@progressflow/shared';
import { classLabel, isSaved, sortClasses } from '../domain';
import type { ClassRoom } from '../domain';
import { useAuth } from '../auth';
import { useLang } from '../lang';
import { useStore } from '../store';
import { theme } from '../theme';
import { Btn, Chip, Header, Icon, IconBtn, Sheet } from '../components/ui';
import { WebAccount } from '../components/WebAccount';
import { ClassSheet } from '../components/ClassSheet';
import { OtpStep } from '../components/OtpStep';

/** The teacher's classes, grouped by grade, one card per section. */
export function HomeScreen({
  onOpenClass,
  onRubric,
}: {
  onOpenClass: (id: string) => void;
  onRubric: () => void;
}) {
  const { data, loadSample } = useStore();
  const { current, logout, markVerified } = useAuth();
  const { t, lang, setLang } = useLang();
  const [profile, setProfile] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClassRoom | undefined>();

  const classes = sortClasses(data.classes);
  const grades = [...new Set(classes.map((c) => c.grade))];

  const stats = (classId: string) => {
    const ids = new Set(data.students.filter((st) => st.classId === classId).map((st) => st.id));
    const waiting = data.submissions.filter(
      (sub) => ids.has(sub.studentId) && sub.pages.length > 0 && !isSaved(sub),
    ).length;
    return { students: ids.size, waiting };
  };

  return (
    <View style={s.root}>
      <Header
        title="ProgressFlow"
        subtitle={current ? `${current.name} · ${current.school}` : t('m.home.classes')}
        right={
          <View style={{ flexDirection: 'row' }}>
            <IconBtn icon="format-list-checks" label={t('m.home.rubric')} onPress={onRubric} />
            <IconBtn
              icon="account-circle-outline"
              label={t('m.home.account')}
              onPress={() => setProfile(true)}
            />
          </View>
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
                      onLongPress={() => setEditing(c)}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.class', { label: classLabel(c) })}
                    >
                      <Pressable
                        style={s.edit}
                        hitSlop={8}
                        onPress={() => setEditing(c)}
                        accessibilityRole="button"
                        accessibilityLabel={t('m.home.editClass', { label: classLabel(c) })}
                      >
                        <Icon name="pencil-outline" size={20} color={theme.color.textMuted} />
                      </Pressable>
                      <Text style={s.label}>{classLabel(c)}</Text>
                      <Text style={s.meta} numberOfLines={1}>
                        {c.assignment}
                      </Text>
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
            {current.phoneVerified ? (
              <Text style={[s.meta, { color: theme.color.success, fontWeight: '700' }]}>
                ✓ {t('m.otp.verified')}
              </Text>
            ) : (
              <Btn
                label={t('m.otp.verifyNow')}
                icon="cellphone-check"
                kind="outline"
                onPress={() => {
                  setProfile(false);
                  setVerifying(true);
                }}
              />
            )}
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

      <Sheet visible={verifying} onClose={() => setVerifying(false)} title={t('m.otp.title')}>
        {current && verifying && (
          <OtpStep
            phone={current.phone}
            onVerified={() => {
              void markVerified(current.id);
              setVerifying(false);
            }}
            onBack={() => setVerifying(false)}
            backLabel={t('common.cancel')}
          />
        )}
      </Sheet>
      <ClassSheet visible={adding} onClose={() => setAdding(false)} />
      <ClassSheet visible={!!editing} editing={editing} onClose={() => setEditing(undefined)} />
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
  edit: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: theme.color.warning },
});
