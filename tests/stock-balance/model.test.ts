import { describe, expect, it } from "vitest";
import {
  entryLabel, goodsWise, maxTreatable, mergeUnitTotals, proportional, remainingOf, statusOf, topUnit, totalsOf, treatmentFigures, treatmentSplit, zero,
  type BalanceEntry, type Weighted,
} from "@/lib/stock-balance/model";

const w = (qty: number, gross = 0, net = 0): Weighted => ({ qty, gross, net });
const entry = (o: Partial<BalanceEntry> & { lotNo: string; goodsName: string; unit?: string }): BalanceEntry => ({
  entryId: `e-${o.lotNo}-${o.goodsName}`, entryNo: 1, lotEntryLabel: "", goodsId: null, brand: "", size: "", origin: "", unit: o.unit ?? "Bags", purchased: w(0), sold: zero(), transferred: zero(), adjusted: zero(),
  reservedQty: 0, inTransitQty: 0, remaining: w(0), unitPrice: null, amount: null, currency: "USD", warehouseId: null, warehouseName: null, loadingRecordId: null, lotRef: null, status: "available",
  treatment: { received: 0, treated: 0, loss: 0, pending: 0 }, ...o,
});

describe("lot weights are linear per unit", () => {
  it("splits a lot weight by the quantity share", () => {
    expect(proportional(2500, 40, 50)).toBe(2000);
    expect(proportional(2300, 40, 50)).toBe(1840);
  });
  it("never divides by zero", () => {
    expect(proportional(100, 5, 0)).toBe(0);
  });
});

describe("Remaining = Purchased − Sold − Transferred − Adjusted", () => {
  it("matches the design example (White Beans 100 − 80 = 20)", () => {
    expect(remainingOf(w(100, 5000, 4500), w(80, 4000, 3600), zero(), zero())).toEqual(w(20, 1000, 900));
  });
  it("subtracts a branch transfer and a damage / treatment-loss adjustment too", () => {
    expect(remainingOf(w(100), w(60), w(10), w(5)).qty).toBe(25);
  });
  it("can show an over-sale as negative (never hidden)", () => {
    expect(remainingOf(w(10), w(12), zero(), zero()).qty).toBe(-2);
  });
});

describe("stock status", () => {
  const base = { purchased: w(10), lotNo: "L1" } as const;
  it("sold out / available / in transit / not loaded / over sold", () => {
    expect(statusOf({ ...base, remaining: w(0), inTransitQty: 0 }, false)).toBe("sold_out");
    expect(statusOf({ ...base, remaining: w(4), inTransitQty: 0 }, false)).toBe("available");
    expect(statusOf({ ...base, remaining: w(4), inTransitQty: 4 }, false)).toBe("in_transit");
    expect(statusOf({ ...base, remaining: w(4), inTransitQty: 1 }, false)).toBe("available");
    expect(statusOf({ ...base, remaining: w(4), inTransitQty: 0 }, true)).toBe("not_loaded");
    expect(statusOf({ ...base, remaining: w(-1), inTransitQty: 0 }, false)).toBe("over_sold");
  });
});

describe("bill totals and goods-wise summary (the design's example)", () => {
  const entries = [
    entry({ lotNo: "LOT-001", goodsName: "White Beans", purchased: w(50, 2500, 2300), sold: w(40, 2000, 1850), remaining: w(10, 500, 450) }),
    entry({ lotNo: "LOT-001", goodsName: "White Beans", purchased: w(50, 2400, 2200), sold: w(40, 1900, 1750), remaining: w(10, 500, 450) }),
    entry({ lotNo: "LOT-002", goodsName: "Chickpeas", purchased: w(60, 3000, 2800), sold: w(50, 2400, 2200), remaining: w(10, 600, 600) }),
    entry({ lotNo: "LOT-002", goodsName: "Chickpeas", purchased: w(60, 2900, 2700), sold: w(40, 2000, 1850), remaining: w(20, 900, 850) }),
  ];
  it("counts lots and entries and adds weights", () => {
    const t = totalsOf(entries);
    expect(t.lots).toBe(2);
    expect(t.entries).toBe(4);
    expect(t.purchased.qty).toBe(220);
    expect(t.sold.qty).toBe(170);
    expect(t.remaining.qty).toBe(50);
    expect(t.purchased.qty - t.sold.qty).toBe(t.remaining.qty);
  });
  it("goods-wise rows add up to the grand total", () => {
    const g = goodsWise(entries);
    expect(g.map((r) => [r.goodsName, r.purchased, r.sold, r.remaining])).toEqual([["Chickpeas", 120, 90, 30], ["White Beans", 100, 80, 20]]);
    expect(g.reduce((s, r) => s + r.remaining, 0)).toBe(50);
  });
  it("never adds different units together", () => {
    const mixed = totalsOf([entry({ lotNo: "A", goodsName: "x", unit: "Bags", purchased: w(10), remaining: w(10) }), entry({ lotNo: "B", goodsName: "y", unit: "Cartons", purchased: w(5), remaining: w(5) })]);
    expect(Object.keys(mixed.byUnit.purchased).sort()).toEqual(["Bags", "Cartons"]);
    const t = topUnit(mergeUnitTotals([mixed.byUnit.purchased]));
    expect(t.unit).toBe("Bags");
    expect(t.more).toBe(1);
  });
});

describe("treatment register arithmetic — information only", () => {
  it("pending = received − treated − loss; final = received − loss", () => {
    expect(treatmentFigures({ qty_received: 100, qty_treated: 60, qty_loss: 5, status: "in_progress" })).toMatchObject({ pending: 35, finalQty: 95, received: 100, treated: 60, loss: 5 });
  });
  it("a cancelled treatment counts for nothing", () => {
    expect(treatmentFigures({ qty_received: 100, qty_treated: 60, qty_loss: 5, status: "cancelled" })).toMatchObject({ pending: 0, received: 0, treated: 0, loss: 0, finalQty: 0 });
  });
  it("untreated stock never goes negative and treated goods are not added to stock", () => {
    const s = treatmentSplit(30, [{ received: 20, treated: 15, loss: 1, pending: 4 }, { received: 10, treated: 10, loss: 0, pending: 0 }]);
    expect(s).toMatchObject({ received: 30, treated: 25, pending: 4, loss: 1 });
    expect(s.untreated).toBe(1);
    expect(treatmentSplit(5, [{ received: 20, treated: 15, loss: 0, pending: 5 }]).untreated).toBe(0);
  });
  it("cannot send for treatment more than what is on hand and not already away", () => {
    expect(maxTreatable(30, 12)).toBe(18);
    expect(maxTreatable(10, 25)).toBe(0);
  });
});

describe("labels", () => {
  it("lot & entry label", () => expect(entryLabel("LOT-001", 2)).toBe("LOT-001 / Entry 2"));
});

import { normalizeUnit } from "@/lib/stock-balance/model";
describe("normalizeUnit", () => {
  it("merges case variants into one unit", () => {
    expect(normalizeUnit("BAGS")).toBe("Bags");
    expect(normalizeUnit("bags")).toBe("Bags");
    expect(normalizeUnit(" Bags ")).toBe("Bags");
    expect(normalizeUnit("pcs")).toBe("PCS");
    expect(normalizeUnit("MT")).toBe("MT");
    expect(normalizeUnit(null)).toBe("");
  });
});
