# QA Review — DAMAAN ERP (accounts.dgt.llc)

**Scope:** Full-sweep QA of the ERP source at `B:\...\ACCOUNTS.DGT.LLC`, cross-referenced against the deployment at `http://72.60.209.121/`.
**Date:** 2026-08-03
**Method note:** Round 1 was a source-code audit. Round 2 (2026-08-03, added below) is a live in-browser pass against `http://72.60.209.121/` — it is currently **blocked at the front door** by a broken static-asset pipeline (see L0). Items marked _(verify live)_ still need confirmation once the deployment is serving assets again.

---

## Executive summary

The application logic and UI are extensive, but there is a **critical, exploitable security surface** that must be fixed before any functional QA matters. The three items in the CRITICAL list below individually allow full compromise of the production database and full super-admin access with no valid credentials. In addition, ~50+ developer/debug/test endpoints are shipped to production, route protection is not enforced centrally, and several UI areas still render seed/placeholder data or use blocking `alert()` dialogs.

Counts observed: **271 API route files** (~100 with no auth check), **470 page/route files**, **186 feature components**, **65 empty catch blocks across 29 files**, **11 `dangerouslySetInnerHTML` usages**.

---

## LIVE TEST ROUND 2 (2026-08-03, in-browser via Chrome)

### L0. Cold-load static assets return 503/400 — app renders unstyled with no JS — **CONFIRMED, blocks all live testing**
Reproduced independently in **two different browsers** (Chrome and Edge), each on a cold cache:
- The HTML document serves **200**, but **every** `/_next/static/*` asset — the stylesheet `css/41324d11fb10bd50.css` and all ~24 JS chunks (webpack, main-app, layout, the login page chunk, etc.) — returns **HTTP 503**. Reproduced across multiple reloads in both browsers; the CSS was requested/retried repeatedly and returned 503 every time.
- A direct request to the CSS URL returns **400 Bad Request** (plain-text error page).
- Rendered result: the login page is completely **unstyled** (elements stacked vertically, no layout).
- **Login is non-functional:** filled `superadmin@damaan.com` / `Admin@123` and clicked "Secure ERP Login" — **no POST to `/api/erp/auth/login` was made at all** (network log shows only the login-page GET 200 and the page JS chunk 503). The click does nothing because the React handler never hydrated. Cannot reach anything behind auth.

**Impact:** any cold-cache visitor — a new user, an incognito window, or **every existing user immediately after a deploy** (content-hashed filenames change and invalidate all caches) — gets a broken, non-functional app that cannot even log in.

**Why it looked fine on your everyday browsers:** they hold the previously-downloaded hashed assets in disk cache and never re-request them, masking the origin failure. A cold browser (fresh Edge here) exposes it instantly.

**ROOT CAUSE (confirmed via server probes, 2026-08-03):** The failure is in the **Next.js process on the VPS**, not nginx and not the repo code:
- nginx (1.24.0) correctly proxies everything to Next.js on :3000. The 400/500 responses carry `X-Powered-By: Next.js` and Next's own `/_error` page — i.e., the app is generating the error, not the proxy.
- The served HTML references build `VBA2qrJ0M7agSWiRS2YJQ`, and the running server reports that same buildId — so this is **not** a stale-HTML/cache mismatch.
- **Every on-disk asset the app should serve fails**, including the current build's own manifest:
  - `/_next/static/<buildId>/_buildManifest.js` → 400
  - `/_next/static/css/41324d11fb10bd50.css` → 400
  - `/_next/static/chunks/webpack-*.js` → 400
  - `/_next/image?...` → 400
  - `/favicon.ico` → 500
- SSR pages render 200 (runs from loaded memory), proving the process is up and the DB works — only the static/file-serving layer is broken.

**Interpretation:** the `.next` build on the server is **incomplete/corrupt or `.next/static` is missing/unreadable** — the typical outcome of a `next build` that was interrupted or ran out of memory/disk on a large app (470 routes), after which PM2 kept serving a half-built `.next`. Middleware matcher (`middleware.ts:9`) correctly excludes `_next/static`, so it is not implicated.

**FIX:** clean, *completed* rebuild on the VPS + verify `.next/static` exists before restarting PM2 (full procedure supplied to the owner). Guard against recurrence: ensure adequate build memory (swap) and disk headroom, and make the deploy script verify build success (`.next/BUILD_ID` + non-empty `.next/static`) before `pm2 restart`.

