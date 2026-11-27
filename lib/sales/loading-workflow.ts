import { z } from "zod";
import { convertedSalesAmount, getBookingCurrencies } from "@/lib/sales/booking-currencies";
import { parseJsonish } from "@/lib/stock-journal/model";

export const CONTAINER_TYPES = ["20 FT", "40 FT", "20 FT Reefer", "40 FT Reefer", "Reefer Container", "Non Reefer", "Open Top", "Flat Rack", "LCL / Bulk", "Truck"] as const;
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
  // Route & Location Master ids (country + port / border / airport); the names above stay the readers' source.
  loadingCountryId: safeText(80), loadingLocationId: safeText(80), receivedCountryId: safeText(80), receivedLocationId: safeText(80),
  shippingLine: safeText(160), seal: safeText(120), voyage: safeText(120),
  vehicle: safeText(120), driver: safeText(160), driverMobile: safeText(40), flight: safeText(160),
  awb: safeText(120), rail: safeText(120), remarks: safeText(1000),
  // Truck from the central Truck Registration (registered = picked by id, data filled from the registry) or a temporary truck typed in.
  truckRegistrationType: z.enum(["registered", "temporary", ""]).default(""),
  truckId: z.union([z.string().uuid(), z.literal("")]).default(""),
  truckOwner: safeText(160), transportCompany: safeText(160),
  items: z.array(z.object({ line: z.number().int().min(0), quantity: measurement, gross: measurement, net: measurement })).min(1).max(100),
}).superRefine((c, ctx) => {
  if (c.truckRegistrationType === "registered" && !c.truckId) ctx.addIssue({ code: "custom", path: ["truckId"], message: "Select the registered truck" });
  if (c.truckRegistrationType === "temporary" && !c.vehicle) ctx.addIssue({ code: "custom", path: ["vehicle"], message: "Enter the temporary truck number" });
  if (c.receivedDate && c.receivedDate < c.loadingDate) ctx.addIssue({ code: "custom", path: ["receivedDate"], message: "Received date cannot precede loading date" });
  const seen = new Set<number>();
  c.items.forEach((it, i) => {
    if (seen.has(it.line)) ctx.addIssue({ code: "custom", path: ["items", i, "line"], message: "A goods line can appear only once per container" });
    if (it.net > it.gross) ctx.addIssue({ code: "custom", path: ["items", i, "net"], message: "Net weight cannot exceed gross weight" });
    seen.add(it.line);
  });
});
export const salesLoadingSource = z.enum(["booking", "local"]).default("booking");
export type SalesLoadingSource = z.infer<typeof salesLoadingSource>;
export const createSalesLoadingSchema = z.object({ source: salesLoadingSource, orderId: z.string().uuid(), containers: z.array(loadContainerSchema).min(1).max(30) });
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
    loadingCountry: text(form.loadingCountry), loadingPort: text(form.loadingPort) || text(form.airportName) || text(form.loadingBorder),
    receivedCountry: text(form.receivedCountry) || text(form.destinationCountry), receivedPort: text(form.receivedPort) || text(form.receivingPort) || text(form.destinationPort),
    loadingCountryId: text(form.loadingCountryId), loadingLocationId: text(form.loadingLocationId),
    receivedCountryId: text(form.receivedCountryId), receivedLocationId: text(form.receivedLocationId),
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

export const ACCOUNT_TRANSFER_LOADING_LABELS = ["account transfer", "account_transfer", "transfer account"] as const;
export const IMMEDIATE_LOADING_LABELS = ["credit", "credit payment", "cash", "cash payment", ...ACCOUNT_TRANSFER_LOADING_LABELS] as const;
export const INVOICE_LOADING_LABELS = ["invoice", "invoice payment"] as const;

const normalizePayment = (v: unknown) => text(v).toLowerCase();
const inLabels = (labels: readonly string[], value: string) => labels.includes(value);

/** Operational eligibility only. Never reads receipts or changes payment status. */
export function loadingReadiness(row: Record<string, unknown>) {
  if (!["posted", "transferred"].includes(text(row.ledger_posting_status))) return "not_transferred";
  const data = parseJsonish(row.form_data) || {};
  const form = data.form || {};
  const recorded = normalizePayment(data.transferTrace?.paymentKind) || normalizePayment(data.workflow?.paymentKind);
  const originalType = normalizePayment(data.transferTrace?.paymentType) || normalizePayment(form.transferAudit?.paymentType);
  const savedType = normalizePayment(form.paymentType) || normalizePayment(data.paymentType) || normalizePayment(form.paymentCondition) || normalizePayment(data.paymentCondition);
  // Legacy Account Transfer was posted through the generic "advance" journal
  // route. An exact stored Account Transfer label (not a balance or later receipt)
  // distinguishes it from actual Advance; a frozen original label takes priority.
  const originalOrLegacy = originalType || savedType;
  const label = (recorded === "advance" && inLabels(ACCOUNT_TRANSFER_LOADING_LABELS, originalOrLegacy))
    ? originalOrLegacy : (recorded || originalOrLegacy);
  if (inLabels(INVOICE_LOADING_LABELS, label)) {
    if (row.invoice_finalized !== true) return "awaiting_invoice";
  } else if (!inLabels(IMMEDIATE_LOADING_LABELS, label)) return "payment_not_eligible";
  const needsLot = form.isEndorseSale === true || form.saleType === "endorse" || data.isEndorseSale === true;
  if (needsLot && (!data.goodsEntries?.length || data.goodsEntries.some((g: any) => !text(g.managedLotId || g.journalTransferId || g.stockLotNo || g.lotNo || g.lotRef) || number(g.qtyNo ?? g.quantity) <= 0))) return "awaiting_lot";
  return "ready";
}
