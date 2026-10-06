-- Migration: 20261012_dgt_connect.sql
-- DGT Connect — internal ERP live chat (user-to-user + group), scoped by the
-- existing Country / Branch / Role model, with per-message original-language
-- preservation and cached 5-language translated views.
--
-- Additive & idempotent. No existing table is altered destructively.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Conversations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dgt_conversations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct','group')),
  title              text,
  created_by         uuid NOT NULL,
  -- scope tag: where the conversation "belongs" (used for admin oversight / filtering).
  country_id         uuid,
  country_branch_id  uuid,
  city_branch_id     uuid,
  -- stable key for direct chats: sorted "uuidA:uuidB" — enforces one thread per pair.
  direct_key         text UNIQUE,
  last_message_at    timestamptz,
  last_message_preview text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dgt_conversation_participants (
  conversation_id  uuid NOT NULL REFERENCES public.dgt_conversations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL,
  role             text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  joined_at        timestamptz NOT NULL DEFAULT now(),
  last_read_at     timestamptz,
  muted            boolean NOT NULL DEFAULT false,
  left_at          timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dgt_participants_user
  ON public.dgt_conversation_participants (user_id) WHERE left_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Messages  (body is ALWAYS the original text; body_lang is the language it was
-- written in — never overwritten. Translations live in dgt_message_translations.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dgt_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.dgt_conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL,
  kind             text NOT NULL DEFAULT 'text'
                     CHECK (kind IN ('text','attachment','record_share','system')),
  body             text NOT NULL DEFAULT '',
  body_lang        text NOT NULL DEFAULT 'en',
  attachment       jsonb,           -- { name, mime, size, url } | { name, mime, size, dataUrl }
  shared_record    jsonb,           -- { module, id, label, route, summary }
  reply_to_id      uuid REFERENCES public.dgt_messages(id) ON DELETE SET NULL,
  edited_at        timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dgt_messages_conversation
  ON public.dgt_messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dgt_message_receipts (
  message_id    uuid NOT NULL REFERENCES public.dgt_messages(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  delivered_at  timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz,
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dgt_receipts_user_unread
  ON public.dgt_message_receipts (user_id) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.dgt_message_translations (
  message_id  uuid NOT NULL REFERENCES public.dgt_messages(id) ON DELETE CASCADE,
  lang        text NOT NULL CHECK (lang IN ('en','ur','ps','fa','ar')),
  text        text NOT NULL,
  engine      text NOT NULL DEFAULT 'machine',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, lang)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Presence  (one row per user; heartbeated by the client while the ERP is open)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dgt_presence (
  user_id                 uuid PRIMARY KEY,
  status                  text NOT NULL DEFAULT 'offline'
                            CHECK (status IN ('online','away','offline')),
  last_seen_at            timestamptz NOT NULL DEFAULT now(),
  typing_in_conversation  uuid,
  typing_since            timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger for conversations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dgt_touch_conversation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dgt_touch_conversation ON public.dgt_conversations;
CREATE TRIGGER trg_dgt_touch_conversation
  BEFORE UPDATE ON public.dgt_conversations
  FOR EACH ROW EXECUTE FUNCTION public.dgt_touch_conversation();

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: allow the browser client to receive change events (reads/writes are
-- still authorised server-side by the DGT Connect API — realtime is only a
-- "something changed, refetch" nudge, same pattern as the WhatsApp inbox).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dgt_messages;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dgt_message_receipts;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dgt_presence;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dgt_conversations;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261012_dgt_connect', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
