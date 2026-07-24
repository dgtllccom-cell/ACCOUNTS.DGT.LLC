# Server Emergency Recovery & Incident Resolution Guide

This document outlines quick recovery procedures for common operational issues.

---

## 1. 502 Bad Gateway Server Error Recovery

### Symptom
- Browsing to `http://72.60.209.121` displays `502 Bad Gateway` or connection refused.

### Automatic 1-Click Fix
Double-click [`deployment/double-click-to-fix-502.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/double-click-to-fix-502.bat).

### What the Recovery Script Executes:
1. Connects via SSH to `root@72.60.209.121`.
2. Verifies Node.js process health and RAM/Swap memory.
3. Restores missing `.env.local` from `/var/www/env_backups/` if corrupted.
4. Cleans stale `.next` cache and re-compiles Next.js.
5. Restarts PM2 instance `dgt-nextjs` and reloads Nginx.

---

## 2. Git Lock / Commit Rejection Recovery

### Symptom
- Git error: `Fatal: Unable to create '.git/index.lock': File exists.`

### Automatic 1-Click Fix
Double-click [`deployment/double-click-to-unlock-git.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/double-click-to-unlock-git.bat).

### Manual Fix:
```powershell
Remove-Item -Path ".git/index.lock" -Force -ErrorAction SilentlyContinue
git reset
```

---

## 3. Database Backup Snapshot & Restoration

### Create Local Backup Snapshot
Double-click [`deployment/double-click-to-create-backup.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/double-click-to-create-backup.bat) or run:

```bash
npm run backup
```

### Restore Database from Backup
```bash
npm run backup:restore-test
```
