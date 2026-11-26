# App Store Connect — DGT.llc B (and BS): what to type in each field

Prepared 2026-11-26. Build path: `docs/store/ios-requirements.md` (GitHub Actions → TestFlight, no Mac needed).
Seller / company: **DAMAAN GENERAL TRADING L.L.C** · Office No. 201, Al Ras – Deira, Dubai, United Arab Emirates · D-U-N-S 850005751.

## 1. App Information
| Field | Value |
|---|---|
| Name | `DGT.llc B` (BS: `DGT.llc BS`) |
| Subtitle (30) | `Your company ERP on the go` |
| Bundle ID / SKU | `com.dgtllc.b` / `dgtllc-b` (BS: `com.dgtllc.bs` / `dgtllc-bs`) |
| Primary language | English (U.S.); localisation Arabic (`fastlane/metadata/ar-SA`). Add Urdu / Persian in App Store Connect only if it offers them; it has no Pashto storefront language. The app itself always offers all five languages |
| Category | Business (secondary: Productivity) |
| Content rights | Does not contain third-party content |
| Age rating | answer **None / No** to every question → 4+ |
| Copyright | `© 2026 DAMAAN GENERAL TRADING L.L.C` |
| Privacy Policy URL | `https://api.dgt.llc/legal/privacy` |
| Support URL | `https://dgt.llc` · Marketing URL (optional) `https://dgt.llc` |
| Price | Free · no in-app purchases |
| Availability | all countries, or only where the company operates (owner's choice) |
| Export compliance | already answered in the build (`ITSAppUsesNonExemptEncryption = NO`, HTTPS only) |
| Distribution | Public App Store (optional alternative: *Unlisted app* — only people with the link can find it; request at https://developer.apple.com/contact/request/unlisted-app/) |

Description / keywords: use `docs/store/listing-b.md` (BS: `listing-bs.md`) per language, **but drop the words "receive notifications"** until
server-side APNs sending exists (see `ios-requirements.md`, "Known limit"). Keywords (100): `ERP,accounts,ledger,purchase,sales,stock,inventory,shipping,roznamcha,business`.

## 2. App Privacy ("nutrition label") — from `docs/store/data-safety.md` and the code
*Data collection:* **Yes, we collect data.** For every type below: **Linked to the user: Yes · Used for tracking: No · Purpose: App Functionality**
(plus *Account management/Other* where noted). No third-party advertising or analytics SDKs; no App Tracking Transparency prompt.

| Apple category → type | Why | Notes |
|---|---|---|
| Contact Info → **Name** | ERP account; device-activation form | App Functionality |
| Contact Info → **Email Address** | ERP sign-in (e-mail or user code) | App Functionality |
| Contact Info → **Phone Number** | device-activation form (so the administrator can verify the phone) | App Functionality |
| User Content → **Photos or Videos** | only when the user captures / attaches a document photo | App Functionality |
| User Content → **Audio Data** | only when the user taps a voice-input button (dictation into a form) | App Functionality |
| User Content → **Other User Content** | business records and documents the user enters or uploads | App Functionality |
| Identifiers → **User ID** | ERP user id / user code | App Functionality |
| Identifiers → **Device ID** | push-notification token and the device-activation record (model, OS version) | App Functionality |
| Diagnostics | **not collected** (no crash/analytics SDK) | — |
| Location, Health, Financial info (cards/bank of the user), Contacts, Browsing/Search history, Purchases, Sensitive info | **not collected** | business ledgers belong to the company and are covered by "Other User Content" |

The privacy manifest in the app (`ios/App/App/PrivacyInfo.xcprivacy`) declares no tracking and the UserDefaults reason `CA92.1`; the Capacitor
plugins ship their own manifests.

## 3. App Review Information
**Sign-in required: Yes.** Contact: the owner's name, `+971 54 481 6664`, `support@dgt.llc`.

User name / password: **entered by the owner directly in App Store Connect's review-credentials fields — never in chat, e-mail or this repository.**
The reviewer login and review pass are proven on the **TESTING** database only (`docs/store/reviewer-accounts.md`). Creating them in Production
(the server the store app opens) needs the owner's explicit approval — until then the build can be tested in TestFlight but **should not be
submitted for review**, because the reviewer would have no way in.

Notes field (paste, then replace `<REVIEW-CODE>` with the code the Super Admin generates for "Apple App Review"):
```
DGT.llc B is the mobile client of the company ERP of DAMAAN GENERAL TRADING L.L.C (accounts, purchase, sales, stock,
shipping documents). Accounts are issued by the company administrator; there is no public sign-up and no purchases.

How to sign in:
1. Open the app. The first screen is "Activate this device" (every phone must be approved by the company administrator).
2. Enter any name and phone number, the ERP e-mail from the credentials above, and in "Store review code" enter: <REVIEW-CODE>
   Tap "Request activation" — the review code activates the device immediately (no waiting for the administrator).
3. Sign in with the user name and password above. The review account is read-only and limited to a review scope.

Native features to check:
- AI Document Intake → "Capture via Scanner / Camera": takes a document photo with the camera (or picks one from Photos) and attaches it.
- Notification permission is requested after sign-in; the device registers for push.
- Turn on Airplane Mode: the app shows an offline screen / banner in the user's language; "Retry" reconnects.
- Swipe from the left edge to go back; the app works in portrait and landscape on iPhone and iPad.
- Five languages (English, Urdu, Arabic, Persian, Pashto) with full right-to-left layout — language menu on the sign-in screen.
```
Attachment (optional, recommended): a 1–2 minute screen recording of the same app on the TESTING environment showing the camera capture and
a few modules (`reviewer-accounts.md`, option A).

## 4. Screenshots (in `docs/store/assets/ios/`)
All taken from a local build connected only to public pages / the TESTING Supabase project — no Production business data.
| Display | Size (px) | Files |
|---|---|---|
| iPhone 6.9" | 1320 × 2868 | `iphone-6.9-login-{en,ur,ps,fa,ar}.jpg`, `iphone-6.9-device-activation-{en,ur,ps,fa,ar}.jpg`, `iphone-6.9-offline-{en,ar}.jpg`, `iphone-6.9-privacy-en.jpg` |
| iPad 13" | 2064 × 2752 | `ipad-13-login-…`, `ipad-13-device-activation-…`, `ipad-13-offline-…`, `ipad-13-privacy-en.jpg` |
The submit workflow uploads English → `*-en` and Arabic → `*-ar` (privacy screenshot in English for both). The Urdu, Persian and Pashto files are for other stores or for adding later.
Apple accepts 1–10 per display size; App Store Connect scales the 6.9"/13" sets down for smaller devices.

Screens inside the ERP (dashboard, ledgers, document intake) were **not** captured: that needs a signed-in TESTING session (TESTING service key /
database URL), which this build environment does not have. Capture them from the TestFlight build signed in to a TESTING-scoped account, or from
the TESTING web app at 440 × 956 (iPhone, ×3) / 1032 × 1376 (iPad, ×2) — never from Production data.

## 5. Automated upload and submission — workflow *iOS App Store submit*
`.github/workflows/ios-appstore-submit.yml` + `fastlane/` push the listing (name, subtitle, description, keywords, URLs, promotional
text in English + Arabic), copyright, categories, age rating (all "None"), export compliance, the App Review contact, reviewer login and
notes, and the screenshots above, through the same App Store Connect API key. Nothing secret is stored in the repository.
1. Run it with **submit = off** → check the listing in App Store Connect.
2. In App Store Connect do the three things the API cannot: **App Privacy** (section 2 above → Publish), **Pricing and Availability → Free**,
   and (only if the run reported it) the **Age Rating** questionnaire.
3. Add 3 more repository secrets: `ASC_REVIEW_EMAIL`, `ASC_REVIEW_PASSWORD` (the reviewer's ERP login) and `ASC_REVIEW_CODE` (the Apple review pass).
4. Run it again with **submit = on** and the TestFlight build number → the app goes to *Waiting for Review*; with automatic release it
   appears on the App Store as soon as Apple approves it.

## 6. Before pressing "Submit for Review"
- [ ] TestFlight build installed and checked on a real iPhone and iPad (camera capture, offline screen, swipe-back, 5 languages)
- [ ] Production has the device-approval system, the reviewer login and an Apple review pass (owner approval; `reviewer-accounts.md`)
- [ ] Review credentials + notes filled in; App Privacy published; screenshots uploaded; price Free; age rating 4+
- [ ] After approval: revoke the review pass and disable the reviewer login
