import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireSettlementAccess, canAccessSettlementRecord } from "@/lib/permissions/settlement-access";
import { settlementService } from "@/lib/services/settlement-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const settlementId = searchParams.get("settlementId") || undefined;
    const countryId = searchParams.get("countryId") || undefined;
    const { session, scope } = await requireSettlementAccess("read", { countryId });
    if (settlementId && !canAccessSettlementRecord(session, await settlementService.getTransactionScope(settlementId))) {
      return apiOk([]);
    }
    const limit = Number(searchParams.get("limit") || 50);

    let history: any[] = await settlementService.getAuditHistory({
      settlementId,
      countryId,
      limit,
      scope
    }) ?? [];

    const lang = await getRequestLanguage(searchParams.get("lang"));
    try {
      history = await localizeJoinedNames<any>(history, lang, [
        { idField: "actor_id", nameField: "actor_name", table: "profiles", field: "full_name" },
        { idField: "country_id", nameField: "country_name", table: "countries", field: "name" },
        { idField: "city_branch_id", nameField: "city_branch_name", table: "city_branches", field: "name" },
        { idField: "settlement_id", nameField: "party_name", table: "settlement_transactions", field: "party_name" }
      ]);
    } catch {
      // keep original names
    }

    return apiOk(history);
  } catch (error) {
    return handleApiError(error);
  }
}
