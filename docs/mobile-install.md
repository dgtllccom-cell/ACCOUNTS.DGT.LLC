# DGT ERP — install on iPhone, Android and tablets

There is ONE ERP. Every phone, tablet and PC uses the same website (`https://api.dgt.llc`), the same login, the same
permissions and the same database. Installing the app only puts an icon on the device; it never copies business data to it.
Updates reach every device the moment the ERP is deployed — nobody downloads anything again.

## iPhone / iPad (installable web app — no App Store needed)

1. Open **Safari** (it must be Safari, not Chrome) and go to `https://api.dgt.llc`.
2. Sign in once.
3. Tap the **Share** button (square with an arrow) → **Add to Home Screen** → **Add**.
4. Open the "DGT Group" icon from the Home Screen. It opens full-screen like an app and stays signed in until you sign out.
5. Language and RTL follow the ERP language you choose in Settings.

## Android phones and tablets (Samsung and others)

Option A — install the web app: open `https://api.dgt.llc` in Chrome → ⋮ menu → **Install app**.

Option B — install the test APK (`DGT-ERP-debug-….apk`, package `com.digitaldock.erp`):
1. Copy the APK to the phone and open it. Allow "Install unknown apps" for the app you opened it from, if asked.
2. Open **Digital Dock ERP**. It loads the live ERP login page; sign in with your normal ERP account.
3. If the phone has no internet the app shows a short offline page with a Retry button (English / Urdu / Arabic / Persian / Pashto).

The APK is a *debug-signed test build*. A store (Google Play) release needs your own signing key — see below.

## iPhone app for TestFlight / App Store (needs a Mac)

The Xcode project already exists in `ios/`. It cannot be built on Windows. When a Mac with Xcode and an Apple Developer
account are available:

```bash
npm install
npx cap sync ios        # on the Mac (installs the iOS plugins)
npx cap open ios        # Xcode: set Team, Bundle ID com.digitaldock.erp, add Push Notifications capability
# Product → Archive → Distribute App → App Store Connect → TestFlight
```

## Android store release (when you want Google Play)

Create an upload keystore (keep it private), then `cd android && ./gradlew bundleRelease` and sign the `.aab`.
Runbook: `docs/mobile-app-readiness.md`.

## Remote access (working outside the office)

The ERP is already served over HTTPS at `api.dgt.llc`; the database stays on Supabase and nothing on the office network is
exposed. Staff only need the app + their login. Every request is checked on the server against the user's role, country and
branch, exactly as on a PC.
