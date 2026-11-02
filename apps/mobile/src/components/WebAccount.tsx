import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../auth';
import type { TKey } from '@progressflow/shared';
import { useLang } from '../lang';
import { useSync } from '../sync';
import { theme } from '../theme';
import { Btn, Chip, Icon } from './ui';

const DEFAULT_URL =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:4000';

const STATUS_KEY: Record<string, TKey> = {
  idle: 'm.web.idle',
  syncing: 'm.web.syncing',
  offline: 'm.web.offline',
  signin: 'm.web.signin',
  error: 'm.web.error',
};

/** Messages from the sync code are either dictionary keys (ours) or plain text (from the server). */
const KEYED = /^(m|login)\.[\w.]+$/;

/** Link this phone to the teacher's web account so classes and scans appear on a laptop. */
export function WebAccount() {
  const { current } = useAuth();
  const sync = useSync();
  const { t } = useLang();
  const say = (m: string) => (KEYED.test(m) ? t(m as TKey) : m);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [url, setUrl] = useState(DEFAULT_URL);
  const [mobile, setMobile] = useState(current?.phone.replace('+91', '') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    setError('');
    const err = await sync.link({ serverUrl: url, mode, mobile, password });
    setBusy(false);
    if (err) setError(err);
    else {
      setPassword('');
      void sync.syncNow();
    }
  }

  if (sync.linked) {
    return (
      <View style={s.box}>
        <View style={s.head}>
          <Icon name="laptop" size={22} color={theme.color.primary} />
          <Text style={s.title}>{t('m.web.title')}</Text>
        </View>
        <Text style={s.line}>
          {sync.accountName} · {sync.serverUrl}
        </Text>
        <Text
          style={[
            s.line,
            (sync.status === 'error' || sync.status === 'signin') && { color: theme.color.danger },
          ]}
        >
          {STATUS_KEY[sync.status] ? t(STATUS_KEY[sync.status]!) : ''}
          {sync.pending > 0 && sync.status !== 'syncing'
            ? ` · ${t('m.web.pending', { n: sync.pending })}`
            : ''}
        </Text>
        {sync.message ? <Text style={s.hint}>{say(sync.message)}</Text> : null}
        {sync.lastSyncAt ? (
          <Text style={s.hint}>
            {t('m.web.last', { t: new Date(sync.lastSyncAt).toLocaleString() })}
          </Text>
        ) : null}
        <Btn
          label={t('m.web.syncNow')}
          icon="sync"
          onPress={() => void sync.syncNow()}
          disabled={sync.status === 'syncing'}
        />
        <Btn label={t('m.web.unlink')} kind="ghost" onPress={() => void sync.unlink()} />
      </View>
    );
  }

  return (
    <View style={s.box}>
      <View style={s.head}>
        <Icon name="laptop" size={22} color={theme.color.primary} />
        <Text style={s.title}>{t('m.web.title')}</Text>
      </View>
      <Text style={s.hint}>{t('m.web.intro')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip
          label={t('m.web.have')}
          selected={mode === 'login'}
          onPress={() => setMode('login')}
        />
        <Chip
          label={t('m.web.createOne')}
          selected={mode === 'register'}
          onPress={() => setMode('register')}
        />
      </View>
      <TextInput
        style={s.input}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder={t('m.web.server')}
        placeholderTextColor={theme.color.textMuted}
        accessibilityLabel={t('m.web.server')}
      />
      <TextInput
        style={s.input}
        value={mobile}
        onChangeText={(t) => setMobile(t.replace(/\D/g, '').slice(0, 10))}
        keyboardType="number-pad"
        placeholder={t('m.auth.mobilePh')}
        placeholderTextColor={theme.color.textMuted}
        accessibilityLabel={t('login.mobile')}
      />
      <TextInput
        style={s.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={mode === 'register' ? t('m.web.pwNew') : t('m.web.pw')}
        placeholderTextColor={theme.color.textMuted}
        accessibilityLabel={t('m.web.pw')}
      />
      {error ? <Text style={s.error}>{say(error)}</Text> : null}
      <Btn
        label={mode === 'register' ? t('m.web.createLink') : t('m.web.signLink')}
        icon="link-variant"
        onPress={() => void connect()}
        disabled={busy}
      />
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    gap: theme.space.sm,
    padding: theme.space.md,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: theme.color.text },
  line: { fontSize: theme.font.body, color: theme.color.text },
  hint: { fontSize: 13, color: theme.color.textMuted },
  error: { color: theme.color.danger, fontWeight: '600' },
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
