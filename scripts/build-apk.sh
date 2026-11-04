#!/usr/bin/env bash
# Local Android build -> ~/Downloads/ProgressFlow/ProgressFlow-preview.apk
# Usage: scripts/build-apk.sh [--install]    (--install pushes it to a USB-connected phone)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/android-env.sh"
cd "$ROOT" && npm run build:shared >/dev/null && npx patch-package >/dev/null   # scanner: crop only, no filters (patches/)
cd "$ROOT/apps/mobile"
if [ ! -d android ]; then
  cp package.json /tmp/pf-package.json.bak
  CI=1 EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --no-install
  cp /tmp/pf-package.json.bak package.json   # prebuild rewrites the android/ios scripts
fi
cd android
NODE_ENV=production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
OUT="$HOME/Downloads/ProgressFlow"; mkdir -p "$OUT"
cp app/build/outputs/apk/release/app-release.apk "$OUT/ProgressFlow-preview.apk"
echo "APK: $OUT/ProgressFlow-preview.apk"
if [ "${1:-}" = "--install" ]; then adb install -r "$OUT/ProgressFlow-preview.apk"; fi
