import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.setConfig({ testTimeout: 20000 }); // full-suite load: these register tests need more than the 5s default (same as the 20000 used on individual tests)
import { act, cleanup, configure, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/journal/purchase-order-payment/remaining", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/lib/hooks/use-erp-scope", () => ({ useErpScope: () => ({ loading: false, isSuperAdmin: true, canViewFinancials: true, countryIds: [], countryBranchIds: [], cityBranchIds: [], permissions: [], roles: [] }) }));
vi.mock("@/lib/purchase-ui/use-usd-rates", () => ({ useUsdRates: () => ({}) }));
vi.mock("@/features/journal/components/payment-module-approved-header", () => ({ PaymentModuleHeader: ({ toolbar }: any) => toolbar, useModulePayments: () => [] }));
vi.mock("@/features/journal/components/payment-journal-v2-header", () => ({ PaymentJournalV2Header: () => null }));
vi.mock("@/features/journal/components/payment-journal-v2-filter-modal", () => ({ PaymentJournalV2FilterModal: () => null }));
import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";
const order = {
  id: "11111111-1111-4111-8111-111111111111", purchase_order_no: "AE-001-0007", currency_code: "USD", exchange_rate: 3.67,
  loaded_loading_count: 1, order_total: 4252612.5, total_goods_original: 1158750, advance_paid: 115875, remaining_paid: 0, remaining_due: 1042875, status: "posted", ledger_posting_status: "posted", created_at: "2026-11-01",
  form_data: { form: { paymentType: "Advance", advancePercent: 10, supplierName: "Supplier", branchCountry: "United Arab Emirates", purchaseAccountNo: "DR-1", salesAccountNo: "CR-1" }, goodsEntries: [{ goodsName: "Walnuts", qtyNo: 22500, qtyName: "Cartons", totalAmount: 1158750, netWeight: 225000 }] }
};
const loading = { id: "22222222-2222-4222-8222-222222222222", purchase_order_id: order.id, loading_record_no: "LOAD-1", loaded_quantity: 2250, net_weight: 22500, gross_weight: 22725, loading_status: "loaded" };
const due = { id: order.id, billNo: order.purchase_order_no, currency: "USD", exchangeRate: 3.67, loadings: [{ id: loading.id, loadingNo: "LOAD-1", quantity: 2250, netWeightKg: 22500, grossWeightKg: 22725, value: 115875, advanceAllocated: 11587.5, paid: 0, outstanding: 104287.5 }] };
let localRecords: any[] = [];
let dueFailure = false;
let batches = due.loadings;
beforeEach(() => {
  configure({ asyncUtilTimeout: 10000 });
  window.history.replaceState({}, "", "/dashboard/journal/purchase-order-payment/remaining");
  localRecords = []; dueFailure = false; batches = due.loadings;
  vi.stubGlobal("React", React);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (input: string, options?: RequestInit) => {
    if (options?.method === "POST") throw new Error("No writes expected");
    let data: any = {};
    if (input.includes("remaining-due")) {
      if (dueFailure && input.includes("orderNo=")) return { ok: false, json: async () => ({ ok: false, error: { message: "Verified loading service unavailable" } }) };
      data = { bills: [{ ...due, loadings: batches }] };
    }
    else if (input.includes("loading-records")) data = { records: [loading] };
    else if (input.includes("local-purchase")) data = { purchases: localRecords };
    else if (input.includes("/payments")) data = { payments: [] };
    else if (input.includes("orders?")) data = { orders: [order] };
    else if (input.includes("auth/session")) data = { id: "user", isSuperAdmin: true, scopes: { isSuperAdmin: true } };
    else if (input.includes("countries")) data = { countries: [] };
    else if (input.includes("ledgers")) data = { ledgers: [] };
    return { ok: true, json: async () => ({ ok: true, data }) };
  }));
});
afterEach(() => { window.history.replaceState({}, "", "/"); cleanup(); vi.unstubAllGlobals(); });
it("opens the booking Remaining entry from the actual Journal button", async () => {
  render(<PurchaseOrderPaymentJournal mode="remaining" paymentPage />);
  const billCell = await screen.findByText("AE-001-0007");
  const row = billCell.closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: /journal/i }));
  expect(await screen.findByTestId("payment-entry-shell")).toBeTruthy();
  expect(await screen.findByText(/P#AE-001-0007/)).toBeTruthy();
  const panel = screen.getByTestId("payment-entry-shell");
  await waitFor(() => expect(document.activeElement).toBe(panel));
  expect(panel.id).toBe("ledger-cash-entry-section");
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  expect(screen.getByTestId("ppe-selected-loading-summary").textContent).toContain("2,250");
});

