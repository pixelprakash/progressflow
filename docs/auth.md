# Teacher accounts (current: local, offline)

`apps/mobile/src/auth.tsx` — a teacher registers on the phone (name, school,
mobile, voice-note language, 4–6 digit PIN) and signs in with the PIN.

- PIN hash + salt: `expo-secure-store` (Android Keystore). 5 wrong tries, then
  30 s lockouts doubling up to 15 min.
- Profile: `progressflow/accounts.json`. Each teacher's classes/scans live in
  their own folder; the first teacher adopts data from the first release.
- The app re-locks after 5 minutes in the background, and on cold start after
  5 minutes of inactivity.
- Forgot PIN = erase that account's data on the phone (no recovery offline).

This is a device lock, **not** server authentication. Planned replacement:
Firebase phone-OTP (`RequestOtpBody` / `VerifyOtpBody` in `packages/shared`).
Swap `register` / `login` in `auth.tsx`; `Teacher` mirrors `User`.
