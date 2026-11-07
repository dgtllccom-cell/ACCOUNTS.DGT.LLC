import { describe, expect, it } from "vitest";
import { salesOrderToTradeInput, type MapOptions } from "@/lib/reports/trade-documents/from-transaction";
import { buildUaeTaxInvoiceHtml } from "@/lib/reports/trade-documents/uae-tax-invoice";

/** Local-sales tax layout: chosen from the source sale, shows the reference columns, never invents VAT or TRN. */
const localRec = {
  id: "ls-1",
  currency_code: "USD",
  order_total: 203484,
  created_at: "2026-10-10T00:00:00Z",
  form_data: {
    form: { saleSource: "local", salesCompanyName: "Global Trading LLC", customerName: "Al Noor Imports", currencyCode: "USD", exchangeRate: 3.673 },
    goodsEntries: [
      { goodsName: "Almond Kernel", hsCode: "080212", qtyNo: 10, qtyName: "MT", netWeight: 11000, coursePrice: 2500, totalAmount: 25000, finalAmount: 91825 },
      { goodsName: "Pistachio", hsCode: "080252", qtyNo: 5, qtyName: "MT", netWeight: 5500, coursePrice: 3200, totalAmount: 16000, finalAmount: 58768 },
    ],
  },
};
const opts = (docType: MapOptions["docType"]): MapOptions => ({ docType, lang: "en", branding: { entityName: "Pakistan", countryName: "Pakistan" } as any });

describe("local sales use the tax layout", () => {
  it("a local sale is marked uae_tax; a standard sale is not", () => {
    expect(salesOrderToTradeInput(localRec, opts("tax_invoice")).layout).toBe("uae_tax");
    const standard = { ...localRec, form_data: { ...localRec.form_data, form: { ...localRec.form_data.form, saleSource: "customer" } } };
    expect(salesOrderToTradeInput(standard, opts("sales_invoice")).layout).toBe("standard");
  });

  it("prints the reference columns, the HS codes, the totals and the amount in words", () => {
    const input = { ...salesOrderToTradeInput(localRec, opts("tax_invoice")), docType: "tax_invoice" as const, layout: "uae_tax" as const };
    const html = buildUaeTaxInvoiceHtml(input);
    expect(html).toContain("Tax Invoice");
    for (const h of ["HS Code", "Taxable Value", "VAT %", "VAT Amount", "Total Qty", "Total Amount After Tax"]) expect(html).toContain(h);
    expect(html).toContain("080212");
    expect(html).toContain("25,000.00");
    expect(html).toContain("41,000.00");
    expect(html).toContain("Forty One Thousand");
  });

  it("does not invent a TRN, a VAT percentage or a VAT amount the record does not carry", () => {
    const input = { ...salesOrderToTradeInput(localRec, opts("tax_invoice")), docType: "tax_invoice" as const, layout: "uae_tax" as const };
    const html = buildUaeTaxInvoiceHtml(input);
    // the company TRN is not on the record: it prints as a dash
    expect(html).toMatch(/TRN<\/strong>|TRN: —|TRN:<\/div>/);
    expect(html).not.toMatch(/TRN:\s*100\d{10}/);
    // no tax data on the lines: the VAT % and VAT amount cells print as dashes
    expect((html.match(/class="r">—</g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it("the header never prints the country as the company name", () => {
    const input = { ...salesOrderToTradeInput(localRec, opts("tax_invoice")), docType: "tax_invoice" as const, layout: "uae_tax" as const };
    const html = buildUaeTaxInvoiceHtml(input);
    expect(html).toContain('<div class="brand-name">Digital Dock ERP</div>');
  });
});
