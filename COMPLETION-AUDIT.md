# DAMAAN ERP — Completion Audit & Production-Readiness Backlog

**Date:** 2026-08-06
**Purpose:** Turn the request "make the whole system production-ready" into a concrete, ranked, evidence-based backlog. Each item lists where it is in the code, why it matters, effort (S/M/L), and what (if anything) I need from you to execute it. Nothing here is changed yet — this is the map we execute slice by slice.

**How to read effort:** S = under ~1 hour, M = a few hours, L = a day+ / needs decisions.

---

## Theme A — Placeholders, demo & mock content (your item 6) — **do first**

These make the app show **fabricated data as if it were real**, which is the most damaging kind of incompleteness in an accounting system.

1. **Stock Reports API serves 14 fake records.** `app/api/erp/reports/stock-reports/route.ts` defines `MOCK_STOCK_REPORTS` (`po-mock-1` … `po-mock-14`) and merges them into live results — comment: *"Add mock records to have a beautiful pre-populated experience when the local database lacks records."* Real and fake rows are indistinguishable to the user. **Fix:** return only DB rows + a proper empty state. **(M)**
2. **Journal Report API injects mock journal rows.** `app/api/erp/reports/journal-report/route.ts` (`js-mock-1` …). Same pattern, same fix. **(M)**
3. **Accounts table shows seed rows.** `features/accounts/components/accounts-table.tsx` renders 3 hardcoded rows ("Seed rows shown until Supabase data is connected"). **Fix:** wire to the accounts API or remove the component. **(S)**
4. **Cash Entry demo array (dead code).** `features/roznamcha/components/cash-entry-form.tsx` still defines `recentTransactions` ("ABC Traders", etc.); now unused after the table rework — delete it. **(S)**
5. **Dashboard prints working credentials.** The "Experimental Setup: Test Accounts" card in `app/dashboard/page.tsx` shows login codes + `TestUser@1234`. Remove from production. **(S)**
6. **Unfinished report types.** `app/api/erp/reports/scoped/route.ts` returns `"Report type '…' not yet implemented"` for some types. Enumerate which and either implement or hide. **(M)**
7. **Duplicate design-only sidebar.** `components/layout/digital-dock-premium-sidebar.tsx` is a *"design-only reference (hardcoded English menu)"*. Confirm it's unused and delete to avoid confusion (the live menu is `lib/navigation/sidebar.ts`). **(S)**

---

## Theme B — Main menu names, grouping & appearance (your item 1) — **keep it on the left**

- **Source of truth:** `lib/navigation/sidebar.ts` (`sidebarTree`), rendered via `components/layout/dashboard-shell.tsx` → `premium-sidebar-nav.tsx`. Position stays exactly where it is; only labels/grouping/spacing change.
- **Work:** normalize label wording (consistent verb-noun, no double parentheticals like "Credit & Debit Entries (Cash Entry)"), tighten grouping into clear sections, polish spacing/active-state styling. **(M)**
- **Dependency:** labels should be translation-keyed (see Theme C) so renaming and translating happen once, not twice. Recommend doing B and the menu part of C together.

---

## Theme C — Translations / mixed languages (your item 3) — **large but mechanical**

Root cause of the mixed-language behavior you're seeing:

- **Hardcoded English in navigation/command palette.** `components/layout/dashboard-frame.tsx` search-registry titles are literal English ("Money Changer (Currency Exchange)", etc.), not `t(lang, …)`. `digital-dock-premium-sidebar.tsx` is explicitly a hardcoded-English menu.
- **Inline `lang === "ur" ? … : …` ternaries** scattered through components (e.g. the Cash Entry table) instead of central keys. Any language *not* covered by a ternary silently falls back to English — that's the "mixed language" symptom.
- **Central dictionary exists:** `lib/i18n/ui.ts` already holds en/ur/ar/fa/ps keys, so the infrastructure is there; the gap is coverage + consistent use.

**Work:** (1) inventory every hardcoded JSX string and every inline-ternary translation, (2) move them to `lib/i18n/ui.ts` keys, (3) fill missing keys across all 5 languages, (4) switch the nav to keyed labels. This is best done module-by-module. **(L — multi-slice)**

---

## Theme D — Backend / DB completeness (your item 4) — **needs per-module decisions**

- **`.gitkeep` stub markers** remain in many `features/*` and `app/api/erp/*` folders. Most now have real code, so `.gitkeep` alone ≠ empty — but a few look like genuine stubs (e.g. `app/api/erp/auth/profile` has no `route.ts`). **Action:** I'll produce a module-by-module matrix (table(s) ✓/✗, API ✓/✗, RLS ✓/✗, UI ✓/✗) so we can see the true gaps rather than guess. **(M to inventory; L to fill)**
- **What I need from you:** for each module that turns out to be a real gap, a one-line confirmation of intended behavior before I build tables/APIs — so I don't invent business rules for an accounting system.

---

## Theme E — File handling & storage (your item 5) — **concrete gap found**

- **Only the Documents module actually stores files.** Supabase Storage is used in exactly 4 files, all under `app/api/erp/documents/`.
- **Attachments elsewhere are cosmetic.** In `cash-entry-form.tsx`, the chosen `File` is only ever read as `attachmentFile.name` and saved as an `attachmentName` **string** (lines ~1751, ~3078) — **the file itself is never uploaded**. The same pattern very likely affects Expenses-Bill entry, WhatsApp media, and B/L documents.
- **Work:** route these attachments through the Documents storage (or a dedicated bucket) so files are actually persisted and retrievable, with links back to the transaction. **(M–L)** Backup functionality (your phrase) was previously provided by the deleted `database-cleanup`/backup routes — if you want a real backup feature, that's a separate design decision (**flag for discussion**).

---

## Theme F — General UI/UX polish (your item 2) — **ongoing, do after A–E stabilize**

- Replace blocking `alert()`/`confirm()` used for real UX (many files) with the app's toast/dialog components.
- 65 empty `catch {}` blocks (29 files) swallow errors silently — surface or log them.
- Consistency pass: spacing, empty states, loading states, button variants, dark-mode contrast.
- This is broad and best executed as a component-by-component sweep once the data-integrity items (A) and structure (B–E) are settled.

---

## Recommended execution order

1. **Theme A** (stop showing fake data) — highest risk, mostly S/M, no business decisions needed.
2. **Theme B + menu-part of C** (rename + translate the menu together) — visible, bounded.
3. **Theme D inventory** (the module matrix) — turns item 4 from vague to concrete; you steer.
4. **Theme E** (make attachments real) — concrete, valuable.
5. **Theme C full** (system-wide translation coverage) — large, mechanical, multi-slice.
6. **Theme F** (polish pass) — continuous.

## What I need from you to keep moving
- For **Theme A**, no input needed — I can start removing mock/seed/demo data immediately.
- For **Theme D/E**, per-module confirmation of intended behavior before I build new tables/APIs or storage flows.
- Everything ships as reviewable commits (still pending the `.git/index.lock` you need to clear once).

---

### Still-uncommitted work from prior slices (clear the lock, then commit)
`features/roznamcha/components/cash-entry-form.tsx`, `app/api/erp/roznamcha/cash-summary/route.ts`, `app/api/erp/currency/daily-rate/route.ts`, `features/companies/components/company-registry.tsx`.
