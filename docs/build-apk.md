# Build the Android APK

## Local build (set up on this Mac)

JDK 17 lives in `~/dev-tools/jdk17`, the Android SDK in `~/Library/Android/sdk`
(paths are set by `scripts/android-env.sh`; your shell profile is untouched).

```bash
npm run build:apk                  # -> ~/Downloads/ProgressFlow/ProgressFlow-preview.apk
scripts/build-apk.sh --install     # also installs on a USB-connected phone
```

First build ~8 min, later ones under a minute. arm64 only, debug-signed: fine
for testing, not for Google Play. `apps/mobile/android/` is generated and gitignored.

## Cloud build (alternative, no local SDK)

The app uses native modules (ML Kit document scanner, OCR, audio), so it does
**not** run in Expo Go. EAS Build compiles it in the cloud and gives you an
APK link. Free Expo account is enough.

One-time, from the repo root:

```bash
git add -A && git commit -m "Scanner, review, rubric, annotations"   # EAS builds from git
cd apps/mobile
npx eas-cli login                    # your Expo account
npx eas-cli init                     # creates the project, writes the id into app.json
npx eas-cli build -p android --profile preview
```

The build takes ~15–20 minutes. When it finishes EAS prints a link and QR code;
open it on the phone, download the `.apk`, and allow "install unknown apps".

## What to test on the phone

1. **Scan artwork** → the system scanner opens with live edge detection. Scan
   3–4 pages (write `Roll No: 2` and a name in block letters on a few).
2. Review screen: check the quality banner, retake a deliberately blurry
   page, confirm the student chip is right, **Save**.
3. Evaluate: tap **Hint** on each rubric row; score; **Mark up** and flip the
   **Markup** switch off/on; record a voice note; attach an image, link, note.
4. Home → a student → progress chart and portfolio.

## Tuning (expected)

Thresholds in `src/capture/quality.ts` were calibrated on synthetic pages
(sharp 2.4–3.1, mild blur ~0.09, heavy blur ~0.01; threshold 0.3) and one real
scan (3.05). Real classroom photos may differ: the review screen prints the raw
readings under each scan, so note a good and a bad one and adjust `THRESHOLDS`.

## Needs Google Play services

The scanner is Google's ML Kit. Phones without Play services fall back to the
plain camera (no live edge detection).
