import { describe, expect, it } from "vitest";
import { ORDER_BILL_TYPES, orderBillHref } from "@/features/clearing-agent/components/order-bill-status";

describe("customer order → expense bill links", () => {
  it("the four bill types map to their pages and bill categories (the registers' own categories)", () => {
    expect(ORDER_BILL_TYPES.map((b) => [b.key, b.billTitle, b.href])).toEqual([
      ["customs", "customs_expenses", "/dashboard/clearing-agent/customs-expenses"],
      ["truck", "truck_expenses", "/dashboard/clearing-agent/truck-expenses"],
      ["customer", "customer_expenses", "/dashboard/clearing-agent/customer-expenses"],
      ["other", "other_expenses", "/dashboard/clearing-agent/other-expenses"],
    ]);
  });

  it("orderBillHref carries the order context (and the bill to open), skipping empty values", () => {
    const href = orderBillHref("truck", { orderId: "o-1", orderNo: "CO 2026/001", truckNo: "LES-123", driver: "", billId: null, date: "2026-10-28" });
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/dashboard/clearing-agent/truck-expenses");
    expect(Object.fromEntries(url.searchParams)).toEqual({ orderId: "o-1", orderNo: "CO 2026/001", truckNo: "LES-123", date: "2026-10-28" });
    expect(new URL(orderBillHref("customs", { orderId: "o-1", orderNo: "X", billId: "b-9" }), "http://x").searchParams.get("billId")).toBe("b-9");
  });
});
