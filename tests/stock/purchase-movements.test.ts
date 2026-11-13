import { describe, expect, it } from "vitest";
import type { BalanceBill } from "@/lib/services/stock-balance-report-service";
import { totalsOf, type BalanceEntry } from "@/lib/stock-balance/model";
import {
  buildDestinationGroups,
  buildPurchaseRows,
  categoryOf,
  destinationTotals,
  isLiveTransfer,
  type RawLaneLoad,
  type RawTransfer,
} from "@/lib/stock/purchase-movements";

const w = (qty: number, gross: number, net: number) => ({ qty, gross, net });
const zero = () => w(0, 0, 0);

function entry(o: Partial<BalanceEntry>): BalanceEntry {
  const purchased = o.purchased ?? w(100, 1000, 990);
  return {
    entryId: "e", lotNo: "LOT-1", entryNo: 1, lotEntryLabel: "LOT-1 / Entry 1", goodsName: "Rice", goodsId: null, brand: "Falcon", size: "25 KG", origin: "PK", unit: "BAGS",
    purchased, sold: zero(), transferred: zero(), adjusted: zero(), reservedQty: 0, inTransitQty: 0, remaining: purchased, unitPrice: null, amount: null, currency: "USD",
    warehouseId: null, warehouseName: null, loadingRecordId: null, lotRef: null, status: "available", treatment: { received: 0, treated: 0, loss: 0, pending: 0 }, ...o,
  };
}

function bill(o: Partial<BalanceBill> & Pick<BalanceBill, "id" | "type" | "billNo" | "entries">): BalanceBill {
  return {
    manualBillNo: "", date: "2026-11-01", purchaseAccountName: "", purchaseAccountDetails: "", companyId: null, companyName: "", countryId: null, countryName: "UAE", countryCode: "AE",
    countryBranchId: null, cityBranchId: null, cityName: "", branchName: "Dubai", originCountry: "", currency: "USD", exchangeRate: 1, remarks: "", amount: null,
    totals: totalsOf(o.entries), sales: [], unallocatedSales: zero(), payments: [], paid: null, pending: null, mixedCurrency: false, treatments: [], paymentStatus: "", ...o,
  };
}

function lane(o: Partial<RawLaneLoad>): RawLaneLoad {
  return {
    id: "l1", source_type: "purchase_booking", source_id: null, purchase_order_id: null, local_purchase_id: null, loading_record_no: "LD-1", loading_date: "2026-11-02",
    goods_name: "Rice", loaded_quantity: 100, unit: "BAGS", gross_weight: 1000, net_weight: 990, disposition: null, transfer_destination: null, destination_text: null,
    lane_status: "in_transit", disposition_warehouse_name: null, ...o,
  };
}

function transfer(o: Partial<RawTransfer>): RawTransfer {
  return {
    id: "t1", journal: "stock", transfer_no: "ST-1", purchase_order_id: null, local_purchase_id: null, loading_record_id: null, line_key: null, lot_ref: null,
    destination: "warehouse", status: "confirmed", quantity: 40, unit: "BAGS", transfer_date: "2026-11-05", goods_name: "Rice", warehouse_name: "Jebel Ali WH", party_name: null, ...o,
  };
}

describe("purchase movements: categories", () => {
  it("maps every journal destination to one category", () => {
    expect(["warehouse", "own_warehouse", "dgt_warehouse", "third_party_warehouse"].map(categoryOf)).toEqual(Array(4).fill("warehouse"));
    expect(["re_export", "export", "export_customer", "export_dgt_branch"].map(categoryOf)).toEqual(Array(4).fill("re_export"));
    expect(["sale_delivery", "local_sales", "local_sale", "direct_sale"].map(categoryOf)).toEqual(Array(4).fill("local_sale"));
    expect(categoryOf("continue_transit")).toBe("in_transit");
    expect(categoryOf("hold")).toBe("hold");
    expect(categoryOf("")).toBeNull();
    expect(categoryOf("something_else")).toBeNull();
  });

  it("leaves out transfers that moved nothing", () => {
    expect(["reversed", "cancelled", "returned", "draft"].map((status) => isLiveTransfer({ status }))).toEqual([false, false, false, false]);
    expect(["confirmed", "issued", "completed", "in_transit"].map((status) => isLiveTransfer({ status }))).toEqual([true, true, true, true]);
  });
});

