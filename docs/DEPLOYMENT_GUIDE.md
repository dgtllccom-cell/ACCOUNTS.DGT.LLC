# Deployment & Release Guide

This document explains the standard production deployment workflows for **ACCOUNTS.DGT.LLC**.

---

## Production Deployment (1-Click)

To deploy the latest code and schema changes to production server `72.60.209.121`:

### Windows Environment
Double-click `deploy.bat` in the root directory, or execute from command line:

```cmd
.\deploy.bat
```

Or run directly from the [`deployment/`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment) folder:

```cmd
cd deployment
.\deploy.bat
```

### What `deploy.bat` Performs:
1. **Database Schema Sync**: Runs `node scripts/sync-supabase-db.mjs` to push schema migrations.
2. **Git Commit & Push**: Stages all local changes, creates a standard sync commit, and pushes to `main` branch.
3. **VPS Server Deployment**: Triggers `node deployment/run-vps-fix.mjs` to pull latest code on `72.60.209.121`, install npm packages, build Next.js, and restart the PM2 process.

---

## Deployment Verification

To deploy and run post-deployment test verification automatically:

```cmd
cd deployment
.\double-click-to-deploy.bat
```

This script validates:
- TypeScript compilation (`npm run typecheck`)
- Unit test suite execution (`npm test`)
- Remote production build status
- HTTP status response from VPS server
