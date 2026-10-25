# DGT ERP — Main Master Progress Report
Owner-facing. Updated 2026-10-25 23:30 Dubai (UTC+4). (No earlier file with this name was found in the repository or on the Desktop — if one exists elsewhere, tell me where and I will merge this into it.)

## Release candidate 2026-10-25 — expense framework + four languages + customer names (branch `release/rc-expense-framework`)

DEV evidence only (DEV database `csesvyxxjivnkkozgopt`); Production was only READ (schema / counts), never written. Production runs `a86355d`; the release is a strict superset of it (47 commits). Runbook: `docs/release-2026-10-25-runbook.md`.

| Check (on the merged build) | Result |
|---|---|
| `tsc --noEmit`, build (`npm run build`), all prebuild guards (i18n 22,215 keys × 5 languages, contract, nav, stock, repo-safety) | PASS |
| Expense framework e2e (`expense-framework-e2e.mjs`): base currency + tax per country, mixed currency with a rate per row, exclusive / inclusive / exempt, tampering refused, role visibility, DR = CR at rate 1, 6-way race | 50 / 50 |
| Bill Expenses lines e2e (`bill-expense-lines-e2e.mjs`): same calculator, Business vs Shipping, posting + void + 5-way race, register totals per currency, Job Cost per currency | 41 / 41 |
| Financial / operational regression (purchase-payment race 4, payment remaining 16, payment kinds 16, sales payment 11, purchase transfer 8, sales transfer 10, local-purchase payment 9, shipping bills 12, transport payment 6, expense registers 32, money exchange 4, delivery status 12, shipment tracking 13, user-creation domain 25, shipping account approval 30, truck print 6) | all PASS |
| Business / Shipping data-leak scan (existing harness) | 57 PASS, 3 reported items are a Shipping-domain test account that sits on a Business branch (not a leak) |
| Four-language sweep: ur / ar / fa / ps × 111 screens × 1440 / 820 / 390 px = 1,332 page-loads | first merged build 6,609 PASS / 51 FAIL; all failures were on 5 screens (+3 borderline short pages), fixed; re-run of those screens 660 / 660; Branch / Country / Super-Admin personas on the shipping dashboards, branch reports and permission screen 232 PASS (8 items are customer / BL codes = data) |
| English regression: 111 screens × 1440 / 820 / 390 px = 333 page-loads | 1,332 / 1,332 |

