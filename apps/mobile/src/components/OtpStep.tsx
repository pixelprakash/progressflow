import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLang } from '../lang';
import { DEMO_CODE, OTP_RE, OtpError, RESEND_SECONDS, otpMode, startOtp } from '../otp';
import type { OtpSession } from '../otp';
import { theme } from '../theme';
import { Btn, Icon } from './ui';

/**
 * Sends a six-digit code to `phone` and waits for it. Calls `onVerified` when the
 * number is confirmed. `onSkip` (registration only) lets a teacher carry on without
 * a connection — the app is offline-first, so a code is never required to start work.
 */
export function OtpStep({
  phone,
  onVerified,
  onSkip,
  onBack,
  backLabel,
}: {
  phone: string;
  onVerified: () => void;
  onSkip?: () => void;
  onBack: () => void;
  backLabel?: string;
}) {
  const { t } = useLang();
  const session = useRef<OtpSession | null>(null);
  const [state, setState] = useState<'sending' | 'ready' | 'failed'>('sending');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [round, setRound] = useState(0);

  // Send on arrival, and again each time "Send again" is pressed.
  useEffect(() => {
    let cancelled = false;
    let stopWatching = () => {};
    setState('sending');
    setError('');
    setWait(RESEND_SECONDS);
    startOtp(phone)
      .then((s) => {
        if (cancelled) return;
        session.current = s;
        setState('ready');
        stopWatching = s.onAutoVerified(onVerified);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState('failed');
        setError(t(e instanceof OtpError ? e.key : 'm.otp.errSend'));
      });
    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [phone, round]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function verify() {
    if (!session.current || !OTP_RE.test(code)) return;
    setBusy(true);
    setError('');
    try {
      await session.current.confirm(code);
      onVerified();
    } catch (e) {
      setError(t(e instanceof OtpError ? e.key : 'm.otp.errCode'));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.h}>{t('m.otp.title')}</Text>
      <Text style={s.body}>
        {state === 'sending'
          ? t('m.otp.sending', { phone })
          : state === 'failed'
            ? t('m.otp.failed')
            : t('m.otp.sent', { phone })}
      </Text>
      {otpMode === 'demo' && (
        <View style={s.demo}>
          <Icon name="information-outline" size={18} color={theme.color.warning} />
          <Text style={s.demoText}>{t('m.otp.demo', { code: DEMO_CODE })}</Text>
        </View>
      )}
      {state === 'ready' && (
        <TextInput
          style={s.input}
          value={code}
          onChangeText={(x) => {
            setCode(x.replace(/\D/g, '').slice(0, 6));
            setError('');
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          placeholder="••••••"
          placeholderTextColor={theme.color.textMuted}
          onSubmitEditing={() => void verify()}
          accessibilityLabel={t('m.otp.code')}
        />
      )}
      {error ? <Text style={s.error}>{error}</Text> : null}
      {state === 'ready' && (
        <Btn
          label={t('m.otp.verify')}
          icon="check"
          onPress={() => void verify()}
          disabled={busy || !OTP_RE.test(code)}
        />
      )}
      <Pressable
        onPress={() => setRound((r) => r + 1)}
        disabled={state === 'sending' || wait > 0}
        hitSlop={8}
        style={{ opacity: state === 'sending' || wait > 0 ? 0.5 : 1 }}
      >
        <Text style={s.link}>
          {wait > 0 ? t('m.otp.resendIn', { n: wait }) : t('m.otp.resend')}
        </Text>
      </Pressable>
      {onSkip && (
        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={s.link}>{t('m.otp.skip')}</Text>
        </Pressable>
      )}
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={s.link}>{backLabel ?? t('m.otp.change')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: theme.space.md },
  h: { fontSize: 22, fontWeight: '700', color: theme.color.text },
  body: { fontSize: theme.font.body, color: theme.color.textMuted, lineHeight: 23 },
  demo: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: theme.color.warningBg,
    borderRadius: theme.radius.sm,
    padding: 10,
  },
  demoText: { flex: 1, fontSize: 13, color: theme.color.text },
  input: {
    minHeight: 64,
    backgroundColor: '#fff',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: 12,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    fontWeight: '700',
    color: theme.color.text,
  },
  error: { color: theme.color.danger, fontSize: 14, fontWeight: '600' },
  link: { color: theme.color.primary, fontWeight: '600', textAlign: 'center', fontSize: 15 },
});
