-- DGT.llc B / BS store apps: REVIEW PASS for Apple / Google / Samsung reviewers.
-- A store reviewer cannot wait for a Super Admin to approve their phone, and every reviewer uses their own devices. The Super Admin therefore
-- issues a time-limited, device-limited pass that is tied to ONE limited reviewer ERP login. The pass only skips the "approve this phone"
-- step: the reviewer still has to sign in with the reviewer account, and that account's (read-only, empty-scope) permissions decide what is seen.
-- Additive only: one new table, nothing existing is touched. The code is stored as an HMAC, never in clear text.
CREATE TABLE IF NOT EXISTS public.mobile_review_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app text NOT NULL CHECK (app IN ('b', 'bs')),
  label text NOT NULL,                              -- e.g. "Apple App Review", "Google Play review"
  identifier text NOT NULL,                         -- the reviewer ERP login (lower-case) the pass is valid for
  code_hash text NOT NULL,
  max_devices int NOT NULL DEFAULT 6 CHECK (max_devices BETWEEN 1 AND 20),
  used_devices int NOT NULL DEFAULT 0,
  failed_attempts int NOT NULL DEFAULT 0,           -- wrong codes tried against this identifier; the pass locks at 10
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobile_review_passes_lookup ON public.mobile_review_passes(app, identifier) WHERE revoked_at IS NULL;
ALTER TABLE public.mobile_review_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_devices ADD COLUMN IF NOT EXISTS review_pass_id uuid REFERENCES public.mobile_review_passes(id) ON DELETE SET NULL;
COMMENT ON TABLE public.mobile_review_passes IS 'Store-review passes: let reviewers activate their own devices for one limited reviewer login, for a limited time and number of devices.';
