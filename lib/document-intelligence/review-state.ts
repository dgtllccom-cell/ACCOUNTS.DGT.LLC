/**
 * Document Intake — the reviewed state of ONE document, and how it becomes a target-form payload.
 *
 * `ReviewState` is exactly what the review screen edits and what is persisted inside the draft
 * (`draft_payload._review`) so a document can be reopened, edited and saved again with nothing lost.
 * `buildTargetPayload` turns it into the keys the destination screen's own form understands. It is pure
 * (no DB / React) and unit-tested, because this is where "extracted info disconnected from the form" and
 * "price fields leaking into a cargo form" used to happen.
 */

import { type AccountSelection, EMPTY_ACCOUNT_SELECTION, type IntakeModule, isUuid } from "./intake-modules";
import { convertAmount, type RateDirection } from "./party-match";

export type ReviewItem = {
  description: string;
  hsCode: string;
  quantity: number | null;
  unit: string;
  unitPrice: number | null;
  amount: number | null;
  grossWeight: number | null;
  tareWeight: number | null;
  netWeight: number | null;
  lotNo: string;
  variety: string;
  quality: string;
  sourcePage: number | null;
};

export type ReviewExchange = {
  originalAmount: number | null;
  originalCurrency: string;
  finalCurrency: string;
  rate: number | null;
  rateDate: string | null;
  direction: RateDirection;
  finalAmount: number | null;
  /** master = read from currency_rates, manual = typed by the reviewer, none = no rate yet */
  rateSource: "master" | "manual" | "none";
  /** the reviewer explicitly confirmed the conversion (required before hand-off) */
  confirmed: boolean;
};

export type ReviewBank = {
  decision: "use_matched" | "keep_extracted" | "ignore" | null;
  bankId: string | null;
};

/** How the goods travel. Decides which transport reference applies — none is universally required. */
export type ShipmentMode = "" | "sea" | "road" | "air" | "train";

export type ReviewForm = {
  contractNo: string;
  documentDate: string;
  reference: string;
  currency: string;
  totalAmount: string;
  paymentTerms: string;
  deliveryTerms: string;
  incoterm: string;
  deliveryPlace: string;
  quality: string;
  packing: string;
  hsCode: string;
  lotNo: string;
  variety: string;
  goodsDescription: string;
  grossWeight: string;
  tareWeight: string;
  netWeight: string;
  truckNo: string;
  blNo: string;
  containerNos: string;
  awbNo: string;
  railRef: string;
  /** "" = the document does not say; the reviewer may choose */
  shipmentMode: ShipmentMode;
  notes: string;
};

export type ReviewParty = { id: string | null; kind: "customer" | "company" | null; name: string; documentName: string };

export type ReviewState = {
  moduleId: string;
  form: ReviewForm;
  party: ReviewParty;
  accounts: AccountSelection;
  items: ReviewItem[];
  exchange: ReviewExchange;
  bank: ReviewBank;
};

export const EMPTY_FORM: ReviewForm = {
  contractNo: "", documentDate: "", reference: "", currency: "", totalAmount: "", paymentTerms: "", deliveryTerms: "",
  incoterm: "", deliveryPlace: "", quality: "", packing: "", hsCode: "", lotNo: "", variety: "", goodsDescription: "",
  grossWeight: "", tareWeight: "", netWeight: "", truckNo: "", blNo: "", containerNos: "", awbNo: "", railRef: "", shipmentMode: "", notes: "",
};

export const EMPTY_EXCHANGE: ReviewExchange = {
  originalAmount: null, originalCurrency: "", finalCurrency: "", rate: null, rateDate: null, direction: "multiply",
  finalAmount: null, rateSource: "none", confirmed: false,
};

export function emptyReview(moduleId: string): ReviewState {
  return {
    moduleId,
    form: { ...EMPTY_FORM },
    party: { id: null, kind: null, name: "", documentName: "" },
    accounts: { ...EMPTY_ACCOUNT_SELECTION },
    items: [],
    exchange: { ...EMPTY_EXCHANGE },
    bank: { decision: null, bankId: null },
  };
}

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Recompute the converted amount from the original amount + rate (the ONLY place conversion happens). */
export function recomputeExchange(ex: ReviewExchange): ReviewExchange {
  const same = ex.originalCurrency && ex.finalCurrency && ex.originalCurrency === ex.finalCurrency;
  if (same) return { ...ex, rate: 1, finalAmount: ex.originalAmount, rateSource: ex.rateSource === "none" ? "master" : ex.rateSource };
  if (ex.originalAmount == null || ex.rate == null) return { ...ex, finalAmount: null };
  return { ...ex, finalAmount: convertAmount(ex.originalAmount, ex.rate, ex.direction) };
}

/** Why the reviewer cannot hand the document to its module yet (empty = ready). */
export function handoffBlockers(mod: IntakeModule | null, s: ReviewState): string[] {
  const out: string[] = [];
  if (!mod) { out.push("module"); return out; }
  for (const r of mod.required) {
    const k = r === "supplier" ? "supplierAccountId" : r === "customer" ? "customerAccountId" : r === "debit" ? "debitAccountId" : r === "credit" ? "creditAccountId" : null;
    if (k && !isUuid((s.accounts as Record<string, string>)[k])) out.push(`account:${r}`);
  }
  if (mod.party && !s.party.id) out.push("party");
  if (mod.financial) {
    if (!s.form.currency) out.push("currency");
    if (!s.form.totalAmount && !s.items.some((i) => i.amount != null)) out.push("amount");
    const ex = s.exchange;
    if (ex.originalCurrency && ex.finalCurrency && ex.originalCurrency !== ex.finalCurrency) {
      if (ex.rate == null || ex.rate <= 0) out.push("rate");
      else if (!ex.confirmed) out.push("rate_unconfirmed");
    }
  }
  return out;
}

