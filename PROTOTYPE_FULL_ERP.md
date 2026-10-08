# DGT ERP — FULL UI PROTOTYPE BRANCH

Branch: `prototype-full-erp-20261008`

This branch is a design/prototype mirror of the ERP source.

## Safety
- Never deploy this branch to the Production VPS.
- Never merge prototype mock/session code into `main`.
- Prototype mode is enabled only with:
  - `DGT_PROTOTYPE_MODE=1`
  - `NEXT_PUBLIC_DGT_PROTOTYPE_MODE=1`
- In prototype mode:
  - a synthetic Super Admin session is used only to render the UI;
  - browser API calls are intercepted;
  - writes are no-op;
  - external network calls are blocked;
  - Supabase clients use local in-memory sample master data;
  - no Production database, ledger, stock, vouchers, email, WhatsApp, or VPS is changed.

## Goal
Render the existing ERP menu, forms, tables, journals, reports and workflows from the real source code so design changes can be reviewed first, then implemented separately after approval.
