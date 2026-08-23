-- The QVC (Quality/Verification Control) review queue feature
-- (app/api/erp/qvc/accounts/route.ts, features/qvc/components/qvc-queue-view.tsx)
-- was built against these columns on enterprise_accounts, but the migration
-- that should have added them was never written/applied — confirmed via
-- information_schema on DEV: all six columns were entirely absent, causing
-- GET /api/erp/qvc/accounts to 500 with "column ... does not exist" (42703),
-- unrelated to and discovered while auditing the translation architecture.

ALTER TABLE public.enterprise_accounts
  ADD COLUMN IF NOT EXISTS qvc_status text,
  ADD COLUMN IF NOT EXISTS qvc_notes text,
  ADD COLUMN IF NOT EXISTS qvc_reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS qvc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_category text,
  ADD COLUMN IF NOT EXISTS import_batch text;

CREATE INDEX IF NOT EXISTS enterprise_accounts_qvc_status_idx
  ON public.enterprise_accounts (qvc_status)
  WHERE qvc_status IS NOT NULL;
