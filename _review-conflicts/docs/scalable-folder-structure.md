# Scalable Folder Structure

## Goal

The ERP must grow module-by-module without rewriting the foundation. Each module should follow the same structure for validation, permissions, actions, server logic, reusable components, reports, approvals, translations, and ledger posting.

## Top-Level Structure

```text
app/
  dashboard/
  api/

components/
  ui/
  layout/
  forms/
  tables/
  dropdowns/
  reports/
  documents/

features/
  approvals/
  i18n/
  settings/
  branch-management/
  locations/
  users/
  accounts/
  ledger/
  roznamcha/
  payments/
  currency/
  purchases/
  sales/
  shipping/
  clearing/
  inventory/
  hr-payroll/
  reports/
  modules/

lib/
  accounting/
  approval/
  architecture/
  audit/
  db/
  forms/
  i18n/
  modules/
  permissions/
  reports/
  security/
  settings/
  supabase/

supabase/
  migrations/
  seed.sql
  seed_phase_1.sql

tests/
  accounting/
  permissions/
  approvals/
  i18n/
  reports/
```

## Module Folder Standard

Each feature module should use:

```text
features/{module}/
  actions.ts
  validation.ts
  permissions.ts
  constants.ts
  components/
  server/
  reports/
```

Financial modules can add:

```text
features/{module}/
  posting/
  approvals/
  translations/
```

## Reusable Component Structure

Reusable UI logic should live outside modules:

```text
components/forms/
  enterprise-form-shell.tsx
  form-section.tsx
  approval-footer.tsx

components/dropdowns/
  management-dropdown.tsx
  country-dropdown.tsx
  branch-dropdown.tsx
  account-dropdown.tsx

components/tables/
  data-table.tsx
  ledger-table.tsx
  report-table.tsx

components/reports/
  report-shell.tsx
  report-toolbar.tsx
  export-buttons.tsx
```

## Rule For Future Modules

Before building any future module, define:

- module contract.
- required tables.
- permissions.
- approval actions.
- translation fields.
- ledger posting impact.
- report definitions.
- number sequences.
- audit rules.

