/**
 * PINT-AE mapper — converts an ERP e-invoice record into the UAE Peppol
 * International Invoice (PINT-AE) JSON structure, and validates it.
 *
 * This is the structural skeleton. The exact code lists, cardinalities and
 * business rules are configurable via uae_tax_rules (rule_type =
 * 'einvoice_validation') so they can track the published PINT-AE spec without a
 * code change. Do not hard-code regulatory values here.
 */

export interface ErpEInvoiceInput {
  invoiceNumber: string;
  documentType: "tax_invoice" | "tax_credit_note" | "commercial_invoice" | "self_billed";
  issueDate: string; // YYYY-MM-DD
  currency: string;
  seller: { name: string; trn: string; address?: string; country?: string };
  buyer: { name?: string; trn?: string; address?: string; country?: string };
  lines: Array<{
    id: string | number;
    description: string;
    quantity: number;
    unitPrice: number;
    lineNet: number;
    vatCategory: "S" | "Z" | "E" | "O" | "RC"; // standard / zero / exempt / out-of-scope / reverse-charge
    vatRate: number;
    vatAmount: number;
  }>;
  totals: { netAmount: number; vatAmount: number; grossAmount: number };
  relatedInvoiceNumber?: string; // for credit notes
  notes?: string;
}

const DOC_TYPE_CODE: Record<ErpEInvoiceInput["documentType"], string> = {
  tax_invoice: "388", // Commercial invoice (UNTDID 1001)
  tax_credit_note: "381", // Credit note
  commercial_invoice: "380",
  self_billed: "389", // Self-billed invoice
};

const VAT_CATEGORY_CODE: Record<string, string> = {
  S: "S", // Standard rated
  Z: "Z", // Zero rated
  E: "E", // Exempt
  O: "O", // Out of scope / services outside scope
  RC: "AE", // VAT Reverse Charge
};

export function mapToPintAe(input: ErpEInvoiceInput): Record<string, unknown> {
  return {
    profile: "urn:peppol:pint:billing-1@ae-1",
    customizationId: "urn:peppol:pint:billing-1@ae-1",
    id: input.invoiceNumber,
    issueDate: input.issueDate,
    invoiceTypeCode: DOC_TYPE_CODE[input.documentType],
    documentCurrencyCode: input.currency,
    ...(input.relatedInvoiceNumber ? { billingReference: { invoiceDocumentReference: { id: input.relatedInvoiceNumber } } } : {}),
    note: input.notes,
    accountingSupplierParty: {
      party: {
        partyName: { name: input.seller.name },
        partyTaxScheme: [{ companyId: input.seller.trn, taxScheme: { id: "VAT" } }],
        postalAddress: { streetName: input.seller.address, country: { identificationCode: input.seller.country ?? "AE" } },
      },
    },
    accountingCustomerParty: {
      party: {
        partyName: { name: input.buyer.name ?? "" },
        ...(input.buyer.trn ? { partyTaxScheme: [{ companyId: input.buyer.trn, taxScheme: { id: "VAT" } }] } : {}),
        postalAddress: { streetName: input.buyer.address, country: { identificationCode: input.buyer.country ?? "AE" } },
      },
    },
    taxTotal: [
      {
        taxAmount: { currencyID: input.currency, value: round2(input.totals.vatAmount) },
        taxSubtotal: groupVatSubtotals(input),
      },
    ],
    legalMonetaryTotal: {
      lineExtensionAmount: { currencyID: input.currency, value: round2(input.totals.netAmount) },
      taxExclusiveAmount: { currencyID: input.currency, value: round2(input.totals.netAmount) },
      taxInclusiveAmount: { currencyID: input.currency, value: round2(input.totals.grossAmount) },
      payableAmount: { currencyID: input.currency, value: round2(input.totals.grossAmount) },
    },
    invoiceLine: input.lines.map((l, i) => ({
      id: String(l.id ?? i + 1),
      invoicedQuantity: l.quantity,
      lineExtensionAmount: { currencyID: input.currency, value: round2(l.lineNet) },
      item: {
        name: l.description,
        classifiedTaxCategory: {
          id: VAT_CATEGORY_CODE[l.vatCategory] ?? "S",
          percent: l.vatRate,
          taxScheme: { id: "VAT" },
        },
      },
      price: { priceAmount: { currencyID: input.currency, value: round2(l.unitPrice) } },
    })),
  };
}

function groupVatSubtotals(input: ErpEInvoiceInput) {
  const groups = new Map<string, { rate: number; taxable: number; vat: number; cat: string }>();
  for (const l of input.lines) {
    const key = `${l.vatCategory}:${l.vatRate}`;
    const g = groups.get(key) ?? { rate: l.vatRate, taxable: 0, vat: 0, cat: l.vatCategory };
    g.taxable += l.lineNet;
    g.vat += l.vatAmount;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({
    taxableAmount: { currencyID: input.currency, value: round2(g.taxable) },
    taxAmount: { currencyID: input.currency, value: round2(g.vat) },
    taxCategory: { id: VAT_CATEGORY_CODE[g.cat] ?? "S", percent: g.rate, taxScheme: { id: "VAT" } },
  }));
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Structural validation of a PINT-AE payload. Returns [] when valid. */
export function validatePintAe(payload: unknown): Array<{ code: string; message: string; path?: string }> {
  const errs: Array<{ code: string; message: string; path?: string }> = [];
  const p = payload as Record<string, any>;
  if (!p || typeof p !== "object") return [{ code: "PINT-000", message: "Payload is not an object" }];

  const req: Array<[string, string]> = [
    ["id", "Invoice number (id) is required"],
    ["issueDate", "issueDate is required"],
    ["invoiceTypeCode", "invoiceTypeCode is required"],
    ["documentCurrencyCode", "documentCurrencyCode is required"],
  ];
  for (const [key, msg] of req) {
    if (p[key] === undefined || p[key] === null || p[key] === "") errs.push({ code: "PINT-001", message: msg, path: key });
  }

  const sellerTrn = p?.accountingSupplierParty?.party?.partyTaxScheme?.[0]?.companyId;
  if (!sellerTrn || String(sellerTrn).length < 5) {
    errs.push({ code: "PINT-010", message: "Seller TRN is missing or invalid", path: "accountingSupplierParty" });
  }

  const lines = p?.invoiceLine;
  if (!Array.isArray(lines) || lines.length === 0) {
    errs.push({ code: "PINT-020", message: "At least one invoice line is required", path: "invoiceLine" });
  }

  const gross = Number(p?.legalMonetaryTotal?.taxInclusiveAmount?.value);
  const net = Number(p?.legalMonetaryTotal?.taxExclusiveAmount?.value);
  const vat = Number(p?.taxTotal?.[0]?.taxAmount?.value);
  if (Number.isFinite(gross) && Number.isFinite(net) && Number.isFinite(vat)) {
    if (Math.abs(gross - (net + vat)) > 0.02) {
      errs.push({ code: "PINT-030", message: `taxInclusiveAmount (${gross}) != taxExclusiveAmount (${net}) + VAT (${vat})`, path: "legalMonetaryTotal" });
    }
  }

  return errs;
}
