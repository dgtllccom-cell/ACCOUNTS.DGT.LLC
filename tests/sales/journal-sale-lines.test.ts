import { describe, expect, it } from "vitest";
import { journalSaleLinesOf } from "@/lib/sales/journal-sale-lots";

describe("sales booking lines from the Stock Journal", () => {
  it("collects one entry per allocation and sums the quantities of its lines", () => {
    const lines = journalSaleLinesOf({
      goodsEntries: [
        { goodsName: "WALNUT", journalTransferId: "t-1", qtyNo: 10, lotNo: "TRF-1" },
        { goodsName: "WALNUT", journalTransferId: "t-1", qtyNo: 5, lotNo: "TRF-1" },
        { goodsName: "ALMOND", journalTransferId: "t-2", quantity: 7, lotNo: "TRF-2" },
      ],
    });
    expect(lines).toEqual([
      { transferId: "t-1", qty: 15, name: "WALNUT" },
      { transferId: "t-2", qty: 7, name: "ALMOND" },
    ]);
  });

  it("ignores managed-lot lines, lines without an allocation, and an empty booking", () => {
    expect(journalSaleLinesOf({ goodsEntries: [{ managedLotId: "m-1", journalTransferId: "t-9", qtyNo: 3 }, { qtyNo: 4, lotNo: "WH-1" }] })).toEqual([]);
    expect(journalSaleLinesOf(null)).toEqual([]);
    expect(journalSaleLinesOf({})).toEqual([]);
  });

  it("treats a non-numeric quantity as zero instead of poisoning the total", () => {
    const lines = journalSaleLinesOf({ goodsEntries: [{ journalTransferId: "t-3", qtyNo: "abc" }, { journalTransferId: "t-3", qtyNo: 4 }] });
    expect(lines).toEqual([{ transferId: "t-3", qty: 4, name: "t-3" }]);
  });
});
