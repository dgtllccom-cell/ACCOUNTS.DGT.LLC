import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { updatePolicy } from "@/lib/services/clearing-order-route-insurance-service";
import { policySchema } from "@/lib/services/clearing-order-insurance-schema";

export const dynamic = "force-dynamic";

/** Edit a policy or cancel it ({ status: "cancelled" }). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; policyId: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    const p = z.object({ id: z.string().uuid(), policyId: z.string().uuid() }).parse(await ctx.params);
    const body = policySchema.partial().extend({ status: z.enum(["active", "cancelled"]).optional() }).parse(await request.json());
    return apiOk(await updatePolicy(session, p.id, p.policyId, body));
  } catch (error) {
    return handleApiError(error);
  }
}
