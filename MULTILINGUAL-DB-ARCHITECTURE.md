# ERP-Wide Multilingual Database Architecture — Review & Implementation Plan

**Date:** 2026-08-06
**Status:** Review complete on the live Production database (`inmayhrxucimxqhgseqi`). This document is the plan. I have **not** mass-altered production tables — the reasons are in §3, and they matter.

---

## 1. Headline findings (read this first)

**Good news — the scalable architecture you asked for already exists.** You asked: *"If a dedicated multilingual translation architecture is better than separate language-specific tables, use that approach."* It is better, and it is **already built** in your database:

- **`record_translations`** — a central sidecar table keyed by `(record_table, record_id, field_name)`, storing `original_text`, `original_language_code`, `english_text / urdu_text / arabic_text / persian_text / pashto_text`, a `language_texts` JSONB, plus `source`, `translation_status`, `translated_by_engine`, and **`corrected_by / corrected_at`** (human-correction support). This is exactly the maintainable, scalable design — one table serves every module, no schema churn.
- **`resolve_record_translation_v2`** — an RPC that returns the right language on read (so no live translation at page load — matches your requirement).
- **`translation_generation_jobs`** — an async job queue table (for backfilling/regenerating translations without blocking saves).
- **`translation_audit_logs`**, **`translation_keys`**, **`translation_values`**, **`product_translations`** — supporting tables.
- Service layer: `lib/services/enterprise-multilingual-service.ts` (`writeRecordTranslation` → `record_translations`), `auto-translation-service.ts`, `multilingual-service.ts`.

So we do **not** need to add `name_ur/name_ar/...` columns to all 153 tables. A few tables did take the column approach (`country_company_profiles`, `warehouses`, `communication_templates`) — that's the less scalable pattern; the central `record_translations` table is the standard we should converge on.

**The catch — the "local translation engine" cannot actually translate arbitrary data.** This is the single most important thing to know. `multilingual-service.translateText()` is a **~200-term ERP dictionary** (Cash, Bank, Purchase, etc.) plus a word-by-word fallback. For any text **not** in that dictionary — i.e. almost all real business data: customer names, supplier names, narrations, addresses, product descriptions — it **returns the original text unchanged**. `auto-translation-service.ts` then stores that original English string into all five language fields.

Concretely: saving a customer named **"Muhammad Ali Traders"** today would store `"Muhammad Ali Traders"` as the Urdu, Arabic, Farsi, **and** Pashto value. That is not translation — it's the same English copied five times, marked `translated_by_engine: "local_dictionary"`, `translation_status: "complete"`. Rolling that across 153 tables would fill the database with **fake multilingual data** and give false confidence that the ERP is translated when it isn't.

---

## 2. The decision that unblocks everything (needs you)

"Automatically generate the other four languages on save" requires a real translation capability for free-form data. There are three honest options:

- **A. Integrate a real machine-translation engine** (e.g. a self-hosted model like LibreTranslate/NLLB on your VPS, or a cloud API). Best quality; genuinely fulfils "auto-generate all five." Trade-off: a cloud API is not "fully offline/local," and self-hosting a model needs server resources (GPU/CPU + RAM). This is the only option that actually delivers real translations of arbitrary text.
- **B. Keep it local but honest:** dictionary-translate known ERP terms, **transliterate** proper nouns (names) into each script rather than "translate" them, and **leave free-form narrations as entered**. No fake data, fully offline, but not every field is fully translated.
- **C. Queue for human/professional translation** of *master data only* via the existing `translation_generation_jobs` table, and don't auto-translate transactions at all.

My recommendation: **A for descriptive master fields + B's transliteration for names + never auto-translate financial narrations.** (See §4 for what should and shouldn't be translated.)

---

## 3. Why I did not mass-migrate production while you were away

You gave me authority to proceed, and I've done all the safe, high-value groundwork. But I deliberately did **not** run schema/data changes across all 153 tables, because:

