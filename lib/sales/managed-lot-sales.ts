/**
 * Bridges the Sales Order wizard to the Goods Transfer Journal's lots.
 *
 * A Sales Order carries `managedLotId` (+ place) on each goods entry that was picked from a managed lot.
 *   - saving the draft (POST/PATCH)  → reserves exactly the committed goods lines (idempotent, resizable)
 *   - deleting the draft             → releases the reservations
 *   - final billing / dispatch       → deducts the reservation once (reserved → sold / exported)
 * Orders that never touched a managed lot are untouched (no extra queries beyond a form_data check).
 */
import { ApiClientError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import {
  finalizeSaleStock,
  releaseSaleReservations,
  syncSaleReservations,
  type SaleEntry,
} from "@/lib/services/goods-transfer-service";

export type ManagedSale = { mode: "local" | "export"; entries: SaleEntry[] };

export function extractManagedEntries(formData: any): ManagedSale {
  const form = formData?.form ?? {};
  const goods: any[] = Array.isArray(formData?.goodsEntries) ? formData.goodsEntries : [];
  const mode: "local" | "export" = form.saleMode === "export" || form.isExportSale ? "export" : "local";
  const entries: SaleEntry[] = goods
    .filter((g) => g && g.managedLotId)
    .map((g) => ({
      lotId: String(g.managedLotId),
      qty: Number(g.qtyNo ?? g.quantity ?? 0),
      warehouseId: g.managedWarehouseId || null,
      rack: String(g.managedRack ?? ""),
      label: String(g.managedLabel ?? ""),
    }));
  return { mode, entries };
}

export function usesManagedLots(formData: any) {
  return extractManagedEntries(formData).entries.length > 0;
}

/** Make the order's reservations match its committed goods lines. */
export async function reserveForOrder(o: {
  salesOrderId: string;
  salesOrderNo: string | null;
  formData: any;
  previousFormData?: any;
  countryId: string | null;
  userId: string | null;
}) {
  const next = extractManagedEntries(o.formData);
  const hadManaged = o.previousFormData ? usesManagedLots(o.previousFormData) : false;
  if (next.entries.length === 0 && !hadManaged) return [];
  const out = await withLocalPg((sql) =>
    sql.begin((tx) =>
      syncSaleReservations(tx, {
        salesOrderId: o.salesOrderId,
        salesOrderNo: o.salesOrderNo,
        mode: next.mode,
        countryId: o.countryId,
        entries: next.entries,
        userId: o.userId,
      }),
    ),
  );
  return out ?? [];
}

export async function releaseForOrder(o: { salesOrderId: string; formData: any; userId: string | null; reason: string }) {
  if (!usesManagedLots(o.formData)) return 0;
  const n = await withLocalPg((sql) => sql.begin((tx) => releaseSaleReservations(tx, o.salesOrderId, o.reason, o.userId)));
  return n ?? 0;
}

/**
 * An Export Sales Order that sells a managed lot must be complete before final billing / dispatch:
 * customer, destination country, rate + currency, payment and delivery terms, transport mode, and the
 * shipping/clearing branch or agent that will carry it.
 */
export function assertExportRequirements(formData: any) {
  const { mode, entries } = extractManagedEntries(formData);
  if (mode !== "export" || entries.length === 0) return;
  const f = formData?.form ?? {};
  const goods: any[] = (formData?.goodsEntries ?? []).filter((g: any) => g?.managedLotId);
  const missing: string[] = [];
  if (!String(f.customerAccountNo || f.customerAccountId || "").trim()) missing.push("customer account");
  if (!String(f.receivedCountry || "").trim()) missing.push("destination country");
  if (!String(f.salesCurrency || f.currencyType || "").trim()) missing.push("sale currency");
  if (goods.some((g) => !(Number(g.coursePrice) > 0))) missing.push("sale rate");
  if (!String(f.paymentType || "").trim()) missing.push("payment terms");
  if (!String(f.shippingMode || f.shipmentType || "").trim()) missing.push("transport mode (Sea / Road / Air / Train)");
  if (!String(f.transportAgent || f.receivedAgentName || "").trim()) missing.push("shipping/clearing branch or agent");
  if (missing.length) {
    throw new ApiClientError(`An export order needs: ${missing.join(", ")}.`, { status: 400, code: "EXPORT_INCOMPLETE" });
  }
}

/** Before posting money: every managed goods line must have its full quantity reserved, or nothing is posted. */
export async function assertReservationsReady(salesOrderId: string, formData: any) {
  const { entries } = extractManagedEntries(formData);
  if (entries.length === 0) return;
  assertExportRequirements(formData);
  const need = new Map<string, number>();
  for (const e of entries) need.set(e.lotId, (need.get(e.lotId) ?? 0) + Number(e.qty));
  const rows = await withLocalPg((sql) => sql`
    select lot_id, sum(qty) as qty from public.goods_transfers
    where sales_order_id = ${salesOrderId}::uuid and purpose in ('local_sale','export_customer') and status in ('confirmed','completed')
    group by lot_id`);
  const have = new Map<string, number>((rows ?? []).map((r: any) => [r.lot_id, Number(r.qty)]));
  for (const [lotId, qty] of need) {
    if ((have.get(lotId) ?? 0) + 0.0001 < qty) {
      throw new ApiClientError("The stock for this order is not fully reserved. Save the draft again; the lot may no longer have enough available quantity.", {
        status: 409,
        code: "STOCK_NOT_RESERVED",
      });
    }
  }
}

/** Final billing/dispatch: deduct the reserved stock exactly once (a repeat call is a no-op). */
export async function finalizeForOrder(o: { salesOrderId: string; salesOrderNo: string | null; userId: string | null }) {
  const done = await withLocalPg((sql) => sql.begin((tx) => finalizeSaleStock(tx, o)));
  return done ?? [];
}
