# Future Module Architecture

## Module Registry

Future ERP modules are registered in:

- `erp_modules`
- `module_dependencies`
- `module_settings`
- `module_number_sequences`
- `module_audit_rules`

## Initial Modules

- FMS Core
- Shipping Line
- Clearing Agent
- Sales and Purchase
- Inventory
- Warehouse
- HR and Payroll
- Marketing
- Document Management
- CRM
- Reports

## Integration Contract

Every future module should support:

- country and branch scope.
- role permissions.
- approval workflow.
- audit logs.
- record translations.
- ledger posting if financial.
- reports and export.
- document attachments.
- numbering sequence.

## Financial Module Rule

If a module creates financial impact, it must produce:

- journal entry.
- balanced journal lines.
- ledger entries.
- audit log.
- optional approval request.
- report metadata.

