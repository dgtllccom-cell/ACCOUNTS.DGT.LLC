# Reusable Form Architecture

## Goal

Forms must be consistent, secure, multilingual, approval-aware, and module-ready.

## Form Layers

1. UI component.
2. React Hook Form state.
3. Zod validation.
4. Server action or API route.
5. Permission and scope check.
6. Approval decision.
7. Database mutation.
8. Audit and translation writes.
9. Report/ledger integration when needed.

## Standard Form Folder

```text
features/{module}/components/{module}-form.tsx
features/{module}/validation.ts
features/{module}/actions.ts
```

## Form Metadata

Every enterprise form should define:

- `formCode`
- `moduleCode`
- `requiredPermission`
- `scopeFields`
- `translationFields`
- `approvalActions`
- `auditEntity`
- `numberSequenceKey`

## Required Fields By Default

For scoped business records:

- country.
- main branch or city branch when applicable.
- created by.
- status.
- audit fields.
- deleted at for soft delete.

For financial records:

- account.
- ledger.
- currency.
- debit/credit or amount.
- exchange rate when needed.
- approval state.

## Save Flow

1. Client validates basic fields.
2. Server validates with Zod.
3. Server checks authentication.
4. Server checks role and scope.
5. Server checks approval policy.
6. If approval is required, create `approval_requests`.
7. If direct save is allowed, write data in transaction.
8. Write translations and audit logs.

## Edit/Delete Flow

Important edit/delete actions do not mutate the record immediately.

1. Create approval request.
2. Lock record.
3. Store before/after data.
4. Super Admin or allowed approver decides.
5. Apply or reject.

