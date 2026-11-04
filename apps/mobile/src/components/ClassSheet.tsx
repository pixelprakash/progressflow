import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { classLabel } from '../domain';
import type { ClassRoom } from '../domain';
import { useLang } from '../lang';
import { newId, useStore } from '../store';
import { theme } from '../theme';
import { Btn, Chip, Sheet } from './ui';

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Add a class, or edit / delete an existing one. */
export function ClassSheet({
  visible,
  onClose,
  editing,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  editing?: ClassRoom;
  onDeleted?: () => void;
}) {
  const { data, addClass, updateClass, deleteClass } = useStore();
  const { t } = useLang();
  const [grade, setGrade] = useState(6);
  const [section, setSection] = useState('A');
  const [assignment, setAssignment] = useState('');

  useEffect(() => {
    if (!visible) return;
    setGrade(editing?.grade ?? 6);
    setSection(editing?.section ?? 'A');
    setAssignment(editing?.assignment ?? data.classes[0]?.assignment ?? '');
  }, [visible, editing?.id]);

  function save() {
    if (
      data.classes.some((c) => c.id !== editing?.id && c.grade === grade && c.section === section)
    ) {
      Alert.alert(t('m.home.dupTitle'), t('m.home.dupBody', { label: `${grade}-${section}` }));
      return;
    }
    const name = assignment.trim() || 'Still life — pencil';
    if (editing) updateClass(editing.id, { grade, section, assignment: name });
    else addClass({ id: newId(), grade, section, assignment: name });
    onClose();
  }

  function remove() {
    if (!editing) return;
    const ids = new Set(data.students.filter((x) => x.classId === editing.id).map((x) => x.id));
    const work = data.submissions.filter((x) => ids.has(x.studentId)).length;
    Alert.alert(
      t('m.home.deleteTitle', { label: classLabel(editing) }),
      t('m.home.deleteBody', { students: ids.size, work }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('m.home.delete'),
          style: 'destructive',
          onPress: () => {
            deleteClass(editing.id);
            onClose();
            onDeleted?.();
          },
        },
      ],
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={
        editing
          ? t('m.home.editClassTitle', { label: classLabel(editing) })
          : t('m.home.addClassTitle')
      }
    >
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
      <Text style={s.meta}>{t('m.home.assignment')}</Text>
      <TextInput
        style={s.input}
        value={assignment}
        onChangeText={setAssignment}
        placeholder={t('m.home.assignmentPh')}
        placeholderTextColor={theme.color.textMuted}
      />
      <Btn
        label={
          editing
            ? t('m.home.saveClass', { label: `${grade}-${section}` })
            : t('m.home.addNamed', { label: `${grade}-${section}` })
        }
        icon="check"
        onPress={save}
      />
      {editing && (
        <View>
          <Btn
            label={t('m.home.delete')}
            icon="trash-can-outline"
            kind="outline"
            onPress={remove}
          />
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  meta: { fontSize: 13, color: theme.color.textMuted },
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
});
