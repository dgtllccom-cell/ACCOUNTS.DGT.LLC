# Database Migrations & Schema Management

This directory contains the complete set of PostgreSQL / Supabase SQL schema migrations for **ACCOUNTS.DGT.LLC**.

---

## Migration File Structure

Migrations are organized chronologically with numerical and feature prefixes:

- `0001_foundation.sql`: Core ERP foundation schema, users, and enterprise tables.
- `0002_multi_country_branch_management.sql`: Multi-country and branch hierarchy schema.
- `0003_enterprise_erp_phase_1.sql`: Accounting ledgers, chart of accounts, vouchers, and transactions.
- ...
- `0078_centralized_multilingual_master_data.sql`: Latest master data and multilingual translation schemas.
- `202606..._*.sql`: Dated feature migrations.

---

## How to Apply Migrations

### 1. Automatic Deployment Sync (Recommended)
When deploying via the deployment scripts (`deployment/deploy.bat`), schema migrations are automatically validated and synchronized with central Supabase:

```bash
node scripts/sync-supabase-db.mjs
```

### 2. Drizzle ORM Migrations
To generate new migrations from updated schema definitions in `lib/db/schema.ts`:

```bash
npm run db:generate
```

To apply pending migrations using Drizzle Kit:

```bash
npm run db:migrate
```
