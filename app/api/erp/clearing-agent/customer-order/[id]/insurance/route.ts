import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { addPolicy } from "@/lib/services/clearing-order-route-insurance-service";
import { policySchema } from "@/lib/services/clearing-order-insurance-schema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    return apiCreated(await addPolicy(session, id, policySchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}
