import React from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within, act } from "@testing-library/react";
import { PurchaseBookingReportScreen } from "@/features/purchases/components/purchase-booking-report";

const ORDER = {
  id: "8cd5a174-8354-4faf-b646-e0558ee5426c",
  purchase_order_no: "AE-001-0005",
  updated_at: "2026-11-23T10:00:00.000000Z",
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
  it("renders the saved booking and View opens the two-page A4 contract document", async () => {
    const fetchImpl = mockFetch();
    const brandingLoader = vi.fn(async () => ({ entityName: "Test Trading LLC", address: "Deira, Dubai", phone: "+971 4 000 0000" }));
    render(<PurchaseBookingReportScreen orderId={ORDER.id} fetchImpl={fetchImpl as any} brandingLoader={brandingLoader} lang="en" />);
    await screen.findByText("BLACK MAFTA", {}, WAIT);
    expect(screen.getAllByTestId("goods-rate")[0].textContent).toBe("÷ 77.2");
    expect(screen.getAllByTestId("goods-final")[0].textContent).toBe("262,305.70");
    expect(screen.queryByTestId("purchase-booking-report-view")).toBeNull();

    fireEvent.click(screen.getByTestId("report-view"));
    const view = await screen.findByTestId("purchase-booking-report-view", {}, WAIT);
    expect(view.getAttribute("role")).toBe("dialog");
    const frame = await within(view).findByTestId("purchase-booking-contract-frame", {}, WAIT);
    const html = frame.getAttribute("srcdoc") || "";
    expect(html.match(/<section class="page/g)?.length).toBe(2);
    expect(html).toContain("Purchase Contract");
    expect(html).toContain("Contract Report &amp; Annexure");
    expect(html).toContain("Test Trading LLC");
    expect(html).toContain("÷ 77.2");
    expect(html).toContain("AED 262,305.70");
    expect(html).toContain("AE-001-0005");
    expect(brandingLoader).toHaveBeenCalled();
    expect((within(view).getByTestId("report-print") as HTMLButtonElement).disabled).toBe(false);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("purchase-booking-report-view")).toBeNull(), WAIT);
  });

  it("a remarks Save sends the saved version and reason with the one changed field", async () => {
    const prompt = vi.spyOn(window, "prompt").mockReturnValueOnce("Clarify payment terms");
    const fetchImpl = mockFetch();
    render(<PurchaseBookingReportScreen orderId={ORDER.id} fetchImpl={fetchImpl as any} lang="en" />);
    const box = await screen.findByTestId("remark-payment", {}, WAIT);
    fireEvent.change(box, { target: { value: "Credit 30 days" } });
    fireEvent.click(screen.getByTestId("remark-save-payment"));
    await screen.findByText("Saved", {}, WAIT);
    const patch = fetchImpl.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PATCH")!;
    expect(patch[0]).toBe(`/api/erp/purchases/orders/${ORDER.id}`);
    const body = JSON.parse(String((patch[1] as RequestInit).body));
    expect(body.expectedUpdatedAt).toBe(ORDER.updated_at);
    expect(body.editReason).toBe("Clarify payment terms");
    prompt.mockRestore();
    expect(body.formData.form.paymentReport).toBe("Credit 30 days");
    expect(body.formData.goodsEntries).toEqual(ORDER.form_data.goodsEntries);
  });

  it("keeps a typed remark when current bill details refresh while the editor is open", async () => {
    // a correction to a saved booking asks for its reason (PR #236)
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("Correction reason");
    onTestFinished(() => prompt.mockRestore());
    let stored = ORDER;
    let nextGet: Promise<Response> | null = null;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return new Response(JSON.stringify({ ok: true, data: { purchaseOrderId: ORDER.id } }));
      if (nextGet) { const response = nextGet; nextGet = null; return response; }
      return new Response(JSON.stringify({ ok: true, data: { order: stored } }));
    });
    const props = { orderId: ORDER.id, fetchImpl: fetchImpl as any, lang: "en" };
    const view = render(<PurchaseBookingReportScreen {...props} reloadToken={0} />);
    const box = await screen.findByTestId("remark-payment", {}, WAIT) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "Credit 30 days" } });
    expect(box.value).toBe("Credit 30 days");

    stored = {
      ...ORDER,
      form_data: {
        ...ORDER.form_data,
        goodsEntries: [{ ...ORDER.form_data.goodsEntries[0], goodsName: "REFRESHED GOODS", totalAmount: 20_300_000 }],
        totals: { ...ORDER.form_data.totals, grandPrimaryFinal: 20_300_000 },
      },
    };
    let resolveRefresh!: (value: Response) => void;
    nextGet = new Promise<Response>((resolve) => { resolveRefresh = resolve; });
    view.rerender(<PurchaseBookingReportScreen {...props} reloadToken={1} />);
    await act(async () => { resolveRefresh(new Response(JSON.stringify({ ok: true, data: { order: stored } }))); });
    expect(screen.getByText("REFRESHED GOODS")).toBeTruthy();
    expect((screen.getByTestId("remark-payment") as HTMLTextAreaElement).value).toBe("Credit 30 days");
    fireEvent.click(screen.getByTestId("remark-save-payment"));
    await screen.findByText("Saved", {}, WAIT);
    const patch = fetchImpl.mock.calls.find(([, init]) => init?.method === "PATCH");
    const body = JSON.parse(String(patch?.[1]?.body));
    expect(body.formData.form.paymentReport).toBe("Credit 30 days");
    expect(body.formData.goodsEntries).toEqual(stored.form_data.goodsEntries);
  });

  it("does not carry an editor or a delayed save response to another booking", async () => {
    // a correction to a saved booking asks for its reason (PR #236)
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("Correction reason");
    onTestFinished(() => prompt.mockRestore());
    const second = { ...ORDER, id: "91a6d6a5-a138-4442-9b04-3afcbf312dfd", purchase_order_no: "AE-001-0006",
      form_data: { ...ORDER.form_data, form: { ...ORDER.form_data.form, paymentReport: "Second booking payment note" } } };
    let resolveSecond!: (res: Response) => void;
    let resolvePatch!: (res: Response) => void;
    const next = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    const patch = new Promise<Response>((resolve) => { resolvePatch = resolve; });
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return patch;
      if (url.includes(second.id)) return next;
      return new Response(JSON.stringify({ ok: true, data: { order: ORDER } }));
    });
    const props = { fetchImpl: fetchImpl as any, lang: "en" };
    const view = render(<PurchaseBookingReportScreen {...props} orderId={ORDER.id} />);
    fireEvent.change(await screen.findByTestId("remark-payment", {}, WAIT), { target: { value: "First booking note" } });
    fireEvent.click(screen.getByTestId("remark-save-payment"));
    await waitFor(() => expect(fetchImpl.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true), WAIT);

    view.rerender(<PurchaseBookingReportScreen {...props} orderId={second.id} />);
    expect(screen.queryByTestId("remark-payment")).toBeNull();
    await act(async () => { resolveSecond(new Response(JSON.stringify({ ok: true, data: { order: second } }))); });
    expect(screen.getByText("Second booking payment note")).toBeTruthy();
    await act(async () => { resolvePatch(new Response(JSON.stringify({ ok: true }))); });
    expect(screen.getByText("Second booking payment note")).toBeTruthy();
    expect(screen.queryByText("First booking note")).toBeNull();
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
