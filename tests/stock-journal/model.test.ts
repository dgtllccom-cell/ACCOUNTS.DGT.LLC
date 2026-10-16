import { describe, expect, it } from "vitest";
import {
  allocateLoadings,
  confirmableQuantity,
  confirmationStage,
  extractPoGoodsLines,
  parseJsonish,
  receivingFacts,
  type LoadingFact,
} from "@/lib/stock-journal/model";

const loading = (over: Partial<LoadingFact>): LoadingFact => ({
  id: "L1", no: "PLR-1", containerNo: "C1", vehicleNo: "", blNumber: "", createdAt: "2026-01-01T00:00:00Z", loadedAt: null,
  loaded: 0, received: null, damaged: 0, shortage: 0, loadingStatus: "loaded", receivingWarehouseId: null, receivingGoodsId: null,
  customsStatus: "not_recorded", customsSource: "none", payload: {}, ...over,
});

describe("parseJsonish — JSON that was stored as text", () => {
  it("reads a JSON string stored inside the jsonb column (the reason bookings had quantity 0)", () => {
    const s = JSON.stringify({ form: { goodsName: "Almond", qtyNo: 200 } });
    expect(parseJsonish(s).form.qtyNo).toBe(200);
  });
  it("reads a double-encoded string", () => {
    const s = JSON.stringify(JSON.stringify({ form: { qtyNo: 7 } }));
    expect(parseJsonish(s).form.qtyNo).toBe(7);
  });
  it("rebuilds an object that is a spread string (keys are character positions)", () => {
    const text = JSON.stringify({ form: { goodsName: "Walnut", qtyNo: 10, pad: "xxxxxxxxxxxxxxxxxxxxxxxxxx" } });
    const spread = Object.fromEntries([...text].map((c, i) => [String(i), c]));
    expect(parseJsonish(spread).form.goodsName).toBe("Walnut");
  });
  it("never throws on garbage / null", () => {
    expect(parseJsonish(null)).toEqual({});
    expect(parseJsonish("not json")).toEqual({});
    expect(parseJsonish(42)).toEqual({});
  });
});

describe("extractPoGoodsLines", () => {
  it("keeps a Draft with no goods yet as one line of quantity 0", () => {
    const { lines } = extractPoGoodsLines({ form: { goodsName: "", qtyNo: 0, qtyName: "BAGS" } });
    expect(lines).toHaveLength(1);
    expect(lines[0].booked).toBe(0);
    expect(lines[0].unit).toBe("BAGS");
  });
  it("does not copy form.quantity onto every goods line", () => {
    const { lines } = extractPoGoodsLines({ form: { quantity: 999 }, goodsEntries: [{ goodsName: "A", qtyNo: 3 }, { goodsName: "B", qtyNo: 4 }] });
    expect(lines.map((l) => l.booked)).toEqual([3, 4]);
  });
  it("gives repeated goods distinct, stable line keys", () => {
    const { lines } = extractPoGoodsLines({ goodsEntries: [{ goodsName: "Rice", qtyNo: 1 }, { goodsName: "Rice", qtyNo: 2 }] });
    expect(new Set(lines.map((l) => l.lineKey)).size).toBe(2);
  });
});

describe("receivingFacts", () => {
  it("treats status 'received' with no recorded receipt as fully received (legacy)", () => {
    const f = receivingFacts({ loaded: 100, received: null, damaged: 0, shortage: 0, loadingStatus: "received" });
    expect(f).toMatchObject({ receivedGood: 100, inTransit: 0, legacyReceived: true });
  });
  it("splits loaded into received / damaged / shortage / still in transit", () => {
    const f = receivingFacts({ loaded: 100, received: 70, damaged: 5, shortage: 3, loadingStatus: "partially_received" });
    expect(f).toMatchObject({ receivedGood: 70, damaged: 5, shortage: 3, inTransit: 22, legacyReceived: false });
  });
});

