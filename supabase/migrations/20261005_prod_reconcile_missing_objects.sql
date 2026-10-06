-- Production schema reconciliation — objects with no migration provenance.
-- 8 tables that exist on the verified DEV target but were never created by any
-- migration file (crm_action_items, crm_followup_notes, daily_branch_summaries,
-- enterprise_audit_events, report_auto_email_configs, sales_order_items,
-- saved_reports, user_activity_events), plus audit columns on daily_usd_rates and
-- 4-level serial columns on shipping_lines. All additive / IF NOT EXISTS.
-- No data touched. UAE-tax tables are intentionally excluded (separate module).
-- Source: DEV project csesvyxxjivnkkozgopt, captured 2026-08-29.

BEGIN;







CREATE TABLE IF NOT EXISTS public.crm_action_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type character varying(50) NOT NULL,
    source_id character varying(255) NOT NULL,
    reference_no character varying(255) NOT NULL,
    party_name character varying(255) NOT NULL,
    due_date date NOT NULL,
    item_type character varying(50) NOT NULL,
    module character varying(50) NOT NULL,
    amount numeric(18,4) DEFAULT 0 NOT NULL,
    paid_amount numeric(18,4) DEFAULT 0 NOT NULL,
    remaining_amount numeric(18,4) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'PKR'::character varying NOT NULL,
    country_id character varying(255),
    country_name character varying(255),
    country_branch_id character varying(255),
    city_branch_id character varying(255),
    branch_name character varying(255),
    responsible_user_id character varying(255),
    responsible_user_name character varying(255),
    urgency_class character varying(50) DEFAULT 'due_today'::character varying NOT NULL,
    status character varying(50) DEFAULT 'Due Today'::character varying NOT NULL,
    last_follow_up timestamp with time zone,
    next_follow_up date,
    notes text,
    is_completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    completed_by character varying(255),
    global_serial character varying(100),
    country_serial character varying(100),
    branch_serial character varying(100),
    entry_serial character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE IF NOT EXISTS public.crm_followup_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crm_item_id uuid,
    user_id character varying(255) NOT NULL,
    user_name character varying(255) NOT NULL,
    user_role character varying(100),
    note_type character varying(50) DEFAULT 'Call Follow-Up'::character varying,
    note_text text NOT NULL,
    promise_date date,
    promise_amount numeric(18,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE IF NOT EXISTS public.daily_branch_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    summary_date date NOT NULL,
    country_id character varying(255),
    country_name character varying(255),
    city_branch_id character varying(255),
    branch_name character varying(255),
    total_credit numeric(18,4) DEFAULT 0,
    total_debit numeric(18,4) DEFAULT 0,
    total_purchases_count integer DEFAULT 0,
    total_purchases_amount numeric(18,4) DEFAULT 0,
    total_sales_count integer DEFAULT 0,
    total_sales_amount numeric(18,4) DEFAULT 0,
    total_payments_count integer DEFAULT 0,
    total_payments_amount numeric(18,4) DEFAULT 0,
    total_roznamcha_entries integer DEFAULT 0,
    total_cash_in numeric(18,4) DEFAULT 0,
    total_cash_out numeric(18,4) DEFAULT 0,
    total_loading_count integer DEFAULT 0,
    total_shipping_count integer DEFAULT 0,
    total_customers_count integer DEFAULT 0,
    total_suppliers_count integer DEFAULT 0,
    total_edited_count integer DEFAULT 0,
    total_deleted_count integer DEFAULT 0,
    active_users_count integer DEFAULT 0,
    failed_violations_count integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE IF NOT EXISTS public.enterprise_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id character varying(255) NOT NULL,
    reference_no character varying(255),
    action_type character varying(50) NOT NULL,
    version_number integer DEFAULT 1,
    diff_changes jsonb,
    previous_snapshot jsonb,
    current_snapshot jsonb,
    user_id character varying(255),
    user_name character varying(255),
    user_role character varying(100),
    country_id character varying(255),
    country_name character varying(255),
    city_branch_id character varying(255),
    branch_name character varying(255),
    ip_address character varying(100),
    device_session character varying(255),
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    module character varying(100),
    page_url text,
    session_id character varying(255),
    approval_reference character varying(255),
    edit_access_window character varying(100),
    approval_status character varying(50) DEFAULT 'Approved'::character varying,
    risk_level character varying(50) DEFAULT 'Low'::character varying,
    review_status character varying(50) DEFAULT 'Reviewed'::character varying,
    reviewer_comments text,
    party_name character varying(255),
    amount numeric(18,4),
    currency character varying(10),
    is_restored boolean DEFAULT false,
    restored_at timestamp with time zone,
    restored_by character varying(255),
    locked_status boolean DEFAULT false
);



