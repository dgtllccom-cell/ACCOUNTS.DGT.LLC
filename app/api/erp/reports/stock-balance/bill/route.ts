import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiClientError, apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { cardsOf, loadBalance } from "@/lib/services/stock-balance-report-service";
import { goodsWise } from "@/lib/stock-balance/model";

export const dynamic = "force-dynamic";

const querySchema = z.object({ type: z.enum(["booking", "local"]), id: uuidSchema });

/** The complete journal of ONE purchase bill: header, goods entries, sales against it, lot-wise balance, payments and treatments. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const sp = request.nextUrl.searchParams;
    const q = querySchema.parse({ type: sp.get("type"), id: sp.get("id") });
    const lang = await getRequestLanguage(sp.get("lang"));
    const { bills, perms } = await loadBalance(session, { type: q.type, billId: q.id, lang });
    const bill = bills[0];
    if (!bill) throw new ApiClientError("Purchase bill not found or outside your authorized scope.", { status: 404, code: "NOT_FOUND" });
    return apiOk({ bill, cards: cardsOf([bill], perms.money), goodsWise: goodsWise(bill.entries), perms });
  } catch (error) {
    return handleApiError(error);
  }
}
