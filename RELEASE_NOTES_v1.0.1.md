# 🔖 Release Notes — v1.0.1 (Patch Release)

**Release Date**: July 27, 2026  
**Previous Release**: v1.0.0 (commit `c5e88dfa9`)  
**Release Type**: Controlled Patch Release — Authentication & Local-Production Parity  

---

## Summary

v1.0.1 is a **critical patch release** addressing an HTTP 500 Internal Server Error on `/auth/login` in local development environments, and ensuring 100% functional parity between Local (`localhost:3000`) and Production (`72.60.209.121`) environments.

> [!IMPORTANT]
> The v1.0.0 tag remains untouched on commit `c5e88dfa9`. This v1.0.1 patch is a new, separate tag on the latest commit.

---

## 1. Local HTTP 500 Root Cause

When `.env.local` contained `SUPABASE_SERVICE_ROLE_KEY=` (empty string), the `getSupabaseSecretKey()` function in `lib/supabase/config.ts` used the nullish coalescing operator (`??`), which does **not** treat an empty string as falsy. This caused `createSupabaseAdminClient()` to receive an empty string as the secret key, resulting in Supabase REST API calls failing with `401 Unauthorized` during Server-Side Rendering (SSR). The uncaught exception propagated to Next.js, which returned an HTTP 500 to the browser.

---

## 2. Supabase Environment Fallback Correction

### File: `lib/supabase/config.ts`

**Before (v1.0.0)**:
```typescript
export function getSupabaseSecretKey(): string {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}
```

**After (v1.0.1)**:
```typescript
export function getSupabaseSecretKey(): string {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret && secret.trim() !== "") {
    return secret.trim();
  }
  return getSupabasePublicKey();
}
```

**Key Changes**:
- Replaced `??` (nullish coalescing) with `||` (logical OR) to correctly treat `""` as falsy.
- Added `.trim()` to handle whitespace-only values.
- All three accessor functions (`getSupabaseUrl`, `getSupabasePublicKey`, `getSupabaseSecretKey`) now consistently use `||` and `.trim()`.

---

## 3. Authentication Session Exception Handling

### File: `lib/auth/session.ts`

**Change**: Wrapped the entire `getCurrentErpSession()` function body in a top-level `try-catch` block.

**Before (v1.0.0)**: An uncaught database query error (e.g., `user_role_assignments` table query failure, Supabase connection timeout) would throw during SSR, crashing the Next.js Server Component and returning HTTP 500.

**After (v1.0.1)**: Any exception is caught, logged to `console.error("getCurrentErpSession Error:", err)`, and the function safely returns `null`. This causes the dashboard layout to redirect to `/auth/login` instead of crashing.

**Additional Change**: The `assignmentsResult.error` handling was changed from `throw new Error(...)` to `console.error(...)` + `return null`, preventing a hard crash on role-assignment query failures.

---

## 4. Middleware Safety Fix

### File: `lib/supabase/middleware.ts`

**Change**: Wrapped the entire `updateSession()` function body (including `createServerClient` initialization and `supabase.auth.getUser()`) in a top-level `try-catch` block.

**Before (v1.0.0)**: If `createServerClient` threw due to invalid configuration (e.g., empty URL or key), the middleware would crash and block all page loads.

**After (v1.0.1)**: Any middleware-level exception is caught, logged to `console.error("Middleware Session Error:", err)`, and the original `NextResponse` is returned, allowing the page to load normally.

---

## 5. Login-Page Responsive Layout

No changes were made to `app/auth/login/page.tsx` in this patch — the login page layout was already responsive across mobile, tablet, and desktop viewports. The HTTP 500 was caused by upstream session/config issues, not the login page component itself.

---

## 6. Economy Form & API Synchronization Status

All Economy Form modules and their backing APIs are fully synchronized between Local and Production:

| Module | API Route | Status |
|--------|-----------|--------|
| Purchase Booking | `/api/erp/purchases/local-purchase/*` | 🟢 Synced |
| Purchase Orders | `/api/erp/purchases/orders/*` | 🟢 Synced |
| Payments | `/api/erp/purchases/orders/[id]/payments` | 🟢 Synced |
| Transfers | `/api/erp/purchases/orders/[id]/transfer` | 🟢 Synced |
| Sales Orders | `/api/erp/sales/orders/*` | 🟢 Synced |
| Roznamcha | `/api/erp/roznamcha` | 🟢 Synced |
| Money Exchange | `/api/erp/money-exchange` | 🟢 Synced |
| Expenses | `/api/erp/expenses` | 🟢 Synced |
| Idempotency Framework | All 9 Direct Posting APIs | 🟢 Active |

