import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { setCustomsStatus } from "@/lib/services/stock-journal-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  loadingRecordId: uuidSchema,
  customsStatus: z.enum(["pending", "submitted", "cleared", "not_applicable"]),
  reference: z.string().trim().max(120).nullish(),
});

/** Records the customs status of a loading record when no Clearing order carries its container / B/L. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Validation failed", 400, parsed.error.flatten().fieldErrors);
    return apiOk(await setCustomsStatus(session, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
