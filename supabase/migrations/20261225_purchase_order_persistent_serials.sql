-- Purchase Booking serials: persistent, never-reused numbers — on the EXISTING counter table.
--
-- Problem: purchase_orders numbers (AE-001-0001 / AE-000001 / 00000001) were computed as
-- count(*)+1. In-app deletes are soft, so the count kept growing, but any hard delete (e.g. a data
-- cleanup) lowers the count and the next booking REISSUES an old number. Two branches whose codes
-- end in the same suffix (ARE-RAS-001, ARE-DXB-001 → both "AE-001") also shared printed numbers,
-- and two simultaneous bookings could read the same count.
--
-- Fix: allocate from public.transaction_serial_sequences (the counter table already used by
-- next_entity_serial / customer orders), entity_type 'purchase_order', keyed by the PRINTED prefix:
--   global  : ('global',  'GLOBAL')            → 00000001
--   country : ('country', '<ISO2>')            → AE-000001
--   branch  : ('prefix',  '<ISO2>-<SUFFIX>')   → AE-001-0001
-- Each allocation takes GREATEST(counter, highest number ever seen + 1), where "ever seen" covers
-- every purchase_orders row (live and soft-deleted) and any backup copy of purchase_orders kept in
-- this database (backup_* / cleanup_backup_* schemas) — so numbers removed by a hard delete are
-- never handed out again. The upsert row lock serialises concurrent bookings.
-- Additive only: one function, no table or data change. Rollback: DROP FUNCTION.

BEGIN;

CREATE OR REPLACE FUNCTION public.allocate_purchase_order_serials(p_country_prefix text, p_branch_prefix text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_cp text := UPPER(NULLIF(TRIM(p_country_prefix), ''));
  v_bp text := UPPER(NULLIF(TRIM(p_branch_prefix), ''));
  v_sources text;
  v_floor bigint;
  v_global bigint;
  v_country bigint;
  v_branch bigint;
  r record;
BEGIN
  -- Every table that holds (or held) purchase order numbers: the live table + in-database backups.
  v_sources := 'SELECT super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, purchase_order_no FROM public.purchase_orders';
  FOR r IN
    SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'purchase_orders' AND c.relkind = 'r' AND (n.nspname LIKE 'backup\_%' OR n.nspname LIKE 'cleanup\_backup\_%')
  LOOP
    v_sources := v_sources || format(' UNION ALL SELECT super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, purchase_order_no FROM %I.purchase_orders', r.nspname);
  END LOOP;

  -- Global (super admin) serial.
  EXECUTE format('SELECT COALESCE(MAX(super_admin_serial_number::bigint), 0) FROM (%s) s WHERE super_admin_serial_number ~ ''^[0-9]+$''', v_sources) INTO v_floor;
  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES ('global', 'GLOBAL', 'purchase_order', 'PO', v_floor + 2)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET next_value = GREATEST(transaction_serial_sequences.next_value, v_floor + 1) + 1, updated_at = now()
  RETURNING next_value - 1 INTO v_global;

  -- Country serial.
  IF v_cp IS NOT NULL THEN
    EXECUTE format('SELECT COALESCE(MAX(substring(country_transaction_serial_number FROM %L)::bigint), 0) FROM (%s) s',
                   '^' || v_cp || '-([0-9]+)$', v_sources) INTO v_floor;
    INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
    VALUES ('country', v_cp, 'purchase_order', v_cp, v_floor + 2)
    ON CONFLICT (scope_type, scope_key, entity_type)
    DO UPDATE SET next_value = GREATEST(transaction_serial_sequences.next_value, v_floor + 1) + 1, updated_at = now()
    RETURNING next_value - 1 INTO v_country;
  END IF;

  -- Branch serial, keyed by the printed prefix (also the default booking number).
  IF v_bp IS NOT NULL THEN
    EXECUTE format('SELECT COALESCE(MAX(GREATEST(COALESCE(substring(branch_transaction_serial_number FROM %L)::bigint, 0), COALESCE(substring(purchase_order_no FROM %L)::bigint, 0))), 0) FROM (%s) s',
                   '^' || v_bp || '-([0-9]+)$', '^' || v_bp || '-([0-9]+)$', v_sources) INTO v_floor;
    INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
    VALUES ('prefix', v_bp, 'purchase_order', v_bp, v_floor + 2)
    ON CONFLICT (scope_type, scope_key, entity_type)
    DO UPDATE SET next_value = GREATEST(transaction_serial_sequences.next_value, v_floor + 1) + 1, updated_at = now()
    RETURNING next_value - 1 INTO v_branch;
  END IF;

  RETURN jsonb_build_object(
    'superAdminSerialNumber', lpad(v_global::text, 8, '0'),
    'countryTransactionSerialNumber', CASE WHEN v_country IS NULL THEN NULL ELSE v_cp || '-' || lpad(v_country::text, 6, '0') END,
    'branchTransactionSerialNumber', CASE WHEN v_branch IS NULL THEN NULL ELSE v_bp || '-' || lpad(v_branch::text, 4, '0') END
  );
END;
$fn$;

COMMENT ON FUNCTION public.allocate_purchase_order_serials(text, text) IS
  'Purchase booking numbers from transaction_serial_sequences (entity purchase_order). Never reissues a number that exists or existed (live, soft-deleted or in an in-database backup).';

REVOKE ALL ON FUNCTION public.allocate_purchase_order_serials(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_purchase_order_serials(text, text) TO service_role;

COMMIT;
