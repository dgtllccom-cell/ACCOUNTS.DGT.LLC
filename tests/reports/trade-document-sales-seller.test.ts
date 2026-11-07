import { describe, expect, it } from "vitest";
import { salesOrderToTradeInput, type MapOptions } from "@/lib/reports/trade-documents/from-transaction";

/**
 * A sale is issued by the selling company chosen on the booking (the form's salesCompanyName). The branding
 * name is only the fallback, and a country name is never used as the company.
 */
const rec = {
  id: "so-1",
  currency_code: "PKR",
  created_at: "2026-10-20T00:00:00Z",
  form_data: {
    form: { salesCompanyName: "Global Trading LLC", customerName: "Al Noor Imports", currencyCode: "PKR" },
    goodsEntries: [{ goodsName: "Walnut In-Shell", qtyNo: 4, qtyName: "Bags", netWeight: 200, coursePrice: 70 }],
  },
};

const opts = (branding: any): MapOptions => ({ docType: "sales_invoice", lang: "en", branding });

describe("sales document seller", () => {
  it("uses the selling company chosen on the booking", () => {
    const input = salesOrderToTradeInput(rec, opts({ entityName: "Digital Dock ERP", countryName: "Pakistan" }));
    expect(input.seller?.name).toBe("Global Trading LLC");
  });

  it("falls back to the branding company name when the booking names no seller", () => {
    const noSeller = { ...rec, form_data: { ...rec.form_data, form: { customerName: "Al Noor Imports", currencyCode: "PKR" } } };
    const input = salesOrderToTradeInput(noSeller, opts({ entityName: "DGT Trading LLC", countryName: "Pakistan" }));
    expect(input.seller?.name).toBe("DGT Trading LLC");
  });

  it("never prints the country as the seller company", () => {
    const noSeller = { ...rec, form_data: { ...rec.form_data, form: { customerName: "Al Noor Imports" } } };
    const input = salesOrderToTradeInput(noSeller, opts({ entityName: "Pakistan", countryName: "Pakistan" }));
    expect(input.seller?.name).toBeFalsy();
  });
});
