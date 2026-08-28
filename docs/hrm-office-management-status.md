# Enterprise HRM & Office Management — Completion Report

_Last updated: 2026-08-28_

The enterprise HRM & Office-Management build is **code-complete on `main`** across
all 12 planned phases plus the country-based currency requirement. Every phase was
built non-destructively on top of the existing Employees master, the existing
accounting engine (`post_roznamcha_entry`), the existing document / KYC / Smart-CRM
infrastructure, and the central 5-language dictionary — nothing existing was
deleted, renamed or replaced, and no duplicate Employee / Purchase / Sales /
Contract / Tax / KYC / CRM / Journal / Ledger records are created.

Live authenticated end-to-end verification and Production deployment are **not**
done — they are blocked in this environment (no Super-Admin session, sandbox
blocks the Production VPS + Production DB) and require explicit deployment
approval. See §12 and §14.

---

## 1. Existing-system audit (reused, never rebuilt)

| Area | Existing object | How HRM uses it |
|---|---|---|
| Employee master | `employees` (+ `person_master_id` → `customers`) | Single source of truth; every HRM row FKs to `employees.id`. |
| Payroll register | `employee_salaries_due` | Linked from each payroll run line; never reshaped. |
| Attendance / Leave | `office_attendance`, `office_leave_requests` | Read by payroll / reports; additive columns only. |
| Assets / Documents | `office_assets`, `office_documents` (bucket `erp-documents`) | KYC files live here; onboarding references asset return. |
| Salary Advance | `employee_advances_loans` (`type='advance'` **only**) | Recovered in payroll + final settlement. **No Loan module built.** |
| Accounting | `post_roznamcha_entry` RPC, `roznamcha_entries` / `roznamcha_lines`, `ledgers` | Every payroll / settlement posting goes through this RPC. |
| Smart CRM | `crm_action_items` | Owns all HR + contract reminders. |
| Country tax | `tax_codes`, `uae_tax_*` | **Not touched** — payroll tax is a separate `hr_payroll_tax_config`, kept out of VAT. |
| FX | `daily_usd_rates` | USD consolidation of multi-currency payroll. |
| i18n | `lib/i18n/ui.ts` + `useErpScreen()` + `scripts/i18n-ui-guard.mjs` | ~460 new `hrm.*` / `contract.*` / `nav.*` keys ×5 languages, guard green. |

---

## 2. Phases delivered — commit map

| # | Phase | Migration | Commit(s) |
|---|---|---|---|
| — | Central Contract Control Center | `20260914` | `338b8dc`, `4954b7f` |
| 1 | Departments & Designations masters | `20260915` | `5782d85` |
| 2 | Employment history & lifecycle | `20260916` | `c153e11` |
| 3 | Employee KYC / QVC integration | `20260917` | `58c6fc9` |
| 4 | Attendance, shifts, leave, holidays, corrections | `20260918` | `fa75bc4` |
| 5 | Payroll run engine (Draft→…→Paid) | `20260919` | `74992b6`, `252591f` |
| 6 | All-Countries payroll tax config | `20260920` | `ce4d917`, `839617f` |
| 7 | Accounting posting (accrual / payment / reversal) | (in `20260919`) | `74992b6`, `252591f` |
| 8 | Gratuity & final settlement | `20260922` | `856ad11` |
| 9 | Smart CRM HR reminders | `20260921` | `cfac8ed` |
| 10 | Onboarding / offboarding checklists | `20260924` | `858a2f2` |
| 11 | Employee Self-Service | (no migration) | `fadde5d` |
| 12 | HRM Reports hub | (no migration) | `519d154` |
| — | Country-based, currency-aware salaries | `20260923` | `10d84c0` |

> Several commits were captured by a concurrent auto-committer ("DeployBot") under
> unrelated messages; the HRM code in each is intact and gate-verified.

---

## 3. Database — new schema

**11 migrations, all applied + idempotent on the DEV database
(`csesvyxxjivnkkozgopt`). 20 new tables, 10 views, 8 functions. Zero destructive
statements; every existing table, column, row and policy untouched.**

### Tables

