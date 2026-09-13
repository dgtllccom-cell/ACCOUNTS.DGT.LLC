import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
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
    const settlementId = searchParams.get("settlementId");

    if (!settlementId) {
      return apiOk([]);
    }

    let links: any[] = await settlementService.getTransactionLinks(settlementId);
    const lang = await getRequestLanguage(searchParams.get("lang"));
    try {
      links = await localizeJoinedNames<any>(links, lang, [
        { idField: "cr_settlement_id", nameField: "cr_party", table: "settlement_transactions", field: "party_name" },
        { idField: "dr_settlement_id", nameField: "dr_party", table: "settlement_transactions", field: "party_name" }
      ]);
    } catch {
      // keep original names
    }
    return apiOk(links);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();

    const { crSettlementId, drSettlementId, linkAmount, remarks, isAuto } = body;

    if (!crSettlementId || !drSettlementId || !linkAmount || Number(linkAmount) <= 0) {
      return handleApiError(new Error("Missing required link parameters: crSettlementId, drSettlementId, linkAmount > 0"));
    }

    const result = await settlementService.createLink({
      crSettlementId,
      drSettlementId,
      linkAmount: Number(linkAmount),
      settledBy: session.userId,
      remarks,
      isAuto: Boolean(isAuto)
    });

    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
