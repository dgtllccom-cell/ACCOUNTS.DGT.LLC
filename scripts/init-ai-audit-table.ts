import { withLocalPg } from "../lib/db/local-postgres";

async function checkAudit() {
  const result = await withLocalPg(async (sql) => {
    return sql`
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
        query_type TEXT NOT NULL, -- 'erp_record' | 'public_research' | 'form_guidance' | 'permission_denial' | 'voice_entry'
        records_accessed JSONB DEFAULT '[]'::jsonb,
        permission_decision TEXT NOT NULL, -- 'allowed' | 'refused'
        refusal_reason TEXT,
        proposed_mapping JSONB,
        user_confirmed BOOLEAN DEFAULT NULL,
        final_action TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
  });
  console.log("Audit table verified / created!");
}

checkAudit().catch(console.error);
