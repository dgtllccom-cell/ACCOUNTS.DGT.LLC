-- Migration: Add entity_type-scoped serial counter support and helper function.
-- Extends the existing next_transaction_serial to support entity-specific serials
-- (purchase, loading, payment, journal) within the same scope.

-- ============================================================================
-- Part 1: Add entity_type to transaction_serial_sequences
-- ============================================================================
ALTER TABLE transaction_serial_sequences
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'roznamcha';

-- Drop old unique constraint to add entity_type
ALTER TABLE transaction_serial_sequences
  DROP CONSTRAINT IF EXISTS transaction_serial_sequences_scope_type_scope_key_key;

-- Create new composite unique constraint including entity_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tss_scope_entity_unique'
  ) THEN
    ALTER TABLE transaction_serial_sequences
      ADD CONSTRAINT tss_scope_entity_unique UNIQUE (scope_type, scope_key, entity_type);
  END IF;
END $$;

-- ============================================================================
-- Part 2: Entity-aware serial generator
-- ============================================================================
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

  IF p_entity_type NOT IN ('roznamcha', 'purchase', 'loading', 'payment', 'journal', 'general') THEN
    RAISE EXCEPTION 'Unsupported entity type: %', p_entity_type;
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

-- ============================================================================
-- Part 3: Update existing next_transaction_serial to use entity_type = 'roznamcha'
-- ============================================================================
-- The existing function continues to work as before, but now uses the entity_type column.
CREATE OR REPLACE FUNCTION next_transaction_serial(
  p_scope_type text,
  p_scope_key text,
  p_prefix text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delegate to entity-aware version with default entity_type
  RETURN next_entity_serial(p_scope_type, p_scope_key, 'roznamcha', p_prefix);
END;
$$;

-- ============================================================================
-- Part 4: Backfill entity_type for existing rows
-- ============================================================================
UPDATE transaction_serial_sequences
SET entity_type = 'roznamcha'
WHERE entity_type = 'roznamcha';  -- no-op, ensures default is correct
