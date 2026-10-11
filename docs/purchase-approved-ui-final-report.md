# Purchase — five approved pages: final DEV report (PASS / FAIL)

Status: **complete on DEV, awaiting the owner's review. NOT deployed. Production was not touched.**
Code: local `main`, commits `46ec66c` (the five pages) and the follow-up "keep Page 1 and other routes on their original layout" (see git log). Database used: Testing project `csesvyxxjivnkkozgopt` only.

## Result table
| # | Check | Result | Evidence / note |
|---|---|---|---|
| 1 | **Page 1 – New Purchase Booking Order unchanged** | **PASS** | Its wizard embeds the register view. My first version changed that embedded register by mistake; this was caught during the final review and fixed: the register now defaults to its ORIGINAL layout and only the two approved routes switch the new layout on. Proof: git diff (only 5 original lines changed, all wrapper conditions), automated test `page1-and-scope-unchanged` (4 tests), browser check (no approved-layout elements on Page 1; original layout screenshot identical to the "before" one). The wizard/entry source files are untouched. |
| 2 | Purchase Transit & Lane unchanged | **PASS** | no file touched (test) |
| 3 | Journal "Remaining Payment" route (not one of the five) keeps its original look | **PASS** | screenshot `7-…/journalrem` |
| 4 | Five pages use the approved yellow/blue/green layout | **PASS** | side-by-side images, 5 pages |
| 5 | Existing tables: only a CSS skin; columns, words, order, rows, filters, search, sort, actions, pagination, print/PDF/Excel/CSV unchanged | **PASS** (code) | scoped diff: no `<th>/<td>/columns/headers` line changed; one wrapper `className` per page |
| 6 | Five languages (EN/UR/AR/FA/PS) on all five pages | **PASS** (with note) | 100 screenshots (5 pages × 5 languages × 4 sizes); header, toolbar, status, country names translate; i18n guard green (21k keys × 5, full parity). Note: I looked at a sample of the images myself (listed in the chat), the rest were checked automatically (no overflow, no page error). Words inside the existing tables are the ERP's existing translations (unchanged). |
| 7 | RTL for UR/AR/FA/PS | **PASS** | whole header, toolbar, menus flip; numbers/dates keep their order (fixes made) |
| 8 | Devices | **PASS** (emulated) | desktop 1440, iPad 820, Samsung 412, iPhone 390 in Chromium. **Not run:** real phones/tablets, real Safari/WebKit, widths 320/375/768/1024/1366/1920 |
| 9 | Dark mode | **PARTIAL** | desktop EN (5 pages) + iPhone UR (2 pages) checked; other language/device dark combinations not run |
| 10 | Data permissions (country/branch scope) | **PASS** (one role) | Country Admin (Pakistan): APIs return only Pakistan rows and the cards show only Pakistan (73 records, "Countries (1)"). Branch-level and other roles were **not** tested. The header only reads rows the page's own RBAC-scoped APIs already return; the new `usd-rates` route needs `purchases:read`. |
| 11 | Finance rules: no mock figures, no double conversion, no fake zero | **PASS** | one currency shown as is; mixed → USD only with a rate for every currency; else "—"; unit tests (11) |
| 12 | Print / PDF / Excel / CSV | **PARTIAL** | the three-dot menus call the pages' existing handlers (menu items verified on Booking Details); I did **not** execute and inspect every print/PDF/CSV output on all five pages |
| 13 | Page search separate from global search; pagination stays under the table | **PASS** | visual |
| 14 | `npm run build`, TypeScript on changed files, i18n guards, tests | **PASS** | build OK; no TS errors in changed files (the repo has other agents' unrelated TS errors); guards green; 11 tests pass |
| 15 | No Production change | **PASS** | no Production deploy, migration or data change |

## Defects found (pre-existing, fixed)
1. Country Bill Payment was always empty (it asked the orders API for `limit=1000`, the API rejects > 500 → HTTP 422). Now 500. If an organisation has > 500 orders this page needs server-side paging (not done).
2. RTL: dates/codes in monospace table cells showed as "Oct 2026 10" — fixed in the skin.

## Pre-existing issues NOT changed (need your decision)
* `booking-journal-report` reads a non-existing column (`daily_usd_rates.exchange_rate`), so its own USD rates are always empty; the new header uses the new `usd-rates` route instead.
* Removed because the approved cards now carry the same numbers: the old summary card blocks, the "Branch & User" box (Orders Payment), the four count boxes (Loading Records). The country drill-down on Loading Records is kept (closed by default).
* Business meaning of two figures was chosen by me: "Pending Review" (accepted, not transferred) and "Final Payment" (paid amount on fully settled orders) — please confirm.
* DEV data is test data (mixed currencies, test names such as RBAC-TEST); figures look odd there (for example paid 1.6%) but are the real sums of that data.

## Before you approve Production
Review the evidence folder, then give a separate written approval; I will first take a verified backup and use the reviewed-deploy gate. These changes include one new read-only API route and no database migration.
