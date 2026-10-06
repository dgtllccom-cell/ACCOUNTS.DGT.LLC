# Phase 1 Enterprise ERP/FMS Architecture

## UI/UX Reference (Canonical)

The ERP UI/UX must follow the project's canonical design reference (Figma) and be implemented as connected modules inside the existing app (no disconnected standalone pages).

See: `docs/ui-ux-design-reference.md`.

## Phase 1 Scope

Phase 1 extends the current accounting foundation without dropping or renaming existing tables. It adds the enterprise structures needed for:

- Multi-country organization control.
- Super Admin, Country, Main Branch, City Branch, and Agent dashboards.
- Multilingual display and record translation.
- Approval workflow for sensitive actions.
- Ledger and Roznamcha foundations.
- Settings and management master data.
- Future module registration for shipping, clearing, sales, purchases, inventory, HR/payroll, CRM, and documents.

APIs and frontend CRUD screens come after this foundation is reviewed and applied.

## Folder Structure

```text
docs/
  phase-1-enterprise-architecture.md
  database-erd.md
  accounting-ledger-flow.md
  multilingual-architecture.md
  approval-workflow.md
  roles-permissions-matrix.md
  future-module-architecture.md
  naming-conventions.md
  reusable-module-structure.md
  reusable-dropdown-architecture.md
  reusable-form-architecture.md
  reusable-report-architecture.md
  scalable-folder-structure.md
  backend-service-architecture.md

supabase/
  migrations/
    0003_enterprise_erp_phase_1.sql
    0004_enterprise_role_alignment.sql
  seed_phase_1.sql

lib/
  accounting/
    ledger-structure.ts
    roznamcha-flow.ts
  approval/
    approval-actions.ts
  i18n/
    languages.ts
  modules/
    erp-modules.ts
    module-contract.ts
  permissions/
    enterprise-roles.ts
  architecture/
    naming-conventions.ts
  forms/
    form-architecture.ts
  reports/
    report-architecture.ts
  settings/
    dropdown-architecture.ts
```

## Complete Database Table List

Existing foundation tables retained:

- `companies`
- `branches`
- `profiles`
- `roles`
- `permissions`
- `role_permissions`
- `memberships`
- `accounts`
- `journal_entries`
- `journal_lines`
- `ledger_entries`
- `attachments`
- `audit_logs`
- `countries`
- `country_branches`
- `city_branches`
- `user_role_assignments`
- `currency_rates`
- `transactions`
- `reports`

Phase 1 organization and location tables:

- `states_provinces`
- `cities`
- `areas_locations`

Phase 1 multilingual tables:

- `languages`
- `user_language_preferences`
- `translation_keys`
- `translation_values`
- `record_translations`
- `translation_audit_logs`

Phase 1 approval and audit tables:

- `approval_requests`
- `approval_request_items`
- `approval_status_history`
- `record_locks`
- `soft_delete_logs`
- `record_change_history`

Phase 1 enterprise role template tables:

- `erp_role_templates`
- `erp_role_template_permissions`

Phase 1 accounting and ledger tables:

- `account_groups`
- `account_types`
- `ledgers`
- `ledger_balances`
- `journal_reversals`

Phase 1 Roznamcha and payment tables:

- `roznamcha_entries`
- `roznamcha_lines`
- `voucher_sequences`
- `payment_methods`

Phase 1 USD and exchange tables:

- `daily_usd_rates`
- `usd_purchase_sales`
- `exchange_rate_history`

Phase 1 settings and management tables:

- `management_categories`
- `management_parameters`
- `management_parameter_values`

Phase 1 report framework tables:

- `report_definitions`
- `report_runs`
- `report_exports`
- `report_snapshots`

Phase 1 modular ERP framework tables:

- `erp_modules`
- `module_dependencies`
- `module_settings`
- `module_number_sequences`
- `module_audit_rules`

## Migration Plan

1. Keep all existing tables and functions stable.
2. Add enum types for language direction, approval actions, approval status, branch level, ledger scope, Roznamcha type, payment entry type, report status, and module status.
3. Add safe optional columns to existing `countries` and `profiles`:
   - `countries.default_language_code`
   - `profiles.preferred_language_code`
4. Add master location tables below `countries`.
5. Add multilingual translation tables.
6. Add approval workflow and record locking tables.
7. Add ledger scope and balance tables beside the existing accounting tables.
8. Add Roznamcha tables and voucher sequencing.
9. Add settings/management generic master tables.
10. Add future module registry tables.
11. Add seed data for languages, initial countries, role templates, permissions, management setup, payment methods, report definitions, and modules.

## Dashboard Hierarchy

Dashboard levels:

- Super Admin Dashboard: global countries, branches, users, approvals, USD reports, audit.
- Country Dashboard: one country, main branch, city branches, rates, ledgers, reports.
- Main Branch Dashboard: country main branch operations and approvals.
- City / Branch Dashboard: local users, transactions, Roznamcha, customers, branch ledger.
- Agent Dashboard: assigned shipments, clearing, customers, collections, tasks.

## Module Expansion Rule

Every future module must attach to:

- Country.
- Main branch or city branch when applicable.
- User and role scope.
- Ledger/account when financial.
- Approval workflow for sensitive changes.
- Audit logs.
- Translation records for multilingual fields.
- Reports and export framework.

## Reusable Architecture

Phase 1 also defines enterprise reusable standards:

- Naming conventions: [naming-conventions.md](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/naming-conventions.md)
- Module structure: [reusable-module-structure.md](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/reusable-module-structure.md)
- Dropdown architecture: [reusable-dropdown-architecture.md](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/reusable-dropdown-architecture.md)
- Form architecture: [reusable-form-architecture.md](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/reusable-form-architecture.md)
- Report architecture: [reusable-report-architecture.md](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/reusable-report-architecture.md)
- Scalable folder structure: [scalable-folder-structure.md](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/scalable-folder-structure.md)
- Backend service architecture: [backend-service-architecture.md](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/backend-service-architecture.md)

These standards ensure future modules can connect to accounting, ledgers, Roznamcha, payments, reports, approvals, and multilingual records without redesign.
