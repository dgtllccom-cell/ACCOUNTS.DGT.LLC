import { describe, expect, it } from "vitest";
import { billFxOperator, checkPostingAgainstSaved, effectiveFxRate, toBaseAmount } from "@/lib/purchases/fx-operator";

// the two real bills (Production, read-only): AE-001-0004 USD "*", AE-001-0005 PKR "/"
const ae0004 = { form: { operator: "*" }, goodsEntries: [{ op: "*" }], totals: { grandFinal: 845250, grandPrimaryFinal: 230000 } };
const ae0005 = { form: { operator: "/" }, goodsEntries: [{ op: "/" }], totals: { grandFinal: 262305.6994818653, grandPrimaryFinal: 20250000 } };

describe("a booking converts with its own operator", () => {
  it("reads the operator the bill was saved with", () => {
    expect(billFxOperator(ae0004)).toBe("*");
    expect(billFxOperator(ae0005)).toBe("/");
    expect(billFxOperator({ goodsEntries: [{ op: "/" }] })).toBe("/");
    expect(billFxOperator(null)).toBe("*");
  });

  it("USD × 3.675 and PKR ÷ 77.2 give the totals the bills saved", () => {
    expect(toBaseAmount(230000, 3.675, "*")).toBeCloseTo(845250, 2);
    expect(toBaseAmount(20250000, 77.2, "/")).toBeCloseTo(262305.70, 2);
    // the bug: multiplying the PKR bill by its rate
    expect(20250000 * 77.2).toBe(1563300000);
    expect(effectiveFxRate(77.2, "/")).toBeCloseTo(1 / 77.2, 10);
    expect(effectiveFxRate(0, "*")).toBe(1);
  });

  it("allows a posting that matches the saved total and stops one that does not", () => {
    expect(checkPostingAgainstSaved({ original: 230000, rate: 3.675, op: "*", savedBase: 845250 }).ok).toBe(true);
    expect(checkPostingAgainstSaved({ original: 20250000, rate: 77.2, op: "/", savedBase: 262305.6995 }).ok).toBe(true);
    const wrong = checkPostingAgainstSaved({ original: 20250000, rate: 77.2, op: "*", savedBase: 262305.6995 });
    expect(wrong.ok).toBe(false);
    expect(wrong.computedBase).toBe(1563300000);
    expect(checkPostingAgainstSaved({ original: 100, rate: 3.675, op: "*", savedBase: null }).ok).toBe(true);
  });
});
