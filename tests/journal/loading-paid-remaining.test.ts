import { describe, expect, it } from "vitest";
import { loadingOutstanding, loadingPaidTotal } from "@/lib/journal/loading-paid-remaining";

describe("purchase-booking loading paid and outstanding", () => {
  it("AE-001-0004: the advance share counts as paid, so the balance is the server's 91,750.15 not the full 116,250", () => {
    const paid = loadingPaidTotal(24499.85, 0);
    expect(paid).toBeCloseTo(24499.85, 2);
    expect(loadingOutstanding(116250, paid, 91750.15)).toBeCloseTo(91750.15, 2);
  });

  it("falls back to value minus paid when the server outstanding is absent", () => {
    expect(loadingOutstanding(116250, loadingPaidTotal(24499.85, 0), null)).toBeCloseTo(91750.15, 2);
  });

  it("AE-001-0007 loading: advance plus remaining payments settle the loading to zero", () => {
    const paid = loadingPaidTotal(11587.5, 104287.5);
    expect(paid).toBeCloseTo(115875, 2);
    expect(loadingOutstanding(115875, paid, 0)).toBe(0);
  });

  it("never returns a negative balance or a negative paid total", () => {
    expect(loadingPaidTotal(-5, -10)).toBe(0);
    expect(loadingOutstanding(100, 150, undefined)).toBe(0);
    expect(loadingOutstanding(100, 0, -20)).toBe(0);
  });
});
