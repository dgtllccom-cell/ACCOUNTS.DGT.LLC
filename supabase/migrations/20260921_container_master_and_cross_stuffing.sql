-- Container Master + Cross-Stuffing data model.
--
-- Investigated first whether any existing structure could support cross-
-- stuffing (a many-to-many truck<->container goods transfer at a warehouse):
-- truck_loadings is flat (one truck, one goods line, free-text destination,
-- no container link); clearing_customer_order_loading_allocations is an
-- order-level warehouse/quantity breakdown, not truck<->container instance
-- level; shipping_bl_records is one container = one BL record with no
-- per-truck breakdown. None of them fit — this is a genuine gap, not a
-- rediscovery of something that already exists.
--
-- Root cause of why nothing could anchor to a real "container": there was no
-- first-class container entity at all. container_number is duplicated as
-- free text independently in shipping_bl_records (Shipping Line) and
-- clearing_customer_order_legs (Clearing Agent), with no link between them.
-- Owner decision: build a shared Container Master (over scoping to just one
-- of the two existing modules) so both link to the same real container.
--
-- This migration adds the MODEL only (master table + link columns on the two
-- existing modules + the cross-stuffing event/line tables) — no API routes
-- or UI. Reuses trucks/warehouses/goods/goods_variations; does not duplicate
-- any of them.

BEGIN;

-- 1) Container Master — first-class entity, linkable from any module that
--    currently only has a free-text container_number.
CREATE TABLE IF NOT EXISTS public.containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_number text NOT NULL,
  container_type text,
  seal_number text,
  warehouse_id uuid REFERENCES public.warehouses(id),
  status text NOT NULL DEFAULT 'active',
  country_id uuid REFERENCES public.countries(id),
  country_branch_id uuid REFERENCES public.country_branches(id),
  city_branch_id uuid REFERENCES public.city_branches(id),
  remarks text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS containers_number_idx
  ON public.containers (lower(container_number))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS containers_scope_idx
  ON public.containers (country_id, country_branch_id, city_branch_id)
  WHERE deleted_at IS NULL;

-- 2) Link the two existing free-text-only modules to the new master. Nullable,
--    additive — existing container_number free-text columns are untouched,
--    so nothing existing breaks; new/edited records can adopt container_id.
ALTER TABLE public.shipping_bl_records
  ADD COLUMN IF NOT EXISTS container_id uuid REFERENCES public.containers(id);
ALTER TABLE public.clearing_customer_order_legs
  ADD COLUMN IF NOT EXISTS container_id uuid REFERENCES public.containers(id);
CREATE INDEX IF NOT EXISTS shipping_bl_records_container_idx
  ON public.shipping_bl_records (container_id) WHERE container_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS clearing_customer_order_legs_container_idx
  ON public.clearing_customer_order_legs (container_id) WHERE container_id IS NOT NULL;

