import { describe, expect, it } from "vitest";
import { localPurchaseSettlement } from "@/lib/purchases/local-purchase-balance";

describe("local purchase settlement from ledger-verified payments", () => {
  it("LP-JRN-00000081 (5,074,545 AED, no posted payments) is unpaid, not cleared", () => {
    const s = localPurchaseSettlement(5074545, 0, 0);
    expect(s.remaining).toBe(5074545);
    expect(s.paid).toBe(0);
    expect(s.cleared).toBe(false);
  });
  it("a bill whose verified payments cover the total is cleared", () => {
    const s = localPurchaseSettlement(348000, 0, 348000);
    expect(s.remaining).toBe(0);
    expect(s.cleared).toBe(true);
  });
  it("advance and remaining payments are both deducted", () => {
    const s = localPurchaseSettlement(1000, 200, 300);
    expect(s.paid).toBe(500);
    expect(s.remaining).toBe(500);
    expect(s.cleared).toBe(false);
  });
  it("never negative and tolerant of missing values", () => {
    expect(localPurchaseSettlement(100, 0, 150).remaining).toBe(0);
    expect(localPurchaseSettlement(undefined, undefined, undefined)).toMatchObject({ total: 0, remaining: 0, cleared: false });
  });
});
