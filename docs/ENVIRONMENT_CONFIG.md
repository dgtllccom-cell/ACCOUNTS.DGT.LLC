# Environment Variables Reference Guide

This document lists all environment variables used across local, staging, and production environments for **ACCOUNTS.DGT.LLC**.

---

## Variable Reference Table

| Variable Name | Required | Scope | Description / Sample Value |
|---|---|---|---|
| `NODE_ENV` | Yes | Server | Runtime mode: `development`, `production`, `test` |
| `PORT` | Optional | Server | HTTP port listener (Default: `3000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client & Server | Supabase project API URL (e.g. `https://csesvyxxjivnkkozgopt.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client & Server | Supabase anonymous client API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server | Supabase admin service role key for migrations and elevated operations |
| `DATABASE_URL` | Yes | Server | PostgreSQL pooler database connection string (`postgresql://postgres:...@pooler.supabase.com:6543/postgres`) |

---

## File Precedence & Security

1. **Local Development**: Saved in `.env.local` (Never committed to Git).
2. **Templates & Backups**: Blueprint files saved in [`env_backups/`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/env_backups).
3. **Server Backups**: Auto-backed up to `/var/www/env_backups/.env.local.bak` on VPS.
