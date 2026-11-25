import { describe, expect, it } from "vitest";
import { createSalesLoadingSchema, loadingProgress, loadingReadiness, loadingValues, planSalesLoading, toLoadingOrder, type LoadingRecord } from "@/lib/sales/loading-workflow";
import { t } from "@/lib/i18n/ui";

const source = {
  id: "e73b8a60-042e-4ff5-a7e1-fce71c64a502", sales_order_no: "SB-QA-009", order_date: "2026-11-23", currency_code: "AED", country_id: "ae",
  form_data: { form: { bookingCurrencyConfigured: true, currencyType: "USD", secondaryCurrency: "AED", exchangeRate: 3.6725, salesAccountName: "Walnut Sales" }, goodsEntries: [
    { goodsName: "Walnuts", lotNo: "LOT-101", qtyNo: 5000, qtyName: "Cartons", finalAmount: 367.25, purchaseAccountName: "Supplier A", purchaseAccountNo: "P-23" },
    { goodsName: "Almonds", lotRef: "LOT-102", qtyNo: 50, qtyName: "KG", finalAmount: 10 },
  ] },
};
const item = (line: number, quantity: number) => ({ line, quantity, gross: 4200, net: 4100 });
const container = (containerNumber: string, items: ReturnType<typeof item>[]) => createSalesLoadingSchema.parse({ orderId: source.id,
  containers: [{ containerNumber, containerType: "40 FT", loadingDate: "2026-11-24", items }] }).containers[0];
const existing = (line: number, quantity: number, received_date: string | null = null): LoadingRecord => ({ id: "example", entry_no: 1, sales_order_id: source.id, sales_booking_no: source.sales_order_no, container_number: "ABC1", container_type: "40 FT", loading_date: "2026-11-24", received_date, details: {}, created_by_name: "A", goods: [item(line, quantity)] });

describe("Sales Loading", () => {
  it("maps saved goods and does not expose accounts or amounts for operational roles", () => {
    const full = toLoadingOrder(source, true);
    expect(full.finalCurrency).toBe("AED");
    expect(full.goods[0]).toMatchObject({ lot: "LOT-101", purchaseDR: ["P-23", "Supplier A"], amount: 367.25 });
    expect(full.orderDate).toBe("2026-11-23");
    const limited = toLoadingOrder(source, false);
    expect(limited.finalCurrency).toBe("");
    expect(limited.salesCR).toEqual([]);
    expect(limited.goods[0]).toMatchObject({ lot: "LOT-101", purchaseDR: [], amount: 0 });
  });
  it("loads multiple containers against the same booking and tracks line quantities rather than mixing units", () => {
    const order = toLoadingOrder(source, true);
    const planned = planSalesLoading(order.goods, [], [container(" ab c1 ", [item(0, 1000)]), container("ABC2", [item(0, 4000), item(1, 50)])]);
    expect(planned[0].containerNumber).toBe("ABC1");
    expect(planned[0].items[0]).toMatchObject({ goods: "Walnuts", lot: "LOT-101", quantity: 1000, unit: "Cartons" });
    expect(loadingProgress(order.goods, [existing(0, 1000)]).status).toBe("partial");
    expect(loadingProgress(order.goods, planned.map(p => ({ goods: p.items }))).status).toBe("loaded");
  });
  it("rejects a duplicate container, another booking's line, and excess against saved and same-request containers", () => {
    const goods = toLoadingOrder(source, true).goods;
    const prior = [existing(0, 1000)];
    expect(() => planSalesLoading(goods, prior, [container("abc1", [item(0, 100)])])).toThrow("already belongs");
    expect(() => planSalesLoading(goods, prior, [container("ABC2", [item(999, 1)])])).toThrow("does not belong");
    expect(() => planSalesLoading(goods, prior, [container("ABC2", [item(0, 3900)]), container("ABC3", [item(0, 101)])])).toThrow("exceeds");
  });
  it("checks before parsing duplicate goods or reversed weights", () => {
    expect(() => container("ABC1", [item(0, 10), item(0, 15)])).toThrow("only once");
    expect(() => container("ABC1", [{ ...item(0, 10), gross: 10 }])).toThrow("cannot exceed gross");
  });
  it("values actually received containers separately from loaded containers", () => {
    const order = toLoadingOrder(source, true);
    const totals = loadingValues(order, [existing(0, 1000), existing(1, 50, "2026-11-25")]);
    expect(totals.total).toBeCloseTo(377.25);
    expect(totals.loading).toBeCloseTo(83.45);
    expect(totals.received).toBeCloseTo(10);
  });
  it("checks original-currency actual payments against cash and advance thresholds without re-converting them", () => {
    const inCash = { ...source, order_total: 367.25, total_goods_original: 100, form_data: { ...source.form_data, form: { ...source.form_data.form, paymentType: "Cash" } } };
    expect(loadingReadiness({ ...inCash, paid_amount: 100 })).toBe("ready");
    expect(loadingReadiness({ ...inCash, paid_amount: 99 })).toBe("awaiting_advance");
    expect(loadingReadiness({ ...inCash, total_goods_original: 0, paid_amount: 100 })).toBe("ready");
    const inAdvance = { ...inCash, form_data: { ...inCash.form_data, form: { ...inCash.form_data.form, paymentType: "Advance", advancePercent: 10 } } };
    expect(loadingReadiness({ ...inAdvance, paid_amount: 10 })).toBe("ready");
    expect(loadingReadiness({ ...inAdvance, paid_amount: 9 })).toBe("awaiting_advance");
  });
  it("requires a finalized invoice and does not invent a source lot", () => {
    const invoice = { ...source, form_data: { ...source.form_data, form: { ...source.form_data.form, paymentType: "Invoice" } } };
    expect(loadingReadiness({ ...invoice, invoice_finalized: false })).toBe("awaiting_invoice");
    expect(loadingReadiness({ ...invoice, invoice_finalized: true })).toBe("ready");
    expect(loadingReadiness({ ...source, form_data: { form: { saleType: "endorse" }, goodsEntries: [{ qtyNo: 2 }] } })).toBe("awaiting_lot");
  });
  it("provides the Sales Loading title and error labels in all five locales", () => {
    for (const key of ["title", "save_error", "duplicate_container", "entry_title", "main_branch", "city_branch"]) {
      const labels = (["en", "ur", "ar", "fa", "ps"] as const).map(lang => t(lang, `sales_loading.${key}` as never, ""));
      expect(labels.every(Boolean)).toBe(true);
      expect(new Set(labels).size).toBe(5);
    }
  });
});
