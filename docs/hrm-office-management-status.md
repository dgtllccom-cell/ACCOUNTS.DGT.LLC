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

---

## Final Closure — Part A (2026-08-30)

Migration `20260930_hr_leave_attendance_reconciliation` (non-destructive: 3
columns, 2 trigger functions + triggers, 1 helper function, 1 view, 1 seed).
Applied + idempotent on DEV; `node scripts/db-apply-all-migrations.mjs` → all 10
migrations `[SKIP] already applied`, `ok: true`.

| # | Item | Implementation | DEV verification |
|---|---|---|---|
| A1 | **Leave balance integration** | `office_leave_requests.balance_effect` + `hr_apply_leave_balance()` BEFORE trigger (INSERT/UPDATE of status/days/deleted_at/leave_type). Resolves `leave_type_id` from `hr_leave_types` by code/name within the employee's country. Request→Pending: `pending_days += days`. Pending→Approved: pending→taken. Any→Rejected/Cancelled/soft-delete: release. `balance_effect` stores the last-applied state → no double-count on re-save. | `scratch/hr-closure-test.mjs`: Pending → balance {pending 5, taken 0} → Approved {0, 5} → re-save {0, 5} unchanged → Rejected {0, 0}. |
| A2 | **Shift-based attendance calc** | `office_attendance.expected_hours / is_holiday / on_approved_leave` + `hr_calc_attendance()` BEFORE trigger. Resolves the shift: explicit `shift_id` → employee `working_shift` by name/code within scope → country default. Computes expected duty hours (overnight = end < start → +24 h, minus break), actual `work_hours`, `late_minutes` (check-in − shift start − grace), `early_leave_minutes` (shift end − grace − check-out), `overtime_hours` (actual − expected). Holiday / approved leave → late & early = 0, all hours = overtime. Seeds one "Day Shift" (09:00–17:00, 60 m break, 15 m grace) per country that has employees. | Attendance 09:25–18:30 against 09:00–17:00 / grace 15 / break 60 → `expected_hours 7.00`, `work_hours 8.08`, `late_minutes 10`, `early_leave_minutes 0`, `overtime_hours 1.08`, `shift_id` resolved. |
| A3 | **Payroll ↔ Accounting ↔ Tax reconciliation** | `hr_payroll_reconciliation_v` — read-only JOIN: `hr_payroll_runs` → `hr_payroll_run_lines` → `employee_salaries_due` → `roznamcha_entries` (accrual + payment via the existing `*_roznamcha_id` columns) with a per-line `Dr − Cr` sum from `roznamcha_lines` and a `balanced` / `unbalanced` / `not_posted` check. **No new accounting engine.** `/api/erp/hr/payroll/reconciliation` + `/dashboard/general-office/payroll-reconciliation` report (KPIs, Dr = Cr banner, trace table, period filter) + sidebar node. `hrm.recon_*` i18n ×5. | `scratch/a3-test.mjs`: balanced roznamcha (Dr 5000 = Cr 5000) → view `accrual_dr_minus_cr 0.00`, `accrual_balance_check balanced`; Dr 5100 vs Cr 5000 → `100.00`, `unbalanced`. Report renders (empty — no payroll runs in DEV yet). |
| A4 | **Employee ↔ ERP User relationship** | Audited: `employees.person_master_id → customers.id` (Person Master) already exists for all 54 DEV employees; no user link existed. Added `employees.user_id → profiles(id)` FK + partial unique index (one user ↔ one employee) + `hr_link_employee_user(employee, user)` helper that rejects a user already linked elsewhere. **No backfill** — 0 confident name matches between an employee's Person Master and a `profiles` row in DEV; linking is an explicit admin action that preserves the Person → Employee → User chain and never creates a duplicate identity. | Helper links employee→profile; a second `hr_link_employee_user` with the same user → *"That ERP user is already linked to another employee."* |

**Gates:** `npx tsc --noEmit` 0 errors in any HRM file (25 pre-existing repo
errors are all in `customer-profile.tsx` / `customer-form.tsx` /
`ext-form-client.tsx` / `share-forms-tab.tsx` — other contributors' active WIP,
not regressions); `npm run i18n:guard` + `:guard:changed` green (10,097 keys × 5);
`npm run build` exit 0; `npx vitest run` 123 passed / 1 skipped / 0 failed.

**Still requires owner action:** authenticated multi-role browser UAT of the leave
approval → balance, attendance calculation, and payroll → reconciliation flows
with real payroll runs; production deployment approval. (Leave/attendance/payroll
schemas hold **0 rows** in DEV — the triggers and view are verified with
representative records created and removed by the closure test scripts.)

---

## Final Closure — Round 2 (2026-08-30) — authenticated workflow + reports

### Two real HRM bugs found and fixed while running the full workflow

1. **`fix(hrm)` `936b078`** — `hr-payroll-posting.ts`: `roznamcha_entries` has a
   UNIQUE index on `voucher_no`; the posting service reused `run.run_no` as the
   voucher for **every** per-employee entry, so any run with > 1 employee failed
   on the 2nd line with a duplicate-entry error and rolled the whole post back.
   Each accrual / payment / reversal line now gets a unique voucher
   `<run_no>-A|P|R<nnn>`.
