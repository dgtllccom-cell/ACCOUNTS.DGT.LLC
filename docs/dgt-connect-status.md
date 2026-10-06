# DGT Connect — internal ERP live chat — status

Date: 2026-08-30. Feature added this session (commits `b0fdc14`, `5bdcead`, `29efe6c`).

**NOT WhatsApp/Meta.** Built entirely on the existing ERP users / auth / roles /
Country-Branch scope with its own Postgres tables.

## Delivered

| Layer | What | Evidence |
|---|---|---|
| DB | `20261012_dgt_connect.sql` (additive, idempotent) — `dgt_conversations`, `dgt_conversation_participants`, `dgt_messages` (body + body_lang = the **original**, never overwritten), `dgt_message_receipts` (delivered/read), `dgt_message_translations` (per-language cached VIEW), `dgt_presence`. Realtime publication on the 4 change tables. | applied to DEV; `erp_schema_migrations` row present |
| Access | `lib/dgt-connect/access.ts` — server-enforced on every directory read / conversation create / message send. super_admin → all; country login → all users in its countries; branch login → same-branch peers + the country/super admins of its countries (support path). Branch scope is expanded from the hierarchy when the login only carries `cityBranchIds`. | `scratch/dgt-connect-verify.mts` **28 / 0** |
| API | `/api/erp/dgt-connect/{directory, conversations, conversations/[id]/messages, conversations/[id]/read, typing, presence, unread, search, messages/[id]/translate}` | build registers all 9 |
| Translation | on-demand per-viewer-language VIEW via `translateViaMachineTranslation` (Google MT tier) → dictionary fallback; cached in `dgt_message_translations`. **Original text + language always preserved.** With no `GOOGLE_TRANSLATE_API_KEY` the fallback is the dictionary/transliteration tier (readable-ish, not a true translation) — set the key for production-grade output. | harness: Urdu message → Pashto view produced & cached, raw row unchanged |
| UI | `features/dgt-connect/dgt-connect-widget.tsx` — floating button (bottom-**end**, flips to bottom-left in RTL) with unread badge, mounted in `DashboardShell` on every authenticated page. Conversation list (presence dots, unread pill, typing), Country→Branch→User picker, direct + group, thread with sent/delivered/read ticks, inline translate toggle + "show original", attachments (≤15 MB, data-URL), ERP record sharing. 47 `dgtc.*` i18n keys ×5. | browser-verified (below) |

## Browser E2E (super_admin + two real city-branch logins, DEV)

- Floating button appears on the dashboard; RTL session → button is bottom-left.
- Quetta opens a direct chat with Chaman from the scoped directory (Pakistan only —
  India / Afghanistan excluded).
- Message sent → appears immediately (optimistic) → recipient's unread badge shows **1**.
- Recipient opens thread → sender's message gets the blue double-tick (read).
- Recipient replies → round-trips; 6 s fallback poll keeps the thread live even though
  the Supabase realtime websocket is unavailable in this environment.
- EN↔UR: an Urdu message shows a translated English view with **"Show original (UR)"**;
  toggling shows the untouched Urdu original.
- Urdu session: the whole widget renders RTL with translated chrome
  (ڈی جی ٹی کنیکٹ / لوگ اور پیغامات تلاش کریں / …).
- "DGT Connect" in the global page-actions menu → widget opens with a
  "Share ERP record: … →" banner → picking a conversation posts a record card
  (**PO AE-001-0022 / USD 220,500**) into the recipient's thread.

## Cross-scope enforcement (harness, 28/0)

- Quetta → Bombay (India) direct chat → **403**.
- Bombay cannot read or send into the Quetta↔Chaman conversation (not a member).
- Group creation rejected when any member is outside the creator's scope.
- `direct_key` guarantees one thread per pair regardless of who opens it.

## EPS / PRODUCTION deployment (2026-08-30, via VPS SSH — key auth)

| | Value |
|---|---|
| Prod `HEAD` | `ea0ddb58` (== `origin/main` == Local) · BUILD_ID `wJyFmKtq1_gGD0nBdprvp` · pm2 `dgt-nextjs` restarted, `✓ Ready in 770ms` |
| Migration `20261012_dgt_connect` | **applied on prod** |
| Migration `20261013_erp_translation_memory` | **applied on prod** |
| Destructive `20261008_*` | **NOT applied** (`[BLOCKED]` by `DESTRUCTIVE_MANUAL_ONLY`; `erp_schema_migrations` has no `20261008%` row) |
| Prod tables | all 8 present: `dgt_conversations`, `dgt_conversation_participants`, `dgt_messages`, `dgt_message_receipts`, `dgt_message_translations`, `dgt_presence`, `erp_translation_memory`, `erp_translation_memory_audit` |
| Prod translation memory | **313 rows** (114 glossary + 199 machine); samples verified: Roznamcha/Ledger/Clearing/Settlement/Bank Transfer/Shipping correct in ur/ar/fa/ps |
| Prod realtime publication | on `dgt_conversations`, `dgt_messages`, `dgt_message_receipts`, `dgt_presence` |
| **DB integrity (prod, before == after)** | **profiles 72 total / 72 active — UNCHANGED**; user_role_assignments 68, customers 4, companies 6, ledgers 11, countries 13, city_branches 23 — all intact |
| Prod backend E2E | **9 / 0** — translation-memory lookups + DGT membership guard (cross-country user excluded) + message/receipt write, test conversation cleaned up |
| Prod routes | `/api/erp/i18n/translate` → 405 (POST-only, exists) · `/api/erp/dgt-connect/*` → 401 · `/dashboard/{city,country}` compiled |
| **Remaining** | prod **browser** E2E (chart pixels, RTL layout, DGT widget UI, Print modal, mobile) — needs an authenticated session; identical code is exhaustively verified on Local. Owner: log into prod in Chrome-with-Claude-extension, then I run it. |
| Pre-existing prod issue (not this work) | `accounting/reports/accounts/general/route.ts` "Auto-ensuring master accounts" logs `column "code" does not exist` — caught, non-fatal, separate round. |

