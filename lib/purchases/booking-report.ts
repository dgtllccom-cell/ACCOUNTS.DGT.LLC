/**
 * Purchase Booking Report — the data behind the one-page booking report (screen + A4 View / Print).
 *
 * Pure: it reads ONLY the saved `purchase_orders` row (form_data.form / goodsEntries / totals, order_total,
 * total_goods_original, exchange_rate, currency_code, payment_currency, statuses). Nothing is invented — a value
 * the bill does not carry is returned as "" / null and the screen shows "—".
 *
 * Currency conversion always follows the bill's OWN operator (lib/purchases/fx-operator.ts): a "/" bill divides
 * (AE-001-0005: 20,250,000 PKR ÷ 77.2 = 262,305.70 AED), a "*" bill multiplies (230,000 USD × 3.675 = 845,250 AED).
 */
import { billFxOperator, toBaseAmount, type FxOperator } from "./fx-operator";
import { billAccounts } from "./bill-accounts";
import { isPurchaseBookingTransferLocked } from "../services/purchase-booking-transfer-routing";

type AnyRec = Record<string, any>;

/** The four free-text remarks a booking report can save — each maps to ONE existing `form_data.form` field. */
export const BOOKING_REPORT_REMARK_FIELDS = {
  loading: "loadingReport",
  payment: "paymentReport",
  quantity: "quantityReport",
  journal: "remarks",
} as const;
export type BookingReportRemarkKind = keyof typeof BOOKING_REPORT_REMARK_FIELDS;

export type BookingReportStatus = "draft" | "pending" | "posted" | "transferred" | "cancelled";

export interface BookingReportLine {
  no: number;
  goodsName: string;
  size: string;
  brand: string;
  hsCode: string;
  origin: string;
  qty: number | null;
  unit: string;
  price: number | null;
  amount: number;
  rate: number | null;
  op: FxOperator;
  rateLabel: string;
  finalAmount: number;
  /** weight per package (kg) as saved, e.g. 50.25 */
  packWeight: number | null;
  /** what the unit price is per, from the saved price / divide type: "40 KG", "KG", "BAGS"; "" when not saved */
  priceBasis: string;
}

export interface BookingReportAccount {
  code: string;
  name: string;
  company: string;
}

export interface BookingReportData {
  orderId: string;
  bookingNo: string;
  bookingDate: string;
  billNo: string;
  contractNo: string;
  pcNumber: string;
  /** the bill's saved serial (country, else branch) */
  serialNo: string;
  invoiceDate: string;
  status: BookingReportStatus;
  paymentType: string;
  shipType: string;
  loadingType: string;
  branch: { name: string; code: string; type: string; parent: string; userName: string; userRole: string };
  purchaseAccount: BookingReportAccount;
  salesAccount: BookingReportAccount;
  /** the supplier party (Cr account) as saved on the bill — the seller on a purchase contract */
  seller: { name: string; company: string; phone: string; email: string; address: string; country: string };
  qualityReport: string;
  currency: string;
  baseCurrency: string;
  rate: number | null;
  op: FxOperator;
  rateLabel: string;
  lines: BookingReportLine[];
  totals: { items: number; qty: number | null; unit: string; grossMt: number | null; netMt: number | null; amount: number; finalAmount: number };
  payment: {
    advancePercent: number | null;
    advanceAmount: number | null;
    advanceFinal: number | null;
    balanceAmount: number | null;
    balanceFinal: number | null;
    status: string;
    advanceDate: string;
    finalPaymentDate: string;
    details: string;
  };
  loading: { fromCountry: string; fromPort: string; date: string; shippingLine: string; vesselName: string; voyageNo: string };
  receiving: { toCountry: string; toPort: string; date: string; finalDestination: string; shippingLine: string };
  remarks: Record<BookingReportRemarkKind, string>;
  /** posted / transferred: amounts, accounts and remarks are read-only (see bookingRemarksEditable) */
  locked: boolean;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const first = (...vals: unknown[]) => vals.map(str).find(Boolean) || "";
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** "P/KGs" priced per divideWeight kg (AE-001-0005: 7,500 PKR per 40 kg); a per-unit price is per its unit */
export function priceBasisOf(g: AnyRec): string {
  const priceType = str(g.priceType).toLowerCase();
  const divideType = str(g.divideType).toLowerCase();
  const w = num(g.divideWeight);
  if (priceType.includes("kg") || divideType.includes("kg")) {
    if (w && w > 0 && w !== 1) return `${w.toLocaleString("en-US", { maximumFractionDigits: 3 })} KG`;
    return "KG";
  }
  if (priceType.includes("ton") || priceType.includes("mt")) return "MT";
  if (priceType) return str(g.qtyName || g.unitName);
  return "";
}

export function parseFormData(record: AnyRec | null | undefined): AnyRec {
  let fd: unknown = record?.form_data;
  if (typeof fd === "string") {
    try { fd = JSON.parse(fd); } catch { fd = {}; }
  }
  return fd && typeof fd === "object" ? (fd as AnyRec) : {};
}

/** "× 3.675" / "÷ 77.2" — the rate shown WITH the bill's operator. */
export function formatRateWithOperator(rate: number | null | undefined, op: FxOperator): string {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return "";
  const shown = r.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 6 });
  return `${op === "/" ? "÷" : "×"} ${shown}`;
}

