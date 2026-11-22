# AGENTS & DEVELOPER GUIDELINES — ACCOUNTS.DGT.LLC

## CRITICAL DATABASE RULE: PRODUCTION VS TESTING

Every agent, developer, and automated tool operating in this codebase MUST follow these rules strictly:

### 1. Production / Original Database
- **Name:** `ACCOUNTS.DGT.LLC - Production`
- **Supabase Ref:** `inmayhrxucimxqhgseqi` (Production / VPS)
- **Role:** Real business database.
- **Rules:**
  - Do NOT add fake data, demo data, duplicate customers, duplicate accounts, test transactions, test purchases/sales, temporary users, or trial stock entries.
  - **DO NOT USE PRODUCTION FOR TESTING.**

### 2. Testing / Local Database
- **Name:** `dgtllccom-cell's Project`
- **Supabase Ref:** `csesvyxxjivnkkozgopt` (Testing / Development)
- **Role:** Dedicated environment for all testing.
- **Rules:**
  - Use ONLY this database for development testing, sample transactions, UI testing, workflow testing, temporary users, test purchases/sales, test stock, and migration verification.

### 3. Production Deployment Rules
- Production deployment may include verified code and reviewed migrations only.
- Test/demo business records must NEVER be copied or synced to Production.

### 4. Mandatory Connection Confirmation
- Before ANY database write, script execution, or migration, explicitly check and confirm which Supabase project / `DATABASE_URL` is connected.

### 5. Production Protection
- NEVER reset, truncate, seed, or wipe the Production database without explicit owner approval.

## MANDATORY: Release workflow — every developer, every session (owner rule, 2026-11-22)
Full owner text and rationale: `docs/release-workflow.md`. The owner has authorized development, testing, PRs, merging and
deployment *preparation*; do not ask for that again. Ask the owner only for an owner-only step (the VPS release, a new financial
posting decision, a mandatory security approval), and then for exactly that.

**Flow:** feature branch → commit + push → PR into `main` → all CI green → merge → separate PR `main` → `production` → CI green
on the combined code → merge → one VPS command block for the owner → owner runs it → verify Live → screenshots + final report.
- Never push directly to `main` or `production`; never force-push, reset, delete branches or overwrite others' work.
- Before merging/deploying: fetch the latest `main` / `production` heads, review commits other developers added during the
  session (e.g. a direct push to `production` must be brought back into `main` by PR), resolve conflicts keeping both sides'
  intent, and run CI on the final combined code.
- Before a release: CI passed on the exact production tip; no unreviewed migrations (`supabase/migrations` diff vs live); no
  deployment running; no other pending approval. **One deployment at a time — never run `dgt-approve-deploy` / `dgt-deploy` /
  `deploy-via-gate.*` while someone else is deploying, and never replace another person's approval** (the gate now refuses both:
  `scripts/production/dgt-approve-deploy.sh`, `--replace` only on purpose).
- Only the authorized gate deploys (`dgt-approve-deploy <sha>` → `dgt-deploy`, or `scripts/production/deploy-via-gate.sh`). Never
  bypass it, the build guard or the ref lock. Agents without owner SSH prepare the release; the owner runs it.
- **The owner's VPS command block** is ONE paste-ready block with the exact, freshly verified production SHA (never a reused one),
  that stops safely on any failed prerequisite: no deploy/build running → show gate log → confirm `origin/production` = SHA →
  (re)install the gate from that SHA if `scripts/production/` changed → approve → `dgt-deploy --dry-run` → `dgt-deploy` detached
  (`setsid nohup`, backup first) → wait for `DEPLOYED <sha>` → print live HEAD + `pm2 ls`. Never give partial commands or make the
  owner guess a SHA.
- **Testing:** `npx tsc --noEmit`, `npm run build`, CI, `npm run i18n:guard`, `npm run stock:guard`; purchase/sales, ledger/
  Roznamcha, payments/FX, loading/stock on the TESTING DB only; Production checks read-only; no real financial postings for tests.
- **Never claim "Live"** from a merge or a green build: verify the gate log (`DEPLOYED <sha>`), live HEAD, backup readable
  (`pg_restore --list`), PM2 online, `https://api.dgt.llc` 200, critical workflows, 5 languages + mobile, with real screenshots.
- Protect Production data always: bills, parties/accounts, ledger/Roznamcha, payments, stock, loading, companies/branches,
  users/permissions. No deletes, no duplicate postings.
- **End of every session**, report: Development status · `main` SHA · `production` SHA · CI status · Production deployment ·
  Database backup · Live ERP status · Screenshots · Required owner action (exact, only if genuinely necessary).
