# Production & VPS Deployment Tools

This directory contains all automated deployment scripts, VPS maintenance tools, database synchronization utilities, and recovery batch/PowerShell scripts for **ACCOUNTS.DGT.LLC**.

---

## Key Deployment Scripts

### 1. [`deploy.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/deploy.bat)
- **Primary 1-Click Deployment Script**
- Performs standard production sync:
  1. Synchronizes Supabase DB schema with local migrations.
  2. Stages and commits git changes.
  3. Pushes changes to GitHub `main` branch.
  4. Triggers remote server update and PM2 reload on VPS (`72.60.209.121`).

### 2. [`double-click-to-deploy.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/double-click-to-deploy.bat)
- **Deployment & Verification Script**
- Runs full build verification, unit tests, and production server deployment.

### 3. [`double-click-to-fix-502.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/double-click-to-fix-502.bat) & [`server-fix-502.ps1`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/server-fix-502.ps1)
- **Automatic 502 Bad Gateway Recovery Tool**
- Connects via SSH to VPS `72.60.209.121`, restarts Nginx service, flushes stale Next.js build cache, and restarts the PM2 process.

### 4. [`double-click-to-unlock-git.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/double-click-to-unlock-git.bat) & [`fix-git-lock.ps1`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/fix-git-lock.ps1)
- **Git Lock & Index Recovery**
- Removes stale `.git/index.lock` files if a previous commit or push was interrupted.

### 5. [`double-click-to-create-backup.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/double-click-to-create-backup.bat)
- **Instant Production Backup Script**
- Creates a timestamped local JSON snapshot backup of all enterprise database tables.

---

## How to Execute Deployment

### Option A: From Root Directory Shortcuts
You can double-click [`deploy.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deploy.bat) in the project root.

### Option B: From Command Line
```bash
# Navigate to deployment directory and run
cd deployment
.\deploy.bat
```
