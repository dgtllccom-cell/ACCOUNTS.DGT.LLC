import { describe, expect, it } from "vitest";
import {
  localPurchaseDestinationChangeBlocker,
  localPurchaseHasWarehouse,
  parseLoadingDetails,
} from "@/lib/purchases/local-purchase-destination";

// The posted 2,100-box bill as saved in production: booked as Warehouse Transfer, its warehouse stage marked complete with no warehouse.
const stuckWarehouseBill = {
  status: "posted",
  shipping_mode: "Transfer Layout",
  loading_details: { shipmentType: "Warehouse Transfer", shippingMode: "Transfer Layout", warehouseName: "", warehousePlotNo: "" },
  warehouse_transfer_status: "completed",
  warehouse_transferred_at: "2026-11-21T15:08:52.220Z",
  warehouse_name: null,
  warehouse_id: null,
  loading_completed_at: null,
};

describe("local purchase destination change", () => {
  it("lets a posted bill with no warehouse recorded move from a mistaken warehouse completion to Loading", () => {
    expect(localPurchaseDestinationChangeBlocker(stuckWarehouseBill, "loading")).toBeNull();
  });

  it("accepts camelCase rows from the register list", () => {
    const camel = { status: "posted", shippingMode: "Transfer Layout", loadingDetails: { shipmentType: "Warehouse Transfer" }, warehouseTransferStatus: "completed", warehouseName: "", warehouseId: null };
    expect(localPurchaseDestinationChangeBlocker(camel, "loading")).toBeNull();
  });

  it("locks the destination once a warehouse was recorded and its transfer completed", () => {
    const withWarehouse = { ...stuckWarehouseBill, warehouse_name: "Al Ras Warehouse" };
    expect(localPurchaseDestinationChangeBlocker(withWarehouse, "loading")).toMatch(/warehouse transfer/i);
  });

  it("locks the destination once goods were loaded", () => {
    const loaded = { ...stuckWarehouseBill, warehouse_transfer_status: null, shipping_mode: "Loading", loading_details: { entries: [{ loadedQuantity: 100 }] } };
    expect(localPurchaseDestinationChangeBlocker(loaded, "warehouse_transfer")).toMatch(/already loaded/i);
  });

  it("locks the destination once the export handover is done", () => {
    const exported = { ...stuckWarehouseBill, warehouse_transfer_status: null, shipping_mode: "Export", export_handover_at: "2026-11-22T10:00:00Z" };
    expect(localPurchaseDestinationChangeBlocker(exported, "loading")).toMatch(/export/i);
  });

  it("refuses a bill that is not posted", () => {
    expect(localPurchaseDestinationChangeBlocker({ ...stuckWarehouseBill, status: "draft" }, "loading")).toMatch(/posted/i);
  });

  it("refuses the bill's current destination", () => {
    expect(localPurchaseDestinationChangeBlocker({ ...stuckWarehouseBill, warehouse_transfer_status: null }, "warehouse_transfer")).toMatch(/already in this destination/i);
  });

  it("reads loading_details whether it is stored as an object or as a JSON string (older rows)", () => {
    const entries = [{ loadedQuantity: 30 }];
    expect(parseLoadingDetails({ entries })).toEqual({ entries });
    expect(parseLoadingDetails(JSON.stringify({ entries }))).toEqual({ entries });
    expect(parseLoadingDetails(null)).toEqual({});
    expect(parseLoadingDetails("not json")).toEqual({});
  });

  it("reports whether a bill records a warehouse by name or id", () => {
    expect(localPurchaseHasWarehouse({ warehouse_name: "Al Ras Warehouse" })).toBe(true);
    expect(localPurchaseHasWarehouse({ warehouse_id: "7f40a764-0168-48e0-a9a6-c8ac7a9aaa2f" })).toBe(true);
    expect(localPurchaseHasWarehouse({ warehouseName: "  " })).toBe(false);
    expect(localPurchaseHasWarehouse(stuckWarehouseBill)).toBe(false);
  });
});
