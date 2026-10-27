# DGT ERP — Main Master Progress Report
Owner-facing. Updated 2026-10-27 (Dubai, UTC+4). (No earlier file with this name was found in the repository or on the Desktop — if one exists elsewhere, tell me where and I will merge this into it.)

## rc2 completion round (2026-10-27, afternoon) — owner's written instruction: "merge the verified code and deploy through the approved Production process"

Evidence is DEV only (`csesvyxxjivnkkozgopt`, real DEV records); Production was only read (and, after the deploy, checked without signing in).
While this round ran, Production moved to `2f44ace` (Clearing E1 sub-sections / location pickers, deployed through the gate at 11:11Z).
It was merged into `release/rc2` (`989b8bc`, one key-list conflict resolved by keeping both lists) and the merged build re-tested.

| Work card | Result |
|---|---|
| A. New Account Setup — Create → Save → Reopen → live language switch → Refresh → Reopen again → Update, six real DEV customers, form started in EN / UR / AR / FA / PS + an approved-variant customer | PASS — 256 / 256. Account name stays the saved name in every language; the Linked customer follows the language (approved variant, else saved name); an unsaved edit survives a language switch; the ledger name and customer link never change on Update; test accounts archived through the app afterwards |
| B. Names on every screen (customer master, Customer Register list + page, Party Directory API, account API, Accounts General Report, Ledger General Report), 5 real DEV customers × 5 languages | PASS — 210 / 210. No stored machine rendering is ever shown. (One check — Accounts General Report in Arabic — first missed the test's 16-second wait while two servers and the regression suite were running; the page showed the name after 23–26 s; re-run with a 40-second wait: 50 / 50 for that customer.) |
| C. Party Directory screen | FIXED + PASS — 33 / 33 (was 23 / 33 on the previous build) |
| D. Customer Register 160 / 160 · customer picker 9 / 9 · Truck Registration 41 / 41 · Truck print 6 / 6 | PASS |
| E. Roznamcha Cash Entry notices in five languages | FIXED + PASS — 24 / 24 |
| F. Outstanding Ledger, user profile, audit filters (English leftovers from the sweep) | FIXED + PASS — sweep of the 13 screens touched in this round × 5 languages × 3 widths (195 page-loads, run while two servers and the regression suite were busy): 169 PASS; of the 26 others, 15 were read before the page finished loading (menu still English during the first paint on an overloaded box), 5 the brand name, 5 "Staff User" / "Authorized Scope" (then fixed: e250998) and one hydration warning (#418). Quiet re-run of the four affected screens (60 page-loads): no English label left except the brand name "Digital Dock ERP" on Outstanding Ledger (a name — not translated), no page error |
| G. Regression (20 financial / operational / security scripts) | PASS — 20 / 20 scripts, 507 checks (purchase / sales payments, transfers, local purchase, shipping bills, expense framework and registers, money exchange, delivery, shipment tracking, truck print, user creation by domain, shipping account approval, branch-admin permissions, direct-URL / API matrix). Leak scan 156 PASS + the same 4 known items as rc2 final (Shipping-domain DEV test records on Business branches — DEV data, not leaks). Two scripts first failed while two servers and a sweep were running (no print document within the wait; an empty user list) and passed on a quiet re-run: truck print 6 / 6, user creation 25 / 25 |
| H. Unit tests / tsc / build / guards | PASS — 570 / 570 (also on the merged tree); tsc 0 errors; build green; i18n guard 22,339 keys × 5 after the merge, nav, stock, repo-safety green |
| I. Production deploy through the gate | DEPLOYED — two gated deploys, each with its own pre-deploy backup, dgt-approve-deploy (no migrations), dry-run, isolated build, atomic swap and zero-downtime reload (rollback build kept): 989b8bc at 12:03:49Z (this round + Production 2f44ace) and e249760 at 12:47:25Z (no-invented-figures fix). Live checks after each: 30 / 30 — VPS HEAD = release, pm2 online, deploy log DEPLOYED, /auth/login 200 with lang / dir following erp_lang in EN / UR / AR / FA / PS, every signed-out page sent to /auth/login, protected APIs refused, this release's dictionary keys present in the live build; public https://ac.dgt.llc/auth/login 200 (UR: lang=ur-PK dir=rtl); live build has the Shipping Line page and 0 invented sample strings. Production data identical before and after (8 customers, 60 accounts, 60 ledgers, 1,930 translations, 10 profiles, 0 Roznamcha, 0 journals, 104 locations, 216 cities). Signed-in checks need the owner's login (listed in the runbook) |
| J. No invented figures (found while checking the live build) | FIXED — Purchase Booking Journal report, Purchase Order dashboard, Clearing Customer Order and Sales Transfer report invented container / B/L / truck / seal numbers (see below); built code scanned: 0 invented strings left; sweep of the four screens × 5 languages × 3 widths: 60 / 60 (one Persian tablet load was first read before the page finished loading; re-check PASS) |

**Root causes found and fixed in this round**
* **Party Directory — saved name not searchable:** the search (server and screen) matched only the name shown in the selected
  language. With an approved Urdu / Arabic / Persian / Pashto variant, typing the saved name gave "No records found". The saved name
  is now searchable (never shown in place of the display name).
* **Party Directory — names kept the old language:** the screen loaded its list once; after a live language switch every name stayed
  in the language the screen was opened in. It now reloads on a language change. Employee names come from the person record (its
  approved variants), as on the party row itself — before, they were rendered by the machine transliterator.
* **Roznamcha Cash Entry:** every validation / save / delete notice, the approver and the status were English-only; a translated
  refusal would also have turned green (the colour was guessed from English words). 16 hand-written keys; the tone is now stored
  with the notice.
* **Outstanding Ledger:** "All Branches" / "All Countries" group names and the Currency / Type labels were English; the API invented
  an "All Branches" branch name; the branch count compared against the English label.
* **User profile header:** role, department and "Global Scope" were English.
* **New Account Setup (earlier today, fc0a384):** a language switch reloaded the whole edit form — unsaved edits were wiped and the
  linked names did not follow the language. Fixed; covered by card A.
* **Invented container / B/L / truck / seal numbers (e249760):** the Purchase Booking Journal report built a container list for every
  booking (CONT-001…, BL-1001…, trucks ABC-123 / XYZ-888, seals S-00123…, receiving country "Dubai", 5 containers when the count was 0,
  a "confirmed" share guessed from the status); the country / branch summaries counted those 5 containers and every search matched
  them. The Purchase Order dashboard did the same (container numbers, seals, 20 / 40 FT sizes). Clearing Customer Order showed truck
  "XYZ-786" when none was entered; the Sales Transfer report showed "CONT-<n> containers" as a container number. Production has 0
  purchase / sales transactions, so nothing invented was on screen yet — it would have appeared with the first real booking.

**Observed, not changed**
* **Purchase payment → automatic Loading record:** when a purchase payment creates the first Loading record and no container number
  was entered, the server stores `CONT-<purchase order no>` as the container number (`app/api/erp/purchases/orders/[id]/payments`).
  That writes a placeholder identifier into the data; changing it touches the Loading / Transit lane, so it is left for the owner to
  decide (store nothing until a real container number is entered, or keep the placeholder).
* Ledger General Report lists only ledgers with entries or a balance, even when opened directly on an idle ledger (by design of the
  report; three idle Shipping AR ledgers are therefore not shown there).
* An intermittent React hydration warning (#418) on Account Setup: seen twice while two servers and two test suites were running,
  not reproduced in 19 dedicated loads. React recovers on its own; nothing visible to the user was found.
* Place names: the Customer Register shows the Urdu spelling of Herat (ہرات) on the Arabic / Persian / Pashto screens. Cause: the DEV
  city translation row for Herat holds the Urdu form in all four columns (the Arabic / Persian / Pashto spelling is هرات). City data
  belongs to Location Management, which is on the owner's do-not-modify list — left for the owner to correct. Production has no such
  row (read-only check), so this is a DEV data item.
* Tax Management (VAT) — postponed by the owner; untouched.

## rc2 final (2026-10-27) — ready for the owner's gate, NOT deployed

Production runs `dffd724` (deployed through the gate 2026-10-26 20:35Z). Branch `release/rc2` contains it (strict superset) and
adds **no database migration**. Runbook: `docs/release-2026-10-27-rc2-runbook.md`. Evidence below is DEV only
(`csesvyxxjivnkkozgopt`); Production was only read.

| Card | Result |
|---|---|
| 1. Names in five languages (account, customer, company, bank, branch) | PASS — approved variant, else the exact saved name; no phonetic re-spelling, no word-by-word substitution; places (country / city) still translated. Company API 10 / 10, approved-variant 5 / 5, place fields correct |
| 2. Save → Reopen → language switch → refresh → logout / login, 5 languages | PASS — 192 / 192 |
| 3. Merge Production into rc2 | PASS — 5d2a4b9 + a6c7c93 + dffd724 merged; one conflict resolved; all rc2 fixes kept |
| 4. Users page Grid / List toggle (phone / tablet / desktop) | PASS — 120 / 120 (10 pages × 3 widths, counted from first paint) |
| 5. DEV clean-up of test accounts | PASS — the 8 reported + 5 more from an interrupted run archived through the app (soft delete, history kept); 28 test accounts archived in total, 0 active ledgers; no real data touched |
| 6. Shipping Line & BL Entry | PASS — 95 / 95 (menu link, Goods Master source, five languages, phone / desktop); both work cards closed. BL Entry no longer shows invented values |
| 7. Regression / security / permissions | PASS — 20 scripts (financial, operational, user creation, account approval, branch-admin permissions, direct-URL / API matrix); unit tests 570 / 570; tsc, build and all guards green. Leak scan: 156 PASS + 4 items that are Shipping-domain DEV test records on Business branches (not leaks) after the Roznamcha fix below |
| 7b. Five-language sweep — every Main Menu screen (185) × EN / UR / AR / FA / PS × 1440 / 820 / 390 px = 2,775 page-loads | 2,585 PASS (93.2 %); 2,624 / 2,751 (95.4 %) when saved names (a bank branch called "Main Branch", the brand name) and the postponed Tax module are not counted; 0 load failures. Checks: loads, no error page / page error, `dir` follows the language, no sideways scroll, no English UI sentence that has a translation. Remaining English labels (10, on 8 screens, after 7d3fbcf): All Countries (edit history / deleted records filters), Country Admin (dashboard settings, exchange-rate report), Super Admin Branch, Sales Booking / Unknown Country (final sales payment header), All Branches (outstanding ledger), Shipping Line Super Admin (handover), General Office, Shipping Line (users list) |
| 8. Deployment gate | PREPARED — `release/rc2` pushed to GitHub; the pull request into `production` is one click (compare page); waiting for the owner's written approval |
| 9. Figma | PREPARED — editable Figma plugin (3 concepts × 20 screens, EN + UR) in `design-review/04-figma-plugin`; the Figma connector still needs the owner's sign-in |

**Found and fixed during the final verification (all live in Production before rc2):**
* **Security — Business ↔ Shipping:** purchase / sales payments, booking transfers and local-purchase payments saved their Roznamcha
  entry without an operational domain; the Roznamcha list shows such entries to every domain, so a Shipping-only login saw Business
  payments (DEV: several hundred rows; Production: 0 transactions, nothing leaked). Read rule + write stamping fixed; the Supabase
  fallback path had no domain filter at all.
* **Invented figures:** Super Admin dashboard (sample shipments / activities, a sample profit curve, sample sales split, "$" sums of
  mixed currencies), Shipping Line dashboard (24 / 56 / 342 / 286 … whenever the real count was 0, fake trend %, sample rows), KYC
  Reports, Audit Monitoring (1,842 added to the real count; branches floored at 9, countries at 5), purchase reports (sample HS code,
  brand, origin, weights, price, supplier; serials built from the booking number), BL Entry (sample BL / truck / seal numbers, a fixed
  "Passed" quality report), City / Country Branch reports (sample accounts, company type), Account Setup ("Created by: Super Admin").
* **Five languages:** menu labels and headings fall back to the central dictionary; ~80 leftover English labels on ~40 screens; two
  hydration errors (CHS Products, Outstanding Ledger).

**Open owner decisions (found, deliberately not changed):**
* **Tax Management (`/dashboard/tax`, VAT / GST) — postponed module:** its KPI cards show fixed figures that are not read from any
  data ("Total Tax Collected (YTD) AED 2,48,320", "+12 % vs last year", 12 branches, 38 users, 5 countries, 12 profiles). Left exactly
  as in Production because the owner postponed this module.
* **Location Management on Production:** migration 20261242 (released through the gate on 2026-10-26 by root) inserted 104 rows into
  `erp_locations` (copies of the ports master). Nothing was deleted; reversing it would itself modify location data.
* **origin/main** carries the owner-only "ONE APP" status page (PR #33); it is also in Production (dffd724) and therefore in rc2.

## Production release ca7383d — LIVE 2026-10-25 23:54 Dubai; follow-up rc2 (2026-10-26)

**ca7383d is deployed.** Sequence (all through the owner's gate): verified full backup (72.8 MB, gzip integrity OK, 1,773 tables) → migration pre-checks (new objects absent, target tables empty) → migrations 20261240 + 20261241 applied (7 columns, 5 unique indexes, 2 CHECKs — verified) → `dgt-approve-deploy ca7383d… --migrations` → `dgt-deploy` (own backup `prod-before-deploy-20261025-194435.dump`, atomic build, rollback kept). Live checks: VPS HEAD = ca7383d, pm2 online, /login 307, expense APIs 401 unauthenticated, no new error-log lines. **Production data identical before and after** (customers 6, companies 3, ledgers 21 with zero totals, profiles 9, assignments 9, branches 3, 0 transactions).

### rc2 (branch `release/rc2`) — found while verifying Chaman Branch Admin and the UAE Country Admin
SECURITY (present in production since 658c4be / a86355d):
* Branch Reports and User Permission Management accepted `?branchId=` from a Country Admin of ANY country and, for a login without a branch, fell back to the first active branch of the whole database (roznamcha, expenses, ledger balances, users with phones / permission sets). Now: only a branch inside the login's scope and operational domain; no fallback except the Global Super Admin.
* Country shipping dashboard: `?countryId=` reached any country and dashboard:read alone opened it for a branch login. Now role-gated and pinned to the session's country.
* City Branch Admin as user manager: requires users:update / users:create in its permission set (template has them, a per-user set can withhold them), manages the branch's STAFF only, an explicit main-branch id must match.
* Shipping Line user stays default-deny; menu entries offered only when the route gate lets the login in (no dead links, one token never unlocks a menu entry).
* The permission screen showed invented values (a fixed phone, e-mail, dates, "Today, active now", a real person's name) — removed.

Unit tests: the 19 failures on production a86355d are resolved (562 pass, 0 fail). They encoded the earlier delegation rule; the approved policy (city admin manages local users, Shipping Line user holds the approved accounting bundle, tier dashboards) is now pinned by tests instead, plus invariants: scope fencing, no wildcard / no commercial trade for the shipping template, user-manager only with the token.

Customer names: one rule on every screen — an authorized translation (human-entered / corrected, verified, curated dictionary), else the saved legal name. Generic record tier, duplicate warning, account live report, Party Directory, Truck registry/report now agree with the Register.

### Open items needing the owner
* **Chaman City Branch permission grants** (Production): stored as a JSON *string* (ignored by the code) and equal to Quetta's BUSINESS list (purchase / sales groups). Fixing the type alone would cap Shipping staff creation to Business groups. Owner decides the Shipping grant list; nothing was changed.
* **Production has no Country Admin assignment** (UAE or Pakistan): the top UAE login is a Main Branch Admin with users:read only. If a UAE Country Admin is expected, it must be created.
* **SMTP:** MX / SPF / DKIM are Titan; DMARC missing; provider `smtp.titan.email:465` correct and reachable from the VPS; four mailboxes have no stored passwords, never tested; stray "DGT Staging" provider. Needs mailbox passwords (entered by the owner in Mail Management) and a DMARC TXT record.
* **Transport payments / Transport ledger:** no ledger posting — needs the accrual mapping (which account is debited and which credited when a transport charge is booked) before the payment leg can be posted without a one-sided entry.
* **VAT Management:** postponed by the owner (not cancelled); no tax rule or mapping was changed.

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
