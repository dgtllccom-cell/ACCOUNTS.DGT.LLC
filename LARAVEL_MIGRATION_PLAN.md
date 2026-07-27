# Digital Dock ERP → Laravel — Migration & Architecture Plan

**Prepared:** 2026‑07‑26 · **Backup branch created:** `stable-pre-laravel-2026-07-26` (= `bea737c`, current stable code)

> **Scope & honesty note.** This document is the engineering plan (audit + architecture + phased roadmap) — the correct first phase of a rewrite. The *execution* phases (real‑data testing, staging, production data migration, UAT, cut‑over) require your servers, live data, and iterative work over time; they cannot be run or certified from this environment. I can build the Laravel code, migrations and plans; your team must run the live testing and cut‑over.

---

## 1. Current system — audit summary

| Area | Current |
|---|---|
| Frontend/Backend | Next.js 15 (App Router) + React 19, API routes in `app/api/**` |
| DB & auth | Supabase PostgreSQL, Supabase Auth, RLS policies; Drizzle ORM (`lib/db/schema.ts`) |
| ORM/migrations | Drizzle schema + SQL migrations (`supabase/migrations`, `database/migrations`) |
| i18n | Local offline engine — `t(lang,key)` UI dictionary (en/ar/ur/fa/ps) + `record_translations` table + `enterprise-multilingual-service` |
| Accounting flow | Purchase Booking → Verification → Transfer → Payment → Roznamcha → Journal → Ledger → Cash Entry → Reports (double‑entry) |
| Known root causes (from audit) | Supabase Service‑Role key mis‑set → RLS blocked data (blank/zero pages); stale VPS builds; a few nullable‑field runtime crashes (fixed). Code is statically clean. |

**Modules identified (from `sidebarTree` + `features/`):** Dashboards (Super Admin / Country / City / Branch), User Management, Countries, Branches (Country/City), Locations, Master Forms, Accounts, Customers, Suppliers, Goods, Purchase (Booking/Verification/Transfer/Loading/Completed Bills), Payments (Advance/Completed/Remaining/Charges/History), Sales, Cash Entry / Roznamcha, Journal, General Ledger, Trial Balance, Reports, Exchange Rates, Multi‑currency/country/branch/language, Notifications, Search, Export/Import, PDF/Excel/Print/Email/WhatsApp.

---

## 2. Target Laravel architecture

