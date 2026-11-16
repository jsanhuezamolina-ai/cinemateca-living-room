#!/usr/bin/env bash
# Compila la web (dist/), la copia a los assets de Android y genera el APK de depuración.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run build
rm -rf android/app/src/main/assets
mkdir -p android/app/src/main/assets
cp -r dist/. android/app/src/main/assets/   # index.html queda en assets/ (URL /assets/index.html)
cd android
./gradlew assembleDebug
echo "APK: $(pwd)/app/build/outputs/apk/debug/app-debug.apk"
