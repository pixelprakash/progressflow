import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Language } from '@progressflow/shared';
import { MOBILE_RE, PIN_RE, useAuth, weakPin } from '../auth';
import type { Teacher } from '../auth';
import { theme } from '../theme';
import { Btn, Chip, Icon } from '../components/ui';
import { initials } from '../domain';

const LANGS: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
];

type Mode = 'pick' | 'pin' | 'register';

/** Sign in (pick a teacher, enter PIN) or create a local teacher account. */
export function AuthScreen() {
  const { accounts, login, register, removeAccount } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(accounts.length ? 'pick' : 'register');
  const [who, setWho] = useState<Teacher | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // login
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // register
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [mobile, setMobile] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [agree, setAgree] = useState(false);

  const go = (m: Mode) => {
    setMode(m);
    setError('');
    setPin('');
  };

  async function signIn() {
    if (!who) return;
    setBusy(true);
    const r = await login(who.id, pin);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      setPin('');
    }
  }

  async function create() {
    const m = mobile.replace(/\s/g, '');
    const problem =
      name.trim().length < 2
        ? 'Enter your name.'
        : school.trim().length < 2
          ? 'Enter your school.'
          : !MOBILE_RE.test(m)
            ? 'Enter a 10-digit Indian mobile number.'
            : accounts.some((a) => a.phone === `+91${m}`)
              ? 'That number already has an account on this phone.'
              : !PIN_RE.test(pin1)
                ? 'PIN must be 4 to 6 digits.'
                : weakPin(pin1)
                  ? 'Choose a PIN that is not repeated or in sequence.'
                  : pin1 !== pin2
                    ? 'The two PINs do not match.'
                    : !agree
                      ? 'Please confirm the permission statement.'
                      : '';
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await register({ name, school, mobile: m, language, pin: pin1 });
    } catch {
      setError('Could not create the account. Please try again.');
      setBusy(false);
    }
  }

  function forgot() {
    if (!who) return;
    Alert.alert(
      'Forgot your PIN?',
      `A PIN cannot be recovered on this phone. You can erase ${who.name}'s account and all its scans and scores from this phone, then register again.\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase account',
          style: 'destructive',
          onPress: () => {
            void removeAccount(who.id).then(() => go(accounts.length > 1 ? 'pick' : 'register'));
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          s.content,
          {
            paddingTop: insets.top + theme.space.xl,
            paddingBottom: insets.bottom + theme.space.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.brand}>
          <View style={s.logo}>
            <Icon name="palette-swatch-outline" size={34} color="#fff" />
          </View>
          <Text style={s.title}>ProgressFlow</Text>
          <Text style={s.tag}>Formative assessment for art & design</Text>
        </View>

        {mode === 'pick' && (
          <View style={s.form}>
            <Text style={s.h}>Who is teaching?</Text>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                style={s.account}
                onPress={() => {
                  setWho(a);
                  go('pin');
                }}
                accessibilityRole="button"
                accessibilityLabel={`Sign in as ${a.name}`}
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials(a.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{a.name}</Text>
                  <Text style={s.meta}>{a.school}</Text>
                </View>
                <Icon name="chevron-right" color={theme.color.textMuted} />
              </Pressable>
            ))}
            <Btn
              label="Create a new account"
              icon="account-plus-outline"
              kind="outline"
              onPress={() => go('register')}
            />
          </View>
        )}

        {mode === 'pin' && who && (
          <View style={s.form}>
            <View style={s.account}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials(who.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{who.name}</Text>
                <Text style={s.meta}>{who.school}</Text>
              </View>
            </View>
            <Text style={s.label}>PIN</Text>
            <View style={s.pinRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={pin}
                onChangeText={(t) => {
                  setPin(t.replace(/\D/g, ''));
                  setError('');
                }}
                secureTextEntry={!showPin}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                placeholder="4–6 digits"
                placeholderTextColor={theme.color.textMuted}
                onSubmitEditing={() => void signIn()}
                accessibilityLabel="PIN"
              />
              <Pressable
                onPress={() => setShowPin((v) => !v)}
                style={s.eye}
                accessibilityLabel={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                <Icon name={showPin ? 'eye-off-outline' : 'eye-outline'} />
              </Pressable>
            </View>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Btn
              label="Sign in"
              icon="login"
              onPress={() => void signIn()}
              disabled={busy || !PIN_RE.test(pin)}
            />
            <Pressable onPress={forgot} hitSlop={8}>
              <Text style={s.link}>Forgot PIN?</Text>
            </Pressable>
            <Pressable onPress={() => go('pick')} hitSlop={8}>
              <Text style={s.link}>Not you? Choose another teacher</Text>
            </Pressable>
          </View>
        )}

        {mode === 'register' && (
          <View style={s.form}>
            <Text style={s.h}>Create your account</Text>
            <Field
              label="Your name"
              value={name}
              onChange={setName}
              placeholder="e.g. Lakshmi Rao"
              cap="words"
            />
            <Field
              label="School"
              value={school}
              onChange={setSchool}
              placeholder="School name"
              cap="words"
            />
            <Text style={s.label}>Mobile number</Text>
            <View style={s.pinRow}>
              <View style={s.prefix}>
                <Text style={s.prefixText}>+91</Text>
              </View>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={mobile}
                onChangeText={(t) => setMobile(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="10-digit number"
                placeholderTextColor={theme.color.textMuted}
                accessibilityLabel="Mobile number"
              />
            </View>
            <Text style={s.label}>Voice-note language</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {LANGS.map((l) => (
                <Chip
                  key={l.code}
                  label={l.label}
                  selected={language === l.code}
                  onPress={() => setLanguage(l.code)}
                />
              ))}
            </View>
            <Text style={s.hint}>
              Used as the default for voice notes. The app screens are English for now.
            </Text>
            <Field
              label="Create a PIN (4–6 digits)"
              value={pin1}
              onChange={(t) => setPin1(t.replace(/\D/g, ''))}
              secure
              max={6}
              numeric
            />
            <Field
              label="Confirm PIN"
              value={pin2}
              onChange={(t) => setPin2(t.replace(/\D/g, ''))}
              secure
              max={6}
              numeric
            />
            <Pressable
              style={s.agree}
              onPress={() => setAgree((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agree }}
            >
              <Icon
                name={agree ? 'checkbox-marked' : 'checkbox-blank-outline'}
                color={theme.color.primary}
                size={26}
              />
              <Text style={s.agreeText}>
                My school has permitted me to photograph and record students' work in this app.
              </Text>
            </Pressable>
            <Text style={s.hint}>
              Your account is stored on this phone and locks the app. It is not recoverable if you
              forget the PIN.
            </Text>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Btn
              label="Create account"
              icon="check"
              onPress={() => void create()}
              disabled={busy}
            />
            {accounts.length > 0 && (
              <Pressable onPress={() => go('pick')} hitSlop={8}>
                <Text style={s.link}>I already have an account</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  cap,
  secure,
  numeric,
  max,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  cap?: 'words';
  secure?: boolean;
  numeric?: boolean;
  max?: number;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textMuted}
        autoCapitalize={cap ?? 'none'}
        secureTextEntry={secure}
        keyboardType={numeric ? 'number-pad' : 'default'}
        maxLength={max}
        accessibilityLabel={label}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  content: { paddingHorizontal: theme.space.lg, gap: theme.space.lg },
  brand: { alignItems: 'center', gap: 6 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: theme.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: theme.font.display, fontWeight: '800', color: theme.color.text },
  tag: { fontSize: 14, color: theme.color.textMuted },
  form: { gap: theme.space.md },
  h: { fontSize: theme.font.title, fontWeight: '700', color: theme.color.text },
  label: { fontSize: 13, fontWeight: '700', color: theme.color.textMuted },
  hint: { fontSize: 13, color: theme.color.textMuted },
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
  pinRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  eye: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  prefix: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: { fontSize: theme.font.body, fontWeight: '700', color: theme.color.text },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    padding: theme.space.md,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
  },
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
  error: { color: theme.color.danger, fontWeight: '600' },
  link: { color: theme.color.primary, fontWeight: '700', textAlign: 'center', paddingVertical: 6 },
  agree: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', minHeight: 48 },
  agreeText: { flex: 1, fontSize: 14, color: theme.color.text },
});
