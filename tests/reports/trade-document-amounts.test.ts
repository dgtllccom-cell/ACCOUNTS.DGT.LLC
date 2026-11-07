import { describe, expect, it } from "vitest";
import { salesOrderToTradeInput, type MapOptions } from "@/lib/reports/trade-documents/from-transaction";

/**
 * Line amounts are in the document currency. The wizard also stores a local-currency equivalent (finalAmount,
 * value x exchange rate); the document must not print that under the document currency.
 */
const rec = {
  id: "so-amt-1",
  currency_code: "USD",
  order_total: 203484, // stored in the local currency (AFN) - not the document total
  exchange_rate: 3.673,
  created_at: "2026-10-10T00:00:00Z",
  form_data: {
    form: { salesCompanyName: "Global Trading LLC", customerName: "Al Noor Imports", currencyCode: "USD", exchangeRate: 3.673 },
    goodsEntries: [
      { goodsName: "Almond Kernel", qtyNo: 10, qtyName: "MT", netWeight: 11000, coursePrice: 2500, totalAmount: 25000, finalAmount: 91825 },
      { goodsName: "Pistachio", qtyNo: 5, qtyName: "MT", netWeight: 5500, coursePrice: 3200, totalAmount: 16000, finalAmount: 58768 },
      { goodsName: "Raisins", qtyNo: 8, qtyName: "MT", netWeight: 7500, coursePrice: 1800, totalAmount: 14400, finalAmount: 52891 },
    ],
  },
};

const opts: MapOptions = { docType: "sales_invoice", lang: "en", branding: { entityName: "DGT", countryName: "Afghanistan" } as any };

describe("trade document amounts are in the document currency", () => {
  it("each line prints its document-currency amount, not the local equivalent", () => {
    const input = salesOrderToTradeInput(rec, opts);
    expect(input.goods.map((g) => g.amount)).toEqual([25000, 16000, 14400]);
  });

  it("the subtotal and grand total are the document-currency sum, and the rate is kept", () => {
    const input = salesOrderToTradeInput(rec, opts);
    expect(input.totals?.subTotal).toBe(55400);
    expect(input.totals?.grandTotal).toBe(55400);
    expect(input.exchangeRate).toBe(3.673);
  });
});
