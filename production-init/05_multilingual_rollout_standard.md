# Digital Dock ERP — A-to-Z Multilingual Standard & Rollout

## What already exists (do NOT rebuild)
The five-language engine and both helpers are already implemented:

| Layer | Where | Function |
|---|---|---|
| Local translation engine | `lib/services/multilingual-service.ts` | `translateText(text) -> {en,ur,ar,fa,ps}` |
| Write-time propagation | `lib/services/translation-trigger-service.ts` | `translateMasterRecord(table, id, fieldValues, lang, actorId)` |
| Storage | `record_translations` + `name_en/ur/ar/fa/ps` columns (migration 0078) | `saveEnterpriseRecordTranslations(...)` |
| Read-time resolver | `lib/i18n/auto-translate-record.ts` | `getTranslatedRecordField(raw, translations, lang)` |
| DB read resolver | migration 0078 | `erp_resolve_language_text(en,ur,ar,fa,ps,lang)` |
| UI labels | `lib/i18n/ui.ts` | `t(lang, key)` |

So this is **not a build task — it is a coverage task.**

## Honest coverage evidence (measured)
- `TRANSLATABLE_FIELDS` now covers **26 tables** (was 14 — extended this commit: states_provinces, districts, cities, areas_locations, products, product_brands, product_categories, product_units, warehouses, banks, employees).
- Only **3 of 116** API write routes (`app/api/**`) currently call the translation trigger.
- => The gap is: (a) wire the remaining ~113 write routes to call `translateMasterRecord`, and (b) make every display read the translated field.

Doing all 113 routes + hundreds of display sites in one blind pass would break this
fragile, concurrently-edited production system (and cannot be build-tested here).
It must be rolled out **module by module, each verified**.

## The standard — apply exactly this pattern everywhere

### 1) WRITE (after every master insert/update)
```ts
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

// ...after the record is saved and you have its id + the entered values:
await translateMasterRecord(
  "cities",                       // table name (must be in TRANSLATABLE_FIELDS)
  saved.id,                       // record UUID
  { name: body.name },            // the field(s) the user typed, in ANY one language
  session.language ?? "en",       // the language the user entered
  session.userId                  // actor (audit)
);
// Non-fatal: never blocks the save. Fills name_en/ur/ar/fa/ps automatically.
```

### 2) READ (every table cell, form value, popup, report, print)
Server (preferred — use the DB column already resolved):
```sql
erp_resolve_language_text(name_en, name_ur, name_ar, name_fa, name_ps, :lang) AS name
```
Client:
```ts
import { getTranslatedRecordField } from "@/lib/i18n/auto-translate-record";
const label = getTranslatedRecordField(row.name, row.translations, lang);
```

### 3) UI labels (headings, buttons, menus) — already the standard
```ts
import { t } from "@/lib/i18n/ui";  const text = t(lang, "nav.purchase");
```

## Rollout order (safe, one module at a time — each with your build + real-data test)
1. **Master data writes** (highest value): locations, products/goods, warehouses, banks, customers/suppliers, accounts/ledgers, employees — add the WRITE snippet to each master's create/update route.
2. **Master data displays**: switch every list/table/detail/popup to the READ resolver (DB `erp_resolve_language_text` or `getTranslatedRecordField`).
3. **Transactional screens**: purchase, sales, journal, roznamcha, payments — labels via `t()`, referenced master names via the resolver (their names come from masters, so step 1-2 covers most).
4. **Reports / Print / PDF / Email**: pass `lang` through and use the same resolver + `t()`; verify RTL (`dir="rtl"`) for ur/ar/fa/ps.
5. **Backfill**: run `translateMasterRecordsBatch(...)` once per table to populate the 5-language columns for EXISTING rows.

## Verification per module (evidence, not claim)
- Create a record in English -> confirm `name_ur/name_ar/name_fa/name_ps` are populated in the DB row.
- Switch language -> the same record's list, form, popup, report and print all show the selected language.
- RTL layout correct for Urdu/Arabic/Farsi/Pashto.
- `npm run build` green; no runtime error in the module.

## This commit
- Extended `TRANSLATABLE_FIELDS` from 14 -> 26 tables (central, low-risk, `parseDiagnostics=0`).
- No write routes were blind-edited (that is the phased work above).

## Recommended next step
Pick the first module (recommended: **Location Management** — its masters were just
seeded). I will wire its create/update routes to `translateMasterRecord`, switch its
displays to the resolver, add a one-time batch backfill, and give you the exact
changed files + verification queries — then move to the next module.
