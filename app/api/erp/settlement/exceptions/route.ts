import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { settlementService } from "@/lib/services/settlement-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    const { searchParams } = new URL(request.url);

    const countryId = searchParams.get("countryId") || undefined;
    const cityBranchId = searchParams.get("cityBranchId") || undefined;
    const limit = Number(searchParams.get("limit") || 50);

    const exceptions = await settlementService.getExceptions({
      countryId,
      cityBranchId,
      limit
    });

    return apiOk(exceptions);
  } catch (error) {
    return handleApiError(error);
  }
}
