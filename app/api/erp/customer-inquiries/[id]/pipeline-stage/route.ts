import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { setPipelineStage } from "@/lib/customer-inquiry/service";
import { PIPELINE_STAGES } from "@/lib/customer-inquiry/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.enum(PIPELINE_STAGES),
  note: z.string().trim().max(2000).optional().nullable(),
  lostReason: z.string().trim().max(600).optional().nullable(),
  quotationValue: z.number().min(0).optional().nullable(),
  quotationCurrency: z.string().trim().max(10).optional().nullable(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid pipeline stage", 400, parsed.error.flatten());
    await setPipelineStage(auth.session, id, parsed.data.to, parsed.data);
    try { await auditApiAction(request, { action: "customer_inquiries.pipeline_stage", entityTable: "customer_inquiries", entityId: id, after: { to: parsed.data.to } }); } catch {}
    return apiOk({ ok: true });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
