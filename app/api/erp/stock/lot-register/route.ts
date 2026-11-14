export const dynamic = "force-dynamic";

import { requireErpSession } from "@/lib/auth/session";
import { apiOk, handleApiError } from "@/lib/api/response";
import { loadLotRegister } from "@/lib/services/lot-register-service";

/**
 * GET /api/erp/stock/lot-register -> Current Stock by lot and warehouse: original lot, receipts, transfers, sales, available,
 * remaining weight, the reconciliation to product_inventory_balances, and every stock flow with its record id. Read only.
 */
export async function GET() {
  try {
    const session = await requireErpSession();
    return apiOk(await loadLotRegister(session));
  } catch (error) {
    return handleApiError(error);
  }
}
