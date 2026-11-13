import { describe, expect, it } from "vitest";
import { DASH, billDetailOf, goodsLinesOf, loadDetailOf, transferDetailOf } from "@/lib/stock/register-detail";

describe("register detail views", () => {
  it("builds a purchase bill from its saved goods lines, with remaining balance = original - transferred", () => {
    const bill = {
      id: "b1", purchase_order_no: "PUR-1001", created_at: "2026-11-10T08:00:00Z", purchase_currency: "USD", exchange_rate: "3.6725",
      order_total: "9000", status: "Posted", payment_status: "completed", country_name: "UAE", branch_label: "Dubai HQ / Deira",
      form_data: { form: { supplierName: "Supplier A", manualBillNumber: "M-7", paymentType: "Credit" },
        goodsEntries: [{ goodsName: "Walnut", qtyNo: "100", qtyName: "CARTON", grossWeight: "1000", netWeight: "900", totalAmount: "5000", currencyType: "USD" },
                       { goodsName: "Almond", qtyNo: 50, qtyName: "BAGS", grossWeight: 500, netWeight: 450 }] },
    };
    const loads = [{ id: "l1", loaded_quantity: "60", loading_record_no: "PLR-1", purchase_order_id: "b1" }];
    const transfers = [{ id: "t1", transfer_no: "TR-1", quantity: "20", warehouse_id: "w1", destination_type: "warehouse" }];
    const d = billDetailOf("booking", bill, loads, transfers, new Map([["w1", "Dubai Main Warehouse"]]));
    expect(d.purchaseNo).toBe("PUR-1001");
    expect(d.supplier).toBe("Supplier A");
    expect(d.manualNo).toBe("M-7");
    expect(d.salesAccount).toBe(DASH);
    expect(d.goods).toHaveLength(2);
    expect(d.goods[0]).toMatchObject({ goodsName: "Walnut", qty: 100, unit: "CARTON", gross: 1000, net: 900 });
    expect(d.quantities).toEqual({ original: 150, loaded: 60, transferred: 20, remaining: 130 });
    expect(d.transfers[0].warehouse).toBe("Dubai Main Warehouse");
    expect(d.loads[0].loadingNo).toBe("PLR-1");
  });

  it("builds one loading entry with its bill reference and history, and dashes for absent values", () => {
    const lane = { id: "l1", purchase_ref_no: "PUR-1001", loading_record_no: "PLR-1", loading_date: "2026-11-11", goods_name: "Walnut",
      loaded_quantity: "60", unit: "CARTON", gross_weight: "600", net_weight: "550", container_number: "CONT-9", truck_number: "TRK-4",
      driver_name: "Ali", bl_number: "BL-22", origin_text: "Karachi", destination_text: "Dubai", lane_status: "loaded",
      disposition: "warehouse", purchase_order_id: "b1", lane_stock_qty: "40" };
    const events = [{ event_type: "loaded", from_status: "pending", to_status: "loaded", detail: "Loaded at Karachi", actor_name: "Ops", created_at: "2026-11-11T09:30:00Z" }];
    const d = loadDetailOf(lane, events);
    expect(d.purchaseNo).toBe("PUR-1001");
    expect(d.container).toBe("CONT-9");
    expect(d.truck).toBe("TRK-4");
    expect(d.bl).toBe("BL-22");
    expect(d.seal).toBe(DASH);
    expect(d.billType).toBe("booking");
    expect(d.billId).toBe("b1");
    expect(d.history[0]).toMatchObject({ event: "loaded", to: "loaded", actor: "Ops" });
  });

  it("builds one transfer with its warehouse and bill reference", () => {
    const t = { id: "t9", transfer_no: "TR-9", transfer_date: "2026-11-12", destination_type: "re_export", warehouse_id: null, goods_name: "Almond",
      quantity: "15", unit: "CARTON", status: "confirmed", remarks: "to export", confirmed_at: "2026-11-12T10:00:00Z" };
    const d = transferDetailOf(t, "", "local", "lp1", "LP-22");
    expect(d.destination).toBe("re_export");
    expect(d.warehouse).toBe(DASH);
    expect(d.qty).toBe(15);
    expect(d.purchaseNo).toBe("LP-22");
    expect(d.billType).toBe("local");
    expect(d.remarks).toBe("to export");
  });

  it("reads goods lines from a saved form given as text, and returns none for a missing form", () => {
    const text = JSON.stringify({ goodsEntries: [{ goodsName: "Rice", qtyNo: 5, qtyName: "BAG" }] });
    expect(goodsLinesOf(text, "USD")).toMatchObject([{ goodsName: "Rice", qty: 5, unit: "BAG", currency: "USD" }]);
    expect(goodsLinesOf(null, "USD")).toEqual([]);
    expect(goodsLinesOf("not json", "USD")).toEqual([]);
  });
});
