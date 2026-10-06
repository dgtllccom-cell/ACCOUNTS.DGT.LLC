import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: vi.fn(), withReadPg: vi.fn() }));
vi.mock("@/lib/user-tasks/service", () => ({ createTask: vi.fn() }));

import { computePkIncomeTax, rateForCompanyType, filingDeadline, PK_CT_RATE_SMALL, PK_CT_RATE_OTHER } from "@/lib/services/pk-income-tax-service";

describe("Pakistan Income Tax computation (rates sourced from Income Tax Ordinance 2001, First Schedule Part I)", () => {
  it("applies 29% for an ordinary company (First Schedule Division II, tax year 2019 onward)", () => {
    const r = computePkIncomeTax({ taxableIncome: 1_000_000, companyType: "other", taxYear: 2026, turnover: null, superTaxAmount: 0 });
    expect(r.rate).toBe(PK_CT_RATE_OTHER);
    expect(r.normalTax).toBe(290_000);
    expect(r.taxPayable).toBe(290_000);
  });
  it("applies 20% for a small company", () => {
    const r = computePkIncomeTax({ taxableIncome: 1_000_000, companyType: "small", taxYear: 2026, turnover: null, superTaxAmount: 0 });
    expect(r.rate).toBe(PK_CT_RATE_SMALL);
    expect(r.normalTax).toBe(200_000);
  });
  it("applies the correct banking-company rate per tax year (44% TY2025, 43% TY2026, 42% TY2027+)", () => {
    expect(rateForCompanyType("banking", 2025)).toBe(0.44);
    expect(rateForCompanyType("banking", 2026)).toBe(0.43);
    expect(rateForCompanyType("banking", 2027)).toBe(0.42);
    expect(rateForCompanyType("banking", 2030)).toBe(0.42);
  });
  it("applies the minimum tax (1.25% of turnover) when it exceeds the normal tax", () => {
    // taxable income low, but turnover high enough that 1.25% of turnover > 29% of taxable income
    const r = computePkIncomeTax({ taxableIncome: 100_000, companyType: "other", taxYear: 2026, turnover: 50_000_000, superTaxAmount: 0 });
    expect(r.normalTax).toBe(29_000);
    expect(r.minimumTax).toBe(625_000);
    expect(r.baseTax).toBe(625_000);
    expect(r.taxPayable).toBe(625_000);
  });
  it("uses the normal tax when it exceeds the minimum tax", () => {
    const r = computePkIncomeTax({ taxableIncome: 5_000_000, companyType: "other", taxYear: 2026, turnover: 1_000_000, superTaxAmount: 0 });
    expect(r.normalTax).toBe(1_450_000);
    expect(r.minimumTax).toBe(12_500);
    expect(r.baseTax).toBe(1_450_000);
  });
  it("adds a manually entered super tax amount on top of the base tax — never auto-computed", () => {
    const r = computePkIncomeTax({ taxableIncome: 1_000_000, companyType: "other", taxYear: 2026, turnover: null, superTaxAmount: 40_000 });
    expect(r.superTaxAmount).toBe(40_000);
    expect(r.taxPayable).toBe(330_000);
  });
  it("negative super tax input is floored at zero, never subtracted", () => {
    const r = computePkIncomeTax({ taxableIncome: 1_000_000, companyType: "other", taxYear: 2026, turnover: null, superTaxAmount: -500 });
    expect(r.superTaxAmount).toBe(0);
    expect(r.taxPayable).toBe(290_000);
  });
  it("zero/negative taxable income produces zero normal tax, not a negative figure", () => {
    expect(computePkIncomeTax({ taxableIncome: -50_000, companyType: "other", taxYear: 2026, turnover: null, superTaxAmount: 0 }).normalTax).toBe(0);
  });
  it("standard annual filing deadline is 30 September of the tax year", () => {
    expect(filingDeadline(2026)).toBe("2026-09-30");
  });
});
