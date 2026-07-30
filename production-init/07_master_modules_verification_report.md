# Verification Report — Warehouse / Brand / Category / Unit Modules

**Method:** project-wide search (migrations, `app/**`, `lib/**`, `features/**`, sidebar, permissions).
**Rule followed:** no guessing — every line below is backed by a found file/line, or an explicit "not found".

---

## Summary table

| Module | DB table | CRUD API | Page/Route | Repository/Service | Menu | Permissions |
|---|---|---|---|---|---|---|
| Product Categories | ✅ exists | ❌ none | ❌ none | ❌ none (read-only join) | ❌ none | ✅ defined |
| Product Brands | ✅ exists | ❌ none | ❌ none | ❌ none (read-only join) | ❌ none | ✅ defined |
| Product Units | ✅ exists (seeded) | ❌ none | ❌ none | ❌ none (read-only join) | ❌ none | ✅ defined |
| Warehouses | ❌ **table missing** | ❌ none | ⚠️ stock-view only | ❌ none | ⚠️ stock-view only | ✅ defined |

**Conclusion:** None of the four have a Create/Update implementation to connect. Categories/Brands/Units **tables exist but have no CRUD**; the Warehouses **table does not exist at all**. They must be built (Warehouses also needs its table created first).

---

## 1. Product Categories
- **DB table:** ✅ `product_categories` — created in `supabase/migrations/0023_product_master_architecture.sql:5`.
  Columns: `id, country_id→countries, category_code, category_name (NOT NULL), description, original_language_code→languages, is_active, created_by→profiles, created_at, updated_at, deleted_at`. Unique index on `(country_id, lower(category_name))`.
- **Name column:** `category_name` (code: `category_code`).
- **API routes / Create-Update endpoints:** ❌ none found anywhere in `app/api/**`.
- **Page / Route (URL):** ❌ none (`app/**` has no categories page).
- **Repository / Service:** ❌ none. Only **read** as a join in `lib/repositories/products-repository.ts:86,128` (`product_categories(category_name)` for the product list dropdown).
- **Relationships:** `products.category_id → product_categories.id`.
- **Permissions:** ✅ `lib/permissions/catalog.ts:524,548` (resource `product_categories`).
- **Menu:** ❌ none in `lib/navigation/sidebar.ts`.

## 2. Product Brands
- **DB table:** ✅ `product_brands` — `0023_product_master_architecture.sql:23`.
  Columns: `id, country_id→countries, brand_code, brand_name (NOT NULL), description, original_language_code, is_active, created_by, timestamps, deleted_at`. Unique `(country_id, lower(brand_name))`.
- **Name column:** `brand_name` (code: `brand_code`).
- **API / Create-Update:** ❌ none.
- **Page / Route:** ❌ none.
- **Repository / Service:** ❌ none. Read-only join in `products-repository.ts:87,129` (`product_brands(brand_name)`).
- **Relationships:** `products.brand_id → product_brands.id`.
- **Permissions:** ✅ `catalog.ts:524,549`.
- **Menu:** ❌ none.

## 3. Product Units
- **DB table:** ✅ `product_units` — `0023_product_master_architecture.sql:41` (seeded with KG, TON, … at line 59+).
  Columns: `id, unit_code (NOT NULL), unit_name (NOT NULL), base_unit_code, conversion_factor, is_active, created_by, timestamps, deleted_at`. Unique `(upper(unit_code))`.
- **Name column:** `unit_name` (code: `unit_code`; has `conversion_factor`, `base_unit_code`).
- **API / Create-Update:** ❌ none.
- **Page / Route:** ❌ none.
- **Repository / Service:** ❌ none. Read-only join in `products-repository.ts:88,130-131` (`product_units(unit_code, unit_name)`).
- **Relationships:** `products.unit_id → product_units.id`.
- **Permissions:** ✅ `catalog.ts:524,550`.
- **Menu:** ❌ none.

## 4. Warehouses
- **DB table:** ❌ **NOT created** — no `create table warehouses` in any file under `supabase/migrations/`. (It appears only in the `central-master-tables.ts` registry and permissions, and is referenced by `product_warehouse_mapping` — a **schema inconsistency**: a mapping table references a warehouses table that is not defined.)
- **API / Create-Update / Page / Repository:** ❌ none.
- **Menu:** ⚠️ only a **stock view** — `lib/navigation/sidebar.ts:565` `stock-warehouse` → `/dashboard/purchase/stock/warehouse` (stock-by-warehouse report, **not** a warehouse master CRUD).
- **Permissions:** ✅ `catalog.ts:524,546` (resource `warehouses`).
- **Registry:** `lib/master-data/central-master-tables.ts:50` (defined but unbacked).

---

## Shared / reusable logic available for the build (no duplication needed)
- **Write-time translation:** `translateMasterRecord()` — `lib/services/translation-trigger-service.ts` (field names already aligned: `brand_name`, `category_name`, `unit_name`, `warehouse_name`).
- **Read-time resolver:** `getTranslatedRecordField()` (`lib/i18n/auto-translate-record.ts`) + DB `erp_resolve_language_text()`.
- **Auth / scope:** `requireErpSession()` + `authorizeApiScope()` (`lib/auth/session.ts`) — same pattern as Accounts.
- **Repository pattern:** mirror `lib/repositories/goods-repository.ts` / `banks-repository.ts` (create returns id, update patch, softDelete, `void translateMasterRecord(...)`).
- **UI labels:** `t(lang, key)` (`lib/i18n/ui.ts`).
- **Audit:** `audit_logs` table (exists).

## Recommended next step (your decision)
1. **Product Units** → build CRUD (table exists) + wire engine.
2. **Product Brands** → build CRUD + wire.
3. **Product Categories** → build CRUD + wire.
4. **Warehouses** → **create the `warehouses` table migration first**, then CRUD + wire (also fixes the `product_warehouse_mapping` dangling reference).

Each built one at a time, static-verified, committed; you run `npm run build` + real-data test before the next.
