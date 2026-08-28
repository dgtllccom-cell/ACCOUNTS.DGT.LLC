import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { documentIntakeService } from "@/lib/services/document-intake-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const idSchema = z.object({ draftId: z.string().uuid() });
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("discard"), reason: z.string().trim().max(2000).optional() }),
  z.object({
    action: z.literal("consume"),
    createdSourceModule: z.string().trim().min(1).max(120),
    createdSourceId: z.string().uuid(),
  }),
]);

export async function GET(_r: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  try {
    const { scope } = await guardIntake("read");
    const { draftId } = idSchema.parse(await ctx.params);
    const draft = await documentIntakeService.getDraft(draftId, scope);
    if (!draft) return apiError("NOT_FOUND", "Draft not found in your scope.", 404);
    return apiOk({ draft });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  try {
    const { session, scope } = await guardIntake("write");
    const { draftId } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const actorName = session.fullName ?? null;
    if (body.action === "discard") {
      const res = await documentIntakeService.discardDraft(draftId, body.reason || "Discarded by reviewer.", session.userId, actorName, scope);
      return apiOk({ result: res });
    }
    const res = await documentIntakeService.consumeDraft(draftId, body.createdSourceModule, body.createdSourceId, session.userId, actorName, scope);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