it("shows multiple payable loadings and opens the entry form after a delayed batch choice", async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", vi.fn(callback => { frames.push(callback); return frames.length; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  batches = [...due.loadings, { ...due.loadings[0], id: "33333333-3333-4333-8333-333333333333", loadingNo: "LOAD-2", quantity: 1000, value: 50000, outstanding: 45000 }];
  window.history.replaceState({}, "", `/dashboard/journal/purchase-order-payment/remaining?purchaseOrderNo=${order.purchase_order_no}`);
  render(<PurchaseOrderPaymentJournal mode="remaining" paymentPage />);
  const choices = await screen.findAllByTestId("remaining-payable-loading");
  expect(choices).toHaveLength(2);
  expect(screen.queryByTestId("payment-entry-document")).toBeNull();
  act(() => { for (let i = 0; i < 125; i++) frames.shift()?.(i * 16); });
  fireEvent.click(choices[1]);
  const summary = await screen.findByTestId("ppe-selected-loading-summary");
  expect(summary.textContent).toContain("LOAD-2");
  expect(summary.textContent).toContain("1,000");
  fireEvent.click(screen.getByTestId("ppe-new-payment"));
  await waitFor(() => expect(screen.getByTestId("ppe-entry-slot").childElementCount).toBeGreaterThan(0));
  expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});

it("shows a failed per-order loading request and retries without posting", async () => {
  dueFailure = true;
  render(<PurchaseOrderPaymentJournal mode="remaining" paymentPage />);
  const row = (await screen.findByText("AE-001-0007")).closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: /journal/i }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Verified loading service unavailable");
  dueFailure = false;
  fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
  expect(await screen.findByTestId("payment-entry-document")).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});

it("keeps Local Purchase entry working and can return to a Booking entry", async () => {
  localRecords = [{ id: "44444444-4444-4444-8444-444444444444", manual_bill_no: "LP-12", payment_mode: "Advance", advance_percentage: 40, advance_amount: 40, remaining_balance: 60, final_cost: 100, quantity_kgs: 10, numbers: 10, goods_name: "Almonds", status: "posted", purchase_currency: "AED", exchange_rate: 1 }];
  render(<PurchaseOrderPaymentJournal mode="remaining" paymentPage />);
  const row = (await screen.findByText("LP-12")).closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: /journal/i }));
  expect(await screen.findByTestId("payment-entry-document")).toBeTruthy();
  fireEvent.click(screen.getByTestId("ppe-new-payment"));
  await waitFor(() => expect(screen.getByTestId("ppe-entry-slot").childElementCount).toBeGreaterThan(0));
  fireEvent.click(screen.getByTestId("ppe-back"));
  const booking = (await screen.findByText("AE-001-0007")).closest("tr")!;
  fireEvent.click(within(booking).getByRole("button", { name: /journal/i }));
  expect(await screen.findByTestId("ppe-selected-loading-summary")).toBeTruthy();
  expect(screen.getAllByTestId("ppe-entry-slot")).toHaveLength(1);
  expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});

it("returns a settled loading to the Remaining register and clears stale entry URL hints", async () => {
  window.history.replaceState({}, "", `/dashboard/journal/purchase-order-payment/remaining?purchaseOrderNo=${order.purchase_order_no}&fromLoading=true&loadingRecordId=${loading.id}&lang=ur`);
  batches = [{ ...due.loadings[0], paid: 104287.5, outstanding: 0, complete: true } as any];
  render(<PurchaseOrderPaymentJournal mode="remaining" paymentPage />);
  expect(await screen.findByTestId("remaining-select-loading")).toBeTruthy();
  expect(await screen.findByText(/Loading History · Paid in full/)).toBeTruthy();
  expect(screen.queryByText(/No verified loaded quantity/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Back to Register" }));
  expect(await screen.findByRole("columnheader", { name: "BILL NO., DATE" })).toBeTruthy();
  expect(screen.queryByTestId("remaining-select-loading")).toBeNull();
  expect(screen.queryByTestId("payment-entry-shell")).toBeNull();
  expect(window.location.search).toBe("?lang=ur");
  await act(async () => { fireEvent.click(screen.getByTitle("Refresh")); });
  await waitFor(() => expect(screen.queryByTestId("payment-entry-shell")).toBeNull());
  expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
}, 20000); // the redesigned remaining register renders heavier than the 5s default in jsdom
