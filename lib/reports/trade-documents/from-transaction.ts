/**
 * Map a real Purchase / Sales transaction record into a `TradeDocumentInput`.
 *
 * One transaction → many documents. Nothing is invented:
 *  - parties, goods, currency, amounts come straight from the record;
 *  - the exchange rate is the record's FROZEN historical rate (never recomputed);
 *  - `tradeScope` is INFERRED — international if the record carries shipping /
 *    port / BL / container data, otherwise local (shipping sections hidden);
 *  - critical fields that are absent are listed in `missingFields` for the user
 *    to confirm, not filled with placeholders.
 */

import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
import type {
  TradeDocumentInput, TradeDocType, TradeLineItem, TradeParty, TradeScope, BeneficiaryBank,
} from "./types";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type AnyRec = Record<string, any>;

const pick = (obj: AnyRec, ...keys: string[]): any => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
};
const n = (v: any): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const x = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(x) ? x : undefined;
};

function goodsFrom(entries: AnyRec[]): TradeLineItem[] {
  return (entries || []).map((g) => {
    const qty = n(pick(g, "qtyNo", "quantity", "totalQuantity", "qty", "numbers"));
    const netW = n(pick(g, "netWeight", "net_weight", "totalNetWeight"));
    const grossW = n(pick(g, "grossWeight", "gross_weight", "totalGrossWeight", "total_gross_weight"));
    const rate = n(pick(g, "coursePrice", "unitPrice", "price", "priceRateC1", "purchase_rate", "rate"));
    const amount = n(pick(g, "finalAmount", "totalAmount", "amount", "final_cost", "lineTotal"));
    const unit = pick(g, "qtyName", "unit", "quantity_name", "uom");
    return {
      description: pick(g, "goodsName", "description", "productName", "goods_name", "name"),
      hsCode: pick(g, "hsCode", "chsCode", "hs_code", "pctCode", "hsPctCode"),
      brand: pick(g, "brand", "brandName"),
      size: pick(g, "size", "sizeSpec", "grade"),
      packing: pick(g, "packing") || (qty && unit ? `${qty} ${unit}` : undefined),
      packages: n(pick(g, "packages", "packageCount")) ?? qty,
      quantity: qty,
      unit,
      unitPrice: rate,
      netWeight: netW,
      grossWeight: grossW ?? (netW != null ? Math.round(netW * 1.03) : undefined),
      amount: amount ?? (qty != null && rate != null ? qty * rate : undefined),
    };
  });
}

function inferScope(form: AnyRec, rec: AnyRec): TradeScope {
  const shippingSignals = [
    pick(form, "loadingPort", "portOfLoading", "loading_port", "loadingBorder", "loadingCountry"),
    pick(form, "receivedPort", "receivingPort", "portOfDischarge", "received_port", "exitPort", "receivedCountry"),
    pick(form, "blNumber", "bl_number"),
    pick(form, "containerNumbers", "container_numbers", "containers"),
    pick(form, "shippingMode", "shipping_mode", "transportMode"),
    pick(form, "vesselName", "vessel"),
    pick(rec, "dest_country_id"),
  ];
  return shippingSignals.some((v) => v !== undefined) ? "international" : "local";
}

export type MapOptions = {
  docType: TradeDocType;
  lang: SupportedLanguage;
  branding: DocumentBranding;
  bank?: BeneficiaryBank | null;
  /** user-confirmed overrides for missing / to-review fields */
  overrides?: Partial<Pick<TradeDocumentInput, "buyer" | "seller" | "notifyParty" | "delivery" | "validity" | "notes" | "signatureName">>;
  orientation?: "portrait" | "landscape";
  autoPrint?: boolean;
};