-- 3) Cross-stuffing: one event per physical transfer at a warehouse, N goods
--    lines per event, each line sourced from a specific truck/loading record.
CREATE TABLE IF NOT EXISTS public.cross_stuffing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.containers(id),
  warehouse_id uuid REFERENCES public.warehouses(id),
  event_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'draft',
  country_id uuid REFERENCES public.countries(id),
  country_branch_id uuid REFERENCES public.country_branches(id),
  city_branch_id uuid REFERENCES public.city_branches(id),
  remarks text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS cross_stuffing_events_container_idx
  ON public.cross_stuffing_events (container_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cross_stuffing_events_scope_idx
  ON public.cross_stuffing_events (country_id, country_branch_id, city_branch_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.cross_stuffing_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.cross_stuffing_events(id) ON DELETE CASCADE,
  source_truck_id uuid REFERENCES public.trucks(id),
  source_truck_loading_id uuid REFERENCES public.truck_loadings(id),
  goods_id uuid REFERENCES public.goods(id),
  goods_variation_id uuid REFERENCES public.goods_variations(id),
  quantity numeric(18,4) NOT NULL DEFAULT 0,
  unit text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cross_stuffing_lines_event_idx
  ON public.cross_stuffing_lines (event_id);

-- 4) RLS — same reusable helpers and pattern as every other scoped table in
--    this codebase (see 0017_shipping_bl_records.sql).
ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_stuffing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_stuffing_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS containers_scope_read ON public.containers;
CREATE POLICY containers_scope_read ON public.containers FOR SELECT
  USING (
    is_super_admin()
    OR (country_id IS NOT NULL AND can_access_country(country_id))
    OR (country_branch_id IS NOT NULL AND can_access_country_branch(country_branch_id))
    OR (city_branch_id IS NOT NULL AND can_access_city_branch(city_branch_id))
  );
DROP POLICY IF EXISTS containers_scope_write ON public.containers;
CREATE POLICY containers_scope_write ON public.containers FOR ALL
  USING (
    is_super_admin()
    OR (country_id IS NOT NULL AND can_manage_country(country_id))
    OR (country_branch_id IS NOT NULL AND can_access_country_branch(country_branch_id))
    OR (city_branch_id IS NOT NULL AND can_access_city_branch(city_branch_id))
  )
  WITH CHECK (
    is_super_admin()
    OR (country_id IS NOT NULL AND can_manage_country(country_id))
    OR (country_branch_id IS NOT NULL AND can_access_country_branch(country_branch_id))
    OR (city_branch_id IS NOT NULL AND can_access_city_branch(city_branch_id))
  );

DROP POLICY IF EXISTS cross_stuffing_events_scope_read ON public.cross_stuffing_events;
CREATE POLICY cross_stuffing_events_scope_read ON public.cross_stuffing_events FOR SELECT
  USING (
    is_super_admin()
    OR (country_id IS NOT NULL AND can_access_country(country_id))
    OR (country_branch_id IS NOT NULL AND can_access_country_branch(country_branch_id))
    OR (city_branch_id IS NOT NULL AND can_access_city_branch(city_branch_id))
  );
DROP POLICY IF EXISTS cross_stuffing_events_scope_write ON public.cross_stuffing_events;
CREATE POLICY cross_stuffing_events_scope_write ON public.cross_stuffing_events FOR ALL
  USING (
    is_super_admin()
    OR (country_id IS NOT NULL AND can_manage_country(country_id))
    OR (country_branch_id IS NOT NULL AND can_access_country_branch(country_branch_id))
    OR (city_branch_id IS NOT NULL AND can_access_city_branch(city_branch_id))
  )
  WITH CHECK (
    is_super_admin()
    OR (country_id IS NOT NULL AND can_manage_country(country_id))
    OR (country_branch_id IS NOT NULL AND can_access_country_branch(country_branch_id))
    OR (city_branch_id IS NOT NULL AND can_access_city_branch(city_branch_id))
  );

DROP POLICY IF EXISTS cross_stuffing_lines_scope_all ON public.cross_stuffing_lines;
CREATE POLICY cross_stuffing_lines_scope_all ON public.cross_stuffing_lines FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.cross_stuffing_events e WHERE e.id = cross_stuffing_lines.event_id
      AND (is_super_admin()
        OR (e.country_id IS NOT NULL AND can_access_country(e.country_id))
        OR (e.country_branch_id IS NOT NULL AND can_access_country_branch(e.country_branch_id))
        OR (e.city_branch_id IS NOT NULL AND can_access_city_branch(e.city_branch_id)))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cross_stuffing_events e WHERE e.id = cross_stuffing_lines.event_id
      AND (is_super_admin()
        OR (e.country_id IS NOT NULL AND can_manage_country(e.country_id))
        OR (e.country_branch_id IS NOT NULL AND can_access_country_branch(e.country_branch_id))
        OR (e.city_branch_id IS NOT NULL AND can_access_city_branch(e.city_branch_id)))
  ));

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20260921_container_master_and_cross_stuffing', 'applied')
ON CONFLICT (name) DO UPDATE SET status='applied', applied_at=NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
