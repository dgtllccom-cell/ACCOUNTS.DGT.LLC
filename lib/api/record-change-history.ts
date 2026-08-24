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

  try {
    const viaPg = await withLocalPg(async (sql) => {
      let validActorId: string | null = null;
      if (row.actor_id) {
        const users = await sql`SELECT id FROM public.users WHERE id = ${row.actor_id}::uuid LIMIT 1`;
        if (users.length > 0) validActorId = users[0].id;
      }
      let validCountryId: string | null = null;
      if (row.country_id) {
        const countries = await sql`SELECT id FROM public.countries WHERE id = ${row.country_id}::uuid LIMIT 1`;
        if (countries.length > 0) validCountryId = countries[0].id;
      }
      let validBranchId: string | null = null;
      if (row.city_branch_id) {
        const branches = await sql`SELECT id FROM public.city_branches WHERE id = ${row.city_branch_id}::uuid LIMIT 1`;
        if (branches.length > 0) validBranchId = branches[0].id;
      }

      await sql`
        INSERT INTO public.record_change_history (record_table, record_id, action, country_id, city_branch_id, actor_id, approval_request_id, before_data, after_data)
        VALUES (${row.record_table}, ${row.record_id}::uuid, ${row.action}, ${validCountryId}::uuid, ${validBranchId}::uuid, ${validActorId}::uuid, ${row.approval_request_id}::uuid, ${beforeData === null ? null : sql.json(beforeData as any)}, ${afterData === null ? null : sql.json(afterData as any)})
      `;
      return true;
    });
    if (viaPg) return;
  } catch (err) {
    console.warn("[RECORD-CHANGE-HISTORY] Safe-warning writing audit log:", err);
  }
}