1. **It depends on the §2 decision.** Without a real engine, a mass migration writes English-copied-5× into every record — actively harmful (DB bloat + false "translated" status that's hard to undo).
2. **Scale + irreversibility.** Backfilling translation rows for every text field of every existing record across 153 tables is a large, hard-to-cleanly-reverse data operation on your production DB. That shouldn't happen unsupervised on a flawed premise.
3. **The commit mechanism is currently blocked** (the `.git/index.lock` you need to clear), so code changes can't even be safely versioned/rolled back yet.

Doing the review and design *first* is the correct first step of an A-to-Z architectural mandate — and it's done.

---

## 4. What should and shouldn't be multilingual (critical for an accounting system)

**Translate / store 5 languages (descriptive, user-read):** category names, product names & descriptions, unit/brand/document-type/contract-type/account-type labels, warehouse/port names, status & enum display labels, settings labels, report titles, notification/template bodies.

**Transliterate, don't translate (proper nouns):** company names, person/customer/supplier/employee names, bank names, city/area names entered as free text. Translating these is usually wrong — "Muhammad Ali" should render in each script phonetically, not be "translated."

**Never auto-translate (leave exactly as entered):** financial narrations/remarks, voucher/reference numbers, codes, IDs/UUIDs, foreign keys, dates, and all numeric/amount fields. (This aligns with your "technical fields unchanged" list, and extends it: free-form accounting narration must not be machine-altered.)

---

## 5. Recommended architecture (converge on what exists)

1. **Single source of truth:** the `record_translations` sidecar for all new multilingual fields. Deprecate the per-column approach (`*_ur/_ar/...`) over time by mirroring those into `record_translations`.
2. **Write path:** on every Create/Update of a whitelisted field, call `writeRecordTranslation({ record_table, record_id, field_name, original_text, original_language })`. For fields marked "descriptive" → run the engine (§2A); for "proper noun" → transliteration; for "narration" → skip.
3. **Read path:** resolve via `resolve_record_translation_v2` (already exists) — no live translation at page load, exactly as required.
4. **Backfill:** enqueue existing records into `translation_generation_jobs`; a worker processes them in batches (off the request path). Never block a user save on translating.
5. **Correction UI:** expose `corrected_by/corrected_at` so a native speaker can fix any auto-translation — essential given machine limits.

---

## 6. Phased rollout (safe, verifiable, one module at a time)

- **Phase 0 (decision):** pick the §2 engine option. Nothing real ships until this is set.
- **Phase 1 (pilot, 1 module):** wire **Categories** or **Goods/Products** (pure descriptive master data, low risk) end-to-end: save → `record_translations`, read → resolver, plus a small backfill. Verify a native speaker sees correct text on language switch.
- **Phase 2:** remaining master data — Companies (descriptive fields only), Customers/Suppliers (transliterate names), Accounts, Units/Brands, Document/Contract/Account types, Warehouses/Ports.
- **Phase 3:** settings labels, report titles, statuses/enums.
- **Phase 4:** transactional descriptive fields **only where sensible** (never raw narration).
- **Each phase:** additive, reversible, committed separately, verified live before the next.

---

## 7. What I can do next without further input
- Wire the **Phase 1 pilot** (Categories or Products) against the existing `record_translations` service — additive and reversible — so you can see the full flow working, *if* you're comfortable with the pilot using the current local engine (which will transliterate/copy until §2A is chosen).
- Write the backfill worker that drains `translation_generation_jobs`.
- Produce the exact field whitelist per module (descriptive / proper-noun / skip) for your review.

**Blocking item for the full mandate:** the §2 engine decision. Everything else is ready to execute on top of infrastructure that, encouragingly, your team already built.

---

### Uncommitted code from prior slices (clear `.git/index.lock`, then commit)
`lib/i18n/ui.ts`, `lib/navigation/sidebar.ts`, `components/layout/dashboard-frame.tsx`, `features/roznamcha/components/cash-entry-form.tsx`, `app/api/erp/roznamcha/cash-summary/route.ts`, `app/api/erp/currency/daily-rate/route.ts`, `features/companies/components/company-registry.tsx`. (Scratch review files `outputs_*translations.json` should not be committed.)
