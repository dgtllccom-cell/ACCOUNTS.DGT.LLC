# GEMINI SYSTEM GUIDELINES — ACCOUNTS.DGT.LLC

## MANDATORY DATABASE POLICY: PRODUCTION VS TESTING

Strict adherence is required at all times across all sessions:

### 1. Production / Original Database
- **Identifier:** `ACCOUNTS.DGT.LLC - Production`
- **Target Reference:** `inmayhrxucimxqhgseqi` (Production / VPS)
- **Status:** LIVE REAL BUSINESS DATA
- **Strict Restrictions:**
  - Absolutely NO fake data, demo data, test transactions, temporary accounts, test purchases/sales, temporary users, or trial stock entries.
  - NEVER run experiments, sample workflows, or tests against this database.

### 2. Testing / Local Database
- **Identifier:** `dgtllccom-cell's Project`
- **Target Reference:** `csesvyxxjivnkkozgopt` (Testing / Development)
- **Status:** SANDBOX / EXPERIMENTAL ENVIRONMENT
- **Authorized Use:**
  - All development testing, sample transactions, UI verification, workflow tests, test stock/purchases/sales, and migration dry-runs must occur HERE.

### 3. Deployments
- Only verified code and reviewed migrations may be deployed to Production.
- Test/demo records must NEVER be copied or merged into Production.

### 4. Verification Step
- Prior to running any migration, script, or write query, ALWAYS inspect the active database connection string to ensure it points to the intended target.

### 5. Production Safety
- NEVER reset, truncate, seed, or wipe the Production database without explicit owner consent.
