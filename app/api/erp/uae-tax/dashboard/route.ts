import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { assertUaeCountryAccess } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";
import { uaeTaxScopeFromSession } from "@/lib/services/uae-tax-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax", action: "read" });
    await assertUaeCountryAccess(session);

    const p = new URL(request.url).searchParams;
    const scope = uaeTaxScopeFromSession(session);

    const [kpis, entities, periods] = await Promise.all([
      uaeTaxService.getDashboardKpis({
        taxEntityId: p.get("taxEntityId") || undefined,
        periodId: p.get("periodId") || undefined,
        fromDate: p.get("fromDate") || undefined,
        toDate: p.get("toDate") || undefined,
      }),
      uaeTaxService.listEntities(scope),
      uaeTaxService.listPeriods(p.get("taxEntityId") || undefined, scope),
    ]);

    return apiOk({ kpis, entities, periods });
  } catch (error) {
    return handleApiError(error);
  }
}
