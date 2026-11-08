import { describe, expect, it } from "vitest";
import { salesOrderToTradeInput, type MapOptions } from "@/lib/reports/trade-documents/from-transaction";
import { buildUaeTaxInvoiceHtml } from "@/lib/reports/trade-documents/uae-tax-invoice";

/**
 * Local-sales tax layout, edge cases from QA on the DEV records: a saved local sale that holds only its header
 * (no goods lines), foreign-currency sales with a functional-currency total, and the Import / Export row.
 */
const branding = { entityName: "Global Trading LLC", countryName: "Afghanistan", taxNumber: "", address: "Kabul" } as any;
const opts = (docType: MapOptions["docType"]): MapOptions => ({ docType, lang: "en", branding });
const taxDoc = (rec: Record<string, any>) => {
  const input = { ...salesOrderToTradeInput(rec, opts("tax_invoice")), docType: "tax_invoice" as const, layout: "uae_tax" as const };
  return { input, html: buildUaeTaxInvoiceHtml(input) };
};

// The shape of LS-DEV-567646: a flat form_data with the sale source only, and a header total with no lines.
const headerOnlyLocalSale = {
  id: "da4604d5-3387-4b4d-9a5d-9bd8dc51fdde",
  sales_order_no: "LS-DEV-567646",
  currency_code: "AED",
  exchange_rate: 1,
  order_total: 5000,
  customer_name: null,
  created_at: "2026-10-10T00:00:00Z",
  form_data: { saleMode: "local", saleSource: "local" },
};

describe("local sale with a header total and no goods lines", () => {
  it("prints the record total, a dash for the taxable value and quantity, and no zero amounts", () => {
    const { html } = taxDoc(headerOnlyLocalSale);
    expect(html).toContain("No goods lines on this transaction.");
    expect(html).toContain("Taxable Amount</td><td>—</td>");
    expect(html).toContain("Total Amount After Tax</td><td>5,000.00 AED</td>");
    expect(html).not.toMatch(/Taxable Amount<\/td><td>0\.00/);
    expect(html).not.toMatch(/Total Amount After Tax<\/td><td>0\.00/);
    expect(html).toContain("Five Thousand Only AED");
  });

  it("prints the sale as a local sale, never as an export", () => {
    const { html } = taxDoc(headerOnlyLocalSale);
    expect(html).toContain("<td>Local Sale</td>");
    expect(html).not.toMatch(/<td>Export<\/td>/);
  });

  it("prints a dash for the amount in words when the record carries no total at all", () => {
    const { html } = taxDoc({ ...headerOnlyLocalSale, order_total: undefined });
    expect(html).toContain("Amount in words:</strong> —");
    expect(html).toContain("Total Amount After Tax</td><td>—</td>");
  });
});

