export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createLegHandoff } from "@/lib/services/clearing-order-workflow-service";

const schema = z.object({
  toCountryId: z.string().uuid(),
  toCountryBranchId: z.string().uuid().nullish(),
  toCityBranchId: z.string().uuid().nullish(),
  narration: z.string().trim().max(2000).nullish(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; legId: string }> }) {
  try {
    const session = await requireErpSession();
    const { legId } = await ctx.params;
    const body = schema.parse(await request.json());
    const result = await createLegHandoff(session, { legId, ...body });
    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