CREATE TABLE IF NOT EXISTS public.report_auto_email_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    saved_report_id uuid NOT NULL,
    recipients jsonb NOT NULL,
    frequency text DEFAULT 'daily'::text NOT NULL,
    format text DEFAULT 'pdf'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_sent_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT report_auto_email_configs_format_check CHECK ((format = ANY (ARRAY['pdf'::text, 'excel'::text]))),
    CONSTRAINT report_auto_email_configs_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])))
);



CREATE TABLE IF NOT EXISTS public.sales_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sales_order_id uuid NOT NULL,
    row_serial integer,
    goods_name text,
    hs_code text,
    brand text,
    size text,
    quantity numeric(18,4),
    unit_name text,
    net_weight numeric(18,4),
    rate_original numeric(18,4),
    rate_local numeric(18,4),
    total_original numeric(18,4),
    total_local numeric(18,4),
    is_taxable boolean,
    tax_code_id uuid,
    vat_rate numeric(9,4),
    taxable_amount numeric(18,4),
    vat_amount numeric(18,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);



CREATE TABLE IF NOT EXISTS public.saved_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    module text NOT NULL,
    config jsonb NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);



CREATE TABLE IF NOT EXISTS public.user_activity_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(255) NOT NULL,
    user_name character varying(255),
    user_role character varying(100),
    country_id character varying(255),
    city_branch_id character varying(255),
    event_type character varying(100) NOT NULL,
    module_name character varying(100),
    page_url text,
    duration_seconds integer DEFAULT 0,
    ip_address character varying(100),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



