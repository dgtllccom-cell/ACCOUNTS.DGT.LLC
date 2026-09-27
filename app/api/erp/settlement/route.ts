import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { settlementService } from "@/lib/services/settlement-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, localizeJoinedNames } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);
    // Branch/country users only ever see settlement rows inside their own assignments
    // (same derivation as the Roznamcha reports route); Super Admin is unrestricted.
    let scope: { countryIds: string[]; countryBranchIds: string[]; cityBranchIds: string[] } | null = null;
    if (!session.isSuperAdmin) {
      scope = { countryIds: [], countryBranchIds: [], cityBranchIds: [] };
      for (const a of session.assignments) {
        if (a.cityBranchId) scope.cityBranchIds.push(a.cityBranchId);
        else if (a.countryBranchId) scope.countryBranchIds.push(a.countryBranchId);
        else if (a.countryId) scope.countryIds.push(a.countryId);
      }
    }

    const countryId = searchParams.get("countryId") || undefined;
    const countryBranchId = searchParams.get("countryBranchId") || undefined;
    const cityBranchId = searchParams.get("cityBranchId") || undefined;
    const direction = (searchParams.get("direction") as "cr" | "dr" | "all") || "all";
    const status = searchParams.get("status") || undefined;
    const module = searchParams.get("module") || undefined;
    const party = searchParams.get("party") || undefined;
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;
    const isFlaggedParam = searchParams.get("isFlagged");
    const isFlagged = isFlaggedParam !== null ? isFlaggedParam === "true" : undefined;
    const search = searchParams.get("search") || undefined;
    const limit = Number(searchParams.get("limit") || 50);
    const offset = Number(searchParams.get("offset") || 0);

    const result = await settlementService.listTransactions({
      countryId,
      countryBranchId,
      cityBranchId,
      direction,
      status,
      module,
      party,
      fromDate,
      toDate,
      isFlagged,
      search,
      limit,
      offset,
      scope
    });

    const lang = await getRequestLanguage(searchParams.get("lang"));
    try {
      result.items = await localizeRecordFields<any>(result.items, "settlement_transactions", ["party_name"], lang);
      result.items = await localizeJoinedNames<any>(result.items, lang, [
        { idField: "country_id", nameField: "country_name", table: "countries" },
        { idField: "country_branch_id", nameField: "branch_name", table: "country_branches", field: "name" },
        { idField: "city_branch_id", nameField: "city_branch_name", table: "city_branches", field: "name" }
      ]);
    } catch {
      // keep original names
    }

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