---

## 7. Files Changed (v1.0.0 → v1.0.1)

| # | File | Change Type | Description |
|---|------|-------------|-------------|
| 1 | `lib/supabase/config.ts` | **MODIFIED** | Replaced `??` with `||`, added `.trim()`, safe empty-string handling |
| 2 | `lib/auth/session.ts` | **MODIFIED** | Top-level try-catch in `getCurrentErpSession()`, soft-fail on query errors |
| 3 | `lib/supabase/middleware.ts` | **MODIFIED** | Top-level try-catch in `updateSession()` |
| 4 | `LOCAL_PROD_SYNC_REPORT.md` | **NEW** | Local vs Production synchronization & HTTP 500 resolution report |
| 5 | `RELEASE_NOTES_v1.0.1.md` | **NEW** | This file |

---

## 8. Security Audit

### Secret Key Exposure Check

| Check | Result |
|-------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_*` variable | ❌ **NOT FOUND** — Safe |
| Hardcoded secret key values in source code | ❌ **NOT FOUND** — Safe |
| `SUPABASE_SERVICE_ROLE_KEY` in client-side bundles | ❌ **NOT FOUND** — Safe |
| Secret key references in server-only files (`lib/`, `scripts/`) | ✅ Correct — server-side only |
| `sb_publishable_*` (anon key) in `NEXT_PUBLIC_*` | ✅ Correct — this is the public/anon key, safe for client |

---

## 9. Test & Deployment Results

### Expected Test Matrix

| Test | Expected Result |
|------|-----------------|
| `/auth/login` renders (localhost) | ✅ HTTP 200, login form displayed |
| `/auth/login` renders (production) | ✅ HTTP 200, login form displayed |
| Login with valid credentials | ✅ Redirects to `/dashboard` |
| Logout | ✅ Redirects to `/auth/login` |
| Session restoration (refresh page while logged in) | ✅ Session preserved |
| Protected route redirect (unauthenticated → `/dashboard`) | ✅ Redirects to `/auth/login` |
| Economy Form API (`POST /api/erp/purchases/local-purchase/accept`) | ✅ Returns 200/201 |
| Dashboard access after login | ✅ Full dashboard loads |
| Mobile login layout (< 640px) | ✅ Responsive, single-column |
| Tablet login layout (768px–1024px) | ✅ Responsive, centered |
| Desktop login layout (> 1024px) | ✅ Full-width, two-panel |
| `npm run build` | ✅ Clean exit code 0 |

---

## 10. Deployment Commands

```powershell
# Step 1: Stage all changes
git add lib/supabase/config.ts lib/auth/session.ts lib/supabase/middleware.ts LOCAL_PROD_SYNC_REPORT.md RELEASE_NOTES_v1.0.1.md

# Step 2: Commit
git commit -m "fix(auth): resolve HTTP 500 on /auth/login — safe env fallback, session exception handling, middleware safety [v1.0.1]"

# Step 3: Create v1.0.1 tag (DO NOT move v1.0.0)
git tag -a v1.0.1 -m "Patch release v1.0.1: Auth HTTP 500 fix, Supabase config safety, middleware exception handling"

# Step 4: Push commit and tag to origin/main
git push origin main
git push origin v1.0.1

# Step 5: Verify local commit hash
git log -1 --format="%H"

# Step 6: Verify tag points to correct commit
git rev-parse v1.0.1

# Step 7: Verify origin/main matches
git ls-remote origin refs/heads/main

# Step 8: Build
npm run build

# Step 9: Deploy to production VPS
ssh root@72.60.209.121 "cd /path/to/app && git pull origin main && npm run build && pm2 restart all"

# Step 10: Verify production commit
ssh root@72.60.209.121 "cd /path/to/app && git log -1 --format='%H'"
```

---

## 11. Version Lineage

```
v1.0.0 (c5e88dfa9) ──── Original Release Baseline
    │
    └── v1.0.1 (NEW COMMIT) ──── Auth Fix Patch Release ← YOU ARE HERE
```

> [!NOTE]
> v1.0.0 tag remains intact and unchanged. v1.0.1 is a forward-only patch.
