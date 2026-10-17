# DGT.llc B / DGT.llc BS — UI/UX design specification

Status 2026-10-18: **design specs + HTML mockups in this folder. No Figma file exists yet** — the Figma connector is listed in the
Claude connector registry (`https://mcp.figma.com/mcp`) but is **not connected** in the session that prepared this, so nothing could be
created in Figma. See "Connecting Figma" at the bottom for what the owner must do.

The apps are thin native shells around the ONE ERP (`api.dgt.llc`). Their screens ARE the ERP screens, so the design here is the
*mobile layer on top of the existing design system* (`docs/design-system.md`) — not a second visual language. Anything that would make
the app look different from the ERP on the web is out of scope.

## 1. Principles
1. **One ERP, two front doors.** B = Business (purchase, sales, accounts, stock, reports). BS = Business Shipping (shipping line + clearing
   agent: tracking, hand-over inbox, clearing). Same login, same permissions; the channel (UA tag) only picks the landing screen and the
   "wrong app" page (`lib/mobile/app-channel.ts`).
2. **Structure, not data, in marketing assets.** Store screenshots show counts/structure only (no names, money or test rows).
3. **Honest controls.** Nothing that does not work is shown (the stub "Face ID / Fingerprint" button is hidden inside the apps).
4. **5 languages, RTL first-class.** EN / UR / AR / FA / PS; UR/AR/FA/PS flip the whole screen (`dir=rtl`, logical CSS).
5. **Thumb-reachable.** Primary actions in the lower 60 % of the screen; 48 dp minimum touch targets; no hover-only affordances.

## 2. Tokens (taken from the ERP — do not invent new ones)
| Token | Value | Use |
|---|---|---|
| Brand blue | `#0f3ea8` (splash/status bar) → `#2563eb` (primary buttons, links) | app bar, primary CTA |
| Surface / page | `#ffffff` / `#f8fafc` (dark: `#0f172a` / `#020617`) | cards / background |
| Text | `#0f172a` / secondary `#64748b` | |
| Success / warning / danger | `#059669` / `#d97706` / `#dc2626` | status chips, KPI stripe |
| Radius | 12 px inputs/buttons, 16–24 px cards/dialogs | |
| Type | Inter (Latin) · Noto Naskh Arabic / Noto Nastaliq Urdu (UR/AR/FA/PS) | numbers `tabular-nums` |
| App icon | B: blue "DGT" rounded square · BS: maritime teal variant (`docs/store/assets/{b,bs}`) | |

## 3. Screen inventory and layout rules (phone 360–440 dp, tablet 768–1032 dp)
| # | Screen | Phone | Tablet | Notes |
|---|---|---|---|---|
| 1 | Splash | brand colour full-bleed, icon centred, 1.5 s | same | native splash (Capacitor) |
| 2 | **Device activation** (`/auth/device`) | one column: app name, device name field, "Request approval" → pending state → 6-digit code | centred 480 dp card | states: idle / pending / code / locked / revoked; all strings `dev.*` keys |
| 3 | Login (`/auth/login`) | logo, identifier, password (show/hide), remember me, **Sign in**, language chip | centred 440 dp card, background artwork visible | no biometric button in apps |
| 4 | Wrong-app page (`/auth/app-access`) | icon, "Use DGT.llc BS" message, link to store | same | public, no session needed |
| 5 | B home (role dashboard) | KPI cards 2-up → Smart Summary list → quick actions | 3–4-up cards, side nav visible | Smart Summary = real data only |
| 6 | BS home (`/dashboard/shipping-line`) | shipment status cards, handover inbox badge, tracking search first | split view: list left, detail right | |
| 7 | Lists (accounts, stock, shipments) | `erp-data-table` in own scroll container, search + filter sheet | table full width | no horizontal page scroll |
| 8 | Detail drawer | full-height bottom sheet | right-side drawer 480 dp | `detail-drawer.tsx` |
| 9 | Reports / print | opens PDF preview modal (`PdfPreviewModal`) — phone scale-to-fit | A4 preview | 5-language PDFs |
| 10 | Offline (`offline.html`) | icon + "No connection" + Retry | same | shipped in `mobile-shell/` |
| 11 | Settings → language, theme, sign out | list rows | same | language persists (`erp_lang`) |

## 4. Navigation
* **Phone:** top app bar (menu, title, language, user) + hamburger → the same sidebar items as the web (`DAMAN_SIDEBAR_ITEMS`,
  RBAC-filtered). BS shows only the shipping/clearing groups for shipping-scoped logins.
* **Tablet / landscape ≥ 768 dp:** permanent sidebar, content area with 12-col grid.
* **RTL:** hamburger, back arrow, chevrons and progress bars mirror; numbers, codes and dates stay LTR (`dir=ltr` inline).

## 5. Responsive matrix (what the existing sweep and emulator cover)
| Device class | Viewport (dp) | Verified how |
|---|---|---|
| iPhone SE / 15 / 16 Pro Max | 375×667 · 393×852 · 440×956 | Playwright WebKit sweep (`scripts/mobile-sweep.mjs`), store screenshots at 440×956 |
| iPad 11" / 13" | 834×1194 · 1032×1376 | same (emulated; **not** real iPad) |
| Samsung Galaxy S (phone) | 360×800 | Android emulator `pixel` (Android 16) + Chromium emulation |
| Samsung Galaxy Tab | 800×1280 | Chromium emulation only |
| Other Android | 320–412 wide | Chromium emulation; 360 is the strictest width |
Real-device confirmation is listed in `../store-readiness.md`.

## 6. Accessibility
Contrast ≥ 4.5:1 for text (slate-500 on white = 4.8:1); focus rings on every control; `aria-label` on icon buttons; respects system font
scale up to 130 % without clipping (tables scroll, headers wrap); status never conveyed by colour alone (icon + text on chips).

## 7. Mockups
`mockups.html` (open in any browser) shows the activation, login, B home and BS home screens in phone frames, LTR and RTL, using the tokens
above. It is a design reference, not production code.

## Connecting Figma (owner action, ~5 minutes)
1. In the Claude desktop app: *Settings → Connectors → Figma → Connect* (OAuth in the browser, sign in to the company Figma account).
2. Enable the connector for the Code session, then ask again: "Create the DGT.llc B / BS screens in Figma from `docs/store/design`".
3. Note the Figma connector's tools are mostly *read / generate-from-design* (`get_design_context`, `get_screenshot`, `generate_diagram` …);
   creating pixel-level frames in Figma still needs a designer or Figma's own AI. The practical flow is: designer builds frames from this
   spec + `mockups.html` → Claude reads them with `get_design_context` and implements the differences in the ERP components.
4. Installing the Figma desktop app alone does not connect it to Claude — the connector (account OAuth) is what is missing.
