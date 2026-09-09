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
