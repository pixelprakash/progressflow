import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import type {
  AnnotationTool,
  AssessmentKind,
  Language,
  PerformanceLevel,
} from '@progressflow/shared';
import { KIND_META, compositeScore, shortDate } from '../domain';
import type { Attachment, Page, Submission } from '../domain';
import { GUIDES, LEVEL_LABELS } from '../rubricContent';
import type { CriterionGuide } from '../rubricContent';
import { useAuth } from '../auth';
import { parseHttpUrl } from '../url';
import { newId, persistMedia, useStore } from '../store';
import { theme } from '../theme';
import { AnnotationCanvas } from '../components/AnnotationCanvas';
import { HintDiagram } from '../components/HintDiagram';
import { Btn, Chip, Header, Icon, IconBtn, Sheet } from '../components/ui';
import { pickFromGallery, scanPages } from '../capture/scan';
import { analyseCapture } from '../capture/quality';

const TOOLS: { tool: AnnotationTool; icon: string; label: string }[] = [
  { tool: 'circle', icon: 'circle-outline', label: 'Circle' },
  { tool: 'highlight', icon: 'marker', label: 'Highlight' },
  { tool: 'arrow', icon: 'arrow-top-right', label: 'Arrow' },
  { tool: 'freehand', icon: 'draw', label: 'Pen' },
];
const COLORS = ['#E53935', '#FBC02D', '#43A047', '#1E88E5'];
const LANGS: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
];
const LEVELS: PerformanceLevel[] = [1, 2, 3, 4];

const fmt = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

