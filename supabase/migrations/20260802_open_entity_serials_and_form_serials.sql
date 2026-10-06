-- Centralized 4-serial architecture (Super Admin / Country / Branch / Entry).
-- Reuses the existing transaction_serial_sequences + next_entity_serial engine.
-- Change 1: relax entity_type so EVERY form/module gets its own independent
--           counters without a new migration each time (per ERP-wide rule).
-- Change 2: add the four serial columns to the truck master + loading forms.
-- Non-destructive, idempotent.

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
BEGIN
  IF p_scope_type NOT IN ('global', 'country', 'branch', 'main_branch', 'city_branch',
                           'module_roznamcha', 'module_purchase', 'module_loading', 'module_payment') THEN
    RAISE EXCEPTION 'Unsupported serial scope type: %', p_scope_type;
  END IF;

  -- Open entity_type: any non-empty identifier is allowed so every form/module
  -- (truck_loading, import_truck_loading, transit_truck_loading, truck, and all
  -- future modules) maintains its OWN independent serial counters.
  IF p_entity_type IS NULL OR trim(p_entity_type) = '' THEN
    RAISE EXCEPTION 'entity_type is required for serial allocation';
  END IF;

  v_scope_key := COALESCE(NULLIF(TRIM(p_scope_key), ''), 'global');
  v_prefix := normalize_transaction_serial_prefix(p_scope_type, v_scope_key, p_prefix);

  INSERT INTO transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES (p_scope_type, v_scope_key, p_entity_type, v_prefix, 2)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET
    next_value = transaction_serial_sequences.next_value + 1,
    prefix = EXCLUDED.prefix,
    updated_at = NOW()
  RETURNING transaction_serial_sequences.next_value - 1 INTO v_next;

  RETURN v_prefix || '-' || LPAD(v_next::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_entity_serial(text, text, text, text) TO authenticated, service_role;

-- Four serial columns on each form + the truck master.
do $$
declare t text;
begin
  foreach t in array array['trucks','truck_loadings','import_truck_loadings','transit_truck_loadings'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists super_admin_serial text', t);
      execute format('alter table public.%I add column if not exists country_serial text', t);
      execute format('alter table public.%I add column if not exists branch_serial text', t);
      execute format('alter table public.%I add column if not exists entry_serial text', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
