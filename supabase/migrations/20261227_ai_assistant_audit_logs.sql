-- AI assistant audit trail (previously created only by scripts/init-ai-audit-table.ts, never as a
-- migration, so it was missing on Production). Additive: CREATE TABLE IF NOT EXISTS, no data change.
CREATE TABLE IF NOT EXISTS public.ai_assistant_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_name TEXT,
  role TEXT,
  country_id UUID,
  branch_id UUID,
  page_context TEXT,
  query TEXT NOT NULL,
  detected_language TEXT,
  query_type TEXT NOT NULL,
  records_accessed JSONB DEFAULT '[]'::jsonb,
  permission_decision TEXT NOT NULL,
  refusal_reason TEXT,
  proposed_mapping JSONB,
  user_confirmed BOOLEAN DEFAULT NULL,
  final_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
