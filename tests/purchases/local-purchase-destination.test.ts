import { describe, expect, it } from "vitest";
import {
  localPurchaseDestinationHref,
  resolveLocalPurchaseDestination,
  stageForShippingMode,
} from "@/lib/purchases/local-purchase-destination";

describe("local purchase destination routing", () => {
  it("maps every booking Shipment Type value to its queue", () => {
    expect(stageForShippingMode("Loading")).toBe("loading");
    expect(stageForShippingMode("Transfer Layout")).toBe("warehouse_transfer");
    expect(stageForShippingMode("Export")).toBe("export");
    expect(stageForShippingMode("")).toBeNull();
    expect(stageForShippingMode("Local Market")).toBeNull();
  });

  it("routes a posted Warehouse Transfer bill (LP-JRN-00000001 shape) to the warehouse queue, not loading", () => {
    const row = {
      id: "1b64354e-31d9-4aff-845a-225161afc95e",
      status: "posted",
      shipping_mode: "Transfer Layout",
      loading_details: { shipmentType: "Warehouse Transfer", shippingMode: "Transfer Layout" },
    };
    const stage = resolveLocalPurchaseDestination(row);
    expect(stage).toBe("warehouse_transfer");
    expect(localPurchaseDestinationHref(stage!, row.id)).toBe(
      "/dashboard/purchase/local-purchase-warehouse-transfer?billId=1b64354e-31d9-4aff-845a-225161afc95e",
    );
  });

  it("routes a Loading by Truck bill to the loading queue", () => {
    const stage = resolveLocalPurchaseDestination({ shippingMode: "Loading" });
    expect(localPurchaseDestinationHref(stage!, "abc")).toBe("/dashboard/purchase/local-purchase-loading?billId=abc");
  });

  it("falls back to loading_details.shipmentType (also string-encoded) when shipping_mode is empty", () => {
    expect(resolveLocalPurchaseDestination({ shipping_mode: null, loading_details: '{"shipmentType":"Export Shipment"}' })).toBe("export");
    expect(resolveLocalPurchaseDestination({ loadingDetails: { shipmentType: "Warehouse Transfer" } })).toBe("warehouse_transfer");
    expect(resolveLocalPurchaseDestination({})).toBeNull();
    expect(resolveLocalPurchaseDestination(null)).toBeNull();
  });

  it("only links to queue pages that exist", async () => {
    const { existsSync } = await import("node:fs");
    const path = await import("node:path");
    for (const stage of ["loading", "warehouse_transfer", "export"] as const) {
      const href = localPurchaseDestinationHref(stage);
      expect(existsSync(path.join(process.cwd(), "app", href, "page.tsx"))).toBe(true);
    }
  });
});