**Blocks:** the entire live walkthrough (sidebar, tables, forms, buttons, data loads) is on hold until a successful rebuild restores static-asset serving.

**✅ RESOLVED (2026-08-03).** Actual root cause turned out to be two committed source syntax errors that aborted `next build` before it emitted `.next/static` (so PM2 kept serving a half-built `.next` from memory — pages 200, all assets 400/503):
1. `lib/repositories/locations-repository.ts` — a bad edit deleted the tail of `createCountry()` and the entire `updateCountry()` signature, merging the fallback object into `updateCountry`'s body (SWC: `Expected ',', got '.'` at line 390).
2. `features/branches/components/city-branch-setup.tsx` — a wrapper-`<div>` className change deleted the closing `</span></div></div>`, leaving an unclosed `<span>` at line 1362 (SWC: unclosed JSX; symptom reported at line 2490).

Fix committed as `96930f8` on `dev` and pushed; server (`root@72.60.209.121:/var/www/dgt-nextjs`, tracks `origin/dev`) reset to it, `rm -rf .next`, clean `next build` (EXIT=0, `.next/static` regenerated with 101 chunks), `pm2 restart dgt-nextjs`. Added 4 GB swap first (server had Swap=0). **Verified:** all `/_next/static/*` now 200 through nginx; `POST /api/erp/auth/login` → 200 + `erp_session` cookie; `GET /dashboard/super-admin` → 200 with live content; browser confirms styled dashboard, 188 nav items, Financial Overview + charts. All 838 source files parse clean.

### L1. Login form leaks password into URL / history when submitted before hydration — HIGH
`features/auth/components/login-form.tsx` uses `<form onSubmit={handleSubmit}>` with inputs `name="identifier"` and `name="password"`. If the form is submitted before React hydrates (exactly the state L0 caused, or any JS failure/slow load), the browser performs the **native GET submission**, producing `…/auth/login?identifier=<email>&password=<plaintext>`. Observed live during testing. The password then lands in browser history, the nginx access log, and any referrer. **Fix:** set `method="post"` on the form and/or guard the submit, and never carry credentials via GET. Do not rely on JS `preventDefault` alone.

### L2. `/favicon.ico` returns 404 (was 500 pre-fix) — LOW
No favicon served at the root. Cosmetic, but every page requests it. Add `app/icon.png`/`favicon.ico` or a `public/favicon.ico`.

### L3. Login/dashboard pages never reach network-idle — LOW/MEDIUM
The page stays in a perpetual "loading" state (document never idles), which blocks tooling and may keep a connection/spinner alive for users. Most likely the "Automatic Download Ready" install-app banner (`components/layout/install-app-banner.tsx`, `app/api/download/app/route.ts`) or a service worker (`public/sw.js`) holding an open request. Worth confirming it isn't auto-starting a download or a hanging fetch on every load.

### L4. Unauthenticated remote code execution: `/api/temp-diagnose?cmd=` — CRITICAL
`app/api/temp-diagnose/route.ts` runs `exec(request.nextUrl.searchParams.get("cmd"))` with **no auth**, as **root**, returning stdout/stderr as JSON. Anyone on the internet has a full root shell on the VPS. (I used this endpoint, with your explicit permission, as the only available channel to diagnose and deploy the L0 fix — but it must be deleted immediately.) Same class as C1/C2 and the other `exec`-based routes: `app/api/deploy`, `app/api/erp/deploy`, `app/api/fix`, `app/api/git-recover` + `app/api/erp/git-recover`, `app/api/recovery-audit`, `app/api/erp/debug/route.js`. **Delete all of these from production.**

---

## CRITICAL (fix immediately — production compromise)

### C1. `/api/dev/run-sql` executes arbitrary SQL, unauthenticated
`app/api/dev/run-sql/route.ts` accepts a POST body `{ query }` and runs `sql.unsafe(query)` against the production database (`DATABASE_URL`, rewritten to the direct `:5432` port). No authentication, no allow-list. Anyone on the internet can read, modify, or drop any table. **This is a full database takeover.** Delete this route.

### C2. `/api/inspect-users` lists and deletes any auth user, unauthenticated
`app/api/inspect-users/route.ts` uses the Supabase **service-role key** with no session check. `GET` returns every user's id/email/metadata; `GET ?action=delete&email=<x>` permanently deletes that user from Supabase Auth. Delete this route.

