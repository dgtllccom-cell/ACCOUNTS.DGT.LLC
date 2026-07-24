# ACCOUNTS.DGT.LLC - Multi-Country Enterprise ERP Platform

A modern, high-performance Multi-Country Accounting & Enterprise Resource Planning (ERP) platform built with Next.js 15 (App Router), TypeScript, Tailwind CSS, Drizzle ORM, and Supabase PostgreSQL.

---

## Quick Table of Contents

1. [How to Download / Clone Project](#1-how-to-download--clone-the-project)
2. [How to Install Dependencies](#2-how-to-install-dependencies)
3. [How to Configure Environment](#3-how-to-configure-the-environment)
4. [How to Run Locally](#4-how-to-run-locally)
5. [How to Deploy to Production Server](#5-how-to-deploy-to-the-server)
6. [How to Recover Server During Issues](#6-how-to-recover-the-server)
7. [Permanent Project Folder Structure](#7-permanent-project-folder-structure)
8. [Documentation Index](#8-documentation-index)

---

## 1. How to Download / Clone the Project

To download and set up the project on a new computer:

```bash
# Clone the repository from GitHub
git clone https://github.com/dgtllccom-cell/dht-nextjs.git ACCOUNTS.DGT.LLC

# Navigate into the project folder
cd ACCOUNTS.DGT.LLC
```

> [!NOTE]
> The permanent repository structure ensures that all necessary folders ([`deployment/`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment), [`env_backups/`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/env_backups), [`database/migrations/`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/database/migrations), [`docs/`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs), [`scripts/`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/scripts)) are automatically downloaded when cloning.

---

## 2. How to Install Dependencies

Ensure you have **Node.js v20 LTS** or **v22 LTS** installed on your system.

```bash
# Install all required npm dependencies
npm install
```

---

## 3. How to Configure the Environment

The repository includes pre-configured environment templates in the [`env_backups/`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/env_backups) directory.

### Step 1: Copy Environment Blueprint
Copy the local environment template to create `.env.local` in the project root:

```bash
# Windows Command Prompt / PowerShell / Bash:
cp env_backups/.env.example .env.local
```

### Step 2: Configure Database & Supabase Credentials
Open `.env.local` and specify your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:your-password@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
```

> [!IMPORTANT]
> Secret `.env.local` files are ignored by `.gitignore` and will never be committed to Git.

---

## 4. How to Run Locally

Start the development server with hot-reloading:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to access the ERP dashboard.

---

## 5. How to Deploy to the Server

Production Server: `72.60.209.121`  
Deployment Directory: [`deployment/`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment)

### 1-Click Automated Deployment

#### Windows Shortcut:
Double-click [`deploy.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deploy.bat) in the project root folder.

#### Command Line:
```bash
# Run the deployment script directly
.\deploy.bat
```

Or from the [`deployment/`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment) directory:

```bash
cd deployment
.\deploy.bat
```

### What Automated Deployment Does:
1. **Syncs Database Schema**: Runs schema migrations to central Supabase DB.
2. **Git Commit & Push**: Pushes code to GitHub `main` branch.
3. **VPS Execution**: Automatically connects via SSH, installs packages, compiles production build, and reloads PM2 on `72.60.209.121`.

For more details, see the [Deployment Guide](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/DEPLOYMENT_GUIDE.md).

---

## 6. How to Recover the Server

If any server issue occurs (such as a 502 Bad Gateway or Git push conflict):

### 1. Fix 502 Bad Gateway / Nginx / PM2 Crash (1-Click Recovery)
Double-click [`deployment/double-click-to-fix-502.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/double-click-to-fix-502.bat).

This automatically repairs Nginx configuration, frees server memory, restores `.env.local` backup, re-compiles the build, and restarts PM2.

### 2. Fix Git Lock Errors (1-Click Recovery)
Double-click [`deployment/double-click-to-unlock-git.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/double-click-to-unlock-git.bat).

### 3. Database Backup & Restore
- **Create Local Backup**: Double-click [`deployment/double-click-to-create-backup.bat`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/double-click-to-create-backup.bat) or run `npm run backup`.
- **Restore Backup**: Run `npm run backup:restore-test`.

For complete emergency procedures, see the [Recovery Steps Guide](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/RECOVERY_STEPS.md).

---

## 7. Permanent Project Folder Structure

```
ACCOUNTS.DGT.LLC/
├── app/                        # Next.js App Router pages and API routes
├── components/                 # Global UI design system components
├── database/                   # Database resources & SQL migration scripts
│   └── migrations/             # Standard SQL migration files (0001_... through 0078_...)
├── deployment/                 # Dedicated deployment scripts, SSH, & recovery tools
│   ├── deploy.bat              # Primary 1-click deployment script
│   ├── double-click-to-deploy.bat # Deployment with build & test verification
│   ├── double-click-to-fix-502.bat # 1-click 502 Bad Gateway recovery tool
│   └── server-fix-502.ps1      # Remote SSH Nginx / PM2 repair script
├── docs/                       # Complete documentation center
│   ├── DEPLOYMENT_GUIDE.md     # Production release guide
│   ├── SERVER_SETUP.md         # Production server installation guide
│   ├── RECOVERY_STEPS.md       # Incident & disaster recovery manual
│   ├── ENVIRONMENT_CONFIG.md   # Environment configuration guide
│   └── PROJECT_STRUCTURE.md    # Folder structure blueprint
├── env_backups/                # Environment blueprints (.env.example, .env.production.example)
├── features/                   # Domain-driven ERP business modules (accounts, purchases, roznamcha)
├── lib/                        # Core repositories, database schemas, & utilities
├── public/                     # Static assets & icons
├── scripts/                    # Database tools & seeders
├── supabase/                   # Supabase integration configurations
└── tests/                      # Unit & End-to-End test suites
```

---

## 8. Documentation Index

- [Deployment Guide](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/DEPLOYMENT_GUIDE.md)
- [Server Setup Manual](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/SERVER_SETUP.md)
- [Recovery Steps Guide](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/RECOVERY_STEPS.md)
- [Environment Variables Config](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/ENVIRONMENT_CONFIG.md)
- [Project Architecture Blueprint](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/docs/PROJECT_STRUCTURE.md)
- [Deployment Tools Readme](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/deployment/README.md)
- [Database Migrations Readme](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/database/migrations/README.md)
- [Environment Backups Readme](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/env_backups/README.md)
