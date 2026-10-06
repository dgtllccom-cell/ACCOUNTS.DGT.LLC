-- RLS hardening batch 3 — closes the remaining 40 of 43 tables the security
-- advisor flagged as RLS-disabled (anon/authenticated PostgREST-readable) on
-- production, following the exact same reasoning and pattern already proven
-- safe in 20261003_prod_reconcile_rls_hardening.sql.
--
-- Verified per-table (not assumed) that every one of these 40 is reached ONLY
-- through this app's service-role paths — createSupabaseAdminClient() or the
-- raw withLocalPg/withReadPg Postgres connection (postgres.<project-ref> role,
-- which has BYPASSRLS) — never through the browser/anon Supabase client. So
-- enabling RLS with zero policies changes NO application behaviour: it only
-- closes the direct anon-key PostgREST read/write hole. Full per-table access
-- trace is in the security-review notes for this migration.
--
-- Deliberately EXCLUDES 3 tables from this batch: dgt_messages,
-- dgt_message_receipts, dgt_presence. Those ARE subscribed to directly by the
-- browser via Supabase Realtime (features/dgt-connect/use-dgt-connect.ts),
-- which evaluates RLS SELECT policies against the browser client's session —
-- zero-policy here would silently degrade live chat push to its polling
-- fallback rather than breaking it outright, but it's a real behaviour change
-- that needs a real SELECT policy (and confirming what auth.uid() actually
-- resolves to for this app's session model) before it ships, not a default-deny
-- bundled into an otherwise-safe batch. Tracked as a follow-up.
--
-- Fully idempotent and reversible (DISABLE ROW LEVEL SECURITY). No data touched.

BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_users','goods_master_parameters',
    'dgt_conversations','dgt_conversation_participants','dgt_message_translations',
    'erp_translation_memory','erp_translation_memory_audit',
    'user_tasks','user_task_attachments','user_task_events','user_task_notifications',
    'customer_inquiries','customer_inquiry_attachments','customer_inquiry_events',
    'business_edit_invoices','business_edit_invoice_lines','business_edit_invoice_versions','business_edit_invoice_events',
    'ai_call_number_map','ai_calls','ai_call_events',
    'consignment','consignment_container','consignment_container_good','consignment_expense',
    'consignment_sale','consignment_receipt','consignment_event',
    'erp_truck_master_options','temp_bill',
    'clearing_customer_order_legs','clearing_customer_order_loading_allocations',
    'invoice_template_defaults',
    'erp_email_account_audit','erp_public_mail_users',
    'public_mail_plans','public_mail_users','public_mail_verification_codes',
    'public_mail_messages','public_mail_audit_logs'
  ]
  LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- No CREATE POLICY statements follow: RLS on, zero policies = default-deny
-- for anon/authenticated. Service-role connections (this app's real access
-- path for all 40) are unaffected — RLS never applies to them.

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20260921_rls_hardening_batch3', 'applied')
ON CONFLICT (name) DO UPDATE SET status='applied', applied_at=NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
