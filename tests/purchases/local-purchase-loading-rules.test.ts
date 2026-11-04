import { describe, expect, it } from "vitest";
import {
  checkLocalPurchaseLoadingEligibility,
  classifyLocalPurchasePaymentMode,
  loadingLineErrors,
  remainingLocalPurchaseQuantity,
} from "@/lib/purchases/local-purchase-loading-rules";

describe("Local Purchase Loading: payment and quantity rules", () => {
  it("never allows an unposted purchase to load", () => {
    expect(checkLocalPurchaseLoadingEligibility({ purchaseStatus: "accepted", mode: "Credit", requiredAdvance: 0, postedAdvance: 0, creditApproved: true }).reason).toBe("NOT_POSTED");
  });

  it("requires the complete posted advance, not the promised amount", () => {
    const base = { purchaseStatus: "posted", mode: "Advance Payment", requiredAdvance: 4500, postedAdvance: 2000 };
    expect(checkLocalPurchaseLoadingEligibility(base)).toMatchObject({ allowed: false, reason: "ADVANCE_PENDING", advanceOutstanding: 2500 });
    expect(checkLocalPurchaseLoadingEligibility({ ...base, postedAdvance: 4500 })).toMatchObject({ allowed: true, reason: "READY" });
  });

  it("requires proof of posted cash payment and approved credit separately", () => {
    expect(checkLocalPurchaseLoadingEligibility({ purchaseStatus: "posted", mode: "Cash", requiredAdvance: 0, postedAdvance: 0 }).reason).toBe("CASH_PENDING");
    expect(checkLocalPurchaseLoadingEligibility({ purchaseStatus: "posted", mode: "Cash", requiredAdvance: 0, postedAdvance: 0, cashPaymentPosted: true }).allowed).toBe(true);
    expect(checkLocalPurchaseLoadingEligibility({ purchaseStatus: "posted", mode: "Credit", requiredAdvance: 0, postedAdvance: 0 }).reason).toBe("CREDIT_NOT_APPROVED");
    expect(checkLocalPurchaseLoadingEligibility({ purchaseStatus: "posted", mode: "Credit", requiredAdvance: 0, postedAdvance: 0, creditApproved: true }).allowed).toBe(true);
  });

  it("fails closed when payment mode is unknown", () => {
    expect(classifyLocalPurchasePaymentMode("something-else")).toBe("unknown");
    expect(checkLocalPurchaseLoadingEligibility({ purchaseStatus: "posted", mode: "something-else", requiredAdvance: 0, postedAdvance: 0 }).allowed).toBe(false);
  });

  it("rejects partial loading that exceeds the remaining quantity", () => {
    const row = { lineId: "goods-1", bookedQuantity: 1890, previouslyLoadedQuantity: 500, newLoadingQuantity: 1391, bookedGrossWeightKg: 94500, bookedNetWeightKg: 92610, newGrossWeightKg: 25000, newNetWeightKg: 24000 };
    expect(loadingLineErrors(row)).toContain("OVERLOADING");
    expect(loadingLineErrors({ ...row, newLoadingQuantity: 700 })).toEqual([]);
    expect(remainingLocalPurchaseQuantity(1890, 1200)).toBe(690);
  });

  it("rejects zero/negative loading, invalid gross/net and overweight", () => {
    const row = { lineId: "goods-1", bookedQuantity: 100, previouslyLoadedQuantity: 0, newLoadingQuantity: 0, bookedGrossWeightKg: 1000, bookedNetWeightKg: 950, newGrossWeightKg: 500, newNetWeightKg: 550 };
    expect(loadingLineErrors(row)).toEqual(expect.arrayContaining(["INVALID_QUANTITY", "INVALID_WEIGHT"]));
    expect(loadingLineErrors({ ...row, newLoadingQuantity: 10, newGrossWeightKg: 1100, newNetWeightKg: 900 })).toContain("OVERWEIGHT");
  });
});