export function EvaluateScreen({
  submissionId,
  onBack,
  onStudent,
}: {
  submissionId: string;
  onBack: () => void;
  onStudent: (id: string) => void;
}) {
  const { data, updateSubmission } = useStore();
  const sub = data.submissions.find((x) => x.id === submissionId);
  const student = data.students.find((x) => x.id === sub?.studentId);

  const [tab, setTab] = useState<'rubric' | 'feedback'>('rubric');
  const [pageIdx, setPageIdx] = useState(0);
  const [showMarks, setShowMarks] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<AnnotationTool>('circle');
  const [color, setColor] = useState(COLORS[0] ?? '#E53935');
  const [hint, setHint] = useState<CriterionGuide | null>(null);
  const { current: teacher } = useAuth();
  const [lang, setLang] = useState<Language>(teacher?.language ?? 'en');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [linkSheet, setLinkSheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  const [draftA, setDraftA] = useState('');
  const [draftB, setDraftB] = useState('');
  const rec = useRef<Audio.Recording | null>(null);
  const sound = useRef<Audio.Sound | null>(null);

  useEffect(
    () => () => {
      void rec.current?.stopAndUnloadAsync().catch(() => {});
      void sound.current?.unloadAsync().catch(() => {});
    },
    [],
  );

  if (!sub || !student)
    return (
      <View style={{ flex: 1 }}>
        <Header title="Not found" onBack={onBack} />
      </View>
    );

  const edit = (fn: (s: Submission) => Submission) => updateSubmission(sub.id, fn);
  const page = sub.pages[Math.min(pageIdx, sub.pages.length - 1)];
  const strokes = page ? (sub.strokes[page.id] ?? []) : [];
  const avg = compositeScore(sub.scores);
  const scored = Object.keys(sub.scores).length;

  const previous = data.submissions
    .filter((x) => x.studentId === sub.studentId && x.id !== sub.id && x.createdAt < sub.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function setScore(key: string, level: PerformanceLevel) {
    void Haptics.selectionAsync().catch(() => {});
    edit((s) => ({ ...s, scores: { ...s.scores, [key]: level } }));
  }

  async function addPages(uris: string[]) {
    const added: Page[] = [];
    for (const raw of uris) {
      try {
        const a = await analyseCapture(raw);
        added.push({
          id: newId(),
          uri: await persistMedia(a.uri, 'artworks', 'jpg'),
          width: a.width,
          height: a.height,
          quality: a.quality,
        });
      } catch {
        Alert.alert('Could not read that image', 'Try scanning it again.');
      }
    }
    if (added.length) {
      edit((s) => ({ ...s, pages: [...s.pages, ...added] }));
      setPageIdx(sub?.pages.length ?? 0);
    }
  }

  async function startRec() {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted)
      return Alert.alert('Microphone needed', 'Allow microphone access to record a voice note.');
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording: r } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
      (st) => setElapsed(st.durationMillis ?? 0),
    );
    rec.current = r;
    setElapsed(0);
    setRecording(true);
  }

  async function stopRec() {
    const r = rec.current;
    if (!r) return;
    setRecording(false);
    await r.stopAndUnloadAsync();
    const st = await r.getStatusAsync();
    const uri = r.getURI();
    rec.current = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    if (!uri) return;
    const saved = await persistMedia(uri, 'voice', 'm4a');
    edit((s) => ({
      ...s,
      voice: { uri: saved, durationMs: st.durationMillis ?? elapsed, language: lang },
    }));
  }

  async function togglePlay() {
    if (!sub?.voice) return;
    if (playing) {
      await sound.current?.stopAsync();
      return setPlaying(false);
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    await sound.current?.unloadAsync().catch(() => {});
    const { sound: snd } = await Audio.Sound.createAsync(
      { uri: sub.voice.uri },
      { shouldPlay: true },
      (st) => {
        if (st.isLoaded && st.didJustFinish) setPlaying(false);
      },
    );
    sound.current = snd;
    setPlaying(true);
  }

  const addAttachment = (a: Omit<Attachment, 'id'>) =>
    edit((s) => ({ ...s, attachments: [...s.attachments, { ...a, id: newId() }] }));

  async function addReferenceImages() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (res.canceled) return;
    for (const a of res.assets)
      addAttachment({
        kind: 'image',
        title: a.fileName ?? 'Reference image',
        uri: await persistMedia(a.uri, 'attachments', 'jpg'),
      });
  }

  async function addFiles() {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    for (const f of res.assets) {
      const ext = f.name.split('.').pop() ?? 'bin';
      addAttachment({
        kind: 'file',
        title: f.name,
        uri: await persistMedia(f.uri, 'attachments', ext),
      });
    }
  }

  function saveLink() {
    const parsed = parseHttpUrl(draftB);
    if (!parsed || !parsed.host.includes('.')) {
      Alert.alert(
        'That link does not look right',
        'Example: youtube.com/watch?v=… or https://example.org/lesson',
      );
      return;
    }
    addAttachment({ kind: 'link', title: draftA.trim() || parsed.host, url: parsed.url });
    setLinkSheet(false);
    setDraftA('');
    setDraftB('');
  }

  function saveNote() {
    const text = draftA.trim();
    if (!text) return;
    addAttachment({ kind: 'note', title: text.slice(0, 40), text });
    setNoteSheet(false);
    setDraftA('');
  }

  return (
    <View style={s.root}>
      <Header
        title={student.name}
        subtitle={`Roll ${student.rollNo} · ${shortDate(sub.createdAt)}`}
        onBack={onBack}
        right={<IconBtn icon="chart-line" label="Progress" onPress={() => onStudent(student.id)} />}
      />
      <ScrollView
        scrollEnabled={!drawing}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: theme.space.xl * 2 }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.kindRow}
        >
          {(Object.keys(KIND_META) as AssessmentKind[]).map((k) => (
            <Chip
              key={k}
              label={KIND_META[k].label}
              icon={KIND_META[k].icon}
              selected={sub.kind === k}
              onPress={() => edit((x) => ({ ...x, kind: k }))}
            />
          ))}
        </ScrollView>

        {page ? (
          <AnnotationCanvas
            uri={page.uri}
            imageWidth={page.width}
            imageHeight={page.height}
            height={340}
            strokes={strokes}
            visible={showMarks}
            drawing={drawing && showMarks}
            tool={tool}
            color={color}
            onAdd={(st) =>
              edit((x) => ({
                ...x,
                strokes: { ...x.strokes, [page.id]: [...(x.strokes[page.id] ?? []), st] },
              }))
            }
          />
        ) : (
          <View style={s.noPhoto}>
            <Icon name="image-off-outline" size={36} color={theme.color.textMuted} />
            <Text style={s.meta}>No photo on this record (sample data).</Text>
          </View>
        )}

        <View style={s.pagesRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, alignItems: 'center' }}
          >
            {sub.pages.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => setPageIdx(i)}
                style={[s.thumb, i === pageIdx && s.thumbSel]}
                accessibilityLabel={`Image ${i + 1}`}
              >
                <Image source={{ uri: p.uri }} style={{ flex: 1 }} />
              </Pressable>
            ))}
            <IconBtn
              icon="camera-plus-outline"
              label="Scan"
              onPress={() => void scanPages().then(addPages)}
            />
            <IconBtn
              icon="image-plus"
              label="Gallery"
              onPress={() => void pickFromGallery().then(addPages)}
            />
          </ScrollView>
        </View>

        {page && (
          <View style={s.markBar}>
            <View style={s.markTop}>
              <Icon
                name={showMarks ? 'eye-outline' : 'eye-off-outline'}
                color={theme.color.primary}
              />
              <Text style={s.markLabel}>{showMarks ? 'Markup shown' : 'Markup hidden'}</Text>
              <Switch
                value={showMarks}
                onValueChange={(v) => {
                  setShowMarks(v);
                  if (!v) setDrawing(false);
                }}
                trackColor={{ true: theme.color.primary, false: theme.color.border }}
                accessibilityLabel="Show or hide markup"
              />
              <View style={{ flex: 1 }} />
              <Chip
                label={drawing ? 'Done' : 'Mark up'}
                icon={drawing ? 'check' : 'draw'}
                selected={drawing}
                onPress={() => {
                  if (showMarks) setDrawing((d) => !d);
                  else Alert.alert('Markup is hidden', 'Turn the switch on to draw.');
                }}
              />
            </View>
            {drawing && (
              <View style={s.tools}>
                {TOOLS.map((t) => (
                  <IconBtn
                    key={t.tool}
                    icon={t.icon}
                    label={t.label}
                    active={tool === t.tool}
                    onPress={() => setTool(t.tool)}
                  />
                ))}
                <IconBtn
                  icon="undo"
                  label="Undo"
                  disabled={!strokes.length}
                  onPress={() =>
                    page &&
                    edit((x) => ({
                      ...x,
                      strokes: { ...x.strokes, [page.id]: strokes.slice(0, -1) },
                    }))
                  }
                />
                <IconBtn
                  icon="delete-sweep-outline"
                  label="Clear"
                  disabled={!strokes.length}
                  onPress={() =>
                    page && edit((x) => ({ ...x, strokes: { ...x.strokes, [page.id]: [] } }))
                  }
                />
                <View style={s.colors}>
                  {COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      accessibilityLabel={`Colour ${c}`}
                      style={[s.dot, { backgroundColor: c }, c === color && s.dotSel]}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        <View style={s.tabs}>
          <Chip
            label="Rubric"
            icon="clipboard-list-outline"
            selected={tab === 'rubric'}
            onPress={() => setTab('rubric')}
          />
          <Chip
            label="Feedback"
            icon="message-text-outline"
            selected={tab === 'feedback'}
            onPress={() => setTab('feedback')}
          />
        </View>

        {tab === 'rubric' ? (
          <View style={s.pad}>
            <Text style={s.meta}>
              {scored} of {GUIDES.length} scored{avg !== null ? ` · average ${avg.toFixed(1)}` : ''}
              . Tap <Text style={{ fontWeight: '700' }}>Hint</Text> on any row to see what to look
              for.
            </Text>
            {GUIDES.map((g) => {
              const level = sub.scores[g.key];
              const prev = previous.find((p) => p.scores[g.key] !== undefined);
              const prevLevel = prev?.scores[g.key];
              const delta =
                level !== undefined && prevLevel !== undefined ? level - prevLevel : null;
              return (
                <View key={g.key} style={s.card}>
                  <View style={s.cardHead}>
                    <View style={[s.badge, { backgroundColor: g.color }]}>
                      <Icon name={g.icon} color="#fff" size={26} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{g.name}</Text>
                      <Text style={s.meta}>{g.tagline}</Text>
                    </View>
                    <IconBtn
                      icon="lightbulb-on-outline"
                      label="Hint"
                      onPress={() => setHint(g)}
                      color={g.color}
                    />
                  </View>
                  <View style={s.levels}>
                    {LEVELS.map((l) => (
                      <Pressable
                        key={l}
                        onPress={() => setScore(g.key, l)}
                        accessibilityRole="button"
                        accessibilityLabel={`${g.name} ${LEVEL_LABELS[l]}`}
                        accessibilityState={{ selected: level === l }}
                        style={[
                          s.level,
                          level === l && { backgroundColor: g.color, borderColor: g.color },
                        ]}
                      >
                        <Text style={[s.levelNum, level === l && { color: '#fff' }]}>{l}</Text>
                        <Text
                          style={[s.levelLabel, level === l && { color: '#fff' }]}
                          numberOfLines={1}
                        >
                          {LEVEL_LABELS[l]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={s.descriptor}>
                    {level ? g.levels[level] : 'Not scored yet. Open the hint if you are unsure.'}
                  </Text>
                  {delta !== null && prev && (
                    <Text
                      style={[
                        s.delta,
                        {
                          color:
                            delta > 0
                              ? theme.color.success
                              : delta < 0
                                ? theme.color.danger
                                : theme.color.textMuted,
                        },
                      ]}
                    >
                      {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '● same'} since{' '}
                      {shortDate(prev.createdAt)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={s.pad}>
            <View style={s.card}>
              <Text style={s.cardTitle}>Voice note</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {LANGS.map((l) => (
                  <Chip
                    key={l.code}
                    label={l.label}
                    selected={(sub.voice?.language ?? lang) === l.code}
                    onPress={() => {
                      setLang(l.code);
                      if (sub.voice)
                        edit((x) => ({
                          ...x,
                          voice: x.voice ? { ...x.voice, language: l.code } : null,
                        }));
                    }}
                  />
                ))}
              </View>
              {recording ? (
                <Btn
                  label={`Stop · ${fmt(elapsed)}`}
                  icon="stop-circle-outline"
                  kind="danger"
                  onPress={() => void stopRec()}
                />
              ) : sub.voice ? (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn
                      label={`${playing ? 'Stop' : 'Play'} · ${fmt(sub.voice.durationMs)}`}
                      icon={playing ? 'stop' : 'play'}
                      onPress={() => void togglePlay()}
                      flex
                    />
                    <Btn
                      label="Re-record"
                      icon="microphone"
                      kind="outline"
                      onPress={() => void startRec()}
                      flex
                    />
                  </View>
                  <Pressable onPress={() => edit((x) => ({ ...x, voice: null }))} hitSlop={8}>
                    <Text style={s.link}>Delete voice note</Text>
                  </Pressable>
                </View>
              ) : (
                <Btn label="Record voice note" icon="microphone" onPress={() => void startRec()} />
              )}
              <Text style={s.meta}>
                Saved on this phone. Automatic transcripts arrive with the sync phase.
              </Text>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>References, links and notes for the student</Text>
              <View style={s.attachBtns}>
                <IconBtn
                  icon="image-multiple-outline"
                  label="Image"
                  onPress={() => void addReferenceImages()}
                />
                <IconBtn
                  icon="file-document-outline"
                  label="File"
                  onPress={() => void addFiles()}
                />
                <IconBtn
                  icon="link-variant"
                  label="Link"
                  onPress={() => {
                    setDraftA('');
                    setDraftB('');
                    setLinkSheet(true);
                  }}
                />
                <IconBtn
                  icon="note-text-outline"
                  label="Note"
                  onPress={() => {
                    setDraftA('');
                    setNoteSheet(true);
                  }}
                />
              </View>
              {sub.attachments.length === 0 && <Text style={s.meta}>Nothing attached yet.</Text>}
              {sub.attachments.map((a) => (
                <View key={a.id} style={s.attRow}>
                  {a.kind === 'image' && a.uri ? (
                    <Image source={{ uri: a.uri }} style={s.attThumb} />
                  ) : (
                    <View
                      style={[
                        s.attThumb,
                        {
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: theme.color.primarySoft,
                        },
                      ]}
                    >
                      <Icon
                        name={
                          a.kind === 'link'
                            ? 'link-variant'
                            : a.kind === 'note'
                              ? 'note-text-outline'
                              : 'file-document-outline'
                        }
                        color={theme.color.primary}
                      />
                    </View>
                  )}
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => a.url && void Linking.openURL(a.url)}
                    disabled={!a.url}
                  >
                    <Text
                      style={[s.name, a.url && { color: theme.color.primary }]}
                      numberOfLines={1}
                    >
                      {a.title}
                    </Text>
                    <Text style={s.meta} numberOfLines={2}>
                      {a.url ?? a.text ?? a.kind}
                    </Text>
                  </Pressable>
                  <IconBtn
                    icon="close"
                    label="Remove"
                    onPress={() =>
                      edit((x) => ({
                        ...x,
                        attachments: x.attachments.filter((y) => y.id !== a.id),
                      }))
                    }
                  />
                </View>
              ))}
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Your notes</Text>
              <TextInput
                style={s.input}
                multiline
                value={sub.note}
                onChangeText={(t) => edit((x) => ({ ...x, note: t }))}
                placeholder="What to remember, or what to tell the student…"
                placeholderTextColor={theme.color.textMuted}
                textAlignVertical="top"
              />
            </View>
          </View>
        )}
      </ScrollView>

      <Sheet visible={!!hint} onClose={() => setHint(null)} title={hint?.name ?? ''}>
        {hint && (
          <>
            <HintDiagram kind={hint.key} />
            <Text style={s.descriptor}>{hint.tagline}</Text>
            <Text style={s.sheetH}>Look for</Text>
            {hint.lookFor.map((l) => (
              <View key={l.title} style={{ flexDirection: 'row', gap: 10 }}>
                <Icon name="eye-outline" color={hint.color} size={20} />
                <Text style={s.descriptor}>
                  <Text style={{ fontWeight: '700' }}>{l.title}. </Text>
                  {l.text}
                </Text>
              </View>
            ))}
            <Text style={s.sheetH}>Ask the student</Text>
            <Text style={s.descriptor}>“{hint.askStudent}”</Text>
            <Text style={s.sheetH}>What each level looks like</Text>
            {LEVELS.map((l) => (
              <View key={l} style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[s.lvBadge, { backgroundColor: hint.color }]}>
                  <Text style={s.lvBadgeText}>{l}</Text>
                </View>
                <Text style={[s.descriptor, { flex: 1 }]}>
                  <Text style={{ fontWeight: '700' }}>{LEVEL_LABELS[l]}. </Text>
                  {hint.levels[l]}
                </Text>
              </View>
            ))}
            <Text style={s.meta}>
              Draft wording — to be replaced with educator-written descriptors and example images.
            </Text>
          </>
        )}
      </Sheet>

      <Sheet visible={linkSheet} onClose={() => setLinkSheet(false)} title="Add a link">
        <TextInput
          style={s.inputLine}
          value={draftA}
          onChangeText={setDraftA}
          placeholder="Title (optional)"
          placeholderTextColor={theme.color.textMuted}
        />
        <TextInput
          style={s.inputLine}
          value={draftB}
          onChangeText={setDraftB}
          placeholder="https://…"
          placeholderTextColor={theme.color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Btn
          label="Add link"
          icon="link-variant-plus"
          onPress={saveLink}
          disabled={!draftB.trim()}
        />
      </Sheet>

      <Sheet visible={noteSheet} onClose={() => setNoteSheet(false)} title="Add a note">
        <TextInput
          style={[s.input, { minHeight: 140 }]}
          multiline
          value={draftA}
          onChangeText={setDraftA}
          placeholder="Type or paste text for the student…"
          placeholderTextColor={theme.color.textMuted}
          textAlignVertical="top"
        />
        <Btn
          label="Add note"
          icon="note-plus-outline"
          onPress={saveNote}
          disabled={!draftA.trim()}
        />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  kindRow: { padding: theme.space.md, gap: 8 },
  noPhoto: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.color.surface,
  },
  pagesRow: { paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm },
  thumb: {
    width: 52,
    height: 64,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#ccc',
  },
  thumbSel: { borderColor: theme.color.primary },
  markBar: {
    marginHorizontal: theme.space.md,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    padding: theme.space.sm,
    gap: 4,
  },
  markTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markLabel: { fontSize: 14, fontWeight: '600', color: theme.color.text },
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  colors: { flexDirection: 'row', gap: 10, paddingHorizontal: 8 },
  dot: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: '#fff' },
  dotSel: { borderColor: theme.color.text },
  tabs: { flexDirection: 'row', gap: 8, padding: theme.space.md },
  pad: { paddingHorizontal: theme.space.md, gap: theme.space.md },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: theme.color.text },
  meta: { fontSize: 13, color: theme.color.textMuted },
  levels: { flexDirection: 'row', gap: 8 },
  level: {
    flex: 1,
    minHeight: theme.tapTarget + 4,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.color.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: { fontSize: 22, fontWeight: '800', color: theme.color.text },
  levelLabel: { fontSize: 11, color: theme.color.textMuted },
  descriptor: { fontSize: 15, color: theme.color.text, lineHeight: 21 },
  delta: { fontSize: 13, fontWeight: '700' },
  link: { color: theme.color.danger, fontWeight: '600' },
  attachBtns: { flexDirection: 'row', justifyContent: 'space-around' },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  attThumb: { width: 48, height: 48, borderRadius: 8 },
  name: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  input: {
    minHeight: 96,
    backgroundColor: '#fff',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 12,
    fontSize: theme.font.body,
    color: theme.color.text,
  },
  inputLine: {
    minHeight: 52,
    backgroundColor: '#fff',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: 12,
    fontSize: theme.font.body,
    color: theme.color.text,
  },
  sheetH: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.textMuted,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  lvBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lvBadgeText: { color: '#fff', fontWeight: '800' },
});
