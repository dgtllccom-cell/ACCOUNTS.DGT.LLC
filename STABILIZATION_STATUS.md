# Digital Dock ERP — Stabilization Status & Evidence

**Date:** 2026‑07‑26 · **Decision:** stabilize the current Next.js/Supabase system first; defer Laravel rewrite.

> **Evidence honesty:** Items marked ✅ are done here with verifiable evidence (git refs, commit IDs, static parse/binder checks). Items marked ⏳ **require your Windows/VPS** — I cannot run `npm run build`, reach the VPS/Supabase, test real data, or take screenshots from this environment. For those I give the exact commands + checklist to run, and the evidence must be captured on your side.

---

## 1. Backup — Branch & Tag ✅ (evidence)

| Type | Name | Commit |
|---|---|---|
| Backup branch | `stable-pre-laravel-2026-07-26` | `bea737c7165592a014d92e8a72210aadd18404d8` |
| Tag | `stable-v1-pre-laravel` | `bea737c7165592a014d92e8a72210aadd18404d8` |
| Current `main` | `main` | `bea737c` |

*(Local git refs. Push to publish: `git push origin stable-pre-laravel-2026-07-26 && git push origin stable-v1-pre-laravel`.)*

## 2. Backup procedure — DB / env / media ✅ (ready to run)

Tooling already exists in the repo:
- **Database:** `npm run backup` (`scripts/db-backup-engine.mjs`) — or `backup_db.bat` / `double-click-to-create-backup.bat`.
- **Env files:** copy `.env.local`, `.env`, `ecosystem.config.cjs` to a dated, off‑repo folder (never commit secrets).
- **Media/uploads:** back up the `backups/`, `exports/`, and any upload folders on the VPS.
- **Source:** the branch + tag above.

Run these **before** any VPS rebuild. (Executed by you; evidence = the produced dump files + `npm run backup:restore-test`.)

## 3. Supabase key / RLS / env audit ⚠️ (code‑level findings + checklist)

**Found & fixed in code (commit `66eca3c`):** `lib/supabase/config.ts` used to fall back to a **publishable (anon) key** for the server admin client → RLS blocked all privileged reads → the "reports show 0 / No country records / blank pages" symptom. The anon fallback is removed; the admin client now fails loudly if the real key is missing.

**You must verify (I cannot read your secrets / query live RLS):**
- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (local) **and** VPS env = the **real service_role secret** (a long `eyJ…` JWT or `sb_secret_…`), **never** `sb_publishable_…`. ⚠️ `ecosystem.config.cjs` currently shows a publishable value — fix it.
- `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` present and correct on the VPS.
- In Supabase → Table Editor, confirm `country_branches` actually has rows (if empty, the report is *correctly* empty — data entry needed).

## 4. VPS fresh production build ⏳ (run on VPS — commands)
```
cd /var/www/dgt-nextjs
git fetch origin && git checkout main && git reset --hard bea737c
rm -rf .next node_modules/.cache
npm ci
npm run build            # capture this output — it is your "build result" evidence
pm2 reload dgt-nextjs    # only if build succeeds with zero errors
pm2 status               # capture — "PM2 status" evidence
```

## 5. Real‑data page checks ⏳ (run on the live site)
After the fresh build + correct Service‑Role key, open each and capture a screenshot + console:
Purchase Booking, Purchase Loading, Payment (Advance/Remaining), Roznamcha (`/dashboard/roznamcha/all`), Journal, Ledger, Reports.
For any page still erroring, copy the **browser Console stack trace** and send it — that pinpoints the exact line for me to fix.

## 6. Blank / Zero / Duplicate / stale‑build — status
- **Blank/Zero** → root cause = Service‑Role key/RLS (§3). Code fix applied; **env fix is yours** (§3), then rebuild (§4).
- **Stale build** → §4 clean rebuild.
- **Client‑side crashes** → fixed in code: Roznamcha nullable guards (`dbe691f`), warehouse‑form guard (`bea737c`).
- **Duplicate posting** → not yet hardened. Recommended next code task: add **idempotency keys** to the payment/transfer/post APIs (server‑side unique constraint) so repeated clicks can't double‑post. Say the word and I'll implement it in the current Next.js APIs.

## 7. Change log — commits, verification ✅ (evidence)

| Commit | Change | Static verification |
|---|---|---|
| `1e819f3` | Remove merge‑residue syntax errors (10 files) | 676 files parse‑clean |
| `bb9947e` | `requireErpSession` import + lazy build‑safe DB client | parse‑clean |
| `aaad4df` | Remove duplicate `_unused_getTableHeader` (build blocker) | binder: 0 redeclarations |
| `66eca3c` | Single codebase: remove server‑monitoring + junk (`_review-conflicts` 1263 files) + **safe Supabase secret‑key config** | parse‑clean |
| `dbe691f` | Roznamcha nullable guards (client‑side crash fix) | parse‑clean |
| `bea737c` | warehouse‑form nullable guard | parse‑clean |

**"Test result" = static parse + TypeScript binder checks** (my honest evidence). **Live build/UAT evidence is yours to capture** (§4–§5).

## 8. System audit (modules / schema / APIs / accounting / i18n / reports)
- **Crash‑class audit** (full): committed code is statically clean — 0 conflict markers, 0 unguarded `.map/.filter/.reduce`, 0 unguarded `.toFixed`; the 2 nullable string‑method crashes are fixed. Details in **`AUDIT_REPORT.md`**.
- **Modules / schema / APIs / accounting flow / i18n / print** inventory and the Laravel mapping: see **`LARAVEL_MIGRATION_PLAN.md`** (§1, §4–§7).
- Accounting workflow documented: Purchase Booking → Verification → Transfer → Payment → Roznamcha → Journal → Ledger → Cash Entry → Reports; rules: Purchase = DR, Sales/Payable = CR, currency preserved, correct exchange rate, country/branch/user scope.

## 9. Laravel Migration & Architecture Plan ✅
Delivered as **`LARAVEL_MIGRATION_PLAN.md`** — module‑by‑module mapping, keep‑Postgres data strategy, transactions + idempotency design, 5‑language (local engine) strategy, phased "one module at a time" roadmap, backup/rollback. Ready for when/if you decide to migrate.

---

## Evidence matrix — who produces what

| Evidence | Source |
|---|---|
| Git branch, tag, commit IDs | ✅ this report (above) |
| Static parse/binder test results | ✅ this report |
| Code fixes for blank/crash/config | ✅ committed (`66eca3c`, `dbe691f`, `bea737c`) |
| **Build result** (`npm run build`) | ⏳ you (VPS/Windows) — §4 |
| **Server / PM2 verification** | ⏳ you — §4 |
| **Screenshots of pages** | ⏳ you — §5 |
| Real‑data page/accounting testing | ⏳ you (+ send me any console errors) |

## Recommended immediate order for you
1. Push branch + tag; run DB/env/media backups (§1–§2).
2. Set the real `SUPABASE_SERVICE_ROLE_KEY` locally + on VPS; fix `ecosystem.config.cjs` (§3).
3. Fresh VPS build + PM2 reload (§4) — capture build output & pm2 status.
4. Open the key pages (§5) — capture screenshots; send me any console errors.
5. Tell me to add **idempotency** to the payment/transfer APIs (§6) — I'll implement it next.
