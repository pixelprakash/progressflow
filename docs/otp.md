# Phone OTP (mobile app)

Used for two things: confirming a teacher's phone number at registration, and resetting a
forgotten PIN **without erasing the account's data**. Offline-first still holds: a teacher with no
connection can skip the code at registration ("Skip for now") and verify later from the account
sheet. Resetting a PIN needs a connection, because the code has to arrive.

The OTP proves the number only. The account is still the local PIN account in `src/auth.tsx`;
Firebase is signed out of straight after the code is checked.

## Modes (`src/otp.ts`)

| Build has `apps/mobile/google-services.json`? | Mode | Behaviour |
| --- | --- | --- |
| No | `demo` | No SMS. The code is `123456`, and the screen says so. Builds always succeed. |
| Yes | `firebase` | Real SMS through Firebase Phone Auth. |

`app.config.js` picks the mode and adds the `@react-native-firebase/app` plugin only when the file exists.

## Switching on real SMS

1. Firebase console → create a project → add an Android app with package `in.ac.iith.des.progressflow`.
2. Add the signing fingerprints to that Android app (Project settings → Your apps). For the current
   build, which is signed with `android/app/debug.keystore`:
   - SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
   - SHA-256 `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`
   A real release keystore (needed for the Play Store) has its own fingerprints; add those too.
3. Authentication → Sign-in method → enable **Phone**. Optionally add test numbers
   (Authentication → Phone → "Phone numbers for testing") so you can try it without sending SMS.
4. Download `google-services.json` into `apps/mobile/` (it is git-ignored; do not commit it).
5. Rebuild from a fresh prebuild so the Google services plugin is applied:
   `cd apps/mobile && npx expo prebuild --platform android --no-install`, then `npm run build:apk`.
   (The existing `android/` folder was generated before Firebase was added.)
6. If SMS is blocked as "app not authorized", enable the Play Integrity API for the Firebase
   project's Google Cloud project.

Costs: Firebase Phone Auth has a small free monthly quota, then charges per SMS (Indian numbers
included). Set a daily SMS quota in the console. iOS needs `GoogleService-Info.plist` and is not set up.
