-- 0040_create_ports_tables.sql
-- Create loading_ports and received_ports tables to support centralized Loading Port Master and Received Port Master.

-- 1. Create loading_ports table
CREATE TABLE IF NOT EXISTS public.loading_ports (
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

-- Indexes for loading_ports
CREATE INDEX IF NOT EXISTS idx_loading_ports_name ON public.loading_ports (port_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loading_ports_country_id ON public.loading_ports (country_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loading_ports_transport_type ON public.loading_ports (transport_type) WHERE deleted_at IS NULL;

-- Enable RLS for loading_ports
ALTER TABLE public.loading_ports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loading_ports_read ON public.loading_ports;
CREATE POLICY loading_ports_read ON public.loading_ports
  FOR SELECT USING (is_super_admin() OR country_id IS NULL OR can_access_country(country_id));

DROP POLICY IF EXISTS loading_ports_write ON public.loading_ports;
CREATE POLICY loading_ports_write ON public.loading_ports
  FOR ALL USING (is_super_admin() OR country_id IS NULL OR can_manage_country(country_id))
  WITH CHECK (is_super_admin() OR country_id IS NULL OR can_manage_country(country_id));


-- 2. Create received_ports table
CREATE TABLE IF NOT EXISTS public.received_ports (
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

-- Indexes for received_ports
CREATE INDEX IF NOT EXISTS idx_received_ports_name ON public.received_ports (port_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_received_ports_country_id ON public.received_ports (country_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_received_ports_transport_type ON public.received_ports (transport_type) WHERE deleted_at IS NULL;

-- Enable RLS for received_ports
ALTER TABLE public.received_ports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS received_ports_read ON public.received_ports;
CREATE POLICY received_ports_read ON public.received_ports
  FOR SELECT USING (is_super_admin() OR country_id IS NULL OR can_access_country(country_id));

DROP POLICY IF EXISTS received_ports_write ON public.received_ports;
CREATE POLICY received_ports_write ON public.received_ports
  FOR ALL USING (is_super_admin() OR country_id IS NULL OR can_manage_country(country_id))
  WITH CHECK (is_super_admin() OR country_id IS NULL OR can_manage_country(country_id));


-- 3. Notify schema reload
NOTIFY pgrst, 'reload schema';
