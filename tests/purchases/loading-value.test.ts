import { describe, expect, it } from "vitest";
import { contractLines, loadingGoodsValue, loadedGoodsOf } from "@/lib/purchases/loading-value";
import { loadingValues, loadingPaymentStates } from "@/lib/purchases/loaded-payable";
import { buildBillPayment } from "@/lib/services/purchase-loading-payment-service";

/** the two real Production bills, goods lines exactly as saved */
const AE0007_GOODS = [
  { goodsId: "a28a4a20", goodsName: "WALNUT KERNELS", qtyNo: 22500, qtyKgs: 10.1, emptyKgs: 0.1, netWeight: 225000, priceType: "P/KGs", divideType: "D/KGs", divideWeight: 1, coursePrice: 5.15, totalAmount: 1158750 }
];
const AE0005_GOODS = [
  { goodsId: "e84ecef0", goodsName: "Cashew Kernel", qtyNo: 1300, qtyKgs: 20.2, emptyKgs: 0.2, netWeight: 26000, priceType: "P/KGs", divideType: "D/KGs", divideWeight: 20, coursePrice: 148.75, totalAmount: 193375 }
];
const loadingOf = (goodsName: string, qty: number, perKg: number, empty: number, netWeight: number) => ({
  loaded_quantity: qty,
  net_weight: netWeight,
  report_payload: { goodsEntries: [{ goodsName, quantityNo: String(qty), oneQtyKgs: String(perKg), oneEmptyKgs: String(empty) }], loadedQuantity: qty }
});

describe("loadingGoodsValue — quantity, weight and the contract price, not an equal share", () => {
  it("AE-001-0007: one truck of 2,250 cartons, 22,500 kg net × USD 5.15/kg = 115,875", () => {
    const v = loadingGoodsValue(contractLines(AE0007_GOODS), loadingOf("WALNUT KERNELS", 2250, 10.1, 0.1, 22500));
    expect(v).toBe(115875);
  });
  it("AE-001-0005: 1,300 boxes, 26,000 kg net, price 148.75 per 20 kg = 193,375", () => {
    const v = loadingGoodsValue(contractLines(AE0005_GOODS), loadingOf("Cashew Kernel", 1300, 20.2, 0.2, 26000));
    expect(v).toBe(193375);
  });
  it("a heavier truck is worth more: 2,250 cartons weighing 23,400 kg net are NOT the same as 2,250 cartons at 22,500 kg", () => {
    const lines = contractLines(AE0007_GOODS);
    expect(loadingGoodsValue(lines, loadingOf("WALNUT KERNELS", 2250, 10.5, 0.1, 23400))).toBe(120510);
    expect(loadingGoodsValue(lines, loadingOf("WALNUT KERNELS", 2250, 10.1, 0.1, 22500))).toBe(115875);
  });
  it("the loading's weighed net weight wins over quantity × per-carton weight", () => {
    const g = loadedGoodsOf(loadingOf("WALNUT KERNELS", 2250, 10.1, 0.1, 22410));
    expect(g).toEqual([{ goodsId: "", goodsName: "WALNUT KERNELS", qty: 2250, netKg: 22410 }]);
  });
  it("per-unit and per-ton goods are priced by their own basis; unknown pricing falls back to the line's share", () => {
    const perUnit = contractLines([{ goodsName: "BOXES", qtyNo: 100, netWeight: 1000, priceType: "P/Qty", coursePrice: 7, totalAmount: 700 }]);
    expect(loadingGoodsValue(perUnit, { loaded_quantity: 40 })).toBe(280);
    const perTon = contractLines([{ goodsName: "RICE", qtyNo: 100, netWeight: 50000, priceType: "P/Ton", coursePrice: 900, totalAmount: 45000 }]);
    expect(loadingGoodsValue(perTon, { loaded_quantity: 40, net_weight: 20000 })).toBe(18000);
    const none = contractLines([{ goodsName: "MIX", qtyNo: 10, netWeight: 100, priceType: "", coursePrice: 0, totalAmount: 5000 }]);
    expect(loadingGoodsValue(none, { loaded_quantity: 4 })).toBe(2000);
  });
  it("a bill with two goods at different prices: each truck is valued from the goods it carries", () => {
    const lines = contractLines([
      { goodsId: "G1", goodsName: "ALMONDS", qtyNo: 100, netWeight: 1000, priceType: "P/KGs", divideWeight: 1, coursePrice: 10, totalAmount: 10000 },
      { goodsId: "G2", goodsName: "RAISINS", qtyNo: 100, netWeight: 1000, priceType: "P/KGs", divideWeight: 1, coursePrice: 2, totalAmount: 2000 }
    ]);
    const truck1 = { loaded_quantity: 50, net_weight: 500, report_payload: { goodsEntries: [{ goodsId: "G1", goodsName: "ALMONDS", quantityNo: 50, oneQtyKgs: 10, oneEmptyKgs: 0 }], loadedQuantity: 50 } };
    const truck2 = { loaded_quantity: 50, net_weight: 500, report_payload: { goodsEntries: [{ goodsId: "G2", goodsName: "RAISINS", quantityNo: 50, oneQtyKgs: 10, oneEmptyKgs: 0 }], loadedQuantity: 50 } };
    expect(loadingGoodsValue(lines, truck1)).toBe(5000);
    expect(loadingGoodsValue(lines, truck2)).toBe(1000); // same quantity and weight, one sixth of the price - never an equal split
  });
  it("cannot be matched → null (the caller then uses the quantity share)", () => {
    const lines = contractLines([{ goodsName: "A", qtyNo: 1, priceType: "P/KGs", coursePrice: 1, totalAmount: 1 }, { goodsName: "B", qtyNo: 1, priceType: "P/KGs", coursePrice: 1, totalAmount: 1 }]);
    expect(loadingGoodsValue(lines, { loaded_quantity: 1, net_weight: 1 })).toBeNull();
    expect(loadingGoodsValue([], { loaded_quantity: 1 })).toBeNull();
  });
});

