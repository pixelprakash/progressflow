import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { AssessmentKind } from '@progressflow/shared';
import type { Page, Submission } from '../domain';
import { KIND_META } from '../domain';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, newId, persistMedia } from '../store';
import { theme } from '../theme';
import { Btn, Chip, Header, Icon, IconBtn, Sheet } from '../components/ui';
import { scanPages } from '../capture/scan';
import {
  ISSUE_TEXT,
  analyseCapture,
  rotate90,
  toFileUri,
  withOrientationFlags,
} from '../capture/quality';
import { detectStudent } from '../capture/identify';
import type { Detection } from '../capture/identify';
import type { CaptureQuality } from '@progressflow/shared';

interface Tile {
  key: string;
  uri: string;
  width: number;
  height: number;
  quality: CaptureQuality | null;
  detection: Detection | null;
  studentId: string | null;
  busy: boolean;
  accepted: boolean;
}

const hasProblem = (t: Tile) => !t.accepted && !t.busy && (t.quality?.issues.length ?? 0) > 0;

/**
 * Batch review, modelled on the Adobe Scan review step: thumbnail strip,
 * per-page toolbar (Retake / Rotate), "Keep scanning" and a Save button — plus
 * the checks that matter here: capture quality and which student each page
 * belongs to.
 */
