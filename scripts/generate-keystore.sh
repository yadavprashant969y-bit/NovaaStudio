#!/bin/bash
set -e

KEYSTORE_PATH="android/app/novacut-release-key.jks"
ALIAS_NAME="novacut_key"

echo "🔐 Generating Release Keystore for Google Play Store Upload..."
echo "Target file: $KEYSTORE_PATH"

keytool -genkey -v -keystore "$KEYSTORE_PATH" \
  -alias "$ALIAS_NAME" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "novacut123" \
  -keypass "novacut123" \
  -dname "CN=NovaCut Studio, OU=Mobile, O=NovaCut, L=City, ST=State, C=IN"

echo "✅ Keystore successfully generated at: $KEYSTORE_PATH"
echo "Alias: $ALIAS_NAME"
echo "Password: novacut123"
