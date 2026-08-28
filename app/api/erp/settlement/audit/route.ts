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

    const settlementId = searchParams.get("settlementId") || undefined;
    const countryId = searchParams.get("countryId") || undefined;
    const limit = Number(searchParams.get("limit") || 50);

    const history = await settlementService.getAuditHistory({
      settlementId,
      countryId,
      limit
    });

    return apiOk(history);
  } catch (error) {
    return handleApiError(error);
  }
}
