import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { settlementService } from "@/lib/services/settlement-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    await requireErpSession();
    const body = await request.json().catch(() => ({}));

    const fromDate = body?.fromDate || undefined;
    const countryId = body?.countryId || undefined;

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