describe("loadingValues — the parts add up to the bill", () => {
  it("a fully loaded bill: the last loading takes whatever is left, so the values sum to the bill total exactly", () => {
    const v = loadingValues(1000, 100, [{ id: "a", quantity: 30, reportedValueFC: 300.4 }, { id: "b", quantity: 70, reportedValueFC: 699.2 }]);
    expect(v[0] + v[1]).toBe(1000);
    expect(v[0]).toBe(300.4);
  });
  it("loadings can never add up to more than the bill", () => {
    const v = loadingValues(1000, 100, [{ id: "a", quantity: 60, reportedValueFC: 800 }, { id: "b", quantity: 30, reportedValueFC: 700 }]);
    expect(v[0] + v[1]).toBe(1000);
  });
});

/** the real Production figures: AE-001-0007 (USD 1,158,750, 10 % advance fully paid = 115,875, one truck of ten loaded) and AE-001-0005 */
const po = (extra: Record<string, unknown>) => ({
  currency_code: "USD", purchase_currency: "USD", exchange_rate: 3.67, base_currency: "AED", credit_amount: 0, remaining_paid: 0,
  ...extra
});

describe("real Production bills — what is payable in Remaining Payment", () => {
  it("AE-001-0007: only the loaded truck is payable = loaded value 115,875 − its allocated advance 11,587.50 = 104,287.50", () => {
    const bill = buildBillPayment(
      po({
        order_total: 4252612.5, total_goods_original: 1158750, advance_paid: 115875, remaining_due: 1042875,
        form_data: { form: { paymentType: "Advance Payment", advancePercent: 10 }, goodsEntries: AE0007_GOODS, totals: { totalQuantity: 22500 }, workflow: { totalQuantity: 22500 } }
      }) as any,
      [{ id: "L1", created_at: "2026-10-31T08:49:23Z", ...loadingOf("WALNUT KERNELS", 2250, 10.1, 0.1, 22500) }],
      []
    );
    const st = bill.byLoading.get("L1")!;
    expect(bill.advanceRequired).toBe(115875);
    expect(bill.loadedQuantity).toBe(2250);
    expect(bill.balanceQuantity).toBe(20250);
    expect(st.valueFC).toBe(115875);
    expect(st.advanceAllocFC).toBe(11587.5);
    expect(st.outstandingFC).toBe(104287.5);
    expect(st.complete).toBe(false);
  });
  it("AE-001-0007: the next trucks are released as they are loaded, each from its own goods (a heavier truck owes more)", () => {
    const bill = buildBillPayment(
      po({
        order_total: 4252612.5, total_goods_original: 1158750, advance_paid: 115875, remaining_due: 1042875,
        form_data: { form: { paymentType: "Advance Payment", advancePercent: 10 }, goodsEntries: AE0007_GOODS, totals: { totalQuantity: 22500 }, workflow: { totalQuantity: 22500 } }
      }) as any,
      [
        { id: "L1", created_at: "2026-10-31T08:49:23Z", ...loadingOf("WALNUT KERNELS", 2250, 10.1, 0.1, 22500) },
        { id: "L2", created_at: "2026-11-01T08:00:00Z", ...loadingOf("WALNUT KERNELS", 2250, 10.5, 0.1, 23400) }
      ],
      []
    );
    const [a, b] = [bill.byLoading.get("L1")!, bill.byLoading.get("L2")!];
    expect(b.valueFC).toBe(120510);
    expect(b.advanceAllocFC).toBeCloseTo(115875 * (120510 / 1158750), 4);
    expect(b.outstandingFC).toBeCloseTo(120510 - 115875 * (120510 / 1158750), 4);
    expect(a.outstandingFC).toBe(104287.5); // the first truck's figure does not move
    expect(bill.loadedQuantity).toBe(4500);
    expect(bill.balanceQuantity).toBe(18000);
  });
  it("AE-001-0005: one truck, fully loaded → the whole outstanding balance is payable (193,375 − 19,618 advance paid = 173,757)", () => {
    const bill = buildBillPayment(
      po({
        order_total: 709686.25, total_goods_original: 193375, advance_paid: 19618, remaining_due: 173757,
        form_data: { form: { paymentType: "Advance Payment", advancePercent: 10 }, goodsEntries: AE0005_GOODS, totals: { totalQuantity: 1300 }, workflow: { totalQuantity: 1300 } }
      }) as any,
      [{ id: "L1", created_at: "2026-10-28T15:22:08Z", ...loadingOf("Cashew Kernel", 1300, 20.2, 0.2, 26000) }],
      []
    );
    const st = bill.byLoading.get("L1")!;
    expect(st.valueFC).toBe(193375);
    expect(st.advanceAllocFC).toBe(19618);
    expect(st.outstandingFC).toBe(173757);
    expect(bill.outstanding).toBe(173757);
    expect(bill.balanceQuantity).toBe(0);
  });
  it("a fully loaded bill whose weighed total differs from the contract still settles to the bill total", () => {
    const states = loadingPaymentStates({
      orderTotalFC: 1000, advancePaidFC: 100, totalQuantity: 100,
      loadings: [{ id: "a", quantity: 60, reportedValueFC: 590 }, { id: "b", quantity: 40, reportedValueFC: 405 }],
      remainingPayments: []
    });
    expect(states[0].valueFC + states[1].valueFC).toBe(1000);
    expect(states[0].outstandingFC + states[1].outstandingFC).toBe(900);
  });
});
