# ERP Auto-i18n Engine — five languages by default

**Permanent requirement.** Whenever a new form, page, module, report, field,
button or document adds an English string, the ERP generates and stores its
**UR / AR / FA / PS** renderings automatically — nobody picks a language, nobody
hand-translates the common cases. Numbers, IDs, reference codes, currencies,
`{placeholders}`, dates, URLs and e-mails are **never** translated.

This is not a new translator. It is a thin, safe layer over the engine the ERP
already has.

## The pieces (all pre-existing, now wired end-to-end)

| Layer | File | Role |
|---|---|---|
| Approved translation memory | `erp_translation_memory` (DB) + `translateErp()` | human-verified phrases — always win |
| Curated ERP glossary | `lib/i18n/erp-glossary.ts` | business terminology, rendered identically everywhere |
| Machine memory | `erp_translation_memory` (status `machine`) | previously produced, reused |
| Local phrase engine | `lib/i18n/multilingual-translator.ts` | offline dictionary substitution + transliteration |
| AI tier *(optional)* | `lib/i18n/ai-translation-client.ts` | Anthropic / OpenAI / Gemini — free-text gaps only, never overrides approved/glossary |
| External MT *(optional)* | `lib/i18n/machine-translation-client.ts` | Google — last resort, result learned back |
| **Auto-i18n engine** | **`lib/i18n/auto-i18n.ts`** | protected-token masking + acceptance gate + provenance over the pipeline above |
| **UI autofill** | **`scripts/i18n-autofill.mts`** | closes PARITY / silent-English gaps in `lib/i18n/ui.ts` |

## `lib/i18n/auto-i18n.ts`

```ts
generateFiveLanguages(english, opts?) → { en, ur, ar, fa, ps, provenance, unresolved }
generateForMany(englishValues[], opts?) → Map<english, result>   // de-duplicated
```

Guarantees:

- **Protected tokens survive verbatim.** `{count}`, `${x}`, `%s`, `TB-000123`,
  `USD 1,000`, `2026-09-09`, urls, e-mails are masked, the frame is translated,
  the tokens are restored unchanged.
- **Never fabricates.** A target the pipeline cannot render *cleanly* (residual
  English, dropped placeholder, below the confidence gate, or — offline — a
  sentence longer than two words with no curated whole-phrase hit) is returned
  as the English source and listed in `unresolved`. The guard still flags it.
- **Provenance.** Every accepted rendering records `{ engine, confidence }` so a
  reviewer can promote a machine result to approved memory.

## `scripts/i18n-autofill.mts`  (`npm run i18n:autofill`)

Scans `lib/i18n/ui.ts`, finds every key that is missing a language or silently
equal to English (minus the acronym/brand allowlist, kept byte-identical to the
guard), translates the distinct English strings once, writes the accepted
renderings back **below the `...en` spread** in each block, appends provenance to
`lib/i18n/ui.autofill-provenance.json`, and writes the gap matrix to
`docs/i18n-gap-matrix.md`.

| Command | Use |
|---|---|
| `npm run i18n:gap-matrix` | report only, write nothing (`--dry`) |
| `npm run i18n:autofill` | deterministic tiers (glossary + local + approved memory) |
| `npm run i18n:autofill:online` | also AI tier + Google MT (needs keys / network) |
| `npm run i18n:autofill -- --staged` | only keys touched in the staged `ui.ts` diff (used by the pre-commit hook) |

### Automatic wiring

- **Pre-commit hook** (`.githooks/pre-commit`): if `lib/i18n/ui.ts` is staged it
  runs `i18n-autofill --staged` and re-stages the file, then the i18n guard runs.
  A new English-only key becomes five languages on commit.
- **Guard hint**: `i18n-ui-guard` now points at `npm run i18n:autofill` when it
  finds parity / silent-English gaps.

## Turning on full automatic coverage

Offline, the engine only auto-fills terms and phrases it has curated entries for
(≈ ERP vocabulary). For **arbitrary** new English at professional quality, set on
the build machine / CI / VPS:

```
AI_TRANSLATE_PROVIDER = anthropic          # or openai | gemini
AI_TRANSLATE_API_KEY  = <key>
AI_TRANSLATE_MODEL    = claude-haiku-4-5-20251001   # optional override
```

With this set, `i18n:autofill:online` (and the pipeline everywhere) closes almost
every gap automatically, still constrained by the approved glossary and the
never-translate-a-code rule.

## What this does NOT change

- The i18n guard still fails the build on an unresolved gap — quality stays gated.
- Approved terminology is never overwritten by a machine tier.
- Business data (names, codes, amounts, narration) is out of scope here — that is
  the `record_translations` contract (`docs/multilingual-architecture.md`,
  `scripts/multilingual-contract-guard.mjs`).
