-- RLS hardening — the 3 tables deliberately excluded from
-- 20260921_rls_hardening_batch3.sql: dgt_messages, dgt_message_receipts,
-- dgt_presence. Unlike the other 40 (service-role-only access, safe for
-- zero-policy default-deny), these are subscribed to directly by the
-- browser via Supabase Realtime (features/dgt-connect/use-dgt-connect.ts's
-- postgres_changes channel), which evaluates RLS SELECT policies against
-- the subscribing client's session.
--
-- Confirmed empirically (not assumed) that auth.uid() resolves correctly for
-- this app's logged-in users: app/api/erp/auth/login/route.ts calls
-- createServerSupabaseClient() (lib/supabase/server.ts, @supabase/ssr's
-- createServerClient) and performs a real supabase.auth.signInWithPassword()
-- against the matched profiles row, which sets real Supabase Auth session
-- cookies. The browser's createClientSupabaseClient() (lib/supabase/client.ts)
-- is the same @supabase/ssr createBrowserClient against the same project, so
-- it picks up that session automatically — auth.uid() is the real profiles.id
-- for any user who has logged in through the normal password flow (the demo-
-- auth bypass is confirmed disabled in production, ALLOW_DEMO_AUTH=false).
--
-- Server-side writes to all 3 tables already go through withLocalPg (service
-- role, bypasses RLS) — these policies only need to cover SELECT, for the
-- Realtime subscription to keep working under RLS.

BEGIN;

ALTER TABLE public.dgt_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dgt_message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dgt_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dgt_messages_participant_read ON public.dgt_messages;
CREATE POLICY dgt_messages_participant_read ON public.dgt_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.dgt_conversation_participants p
    WHERE p.conversation_id = dgt_messages.conversation_id
      AND p.user_id = auth.uid()
      AND p.left_at IS NULL
  ));

DROP POLICY IF EXISTS dgt_message_receipts_participant_read ON public.dgt_message_receipts;
CREATE POLICY dgt_message_receipts_participant_read ON public.dgt_message_receipts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.dgt_messages m
    JOIN public.dgt_conversation_participants p ON p.conversation_id = m.conversation_id
    WHERE m.id = dgt_message_receipts.message_id
      AND p.user_id = auth.uid()
      AND p.left_at IS NULL
  ));

-- Presence (online/typing status) is visible to any signed-in user, matching
-- how dgtCanReach()/dgtReachableUserIds (lib/dgt-connect/access.ts) already
-- treat reachability as an authenticated-user-wide concern, not per-conversation.
DROP POLICY IF EXISTS dgt_presence_authenticated_read ON public.dgt_presence;
CREATE POLICY dgt_presence_authenticated_read ON public.dgt_presence FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20260921_rls_hardening_dgt_connect', 'applied')
ON CONFLICT (name) DO UPDATE SET status='applied', applied_at=NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
