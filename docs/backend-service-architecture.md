# Backend Service Architecture

## API Module Structure

Route handlers will be added under:

```text
app/api/erp/
  auth/
    session/
    profile/
  permissions/
  translations/
  approvals/
  ledgers/
  roznamcha/
  reports/
```

Current Phase 1 status: folders are prepared only. Route handlers are not started yet.

## Backend Folder Structure

```text
lib/
  auth/
    session.ts
  permissions/
    middleware.ts
    enterprise-roles.ts
  services/
    multilingual-service.ts
    approval-service.ts
    ledger-service.ts
    roznamcha-service.ts
  repositories/
    approvals-repository.ts
    ledgers-repository.ts
    roznamcha-repository.ts
  db/
    transactions.ts
```

## Service Architecture

Every future API route should follow:

```text
API Route
  -> requireErpSession()
  -> authorize()
  -> Zod validation
  -> service method
  -> repository/database transaction
  -> audit/change history
  -> response
```

## Middleware Structure

Authentication:

- `getCurrentErpSession()`
- `requireErpSession()`

Permissions:

- `hasRolePermission()`
- `canAccessCountry()`
- `canAccessCountryBranch()`
- `canAccessCityBranch()`
- `canApprove()`
- `authorize()`

## Authentication Flow

```text
1. Supabase Auth validates session.
2. API calls requireErpSession().
3. Profile is loaded from profiles.
4. Active role assignments are loaded from user_role_assignments.
5. Session receives roles, country ids, main branch ids, city branch ids, and preferred language.
6. API continues only when authenticated.
```

## Ledger Transaction Flow

```text
1. Service receives journal lines.
2. Every line must have debit or credit, not both.
3. Debit total must equal credit total.
4. Exchange rates must be positive.
5. Posting plan is created.
6. Repository posts journal and ledger entries in a database transaction.
7. Ledger balances are updated.
8. Audit history is written.
```

## Roznamcha Posting Flow

```text
1. Select Super Admin, Country, or Branch Roznamcha.
2. Validate required scope.
3. Generate voucher number.
4. Add payment lines.
5. Validate balanced debit/credit.
6. Create ledger posting plan.
7. Repository creates draft/posting records.
8. Ledger service updates ledgers.
```

## Multilingual Service Flow

```text
1. User preferred language is loaded from session.
2. System resolves text using preferred language.
3. Fallback order: selected language -> English -> original text.
4. Record translation payload stores English, Arabic, Urdu, Persian/Farsi, and Pashto fields.
5. RTL languages use language direction from supportedLanguages.
```

## Approval Workflow Service Flow

```text
1. Sensitive action requests approval.
2. Approval service checks permission and scope.
3. Approval request is created.
4. Record is locked while pending.
5. Approver approves or rejects.
6. Approved changes are applied by the future repository layer.
7. Record can be unlocked after decision.
```

