import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({ id: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.id ? `id=${state.id}` : ""),
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => {} }),
}));
(globalThis as any).React = React; // some shared components use the automatic JSX runtime
import { PurchaseTransferErpReportView } from "@/features/purchases/components/purchase-transfer-erp-report-view-v2";

// the two real bills as the booking journal API returns them (Production, read-only)
const ae0004 = {
  id: "740f99e9-2bf6-408e-b8cb-82599748bbac", purchaseBookingOrderNumber: "AE-001-0004", currency: "USD", exchange_rate: 3.675,
  totalPurchaseAmount: 230000, finalAmount: 845250, order_total: 845250,
  form_data: { form: { operator: "*", currencyType: "USD", secondaryCurrency: "AED", paymentType: "Advance Payment", advancePercent: 20 },
    goodsEntries: [{ op: "*", goodsName: "WALNUT KENRELS", totalAmount: 230000, finalAmount: 845250, qtyNo: 4600 }], totals: { grandFinal: 845250, grandPrimaryFinal: 230000 } },
};
const ae0005 = {
  id: "8cd5a174-8354-4faf-b646-e0558ee5426c", purchaseBookingOrderNumber: "AE-001-0005", currency: "PKR", exchange_rate: 77.2,
  totalPurchaseAmount: 20250000, finalAmount: 262305.6994818653, order_total: 262305.6995,
  form_data: { form: { operator: "/", currencyType: "PKR", secondaryCurrency: "AED", paymentType: "Credit", advancePercent: 10 },
    goodsEntries: [{ op: "/", goodsName: "BLACK MAFTA", totalAmount: 20250000, finalAmount: 262305.6994818653, qtyNo: 2160 }], totals: { grandFinal: 262305.6994818653, grandPrimaryFinal: 20250000 } },
};

beforeEach(() => {
  // newest first, like the real list — the screen must still pick the requested bill
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, data: { reports: [ae0005, ae0004] } }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Purchase Transfer Verification", () => {
  it("opens the requested bill, not the newest one", async () => {
    state.id = ae0004.id;
    render(<PurchaseTransferErpReportView />);
    expect((await screen.findAllByText(/AE-001-0004/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/AE-001-0005/)).toBeNull();
    expect(document.body.textContent).toContain("845,250.00");
  });

  it("a PKR bill is divided by its rate: 262,305.70 AED, never 1,563,300,000", async () => {
    state.id = ae0005.id;
    render(<PurchaseTransferErpReportView />);
    expect((await screen.findAllByText(/AE-001-0005/)).length).toBeGreaterThan(0);
    const text = document.body.textContent || "";
    expect(text).toContain("262,305.70");
    expect(text).toContain("÷ 77.2");
    expect(text).not.toContain("1,563,300,000");
  });
});
