import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeLogistics } from "@/lib/api/scope-middleware";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getLaneLoad } from "@/lib/services/purchase-lane-service";
import { laneSettlementPreview } from "@/lib/services/lane-settlement-preview";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeLogistics(session, { action: "read" });
    const id = z.string().uuid().parse((await context.params).id);
    const detail = await getLaneLoad(session,id);
    if (!detail) return apiError("NOT_FOUND", "Load not found in your scope.",404);
    return apiOk({ bills: [await laneSettlementPreview(session,detail.load)].filter(Boolean) });
  } catch (error) { return handleApiError(error); }
}
