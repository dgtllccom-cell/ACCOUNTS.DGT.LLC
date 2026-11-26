# Company identity — the ONE set of values for every store, account and document

Confirmed by the owner on 2026-11-26 and identical to the Dun & Bradstreet record. Copy these **character for character**;
Apple, Google and Samsung compare the enrolment with the D-U-N-S record.

| Field | Exact value |
|---|---|
| Legal entity name | `DAMAAN GENERAL TRADING L.L.C` (capitals, dots in L.L.C, no trailing dot) |
| D-U-N-S number | `850005751` |
| Entity type | Corporation (Apple/Google: "Organization" / "Company"; Samsung: "Commercial seller") |
| Address line 1 | `Office No. 201` |
| Address line 2 / area | `Al Ras – Deira` |
| City / emirate | `Dubai` |
| Country | `United Arab Emirates` (country code AE) |
| One-line address | `Office No. 201, Al Ras – Deira, Dubai, United Arab Emirates` |
| Trade licence | 1099620 (expiry 15 Sep 2027 per ERP) |
| Phone | +971 54 481 6664 |
| Website | https://dgt.llc |
| Copyright line | `© 2026 DAMAAN GENERAL TRADING L.L.C` |

Retired variants — do **not** use anywhere: "Damaan General Trading LLC" (no dots), "Al Hathoor Building, Office 2-01", "Al Hathboor Building, Office No. 201".
If a form has no "–" character, use a plain hyphen: `Al Ras - Deira`.

## Where it is applied
| Place | Status |
|---|---|
| Apple Developer enrolment / App Store Connect seller | to be typed by the owner (`ios-requirements.md` step 1, `app-store-connect.md`) |
| Google Play Console developer profile + public developer address | to be typed by the owner (`registration-data-sheets.md` §1) |
| Samsung Seller Portal (commercial seller) | to be typed by the owner (`registration-data-sheets.md` §3) |
| Privacy policy `https://api.dgt.llc/legal/privacy` | registered-office line added (5 languages); live after the next approved Production release |
| ERP company master (Production `companies`, id `fbfab380-…`) | name / legal / trade name were already correct; address corrected 2026-11-26 from `al ras` to the one-line address above (owner-approved, single field) |
| ERP login screen logo alt text | corrected to `DAMAAN GENERAL TRADING L.L.C - DGT.LLC` |
| docs/store (owner-checklist, registration-data-sheets, START-HERE, store-readiness, ios-requirements, app-store-connect) | corrected |
| Android upload-key certificate subject (`O=DAMAAN GENERAL TRADING LLC`) | left as is: never shown to users or checked by the stores; changing it would mean a new signing key |
