import { describe, expect, it } from "vitest";
import { buildSalesBookingPaymentUrl, resolveSalesBookingPaymentRoute, salesBookingLoadingStatus } from "@/lib/services/sales-booking-routing";

describe("Sales Booking workflow routing", () => {
  const workflow = { transferStatus: "transferred" };
  it("routes an invoice to its original bill and requires a finalized invoice for loading", () => {
    const route = resolveSalesBookingPaymentRoute("Invoice");
    expect(buildSalesBookingPaymentUrl(route, "SO/001")).toBe("/dashboard/business-edit-invoice?billNo=SO%2F001");
    expect(salesBookingLoadingStatus({ paymentType: "Invoice", workflow })).toBe("awaiting_invoice");
    expect(salesBookingLoadingStatus({ paymentType: "Invoice", workflow, invoiceFinalized: true })).toBe("ready");
    expect(salesBookingLoadingStatus({ paymentType: "Invoice", invoiceFinalized: true })).toBe("awaiting_transfer");
  });
  it("uses the Credit journal and opens loading after posting without waiting for a receipt", () => {
    const route = resolveSalesBookingPaymentRoute("Final Credit");
    expect(route.path).toBe("/dashboard/journal/sales-order-payment/credit");
    expect(salesBookingLoadingStatus({ paymentType: "Credit", ledgerStatus: "posted", paidAmount: 0 })).toBe("ready");
  });
  it("keeps Final distinct from a remaining balance payment", () => {
    expect(resolveSalesBookingPaymentRoute("Final Payment").path).toBe("/dashboard/journal/sales-order-payment/final");
    expect(resolveSalesBookingPaymentRoute("Remaining").path).toBe("/dashboard/journal/sales-order-payment/remaining");
  });
  it("keeps Advance out of loading until the receipt and the allocated stock are both ready", () => {
    const base = { paymentType: "Advance", workflow, billAmount: 1000, advancePercent: 20 };
    expect(salesBookingLoadingStatus({ ...base, paidAmount: 199 })).toBe("awaiting_advance");
    expect(salesBookingLoadingStatus({ ...base, paidAmount: 200, needsPurchaseLot: true })).toBe("awaiting_lot");
    expect(salesBookingLoadingStatus({ ...base, paidAmount: 200 })).toBe("ready");
  });
});
