# DGT.llc B / DGT.llc BS — owner checklist (store registration and publishing)

Prepared 2026-10-10. Everything marked **OWNER** needs a person with authority for the company; I cannot create accounts, pay, sign in as you, or accept store agreements.

## 1. Company details we already have
| Item | Value | Source |
|---|---|---|
| Legal name | DAMAAN GENERAL TRADING L.L.C (ERP record: "DAMAAN GENERAL TRADING L.L.C") | your message + ERP company master |
| Country / emirate / area | United Arab Emirates · Dubai · Al Ras, Deira | your message |
| Office address | Al Hathoor Building, Office 2-01, Al Ras, Deira, Dubai (ERP record: "Al **Hathboor** Building, Office No. **201**, Al Ras, Dubai – UAE") | your message + ERP |
| Trade licence no. | **1099620** — the ERP shows the same number, expiry **15 Sep 2027** | ERP company master |
| Tax registration (TRN) | 104127559300001 (not needed for stores) | ERP |
| Activities | General Trading, Import & Export | your message |
| Company e-mail | Dgt.llc.com@gmail.com (a Gmail address — see §5) | your message |
| Website | www.dgt.llc → redirects to https://dgt.llc and loads (200) | checked today |
| Account owner on file | Asmatullah Abdullah (ERP owner field) | ERP |
| Mail system | dgt.llc already has company mailboxes (Titan mail), so a company-domain address can be created | DNS check |

**Two details differ between your message and the ERP and must be checked against the paper trade licence before any registration:** (a) legal name "LLC" vs "L.L.C", (b) "Hathoor / Office 2-01" vs "Hathboor / Office No. 201". Google, Apple and D&B compare these character by character.

## 2. Still missing (OWNER)
1. A scan of the **trade licence** (all pages) and the **owner/manager's passport or Emirates ID** — I do not have copies.
2. A **company phone number** the stores can call (Apple verifies by phone call; Samsung and Google show/verify it).
3. A **support e-mail on the company domain** (see §5) and the public **support page URL** (can be `https://dgt.llc`).
4. The person who will be the **permanent account owner** of each store account (must have authority to sign for the company).
5. **Final logo/artwork approval** (the current icons are working marks), and approval of the **privacy policy text** (`/legal/privacy`).
6. A **reviewer login** for Apple/Google/Samsung (least-privilege Production account) — your decision, because Production must not receive test data.
7. Company **bank account** details (Samsung Seller Portal asks for them for commercial-seller status).

## 3. D-U-N-S number
* **Not confirmed.** I searched the public web and found no listing for the company; that proves nothing either way.
* Dubai licensing has issued D-U-N-S numbers with new/renewed licences (D&B UAE / CRIF Gulf), so the company **may already have one** — look for it on the licence or renewal paperwork.
* **OWNER:** check at the D&B directory https://www.dnb.com/duns-number/lookup.html or Apple's lookup https://developer.apple.com/enroll/duns-lookup/ (needs an Apple ID). If none exists, request one free at D&B — it can take days to ~30 days, so **start this first**. The legal name and address on the D-U-N-S record must match the licence and the store forms.

## 4. Accounts to create (all under the company, not a person)
| Store | Link | Fee | Verification |
|---|---|---|---|
| Google Play Console (organisation) | https://play.google.com/console/signup | USD 25 once | D-U-N-S, ID of owner, company documents, phone/e-mail check |
| Apple Developer Program (organisation) | https://developer.apple.com/programs/enroll/ | USD 99 / year | D-U-N-S, legal-entity check, **phone call from Apple**, company-domain e-mail and website |
| Samsung Seller Portal (Galaxy Store) | https://seller.samsungapps.com/ (Samsung account: https://account.samsung.com) | registration free | commercial-seller approval: business verification (D-U-N-S), bank account |

Fees and rules change — confirm on each official page before paying (my sources were third-party guides; I could not read the official fee pages). Step-by-step instructions: `accounts-guide.md`.

## 5. Is a company-domain e-mail required?
**Yes, you should create one** (for example `apple@dgt.llc`, `play@dgt.llc`, `support@dgt.llc`): Apple's organisation enrolment is reported not to accept free-mail addresses such as Gmail, and Samsung asks for a company-domain address for commercial sellers. Google accepts any Google account but a company address is cleaner. The domain already has mailboxes (Titan), so this is an admin task, not a purchase.

## 6. What needs YOUR personal action (I cannot do these)
* Sign in and create each account; accept the developer agreements; **pay** (Google USD 25, Apple USD 99/yr).
* Identity verification (ID photo / video), Apple's verification phone call, D-U-N-S lookup/request.
* Samsung commercial-seller application with bank details.
* Back up the Android upload signing key to the company vault (`B:\DGT-Mobile-Apps-PRIVATE-signing-keys\` — move and delete the folder copy).
* Final approval to publish each app after review; separate approval to deploy the server changes to Production (`production-deployment-plan.md`).
Passwords, 2-step codes and the signing key must never be sent through chat.

## 7. What I already prepared
* Android: two signed release bundles (`DGT.llc-B-Business-release.aab`, `DGT.llc-BS-Shipping-release.aab`), signed release APKs for Samsung, and test APKs — folder `C:\Users\dgtll\OneDrive\Desktop\DGT-Mobile-Apps\` (exact paths in the report).
* Listings (5 languages), icons/feature graphics, privacy policy page, data-safety answers, iOS build script and requirements, Production deployment plan with backup/rollback, device-approval system (built and tested on DEV).

## 8. iPhone/iPad — remaining steps (all need a Mac + Apple account)
1. Create the Apple Developer organisation account (above). 2. Get a Mac (or cloud Mac: MacStadium / Codemagic / Xcode Cloud). 3. Create App IDs `com.dgtllc.b`, `com.dgtllc.bs` and the two App Store Connect records. 4. On the Mac run `APPLE_TEAM_ID=… bash scripts/ios-build-apps.sh all`. 5. Upload with Transporter → TestFlight → test on real iPhone/iPad. 6. Complete App Privacy, screenshots (6.9" iPhone, 13" iPad), reviewer login; submit. Details: `ios-requirements.md`.

## 9. Submission and approval — what to expect
| Store | Steps | Typical review time |
|---|---|---|
| Google Play | create app → upload AAB (internal testing first) → store listing, privacy URL, Data safety, content rating, app access (reviewer login) → submit to Production | hours to a few days (new accounts can take longer) |
| Samsung Galaxy Store | commercial-seller approval → add app → upload signed build → listing + content rating → submit | about 1–3 days after seller approval |
| Apple App Store | TestFlight build → App Store Connect listing + App Privacy → submit for review | about 1–2 days; a rejection (often guideline 4.2 "minimum functionality") means a resubmission |
After approval each store gives the public link; I will list the three links in the final report once they exist. **None of the apps is published yet.**