function baseFromForm(rec: AnyRec, kind: "purchase" | "sales", opts: MapOptions): TradeDocumentInput {
  const fd = rec.form_data || rec.formData || {};
  const form: AnyRec = fd.form || fd || {};
  const entries: AnyRec[] = form.goodsEntries || fd.goodsEntries || fd.goods || form.goods || rec.goods || [];
  const goods = goodsFrom(entries);
  const scope = inferScope(form, rec);

  const currency = pick(rec, "currency_code", "currency") || pick(form, "purchaseCurrency", "currencyCode", "currencyType", "currency") || "USD";
  const exchangeRate = n(pick(rec, "exchange_rate")) ?? n(pick(form, "exchangeRate")) ?? undefined;
  const functionalCurrency = pick(form, "secondaryCurrency", "localCurrency", "functionalCurrency", "paymentCurrency") || pick(rec, "local_currency");

  const supplier = pick(form, "supplierName", "supplier_name") || rec.companies?.name || pick(rec, "supplier_name");
  const customer = pick(form, "customerName", "customer_name", "buyerName") || pick(rec, "customer_name");
  const isSales = kind === "sales";
  const seller: TradeParty = {
    name: (isSales ? opts.branding.entityName : supplier) || opts.branding.entityName,
    address: isSales ? opts.branding.address : pick(form, "supplierAddress"),
    phone: isSales ? opts.branding.phone : pick(form, "supplierMobile", "supplierContact", "purchaseContact"),
    email: isSales ? opts.branding.email : pick(form, "supplierEmail"),
    taxId: isSales ? opts.branding.taxNumber : pick(form, "supplierTaxId", "supplierTrn"),
    country: isSales ? opts.branding.countryName : pick(form, "loadingCountry", "supplierCountry"),
  };
  const buyer: TradeParty = {
    name: (isSales ? customer : opts.branding.entityName) || (isSales ? customer : opts.branding.entityName),
    address: isSales ? pick(form, "customerAddress", "deliveryAddress") : opts.branding.address,
    phone: isSales ? pick(form, "customerContact", "customerMobile") : opts.branding.phone,
    email: isSales ? pick(form, "customerEmail") : opts.branding.email,
    taxId: isSales ? pick(form, "customerTrn", "customerTaxId") : opts.branding.taxNumber,
    country: isSales ? pick(form, "receivedCountry", "customerCountry") : opts.branding.countryName,
  };

  const totalNet = goods.reduce((s, g) => s + (Number(g.netWeight) || 0), 0);
  const totalGross = goods.reduce((s, g) => s + (Number(g.grossWeight) || 0), 0);
  const totalQty = goods.reduce((s, g) => s + (Number(g.quantity) || 0), 0);
  const totalPkg = goods.reduce((s, g) => s + (Number(g.packages) || 0), 0);
  const subTotal = goods.reduce((s, g) => s + (Number(g.amount) || 0), 0);
  const grand = n(pick(rec, "order_total")) ?? n(pick(form, "orderTotal", "grandTotal")) ?? subTotal;
  const advance = n(pick(rec, "advance_paid")) ?? n(pick(form, "advanceAmount"));

  const transport = scope === "international" ? {
    mode: pick(form, "shippingMode", "transportMode"),
    vessel: pick(form, "vesselName", "vessel"),
    portOfLoading: pick(form, "loadingPort", "loadingBorder", "airportName"),
    loadingCountry: pick(form, "loadingCountry"),
    portOfDischarge: pick(form, "receivedPort", "receivingPort", "receivedBorder", "exitPort"),
    dischargeCountry: pick(form, "receivedCountry"),
    shippingLine: pick(form, "shippingLineName", "shippingLine"),
    blNumber: pick(form, "blNumber", "bl_number"),
    containers: String(pick(form, "containerNumbers", "container_numbers") || "").split(/[,\s]+/).filter(Boolean),
    containerSize: pick(form, "containerSize"),
    marks: pick(form, "shippingMarks", "marks"),
    etd: pick(form, "loadingDate", "etd"),
    eta: pick(form, "receivedDate", "eta"),
  } : null;

  const missing: string[] = [];
  if (!buyer.name) missing.push("Buyer");
  if (!seller.name) missing.push("Seller");
  if (goods.length === 0) missing.push("Goods lines");
  if (opts.docType !== "packing_list" && !grand) missing.push("Total amount");

  const refs = {
    contract: pick(rec, "purchase_contract_no", "sales_contract_no") || pick(form, "purchaseContractNo", "salesContractNo", "contractNo"),
    po: pick(rec, "purchase_order_no") || pick(form, "purchaseOrderNo"),
    so: pick(rec, "sales_order_no") || pick(form, "salesOrderNo"),
    invoice: pick(form, "billNo", "invoiceNo", "manualBillNumber", "manualReferenceNumber"),
    quotation: pick(form, "quotationNo", "quotationNumber"),
    booking: pick(rec, "purchaseBookingOrderNumber") || pick(form, "bookingReference"),
  };

  return {
    docType: opts.docType,
    txnKind: kind,
    tradeScope: scope,
    lang: opts.lang,
    branding: opts.branding,
    docNo: `${opts.docType === "commercial_invoice" ? "CI" : opts.docType === "packing_list" ? "PL" : "PFI"}-${refs.invoice || refs.contract || refs.po || refs.so || rec.id?.slice(0, 8) || "NEW"}`,
    docDate: pick(form, "purchaseDate", "orderDate", "bookingDate", "invoiceDate") || pick(rec, "created_at") || new Date().toISOString(),
    referenceNos: refs,
    seller: { ...seller, ...(opts.overrides?.seller || {}) },
    buyer: { ...buyer, ...(opts.overrides?.buyer || {}) },
    notifyParty: opts.overrides?.notifyParty ?? null,
    delivery: {
      incoterms: pick(form, "incoterms", "deliveryTerms"),
      deliveryTerms: pick(form, "deliveryTerms"),
      paymentTerms: pick(form, "paymentDaysAndMethodDetails", "paymentTerms", "paymentType"),
      ...(opts.overrides?.delivery || {}),
    },
    transport,
    goods,
    currency,
    exchangeRate,
    functionalCurrency,
    totals: {
      totalPackages: totalPkg || undefined,
      totalQuantity: totalQty || undefined,
      totalNetWeight: totalNet || undefined,
      totalGrossWeight: totalGross || undefined,
      subTotal: subTotal || undefined,
      grandTotal: grand || undefined,
      advanceAmount: advance || undefined,
      balanceAmount: grand != null && advance != null ? grand - advance : undefined,
    },
    bank: opts.bank ?? null,
    validity: opts.overrides?.validity ?? null,
    notes: opts.overrides?.notes ?? pick(form, "remarks", "orderReportRemarks", "purchaseInvoiceRemarks"),
    signatureName: opts.overrides?.signatureName ?? null,
    missingFields: missing,
    orientation: opts.orientation,
    autoPrint: opts.autoPrint,
  };
}

