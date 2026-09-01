# AI Receptionist / Calling — Architecture & Owner Action

Status: **DESIGN ONLY — not built.** This is the one ERP-improvement area with no existing
implementation (confirmed by audit 2026-09-01: no telephony code, no call tables, no
provider SDK anywhere in the repo). Every other improvement area — Barcode & Stock Control,
Low-Stock / Re-order, VAT/Tax, Backup & Recovery, Document AI, CRM AI — already exists and
was audited/extended in place.

Building an AI receptionist requires a **paid external telephony provider plus API
credentials plus at least one phone number**, none of which can be created or paid for from
this environment. So the work stops at a verified design + a precise Owner Action list.

---

## What "AI Receptionist / Calling" means here

Two capabilities, sharing one call spine:

1. **Inbound AI Receptionist** — a caller dials the company number; an AI agent answers in
   the caller's language (EN/UR/PS/FA/AR), identifies the caller against the Customer
   Master, answers routine questions (order status, outstanding balance, office hours,
   branch address), captures a message or a callback request, and files it as a
   **Customer Inquiry** (existing module, `features/customer-inquiry/`) + optionally a
   **User Task** follow-up (existing module, migration 20261018).

2. **Outbound Calling** — staff or a scheduled job triggers a call (payment reminder,
   delivery confirmation, KYC-document chase). The AI places the call, speaks a script
   filled from real ERP data, records the outcome, and writes it back to the same
   Customer Inquiry / User Task / Ledger-note surface.

Everything the AI says is **read from the ERP** and everything it hears is **written back
into existing modules** — no new parallel CRM, matching the golden rule (reuse, don't
duplicate).

---

## Reuse map (what already exists and will be wired, not rebuilt)

| Need | Existing ERP asset |
|---|---|
| Caller ↔ customer identity | `customers` master + `customers-repository` phone search |
| "What's my balance / order status" | `/api/erp/parties/360-summary`, ledger + outstanding-recovery services |
| Message / meeting capture | **Customer Inquiry module** (`features/customer-inquiry/`, migration 20261021) — already has local voice/text extractor + 5-lang translated views |
| Follow-up action | **User Tasks / Work Order module** (migration 20261018) |
| Language + RTL | central i18n (`lib/i18n/ui.ts`), `translateErp()` pipeline |
| Transcription → structured fields | existing local extractor in `ai-voice-text-entry.tsx` (no LLM key needed) |
| Permissions / scope | `requireErpSession`, `authorizeApiScope`, Country/Branch scope middleware |
| Audit | `auditApiAction` |

New surface required: a **call log** (`ai_calls`, `ai_call_events`) and a thin
**provider adapter** — that is the entire net-new footprint.

---

## Proposed architecture (provider-agnostic)

```
                inbound PSTN / outbound trigger
                              │
                    ┌─────────▼──────────┐
                    │  Telephony provider │  (Twilio / Vonage / Telnyx / Plivo)
                    │  – SIP/PSTN number  │
                    │  – media streaming  │
                    │  – STT + TTS        │
                    └─────────┬──────────┘
                     webhook (signed)   media (WS)
                              │
              ┌───────────────▼─────────────────┐
              │  app/api/erp/ai-calls/webhook    │  Next.js route
              │  – verify provider signature     │
              │  – load/create ai_calls row      │
              │  – resolve caller → customer     │
              │  – dialogue policy (per lang)    │
              │  – tool calls into ERP services  │
              └───────────────┬─────────────────┘
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
  customer_inquiries     user_tasks            ai_calls / ai_call_events
  (message, transcript)  (callback follow-up)  (recording url, outcome, cost)
```

- **Dialogue policy**: deterministic intent router first (order-status / balance /
  hours / address / "speak to a person" / leave-message). Falls through to an LLM turn
  **only if** an AI provider key is configured — same self-gating pattern as
  `lib/i18n/ai-translation-client.ts` (`aiTranslate` returns null when unconfigured).
  With no LLM key the receptionist still works as a structured IVR + message taker.
