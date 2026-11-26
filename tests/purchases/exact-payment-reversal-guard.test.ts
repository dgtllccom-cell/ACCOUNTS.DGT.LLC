import { describe, expect, it, vi } from "vitest";
import { revertAllOrderPayments, revertOrderBookingTransfer } from "@/lib/services/purchase-payment-reversal";

describe("legacy Purchase Booking reversal with exact allocation", () => {
  it.each([revertAllOrderPayments, revertOrderBookingTransfer])("refuses before ledger operations or deletes (%s)", async reverse => {
    const paidRecord = { id: "fixture", applied_purchase_amount: "100.0000", roznamcha_entry_id: "journal" };
    const db = { from: vi.fn(() => qb) };
    const qb = { select: vi.fn(() => qb), eq: vi.fn(() => qb), in: vi.fn(() => qb),
      not: vi.fn(() => qb), then: (accept: (result: unknown) => void) => accept({ data: [paidRecord], error: null }) };
    const admin = { from: vi.fn() };
    await expect(reverse("booking", db, admin)).rejects.toMatchObject({ code: "EXACT_PURCHASE_PAYMENT_REVIEW_REQUIRED" });
    expect(db.from).toHaveBeenCalledExactlyOnceWith("purchase_order_payments");
    expect(admin.from).not.toHaveBeenCalled();
  });
});
