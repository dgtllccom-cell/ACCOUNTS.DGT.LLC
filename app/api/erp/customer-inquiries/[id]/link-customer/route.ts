import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { linkCustomer, convertToCustomer } from "@/lib/customer-inquiry/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  convert: z.boolean().optional(),
});

/**
 * Link this inquiry to an EXISTING customer master (never duplicate), or
 * `convert:true` to create/attach a customers row from the inquiry.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid request", 400, parsed.error.flatten());

    if (parsed.data.convert) {
      const res = await convertToCustomer(auth.session, id);
      try { await auditApiAction(request, { action: "customer_inquiries.convert", entityTable: "customer_inquiries", entityId: id, after: res }); } catch {}
      return apiOk({ ok: true, ...res });
    }
    if (!parsed.data.customerId) return apiError("VALIDATION", "customerId is required to link.", 400);
    await linkCustomer(auth.session, id, parsed.data.customerId);
    try { await auditApiAction(request, { action: "customer_inquiries.link", entityTable: "customer_inquiries", entityId: id, after: { customerId: parsed.data.customerId } }); } catch {}
    return apiOk({ ok: true });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
