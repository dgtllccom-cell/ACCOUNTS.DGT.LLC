import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { getStockHistory } from "@/lib/services/stock-journal-service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  sourceType: z.enum(["purchase_booking", "local_purchase"]),
  sourceId: uuidSchema,
  loadingRecordId: uuidSchema.optional(),
});

/** Complete linked transaction history of a booking / loading record / local purchase (scope-checked). */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const sp = request.nextUrl.searchParams;
    const q = querySchema.parse({ sourceType: sp.get("sourceType"), sourceId: sp.get("sourceId"), loadingRecordId: sp.get("loadingRecordId") || undefined });
    return apiOk(await getStockHistory(session, q));
  } catch (error) {
    return handleApiError(error);
  }
}
