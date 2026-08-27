# Digital Dock ERP — Engineering Standards

## MANDATORY: 5-language UI (EN / UR / PS / FA / AR) — no exceptions

Every user-visible string in **any** new or edited UI (forms, reports, Shipping/Clearing,
Purchase, Ledger/Roznamcha, dashboards, widgets, tables, buttons, modals, print templates,
PDF/Excel export headings, toasts, validation/empty/loading/error states) MUST render through the
central i18n dictionary in all five languages **from the start**. Do not ship English-only UI and
"internationalize it later".

### The single source of truth
- Dictionary: **`lib/i18n/ui.ts`** — one `UiKey` union + five `Dict` blocks (`en`, `ur`, `ar`, `fa`, `ps`),
  each `Record<UiKey, string>`. Add a key to the `UiKey` union **and** give it a value in **all five**
  blocks. Never create a per-module/parallel translation object.
- Lookup: `t(lang, "some.key", "English fallback")` — resolves `dictionaries[lang][key] ?? en[key] ?? fallback ?? key`.
- Active language (client): **`useActiveLanguage()`** (`lib/i18n/use-active-language.ts`). It is the reactive
  source of truth (localStorage `erp_lang`, `en` during SSR — no hydration mismatch). **Prefer it over any
  server-threaded `lang` prop.** If a component receives a `lang` prop, reconcile:
  `const lang = activeLang !== "en" ? activeLang : langProp;` (see `components/layout/dashboard-frame.tsx`).

### Component pattern — use `useErpScreen()` (copy this)
```tsx
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

const s = useErpScreen("module", lang);   // namespace + optional server lang prop
// ...
<section dir={s.dir}>
  <h1>{s.t("title", "My Screen")}</h1>
  <th className={s.textStart}>{s.t("col_amount", "Amount")}</th>
  {rows.length === 0 && <p>{s.t("empty", "No records found.")}</p>}
</section>
```
`useErpScreen` packages the active language (cookie / `localStorage erp_lang` / `<html lang>`),
the `lang`-prop reconciliation, `dir`, `isRtl`, `textStart`/`textEnd`, and a namespaced `t()`.
The raw pattern (`useActiveLanguage()` + hand-rolled `tt`) still works and is equivalent —
`useErpScreen` is just the shorthand. Full reference component:
**`components/i18n/five-language-reference-card.tsx`**.

Reuse existing keys where one already fits; otherwise add a new canonical key (namespaced by module,
e.g. `bankroz.*`, `nav.*`) to `lib/i18n/ui.ts` in all five language blocks.

### Automatic guard — runs on every commit, build and CI
`scripts/i18n-ui-guard.mjs` (`npm run i18n:guard`) fails the build/commit on: parity gap,
duplicate key, referenced-but-missing key, silent English (non-en value === en), or a **new**
per-module `{en,ur,ar,fa,ps}` dictionary. It is wired as `prebuild`, a `.githooks/pre-commit`
hook (`npm install` / `npm run prepare` enables it), and `.github/workflows/i18n-guard.yml`.
`npm run i18n:guard:changed` additionally flags new hard-coded English in changed files.
DB side: `npm run i18n:scan` guards `translation_field_registry` (new translatable columns).

### Checklist — every new page / form / module / report / modal / export
1. Central keys added in `lib/i18n/ui.ts` — **all five** blocks (`npm run i18n:guard` green).
2. No visible hard-coded English (`npm run i18n:guard:changed` green).
3. RTL/LTR verified — whole screen flips EN↔UR/AR/FA/PS.
4. Language persists across refresh + navigation.
5. Print / PDF / Excel / CSV output in the selected language (see `docs/universal-print-pdf-requirements.md`).
6. New translatable DB free-text fields registered (`npm run i18n:scan` green).
7. `npx tsc --noEmit` and `npm run build` both exit 0.

### RTL
UR/AR/FA/PS are RTL. Use logical CSS (`ms-*`/`me-*`, `ps-*`/`pe-*`, `text-start`/`text-end`), and set
`dir={isRtl ? "rtl" : "ltr"}` on print/PDF HTML (`document.documentElement.dir` is already set app-wide).

### What is NOT translated
Actual business data and user-entered values: names, codes, account/cheque/serial numbers, currencies,
amounts, dates. Translate **labels/chrome**, not data.

### Definition of done for any UI change
Build green is necessary but NOT sufficient. Switch EN→UR→PS→FA→AR and confirm the whole screen
(menu, title, cards, filters, table headers, statuses, modals, print/export) follows the language with
correct RTL — no half-English screen.

## Reference docs
`docs/multilingual-architecture.md`, `docs/LOCALIZATION_5_LANGUAGE_SPEC.md`,
`docs/universal-print-pdf-requirements.md`.