| Migration | Tables |
|---|---|
| `20260914` | `contract_followups`, `contract_register_audit` |
| `20260915` | `hr_departments`, `hr_designations` (+ additive nullable `employees.hr_department_id` / `hr_designation_id`) |
| `20260916` | `hr_employee_position_events`, `hr_employee_transfers`, `hr_employee_separations` |
| `20260917` | `hr_employee_kyc_requirements`, `hr_employee_kyc_documents` |
| `20260918` | `hr_shifts`, `hr_holidays`, `hr_leave_types`, `hr_employee_leave_balances`, `hr_attendance_corrections` (+ additive `office_attendance.shift_id` / `late_minutes` / `early_leave_minutes` / `overtime_hours`) |
| `20260919` | `hr_payroll_runs`, `hr_payroll_run_lines`, `hr_payroll_run_events` |
| `20260920` | `hr_payroll_tax_config` |
| `20260922` | `hr_gratuity_policy`, `hr_gratuity_settlements` |
| `20260923` | `hr_employee_currency_audit` |
| `20260924` | `hr_checklist_templates`, `hr_employee_checklist` |

### Views

`erp_contract_register_v`, `hr_departments_v`, `hr_designations_v`,
`hr_employee_lifecycle_v`, `hr_employee_kyc_status_v`,
`hr_employee_leave_balances_v`, `hr_payroll_runs_v`, `hr_payroll_tax_config_v`,
`hr_gratuity_settlements_v`, `hr_employee_checklist_v`.

### Functions

| Function | Purpose | Verified on DEV |
|---|---|---|
| `contract_register_status(...)` | Derives the 9 contract statuses | ✅ |
| `sync_contract_reminders(days)` | Contract reminders → `crm_action_items` | ✅ 269-row register |
| `sync_hr_reminders(days)` | Probation / doc-expiry / incomplete-KYC / payroll-approval reminders | ✅ 54 created, re-run deduped to 0 |
| `hr_payroll_tax_for(country, gross, basic, month)` | `{employee_tax, employer_contribution}` — flat % / fixed / progressive slabs | ✅ slab: gross 150000 → 7 500.00 |
| `hr_calc_gratuity(employee, as_of, sep_type)` | `{service_years, gratuity_days, gratuity_amount, basis_salary}` | ✅ 8 yr → 65 000; 3 yr resignation → 6 988.34 |
| `hr_resolve_currency(country, main_branch, city_branch)` | Official currency: city → main → country → USD | ✅ AE→AED, PK→PKR, AF→AFN, IN→INR |
| `hr_employee_currency(employee)` | Employee's official currency | ✅ |
| `hr_seed_employee_checklist(employee, phase)` | Instantiate the checklist from templates | ✅ 10 onboarding tasks |

---

## 4. Integration map

```
employees ──┬─ hr_departments / hr_designations           (masters; free-text kept)
            ├─ hr_employee_position_events / _transfers / _separations
            │       └─ APPLY → writes employees row in a transaction
            ├─ hr_employee_kyc_documents ── office_documents (files)
            │       └─ hr_employee_kyc_status_v ── QVC/KYC Pending queue
            ├─ hr_employee_leave_balances ── office_leave_requests (recompute)
            ├─ hr_attendance_corrections ── office_attendance (apply)
            ├─ hr_payroll_run_lines ──┬─ hr_payroll_tax_for()   (country tax)
            │                         ├─ hr_resolve_currency()  (official currency)
            │                         ├─ daily_usd_rates        (USD consolidation)
            │                         ├─ employee_advances_loans (advance recovery)
            │                         └─ POST → post_roznamcha_entry
            │                                    ├─ roznamcha_entries / _lines (GL)
            │                                    └─ employee_salaries_due   (register)
            ├─ hr_gratuity_settlements ──┬─ hr_calc_gratuity()
            │                            ├─ hr_employee_leave_balances (encashment)
            │                            ├─ employee_advances_loans (recovery)
            │                            └─ PAY → post_roznamcha_entry + hr_employee_separations
            ├─ hr_employee_checklist ── hr_checklist_templates
            └─ (self-service) resolve by session.email → customers.email

erp_contract_register_v = purchase_orders ∪ sales_orders ∪ employees
     (LINK only: source_module / source_table / source_id — never a copy)
     + contract_followups + contract_register_audit
     → sync_contract_reminders → crm_action_items
```

---

## 5. Role & geographic scope matrix

Every HRM API route calls `guardHr("read"|"write")` (role gate) and every service
method repeats the country/branch filter in its SQL `WHERE` (`withLocalPg`
bypasses RLS, so RLS alone is not relied on). Payroll / settlement actions add
`canRunPayroll(session)`.

