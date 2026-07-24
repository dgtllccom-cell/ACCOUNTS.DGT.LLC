# Centralized Master Data and Five-Language ERP Standard

This ERP uses one centralized master table for each master-data entity. New modules must not create module-specific duplicate master tables.

## Central Masters

Use these masters across the ERP:

- Goods: `goods`, `goods_variations`, `products`, `product_brands`, `product_categories`, `product_units`
- Locations: `countries`, `states_provinces`, `districts`, `cities`, `areas`, `postal_codes`
- Parties: `customers` for customers and suppliers where the current schema uses party typing
- Accounts: `enterprise_accounts`
- Banks: `banks`
- Companies: `companies`
- Warehouses: `warehouses`
- Branches: `country_branches`, `city_branches`

Every module must read from these tables through shared lookups or repositories. Do not create separate Goods, Location, Customer, Supplier, Bank, Account, Brand, Unit, Category, Warehouse, Branch, City, or Country masters for a module.

## Five-Language Record Contract

Every master record should be stored once and carry language values on the same row:

- `name_en`
- `name_ur`
- `name_ar`
- `name_fa`
- `name_ps`

Where descriptions are needed, use the same pattern:

- `description_en`
- `description_ur`
- `description_ar`
- `description_fa`
- `description_ps`

Do not duplicate a record per language.

## Display Rule

The selected ERP language determines which field is displayed:

- English -> `name_en`
- Urdu -> `name_ur`
- Arabic -> `name_ar`
- Persian/Farsi -> `name_fa`
- Pashto -> `name_ps`

If the selected language is missing, fall back to English, then to the legacy name column.

Use `lib/master-data/multilingual.ts` for this behavior. Do not manually choose language columns in individual modules.

## Shared Lookup API

Use this endpoint for reusable master-data dropdowns and search:

`GET /api/erp/master-data/lookup?entity=goods&q=cashew&lang=ur`

Supported entities are defined in `lib/master-data/central-master-tables.ts`.

The endpoint returns localized labels according to the selected language and applies session country/branch scope where master rows contain scope columns.

## Future Module Rule

Before adding a new module, connect it to the centralized master layer first. A future module should only add transaction tables and module-specific workflow data. Master data must remain centralized.
