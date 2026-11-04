import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { classLabel } from '../domain';
import { useLang } from '../lang';
import { moveMedia, newId, useStore } from '../store';
import { theme } from '../theme';
import { Btn, Icon } from '../components/ui';

/**
 * Photograph a whole stack of papers one after another, with no review in
 * between. Each shot is the camera's own full-size JPEG, untouched — no
 * cropping, filters or enhancement — and goes straight into the class's inbox,
 * so nothing is lost if the phone is put away. Names are read and papers
 * filed later, from the inbox.
 */
export function BatchCaptureScreen({
  classId,
  replaceId,
  onDone,
}: {
  classId: string;
  /** Retake: the first shot replaces this inbox photo and the camera closes. */
  replaceId?: string;
  onDone: () => void;
}) {
  const { data, addInbox, removeInbox } = useStore();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [perm, requestPerm, refreshPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [flash, setFlash] = useState(false);
  const [shots, setShots] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const klass = data.classes.find((c) => c.id === classId);

  // Coming back from the phone's settings page: pick up the new permission without a restart.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void refreshPerm();
    });
    return () => sub.remove();
  }, [refreshPerm]);

  if (!perm) return <View style={s.root} />;

  if (!perm.granted) {
    return (
      <View style={[s.root, s.center, { paddingTop: insets.top }]}>
        <Icon name="camera-outline" size={56} color="#fff" />
        <Text style={s.permTitle}>{t('m.perm.camera')}</Text>
        <Text style={s.permBody}>
          {perm.canAskAgain ? t('m.perm.cameraBody') : t('m.perm.deniedBody')}
        </Text>
        <View style={{ gap: 8, alignSelf: 'stretch', paddingHorizontal: theme.space.lg }}>
          {perm.canAskAgain ? (
            <Btn label={t('m.perm.allow')} icon="check" onPress={() => void requestPerm()} />
          ) : (
            // Android stops showing the prompt after repeated refusals; settings is the only way back.
            <Btn
              label={t('m.perm.openSettings')}
              icon="cog-outline"
              onPress={() => void Linking.openSettings()}
            />
          )}
          <Btn label={t('common.back')} kind="outline" onPress={onDone} />
        </View>
      </View>
    );
  }

  async function shoot() {
    if (busy || !cam.current) return;
    setBusy(true);
    setError(false);
    try {
      // quality 1 and no processing: the file is what the sensor produced.
      const pic = await cam.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
        exif: false,
      });
      if (!pic) throw new Error('no picture');
      const uri = await moveMedia(pic.uri, 'inbox', 'jpg');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      addInbox([
        {
          id: newId(),
          classId,
          uri,
          width: pic.width,
          height: pic.height,
          createdAt: new Date().toISOString(),
        },
      ]);
      setLast(uri);
      setShots((n) => n + 1);
      if (replaceId) {
        removeInbox([replaceId], true);
        onDone();
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <CameraView
        ref={cam}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash ? 'on' : 'off'}
      />
      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onDone} style={s.round} accessibilityLabel={t('common.back')}>
          <Icon name="close" color="#fff" size={26} />
        </Pressable>
        <View style={s.pill}>
          <Text style={s.pillText}>
            {klass ? t('common.class', { label: classLabel(klass) }) : ''} · {t('m.cap.original')}
          </Text>
        </View>
        <Pressable
          onPress={() => setFlash((f) => !f)}
          style={s.round}
          accessibilityRole="switch"
          accessibilityState={{ checked: flash }}
          accessibilityLabel={t('m.cap.flash')}
        >
          <Icon name={flash ? 'flash' : 'flash-off'} color="#fff" size={24} />
        </Pressable>
      </View>

      <View style={s.guide} pointerEvents="none">
        <Text style={s.guideText}>{replaceId ? t('m.cap.retakeHint') : t('m.cap.hint')}</Text>
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {error && <Text style={s.error}>{t('m.cap.fail')}</Text>}
        <View style={s.controls}>
          <View style={s.side}>
            {last ? (
              <Image source={{ uri: last }} style={s.thumb} />
            ) : (
              <View style={[s.thumb, { opacity: 0.3 }]} />
            )}
            {shots > 0 && (
              <View style={s.count}>
                <Text style={s.countText}>{shots}</Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={() => void shoot()}
            disabled={busy}
            style={[s.shutter, busy && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={t('m.cap.shutter')}
          >
            <View style={s.shutterInner} />
          </Pressable>
          <View style={s.side}>
            <Btn
              label={shots > 0 ? t('m.cap.done', { n: shots }) : t('common.back')}
              kind={shots > 0 ? 'primary' : 'outline'}
              onPress={onDone}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: theme.space.md },
  permTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  permBody: {
    color: '#ddd',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: theme.space.lg,
    lineHeight: 23,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  guide: { position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center' },
  guideText: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    fontSize: 14,
    overflow: 'hidden',
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: 16,
    gap: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  side: { width: 110, alignItems: 'center' },
  thumb: {
    width: 64,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  count: {
    position: 'absolute',
    top: -8,
    right: 8,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: '#fff', fontWeight: '800' },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  error: { color: '#ffb4ab', textAlign: 'center', fontWeight: '600' },
});
