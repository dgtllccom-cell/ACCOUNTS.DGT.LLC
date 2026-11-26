import { describe, expect, it } from "vitest";
import { convertReviewedSalesReceipt, linkedSalesAdvanceReceipt, linkedSalesBalanceReceipt, salesInvoiceReceiptHref, matchesSalesReceiptQueue, planSalesWorkflowReceipt, reviewedSalesSettlement, salesWorkflowDestination, salesWorkflowPayment } from "@/lib/sales/payment-workflow";

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

it.each([["Cash", "cash"], ["Account Transfer", "account-transfer"]] as const)(
  "keeps historical %s discoverable without allowing a receipt with missing settlement",
  (paymentType, queue) => {
    const row = { ledger_posting_status: "posted", payment_status: "partial", form_data: { form: { paymentType } } };
    expect(matchesSalesReceiptQueue(row, queue)).toBe(true);
    expect(reviewedSalesSettlement(undefined)).toBeNull();
    expect(planSalesWorkflowReceipt(undefined, { currency: "AED", amount: 50, paidOriginal: 10, remainingOriginal: 90 })).toBeNull();
  },
);

it("rejects missing and invalid approved settlement amounts and currency", () => {
  for (const settlement of [null, {}, { finalCurrency: "AED", originalAmount: 10 }, { finalCurrency: "AED", originalAmount: 100, finalAmount: 0 }]) {
    expect(reviewedSalesSettlement(settlement)).toBeNull();
  }
  expect(reviewedSalesSettlement({ finalCurrency: " aed ", originalAmount: "100", finalAmount: "367" })).toEqual({ currency: "AED", original: 100, final: 367 });
});

describe("linked Sales Roznamcha entry points", () => {
  const settlement = { finalCurrency: "AED", originalAmount: 100, finalAmount: 367 };
  const postedOrder = (paymentType: string, advancePercent = 0) => ({
    ledger_posting_status: "posted", payment_status: "partially_paid", paid_amount: 20, remaining_amount: 80,
    form_data: { form: { paymentType, advancePercent }, transferTrace: { settlement } },
  });
  it.each([
    ["Invoice", "remaining", undefined],
    ["Credit", "credit", undefined],
    ["Cash", "remaining", "cash"],
    ["Account Transfer", "remaining", "account-transfer"],
  ])("uses the same posting stage from the order entry or Final for %s", (paymentType, kind, queue) => {
    expect(linkedSalesBalanceReceipt(postedOrder(paymentType))).toEqual({ kind, queue });
  });
  it("does not enable a new receipt for unposted, fully paid, or advance-pending bills", () => {
    expect(linkedSalesBalanceReceipt({ ...postedOrder("Invoice"), ledger_posting_status: "draft" })).toBeNull();
    expect(linkedSalesBalanceReceipt({ ...postedOrder("Cash"), payment_status: "completed" })).toBeNull();
    expect(linkedSalesBalanceReceipt({ ...postedOrder("Credit"), remaining_amount: 0 })).toBeNull();
    expect(linkedSalesBalanceReceipt(postedOrder("Endorsement", 30))).toBeNull();
    expect(linkedSalesBalanceReceipt(postedOrder("Endorsement", 20))).toEqual({ kind: "remaining", queue: undefined });
  });
  it.each(["sales_booking", "local_sales"])("links %s invoice to the original order UUID and invoice UUID", sourceModule => {
    const invoice = { id: "b78ef105-dfe2-472c-8016-cae6f19de8af", sourceId: "e73b8a60-042e-4ff5-a7e1-fce71c64a502",
      sourceTable: "sales_orders", sourceModule, docType: "commercial_invoice", txnKind: "sales", status: "finalized" };
    const url = new URL(salesInvoiceReceiptHref(invoice)!, "https://example.com");
    expect(url.pathname).toBe("/dashboard/journal/sales-order-payment/remaining");
    expect(Object.fromEntries(url.searchParams)).toEqual({ orderId: invoice.sourceId, invoiceId: invoice.id });
    for (const invalid of [{ status: "draft" }, { status: "void" }, { docType: "packing_list" }, { txnKind: "purchase" }, { sourceModule: "purchase_booking" }, { sourceTable: "purchase_orders" }, { sourceId: undefined }]) {
      expect(salesInvoiceReceiptHref({ ...invoice, ...invalid })).toBeNull();
    }
  });
});

