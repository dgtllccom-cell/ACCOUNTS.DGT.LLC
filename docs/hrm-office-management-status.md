# Enterprise HRM & Office Management — Implementation Status

_Last updated: 2026-08-28_

## 1. Existing-system audit (what already exists — preserved, not rebuilt)

| Area | Table(s) / module | State |
|---|---|---|
| Employee master | `employees` (+ `person_master_id` link to `customers`) | Complete — single source of truth |
| Payroll (salary due) | `employee_salaries_due` | Partial — amounts only, no Draft→…→Paid workflow |
| Attendance | `office_attendance` | Basic check-in/out |
| Leave | `office_leave` | Basic request/approve |
| Assets | `office_assets` | Complete |
| Documents | `office_documents` (bucket `erp-documents`) | Complete generic doc store |
| CRM action items | `crm_action_items` | Complete — reused for contract/HR reminders |
| Salary advance | `employee_advances_loans` (`type='advance'` path only) | Preserved; **no Loan module built (per instruction #2)** |
| All-Countries Tax | `tax_codes`, `country_tax_settings` refs, UAE `uae_tax_*` (17 tables) | Complete tax backbone — HRM will consume, not duplicate |

**Missing (documented, not yet built):** `departments`, `designations`, `leave_types`,
`employee_leave_balances`, `employee_documents` (KYC), `gratuity_settlements`,
`payroll_runs`, `kyc_verifications`, promotion/transfer/termination history tables.

## 2. Delivered this cycle — Central Contract Control Center (spec #4, #5 partial)

**Migration** `supabase/migrations/20260914_contract_control_center.sql` — applied to DEV,
269 contract rows. Non-destructive: 2 new tables + 1 view + 2 functions, touches nothing existing.

| Object | Purpose |
|---|---|
| `erp_contract_register_v` (view) | UNION of `purchase_orders` + `sales_orders` + `employees` → one linked register row per contract (49 cols). **No copy** — `source_module / source_table / source_id / contract_reference` link back. |
| `contract_followups` (table) | Per-contract watch status, last follow-up, next-action date. Unique on `(source_module, source_id)`. |
| `contract_register_audit` (table) | Append-only: viewed / followup_added / next_action_set / watch_changed. |
| `contract_register_status(...)` fn | Derives the 9 required statuses (Draft…Cancelled). |
| `sync_contract_reminders(days)` fn | Inserts contract-expiry / delivery-due / missing-attachment / pending-payment reminders into `crm_action_items` (Smart CRM owns them). |

**Service** `lib/services/contract-register-service.ts` — `list` / `get` / `kpis` /
`upsertFollowup` / `recordView` / `syncReminders`, all scope-filtered in SQL WHERE.

**API** `app/api/erp/hr/contracts/{route,kpis,[module]/[id],reminders/sync}` —
`requireErpSession` + `authorizeApiScope({resource:"contracts"})` + repeated scope filter.

**RBAC** — `contracts:read` on 8 roles, `contracts:write` on 6; `contracts.view` +
`contracts.followup` catalog permissions; `contract_control` RBAC-matrix module.

**UI** `features/contracts/components/contract-control-center.tsx` +
`app/dashboard/general-office/contracts/page.tsx` + sidebar entry — KPI cards,
filter bar, consolidated register table, detail drawer with deep links
(source record / KYC / Journal-Roznamcha-Ledger / settlement / attachments / audit),
follow-up panel, `UniversalPrintActionButton` export. `useErpScreen("contract")`,
79 `contract.*` keys ×5 languages.

**Gates:** `npx tsc --noEmit` 0 · `npm run i18n:guard` green (9386 keys/block) ·
`npm run i18n:guard:changed` green · `npm run build` exit 0 · `npx vitest run` 111 passed / 1 skipped.

**Not verified:** authenticated browser E2E (no session available in this environment —
routes return 307→login as expected). Not applied to Production.

## 3. Exact remaining-work list (authorized, non-destructive, not yet built)

Ordered by dependency. Each item = its own migration + service + API + view + i18n + gates.

1. ~~**Masters** — `departments`, `designations` tables + CRUD~~ ✅ **DONE** — commit `5782d85`,
   migration `20260915`. `hr_departments` / `hr_designations` + additive
   `employees.hr_department_id` / `hr_designation_id`, backfilled + linked,
   `hr_departments_v` / `hr_designations_v` views, CRUD API + `HrMastersManager` UI,
   36 `hrm.*` keys ×5. Free-text columns untouched.
2. ~~**Employee lifecycle history**~~ ✅ **DONE** — commit `c153e11`, migration `20260916`.
   `hr_employee_position_events` / `hr_employee_transfers` / `hr_employee_separations`
   (append-only) + `hr_employee_lifecycle_v`. Draft→approved→applied workflow; approved
   events applied onto the live `employees` row transactionally; verified E2E on DEV.
   `EmployeeLifecycleView` UI + 68 `hrm.*` keys ×5.
3. ~~**Employee KYC**~~ ✅ **DONE** — commit `58c6fc9`, migration `20260917`.
   `hr_employee_kyc_requirements` (seeded 9-doc checklist) + `hr_employee_kyc_documents`
   (number/issue/expiry/verification state; file in `office_documents`) +
   `hr_employee_kyc_status_v` (completeness + exact missing mandatory items — the
   Pending Verification feed). `EmployeeKycView` UI (queue + per-employee checklist
   drawer + verify/reject), 37 `hrm.*` keys ×5. Verified E2E on DEV.
4. ~~**Attendance/Leave completion**~~ ✅ **DONE** — commit `fa75bc4`, migration `20260918`.
   `hr_shifts`, `hr_holidays`, `hr_leave_types` (seeded 8), `hr_employee_leave_balances`
   (+ `_v` with computed `remaining_days`), `hr_attendance_corrections` (append-only,
   prev/new + reason + requester + approver + timestamps), additive `office_attendance`
   columns. `initializeYear` / `recomputeBalances` / correction approve→apply.
   `HrLeaveAttendanceView` 5-tab UI, 46 `hrm.*` keys ×5. Verified E2E on DEV.
   *Still open within this item:* wire `office_leave_requests` submission to decrement
   `hr_employee_leave_balances.pending_days` at request time (currently `recomputeBalances`
   backfills it on demand); shift-based late/early-minutes auto-calc on attendance punch.
5. **Payroll engine** — `payroll_runs` + `payroll_run_lines` with status
   Draft→Calculated→Reviewed→Approved→Posted→Paid; components basic/allowances/overtime/
   bonus/leave-adjustment/deductions/salary-advance-recovery; multi-currency
   (original currency + txn-date rate + local + USD consolidated); idempotency key per run.
6. **All-Countries payroll tax** — consume existing country Tax Master (Pakistan/Afghanistan/UAE/…);
   `payroll_tax_config` per country (payroll tax, employee deductions, employer contributions,
   withholding, thresholds, exemptions, effective dates, ledger/account mapping).
   **Kept out of VAT returns** — separate ledger accounts, separate report.
7. **Accounting posting** — on payroll `Approved→Posted`, call existing `post_roznamcha_entry`
   RPC with balanced lines (Salary Expense Dr / Allowance-OT Dr / Tax-Contribution Payable Cr /
   Advance Recovery Cr / Salary Payable-Bank Cr). Idempotent; controlled reversal (never delete).
   Reconciliation across Payroll Register / Salary Slip / Employee Ledger / Journal / Roznamcha /
   Cash-Bank Book / GL / Tax Report / Settlement.
8. **Gratuity / final settlement** — `gratuity_settlements` (country-specific accrual rules),
   final-settlement worksheet (pending salary + leave encashment + gratuity − advances − deductions).
9. **Smart CRM HR reminders** — extend `sync_contract_reminders` (or a sibling fn) for
   probation expiry, employee document expiry, incomplete KYC, required follow-up date.
10. **Onboarding / offboarding** checklists linked to employee + document + asset + KYC state.
11. **Employee Self-Service** scoped view (own permitted info only) — enforce in API + DB WHERE.
12. **Reports (#13 list)** — Employee Directory, Attendance, Leave, Overtime, Payroll Register,
    Salary Slips, Employee Ledger, Payroll Tax, Expiring Documents, Contract registers
    (Purchase / Sales / Employee / Consolidated), Pending Contract Actions, Payment/Remaining
    Balance, Loading/Receiving Status, Gratuity/Final Settlement, Audit/Approval History —
    all via `UniversalPrintActionButton` (Print/PDF/HTML/Excel/CSV, A4, Page X of Y, 5 languages,
    RTL, zero/one/many).
13. **Full E2E verification** (spec #16) — needs an authenticated Super Admin session +
    working browser preview: Employee→KYC→Attendance/Leave→Payroll→Tax→Approval→
    Journal/Roznamcha/Ledger→Payment→Settlement→Reports; role/geographic scope isolation;
    cross-country / cross-branch isolation; duplicate-posting prevention; reversal audit.

## 4. Blockers

- **Authenticated E2E** — no Super Admin session in this environment; routes verified only to
  the auth boundary (307).
- **Production deployment** — operator runs `docs/production-deployment-runbook.md`
  (sandbox blocks SSH + prod DB). Do **not** mark Production Ready until #13 above is done
  and explicit deployment approval is given.
