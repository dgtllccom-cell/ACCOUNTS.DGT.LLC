import { describe, expect, it } from "vitest";
import {
  buildPurchaseBookingTransferUrl,
  canEditTransferredPurchaseBooking,
  isPurchaseBookingTransferLocked,
  resolvePurchaseBookingTransferDestination
} from "@/lib/services/purchase-booking-transfer-routing";

describe("purchase booking transfer routing", () => {
  it.each([
    ["Advance Payment", "advance", "/dashboard/journal/purchase-order-payment/advance"],
    ["advance", "advance", "/dashboard/journal/purchase-order-payment/advance"],
    ["Credit", "credit", "/dashboard/journal/purchase-order-payment/charges"],
    ["Invoice", "remaining", "/dashboard/journal/purchase-order-payment/remaining"],
    ["Final Payment", "remaining", "/dashboard/journal/purchase-order-payment/remaining"],
    [undefined, "remaining", "/dashboard/journal/purchase-order-payment/remaining"]
  ])("routes %s through the existing %s journal", (paymentType, flow, path) => {
    expect(resolvePurchaseBookingTransferDestination(paymentType)).toMatchObject({ flow, path });
  });

  it("adds the selected purchase order without changing the destination", () => {
    expect(buildPurchaseBookingTransferUrl("Credit", "PBO / 42")).toBe(
      "/dashboard/journal/purchase-order-payment/charges?purchaseOrderNo=PBO%20%2F%2042"
    );
  });

  it.each([
    [{ isSuperAdmin: true }, true],
    [{ roles: ["super_admin"] }, true],
    [{ roles: ["admin"] }, true],
    [{ roles: ["country_admin"] }, true],
    [{ roles: ["branch_admin"] }, false],
    [{ roles: ["user"] }, false]
  ])("enforces transferred-booking edit authorization", (session, allowed) => {
    expect(canEditTransferredPurchaseBooking(session)).toBe(allowed);
  });

  it("blocks a completed transfer but permits interrupted reconciliation or an approved edit", () => {
    expect(isPurchaseBookingTransferLocked({ ledger_posting_status: "posted", is_edited_since_transfer: false })).toBe(true);
    expect(isPurchaseBookingTransferLocked({ ledger_posting_status: "draft", is_edited_since_transfer: false })).toBe(false);
    expect(isPurchaseBookingTransferLocked({ ledger_posting_status: "posted", is_edited_since_transfer: true })).toBe(false);
  });
});
