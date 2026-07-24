# Environment Backups & Configuration Templates

This directory contains sanitized environment file blueprints and backup templates for different deployment environments.

> [!IMPORTANT]
> **Security Notice**: Never commit secret `.env` or `.env.local` files containing actual passwords, private API keys, or database credentials to version control.

---

## Included Templates

1. [`.env.example`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/env_backups/.env.example)
   - Standard blueprint for local development.
   - Copy this file to `.env.local` in the project root to configure your local dev server.

2. [`.env.production.example`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/env_backups/.env.production.example)
   - Blueprint for Production VPS environment setup (72.60.209.121).

3. [`.env.staging.example`](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/env_backups/.env.staging.example)
   - Blueprint for Staging / QA testing environment.

---

## How to Restore / Configure Environment

When setting up on a new computer or server:

```bash
# 1. Copy the example file to .env.local in the root directory
cp env_backups/.env.example .env.local

# 2. Update the credentials in .env.local with your real keys
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...
# DATABASE_URL=...
```
