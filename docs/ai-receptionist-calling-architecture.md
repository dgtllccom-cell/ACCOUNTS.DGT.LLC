# AI Receptionist / Calling — Architecture, ERP-side build, Owner Action

## Status

**ERP side: BUILT and tested (DEV E2E 39/0). Telephony side: DORMANT — one Owner Action.**

The call spine, dialogue policy, provider adapter, webhook, register UI, 5-language
strings and DB schema are all in the repo and deployed. Nothing accepts a real call
until the owner supplies a telephony provider + credentials (below). Until then every
`ai_call*` table stays empty and the webhook returns `503`.

It **reuses** the existing Customer / CRM / AI / Translator systems — it does not add a
second one:

| Call output | Existing module reused |
|---|---|
| Caller identity | `public.customers` — matched by mobile/whatsapp digits, never duplicated (`matchCustomerByPhone`) |
| Message / requirement | `public.customer_inquiries` — `source='phone'`, `entry_mode='ai_voice'`, `ai_raw_input=transcript`, status `ai_draft` |
| Translated views of the inquiry | central `translateMasterRecord()` → `record_translations` (same as every other module) |
| Follow-up | `public.user_tasks` (`task_id` link) |
| Scope / visibility | resolved country/branch on the call row, filtered by the caller's `ErpSession` scope |

## What is in the repo

| Piece | File |
|---|---|
| DB schema (`ai_calls`, `ai_call_events`, `ai_call_number_map`) | `supabase/migrations/20261026_ai_calls.sql` — applied DEV + PROD |
| Env gating (dormant until keyed, never hard-codes secrets) | `lib/ai-receptionist/config.ts` |
| Deterministic 5-language dialogue policy (intent router: order / balance / hours / address / message / callback / agent) | `lib/ai-receptionist/dialogue.ts` — spoken phrases in `recept.*` (all 5 languages) |
| Provider-agnostic adapter + Twilio implementation (TwiML, `<Gather>`, `<Dial>` handoff, per-language voice locale, signature check) | `lib/ai-receptionist/provider.ts` |
| Call lifecycle service (open / event / finalize→inquiry / list / summary / number map) | `lib/ai-receptionist/service.ts` |
| Webhook (public, dormant, verifies signature, orchestrates dialogue) | `app/api/erp/ai-calls/webhook/route.ts` |
| Scoped read APIs | `app/api/erp/ai-calls/route.ts`, `app/api/erp/ai-calls/[id]/route.ts` |
| Owner number-map config API (Super Admin only) | `app/api/erp/ai-calls/number-map/route.ts` |
| Register UI (KPIs, dormant banner with the exact Owner Action, 5-language, RTL) | `features/ai-receptionist/components/ai-calls-register-view.tsx` → `/dashboard/customer-inquiries/calls` (nav: Customer Inquiries → **AI Calls**) |
| E2E | `scratch/ai-receptionist-e2e.mts` — 39/0 on DEV |

### Flow

```
 caller → telephony provider → POST /api/erp/ai-calls/webhook
    ├─ verify provider signature
    ├─ openInboundCall()  → ai_calls row, resolve number→country/branch, match caller→customer
    ├─ greet (recept.greeting, caller's language) + <Gather speech>
    ├─ each turn: detectIntent() → nextTurn() → provider markup
    │     • agent  → <Dial> AI_CALL_HANDOFF_NUMBER, mark handed_off
    │     • hours/address → answer from branch data, no inquiry
    │     • order/balance → safe answer, decline to disclose balance by phone
    │     • message/other → gather, then …
    └─ completed → finalizeCall()
          → customer_inquiries row (source=phone, ai_voice) assigned to the number's ERP user
          → central translation registration
          → ai_calls.status + recording_url + duration + inquiry_id
```

### LLM tier (optional)

With `AI_CALL_LLM_PROVIDER` + `AI_CALL_LLM_API_KEY` the dialogue can fall through to an
LLM turn for open-ended questions. Without it, it runs as a structured multilingual IVR
+ message-taker (fully functional). Same self-gating pattern as `lib/i18n/ai-translation-client.ts`.

---

## OWNER ACTION (the only thing left)

1. **Choose a provider.** Recommended **Twilio** (best multi-language `<Gather>` speech).
   Adapter interface is provider-agnostic — Vonage/Telnyx/Plivo can be added behind it.
2. **Create the account, buy number(s)** — one per country/branch that should answer
   (e.g. a UAE number, a Pakistan number). ~USD 1–5/number/month + ~USD 0.01–0.04/min.
3. **Set on the VPS `.env` (never in chat, never in code):**
   - `AI_CALL_PROVIDER=twilio`
   - `AI_CALL_ACCOUNT_SID=…`
   - `AI_CALL_AUTH_TOKEN=…`
   - `AI_CALL_NUMBER=+971…`
   - `AI_CALL_SIGNING_SECRET=…`  (Twilio request-validation)
   - `AI_CALL_HANDOFF_NUMBER=+971…`  (rings a human on "speak to an agent")
   - optional: `AI_CALL_LLM_PROVIDER` + `AI_CALL_LLM_API_KEY`
4. **Point the provider's Voice webhook** at `https://api.dgt.llc/api/erp/ai-calls/webhook`.
5. In the ERP: **Customer Inquiries → AI Calls** → (Super Admin) add each number to the
   **Answering Numbers** map (country/branch, default language, greeting, assigned user,
   recording announcement).
6. Confirm call-recording consent wording per country; confirm recording retention
   (keep at provider, or copy into the `erp-documents` bucket).

Once 1–4 are set the webhook goes live automatically — no code change.

## Until then

Inbound messages: staff enter them in **Customer Inquiries** (local voice/text
extractor structures them, 5-language translated views). Outbound reminders: **User
Tasks** + **Outstanding Recovery** + the `mailto:` / `wa.me` share hand-off. Nothing is
blocked for day-to-day operation.
