# Digital Dock ERP — Android & iOS App (Build & Release Runbook)

## Architecture decision (do not re-litigate)

The mobile apps are a **Capacitor 8 native shell around the existing responsive ERP
web app**. There is **one backend, one auth system, one permission model, one i18n
dictionary, one set of business/accounting rules** — the apps load
`https://api.dgt.llc` and reuse every `/api/erp/**` endpoint with the same cookie
session as the browser.

- ❌ No second ERP backend. ❌ No duplicated accounting/permission logic on device.
- ✅ Sensitive rules stay server-side and are enforced there (`requireErpSession`,
  `authorizeApiScope`, scope middleware) exactly as for the web.
- ✅ Native capabilities (camera, push, offline, status bar, hardware back) are added
  through a single bridge — `lib/mobile/native-bridge.ts` — that is a **no-op on the
  web/PWA**, so the same codebase serves web, installable PWA, Android and iOS.

Native projects already exist: `android/` (applicationId `com.digitaldock.erp`,
compileSdk 36, minSdk 24) and `ios/` (`ios/App`, display name "Digital Dock ERP").

## What is wired in this repo

| Piece | File |
|---|---|
| Capacitor config (appId, HTTPS server URL, SplashScreen/StatusBar/Keyboard/Push) | `capacitor.config.json` |
| Native bridge (camera, network, back button, status bar, push token) | `lib/mobile/native-bridge.ts` |
| Native shell mounted in dashboard (status bar theming, Android back, offline banner, push register) | `components/layout/native-app-shell.tsx` (mounted in `components/layout/dashboard-shell.tsx`) |
| Native camera in AI Document Intake upload | `features/document-intelligence/components/document-intake-center.tsx` |
| Push token endpoint (already existed) | `app/api/erp/mobile/push/route.ts` → `lib/services/mobile-push-service.ts` |
| Mobile auto-sync endpoint (already existed) | `app/api/erp/mobile/sync/route.ts` |
| Android permissions (INTERNET, CAMERA, POST_NOTIFICATIONS, READ_MEDIA_IMAGES, NETWORK_STATE) | `android/app/src/main/AndroidManifest.xml` |
| iOS usage strings (camera, photo library, remote-notification background mode) | `ios/App/App/Info.plist` |
| PWA manifest + icons | `app/manifest.ts`, `public/icons/*` |
| Plugin install helper | `scripts/mobile-plugins-install.sh` |
| 5-language: whole app (native shell strings in `mbl.*` / `dintake.*`, RTL via `dir`) | `lib/i18n/ui.ts` |

The narrow **"AI Mobile – Return WhatsApp Reply"** screen (`app/mobile`,
`features/mobile/*`) is a **separate deliberate sub-feature** of the Return-SMS-Reply
module — it is not the ERP app shell and is left as-is.

## Build steps (owner / release engineer)

### 0. One-time: install native plugins
```bash
bash scripts/mobile-plugins-install.sh
```
This installs `@capacitor/{camera,push-notifications,network,app,status-bar,keyboard,splash-screen,share,filesystem,preferences}` (pinned to `^8`), builds, and runs `npx cap sync`.

### 1. Android (needs Android Studio + JDK 21)
```bash
npm run mobile:android      # next build + cap sync android + cap open android
```
In Android Studio:
- Build → Generate Signed Bundle / APK → **Android App Bundle (.aab)**
- Signing: use the Play upload keystore (OWNER ACTION — see below)
- Upload the `.aab` to Google Play Console → Internal testing → Production

### 2. iOS (needs macOS + Xcode + Apple Developer account)
```bash
npm run mobile:ios          # next build + cap sync ios + cap open ios
```
In Xcode:
- Signing & Capabilities → Team = your Apple Developer team; Bundle ID `com.digitaldock.erp`
- Add capability **Push Notifications** and **Background Modes → Remote notifications**
- Product → Archive → Distribute App → App Store Connect → TestFlight → App Store

### 3. Push notifications (FCM / APNs)
- Android: create a Firebase project, add `google-services.json` to `android/app/`,
  add the FCM server key to the ERP env as `MOBILE_PUSH_FCM_KEY` (consumed by
  `lib/services/mobile-push-service.ts`).
- iOS: create an APNs auth key (.p8) in the Apple Developer portal; upload it to
  Firebase (or wire APNs directly) and set `MOBILE_PUSH_APNS_KEY_ID` /
  `MOBILE_PUSH_APNS_TEAM_ID` / `MOBILE_PUSH_APNS_KEY` in the ERP env.

## OWNER ACTIONS (cannot be done from this environment)

1. **Google Play Console account** + an **upload keystore** (`.jks`) kept private.
2. **Apple Developer Program** membership ($99/yr) + a **macOS machine with Xcode**
   (iOS apps cannot be compiled or signed on Windows/Linux).
3. **Firebase project** + `google-services.json` + FCM server key for Android push.
4. **APNs auth key** (.p8) for iOS push.
5. App Store / Play Store **listing assets**: screenshots (per device size),
   description (5 languages welcome), privacy policy URL, support URL, app icon 512².
6. Confirm the production ERP URL is `https://api.dgt.llc` (set in
   `capacitor.config.json`) — change here if it differs.

Once 1–4 are supplied, `mobile:android` / `mobile:ios` produce store-ready builds
with no further code changes.

## Verification done in-repo

- `npx tsc --noEmit` 0, `npm run build` 0, `npm run i18n:guard` green.
- Bridge is inert on web: `isNativeApp()` is `false` in the browser, every native
  call short-circuits, the offline banner never renders, no web UX change.
- `capacitor.config.json` validates (`npx cap sync` dry parse).