/**
 * Target-form payload. Money keys (price / currency / amount / rate / payment) are written ONLY for modules
 * flagged `financial` — a Shipping cargo form never receives them.
 */
export function buildTargetPayload(mod: IntakeModule, s: ReviewState, scope: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }): Record<string, string | number | boolean | null> {
  const f = s.form;
  const p: Record<string, string | number | boolean | null> = {};
  const put = (k: string, v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === "") return;
    p[k] = v;
  };

  put("countryId", scope.countryId);
  put("countryBranchId", scope.countryBranchId);
  put("cityBranchId", scope.cityBranchId);
  put("branchId", scope.countryBranchId || scope.cityBranchId);
  put("goodsName", f.goodsDescription);
  put("hsCode", f.hsCode);
  put("chsCode", f.hsCode);
  // Transport references are conditional: only the one that belongs to the shipment mode is carried over,
  // and only when the document actually states it (a Purchase Contract alone has none of them).
  if (f.shipmentMode === "sea") { put("blNumber", f.blNo); put("containerNumbers", f.containerNos); }
  else if (f.shipmentMode === "road") put("truckNumber", f.truckNo);
  else if (f.shipmentMode === "air") put("awbNumber", f.awbNo);
  else if (f.shipmentMode === "train") put("railReference", f.railRef);
  else if (mod.side === "shipping") { put("blNumber", f.blNo); put("containerNumbers", f.containerNos); put("truckNumber", f.truckNo); }
  put("shippingMode", { sea: "By Sea", road: "By Road", air: "By Air", train: "By Train", "": "" }[f.shipmentMode]);
  put("remarks", f.notes);

  if (mod.side === "shipping" && !mod.financial) {
    put("grossWeight", num(f.grossWeight));
    put("tareWeight", num(f.tareWeight));
    put("netWeight", num(f.netWeight));
    if (mod.party === "customer") {
      put("customerName", s.party.name || s.party.documentName);
      if (isUuid(s.party.id) && s.party.kind === "customer") put("customerId", s.party.id);
    }
    return p; // no money keys, ever
  }

  if (mod.financial) {
    const ex = s.exchange;
    put("currency", f.currency);
    put("currencyCode", f.currency);
    put("purchaseCurrency", ex.originalCurrency || f.currency);
    put("currencyType", ex.originalCurrency || f.currency);
    if (ex.finalCurrency && ex.originalCurrency && ex.finalCurrency !== ex.originalCurrency && ex.rate && ex.rate > 0) {
      put("secondaryCurrency", ex.finalCurrency);
      put("exchangeRate", ex.rate);
      put("operator", ex.direction === "divide" ? "/" : "*");
    }
    put("totalAmount", num(f.totalAmount));
    put("orderTotal", num(f.totalAmount));
  }

  if (mod.side === "purchase" || mod.side === "expense") {
    put("purchaseContractNo", f.contractNo);
    put("contractNo", f.contractNo);
    put("purchaseDate", f.documentDate);
    put("billNo", f.reference);
    put("supplierName", s.party.name || s.party.documentName);
    if (isUuid(s.party.id) && s.party.kind === "customer") put("supplierId", s.party.id);
    // In the purchase wizard the "Purchase Account" IS the supplier's ledger account.
    if (isUuid(s.accounts.supplierAccountId)) {
      put("purchaseAccountId", s.accounts.supplierAccountId);
      put("supplierAccountId", s.accounts.supplierAccountId);
    }
    if (isUuid(s.accounts.purchaseAccountId)) put("purchaseExpenseAccountId", s.accounts.purchaseAccountId);
    put("paymentDaysAndMethodDetails", [f.paymentTerms, f.deliveryTerms].filter(Boolean).join(" — "));
    put("paymentTerms", f.paymentTerms);
    put("manualBillNo", f.reference || f.contractNo);
    const it = s.items[0];
    if (it) {
      put("coursePrice", it.unitPrice);
      put("lotNo", f.lotNo || it.lotNo);
      put("allotName", f.lotNo || it.lotNo);
    }
  } else if (mod.side === "sales") {
    put("salesContractNo", f.contractNo);
    put("orderDate", f.documentDate);
    put("invoiceNo", f.reference);
    put("customerName", s.party.name || s.party.documentName);
    if (isUuid(s.party.id) && s.party.kind === "customer") put("customerId", s.party.id);
    // In the sales wizard the customer's ledger account is customerAccountId; salesAccountId is the (optional) sales / income account.
    if (isUuid(s.accounts.customerAccountId)) put("customerAccountId", s.accounts.customerAccountId);
    if (isUuid(s.accounts.salesAccountId)) put("salesAccountId", s.accounts.salesAccountId);
    put("paymentTerms", f.paymentTerms);
    put("deliveryTerms", f.deliveryTerms);
    const it = s.items[0];
    if (it) put("coursePrice", it.unitPrice);
  } else if (mod.side === "cash") {
    if (isUuid(s.accounts.debitAccountId)) put("debitAccountId", s.accounts.debitAccountId);
    if (isUuid(s.accounts.creditAccountId)) put("creditAccountId", s.accounts.creditAccountId);
    put("entryDate", f.documentDate);
    put("sourceReference", f.contractNo || f.reference);
    put("finalAmount", s.exchange.finalAmount ?? num(f.totalAmount));
  }
  return p;
}
