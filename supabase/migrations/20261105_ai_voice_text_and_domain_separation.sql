-- ERP-WIDE AI VOICE + TEXT ENTRY + DOMAIN SEPARATION
-- Migration: Add operational_domain to user_role_assignments + extend document_intake for voice/text sources

-- 1. Add operational_domain to user_role_assignments for explicit BUSINESS vs CLEARING/SHIPPING separation
ALTER TABLE IF EXISTS public.user_role_assignments
ADD COLUMN IF NOT EXISTS operational_domain text DEFAULT 'business'
CHECK (operational_domain IN ('business', 'shipping', 'both'));

CREATE INDEX IF NOT EXISTS user_role_assignments_domain_idx
ON public.user_role_assignments (user_id, operational_domain)
WHERE is_active = true AND deleted_at IS NULL;

-- 2. Extend document_intake_jobs to support voice and text sources (not just PDF/image)
ALTER TABLE IF EXISTS public.document_intake_jobs
ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'file'
CHECK (source_type IN ('file', 'voice', 'text', 'api'));

ALTER TABLE IF EXISTS public.document_intake_jobs
ADD COLUMN IF NOT EXISTS original_language text DEFAULT 'en'
CHECK (original_language IN ('en', 'ur', 'ps', 'fa', 'ar'));

ALTER TABLE IF EXISTS public.document_intake_jobs
ADD COLUMN IF NOT EXISTS transcript text;

ALTER TABLE IF EXISTS public.document_intake_jobs
ADD COLUMN IF NOT EXISTS audio_duration_seconds int;

ALTER TABLE IF EXISTS public.document_intake_jobs
ADD COLUMN IF NOT EXISTS audio_mime_type text;

ALTER TABLE IF EXISTS public.document_intake_jobs
ADD COLUMN IF NOT EXISTS audio_storage_key text;

CREATE INDEX IF NOT EXISTS document_intake_source_type_idx
ON public.document_intake_jobs (source_type)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS document_intake_language_idx
ON public.document_intake_jobs (original_language)
WHERE deleted_at IS NULL;

-- 3. Create approval_workflows table for AI draft approval tracking
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_intake_job_id uuid NOT NULL REFERENCES public.document_intake_jobs(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'returned_for_review')),

  submitted_by uuid NOT NULL REFERENCES public.profiles(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),

  reviewer_id uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  reviewer_notes text,

  approver_id uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  approver_notes text,

  rejection_reason text,
  rejected_at timestamptz,

  returned_reason text,
  returned_at timestamptz,

  final_erp_transaction_id uuid,
  final_voucher_no text,
  final_serial_references jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT approval_workflow_logical_checks CHECK (
    (status = 'pending' AND reviewer_id IS NULL AND approver_id IS NULL) OR
    (status = 'approved' AND approver_id IS NOT NULL AND approved_at IS NOT NULL) OR
    (status = 'rejected' AND rejected_at IS NOT NULL AND rejection_reason IS NOT NULL) OR
    (status = 'returned_for_review' AND returned_at IS NOT NULL AND returned_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS approval_workflows_job_idx
ON public.approval_workflows (document_intake_job_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS approval_workflows_status_idx
ON public.approval_workflows (status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS approval_workflows_reviewer_idx
ON public.approval_workflows (reviewer_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS approval_workflows_approver_idx
ON public.approval_workflows (approver_id)
WHERE deleted_at IS NULL;

-- 4. Create AI draft corrections/amendments log
CREATE TABLE IF NOT EXISTS public.approval_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_workflow_id uuid NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,

  field_key text NOT NULL,
  original_value text,
  amended_value text NOT NULL,

  amended_by uuid NOT NULL REFERENCES public.profiles(id),
  amended_at timestamptz NOT NULL DEFAULT now(),
  amendment_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS approval_amendments_workflow_idx
ON public.approval_amendments (approval_workflow_id)
WHERE deleted_at IS NULL;

-- 5. Create voice entry sessions table
CREATE TABLE IF NOT EXISTS public.voice_entry_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL REFERENCES public.profiles(id),
  session_token text UNIQUE NOT NULL,

  operational_domain text NOT NULL DEFAULT 'business'
    CHECK (operational_domain IN ('business', 'shipping')),

  country_id uuid REFERENCES public.countries(id),
  country_branch_id uuid REFERENCES public.country_branches(id),
  city_branch_id uuid REFERENCES public.city_branches(id),
  clearing_agent_id uuid,

  language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'ur', 'ps', 'fa', 'ar')),

  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned', 'error')),

  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,

  total_audio_duration_seconds int DEFAULT 0,
  total_messages_recorded int DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS voice_sessions_user_idx
ON public.voice_entry_sessions (user_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS voice_sessions_status_idx
ON public.voice_entry_sessions (status)
WHERE deleted_at IS NULL;

-- Enable row-level security
ALTER TABLE IF EXISTS public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.approval_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voice_entry_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for approval_workflows
CREATE POLICY approval_workflows_read
  ON public.approval_workflows
  FOR SELECT
  USING (
    is_super_admin() OR
    submitted_by = auth.uid() OR
    reviewer_id = auth.uid() OR
    approver_id = auth.uid()
  );

CREATE POLICY approval_workflows_write_submitter
  ON public.approval_workflows
  FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY approval_workflows_update_reviewer
  ON public.approval_workflows
  FOR UPDATE
  USING (reviewer_id = auth.uid() OR is_super_admin())
  WITH CHECK (reviewer_id = auth.uid() OR is_super_admin());

-- RLS policies for voice_entry_sessions
CREATE POLICY voice_sessions_read
  ON public.voice_entry_sessions
  FOR SELECT
  USING (is_super_admin() OR user_id = auth.uid());

CREATE POLICY voice_sessions_write_self
  ON public.voice_entry_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY voice_sessions_update_self
  ON public.voice_entry_sessions
  FOR UPDATE
  USING (user_id = auth.uid() OR is_super_admin())
  WITH CHECK (user_id = auth.uid() OR is_super_admin());

-- 6. Add i18n tracking for voice/text approval screens
-- (These keys will be added to lib/i18n/ui.ts in the implementation phase)
-- Keys needed:
-- - ai_entry.voice_entry, ai_entry.text_entry, ai_entry.voice_or_text
-- - approval.pending, approval.approved, approval.rejected, approval.returned
-- - approval.submit_for_review, approval.approve, approval.return, approval.reject
-- - approval.reviewer_notes, approval.approver_notes, approval.rejection_reason
-- - voice.recording, voice.stop, voice.playback, voice.duration

COMMENT ON TABLE public.approval_workflows IS
'AI Draft & Approval workflow: AI creates draft (via voice/text/PDF/image), reviewer checks, returns, or approves, approver signs off before ERP posting. Never posts without human approval.';

COMMENT ON TABLE public.voice_entry_sessions IS
'Voice entry session tracking: captures session context (domain, country/branch, language, user) and metadata (duration, message count).';

COMMENT ON TABLE public.approval_amendments IS
'Audit trail of corrections made during approval workflow: tracks what was changed, by whom, when, and why.';
