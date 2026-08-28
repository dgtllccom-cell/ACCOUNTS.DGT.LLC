export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { businessShippingHandoverService, type HandoverScope } from "@/lib/services/business-shipping-handover-service";

function scopeOf(session: any): HandoverScope {
  const global = session.isSuperAdmin || (session.roles ?? []).includes("super_admin_reports");
  return {
    isSuperAdmin: !!session.isSuperAdmin,
    isShippingScoped: !!session.isShippingScoped,
    countryIds: global ? null : (session.countryIds ?? []),
    countryBranchIds: global ? null : (session.countryBranchIds ?? []),
    cityBranchIds: global ? null : (session.cityBranchIds ?? []),
    clearingAgentIds: session.clearingAgentIds ?? [],
  };
}

const idSchema = z.object({ id: z.string().uuid() });
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("cancel") }),
]);

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const scope = scopeOf(session);
    const actorName = session.fullName ?? null;

    if (body.action === "approve") {
      // the receiving (shipping/clearing) side accepts the handover
      authorizeApiScope(session, { resource: "shipping_records", action: "write" });
      return apiOk({ result: await businessShippingHandoverService.approve(id, scope, session.userId, actorName) });
    }
    if (body.action === "reject") {
      authorizeApiScope(session, { resource: "shipping_records", action: "write" });
      return apiOk({ result: await businessShippingHandoverService.reject(id, body.reason || "Rejected by shipping.", scope, session.userId, actorName) });
    }
    authorizeApiScope(session, { resource: "purchases", action: "write" });
    return apiOk({ result: await businessShippingHandoverService.cancel(id, scope, session.userId) });
  } catch (error) {
    return handleApiError(error);
  }
}
