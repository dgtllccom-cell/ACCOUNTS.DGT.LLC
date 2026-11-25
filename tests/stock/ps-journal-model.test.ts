import { describe, expect, it } from "vitest";
import {
  applyPsStockFilters,
  buildJournalBookingStockView,
  buildPsJournalView,
  buildPsLotDetailView,
  formatUnitQty,
  type PsStockChunk,
} from "@/lib/stock/ps-journal-model";

function makeChunk(over: Partial<PsStockChunk>): PsStockChunk {
  return {
    chunkId: "po:1:load:L1:l0",
    sourceKind: "purchase_booking",
    purchaseBillId: "po-1",
    purchaseBillNo: "AE-001-0001",
    manualBillNo: "INV-100",
    purchaseDate: "2026-11-10",
    entryRef: "AE-001-0001 / PLR-01",
    entryTypeLabel: "Purchase Booking (Loaded)",
    countryId: "c-uae",
    countryName: "UAE",
    countryCode: "AE",
    countryBranchId: "cb-dubai",
    cityBranchId: "cib-dubai",
    branchId: "cib-dubai",
    branchName: "Dubai City Branch",
    warehouseId: "wh-1",
    warehouseName: "Al Ras Warehouse",
    lotKey: "LOT:4BWT",
    lotName: "4BWT",
    blNo: "BL-UAE-001",
    containerNo: "CONT-9001",
    supplierAccountNo: "AE-SUP-01",
    supplierAccountName: "Kabul Agro Supplier",
    goodsId: "g-walnut",
    goodsName: "Walnut Kernels",
    brand: "DGT",
    size: "90%",
    origin: "Afghanistan",
    unit: "BOXES",
    purchasedQty: 1000,
    purchasedGrossKg: 10500,
    purchasedNetKg: 10000,
    transferredQty: 0,
    transferredGrossKg: 0,
    transferredNetKg: 0,
    adjustedQty: 0,
    adjustedGrossKg: 0,
    adjustedNetKg: 0,
    inTransitQty: 0,
    notLoaded: false,
    sales: [],
    ...over,
  };
}

