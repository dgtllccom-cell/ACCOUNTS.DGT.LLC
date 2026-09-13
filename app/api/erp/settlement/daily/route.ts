import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { settlementService } from "@/lib/services/settlement-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    const { searchParams } = new URL(request.url);

    const countryId = searchParams.get("countryId") || undefined;
    const cityBranchId = searchParams.get("cityBranchId") || undefined;
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;

    let rows: any[] = await settlementService.getDailySummary({
      countryId,
      cityBranchId,
      fromDate,
      toDate
    }) ?? [];

    const lang = await getRequestLanguage(searchParams.get("lang"));
    try {
      rows = await localizeJoinedNames<any>(rows, lang, [
        { idField: "country_id", nameField: "country_name", table: "countries" },
        { idField: "country_branch_id", nameField: "branch_name", table: "country_branches", field: "name" },
        { idField: "city_branch_id", nameField: "city_branch_name", table: "city_branches", field: "name" }
      ]);
    } catch {
      // keep original names
    }

    return apiOk(rows);
  } catch (error) {
    return handleApiError(error);
  }
}
