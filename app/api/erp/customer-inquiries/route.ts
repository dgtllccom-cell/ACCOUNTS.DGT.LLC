import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { getRequestLanguage } from "@/lib/i18n/server";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { createInquiry, listInquiries } from "@/lib/customer-inquiry/service";
import { canManageInquiries } from "@/lib/customer-inquiry/access";
import { INQUIRY_SOURCES, INQUIRY_STATUSES } from "@/lib/customer-inquiry/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const p = request.nextUrl.searchParams;
    const lang = await getRequestLanguage(p.get("lang"));
    const scope = (p.get("scope") || "all").toLowerCase();
    const rows = await listInquiries(auth.session, {
      scope: (["all", "mine", "assigned", "follow_up"].includes(scope) ? scope : "all") as any,
      status: p.get("status"),
      source: p.get("source"),
      assigneeId: p.get("assigneeId"),
      countryId: p.get("countryId"),
      q: p.get("q"),
      lang,
      original: p.get("original") === "1",
      limit: p.get("limit") ? Number(p.get("limit")) : undefined,
    });
    return apiOk({ rows, canManage: canManageInquiries(auth.session), lang });
  } catch (error) {
    return inquiryErrorResponse(error, { rows: [], canManage: false });
  }
}

const createSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  customerName: z.string().trim().min(1).max(240),
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
  source: z.enum(INQUIRY_SOURCES).optional().nullable(),
  inquiryDate: z.string().trim().max(40).optional().nullable(),
  followUpDate: z.string().trim().max(40).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  countryId: z.string().uuid().optional().nullable(),
  countryBranchId: z.string().uuid().optional().nullable(),
  cityBranchId: z.string().uuid().optional().nullable(),
  entryMode: z.enum(["manual", "ai_text", "ai_voice"]).optional(),
  aiRawInput: z.string().trim().max(16000).optional().nullable(),
  aiConfidence: z.number().min(0).max(1).optional().nullable(),
  originalLanguageCode: z.enum(["en", "ur", "ps", "fa", "ar"]).optional().nullable(),
  status: z.enum(INQUIRY_STATUSES).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid inquiry", 400, parsed.error.flatten());
    const { id, inquiryNo } = await createInquiry(auth.session, parsed.data);
    try {
      await auditApiAction(request, {
        action: "customer_inquiries.create",
        entityTable: "customer_inquiries",
        entityId: id,
        after: { inquiryNo, customerName: parsed.data.customerName },
      });
    } catch {}
    return apiCreated({ id, inquiryNo });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
