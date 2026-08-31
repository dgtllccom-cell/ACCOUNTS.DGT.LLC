import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { createFollowUpTask } from "@/lib/customer-inquiry/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  assignedTo: z.string().uuid(),
  dueAt: z.string().trim().max(40).optional().nullable(),
  instructions: z.string().trim().max(4000).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().nullable(),
});

/** Create a follow-up in the existing User Tasks module, linked to this inquiry. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid follow-up", 400, parsed.error.flatten());
    const res = await createFollowUpTask(auth.session, id, parsed.data);
    try { await auditApiAction(request, { action: "customer_inquiries.followup_task", entityTable: "customer_inquiries", entityId: id, after: res }); } catch {}
    return apiCreated(res);
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
