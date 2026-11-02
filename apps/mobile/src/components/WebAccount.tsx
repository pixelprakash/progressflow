import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../auth';
import { useSync } from '../sync';
import { theme } from '../theme';
import { Btn, Chip, Icon } from './ui';

const DEFAULT_URL =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:4000';

const STATUS_TEXT: Record<string, string> = {
  idle: 'Up to date',
  syncing: 'Syncing…',
  offline: 'Waiting for a connection',
  signin: 'Sign in again',
  error: 'Needs attention',
};

/** Link this phone to the teacher's web account so classes and scans appear on a laptop. */
export function WebAccount() {
  const { current } = useAuth();
  const sync = useSync();
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
          <Text style={s.title}>Web account</Text>
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
          {STATUS_TEXT[sync.status] ?? ''}
          {sync.pending > 0 && sync.status !== 'syncing'
            ? ` · ${sync.pending} waiting to upload`
            : ''}
        </Text>
        {sync.message ? <Text style={s.hint}>{sync.message}</Text> : null}
        {sync.lastSyncAt ? (
          <Text style={s.hint}>
            Last synced {new Date(sync.lastSyncAt).toLocaleString('en-IN')}
          </Text>
        ) : null}
        <Btn
          label="Sync now"
          icon="sync"
          onPress={() => void sync.syncNow()}
          disabled={sync.status === 'syncing'}
        />
        <Btn label="Unlink this phone" kind="ghost" onPress={() => void sync.unlink()} />
      </View>
    );
  }

  return (
    <View style={s.box}>
      <View style={s.head}>
        <Icon name="laptop" size={22} color={theme.color.primary} />
        <Text style={s.title}>Web account</Text>
      </View>
      <Text style={s.hint}>
        See your classes, scans and scores on a laptop. Your data stays on this phone and uploads
        when connected.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip
          label="I have an account"
          selected={mode === 'login'}
          onPress={() => setMode('login')}
        />
        <Chip
          label="Create one"
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
        placeholder="Server address"
        placeholderTextColor={theme.color.textMuted}
        accessibilityLabel="Server address"
      />
      <TextInput
        style={s.input}
        value={mobile}
        onChangeText={(t) => setMobile(t.replace(/\D/g, '').slice(0, 10))}
        keyboardType="number-pad"
        placeholder="10-digit mobile"
        placeholderTextColor={theme.color.textMuted}
        accessibilityLabel="Mobile number"
      />
      <TextInput
        style={s.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={mode === 'register' ? 'Choose a web password (8+ characters)' : 'Web password'}
        placeholderTextColor={theme.color.textMuted}
        accessibilityLabel="Web password"
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Btn
        label={mode === 'register' ? 'Create and link' : 'Sign in and link'}
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
