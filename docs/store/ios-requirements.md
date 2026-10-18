# iPhone / iPad builds — exactly what is required

The Xcode project is ready in `ios/` (display name driven by `APP_DISPLAY_NAME`, bundle ids `com.dgtllc.b` / `com.dgtllc.bs`, AppIcon + AppIcon-BS, camera/photo/notification strings). It **cannot be compiled on Windows** — Apple only allows iOS builds from macOS.

## You need
1. **A Mac** (Apple silicon or Intel) on a current macOS, or a cloud Mac / CI that provides one (MacStadium, Codemagic, Xcode Cloud, GitHub Actions macOS runner).
2. **Xcode** (current stable, free from the Mac App Store) + command-line tools; **Node 20+** and **CocoaPods** (`sudo gem install cocoapods` or `brew install cocoapods`).
3. **Apple Developer Program organisation membership** (USD 99/year) — see `accounts-guide.md`.
4. **Certificates and profiles** (Xcode "Automatic signing" creates them for the team): *Apple Distribution* certificate and two *App Store* provisioning profiles (one per bundle id). Optional: an APNs key (`.p8`) for push notifications.
5. The company **Team ID** (10 characters, in the developer account → Membership).

## Steps on the Mac
```
git clone <repo> && cd ACCOUNTS.DGT.LLC
APPLE_TEAM_ID=ABCDE12345 bash scripts/ios-build-apps.sh all      # builds + exports DGT.llc B and DGT.llc BS .ipa files
```
Then upload each `.ipa` with **Transporter** (Mac App Store) or `xcrun altool`, wait for processing, and add it to a TestFlight internal group → install on iPhone/iPad → submit for App Review.

## App Review notes to paste
"DGT.llc B / BS are the mobile clients of the DGT company ERP. Accounts are issued by the company administrator (no public sign-up). Use the reviewer login provided in the notes. Native features: camera document capture, notifications, offline notice, secure session." (Apple guideline 4.2 can reject thin web wrappers — if asked, the answer is to add native features such as document scanning/push, not to change the design.)

## Until the Mac exists
iPhone and iPad users can install the web app today: Safari → `https://api.dgt.llc` → Share → *Add to Home Screen* (see `docs/mobile-install.md`).
