import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { setCustomerApproval } from "@/lib/customer-inquiry/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["approved", "declined", "not_required"]),
  note: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid approval", 400, parsed.error.flatten());
    await setCustomerApproval(auth.session, id, parsed.data.status, parsed.data.note);
    try { await auditApiAction(request, { action: "customer_inquiries.customer_approval", entityTable: "customer_inquiries", entityId: id, after: { status: parsed.data.status } }); } catch {}
    return apiOk({ ok: true });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
