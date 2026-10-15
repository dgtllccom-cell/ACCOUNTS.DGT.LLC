import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { confirmStock } from "@/lib/services/stock-journal-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(80),
  purchaseOrderId: uuidSchema,
  loadingRecordId: uuidSchema,
  lineKey: z.string().trim().min(1).max(200),
  destinationType: z.enum(["warehouse", "local_sales", "export", "direct_sale"]),
  warehouseId: uuidSchema.nullish(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  customerId: uuidSchema.nullish(),
  customerName: z.string().trim().max(200).nullish(),
  salesOrderNo: z.string().trim().max(80).nullish(),
  documentRef: z.string().trim().max(120).nullish(),
  referenceNo: z.string().trim().max(120).nullish(),
  remarks: z.string().trim().max(500).nullish(),
  transferDate: z.string().nullish(),
  authorized: z.boolean().refine((v) => v === true, { message: "authorization_required" }),
});

/** Confirm Stock: an authorized user allocates received + customs-cleared stock to a destination. Idempotent. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Validation failed", 400, parsed.error.flatten().fieldErrors);
    const result = await confirmStock(session, parsed.data);
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