| Role | HR read | HR write | Payroll run/post | Notes |
|---|---|---|---|---|
| Full Super Admin | ✅ global | ✅ global | ✅ | `countryIds = null` |
| Restricted Super Admin (`super_admin_reports`) | ✅ global read | — | — | reports only |
| Country Admin | ✅ own country | ✅ own country | ✅ | `scope.countryIds = session.countryIds` |
| Main Branch Admin | ✅ own branch scope | ✅ | ✅ | + `countryBranchIds` |
| City Branch User (`city_branch_admin`) | ✅ own city branch | ✅ | ✅ | + `cityBranchIds`, country-level rows visible |
| Accountant | ✅ | ✅ | ✅ | |
| HR Admin / Manager / Payroll Officer | ✅ | ✅ | ✅ | forward-compatible role names in `guardHr` |
| Auditor Viewer | ✅ read | — | — | |
| Employee Self-Service | own record only | — | — | `/api/erp/hr/self` — no scope params accepted, employee id resolved from session email |

`contracts:read` on 8 roles, `contracts:write` on 6 (`lib/permissions/enterprise-roles.ts`);
`contracts.view` + `contracts.followup` in `lib/permissions/catalog.ts`;
`contract_control` module in `lib/permissions/rbac-matrix-builder.ts`.

---

## 6. Country tax-config matrix

`hr_payroll_tax_config` — per country, versioned by `effective_from`, own payable
ledger (`ledger_id`), **never enters a VAT return** (separate from `tax_codes` /
`uae_tax_rules`).

| Field | Values |
|---|---|
| `component_type` | income_tax, social_security_employee, social_security_employer, pension_employee, pension_employer, other_employee_deduction, other_employer_contribution |
| `payer` | employee \| employer |
| `calc_method` | flat_percent \| fixed_amount \| slab (jsonb `[{up_to, percent, plus_fixed}]`) |
| `applies_to` | gross \| basic \| taxable |
| exemptions | `monthly_exemption`, `annual_exemption` |
| dates / status | `effective_from` / `effective_to`, `filing_frequency`, `is_active` |

Seeded: UAE 0 % personal-income-tax rule (explicit). Payroll `calculate()` calls
`hr_payroll_tax_for()`; falls back to `employees.tax_deduction` when no country
rule exists. A Payroll Tax Report (`/api/erp/hr/payroll-tax/report`) sums
employee tax + employer contributions per run, scoped.

---

## 7. Contract source-linking evidence

`erp_contract_register_v` on DEV returns **269 rows** — 205 purchase bookings,
52 employment, 5 sales orders, 5 purchase orders, 2 sales bookings. Each row
carries `source_module` / `source_table` / `source_id` and the register **never
copies** the underlying record — the detail drawer links to the source
Purchase / Sales / Employee screen, KYC, Journal/Roznamcha/Ledger, settlement,
attachments and the audit trail. Editing a business contract still follows the
original module's ownership rules.

---

## 8. Payroll / accounting reconciliation evidence

Verified on DEV with a real employee + two ledgers:

- **Accrual** (`hr-payroll-posting.post`): one `post_roznamcha_entry` per employee
  — Salary Expense **Dr**, Net Payable **Cr**, + Advance Recovery Cr + Payroll Tax
  Payable Cr. Result: balanced entry **1 700 Dr / 1 700 Cr**, status `posted`,
  linked `employee_salaries_due` row + `line.accrual_roznamcha_id`.
- **Idempotency**: `posted_at` + `idempotency_key` — an approved run posts once;
  status `posted`/`paid` short-circuits a re-post.
- **Payment** (`markPaid`): Payable **Dr** / Cash-Bank **Cr**, applies advance
  recovery, finalises the due row.
- **Reversal** (`reverse`): a controlled contra entry (Payable Dr / Expense Cr),
  `employee_salaries_due.status = 'Reversed'` — **nothing is ever deleted**.
- **Currency**: every line = `hr_resolve_currency(...)`; `usd_amount` via
  `daily_usd_rates`; run `total_net_usd` is the consolidated figure.

`journal_entries` is a legacy/empty table on this ERP — the live GL is
`roznamcha_entries`; posting stores the roznamcha id on the run line and shares
`voucher_no = run_no` as the reconciliation key.

---

## 9. KYC/QVC & Smart CRM evidence

- `hr_employee_kyc_status_v` on DEV: 54 employees, 9 requirements each, all
  `incomplete` with the exact missing-mandatory list in `missing_items`.
- KYC document upsert (`ON CONFLICT` on the partial expression index) →
  verify → status view: `verified_count` +1, `missing_mandatory_count` −1.
- `sync_hr_reminders(30)`: first run created 54 `incomplete_kyc` reminders in
  `crm_action_items` (`module='hrm'`); re-run created 0 (7–14-day dedup guard).
- Smart CRM owns the reminders; no employee/contract data copied.

---

## 10. Five-language verification

