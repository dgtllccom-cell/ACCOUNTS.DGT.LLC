-- Migration: 20260727_idempotency_keys.sql
-- Description: Creates the idempotency_keys table, composite indices, and atomic lock management RPCs for Digital Dock ERP direct posting APIs.

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  tenant_hash TEXT NOT NULL,
  scope_module TEXT NOT NULL,
  user_id UUID,
  country_id UUID,
  city_branch_id UUID,
  business_reference TEXT,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  response_code INTEGER,
  response_body JSONB,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 seconds'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index ensuring scoped composite uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_tenant_key 
ON public.idempotency_keys (tenant_hash, idempotency_key);

-- Index for lookup & garbage collection
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at 
ON public.idempotency_keys (expires_at);

-- RPC for atomic lock acquisition & stale lock recovery
CREATE OR REPLACE FUNCTION public.acquire_idempotency_lock(
  p_idempotency_key TEXT,
  p_tenant_hash TEXT,
  p_scope_module TEXT,
  p_user_id UUID,
  p_country_id UUID,
  p_city_branch_id UUID,
  p_business_reference TEXT,
  p_request_hash TEXT,
  p_lock_seconds INTEGER DEFAULT 90
)
RETURNS TABLE (
  acquired BOOLEAN,
  status TEXT,
  response_code INTEGER,
  response_body JSONB,
  is_replayed BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_expires TIMESTAMPTZ := v_now + (p_lock_seconds || ' seconds')::INTERVAL;
BEGIN
  -- Lock or fetch existing key record
  SELECT * INTO v_existing
  FROM public.idempotency_keys
  WHERE tenant_hash = p_tenant_hash AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    -- Scenario 1: Already COMPLETED -> Replay cached response
    IF v_existing.status = 'COMPLETED' THEN
      RETURN QUERY SELECT FALSE, v_existing.status, v_existing.response_code, v_existing.response_body, TRUE;
      RETURN;
    END IF;

    -- Scenario 2: Active PROCESSING lock & NOT expired -> Concurrent conflict
    IF v_existing.status = 'PROCESSING' AND v_existing.expires_at > v_now THEN
      RETURN QUERY SELECT FALSE, v_existing.status, NULL::INTEGER, NULL::JSONB, FALSE;
      RETURN;
    END IF;

    -- Scenario 3: Stale PROCESSING or FAILED lock -> Break stale lock & acquire
    UPDATE public.idempotency_keys
    SET status = 'PROCESSING',
        request_hash = p_request_hash,
        user_id = p_user_id,
        country_id = p_country_id,
        city_branch_id = p_city_branch_id,
        business_reference = p_business_reference,
        locked_at = v_now,
        expires_at = v_expires,
        response_code = NULL,
        response_body = NULL,
        updated_at = v_now
    WHERE id = v_existing.id;

    RETURN QUERY SELECT TRUE, 'PROCESSING'::TEXT, NULL::INTEGER, NULL::JSONB, FALSE;
    RETURN;
  ELSE
    -- Scenario 4: New key -> Insert new lock record
    INSERT INTO public.idempotency_keys (
      idempotency_key,
      tenant_hash,
      scope_module,
      user_id,
      country_id,
      city_branch_id,
      business_reference,
      request_hash,
      status,
      locked_at,
      expires_at
    ) VALUES (
      p_idempotency_key,
      p_tenant_hash,
      p_scope_module,
      p_user_id,
      p_country_id,
      p_city_branch_id,
      p_business_reference,
      p_request_hash,
      'PROCESSING',
      v_now,
      v_expires
    );

    RETURN QUERY SELECT TRUE, 'PROCESSING'::TEXT, NULL::INTEGER, NULL::JSONB, FALSE;
    RETURN;
  END IF;
END;
$$;
