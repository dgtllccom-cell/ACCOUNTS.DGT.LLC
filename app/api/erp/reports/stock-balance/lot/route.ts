import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { loadLotReport } from "@/lib/services/stock-balance-report-service";

export const dynamic = "force-dynamic";

const querySchema = z.object({ type: z.enum(["booking", "local"]), billId: uuidSchema, lotNo: z.string().trim().min(1).max(200) });

/** Individual Lot Report: purchase, related sales, stock transfers, treatment history and the remaining balance of one lot. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const sp = request.nextUrl.searchParams;
    const q = querySchema.parse({ type: sp.get("type"), billId: sp.get("billId"), lotNo: sp.get("lotNo") });
    const lang = await getRequestLanguage(sp.get("lang"));
    return apiOk(await loadLotReport(session, { type: q.type, billId: q.billId, lotNo: q.lotNo, lang }));
  } catch (error) {
    return handleApiError(error);
  }
}