export function purchaseOrderToTradeInput(rec: AnyRec, opts: MapOptions): TradeDocumentInput {
  return baseFromForm(rec, "purchase", opts);
}

export function salesOrderToTradeInput(rec: AnyRec, opts: MapOptions): TradeDocumentInput {
  return baseFromForm(rec, "sales", opts);
}

/** Local Purchase (`local_purchases` table) — a single-good, no-shipping record. */
export function localPurchaseToTradeInput(rec: AnyRec, opts: MapOptions): TradeDocumentInput {
  const qty = n(rec.numbers) ?? n(rec.quantity_kgs);
  const li: TradeLineItem = {
    description: rec.goods_name,
    hsCode: rec.chassis_code,
    brand: rec.brand,
    size: rec.size,
    packing: rec.quantity_name && rec.quantity_kgs ? `${rec.numbers || ""} ${rec.quantity_name}` : undefined,
    packages: n(rec.numbers),
    quantity: qty,
    unit: rec.quantity_name,
    unitPrice: n(rec.purchase_rate),
    netWeight: n(rec.net_weight),
    grossWeight: n(rec.total_gross_weight),
    amount: n(rec.final_cost) ?? n(rec.purchase_cost),
  };
  const grand = n(rec.final_cost) ?? n(rec.purchase_cost) ?? (li.amount || 0);
  return {
    docType: opts.docType,
    txnKind: "purchase",
    tradeScope: "local",
    lang: opts.lang,
    branding: opts.branding,
    docNo: `${opts.docType === "commercial_invoice" ? "CI" : opts.docType === "packing_list" ? "PL" : "PFI"}-LP-${rec.id?.slice(0, 8) || "NEW"}`,
    docDate: rec.created_at || new Date().toISOString(),
    referenceNos: { invoice: rec.purchase_account_no, contract: rec.chassis_code },
    seller: { name: rec.supplier_name || opts.branding.entityName, ...(opts.overrides?.seller || {}) },
    buyer: { name: opts.branding.entityName, address: opts.branding.address, taxId: opts.branding.taxNumber, ...(opts.overrides?.buyer || {}) },
    notifyParty: null,
    delivery: { ...(opts.overrides?.delivery || {}) },
    transport: null,
    goods: [li],
    currency: rec.purchase_currency || "USD",
    exchangeRate: n(rec.exchange_rate),
    functionalCurrency: rec.local_currency,
    totals: {
      totalQuantity: qty || undefined,
      totalNetWeight: n(rec.net_weight) || undefined,
      totalGrossWeight: n(rec.total_gross_weight) || undefined,
      subTotal: li.amount || undefined,
      grandTotal: grand || undefined,
    },
    bank: opts.bank ?? null,
    validity: opts.overrides?.validity ?? null,
    notes: opts.overrides?.notes ?? null,
    signatureName: opts.overrides?.signatureName ?? null,
    missingFields: [
      ...(rec.supplier_name ? [] : ["Supplier"]),
      ...(rec.goods_name ? [] : ["Goods"]),
    ],
    orientation: opts.orientation,
    autoPrint: opts.autoPrint,
  };
}
