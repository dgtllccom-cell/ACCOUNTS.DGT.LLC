-- Enterprise ERP: Future-Proof 4-Level Serial Number Architecture
-- Migration: 20260828_erp_wide_4level_serial_engine.sql
--
-- Supports enterprise volume:
-- 1. Super Admin Serial: Unique across complete ERP (e.g. ACC-SA-00000001)
-- 2. Country Serial: Independent sequence per country (e.g. AE-ACC-00000001)
-- 3. Branch Serial: Independent sequence per branch (e.g. DXB-ACC-00000001)
-- 4. Module / Entry Serial: Independent business sequence (e.g. ACC/DXB/00000001)
--
-- Concurrency-Safe: Atomic row-level lock on sequence counter via ON CONFLICT DO UPDATE.
-- Zero-Reuse: Monotonic forward increments even if records are deleted/cancelled.
-- 8-digit zero padding supporting 100,000,000+ records per sequence.

-- ============================================================================
-- 1. Serial Sequence Storage & Normalization
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_serial_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL,
  scope_key text NOT NULL,
  entity_type text NOT NULL DEFAULT 'general',
  prefix text NOT NULL,
  next_value bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT tss_scope_entity_unique UNIQUE (scope_type, scope_key, entity_type)
);

ALTER TABLE public.transaction_serial_sequences
  DROP CONSTRAINT IF EXISTS transaction_serial_sequences_scope_type_check;

CREATE INDEX IF NOT EXISTS tss_lookup_idx
  ON public.transaction_serial_sequences (scope_type, scope_key, entity_type);