export function ReviewScreen({
  classId,
  initialUris,
  onCancel,
  onSaved,
}: {
  classId: string;
  initialUris: string[];
  onCancel: () => void;
  onSaved: (ids: string[]) => void;
}) {
  const { data, addSubmissions } = useStore();
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [kind, setKind] = useState<AssessmentKind>('regular');
  const [picking, setPicking] = useState(false);
  const started = useRef(false);

  const patch = (key: string, p: Partial<Tile>) =>
    setTiles((ts) => ts.map((t) => (t.key === key ? { ...t, ...p } : t)));

  const reflag = () =>
    setTiles((ts) => {
      const done = ts.filter((t) => t.quality && !t.busy) as (Tile & { quality: CaptureQuality })[];
      const flagged = new Map(withOrientationFlags(done).map((t) => [t.key, t.quality]));
      return ts.map((t) =>
        flagged.has(t.key) ? { ...t, quality: flagged.get(t.key) ?? t.quality } : t,
      );
    });

  async function analyseInto(key: string, uri: string) {
    patch(key, { busy: true });
    try {
      const a = await analyseCapture(uri);
      const d = await detectStudent(a.uri, students);
      patch(key, {
        uri: a.uri,
        width: a.width,
        height: a.height,
        quality: a.quality,
        detection: d,
        studentId: d.studentId,
        accepted: false,
        busy: false,
      });
    } catch {
      patch(key, { busy: false, quality: null });
    }
  }

  async function ingest(raw: string[]) {
    const fresh: Tile[] = raw.map((uri) => ({
      key: newId(),
      uri: toFileUri(uri),
      width: 0,
      height: 0,
      quality: null,
      detection: null,
      studentId: null,
      busy: true,
      accepted: false,
    }));
    setTiles((ts) => [...ts, ...fresh]);
    setSel((cur) => cur ?? fresh[0]?.key ?? null);
    for (const t of fresh) await analyseInto(t.key, t.uri);
    reflag();
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void ingest(initialUris);
  }, []);

  const current = tiles.find((t) => t.key === sel) ?? tiles[0];
  const students = data.students.filter((st) => st.classId === classId);
  const studentOf = (id: string | null) => students.find((x) => x.id === id);
  const busy = tiles.some((t) => t.busy);

  async function keepScanning() {
    const uris = await scanPages();
    if (uris.length) await ingest(uris);
  }

  async function retake(t: Tile) {
    const uris = await scanPages(1);
    const uri = uris[0];
    if (!uri) return;
    await analyseInto(t.key, toFileUri(uri));
    reflag();
  }

  async function rotate(t: Tile) {
    patch(t.key, { busy: true });
    await analyseInto(t.key, await rotate90(t.uri));
    reflag();
  }

  function remove(t: Tile) {
    setTiles((ts) => {
      const rest = ts.filter((x) => x.key !== t.key);
      setSel(rest[0]?.key ?? null);
      return rest;
    });
  }

  async function doSave() {
    const now = new Date().toISOString();
    const byStudent = new Map<string, Tile[]>();
    for (const t of tiles) {
      if (!t.studentId) continue;
      byStudent.set(t.studentId, [...(byStudent.get(t.studentId) ?? []), t]);
    }
    const subs: Submission[] = [];
    for (const [studentId, ts] of byStudent) {
      const pages: Page[] = [];
      for (const t of ts) {
        pages.push({
          id: newId(),
          uri: await persistMedia(t.uri, 'artworks', 'jpg'),
          width: t.width,
          height: t.height,
          quality: t.quality,
        });
      }
      subs.push({
        id: newId(),
        studentId,
        kind,
        createdAt: now,
        updatedAt: now,
        pages,
        scores: {},
        strokes: {},
        voice: null,
        attachments: [],
        note: '',
      });
    }
    addSubmissions(subs);
    onSaved(subs.map((x) => x.id));
  }

  function save() {
    const unassigned = tiles.find((t) => !t.studentId);
    if (unassigned) {
      setSel(unassigned.key);
      Alert.alert('Choose a student', 'Every scan needs a student before it can be saved.');
      return;
    }
    const bad = tiles.filter(hasProblem);
    if (bad.length) {
      Alert.alert(
        `${bad.length} ${bad.length === 1 ? 'scan has' : 'scans have'} problems`,
        'Retaking gives a fairer assessment. You can also save them as they are.',
        [
          { text: 'Review', onPress: () => setSel(bad[0]?.key ?? null) },
          { text: 'Save anyway', onPress: () => void doSave() },
        ],
      );
      return;
    }
    void doSave();
  }

  function cancel() {
    if (!tiles.length) return onCancel();
    Alert.alert('Discard these scans?', 'Nothing has been saved yet.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  }

  const matched = current ? studentOf(current.studentId) : undefined;
  const viaText = current?.detection?.via
    ? {
        roll: 'Matched by roll number',
        name: 'Matched by name — please check',
        both: 'Matched by roll number and name',
      }[current.detection.via]
    : "Couldn't read a roll number or name — choose the student";
  const unsure = !!current && !!current.detection && current.detection.confidence < 0.8;

  return (
    <View style={s.root}>
      <Header title={`Review scans (${tiles.length})`} onBack={cancel} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: theme.space.md }}>
        <View style={s.kindRow}>
          <Text style={s.label}>This batch is a…</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {(Object.keys(KIND_META) as AssessmentKind[]).map((k) => (
              <Chip
                key={k}
                label={KIND_META[k].label}
                icon={KIND_META[k].icon}
                selected={kind === k}
                onPress={() => setKind(k)}
              />
            ))}
          </ScrollView>
        </View>

        {current ? (
          <>
            <View style={[s.preview, { height: Math.round(winH * 0.3) }]}>
              <Image
                source={{ uri: current.uri }}
                style={{ flex: 1 }}
                resizeMode="contain"
                accessibilityLabel="Scanned page"
              />
              {current.busy && (
                <View style={s.busy}>
                  <Text style={s.busyText}>Checking quality and reading name…</Text>
                </View>
              )}
            </View>

            <Pressable
              style={s.student}
              onPress={() => setPicking(true)}
              accessibilityRole="button"
              accessibilityLabel="Change student"
            >
              <Icon
                name={matched ? 'account-check-outline' : 'account-question-outline'}
                size={28}
                color={matched && !unsure ? theme.color.success : theme.color.warning}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.studentName}>
                  {matched ? `${matched.name} · Roll ${matched.rollNo}` : 'Choose student'}
                </Text>
                <Text style={s.meta}>{current.busy ? 'Reading…' : viaText}</Text>
              </View>
              <Text style={s.change}>Change</Text>
            </Pressable>

            <View style={s.toolbar}>
              <IconBtn
                icon="camera-retake-outline"
                label="Retake"
                onPress={() => void retake(current)}
                disabled={current.busy}
                active={hasProblem(current)}
              />
              <IconBtn
                icon="rotate-right"
                label="Rotate"
                onPress={() => void rotate(current)}
                disabled={current.busy}
              />
              {hasProblem(current) && (
                <IconBtn
                  icon="check"
                  label="Use anyway"
                  onPress={() => patch(current.key, { accepted: true })}
                />
              )}
              <IconBtn
                icon="trash-can-outline"
                label="Delete"
                onPress={() => remove(current)}
                color={theme.color.danger}
              />
            </View>

            {!current.busy && current.quality && (
              <View style={[s.banner, hasProblem(current) ? s.bannerWarn : s.bannerOk]}>
                <Icon
                  name={hasProblem(current) ? 'alert-circle-outline' : 'check-circle-outline'}
                  color={hasProblem(current) ? theme.color.warning : theme.color.success}
                  size={26}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.bannerTitle}>
                    {hasProblem(current)
                      ? 'Please retake this one'
                      : current.accepted
                        ? 'Accepted as is'
                        : 'Good scan'}
                  </Text>
                  {current.quality.issues.map((i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                      <Icon name={ISSUE_TEXT[i].icon} size={20} color={theme.color.warning} />
                      <Text style={s.issue}>
                        <Text style={{ fontWeight: '700' }}>{ISSUE_TEXT[i].title}. </Text>
                        {ISSUE_TEXT[i].fix}
                      </Text>
                    </View>
                  ))}
                  <Text style={s.tech}>
                    {current.width}×{current.height}px · sharpness {current.quality.sharpness} ·
                    brightness {current.quality.brightness}
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <Text style={[s.meta, { padding: theme.space.lg }]}>No scans yet.</Text>
        )}
      </ScrollView>

      <View style={s.strip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: theme.space.md }}
        >
          {tiles.map((t, i) => (
            <Pressable
              key={t.key}
              onPress={() => setSel(t.key)}
              style={[s.thumb, t.key === current?.key && s.thumbSel]}
              accessibilityLabel={`Page ${i + 1}`}
            >
              <Image source={{ uri: t.uri }} style={{ flex: 1 }} resizeMode="cover" />
              <View style={s.num}>
                <Text style={s.numText}>{i + 1}</Text>
              </View>
              {hasProblem(t) && (
                <View style={s.warnDot}>
                  <Icon name="alert" size={14} color="#fff" />
                </View>
              )}
              {!t.studentId && !t.busy && (
                <View style={[s.warnDot, { backgroundColor: theme.color.danger }]}>
                  <Icon name="account-question" size={14} color="#fff" />
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={[s.bottom, { paddingBottom: theme.space.md + insets.bottom }]}>
        <Btn label="Keep scanning" kind="outline" onPress={() => void keepScanning()} flex />
        <Btn
          label={`Save ${tiles.length}`}
          icon="content-save-outline"
          onPress={save}
          disabled={busy || !tiles.length}
          flex
        />
      </View>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Whose artwork is this?">
        {students.map((st) => (
          <Pressable
            key={st.id}
            style={s.pickRow}
            onPress={() => {
              if (current) patch(current.key, { studentId: st.id });
              setPicking(false);
            }}
          >
            <Icon
              name={current?.studentId === st.id ? 'radiobox-marked' : 'radiobox-blank'}
              color={theme.color.primary}
            />
            <Text style={s.studentName}>{st.name}</Text>
            <Text style={s.meta}>Roll {st.rollNo}</Text>
          </Pressable>
        ))}
        <Text style={s.meta}>
          Two pages for the same student are saved together as one submission with multiple images.
        </Text>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  kindRow: { paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm, gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: theme.color.textMuted },
  preview: { backgroundColor: '#1d1d1d' },
  busy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyText: { color: '#fff', fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    gap: 12,
    margin: theme.space.md,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
  },
  bannerOk: { backgroundColor: theme.color.successBg },
  bannerWarn: { backgroundColor: theme.color.warningBg },
  bannerTitle: { fontSize: 17, fontWeight: '700', color: theme.color.text },
  issue: { flex: 1, fontSize: 14, color: theme.color.text },
  tech: { fontSize: 12, color: theme.color.textMuted },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: theme.space.sm,
  },
  student: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: theme.space.md,
    padding: theme.space.md,
    minHeight: 64,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
  },
  studentName: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  meta: { fontSize: 13, color: theme.color.textMuted },
  change: { color: theme.color.primary, fontWeight: '700' },
  strip: {
    height: 92,
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
  thumb: {
    width: 60,
    height: 76,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#ccc',
  },
  thumbSel: { borderColor: theme.color.primary },
  num: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 5,
  },
  numText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  warnDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: theme.color.warning,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { flexDirection: 'row', gap: 12, padding: theme.space.md, backgroundColor: '#fff' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
});
