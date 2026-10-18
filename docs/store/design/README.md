# DGT.llc B / DGT.llc BS — mobile UI/UX design set

Status 2026-10-18 · DEV/docs only · **designs are for owner review — nothing is integrated into the apps yet.**
Figma: the Figma connector is **not connected** in our sessions (see "Figma import plan"), so the deliverables are repo files that import into Figma
in minutes. Nothing was published, deployed or changed in Production.

## 1. What is in this folder
| File | What it is |
|---|---|
| **`mockups.html`** | All screens, both apps. Toolbar: **App** (B / BS) · **Device** (Phone 390 · Phone 360 · Tablet 820) · **Language** (EN, اردو, العربية, فارسی, پښتو — full RTL) · **View** (full length / device frame) · **Theme** (light / dark). Deep link: `mockups.html?app=bs&device=tablet&lang=ur&mode=night&view=full`. |
| **`components.html`** | Component inventory (20 groups, same toolbar). Names follow the Figma naming below. |
| `tokens.json` | Design tokens (colours incl. day/soft/green/night + per-app, type scale, spacing, radii, sizes, breakpoints, elevation incl. **3D-style** recipes, motion, layout, RTL rules). Source of truth. |
| `tokens.css`, `design.css`, `design-lib.js` | Generated tokens / hand-authored component CSS / renderer used by the two HTML pages. |
| `strings.json` | Every label used (212) with EN/UR/AR/FA/PS and its ERP source key — usable as Figma text variables. |
| `previews/*.png` | 25 static previews (dashboards first) for quick review without a browser. |
| Build / checks | `node scripts/build-design-mockups.mjs` (fails on a missing route or a label without a real translation) · `node scripts/check-design-mockups.mjs` (120/120: every app × device × language × page renders, no missing translation, no horizontal overflow, RTL `dir` correct) · `node scripts/make-design-previews.mjs`. |

**Content rules followed.** Routes are real ERP routes (checked against `app/**/page.tsx`). Labels/translations are the ERP's own (`lib/i18n/ui.ts`, header translations,
login translations) — **no invented wording, no half-English RTL screen**. Values are placeholders (`#,###` and grey bars); the only decorative "data" is the
placeholder bar chart (caption `#,###`). No new modules and no changed workflows (changes needed are listed in §7 as flags, not applied).

