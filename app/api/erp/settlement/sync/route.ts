import { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { requireSettlementAccess } from "@/lib/permissions/settlement-access";
import { settlementService } from "@/lib/services/settlement-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { session } = await requireSettlementAccess("write", { countryId: undefined });
    const body = await request.json().catch(() => ({}));
    const fromDate = body?.fromDate || undefined;
    let countryId: string | undefined = body?.countryId || undefined;
    if (!session.isSuperAdmin) {
      const isCountryRole = session.roles.some((r) => r === "country_admin");
      if (!isCountryRole) return apiError("FORBIDDEN", "Only Super Admin or Country Admin can synchronize settlements.", 403);
      if (countryId && !session.countryIds.includes(countryId)) return apiError("FORBIDDEN", "This country is outside your authorized scope.", 403);
      if (!countryId) {
        if (session.countryIds.length !== 1) return apiError("BAD_REQUEST", "countryId is required.", 400);
        countryId = session.countryIds[0];
      }
    }

    const result = await settlementService.syncFromErp({ fromDate, countryId });

    return apiOk({
      success: true,
      message: `Synchronized ${result.totalSynced} transaction references into Settlement Center`,
      details: result
    });
  } catch (error) {
    return handleApiError(error);
  }
}
