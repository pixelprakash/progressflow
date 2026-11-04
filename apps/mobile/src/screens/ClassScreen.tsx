import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { classLabel, compositeScore, initials, isSaved } from '../domain';
import type { RosterStudent } from '../domain';
import { useKinds, usePrefs, useRubric } from '../hooks';
import { useLang } from '../lang';
import { newId, useStore } from '../store';
import { theme } from '../theme';
import { Btn, Chip, Header, Icon, IconBtn, Sheet } from '../components/ui';
import { ClassSheet } from '../components/ClassSheet';
import { ExportSheet, useReportEnv } from '../components/ExportSheet';
import { UnreadableFile, parseRosterBase64, planImport } from '../import/roster';
import type { ParsedRoster } from '../import/roster';
import { classReport } from '../reports/model';

const PICK_TYPES = [
  'text/csv',
  'text/comma-separated-values',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
];

export function ClassScreen({
  classId,
  onBack,
  onCapture,
  onGallery,
  onOpenInbox,
  onOpenSubmission,
  onOpenStudent,
}: {
  classId: string;
  onBack: () => void;
  onCapture: () => void;
  onGallery: () => void;
  onOpenInbox: () => void;
  onOpenSubmission: (id: string) => void;
  onOpenStudent: (id: string) => void;
}) {
  const { data, addStudent, addStudents, updateStudent, deleteStudent, setPrefs } = useStore();
  const { t, shortDate } = useLang();
  const kinds = useKinds();
  const criteria = useRubric();
  const prefs = usePrefs();
  const makeEnv = useReportEnv();
  const klass = data.classes.find((c) => c.id === classId);
  const roster = data.students
    .filter((st) => st.classId === classId)
    .sort((a, b) => (parseInt(a.rollNo, 10) || 0) - (parseInt(b.rollNo, 10) || 0));
  const [editingClass, setEditingClass] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [studentForm, setStudentForm] = useState<{ id?: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [newRoll, setNewRoll] = useState('');
  const [importing, setImporting] = useState<{
    file: string;
    parsed: ParsedRoster;
    plan: ReturnType<typeof planImport>;
  } | null>(null);
  const nameOf = (id: string) => data.students.find((s) => s.id === id)?.name ?? '—';
  const rosterIds = new Set(roster.map((st) => st.id));
  const keys = criteria.map((g) => g.key);
  const toScore = data.submissions
    .filter((s) => rosterIds.has(s.studentId))
    .filter((s) => s.pages.length > 0 && !isSaved(s))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const inbox = (data.inbox ?? []).filter((i) => i.classId === classId);

  function openStudentForm(st?: RosterStudent) {
    setNewName(st?.name ?? '');
    setNewRoll(
      st?.rollNo ?? String(Math.max(0, ...roster.map((x) => parseInt(x.rollNo, 10) || 0)) + 1),
    );
    setStudentForm({ id: st?.id });
  }

  function saveStudent() {
    const roll = newRoll.trim().replace(/^0+(?=\d)/, '');
    const name = newName.trim();
    if (roster.some((x) => x.rollNo === roll && x.id !== studentForm?.id)) {
      Alert.alert(t('m.class.rollUsed'), t('m.class.rollUsedBody', { n: roll }));
      return;
    }
    if (studentForm?.id) updateStudent(studentForm.id, { name, rollNo: roll });
    else addStudent({ id: newId(), classId, name, rollNo: roll });
    setStudentForm(null);
  }

  function removeStudent() {
    const st = roster.find((x) => x.id === studentForm?.id);
    if (!st) return;
    const work = data.submissions.filter((x) => x.studentId === st.id).length;
    Alert.alert(t('m.class.deleteTitle', { name: st.name }), t('m.class.deleteBody', { n: work }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('m.home.delete'),
        style: 'destructive',
        onPress: () => {
          deleteStudent(st.id);
          setStudentForm(null);
        },
      },
    ]);
  }

  async function pickRoster() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: PICK_TYPES,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const file = res.assets[0];
      if (!file) return;
      const b64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => {});
      const parsed = await parseRosterBase64(b64, file.name);
      setImporting({
        file: file.name,
        parsed,
        plan: planImport(
          parsed.students,
          roster.map((x) => x.rollNo),
        ),
      });
    } catch (e) {
      const why = e instanceof UnreadableFile ? e.reason : 'unknown';
      Alert.alert(
        t('m.imp.failTitle'),
        why === 'legacy'
          ? t('m.imp.legacy')
          : why === 'empty'
            ? t('m.imp.empty')
            : t('m.imp.unknown'),
      );
    }
  }

  function confirmImport() {
    if (!importing) return;
    addStudents(
      importing.plan.add.map((a) => ({ id: newId(), classId, name: a.name, rollNo: a.rollNo })),
    );
    const n = importing.plan.add.length;
    setImporting(null);
    Alert.alert(t('m.imp.doneTitle'), t('m.imp.doneBody', { n }));
  }

  return (
    <View style={s.root}>
      <Header
        title={klass ? t('common.class', { label: classLabel(klass) }) : ''}
        subtitle={klass?.assignment}
        onBack={onBack}
        right={
          <View style={{ flexDirection: 'row' }}>
            <IconBtn
              icon="file-export-outline"
              label={t('m.class.report')}
              onPress={() => setExporting(true)}
            />
            <IconBtn
              icon="pencil-outline"
              label={t('m.class.edit')}
              onPress={() => setEditingClass(true)}
            />
          </View>
        }
      />
      <ScrollView contentContainerStyle={s.content}>
        {data.sample ? (
          <View style={s.demo}>
            <Icon name="information-outline" size={18} color={theme.color.warning} />
            <Text style={s.demoText}>{t('m.class.sampleBanner')}</Text>
          </View>
        ) : null}

        <View style={s.captureCard}>
          <Btn
            label={t('m.class.capture')}
            icon={prefs.captureMode === 'original' ? 'camera-burst' : 'scanner'}
            onPress={onCapture}
          />
          <View style={s.modeRow}>
            <Chip
              label={t('m.cap.modeScan')}
              icon="scanner"
              selected={prefs.captureMode === 'scan'}
              onPress={() => setPrefs({ captureMode: 'scan' })}
            />
            <Chip
              label={t('m.cap.modeOriginal')}
              icon="image-outline"
              selected={prefs.captureMode === 'original'}
              onPress={() => setPrefs({ captureMode: 'original' })}
            />
          </View>
          <Text style={s.meta}>
            {prefs.captureMode === 'scan' ? t('m.cap.modeScanHint') : t('m.cap.modeOriginalHint')}
          </Text>
          <Btn
            label={t('m.class.gallery')}
            icon="image-multiple-outline"
            kind="outline"
            onPress={onGallery}
          />
        </View>

        {inbox.length > 0 && (
          <Pressable style={s.inbox} onPress={onOpenInbox} accessibilityRole="button">
            <Icon name="tray-full" size={30} color={theme.color.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{t('m.class.inbox', { n: inbox.length })}</Text>
              <Text style={s.meta}>{t('m.class.inboxHint')}</Text>
            </View>
            <Icon name="chevron-right" color={theme.color.primary} />
          </Pressable>
        )}

        {toScore.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('m.class.waiting')}</Text>
            {toScore.map((sub) => (
              <Pressable
                key={sub.id}
                style={s.row}
                onPress={() => onOpenSubmission(sub.id)}
                accessibilityRole="button"
              >
                <View style={[s.avatar, { backgroundColor: theme.color.warningBg }]}>
                  <Icon name={kinds.icon(sub.kind)} size={20} color={theme.color.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{nameOf(sub.studentId)}</Text>
                  <Text style={s.meta}>
                    {kinds.label(sub.kind)} · {t('sub.images', { n: sub.pages.length })} ·{' '}
                    {shortDate(sub.createdAt)}
                  </Text>
                </View>
                <Icon name="chevron-right" color={theme.color.textMuted} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>{t('cls.students')}</Text>
          {roster.map((st) => {
            const subs = data.submissions
              .filter((x) => x.studentId === st.id)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            const latest = subs[subs.length - 1];
            const avg = latest ? compositeScore(latest.scores, keys) : null;
            return (
              <View key={st.id} style={s.row}>
                <Pressable
                  style={[s.row, { flex: 1 }]}
                  onPress={() => onOpenStudent(st.id)}
                  accessibilityRole="button"
                >
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{initials(st.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{st.name}</Text>
                    <Text style={s.meta}>
                      {t('common.roll', { n: st.rollNo })} ·{' '}
                      {subs.length === 0
                        ? t('m.class.noWork')
                        : subs.length === 1
                          ? t('m.class.sub1', { n: 1 })
                          : t('m.class.subs', { n: subs.length })}
                    </Text>
                  </View>
                  {avg !== null && <Text style={s.avg}>{avg.toFixed(1)}</Text>}
                </Pressable>
                <Pressable
                  onPress={() => openStudentForm(st)}
                  hitSlop={6}
                  style={s.more}
                  accessibilityRole="button"
                  accessibilityLabel={t('m.class.editStudent', { name: st.name })}
                >
                  <Icon name="pencil-outline" size={22} color={theme.color.textMuted} />
                </Pressable>
              </View>
            );
          })}
          <Btn
            label={t('m.class.addStudent')}
            icon="account-plus-outline"
            kind="ghost"
            onPress={() => openStudentForm()}
          />
          <Btn
            label={t('m.imp.button')}
            icon="file-import-outline"
            kind="ghost"
            onPress={() => void pickRoster()}
          />
        </View>
      </ScrollView>

      <ClassSheet
        visible={editingClass}
        editing={klass}
        onClose={() => setEditingClass(false)}
        onDeleted={onBack}
      />

      <ExportSheet
        visible={exporting}
        onClose={() => setExporting(false)}
        title={t('rep.exportClass')}
        build={() => classReport(data, klass!, makeEnv())}
      />

      <Sheet
        visible={!!studentForm}
        onClose={() => setStudentForm(null)}
        title={studentForm?.id ? t('m.class.editStudentTitle') : t('m.class.addStudentTitle')}
      >
        <TextInput
          style={s.input}
          value={newName}
          onChangeText={setNewName}
          placeholder={t('m.class.namePh')}
          placeholderTextColor={theme.color.textMuted}
        />
        <TextInput
          style={s.input}
          value={newRoll}
          onChangeText={setNewRoll}
          placeholder={t('m.class.rollPh')}
          placeholderTextColor={theme.color.textMuted}
          keyboardType="number-pad"
        />
        <Btn
          label={studentForm?.id ? t('m.class.saveStudent') : t('m.class.addStudent')}
          icon="check"
          disabled={!newName.trim() || !newRoll.trim()}
          onPress={saveStudent}
        />
        {studentForm?.id ? (
          <Btn
            label={t('m.home.delete')}
            icon="trash-can-outline"
            kind="outline"
            onPress={removeStudent}
          />
        ) : null}
      </Sheet>

      <Sheet
        visible={!!importing}
        onClose={() => setImporting(null)}
        title={t('m.imp.previewTitle')}
      >
        {importing && (
          <>
            <Text style={s.meta}>{importing.file}</Text>
            <Text style={s.cardTitle}>{t('m.imp.found', { n: importing.plan.add.length })}</Text>
            {importing.plan.add.slice(0, 8).map((a) => (
              <View key={a.rollNo + a.name} style={s.previewRow}>
                <Text style={s.previewRoll}>{a.rollNo}</Text>
                <Text style={s.name}>{a.name}</Text>
              </View>
            ))}
            {importing.plan.add.length > 8 && (
              <Text style={s.meta}>{t('m.imp.more', { n: importing.plan.add.length - 8 })}</Text>
            )}
            {importing.plan.duplicates.length > 0 && (
              <Text style={[s.meta, { color: theme.color.warning }]}>
                {t('m.imp.dups', { n: importing.plan.duplicates.length })}
              </Text>
            )}
            {importing.parsed.skipped > 0 && (
              <Text style={s.meta}>{t('m.imp.skipped', { n: importing.parsed.skipped })}</Text>
            )}
            {importing.parsed.students.some((x) => x.rollNo === null) && (
              <Text style={s.meta}>{t('m.imp.numbered')}</Text>
            )}
            <Btn
              label={t('m.imp.add', { n: importing.plan.add.length })}
              icon="check"
              disabled={importing.plan.add.length === 0}
              onPress={confirmImport}
            />
          </>
        )}
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
  captureCard: { gap: theme.space.sm },
  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  inbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    padding: theme.space.md,
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.md,
  },
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
  more: { width: 44, height: 56, alignItems: 'center', justifyContent: 'center' },
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
  previewRow: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 36 },
  previewRoll: { width: 40, fontWeight: '800', color: theme.color.primary, fontSize: 16 },
});
