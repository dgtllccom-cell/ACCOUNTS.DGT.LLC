-- DGT.llc: device access per user assignment (Mobile / Computer).
-- A user may be allotted to one or more device kinds; the user can sign in from any device kind allotted to them.
-- Set by a Super Admin or Country Admin in the user registration wizard (app/api/erp/users). Additive only: one nullable column on the
-- existing user_role_assignments row (the same row that already carries mobile_profile and warehouse_ids). No backfill.
--   NULL                      → not restricted (every existing assignment keeps today's behaviour)
--   '{mobile}'                → sign-in from phones / tablets (incl. the B / BS store apps) only
--   '{computer}'              → sign-in from computers only
--   '{mobile,computer}'       → any device
-- Apply to Production only after review, and before the code that writes/reads this column is deployed (the login route tolerates a
-- missing column, but the wizard refuses to save a device allotment until the column exists).

ALTER TABLE public.user_role_assignments
  ADD COLUMN IF NOT EXISTS device_access text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_role_assignments_device_access_check'
      AND conrelid = 'public.user_role_assignments'::regclass
  ) THEN
    ALTER TABLE public.user_role_assignments
      ADD CONSTRAINT user_role_assignments_device_access_check
      CHECK (
        device_access IS NULL
        OR (cardinality(device_access) >= 1 AND device_access <@ ARRAY['mobile', 'computer']::text[])
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.user_role_assignments.device_access IS
  'Device kinds this assignment may sign in from: mobile | computer. NULL = not restricted (legacy rows). Set by Super Admin / Country Admin only.';