## Synchronization (2026-08-30)

| | Value |
|---|---|
| Local `HEAD` | `4d2640e` (== `origin/main`, 0 ahead, working tree clean) — **pushed** |
| `origin/main` | `4d2640e` — every DGT Connect commit + the runner registration of `20261012` (`2c52be2`) + the chart / graceful-degrade fixes (`5e1764d`, `c79a407`, `4d2640e`) |
| Prod code | `https://api.dgt.llc/api/erp/dgt-connect/unread` → **HTTP 401** (route exists → code deployed). Whether prod has pulled `4d2640e` yet is owner-verifiable only. |
| Migration `20261012` — DEV | **applied** (`erp_schema_migrations` row present; 6 tables exist) |
| Migration `20261012` — PROD | **NOT applied yet** — this is the `relation "public.dgt_conversations" does not exist` in the screenshot. Now registered in `db-apply-all-migrations.mjs`, so the next VPS deploy (`[VPS 3b/7] node scripts/db-apply-all-migrations.mjs`) creates the 6 tables. 100 % additive (`CREATE TABLE IF NOT EXISTS` ×6 + realtime publication) — cannot harm existing data. |
| Runtime guard (until the migration runs) | `directory` / `conversations` / `unread` / `messages` / `search` now detect Postgres `42P01` and return a clean empty payload + `setupPending:true` (HTTP 200) — no raw SQL string, dashboard stays healthy, widget shows an amber "being set up" note. Non-schema errors → generic 503, never a driver message. |
| `20261008_*` (both variants) | tracked on `origin/main` but **not** in `migrations[]`; both listed in `DESTRUCTIVE_MANUAL_ONLY` → can never auto-apply. Prod profiles untouched. |

## Branch / Country dashboard charts (2026-08-30, commits `5e1764d`, `c79a407`)

The "Branch Financials" / "Branch Mix" (and Country Sales/Purchase/Top-Branches)
charts appearing blank was addressed end-to-end:

- **KPI cards and charts already read the identical `data.*` aggregate** — they
  cannot disagree. Kept.
- Bar chart shows every non-zero series including a **negative** cash/bank balance
  (that is real). "No data available" only when every series is genuinely 0.
- Pie ("Branch Mix") charts **positive magnitudes only** — a negative balance has
  no slice — and shows its own "No data" state when nothing is positive (this was
  the blank-pie cause).
- Charts render **only after mount** — recharts' `ResponsiveContainer` measures
  its parent post-layout; a 0×0 first paint otherwise left a permanently blank
  SVG. Same guard added to the country dashboard.
- `app/dashboard/city/page.tsx`: **each aggregate query resolves independently** —
  one failing / lagging query (a missing column, a permission quirk) no longer
  zeroes the whole dashboard; it logs a per-query warning and contributes 0 for
  its own metric only.

**Browser-verified on Local (DEV) for all three roles:**

| Role | Result |
|---|---|
| Branch Admin (Chaman city branch) | bar (Purchases 11,720 up · Cash −3,000 down · Sales/Bank 0) + pie render with real data |
| Super Admin (branch switcher) | Chaman → charts render; Mumbai (all-zero branch) → both charts show "No data available" (inbox icon, not a blank SVG) |
| Country Admin (Pakistan) | Purchase Overview area chart renders (~PKR 219k); Sales Overview + Top Branches → "No data available" |

## Not done / remaining

- Per-language browser screenshots of the widget in PS / FA / AR (EN + UR verified;
  same code path + the 47 keys are present in all 5 blocks — `i18n:guard` green).
- Device-grid screenshots of the widget specifically (the panel is `max-w-[380px]`,
  `w-[92vw]`, `h-[70vh]` so it fits a phone; not yet shot at every breakpoint).
- `GOOGLE_TRANSLATE_API_KEY` not set on DEV → live message translation uses the crude
  dictionary tier. Owner must add the key for real MT.
- EPS/Production: migration `20261012` + code not deployed (see deploy blocker in
  `account-setup-and-universal-print-closure.md`).
