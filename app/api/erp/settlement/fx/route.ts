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
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;

    const fxList = await settlementService.getFxAnalysis({
      countryId,
      fromDate,
      toDate
    });

    return apiOk(fxList);
  } catch (error) {
    return handleApiError(error);
  }
}