### C3. Hardcoded login backdoor / weak-password bypass
`app/api/erp/auth/login/route.ts` contains a `demoAccounts` map that is evaluated **unconditionally** (the imported `isDemoAuthEnabled()` is never called in the handler). Consequences:
- Identifier `admin` / `superadmin` / `asmat` / anything containing "admin" resolves to a **super_admin** account.
- The password check accepts a hardcoded weak list regardless of the account: `admin@123`, `admin123`, `gulistan@9090`, `12345678`, `test@12345`, `testuser@1234`, `password`.
- Net effect: `admin` + `password` (or `superadmin` + `Admin@123`) grants a signed **super-admin** session on production. Remove demo accounts from production, or hard-gate behind an env flag that is off by default.

### C4. Forgeable session cookie (hardcoded HMAC fallback secret) _(verify env)_
`lib/auth/temp-session.ts` and the login route sign the `erp_session` cookie with `getSessionSecret()`, which falls back to the literal string `"dev-insecure-erp-session-secret"` when `ERP_SESSION_SECRET` / `AUTH_SECRET` / `NEXTAUTH_SECRET` are unset. Because the algorithm and fallback key are in the public source, if that env var is not set in production **anyone can forge a valid super-admin cookie offline**. Verify the secret is set on the server; if not, this is CRITICAL. Regardless, the fallback should throw in production rather than default.

---

## HIGH

### H1. ~50+ developer/debug/test/temp endpoints shipped to production
The `app/api` tree contains a large set of maintenance routes, many unauthenticated and using the admin/service-role client, several of which mutate or destroy data. Examples observed:
`api/dev/run-sql`, `api/dev/migrate`, `api/dev/test-expenses`, `api/dev-reset`, `api/dev-schema`, `api/dev-zod`, `api/dev-cleanup`, `api/erp/dev-cleanup/fix-currencies`, `api/erp/dev-delete-purchases`, `api/erp/currency/delete-all-rates`, `api/temp-reset-db`, `api/temp-cleanup`, `api/temp-db-test`, `api/setup-db`, `api/db-alter`, `api/git-recover`, `api/inspect-db`, `api/scratch`, `api/dump-fn`, `api/check-superadmins`, `api/fix-superadmins`, `api/fix`, `api/erp/fix`, `api/debug`, `api/debug2`, `api/debug/*`, `api/erp/debug-query`/`2`/`3`, `api/erp/debug/fix-roznamcha`…`4`, `api/erp/debug/test-hello`/`2`, `api/recovery-diff-checker`, `api/test`, `api/test-db`, `api/test-rpc`, `api/test-reload`. Remove all of these from the production build (or gate them behind a server-only flag).

### H2. No central route protection; auth is per-file and inconsistent
`middleware.ts` → `updateSession()` only refreshes the Supabase cookie and **never redirects unauthenticated users**. Protection depends entirely on each page/route calling `requireErpSession()`. ~100 of 271 API routes contain no session/auth reference. Add auth enforcement in middleware for `/dashboard` and `/api/erp/**`, and audit every route that currently lacks a check.

### H3. `/dashboard` leaks live financials to unauthenticated users _(verify live)_
`app/dashboard/page.tsx` calls `getCurrentErpSession()` but only redirects when a session **exists**. When the session is `null` it falls through and renders the page, loading org-wide counts and financial totals via `createSupabaseAdminClient()` (service role, RLS bypassed). Combined with H2, an anonymous visitor to `/dashboard` may see production totals. Require a session before rendering.

### H4. Production dashboard prints working credentials
`app/dashboard/page.tsx` renders an "Experimental Setup: Test Accounts" card listing login codes and the password `TestUser@1234` (marked `select-all`). With C3 these are live super/country credentials. Remove this card from production.

### H5. Service-role client used for user-facing reads (RLS bypass)
The main dashboard and several routes use `createSupabaseAdminClient()` for ordinary reads, which bypasses row-level security and any per-branch/per-country scoping. Data isolation between countries/branches then depends solely on hand-written `.eq()`/`.in()` filters in application code — easy to miss. Prefer the RLS-enforced server client for user-scoped reads; reserve the admin client for genuine system operations.

