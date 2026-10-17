import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { cancelTreatment, createTreatment, updateTreatment } from "@/lib/services/stock-balance-report-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(80),
  billType: z.enum(["booking", "local"]),
  billId: uuidSchema,
  lotNo: z.string().trim().min(1).max(200),
  entryKey: z.string().trim().min(1).max(200),
  treatmentType: z.string().trim().min(2).max(120),
  treatmentDate: z.string().nullish(),
  qtyReceived: z.coerce.number().positive("Quantity must be greater than zero"),
  qtyTreated: z.coerce.number().min(0).default(0),
  qtyLoss: z.coerce.number().min(0).default(0),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  warehouseId: uuidSchema.nullish(),
  remarks: z.string().trim().max(500).nullish(),
});
const updateSchema = z.object({
  id: uuidSchema,
  qtyTreated: z.coerce.number().min(0).optional(),
  qtyLoss: z.coerce.number().min(0).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  remarks: z.string().trim().max(500).nullish(),
  treatmentType: z.string().trim().min(2).max(120).optional(),
});
const cancelSchema = z.object({ id: uuidSchema, reason: z.string().trim().min(3, "Enter the reason").max(500) });

/** Treatment Register: add (POST), update progress (PATCH), cancel (DELETE). Information only, stock never moves. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "create" });
    const p = createSchema.safeParse(await request.json());
    if (!p.success) return apiError("VALIDATION_ERROR", p.error.issues[0]?.message || "Validation failed", 400, p.error.flatten().fieldErrors);
    return apiOk(await createTreatment(session, p.data));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "update" });
    const p = updateSchema.safeParse(await request.json());
    if (!p.success) return apiError("VALIDATION_ERROR", p.error.issues[0]?.message || "Validation failed", 400, p.error.flatten().fieldErrors);
    return apiOk({ treatment: await updateTreatment(session, p.data) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "delete" });
    const p = cancelSchema.safeParse(await request.json());
    if (!p.success) return apiError("VALIDATION_ERROR", p.error.issues[0]?.message || "Validation failed", 400, p.error.flatten().fieldErrors);
    return apiOk({ treatment: await cancelTreatment(session, p.data) });
  } catch (error) {
    return handleApiError(error);
  }
}
