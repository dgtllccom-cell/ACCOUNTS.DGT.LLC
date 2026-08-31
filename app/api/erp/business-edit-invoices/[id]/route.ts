import { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { getRequestLanguage } from "@/lib/i18n/server";
import { requireBeiSession, beiErrorResponse } from "@/lib/business-edit-invoice/route-helpers";
import { getInvoice, updateInvoice, deleteInvoice } from "@/lib/business-edit-invoice/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireBeiSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const p = request.nextUrl.searchParams;
    const lang = await getRequestLanguage(p.get("lang"));
    const invoice = await getInvoice(auth.session, id, { lang, original: p.get("original") === "1" });
    return apiOk({ invoice, lang });
  } catch (error) {
    return beiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireBeiSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const invoice = await updateInvoice(auth.session, id, body);
    try {
      await auditApiAction(request, {
        action: "business_edit_invoices.update",
        entityTable: "business_edit_invoices",
        entityId: id,
        after: { version: invoice.versionNo, documentTotalValue: invoice.documentTotalValue },
      });
    } catch {}
    return apiOk({ invoice });
  } catch (error) {
    return beiErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireBeiSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    await deleteInvoice(auth.session, id);
    return apiOk({ ok: true });
  } catch (error) {
    return beiErrorResponse(error);
  }
}