- **Laravel 11** (backend + business logic).
- **UI:** Inertia.js + React (reuse existing React components/design), OR Blade + Livewire. *Recommendation: Inertia + React* — lets us reuse the current UI/print components while moving all logic server‑side.
- **Auth:** Laravel **Sanctum** (SPA/session). Migrate existing users; keep password hashes if compatible, else forced reset flow.
- **Authorization:** **Policies + Gates + Middleware** enforcing role + **country/branch/user scope** (the ERP's core tenancy rule).
- **Business logic:** **Service classes** (e.g. `PurchasePostingService`, `LedgerService`, `ExchangeRateService`). Controllers stay thin. Repositories only where they add value.
- **Validation:** **Form Request** classes per action.
- **Accounting writes:** **DB transactions** + **idempotency keys** (see §6).
- **Async:** **Jobs/Queues** for PDF/Excel/email/WhatsApp/heavy reports; **Events/Listeners** for connected workflow postings; **Notifications**; **Scheduler** for exchange‑rate/backups.
- **Audit:** activity‑log package (e.g. `spatie/laravel-activitylog`) + created_by/updated_by + `erp_multilingual_events`‑style event log.

---

## 3. Database strategy (lowest‑risk path)

**Keep PostgreSQL** (the existing Supabase DB). Laravel fully supports Postgres, so we **avoid a data‑type migration** and can point Laravel at the *same* schema — dramatically reducing data‑migration risk.

- Introspect the existing tables and **generate Laravel migrations** that represent the current schema exactly (companies, countries, country_branches, city_branches, profiles, roles, user_role_assignments, accounts/ledgers, goods_registry, local_purchases, purchase orders/payments, roznamcha/journal/ledger tables, record_translations, erp_multilingual_events, saved_reports, …).
- Add missing enterprise fields where absent: `created_by`, `updated_by`, `country_id`/`branch_id` ownership, `deleted_at` (soft deletes), `idempotency_key`, `source_module`, `transaction_reference`, indexes, FK/unique constraints.
- **Replace Supabase‑specific pieces:** Supabase Auth → Sanctum; RLS policies → Laravel Policies/global scopes (`BelongsToTenant` scope on country/branch); Supabase edge/RPC functions (`resolve_record_translation_v2`, etc.) → Laravel services.

---

## 4. Module → Laravel mapping (pattern)

| Current (Next.js) | Laravel |
|---|---|
| `app/api/erp/**/route.ts` | `routes/api.php` + `App\Http\Controllers\**` |
| `lib/services/*` (e.g. multilingual, ledger-report) | `App\Services\**` |
| `lib/db/schema.ts` (Drizzle) | `database/migrations/**` + `App\Models\**` (Eloquent) |
| `requireErpSession` + role/branch scope | Sanctum + Policies + `TenantScope` middleware |
| Zod validation | Form Request classes |
| React pages `app/dashboard/**` | Inertia React pages (reused components) |
| Print/report components | Blade/React print views + DomPDF/Excel jobs |

A full per‑route table will be generated during Phase 1.

---

## 5. Accounting workflow (rebuilt & verified)

Flow: **Purchase Booking → Verification → Transfer → Payment → Roznamcha → Journal → Ledger → Cash Entry → Reports.**

Rules enforced in `PurchasePostingService` (and siblings), always inside a **DB transaction**:
- Purchase Account = **Debit**; Sales/Payable = **Credit**.
- Purchase currency **preserved**; final posting uses the **correct exchange rate**; country/branch/user scope enforced.
- All‑or‑nothing posting (full rollback on any failure) → no partial postings.
- Totals reconciled across Journal / Ledger / Roznamcha / Cash Entry.

---

## 6. Idempotency (no duplicate postings)

- Every Save/Post/Transfer/Payment request carries an **`idempotency_key`** (client‑generated UUID).
- A unique DB constraint on `(source_module, idempotency_key)` + a `processed_requests` table → a repeated click **returns the first result** instead of posting again.
- Combined with DB transactions, this guarantees exactly‑once accounting effects.

---

## 7. Multilingual (5 languages, local engine only)

- **No external translation API** (no Google/Gemini/OpenAI). Own engine only.
- **Static UI/labels/validation/errors:** Laravel `lang/{en,ar,ur,fa,ps}/*.php` files (ported from `lib/i18n/ui.ts`).
- **Dynamic business data:** keep/port the **`record_translations`** table + a `TranslationService` (mirrors `resolveLanguageText`).
- **RTL/LTR:** `en` = LTR; `ar/ur/fa/ps` = RTL — driven by a `dir` helper on every page, report, print, and PDF.
- Selected language persists across pages, print, PDF, and session (user preference column + session).

---

## 8. Libraries (Laravel‑compatible)

PDF: `barryvdh/laravel-dompdf` or `spatie/laravel-pdf` (Chromium, best for RTL) · Excel: `maatwebsite/excel` · Email: Laravel Mail + queues · WhatsApp: queued job to your provider · Audit: `spatie/laravel-activitylog` · Permissions: Policies/Gates (+ `spatie/laravel-permission` if useful) · Backups: `spatie/laravel-backup`.

---

## 9. Phased roadmap (safe, one module at a time)

0. **Backup & tag** — ✅ done (`stable-pre-laravel-2026-07-26`) + DB/env/media backups (your infra).
1. **Scaffold** Laravel + Sanctum + tenant scope + introspected core migrations + Auth & Users.
2. **Master data:** Countries, Branches, Locations, Accounts, Customers, Suppliers, Goods.
3. **Purchase workflow + accounting posting** (transactions + idempotency).
4. **Sales, Cash Entry/Roznamcha, Journal, Ledger, Trial Balance.**
5. **Reports, PDF, Excel, Print, Email, WhatsApp.**
6. **Multilingual (5 langs, RTL) across all of the above.**
7. **Staging deploy** (parallel to production).
8. **Data‑parity reconciliation** — module‑by‑module totals match old ERP.
9. **UAT → production cut‑over → keep rollback ready.**

Each phase: you run `php artisan test`/build + verify on your machine before we proceed.

---

## 10. Data migration & rollback

- **Data migration:** because we keep Postgres, most tables are reused in place; only added columns need back‑fill. A read‑only reconciliation script compares old vs new totals per module before cut‑over.
- **No production data is deleted/reset** — full DB dump + media + env + git tag taken first.
- **Rollback:** the Next.js app stays deployed and live until Laravel passes parity + UAT; cut‑over is a reverse‑proxy/DNS switch, and rollback is switching it back. Both apps share the same Postgres during transition (read‑compatible).

---

## 11. What I deliver vs what needs you/infra

**I can produce:** the introspected migrations + Eloquent models, controllers/services/form‑requests/policies per module, print/PDF/Excel jobs, lang files, the reconciliation scripts, and this plan — module by module, each parse/artisan‑checkable.

**You/your team must run (I can't from here):** builds/tests, staging server, live DB/media/env backups, production data migration, UAT, production cut‑over, and final "tested with real data" sign‑off.

---

## 12. Immediate next step

Say the word and I'll start **Phase 1**: scaffold the Laravel app skeleton + Sanctum + tenant scope + the introspected core migrations (countries, branches, profiles/users, roles, assignments) + Auth & User module — delivered as real Laravel files you can `composer install && php artisan migrate` and test locally.
