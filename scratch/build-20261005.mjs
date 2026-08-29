import fs from "node:fs";
const SP = "C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project-ACCOUNTS-DGT-LLC/e2861670-e129-4e08-993a-9199b5bf57a6/scratchpad";

let dump = fs.readFileSync(SP + "/missing_tables.sql", "utf8");
dump = dump.split(/\r?\n/).filter(l => !/^(SET |SELECT pg_catalog|--)/.test(l)).join("\n");
// strip UAE-tax triggers (the UAE Tax module ships separately)
dump = dump.replace(/^CREATE TRIGGER \S*uae\S* [^;]+;/gim, "");
// strip CREATE POLICY blocks from the dump — the explicit idempotent block below owns them
dump = dump.split(/;\r?\n/).filter(stmt => !/^\s*CREATE POLICY/i.test(stmt)).join(";\n");
// make remaining CREATE TRIGGER idempotent
dump = dump.replace(/^CREATE TRIGGER (\w+) ([\s\S]*?) ON (public\.\w+)([\s\S]*?);/gm,
  (m, tg, mid, tbl, rest) => `DROP TRIGGER IF EXISTS ${tg} ON ${tbl};\nCREATE TRIGGER ${tg} ${mid} ON ${tbl}${rest};`);
dump = dump.replace(/^CREATE TABLE public\./gm, "CREATE TABLE IF NOT EXISTS public.");
dump = dump.replace(/^CREATE (UNIQUE )?INDEX /gm, (m, u) => `CREATE ${u || ""}INDEX IF NOT EXISTS `);
dump = dump.replace(/^ALTER TABLE ONLY public\.(\w+)\s*\n\s+ADD CONSTRAINT ([^\n]+);/gm,
  (m, t, c) => `DO $rc$ BEGIN\n  ALTER TABLE public.${t} ADD CONSTRAINT ${c};\nEXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $rc$;`);

const header = `-- Production schema reconciliation — objects with no migration provenance.
-- 8 tables that exist on the verified DEV target but were never created by any
-- migration file (crm_action_items, crm_followup_notes, daily_branch_summaries,
-- enterprise_audit_events, report_auto_email_configs, sales_order_items,
-- saved_reports, user_activity_events), plus audit columns on daily_usd_rates and
-- 4-level serial columns on shipping_lines. All additive / IF NOT EXISTS.
-- No data touched. UAE-tax tables are intentionally excluded (separate module).
-- Source: DEV project csesvyxxjivnkkozgopt, captured 2026-08-29.

BEGIN;

`;

const cols = `

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
`;

const footer = `
INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261005_prod_reconcile_missing_objects', 'applied')
ON CONFLICT (name) DO UPDATE SET status='applied', applied_at=NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
`;

fs.writeFileSync("supabase/migrations/20261005_prod_reconcile_missing_objects.sql", header + dump + cols + footer);
console.log("wrote 20261005 —", (header + dump + cols + footer).length, "bytes");