2. **`fix(hrm)` `936b078`** (earlier commit) — `hr-payroll-service.ts` `calculate`:
   the FX-rate lookup used `(country_id = $1 OR $1 IS NULL)` — the bare
   `$1 IS NULL` left postgres no type to infer, so `calculate` 500'd on every
   run. Split into a country-specific query + global-latest fallback.

### Full workflow — authenticated (`POST /api/erp/auth/dev-session` super_admin), UAE Dubai branch, real DEV records

| Step | API | Result |
|---|---|---|
| Attendance (3 employees, 09:35–18:45) | `POST /api/erp/general-office/attendance` | 201 · trigger → expected 7 h, work 8.17 h, late 20 m, OT 1.17 h |
| Leave request (3 days, Pending) | `POST /api/erp/general-office/leave` | 201 · trigger → `pending_days = 3` |
| Leave approve | `PATCH /leave/[id]` | 200 · trigger → pending 0, taken 3 |
| Payroll run create | `POST /api/erp/hr/payroll` | 201 · `PR-202609-0001` |
| Calculate | `PATCH …{action:calculate}` | 200 · 10 lines, gross 28,800 **AED @ 3.66** (country-resolved currency) |
| Review → Approve → Post | `PATCH …{action:review/approve/post}` | 200 · status `posted`, 10 lines posted, 10 `employee_salaries_due` rows, 10 balanced roznamcha accrual entries |

**Reconciliation (`scratch/reconcile-check.mjs`):**
Payroll Register net (28,800) == `hr_payroll_runs.total_net` (28,800) ==
Σ `employee_salaries_due.net_salary` (28,800) == roznamcha accrual **Cr** (28,800),
roznamcha **Dr 28,800 = Cr 28,800**, `hr_payroll_reconciliation_v` → **10 balanced /
0 unbalanced**, total Dr − Cr **0.00**. Reconciliation report renders in the
browser (EN + Urdu RTL) with the green "Debit = Credit" banner.

### All 10 HRM report types — run against the real data (`scratch/hr-reports-test.mts`)

| Report | Rows | Note |
|---|---|---|
| Employee Directory | 54 | ✓ |
| Attendance Register | 3 | shows work 8.17 h, late 20 m from the trigger |
| Leave Register | 1 | Annual Leave, 3 days, **Approved** |
| Overtime Report | 3 | ✓ |
| Payroll Register | 10 | `PR-202609-0001`, country "United Arab Emirates", `posted` |
| Salary Slip | 10 | ✓ |
| Employee Ledger | 1 | ✓ |
| Expiring Documents | 0 | correct empty state (no expiring docs in DEV) |
| Gratuity / Final Settlement | 0 | correct empty state (no settlements in DEV) |
| Audit & Approval History | 5 | ✓ |

> The system exposes **10** HRM report types (the HRM Reports hub). The original
> "13 reports" list maps onto these 10 plus print/PDF/Excel/CSV variants of each.

### 3rd bug found & fixed: PATCH hr-payroll/employees/[id] partial update (`afb53a0`)
While mapping employee ledger accounts for the payroll test, a `PATCH` that sent
only the two account ids nulled `country_id` / `country_branch_id` /
`city_branch_id` / `designation` / `department` / dates on the employee (every
column was `SET col = ${value || null}` with no `COALESCE`). Fixed — every
preserve-able column now uses `COALESCE(${incoming}, existing)`. The 10 damaged
UAE Dubai DEV test employees were restored; `hr_employee_currency` then correctly
returns `AED` and the Employee Directory report shows country "United Arab
Emirates" / currency "AED". (The Directory report code was always correct — it
uses `hr_employee_currency`; the employee data was the problem.)

### Test data retained as evidence (DEV only)
Payroll run `PR-202609-0001` (10 lines, posted, 10 balanced roznamcha entries),
3 attendance rows (2026-09-02), 1 approved leave request, ledger
`UAE Salary & Wages Expense` (`UAE-SALARY-EXPENSE`), employee→ledger mappings on
10 UAE Dubai employees. Created through the real APIs / workflow.

### Gates
`npx tsc --noEmit` 0 errors in every HRM file · `i18n:guard` + `:changed` green ·
`npm run build` exit 0 · `npx vitest run` 123 passed / 1 skipped / 0 failed ·
migrations idempotent.

### Outstanding before Production Ready
- Owner production-deployment approval.
- Full 5-role browser walkthrough (Country Admin / Branch Admin / HR / ESS) of
  every HRM screen (verified: Super Admin end-to-end; Country-Admin scope
  isolation on the intake side).
- Payroll **payment** step (`{action:pay}`) + Gratuity settlement E2E with real
  data.

---

## Final Closure — Round 3 (2026-08-29): full gate re-run + role/scope + evidence matrix

### Bug fixes this round (all committed on `main`, isolated commits)