describe("linked receipt currency and DR/CR posting amount", () => {
  const approved = { finalCurrency: "AED", originalCurrency: "USD", originalAmount: 100, finalAmount: 367, exchangeRate: 3.67, operator: "*" };
  it("takes local currency straight through without conversion", () => {
    expect(convertReviewedSalesReceipt(approved, { currency: "AED", amount: 75 })).toMatchObject({ amount: 75, currency: "AED", rate: 1 });
  });
  it("converts original foreign quantity at the approved rate, including division", () => {
    expect(convertReviewedSalesReceipt(approved, { currency: "USD", amount: 20 })).toMatchObject({ amount: 73.4, currency: "AED", rate: 3.67, operator: "*" });
    const divide = { ...approved, finalAmount: 50, exchangeRate: 2, operator: "/" };
    expect(convertReviewedSalesReceipt(divide, { currency: "USD", amount: 9 })).toMatchObject({ amount: 4.5, currency: "AED", rate: 2, operator: "/" });
  });
  it("rejects other currencies and refuses to guess a missing or inconsistent foreign rate", () => {
    expect(convertReviewedSalesReceipt(approved, { currency: "EUR", amount: 20 })).toBeNull();
    expect(convertReviewedSalesReceipt({ ...approved, exchangeRate: 5 }, { currency: "USD", amount: 20 })).toBeNull();
    expect(convertReviewedSalesReceipt({ ...approved, exchangeRate: null }, { currency: "AED", amount: 20 })).toMatchObject({ amount: 20, currency: "AED" });
  });
});

it.each(["stock", "local"])("counts the existing advance once and stops further collection after the target for %s sales", saleSource => {
  const order = { ledger_posting_status: "posted", payment_status: "partial", paid_amount: 10, remaining_amount: 90,
    form_data: { form: { saleSource, paymentType: "Advance", advancePercent: 30 },
      transferTrace: { settlement: { finalCurrency: "AED", originalAmount: 100, finalAmount: 367 } } } };
  expect(linkedSalesAdvanceReceipt(order)).toEqual({ kind: "advance", queue: undefined, limit: 73.4 });
  expect(linkedSalesBalanceReceipt(order)).toBeNull();
  const paid = { ...order, paid_amount: 30, remaining_amount: 70 };
  expect(linkedSalesAdvanceReceipt(paid)).toBeNull();
  expect(linkedSalesBalanceReceipt(paid)).toEqual({ kind: "remaining", queue: undefined });
  expect(linkedSalesAdvanceReceipt({ ...order, form_data: { ...order.form_data, form: { ...order.form_data.form, paymentType: "Credit" } } })).toBeNull();
});

describe("reviewed Sales receipt minor units", () => {
  const same = { finalCurrency: "AED", originalAmount: 100, finalAmount: 100 };
  const receipt = { currency: "AED", paidOriginal: 90, remainingOriginal: 10 };
  it("rejects even a one-cent overpayment or fractional-cent posting", () => {
    expect(planSalesWorkflowReceipt(same, { ...receipt, amount: 10.01 })).toBeNull();
    expect(planSalesWorkflowReceipt(same, { ...receipt, amount: 9.999 })).toBeNull();
    expect(planSalesWorkflowReceipt(same, { ...receipt, amount: 9.99 })).toEqual({
      currency: "AED", postingAmount: 9.99, paid: 99.99, remaining: 0.01,
    });
    expect(planSalesWorkflowReceipt(same, { ...receipt, amount: 10 })).toEqual({
      currency: "AED", postingAmount: 10, paid: 100, remaining: 0,
    });
  });

  it("collects and fully settles a one-cent balance on the existing paths", () => {
    const order = { ledger_posting_status: "posted", payment_status: "partially_paid", paid_amount: 99.99,
      remaining_amount: 0.01, form_data: { form: { paymentType: "Credit" }, transferTrace: { settlement: same } } };
    expect(linkedSalesBalanceReceipt(order)).toEqual({ kind: "credit", queue: undefined });
    expect(linkedSalesAdvanceReceipt({ ...order, form_data: { ...order.form_data,
      form: { paymentType: "Endorsement", advancePercent: 100 } } })).toMatchObject({ kind: "advance", limit: 0.01 });
    expect(planSalesWorkflowReceipt(same, { currency: "AED", amount: 0.01, paidOriginal: 99.99, remainingOriginal: 0.01 }))
      .toEqual({ currency: "AED", postingAmount: 0.01, paid: 100, remaining: 0 });
  });

  it("uses identical rounding for foreign receipt conversion and the approved outstanding amount", () => {
    const fx = { finalCurrency: "AED", originalCurrency: "USD", originalAmount: 100, finalAmount: 100.5,
      exchangeRate: 1.005, operator: "*" };
    const converted = convertReviewedSalesReceipt(fx, { currency: "USD", amount: 1 });
    expect(converted).toMatchObject({ amount: 1.01, currency: "AED" });
    const balance = { currency: "AED", paidOriginal: 99, remainingOriginal: 1 };
    expect(planSalesWorkflowReceipt(fx, { ...balance, amount: converted!.amount })).toEqual({
      currency: "AED", postingAmount: 1.01, paid: 100, remaining: 0,
    });
    expect(planSalesWorkflowReceipt(fx, { ...balance, amount: 1.02 })).toBeNull();
  });
});