describe("allocateLoadings — partial loading, several containers, no duplication", () => {
  const lines = extractPoGoodsLines({ goodsEntries: [{ goodsName: "A", qtyNo: 100 }, { goodsName: "B", qtyNo: 50 }] }).lines;

  it("fills goods lines first-in-first-out and keeps every loaded unit exactly once", () => {
    const { chunks } = allocateLoadings(lines, [loading({ id: "L1", loaded: 80 }), loading({ id: "L2", loaded: 40, createdAt: "2026-01-02T00:00:00Z" })]);
    const perLine = (k: string) => chunks.filter((c) => c.lineKey === k).reduce((s, c) => s + c.loaded, 0);
    expect(perLine(lines[0].lineKey)).toBe(100);
    expect(perLine(lines[1].lineKey)).toBe(20);
    expect(chunks.reduce((s, c) => s + c.loaded, 0)).toBe(120);
  });

  it("splits receiving facts in the same proportion without losing a unit", () => {
    const { chunks } = allocateLoadings(lines, [loading({ id: "L1", loaded: 120, received: 90, damaged: 6, shortage: 3 })]);
    expect(chunks.reduce((s, c) => s + c.receivedGood, 0)).toBeCloseTo(90, 4);
    expect(chunks.reduce((s, c) => s + c.damaged, 0)).toBeCloseTo(6, 4);
    expect(chunks.reduce((s, c) => s + c.shortage, 0)).toBeCloseTo(3, 4);
    expect(chunks.reduce((s, c) => s + c.inTransit, 0)).toBeCloseTo(21, 4);
  });

  it("uses the loading record's own per-goods quantities when it has them", () => {
    const { chunks } = allocateLoadings(lines, [loading({ id: "L1", loaded: 30, payload: { goodsEntries: [{ goodsName: "B", loadedQuantity: 30 }] } })]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].lineKey).toBe(lines[1].lineKey);
  });

  it("flags over-loading instead of dropping the quantity", () => {
    const one = extractPoGoodsLines({ form: { goodsName: "A", qtyNo: 10 } }).lines;
    const { chunks, overLoaded } = allocateLoadings(one, [loading({ id: "L1", loaded: 15 })]);
    expect(chunks[0].loaded).toBe(15);
    expect(overLoaded[one[0].lineKey]).toBe(5);
  });
});

describe("confirmations", () => {
  const chunk = { loadingId: "L1", lineKey: "a", loaded: 100, receivedGood: 100, damaged: 0, shortage: 0, inTransit: 0, legacyReceived: false };
  it("can only confirm what is received and not already confirmed", () => {
    const conf = [
      { loadingRecordId: "L1", lineKey: "a", status: "confirmed" as const, quantity: 30 },
      { loadingRecordId: "L1", lineKey: "a", status: "issued" as const, quantity: 20 },
      { loadingRecordId: "L1", lineKey: "a", status: "reversed" as const, quantity: 50 }, // reversed quantity is free again
    ];
    expect(confirmableQuantity(chunk, conf)).toBe(50);
  });
  it("never goes negative", () => {
    expect(confirmableQuantity(chunk, [{ loadingRecordId: "L1", lineKey: "a", status: "confirmed", quantity: 500 }])).toBe(0);
  });
  it("maps a confirmation to its stage", () => {
    expect(confirmationStage({ status: "issued", destinationType: "warehouse", reserved: false })).toBe("sold");
    expect(confirmationStage({ status: "confirmed", destinationType: "direct_sale", reserved: true })).toBe("reserved");
    expect(confirmationStage({ status: "confirmed", destinationType: "export", reserved: true })).toBe("reserved");
    expect(confirmationStage({ status: "confirmed", destinationType: "warehouse", reserved: false })).toBe("available");
    expect(confirmationStage({ status: "confirmed", destinationType: "local_sales", reserved: false })).toBe("available");
  });
});
