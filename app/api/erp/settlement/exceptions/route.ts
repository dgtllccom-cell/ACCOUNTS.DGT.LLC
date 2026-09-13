import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { settlementService } from "@/lib/services/settlement-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    const { searchParams } = new URL(request.url);

    const countryId = searchParams.get("countryId") || undefined;
    const cityBranchId = searchParams.get("cityBranchId") || undefined;
    const limit = Number(searchParams.get("limit") || 50);

    let exceptions: any[] = await settlementService.getExceptions({
      countryId,
      cityBranchId,
      limit
    }) ?? [];

    const lang = await getRequestLanguage(searchParams.get("lang"));
    try {
      exceptions = await localizeRecordFields<any>(exceptions, "settlement_transactions", ["party_name"], lang);
    } catch {
      // keep original party names
    }

    return apiOk(exceptions);
  } catch (error) {
    return handleApiError(error);
  }
}