export function normalizeBookingStatus(record: AnyRec): BookingReportStatus {
  const s = str(record.ledger_posting_status || record.status).toLowerCase();
  if (s === "posted") return "posted";
  if (s === "transferred") return "transferred";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "pending") return "pending";
  return "draft";
}

/**
 * A remark may be saved only while the bill is not posted / transferred: the purchase-order PATCH API reverses the
 * bill's Roznamcha entry and every payment whenever form_data changes on a posted / transferred bill, so a remarks
 * save there would undo the posting. Posted bills (isPurchaseBookingTransferLocked) are read-only here.
 */
export function bookingRemarksEditable(record: AnyRec | null | undefined): boolean {
  if (!record) return false;
  const s = str(record.ledger_posting_status).toLowerCase();
  if (isPurchaseBookingTransferLocked({ ledger_posting_status: s, is_edited_since_transfer: record.is_edited_since_transfer ?? null })) return false;
  return s !== "posted" && s !== "transferred" && s !== "cancelled";
}

export function buildPurchaseBookingReport(
  record: AnyRec | null | undefined,
  opts: { userName?: string | null; userRole?: string | null } = {},
): BookingReportData {
  const r = record || {};
  const fd = parseFormData(r);
  const form: AnyRec = fd.form && typeof fd.form === "object" ? fd.form : {};
  const goods: AnyRec[] = Array.isArray(fd.goodsEntries) ? fd.goodsEntries : [];
  const savedTotals: AnyRec = fd.totals && typeof fd.totals === "object" ? fd.totals : {};

  const op = billFxOperator(fd);
  const rate = num(r.exchange_rate) ?? num(form.exchangeRate) ?? num(goods[0]?.exchangeRate);
  const currency = first(r.currency_code, r.purchase_currency, form.purchaseCurrency, form.currencyType, goods[0]?.purchaseCurrency, goods[0]?.currencyType);
  const baseCurrency = first(r.payment_currency, form.paymentCurrency, form.secondaryCurrency, goods[0]?.secondaryCurrency);

  const lines: BookingReportLine[] = goods.map((g, i) => {
    const qty = num(g.qtyNo ?? g.quantity);
    const price = num(g.coursePrice ?? g.price ?? g.rateOriginal);
    const amount = num(g.totalAmount ?? g.amount ?? g.totalOriginal) ?? (qty !== null && price !== null ? qty * price : 0);
    const lineOp: FxOperator = str(g.op ?? g.operator) === "/" ? "/" : str(g.op ?? g.operator) === "*" ? "*" : op;
    const lineRate = num(g.exchangeRate) ?? rate;
    return {
      no: i + 1,
      goodsName: first(g.goodsName, g.productName, g.name),
      size: first(g.size),
      brand: first(g.brand),
      hsCode: first(g.hsCode),
      origin: first(g.origin, g.originCountry),
      qty,
      unit: first(g.qtyName, g.unitName),
      price,
      amount: round2(amount),
      rate: lineRate,
      op: lineOp,
      rateLabel: formatRateWithOperator(lineRate, lineOp),
      finalAmount: round2(lineRate ? toBaseAmount(amount, lineRate, lineOp) : amount),
      packWeight: num(g.qtyKgs ?? g.unitWeight),
      priceBasis: priceBasisOf(g),
    };
  });

  const sumLines = (pick: (g: AnyRec) => unknown) => {
    const vals = goods.map((g) => num(pick(g))).filter((n): n is number => n !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const amount = num(r.total_goods_original) ?? num(savedTotals.grandPrimaryFinal) ?? lines.reduce((a, l) => a + l.amount, 0);
  const finalAmount = rate ? toBaseAmount(amount, rate, op) : (num(r.order_total) ?? num(savedTotals.grandFinal) ?? amount);
  const qty = num(savedTotals.totalQty) ?? sumLines((g) => g.qtyNo ?? g.quantity);
  const grossKg = num(savedTotals.totalGross) ?? sumLines((g) => g.grossWeight);
  const netKg = num(savedTotals.totalNet) ?? sumLines((g) => g.netWeight);

  const advancePercent = num(form.advancePercent);
  const advanceAmount = advancePercent !== null ? round2((amount * advancePercent) / 100) : null;
  const advanceFinal = advancePercent !== null ? round2((finalAmount * advancePercent) / 100) : null;

  const accounts = billAccounts("purchase_order", r);
  const workflow: AnyRec = fd.workflow && typeof fd.workflow === "object" ? fd.workflow : {};
  const remarks = Object.fromEntries(
    (Object.keys(BOOKING_REPORT_REMARK_FIELDS) as BookingReportRemarkKind[]).map((k) => [k, str(form[BOOKING_REPORT_REMARK_FIELDS[k]])]),
  ) as Record<BookingReportRemarkKind, string>;

  return {
    orderId: str(r.id),
    bookingNo: first(r.purchase_order_no, form.purchaseOrderNo),
    bookingDate: first(form.purchaseDate, form.bookingDate, str(r.created_at).slice(0, 10)),
    billNo: first(form.billNo, r.bill_no),
    contractNo: first(r.purchase_contract_no, form.purchaseContractNo),
    pcNumber: first(form.pcNumber, form.pcNo),
    serialNo: first(workflow.countrySerialNo, r.country_transaction_serial_number, workflow.branchSerialNo, r.branch_transaction_serial_number),
    invoiceDate: first(form.invoiceDate, form.billDate),
    status: normalizeBookingStatus(r),
    paymentType: first(form.paymentType),
    shipType: first(form.shipmentType, form.shipType, form.shippingMode),
    loadingType: first(form.loadingType, form.incoterm, form.deliveryTerms),
    branch: {
      name: first(form.branchName),
      code: first(form.branchCode),
      type: first(form.branchType),
      parent: first(form.parentBranch, form.parentBranchName),
      userName: first(form.userName, opts.userName),
      userRole: first(form.userRole, opts.userRole),
    },
    purchaseAccount: { code: accounts.debit.code, name: accounts.debit.name, company: first(form.purchaseCompanyName) },
    salesAccount: { code: accounts.credit.code, name: accounts.credit.name, company: first(form.salesCompanyName) },
    seller: {
      name: accounts.credit.name,
      company: first(form.salesCompanyName),
      phone: first(form.salesAccountMobile, form.salesAccountWhatsapp),
      email: first(form.salesAccountEmail),
      address: first(form.salesAccountAddress),
      country: first(form.salesAccountCountry),
    },
    qualityReport: first(form.qualityReport),
    currency,
    baseCurrency,
    rate,
    op,
    rateLabel: formatRateWithOperator(rate, op),
    lines,
    totals: {
      items: lines.length,
      qty,
      unit: first(goods[0]?.qtyName, goods[0]?.unitName),
      grossMt: grossKg !== null ? grossKg / 1000 : null,
      netMt: netKg !== null ? netKg / 1000 : null,
      amount: round2(amount),
      finalAmount: round2(finalAmount),
    },
    payment: {
      advancePercent,
      advanceAmount,
      advanceFinal,
      balanceAmount: advanceAmount !== null ? round2(amount - advanceAmount) : null,
      balanceFinal: advanceFinal !== null ? round2(finalAmount - advanceFinal) : null,
      status: first(r.payment_status).toLowerCase(),
      advanceDate: first(form.advancePaymentDate),
      finalPaymentDate: first(form.paymentDate),
      details: first(form.paymentDaysAndMethodDetails),
    },
    loading: {
      fromCountry: first(form.loadingCountry),
      fromPort: first(form.loadingPort, form.loadingLocation, form.loadingBorder),
      date: first(form.loadingDate),
      shippingLine: first(form.shippingLine, form.shippingLineName, form.transportAgent),
      vesselName: first(form.vesselName, form.airlineName),
      voyageNo: first(form.voyageNo, form.voyageNumber, form.flightNo),
    },
    receiving: {
      toCountry: first(form.receivedCountry, form.receivingCountry),
      toPort: first(form.receivedPort, form.receivingPort, form.receivedPortName, form.receivedBorder),
      date: first(form.receivedDate, form.receivingDate),
      finalDestination: first(form.finalDestination, form.destinationPort, form.destinationCountry),
      shippingLine: first(form.receivingShippingLine, form.receivedShippingLine, form.receivedAgentName, form.shippingLine, form.shippingLineName),
    },
    remarks,
    locked: !bookingRemarksEditable(r),
  };
}

/**
 * The PATCH body that saves ONE remark: the bill's saved form_data with only that field changed. Amounts,
 * accounts, goods, totals and posting status are passed through untouched (and no other API field is sent).
 */
export function remarkPatchBody(savedRecord: AnyRec, kind: BookingReportRemarkKind, value: string): { formData: AnyRec } {
  const fd = parseFormData(savedRecord);
  const form = fd.form && typeof fd.form === "object" ? fd.form : {};
  return { formData: { ...fd, form: { ...form, [BOOKING_REPORT_REMARK_FIELDS[kind]]: value } } };
}

/* ------------------------------------------------------------------ suggested reports */

/** a translator: (key, English template) → template in the active language; {name} placeholders are filled with data */
export type ReportTranslator = (key: string, fallback: string) => string;

const D = "—";
const money = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(Number(n)) ? D : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = (n: number | null | undefined, digits = 3) =>
  n === null || n === undefined || !Number.isFinite(Number(n)) ? D : Number(n).toLocaleString("en-US", { minimumFractionDigits: digits === 3 ? 0 : digits, maximumFractionDigits: digits });
const val = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? D : String(v).trim());
const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));

