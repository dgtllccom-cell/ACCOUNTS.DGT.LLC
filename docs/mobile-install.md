# DGT ERP on phones and tablets — DGT.llc B and DGT.llc BS

There is ONE ERP. Both store apps, the web site and the installable web app use the same server (`https://api.dgt.llc`, EPS Production),
the same login, the same permissions and the same database. Installing an app only puts an icon on the device; business data stays on the server.

| App | For | Android id | iOS bundle id |
|---|---|---|---|
| **DGT.llc B** | Business users | `com.dgtllc.b` | `com.dgtllc.b` |
| **DGT.llc BS** | Shipping Line and Clearing Agent users | `com.dgtllc.bs` | `com.dgtllc.bs` |

A login opened in the wrong app is shown a short notice (in the user's language) saying which app to use. Super Admin and logins with
both domains may use either app. What a login can see is always decided by its role, permissions and country/branch — never by the app.

## iPhone / iPad now — installable web app (no App Store needed)
1. Open **Safari** and go to `https://api.dgt.llc`, sign in once.
2. **Share** → **Add to Home Screen** → **Add**. Open the "DGT Group" icon: full-screen, stays signed in.
(The store apps for iPhone need a Mac + Apple Developer account: see `docs/store/README.md`.)

## Android phones and tablets (Samsung and others)
* **Test build:** copy `DGTllc-B-debug.apk` or `DGTllc-BS-debug.apk` to the phone, open it, allow "Install unknown apps" if asked. Debug-signed, for testing only.
* **Store build:** signed bundles `DGTllc-B-release.aab` / `DGTllc-BS-release.aab` are uploaded to Google Play and Samsung Galaxy Store by the company account.
* Or install the web app: Chrome → `https://api.dgt.llc` → ⋮ → **Install app**.
* No internet → a short offline page (English / Urdu / Arabic / Persian / Pashto) with Retry.

## For developers
```
node scripts/mobile-env.mjs production --release     # EPS Production, https only (the only target a store build may use)
node scripts/mobile-env.mjs local                    # developer PC localhost:3000 → debug builds only
npx cap sync android
set JAVA_HOME=...  set ANDROID_HOME=...  set DGTLLC_KEYSTORE_PROPERTIES=<keystore.properties outside the repo>
cd android && gradlew assembleBusinessDebug assembleShippingDebug bundleBusinessRelease bundleShippingRelease
```
macOS / iOS: `APPLE_TEAM_ID=… bash scripts/ios-build-apps.sh all`. Store pack, accounts and declarations: `docs/store/`.
Brand assets: `node scripts/generate-digitic-icons.mjs`. Channel check: `BASE=http://localhost:3260 node scripts/e2e-app-channel.mjs` (DEV server with `ALLOW_DEV_SESSION=true`).

## Remote access
The ERP is served over HTTPS at `api.dgt.llc`; the database stays on Supabase and no office or development service is exposed.
Local development (`localhost:3000`) is reachable only from the developer's own emulator/PC; a release build refuses it.
