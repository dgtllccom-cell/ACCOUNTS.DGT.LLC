# Engineering Report — Company Branding Rollout, Cleanup & Access

**Date:** 2026-07-31
**Scope:** Multi-company branding rollout, test-data cleanup, user-access report, responsive/PWA status, verification.
**Guiding rule honoured throughout:** reuse existing architecture — no duplicate tables, no duplicate systems.

---

## 1. What was delivered this cycle (committed)

| Commit | Area | Summary |
|---|---|---|
| `f3268f6` | Branding resolver | New `GET /api/erp/branding?countryId=` reads the **existing** `country_company_profiles` master. Scope-enforced (a Country Admin can only read their own country's branding). Employee Certificate now fetches the **employee's own country** branding instead of a hardcoded name. |
| `3783d1a` | Branding fields | Additive migration `20260809_branding_extra_fields.sql` adds `company_stamp_url`, `letterhead_url`, `report_header`, `certificate_header`, `hr_manager_name`, and 5-language `company_name_en/ur/ar/fa/ps` to `country_company_profiles`. All nullable, `IF NOT EXISTS`, re-runnable, no data loss. Resolver + certificate render them. |
| `97c5df6` | Central print engine | `ReportActions` + `printRecord` (the universal Print / PDF / Excel engine used across the ERP) now pull logo, company name, header, footer and watermark from the shared resolver via `lib/branding/client.ts` (cached). **Every** report consumer is branded automatically by the logged-in user's country, with a per-record `countryId` override. |
| `339fff1` | 5-language | Clearing forms (truck / import / transit loading, truck registration) pass the active language so the branded header uses the correct 5-language company name. |
| `e861bc5` | Leak removal | Removed hardcoded `"Damaan…"` / `"DAMAN BUSINESS GROUP"` fallbacks in the 3 detailed-ledger reports and the purchase-transfer report header. Dynamic `header.companyName` remains primary; fallback is now neutral. |
| `8a2aec8` | Cleanup + access | `10_test_data_cleanup.sql` (transactional, dry-run by default) and `11_user_access_report.sql` (no passwords). |

**How isolation is guaranteed (requirement #3):** branding is keyed on `country_id` with a unique active-profile index. For a Country Admin, the resolver defaults to *their* country, so one company's branding cannot appear in another's report. For the Employee Certificate it is keyed on the **employee's** `country_id`. For Super Admin cross-country views, a `countryId` can be passed per record.

---

## 2. Verification performed (static / code-level)

- ✅ Branding resolver returns the correct per-country fields; scope check blocks cross-country reads for non-super-admins.
- ✅ Employee Certificate uses the employee's country branding (logo, name, address, stamp, HR name, certificate header).
- ✅ Central print engine (Print / PDF / Excel) uses branding; **no** `Digital Dock ERP` / `DAMAN` literals remain in `components/ui` print code (grep-verified: 0 matches).
- ✅ 5-language company name plumbed end-to-end (`company_name_{en,ur,ar,fa,ps}` → resolver `companyNameByLang` → `brandingName(b, lang)`).
- ✅ SQL structurally checked: balanced parentheses/dollar-quotes, dry-run `ROLLBACK` default, `to_regclass`-guarded deletes.
- ✅ Changed TS/TSX files: balanced braces/parens/backticks.
- ✅ PWA/responsive config present and correct: `manifest.webmanifest`, `appleWebApp.capable`, viewport `device-width` + `viewportFit: cover`, `themeColor`.

**Cannot be verified from here (requires your runtime — build/deploy/device):**
- Live logo swapping by country/branch on real data.
- On-device mobile/Samsung/iPhone/tablet layout rendering.
- Actual PDF/print output pixels.
- Running the migration and cleanup against the live database.

---

## 3. Pending items (honest list)

1. **Run migration `20260809_branding_extra_fields.sql`** on your database, then upload each country's `company_logo_url`, `company_stamp_url`, `letterhead_url`, header/footer text into `country_company_profiles`. Until logos are uploaded, headers show the company **name** (correct) but no image.

2. **Per-branch branding decision.** `country_company_profiles` is per **country/company** (one active profile per country). "Each *branch* has its own logo" is **not** modelled today. Options, both no-duplication:
   - (a) Keep branding at country/company level; show branch name/address in the header (current behaviour). *Recommended.*
   - (b) Add optional override columns (`logo_url`, `stamp_url`) to `country_branches` / `city_branches` and have the resolver prefer a branch override when present. Small additive migration; say the word and I'll build it.

3. **Large bespoke report views** (detailed ledger, journal report, roznamcha report, purchase-transfer, purchase dashboard) render their own header from a server-supplied `header` object rather than the central engine. They already use `header.companyName`; the DAMAN fallbacks are removed. **Recommended:** confirm each report's API populates `header` from `country_company_profiles` so the name/logo are always present. This is a per-report API check (server-side), not a new system.

4. **Mock/sample data literals.** `purchase-order-management-dashboard.tsx` (14) and `purchase-booking-journal-report-view.tsx` (11) contain `"Damaan…"` strings that look like **sample/demo data**, not branding. They should be cleared by the test-data cleanup or replaced with real data — flagging rather than blindly editing.

5. **Email / WhatsApp templates.** The resolver is ready; wiring branding into outbound email/WhatsApp message templates still needs to be applied where those templates are built (server-side send paths).

6. **Cleanup execution (requirement #6/#7/#8).** Take a full backup, run `10_test_data_cleanup.sql` as a dry run, review the NOTICE counts, then flip `ROLLBACK`→`COMMIT`. Fill the keeper branch IDs in Section 3 to prune test branches/companies/users down to the 4 countries + Super Admin + Country Admins.

7. **Device/PWA sign-off (requirement #5).** Config is correct; actual per-screen layout QA on physical Mobile/Samsung/iPhone/Tablet/Desktop/PWA is a runtime task on your side.

---

## 4. Recommended next actions (your environment)

1. `pg_dump` full backup.
2. Run migrations (`20260809…` and any unapplied serial migrations).
3. Upload per-country logo/stamp/letterhead into `country_company_profiles`.
4. Dry-run `10_test_data_cleanup.sql`; review; `COMMIT`.
5. Run `11_user_access_report.sql`; confirm 1 Super Admin + 4 Country Admins.
6. Build, deploy, and QA branding + layouts on devices.

**No completion is claimed for the runtime items above** — they depend on your database and devices, which I cannot execute from here.
