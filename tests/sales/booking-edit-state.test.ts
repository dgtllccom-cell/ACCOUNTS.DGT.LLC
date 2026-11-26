import { describe, expect, it } from "vitest";
import { isSalesBookingEditLocked } from "@/lib/sales/booking-edit-state";

describe("Sales Booking edit safeguards", () => {
  it("allows unpaid drafts awaiting transfer", () => {
    expect(isSalesBookingEditLocked({ sales_status: "Draft", ledger_posting_status: "unposted",
      paid_amount: "0.0000", form_data: { workflow: { transferStatus: "pending" } } })).toBe(false);
  });

  it.each([
    { sales_status: "Finalized" },
    { ledger_posting_status: "posted" },
    { payment_status: "partial" },
    { paid_amount: "10.0000" },
    { form_data: { form: { isTransferred: true } } },
    { form_data: { workflow: { transferClaimAt: "2026-11-23T00:00:00Z" } } },
    { form_data: { lastPaymentTrace: { paymentId: "linked-payment" } } },
  ])("locks orders with prior or in-progress accounting state (%j)", order => {
    expect(isSalesBookingEditLocked(order)).toBe(true);
  });
});

import { changesSalesBookingContent } from "@/lib/sales/booking-edit-state";

describe("Sales Booking status-only updates", () => {
  it("a status move is not a content change", () => {
    expect(changesSalesBookingContent({ salesStatus: "Completed" })).toBe(false);
  });
  it("goods, amounts, accounts, branch or number are content changes", () => {
    for (const body of [{ formData: {} }, { orderTotal: 1 }, { customerAccountId: "x" }, { cityBranchId: "x" }, { salesOrderNo: "S-2" }]) {
      expect(changesSalesBookingContent(body)).toBe(true);
    }
  });
});
