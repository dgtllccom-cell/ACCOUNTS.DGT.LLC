# Reusable Report Architecture

## Goal

Reports must be reusable, multilingual, exportable, printable, and scoped by role.

## Report Tables

- `report_definitions`
- `report_runs`
- `report_exports`
- `report_snapshots`

## Report Contract

Each report must define:

- `reportCode`
- `moduleCode`
- `requiredPermission`
- `scopeLevel`
- `defaultCurrency`
- `filters`
- `columns`
- `grouping`
- `exportTypes`
- `translationKeys`

## Report Flow

1. User opens report.
2. System reads user role and scope.
3. User selects filters.
4. Server validates filters.
5. Server queries normalized data.
6. Financial reports convert or read USD totals.
7. System creates `report_runs`.
8. System creates `report_snapshots` for stable output.
9. User exports PDF, Excel, or print.

## Financial Report Rule

Reports should not calculate from raw forms when ledger data exists.

Preferred source order:

1. `ledger_entries`
2. `ledger_balances`
3. posted `transactions`
4. approved report snapshots

## Multilingual Reports

Labels use `translation_keys` and `translation_values`.

Record text uses `record_translations`.

Export language is taken from:

1. selected report language.
2. user preferred language.
3. English.

## Report Examples

- Daily Report.
- Ledger Report.
- Roznamcha Report.
- Payment Report.
- Receipt Report.
- Country Report.
- Branch Report.
- USD Report.
- Sales Report.
- Purchase Report.
- Audit Report.
- Trial Balance.
- Balance Sheet.
- Profit/Loss.

