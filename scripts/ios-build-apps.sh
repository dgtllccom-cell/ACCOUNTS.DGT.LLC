#!/usr/bin/env bash
# macOS ONLY (needs Xcode + an Apple Developer team). Builds both store apps from the one iOS project:
#   DGT.llc B  (com.dgtllc.b)   and   DGT.llc BS  (com.dgtllc.bs)
# Both talk to the ONE ERP (https://api.dgt.llc, EPS Production). Usage:
#   APPLE_TEAM_ID=ABCDE12345 bash scripts/ios-build-apps.sh [b|bs|all]      (default: all)
# Produces build/ios/<app>.xcarchive and, for App Store Connect / TestFlight, build/ios/<app>-export/*.ipa
set -euo pipefail
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID to your Apple Developer Team ID}"
which=${1:-all}
cd "$(dirname "$0")/.."
npm ci
node scripts/mobile-env.mjs production --release
mkdir -p build/ios
build_one() {
  key=$1; name=$2; bundle=$3; icon=$4
  cp "mobile/generated/capacitor.${key}.json" capacitor.config.json
  npx cap sync ios
  xcodebuild archive -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
    -archivePath "build/ios/${key}.xcarchive" -destination 'generic/platform=iOS' \
    DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates \
    PRODUCT_BUNDLE_IDENTIFIER="$bundle" APP_DISPLAY_NAME="$name" ASSETCATALOG_COMPILER_APPICON_NAME="$icon"
  cat > "build/ios/ExportOptions-${key}.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>${APPLE_TEAM_ID}</string>
  <key>destination</key><string>export</string>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
PLIST
  xcodebuild -exportArchive -archivePath "build/ios/${key}.xcarchive" -exportPath "build/ios/${key}-export" \
    -exportOptionsPlist "build/ios/ExportOptions-${key}.plist" -allowProvisioningUpdates
}
[[ $which == all || $which == b  ]] && build_one b  "DGT.llc B"  com.dgtllc.b  AppIcon
[[ $which == all || $which == bs ]] && build_one bs "DGT.llc BS" com.dgtllc.bs AppIcon-BS
echo "Upload the .ipa files with Transporter or: xcrun altool --upload-app (App Store Connect → TestFlight)."
