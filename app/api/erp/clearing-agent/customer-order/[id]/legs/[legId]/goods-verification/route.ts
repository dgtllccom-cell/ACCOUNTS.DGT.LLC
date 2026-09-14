export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { recordGoodsVerification } from "@/lib/services/clearing-order-workflow-service";

const schema = z.object({
  bookedQuantity: z.number().nullish(),
  bookedUnit: z.string().trim().max(40).nullish(),
  bookedCartons: z.number().int().nullish(),
  bookedGrossWeight: z.number().nullish(),
  bookedNetWeight: z.number().nullish(),
  verifiedQuantity: z.number().nullish(),
  verifiedUnit: z.string().trim().max(40).nullish(),
  verifiedCartons: z.number().int().nullish(),
  verifiedGrossWeight: z.number().nullish(),
  verifiedNetWeight: z.number().nullish(),
  warehouseId: z.string().uuid().nullish(),
  loadingSourceText: z.string().trim().max(240).nullish(),
  supportingDocument: z.string().trim().max(400).nullish(),
  result: z.enum(["verified", "discrepancy", "returned"]),
  discrepancyNotes: z.string().trim().max(2000).nullish(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; legId: string }> }) {
  try {
    const session = await requireErpSession();
    const { id, legId } = await ctx.params;
    const body = schema.parse(await request.json());
    const result = await recordGoodsVerification(session, { orderId: id, legId, ...body });
    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
