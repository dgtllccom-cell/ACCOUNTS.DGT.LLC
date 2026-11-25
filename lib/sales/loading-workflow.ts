import { z } from "zod";
import { convertedSalesAmount, getBookingCurrencies } from "@/lib/sales/booking-currencies";
import { parseJsonish } from "@/lib/stock-journal/model";

export const CONTAINER_TYPES = ["20 FT", "40 FT", "20 FT Reefer", "40 FT Reefer", "Reefer Container", "Non Reefer", "Open Top", "Flat Rack", "LCL / Bulk"] as const;
const safeText = (length: number) => z.string().trim().max(length).default("");
const measurement = z.number().finite().positive().max(1e12);
export const receivingSchema = z.object({
  receivedCountry: safeText(160), receivedPort: safeText(160),
  receivedDate: z.string().date().nullable().default(null),
});
export const loadContainerSchema = receivingSchema.extend({
  containerNumber: z.string().trim().min(1).max(160).transform(s => s.toUpperCase().replace(/\s+/g, "")),
  containerType: z.enum(CONTAINER_TYPES), loadingDate: z.string().date(),
  loadingCountry: safeText(160), loadingPort: safeText(160), vessel: safeText(160), bl: safeText(120),
  shippingLine: safeText(160), seal: safeText(120), voyage: safeText(120),
  vehicle: safeText(120), driver: safeText(160), driverMobile: safeText(40), flight: safeText(160),
  awb: safeText(120), rail: safeText(120), remarks: safeText(1000),
  items: z.array(z.object({ line: z.number().int().min(0), quantity: measurement, gross: measurement, net: measurement })).min(1).max(100),
}).superRefine((c, ctx) => {
  if (c.receivedDate && c.receivedDate < c.loadingDate) ctx.addIssue({ code: "custom", path: ["receivedDate"], message: "Received date cannot precede loading date" });
  const seen = new Set<number>();
  c.items.forEach((it, i) => {
    if (seen.has(it.line)) ctx.addIssue({ code: "custom", path: ["items", i, "line"], message: "A goods line can appear only once per container" });
    if (it.net > it.gross) ctx.addIssue({ code: "custom", path: ["items", i, "net"], message: "Net weight cannot exceed gross weight" });
    seen.add(it.line);
  });
});
export const createSalesLoadingSchema = z.object({ orderId: z.string().uuid(), containers: z.array(loadContainerSchema).min(1).max(30) });
export type SalesLoadingInput = z.infer<typeof createSalesLoadingSchema>;
export type SalesLoadingContainer = SalesLoadingInput["containers"][number];
export type LoadingStatus = "pending" | "partial" | "loaded";

const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const number = (v: unknown) => Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0;

export type LoadingLine = { line: number; goods: string; brand: string; size: string; hs: string; lot: string; unit: string; quantity: number; gross: number; net: number; amount: number; purchaseDR: string[] };
export type LoadedLine = Pick<LoadingLine, "line" | "quantity" | "gross" | "net"> & Partial<LoadingLine>;
export type LoadingRecord = {
  id: string; entry_no: string | number; sales_order_id: string; sales_booking_no: string; container_number: string;
  container_type: string; loading_date: string; received_date: string | null; details: Record<string, string>;
  goods: LoadedLine[]; created_by_name: string | null;
};
export type LoadingOrder = ReturnType<typeof toLoadingOrder>;
export class LoadingValidationError extends Error {
  constructor(public readonly reason: "DUPLICATE_CONTAINER" | "INVALID_LINE" | "OVERLOAD", message: string) { super(message); }
}

// Select only fields needed by the operational screen; never send raw financial form_data.
export function toLoadingOrder(row: Record<string, unknown>, viewFinancials: boolean) {
  const data = parseJsonish(row.form_data) || {};
  const form = data.form || {};
  const rows = Array.isArray(data.goodsEntries) ? data.goodsEntries : [];
  const iso = (v: unknown) => text(v).split(" ")[0]?.toUpperCase() || "";
  const currencies = getBookingCurrencies(form);
  const transferCurrency = iso(data.transferTrace?.settlement?.finalCurrency || data.transferVerification?.creditCurrency);
  const finalCurrency = viewFinancials ? [transferCurrency, iso(form.secondaryCurrency), iso(form.baseCurrency), form.bookingCurrencyConfigured === true ? iso(currencies.final) : ""].find(v => /^[A-Z]{3}$/.test(v)) || "" : "";
  const goods: LoadingLine[] = rows.map((g: Record<string, unknown>, line: number) => ({
    line, goods: text(g.goodsName), brand: text(g.brand), size: text(g.size), hs: text(g.hsCode),
    lot: text(g.lotNo) || text(g.allotName) || text(g.lotRef) || text(g.stockLotNo) || text(g.lotName),
    unit: text(g.qtyName) || text(g.unit), quantity: number(g.qtyNo ?? g.quantity), gross: number(g.grossWeight),
    net: number(g.netWeight),
    amount: viewFinancials && finalCurrency ? (number(g.finalAmount) || (iso(currencies.final) === finalCurrency ? number(convertedSalesAmount(number(g.totalAmount), currencies.rate)) : 0)) : 0,
    purchaseDR: viewFinancials ? [text(g.purchaseAccountNo), text(g.purchaseAccountName)].filter(Boolean) : [],
  })).filter((g: LoadingLine) => g.quantity > 0);
  return {
    id: text(row.id), bookingNo: text(row.sales_order_no), contractNo: text(row.sales_contract_no),
    orderDate: text(row.order_date), customer: text(row.customer_name) || text(form.customerAccountName),
    mainBranch: text(row.main_branch_name), cityBranch: text(row.city_branch_name), country: text(row.country_name),
    countryId: text(row.country_id), mainBranchId: text(row.country_branch_id), cityBranchId: text(row.city_branch_id), byUser: text(form.transferAudit?.userName) || text(form.userName),
    purchaseDR: viewFinancials ? [text(form.purchaseAccountNo), text(form.purchaseAccountName)].filter(Boolean) : [],
    salesCR: viewFinancials ? [text(form.salesAccountNo), text(form.salesAccountName)].filter(Boolean) : [],
    notify: text(form.notifyPartyName) || text(form.notifyParty), supplier: text(form.supplierName), shipper: text(form.exporterName),
    loadingCountry: text(form.loadingCountry), loadingPort: text(form.loadingPort),
    receivedCountry: text(form.receivedCountry) || text(form.destinationCountry), receivedPort: text(form.receivedPort),
    shippingMode: text(form.shippingMode), shippingLine: text(form.shippingLine), vessel: text(form.vesselName),
    voyage: text(form.voyageNo), bl: text(form.blNumber) || text(form.billOfLadingNo), finalCurrency, goods,
  };
}