/**
 * A draft written report for each of the four boxes, built ONLY from the bill's saved values (a missing value is
 * "—"). The sentence is translated; names, codes, places, dates and amounts are data and stay as saved. The user
 * reviews and saves it — nothing is saved automatically.
 */
export function suggestedRemarks(data: BookingReportData, tr: ReportTranslator): Record<BookingReportRemarkKind, string> {
  const goods = data.lines.map((l) => l.goodsName).filter(Boolean).join(", ");
  const unit = val(data.totals.unit);
  const rate = data.rateLabel || D;
  const statusWord = data.payment.status ? data.payment.status.charAt(0).toUpperCase() + data.payment.status.slice(1) : D;
  const vars: Record<string, string> = {
    qty: qtyFmt(data.totals.qty),
    unit,
    goods: val(goods),
    items: String(data.totals.items || 0),
    fromPort: val(data.loading.fromPort),
    fromCountry: val(data.loading.fromCountry),
    loadDate: val(data.loading.date),
    toPort: val(data.receiving.toPort),
    toCountry: val(data.receiving.toCountry),
    recvDate: val(data.receiving.date),
    ship: val(data.shipType),
    paymentType: val(data.paymentType),
    amount: money(data.totals.amount),
    cur: val(data.currency),
    rate,
    final: money(data.totals.finalAmount),
    base: val(data.baseCurrency),
    pct: data.payment.advancePercent === null ? D : String(data.payment.advancePercent),
    adv: money(data.payment.advanceFinal),
    advDate: val(data.payment.advanceDate),
    bal: money(data.payment.balanceFinal),
    finalDate: val(data.payment.finalPaymentDate),
    status: statusWord,
    gross: qtyFmt(data.totals.grossMt, 3),
    net: qtyFmt(data.totals.netMt, 3),
    quality: val(data.qualityReport),
    no: val(data.bookingNo),
    date: val(data.bookingDate),
    drCode: val(data.purchaseAccount.code),
    drName: val(data.purchaseAccount.name),
    crCode: val(data.salesAccount.code),
    crName: val(data.salesAccount.name),
  };
  return {
    loading: fill(tr("pbrep.sug_loading", "{qty} {unit} {goods} — loading from {fromPort}, {fromCountry} on {loadDate}; receiving at {toPort}, {toCountry} on {recvDate}. Ship type: {ship}."), vars),
    payment: fill(tr("pbrep.sug_payment", "Payment type {paymentType}. Total {amount} {cur} {rate} = {final} {base}. Advance {pct}% = {adv} {base} by {advDate}; balance {bal} {base} due {finalDate}. Status: {status}."), vars),
    quantity: fill(tr("pbrep.sug_quantity", "{items} item(s), {qty} {unit}; gross {gross} MT, net {net} MT; quality: {quality}."), vars),
    journal: fill(tr("pbrep.sug_journal", "Purchase booking {no} dated {date} — Dr {drCode} {drName} / Cr {crCode} {crName}, {final} {base} ({amount} {cur} {rate})."), vars),
  };
}
