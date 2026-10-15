import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { reverseConfirmation } from "@/lib/services/stock-journal-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ transferId: uuidSchema, reason: z.string().trim().min(3, "Enter the reason for the reversal").max(500) });

/** Reverse a confirmed (not yet issued) allocation: releases the reservation / restores the warehouse move, keeps the audit row. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Validation failed", 400, parsed.error.flatten().fieldErrors);
    return apiOk(await reverseConfirmation(session, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
