import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { wantsRawRecord } from "@/lib/i18n/localize-records";
import { deleteTempBill, getTempBill, updateTempBill, mapTempBillError } from "@/lib/temp-bills/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await ctx.params;
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const bill = await getTempBill(session, id, lang, wantsRawRecord(request));
    if (!bill) return apiError("NOT_FOUND", "Bill not found.", 404);
    return apiOk({ bill });
  } catch (error) {
    const m = mapTempBillError(error);
    return apiError(m.code, m.message, m.status);
  }
}

const patchSchema = z.object({
  billKind: z.enum(["purchase", "sale"]).optional(),
  partyAccountId: z.string().uuid().nullable().optional(),
  partyCustomerId: z.string().uuid().nullable().optional(),
  partyName: z.string().trim().min(1).max(240).optional(),
  referenceNo: z.string().trim().max(120).nullable().optional(),
  goodsId: z.string().uuid().nullable().optional(),
  goodsName: z.string().trim().max(240).nullable().optional(),
  billNo: z.string().trim().max(120).nullable().optional(),
  containerNo: z.string().trim().max(120).nullable().optional(),
  blNo: z.string().trim().max(120).nullable().optional(),
  billDate: z.string().trim().max(40).nullable().optional(),
  quantity: z.union([z.number(), z.string().trim()]).nullable().optional(),
  weightCartons: z.union([z.number(), z.string().trim()]).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  rate: z.union([z.number(), z.string().trim()]).nullable().optional(),
  amount: z.union([z.number(), z.string().trim()]).nullable().optional(),
  currencyCode: z.string().trim().max(8).nullable().optional(),
  remarks: z.string().trim().max(4000).nullable().optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    await updateTempBill(session, id, {
      ...body,
      quantity: body.quantity == null ? body.quantity : Number(body.quantity),
      weightCartons: body.weightCartons == null ? body.weightCartons : Number(body.weightCartons),
      rate: body.rate == null ? body.rate : Number(body.rate),
      amount: body.amount == null ? body.amount : Number(body.amount),
    });
    await auditApiAction(request, { action: "temp_bill.update.api", entityTable: "temp_bill", entityId: id, after: body });
    return apiOk({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("BAD_REQUEST", error.issues.map((i) => i.message).join("; "), 400);
    const m = mapTempBillError(error);
    return apiError(m.code, m.message, m.status);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await ctx.params;
    await deleteTempBill(session, id);
    await auditApiAction(request, { action: "temp_bill.delete.api", entityTable: "temp_bill", entityId: id });
    return apiOk({ ok: true });
  } catch (error) {
    const m = mapTempBillError(error);
    return apiError(m.code, m.message, m.status);
  }
}
