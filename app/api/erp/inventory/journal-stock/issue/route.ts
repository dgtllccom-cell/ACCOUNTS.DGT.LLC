import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { issueStock } from "@/lib/services/stock-journal-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  transferId: uuidSchema,
  issueType: z.enum(["goods_issue", "dispatch", "delivery"]),
  issueRef: z.string().trim().min(1, "Enter the document reference").max(120),
  salesOrderNo: z.string().trim().max(80).nullish(),
  remarks: z.string().trim().max(500).nullish(),
});

/** Goods Issue / Dispatch / Delivery — the only event that deducts physical stock. Issuing twice is a no-op. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Validation failed", 400, parsed.error.flatten().fieldErrors);
    return apiOk(await issueStock(session, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
