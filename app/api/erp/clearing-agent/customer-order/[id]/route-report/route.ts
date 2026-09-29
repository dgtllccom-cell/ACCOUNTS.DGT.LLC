import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { routeReport } from "@/lib/services/clearing-order-route-insurance-service";

export const dynamic = "force-dynamic";

/** Live route report: legs, route check, customs, handovers, insurance coverage + gaps, partner bills per leg. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    return apiOk(await routeReport(session, id));
  } catch (error) {
    return handleApiError(error);
  }
}
