import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { PurchaseBookingReportScreen } from "@/features/purchases/components/purchase-booking-report";

const ORDER = {
  id: "8cd5a174-8354-4faf-b646-e0558ee5426c",
  purchase_order_no: "AE-001-0005",
  ledger_posting_status: "draft",
  payment_status: "pending",
  currency_code: "PKR",
  payment_currency: "AED",
  exchange_rate: "77.20000000",
  form_data: {
    form: { operator: "/", billNo: "DUBAI-0000", advancePercent: 10, paymentReport: "" },
    goodsEntries: [{ op: "/", goodsName: "BLACK MAFTA", qtyNo: 2160, qtyName: "BAGS", coursePrice: 7500, totalAmount: 20250000, exchangeRate: 77.2 }],
    totals: { totalQty: 2160, grandPrimaryFinal: 20250000 },
  },
};

function mockFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") return new Response(JSON.stringify({ ok: true, data: { purchaseOrderId: ORDER.id } }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, data: { order: ORDER } }), { status: 200 });
  });
}

// the save round-trip and the A4 viewer can take over 1 s on a loaded CI runner
const WAIT = { timeout: 5000 };
describe("PurchaseBookingReportScreen", { timeout: 20000 }, () => {
  it("renders the saved booking and View opens the full-screen A4 report", async () => {
    const fetchImpl = mockFetch();
    render(<PurchaseBookingReportScreen orderId={ORDER.id} fetchImpl={fetchImpl as any} lang="en" />);
    await screen.findByText("BLACK MAFTA", {}, WAIT);
    expect(screen.getAllByTestId("goods-rate")[0].textContent).toBe("÷ 77.2");
    expect(screen.getAllByTestId("goods-final")[0].textContent).toBe("262,305.70");
    expect(screen.queryByTestId("purchase-booking-report-view")).toBeNull();

    fireEvent.click(screen.getByTestId("report-view"));
    const view = await screen.findByTestId("purchase-booking-report-view", {}, WAIT);
    expect(view.getAttribute("role")).toBe("dialog");
    const page = within(view);
    expect(page.getAllByText("AE-001-0005").length).toBeGreaterThan(0);
    expect(page.getAllByTestId("goods-rate")[0].textContent).toBe("÷ 77.2");
    expect(page.getByTestId("report-print")).toBeTruthy();
    // the A4 copy prints remarks as text, not editable boxes
    expect(view.querySelectorAll("textarea").length).toBe(0);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("purchase-booking-report-view")).toBeNull());
  });

  it("a remarks Save PATCHes only formData with that one field changed", async () => {
    const fetchImpl = mockFetch();
    render(<PurchaseBookingReportScreen orderId={ORDER.id} fetchImpl={fetchImpl as any} lang="en" />);
    const box = await screen.findByTestId("remark-payment", {}, WAIT);
    fireEvent.change(box, { target: { value: "Credit 30 days" } });
    fireEvent.click(screen.getByTestId("remark-save-payment"));
    await screen.findByText("Saved", {}, WAIT);
    const patch = fetchImpl.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PATCH")!;
    expect(patch[0]).toBe(`/api/erp/purchases/orders/${ORDER.id}`);
    const body = JSON.parse(String((patch[1] as RequestInit).body));
    expect(Object.keys(body)).toEqual(["formData"]);
    expect(body.formData.form.paymentReport).toBe("Credit 30 days");
    expect(body.formData.goodsEntries).toEqual(ORDER.form_data.goodsEntries);
  });

  it("a posted bill is read-only", async () => {
    const posted = { ...ORDER, ledger_posting_status: "posted" };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { order: posted } }), { status: 200 }));
    render(<PurchaseBookingReportScreen orderId={ORDER.id} fetchImpl={fetchImpl as any} lang="en" onUpdate={() => {}} />);
    await screen.findByTestId("report-locked-note", {}, WAIT);
    expect((screen.getByTestId("remark-payment") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByTestId("report-update") as HTMLButtonElement).disabled).toBe(true);
  });
});