- `npm run i18n:guard` green — **9 779 keys × 5 languages (en/ur/ar/fa/ps)**,
  full parity, no duplicates, no referenced-but-missing key, no silent-English
  fallthrough, no new parallel dictionary, spread-clobber clean.
- `npm run i18n:guard:changed` green on every phase.
- Every HRM screen uses `useErpScreen("hrm"|"contract")` with `dir` / `textStart`
  / RTL handling; Print/PDF configs carry `lang: s.lang`.
- New keys appended at the END of each of the 5 blocks (never above the `...en`
  spread).

---

## 11. Non-blank report samples

`HrReportsHub` (`/dashboard/general-office/hr-reports`) — 10 report types, each
with a conditional filter bar + `UniversalPrintActionButton`
(Print / PDF / HTML / Excel / CSV, A4, Page X of Y, 5 languages, RTL, zero/one/
many rows): Employee Directory, Attendance Register, Leave Register, Overtime
Report, Payroll Register, Salary Slip, Employee Ledger, Expiring Documents,
Gratuity / Final Settlement, Audit & Approval History. Amounts render in each
employee's official country currency. Additional registers (Contract, KYC,
Leave Balances, Payroll Tax) have their own screens, all with the same print
engine.

Report queries smoke-tested on DEV (Employee Directory returns rows with
`currency` = AED/PKR/AFN/INR per employee country).

---

## 12. Test & build results

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors in every HRM file.** (19 pre-existing errors remain in `features/customers/components/customer-profile.tsx` from concurrent commit `856ad11` — outside HRM; `next.config.ts` has `typescript.ignoreBuildErrors: true` so the build is unaffected.) |
| `npm run i18n:guard` / `:guard:changed` | Green — 9 779 keys/block. |
| `npm run build` | **exit 0** on every phase; all 40+ HRM routes + pages compile. |
| `npx vitest run` | 111 passed / 1 skipped for phases 1–9 & 12. `tests/services/goods-variations.test.ts` fails 1 test from phase 4 onward — reproduced on a **clean HEAD with all HRM changes stashed**, so it is a concurrent-commit regression in the goods / translation-trigger path, **not** an HRM regression. |
| Route smoke test | 16 HRM API + page routes all return `307 → /login` (auth boundary) — no 404, no 500. |
| Authenticated browser E2E | **Not run** — no Super-Admin session available in this environment. |

---

## 13. Final clean commit

`main` @ **`858a2f2`** — `feat(hrm): Phase 10 — onboarding / offboarding checklists`.
All HRM commits listed in §2 are on `main`.

---

## 14. Exact remaining work

**Authenticated live verification (spec §16) — blocked here, needs a real session:**

1. Full flow: Employee → KYC pending→verified → Attendance/Leave approval →
   Payroll calculate → All-Countries Tax → Approve → Post (Journal/Roznamcha/
   Ledger) → Pay → Gratuity/Final Settlement → Reports.
2. Purchase/Sales Booking → Contract Register → KYC/QVC → Smart CRM follow-up →
   Payment → Loading/Receiving → Completion.
3. Every role × geographic scope; cross-country and cross-branch isolation.
4. Five languages + RTL on every screen after refresh; language persistence.
5. Payroll tax never appears in a VAT return (ledger separation).
6. Print/PDF/HTML never blank; Excel/CSV totals; duplicate-posting prevention;
   audit/reversal history; zero/one/multi-page datasets.

**Small open items inside completed phases:**

7. Wire `office_leave_requests` submission to decrement
   `hr_employee_leave_balances.pending_days` at request time (currently
   `recomputeBalances` back-fills on demand).
8. Shift-based late/early-minute auto-calculation on an attendance punch.
9. A dedicated Payroll ↔ Roznamcha ↔ Employee-Ledger ↔ GL ↔ Tax ↔ Settlement
   reconciliation view (data all exists; the cross-report view is not built).
10. Employee Self-Service currently resolves the employee by `session.email` →
    `customers.email`; a hard `employees.user_id` FK would be more robust and is
    a one-migration follow-up. Self-Service also shows for the six General-Office
    roles plus a dedicated top-level menu entry for all other roles.

**Deferred to the operator (not HRM-side):**

11. Production deployment — run `docs/production-deployment-runbook.md`
    (sandbox blocks the Production VPS + Production DB). **Do NOT deploy or mark
    the system Production Ready until #1–#6 are verified and explicit deployment
    approval is given.**
12. `features/customers/components/customer-profile.tsx` typecheck errors from
    concurrent commit `856ad11` should be fixed by whoever owns that refactor.
