# DGT.llc B and DGT.llc BS — store publishing pack

Two store apps, ONE ERP (same backend, database, login, permissions, country/branch scope):

| | **DGT.llc B** (Business) | **DGT.llc BS** (Business Shipping) |
|---|---|---|
| Users | Business users (accounts, purchase, sales, stock, CRM, HR …) | Shipping Line and Clearing Agent users |
| Android id / iOS bundle id | `com.dgtllc.b` | `com.dgtllc.bs` |
| Lands on | the user's normal role dashboard | shipping-side dashboard (shipping line / clearing agent / logistics) |
| Wrong login | a shipping-only login is told to use DGT.llc BS | a business-only login is told to use DGT.llc B |
| Super Admin / "both" logins | may use either app | may use either app |

The app tags its web view with `DGTllc-B/1` or `DGTllc-BS/1`; the ERP reads it in `lib/mobile/app-channel.ts`. This only decides the *front door*.
What a login can read or change is decided by the existing role / permission / operational-domain / country-branch rules on the server,
exactly as in the browser — the apps add no data access of their own.

## Environments (kept separate)
| Name | URL | Used by |
|---|---|---|
| `local` | `http://10.0.2.2:3000` (= developer PC `localhost:3000` from an Android emulator) | developer debug builds only; plain http is rejected by release builds |
| `production` (EPS Production) | `https://api.dgt.llc` | the only target of store releases |

`node scripts/mobile-env.mjs production --release` refuses anything else. Local and EPS test URLs are never baked into a release build.

## Build commands
Android (Windows/macOS/Linux, JDK 21 + Android SDK 36):
```
node scripts/mobile-env.mjs production --release
npx cap sync android
set DGTLLC_KEYSTORE_PROPERTIES=<path to keystore.properties>   # keep OUTSIDE the repository
cd android && gradlew bundleBusinessRelease bundleShippingRelease    # → app/build/outputs/bundle/{business,shipping}Release/*.aab
```
iOS (macOS + Xcode only): `APPLE_TEAM_ID=… bash scripts/ios-build-apps.sh all`
Brand assets: `node scripts/generate-digitic-icons.mjs` (regenerates every icon / splash / store graphic).

## What the COMPANY must provide (I cannot create accounts, pay, or sign in as the owner)
1. **Google Play Console** developer account (company, one-time USD 25 + identity/D-U-N-S verification). Create both apps with the ids above, enrol in **Play App Signing**, upload the AABs.
2. **Apple Developer Program** (organisation, USD 99/year, D-U-N-S) and a **Mac with Xcode** (or a cloud Mac / CI such as Xcode Cloud, Codemagic). Create the two App IDs, two App Store Connect records, then run `scripts/ios-build-apps.sh`.
3. **Samsung Seller Office / Galaxy Store** account (company verification). It accepts the same signed Android build.
4. **Support e-mail and website**, **company legal name/address** for the listings, and approval of the privacy policy text (`/legal/privacy`, needs the next Production deployment).
5. **Reviewer login** for Apple/Google/Samsung (they must be able to sign in). A least-privilege account on Production with no extra business data — your decision, because the project rule is that Production gets no test data.
6. **Firebase project** (`google-services.json`) and an **APNs key** if push notifications are to be switched on.
7. **Signing keys stay with the company**: the Android upload key is in `B:\android-toolchain\keys\` (copy it to the company password vault NOW; if lost the Play upload key can only be reset through Google support). iOS signing is held in the company Apple account.
8. The **final brand artwork** (the generated icons are a working mark).

## Store-policy notes (so review does not surprise us)
* Apple guideline 4.2 (minimum functionality) can reject apps that are only a website. Mitigation in the apps: native shell with offline page, camera for document upload, notification support, secure session handling, and an app-specific front door. If review pushes back, the answer is native features (push, camera, document scan), not a different design.
* Apple 5.1.1(v) / Google account-deletion: accounts are issued and removed by the company administrator (no self sign-up); the privacy policy and listing explain how to request deletion.
* Data-safety / App-privacy answers: see `data-safety.md`.
