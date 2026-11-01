import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { ErpPermissionError, hasRolePermission } from "@/lib/permissions/middleware";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/reports/handover-summary - the OPERATIONAL handover report: Business -> Shipping Line handovers in the login's own country / branch
 * scope (counts by status and the latest handovers). Real saved records only; no payload, no credentials, no system administration data - those stay
 * in the Super-Admin-only access register. `?admin=1` (Super Admin only) adds the system facts the admin handover shows (real table count).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!hasRolePermission(session, "reports", "read") && !hasRolePermission(session, "shipping_transfers", "read")) {
      throw new ErpPermissionError("Missing permission: reports:read / shipping_transfers:read");
    }
    const scope = sessionSqlScope(session);
    const wantAdmin = request.nextUrl.searchParams.get("admin") === "1";
    if (wantAdmin && !session.isSuperAdmin) throw new ErpPermissionError("System administration facts are available to the Super Admin only.");

    const data = await withLocalPg(async (sql) => {
      const where = sql`h.deleted_at is null and ${sqlScopeCondition(sql, scope, "h")}`;
      const byStatus = (await sql`select coalesce(h.status::text,'unknown') status, count(*)::int n from public.business_shipping_handovers h where ${where} group by 1 order by 2 desc`) as any[];
      const latest = (await sql`
        select h.id::text id, h.handover_no, h.action_type, h.business_reference_no, h.bl_reference, h.status::text status, h.created_by_name, h.created_at
        from public.business_shipping_handovers h where ${where} order by h.created_at desc limit 25`) as any[];
      const admin = wantAdmin ? ((await sql`select count(*)::int n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`) as any[])[0] : null;
      return { byStatus, latest, admin };
    });

    return apiOk({
      total: (data?.byStatus ?? []).reduce((s: number, r: any) => s + r.n, 0),
      byStatus: data?.byStatus ?? [],
      latest: data?.latest ?? [],
      ...(wantAdmin ? { system: { publicTables: data?.admin?.n ?? 0 } } : {})
    });
  } catch (error) {
    return handleApiError(error);
  }
}