### H6. Internal error details / stack traces returned to clients
Multiple routes return `error.message` and `err.stack` in the JSON response (e.g. `api/inspect-users`, `api/temp-db-test`, `api/recovery-diff-checker`). This leaks schema, file paths, and internals. Return generic messages; log details server-side only.

---

## MEDIUM

### M1. `accounts-table.tsx` renders hardcoded seed data
`features/accounts/components/accounts-table.tsx` shows three static rows with the caption "Seed rows shown until Supabase data is connected." If this component is used on any live screen, the table never reflects real accounts. Wire it to the accounts API or remove it.

### M2. Blocking `alert()`/`confirm()` used for real error and success UX
Native `alert()` is used pervasively for validation, errors, and even success messages (e.g. `features/settings/components/email-accounts-management.tsx`, `app/dashboard/settings/management/goods/ui-client.tsx`, `app/dashboard/print-reports/page.tsx`, `sales-order-wizard.jsx`, `roznamcha/money-exchange-form.tsx`, `users/user-journal-report.tsx`). This blocks the UI thread and is inconsistent with the app's toast/dialog styling. Replace with in-app notifications.

### M3. Debug text leaking into user-facing alerts
`features/sales/components/sales-order-wizard.jsx` shows internal state to users, e.g. `alert("Please select a Good first before adding a new Brand. (Current goodsName: ..., dbGoods count: N)")`. Remove diagnostic strings from end-user messages.

### M4. Dead links in the login footer
`app/auth/login/page.tsx` — "Privacy Policy" and "Security" are `<a href="#">` (go nowhere). Also `components/purchase-booking-view-redesign.tsx` uses `href="#"` nav items. Point them at real pages or remove.

### M5. Placeholder report actions
`app/dashboard/print-reports/page.tsx` has actions that only `alert()` (e.g. "Expenses Bill Report — Opens when expense data is available"). Confirm which print/report buttons are actually implemented vs. stubs.

### M6. 65 empty `catch {}` blocks across 29 files
Silent error-swallowing (e.g. `lib/services/purchase-table-manager.ts` ×6, `features/accounts/components/new-account-setup.tsx` ×6, `app/api/setup-db` ×5) hides failures from users and logs. Failures should surface a message or be logged.

### M7. Dashboard summary is all-or-nothing
`loadDashboardData()` wraps ~14 parallel queries in one try/catch; a single failing table blanks the entire summary (amber "could not load" banner) instead of degrading per-widget. Also `countRows("profiles", false)` counts soft-deleted profiles (passes `deleted=false`), likely inflating the user count.

### M8. `dangerouslySetInnerHTML` in 11 components
Report/print viewers and preferences controls inject HTML. Verify none of the injected content is user-supplied (XSS risk), especially in report viewers that render record data.

---

## LOW / polish

- **L1.** `api/temp-read` already returns 403 "Endpoint disabled" — dead file, remove it along with the other temp routes.
- **L2.** `api/git-recover` and `api/recovery-diff-checker` hardcode Windows paths (`C:\Users\dgtll\OneDrive\...`); they will throw on the Linux server. Dead code — remove.
- **L3.** WhatsApp/settings placeholders contain a real-looking phone number (`00971544816664`) and token hints as placeholders — confirm these are only placeholders, not committed credentials.
- **L4.** Login `searchParams.error` is rendered via `decodeURIComponent` into the page; ensure it is text-only (it is, but keep it escaped) to avoid reflected content issues.

---

## Suggested fix order

1. Delete C1, C2 and all H1 dev/debug/temp routes; redeploy. (Stops active exploitation.)
2. Fix C3 (remove login backdoor) and confirm/lock C4 (`ERP_SESSION_SECRET` set; fallback throws in prod).
3. Enforce auth in middleware (H2), then fix H3/H4/H5 (unauth dashboard, printed creds, RLS bypass).
4. Stop leaking stack traces (H6).
5. Work through MEDIUM UX/data issues (seed table, alerts, empty catches, dashboard resilience).
6. Once Chrome is connected, run the live click-through pass to catch runtime-only issues (broken data loads, table pagination/sorting, form submits, 404s) that static review can't see.

## What still needs a live pass
- Every sidebar link → confirm the target page loads (no 404/500).
- Each table → data actually loads, empty state, sorting/pagination/filter, and row actions.
- Each form → submit succeeds, validation fires, and the record appears.
- Role-based views → log in as super-admin, country-admin, branch-admin and confirm scoping.
- Console/network errors on each page.
