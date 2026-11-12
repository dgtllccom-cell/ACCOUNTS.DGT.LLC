import { describe, expect, it } from "vitest";
import { normalizeBalanceRow, registerTotals } from "@/lib/stock/warehouse-register";

describe("warehouse stock register", () => {
  it("maps a balance row, reading numeric strings as numbers and blank names as a dash", () => {
    const r = normalizeBalanceRow({ warehouse_id: "w1", warehouse_name: " Dubai Main ", goods_id: "g1", goods_name: "", country_name: "UAE", quantity_on_hand: "1250.5", quantity_reserved: "250", quantity_available: "1000.5" });
    expect(r).toEqual({ warehouseId: "w1", warehouseName: "Dubai Main", goodsId: "g1", goodsName: "—", countryName: "UAE", onHand: 1250.5, reserved: 250, available: 1000.5 });
  });

  it("missing numbers become zero, never NaN", () => {
    const r = normalizeBalanceRow({});
    expect(r.onHand).toBe(0);
    expect(r.available).toBe(0);
    expect(Number.isNaN(r.reserved)).toBe(false);
  });

  it("totals add lines, on hand, reserved and available", () => {
    const rows = [
      normalizeBalanceRow({ quantity_on_hand: 100, quantity_reserved: 20, quantity_available: 80 }),
      normalizeBalanceRow({ quantity_on_hand: 50, quantity_reserved: 0, quantity_available: 50 }),
    ];
    expect(registerTotals(rows)).toEqual({ lines: 2, onHand: 150, reserved: 20, available: 130 });
  });

  it("an empty register totals to zero", () => {
    expect(registerTotals([])).toEqual({ lines: 0, onHand: 0, reserved: 0, available: 0 });
  });
});