describe("P/S Journal & Journal Booking Stock canonical model", () => {
  it("supports partial sales and multiple sales against the same purchase without duplicating purchase or remaining stock", () => {
    const chunk = makeChunk({
      purchasedQty: 1000,
      purchasedGrossKg: 10500,
      purchasedNetKg: 10000,
      sales: [
        {
          id: "s-1",
          salesOrderId: "so-1",
          salesBillNo: "SO-0001",
          manualBillNo: "",
          saleType: "Sales Booking",
          date: "2026-11-12",
          accountNo: "CUS-01",
          accountName: "Buyer One",
          blNo: "BL-UAE-001",
          containerNo: "CONT-9001",
          goodsName: "Walnut Kernels",
          brand: "DGT",
          size: "90%",
          origin: "Afghanistan",
          unit: "BOX",
          qty: 350,
          grossKg: 3675,
          netKg: 3500,
        },
        {
          id: "s-2",
          salesOrderId: "so-2",
          salesBillNo: "SO-0002",
          manualBillNo: "",
          saleType: "Sales Booking",
          date: "2026-11-15",
          accountNo: "CUS-02",
          accountName: "Buyer Two",
          blNo: "BL-UAE-001",
          containerNo: "CONT-9001",
          goodsName: "Walnut Kernels",
          brand: "DGT",
          size: "90%",
          origin: "Afghanistan",
          unit: "BOX",
          qty: 250,
          grossKg: 2625,
          netKg: 2500,
        },
      ],
    });

    const jbs = buildJournalBookingStockView([chunk], {});
    expect(jbs.cards.purchase.bills).toBe(1);
    expect(jbs.cards.sales.bills).toBe(2);
    expect(jbs.cards.purchase.qtyByUnit).toEqual({ BOX: 1000 });
    expect(jbs.cards.sales.qtyByUnit).toEqual({ BOX: 600 });
    expect(jbs.cards.remaining.qtyByUnit).toEqual({ BOX: 400 });
    expect(jbs.rows).toHaveLength(1);
    expect(jbs.rows[0].salesBillDisplay).toBe("SO-0001 (+1)");
    expect(jbs.rows[0].remQty).toBe(400);
    expect(jbs.rows[0].remNetKg).toBe(4000);
  });

  it("never sums incompatible units (BAG vs BOX) and preserves negative balances with an explanation", () => {
    const bagLot = makeChunk({
      chunkId: "lp:1:lot:1",
      sourceKind: "local_purchase",
      purchaseBillId: "lp-1",
      purchaseBillNo: "LP-0001",
      lotKey: "LOT:MIR",
      lotName: "MIR",
      goodsName: "Black Mafta",
      unit: "BAGS",
      purchasedQty: 500,
      purchasedGrossKg: 25500,
      purchasedNetKg: 25000,
      sales: [
        {
          id: "s-over",
          salesOrderId: "so-9",
          salesBillNo: "SO-0009",
          manualBillNo: "",
          saleType: "Local Sale",
          date: "2026-11-18",
          accountNo: "CUS-09",
          accountName: "Over Buyer",
          blNo: "",
          containerNo: "TRK-9",
          goodsName: "Black Mafta",
          brand: "",
          size: "50%",
          origin: "Afghanistan",
          unit: "BAG",
          qty: 650,
          grossKg: 33150,
          netKg: 32500,
        },
      ],
    });
    const boxLot = makeChunk({
      chunkId: "po:2:load:L2:l0",
      purchaseBillId: "po-2",
      purchaseBillNo: "AE-001-0002",
      lotKey: "LOT:DP2WK",
      lotName: "DP2WK",
      unit: "BOXES",
      purchasedQty: 200,
      purchasedGrossKg: 2100,
      purchasedNetKg: 2000,
    });

    const psj = buildPsJournalView([bagLot, boxLot], {});
    expect(psj.cards.purchase.qtyByUnit).toEqual({ BAG: 500, BOX: 200 });
    expect(psj.cards.balance.qtyByUnit).toEqual({ BAG: -150, BOX: 200 });
    expect(formatUnitQty(psj.cards.purchase.qtyByUnit)).toBe("500 BAG · 200 BOX");

    const mir = psj.lots.find((l) => l.lotName === "MIR")!;
    expect(mir.hasNegativeBalance).toBe(true);
    expect(mir.balQtyByUnit).toEqual({ BAG: -150 });
    expect(mir.negativeReason).toBeTruthy();

    const detail = buildPsLotDetailView([bagLot, boxLot], "LOT:MIR")!;
    expect(detail.purchasedItems).toHaveLength(1);
    expect(detail.soldItems).toHaveLength(1);
    expect(detail.lot.balNetKg).toBe(-7500);
  });

  it("filters accurately across B/L, Container, Sales Bill, Stock Status, and Country/Branch", () => {
    const c1 = makeChunk({
      chunkId: "c1",
      countryId: "c-uae",
      blNo: "OOLU2567",
      containerNo: "OOLU6515",
      lotKey: "LOT:A",
      lotName: "LOT-A",
    });
    const c2 = makeChunk({
      chunkId: "c2",
      countryId: "c-pk",
      countryName: "Pakistan",
      branchId: "cib-quetta",
      branchName: "Quetta",
      blNo: "NIM-001",
      containerNo: "AFG-2",
      lotKey: "LOT:B",
      lotName: "LOT-B",
      purchasedQty: 540,
      sales: [
        {
          id: "s-8",
          salesOrderId: "so-8",
          salesBillNo: "S#8",
          manualBillNo: "",
          saleType: "Sales Booking",
          date: "2026-11-20",
          accountNo: "CUS-8",
          accountName: "Quetta Trader",
          blNo: "NIM-001",
          containerNo: "AFG-2",
          goodsName: "Walnut Kernels",
          brand: "DGT",
          size: "90%",
          origin: "Afghanistan",
          unit: "BOX",
          qty: 540,
          grossKg: 5670,
          netKg: 5400,
        },
      ],
    });

    expect(applyPsStockFilters([c1, c2], { blNo: "OOLU2567" }).map((x) => x.chunkId)).toEqual(["c1"]);
    expect(applyPsStockFilters([c1, c2], { containerNo: "AFG-2" }).map((x) => x.chunkId)).toEqual(["c2"]);
    expect(applyPsStockFilters([c1, c2], { salesBill: "S#8" }).map((x) => x.chunkId)).toEqual(["c2"]);
    expect(applyPsStockFilters([c1, c2], { stockStatus: "sold_out" }).map((x) => x.chunkId)).toEqual(["c2"]);
    expect(applyPsStockFilters([c1, c2], { countryId: "c-pk" }).map((x) => x.chunkId)).toEqual(["c2"]);
  });
});
