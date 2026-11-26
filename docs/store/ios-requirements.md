# iPhone / iPad builds — no Mac needed (GitHub Actions → TestFlight)

The Xcode project is in `ios/App` (Capacitor 8, Swift Package Manager, no CocoaPods). Bundle ids `com.dgtllc.b` (DGT.llc B) and
`com.dgtllc.bs` (DGT.llc BS), display name from `APP_DISPLAY_NAME`, icons `AppIcon` / `AppIcon-BS`, camera / photo / microphone
usage strings, push entitlement (`App/App.entitlements`), privacy manifest (`App/PrivacyInfo.xcprivacy`).

Apple only builds iOS apps on macOS. **The owner does not need a Mac:** the workflow `.github/workflows/ios-testflight.yml` runs on a
GitHub-hosted Mac (`macos-latest`, current stable Xcode), builds the app, signs it automatically with an App Store Connect API key and
uploads it to TestFlight. The local script `scripts/ios-build-apps.sh` still works for anyone who has a Mac.

Company on every Apple form (exactly as on the D-U-N-S record): **DAMAAN GENERAL TRADING L.L.C** · **Office No. 201, Al Ras – Deira, Dubai, United Arab Emirates** ·
D-U-N-S **850005751** · Corporation.

## Owner guide — 6 steps (never paste a key, password or code into chat)
| # | Step | Where | Result |
|---|---|---|---|
| 1 | **Enrol the company** in the Apple Developer Program as an *Organization* (USD 99/year). Sign in with an Apple ID made on a company address (e.g. `apple@dgt.llc`), 2-factor on; legal name + D-U-N-S above; Apple telephones to verify. | https://developer.apple.com/programs/enroll/ | Membership active |
| 2 | **Team ID** — copy the 10-character Team ID. | https://developer.apple.com/account → *Membership details* | value for `APPLE_TEAM_ID` |
| 3 | **Create the app record(s)** — *Apps → + → New App*: platform iOS, name `DGT.llc B`, primary language English (U.S.), bundle ID `com.dgtllc.b` (if it is not in the list, first register it at https://developer.apple.com/account/resources/identifiers/list → App IDs → `com.dgtllc.b`, capability **Push Notifications**), SKU `dgtllc-b`, full access. Repeat with `DGT.llc BS` / `com.dgtllc.bs` / `dgtllc-bs` only when BS is wanted. | https://appstoreconnect.apple.com/apps | upload target exists |
| 4 | **App Store Connect API key** — *Users and Access → Integrations → App Store Connect API → Team Keys → +*, name `GitHub TestFlight`, access **Admin** (needed so Xcode may create the signing certificate and profiles). Note the **Issuer ID** (top of the page) and the **Key ID**; **Download** the `.p8` file (it can be downloaded only once — keep it in the company vault). | https://appstoreconnect.apple.com/access/integrations/api | Key ID, Issuer ID, `.p8` |
| 5 | **Add 4 repository secrets** — *New repository secret* four times: `ASC_KEY_ID` (Key ID), `ASC_ISSUER_ID` (Issuer ID), `ASC_KEY_P8` (open the `.p8` in Notepad and paste the whole text, including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines), `APPLE_TEAM_ID` (Team ID). | https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC/settings/secrets/actions | secrets stored encrypted; nobody (including Claude) can read them back |
| 6 | **Run the workflow** — *Actions → iOS TestFlight → Run workflow*, app `b`, upload ✔ → wait ~20–30 min (green). | https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC/actions/workflows/ios-testflight.yml | build uploaded |

Then: App Store Connect → the app → **TestFlight** → wait for "Processing" to finish (5–30 min) → answer the export-compliance question if asked
(the Info.plist already says *no non-exempt encryption*) → add yourself to *Internal Testing* → install **TestFlight** from the App Store on the
iPhone/iPad and open the invite → test → **App Store** tab: fill the listing from `docs/store/app-store-connect.md`, pick the build, **Add for Review**.

**Submitting without clicking through every page:** the workflow *iOS App Store submit* uploads the listing, screenshots, age rating,
review contact, reviewer login and notes, and can press *Submit for Review* (`app-store-connect.md` §5). You still do App Privacy and
Pricing (Free) once in App Store Connect, because Apple's API does not offer them.

If a secret is missing the first step of the workflow fails with a red message naming it (e.g. *Repository secret ASC_KEY_P8 is not set*).

## What the workflow does
1. Checks the 4 secrets exist (names only, values are never printed) and look right (`.p8` text, 10-character Team ID).
2. Node 22, `npm ci`, `node scripts/mobile-env.mjs production --release` (store builds may only point at `https://api.dgt.llc`), `npx cap sync ios`.
3. `xcodebuild archive` with automatic signing (`-allowProvisioningUpdates -authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID`),
   `CURRENT_PROJECT_VERSION` = the workflow run number (every run gives a new, higher build number), optional `MARKETING_VERSION` input (e.g. `1.0.1`).
4. `xcodebuild -exportArchive` (`method app-store-connect`) → `.ipa`, kept 7 days as a run artifact.
5. `xcrun altool --upload-app --apiKey … --apiIssuer …` → App Store Connect / TestFlight. The `.p8` is deleted from the runner at the end.
Inputs: `app` = `b` / `bs` / `both`, `marketing_version`, `upload` (off = build + export only — a safe first test of the signing setup).

Notes: automatic signing creates an *Apple Distribution* certificate the first time and may add an *Apple Development* certificate per run;
old development certificates can be revoked any time under Certificates without affecting the App Store build. GitHub macOS minutes count 10×
against the free plan allowance (one run ≈ 20–30 min).

## Native features in the app (Apple guideline 4.2 "minimum functionality")
| Feature | Where | How |
|---|---|---|
| Camera / photo-library document capture | AI Document Intake → *Capture via Scanner / Camera* | `@capacitor/camera` (`captureDocumentPhoto`) → same upload flow as the web file input |
| Push-notification registration (APNs) | after sign-in, on every launch | `@capacitor/push-notifications`; token → `POST /api/erp/mobile/push`; AppDelegate forwards the APNs token; `aps-environment` entitlement |
| Device activation / approval | first launch of the store app | `/auth/device`: each phone must be approved by the Super Admin (reviewers use a store review pass) |
| Offline screen (5 languages, RTL) | whenever `https://api.dgt.llc` cannot be reached | `mobile-shell/offline.html` (Capacitor `errorPath`) + in-app offline banner via `@capacitor/network` |
| Native back navigation | iPhone/iPad edge swipe | `MainViewController` turns on `allowsBackForwardNavigationGestures`; Android uses the hardware back button (`@capacitor/app`) |
| Status bar | whole app | `@capacitor/status-bar`: light text on the brand / dark background, follows the ERP theme |
| Splash screen, native keyboard resize | launch / forms | `@capacitor/splash-screen`, `@capacitor/keyboard` |

Until 2026-11-26 none of these plugins was installed, so in an iOS build every native call silently did nothing (a sure 4.2 rejection).
They are now dependencies and listed in `ios/App/CapApp-SPM/Package.swift`.

Known limit: the server side of push (`lib/services/mobile-push-service.ts`) stores tokens but does not yet send through APNs — an APNs key
(`.p8`, *Keys → Apple Push Notifications service*) and a sender are a later step. Do not advertise "notifications" in the listing until then.

App Store texts, App Privacy answers, review notes and screenshots: **`docs/store/app-store-connect.md`**.
