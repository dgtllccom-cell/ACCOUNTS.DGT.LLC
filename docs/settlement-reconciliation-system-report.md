# SETTLEMENT & RECONCILIATION CONTROL CENTER
## Master Architecture, Design & Verification Report

---

### Executive Summary
The **Settlement & Reconciliation Control Center** is a system-wide financial integrity, multi-currency audit, and transaction matching layer within the ERP. It operates on a **zero-duplication architecture**, referencing existing ERP transactions (Roznamcha, Cash Entries, Bank Transactions, Purchases, Sales, Payments, and Operational Expenses) rather than copying records.

---

### 1. Architectural Principles
1. **Zero Accounting Duplication**: All financial amounts and particulars reside in their authoritative source tables (`roznamcha_entries`, `purchase_orders`, `sales_orders`, etc.). Settlement records link via `(source_table, source_id)`.
2. **Historical FX Preservation**: Original transaction conversion rates (`cr_usd_rate`, `dr_usd_rate`) are permanently preserved at settlement time. Realized FX gains/losses are determined directionally (Credit receipts vs Debit disbursements).
3. **Many-to-Many Matching**: One Credit (CR) entry can partially or fully offset multiple Debit (DR) entries (or vice versa), with real-time remaining balance calculations.
4. **Immutable Audit Logging**: Any creation, modification, or reversal of settlement links is written to an append-only audit trail (`settlement_audit_log`).
5. **Universal Printing Integration**: Direct binding with `Universal ERP Print Engine` for multilingual reports and PDF generation.

---

### 2. Database Schema Specification
- **`settlement_transactions`**:
  - `id`: UUID (Primary Key)
  - `country_id`, `country_branch_id`, `city_branch_id`: Multi-tier scoping FKs
  - `source_module`, `source_table`, `source_id`: Source reference pointers
  - `direction`: `'cr'` (receipt) | `'dr'` (payment)
  - `local_currency`, `local_amount`, `original_usd_rate`, `original_usd_amount`
  - `settlement_status`: `'settled'`, `'partially_settled'`, `'unsettled'`, `'difference'`, `'needs_review'`
  - `remaining_local`, `remaining_usd`: Generated columns
- **`settlement_links`**:
  - `id`: UUID (Primary Key)
  - `cr_settlement_id`, `dr_settlement_id`: Bidirectional FKs
  - `linked_local_amount`, `linked_usd_amount`: Matched portion
  - `cr_usd_rate`, `dr_usd_rate`, `fx_difference_usd`, `fx_direction`: FX breakdown
- **`settlement_audit_log`**:
  - Append-only audit record tracking actors, timestamps, status deltas, and financial snapshots.
- **Views**:
  - `settlement_summary_v`: Grouped branch-level daily totals.
  - `settlement_exceptions_v`: Auto-detected anomalies (unsettled > 30 days, zero amounts, partial mismatches).

---

### 3. API Subsystem (`/app/api/erp/settlement/*`)
| Route | Method | Purpose |
|---|---|---|
| `/api/erp/settlement` | `GET` | Filtered, scoped transaction list |
| `/api/erp/settlement/dashboard` | `GET` | Real-time KPI summaries |
| `/api/erp/settlement/daily` | `GET` | Branch daily closing breakdown |
| `/api/erp/settlement/link` | `GET`, `POST` | Query active links / Execute CR→DR match |
| `/api/erp/settlement/link/[id]` | `DELETE` | Reversible unlinking with balance rollback |
| `/api/erp/settlement/sync` | `POST` | Automated idempotent sync from all ERP modules |
| `/api/erp/settlement/exceptions` | `GET` | Anomaly queue for auditor review |
| `/api/erp/settlement/audit` | `GET` | Chronological audit trail |
| `/api/erp/settlement/fx` | `GET` | Realized FX gain/loss breakdown |
| `/api/erp/settlement/flag` | `POST` | Manual anomaly review and resolution flag |

---

### 4. UI Dashboard & Specialized Sub-Modules
Integrated under the main navigation sidebar (`SETTLEMENT & RECONCILIATION`):
1. **Settlement Dashboard** (`/dashboard/settlement`)
2. **Daily Settlement** (`/dashboard/settlement/daily`)
3. **Cash / Roznamcha Settlement** (`/dashboard/settlement/cash`)
4. **Bank & Cheque Settlement** (`/dashboard/settlement/bank`)
5. **Party / Account Settlement** (`/dashboard/settlement/party`)
6. **Purchase Bill Settlement** (`/dashboard/settlement/purchase`)
7. **Sales & Customer Settlement** (`/dashboard/settlement/sales`)
8. **Payment & Transfer Settlement** (`/dashboard/settlement/payment`)
9. **Expense & Office Bill Settlement** (`/dashboard/settlement/expense`)
10. **Multi-Currency & FX Center** (`/dashboard/settlement/fx`)
11. **Unsettled & Discrepancy Queue** (`/dashboard/settlement/unsettled`)
12. **Printable Reports Hub** (`/dashboard/settlement/reports`)
13. **Audit Trail** (`/dashboard/settlement/audit`)

---

### 5. Directional FX Gain/Loss Logic
$$\text{FX Difference (USD)} = \frac{\text{Linked Local Amount}}{\text{Settlement Rate}} - \frac{\text{Linked Local Amount}}{\text{Original Rate}}$$
- **For Credit (CR) Receipts**: If settlement rate yields higher USD $\rightarrow$ **FX Gain** (+). If lower $\rightarrow$ **FX Loss** (-).
- **For Debit (DR) Payments**: If settlement rate yields lower USD required $\rightarrow$ **FX Gain** (+). If higher $\rightarrow$ **FX Loss** (-).

---

### 6. Verification and Validation Results
- **Database Migration**: Applied via `supabase/migrations/20260828_settlement_reconciliation_engine.sql` and verified on PostgreSQL instance.
- **TypeScript Compilation**: Clean build with `npx tsc --noEmit` (0 errors).
- **Universal Print Engine**: Fully integrated with standard formatting, table rendering, and PDF triggers.