describe("local sale in a foreign currency", () => {
  const usdLocalSale = {
    id: "ls-usd-1",
    sales_order_no: "LS-USD-1",
    currency_code: "USD",
    exchange_rate: 71.5,
    created_at: "2026-10-10T00:00:00Z",
    form_data: {
      form: { saleSource: "local", secondaryCurrency: "AFN", customerName: "Al Noor Imports" },
      goodsEntries: [
        { goodsName: "Almond Kernel", hsCode: "080212", qtyNo: 10, qtyName: "MT", coursePrice: 2500, totalAmount: 25000, finalAmount: 1787500 },
        { goodsName: "Pistachio", hsCode: "080252", qtyNo: 6, qtyName: "MT", coursePrice: 2750, totalAmount: 16500, finalAmount: 1179750 },
      ],
    },
  };

  it("prints the frozen rate and the functional-currency total from the document-currency total", () => {
    const { html } = taxDoc(usdLocalSale);
    expect(html).toContain("1 USD = 71.5 AFN");
    expect(html).toContain("Total in Functional Currency</td><td>" + (41500 * 71.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " AFN</td>");
    expect(html).toContain("Total Amount After Tax</td><td>41,500.00 USD</td>");
    // the line amounts are document-currency figures, never the AFN equivalents
    expect(html).toContain("25,000.00");
    expect(html).not.toContain("1,787,500");
  });

  it("prints no rate row when the sale is already in the functional currency or the rate is 1", () => {
    const sameCurrency = { ...usdLocalSale, form_data: { ...usdLocalSale.form_data, form: { ...usdLocalSale.form_data.form, secondaryCurrency: "USD" } } };
    expect(taxDoc(sameCurrency).html).not.toContain("1 USD =");
    const unitRate = { ...usdLocalSale, exchange_rate: 1 };
    expect(taxDoc(unitRate).html).not.toContain("Total in Functional Currency");
  });

  it("prints the buyer named on the sale", () => {
    const { input, html } = taxDoc(usdLocalSale);
    expect(input.buyer.name).toBe("Al Noor Imports");
    expect(html).toContain("<td>Al Noor Imports</td>");
  });
});

describe("saved sale whose form does not carry the customer", () => {
  it("falls back to the saved customer column for the buyer", () => {
    const rec = {
      id: "ls-saved-customer",
      sales_order_no: "LS-SAVED-1",
      currency_code: "AED",
      customer_name: "E2E Customer",
      order_total: 5000,
      form_data: { form: { saleSource: "local" } },
    };
    const input = salesOrderToTradeInput(rec, opts("tax_invoice"));
    expect(input.buyer.name).toBe("E2E Customer");
    expect(input.currency).toBe("AED");
    expect(input.totals?.grandTotal).toBe(5000);
  });
});

describe("sales document currency and scope", () => {
  // The country currency is stored on currency_code; the sale's own currency is original_currency_code.
  const usdOnAfnCountry = {
    id: "ls-usd-country-afn",
    sales_order_no: "QA-LS-TAX-02",
    currency_code: "AFN",
    original_currency_code: "USD",
    exchange_rate: 71.5,
    order_total: 2967250,
    created_at: "2026-11-06T00:00:00Z",
    form_data: {
      form: { saleSource: "local", saleMode: "local", currencyType: "USD", secondaryCurrency: "AFN", receivedCountry: "Afghanistan" },
      goodsEntries: [
        { goodsName: "Almond Kernel", hsCode: "080212", qtyNo: 10, qtyName: "MT", coursePrice: 2500, totalAmount: 25000, finalAmount: 1787500 },
      ],
    },
  };

  it("prints the sale's own currency (USD), not the country currency, on the amounts and the words", () => {
    const { input, html } = taxDoc(usdOnAfnCountry);
    expect(input.currency).toBe("USD");
    expect(html).toContain("Taxable Amount</td><td>25,000.00 USD</td>");
    expect(html).not.toContain("25,000.00 AFN");
    expect(html).toContain("USD</div>");
  });

  it("a saved sale's own currency wins over a currency default in its form", () => {
    const withDefault = { ...usdOnAfnCountry, form_data: { ...usdOnAfnCountry.form_data, form: { ...usdOnAfnCountry.form_data.form, currencyType: "AED" } } };
    expect(salesOrderToTradeInput(withDefault, opts("tax_invoice")).currency).toBe("USD");
  });

  it("prints the frozen rate and the functional total when the sale is in a foreign currency", () => {
    const { html } = taxDoc(usdOnAfnCountry);
    expect(html).toContain("1 USD = 71.5 AFN");
    expect(html).toContain("1,787,500.00 AFN");
  });

  it("a local sale with a received country on its form is still a local sale, not an export", () => {
    const { input, html } = taxDoc(usdOnAfnCountry);
    expect(input.tradeScope).toBe("local");
    expect(html).toContain("<td>Local Sale</td>");
    expect(html).not.toMatch(/<td>Export<\/td>/);
  });

  it("an export sale (saleMode export) keeps its international scope and the export label", () => {
    const exportSale = { ...usdOnAfnCountry, form_data: { ...usdOnAfnCountry.form_data, form: { ...usdOnAfnCountry.form_data.form, saleMode: "export" } } };
    const input = salesOrderToTradeInput(exportSale, opts("tax_invoice"));
    expect(input.tradeScope).toBe("international");
  });

  it("marks the line table as the data table, so a saved PDF is paginated as one sheet", () => {
    const { html } = taxDoc(usdOnAfnCountry);
    expect(html).toContain('<table class="items data-table">');
    expect(html).toMatch(/size: A4 (portrait|landscape)/);
  });

  it("prints the words with the cents of the total, not a rounded figure", () => {
    const withCents = { ...headerOnlyLocalSale, order_total: 41000.5 };
    const { html } = taxDoc(withCents);
    expect(html).toContain("Forty One Thousand and Fifty Cents Only AED");
  });
});