- **STT/TTS**: use the telephony provider's built-in speech (Twilio `<Gather>` speech /
  Vonage ASR) so no second vendor is required for a v1.
- **Secrets**: `AI_CALL_PROVIDER`, `AI_CALL_ACCOUNT_SID`, `AI_CALL_AUTH_TOKEN`,
  `AI_CALL_NUMBER`, `AI_CALL_SIGNING_SECRET` — read from env only, never hard-coded,
  never logged. Route is inert (returns 503 "calling not configured") until all are set,
  mirroring the translator's dormant-until-keyed design.
- **Scope**: each `ai_calls` row stamped with `country_id` / `country_branch_id` from the
  dialed number's mapping, so call logs obey the same Country/Branch visibility as every
  other record.

### New migration (only when the owner green-lights the provider)

```
ai_call_number_map (id, phone_e164, country_id, country_branch_id, city_branch_id, purpose)
ai_calls           (id, direction, provider, provider_call_id, from_e164, to_e164,
                    customer_id, country_id, country_branch_id, language_code,
                    status, outcome, recording_url, transcript, duration_seconds,
                    cost_amount, cost_currency, inquiry_id, task_id, created_by, created_at)
ai_call_events     (id, call_id, at, kind, detail jsonb)          -- ring, answer, intent, handoff, hangup
```

Additive only. No change to any existing table. Recording URLs stored as provider
references; media itself stays with the provider (or is copied to the existing
`erp-documents` Supabase bucket if the owner wants retention in-house).

---

## OWNER ACTION (required before any code is written)

1. **Choose a telephony provider.** Recommended: **Twilio** (best multi-language speech,
   Programmable Voice + Media Streams, pay-as-you-go). Alternatives: Vonage, Telnyx, Plivo.
2. **Create the account and buy number(s).** One number per country/branch that should
   answer calls (e.g. one UAE number, one Pakistan number). Expect ~USD 1–5 / number /
   month + ~USD 0.01–0.04 / minute.
3. **Provide these values** (send them for the VPS `.env`, do **not** put them in chat if
   avoidable — load via the server env file):
   - `AI_CALL_PROVIDER=twilio`
   - `AI_CALL_ACCOUNT_SID=…`
   - `AI_CALL_AUTH_TOKEN=…`
   - `AI_CALL_NUMBER=+971…` (and any additional numbers → they map in `ai_call_number_map`)
   - `AI_CALL_SIGNING_SECRET=…` (Twilio request-validation / webhook signing)
4. **(Optional) LLM for free-form answers.** If you want the receptionist to handle
   open-ended questions beyond the fixed intents, also provide `AI_CALL_LLM_PROVIDER` +
   `AI_CALL_LLM_API_KEY` (Anthropic / OpenAI / Gemini). Without this it runs as a
   structured multilingual IVR + message taker.
5. **Confirm call-recording consent policy** per country (some jurisdictions require an
   announced "this call is recorded"). The greeting script will include it where you say so.
6. **Confirm data retention**: keep recordings at the provider, or copy into the ERP
   `erp-documents` bucket.

Once 1–3 are supplied, implementation is: 1 migration + 1 webhook route + 1 provider
adapter + dialogue policy + a "Calls" tab on the Customer Inquiry module + i18n keys ×5 +
E2E harness. Estimated ~2–3 working days after credentials land.

---

## Until then

- Inbound messages are already handled by the **Customer Inquiry** module (staff enter
  them; the local extractor structures them; 5-language translated views exist).
- Outbound reminders are already handled by **User Tasks** + the **Outstanding Recovery**
  report + the client-side `mailto:` / `wa.me` share hand-off in the print/PDF modal.

No functionality is missing for day-to-day operation — the AI receptionist is an
automation layer on top of surfaces that already work.
