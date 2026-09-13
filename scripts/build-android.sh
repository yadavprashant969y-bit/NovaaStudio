#!/bin/bash
set -e

echo "🚀 [1/3] Copying latest web assets to www..."
mkdir -p www
cp -r index.html manifest.json css js assets www/ 2>/dev/null || true

echo "🔄 [2/3] Syncing Capacitor Android project..."
npx cap sync android

echo "📦 [3/3] Checking Gradle build environment..."
cd android
if [ -f "./gradlew" ]; then
  chmod +x ./gradlew
  echo "✅ Gradle Wrapper is ready."
  echo "To build a Debug APK: cd android && ./gradlew assembleDebug"
  echo "To build a Play Store Release Bundle (.aab): cd android && ./gradlew bundleRelease"
fi

echo "✨ NovaCut Android project is fully synced and ready!"