export function loadingProgress(goods: LoadingLine[], existing: { goods: LoadedLine[] }[]) {
  const loadedByLine = new Map<number, number>();
  for (const record of existing) for (const item of record.goods) loadedByLine.set(item.line, (loadedByLine.get(item.line) ?? 0) + number(item.quantity));
  const hasLoad = goods.some(g => (loadedByLine.get(g.line) ?? 0) > 0);
  const complete = goods.length > 0 && goods.every(g => g.quantity - (loadedByLine.get(g.line) ?? 0) <= 1e-8);
  return { loadedByLine, status: (complete ? "loaded" : hasLoad ? "partial" : "pending") as LoadingStatus };
}

/** Called inside the order's row lock so concurrent requests cannot exceed booking quantities. */
export function planSalesLoading(goods: LoadingLine[], existing: Pick<LoadingRecord, "goods" | "container_number">[], containers: SalesLoadingContainer[]) {
  const byLine = new Map(goods.map(line => [line.line, line]));
  const consumed = loadingProgress(goods, existing).loadedByLine;
  const numbers = new Set(existing.map(record => record.container_number));
  return containers.map(container => {
    if (numbers.has(container.containerNumber)) throw new LoadingValidationError("DUPLICATE_CONTAINER", "This container already belongs to the booking");
    numbers.add(container.containerNumber);
    const items = container.items.map(item => {
      const source = byLine.get(item.line);
      if (!source) throw new LoadingValidationError("INVALID_LINE", "The selected line does not belong to this Sales Booking");
      const used = (consumed.get(item.line) ?? 0) + item.quantity;
      if (used - source.quantity > 1e-8) throw new LoadingValidationError("OVERLOAD", "Loading quantity exceeds the booking balance for a goods line");
      consumed.set(item.line, used);
      return { line: source.line, goods: source.goods, brand: source.brand, size: source.size, hs: source.hs, lot: source.lot, unit: source.unit, quantity: item.quantity, gross: item.gross, net: item.net };
    });
    return { ...container, items };
  });
}

export function loadingValues(order: LoadingOrder, records: LoadingRecord[]) {
  const loaded = loadingProgress(order.goods, records).loadedByLine;
  const received = loadingProgress(order.goods, records.filter(r => r.received_date)).loadedByLine;
  return order.goods.reduce((t, line) => ({
    total: t.total + line.amount,
    loading: t.loading + line.amount * Math.min(1, (loaded.get(line.line) ?? 0) / line.quantity),
    received: t.received + line.amount * Math.min(1, (received.get(line.line) ?? 0) / line.quantity),
  }), { total: 0, loading: 0, received: 0 });
}

/** Sales-specific readiness from PR #238. Loading never creates the payment itself. */
export function loadingReadiness(row: Record<string, unknown>) {
  const data = parseJsonish(row.form_data) || {};
  const form = data.form || {};
  const workflow = data.workflow || {};
  const paymentType = text(form.paymentType || form.paymentCondition || workflow.paymentKind).toLowerCase();
  const invoice = paymentType.includes("invoice");
  const cash = paymentType.includes("cash");
  if (invoice && row.invoice_finalized !== true) return "awaiting_invoice";
  const advance = paymentType.includes("advance") ? Math.min(100, number(form.advancePercent ?? form.advancePercentage)) : 0;
  const currencies = getBookingCurrencies(form);
  const originalAmount = number(data.transferTrace?.settlement?.originalAmount) || number(row.total_goods_original) || number(data.totals?.grandPrimaryFinal)
    || (form.bookingCurrencyConfigured === true && currencies.rate.ok ? convertedSalesAmount(number(row.order_total), { ...currencies.rate, operator: currencies.rate.operator === "/" ? "*" : "/" }) ?? 0 : number(row.total_goods_usd));
  if ((cash || advance > 0) && (originalAmount <= 0 || number(row.paid_amount) + 0.005 < originalAmount * (cash ? 1 : advance / 100))) return "awaiting_advance";
  const needsLot = form.isEndorseSale === true || form.saleType === "endorse" || data.isEndorseSale === true;
  if (needsLot && (!data.goodsEntries?.length || data.goodsEntries.some((g: any) => !text(g.managedLotId || g.journalTransferId || g.stockLotNo || g.lotNo || g.lotRef) || number(g.qtyNo ?? g.quantity) <= 0))) return "awaiting_lot";
  return "ready";
}
