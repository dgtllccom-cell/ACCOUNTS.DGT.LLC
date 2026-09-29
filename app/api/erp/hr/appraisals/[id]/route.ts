import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { getAppraisal, updateDraft } from "@/lib/services/hr-appraisal-service";
import { goalsSchema } from "@/lib/services/hr-appraisal-schema";

export const dynamic = "force-dynamic";
const idSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = idSchema.parse(await ctx.params);
    return apiOk(await getAppraisal(session, id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Draft edits: goals / KPIs, scores, manager comments, strengths, improvement plan, reviewer (HR). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = idSchema.parse(await ctx.params);
    const body = z.object({
      goals: goalsSchema.optional(),
      managerComments: z.string().trim().max(4000).nullish(),
      strengths: z.string().trim().max(4000).nullish(),
      improvementPlan: z.string().trim().max(4000).nullish(),
      improvementDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
      reviewerId: z.string().uuid().nullish(),
    }).parse(await request.json());
    return apiOk(await updateDraft(session, id, body));
  } catch (error) {
    return handleApiError(error);
  }
}
