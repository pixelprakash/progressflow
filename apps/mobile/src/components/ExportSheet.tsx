import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_NAMES } from '@progressflow/shared';
import type { TKey } from '@progressflow/shared';
import { useAuth } from '../auth';
import { useKinds, useRubric } from '../hooks';
import { useLang } from '../lang';
import { theme } from '../theme';
import { exportReport } from '../reports/share';
import type { ReportDoc, ReportEnv } from '../reports/model';
import type { ReportFormat } from '../reports/render';
import { Btn, Icon, Sheet } from './ui';

const FORMATS: { id: ReportFormat; icon: string; name: TKey; hint: TKey }[] = [
  { id: 'pdf', icon: 'file-pdf-box', name: 'rep.fmt.pdf', hint: 'rep.fmt.pdfHint' },
  { id: 'docx', icon: 'file-word-outline', name: 'rep.fmt.docx', hint: 'rep.fmt.docxHint' },
  { id: 'xlsx', icon: 'file-excel-outline', name: 'rep.fmt.xlsx', hint: 'rep.fmt.xlsxHint' },
  { id: 'csv', icon: 'file-delimited-outline', name: 'rep.fmt.csv', hint: 'rep.fmt.csvHint' },
];

/** Everything a report builder needs from the app's current language, rubric and teacher. */
export function useReportEnv(): () => ReportEnv {
  const { t, lang } = useLang();
  const criteria = useRubric();
  const kinds = useKinds();
  const { current } = useAuth();
  return () => ({
    t,
    lang,
    criteria,
    kindLabel: kinds.label,
    fmtDate: (iso) =>
      new Date(iso).toLocaleDateString(
        lang === 'en' ? 'en-IN' : lang === 'hi' ? 'hi-IN' : 'te-IN',
        {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
      ),
    teacher: current ? { name: current.name, school: current.school } : null,
    now: new Date(),
  });
}

/** Choose a file format, then save or share the class or student report. */
export function ExportSheet({
  visible,
  onClose,
  title,
  build,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  build: () => ReportDoc;
}) {
  const { t, lang } = useLang();
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await exportReport(build(), format, lang, title);
      onClose();
    } catch {
      Alert.alert(t('rep.failTitle'), t('rep.failBody'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Text style={s.meta}>{t('rep.chooseFormat')}</Text>
      {FORMATS.map((f) => (
        <Pressable
          key={f.id}
          style={[s.row, format === f.id && s.rowOn]}
          onPress={() => setFormat(f.id)}
          accessibilityRole="radio"
          accessibilityState={{ selected: format === f.id }}
        >
          <Icon
            name={f.icon}
            size={30}
            color={format === f.id ? theme.color.primary : theme.color.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{t(f.name)}</Text>
            <Text style={s.meta}>{t(f.hint)}</Text>
          </View>
          <Icon
            name={format === f.id ? 'radiobox-marked' : 'radiobox-blank'}
            color={theme.color.primary}
          />
        </Pressable>
      ))}
      <Text style={s.meta}>{t('rep.inLanguage', { lang: LANGUAGE_NAMES[lang] })}</Text>
      <Btn
        label={busy ? t('rep.preparing') : t('rep.share')}
        icon="share-variant-outline"
        onPress={() => void go()}
        disabled={busy}
      />
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    minHeight: 64,
    padding: theme.space.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.color.border,
  },
  rowOn: { borderColor: theme.color.primary, backgroundColor: theme.color.primarySoft },
  name: { fontSize: theme.font.body, fontWeight: '700', color: theme.color.text },
  meta: { fontSize: 13, color: theme.color.textMuted },
});
