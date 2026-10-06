#!/usr/bin/env bash
# =============================================================================
# Installs the Capacitor native plugins the Digital Dock ERP mobile shell uses.
# Run this ONCE on the machine that builds the Android / iOS apps, before the
# first `npx cap sync`. It is intentionally NOT part of the web `npm install`
# so the web / VPS deploy stays lean and lockfile-consistent.
#
#   bash scripts/mobile-plugins-install.sh
#
# All plugins are pinned to the Capacitor 8 line to match @capacitor/core.
# The web app only imports @capacitor/core; these add the NATIVE implementations
# that lib/mobile/native-bridge.ts reaches through Capacitor.registerPlugin().
# =============================================================================
set -e

PLUGINS=(
  "@capacitor/camera@^8"
  "@capacitor/push-notifications@^8"
  "@capacitor/network@^8"
  "@capacitor/app@^8"
  "@capacitor/status-bar@^8"
  "@capacitor/keyboard@^8"
  "@capacitor/splash-screen@^8"
  "@capacitor/share@^8"
  "@capacitor/filesystem@^8"
  "@capacitor/preferences@^8"
)

echo "Installing Capacitor native plugins: ${PLUGINS[*]}"
npm install "${PLUGINS[@]}"

echo
echo "Syncing native projects..."
npm run build
npx cap sync

echo
echo "Done. Next:"
echo "  Android : npx cap open android   (then build a signed .aab in Android Studio)"
echo "  iOS     : npx cap open ios        (then archive in Xcode -> TestFlight)"
