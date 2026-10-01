import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg, getSharedPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang") || session.preferredLanguage);

    const isSuperAdmin = session.isSuperAdmin || session.roles?.includes("super_admin_reports");
    const countryId = session.countryIds?.[0] ?? null;

    const fetchLogs = async (sql: any) => {
      const rows = await sql`
        SELECT id, user_name, role, query, detected_language, query_type, permission_decision, refusal_reason, created_at
        FROM public.ai_assistant_audit_logs
        ${isSuperAdmin ? sql`` : countryId ? sql`WHERE (country_id = ${countryId} OR user_id = ${session.userId})` : sql`WHERE user_id = ${session.userId}`}
        ORDER BY created_at DESC
        LIMIT 50;
      `;
      return rows;
    };

    const sharedPg = getSharedPg();
    const logs = sharedPg ? await fetchLogs(sharedPg) : await withLocalPg(fetchLogs);

    return apiOk(logs);
  } catch (error) {
    return handleApiError(error);
  }
}