## 2. Visual language (from the real ERP theme — no new brand)
* **Colours:** ERP theme modes `day` (default) / `soft` / `green` / `night` (`app/globals.css`). **B** uses the ERP's `.theme-blue` primary (matches the B icon and login CTA);
  **BS** uses `.theme-cyan` (matches the BS icon's teal wave). Status colours = the Tailwind palette the ERP already uses for badges. Dark = `night` / `.dark.theme-*`.
* **Type:** Inter (Latin) · Noto Sans Arabic (UR/AR/FA/PS; the ERP also overrides Cairo for AR, Vazirmatn for FA, Noto Naskh for UR/PS). Arabic-script line-height 1.65.
* **3D-style elements** (all CSS/SVG, no images; disabled motion under `prefers-reduced-motion`): *KPI tile* with a light top edge, a tinted base edge and a tinted drop shadow;
  *gem* icon chips (inner highlight + base shade); *hero* banners with isometric SVG art (ledger, ship, containers, bars); *3D bar chart*; *3D primary button*.
  Elevation tokens `elevation.3d-*` in `tokens.json`.
* **Touch:** 48 px minimum targets; 16 px phone / 24 px tablet gutters; safe-area aware.

## 3. Screen map (IDs match the figures in `mockups.html`)
| Group | IDs | Real routes (content source) | App |
|---|---|---|---|
| 1 Login & device | A1 splash · A2 device request · A3 pending · A4 enter code · A5 login · A6 wrong-app · A7 admin approves phones | `/auth/device`, `/auth/login`, `/auth/app-access`, `/dashboard/super-admin/mobile-devices` | both |
| 2 Dashboards | D1 Business (Super Admin) · D2 Country/Branch · D3 Shipping home · D4 Clearing Agent · D5 Logistics | `/dashboard/super-admin`, `/dashboard/country`, `/dashboard/city`, `/dashboard/shipping-line`, `/dashboard/clearing-agent`, `/dashboard/logistics` | B: D1–D2 · BS: D3–D5 |
| 3 Navigation | N1 B Super Admin drawer · N2 B Accountant · N3 BS Super Admin · N4 BS Agent · N5 More tab | real sidebar `components/layout/digital-dock-premium-sidebar.tsx` (`DAMAN_SIDEBAR_ITEMS`, role + domain filtering) | N1–N2 B · N3–N4 BS · N5 both |
| 4 Business modules | M1 purchase register · M2 new purchase booking · M3 purchase payments · M4 new sales booking · M5 confirmed sales · M6 confirmed stock | `/dashboard/purchase/purchase-booking-journal-report`, `…/new-purchase-booking-order`, `…/purchase-payments`, `/dashboard/sales/new-sales-booking-order`, `…/sales-confirm`, `/dashboard/purchase/stock/confirmed` | B |
| 5 Shipping | S1 customer orders · S2 new order · S3 tracking list (+ tablet master-detail) · S4 shipment detail · S5 BL entry · S6 clearing workspace · S7 agents · S8 trucks · S9 bills | `/dashboard/clearing-agent/*`, `/dashboard/shipping-line/{tracking,shipment-details,bl-entry}` | BS (S1–S2 also B for domain "both") |
| 6 Accounts & reports | R1 detailed ledger · R2 outstanding · R3 Roznamcha cash entry · R4 reports hub · R5 report preview | `/dashboard/ledger/{detailed,outstanding}`, `/dashboard/roznamcha/cash-entry`, `/dashboard/reports` | both |
| 7 Notifications & tasks | T1 Transfer & Handover Center · T2 Smart Operations · T3 User Tasks | `/dashboard/transfer-center`, `/dashboard/shipping-line/handover-inbox`, `/dashboard/smart-operations`, `/dashboard/user-tasks` | both |
| 8 Settings & profile | P1 profile · P2 language sheet · P3 appearance | `/dashboard/settings/profile`, `/dashboard/settings/template-color` | both |
| 9 States | X1 empty · X2 loading · X3 error · X4 offline | `mobile-shell/offline.html` | both |

## 4. Navigation model
* **Phone:** app bar (menu · title · language · bell) → content → **bottom tabs (5)**. B: Home · Purchase · Sales · Accounts · More. BS: Home · Tracking · Orders · Inbox · More.
  The **drawer** is the full role-filtered sidebar; **More** shows tiles for everything else.
* **Tablet (≥ 820):** permanent **side rail** (same 5 entries) + 12-column content; lists become **master-detail** (S3) and tables show real columns.
* **Role-based pages = the ERP's own rules, unchanged:** the drawer content is the real sidebar filtered by role and operational domain. Business-only logins never see
  *Shipping & Clearing*; shipping-only/agent logins see only their shipping modules and their own ledger; Super Admin sees everything; the wrong app shows A6.
  The device gate (A2–A4) comes before login; the admin approves phones in A7.

## 5. RTL rules (UR · AR · FA · PS)
Whole screen flips with `dir="rtl"` on the screen root (the ERP already sets `document.documentElement.dir`); **logical CSS only**.
**Mirror:** app-bar order, drawer/rail docking, chevrons/back arrows, stepper/route direction, bottom-tab order, input icons, hero art. **Do not mirror:** numbers, amounts, dates,
container/BL/seal numbers, phone numbers, e-mail, the 6-digit activation code (LTR), logos, chart value axes. Arabic-script font stack, line-height 1.65, no letter-spacing,
no uppercase transform. Language persists (`erp_lang`). Details in `tokens.json → rtl`.

## 6. Figma import plan
**Connect first (owner, ~5 min):** Claude app → Settings → Connectors → Figma → Connect (account OAuth). Installing the Figma desktop app alone does not connect it. The Figma connector
mostly *reads/generates from designs*; pixel-level frames are created either by a designer or by importing the HTML below.
1. **Variables** — import `tokens.json` (Tokens Studio / "Variables Import" plugin). Collections: `Color/Mode` (day, soft, green, night), `Color/App` (b, bs), `Color/Status`, `Space`, `Radius`, `Size`, `Type`.
   Modes: Light/Dark × App B/BS. Create text styles from `font.scale`; effect styles from `elevation.*` (`3d-tile`, `3d-gem`, `3d-button` use the tile's HSL as `{tone}`).
2. **Pages & frames** — pages `00 Cover`, `01 Tokens`, `02 Components`, `03 B — Screens`, `04 BS — Screens`, `05 Flows`. Frame sizes: **Phone 390×844** (also 360×780), **Tablet 820×1180**.
   Frame names: `B/Phone/EN/D1 Dashboard`, `BS/Tablet/UR/S3 Tracking` (pattern `App/Device/Lang/ID Name`). RTL = duplicate frame with auto-layout direction RTL.
3. **Import the HTML** — with a "HTML to Figma" plugin, capture `mockups.html?app=…&device=…&lang=…&view=full` per figure (each figure `#s-<id>` is one frame); `components.html` per figure `#c<n>`.
   Then convert to components using the names below.
4. **Component names** (Figma): `Button/Primary|Secondary|Ghost|Danger|Disabled|Small` · `Input/Text|Select|Date|Password|Textarea|Error|OTP|Search` · `Chip/Filter` · `Pill/Status/{Success,Warning,Danger,Info,Neutral}` ·
   `Tabs/Underline|Segmented` · `Card/KPI-3D` · `Card/Hero-3D/{Ledger,Ship,Containers,Bars}` · `Card/Chart-3D` · `Card/Detail` · `Card/List-Item` · `Table/Tablet` · `Card/Notice/{Info,Warning,Success,Danger}` ·
   `Nav/AppBar` · `Nav/BottomTabs` · `Nav/SideRail` · `Nav/Drawer` · `QuickAccess/Tile` · `Stepper/Timeline` · `Route/Line` · `Sheet/Language` · `State/{Empty,Loading,Error,Offline}` · `Icon/Gem/{tone}`.
5. **Text** — bind text layers to `strings.json` (one variable per English label, 5 modes en/ur/ar/fa/ps) so a language switch flips the whole file.
6. **Hand-off back to code** — after owner approval, implement with the existing ERP components (`docs/design-system.md`: `dashboard-page-header`, `stat-card`, `erp-data-table`, `detail-drawer`, `useErpScreen`); the 3D tile/gem/hero become one shared `components/ui` primitive. i18n guard + the app-UA screen check must stay green.

## 7. Flags — things the designs expose (NOT changed; need a decision)
1. **Biometric unlock:** the web login's "Face ID / Fingerprint" button never signed anyone in; it is hidden in the apps (commit 811dd78/de4f6c4). A real unlock (Keychain/Keystore + WebAuthn) would be new work.
2. **Notifications:** the ERP has no notification centre — the surfaces are Transfer & Handover Center, Smart Operations, User Tasks. Native push (Firebase/APNs) is not built; the Android manifest still declares `POST_NOTIFICATIONS`.
3. **Untranslated sidebar labels in the live ERP:** e.g. "Track Shipment (Container & Vessel)", "Track Shipment (Clearing & Cargo)" have no UR/AR/FA/PS entry in the header-translation tables and show English in those languages. The mockups use translated equivalents (`shtrk.title`, `shtrk.live_tracking`).
4. **Offline page** (`mobile-shell/offline.html`) is already 5-language but titled "Digital Dock ERP" and is not branded per app.
5. **"Remember me" checkbox** renders ≈ 44 px wide inside the apps (global touch-target rule) — visual defect in the live login.
6. **Voice input** needs `RECORD_AUDIO` (Android) — not declared, so voice buttons will not work in the Android app today.
7. **Tab label "Orders"** (BS) is the short form of *Customer Order* to fit 5 tabs; confirm wording with the owner.
8. 3D effects are decorative CSS/SVG only; if the owner wants photographic/real 3D renders, those are new artwork.
