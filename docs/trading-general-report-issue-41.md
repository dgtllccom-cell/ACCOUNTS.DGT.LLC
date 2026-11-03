# Trading General Report — Implementation status

Issue: #41. This feature is an additive, **read-only** report. It does not alter stock, payments, original bills, or accounting postings.

## Current implementation (draft)
- Route: `/dashboard/reports/trading-general`
- UI: `features/reports/components/trading-general-report-view.tsx`
- Server session check; data fetched from existing source-specific APIs:
  - `/api/erp/purchases/booking-journal-report`
  - `/api/erp/purchases/local-purchase`
  - `/api/erp/sales/booking-journal-report`
- Source tabs All, Purchase, Sales, Booking, Local; simple search and per-row expand.
- Values not supplied by an API render as a dash, never guessed.

## Important limitations — NOT READY TO MERGE/DEPLOY
1. The Local Sales source has **not** been mapped. The Local tab currently means Local Purchase only. Confirm canonical Local Sales source and add it.
2. All source API responses, field mapping and URLs need live DEV verification; source report links are generic and do not yet deep-link to individual records.
3. Booking/Local/Sales API item fields differ. Verify bill number, amount, gross/net weight, account, country/port, unit, branch and dates against real saved records.
4. UI currently has English-only new copy. Translate all new visible labels into EN, UR, AR, FA, PS and verify RTL in each.
5. No verified payment, transaction, load, transit, receipt, confirmed warehouse or customer-sale linkage yet. Do NOT derive any of these from a status label or from one another. Add an explicitly scoped, server-backed read model with original record identifiers and authorization per source.
6. Do not combine amounts from different currencies or quantities from different units. Aggregate only by compatible currency/UOM. Gross and net weights must remain distinct.
7. Permission/policy review still required for `/dashboard/reports/trading-general`. No direct link in canonical sidebar yet; add after testing and approval.
8. Print/PDF/Excel still need wiring through the existing universal print engine, with table landscape and bill portrait modes.
9. No build, TypeScript, lint, unit, browser, five-language, RBAC or Production tests have been executed from this connector. Branch is draft.

## Next steps
- Build an authorized server-side unified read-model service, preserving each original bill's ID, source, account, currency, qty/UOM, finance and movement links. Avoid client-derived cross-domain totals.
- Add Local Sales and a canonical nested transaction/stock movement drill-down. Payment totals must reconcile to real posted Roznamcha and advance/remaining entries.
- Add complete filters, printing, responsive layouts and translations.
- Run `tsc`, build, stock-journal guard, regression tests, screenshot suite and browser verification on DEV; then review and deploy via existing EPS/Production gate. Do not overlap production deployments.

## Menu update (2026-11-03)
- Added top-level **All Entries** immediately beneath Dashboard in canonical `components/layout/digital-dock-premium-sidebar.tsx` and mirrored `lib/navigation/sidebar.ts`.
- Added explicit `/dashboard/reports/trading-general` route policy.
- IMPORTANT: nav.all_entries localization, business-domain permission hardening, real data scope, and browser verification remain required. No deployment approved yet.
