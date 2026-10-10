-- DGT.llc B / BS store apps: device activation. Anyone may install the public app; no ERP data is served until the Super Admin has
-- approved THAT device, the user has entered the one-time activation code, and the user signs in with their normal ERP account
-- (which must be the account the device was approved for). Additive only: two new tables, nothing existing is touched.
CREATE TABLE IF NOT EXISTS public.mobile_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app text NOT NULL CHECK (app IN ('b', 'bs')),
  platform text,                                   -- android | ios
  device_model text,
  os_version text,
  app_version text,
  requested_name text NOT NULL,
  requested_phone text,
  requested_identifier text NOT NULL,              -- the ERP login (e-mail / user code) this device is requested for, lower-case
  request_note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'rejected', 'revoked')),
  code_hash text,                                  -- HMAC of the activation code; the code itself is shown once to the Super Admin
  code_expires_at timestamptz,
  code_attempts int NOT NULL DEFAULT 0,
  approved_by uuid,
  approved_at timestamptz,
  activated_at timestamptz,
  bound_user_id uuid,                              -- set by the first successful ERP login on this device; later logins must match
  last_seen_at timestamptz,
  last_ip text,
  decision_note text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_status ON public.mobile_devices(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_identifier ON public.mobile_devices(requested_identifier);

CREATE TABLE IF NOT EXISTS public.mobile_device_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.mobile_devices(id) ON DELETE CASCADE,
  event text NOT NULL,                             -- requested | approved | rejected | revoked | code_failed | code_locked | activated | login_ok | login_blocked
  actor_id uuid,
  detail text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobile_device_events_device ON public.mobile_device_events(device_id, created_at DESC);

ALTER TABLE public.mobile_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_device_events ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.mobile_devices IS 'Store-app device approvals: pending → approved (code issued) → active (code verified); rejected/revoked block the device.';