describe("purchase movements: purchase rows", () => {
  const booking = bill({
    id: "po1", type: "booking", billNo: "PB-001",
    entries: [entry({ entryId: "po:po1::LOT-A::l1", lotNo: "LOT-A", lotEntryLabel: "LOT-A / Entry 1", loadingRecordId: "plr1", remaining: w(60, 600, 594) })],
  });
  const local = bill({
    id: "lp1", type: "local", billNo: "LP-7", date: "2026-10-20",
    entries: [entry({ entryId: "lp:lp1::L7::l1", lotNo: "L7", lotEntryLabel: "L7 / Entry 1", lotRef: "LOT-0007", goodsName: "Sugar", brand: "", size: "", purchased: w(50, 520, 500), remaining: w(50, 520, 500) })],
  });

  it("includes Purchase Booking and Local Purchase bills with purchase date, lot, brand, size and remaining", () => {
    const rows = buildPurchaseRows([booking, local], [], [], { plr1: "2026-11-02" });
    expect(rows.map((r) => [r.billType, r.purchaseNo, r.purchaseDate])).toEqual([["booking", "PB-001", "2026-11-01"], ["local", "LP-7", "2026-10-20"]]);
    expect(rows[0].entries[0]).toMatchObject({ entryNo: "LOT-A / Entry 1", loadingDate: "2026-11-02", brand: "Falcon", size: "25 KG", lot: "LOT-A", qty: 100, remaining: 60 });
    // blank brand and size show a dash, never an invented value
    expect(rows[1].entries[0]).toMatchObject({ brand: "—", size: "—", lot: "L7", qty: 50 });
    expect(rows[0].remaining).toBe(60);
  });

  it("puts every loading and stock transfer under its original purchase number", () => {
    const lanes = [
      lane({ id: "a", source_id: "plr1", purchase_order_id: "po1", loading_record_no: "LD-9" }),
      lane({ id: "b", source_type: "local_purchase", source_id: "lp1", local_purchase_id: "lp1", loading_record_no: "LP-LD-1", goods_name: "Sugar", loaded_quantity: 50 }),
    ];
    const transfers = [
      transfer({ id: "s1", purchase_order_id: "po1", loading_record_id: "plr1", line_key: "l1", quantity: 40 }),
      transfer({ id: "g1", journal: "goods", transfer_no: "GT-3", local_purchase_id: "lp1", lot_ref: "LOT-0007", destination: "export_customer", quantity: 20, warehouse_name: null, party_name: "Kabul Buyer" }),
      transfer({ id: "x", purchase_order_id: "po1", status: "reversed" }),
    ];
    const [po, lp] = buildPurchaseRows([booking, local], lanes, transfers);
    expect(po.movements.map((m) => [m.kind, m.refNo, m.category, m.destination])).toEqual([
      ["loading", "LD-9", "in_transit", "—"],
      ["transfer", "ST-1", "warehouse", "Jebel Ali WH"],
    ]);
    // a transfer row takes its brand, size and lot from the lot entry it came from, and the entry's weight per unit
    expect(po.movements[1]).toMatchObject({ brand: "Falcon", size: "25 KG", lot: "LOT-A", qty: 40, gross: 400, net: 396 });
    expect(lp.movements.map((m) => [m.kind, m.refNo, m.category, m.destination])).toEqual([
      ["loading", "LP-LD-1", "in_transit", "—"],
      ["transfer", "GT-3", "re_export", "Kabul Buyer"],
    ]);
    expect(lp.movements[1]).toMatchObject({ lot: "L7", qty: 20, gross: 208, net: 200 });
  });

  it("shows the lane's place as destination, never a workflow queue, and the journal no. for a Local Purchase load", () => {
    const rows = buildPurchaseRows(
      [booking, local],
      [
        lane({ id: "a", source_id: "plr1", purchase_order_id: "po1", transfer_destination: "remaining_payment", destination_text: "Pakistan / Karachi Port (KPT)" }),
        lane({ id: "b", source_type: "local_purchase", source_id: "lp1", local_purchase_id: "lp1", loading_record_no: null, purchase_ref_no: "LP-JRN-00000052", transfer_destination: "general_purchase_expenses" }),
      ],
      []
    );
    expect(rows[0].movements[0].destination).toBe("Pakistan / Karachi Port (KPT)");
    expect(rows[0].entries[0].destination).toBe("Pakistan / Karachi Port (KPT)");
    expect(rows[1].movements[0]).toMatchObject({ refNo: "LP-JRN-00000052", destination: "—" });
  });

  it("never attaches a sales load to a purchase", () => {
    const rows = buildPurchaseRows([booking], [lane({ source_type: "sales_booking", purchase_order_id: "po1" })], []);
    expect(rows[0].movements).toEqual([]);
  });
});

