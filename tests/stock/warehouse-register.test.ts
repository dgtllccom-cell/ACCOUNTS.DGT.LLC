import { describe, expect, it } from "vitest";
import { branchLabel, groupPurchases, groupRegister, loadTotals, normalizeBalanceRow, normalizeLoadRow, registerTotals } from "@/lib/stock/warehouse-register";

describe("warehouse stock register", () => {
  it("maps a balance row, reading numeric strings as numbers and blank names as a dash", () => {
    const r = normalizeBalanceRow({ warehouse_id: "w1", warehouse_name: " Dubai Main ", goods_id: "g1", goods_name: "", country_name: "UAE", quantity_on_hand: "1250.5", quantity_reserved: "250", quantity_available: "1000.5" });
    expect(r).toEqual({
      warehouseId: "w1", warehouseName: "Dubai Main", goodsId: "g1", goodsName: "—", countryName: "UAE",
      countryBranchId: "", countryBranchName: "—", countryBranchCode: "", cityBranchId: "", cityBranchName: "—", cityBranchCode: "",
      onHand: 1250.5, reserved: 250, available: 1000.5,
    });
  });

  it("branch label shows the main branch then the city branch, each with its code", () => {
    const r = normalizeBalanceRow({
      country_branch_id: "cb1", country_branch_name: "Pakistan Main Branch", country_branch_code: "PK-MB",
      city_branch_id: "ci1", city_branch_name: "Quetta City Branch", city_branch_code: "QTA",
    });
    expect(branchLabel(r)).toBe("Pakistan Main Branch (PK-MB) / Quetta City Branch (QTA)");
    const noCity = normalizeBalanceRow({ country_branch_id: "cb1", country_branch_name: "Pakistan Main Branch", country_branch_code: "PK-MB" });
    expect(branchLabel(noCity)).toBe("Pakistan Main Branch (PK-MB)");
  });

  it("branch label joins the country and city branch names and skips missing ones", () => {
    const both = normalizeBalanceRow({ country_branch_id: "cb1", country_branch_name: "Dubai HQ", city_branch_id: "ci1", city_branch_name: "Deira" });
    const onlyCountry = normalizeBalanceRow({ country_branch_id: "cb1", country_branch_name: "Dubai HQ" });
    const none = normalizeBalanceRow({});
    expect(branchLabel(both)).toBe("Dubai HQ / Deira");
    expect(branchLabel(onlyCountry)).toBe("Dubai HQ");
    expect(branchLabel(none)).toBe("—");
  });

  it("groups the register per goods, per country and per branch, summing quantities", () => {
    const rows = [
      normalizeBalanceRow({ goods_id: "g1", goods_name: "Rice", country_name: "UAE", country_branch_id: "cb1", country_branch_name: "Dubai HQ", quantity_on_hand: 100, quantity_reserved: 10, quantity_available: 90 }),
      normalizeBalanceRow({ goods_id: "g1", goods_name: "Rice", country_name: "Pakistan", country_branch_id: "cb2", country_branch_name: "Quetta", quantity_on_hand: 40, quantity_reserved: 0, quantity_available: 40 }),
      normalizeBalanceRow({ goods_id: "g2", goods_name: "Sugar", country_name: "UAE", country_branch_id: "cb1", country_branch_name: "Dubai HQ", quantity_on_hand: 5, quantity_reserved: 1, quantity_available: 4 }),
    ];
    const byGoods = groupRegister(rows, (r) => r.goodsId, (r) => r.goodsName);
    expect(byGoods.map((g) => [g.label, g.onHand, g.available])).toEqual([["Rice", 140, 130], ["Sugar", 5, 4]]);
    const byCountry = groupRegister(rows, (r) => r.countryName, (r) => r.countryName);
    expect(byCountry.map((g) => [g.label, g.lines, g.onHand])).toEqual([["Pakistan", 1, 40], ["UAE", 2, 105]]);
    const byBranch = groupRegister(rows, (r) => `${r.countryBranchId}|${r.cityBranchId}`, branchLabel);
    expect(byBranch.map((g) => [g.label, g.reserved])).toEqual([["Dubai HQ", 11], ["Quetta", 0]]);
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

  it("maps a loading entry: quantity, weights, transfer type and balance in the lane", () => {
    const e = normalizeLoadRow({
      id: "L1", purchase_ref_no: "PUR-1001", loading_record_no: "PUR-1001-LD1", loading_date: "2026-11-10",
      goods_name: "Walnut Kernel", loaded_quantity: "2000.000", unit: "CARTON", gross_weight: "21000", net_weight: "20000",
      disposition: null, transfer_destination: "warehouse", lane_status: "loaded", lane_stock_qty: "1500.000",
    });
    expect(e).toMatchObject({ purchaseRef: "PUR-1001", loadingNo: "PUR-1001-LD1", loadingDate: "2026-11-10", qty: 2000, unit: "CARTON", gross: 21000, net: 20000, transferType: "warehouse", balance: 1500 });
  });

  it("a loading entry with no lane balance shows its loaded quantity, and a missing reference shows a dash", () => {
    const e = normalizeLoadRow({ id: "L2", loaded_quantity: "500", lane_stock_qty: null, lane_status: "arrived" });
    expect(e.balance).toBe(500);
    expect(e.purchaseRef).toBe("—");
    expect(e.transferType).toBe("arrived");
  });

  it("groups loading entries under their purchase with totals, purchases sorted by reference", () => {
    const entries = [
      normalizeLoadRow({ id: "b", purchase_ref_no: "PUR-1002", goods_name: "Almond", loaded_quantity: 5000, gross_weight: 52500, net_weight: 50000, lane_stock_qty: 1000 }),
      normalizeLoadRow({ id: "a1", purchase_ref_no: "PUR-1001", goods_name: "Walnut", loaded_quantity: 2000, gross_weight: 21000, net_weight: 20000, lane_stock_qty: 2000 }),
      normalizeLoadRow({ id: "a2", purchase_ref_no: "PUR-1001", goods_name: "Walnut", loaded_quantity: 3000, gross_weight: 31500, net_weight: 30000, lane_stock_qty: 0 }),
    ];
    const groups = groupPurchases(entries);
    expect(groups.map((g) => g.purchaseRef)).toEqual(["PUR-1001", "PUR-1002"]);
    expect(groups[0]).toMatchObject({ qty: 5000, gross: 52500, net: 50000, balance: 2000, goodsNames: ["Walnut"] });
    expect(groups[0].entries.map((e) => e.id)).toEqual(["a1", "a2"]);
    expect(groups[1].balance).toBe(1000);
  });

  it("loading totals count distinct purchases, total loaded quantity and stock still in the lanes", () => {
    const entries = [
      normalizeLoadRow({ purchase_ref_no: "PUR-1", loaded_quantity: 100, lane_stock_qty: 40 }),
      normalizeLoadRow({ purchase_ref_no: "PUR-1", loaded_quantity: 50, lane_stock_qty: 50 }),
      normalizeLoadRow({ purchase_ref_no: "PUR-2", loaded_quantity: 10, lane_stock_qty: 0 }),
    ];
    expect(loadTotals(entries)).toEqual({ bills: 2, loaded: 160, inLanes: 90 });
    expect(loadTotals([])).toEqual({ bills: 0, loaded: 0, inLanes: 0 });
  });
});
