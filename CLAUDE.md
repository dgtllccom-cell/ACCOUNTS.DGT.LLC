# Digital Dock ERP — Engineering Standards

## MANDATORY DATABASE POLICY: PRODUCTION VS TESTING
1. **Production / Original Database (`ACCOUNTS.DGT.LLC - Production` / `inmayhrxucimxqhgseqi`)**:
   - Real business database.
   - Do NOT add: fake data, demo data, duplicate customers, duplicate accounts, test transactions, test purchases/sales, temporary users, trial stock entries.
   - Never use Production for testing.
2. **Testing / Local Database (`dgtllccom-cell's Project` / `csesvyxxjivnkkozgopt`)**:
   - Use this database for: development testing, sample transactions, UI testing, workflow testing, temporary users, test purchases/sales, test stock, migration verification.
3. **Deployment**: Production deployment may include verified code and reviewed migrations only. Test/demo business records must NEVER be copied to Production.
4. **Verification**: Before any database write or migration, confirm which Supabase project / `DATABASE_URL` is connected.
5. **Protection**: Never reset, truncate, seed, or clean the Production database without explicit owner approval.

## MANDATORY: Release workflow — every developer, every session (owner rule, 2026-11-22)
Full owner text and rationale: `docs/release-workflow.md`. The owner has authorized development, testing, PRs, merging and
deployment *preparation*; do not ask for that again. Ask the owner only for an owner-only step (the VPS release, a new financial
posting decision, a mandatory security approval), and then for exactly that.

**Flow:** feature branch → commit + push → PR into `main` → all CI green → merge → separate PR `main` → `production` → CI green
on the combined code → merge → one VPS command block for the owner → owner runs it → verify Live → screenshots + final report.
- Never push directly to `main` or `production`; never force-push, reset, delete branches or overwrite others' work.
- Before merging/deploying: fetch the latest `main` / `production` heads, review commits other developers added during the
  session (e.g. a direct push to `production` must be brought back into `main` by PR), resolve conflicts keeping both sides'
  intent, and run CI on the final combined code.
- Before a release: CI passed on the exact production tip; no unreviewed migrations (`supabase/migrations` diff vs live); no
  deployment running; no other pending approval. **One deployment at a time — never run `dgt-approve-deploy` / `dgt-deploy` /
  `deploy-via-gate.*` while someone else is deploying, and never replace another person's approval** (the gate now refuses both:
  `scripts/production/dgt-approve-deploy.sh`, `--replace` only on purpose).
- Only the authorized gate deploys (`dgt-approve-deploy <sha>` → `dgt-deploy`, or `scripts/production/deploy-via-gate.sh`). Never
  bypass it, the build guard or the ref lock. Agents without owner SSH prepare the release; the owner runs it.
- **The owner's VPS command block** is ONE paste-ready block with the exact, freshly verified production SHA (never a reused one),
  that stops safely on any failed prerequisite: no deploy/build running → show gate log → confirm `origin/production` = SHA →
  (re)install the gate from that SHA if `scripts/production/` changed → approve → `dgt-deploy --dry-run` → `dgt-deploy` detached
  (`setsid nohup`, backup first) → wait for `DEPLOYED <sha>` → print live HEAD + `pm2 ls`. Never give partial commands or make the
  owner guess a SHA.
- **Testing:** `npx tsc --noEmit`, `npm run build`, CI, `npm run i18n:guard`, `npm run stock:guard`; purchase/sales, ledger/
  Roznamcha, payments/FX, loading/stock on the TESTING DB only; Production checks read-only; no real financial postings for tests.
- **Never claim "Live"** from a merge or a green build: verify the gate log (`DEPLOYED <sha>`), live HEAD, backup readable
  (`pg_restore --list`), PM2 online, `https://api.dgt.llc` 200, critical workflows, 5 languages + mobile, with real screenshots.
- Protect Production data always: bills, parties/accounts, ledger/Roznamcha, payments, stock, loading, companies/branches,
  users/permissions. No deletes, no duplicate postings.
- **End of every session**, report: Development status · `main` SHA · `production` SHA · CI status · Production deployment ·
  Database backup · Live ERP status · Screenshots · Required owner action (exact, only if genuinely necessary).

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
0. Add the key with its **English** value; run `npm run i18n:autofill` (or just
   commit — the pre-commit hook does it) to auto-generate UR/AR/FA/PS. Review
   `lib/i18n/ui.autofill-provenance.json`; hand-fix anything left in `unresolved`.
   See `docs/auto-i18n-engine.md`.
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

## STOCK JOURNAL — ONE canonical implementation (do not restore or fork older copies)
`/dashboard/purchase/stock/*` (Purchase Booking & Local Purchase → Loading → Receiving & Customs → Confirm Stock → Sale / Export) is ONE
implementation, documented in `docs/stock-journal.md`:
- service `lib/services/stock-journal-service.ts` + pure model `lib/stock-journal/model.ts` (`parseJsonish` reads string-encoded `form_data`);
- routes `app/api/erp/inventory/journal-stock/{route,confirm,issue,reverse,customs,history}`; the old `/transfer` route is deleted for good;
- screen `features/journal/components/journal-booking-stock-dashboard.tsx` (i18n namespace `sj.*`, all five languages);
- ledger table `journal_stock_transfers` (migration 20261235). Physical stock stays in `product_inventory_balances` + `stock_movements`;
  never add a parallel stock path. Stock leaves ONLY through Goods Issue / Dispatch / Delivery (`issueStock` / `issueForSalesOrder`).
- Before merging anything that touches these files run `npm run stock:guard` (also in prebuild, pre-commit and CI). If a merge conflict
  appears in them, keep THIS implementation; port any wanted idea into it instead of reverting.

## Reference docs
`docs/multilingual-architecture.md`, `docs/LOCALIZATION_5_LANGUAGE_SPEC.md`,
`docs/universal-print-pdf-requirements.md`, `docs/i18n-guard.md`.
