import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, rethrowIfNextControlFlow } from "@/lib/api/response";
import { revokeReviewPass } from "@/lib/mobile/device-service";
import { requireSuperAdminSession } from "@/lib/mobile/device-admin";

/** Revokes the pass AND blocks every device that was activated with it. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperAdminSession();
    const id = z.string().uuid().parse((await ctx.params).id);
    const blocked = await revokeReviewPass(id, session.userId);
    return apiOk({ revoked: true, devicesBlocked: blocked });
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return handleApiError(e);
  }
}