DO $rc$ BEGIN
  ALTER TABLE public.crm_action_items ADD CONSTRAINT crm_action_items_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.crm_followup_notes ADD CONSTRAINT crm_followup_notes_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.daily_branch_summaries ADD CONSTRAINT daily_branch_summaries_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.daily_branch_summaries ADD CONSTRAINT daily_branch_summaries_summary_date_country_id_city_branch__key UNIQUE (summary_date, country_id, city_branch_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.enterprise_audit_events ADD CONSTRAINT enterprise_audit_events_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.report_auto_email_configs ADD CONSTRAINT report_auto_email_configs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.sales_order_items ADD CONSTRAINT sales_order_items_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.saved_reports ADD CONSTRAINT saved_reports_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.user_activity_events ADD CONSTRAINT user_activity_events_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



CREATE INDEX IF NOT EXISTS idx_audit_events_action ON public.enterprise_audit_events USING btree (action_type);



CREATE INDEX IF NOT EXISTS idx_audit_events_branch ON public.enterprise_audit_events USING btree (city_branch_id);



CREATE INDEX IF NOT EXISTS idx_audit_events_country ON public.enterprise_audit_events USING btree (country_id);



CREATE INDEX IF NOT EXISTS idx_audit_events_created ON public.enterprise_audit_events USING btree (created_at DESC);



CREATE INDEX IF NOT EXISTS idx_audit_events_deleted ON public.enterprise_audit_events USING btree (is_deleted);



CREATE INDEX IF NOT EXISTS idx_audit_events_deleted_at ON public.enterprise_audit_events USING btree (deleted_at DESC);



CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.enterprise_audit_events USING btree (entity_type, entity_id);



CREATE INDEX IF NOT EXISTS idx_audit_events_module ON public.enterprise_audit_events USING btree (module);



CREATE INDEX IF NOT EXISTS idx_audit_events_ref ON public.enterprise_audit_events USING btree (reference_no);



CREATE INDEX IF NOT EXISTS idx_audit_events_review ON public.enterprise_audit_events USING btree (review_status);



CREATE INDEX IF NOT EXISTS idx_audit_events_risk ON public.enterprise_audit_events USING btree (risk_level);



CREATE INDEX IF NOT EXISTS idx_audit_events_user ON public.enterprise_audit_events USING btree (user_id);



CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_action_items_unique_source ON public.crm_action_items USING btree (source_type, source_id);



CREATE INDEX IF NOT EXISTS idx_crm_items_completed ON public.crm_action_items USING btree (is_completed);



CREATE INDEX IF NOT EXISTS idx_crm_items_due_date ON public.crm_action_items USING btree (due_date);



CREATE INDEX IF NOT EXISTS idx_crm_items_party ON public.crm_action_items USING btree (party_name);



CREATE INDEX IF NOT EXISTS idx_crm_items_ref ON public.crm_action_items USING btree (reference_no);



CREATE INDEX IF NOT EXISTS idx_crm_items_scope_urgency ON public.crm_action_items USING btree (country_id, city_branch_id, urgency_class, due_date DESC);



CREATE INDEX IF NOT EXISTS idx_crm_items_type ON public.crm_action_items USING btree (item_type);



CREATE INDEX IF NOT EXISTS idx_crm_items_urgency ON public.crm_action_items USING btree (urgency_class);



CREATE INDEX IF NOT EXISTS idx_crm_notes_created ON public.crm_followup_notes USING btree (created_at DESC);



CREATE INDEX IF NOT EXISTS idx_crm_notes_item ON public.crm_followup_notes USING btree (crm_item_id);



CREATE INDEX IF NOT EXISTS idx_daily_summaries_branch ON public.daily_branch_summaries USING btree (city_branch_id);



CREATE INDEX IF NOT EXISTS idx_daily_summaries_country ON public.daily_branch_summaries USING btree (country_id);



CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON public.daily_branch_summaries USING btree (summary_date DESC);



CREATE INDEX IF NOT EXISTS idx_user_activity_created ON public.user_activity_events USING btree (created_at DESC);



CREATE INDEX IF NOT EXISTS idx_user_activity_module ON public.user_activity_events USING btree (module_name);



CREATE INDEX IF NOT EXISTS idx_user_activity_user ON public.user_activity_events USING btree (user_id);



CREATE INDEX IF NOT EXISTS report_auto_email_configs_saved_report_idx ON public.report_auto_email_configs USING btree (saved_report_id);



CREATE INDEX IF NOT EXISTS sales_order_items_order_idx ON public.sales_order_items USING btree (sales_order_id) WHERE (deleted_at IS NULL);



CREATE INDEX IF NOT EXISTS saved_reports_module_idx ON public.saved_reports USING btree (module);



CREATE INDEX IF NOT EXISTS saved_reports_user_idx ON public.saved_reports USING btree (user_id);



DROP TRIGGER IF EXISTS trg_enroll_translations ON public.saved_reports;
CREATE TRIGGER trg_enroll_translations AFTER INSERT OR UPDATE ON public.saved_reports FOR EACH ROW EXECUTE FUNCTION public.tg_enroll_translations();







DO $rc$ BEGIN
  ALTER TABLE public.crm_followup_notes ADD CONSTRAINT crm_followup_notes_crm_item_id_fkey FOREIGN KEY (crm_item_id) REFERENCES public.crm_action_items(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.report_auto_email_configs ADD CONSTRAINT report_auto_email_configs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.report_auto_email_configs ADD CONSTRAINT report_auto_email_configs_saved_report_id_fkey FOREIGN KEY (saved_report_id) REFERENCES public.saved_reports(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.sales_order_items ADD CONSTRAINT sales_order_items_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.sales_order_items ADD CONSTRAINT sales_order_items_tax_code_id_fkey FOREIGN KEY (tax_code_id) REFERENCES public.tax_codes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



DO $rc$ BEGIN
  ALTER TABLE public.saved_reports ADD CONSTRAINT saved_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;



ALTER TABLE public.crm_action_items ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.crm_followup_notes ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.daily_branch_summaries ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.enterprise_audit_events ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.report_auto_email_configs ENABLE ROW LEVEL SECURITY;



ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;



ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;



ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;




-- audit / serial columns missing on shared tables
ALTER TABLE public.daily_usd_rates ADD COLUMN IF NOT EXISTS branch_name text DEFAULT 'Pakistan Main Branch'::text;
ALTER TABLE public.daily_usd_rates ADD COLUMN IF NOT EXISTS rate_time text DEFAULT '09:00 AM'::text;
ALTER TABLE public.daily_usd_rates ADD COLUMN IF NOT EXISTS user_name text DEFAULT 'SUPER ADMIN'::text;
ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS branch_serial text;
ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS country_serial text;
ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS entry_serial text;
ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS super_admin_serial text;

-- RLS (DEV has all 8 tables RLS-enabled)
DO $rc$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['crm_action_items','crm_followup_notes','daily_branch_summaries','enterprise_audit_events','report_auto_email_configs','sales_order_items','saved_reports','user_activity_events'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t); END IF;
  END LOOP;
END $rc$;

DROP POLICY IF EXISTS report_auto_email_configs_owner_all ON public.report_auto_email_configs;
CREATE POLICY report_auto_email_configs_owner_all ON public.report_auto_email_configs FOR ALL
  USING (EXISTS (SELECT 1 FROM saved_reports sr WHERE sr.id = report_auto_email_configs.saved_report_id AND sr.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM saved_reports sr WHERE sr.id = report_auto_email_configs.saved_report_id AND sr.user_id = auth.uid()));
DROP POLICY IF EXISTS sales_order_items_all ON public.sales_order_items;
CREATE POLICY sales_order_items_all ON public.sales_order_items FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS saved_reports_owner_all ON public.saved_reports;
CREATE POLICY saved_reports_owner_all ON public.saved_reports FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS saved_reports_public_read ON public.saved_reports;
CREATE POLICY saved_reports_public_read ON public.saved_reports FOR SELECT USING (is_public = true);

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261005_prod_reconcile_missing_objects', 'applied')
ON CONFLICT (name) DO UPDATE SET status='applied', applied_at=NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
