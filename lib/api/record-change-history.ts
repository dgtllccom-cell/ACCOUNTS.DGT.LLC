import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";

type JsonRecord = Record<string, unknown>;

function cleanJson(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

export async function writeRecordChangeHistory(input: {
  recordTable: string;
  recordId: string;
  action: string;
  countryId?: string | null;
  cityBranchId?: string | null;
  actorId?: string | null;
  approvalRequestId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
}) {
  const beforeData = cleanJson(input.beforeData) ?? input.beforeData ?? null;
  const afterData = cleanJson(input.afterData) ?? input.afterData ?? null;
  const row = {
    record_table: input.recordTable,
    record_id: input.recordId,
    action: input.action,
    country_id: input.countryId ?? null,
    city_branch_id: input.cityBranchId ?? null,
    actor_id: input.actorId ?? null,
    approval_request_id: input.approvalRequestId ?? null,
    before_data: beforeData,
    after_data: afterData
  };

  const viaPg = await withLocalPg(async (sql) => {
    await sql`
      INSERT INTO public.record_change_history (record_table, record_id, action, country_id, city_branch_id, actor_id, approval_request_id, before_data, after_data)
      VALUES (${row.record_table}, ${row.record_id}::uuid, ${row.action}, ${row.country_id}::uuid, ${row.city_branch_id}::uuid, ${row.actor_id}::uuid, ${row.approval_request_id}::uuid, ${beforeData === null ? null : JSON.stringify(beforeData)}::jsonb, ${afterData === null ? null : JSON.stringify(afterData)}::jsonb)
    `;
    return true;
  });
  if (viaPg) return;

  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("record_change_history").insert(row);
  if (error) throw new Error(error.message);
}
