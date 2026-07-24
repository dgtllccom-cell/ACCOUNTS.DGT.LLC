import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { applySessionScopeDefaults, resolveCommunicationSender } from "@/lib/communication-center/communication-center-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function clean(value: string | null) {
  return value && value !== "all" ? value : null;
}

function applyScope(query: any, scope: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }) {
  if (scope.countryId) query = query.eq("country_id", scope.countryId);
  if (scope.countryBranchId) query = query.eq("country_branch_id", scope.countryBranchId);
  if (scope.cityBranchId) query = query.eq("city_branch_id", scope.cityBranchId);
  return query;
}

async function countRows(admin: any, table: string, scope: any, filters: Record<string, string> = {}) {
  let query = admin.from(table).select("id", { count: "exact", head: true }).is("deleted_at", null);
  query = applyScope(query, scope);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient() as any;
    const { searchParams } = new URL(req.url);
    const scope = applySessionScopeDefaults(session, {
      countryId: clean(searchParams.get("countryId")),
      countryBranchId: clean(searchParams.get("countryBranchId")),
      cityBranchId: clean(searchParams.get("cityBranchId"))
    });

    const [sender, emailsSent, whatsappsSent, openLeads, dueFollowups, campaigns, failedMessages] = await Promise.all([
      resolveCommunicationSender(admin, scope),
      countRows(admin, "communication_center_messages", scope, { channel: "email", direction: "outgoing" }),
      countRows(admin, "communication_center_messages", scope, { channel: "whatsapp", direction: "outgoing" }),
      countRows(admin, "communication_center_leads", scope, { status: "new" }),
      countRows(admin, "communication_center_followups", scope, { status: "open" }),
      countRows(admin, "communication_center_campaigns", scope),
      countRows(admin, "communication_center_messages", scope, { delivery_status: "failed" })
    ]);

    let recentQuery = admin
      .from("communication_center_messages")
      .select("id,channel,direction,folder,recipient_to,subject,delivery_status,read_status,linked_module,linked_document_no,created_at,sender_name")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8);
    recentQuery = applyScope(recentQuery, scope);
    const { data: recentMessages, error: recentError } = await recentQuery;
    if (recentError) throw recentError;

    return apiOk({
      scope,
      sender,
      metrics: {
        emailsSent,
        whatsappsSent,
        openLeads,
        dueFollowups,
        campaigns,
        failedMessages
      },
      recentMessages: recentMessages ?? []
    });
  } catch (error) {
    return handleApiError(error);
  }
}
