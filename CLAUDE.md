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

### Component pattern (copy this)
```tsx
const activeLang = useActiveLanguage() || lang;
const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);
const tt = (key: string, fallback: string) => t(activeLang, key as never, fallback);
// ...
<h1>{tt("module.title", "My Screen")}</h1>
<th>{tt("module.col_amount", "Amount")}</th>
```
Reuse existing keys where one already fits; otherwise add a new canonical key (namespaced by module,
e.g. `bankroz.*`, `nav.*`) to `lib/i18n/ui.ts` in all five languages.

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
`docs/multilingual-architecture.md`, `docs/LOCALIZATION_5_LANGUAGE_SPEC.md`.
