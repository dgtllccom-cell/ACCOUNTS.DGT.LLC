-- Migration: 20261021_customer_inquiries.sql
-- ONLINE CUSTOMER INQUIRY / MEETING RECORD SYSTEM
--
-- Mobile/desktop capture of a customer inquiry or meeting: customer + company +
-- contact details, business type, meeting/inquiry notes, requirements, follow-up
-- date, assigned user, status, attachments, and a full Inquiry Register.
--
-- AI voice/text entry: the raw text/transcript is kept on the row (ai_raw_input);
-- a local heuristic extractor turns it into the structured draft the user
-- previews & confirms before Save. AI never writes the final row directly.
--
-- Workflow:  new -> ai_draft -> confirmed -> in_progress -> follow_up
--            -> customer_approved -> converted   (also: closed / lost)
--
-- 5-language: ONE original row (original_language_code). Translated free-text
-- fields resolve through the central `record_translations` table (registered in
-- lib/i18n/translatable-fields.ts). "View Original" bypasses localisation.
--
-- If the customer already exists it is LINKED (customer_id) — never duplicated.
-- On "Convert" the inquiry can create / attach a customers row and, where
-- appropriate, a follow-up in the existing user_tasks module (linked_task_id).
--
-- Scoped by the existing Country / Branch / Role model (enforced server-side).
-- Additive & idempotent. No existing table is altered.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.customer_inquiry_no_seq;

-- ─────────────────────────────────────────────────────────────────────────────
-- customer_inquiries
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_inquiries (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_no             text UNIQUE,

  -- scope (admin oversight / filtering) — resolved from the creator/assignee
  country_id             uuid REFERENCES public.countries(id),
  country_branch_id      uuid REFERENCES public.country_branches(id),
  city_branch_id         uuid REFERENCES public.city_branches(id),

  -- link to an existing customer master (NEVER duplicate an existing customer)
  customer_id            uuid REFERENCES public.customers(id),
  is_existing_customer   boolean NOT NULL DEFAULT false,

  -- captured party details (used as-is when there is no linked customer)
  customer_name          text NOT NULL,
  company_name           text,
  contact_person         text,
  mobile                 text,
  whatsapp               text,
  email                  text,
  address                text,

  -- inquiry content (the free-text fields are the translatable ones)
  business_type          text,
  inquiry_summary        text,          -- short structured one-liner (AI or user)
  meeting_notes          text,          -- what was discussed
  requirements           text,          -- what the customer needs
  source                 text NOT NULL DEFAULT 'meeting'
                            CHECK (source IN ('meeting','phone','online','whatsapp','email','walk_in','referral','exhibition','other')),

  inquiry_date           date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  follow_up_date         date,

  assigned_to            uuid,          -- ERP user responsible for follow-up

  status                 text NOT NULL DEFAULT 'new'
                            CHECK (status IN ('new','ai_draft','confirmed','in_progress','follow_up','customer_approved','converted','closed','lost')),

  -- AI capture
  ai_raw_input           text,          -- the spoken transcript / typed notes
  ai_confidence          numeric(4,3),  -- 0..1 from the local extractor
  entry_mode             text NOT NULL DEFAULT 'manual'
                            CHECK (entry_mode IN ('manual','ai_text','ai_voice')),

  original_language_code text NOT NULL DEFAULT 'en'
                            CHECK (original_language_code IN ('en','ur','ps','fa','ar')),

  -- customer approval (the customer confirms the recorded requirement)
  customer_approval_status text NOT NULL DEFAULT 'pending'
                            CHECK (customer_approval_status IN ('pending','approved','declined','not_required')),
  customer_approved_at    timestamptz,
  customer_approved_note   text,

  -- links out
  linked_task_id         uuid REFERENCES public.user_tasks(id),   -- follow-up task
  converted_customer_id  uuid REFERENCES public.customers(id),    -- set on Convert
  converted_at           timestamptz,

  status_note            text,
  confirmed_at           timestamptz,
  closed_at              timestamptz,
  lost_reason            text,

  created_by             uuid NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customer_inquiries_scope
  ON public.customer_inquiries (country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_assignee
  ON public.customer_inquiries (assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_creator
  ON public.customer_inquiries (created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_customer
  ON public.customer_inquiries (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_status
  ON public.customer_inquiries (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_followup
  ON public.customer_inquiries (follow_up_date) WHERE deleted_at IS NULL AND follow_up_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- customer_inquiry_attachments  (Supabase Storage bucket 'erp-documents')
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_inquiry_attachments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id     uuid NOT NULL REFERENCES public.customer_inquiries(id) ON DELETE CASCADE,
  file           jsonb NOT NULL,        -- { storageKey, storageProvider }
  name           text NOT NULL,
  kind           text,                  -- 'card' | 'quote' | 'photo' | 'doc' | ...
  content_type   text,
  size_bytes     bigint,
  uploaded_by    uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_customer_inquiry_attachments_inquiry
  ON public.customer_inquiry_attachments (inquiry_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- customer_inquiry_events  (audit history)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_inquiry_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   uuid NOT NULL REFERENCES public.customer_inquiries(id) ON DELETE CASCADE,
  actor_id     uuid,
  actor_name   text,
  event_type   text NOT NULL,           -- created | ai_draft | confirmed | status | note | attachment | linked_customer | followup_task | customer_approval | converted
  from_status  text,
  to_status    text,
  note         text,
  meta         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_inquiry_events_inquiry
  ON public.customer_inquiry_events (inquiry_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- triggers: updated_at + inquiry_no + guaranteed 'created' history row
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customer_inquiries_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_customer_inquiries_touch ON public.customer_inquiries;
CREATE TRIGGER trg_customer_inquiries_touch
  BEFORE UPDATE ON public.customer_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.customer_inquiries_touch();

CREATE OR REPLACE FUNCTION public.customer_inquiries_assign_no()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.inquiry_no IS NULL OR NEW.inquiry_no = '' THEN
    NEW.inquiry_no := 'INQ-' || to_char(now(), 'YYYYMMDD') || '-' ||
                      lpad(nextval('public.customer_inquiry_no_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_customer_inquiries_assign_no ON public.customer_inquiries;
CREATE TRIGGER trg_customer_inquiries_assign_no
  BEFORE INSERT ON public.customer_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.customer_inquiries_assign_no();

CREATE OR REPLACE FUNCTION public.customer_inquiries_seed_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.customer_inquiry_events (inquiry_id, actor_id, event_type, to_status, note)
  VALUES (NEW.id, NEW.created_by, 'created', NEW.status, NEW.customer_name);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_customer_inquiries_seed_history ON public.customer_inquiries;
CREATE TRIGGER trg_customer_inquiries_seed_history
  AFTER INSERT ON public.customer_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.customer_inquiries_seed_history();

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime nudge (optional — same pattern as User Tasks / DGT Connect)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_inquiries; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_inquiry_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

COMMIT;
