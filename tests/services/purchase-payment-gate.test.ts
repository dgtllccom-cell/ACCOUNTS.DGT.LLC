import { describe, expect, it } from "vitest";
import { resolveLoadingEligibility, resolvePaymentCondition } from "@/lib/services/purchase-calculation-service";

const po = (paymentType: string, extra: Record<string, unknown> = {}, workflow: Record<string, unknown> = {}) => ({
  order_total: 50000,
  advance_paid: 0,
  remaining_paid: 0,
  remaining_due: 50000,
  currency_code: "USD",
  exchange_rate: 3.6725,
  payment_status: "pending",
  form_data: { form: { paymentType }, goodsEntries: [{ qtyNo: 100, totalAmount: 50000 }], totals: { totalQuantity: 100 }, workflow: { totalQuantity: 100, ...workflow } },
  ...extra,
});

describe("payment-to-loading rules", () => {
  it("recognises the three purchase payment types", () => {
    expect(resolvePaymentCondition(po("Invoice") as any)).toBe("invoice");
    expect(resolvePaymentCondition(po("Credit") as any)).toBe("credit");
    expect(resolvePaymentCondition(po("Final Payment") as any)).toBe("final");
  });

  describe("Invoice Purchase — payment must be completed and confirmed first", () => {
    it("blocks loading while nothing is paid", () => {
      const r = resolveLoadingEligibility(po("Invoice") as any, 0);
      expect(r.eligible).toBe(false);
      expect(r.reason).toMatch(/completed and confirmed/i);
    });
    it("a PARTIAL payment does not unlock loading", () => {
      const r = resolveLoadingEligibility(po("Invoice") as any, 20000);
      expect(r.eligible).toBe(false);
      expect(r.shortfallFC).toBe(30000);
    });
    it("unlocks when the posted payments cover the invoice", () => {
      expect(resolveLoadingEligibility(po("Invoice") as any, 50000).eligible).toBe(true);
    });
    it("unlocks when the invoice step is confirmed as completed", () => {
      expect(resolveLoadingEligibility(po("Invoice", {}, { invoiceStatus: "completed" }) as any, 0).eligible).toBe(true);
    });
  });

  describe("Credit Purchase — straight to Loading, outstanding payable never blocks it", () => {
    it("is eligible with nothing paid", () => {
      const r = resolveLoadingEligibility(po("Credit") as any, 0);
      expect(r.eligible).toBe(true);
      expect(r.requiredAmountFC).toBe(0);
      expect(r.shortfallFC).toBe(0);
    });
  });

  describe("Final Payment Purchase — straight to Loading, payment decided later", () => {
    it("is eligible with nothing paid (was wrongly treated as 'unknown' and blocked)", () => {
      const r = resolveLoadingEligibility(po("Final Payment") as any, 0);
      expect(r.eligible).toBe(true);
      expect(r.paymentCondition).toBe("final");
      expect(r.shortfallFC).toBe(0);
    });
  });

  it("advance purchases still need the advance cleared (unchanged)", () => {
    const adv = po("Advance Payment", {}, {});
    (adv.form_data.form as any).advancePercent = 20;
    expect(resolveLoadingEligibility(adv as any, 0).eligible).toBe(false);
  });
});
