# Digital Dock ERP Mobile App Readiness

## Brand

- App name: Digital Dock ERP
- App ID: `com.digitaldock.erp`
- Platforms: Android, iOS, iPadOS, tablets, desktop web, browser
- Shared login: same ERP user ID/password and the same backend APIs as the web ERP

## What Is Configured

- PWA manifest: `app/manifest.ts`
- App icons: `public/icons/digital-dock-icon.svg`, `public/icons/digital-dock-maskable.svg`
- Mobile metadata and install behavior: `app/layout.tsx`
- Capacitor base config: `capacitor.config.json`
- Package scripts:
  - `npm run mobile:prepare`
  - `npm run mobile:android`
  - `npm run mobile:ios`

## Required Native Build Tools

Android:

- Node.js dependencies installed
- Android Studio
- Java/JDK supported by Android Gradle
- Google Play upload key / keystore

IOS:

- macOS with Xcode
- Apple Developer account
- Bundle ID configured for `com.digitaldock.erp`
- App Store Connect / TestFlight access
- iOS signing certificate and provisioning profile

## Required Install Step

Install Capacitor packages before native builds:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
```

Then initialize/sync native projects:

```bash
npx cap add android
npx cap add ios
npm run mobile:prepare
```

## Android Build

```bash
npm run mobile:android
```

In Android Studio:

- Set app icon and adaptive icon from the `public/icons` assets.
- Configure signing under Build > Generate Signed Bundle / APK.
- Build Android App Bundle `.aab` for Google Play.

## iOS Build

```bash
npm run mobile:ios
```

In Xcode:

- Confirm Bundle ID: `com.digitaldock.erp`
- Configure signing team and provisioning profile.
- Archive and upload to TestFlight/App Store Connect.

## Production Notes

- `capacitor.config.json` currently points mobile shells to `https://erp.dgt.llc`.
- Replace this with the final production ERP URL before store submission.
- APK/AAB and IPA/TestFlight builds require local signing keys and store accounts. They cannot be produced safely without those credentials.