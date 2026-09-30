import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { getInsuranceAlerts } from "@/lib/services/clearing-insurance-service";

export const dynamic = "force-dynamic";

/**
 * Real, scope-filtered exceptions (missing-policy legs + expiring/expired
 * policies) for the Route, Border & Insurance report and, later, the Smart
 * Operations feed. No fabricated alerts — every row is a real order/leg/policy.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const alerts = await getInsuranceAlerts({
      isSuperAdmin: session.isSuperAdmin,
      countryId: session.countryIds?.[0] ?? null,
      countryBranchId: session.countryBranchIds?.[0] ?? null,
      cityBranchId: session.cityBranchIds?.[0] ?? null
    });
    return apiOk(alerts);
  } catch (error) {
    return handleApiError(error);
  }
}
