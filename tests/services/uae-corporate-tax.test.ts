import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: vi.fn(), withReadPg: vi.fn() }));
vi.mock("@/lib/user-tasks/service", () => ({ createTask: vi.fn() }));

import { computeCt, filingDeadline } from "@/lib/services/uae-corporate-tax-service";

const base = { adjustments: [], smallBusinessRelief: false, revenue: null, qualifyingFreeZone: false, qualifyingIncome: 0, lossesBroughtForward: 0 };

describe("UAE Corporate Tax computation", () => {
  it("0% up to AED 375,000 and 9% above", () => {
    expect(computeCt({ ...base, accountingProfit: 375_000 }).taxPayable).toBe(0);
    expect(computeCt({ ...base, accountingProfit: 1_000_000 }).taxPayable).toBe(56_250);
  });
  it("applies add-backs, deductions and exempt income", () => {
    const r = computeCt({ ...base, accountingProfit: 900_000, adjustments: [
      { category: "add_back", amount: 50_000 }, { category: "deduction", amount: 20_000 }, { category: "exempt_income", amount: 30_000 },
    ] });
    expect(r.adjusted).toBe(900_000);
    expect(r.taxableIncome).toBe(900_000);
    expect(r.taxPayable).toBe(47_250);
  });
  it("caps loss relief at 75% of taxable income", () => {
    const r = computeCt({ ...base, accountingProfit: 1_000_000, lossesBroughtForward: 2_000_000 });
    expect(r.lossReliefUsed).toBe(750_000);
    expect(r.taxableIncome).toBe(250_000);
    expect(r.taxPayable).toBe(0);
    expect(r.lossCarriedForward).toBe(1_250_000);
  });
  it("Small Business Relief: nil when revenue ≤ AED 3m, refused above", () => {
    expect(computeCt({ ...base, accountingProfit: 800_000, smallBusinessRelief: true, revenue: 2_900_000 }).taxPayable).toBe(0);
    expect(() => computeCt({ ...base, accountingProfit: 800_000, smallBusinessRelief: true, revenue: 3_100_000 })).toThrow();
    expect(() => computeCt({ ...base, accountingProfit: 800_000, smallBusinessRelief: true, revenue: null })).toThrow();
  });
  it("Qualifying Free Zone Person: 0% on qualifying income, 9% on the rest without threshold", () => {
    const r = computeCt({ ...base, accountingProfit: 1_000_000, qualifyingFreeZone: true, qualifyingIncome: 800_000 });
    expect(r.taxableIncome).toBe(200_000);
    expect(r.taxPayable).toBe(18_000);
  });
  it("a loss year pays nothing and carries the loss forward", () => {
    const r = computeCt({ ...base, accountingProfit: -120_000, lossesBroughtForward: 10_000 });
    expect(r.taxPayable).toBe(0);
    expect(r.lossCarriedForward).toBe(130_000);
  });
  it("deadline = 9 months after the financial year end", () => {
    expect(filingDeadline("2025-12-31")).toBe("2026-09-30");
    expect(filingDeadline("2025-06-30")).toBe("2026-03-30");
    expect(filingDeadline("2025-03-31")).toBe("2025-12-31");
  });
});
