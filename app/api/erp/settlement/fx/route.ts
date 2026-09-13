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
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;

    let fxList: any[] = await settlementService.getFxAnalysis({
      countryId,
      fromDate,
      toDate
    }) ?? [];

    const lang = await getRequestLanguage(searchParams.get("lang"));
    try {
      const flat = fxList.map((r: any) => ({
        cr_settlement_id: r.cr_settlement_id, crPartyFlat: r.cr_party,
        dr_settlement_id: r.dr_settlement_id, drPartyFlat: r.dr_party,
        country_id: r.country_id, countryNameFlat: r.country_name
      }));
      const localizedFlat = await localizeJoinedNames<any>(flat, lang, [
        { idField: "cr_settlement_id", nameField: "crPartyFlat", table: "settlement_transactions", field: "party_name" },
        { idField: "dr_settlement_id", nameField: "drPartyFlat", table: "settlement_transactions", field: "party_name" },
        { idField: "country_id", nameField: "countryNameFlat", table: "countries", field: "name" }
      ]);
      fxList = fxList.map((r: any, i: number) => ({
        ...r,
        cr_party: localizedFlat[i].crPartyFlat,
        dr_party: localizedFlat[i].drPartyFlat,
        country_name: localizedFlat[i].countryNameFlat
      }));
    } catch {
      // keep original names
    }

    return apiOk(fxList);
  } catch (error) {
    return handleApiError(error);
  }
}
