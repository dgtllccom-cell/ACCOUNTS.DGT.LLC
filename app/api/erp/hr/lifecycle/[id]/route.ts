import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrLifecycleService } from "@/lib/services/hr-lifecycle-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  kind: z.enum(["position", "transfer", "separation"]),
  action: z.enum(["approve", "reject", "cancel", "apply"]),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const { kind, action } = bodySchema.parse(await request.json());
    if (action === "apply") {
      const res = await hrLifecycleService.apply(kind, id, session.userId, scope);
      return apiOk({ result: res });
    }
    const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled";
    const res = await hrLifecycleService.setStatus(kind, id, status, session.userId, scope);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
