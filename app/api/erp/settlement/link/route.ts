import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { settlementService } from "@/lib/services/settlement-service";

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

    const links = await settlementService.getTransactionLinks(settlementId);
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
