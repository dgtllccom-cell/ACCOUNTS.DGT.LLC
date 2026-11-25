import { describe, expect, it, vi } from "vitest";
import { issuedSalesPaymentReceipt } from "@/lib/sales/payment-receipt";
import { printSalesPaymentReceipt } from "@/lib/reports/sales-payment-receipt";

const print = vi.hoisted(() => vi.fn());
vi.mock("@/lib/store/print-store", () => ({ printStore: { openPrint: print } }));
const paid = { status: "posted", payment_kind: "remaining", payment_date: "2026-11-25", amount: "100.00", currency_code: "AED" };
const journal = { status: "posted", voucher_no: "RCPT-123", source_reference_no: "R-100", entry_category: "cash", deleted_at: null };

describe("issued Sales receipt and customer print", () => {
  it.each([["booking", "SB-202", "Sales Booking"], ["local", "LS-202", "Local Sales"]])("renders an official customer copy for %s", (saleSource, bill, sourceLabel) => {
    const order = { sales_order_no: bill, form_data: { form: { saleSource, customerAccountName: "A & B <script>" } } };
    const receipt = issuedSalesPaymentReceipt(order, paid, journal)!;
    expect(receipt).toMatchObject({ number: "RCPT-123", bill, amount: 100, currency: "AED", method: "cash", date: "2026-11-25" });
    printSalesPaymentReceipt(receipt, "en");
    const [html] = print.mock.lastCall!;
    expect(html).toContain(sourceLabel);
    expect(html).toContain("Customer Copy");
    expect(html).toContain("AED 100.00");
    expect(html).toContain("A &amp; B &lt;script&gt;");
    expect(html).toContain("R-100");
    expect(html).not.toContain("Purchase & Vendor");
    expect(html.toLowerCase()).not.toContain("account setup profile");
    expect(html).not.toContain("A & B <script>");
    expect(html).toContain("size: A4");
  });
  it("won't create receipts for the booking transfer, a draft, void or deleted journal, or missing document number", () => {
    const order = { sales_order_no: "SB-202" };
    for (const entry of [{ ...journal, status: "draft" }, { ...journal, status: "void" }, { ...journal, deleted_at: "2026-11-25" }, { ...journal, voucher_no: "" }]) {
      expect(issuedSalesPaymentReceipt(order, paid, entry)).toBeNull();
    }
    expect(issuedSalesPaymentReceipt(order, { ...paid, payment_kind: "booking" }, journal)).toBeNull();
    expect(issuedSalesPaymentReceipt(order, { ...paid, status: "cancelled" }, journal)).toBeNull();
  });
  it.each(["booking", "local"])("prints every saved goods line for %s without changing the amount received", (saleSource) => {
    const goodsEntries = [
      { goodsName: "<Almonds>", brand: "Select", origin: "Pakistan", lotName: "A-Grade", lotNo: "LTX-210", qtyNo: 5, qtyName: "Cartons", grossWeight: 50, netWeight: 49.75, unitPrice: 12, totalAmount: 60, salesCurrency: "USD" },
      { productName: "Walnuts", lotNo: "LTX-211", qtyNo: 2, qtyName: "Bags", grossWeight: null, netWeight: 0, totalAmount: 200, salesCurrency: "PKR" },
    ];
    const order = { sales_order_no: "SB-202", form_data: { form: { saleSource, manualBillNumber: "REF-314", goodsName: "Unused draft value" }, goodsEntries } };
    const receipt = issuedSalesPaymentReceipt(order, paid, journal, true)!;
    expect(receipt.goods?.[1]).toMatchObject({ gross: null, net: 0 });
    printSalesPaymentReceipt(receipt, "en");
    const [html] = print.mock.lastCall!;
    for (const value of ["REF-314", "&lt;Almonds&gt;", "LTX-210", "LTX-211", "Walnuts", "49.75", "5 Cartons", "PKR 200", "AED 100.00"]) expect(html).toContain(value);
    expect(html).not.toContain("Unused draft value");
    expect(html).toContain('data-scroll-print-preview="true"');
    expect(html).not.toContain("1 / 1");
    const limitedReceipt = issuedSalesPaymentReceipt(order, paid, journal)!;
    expect(limitedReceipt.goods?.[0]).toMatchObject({ amount: null, price: null, currency: "" });
    printSalesPaymentReceipt(limitedReceipt, "ur");
    expect(print.mock.lastCall![0]).toContain("لاٹ نمبر");
    expect(print.mock.lastCall![0]).not.toContain("USD 60");
  });
  it("does not duplicate a bill or invent goods, quantities or pricing for an older receipt", () => {
    const order = { sales_order_no: "SB-202", form_data: { form: { manualBillNumber: "SB-202", goodsName: "Historic item", qtyNo: "", quantity: "3", netWeight: false } } };
    expect(issuedSalesPaymentReceipt(order, paid, journal, true)).toMatchObject({ manualBill: "", goods: [{ name: "Historic item", quantity: 3, net: null, price: null }] });
    expect(issuedSalesPaymentReceipt({ sales_order_no: "SB-202" }, paid, journal, true)?.goods).toEqual([]);
  });
});
