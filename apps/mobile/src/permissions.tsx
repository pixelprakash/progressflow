import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from './lang';
import { theme } from './theme';
import { Btn, Icon } from './components/ui';

/**
 * Camera and microphone access. The first time the app opens on a phone we
 * explain what each is for, then ask — so the system prompt never arrives
 * out of the blue in the middle of a scan. If it was refused, `useCameraAccess`
 * says so plainly and offers the settings page.
 */

const FILE = `${FileSystem.documentDirectory ?? ''}progressflow/permissions.json`;

async function wasAsked(): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(FILE)).exists;
  } catch {
    return false;
  }
}

async function markAsked() {
  try {
    await FileSystem.makeDirectoryAsync(FILE.replace(/[^/]+$/, ''), { intermediates: true });
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify({ asked: new Date().toISOString() }));
  } catch {
    // Asking again next launch is harmless.
  }
}

/** Gate for the first launch: renders the explainer until the teacher has answered. */
export function PermissionsGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'ask' | 'done'>('checking');
  useEffect(() => {
    void wasAsked().then((asked) => setState(asked ? 'done' : 'ask'));
  }, []);
  if (state === 'checking') return null;
  if (state === 'ask') return <PermissionsIntro onDone={() => setState('done')} />;
  return <>{children}</>;
}

function PermissionsIntro({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function allow() {
    setBusy(true);
    try {
      await Camera.requestCameraPermissionsAsync();
      await Audio.requestPermissionsAsync();
    } catch {
      // A refusal or an error both lead on; the app asks again, with an explanation, when needed.
    }
    await markAsked();
    onDone();
  }

  async function skip() {
    await markAsked();
    onDone();
  }

  const rows = [
    { icon: 'camera-outline', title: t('m.perm.camera'), body: t('m.perm.cameraBody') },
    { icon: 'microphone-outline', title: t('m.perm.mic'), body: t('m.perm.micBody') },
    { icon: 'shield-lock-outline', title: t('m.perm.private'), body: t('m.perm.privateBody') },
  ];

  return (
    <View style={[s.root, { paddingTop: insets.top + theme.space.lg }]}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>{t('m.perm.title')}</Text>
        <Text style={s.lead}>{t('m.perm.lead')}</Text>
        {rows.map((r) => (
          <View key={r.icon} style={s.row}>
            <View style={s.iconWrap}>
              <Icon name={r.icon} size={28} color={theme.color.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.rowTitle}>{r.title}</Text>
              <Text style={s.rowBody}>{r.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={[s.bottom, { paddingBottom: theme.space.md + insets.bottom }]}>
        <Btn label={t('m.perm.allow')} icon="check" onPress={() => void allow()} disabled={busy} />
        <Btn label={t('m.perm.later')} kind="ghost" onPress={() => void skip()} disabled={busy} />
      </View>
    </View>
  );
}

/**
 * `ensure()` resolves true when the camera can be used right now. It asks if it
 * still may; if the teacher refused for good, it explains and links to settings.
 */
export function useCameraAccess() {
  const { t } = useLang();
  return async function ensure(): Promise<boolean> {
    let p = await Camera.getCameraPermissionsAsync();
    if (p.granted) return true;
    if (p.canAskAgain) {
      p = await Camera.requestCameraPermissionsAsync();
      if (p.granted) return true;
    }
    Alert.alert(t('m.perm.deniedTitle'), t('m.perm.deniedBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('m.perm.openSettings'), onPress: () => void Linking.openSettings() },
    ]);
    return false;
  };
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.lg, gap: theme.space.lg },
  title: { fontSize: theme.font.display, fontWeight: '800', color: theme.color.text },
  lead: { fontSize: theme.font.body, color: theme.color.textMuted, lineHeight: 24 },
  row: { flexDirection: 'row', gap: theme.space.md, alignItems: 'flex-start' },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 17, fontWeight: '700', color: theme.color.text },
  rowBody: { fontSize: 15, color: theme.color.textMuted, lineHeight: 22 },
  bottom: { padding: theme.space.md, gap: theme.space.sm },
});
