# Reusable Module Structure

## Module Folder Pattern

Every business module should follow this structure:

```text
features/{module}/
  actions.ts
  validation.ts
  permissions.ts
  constants.ts
  components/
    {module}-form.tsx
    {module}-table.tsx
    {module}-filters.tsx
  server/
    queries.ts
    mutations.ts
  reports/
    definitions.ts
```

Large modules may add:

```text
features/{module}/
  posting/
    journal-builder.ts
    ledger-posting.ts
  approvals/
    approval-policy.ts
  translations/
    translation-fields.ts
```

## Module Contract

Every module must declare:

- `moduleCode`
- `displayName`
- `isFinancial`
- `requiredPermissions`
- `approvalRules`
- `translationFields`
- `reportDefinitions`
- `numberSequences`

## Financial Module Contract

If `isFinancial = true`, the module must support:

- account selection.
- ledger selection.
- balanced journal creation.
- approval before posting when required.
- ledger posting.
- audit log creation.
- report snapshots.

## Module Integration Points

Every module connects to:

- country scope.
- main branch or city branch scope.
- user role assignment.
- approval workflow.
- audit logs.
- translations.
- reports.
- attachments when needed.
- number sequences.

## Future Modules

The same structure applies to:

- FMS Core.
- Shipping Line.
- Clearing Agent.
- Sales and Purchase.
- Inventory.
- Warehouse.
- HR and Payroll.
- Marketing.
- Document Management.
- CRM.

