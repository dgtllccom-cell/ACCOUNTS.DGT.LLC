# Creating the three store accounts (company-owned)

All three need the SAME company facts — prepare them once:
* Legal company name **exactly** as on the trade licence (e.g. "Digital Dock Group LLC") and registered address
* **D-U-N-S number** of that legal entity (free from Dun & Bradstreet; can take days to ~30 days). Check first if one already exists: https://www.dnb.com/duns-number/lookup.html and Apple's own lookup https://developer.apple.com/enroll/duns-lookup/
* Trade licence / certificate of incorporation (PDF), passport or Emirates ID of the person who will own the account (must have authority to bind the company)
* A **company-domain e-mail** (not Gmail/Yahoo), a company **phone**, and a public company **website**
* A company card for the fees; for Samsung also a company bank account (country must match the seller country)

| Store | Official page | Cost | Typical time |
|---|---|---|---|
| Google Play Console (organisation) | https://play.google.com/console/signup | one-time **USD 25**, no renewal | identity/D-U-N-S verification: days to ~2 weeks |
| Apple Developer Program (organisation) | https://developer.apple.com/programs/enroll/ | **USD 99 per year** | D-U-N-S + Apple phone verification: 1–4 weeks |
| Samsung Seller Portal (Galaxy Store) | https://seller.samsungapps.com/ (Samsung account first: https://account.samsung.com) | registration free; commercial-seller status needs business verification | 1–3 weeks |

Costs and rules change — confirm on the official page before paying. (Sources used: third-party enrolment guides + Samsung developer docs; I could not read the official fee pages from here.)

## Google Play Console — step by step
1. Create/use a dedicated Google account on the company domain (e.g. `play@yourcompany.com`) with 2-step verification. The person who creates the account becomes the **permanent owner** — choose an authorised director.
2. Open the signup link → **Organization** → enter legal name, D-U-N-S, address, phone, website → pay USD 25.
3. Verify identity (ID + company documents) and the phone/e-mail shown to users.
4. Create app → "DGT.llc B" (package must be `com.dgtllc.b`), then again for "DGT.llc BS" (`com.dgtllc.bs`). Free app, category Business.
5. Enrol in **Play App Signing** when asked; upload `DGT.llc-B-Business-release.aab` / `DGT.llc-BS-Shipping-release.aab` (Production or Internal testing track first).
6. Complete: store listing (text in `docs/store/listing-*.md`, icon 512, feature graphic 1024×500, phone + tablet screenshots), Privacy policy URL, Data safety (`data-safety.md`), content rating questionnaire, target audience 18+, app access (give reviewers a login).
7. New personal accounts must run a 14-day closed test with 12 testers; organisation accounts are normally exempt (verify the current Google policy) — one more reason to register as an organisation.

## Apple Developer Program — step by step
1. Apple ID on the company e-mail with two-factor authentication.
2. https://developer.apple.com/programs/enroll/ → **Organization** → legal name, D-U-N-S, website, authority to bind the company → USD 99.
3. Apple phones the contact to verify; keep the phone reachable. Approval e-mail → App Store Connect access.
4. In *Certificates, Identifiers & Profiles* create App IDs `com.dgtllc.b` and `com.dgtllc.bs` (Push Notifications capability if used). In App Store Connect create two apps with the same bundle ids.
5. Needs a **Mac with Xcode** to build (see `ios-requirements.md`); upload with Xcode/Transporter; test in TestFlight; fill App Privacy (`data-safety.md`), screenshots (6.9" iPhone, 13" iPad), review notes with a reviewer login; submit for review.

## Samsung Galaxy Store — step by step
1. Create a Samsung account (company e-mail) at https://account.samsung.com.
2. Sign in at https://seller.samsungapps.com → register as a seller → apply for **Commercial Seller** (business name, D-U-N-S, bank account, representative). Public listing shows company name, address, support e-mail and privacy-policy URL.
3. Add new app → upload the signed release (AAB, or the signed release APK if AAB registration is not offered for your account) → listing text/screenshots/icon → content rating → submit for Samsung validation.