### Defects found and fixed in this pass
* Bill Expenses lines: converted with a rate defaulting to 1 and no tax treatment; grand amounts were labelled in the original invoice currency; posting fell back to USD. Now one calculator (original → base currency → tax exclusive / inclusive / exempt with the country's code and rate), base-currency labels, 422 when the base currency is not configured.
* Job Cost / Profit added charges, expenses and partner bills of different currencies into one number; now one row per currency, no single figure for mixed-currency orders.
* Production screens added by `658c4be` / `a86355d` (permission management, Branch / Country / Super-Admin shipping dashboards, branch reports) were English in UR / AR / FA / PS: 121 labels + status legends + role names + toasts translated; the permission screen showed a fixed phone number, e-mail, dates, "Today, active now" and a real person's name when data was missing — it now shows only real values.
* Customer Register row label hard-coded English (found by the sweep, not by the register's own matrix).

### Open items (not hidden)
* **19 unit tests fail on `origin/production` `a86355d` itself** (permissions: `domain-separation`, `domain-super-admins`, `rbac-v2`, `scoped-user-creation`, `scoped-user-creation-api`, `mobile/app-channel`). They encode the earlier rule "a city branch admin is not a user manager without an explicit grant; shipping-line users hold no financial resource". Commits `658c4be` / `a86355d` deliberately changed that (city admins are now user managers, shipping-line users get customer / account / roznamcha entry). The tests were not updated. Owner decision: keep the new policy and update the tests, or revert the policy.
* Customer-name rule (saved legal name when no authorized translation) vs the older display-only transliteration still used by the generic record localiser (Truck Registration report, Account Name input, Party Directory report): two behaviours on one screen. Owner decision.
* Transport payments are recorded without a ledger posting (needs the owner's account mapping); input-VAT is part of the expense posting (no separate tax account).
* Production authenticated screen checks: no Production login available to Claude (dev-session is disabled on Production by design).

## Mobile apps — DGT.llc B (Business) and DGT.llc BS (Shipping)

### Design approval gate (owner order of 2026-10-18)
| Item | Status |
|---|---|
| Final mobile UI / final store screenshots | **ON HOLD until the owner approves one Figma concept.** Screenshot rebuilding stopped; existing screenshots marked DRAFT (`docs/store/screenshots/DRAFT-NOT-APPROVED.txt`). |
| Figma connection | **BLOCKED — waiting for the owner's one click** (Connect card for the Figma connector `https://mcp.figma.com/mcp`, OAuth). Not connected yet; I cannot sign in for the owner. |
| Three design concepts (login, device activation, dashboard, navigation menu, customer order, shipment tracking, sample report; phone + tablet; English + Urdu RTL) | **STARTED 2026-10-18.** Target: Mon 2026-10-19 12:00 Dubai. |
| Complete approved design (both apps, 5 languages, iPhone/iPad/Android/tablets, light + dark) | Target: Thu 2026-10-22 18:00 Dubai, if the concept is approved on 19 Oct. |
| Implementation in both apps | Starts the hour the concept is approved; target Tue 2026-10-27 (see store-date impact). |

### Not blocked by the design (continuing in parallel)
* Production security: reversible ref lock installed + verified on the live server (2026-10-11); owner decisions pending (Daily Payments change A/B/C, GitHub `production` ruleset, branch switch, two unused SSH keys).
* Device approval + review pass (store-review access): built and proven on the Testing database only — 35/35, 32/32, 26/26, 12/12 end-to-end checks. Production migrations `20261232` / `20261233` need the owner's approval and a verified backup.
* ERP sweep (9,550 device/language/route cases): all cases run; remaining real defects fixed or listed (Edit History loads slowly: a 5–20 s query over 5,000 history rows).
* Registrations (owner-only): D-U-N-S, Apple / Google / Samsung accounts, payments, OTP.

### Store-date impact of the new design gate
The old targets (Google Play 25–29 Oct, Samsung end Oct, Apple early Nov) assumed the current design. With a new design, the implementation + new store screenshots + a new signed build move **Google Play submission to about 28 Oct → live about 1–5 Nov**, Samsung about 5–8 Nov, Apple about 10–15 Nov. These dates also depend on the owner finishing the store registrations.

### Update 2026-10-18 23:00 Dubai — three design concepts delivered (not final)
* Concepts A **Harbour Ledger** (light, navy + brass, bottom tabs), B **Night Dock** (dark control room, teal + amber, floating nav), C **Manifest** (flat editorial, black/white + orange, side drawer).
* 10 screens each (Login, Device activation, Dashboard B, Dashboard BS, Menu, Customer order, Shipment tracking, Report + 2 tablet screens) in English and Urdu RTL. Folder: `Desktop\DGT-Mobile-Design-Concepts` (compare sheets, boards, single screens, Figma plugin). Sources: `docs/design/mobile-concepts`.
* Figma: connector still NOT connected (owner click needed). Editable Figma file = run the plugin in Figma Desktop (steps in the folder) — the plugin has not yet been run inside Figma by me.
* Owner decision needed: choose A, B or C (or a mix). No final UI, no store screenshots, no implementation until then.

## Four-language verification (Urdu, Arabic, Farsi, Pashto) — 2026-10-23 / 24

Evidence from the DEV test environment only (DEV database `csesvyxxjivnkkozgopt`; Production was not touched). Final build = branch `feat/stock-balance-report` at commit `d8b997f` (production-mode build, `npm run build` exit 0, `npx tsc --noEmit` exit 0, `node scripts/i18n-ui-guard.mjs` passed with 22,167 keys × 5 languages).

| Language | Page-loads (102 pages × desktop 1440 / tablet 820 / phone 390) | Checks passed | Checks failed |
|---|---|---|---|
| Urdu (ur) | 306 | 1,530 | 0 |
| Arabic (ar) | 306 | 1,530 | 0 |
| Farsi (fa) | 306 | 1,530 | 0 |
| Pashto (ps) | 306 | 1,530 | 0 |
| **Total** | **1,224** | **6,120** | **0** |

Each page-load runs five checks: page renders, correct RTL direction, no sideways page scroll, no leftover English chrome (headers, buttons, labels, options, titles, placeholders, aria-labels), no page errors.

* 99 pages run together (5,940/5,940) and the three slow report-engine pages (Country, Branch, Shipping reports: 180/180) run separately with a longer wait.
* English regression on the same build: 102 pages at desktop (1440) and phone (390) = 816/816 checks passed, 0 failed (render, direction, no sideways scroll, no page errors).
* The "no leftover English" check tolerates business data that is never translated (product, supplier and company names, e-mail addresses, account codes, the signed-in user's own name). 216 of 1,224 label checks passed on that basis, on 18 pages (p3, p4, p5–p8, p10, p12, p14, p15, p18, p26, p30, p34, p47, p54, p74, p77).

### Defects fixed during this pass
* Report header (scope badge, role, "All Countries (Global)", "All Global Branches", Global/Country/Branch scope words) now follows the language.
* Country names shown in the active language in the shared register bar, Local Purchase (dropdowns, chips, summary strip, table), Business Edit Invoice, Access Register, cash-entry country selector, account general report; "All Countries / All Branches" in the General Ledger no longer freeze in the first-render language.
* System Forms Directory category pills and column; Shipping landing heading and subtitle; Customer 360 pager, refresh and "Show … per page"; stock journal pager and "Showing x to y of z entries"; outstanding ledger e-mail tooltip; currency placeholder; "Urdu Audit Excel" button; exchange-rate branch labels and placeholder; "Actions for {name}" row-action labels; fallback branch label "Unassigned Branch" replaced by a neutral dash.
* Goods update with a blank CHS code no longer fails (it called `.trim()` on null); `tsc --noEmit` is clean again.
* Test harness: spinner cap, hydration wait, text-stability wait and minimum-length options.

### Known characteristics and remaining observations (not blockers)
* **Brief English before the language applies:** the language store is set after hydration by design (server render is English). On a slow or heavily loaded browser a page can show English for a moment, rarely longer. Not reproduced in 220 one-at-a-time follow-up loads. Recommended follow-up: seed the initial language from the `erp_lang` cookie on the server.
* **DEV server stability (test environment only):** the DEV Next.js server process was silently terminated about every 1.5–4 hours and, once, stopped answering database-backed pages until restarted (mitigated by a supervisor, a larger resolver thread pool and IPv4-first DNS). I did not review Production server logs for this, so there is no evidence either way for Production; worth watching after deployment.
* **One rare React hydration warning (#418)** on the Outstanding & Recovery Ledger at phone/tablet width (2 of ~2,500 loads, not reproduced in 24 isolated loads).
* **Slow first load of report-engine pages (6–9 s)** against the remote DEV database; they finish loading, they do not hang.
* Business data shown in its original language on 18 pages (see above) — by policy, not translated.
