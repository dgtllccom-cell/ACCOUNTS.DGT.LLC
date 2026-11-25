import { describe, expect, it } from "vitest";
import { matchesSalesReceiptQueue, planSalesWorkflowReceipt, salesWorkflowDestination, salesWorkflowPayment } from "@/lib/sales/payment-workflow";

describe.each([{ label: "Sales Booking", local: false }, { label: "Local Sale", local: true }])("$label payment routing", ({ local }) => {
  const original = { local, billNo: "SB / 001", orderId: "e73b8a60-042e-4ff5-a7e1-fce71c64a502" };
  it("opens the existing Invoice Register linked to the exact source", () => {
    const href = salesWorkflowDestination("Invoice", original)?.href;
    const url = new URL(href!, "https://example.com");
    expect(url.pathname).toBe("/dashboard/business-edit-invoice");
    expect(Object.fromEntries(url.searchParams)).toEqual({ sourceId: original.orderId, module: local ? "local_sales" : "sales_booking", billNo: original.billNo });
  });
  it.each([["Credit", "charges", null], ["Cash", "advance", "cash"], ["Account Transfer", "advance", "account-transfer"]])("routes %s through the existing Sales Payment page", (type, path, queue) => {
    const url = new URL(salesWorkflowDestination(type, original)!.href, "https://example.com");
    expect(url.pathname).toBe(`/dashboard/journal/sales-order-payment/${path}`);
    expect(url.searchParams.get("salesOrderNo")).toBe(original.billNo);
    expect(url.searchParams.get("payment")).toBe(queue);
  });
});

it("keeps unpaid cash/transfer separate; never puts Credit, Invoice or Advance in either queue", () => {
  for (const type of ["Credit", "Invoice", "Advance", "Cash", "Account Transfer"]) {
    const data = { ledger_posting_status: "posted", payment_status: "partial", form_data: { form: { paymentType: type } } };
    expect(matchesSalesReceiptQueue(data, "cash")).toBe(type === "Cash");
    expect(matchesSalesReceiptQueue(data, "account-transfer")).toBe(type === "Account Transfer");
    expect(matchesSalesReceiptQueue({ ...data, payment_status: "paid" }, "cash")).toBe(false);
    expect(matchesSalesReceiptQueue({ ...data, ledger_posting_status: "draft" }, "account-transfer")).toBe(false);
  }
  expect(salesWorkflowPayment("account_transfer")).toBe("account-transfer");
  expect(salesWorkflowDestination("Advance Payment", {})).toBeNull();
});

it("checks an outstanding original balance using the approved final currency without converting the posted amount twice", () => {
  const settlement = { finalCurrency: "AED", originalAmount: 100, finalAmount: 367 };
  const receipt = { currency: "AED", amount: 73.4, paidOriginal: 30, remainingOriginal: 70 };
  expect(planSalesWorkflowReceipt(settlement, receipt)).toEqual({ currency: "AED", postingAmount: 73.4, paid: 50, remaining: 50 });
  expect(planSalesWorkflowReceipt(settlement, { ...receipt, currency: "USD" })).toBeNull();
  expect(planSalesWorkflowReceipt(settlement, { ...receipt, amount: 300 })).toBeNull();
  expect(planSalesWorkflowReceipt(settlement, { ...receipt, paidOriginal: 100, remainingOriginal: 0 })).toBeNull();
});
