# Naming Conventions

## Database Naming

Tables:

- Use plural snake_case names.
- Examples: `countries`, `city_branches`, `approval_requests`, `record_translations`.

Columns:

- Use snake_case.
- Use `*_id` for foreign keys.
- Use `created_at`, `updated_at`, `deleted_at` consistently.
- Use `created_by`, `approved_by`, `rejected_by`, `posted_by` for actor references.

Indexes:

- Pattern: `{table}_{columns}_idx`.
- Unique indexes: `{table}_{columns}_idx` with `unique index`.
- Soft-delete aware unique indexes must include `where deleted_at is null`.

Enums:

- Use singular snake_case.
- Examples: `approval_status`, `ledger_scope`, `roznamcha_type`.

Functions:

- Use verb-first snake_case.
- Examples: `create_country`, `post_journal_entry`, `can_access_country`.

## TypeScript Naming

Folders:

- Use kebab-case for feature folders.
- Examples: `branch-management`, `country-setup`, `payment-entry`.

Files:

- Components: kebab-case file names, PascalCase exports.
- Server actions: `actions.ts`.
- Validation: `validation.ts`.
- Constants: clear domain names, for example `enterprise-roles.ts`.

Types:

- Use PascalCase.
- Examples: `ApprovalAction`, `LedgerScope`, `SupportedLanguage`.

Constants:

- Use camelCase exports for arrays and maps.
- Examples: `enterpriseRoles`, `supportedLanguages`, `erpModules`.

## API Naming

Routes:

- Use noun-based kebab-case paths.
- Examples:
  - `/api/branch-management/countries`
  - `/api/approvals/requests`
  - `/api/roznamcha/entries`

HTTP verbs:

- `GET`: list or read.
- `POST`: create or submit action.
- `PATCH`: update draft or editable fields.
- `DELETE`: request soft delete only, never permanent delete.

## UI Naming

Menu labels:

- Use clear business names.
- Examples: `Branch Management`, `Daily Payment / Roznamcha`, `USD Rates`.

Form labels:

- Use short labels.
- Place longer help text below the field, not inside the label.

Report names:

- Pattern: `{Scope} {Report Type}`.
- Examples: `Country Ledger Report`, `Branch Roznamcha Report`, `Global USD Report`.

