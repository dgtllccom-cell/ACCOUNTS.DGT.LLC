import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { getRouteBorderInsuranceReport } from "@/lib/services/clearing-insurance-service";

export const dynamic = "force-dynamic";

/**
 * Route, Border & Insurance report: real per-leg route/customs/insurance data,
 * scope-filtered. See getRouteBorderInsuranceReport for the query.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    const rows = await getRouteBorderInsuranceReport(
      {
        isSuperAdmin: session.isSuperAdmin,
        countryId: session.countryIds?.[0] ?? null,
        countryBranchId: session.countryBranchIds?.[0] ?? null,
        cityBranchId: session.cityBranchIds?.[0] ?? null,
      },
      {
        countryId: searchParams.get("countryId") || null,
        fromDate: searchParams.get("fromDate") || null,
        toDate: searchParams.get("toDate") || null,
        clearanceType: searchParams.get("clearanceType") || null,
      }
    );
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}
