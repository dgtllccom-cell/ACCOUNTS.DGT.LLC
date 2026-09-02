import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireConsignmentSession, consignmentErrorResponse } from "@/lib/consignment/route-helpers";
import {
  addContainer,
  addContainerGood,
  addExpense,
  addSale,
  addReceipt,
  deleteChild,
} from "@/lib/consignment/service";
import { CONTAINER_STATUSES, EXPENSE_TYPES, RECEIPT_METHODS } from "@/lib/consignment/types";

export const dynamic = "force-dynamic";

const num = z.union([z.number(), z.string().trim().transform((v) => (v === "" ? null : Number(v)))]).nullable().optional();
const uuid = z.string().uuid().nullable().optional();
const txt = (n: number) => z.string().trim().max(n).nullable().optional();

const containerSchema = z.object({
  kind: z.literal("container"),
  container_no: txt(120), bl_no: txt(120), loading_date: txt(40), arrival_date: txt(40),
  vessel_name: txt(160), shipping_line: txt(160), origin_country_id: uuid, seal_no: txt(80),
  total_cartons: num, total_gross_weight: num, total_net_weight: num,
  status: z.enum(CONTAINER_STATUSES).optional(), notes: txt(2000),
});
const goodSchema = z.object({
  kind: z.literal("good"),
  container_id: z.string().uuid(),
  goods_id: uuid, goods_name: z.string().trim().min(1).max(240), unit_id: uuid, unit_label: txt(60),
  cartons: num, quantity: num, gross_weight: num, net_weight: num, rate: num, amount: num,
  currency: txt(8), notes: txt(2000),
});
const expenseSchema = z.object({
  kind: z.literal("expense"),
  container_id: uuid, expense_type: z.enum(EXPENSE_TYPES).optional(), description: txt(400),
  currency: txt(8), amount: num, expense_date: txt(40), paid_by: txt(160), reference_no: txt(120), notes: txt(2000),
});
const saleSchema = z.object({
  kind: z.literal("sale"),
  container_id: uuid, sale_date: txt(40), buyer_name: txt(240),
  goods_id: uuid, goods_name: z.string().trim().min(1).max(240), unit_id: uuid, unit_label: txt(60),
  quantity: num, rate: num, currency: txt(8), amount: num, reference_no: txt(120), notes: txt(2000),
});
const receiptSchema = z.object({
  kind: z.literal("receipt"),
  receipt_date: txt(40), amount: num, currency: txt(8),
  method: z.enum(RECEIPT_METHODS).optional(), reference_no: txt(120), notes: txt(2000),
});
const bodySchema = z.discriminatedUnion("kind", [containerSchema, goodSchema, expenseSchema, saleSchema, receiptSchema]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsignmentSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid entry", 400, parsed.error.flatten());
    const b = parsed.data as any;
    let out: { id: string };
    switch (b.kind) {
      case "container": out = await addContainer(auth.session, id, b); break;
      case "good": out = await addContainerGood(auth.session, id, b.container_id, b); break;
      case "expense": out = await addExpense(auth.session, id, b); break;
      case "sale": out = await addSale(auth.session, id, b); break;
      case "receipt": out = await addReceipt(auth.session, id, b); break;
      default: return apiError("VALIDATION", "Unknown entry kind", 400);
    }
    try {
      await auditApiAction(request, { action: `consignment.${b.kind}.add`, entityTable: "consignment", entityId: id, after: { childId: out.id } });
    } catch {}
    return apiCreated(out);
  } catch (error) {
    return consignmentErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsignmentSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const p = request.nextUrl.searchParams;
    const kind = p.get("kind");
    const childId = p.get("childId");
    if (!kind || !childId || !["container", "good", "expense", "sale", "receipt"].includes(kind)) {
      return apiError("VALIDATION", "kind and childId are required", 400);
    }
    await deleteChild(auth.session, kind as any, id, childId);
    try {
      await auditApiAction(request, { action: `consignment.${kind}.delete`, entityTable: "consignment", entityId: id, after: { childId } });
    } catch {}
    return apiOk({ id, childId });
  } catch (error) {
    return consignmentErrorResponse(error);
  }
}
