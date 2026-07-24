-- 0041_merge_ports.sql
-- Create ports table and convert loading_ports and received_ports into views pointing to it.

-- 1. Create public.ports table
CREATE TABLE IF NOT EXISTS public.ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  port_name TEXT NOT NULL,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  port_code TEXT,
  transport_type TEXT DEFAULT 'sea' CHECK (transport_type IN ('sea','road','air')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for ports
CREATE INDEX IF NOT EXISTS idx_ports_name ON public.ports (port_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ports_country_id ON public.ports (country_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ports_transport_type ON public.ports (transport_type) WHERE deleted_at IS NULL;

-- Enable RLS for ports
ALTER TABLE public.ports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ports_read ON public.ports;
CREATE POLICY ports_read ON public.ports
  FOR SELECT USING (is_super_admin() OR country_id IS NULL OR can_access_country(country_id));

DROP POLICY IF EXISTS ports_write ON public.ports;
CREATE POLICY ports_write ON public.ports
  FOR ALL USING (is_super_admin() OR country_id IS NULL OR can_manage_country(country_id))
  WITH CHECK (is_super_admin() OR country_id IS NULL OR can_manage_country(country_id));

-- 2. Migrate existing records from loading_ports if it exists as a table
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'loading_ports'
  ) AND NOT EXISTS (
    SELECT FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'loading_ports'
  ) THEN
    INSERT INTO public.ports (id, port_name, country_id, port_code, transport_type, is_active, created_by, created_at, updated_at, deleted_at)
    SELECT id, port_name, country_id, port_code, transport_type, is_active, created_by, created_at, updated_at, deleted_at 
    FROM public.loading_ports
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 3. Migrate existing records from received_ports if it exists as a table
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'received_ports'
  ) AND NOT EXISTS (
    SELECT FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'received_ports'
  ) THEN
    INSERT INTO public.ports (id, port_name, country_id, port_code, transport_type, is_active, created_by, created_at, updated_at, deleted_at)
    SELECT id, port_name, country_id, port_code, transport_type, is_active, created_by, created_at, updated_at, deleted_at 
    FROM public.received_ports
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 4. Drop original tables and recreate as views pointing to ports
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'loading_ports'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'loading_ports'
  ) THEN
    DROP TABLE IF EXISTS public.loading_ports CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'received_ports'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'received_ports'
  ) THEN
    DROP TABLE IF EXISTS public.received_ports CASCADE;
  END IF;
END $$;

-- 5. Create views pointing to ports with security invoker enabled
CREATE OR REPLACE VIEW public.loading_ports WITH (security_invoker = on) AS 
SELECT * FROM public.ports;

CREATE OR REPLACE VIEW public.received_ports WITH (security_invoker = on) AS 
SELECT * FROM public.ports;

NOTIFY pgrst, 'reload schema';
