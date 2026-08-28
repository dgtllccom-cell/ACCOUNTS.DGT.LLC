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
      offset
    });

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
