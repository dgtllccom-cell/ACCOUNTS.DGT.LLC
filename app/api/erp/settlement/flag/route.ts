import { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { requireSettlementAccess, canAccessSettlementRecord } from "@/lib/permissions/settlement-access";
import { settlementService } from "@/lib/services/settlement-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { session } = await requireSettlementAccess("write");
    const body = await request.json();

    const { settlementId, isFlagged, reason } = body;

    if (!settlementId || typeof isFlagged !== "boolean") {
      return handleApiError(new Error("settlementId and boolean isFlagged are required"));
    }

    if (!canAccessSettlementRecord(session, await settlementService.getTransactionScope(settlementId))) {
      return apiError("FORBIDDEN", "This settlement transaction is outside your assigned scope.", 403);
    }
    await settlementService.toggleFlag({
      settlementId,
      isFlagged,
      reason,
      reviewerId: session.userId
    });

    return apiOk({ success: true, message: isFlagged ? "Transaction flagged" : "Flag cleared" });
  } catch (error) {
    return handleApiError(error);
  }
}
