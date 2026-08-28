import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrKycService } from "@/lib/services/hr-kyc-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  decision: z.enum(["verified", "rejected"]),
  reason: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const { decision, reason } = bodySchema.parse(await request.json());
    const res = await hrKycService.verifyDocument(id, decision, session.userId, scope, reason);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
