# Multilingual Automation — Completion Report

**Date:** 2026-08-06
**Scope:** Permanent, self-applying five-language (en/ur/ar/fa/ps) architecture from the database layer up, for all current and future ERP development.

---

## What now happens automatically

1. **Any INSERT/UPDATE** on a registered table → a database trigger (`trg_enroll_translations`) enrolls every registered text field into `record_translations` (five language columns + JSONB), with the original stored as a safe fallback and status `pending`. This is **code-path independent** — it works for app routes, direct SQL, imports, and future modules alike. No developer has to remember anything.
2. **Reads** resolve the correct language via `resolve_record_translation_v2(...)` — no live translation at page load; English is the fallback until a real translation exists.
3. **Technical fields** (ids, uuids, codes, FKs, dates, numbers, statuses) and **financial narration** are never touched — enforced by the curated registry.

## The permanent building blocks (all in the repo, all applied to Production)

Repo migration `supabase/migrations/20260808_multilingual_automation.sql` (idempotent, replay-safe) contains:

- `translation_field_registry` — DB source of truth (145 fields / 71 tables), seeded.
- `upsert_record_translation(...)` — partial-unique-index-safe writer (fixes the original 42P10 bug).
- `backfill_record_translations(table, field)` — bulk enroll one field.
- `backfill_translation_keyset(table, field, after, limit)` — **resumable, batched** backfill for very large tables (used for the 704k-row Cities table).
- `tg_enroll_translations()` — the universal, exception-safe enrollment trigger (a translation hiccup can never break a user's save).
- `attach_translation_triggers()` — (re)attaches the trigger to every registered base table; re-run after adding tables.

App layer (repo): `lib/i18n/translatable-fields.ts` (registry mirror), `lib/i18n/record-translation-sync.ts` (save hook), `lib/services/translation-trigger-service.ts` (now registry-driven), `lib/services/enterprise-multilingual-service.ts` (RPC writer).

## Automatic validation (the guard)

`scripts/i18n-scan.mjs` + `npm run i18n:scan` (and `npm run i18n:fix`): connects to the DB, classifies every user-facing text column, and **fails (exit 1) if any eligible field is not registered** — wire it into CI/pre-deploy so no new table/form/report ships without multilingual support. `--fix` auto-registers the field and re-attaches triggers. A curated exclusion list keeps narration/technical/snapshot/legacy-column fields out.

## Verified

- **Trigger:** inserted a real `product_categories` row with no app code → 2 translation rows auto-created (`category_name` + `description`, engine `trigger_enroll`), resolvable in all five languages. (Test row cleaned up.)
- **Attachment:** trigger attached to **69** base tables; registry holds **145** fields.
- **Backfill:** **706,717** translation rows across all populated tables, including the full **704,824-row Cities** table (done in resumable 50k–100k keyset batches, zero timeouts, exactly matching the table count).
- **Reads:** countries, states, cities, and categories all resolve per language with English fallback.
- **Validator:** clean — every eligible field is registered (34 heuristic hits are all intentional exclusions).

## Deployment status

- **Production database (live):** ✅ all functions, the registry, the seed, and the triggers are applied; all existing data backfilled. Active now.
- **Local database:** apply the repo migration — `supabase db push` (or `supabase migration up` / a fresh `supabase start` replays `supabase/migrations/`). Because everything lives in the migration file, it rebuilds automatically. Then optionally run existing-data backfill locally the same way.
- **Backup/restore & future deploys:** self-restoring — the migration is versioned in the repo, so any environment rebuilt from migrations gets the entire multilingual layer (registry + triggers + functions) automatically. After adding a new table, run `npm run i18n:fix` (or add to the registry + a migration) so its trigger attaches.
- **Application code:** the Phase 1–2 source files still need to be committed (the local `.git/index.lock` blocker) — commands below.

## Onboarding a NEW table/field later (the A-to-Z promise)

1. Create the table as usual.
2. `npm run i18n:fix` — registers eligible fields + attaches the trigger. (Also mirror them into `lib/i18n/translatable-fields.ts`.)
3. From then on, every insert/update auto-enrolls; run `backfill_translation_keyset(...)` once for any pre-existing rows.

## Honest limitation (unchanged, by design)

Enrolled values start as the original text in all five languages, status `pending`. This guarantees no regressions and instant language switching, but it is **enrollment, not real translation** — genuine Urdu/Arabic/Farsi/Pashto values for free-form data require the translation engine (dictionary) + native-speaker correction pass (the `pending` status marks exactly what remains). For proper nouns (names/places), the fallback is usually the correct display anyway.

## Commit set (clear the lock once, then commit)

```
del ".git\index.lock"
git add supabase/migrations/20260808_multilingual_automation.sql scripts/i18n-scan.mjs package.json ^
  lib/i18n/translatable-fields.ts lib/i18n/record-translation-sync.ts ^
  lib/services/translation-trigger-service.ts lib/services/enterprise-multilingual-service.ts ^
  app/api/erp/master-data/categories/route.ts MULTILINGUAL-AUTOMATION-COMPLETE.md
git commit -m "i18n: permanent multilingual automation — registry, enrollment triggers, resumable backfill, CI validator"
```
