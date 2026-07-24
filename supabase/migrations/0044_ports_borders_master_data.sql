-- 0044_ports_borders_master_data.sql
-- Update Country Official Names and Insert Master Data for Ports and Borders

-- 1. Update Countries Official Names
UPDATE public.countries SET name = 'Islamic Republic of Pakistan' WHERE iso2 = 'PK' OR name ILIKE 'Pakistan%';
UPDATE public.countries SET name = 'United Arab Emirates (UAE)' WHERE iso2 = 'AE' OR name ILIKE 'United Arab Emirates%';
UPDATE public.countries SET name = 'Islamic Republic of Afghanistan' WHERE iso2 = 'AF' OR name ILIKE 'Afghanistan%';
UPDATE public.countries SET name = 'Islamic Republic of Iran' WHERE iso2 = 'IR' OR name ILIKE 'Iran%';
UPDATE public.countries SET name = 'Republic of India' WHERE iso2 = 'IN' OR name ILIKE 'India%';

-- 2. Insert Ports and Borders helper block
DO $$
DECLARE
  pk_id UUID;
  ae_id UUID;
  af_id UUID;
  ir_id UUID;
  in_id UUID;
BEGIN
  -- Fetch Country IDs
  SELECT id INTO pk_id FROM public.countries WHERE name = 'Islamic Republic of Pakistan' LIMIT 1;
  SELECT id INTO ae_id FROM public.countries WHERE name = 'United Arab Emirates (UAE)' LIMIT 1;
  SELECT id INTO af_id FROM public.countries WHERE name = 'Islamic Republic of Afghanistan' LIMIT 1;
  SELECT id INTO ir_id FROM public.countries WHERE name = 'Islamic Republic of Iran' LIMIT 1;
  SELECT id INTO in_id FROM public.countries WHERE name = 'Republic of India' LIMIT 1;

  -- Insert Sea Ports
  IF pk_id IS NOT NULL THEN
    INSERT INTO public.ports (port_name, country_id, transport_type)
    SELECT n, pk_id, 'sea' FROM unnest(ARRAY[
      'Karachi Port', 'Port Qasim', 'Gwadar Port'
    ]) AS n
    WHERE NOT EXISTS (SELECT 1 FROM public.ports WHERE port_name = n AND country_id = pk_id AND transport_type = 'sea');
  END IF;

  IF ae_id IS NOT NULL THEN
    INSERT INTO public.ports (port_name, country_id, transport_type)
    SELECT n, ae_id, 'sea' FROM unnest(ARRAY[
      'Jebel Ali Port (Dubai)', 'Port Rashid (Dubai)', 'Khalifa Port (Abu Dhabi)',
      'Zayed Port (Abu Dhabi)', 'Khor Fakkan Port (Sharjah)', 'Fujairah Port'
    ]) AS n
    WHERE NOT EXISTS (SELECT 1 FROM public.ports WHERE port_name = n AND country_id = ae_id AND transport_type = 'sea');
  END IF;

  IF ir_id IS NOT NULL THEN
    INSERT INTO public.ports (port_name, country_id, transport_type)
    SELECT n, ir_id, 'sea' FROM unnest(ARRAY[
      'Bandar Abbas Port', 'Shahid Rajaee Port', 'Imam Khomeini Port',
      'Chabahar Port', 'Bushehr Port'
    ]) AS n
    WHERE NOT EXISTS (SELECT 1 FROM public.ports WHERE port_name = n AND country_id = ir_id AND transport_type = 'sea');
  END IF;

  IF in_id IS NOT NULL THEN
    INSERT INTO public.ports (port_name, country_id, transport_type)
    SELECT n, in_id, 'sea' FROM unnest(ARRAY[
      'Nhava Sheva (JNPT) Port', 'Mundra Port', 'Mumbai Port',
      'Chennai Port', 'Kandla (Deendayal) Port', 'Visakhapatnam Port'
    ]) AS n
    WHERE NOT EXISTS (SELECT 1 FROM public.ports WHERE port_name = n AND country_id = in_id AND transport_type = 'sea');
  END IF;

  -- Insert Road Borders
  IF pk_id IS NOT NULL THEN
    INSERT INTO public.ports (port_name, country_id, transport_type)
    SELECT n, pk_id, 'road' FROM unnest(ARRAY[
      'Torkham Border', 'Chaman Border', 'Ghulam Khan Border', 'Angoor Adda Border',
      'Taftan Border', 'Gabd-Rimdan Border', 'Wagah Border', 'Khokhrapar Border'
    ]) AS n
    WHERE NOT EXISTS (SELECT 1 FROM public.ports WHERE port_name = n AND country_id = pk_id AND transport_type = 'road');
  END IF;

  IF af_id IS NOT NULL THEN
    INSERT INTO public.ports (port_name, country_id, transport_type)
    SELECT n, af_id, 'road' FROM unnest(ARRAY[
      'Torkham (Pakistan)', 'Chaman/Spin Boldak (Pakistan)', 'Islam Qala (Iran)',
      'Abu Nasr Farahi (Iran)', 'Hairatan (Uzbekistan)', 'Sher Khan Bandar (Tajikistan)',
      'Aqina (Turkmenistan)', 'Torghundi (Turkmenistan)'
    ]) AS n
    WHERE NOT EXISTS (SELECT 1 FROM public.ports WHERE port_name = n AND country_id = af_id AND transport_type = 'road');
  END IF;

  IF ir_id IS NOT NULL THEN
    INSERT INTO public.ports (port_name, country_id, transport_type)
    SELECT n, ir_id, 'road' FROM unnest(ARRAY[
      'Taftan / Mirjaveh (Pakistan)', 'Rimdan / Gabd (Pakistan)',
      'Islam Qala (Afghanistan)', 'Abu Nasr Farahi (Afghanistan)'
    ]) AS n
    WHERE NOT EXISTS (SELECT 1 FROM public.ports WHERE port_name = n AND country_id = ir_id AND transport_type = 'road');
  END IF;

END $$;

INSERT INTO public.erp_schema_migrations (name, status, applied_at)
VALUES ('0044_ports_borders_master_data', 'applied', now())
ON CONFLICT (name) DO UPDATE
  SET status = excluded.status,
      applied_at = excluded.applied_at;

NOTIFY pgrst, 'reload schema';
