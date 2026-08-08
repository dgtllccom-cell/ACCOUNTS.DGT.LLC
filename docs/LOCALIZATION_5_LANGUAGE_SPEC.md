# Complete 5-Language Localization — Consolidated Specification
**Project:** Damaan Business Group ERP (Digital Dock ERP)
**Languages (all mandatory):** English (`en`), Urdu (`ur`), Arabic (`ar`), Pashto (`ps`), Persian/Farsi (`fa`)

> This document consolidates **two related but distinct localization tracks** into one permanent specification:
> - **Part A — Data localization** (record *content* stored per language) — *largely implemented, see status.*
> - **Part B — UI localization** (every user-facing *string* in every screen, form, modal, wizard) — *the main outstanding requirement.*
>
> The goal is **one global, permanent 5-language solution for the entire ERP** — fixed at the architecture level, not screen-by-screen.

---

## PART A — DATA LOCALIZATION (per-language tables)

**Requirement:** Every data record (all tables **except** `users` and branch tables) must be translated into all 5 languages on entry and stored in **separate per-language tables**. A local translator translates each record into every language automatically at save time.

**Implementation status: ✅ DONE on DEV + local Postgres (PROD backfill pending).**
- Five per-language tables created: `translations_english`, `translations_urdu`, `translations_arabic`, `translations_persian`, `translations_pashto`.
- `record_translations` kept as a compatibility **view** over the five tables (so existing read/write code is unchanged), with `INSTEAD OF` triggers.
- `upsert_record_translation()` RPC rewritten to fan out into all five tables on every save.
- Local translation engine: `autoTranslate5Languages()` in `lib/i18n/multilingual-translator.ts`.
- Migration: `supabase/migrations/20260814_per_language_tables.sql`.

**Outstanding for Part A:** apply the migration + backfill to PRODUCTION (~706k existing rows); replace the placeholder `SUPABASE_SERVICE_ROLE_KEY` (currently a publishable key) with the real `sb_secret_…` service-role key so admin reads/writes bypass RLS correctly.

---

## PART B — UI LOCALIZATION (OUTSTANDING — primary requirement)

**Problem:** When Urdu (`ur`) is selected, large parts of the Dashboard and **every form opened from the Dashboard/Menu** still render in English. A single screen must **never** be a mixture of Urdu and English.

**Examples of currently-untranslated text (illustrative only — NOT an exhaustive list):**
> Dashboard, Employees, General Office Management, Register New Employee, Register New Employee Master Record, Enterprise Employee Registration Wizard, Step 1 Packet, Employee Category & Person Selection, Select Employee Category, Manager, Normal Staff, Employee, Others, Search Employee / Person Name, Add New Person Master, Department, Designation / Position, Save & Finalize Employee, Next Step, Cancel, All Statuses, All Categories, Office Modules, Employee Management, Departments, Designations, Attendance, Leave Management, Payroll / Salary, Office Assets, Office Documents, Employee ID Cards, Employee Reports — and many other labels, placeholders, dropdown options, and messages.

**Do not fix only these words. Scan the entire application.**

**Current partial progress (for the developer's reference):**
- A UI dictionary exists: `lib/i18n/ui.ts` with `t(lang, key, default)`.
- Active language hook: `lib/i18n/use-active-language.ts` (`useActiveLanguage()`), backed by `localStorage["erp_lang"]` + `document.documentElement.lang` + the `erp_language_changed` window event.
- Table **column headers** are now translated globally via `<Th>` (`components/ui/translated-th.tsx`) + `lib/i18n/table-headers.ts` (all 116 table components wired).
- **The gap:** forms, modals, wizards, menus, tabs, field labels, placeholders, dropdown options, buttons, validation/success/error messages, empty states, and dynamically-mounted screens are **not** yet globally localized. Many components hard-code English.

---

### B.1 — Every New/Create/Entry Form Must Be Fully Translated

Applies to **every screen opened through:** New, Add New, Create, Register, Entry, Edit, View, Actions, dropdown menus, submenus, and popup/modal buttons.

When the language is Urdu, clicking **New Employee** (and the equivalent in **every** module) must open a **completely Urdu** form, including:
- Modal title, wizard title, step names, tabs
- Category names, field labels, placeholders
- Dropdown options
- Buttons (Cancel / Next / Save, etc.)
- Validation messages
- Preview/summary sections
- Success and error messages

The same behavior applies to **every New Entry form in every ERP module**, not only Employee Management.

### B.2 — Mandatory 5-Language Translation Structure

Every user-facing string must be **one translation key with all five language values**. A key is **not complete** unless all five values exist.

```
employee.register
  en: Register New Employee
  ur: نیا ملازم رجسٹر کریں
  ar: تسجيل موظف جديد
  ps: نوی کارکوونکی ثبت کړئ
  fa: ثبت کارمند جدید
```

### B.3 — No Hard-Coded English

Do **not** place literal UI text (e.g. `"Register New Employee"`, `"Next Step"`, `"Cancel"`, `"Department"`, `"No Records Found"`) directly in components. All user-facing strings must come from the centralized 5-language dictionary, resolved by the currently-selected language.

**Also add a validation/audit mechanism** that detects (a) missing translation keys and (b) missing language values for any key. It should run in CI and/or as a dev script and fail/report when any key lacks all five languages.

### B.4 — Language Must Propagate to Dynamically-Opened Components

Language selection must be **global application state** (single source of truth) and every component must react to language changes **immediately**.

A child component — modal, wizard, dropdown, nested component, popup, report, portal-mounted element, or a newly navigated page — **must not** fall back to English just because it was opened dynamically. It must read the same global language and re-render on change.

### B.5 — Urdu Font and RTL

- Use proper **RTL layout** throughout for Urdu (and Arabic, Persian, Pashto).
- Use **Jameel Noori Nastaleeq** (or the project's available equivalent Nastaleeq font) for Urdu.
- Menu names, form titles, modal headings, buttons, and key labels should be **slightly heavier/bolder** and clearly readable while keeping proper Nastaleeq appearance.

---

## REQUIRED ARCHITECTURE (fix globally, not screen-by-screen)

1. **Single global language store** (React Context / app-level state) as the one source of truth, initialized from `erp_lang`, reactive to changes, and consumed by **all** components including dynamically-mounted ones (modals/wizards/portals).
2. **One centralized message catalog** keyed by string, each key carrying all five language values. Every user-facing string routes through `t(key)` — zero hard-coded English in components.
3. **Automated coverage audit**: a script/CI check that scans components for hard-coded user-facing text and reports any key missing one or more of the five languages.
4. **Direction + typography layer**: automatic `dir="rtl"` and Nastaleeq font for `ur` (and RTL for `ar`/`fa`/`ps`), applied at the layout root so every child inherits it.
5. **Reuse the existing infrastructure** (`t()`, `useActiveLanguage()`, `table-headers.ts`, `<Th>`) rather than inventing parallel systems; unify everything under the single global store above.

---

## FINAL ACCEPTANCE TEST

Select **Urdu**, then walk the ERP end-to-end:

`Dashboard → Menu → Submenu → New → Form → Dropdown → Modal → Wizard Steps → Save → Validation/Success Message → Reports`

**Everything must remain Urdu — no mixed languages on any screen.**

Then repeat the **complete** test for **Arabic, Pashto, Persian, and English**.

**Acceptance rule:** If Urdu is selected and **even ONE** user-facing English word remains anywhere — including inside a New Entry form, dropdown, placeholder, or validation message — the Urdu localization is **NOT complete**.

This must be delivered as **one permanent 5-language localization solution for the entire ERP.**
