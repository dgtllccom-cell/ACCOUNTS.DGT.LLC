# Registration data sheets — copy/paste values for the three store forms

I cannot create the accounts (account creation, identity checks, payments and agreement acceptance must be done by the company owner). Everything the forms ask for is below, so each registration is copy-paste work of ~15 minutes. **[CONFIRM]** = an item only you can settle.

## Company facts (same in every form)
| Field | Value |
|---|---|
| Legal entity name | **DAMAAN GENERAL TRADING L.L.C** (exactly as on the trade licence — your last message; confirm the dots on the paper licence) |
| Country / emirate / area | United Arab Emirates · Dubai · Al Ras, Deira |
| Trade licence no. | 1099620 (ERP shows expiry 15 Sep 2027) |
| Registered / head-office address | **[CONFIRM]** "Al Hathoor Building, Office 2-01, Al Ras, Deira, Dubai" (your message) **or** "Al Hathboor Building, Office No. 201, Al Ras, Dubai – UAE" (ERP) — copy it from the licence |
| Company phone | +971 54 481 6664 (+971544816664) |
| Website | https://dgt.llc |
| Business activities | General Trading, Import & Export |
| D-U-N-S number | **pending** — D&B application submitted; add the 9 digits here when it arrives: `_________` |
| Account e-mails | Apple: `apple@dgt.llc` · Google: `play@dgt.llc` · Samsung: **[CONFIRM which — suggest `support@dgt.llc`]** · public support: `support@dgt.llc` |
| Privacy policy | https://api.dgt.llc/legal/privacy (live now in 5 languages; the company-name wording will be refreshed at the next approved deployment) |
| Support URL | https://dgt.llc |

## App facts
| | DGT.llc B | DGT.llc BS |
|---|---|---|
| Name (≤30) | DGT.llc B | DGT.llc BS |
| Subtitle / short description | Your DGT business ERP | Shipping Line & Clearing Agent ERP |
| Package / bundle id | com.dgtllc.b | com.dgtllc.bs |
| Category | Business | Business |
| Price | Free, no in-app purchases, no ads | same |
| Age / content rating | Everyone / 4+ (business tool; no user-generated public content, no violence, gambling, etc.) | same |
| Descriptions (5 languages) | `docs/store/listing-b.md` | `docs/store/listing-bs.md` |
| Icons & feature graphic | `DGT-Mobile-Apps\Store-graphics\b\` | `...\bs\` |
| Files | `DGT.llc-B-Business-release.aab` (+ signed `.apk` for Samsung) | `DGT.llc-BS-Shipping-release.aab` (+ signed `.apk`) |
| Review login | **[CONFIRM]** least-privilege Production account (needed by all 3 reviewers) | a shipping-only reviewer account |

## 1. Google Play Console — https://play.google.com/console/signup
1. Sign in as `play@dgt.llc` (2-step on). Account type **Organization**.
2. Developer name (public): DAMAAN GENERAL TRADING L.L.C · address and phone from the table · D-U-N-S when issued · website https://dgt.llc · contact e-mail shown to users: support@dgt.llc.
3. Pay USD 25 (**you**). Verify identity (**you**: ID photo / video) and the phone/e-mail OTPs (**you**).
4. Create app → name "DGT.llc B" → English (United Kingdom/US) default → **App** → **Free** → accept declarations (**you**) → package must be com.dgtllc.b → repeat for DGT.llc BS.
5. Store listing: copy from `listing-*.md`; upload icon 512, feature graphic 1024×500, phone screenshots (I prepare them). Privacy policy URL above. App access: "restricted — instructions": supply the reviewer login. Ads: No. Content rating: complete the IARC questionnaire with "No" to every content category. Target audience: 18+. Data safety: `docs/store/data-safety.md`. News/Health/Finance declarations: **not** a financial-services, health or news app.
6. Release: Internal testing first, then Production; **Play App Signing: accept**, upload the `.aab`. (New org accounts normally need no closed-test period.)

## 2. Apple Developer Program — https://developer.apple.com/programs/enroll/
1. Sign in with an Apple ID created for `apple@dgt.llc` (2-factor **you**). Choose **Organization**.
2. Legal entity name, D-U-N-S (must match D&B's record), headquarters address, phone +971544816664, website https://dgt.llc. Enrolling person must have authority to bind the company (state the role). Apple will **telephone** you — answer the +971544816664 line (**you**).
3. Pay USD 99/yr (**you**), accept the agreement (**you**).
4. After approval: Certificates, Identifiers & Profiles → App IDs `com.dgtllc.b`, `com.dgtllc.bs`; App Store Connect → New App ×2 (name, primary language English, bundle id, SKU `dgtllc-b` / `dgtllc-bs`).
5. App Information: category Business; copyright "© 2026 DAMAAN GENERAL TRADING L.L.C"; support URL https://dgt.llc; privacy URL above. Age rating: all "None" → 4+. Export compliance: uses only standard HTTPS → "Yes, exempt". App Privacy: `data-safety.md`. Review notes: `docs/store/ios-requirements.md`. Screenshots: 6.9" iPhone (1320×2868) + 13" iPad (2064×2752) — I prepare them.

## 3. Samsung Galaxy Store — https://account.samsung.com → https://seller.samsungapps.com/
1. Create a Samsung account with the company e-mail ([CONFIRM which]). Register as seller → **Commercial seller** (**you**): company name, address, phone, D-U-N-S, representative, company bank account, public support e-mail/URL, privacy-policy URL.
2. Add application ×2: category Business, free, content rating, countries (all or UAE + the countries you operate in), upload the signed release (`.aab`, or the signed `.apk` if AAB is not offered), listing text + screenshots + icon, reviewer login.

## What I do the moment a number/approval arrives
D-U-N-S → I update these sheets and the store texts. Google/Samsung approved → I upload the files and complete the listings with you at the confirm/payment/OTP steps. Apple approved → cloud-Mac build (`scripts/ios-build-apps.sh`) the same day.
