import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { levelLabel } from '@progressflow/shared';
import type { CriterionGuide, PerformanceLevel } from '@progressflow/shared';
import { useRubric } from '../hooks';
import { useLang } from '../lang';
import { newId, useStore } from '../store';
import { theme } from '../theme';
import { Btn, Header, Icon, Sheet } from '../components/ui';

const ICONS = [
  'grid',
  'palette-outline',
  'brush',
  'lightbulb-on-outline',
  'shape-outline',
  'format-color-fill',
  'pencil-ruler',
  'image-filter-center-focus',
  'cube-outline',
  'layers-outline',
  'star-outline',
  'heart-outline',
  'puzzle-outline',
  'book-open-variant',
  'hand-back-right-outline',
  'clock-outline',
  'target',
  'flower-outline',
];
const COLORS = [
  '#2E5AAC',
  '#C2410C',
  '#2E7D32',
  '#7B3FA0',
  '#B91C1C',
  '#0E7490',
  '#A16207',
  '#BE185D',
];
const LEVELS: PerformanceLevel[] = [1, 2, 3, 4];
const MAX = 8;

const blank = (): CriterionGuide => ({
  key: `c_${newId().slice(0, 8).replace(/-/g, '')}`,
  name: '',
  icon: 'star-outline',
  color: COLORS[5]!,
  tagline: '',
  lookFor: [],
  askStudent: '',
  levels: { 1: '', 2: '', 3: '', 4: '' },
});

