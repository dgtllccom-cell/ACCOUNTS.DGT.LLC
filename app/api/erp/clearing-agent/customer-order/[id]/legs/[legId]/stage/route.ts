export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { advanceLegStage, LEG_STAGES } from "@/lib/services/clearing-order-workflow-service";

const schema = z.object({ stage: z.enum(LEG_STAGES) });

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; legId: string }> }) {
  try {
    const session = await requireErpSession();
    const { legId } = await ctx.params;
    const body = schema.parse(await request.json());
    const result = await advanceLegStage(session, { legId, ...body });
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
