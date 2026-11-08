import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { auditApiAction } from "@/lib/api/audit";
import { transferLoadingConsignment } from "@/lib/consignment/loading-consignment-service";
import { CONSIGNMENT_DESTINATIONS } from "@/lib/consignment/loading-consignment-rules";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  key: z.string().trim().min(4).max(200),
  destination: z.enum(CONSIGNMENT_DESTINATIONS),
  qty: z.coerce.number().positive(),
  warehouseId: z.string().uuid().nullable().optional(),
  lotId: z.string().uuid().nullable().optional(),
  destinationNote: z.string().trim().max(500).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(100),
});

/**
 * POST /api/erp/consignment/loadings/transfer
 * Moves part or all of ONE loading's untransferred balance to Warehouse or Re-export, reusing the existing stock logic.
 * Idempotent (same idempotencyKey → same result, stock is never moved twice). No payment or ledger posting.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const body = bodySchema.parse(await request.json());
    const result = await transferLoadingConsignment(session, body);
    if (!result.replayed) {
      try {
        await auditApiAction(request, {
          action: "consignment.loading_transfer",
          entityTable: body.key.startsWith("pb:") ? "purchase_loading_records" : "local_purchases",
          entityId: body.key.split(":")[1],
          after: { key: body.key, ...result.transfer, availableQty: result.availableQty },
        });
      } catch {
        /* audit is best-effort */
      }
    }
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

