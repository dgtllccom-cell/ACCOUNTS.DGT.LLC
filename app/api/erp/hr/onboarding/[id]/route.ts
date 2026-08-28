import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrOnboardingService } from "@/lib/services/hr-onboarding-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const patchSchema = z.object({
  status: z.enum(["pending", "in_progress", "done", "not_applicable"]).optional(),
  notes: z.string().trim().max(2000).nullish(),
  dueDate: z.string().nullish(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const res = await hrOnboardingService.updateTask(id, body, session.userId, scope);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
