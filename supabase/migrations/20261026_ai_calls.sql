-- ============================================================================
-- 20261026 — AI Receptionist / Calling — call spine
--
-- This is ONLY the call metadata + timeline. Everything a call produces
-- (message, requirement, follow-up) is written into the EXISTING modules:
--   - customer_inquiries  (source='phone', entry_mode='ai_voice', ai_raw_input=transcript)
--   - user_tasks          (callback / follow-up)
--   - customers            (identity match — never duplicated)
-- No new Customer / CRM / AI / Translator system is introduced.
--
-- The webhook route + provider adapter stay DORMANT until the owner supplies
-- telephony credentials (AI_CALL_* env). Until then these tables simply stay empty.
--
-- Additive & idempotent. No existing table is altered.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_call_number_map — which ERP scope answers which phone number, and why.
-- Owner-populated (Settings screen). One number can map to one country/branch.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_call_number_map (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164        text NOT NULL,
  label             text,
  country_id        uuid REFERENCES public.countries(id),
  country_branch_id uuid REFERENCES public.country_branches(id),
  city_branch_id    uuid REFERENCES public.city_branches(id),
  purpose           text NOT NULL DEFAULT 'reception'
                       CHECK (purpose IN ('reception','sales','support','collections','outbound')),
  default_language  text NOT NULL DEFAULT 'en'
                       CHECK (default_language IN ('en','ur','ps','fa','ar')),
  greeting_override text,
  announce_recording boolean NOT NULL DEFAULT true,
  -- ERP user who picks up inquiries/tasks this number generates (falls back to admin queue)
  assigned_to       uuid,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_call_number_map_phone_uidx
  ON public.ai_call_number_map (lower(btrim(phone_e164)));

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_calls — one row per call (inbound or outbound)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_calls (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction          text NOT NULL CHECK (direction IN ('inbound','outbound')),
  provider           text NOT NULL DEFAULT 'unset',
  provider_call_id   text,

  from_e164          text,
  to_e164            text,

  -- resolved context
  number_map_id      uuid REFERENCES public.ai_call_number_map(id),
  customer_id        uuid REFERENCES public.customers(id),
  country_id         uuid REFERENCES public.countries(id),
  country_branch_id  uuid REFERENCES public.country_branches(id),
  city_branch_id     uuid REFERENCES public.city_branches(id),
  language_code      text NOT NULL DEFAULT 'en'
                        CHECK (language_code IN ('en','ur','ps','fa','ar')),

  status             text NOT NULL DEFAULT 'ringing'
                        CHECK (status IN ('ringing','in_progress','completed','no_answer','busy','failed','voicemail','handed_off')),
  intent             text,               -- order_status | balance | hours | address | message | callback | agent | other
  outcome            text,               -- short human summary of what happened

  recording_url      text,               -- provider reference (media stays at provider unless owner opts in)
  transcript         text,               -- STT transcript (fed to the existing local extractor)
  duration_seconds   integer,
  cost_amount        numeric(12,4),
  cost_currency      text,

  -- write-backs into existing modules
  inquiry_id         uuid REFERENCES public.customer_inquiries(id),
  task_id            uuid,

  created_by         uuid,               -- staff member for an outbound call; null for inbound
  started_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_calls_started_idx        ON public.ai_calls (started_at DESC);
CREATE INDEX IF NOT EXISTS ai_calls_customer_idx       ON public.ai_calls (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_calls_country_idx        ON public.ai_calls (country_id);
CREATE UNIQUE INDEX IF NOT EXISTS ai_calls_provider_call_uidx
  ON public.ai_calls (provider, provider_call_id) WHERE provider_call_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_call_events — call timeline
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_call_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id    uuid NOT NULL REFERENCES public.ai_calls(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now(),
  kind       text NOT NULL,     -- ring | answer | prompt | dtmf | speech | intent | tool_call | handoff | hangup | error
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ai_call_events_call_idx ON public.ai_call_events (call_id, at);

-- updated_at touch
CREATE OR REPLACE FUNCTION public.tg_ai_calls_touch() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_calls_touch ON public.ai_calls;
CREATE TRIGGER trg_ai_calls_touch BEFORE UPDATE ON public.ai_calls
  FOR EACH ROW EXECUTE FUNCTION public.tg_ai_calls_touch();

DROP TRIGGER IF EXISTS trg_ai_call_number_map_touch ON public.ai_call_number_map;
CREATE TRIGGER trg_ai_call_number_map_touch BEFORE UPDATE ON public.ai_call_number_map
  FOR EACH ROW EXECUTE FUNCTION public.tg_ai_calls_touch();

COMMENT ON TABLE public.ai_calls IS
  'AI Receptionist call log. Call outputs are written into customer_inquiries / user_tasks / customers — this table is metadata + recording reference only.';

COMMIT;
