#!/usr/bin/env bash
# One-time GitHub branch clean-up (19 Nov 2026). Leaves exactly: main, production, archive/branches-20261119.
# Deletes a branch ONLY if every commit on it is already inside main or inside archive/branches-20261119
# (the archive keeps the 48 branches whose work was never merged — restore one with: git branch <name> <sha>,
#  the names and SHAs are in that branch's last commit message). Nothing that is not saved is ever deleted.
# Run from the laptop (an account allowed to delete branches):  bash scripts/github/cleanup-branches-20261119.sh
set -uo pipefail
git fetch --quiet --prune origin '+refs/heads/*:refs/remotes/origin/*'
for keep in main production archive/branches-20261119; do
  git rev-parse --verify --quiet "origin/$keep" >/dev/null || { echo "missing origin/$keep — stopping"; exit 1; }
done
deleted=0; kept=0
while read -r b; do
  [ -z "$b" ] && continue
  git rev-parse --verify --quiet "origin/$b" >/dev/null || continue                      # already gone
  if git merge-base --is-ancestor "origin/$b" origin/main || git merge-base --is-ancestor "origin/$b" origin/archive/branches-20261119; then
    if git push --quiet origin --delete "$b"; then deleted=$((deleted+1)); echo "deleted  $b"; else echo "FAILED   $b"; fi
  else
    kept=$((kept+1)); echo "KEPT (has unsaved commits) $b"
  fi
done <<'LIST'
audit/dgt-connected-workflows-20261018
ci/github-setup
ci/github-setup-main
claude/elegant-hugle-ed1145
claude/new-session-wdz1o8
claude/vigilant-newton-ce1473
codex/compact-mobile-control-center
codex/fix-production-db-wiring
copilot/dgt
copilot/fix-copilot-issue
copilot/fix-with-copilot
design-google-studio
design/compact-shipping-dashboard-banner-20261009
design/dgt-dashboard-v22-responsive-preview
design/purchase-payment-journal-v23-ui-only
design/responsive-preview
dev
dgt-ptp-v24-web-preview
feat/accounting-corrections-final
feat/advance-filter-panel
feat/advance-menu-actions
feat/advance-menu-actions-r2
feat/advance-row-menu
feat/cash-journal-design
feat/company-form-redesign
feat/customer-auto-reply
feat/domain-separation-user-verification
feat/invoice-gallery-roznamcha-print
feat/issue-38-purchase-journal-booking-stock
feat/local-purchase-redesign
feat/mobile-store-apps
feat/pakistan-country-branch-setup
feat/payment-screens-approved-ui
feat/payment-screens-approved-ui-v2
feat/purchase-booking-list-20261114
feat/purchase-journal-booking-issue-38
feat/purchase-main-pages-design
feat/purchase-reference-layout
feat/register-view-full-entry
feat/report-redesign
feat/restore-ten-erp-colors-20261109
feat/short-register-headers
feat/stock-balance-report
feat/stock-journal-integration
feat/stock-menu-warehouse-register
feat/strengthen-erp
feat/ten-payment-pages-approved-ui
feat/trading-general-register-issue-41
feat/transfer-requires-paid-balance
feat/user-device-access-rights
feat/warehouse-register-admin-tables
feat/warehouse-register-branch-codes
feat/warehouse-register-readonly
feat/warehouse-register-refresh-20261112
feat/warehouse-stock-register-20261104
feature/advance-payment-compact-double-line-20261108
feature/dev-prod-db-separation
feature/general-warehouse-register-spec-20261108
feature/loading-main-register-role-scoped-20261108
feature/loading-statement-real-data-guards-20261108
feature/local-purchase-loading-posted-queue-20261105
feature/local-purchase-transfer-warehouse-export-20261104
feature/unified-purchase-sales-payment-ui-20261108
fix-production-next-build-manifest
fix/account-language-refresh-20261116
fix/account-registry-classification-20261116
fix/advance-invoice-currency-summary
fix/advance-register-test
fix/advance-summary-driver-phone
fix/allow-duplicate-names
fix/booking-journal-button-20261105
fix/branch-json-regression
fix/branch-smtp-test-settings
fix/cash-daily-rate-rpc-fallback-20261106
fix/cash-entry-credit-usd-order
fix/cash-entry-currency-post
fix/center-payment-cr-dr-details
fix/city-branch-save-checklist
fix/city-edit-location-area
fix/company-registry-remove-demo-data
fix/country-branch-final-review
fix/daily-exchange-rate-usd
fix/erp-wide-repair
fix/final-payment-reconciliation-bank-details
fix/goods-create-edit-validation-report
fix/goods-save-white-preview-20261115
fix/issue-44-superadmin-no-fake-metrics
fix/journal-five-tests
fix/kyc-all-incomplete-masters
fix/lane-centered-details-20261104
fix/lane-local-purchase-status
fix/ledger-portrait-landscape-bank-style-20261101
fix/loading-journal-and-transfer-workflow
fix/loading-weights-from-saved-goods
fix/local-purchase-po-payment-journal-verification
fix/local-purchase-registry-visibility-20261104
fix/local-purchase-verified-balance
fix/location-management-branch-workflows
fix/main-tsc-clean
fix/mobile-qa-summary-headers
fix/new-account-five-language
fix/pb-title-key-collision
fix/ps-transfer-lane-schema-20261101
fix/purchase-booking-0004-layout-account-isolation
fix/purchase-booking-build
fix/purchase-booking-shorten-country-tdz
fix/purchase-list-load-error
fix/qvc-incomplete-setup-queue
fix/record-language-display
fix/register-display-20261114
fix/register-entry-detail-text
fix/remaining-booking-table-20261104
fix/remaining-loaded-entries-20261104
fix/remaining-loading-balance
fix/remaining-payment-source-specific-journal-20261104
fix/remaining-return-register-after-save
fix/remaining-stays-after-partial-payment
fix/remove-mid-table-filter
fix/roznamcha-entry-types-restore
fix/sales-booking-responsive-layout
fix/scoped-user-delegation-20261024
fix/shared-viewer-language-20261116
fix/super-admin-branch-form
fix/truck-registration-language-layout
fix/truck-trial-chaman-office-access
integration/invoice-templates
integration/release-20261116
journal-print-standard
prototype-full-erp-20261008
prototype-full-erp-v7-20261009
prototype-full-erp-v8-20261102
recovery/2026-11-01-bill-preview-patch
release/2026-10-18
release/2026-10-18b
release/2026-10-20
release/2026-10-29-erp-repair
release/2026-10-30-erp-fixes
release/2026-10-30-multilingual-search
release/2026-10-31-final
release/2026-10-31-payment-summary
release/2026-10-31-rebased
release/2026-10-31-roznamcha-transfer
release/2026-11-01-reports-center
release/2026-11-02-access-control
release/2026-11-02-cards
release/20261118-unify
release/20261119-final
release/consolidated-20261116
release/print-templates-on-44fee93
release/production-20261116
release/rc-expense-framework
release/rc2
release/register-lot-current-stock
release/shipping-20260926
revert-148-fix/local-purchase-destination-routing
security/plaintext-credential-cleanup
security/reviewed-main-20260926
sync/unify-main-production-20261119
test/session-dynamic-error-coverage
ui/customer-order-reference-layout-20260925
ui/customer-order-reference-layout-20260925-r2
chore/branch-cleanup-script
LIST
echo "done: $deleted deleted, $kept kept. Remaining branches:"; git ls-remote --heads origin | sed 's|.*refs/heads/||'
