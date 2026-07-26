-- Idempotency keys — prevents duplicate accounting posts (payments, transfers, etc.)
-- The application also self-provisions this table at runtime (lib/api/idempotency.ts),
-- so applying this migration is optional but recommended for a clean schema.
CREATE TABLE IF NOT EXISTS erp_idempotency_keys (
  idempotency_key text PRIMARY KEY,
  endpoint        text NOT NULL,
  user_id         uuid,
  status          text NOT NULL DEFAULT 'processing',
  response        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);
CREATE INDEX IF NOT EXISTS erp_idempotency_keys_endpoint_idx ON erp_idempotency_keys (endpoint, created_at DESC);
