import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DEFAULT_TYPES, isBuiltinType } from '../domain';
import { useKinds } from '../hooks';
import { useLang } from '../lang';
import { newId, useStore } from '../store';
import { theme } from '../theme';
import { Btn, Chip, Icon, Sheet } from './ui';

/**
 * The row of assessment types (Assignment, Exam 1, Exam 2, Quarterly…). Slides
 * sideways; the pencil at the end opens the editor to rename, add, remove and reorder.
 */
export function KindBar({
  selected,
  onSelect,
  all,
  padded = true,
}: {
  selected: string;
  onSelect: (id: string) => void;
  /** Adds a leading "All" chip; its id is the empty string. */
  all?: boolean;
  padded?: boolean;
}) {
  const kinds = useKinds();
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.row, padded && { paddingHorizontal: theme.space.md }]}
      >
        {all ? (
          <Chip label={t('common.all')} selected={selected === ''} onPress={() => onSelect('')} />
        ) : null}
        {kinds.types.map((k) => (
          <Chip
            key={k.id}
            label={kinds.label(k.id)}
            icon={kinds.icon(k.id)}
            selected={selected === k.id}
            onPress={() => onSelect(k.id)}
          />
        ))}
        <Chip
          label={t('kinds.edit')}
          icon="pencil-outline"
          color={theme.color.textMuted}
          onPress={() => setEditing(true)}
        />
      </ScrollView>
      <KindEditor visible={editing} onClose={() => setEditing(false)} />
    </>
  );
}

function KindEditor({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, setTypes, moveKind } = useStore();
  const kinds = useKinds();
  const { t } = useLang();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState('');
  const types = kinds.types;

  const inUse = (id: string) => data.submissions.filter((x) => x.kind === id).length;

  function rename(id: string, text: string) {
    setDrafts((d) => ({ ...d, [id]: text }));
    const label = text.trim();
    setTypes(types.map((x) => (x.id === id ? { id, ...(label ? { label } : {}) } : x)));
  }

  function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= types.length) return;
    const next = [...types];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setTypes(next);
  }

  function remove(id: string) {
    if (types.length <= 1) return;
    const fallback = types.find((x) => x.id !== id)!.id;
    const n = inUse(id);
    const go = () => {
      if (n) moveKind(id, fallback);
      setTypes(types.filter((x) => x.id !== id));
    };
    if (!n) return go();
    Alert.alert(
      t('kinds.removeTitle', { name: kinds.label(id) }),
      t('kinds.removeBody', { n, to: kinds.label(fallback) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('kinds.remove'), style: 'destructive', onPress: go },
      ],
    );
  }

  function add() {
    const label = adding.trim();
    if (!label) return;
    setTypes([...types, { id: `t_${newId().slice(0, 8)}`, label }]);
    setAdding('');
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('kinds.title')}>
      <Text style={s.meta}>{t('kinds.hint')}</Text>
      {types.map((k, i) => (
        <View key={k.id} style={s.item}>
          <Icon name={kinds.icon(k.id)} color={theme.color.textMuted} />
          <TextInput
            style={s.input}
            value={drafts[k.id] ?? kinds.label(k.id)}
            onChangeText={(x) => rename(k.id, x)}
            onBlur={() =>
              setDrafts((d) =>
                Object.fromEntries(Object.entries(d).filter(([key]) => key !== k.id)),
              )
            }
            accessibilityLabel={t('kinds.rename')}
          />
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
            disabled={i === types.length - 1}
            hitSlop={6}
            style={[s.sq, i === types.length - 1 && s.off]}
            accessibilityLabel={t('kinds.down')}
          >
            <Icon name="arrow-down" />
          </Pressable>
          <Pressable
            onPress={() => remove(k.id)}
            disabled={types.length <= 1}
            hitSlop={6}
            style={[s.sq, types.length <= 1 && s.off]}
            accessibilityLabel={t('kinds.remove')}
          >
            <Icon name="trash-can-outline" color={theme.color.danger} />
          </Pressable>
        </View>
      ))}
      <View style={s.item}>
        <Icon name="plus" color={theme.color.primary} />
        <TextInput
          style={s.input}
          value={adding}
          onChangeText={setAdding}
          placeholder={t('kinds.newPh')}
          placeholderTextColor={theme.color.textMuted}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Btn label={t('kinds.add')} onPress={add} disabled={!adding.trim()} />
      </View>
      {types.some((k) => !isBuiltinType(k.id) || k.label) ||
      types.length !== DEFAULT_TYPES.length ||
      types.some((k, i) => k.id !== DEFAULT_TYPES[i]?.id) ? (
        <Btn
          label={t('kinds.reset')}
          kind="ghost"
          icon="restore"
          onPress={() => {
            setDrafts({});
            const custom = types.filter((k) => !isBuiltinType(k.id));
            // Work filed under a custom type moves to the first default so it is never orphaned.
            for (const k of custom) if (inUse(k.id)) moveKind(k.id, DEFAULT_TYPES[0]!.id);
            setTypes(DEFAULT_TYPES);
          }}
        />
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { gap: 8, alignItems: 'center', paddingVertical: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    fontSize: theme.font.body,
    color: theme.color.text,
    backgroundColor: '#fff',
  },
  sq: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.25 },
  meta: { fontSize: 13, color: theme.color.textMuted },
});
