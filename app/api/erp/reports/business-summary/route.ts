import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { computeBusinessSummary } from "@/lib/reports/business-summary-data";

/**
 * Branch/Country Business Summary — CLAUDE.md Section C.
 *
 * A single reusable aggregation endpoint for total purchase / sales /
 * expenses / outstanding / payments / stock / profit / customer balances,
 * scoped by the same super_admin/country_admin/branch RBAC every other
 * report endpoint uses (resolveReportScope/enforceScopeFilters, identical
 * to app/api/erp/bill-expenses/route.ts). Previously this arithmetic was
 * duplicated ad hoc inside app/dashboard/page.tsx and
 * app/dashboard/country/page.tsx server components with no callable API —
 * this route exposes the same figures as one composable JSON response.
 *
 * The aggregation itself now lives in lib/reports/business-summary-data.ts
 * (computeBusinessSummary) so the read-only AI Business Assistant
 * (app/api/erp/ai/query/route.ts) can reuse the identical scoped totals
 * instead of re-deriving them — this route is a thin wrapper, response
 * shape unchanged.
 *
 * Query params: countryId, branchId (= city_branch_id; ignored/forced per
 * the caller's scope exactly like every other scoped report route).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const sp = request.nextUrl.searchParams;
    const summary = await computeBusinessSummary(session, {
      countryId: sp.get("countryId") && sp.get("countryId") !== "all" ? sp.get("countryId") : null,
      branchId: sp.get("branchId") && sp.get("branchId") !== "all" ? sp.get("branchId") : null
    });

    return apiOk(summary);
  } catch (err: any) {
    return handleApiError(err);
  }
}
