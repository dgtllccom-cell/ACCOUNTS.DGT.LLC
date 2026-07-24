# DGT Accounts

Modern SaaS-style accounting and trading management system built with Next.js, TypeScript, Tailwind CSS, shadcn/ui patterns, Supabase PostgreSQL, Supabase Auth, Supabase Storage, Drizzle ORM, Zod, TanStack Table, Recharts, Vitest, and Playwright.

## First Milestone

This milestone intentionally focuses on the financial foundation:

- Supabase PostgreSQL schema for companies, branches, profiles, memberships, roles, permissions, accounts, journal entries, ledger entries, attachments, and audit logs.
- Role-based access model with company and branch membership boundaries.
- Row Level Security policies for member reads and permission-gated writes.
- Transaction-safe `post_journal_entry` database function that locks the draft entry, validates debit/credit balance, writes normalized ledger rows, marks the document posted, and writes an audit log.
- Next.js App Router dashboard shell with protected routes using Supabase Auth.
- Workspace onboarding RPC for the first company, branch, owner role, owner membership, and starter chart of accounts.
- Audited account creation RPC for permission-checked account setup.
- Initial pages for dashboard, companies, users/roles, accounts/khaata, and reports.
- TypeScript helpers and tests for accounting balance checks and permission behavior.

## Architecture Decisions

### Application Structure

```text
app/
  auth/
  dashboard/
components/
  layout/
  ui/
features/
  accounts/
  auth/
  companies/
  ledger/
  users/
lib/
  accounting/
  db/
  permissions/
  supabase/
supabase/
  migrations/
tests/
```

Feature modules own their forms, tables, actions, and validation. Shared infrastructure lives under `lib/`. Sensitive business operations use server actions and database functions instead of client-only React logic.

### Database Model

Companies are the primary tenant boundary. Branches optionally narrow operational access. Users authenticate through Supabase Auth and are represented in `profiles`. Memberships connect users to company or branch scopes through a role.

Financial records use immutable posting:

- `journal_entries` starts as `draft`.
- `journal_lines` hold debit and credit draft details.
- `post_journal_entry()` validates the entry and creates `ledger_entries`.
- Posted entries cannot be directly edited by normal policies.
- Edits, deletes, and reversals should be modeled as new audit events and corrective documents.

Reports must query normalized `ledger_entries`, not draft purchases, sales, or invoices.

### Multi-Country Branch Management

The branch hierarchy now has a dedicated foundation for:

- Super Admin global control.
- Country Main Branch per country.
- City/Sub Branch under a selected country.
- Role scopes for `Super Admin`, `Country Admin`, `Branch Admin`, and `Staff/User`.
- Local-currency transactions with USD conversion for global reports.

The design lives in [docs/multi-country-branch-management.md](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/multi-country-branch-management.md).
The database migration is [supabase/migrations/0002_multi_country_branch_management.sql](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/supabase/migrations/0002_multi_country_branch_management.sql).
The initial admin panel is `/dashboard/branch-management`.

### Permissions

Permissions are stored as resource/action pairs, for example:

- `accounts:create`
- `journal_entries:post`
- `reports:export`

Roles are company-owned and receive permissions through `role_permissions`. The starter templates are `owner`, `accountant`, and `viewer`, implemented in [lib/permissions/model.ts](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/lib/permissions/model.ts).

### Row Level Security

RLS is enabled on tenant and finance tables. Policies allow members to read company-scoped data, while writes require permission checks through `has_company_permission()`.

The database function `post_journal_entry()` is `security definer` and performs its own permission check for `journal_entries:post`. This keeps posting atomic and protects the ledger from partial frontend writes.

### Accounting Flow

1. Create a draft business document or manual journal entry.
2. Validate every line has exactly one positive side: debit or credit.
3. Validate total debits equal total credits.
4. Post inside the database transaction.
5. Insert one ledger row per journal line.
6. Mark the source entry as `posted`.
7. Write an immutable audit log row.

Purchases, sales, invoices, and currency exchange modules should produce balanced journal entries and call the same posting path.

## Environment

Copy `.env.example` to `.env.local` and provide:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run test:e2e
```

## Database

Apply the baseline migration in [supabase/migrations/0001_foundation.sql](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/supabase/migrations/0001_foundation.sql), then seed permissions with [supabase/seed.sql](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/supabase/seed.sql).

The baseline migration already inserts the starter permissions required by onboarding. The seed file is idempotent and can be rerun safely.

Drizzle schema definitions live in [lib/db/schema.ts](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/lib/db/schema.ts).

## Next Modules

Build the remaining product in this order:

1. Company onboarding and initial owner membership creation.
2. Account/khaata CRUD with import/export and branch filters.
3. Journal entry UI backed by the posting function.
4. Purchases and sales as document modules that generate journals.
5. Invoice print views and Supabase Storage attachments.
6. Ledger, trial balance, account statement, and tax/compliance reports.

## Enterprise Phase 1

Phase 1 extends the foundation for a full enterprise ERP/FMS without removing current tables.

Key files:

- [Phase 1 Architecture](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/phase-1-enterprise-architecture.md)
- [Database ERD](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/database-erd.md)
- [Accounting and Roznamcha Flow](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/accounting-ledger-flow.md)
- [Multilingual Architecture](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/multilingual-architecture.md)
- [Approval Workflow](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/approval-workflow.md)
- [Roles and Permissions Matrix](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/roles-permissions-matrix.md)
- [Future Module Architecture](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/future-module-architecture.md)
- [Naming Conventions](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/naming-conventions.md)
- [Reusable Module Structure](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/reusable-module-structure.md)
- [Reusable Dropdown Architecture](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/reusable-dropdown-architecture.md)
- [Reusable Form Architecture](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/reusable-form-architecture.md)
- [Reusable Report Architecture](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/reusable-report-architecture.md)
- [Scalable Folder Structure](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/scalable-folder-structure.md)
- [Backend Service Architecture](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/backend-service-architecture.md)
- [Phase 1 Migration](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/supabase/migrations/0003_enterprise_erp_phase_1.sql)
- [Enterprise Role Alignment Migration](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/supabase/migrations/0004_enterprise_role_alignment.sql)
- [Phase 1 Seed](C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/supabase/seed_phase_1.sql)
