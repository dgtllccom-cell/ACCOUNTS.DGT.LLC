# Central ERP Translation Engine (EN / UR / AR / FA / PS)

Date: 2026-08-30. Commits `7006e55` → `fbbc915`.

The ERP no longer depends on Google Translate for day-to-day translation. One
engine now serves DGT Connect, forms, reports, Print/PDF and future modules.

## Resolution priority (highest first)

1. **Local APPROVED translation memory** — human-verified, per phrase (`status='approved'`)
2. **Curated ERP glossary** — `lib/i18n/erp-glossary.ts`, business terminology
3. **Local MACHINE translation memory** — previously produced, reusable (`status='machine'`)
4. **Local phrase / contextual engine** — greedy longest-match glossary substitution
   over the whole sentence (`glossaryPhraseSubstitute`) + the existing 241-entry
   `MULTILINGUAL_DICTIONARY` + transliteration for residual proper nouns
5. **External MT (Google)** — last-resort fallback, only when the local engine
   left English behind; **the result is learned back into the memory**

The engine picks whichever local rendering has the least leftover English and
**never caches a transliteration** as a "machine" translation.

## Pieces

| File / object | Role |
|---|---|
| `supabase/migrations/20261013_erp_translation_memory.sql` | `erp_translation_memory` (phrase-level, `source_lang` + normalised key → en/ur/ar/fa/ps, domain, status, hits) + `erp_translation_memory_audit` |
| `lib/i18n/erp-glossary.ts` | ~115 curated ERP terms across accounting / shipping / clearing / banking / tax / hr / crm / purchase / sales / inventory / general, with source-side variants (PO, DR/CR, روزنامچہ, …) |
| `lib/i18n/erp-translator.ts` | `translateErp` / `translateErpAll` (one or all 5), `approveErpTranslation` (learn), `erpTranslationStats`, `normalizeForMatch` |
| `app/api/erp/i18n/translate` (+ `/approve`, `/stats`) | the single endpoint every client form / module calls |
| `lib/dgt-connect/translate.ts` | DGT Connect message translation now goes through `translateErp` |
| `scripts/seed-erp-translation-memory.mts` | seeds the memory from glossary + dictionary (idempotent; `--target=prod` supported); also run by the VPS deploy |

## The original text is never mutated

`translateErp` returns a *view*. Callers store `original` + `originalLang` and
render the translated string separately (DGT Connect: `dgt_messages.body` +
`body_lang` are immutable; a per-language cache lives in
`dgt_message_translations`). Same contract for records / reports.

## Verified (Local / DEV)

`scratch/erp-translator-verify.mts` **13/0** · `scratch/erp-translator-phrase.mts` **5/0**

- `Roznamcha`→ur = روزنامچہ · `DR/CR`→ar = مدين / دائن · `Ledger`→ps = لیجر
- `Ledger Settlement`→ur = لیجر تصفیہ
- `Bank Transfer and Cheque Settlement`→fa = انتقال بانکی و چک تسویه
- `Shipping and Clearing charges for Container`→ar = الشحن و رسوم التخليص لأجل حاوية
- `Please confirm Journal Ledger posting and Bank Settlement today`
  - ur: براہ کرم تصدیق کریں جرنل لیجر پوسٹنگ اور بینک تصفیہ آج
  - ar: من فضلك تأكيد دفتر اليومية دفتر الأستاذ ترحيل و بنك التسوية اليوم
- **Learning**: `approveErpTranslation` → the phrase is then served from memory
  (engine `approved`) in every language, forever, with no external call.

Memory on DEV: **314 rows** (115 glossary/approved). Google API key **not
required** — it is purely a quality-support fallback.

## Not done

- Prod: migration `20261013` + the translation-engine code are **not deployed**
  yet (see `dgt-connect-status.md` deploy blocker).
- A UI screen to review/approve `draft`/`machine` memory rows (the API exists).
