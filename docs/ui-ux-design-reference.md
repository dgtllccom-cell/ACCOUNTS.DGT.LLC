# ERP UI/UX Design Reference (Canonical)

This document records the primary UI/UX reference for this ERP/FMS project. It should be treated as the canonical source for layout, spacing, patterns, and overall visual language.

## Primary Design Reference (Figma)

- Inventory System (Figma): https://www.figma.com/design/c2uFKB38VMe1aZZrQNADDh/inventory-system?node-id=0-1&t=T1SebQxC1eFCyCnO-1

## How To Use This Reference

Do **not** copy disconnected screens into the codebase.

Use the Figma reference to implement the same style inside the existing ERP project while keeping everything connected:

- Routing and sidebar navigation (no standalone pages).
- Role-based access control (RBAC) + branch/country scope.
- Multilingual + RTL support (English, Arabic, Urdu, Persian/Farsi, Pashto).
- Database and API integration (when a screen is not a placeholder).
- Audit logs, approvals, and reporting where applicable.
- Searchable dropdown patterns and master-data reuse.

## Consistency Rules

Match the reference patterns for:

- Sidebar structure and dropdown behavior.
- Topbar height, spacing, and dense/compact ERP layout.
- Filter bars (date range, search, dropdowns).
- Tables (sticky headers where needed, compact cells, clear totals).
- Report cards (print-preview style, export actions).
- Consistent typography and alignment (RTL must mirror layout).
- Light/Dark theme and template color variants.

Implementation rule:

- Prefer existing shared components (`components/ui`, `components/forms`, `components/tables`, `components/reports`) and extend them instead of reinventing per-page UI.

## Step-by-Step ERP Development Flow

Complete and stabilize each step before moving to the next:

1. Super Admin + Super Admin Branch
2. Country Main Branch
3. City / Branch hierarchy
4. User Management + User ID forms + Roles & Permissions
5. Accounts + Account Codes + Economic Codes + Ledgers
6. Roznamcha / Daily Payment + Journal posting (debit/credit)
7. Reports + Print preview + PDF/Excel/Email + Live reporting
8. Cross-system connections (Search, multilingual, currency/rates, master data)

## QA Checklist (After Each Step)

Before moving forward, verify:

- Browser UI and responsive behavior
- Save/load behavior
- Database reads/writes (when enabled)
- Routing + sidebar links (no dead links)
- RBAC + scope checks (super/country/branch/agent)
- Search + dropdown behavior
- Reports + print preview
- Language switching + RTL behavior
- Currency and exchange-rate behavior (where applicable)

