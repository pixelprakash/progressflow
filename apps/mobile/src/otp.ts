import Constants from 'expo-constants';
import type { TKey } from '@progressflow/shared';

/**
 * Phone verification by one-time code. Real SMS goes through Firebase Phone Auth
 * when the build has google-services.json; otherwise it runs in demo mode (no SMS,
 * the code is DEMO_CODE) so the flow can be tried without a Firebase project.
 * Firebase is only used to prove the phone number: we sign out of it straight away
 * and keep our own local PIN account.
 */

export type OtpMode = 'firebase' | 'demo';
export const otpMode: OtpMode =
  (Constants.expoConfig?.extra as { otpMode?: OtpMode } | undefined)?.otpMode === 'firebase'
    ? 'firebase'
    : 'demo';

export const DEMO_CODE = '123456';
export const OTP_RE = /^\d{6}$/;
export const RESEND_SECONDS = 30;

export interface OtpSession {
  /** Resolves if the code is right, rejects with an OtpError otherwise. */
  confirm: (code: string) => Promise<void>;
  /** Android can read the SMS itself; `cb` fires when the number is verified without typing. */
  onAutoVerified: (cb: () => void) => () => void;
}

export class OtpError extends Error {
  constructor(public key: TKey) {
    super(key);
  }
}

function mapError(e: unknown): OtpError {
  const code = (e as { code?: string } | null)?.code ?? '';
  if (code.includes('invalid-verification-code') || code.includes('invalid-verification-id'))
    return new OtpError('m.otp.errCode');
  if (code.includes('code-expired') || code.includes('session-expired'))
    return new OtpError('m.otp.errExpired');
  if (code.includes('too-many-requests') || code.includes('quota'))
    return new OtpError('m.otp.errMany');
  if (code.includes('network')) return new OtpError('m.otp.errNet');
  if (code.includes('invalid-phone-number')) return new OtpError('login.err.mobile');
  return new OtpError('m.otp.errSend');
}

/** Sends a code to an E.164 number (+919876543210). */
export async function startOtp(phone: string): Promise<OtpSession> {
  if (otpMode === 'demo') {
    return {
      confirm: async (code) => {
        if (code !== DEMO_CODE) throw new OtpError('m.otp.errCode');
      },
      onAutoVerified: () => () => {},
    };
  }
  try {
    // Loaded only when configured, so a build without Firebase never touches the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const auth = (
      require('@react-native-firebase/auth') as typeof import('@react-native-firebase/auth')
    ).default;
    const confirmation = await auth().signInWithPhoneNumber(phone);
    return {
      confirm: async (code) => {
        try {
          await confirmation.confirm(code);
          await auth().signOut();
        } catch (e) {
          throw mapError(e);
        }
      },
      onAutoVerified: (cb) =>
        auth().onAuthStateChanged((user) => {
          if (user?.phoneNumber === phone) {
            void auth().signOut().finally(cb);
          }
        }),
    };
  } catch (e) {
    throw mapError(e);
  }
}
