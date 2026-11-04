import { useRef, useState } from 'react';
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
import * as FileSystem from 'expo-file-system';
import type { TKey } from '@progressflow/shared';
import type { InboxItem, Page, Submission } from '../domain';
import { initials } from '../domain';
import { useKinds } from '../hooks';
import { useLang } from '../lang';
import { moveMedia, newId, useStore } from '../store';
import { theme } from '../theme';
import { analyseCapture, ISSUE_TEXT, rotate90 } from '../capture/quality';
import { detectStudent } from '../capture/identify';
import { Btn, Header, Icon, IconBtn, Sheet } from '../components/ui';
import { KindBar } from '../components/KindBar';

/** A match at or above this is filed without a second look; below it the teacher confirms. */
export const AUTO_FILE = 0.8;

const isReady = (i: InboxItem) => !!i.guessId && (i.guessConfidence ?? 0) >= AUTO_FILE;
const flagged = (i: InboxItem) => (i.quality?.issues.length ?? 0) > 0;

/**
 * Papers captured in a batch, waiting to be sorted. "Read names" runs the
 * on-device text reader over every photo and suggests whose each paper is;
 * "File" then puts them on those students' profiles. Anything the reader was
 * unsure of is marked and left for the teacher to confirm or change.
 */
export function InboxScreen({
  classId,
  onBack,
  onCapture,
  onFiled,
}: {
  classId: string;
  onBack: () => void;
  onCapture: (replaceId?: string) => void;
  onFiled: (count: number) => void;
}) {
  const { data, addSubmissions, updateInbox, removeInbox } = useStore();
  const { t } = useLang();
  const kinds = useKinds();
  const { width } = useWindowDimensions();
  const roster = data.students.filter((st) => st.classId === classId);
  const items = (data.inbox ?? [])
    .filter((i) => i.classId === classId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const [kind, setKind] = useState(kinds.types[0]?.id ?? 'assignment');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const stop = useRef(false);

  const unsorted = items.filter((i) => !i.sorted);
  const ready = items.filter(isReady);
  const review = items.filter((i) => i.sorted && !isReady(i));
  const nameOf = (id: string | null | undefined) => roster.find((x) => x.id === id);
  const open = items.find((i) => i.id === openId) ?? null;
  const tile = (width - theme.space.md * 2 - 16) / 3;

  async function readNames(list: InboxItem[]) {
    stop.current = false;
    setProgress({ done: 0, total: list.length });
    for (const [n, it] of list.entries()) {
      if (stop.current) break;
      try {
        const a = await analyseCapture(it.uri);
        const d = await detectStudent(a.uri, roster, a);
        updateInbox(it.id, {
          width: a.width,
          height: a.height,
          quality: a.quality,
          guessId: d.studentId,
          guessConfidence: d.confidence,
          sorted: true,
        });
      } catch {
        updateInbox(it.id, { sorted: true, guessId: null, guessConfidence: 0 });
      }
      setProgress({ done: n + 1, total: list.length });
    }
    setProgress(null);
  }

  async function file(list: InboxItem[]) {
    const now = new Date().toISOString();
    const byStudent = new Map<string, InboxItem[]>();
    for (const it of list) {
      if (!it.guessId) continue;
      byStudent.set(it.guessId, [...(byStudent.get(it.guessId) ?? []), it]);
    }
    const subs: Submission[] = [...byStudent].map(([studentId, group]) => ({
      id: newId(),
      studentId,
      kind,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      // The photo file stays where the camera put it; the page now points at it.
      pages: group.map<Page>((g) => ({
        id: newId(),
        uri: g.uri,
        width: g.width,
        height: g.height,
        quality: g.quality ?? null,
      })),
      scores: {},
      strokes: {},
      voice: null,
      attachments: [],
      note: '',
    }));
    addSubmissions(subs);
    removeInbox(
      list.map((x) => x.id),
      false,
    );
    onFiled(list.length);
  }

  function confirmFile() {
    const blurry = ready.filter(flagged).length;
    const go = () => void file(ready);
    if (!blurry) return go();
    Alert.alert(t('m.inb.flaggedTitle', { n: blurry }), t('m.inb.flaggedBody'), [
      { text: t('m.rev.look'), style: 'cancel' },
      { text: t('m.inb.fileAnyway'), onPress: go },
    ]);
  }

  async function rotate(it: InboxItem) {
    const turned = await rotate90(it.uri);
    const uri = await moveMedia(turned, 'inbox', 'jpg');
    updateInbox(it.id, {
      uri,
      width: it.height,
      height: it.width,
      sorted: false,
      guessId: null,
      guessConfidence: 0,
      quality: null,
    });
    // The old file is no longer referenced.
    FileSystem.deleteAsync(it.uri, { idempotent: true }).catch(() => {});
    setOpenId(null);
  }

  const viaText = (i: InboxItem) =>
    !i.sorted
      ? t('m.inb.notRead')
      : !i.guessId
        ? t('m.rev.viaNone')
        : (i.guessConfidence ?? 0) >= 0.98
          ? t('m.rev.viaBoth')
          : (i.guessConfidence ?? 0) >= 0.8
            ? t('m.rev.viaRoll')
            : t('m.inb.unsure');

  return (
    <View style={s.root}>
      <Header
        title={t('m.inb.title', { n: items.length })}
        subtitle={t('m.inb.sub', {
          ready: ready.length,
          review: review.length,
          unsorted: unsorted.length,
        })}
        onBack={onBack}
        right={<IconBtn icon="camera-burst" label={t('m.inb.add')} onPress={() => onCapture()} />}
      />
      <ScrollView contentContainerStyle={s.content}>
        {items.length === 0 ? (
          <View style={s.empty}>
            <Icon name="tray-full" size={44} color={theme.color.textMuted} />
            <Text style={s.title}>{t('m.inb.empty')}</Text>
            <Text style={s.meta}>{t('m.inb.emptyBody')}</Text>
            <Btn label={t('m.class.capture')} icon="camera-burst" onPress={() => onCapture()} />
          </View>
        ) : (
          <>
            <Text style={s.label}>{t('m.inb.fileAs')}</Text>
            <KindBar selected={kind} onSelect={setKind} padded={false} />

            {progress && (
              <View style={s.progress}>
                <Text style={s.title}>
                  {t('m.inb.reading', { done: progress.done, total: progress.total })}
                </Text>
                <View style={s.bar}>
                  <View
                    style={[
                      s.barFill,
                      { width: `${(progress.done / Math.max(1, progress.total)) * 100}%` },
                    ]}
                  />
                </View>
                <Btn label={t('m.inb.stop')} kind="ghost" onPress={() => (stop.current = true)} />
              </View>
            )}

            <View style={s.grid}>
              {items.map((it, i) => {
                const st = nameOf(it.guessId);
                const okay = isReady(it);
                return (
                  <Pressable
                    key={it.id}
                    onPress={() => setOpenId(it.id)}
                    style={[
                      s.tile,
                      { width: tile, height: tile * 1.3 },
                      it.sorted && !okay && s.tileWarn,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${i + 1}. ${st?.name ?? viaText(it)}`}
                  >
                    <Image source={{ uri: it.uri }} style={{ flex: 1 }} resizeMode="cover" />
                    <View style={s.num}>
                      <Text style={s.numText}>{i + 1}</Text>
                    </View>
                    {flagged(it) && (
                      <View style={s.warnDot}>
                        <Icon name="alert" size={14} color="#fff" />
                      </View>
                    )}
                    <View
                      style={[
                        s.label2,
                        okay ? s.labelOk : it.sorted ? s.labelWarn : s.labelNeutral,
                      ]}
                    >
                      <Icon
                        name={
                          okay
                            ? 'check'
                            : it.sorted
                              ? 'account-question-outline'
                              : 'help-circle-outline'
                        }
                        size={13}
                        color="#fff"
                      />
                      <Text style={s.label2Text} numberOfLines={1}>
                        {st ? st.name : it.sorted ? t('m.inb.who') : t('m.inb.unread')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {review.length > 0 && (
              <Text style={s.meta}>{t('m.inb.reviewHint', { n: review.length })}</Text>
            )}
          </>
        )}
      </ScrollView>

      {items.length > 0 && (
        <View style={s.bottom}>
          {unsorted.length > 0 && (
            <Btn
              label={t('m.inb.read', { n: unsorted.length })}
              icon="account-search-outline"
              onPress={() => void readNames(unsorted)}
              disabled={!!progress}
            />
          )}
          <Btn
            label={t('m.inb.file', { n: ready.length })}
            icon="account-arrow-right-outline"
            kind={unsorted.length > 0 ? 'outline' : 'primary'}
            onPress={confirmFile}
            disabled={!!progress || ready.length === 0}
          />
        </View>
      )}

      <Sheet
        visible={!!open && !picking}
        onClose={() => setOpenId(null)}
        title={nameOf(open?.guessId)?.name ?? t('m.inb.who')}
      >
        {open && (
          <>
            <Image source={{ uri: open.uri }} style={s.big} resizeMode="contain" />
            <Pressable
              style={s.student}
              onPress={() => setPicking(true)}
              accessibilityRole="button"
            >
              <Icon
                name={isReady(open) ? 'account-check-outline' : 'account-question-outline'}
                size={28}
                color={isReady(open) ? theme.color.success : theme.color.warning}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>
                  {nameOf(open.guessId)
                    ? `${nameOf(open.guessId)!.name} · ${t('common.roll', { n: nameOf(open.guessId)!.rollNo })}`
                    : t('m.rev.chooseStudent')}
                </Text>
                <Text style={s.meta}>{viaText(open)}</Text>
              </View>
              <Text style={s.change}>{t('m.rev.change')}</Text>
            </Pressable>
            {open.guessId && !isReady(open) && (
              <Btn
                label={t('m.inb.confirm', { name: nameOf(open.guessId)?.name ?? '' })}
                icon="check"
                onPress={() => {
                  updateInbox(open.id, { guessConfidence: 1 });
                  setOpenId(null);
                }}
              />
            )}
            {open.quality && flagged(open) && (
              <View style={s.banner}>
                <Text style={s.name}>{t('m.rev.retakeThis')}</Text>
                {open.quality.issues.map((iss) => (
                  <View key={iss} style={{ flexDirection: 'row', gap: 8 }}>
                    <Icon name={ISSUE_TEXT[iss].icon} size={20} color={theme.color.warning} />
                    <Text style={[s.meta, { flex: 1, color: theme.color.text }]}>
                      <Text style={{ fontWeight: '700' }}>{t(`m.issue.${iss}` as TKey)}. </Text>
                      {t(`m.fix.${iss}` as TKey)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={s.tools}>
              <IconBtn
                icon="camera-retake-outline"
                label={t('m.rev.retake')}
                active={flagged(open)}
                onPress={() => {
                  setOpenId(null);
                  onCapture(open.id);
                }}
              />
              <IconBtn
                icon="rotate-right"
                label={t('m.rev.rotate')}
                onPress={() => void rotate(open)}
              />
              <IconBtn
                icon="trash-can-outline"
                label={t('m.rev.delete')}
                color={theme.color.danger}
                onPress={() =>
                  Alert.alert(t('m.inb.deleteTitle'), t('m.inb.deleteBody'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('m.rev.delete'),
                      style: 'destructive',
                      onPress: () => {
                        removeInbox([open.id], true);
                        setOpenId(null);
                      },
                    },
                  ])
                }
              />
            </View>
          </>
        )}
      </Sheet>

      <Sheet visible={picking} onClose={() => setPicking(false)} title={t('m.rev.whose')}>
        {roster.map((st) => (
          <Pressable
            key={st.id}
            style={s.pickRow}
            onPress={() => {
              if (open) updateInbox(open.id, { guessId: st.id, guessConfidence: 1, sorted: true });
              setPicking(false);
              setOpenId(null);
            }}
          >
            <Icon
              name={open?.guessId === st.id ? 'radiobox-marked' : 'radiobox-blank'}
              color={theme.color.primary}
            />
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials(st.name)}</Text>
            </View>
            <Text style={[s.name, { flex: 1 }]}>{st.name}</Text>
            <Text style={s.meta}>{t('common.roll', { n: st.rollNo })}</Text>
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl * 2 },
  empty: {
    alignItems: 'center',
    gap: 10,
    padding: theme.space.lg,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.color.text, textAlign: 'center' },
  meta: { fontSize: 13, color: theme.color.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: theme.color.textMuted },
  progress: {
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: 8,
  },
  bar: { height: 10, borderRadius: 5, backgroundColor: '#fff', overflow: 'hidden' },
  barFill: { height: 10, backgroundColor: theme.color.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ccc',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileWarn: { borderColor: theme.color.warning },
  num: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 5,
  },
  numText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  warnDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: theme.color.warning,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  labelOk: { backgroundColor: 'rgba(46,125,50,0.92)' },
  labelWarn: { backgroundColor: 'rgba(178,106,0,0.95)' },
  labelNeutral: { backgroundColor: 'rgba(0,0,0,0.6)' },
  label2Text: { flex: 1, color: '#fff', fontSize: 11, fontWeight: '700' },
  bottom: {
    padding: theme.space.md,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
  big: { width: '100%', height: 300, backgroundColor: '#1d1d1d', borderRadius: theme.radius.sm },
  student: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: theme.space.md,
    minHeight: 64,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
  },
  name: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  change: { color: theme.color.primary, fontWeight: '700' },
  banner: {
    backgroundColor: theme.color.warningBg,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: 6,
  },
  tools: { flexDirection: 'row', justifyContent: 'space-around' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: theme.color.primary, fontSize: 13 },
});
