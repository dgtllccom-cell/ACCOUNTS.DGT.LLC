import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { getRequestLanguage } from "@/lib/i18n/server";
import { requireBeiSession, beiErrorResponse } from "@/lib/business-edit-invoice/route-helpers";
import { createFromBill, listInvoices } from "@/lib/business-edit-invoice/service";
import { canManageBusinessEditInvoice } from "@/lib/business-edit-invoice/access";
import { BEI_DOC_TYPES, BEI_SOURCE_MODULES } from "@/lib/business-edit-invoice/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireBeiSession();
  if ("response" in auth) return auth.response;
  try {
    const p = request.nextUrl.searchParams;
    const lang = await getRequestLanguage(p.get("lang"));
    const rows = await listInvoices(auth.session, {
      q: p.get("q") ?? undefined,
      docType: p.get("docType") ?? undefined,
      status: p.get("status") ?? undefined,
      countryId: p.get("countryId") ?? undefined,
      branchId: p.get("branchId") ?? undefined,
      lang,
      original: p.get("original") === "1",
      limit: p.get("limit") ? Number(p.get("limit")) : undefined,
    });
    return apiOk({ rows, canManage: canManageBusinessEditInvoice(auth.session), lang });
  } catch (error) {
    return beiErrorResponse(error, { rows: [], canManage: false });
  }
}

const createSchema = z.object({
  sourceModule: z.enum(BEI_SOURCE_MODULES),
  sourceId: z.string().uuid(),
  docType: z.enum(BEI_DOC_TYPES).optional(),
  lang: z.enum(["en", "ur", "ps", "fa", "ar"]).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireBeiSession();
  if ("response" in auth) return auth.response;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid request", 400, parsed.error.flatten());
    const inv = await createFromBill(auth.session, parsed.data);
    try {
      await auditApiAction(request, {
        action: "business_edit_invoices.create",
        entityTable: "business_edit_invoices",
        entityId: inv.id,
        after: { invoiceNo: inv.invoiceNo, sourceModule: inv.sourceModule, originalTotalValue: inv.originalTotalValue },
      });
    } catch {}
    return apiCreated({ id: inv.id, invoiceNo: inv.invoiceNo, invoice: inv });
  } catch (error) {
    return beiErrorResponse(error);
  }
}