describe("purchase movements: destination & re-export register", () => {
  const booking = bill({ id: "po1", type: "booking", billNo: "PB-001", entries: [entry({ entryId: "po:po1::LOT-A::l1", lotNo: "LOT-A", loadingRecordId: "plr1" }), entry({ entryId: "po:po1::LOT-B::l1", lotNo: "LOT-B", loadingRecordId: "plr2" })] });

  it("counts a loading once: under its transfer when one exists, otherwise under its lane disposition", () => {
    const lanes = [
      lane({ id: "a", source_id: "plr1", purchase_order_id: "po1", loading_record_no: "LD-1" }),
      lane({ id: "b", source_id: "plr2", purchase_order_id: "po1", loading_record_no: "LD-2", disposition: "re_export", destination_text: "Kabul" }),
    ];
    const transfers = [transfer({ purchase_order_id: "po1", loading_record_id: "plr1", quantity: 100 })];
    const groups = buildDestinationGroups(buildPurchaseRows([booking], lanes, transfers));
    expect(groups.map((g) => [g.category, g.destination, g.qty, g.rows.map((r) => r.refNo)])).toEqual([
      ["warehouse", "Jebel Ali WH", 100, ["ST-1"]],
      ["re_export", "Kabul", 100, ["LD-2"]],
    ]);
    expect(groups[0].rows[0]).toMatchObject({ purchaseNo: "PB-001", purchaseDate: "2026-11-01", billType: "booking" });
    expect(destinationTotals(groups)).toEqual({ warehouse: 100, re_export: 100, local_sale: 0, in_transit: 0, hold: 0 });
  });

  it("a partly transferred loading counts only its untransferred remainder, with weights per unit", () => {
    const local = bill({ id: "lp1", type: "local", billNo: "LP-4", entries: [entry({ entryId: "lp:lp1::A::1", lotNo: "A", lotRef: "LOT-19" })] });
    const lanes = [lane({ source_type: "local_purchase", source_id: "lp1", local_purchase_id: "lp1", loaded_quantity: 3292, gross_weight: 125344, net_weight: 122052 })];
    const transfers = [transfer({ journal: "goods", local_purchase_id: "lp1", lot_ref: "LOT-19", destination: "hold", status: "completed", quantity: 1890 })];
    const groups = buildDestinationGroups(buildPurchaseRows([local], lanes, transfers));
    expect(groups.map((g) => [g.category, g.qty])).toEqual([["in_transit", 1402], ["hold", 1890]]);
    expect(groups[0].rows[0].gross).toBeCloseTo((125344 * 1402) / 3292, 3);
  });

  it("an untransferred loading with no disposition is stock in transit", () => {
    const groups = buildDestinationGroups(buildPurchaseRows([booking], [lane({ source_id: "plr1", purchase_order_id: "po1" })], []));
    expect(groups.map((g) => [g.category, g.qty])).toEqual([["in_transit", 100]]);
  });
});
