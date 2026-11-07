import { describe, expect, it } from "vitest";
import { loadingWeightProfile, loadingWeights } from "@/lib/purchases/loading-weights";
const goods = [{ goodsName: "Walnuts", qtyNo: 1000, qtyName: "CARTON", grossWeight: 10100, netWeight: 10000 }];
describe("Loading weights from the selected saved bill line", () => {
  it("calculates only the loaded share and refreshes as quantity changes", () => {
    const p = loadingWeightProfile(goods, {}, "Walnuts");
    expect(loadingWeights(100, p)).toEqual({ gross: 1010, net: 1000, tare: 10 });
    expect(loadingWeights(200, p)).toEqual({ gross: 2020, net: 2000, tare: 20 });
    expect(loadingWeights(1000, p)).toEqual({ gross: 10100, net: 10000, tare: 100 });
  });
  it("reuses per-unit gross/empty calculation, preserving explicit zero packing", () => {
    const p = loadingWeightProfile([{ goodsName: "Bags", qtyKgs: 25, emptyKgs: 0 }], {}, "Bags");
    expect(loadingWeights(100, p)).toEqual({ gross: 2500, net: 2500, tare: 0 });
    expect(loadingWeights(100, p, "25", "0.2")).toEqual({ gross: 2500, net: 2480, tare: 20 });
  });
  it("keeps goods lines and units separate rather than using whole-contract weights", () => {
    const mixed = [...goods, { goodsName: "Almonds", qtyNo: 50, qtyName: "BAG", grossWeight: 1250, netWeight: 1240 }];
    expect(loadingWeights(10, loadingWeightProfile(mixed, { grossWeight: 99999 }, "Almonds"))).toEqual({ gross: 250, net: 248, tare: 2 });
    expect(loadingWeights(10, loadingWeightProfile(mixed, {}, "Missing"))).toEqual({ gross: null, net: null, tare: null });
    expect(loadingWeightProfile([...goods, ...goods], {}, "Walnuts").grossPerUnit).toBeNull();
  });
  it("does not invent net weight or assume missing tare is zero", () => {
    const p = loadingWeightProfile([{ goodsName: "Unknown", qtyKgs: 25 }], {}, "Unknown");
    expect(loadingWeights(10, p)).toEqual({ gross: 250, net: null, tare: null });
    expect(loadingWeights("", p)).toEqual({ gross: null, net: null, tare: null });
    expect(loadingWeights(-10, p)).toEqual({ gross: null, net: null, tare: null });
  });
  it("uses flat legacy bill fields when there is no goods array and rejects impossible tare", () => {
    const p = loadingWeightProfile([], { qtyNo: 100, grossWeight: 1000, netWeight: 990 }, "Legacy");
    expect(loadingWeights(12.5, p)).toEqual({ gross: 125, net: 123.75, tare: 1.25 });
    expect(loadingWeights(10, p, 1, 2).net).toBeNull();
  });
});
