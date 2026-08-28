/**
 * AI Document Intake — reviewed-draft field mapping.
 *
 * Maps verified intake field keys → the payload shape the target source module's
 * own "new entry" screen understands. This produces a DRAFT only: the human
 * opens the real form pre-filled (Entry Method Selector → "Continue Saved
 * Draft") and completes creation there, which runs all serials / validation /
 * approval / audit / posting. Nothing here writes to any source table.
 */

export type IntakeFieldRow = {
  field_key: string;
  corrected_value: string | null;
  normalized_value: string | null;
  raw_value: string | null;
  confidence: number | null;
  page_number: number | null;
  verified: boolean;
  validation_status: string;
};

export type IntakeLineRow = {
  line_no: number;
  description: string | null;
  hs_code: string | null;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  packages: number | null;
  gross_weight: number | null;
  net_weight: number | null;
  unit_price: number | null;
  amount: number | null;
  currency: string | null;
};

export type PreparedDraft = {
  targetModule: string;
  payload: Record<string, string | number | null>;
  goodsEntries: Array<Record<string, string | number | null>>;
  provenance: Record<string, { confidence: number | null; page: number | null; verified: boolean; sourceValue: string | null }>;
  currency: string | null;
  unresolved: string[]; // field keys still red / unverified that the human must complete
};

const val = (f: IntakeFieldRow): string | null =>
  (f.corrected_value ?? f.normalized_value ?? f.raw_value ?? null) || null;

// intake key -> [target payload key(s)] per module. Only labels/chrome are
// translated elsewhere; these are field identifiers, not user text.
const MODULE_MAP: Record<string, Record<string, string>> = {
  // keys align with features/purchases/components/purchase-order-wizard.jsx DEFAULT_FORM
  purchase_orders: {
    contract_number: "purchaseContractNo",
    po_number: "purchaseOrderNo",
    invoice_number: "billNo",
    document_date: "purchaseDate",
    currency: "purchaseCurrency",
    exchange_rate: "exchangeRate",
    advance_amount: "advanceAmount",
    supplier_name: "supplierName",
    payment_terms: "paymentDaysAndMethodDetails",
    port_of_loading: "loadingPort",
    port_of_discharge: "receivedPort",
    vessel: "vesselName",
    container_numbers: "containerNumbers",
  },
  sales_orders: {
    contract_number: "salesContractNo",
    manual_contract_number: "manualReferenceNumber",
    booking_number: "bookingReference",
    so_number: "salesOrderNo",
    invoice_number: "invoiceNo",
    document_date: "orderDate",
    due_date: "paymentDueDate",
    currency: "currencyCode",
    exchange_rate: "exchangeRate",
    grand_total: "orderTotal",
    subtotal: "subTotal",
    tax_amount: "taxAmount",
    advance_amount: "advanceAmount",
    customer_name: "customerName",
    payment_terms: "paymentTerms",
    delivery_terms: "deliveryTerms",
    trn: "customerTrn",
  },
  shipping_bl_records: {
    bl_number: "blNumber",
    booking_number: "bookingNumber",
    vessel: "vesselName",
    voyage: "voyageNumber",
    port_of_loading: "portOfLoading",
    port_of_discharge: "portOfDischarge",
    shipping_line: "shippingLineName",
    shipper: "shipperName",
    consignee: "consigneeName",
    document_date: "blDate",
    eta: "eta",
    etd: "etd",
    container_numbers: "containerNumbers",
    seal_numbers: "sealNumbers",
  },
  clearing_agent_custom_entries: {
    customs_reference: "customsReferenceNo",
    bl_number: "blNumber",
    document_date: "declarationDate",
    grand_total: "assessedValue",
    currency: "currencyCode",
    port_of_discharge: "portOfDischarge",
    container_numbers: "containerNumbers",
  },
  purchase_loading_records: {
    contract_number: "purchaseContractNo",
    po_number: "purchaseOrderNo",
    container_numbers: "containerNumbers",
    document_date: "loadingDate",
    port_of_loading: "portOfLoading",
  },
  // Cash / Bank Roznamcha — a reviewed draft + pre-post preview only. The AI
  // never posts; the human posts through the existing Roznamcha screen.
  roznamcha_entries: {
    invoice_number: "billNumber",
    manual_contract_number: "manualBillNumber",
    document_date: "entryDate",
    currency: "originalCurrency",
    exchange_rate: "exchangeRate",
    grand_total: "finalAmount",
    paid_amount: "finalAmount",
    supplier_name: "counterpartyName",
    customer_name: "counterpartyName",
    contract_number: "sourceReference",
    po_number: "sourceReference",
    so_number: "sourceReference",
  },
};

const AMOUNT_KEYS = new Set([
  "grand_total", "subtotal", "freight_amount", "insurance_amount", "tax_amount",
  "advance_amount", "paid_amount", "balance_amount", "exchange_rate",
]);

function toNumber(s: string | null): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function buildPreparedDraft(
  targetModule: string,
  fields: IntakeFieldRow[],
  lines: IntakeLineRow[],
): PreparedDraft {
  const map = MODULE_MAP[targetModule] ?? {};
  const payload: Record<string, string | number | null> = {};
  const provenance: PreparedDraft["provenance"] = {};
  const unresolved: string[] = [];
  let currency: string | null = null;

  for (const f of fields) {
    const target = map[f.field_key];
    const v = val(f);
    if (f.field_key === "currency" && v) currency = v.toUpperCase().slice(0, 3);
    if (!target) continue;
    payload[target] = AMOUNT_KEYS.has(f.field_key) ? toNumber(v) : v;
    provenance[target] = {
      confidence: f.confidence,
      page: f.page_number,
      verified: f.verified,
      sourceValue: f.raw_value,
    };
    if (!f.verified && f.validation_status === "red") unresolved.push(f.field_key);
  }

  const goodsEntries = lines.map((li) => ({
    description: li.description,
    hsCode: li.hs_code,
    brand: li.brand,
    quantity: li.quantity,
    unit: li.unit,
    packages: li.packages,
    grossWeight: li.gross_weight,
    netWeight: li.net_weight,
    unitPrice: li.unit_price,
    amount: li.amount,
    currency: li.currency ?? currency,
  }));

  return { targetModule, payload, goodsEntries, provenance, currency, unresolved };
}

export const DRAFTABLE_MODULES = Object.keys(MODULE_MAP);
