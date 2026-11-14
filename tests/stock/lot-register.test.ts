import { describe, expect, it } from "vitest";
import { buildLotRows, lotTotals, reconcileLots, type LotFlow, type LotMeta, type LotState } from "@/lib/stock/lot-register";

function meta(o: Partial<LotMeta> & Pick<LotMeta, "lotKey">): LotMeta {
  return {
    source: "local_lot", goodsId: "g1", goodsName: "Walnut Kernels", brand: "Premium", size: "Large", origin: "CHN",
    lotName: "LOT-WK-01", lotNo: "LOT-2611-000001", billNo: "QA-CNS-129025", billId: "b1", purchased: 7500, grossPerUnit: null, netPerUnit: null, unit: "CARTON", ...o,
  };
}

function flow(o: Partial<LotFlow> & Pick<LotFlow, "id" | "kind" | "qty" | "date">): LotFlow {
  return { source: "local_lot", lotKey: "L1", warehouseId: "w1", refNo: "GT-1", note: "", ...o };
}

const walnutReceipts: LotFlow[] = [
  flow({ id: "lm1", kind: "received", qty: 1500, date: "2026-11-10", refNo: "Entry 01 / LD-00018" }),
  flow({ id: "lm2", kind: "received", qty: 2000, date: "2026-11-12", refNo: "Entry 02 / LD-00021" }),
  flow({ id: "lm3", kind: "received", qty: 1500, date: "2026-11-14", refNo: "Entry 03 / LD-00024" }),
];

describe("lot register: one row per lot and warehouse", () => {
  it("accumulates every receipt of the lot and deducts the sale: 1,500 + 2,000 + 1,500 − 1,500 = 3,500", () => {
    const rows = buildLotRows(
      [...walnutReceipts, flow({ id: "lm4", kind: "sold", qty: 1500, date: "2026-11-13", refNo: "SI-00126" })],
      [meta({ lotKey: "L1" })],
      [{ lotKey: "L1", warehouseId: "w1", byState: 3500 }]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ firstReceiptDate: "2026-11-10", received: 5000, sold: 1500, available: 3500, check: 0, negative: false, lotName: "LOT-WK-01" });
    expect(rows[0].flows.map((f) => f.id)).toEqual(["lm1", "lm2", "lm4", "lm3"]);
  });

  it("counts a flow once even when it is listed twice, and ignores zero quantities", () => {
    const rows = buildLotRows(
      [...walnutReceipts, walnutReceipts[0], flow({ id: "z", kind: "received", qty: 0, date: "2026-11-10" })],
      [meta({ lotKey: "L1" })]
    );
    expect(rows[0]).toMatchObject({ received: 5000, available: 5000 });
    expect(rows[0].flows).toHaveLength(3);
  });

  it("keeps the same lot in two warehouses as two rows", () => {
    const rows = buildLotRows(
      [flow({ id: "a", kind: "received", qty: 100, date: "2026-11-10" }), flow({ id: "b", kind: "received", qty: 40, date: "2026-11-11", warehouseId: "w2" })],
      [meta({ lotKey: "L1" })]
    );
    expect(rows.map((r) => [r.warehouseId, r.available])).toEqual([["w1", 100], ["w2", 40]]);
  });

  it("works out transfers, exports and sales; a transfer in adds stock, a transfer out and an export take it away", () => {
    const rows = buildLotRows(
      [
        flow({ id: "r", kind: "received", qty: 1000, date: "2026-11-01" }),
        flow({ id: "o", kind: "transfer_out", qty: 200, date: "2026-11-02" }),
        flow({ id: "e", kind: "exported", qty: 100, date: "2026-11-03" }),
        flow({ id: "s", kind: "sold", qty: 300, date: "2026-11-04" }),
        flow({ id: "i", kind: "transfer_in", qty: 50, date: "2026-11-05" }),
      ],
      [meta({ lotKey: "L1" })]
    );
    expect(rows[0]).toMatchObject({ received: 1000, transferredIn: 50, transferredOut: 200, exported: 100, sold: 300, available: 450 });
  });

  it("flags a lot whose sales exceed what was received, instead of hiding it", () => {
    const rows = buildLotRows([flow({ id: "r", kind: "received", qty: 100, date: "2026-11-01" }), flow({ id: "s", kind: "sold", qty: 150, date: "2026-11-02" })], [meta({ lotKey: "L1" })]);
    expect(rows[0]).toMatchObject({ available: -50, negative: true });
  });

  it("shows a check difference when the lot record disagrees with the flows", () => {
    const states: LotState[] = [{ lotKey: "L1", warehouseId: "w1", byState: 4900 }];
    const rows = buildLotRows(walnutReceipts, [meta({ lotKey: "L1" })], states);
    expect(rows[0]).toMatchObject({ available: 5000, byState: 4900, check: 100 });
  });

  it("adds up several stock records of one lot in one warehouse before comparing with the lot record", () => {
    const states: LotState[] = [
      { lotKey: "L1", warehouseId: "w1", byState: 7 },
      { lotKey: "L1", warehouseId: "w1", byState: 20 },
    ];
    const rows = buildLotRows(
      [flow({ id: "a", kind: "received", qty: 7, date: "2026-10-09" }), flow({ id: "b", kind: "received", qty: 10, date: "2026-10-09" }), flow({ id: "c", kind: "received", qty: 10, date: "2026-10-09" })],
      [meta({ lotKey: "L1" })],
      states
    );
    expect(rows[0]).toMatchObject({ available: 27, byState: 27, check: 0 });
  });

  it("gives the remaining weight at the lot's weight per unit, and no weight when it was never recorded", () => {
    const withWeight = buildLotRows([flow({ id: "r", kind: "received", qty: 2000, date: "2026-11-01" }), flow({ id: "s", kind: "sold", qty: 500, date: "2026-11-02" })], [meta({ lotKey: "L1", grossPerUnit: 10.5, netPerUnit: 10 })]);
    expect(withWeight[0]).toMatchObject({ available: 1500, gross: 15750, net: 15000 });
    const noWeight = buildLotRows([flow({ id: "r", kind: "received", qty: 2000, date: "2026-11-01" })], [meta({ lotKey: "L1" })]);
    expect(noWeight[0].gross).toBeNull();
    expect(noWeight[0].net).toBeNull();
  });

  it("never invents a lot name: an unrecorded lot keeps lotName and lotNo empty", () => {
    const rows = buildLotRows(
      [flow({ id: "m1", kind: "received", qty: 30, date: "2026-10-09", source: "unrecorded", lotKey: "U1" })],
      [meta({ lotKey: "U1", source: "unrecorded", lotName: null, lotNo: null, billNo: "MAIN-000001", billId: "" })]
    );
    expect(rows[0]).toMatchObject({ source: "unrecorded", lotName: null, lotNo: null, billNo: "MAIN-000001", available: 30 });
  });

  it("several lots and loadings under the same bill each keep their own row", () => {
    const rows = buildLotRows(
      [flow({ id: "a", kind: "received", qty: 100, date: "2026-11-01", lotKey: "L1" }), flow({ id: "b", kind: "received", qty: 40, date: "2026-11-02", lotKey: "L2" })],
      [meta({ lotKey: "L1", lotName: "E2E-A" }), meta({ lotKey: "L2", lotName: "E2E-B", goodsName: "Walnut" })]
    );
    expect(rows.map((r) => [r.billNo, r.lotName, r.available])).toEqual([
      ["QA-CNS-129025", "E2E-A", 100],
      ["QA-CNS-129025", "E2E-B", 40],
    ]);
  });
});

