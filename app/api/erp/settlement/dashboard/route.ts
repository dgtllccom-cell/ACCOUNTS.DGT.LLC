import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireSettlementAccess } from "@/lib/permissions/settlement-access";
import { settlementService } from "@/lib/services/settlement-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get("countryId") || undefined;
    const branchId = searchParams.get("branchId") || undefined;
    const { scope } = await requireSettlementAccess("read", { countryId, cityBranchId: branchId });
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;

    const kpis = await settlementService.getDashboardKpis({
      countryId,
      branchId,
      fromDate,
      toDate,
      scope
    });

    return apiOk(kpis);
  } catch (error) {
    return handleApiError(error);
  }
}
