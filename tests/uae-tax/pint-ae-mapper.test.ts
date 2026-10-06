import { describe, expect, it } from "vitest";
import { mapToPintAe, validatePintAe, type ErpEInvoiceInput } from "@/lib/services/einvoice/pint-ae-mapper";

const baseInvoice: ErpEInvoiceInput = {
  invoiceNumber: "INV-2026-001",
  documentType: "tax_invoice",
  issueDate: "2026-08-15",
  currency: "AED",
  seller: { name: "DAMAAN Trading LLC", trn: "100000000000003", country: "AE" },
  buyer: { name: "Al-Noor Retail", trn: "100000000000456", country: "AE" },
  lines: [
    { id: 1, description: "Rice 25kg", quantity: 10, unitPrice: 100, lineNet: 1000, vatCategory: "S", vatRate: 5, vatAmount: 50 },
    { id: 2, description: "Delivery", quantity: 1, unitPrice: 200, lineNet: 200, vatCategory: "S", vatRate: 5, vatAmount: 10 },
  ],
  totals: { netAmount: 1200, vatAmount: 60, grossAmount: 1260 },
};

describe("PINT-AE mapper", () => {
  it("maps an ERP invoice to a PINT-AE structure with the AE profile", () => {
    const p = mapToPintAe(baseInvoice) as any;
    expect(p.profile).toContain("ae-1");
    expect(p.id).toBe("INV-2026-001");
    expect(p.invoiceTypeCode).toBe("388"); // tax invoice
    expect(p.documentCurrencyCode).toBe("AED");
    expect(p.accountingSupplierParty.party.partyTaxScheme[0].companyId).toBe("100000000000003");
    expect(p.accountingCustomerParty.party.partyTaxScheme[0].companyId).toBe("100000000000456");
    expect(p.invoiceLine).toHaveLength(2);
    expect(p.legalMonetaryTotal.taxInclusiveAmount.value).toBe(1260);
  });

  it("groups tax subtotals by category + rate", () => {
    const p = mapToPintAe(baseInvoice) as any;
    const subs = p.taxTotal[0].taxSubtotal;
    expect(subs).toHaveLength(1); // both lines are S@5%
    expect(subs[0].taxableAmount.value).toBe(1200);
    expect(subs[0].taxAmount.value).toBe(60);
  });

  it("uses code 381 for a credit note and carries the billing reference", () => {
    const p = mapToPintAe({
      ...baseInvoice,
      documentType: "tax_credit_note",
      relatedInvoiceNumber: "INV-2026-001",
      totals: { netAmount: -1200, vatAmount: -60, grossAmount: -1260 },
      lines: baseInvoice.lines.map((l) => ({ ...l, lineNet: -l.lineNet, vatAmount: -l.vatAmount })),
    }) as any;
    expect(p.invoiceTypeCode).toBe("381");
    expect(p.billingReference.invoiceDocumentReference.id).toBe("INV-2026-001");
  });

  it("validatePintAe passes a well-formed payload", () => {
    expect(validatePintAe(mapToPintAe(baseInvoice))).toEqual([]);
  });

  it("validatePintAe flags a missing seller TRN", () => {
    const p = mapToPintAe({ ...baseInvoice, seller: { name: "X", trn: "" } });
    const errs = validatePintAe(p);
    expect(errs.some((e) => e.code === "PINT-010")).toBe(true);
  });

  it("validatePintAe flags a totals mismatch", () => {
    const p = mapToPintAe(baseInvoice) as any;
    p.legalMonetaryTotal.taxInclusiveAmount.value = 9999;
    const errs = validatePintAe(p);
    expect(errs.some((e) => e.code === "PINT-030")).toBe(true);
  });

  it("validatePintAe flags an empty line set", () => {
    const p = mapToPintAe({ ...baseInvoice, lines: [] }) as any;
    const errs = validatePintAe(p);
    expect(errs.some((e) => e.code === "PINT-020")).toBe(true);
  });
});
