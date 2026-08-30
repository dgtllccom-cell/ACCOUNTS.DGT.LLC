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

## Not done / remaining

- Per-language browser screenshots of the widget in PS / FA / AR (EN + UR verified;
  same code path + the 47 keys are present in all 5 blocks — `i18n:guard` green).
- Device-grid screenshots of the widget specifically (the panel is `max-w-[380px]`,
  `w-[92vw]`, `h-[70vh]` so it fits a phone; not yet shot at every breakpoint).
- `GOOGLE_TRANSLATE_API_KEY` not set on DEV → live message translation uses the crude
  dictionary tier. Owner must add the key for real MT.
- EPS/Production: migration `20261012` + code not deployed (see deploy blocker in
  `account-setup-and-universal-print-closure.md`).
