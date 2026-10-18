# DGT.llc B / DGT.llc BS — store readiness report

Prepared **2026-10-18** on branch `claude/elegant-hugle-ed1145` (base = `origin/production` a29f816 merged). Testing database only
(`csesvyxxjivnkkozgopt`). **Nothing was published, deployed to Production, or paid for.**
Companion docs: `START-HERE.md` (owner steps in order), `owner-checklist.md`, `accounts-guide.md`, `reviewer-accounts.md`,
`ios-requirements.md`, `data-safety.md`, `design/README.md`.

## 1. One-line status
| | Android (Play + Samsung) | iOS (App Store) |
|---|---|---|
| Build | **Signed AAB + APK for both apps built 2026-10-18 from current code** | project prepared; **cannot be built on Windows — never faked** |
| App works against Production today | **No — blocked** (§3, blocker 1) | same |
| Store account | none confirmed | none confirmed |
| Can be submitted today | No | No |

## 2. Build artifacts (this session)
Folder `B:\accounts.dgt.llc.code_project\mobile-builds\release-2026-10-18\` (checksums in `SHA256SUMS.txt`; previous builds moved, not deleted, to
`mobile-builds\archive-2026-10-10-pre-ua-fix\`).

| File | Use | SHA-256 |
|---|---|---|
| `DGTllc-B-release.aab` | Google Play — DGT.llc B (`com.dgtllc.b`) | `c8d950027e527c5c24660742d4e8b0b860af8cf511ed54b3e2fba2d141f85a2d` |
| `DGTllc-BS-release.aab` | Google Play — DGT.llc BS (`com.dgtllc.bs`) | `5166d251eec2d16c3648b70b102fb5d15644b2fe0889b1b6ded6172825d92977` |
| `DGTllc-B-release-signed.apk` | Samsung Galaxy Store / sideload test — B | `afbcc86b41ae29134d6b04c5968cf5cee79cdf1c5c1b960662c942cc695446ca` |
| `DGTllc-BS-release-signed.apk` | Samsung Galaxy Store / sideload test — BS | `53ab091b61017bc1c0b9f564aac1bd3be54ddeabe0ab72fbcf0aa388d2d8ca53` |

Verified by running tools (not assumed): `apksigner verify` → *Verifies*, v2 scheme, certificate `CN=DGT.llc, OU=Mobile Apps, O=DAMAAN GENERAL TRADING LLC,
L=Dubai, C=AE`; `jarsigner -verify` on both AABs → *jar verified*; the APK's embedded `capacitor.config.json` contains the production URL
`https://api.dgt.llc/auth/login`, **no** cleartext flag, and the correct User-Agent tag (`DGTllc-B/1`, `DGTllc-BS/1`) and application id per flavor.
versionCode 1 / versionName 1.0.0, minSdk 24, targetSdk 36 (meets Play's current target-API rule as of this report — re-check at submission).

Signing key: `B:\android-toolchain\keys\dgtllc-upload.jks` (+ copy in `B:\DGT-Mobile-Apps-PRIVATE-signing-keys`). It is the **upload key**; with Play App
Signing Google holds the distribution key. **The owner must move the key + passwords to the company vault; if both copies are lost the apps cannot be updated
under the same upload key (recoverable only through a Play support reset).** Samsung needs the same signed APK; if Samsung later asks for its own signing
certificate the build must be redone.

## 3. Blockers (exact)
1. **Production database lacks the mobile tables.** Production code (origin/production) already contains the device-approval system and `/auth/device`
   answers 200, but a read-only check of Production (`to_regclass`) shows `mobile_devices`, `mobile_device_events`, `mobile_review_passes` do **not exist**
   (migrations `20261232` and `20261233` exist only on the Testing DB). Consequence: a store app opening against Production cannot create an activation request,
   so **neither a user nor a store reviewer can get past the activation screen.** Needs the owner's approval to apply the two additive migrations to Production
   (`production-deployment-plan.md`, Step 0/1: backup first). Not done by me (project rule).
2. **Reviewer access does not exist in Production.** The read-only reviewer login + review pass are proven on Testing only (`reviewer-accounts.md`). Creating
   them in Production needs the owner's approval; the review code is shown once and goes into each store's review notes.
3. **No store developer account is confirmed.** `store-links.json` is empty; the owner has not reported D-U-N-S, registrations or e-mail addresses. Nothing in
   the repository or session notes shows an account exists.
4. **D-U-N-S status unknown**; licence spelling ("LLC" vs "L.L.C", "Hathoor Office 2-01" vs "Hathboor Office 201") must be settled against the paper licence
   before any registration (`owner-checklist.md` §1).
5. **iOS:** needs a Mac with Xcode (own or rented), Apple Developer Program membership, App IDs and App Store Connect records (§6).
6. **Apple guideline 4.2 risk (real, not cosmetic):** the apps are native shells around the ERP web app. Apple can reject "minimal functionality" web wrappers.
   Strengths to state in review notes: device approval/activation, scoped enterprise accounts, camera document capture, offline notice, native splash/status bar,
   no public sign-up. Weak points: no native push yet (no Firebase/APNs set up), no biometric sign-in. Treat a first-round rejection as likely enough to plan for
   (add ~1 week to the Apple estimate).
7. **Push notifications are not functional** (no `google-services.json`, no push plugin installed). The Android manifest still declares `POST_NOTIFICATIONS`
   and `data-safety.md` mentions a push token — either wire push (needs a Firebase project/APNs key = owner) or remove both before the Play/Apple forms are filled,
   so the declarations match the app.
8. **Production must receive the updated web code** for two App-Review items done in this session: the stub "Face ID / Fingerprint" login button is now hidden inside
   the apps (commit 811dd78 — shows only after deploy), and the existing device flow. Deployment is the owner's decision.

## 4. Per-store status and what the owner must personally do
| Item | Google Play | Apple App Store | Samsung Galaxy Store |
|---|---|---|---|
| Account | not created / unconfirmed | not created / unconfirmed | not created / unconfirmed |
| Fee | USD 25 once | USD 99 / year | free to register |
| D-U-N-S | required (organisation) | required | required (commercial seller) |
| Identity / legal checks (owner only) | ID + company documents; phone/e-mail OTP | **Apple phones the company contact**; 2-factor Apple ID | business verification + company bank account |
| Company e-mail | `play@dgt.llc` recommended | `apple@dgt.llc` **required** (no Gmail) | company e-mail recommended |
| Build to upload | AAB (ready) | `.ipa` from a Mac (not possible here) | signed APK/AAB (ready) |
| Signing | Play App Signing, our upload key (ready) | Apple Distribution cert + profiles (Xcode automatic) | our signed APK |
| Screenshots | phone 1080×1920 generator ready; **regenerate from current code before upload** | 6.9" iPhone 1320×2868 + 13" iPad 2064×2752 (generator ready) | same as Play |
| Privacy policy | `https://api.dgt.llc/legal/privacy` (200, 5 languages) | same | same |
| Data safety / App Privacy | `data-safety.md` (see blocker 7) | `data-safety.md` + `PrivacyInfo.xcprivacy` added | `data-safety.md` |
| Reviewer login | read-only Reports Auditor + review pass (blockers 1–2) | same | same |
| Listing text (5 languages) | `listing-b.md`, `listing-bs.md` | same | same |
| Submission possible today | No (account) | No (account, Mac) | No (account) |

Screenshot rules (enforced by `scripts/make-store-screenshots.mjs`): real screens of a Testing server, structure and counts only — **no customer/company names, no
test rows (`RBAC-TEST-*`, demo, dummy), no money figures**, `[data-dgt-connect]` chat widget hidden, placeholder ids masked.

## 5. Realistic dates and review times
Today is **Sun 2026-10-18**. The earlier targets (Play 25–29 Oct, Samsung end Oct, Apple early Nov) were conditional on the owner starting registrations on
11 Oct; there is no evidence they were started, so they are **no longer realistic unless registrations are submitted in the next 1–2 days**. Times below are
typical published/anecdotal ranges, **not guarantees** — confirm on each official page.

| Scenario | Google Play live | Samsung live | Apple live |
|---|---|---|---|
| **A.** D-U-N-S already exists; all three registrations submitted by Tue 20 Oct; Production migrations + reviewer access approved by 22 Oct | ≈ 29 Oct – 6 Nov | ≈ 5 – 15 Nov | ≈ 10 – 25 Nov (needs Mac; plan one rejection round) |
| **B.** D-U-N-S must be requested (5–30 business days) | ≈ late Nov – mid Dec | ≈ Dec | ≈ Dec – Jan |

Review time after submission: Google a few hours to ~7 days (first submissions of a new account are slower); Samsung ~1–3 working days after seller approval; Apple
~24–48 h per round. The Play 14-day/12-tester closed-test rule applies to *personal* accounts; organisation accounts are normally exempt (verify at registration).

## 6. iOS — exactly what needs a Mac and an Apple account
Done here (files only, unverified until opened in Xcode): `ios/App` project with bundle id `com.dgtllc.b` (BS is produced by the build script overriding bundle id,
display name and icon `AppIcon-BS`), iOS 15 target, iPhone + iPad, `Info.plist` (camera / photo-library / microphone purpose strings reworded, unused
`remote-notification` background mode and photo-add string removed, `arm64`), **new `PrivacyInfo.xcprivacy`** (no tracking, UserDefaults reason CA92.1) wired into the
Xcode project by hand-edit (`project.pbxproj` — **must be opened once in Xcode to confirm it loads**), `scripts/ios-build-apps.sh`.
Needs a person: (1) Apple Developer organisation account; (2) a Mac with current Xcode, Node 20+ (CocoaPods not needed — the project uses Swift Package Manager);
(3) `APPLE_TEAM_ID=… bash scripts/ios-build-apps.sh all`; (4) create both App IDs and App Store Connect records, upload with Transporter, TestFlight on a real iPhone
and iPad; (5) App Privacy answers, screenshots, review notes + reviewer code, submit. **No iOS build, simulator run or TestFlight run has been done.**

## 7. Test evidence (Testing DB, local DEV server port 3520, merged code)
| Check | Result | Log |
|---|---|---|
| `scripts/e2e-app-channel.mjs` | **12 / 12 PASS** | `mobile-builds\test-logs\e2e-app-channel.txt` |
| `scripts/e2e-mobile-device.mjs` | **35 / 35 PASS** | `…\e2e-mobile-device.txt` |
| `scripts/e2e-review-pass.mjs` | **32 / 32 PASS** | `…\e2e-review-pass.txt` |
| `scripts/e2e-reviewer-account.mjs` | **26 / 26 PASS** | `…\e2e-reviewer-account.txt` |
| `npx tsc --noEmit` (whole project, merged code + this branch's changes) | **exit 0** | `…	sc.txt` |
| `npm run i18n:guard` | PASS — 21,627 keys × 5 languages | commit hook output |
| Gradle debug build (both flavors) | BUILD SUCCESSFUL 5m37s | `…\gradle-debug.txt` |
| Gradle release `bundle*Release assemble*Release` (both flavors, signed) | BUILD SUCCESSFUL 3m53s | `…\gradle-release.txt` |
| `scripts/check-app-screens.mjs` — app User-Agent tags, 5 languages × phone 360×800 / tablet 800×1280: login / activation / wrong-app pages load, no horizontal scroll, RTL for ur/ps/fa/ar, biometric stub hidden in the apps, control (plain browser) unchanged | **91 / 91 PASS** on the final run (two earlier runs 89/91 and 90/91 exposed a real flash of the stub button in server-rendered HTML; fixed by hiding it until mount — logs `check-app-screens-run1/run2-*.txt` kept) | `…\check-app-screens.txt` |
| Real-app run on Android emulator (AVD `pixel`) | **FAILED TO RUN — infrastructure, not the app**: with the Next dev server + other sessions the 16 GB host has < 1 GB free; Android SystemUI hit ANR, then `system_server` died ("Can't find service: activity") on two cold boots. The app installed (`pm list packages` shows both) but was never seen rendering. | |
| Real devices (Samsung phone/tablet, iPhone, iPad) | **NOT TESTED** | |

Coverage of the earlier 191-route × 5-language × phone/tablet Playwright sweep is in the 2026-10-10/11 session notes (≈9,340 cases, 8,986 clean at that time);
it was **not re-run** in this session.

## 8. What was tested how — emulator / browser emulation / real devices
| Level | What it proves | Status |
|---|---|---|
| Server + database logic (the 4 e2e harnesses) | device approval, review pass, app-channel routing, reviewer permissions, country/branch scope — real HTTP against the Testing DB | **PASS** |
| Browser emulation with the apps' exact User-Agent (`check-app-screens.mjs`, Chromium) | what the apps' web view loads: activation gate, login, wrong-app page; 5 languages; phone and tablet widths; RTL | **PASS** (not the real app; Chromium, not Android WebView / WKWebView) |
| Android emulator running the real APK | the shell boots, loads the ERP, shows the activation screen | **NOT DONE** (host memory; retry on a machine with ≥ 8 GB free, or run the debug APK on the owner's phone — `mobile-builds\dev-only\DGTllc-B-DEBUG-emulator-3520-DEV-ONLY.apk` expects a DEV server at 10.0.2.2:3520 so is for emulators only; for a phone use the earlier `…PHONE-TEST…` APKs) |
| Real Samsung phone / tablet, other Android | WebView behaviour, camera capture, keyboard, RTL on One UI, performance | **NOT TESTED — owner/device needed** |
| iPhone / iPad (Safari engine only via Playwright WebKit in the 10 Oct sweep) | layout | earlier sweep only; **no iOS app run at all** |

Known limits to check on real devices: camera document capture and file picker inside the web view; voice-input buttons (the Android manifest has no `RECORD_AUDIO`,
so microphone features will not work in the Android app — decide whether to ship without voice or add the permission and update Data Safety); barcode scan
(`BarcodeDetector`) availability in Android WebView; biometric sign-in (not offered in the apps); push notifications (not wired).
Cosmetic: the "Remember me" checkbox renders about 44 px wide inside the apps (global touch-target rule) — not fixed here because it is shared ERP CSS.
Real-device test steps for the owner (Samsung phone, ~20 min): `DGT-Mobile-Apps\SAMSUNG-TEST-STEPS.txt` from the earlier session.