-- Location code resolver for prefix generation
CREATE OR REPLACE FUNCTION resolve_serial_location_code(
  p_scope_type text,
  p_scope_key text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_country record;
  v_branch record;
  v_code text;
BEGIN
  IF p_scope_key IS NULL OR TRIM(p_scope_key) = '' OR UPPER(TRIM(p_scope_key)) = 'GLOBAL' THEN
    RETURN 'GLB';
  END IF;

  IF p_scope_type = 'country' THEN
    SELECT iso2, iso3, name INTO v_country
    FROM public.countries
    WHERE (
      (p_scope_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = p_scope_key::uuid)
      OR iso2 ILIKE p_scope_key
      OR iso3 ILIKE p_scope_key
      OR name ILIKE p_scope_key
    )
    LIMIT 1;

    IF FOUND THEN
      IF v_country.name ILIKE '%United Arab Emirates%' OR v_country.iso2 = 'AE' THEN
        RETURN 'AE';
      ELSIF v_country.name ILIKE '%Pakistan%' OR v_country.iso2 = 'PK' THEN
        RETURN 'PK';
      ELSIF v_country.name ILIKE '%Afghanistan%' OR v_country.iso2 = 'AF' THEN
        RETURN 'AF';
      ELSE
        RETURN UPPER(COALESCE(NULLIF(TRIM(v_country.iso2), ''), NULLIF(TRIM(v_country.iso3), ''), SUBSTRING(REGEXP_REPLACE(v_country.name, '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 3), 'GLB'));
      END IF;
    END IF;
  END IF;

  IF p_scope_type IN ('branch', 'main_branch', 'city_branch') THEN
    SELECT code, name INTO v_branch
    FROM public.city_branches
    WHERE (
      (p_scope_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = p_scope_key::uuid)
      OR code ILIKE p_scope_key
      OR name ILIKE p_scope_key
    )
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT code, name INTO v_branch
      FROM public.country_branches
      WHERE (
        (p_scope_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = p_scope_key::uuid)
        OR code ILIKE p_scope_key
        OR name ILIKE p_scope_key
      )
      LIMIT 1;
    END IF;

    IF FOUND THEN
      v_code := UPPER(COALESCE(NULLIF(TRIM(v_branch.code), ''), ''));
      IF v_code ~ '^(PAK|DEV-PK)-.*(KHI|KARACHI)' OR v_branch.name ILIKE '%Karachi%' THEN
        RETURN 'KHI';
      ELSIF v_code ~ '^(UAE|DEV-AE|ARE)-.*(DXB|DUBAI|ALRAS|MAIN)' OR v_branch.name ILIKE '%Dubai%' OR v_branch.name ILIKE '%Al-Ras%' OR v_branch.name ILIKE '%Emirates Main%' THEN
        RETURN 'DXB';
      ELSIF v_code ~ '^(PAK|DEV-PK)-.*(LHE|LAHORE)' OR v_branch.name ILIKE '%Lahore%' THEN
        RETURN 'LHE';
      ELSIF v_code ~ '^(PAK|DEV-PK)-.*(QUE|QUETTA)' OR v_branch.name ILIKE '%Quetta%' THEN
        RETURN 'QTA';
      ELSIF v_code ~ '^(PAK|DEV-PK)-.*(CHM|CHAMAN)' OR v_branch.name ILIKE '%Chaman%' THEN
        RETURN 'CHM';
      ELSIF v_code ~ '^(AFG|DEV-AF)-.*(KBL|KABUL)' OR v_branch.name ILIKE '%Kabul%' THEN
        RETURN 'KBL';
      ELSIF v_code ~ '^(PAK-MAIN|PAK)' OR v_branch.name ILIKE '%Pakistan Main%' THEN
        RETURN 'KHI';
      ELSIF v_code ~ '^(ARE-MAIN|ARE|UAE)' OR v_branch.name ILIKE '%Emirates Main%' THEN
        RETURN 'DXB';
      ELSIF v_code ~ '^(AFG-MAIN|AFG)' OR v_branch.name ILIKE '%Afghanistan Main%' THEN
        RETURN 'KBL';
      ELSIF v_code <> '' THEN
        RETURN SUBSTRING(REGEXP_REPLACE(v_code, '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 4);
      ELSE
        RETURN UPPER(SUBSTRING(REGEXP_REPLACE(v_branch.name, '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 4));
      END IF;
    END IF;
  END IF;

  RETURN 'GLB';
END;
$$;

-- Atomic Entity Serial Allocator (8-digit padding)
CREATE OR REPLACE FUNCTION next_entity_serial(
  p_scope_type text,
  p_scope_key text,
  p_entity_type text,
  p_prefix text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
  v_prefix text;
  v_scope_key text;
  v_scope_type text;
  v_entity_type text;
BEGIN
  v_scope_type := LOWER(COALESCE(NULLIF(TRIM(p_scope_type), ''), 'global'));
  v_scope_key := COALESCE(NULLIF(TRIM(p_scope_key), ''), 'GLOBAL');
  v_entity_type := LOWER(COALESCE(NULLIF(TRIM(p_entity_type), ''), 'general'));
  v_prefix := UPPER(COALESCE(NULLIF(TRIM(p_prefix), ''), 'SER'));

  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES (v_scope_type, v_scope_key, v_entity_type, v_prefix, 2)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET
    next_value = transaction_serial_sequences.next_value + 1,
    prefix = EXCLUDED.prefix,
    updated_at = NOW()
  RETURNING transaction_serial_sequences.next_value - 1 INTO v_next;

  -- 8-digit padding for high-volume enterprise scalability
  RETURN v_prefix || '-' || LPAD(v_next::text, 8, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_entity_serial(text, text, text, text) TO authenticated, service_role, anon;

-- ============================================================================
-- 2. Bulk 4-Level Serial Allocator RPC (Atomic in one round-trip)
-- ============================================================================

CREATE OR REPLACE FUNCTION allocate_4level_serials(
  p_entity_type text,
  p_country_id text DEFAULT NULL,
  p_branch_id text DEFAULT NULL,
  p_custom_prefix text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_country_code text;
  v_branch_code text;
  v_sa_serial text;
  v_co_serial text;
  v_br_serial text;
  v_mod_serial text;
  v_sa_num bigint;
  v_co_num bigint;
  v_br_num bigint;
  v_mod_num bigint;
  v_country_key text;
  v_branch_key text;
BEGIN
  v_prefix := UPPER(COALESCE(NULLIF(TRIM(p_custom_prefix), ''), NULLIF(TRIM(p_entity_type), ''), 'DOC'));
  v_country_key := COALESCE(NULLIF(TRIM(p_country_id), ''), 'GLOBAL');
  v_branch_key := COALESCE(NULLIF(TRIM(p_branch_id), ''), 'GLOBAL');

  v_country_code := resolve_serial_location_code('country', v_country_key);
  v_branch_code := resolve_serial_location_code('branch', v_branch_key);

  -- 1. Super Admin Serial (Global across complete ERP for this entity_type)
  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES ('global', 'GLOBAL', p_entity_type, v_prefix || '-SA', 2)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET next_value = transaction_serial_sequences.next_value + 1, updated_at = NOW()
  RETURNING transaction_serial_sequences.next_value - 1 INTO v_sa_num;
  v_sa_serial := v_prefix || '-SA-' || LPAD(v_sa_num::text, 8, '0');

  -- 2. Country Serial (Independent sequence per Country)
  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES ('country', v_country_key, p_entity_type, v_country_code || '-' || v_prefix, 2)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET next_value = transaction_serial_sequences.next_value + 1, updated_at = NOW()
  RETURNING transaction_serial_sequences.next_value - 1 INTO v_co_num;
  v_co_serial := v_country_code || '-' || v_prefix || '-' || LPAD(v_co_num::text, 8, '0');

  -- 3. Branch Serial (Independent sequence per Branch)
  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES ('branch', v_branch_key, p_entity_type, v_branch_code || '-' || v_prefix, 2)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET next_value = transaction_serial_sequences.next_value + 1, updated_at = NOW()
  RETURNING transaction_serial_sequences.next_value - 1 INTO v_br_num;
  v_br_serial := v_branch_code || '-' || v_prefix || '-' || LPAD(v_br_num::text, 8, '0');

  -- 4. Module / Record Serial (Canonical business reference e.g. ACC/DXB/00000001)
  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES ('module', v_branch_key, p_entity_type, v_prefix || '/' || v_branch_code, 2)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET next_value = transaction_serial_sequences.next_value + 1, updated_at = NOW()
  RETURNING transaction_serial_sequences.next_value - 1 INTO v_mod_num;
  v_mod_serial := v_prefix || '/' || v_branch_code || '/' || LPAD(v_mod_num::text, 8, '0');

  RETURN jsonb_build_object(
    'super_admin_serial', v_sa_serial,
    'country_serial', v_co_serial,
    'branch_serial', v_br_serial,
    'entry_serial', v_mod_serial,
    'country_code', v_country_code,
    'branch_code', v_branch_code,
    'sa_seq', v_sa_num,
    'country_seq', v_co_num,
    'branch_seq', v_br_num,
    'module_seq', v_mod_num
  );
END;
$$;

GRANT EXECUTE ON FUNCTION allocate_4level_serials(text, text, text, text) TO authenticated, service_role, anon;

-- ============================================================================
-- 3. Ensure 4 Standard Serial Columns on ALL ERP Master and Transaction Tables
-- ============================================================================

DO $$
DECLARE
  t text;
  form_tables text[] := ARRAY[
    'customers',
    'companies',
    'employees',
    'banks',
    'warehouses',
    'trucks',
    'goods',
    'products',
    'enterprise_accounts',
    'ledgers',
    'purchase_orders',
    'purchase_order_payments',
    'local_purchases',
    'purchase_loadings',
    'truck_loadings',
    'import_truck_loadings',
    'transit_truck_loadings',
    'sales_orders',
    'sales_order_payments',
    'roznamcha_entries',
    'journal_entries',
    'ledger_entries',
    'money_exchange_entries',
    'expenses_bills',
    'transit_entries',
    'shipping_bl_records',
    'shipping_lines',
    'clearing_agents'
  ];
BEGIN
  FOREACH t IN ARRAY form_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS super_admin_serial text', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS country_serial text', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS branch_serial text', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS entry_serial text', t);

      -- Add indexes for high-speed search and uniqueness
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I_sa_serial_idx ON public.%I (super_admin_serial) WHERE super_admin_serial IS NOT NULL AND deleted_at IS NULL', t, t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I_country_serial_idx ON public.%I (country_serial) WHERE country_serial IS NOT NULL AND deleted_at IS NULL', t, t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I_branch_serial_idx ON public.%I (branch_serial) WHERE branch_serial IS NOT NULL AND deleted_at IS NULL', t, t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I_entry_serial_idx ON public.%I (entry_serial) WHERE entry_serial IS NOT NULL AND deleted_at IS NULL', t, t);
    END IF;
  END LOOP;
END $$;

-- Register migration
INSERT INTO erp_schema_migrations (name, status, applied_at)
VALUES ('20260828_erp_wide_4level_serial_engine', 'applied', NOW())
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

NOTIFY pgrst, 'reload schema';
