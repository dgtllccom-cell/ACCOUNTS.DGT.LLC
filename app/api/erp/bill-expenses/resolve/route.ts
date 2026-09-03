import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/bill-expenses/resolve?sourceId=<uuid>
 *
 * Maps a source-bill id (purchase_orders / local_purchases / sales_orders /
 * shipping_bl_records / clearing_payment_bills) to its bill_expenses register
 * row id, so an "Add Expense Bill" button on a source screen can deep-link
 * straight into the drill-down. The register row is created by the
 * bill_expenses_sync_from_source trigger when the source bill becomes eligible —
 * this endpoint never creates a row. Scope is enforced.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const scope = resolveReportScope(session);
    const sourceId = request.nextUrl.searchParams.get("sourceId");
    if (!sourceId || !/^[0-9a-f-]{36}$/i.test(sourceId)) {
      throw new ApiClientError("A valid sourceId is required.", { status: 400, code: "BAD_SOURCE_ID" });
    }

    const result = await withLocalPg(async (sql) => {
      const [be] = await sql`
        select id, country_id, city_branch_id, eligibility
        from public.bill_expenses
        where source_id = ${sourceId}::uuid and deleted_at is null
        limit 1`;
      if (!be) return { id: null as string | null, eligible: false };
      if (scope.level === "country" && scope.countryId && be.country_id !== scope.countryId) {
        return { forbidden: true } as const;
      }
      if (scope.level === "branch" && scope.branchId && be.city_branch_id !== scope.branchId) {
        return { forbidden: true } as const;
      }
      return { id: be.id as string, eligible: be.eligibility === "active" };
    });

    if (result && "forbidden" in result) {
      throw new ApiClientError("This bill is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });
    }

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
