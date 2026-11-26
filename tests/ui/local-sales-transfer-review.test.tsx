// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SalesBookingGlobalRegisterView } from "@/features/sales/components/sales-booking-global-register-view";

const { apiGet, apiFetch, push } = vi.hoisted(() => ({ apiGet: vi.fn(), apiFetch: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("source=local"),
  useRouter: () => ({ push }),
}));
vi.mock("@/lib/api/client", () => ({ apiGet, apiFetch }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/components/invoices/invoice-document-view", () => ({ InvoiceDocumentView: () => null }));
vi.mock("@/features/document-intelligence/components/entry-method-selector", () => ({ EntryMethodSelector: () => null }));
vi.mock("@/features/sales/components/sales-order-wizard.jsx", () => ({ SalesOrderWizard: () => null }));

const localId = "634bf302-2cc0-469d-b148-947e205665c2";
const salesId = "a237f271-2948-4e45-b9a4-4a08bc9764c9";
const localForm = { saleSource: "local", saleMode: "local", customerAccountName: "Local customer", salesAccountName: "Local Sales Income", salesCurrency: "AED", secondaryCurrency: "AED", paymentType: "Credit" };
const order = {
  id: localId, sales_order_no: "LS-101", sales_status: "pending", order_total: 300, currency_code: "AED",
  form_data: { form: localForm, goodsEntries: [{ goodsName: "Local goods", qtyNo: 3, qtyName: "BAGS", totalAmount: 300, finalAmount: 300 }] },
};
const local = { id: localId, salesBookingOrderNumber: "LS-101", status: "pending", ledger_posting_status: "draft", form_data: order.form_data };
const regular = { id: salesId, salesBookingOrderNumber: "SB-100", status: "pending", form_data: { form: { saleSource: "stock", saleMode: "local" } } };
const session = { canViewFinancials: true, permissions: ["sales:read", "sales:post"] };

describe("Local Sales row Transfer", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    apiFetch.mockReset();
    apiGet.mockReset().mockImplementation(async (url: string) => url.includes("booking-journal")
      ? { reports: [local, regular], nextCursor: null }
      : { order });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("shows the verified full report from the row without writing, then posts once with a stable retry key", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Connection interrupted")).mockResolvedValueOnce({
      ledgerPostingStatus: "posted", salesOrderNo: "LS-101",
      transferVerification: { voucherNo: "VR-LS-101", debitAmount: 300, debitCurrency: "AED", creditAmount: 300, creditCurrency: "AED" },
    });
    render(<SalesBookingGlobalRegisterView session={session} lang="en" initialSource="local" />);
    expect(await screen.findByRole("button", { name: "Actions LS-101" })).toBeTruthy();
    expect(screen.queryByText("SB-100")).toBeNull();
    expect(screen.getByRole("link", { name: "Local Sales Transfer Payment" }).getAttribute("href")).toBe("/dashboard/sales/sales-order?transfer=1&source=local");
    expect(apiGet).toHaveBeenCalledWith(expect.stringMatching(/booking-journal-report.*source=local/));
    fireEvent.click(screen.getByRole("button", { name: "Actions LS-101" }));
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    const report = await screen.findByRole("dialog", { name: "Local Sales Transfer Verification Report" });
    // the goods line is listed in both the Warehouse / Stock Source and the Goods Details tables
    expect((await within(report).findAllByText("Local goods")).length).toBe(2);
    expect(apiGet).toHaveBeenCalledWith(`/api/erp/sales/orders/${localId}?transfer=1&source=local`);
    expect(apiFetch).not.toHaveBeenCalled();
    fireEvent.click(within(report).getByRole("button", { name: "Transfer / Post" }));
    expect((await within(report).findByRole("alert")).textContent).toContain("Connection interrupted");
    fireEvent.click(within(report).getByRole("button", { name: "Transfer / Post" }));
    expect(await within(report).findByText("VR-LS-101")).toBeTruthy();
    const [first, second] = apiFetch.mock.calls;
    expect(first[0]).toBe(`/api/erp/sales/orders/${localId}/transfer`);
    expect(first[1]).toMatchObject({ method: "POST", body: JSON.stringify({ transferRegister: true, source: "local" }) });
    expect(first[1].headers["Idempotency-Key"]).toMatch(/^local-sales-transfer-/);
    expect(second[1].headers["Idempotency-Key"]).toBe(first[1].headers["Idempotency-Key"]);
    expect(within(report).queryByRole("button", { name: "Transfer / Post" })).toBeNull();
  });

  it("does not let a read-only financial login start posting", async () => {
    render(<SalesBookingGlobalRegisterView session={{ ...session, permissions: ["sales:read"] }} lang="en" initialSource="local" />);
    fireEvent.click(await screen.findByRole("button", { name: "Actions LS-101" }));
    expect(screen.queryByRole("button", { name: "Transfer" })).toBeNull();
    await waitFor(() => expect(apiFetch).not.toHaveBeenCalled());
  });
});
