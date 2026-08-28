import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { documentIntakeService } from "@/lib/services/document-intake-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  fieldKey: z.string().trim().min(1).max(80),
  correctedValue: z.string().trim().max(4000).nullish(),
  verified: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardIntake("write");
    const { id } = idSchema.parse(await ctx.params);
    const body = bodySchema.parse(await request.json());
    const res = await documentIntakeService.updateField(id, body.fieldKey, { correctedValue: body.correctedValue, verified: body.verified }, session.userId, session.fullName ?? null, scope);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