describe("lot register: reconciliation and totals", () => {
  it("reconciles lot totals with the warehouse balance and shows any difference", () => {
    const rows = buildLotRows(walnutReceipts, [meta({ lotKey: "L1" })]);
    expect(reconcileLots(rows, [{ goodsId: "g1", warehouseId: "w1", onHand: 5000 }])).toEqual([
      { goodsId: "g1", warehouseId: "w1", balanceOnHand: 5000, lotsAvailable: 5000, difference: 0 },
    ]);
    expect(reconcileLots(rows, [{ goodsId: "g1", warehouseId: "w1", onHand: 4600 }])[0].difference).toBe(-400);
    expect(reconcileLots([], [{ goodsId: "g2", warehouseId: "w1", onHand: 120 }])).toEqual([
      { goodsId: "g2", warehouseId: "w1", balanceOnHand: 120, lotsAvailable: 0, difference: 120 },
    ]);
  });

  it("totals the cards: active lots, received, sold and available", () => {
    const rows = buildLotRows(
      [...walnutReceipts, flow({ id: "s1", kind: "sold", qty: 1500, date: "2026-11-13" }), flow({ id: "p", kind: "received", qty: 400, date: "2026-11-11", lotKey: "L2" })],
      [meta({ lotKey: "L1" }), meta({ lotKey: "L2", lotName: "LOT-PI-03" })]
    );
    expect(lotTotals(rows)).toEqual({ activeLots: 2, received: 5400, sold: 1500, available: 3900 });
  });
});
