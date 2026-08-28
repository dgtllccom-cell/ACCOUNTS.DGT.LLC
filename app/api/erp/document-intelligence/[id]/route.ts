import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { documentIntakeService } from "@/lib/services/document-intake-service";
import { checkRateLimit, sweepRateLimiter } from "@/lib/document-intelligence/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const patchSchema = z.object({
  action: z.enum(["process", "cancel", "qvc", "confirm"]),
  reason: z.string().trim().max(2000).optional(),
  linkMode: z.enum(["new_record", "append_existing"]).optional(),
  targetModule: z.string().trim().max(120).optional(),
});

export async function GET(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardIntake("read");
    const { id } = idSchema.parse(await ctx.params);
    const data = await documentIntakeService.get(id, scope);
    if (!data) return apiError("NOT_FOUND", "Document job not found in your scope.", 404);
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardIntake("write");
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const actorName = session.fullName ?? null;
    if (body.action === "process") {
      sweepRateLimiter();
      const rl = checkRateLimit("process", session.userId);
      if (!rl.ok) return apiError("RATE_LIMITED", `Too many processing requests — retry in ${rl.retryAfterSec}s.`, 429);
      const res = await documentIntakeService.processJob(id, session.userId, actorName, scope);
      return apiOk({ result: res });
    }
    if (body.action === "cancel") {
      const res = await documentIntakeService.cancelJob(id, session.userId, actorName, scope);
      return apiOk({ result: res });
    }
    if (body.action === "confirm") {
      const res = await documentIntakeService.confirmDraft(
        id,
        { linkMode: body.linkMode, targetModuleOverride: body.targetModule ?? null },
        session.userId, actorName, scope,
      );
      return apiOk({ result: res });
    }
    const res = await documentIntakeService.sendToQvc(id, body.reason || "Sent to QVC for manual review.", session.userId, actorName, scope);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
