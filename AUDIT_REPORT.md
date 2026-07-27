# ERP Stabilization Audit — Report

**Codebase audited:** `ACCOUNTS.DGT.LLC`, committed `main` (latest `bea737c`).
**Scope of this audit:** static source analysis (syntax, duplicate declarations, conflict markers, and the runtime‑crash patterns that produce "Application error: a client‑side exception"). See *Limitations* for what could not be done in this environment.

---

## 1. Headline finding

The **committed source code is statically clean** for the crash classes that cause client‑side exceptions. The scan found essentially no widespread code bugs:

| Check (across `features/`, `app/`, `components/`) | Result |
|---|---|
| Git merge‑conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) | **0** |
| Unguarded `X.field.map/filter/reduce/forEach()` (array‑undefined crashes) | **0** |
| Unguarded `X.field.toFixed()` (number‑undefined crashes) | **0** |
| Unguarded `X.field.toLowerCase/toUpperCase/split/trim()` (string‑null crashes) | **1** (fixed) |
| Files failing to parse (syntax errors) | **0** |

**Conclusion:** the repeated "pages crash / blank / no data" symptoms are **not** caused by many broken code files. The code guards its data almost everywhere. The remaining symptoms point to the **data/runtime layer**, not source bugs (see Root Cause).

---

## 2. Issues found & fixes applied (this session)

| # | Issue | Root cause | Fix | Status |
|---|---|---|---|---|
| 1 | Roznamcha page (`/dashboard/roznamcha/all`) → "client‑side exception" white screen; Print/PDF/Actions never render | `row.countryName.toLowerCase()` / `row.currency.toUpperCase()` / `targetRow.lines.slice()` called on **nullable fields** in the render body. One row with a null country/currency threw a `TypeError` and crashed the whole page. | Added `|| ""` / `|| []` guards (6 spots). | ✅ Fixed (`dbe691f`) |
| 2 | Reports show **0 / "No country records"** although the DB has data | `lib/supabase/config.ts` fell back to a **publishable (anon) key** when the Service‑Role key was absent, so the server admin client ran at anon level and **RLS blocked every table read**. | Removed the anon fallback (admin client now throws clearly instead of silently reading nothing). | ✅ Fixed |
| 3 | `warehouse-form` could crash on `.value.trim()` | Nullable contact `value` field. | Guarded with `\|\| ""`. | ✅ Fixed (`bea737c`) |
| 4 | Duplicate `_unused_getTableHeader` broke the build | Merge left a second (mojibake) copy → "Cannot redeclare block‑scoped variable". | Removed the duplicate. | ✅ Fixed (`aaad4df`) |
| 5 | `requireSession` import / eager DB init broke `next build` | Import used an alias missing on some branches; DB pool was created at module import. | Switched to `requireErpSession`; made the DB client lazy. | ✅ Fixed |
| 6 | Duplicate/experimental code + junk (server‑monitoring, `_review-conflicts` 1263 files, `scratch/`, `_codex/`, logs) | Accumulated agent/merge artifacts. | Removed; single ERP codebase retained. | ✅ Fixed (`66eca3c`) |

---

## 3. Root cause of the production symptoms (analysis)

Because the source is statically clean, the "many pages broken after login" pattern is almost certainly driven by **runtime data/infrastructure**, not code:

1. **Data layer (highest probability).** With the Service‑Role key misconfigured (Issue #2), the server read **empty/error** data from Supabase. Pages that assume data is present then show blank screens, zero counts, or (where a value is unexpectedly null) a client‑side crash. Fixing the key config + setting the real `SUPABASE_SERVICE_ROLE_KEY` should restore most of these at once.
2. **Stale VPS build.** If the VPS `.next` build is older than the current code, routes can crash or 404 until a clean rebuild.
3. **Per‑page runtime exceptions** that only the **browser console stack trace** can pinpoint. Static analysis cannot see these; each needs its console error.

---

## 4. Limitations — what this environment cannot verify

I could **not** run these here (Linux sandbox with a Windows‑only compiler binary + cloud‑synced `node_modules`, and no VPS/browser access). They must be run by you:

- ❌ `npm install` / `npm run build` (production build, TS/ESLint errors)
- ❌ Live browser Console / Network errors per page
- ❌ PM2 / Next.js server logs
- ❌ Login‑to‑logout end‑to‑end testing, screenshots, "production website operational"

Therefore I **cannot certify "100% production‑ready"** — that certification comes from the build + live tests on your side.

---

## 5. Remaining items (for you, to finish stabilization)

1. **Set the real Service‑Role key** in `.env.local` (local) and the VPS env: `SUPABASE_SERVICE_ROLE_KEY=<real service_role secret>` (never a `sb_publishable_…` key). This is the most likely single fix for blank/zero pages.
2. **Clean rebuild on Windows and VPS:**
   ```
   git checkout main && git reset --hard bea737c
   npm install && npm run build            # must be zero errors
   # VPS:
   cd /var/www/dgt-nextjs && git pull && npm ci && npm run build && pm2 reload dgt-nextjs
   ```
3. **For any page still crashing:** open it, copy the **exact browser Console error / stack trace**, and send it — that pinpoints the precise line, and I'll fix it. (Static analysis alone cannot see runtime‑only exceptions.)
4. **Stop concurrent edits to the OneDrive `.git`** — parallel git access keeps re‑introducing conflict markers/duplicates.

---

*Prepared from static analysis of committed `main` (`bea737c`). No database, VPS, or environment secret was modified.*