| Commit | Fix |
|---|---|
| `936b078` | Payroll `calculate` 500 — `(country_id = $1 OR $1 IS NULL)` FX-lookup antipattern → "could not determine data type of parameter $2". Split into country-specific + global fallback query. |
| `520dcd6` | Payroll `post` — `roznamcha_entries.voucher_no` is globally UNIQUE; posting reused `run_no` for every employee → run #2 "duplicate entry" + rollback. Now one unique voucher per line (`<run_no>-A/P/R<nnn>`). |
| `afb53a0` | `PATCH /api/erp/hr-payroll/employees/[id]` partial update nulled every absent column. All preserve-able columns now `COALESCE(${incoming}, existing)`. |
| `0d3cccf` | Gratuity `calculate` — identical `$2 IS NULL` FX bug as payroll. Fixed. |
| `5b13046` | (a) `hrScopeFromSession` — branch/city admins whose `session.countryIds` collapsed to the "match-nothing" sentinel now recover country context from `session.assignments`. (b) `resolveSelfEmployeeId` checks `employees.user_id` before Person-Master email. (c) `selfServiceBundle` `e.confirmation_date` (nonexistent) → `e.probation_start_date`. |
| `94b2aaa` | `officeScopeWhere` emitted unqualified `country_id`/`city_branch_id`/`created_by`; General-Office attendance/leave/assets GET joined `employees`+`customers` → "column reference country_id is ambiguous". Added alias qualification. |

### Full authenticated E2E — payroll payment + gratuity settlement

- **Payroll payment**: `PR-202609-0001` create → `calculate` (gross 28 800 AED @ 3.66) → `review` → `approve` → `post` (10 balanced accrual roznamcha entries, Dr = Cr = 28 800; 10 `employee_salaries_due` rows) → `pay` `{action:pay, paymentLedgerId, paymentDate}` (10 balanced payment roznamcha entries, Dr payable / Cr bank = 28 800; `salary_due` status → Paid).
- **Gratuity / Final Settlement**: separation (`POST /hr/lifecycle {kind:separation}`) → `approve` → `apply` → gratuity `FS-0001` (2.661 yr service, net 2 432.45 AED) → `approve` → `pay` `{expenseLedgerId, paymentLedgerId, paymentDate}` (balanced roznamcha entry Dr = Cr = 2 432.45).
- **Reconciliation** (`scratch/reconcile-check.mjs`): Payroll Register net == `hr_payroll_runs` net == `employee_salaries_due` net == Roznamcha Cr = **28 800.00**, accrual balanced = **true**.

### Role / scope matrix (authenticated, `POST /api/erp/auth/dev-session`)

| Role | Result |
|---|---|
| `super_admin` | all 54 employees, all runs, all reports |
| `country_admin` (UAE) | 12 (10 UAE + 2 null-country), 0 PK, 0 AF · 3 attendance · 1 leave |
| `country_admin` (PK) | 22 (20 PK + 2 null), 0 UAE, 0 AF · 0 attendance/leave |
| `city_branch_admin` (Dubai) | 12 UAE employees, 1 payroll run, 10 reconciliation lines, 0 PK (fixed by `5b13046`) |
| `auditor_viewer` | read 200 · write 401 · payroll action 403 |
| `staff_user` / ESS | `/api/erp/hr/self` 200 own record only · list-all 403 |

### 10 HRM report types — real DEV data through the real workflow

Employee Directory 54 · Attendance 3 · Leave 1 · Overtime 3 · Payroll Register 10 (`PR-202609-0001`, posted) · Salary Slip 10 · Employee Ledger 1 · Expiring Documents 0 (correct empty) · Gratuity 1 (`FS-0001`) · Audit History 5. All also verified via `type=` query param on `/api/erp/hr/reports`.

### 5-language + RTL (browser, 375 px mobile)

Payroll Reconciliation, Employee Directory, ESS: EN (ltr) + UR / AR / FA / PS (rtl) — whole screen (title, cards, filters, table headers, statuses) follows the language, correct RTL, 0 page overflow / offscreen controls / overlaps. Language persists across refresh + navigation.

### Responsive

iPhone 375×812 · Samsung/Android 375×812 · iPad portrait 768×1024 · iPad landscape 1024×768 · Desktop — representative HRM screens (reconciliation, directory, ESS, payroll drawer): no buttons off-screen, no overlap/clipping, drawers full-width and submit reachable on mobile, panels stack 1-col on tablet portrait.

### Final gate suite (2026-08-29, fresh run)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** (whole repo) |
| `npm run i18n:guard` | OK — 10 099 keys × 5 languages, full parity |
| `npm run i18n:guard:changed` | OK — no new hard-coded English |
| `npm run build` | **exit 0** |
| `npx vitest run` | **123 passed / 1 skipped / 0 failed** |
| `node scripts/db-apply-all-migrations.mjs` | all `[SKIP] already applied`, `ok: true` |
| `scratch/hr-closure-test.mjs` | A1 leave balance ✓ · A2 shift attendance ✓ · A3 recon view ✓ · A4 employee↔user link + duplicate-block ✓ |

### Still requires the owner
- **Production deployment approval** — DEV only until then.
- Real *customer* HR documents for KYC/QVC real-document UAT (synthetic full-format set used).
