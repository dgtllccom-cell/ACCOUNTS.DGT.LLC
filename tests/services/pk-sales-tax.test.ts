import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: vi.fn(), withReadPg: vi.fn() }));
vi.mock("@/lib/user-tasks/service", () => ({ createTask: vi.fn() }));

import { computePkSalesTax, filingDeadline, PK_SALES_TAX_STANDARD_RATE } from "@/lib/services/pk-sales-tax-service";

describe("Pakistan Sales Tax computation (rate sourced from Sales Tax Act 1990, Section 3(1))", () => {
  it("standard rate is 18% (Finance Supplementary Act 2023 amendment, confirmed still current)", () => {
    expect(PK_SALES_TAX_STANDARD_RATE).toBe(0.18);
  });
  it("net payable = output tax - input tax", () => {
    const r = computePkSalesTax({ outputTaxAmount: 180_000, inputTaxAmount: 50_000 });
    expect(r.netPayable).toBe(130_000);
    expect(r.isCredit).toBe(false);
  });
  it("a negative net payable is flagged as a carry-forward credit, not an amount due", () => {
    const r = computePkSalesTax({ outputTaxAmount: 20_000, inputTaxAmount: 80_000 });
    expect(r.netPayable).toBe(-60_000);
    expect(r.isCredit).toBe(true);
  });
  it("never invents output/input tax — both default to 0 if omitted", () => {
    const r = computePkSalesTax({ outputTaxAmount: 0, inputTaxAmount: 0 });
    expect(r.netPayable).toBe(0);
  });
  it("monthly return deadline is the 18th of the month following the period", () => {
    expect(filingDeadline(2026, 1)).toBe("2026-02-18");
    expect(filingDeadline(2026, 12)).toBe("2027-01-18");
  });
});
