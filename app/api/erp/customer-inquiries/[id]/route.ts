import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { getRequestLanguage } from "@/lib/i18n/server";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { getInquiry, updateInquiry, deleteInquiry } from "@/lib/customer-inquiry/service";
import { INQUIRY_SOURCES } from "@/lib/customer-inquiry/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const original = request.nextUrl.searchParams.get("original") === "1";
    const inquiry = await getInquiry(auth.session, id, { lang, original });
    return apiOk({ inquiry, lang, viewingOriginal: original });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}

const patchSchema = z.object({
  customerName: z.string().trim().max(240).optional(),
  companyName: z.string().trim().max(240).optional().nullable(),
  contactPerson: z.string().trim().max(240).optional().nullable(),
  mobile: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  address: z.string().trim().max(600).optional().nullable(),
  businessType: z.string().trim().max(160).optional().nullable(),
  inquirySummary: z.string().trim().max(400).optional().nullable(),
  meetingNotes: z.string().trim().max(8000).optional().nullable(),
  requirements: z.string().trim().max(8000).optional().nullable(),
  source: z.enum(INQUIRY_SOURCES).optional(),
  inquiryDate: z.string().trim().max(40).optional().nullable(),
  followUpDate: z.string().trim().max(40).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
}).strict();

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid update", 400, parsed.error.flatten());
    await updateInquiry(auth.session, id, parsed.data);
    try { await auditApiAction(request, { action: "customer_inquiries.update", entityTable: "customer_inquiries", entityId: id, after: parsed.data }); } catch {}
    return apiOk({ ok: true });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    await deleteInquiry(auth.session, id);
    try { await auditApiAction(request, { action: "customer_inquiries.delete", entityTable: "customer_inquiries", entityId: id }); } catch {}
    return apiOk({ ok: true });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
