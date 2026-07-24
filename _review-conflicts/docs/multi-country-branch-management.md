# Multi-Country Branch Management

## Goal

The system uses a strict hierarchy:

1. Super Admin controls all countries, branches, users, permissions, currency rates, transactions, and global reports.
2. Country Admin controls one assigned country and creates city branches under that country.
3. Branch Admin controls one assigned city branch.
4. Staff/User controls only assigned branch work and records.

Global reports are always shown in USD. Local transactions keep local currency, local amount, USD rate, and USD amount.

## Database Design

Core tables:

- `profiles`: application user profile linked to Supabase Auth.
- `roles` and `permissions`: existing resource/action permission model.
- `countries`: country master with local currency and USD reporting currency.
- `country_branches`: one main branch per country.
- `city_branches`: city branch under a selected country and country main branch.
- `user_role_assignments`: role and scope assignment for Super Admin, Country Admin, Branch Admin, and Staff.
- `transactions`: local currency operational transactions with USD conversion.
- `currency_rates`: daily conversion rates to USD.
- `reports`: generated USD report snapshots.

Migration: `supabase/migrations/0002_multi_country_branch_management.sql`

## Scope Logic

Super Admin:

- Can create countries.
- Can create one main branch for each country.
- Can assign admins and permissions.
- Can view every country, branch, user, transaction, and report.
- Reads global reports in USD.

Country Admin:

- Must be assigned to one country.
- Can create city branches only under assigned country.
- Can view country reports only for assigned country.

Branch Admin:

- Must be assigned to one city branch.
- Can manage local branch users and daily transactions.
- Can view branch-only reports.

Staff/User:

- Can only see assigned work/data.

## Backend API Draft

- `POST /api/branch-management/countries`
- `POST /api/branch-management/country-branches`
- `POST /api/branch-management/city-branches`

These route handlers validate input and call Supabase RPC functions:

- `create_country`
- `create_country_main_branch`
- `create_city_branch`

## Frontend Admin Panel

Initial panel:

- `/dashboard/branch-management`

The panel documents hierarchy, permissions, database tables, USD reporting, and API flow.

## Next Build Order

1. Apply migration `0002_multi_country_branch_management.sql`.
2. Create first Super Admin assignment in `user_role_assignments`.
3. Build country create form.
4. Build country main branch create form.
5. Build city branch create form with required country selection.
6. Build users/role assignment screen.
7. Build country and branch report pages using USD conversion.

