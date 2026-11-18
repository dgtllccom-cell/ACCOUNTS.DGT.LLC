import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lotWeight } from "@/lib/services/stock-journal-service";

describe("Stock Journal shows only real data", () => {
  it("a lot's weight is its own recorded weight, shared by quantity (LP-JRN-00000001: 2,100 boxes, 21,525 / 21,000 kg)", () => {
    expect(lotWeight(21525, 2100, 2100)).toBe(21525);
    expect(lotWeight(21000, 700, 2100)).toBe(7000);
    // no recorded weight -> no invented weight (never the package count)
    expect(lotWeight(0, 2100, 2100)).toBeNull();
    expect(lotWeight(null, 2100, 2100)).toBeNull();
  });

  it("the Purchase General Stock screen carries no hard-coded sample bills, entries or totals", () => {
    const src = readFileSync("features/journal/components/journal-booking-stock-dashboard.tsx", "utf8");
    // values from a design mock-up that appeared on the live screen as if they were stock (18 Nov)
    for (const sample of ["CNU1234567", "BL789001", "AE-001-0007", "Dulin Sunshine", "INV-8567", "INV-8867", "IRN (Tehran)", "PAK (Karachi)", "Last Login: 01 Nov", "14290", "24,800", "227,250", "17,200", "44,000", "01-24-2M"]) {
      expect(src, sample).not.toContain(sample);
    }
  });
});
