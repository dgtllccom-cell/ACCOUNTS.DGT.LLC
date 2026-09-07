-- Customer Auto-Reply — 5-language editable replies from the Customers module.
--
-- Reuses the existing return-sms-reply / communication_* pipeline. Adds:
--   * a 5th language column (Arabic) to reply templates,
--   * Arabic to the conversation language CHECK,
--   * honest outbound status values ('queued', 'no_channel') so a reply is
--     never marked "sent" when no email/WhatsApp channel is configured,
--   * direct customer linkage + the language a reply was sent in, on both the
--     outbound message row and the audit log,
--   * a per-customer preferred reply language (falls back to
--     customers.original_language_code, then 'en').
--
-- Additive and idempotent. No data is deleted or rewritten.

begin;

-- 1) 5th language for reply templates -----------------------------------------
alter table public.communication_templates
  add column if not exists body_ar text not null default '';

-- Idempotent seeding needs a stable key.
create unique index if not exists communication_templates_code_key
  on public.communication_templates (code);

-- 2) Arabic in the conversation language CHECK --------------------------------
alter table public.communication_conversations
  drop constraint if exists communication_conversations_message_language_check;
alter table public.communication_conversations
  add constraint communication_conversations_message_language_check
  check (
    message_language is null
    or (message_language)::text = any (array['en','ur','ps','fa','ar'])
  );

-- 3) Honest outbound status --------------------------------------------------
--    'queued'     = accepted, waiting on a delivery channel to be configured
--    'no_channel' = there is no email/WhatsApp channel for this scope at all
alter table public.communication_messages
  drop constraint if exists communication_messages_status_check;
alter table public.communication_messages
  add constraint communication_messages_status_check
  check (
    (status)::text = any (array[
      'sent','delivered','read','failed','pending','replied',
      'awaiting_approval','queued','no_channel'
    ])
  );

-- 4) Customer linkage + reply language on the outbound record ----------------
alter table public.communication_messages
  add column if not exists customer_id uuid references public.customers(id);
alter table public.communication_messages
  add column if not exists reply_language varchar(8);

create index if not exists communication_messages_customer_id_idx
  on public.communication_messages (customer_id)
  where customer_id is not null;

-- 5) Audit log: which language the reply went out in ------------------------
alter table public.communication_audit_logs
  add column if not exists reply_language varchar(8);
alter table public.communication_audit_logs
  add column if not exists customer_id uuid references public.customers(id);

-- 6) Per-customer preferred reply language ---------------------------------
alter table public.customers
  add column if not exists preferred_reply_language varchar(8);

comment on column public.customers.preferred_reply_language is
  'Language the customer prefers to receive replies in (en|ur|ps|fa|ar). '
  'Falls back to original_language_code, then en.';

commit;
