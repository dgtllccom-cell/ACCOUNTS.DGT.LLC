-- Person Master Phase 2 — Shipping Line & Clearing Agent masters.
--
-- Both are external organizations DGT doesn't own or manage (a shipping
-- line is a carrier like Maersk; a clearing agent may be an individual
-- customs broker or a firm) — standalone master tables, not forced into
-- Person Master or Company Master.
--
-- IMPORTANT: clearing_agents already exists live on this DB (confirmed via
-- information_schema before writing this) with 3 rows and is already
-- load-bearing for RBAC: user_role_assignments.clearing_agent_id,
-- shipping_line_records.clearing_agent_id, shipping_bl_records.clearing_
-- agent_id, and RLS policies can_access_clearing_agent()/
-- is_shipping_scoped_user() (20260818_shipping_clearing_rbac.sql). This
-- migration ALTERs it — never recreates it — and leaves its existing
-- free-text `code` column untouched (values like "DGT-CLEARING-HQ" are
-- still read by login-management's RBAC assignment UI); the new permanent
-- serial-generated identity lives in a separate `clearing_agent_code`
-- column instead.
--
-- shipping_agent_entries is referenced by existing code
-- (app/api/erp/shipping-line/agent-entry/route.ts,
-- features/shipping/components/shipping-agent-entry-view.tsx) but does not
-- exist on this DB at all (confirmed) — the GET handler silently swallows
-- the resulting error and returns an empty list, so that screen has been
-- non-functional. Created here, FK-first, alongside shipping_lines.

-- ============================================================
-- Part 1: new shipping_lines master.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shipping_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_line_code text,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  website text,
  country_id uuid REFERENCES public.countries(id),
  remarks text,
  name_en text,
  name_ur text,
  name_ar text,
  name_fa text,
  name_ps text,
  original_language_code text NOT NULL DEFAULT 'en' REFERENCES public.languages(code),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS shipping_lines_code_uidx
  ON public.shipping_lines (shipping_line_code)
  WHERE shipping_line_code IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shipping_lines_name_uidx
  ON public.shipping_lines (lower(name)) WHERE deleted_at IS NULL;

ALTER TABLE public.shipping_lines ENABLE ROW LEVEL SECURITY;

-- Mirrors clearing_agents' existing read-scope/super-admin-write split
-- (20260818_shipping_clearing_rbac.sql) so the two new masters follow the
-- same access model as the one this migration extends.
DROP POLICY IF EXISTS shipping_lines_read_scope ON public.shipping_lines;
CREATE POLICY shipping_lines_read_scope ON public.shipping_lines
  FOR SELECT USING (
    is_super_admin() OR (country_id IS NOT NULL AND can_access_country(country_id)) OR country_id IS NULL
  );

DROP POLICY IF EXISTS shipping_lines_super_admin_write ON public.shipping_lines;
CREATE POLICY shipping_lines_super_admin_write ON public.shipping_lines
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

COMMENT ON TABLE public.shipping_lines IS
  'Central ERP master. Do not free-text shipping_line_name where this FK is selectable — use ShippingLinePicker.';

-- ============================================================
-- Part 2: harden the EXISTING clearing_agents table. Additive only.
-- ============================================================
ALTER TABLE public.clearing_agents ADD COLUMN IF NOT EXISTS clearing_agent_code text;
ALTER TABLE public.clearing_agents
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.clearing_agents
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.clearing_agents ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE public.clearing_agents ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.clearing_agents ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.clearing_agents ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.clearing_agents ADD COLUMN IF NOT EXISTS name_ur text;
ALTER TABLE public.clearing_agents ADD COLUMN IF NOT EXISTS name_ar text;
ALTER TABLE public.clearing_agents ADD COLUMN IF NOT EXISTS name_fa text;
ALTER TABLE public.clearing_agents ADD COLUMN IF NOT EXISTS name_ps text;
ALTER TABLE public.clearing_agents
  ADD COLUMN IF NOT EXISTS original_language_code text NOT NULL DEFAULT 'en' REFERENCES public.languages(code);

CREATE UNIQUE INDEX IF NOT EXISTS clearing_agents_code_uidx
  ON public.clearing_agents (clearing_agent_code)
  WHERE clearing_agent_code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS clearing_agents_person_idx
  ON public.clearing_agents (person_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS clearing_agents_company_idx
  ON public.clearing_agents (company_id) WHERE deleted_at IS NULL;

-- An agent is an individual, a firm, or neither (a pure standalone agent
-- record) — never both at once.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clearing_agents_person_or_company_chk'
  ) THEN
    ALTER TABLE public.clearing_agents ADD CONSTRAINT clearing_agents_person_or_company_chk
      CHECK (NOT (person_id IS NOT NULL AND company_id IS NOT NULL));
  END IF;
END $$;

-- ============================================================
-- Part 3: shipping_line_id FK on the two existing shipping transaction
-- tables, parallel to their pre-existing clearing_agent_id.
-- ============================================================
ALTER TABLE public.shipping_line_records
  ADD COLUMN IF NOT EXISTS shipping_line_id uuid REFERENCES public.shipping_lines(id) ON DELETE SET NULL;
ALTER TABLE public.shipping_bl_records
  ADD COLUMN IF NOT EXISTS shipping_line_id uuid REFERENCES public.shipping_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shipping_line_records_line_idx
  ON public.shipping_line_records (shipping_line_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS shipping_bl_records_line_idx
  ON public.shipping_bl_records (shipping_line_id) WHERE deleted_at IS NULL;

-- ============================================================
-- Part 4: shipping_agent_entries — confirmed absent from this DB. Created
-- fresh, FK-first, keeping the free-text snapshot columns the existing
-- (currently no-op) API route already expects for display/print.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shipping_agent_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_code text,
  agent_name text NOT NULL,
  clearing_agent_id uuid REFERENCES public.clearing_agents(id) ON DELETE SET NULL,
  shipping_line_name text,
  shipping_line_id uuid REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  contact_person text,
  email text,
  phone text,
  city_name text,
  country_name text,
  status text NOT NULL DEFAULT 'active',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS shipping_agent_entries_clearing_agent_idx
  ON public.shipping_agent_entries (clearing_agent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS shipping_agent_entries_shipping_line_idx
  ON public.shipping_agent_entries (shipping_line_id) WHERE deleted_at IS NULL;

ALTER TABLE public.shipping_agent_entries ENABLE ROW LEVEL SECURITY;

-- No country_id to scope by on this table — gate both read and write by
-- super-admin, matching the safe default for an ungated master; broaden
-- later with an explicit scoping column if non-admin access is needed.
DROP POLICY IF EXISTS shipping_agent_entries_super_admin_all ON public.shipping_agent_entries;
CREATE POLICY shipping_agent_entries_super_admin_all ON public.shipping_agent_entries
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

NOTIFY pgrst, 'reload schema';
