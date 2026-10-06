# Automatic five-language guard

The ERP must stay fully translated (EN / UR / PS / FA / AR) as it grows. Two
committed guards enforce that on every commit, build and CI run.

## 1. UI dictionary guard — `scripts/i18n-ui-guard.mjs`

`npm run i18n:guard`

| Check | Fails the build/commit when… |
|---|---|
| **PARITY** | a key is not present in all five `lib/i18n/ui.ts` blocks (`en/ur/ar/fa/ps`) |
| **DUPLICATES** | a key is defined twice inside one block |
| **MISSING** | code references `t(lang, "ns.key")` / `tt("ns.key")` for a key absent from `ui.ts` |
| **FALLBACK** | a non-English value is byte-identical to English (silent English), excluding an acronym/brand allowlist |
| **PARALLEL** | a **new** per-module `{ en, ur, ar, fa, ps }` object appears outside `lib/i18n/` |

Non-blocking **warnings**:

| Warning | Meaning |
|---|---|
| **MISUSE** | `t(lang, "Some English Text")` — the English text is being used *as the key*, so it renders the same in every language. Fix: `t(lang, "ns.key", "Some English Text")`. |

`--changed[=REF]` additionally scans files changed vs `REF` (default `origin/main`)
for **new hard-coded English** strings and fails if any are found.

`--json` prints a machine-readable summary. `--quiet` prints only failures.

### Where it runs

- **`prebuild`** — `npm run build` runs the full guard first; a failing guard fails the build.
- **`.githooks/pre-commit`** — runs `--changed`; `npm install` (or `npm run prepare`) points
  `core.hooksPath` at `.githooks/`. Bypass a single commit with `git commit --no-verify`.
- **`.github/workflows/i18n-guard.yml`** — full guard + PR-diff hard-coded check + `tsc --noEmit`.

### Grandfathered exceptions

`KNOWN_PARALLEL` in the script lists pre-existing parallel dictionaries that are tracked
tech-debt (migrate them into `ui.ts`, then remove from the set). New ones are always blocked.
`PARALLEL_ALLOW` lists false positives (language-code maps, DB column maps, empty
multilingual record-field shapes).

## 2. Database field guard — `scripts/i18n-scan.mjs`

`npm run i18n:scan` (needs `DATABASE_URL`)

Scans the live schema for user-facing free-text columns and fails if an **eligible column
is not registered** in `translation_field_registry`. `--fix` registers the missing fields
and attaches the enrollment trigger. This is the guard that stops a new table/field
shipping without multilingual support.

## Author pattern

Every screen uses one hook — see `CLAUDE.md` and
`components/i18n/five-language-reference-card.tsx`:

```tsx
const s = useErpScreen("module", lang);
<section dir={s.dir}>
  <h1>{s.t("title", "My Screen")}</h1>
  <th className={s.textStart}>{s.t("col_amount", "Amount")}</th>
</section>
```

Add every new key to `lib/i18n/ui.ts` in **all five** blocks. Never build a `{en,ur,…}`
object in a component. Business identifiers (invoice / BL / container numbers, account
codes, serials, currency codes, legal names) are **not** translated.
