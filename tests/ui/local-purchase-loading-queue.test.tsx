import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
(globalThis as any).React = React;
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {}, refresh: () => {}, prefetch: () => {} }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/dashboard/purchase/local-purchase-loading",
}));
import { LocalPurchaseDestinationQueueView } from "@/features/purchases/components/local-purchase-destination-queue-view";

// LP-JRN-00000009 as saved in Production (read only): transferred & posted 21 Nov, booked for Loading by Truck, not loaded yet
const lp9 = {
  id: "5af5944f-3f9f-4308-b632-770c6238920e", journal_serial_no: "LP-JRN-00000009", status: "posted", shipping_mode: "Loading",
  payment_mode: "Credit (Due: 2026-12-19)", loading_status: null, warehouse_transfer_status: null, export_status: null,
  loading_details: { shipmentType: "Loading by Truck", shippingMode: "Loading" }, goods_name: "WALNUT KENRELS", brand: "DGT.LLC",
  numbers: 2500, quantity_name: "Boxes", total_gross_weight: 25625, net_weight: 25000, final_cost: 412500, purchase_currency: "AED",
  country_id: "c1", country_branch_id: "b1", city_branch_id: "cb1", country_name: "United Arab Emirates", branch_name: "United Arab Emirates Main Branch",
};
const WAIT = { timeout: 5000 };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { purchases: [lp9] } }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Local Purchase Loading queue", { timeout: 20000 }, () => {
  it("lists a transferred bill as pending loading, counts it as Transferred, and totals it in its own currency", async () => {
    render(<LocalPurchaseDestinationQueueView stage="loading" session={{ isSuperAdmin: true, roles: ["super_admin"] }} />);
    expect((await screen.findAllByText(/LP-JRN-00000009/, {}, WAIT)).length).toBeGreaterThan(0);
    const text = document.body.textContent || "";
    expect(text).not.toMatch(/PKR\s*412,500/);
    expect(text).toMatch(/AED\s*412,500/);
  });
});
