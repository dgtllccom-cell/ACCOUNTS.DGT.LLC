# IMPORTANT DATABASE RULE — PRODUCTION VS TESTING

## 1. Production / Original Database
**Project Name:** `ACCOUNTS.DGT.LLC - Production`  
**Reference:** `inmayhrxucimxqhgseqi` (VPS / Production Database)

This is the real, live business database.
**STRICT PROHIBITION:** Do NOT add:
- Fake data
- Demo data
- Duplicate customers
- Duplicate accounts
- Test transactions
- Test purchases / sales
- Temporary users
- Trial stock entries

**NEVER** use Production for testing.

---

## 2. Testing / Local Database
**Project Name:** `dgtllccom-cell's Project`  
**Reference:** `csesvyxxjivnkkozgopt` (Local / Testing Database)

Use this database exclusively for:
- Development testing
- Sample transactions
- UI testing
- Workflow testing
- Temporary users
- Test purchases and sales
- Test stock
- Migration verification

---

## 3. Production Deployment Rules
- Production deployment may include **verified code** and **reviewed migrations only**.
- Test / demo business records must **NEVER** be copied, synced, or pushed to Production.

---

## 4. Pre-Execution Verification
- Before ANY database write, script execution, or migration, **ALWAYS confirm which Supabase project / DATABASE_URL is connected**.
- Verify the active connection string against the intended target (`csesvyxxjivnkkozgopt` for testing vs `inmayhrxucimxqhgseqi` for production).

---

## 5. Absolute Protection of Production Data
- **NEVER** reset, truncate, seed, or clean the Production database without explicit, written owner approval.
- Any administrative maintenance on Production must be surgical, non-destructive, and strictly authorized.