/** The teacher's rubric: add, rename, reorder and remove criteria, and write what each level looks like. */
export function RubricScreen({ onBack }: { onBack: () => void }) {
  const { data, setRubric } = useStore();
  const { t, lang } = useLang();
  const rubric = useRubric();
  const [editing, setEditing] = useState<CriterionGuide | null>(null);
  const [isNew, setIsNew] = useState(false);

  const customised = !!data.rubric;
  const used = (key: string) => data.submissions.filter((x) => x.scores[key] !== undefined).length;

  function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= rubric.length) return;
    const next = [...rubric];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setRubric(next);
  }

  function remove(g: CriterionGuide) {
    if (rubric.length <= 1) return Alert.alert(t('rb.lastTitle'), t('rb.lastBody'));
    const n = used(g.key);
    Alert.alert(
      t('rb.removeTitle', { name: g.name }),
      n ? t('rb.removeBodyUsed', { n }) : t('rb.removeBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('rb.remove'),
          style: 'destructive',
          onPress: () => setRubric(rubric.filter((x) => x.key !== g.key)),
        },
      ],
    );
  }

  function save() {
    if (!editing) return;
    const g: CriterionGuide = {
      ...editing,
      name: editing.name.trim(),
      tagline: editing.tagline.trim(),
      askStudent: editing.askStudent.trim(),
      levels: Object.fromEntries(LEVELS.map((l) => [l, editing.levels[l].trim()])) as Record<
        PerformanceLevel,
        string
      >,
    };
    if (!g.name) return Alert.alert(t('rb.needName'));
    if (rubric.some((x) => x.key !== g.key && x.name.toLowerCase() === g.name.toLowerCase()))
      return Alert.alert(t('rb.dupName', { name: g.name }));
    setRubric(isNew ? [...rubric, g] : rubric.map((x) => (x.key === g.key ? g : x)));
    setEditing(null);
  }

  const patch = (p: Partial<CriterionGuide>) => setEditing((e) => (e ? { ...e, ...p } : e));

  return (
    <View style={s.root}>
      <Header title={t('rb.title')} subtitle={t('rb.sub', { n: rubric.length })} onBack={onBack} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.meta}>{t('rb.intro')}</Text>
        {rubric.map((g, i) => (
          <View key={g.key} style={s.card}>
            <View style={[s.badge, { backgroundColor: g.color }]}>
              <Icon name={g.icon} color="#fff" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{g.name}</Text>
              <Text style={s.meta} numberOfLines={2}>
                {g.tagline || t('rb.noTagline')}
              </Text>
            </View>
            <View style={s.actions}>
              <View style={s.pair}>
                <Pressable
                  onPress={() => move(i, -1)}
                  disabled={i === 0}
                  hitSlop={6}
                  style={[s.sq, i === 0 && s.off]}
                  accessibilityLabel={t('kinds.up')}
                >
                  <Icon name="arrow-up" />
                </Pressable>
                <Pressable
                  onPress={() => move(i, 1)}
                  disabled={i === rubric.length - 1}
                  hitSlop={6}
                  style={[s.sq, i === rubric.length - 1 && s.off]}
                  accessibilityLabel={t('kinds.down')}
                >
                  <Icon name="arrow-down" />
                </Pressable>
              </View>
              <View style={s.pair}>
                <Pressable
                  onPress={() => {
                    setIsNew(false);
                    setEditing(g);
                  }}
                  hitSlop={6}
                  style={s.sq}
                  accessibilityLabel={t('rb.edit')}
                >
                  <Icon name="pencil-outline" color={theme.color.primary} />
                </Pressable>
                <Pressable
                  onPress={() => remove(g)}
                  hitSlop={6}
                  style={s.sq}
                  accessibilityLabel={t('rb.remove')}
                >
                  <Icon name="trash-can-outline" color={theme.color.danger} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}
        <Btn
          label={t('rb.add')}
          icon="plus"
          kind="outline"
          disabled={rubric.length >= MAX}
          onPress={() => {
            setIsNew(true);
            setEditing(blank());
          }}
        />
        {rubric.length >= MAX && <Text style={s.meta}>{t('rb.max', { n: MAX })}</Text>}
        {customised && (
          <Btn
            label={t('rb.reset')}
            icon="restore"
            kind="ghost"
            onPress={() =>
              Alert.alert(t('rb.resetTitle'), t('rb.resetBody'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('rb.reset'), style: 'destructive', onPress: () => setRubric(null) },
              ])
            }
          />
        )}
      </ScrollView>

      <Sheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? t('rb.addTitle') : t('rb.editTitle')}
      >
        {editing && (
          <>
            <Text style={s.label}>{t('rb.name')}</Text>
            <TextInput
              style={s.input}
              value={editing.name}
              onChangeText={(name) => patch({ name })}
              placeholder={t('rb.namePh')}
              placeholderTextColor={theme.color.textMuted}
              maxLength={40}
            />
            <Text style={s.label}>{t('rb.tagline')}</Text>
            <TextInput
              style={s.input}
              value={editing.tagline}
              onChangeText={(tagline) => patch({ tagline })}
              placeholder={t('rb.taglinePh')}
              placeholderTextColor={theme.color.textMuted}
              maxLength={80}
            />

            <Text style={s.label}>{t('rb.icon')}</Text>
            <View style={s.grid}>
              {ICONS.map((ic) => (
                <Pressable
                  key={ic}
                  onPress={() => patch({ icon: ic })}
                  style={[
                    s.pick,
                    editing.icon === ic && {
                      borderColor: editing.color,
                      backgroundColor: theme.color.surface,
                    },
                  ]}
                  accessibilityLabel={ic}
                  accessibilityState={{ selected: editing.icon === ic }}
                >
                  <Icon
                    name={ic}
                    color={editing.icon === ic ? editing.color : theme.color.textMuted}
                  />
                </Pressable>
              ))}
            </View>
            <Text style={s.label}>{t('rb.colour')}</Text>
            <View style={s.grid}>
              {COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => patch({ color: c })}
                  style={[s.swatch, { backgroundColor: c }, editing.color === c && s.swatchOn]}
                  accessibilityLabel={c}
                  accessibilityState={{ selected: editing.color === c }}
                />
              ))}
            </View>

            <Text style={s.label}>{t('rb.levels')}</Text>
            {LEVELS.map((l) => (
              <View key={l} style={{ gap: 4 }}>
                <Text style={s.levelHead}>
                  {l} · {levelLabel(lang, l)}
                </Text>
                <TextInput
                  style={[s.input, { minHeight: 72 }]}
                  multiline
                  textAlignVertical="top"
                  maxLength={400}
                  value={editing.levels[l]}
                  onChangeText={(x) => patch({ levels: { ...editing.levels, [l]: x } })}
                  placeholder={t('rb.levelPh')}
                  placeholderTextColor={theme.color.textMuted}
                />
              </View>
            ))}
            <Text style={s.label}>{t('rb.ask')}</Text>
            <TextInput
              style={s.input}
              value={editing.askStudent}
              onChangeText={(askStudent) => patch({ askStudent })}
              placeholder={t('rb.askPh')}
              placeholderTextColor={theme.color.textMuted}
            />
            <Btn label={t('rb.save')} icon="check" onPress={save} />
          </>
        )}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl * 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: theme.space.sm,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: theme.font.body, fontWeight: '700', color: theme.color.text },
  meta: { fontSize: 13, color: theme.color.textMuted },
  actions: { alignItems: 'flex-end' },
  pair: { flexDirection: 'row' },
  sq: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.25 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.color.textMuted,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  levelHead: { fontSize: 14, fontWeight: '700', color: theme.color.text },
  input: {
    minHeight: 52,
    backgroundColor: '#fff',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: theme.font.body,
    color: theme.color.text,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pick: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#fff' },
  swatchOn: { borderColor: theme.color.text },
});
