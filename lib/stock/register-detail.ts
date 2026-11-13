/**
 * Full detail of one purchase bill, one loading entry or one stock transfer, shaped from EXISTING rows only.
 * Nothing is invented: a value the database does not hold is returned as null and shown as a dash.
 * Remaining balance = original quantity - transferred quantity (what has not yet left the purchase).
 */

export const DASH = "—";

const txt = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return s || DASH;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

const day = (v: unknown): string => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? DASH : v.toISOString().slice(0, 10);
  const s = String(v ?? "").slice(0, 10);
  return s || DASH;
};

/** Event detail as readable text: a plain string as is, a JSON object as "key: value" pairs (never "[object Object]"). */
const detailText = (v: unknown): string => {
  if (v === null || v === undefined) return DASH;
  if (typeof v === "string") return txt(v);
  if (typeof v === "object" && !Array.isArray(v)) {
    const pairs = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== null && x !== undefined && String(x).trim() !== "")
      .map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : String(x)}`);
    return pairs.length ? pairs.join("; ") : DASH;
  }
  return txt(v);
};

const stamp = (v: unknown): string => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? DASH : v.toISOString().slice(0, 16).replace("T", " ");
  const s = String(v ?? "").replace("T", " ").slice(0, 16);
  return s || DASH;
};

export type GoodsLine = {
  goodsName: string;
  qty: number | null;
  unit: string;
  gross: number | null;
  net: number | null;
  totalAmount: number | null;
  currency: string;
};

export type LaneSummary = {
  id: string;
  loadingNo: string;
  loadingDate: string;
  goodsName: string;
  qty: number | null;
  unit: string;
  gross: number | null;
  net: number | null;
  container: string;
  truck: string;
  driver: string;
  bl: string;
  loadingPort: string;
  receivingPort: string;
  status: string;
  disposition: string;
};

export type TransferSummary = {
  id: string;
  transferNo: string;
  date: string;
  destination: string;
  warehouse: string;
  goodsName: string;
  qty: number | null;
  unit: string;
  status: string;
  reference: string;
};

export type BillDetail = {
  kind: "bill";
  billType: "booking" | "local";
  id: string;
  purchaseNo: string;
  purchaseDate: string;
  manualNo: string;
  supplier: string;
  salesAccount: string;
  country: string;
  branch: string;
  currency: string;
  exchangeRate: number | null;
  totalAmount: number | null;
  paymentType: string;
  status: string;
  paymentStatus: string;
  goods: GoodsLine[];
  loads: LaneSummary[];
  transfers: TransferSummary[];
  quantities: { original: number; loaded: number; transferred: number; remaining: number };
};

export type EntryHistory = { at: string; event: string; from: string; to: string; detail: string; actor: string };

export type LoadDetail = {
  kind: "loading";
  id: string;
  purchaseNo: string;
  loadingNo: string;
  loadingDate: string;
  goodsName: string;
  qty: number | null;
  unit: string;
  gross: number | null;
  net: number | null;
  tare: number | null;
  container: string;
  containerType: string;
  seal: string;
  truck: string;
  driver: string;
  driverPhone: string;
  bl: string;
  transport: string;
  loadingPort: string;
  receivingPort: string;
  status: string;
  disposition: string;
  dispositionAt: string;
  dispositionNote: string;
  stockInLane: number | null;
  billType: "booking" | "local" | null;
  billId: string | null;
  history: EntryHistory[];
};

export type TransferDetail = {
  kind: "transfer";
  id: string;
  transferNo: string;
  date: string;
  destination: string;
  warehouse: string;
  goodsName: string;
  qty: number | null;
  unit: string;
  status: string;
  reference: string;
  remarks: string;
  confirmedAt: string;
  issuedAt: string;
  reversedAt: string;
  customer: string;
  salesOrderNo: string;
  billType: "booking" | "local" | null;
  billId: string | null;
  purchaseNo: string;
};

type Row = Record<string, unknown>;

/** The goods lines of a purchase booking, read from its saved form (form_data.goodsEntries). */
export function goodsLinesOf(formData: unknown, currency: string): GoodsLine[] {
  const fd = typeof formData === "string" ? safeJson(formData) : formData;
  const entries = fd && typeof fd === "object" ? ((fd as Row).goodsEntries as Row[] | undefined) ?? [] : [];
  return entries.map((g) => ({
    goodsName: txt(g.goodsName),
    qty: num(g.qtyNo ?? g.quantity),
    unit: txt(g.qtyName) === DASH ? "" : txt(g.qtyName),
    gross: num(g.grossWeight),
    net: num(g.netWeight),
    totalAmount: num(g.totalAmount),
    currency: txt(g.currencyType ?? g.purchaseCurrency ?? currency),
  }));
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function laneSummaryOf(r: Row): LaneSummary {
  return {
    id: String(r.id ?? ""),
    loadingNo: txt(r.loading_record_no),
    loadingDate: day(r.loading_date),
    goodsName: txt(r.goods_name),
    qty: num(r.loaded_quantity),
    unit: txt(r.unit) === DASH ? "" : txt(r.unit),
    gross: num(r.gross_weight),
    net: num(r.net_weight),
    container: txt(r.container_number),
    truck: txt(r.truck_number),
    driver: txt(r.driver_name),
    bl: txt(r.bl_number),
    loadingPort: txt(r.origin_text),
    receivingPort: txt(r.destination_text),
    status: txt(r.lane_status),
    disposition: txt(r.disposition),
  };
}

export function transferSummaryOf(r: Row, warehouse: string): TransferSummary {
  return {
    id: String(r.id ?? ""),
    transferNo: txt(r.transfer_no),
    date: day(r.transfer_date),
    destination: txt(r.destination_type),
    warehouse: warehouse || DASH,
    goodsName: txt(r.goods_name),
    qty: num(r.quantity),
    unit: txt(r.unit) === DASH ? "" : txt(r.unit),
    status: txt(r.status),
    reference: txt(r.reference_no ?? r.sales_order_no),
  };
}

export function billDetailOf(
  billType: "booking" | "local",
  bill: Row,
  loads: Row[],
  transfers: Row[],
  warehouseNames: Map<string, string>
): BillDetail {
  const form = bill.form_data && typeof bill.form_data === "object" ? ((bill.form_data as Row).form as Row | undefined) ?? {} : {};
  const isBooking = billType === "booking";
  const currency = txt(isBooking ? bill.purchase_currency ?? bill.currency_code : bill.purchase_currency);
  const goods = isBooking
    ? goodsLinesOf(bill.form_data, currency)
    : [{ goodsName: txt(bill.goods_name), qty: num(bill.quantity_kgs), unit: txt(bill.quantity_name) === DASH ? "" : txt(bill.quantity_name), gross: num(bill.total_gross_weight), net: num(bill.net_weight), totalAmount: num(bill.purchase_cost), currency }];
  const original = goods.reduce((s, g) => s + (g.qty ?? 0), 0);
  const loaded = loads.reduce((s, l) => s + (num(l.loaded_quantity) ?? 0), 0);
  const transferred = transfers.reduce((s, t) => s + (num(t.quantity) ?? 0), 0);
  return {
    kind: "bill",
    billType,
    id: String(bill.id ?? ""),
    purchaseNo: txt(isBooking ? bill.purchase_order_no : bill.journal_serial_no ?? bill.manual_bill_no),
    purchaseDate: day(bill.created_at),
    manualNo: txt(isBooking ? form.manualBillNumber : bill.manual_bill_no),
    supplier: txt(isBooking ? form.supplierName ?? bill.supplier_name : bill.supplier_name),
    salesAccount: txt(isBooking ? form.salesAccountName ?? null : bill.sales_account_no),
    country: txt(bill.country_name),
    branch: txt(bill.branch_label),
    currency,
    exchangeRate: num(isBooking ? bill.exchange_rate : bill.exchange_rate),
    totalAmount: num(isBooking ? bill.order_total : bill.final_cost),
    paymentType: txt(form.paymentType ?? bill.payment_mode),
    status: txt(bill.status),
    paymentStatus: txt(bill.payment_status),
    goods,
    loads: loads.map(laneSummaryOf),
    transfers: transfers.map((t) => transferSummaryOf(t, warehouseNames.get(String(t.warehouse_id ?? "")) ?? "")),
    quantities: { original, loaded, transferred, remaining: original - transferred },
  };
}

export function loadDetailOf(lane: Row, events: Row[]): LoadDetail {
  const s = laneSummaryOf(lane);
  return {
    kind: "loading",
    id: s.id,
    purchaseNo: txt(lane.purchase_ref_no),
    loadingNo: s.loadingNo,
    loadingDate: s.loadingDate,
    goodsName: s.goodsName,
    qty: s.qty,
    unit: s.unit,
    gross: s.gross,
    net: s.net,
    tare: num(lane.tare_weight),
    container: s.container,
    containerType: txt(lane.container_type),
    seal: txt(lane.seal_numbers),
    truck: s.truck,
    driver: s.driver,
    driverPhone: txt(lane.driver_phone),
    bl: s.bl,
    transport: txt(lane.transport_mode),
    loadingPort: s.loadingPort,
    receivingPort: s.receivingPort,
    status: s.status,
    disposition: s.disposition,
    dispositionAt: stamp(lane.disposition_at),
    dispositionNote: txt(lane.disposition_note),
    stockInLane: num(lane.lane_stock_qty),
    billType: lane.purchase_order_id ? "booking" : lane.local_purchase_id ? "local" : null,
    billId: lane.purchase_order_id ? String(lane.purchase_order_id) : lane.local_purchase_id ? String(lane.local_purchase_id) : null,
    history: events.map((e) => ({
      at: stamp(e.created_at),
      event: txt(e.event_type),
      from: txt(e.from_status),
      to: txt(e.to_status),
      detail: detailText(e.detail),
      actor: txt(e.actor_name),
    })),
  };
}

export function transferDetailOf(t: Row, warehouse: string, billType: "booking" | "local" | null, billId: string | null, purchaseNo: string): TransferDetail {
  const s = transferSummaryOf(t, warehouse);
  return {
    kind: "transfer",
    id: s.id,
    transferNo: s.transferNo,
    date: s.date,
    destination: s.destination,
    warehouse: s.warehouse,
    goodsName: s.goodsName,
    qty: s.qty,
    unit: s.unit,
    status: s.status,
    reference: s.reference,
    remarks: txt(t.remarks),
    confirmedAt: stamp(t.confirmed_at),
    issuedAt: stamp(t.issued_at),
    reversedAt: stamp(t.reversed_at),
    customer: txt(t.customer_name),
    salesOrderNo: txt(t.sales_order_no),
    billType,
    billId,
    purchaseNo,
  };
}
