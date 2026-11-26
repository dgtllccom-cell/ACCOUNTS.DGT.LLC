// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AdvancePage from "@/app/dashboard/journal/sales-order-payment/advance/page";
import CreditPage from "@/app/dashboard/journal/sales-order-payment/charges/page";
import RemainingPage from "@/app/dashboard/journal/sales-order-payment/remaining/page";
import FinalPage from "@/app/dashboard/journal/sales-order-payment/final/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/lib/hooks/use-erp-scope", () => ({ useErpScope: () => ({ isSuperAdmin: true, canViewFinancials: true }) }));
vi.mock("@/lib/purchase-ui/use-usd-rates", () => ({ useUsdRates: () => ({}) }));

vi.mock("@/features/reports/ledger-report/ledger-report-api", () => ({ listLedgerReportLedgers: async () => ({ ledgers: [] }) }));

const order = (source: "SB" | "LS", tag: string, method: string, advancePercent: number, paid: number) => ({
  id: `${source}-${tag}`, sales_order_no: `${source}-${tag}`, ledger_posting_status: "posted",
  payment_status: paid >= 100 ? "completed" : paid > 0 ? "partially_paid" : "pending",
  paid_amount: paid, remaining_amount: 100 - paid, order_total: 367, currency_code: "AED", exchange_rate: 3.67,
  form_data: { form: { saleSource: source === "LS" ? "local" : "stock", saleMode: "local", paymentType: method, advancePercent },
    transferTrace: { settlement: { finalCurrency: "AED", originalCurrency: "USD", originalAmount: 100, finalAmount: 367, exchangeRate: 3.67, operator: "*" } } },
});
const tags = ["AD", "CR", "RE", "CL"] as const;
const rows = (["SB", "LS"] as const).flatMap(source => [
  order(source, "AD", "Advance", 30, 0),
  order(source, "CR", "Credit", 0, 0),
  order(source, "RE", "Advance", 30, 30),
  order(source, "CL", "Credit", 0, 100),
]);

const { printCopies, moduleHeader } = vi.hoisted(() => ({ printCopies: vi.fn(), moduleHeader: vi.fn() }));
vi.mock("@/features/journal/components/payment-module-approved-header", async importOriginal => {
  const actual = await importOriginal<typeof import("@/features/journal/components/payment-module-approved-header")>();
  return {
    ...actual,
    PaymentModuleHeader: (props: React.ComponentProps<typeof actual.PaymentModuleHeader>) => {
      moduleHeader(props.rows);
      return <actual.PaymentModuleHeader {...props} />;
    },
  };
});
vi.mock("@/lib/reports/sales-payment-receipt", () => ({
  printSalesReceiptCopies: printCopies, printSalesPaymentReceipt: vi.fn(),
}));
const fetchMock = vi.fn();
const body = (data: unknown) => Promise.resolve({ ok: true, json: async () => ({ ok: true, data }) } as Response);

beforeEach(() => {
  printCopies.mockClear();
  moduleHeader.mockClear();
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })));
  window.history.replaceState({}, "", "/");
  fetchMock.mockReset().mockImplementation((url: string) =>
    url.startsWith("/api/erp/sales/orders?") ? body({ salesOrders: rows, nextCursor: null }) : body([]));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Four Sales payment journal entrypoints with both source types", () => {
  it.each([
    ["Advance", () => AdvancePage({ searchParams: Promise.resolve({}) }), ["AD"]],
    ["Credit", () => CreditPage(), ["CR"]],
    ["Remaining", () => RemainingPage({ searchParams: Promise.resolve({}) }), ["RE"]],
    ["Final", () => FinalPage(), [...tags]],
  ] as const)("%s displays eligible Sales Booking and Local Sales rows and filters each source", async (_label, page, included) => {
    render(await page());
    await screen.findByText(`S#SB-${included[0]}`);
    expect(screen.getByText(`S#LS-${included[0]}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Sales Booking \(/i }));
    await waitFor(() => expect(screen.queryByText(`S#LS-${included[0]}`)).toBeNull());
    for (const tag of tags) expect(Boolean(screen.queryByText(`S#SB-${tag}`))).toBe((included as readonly string[]).includes(tag));
    fireEvent.click(screen.getByRole("button", { name: /^Local Sales \(/i }));
    await waitFor(() => expect(screen.queryByText(`S#SB-${included[0]}`)).toBeNull());
    for (const tag of tags) expect(Boolean(screen.queryByText(`S#LS-${tag}`))).toBe((included as readonly string[]).includes(tag));
  });
});


it.each(["SB", "LS"] as const)("reprints the same persisted %s receipt twice via history without a POST", async source => {
  const receipt = {
    orderId: `${source}-CL`, number: `VR-${source}-301`, bill: `${source}-CL`, date: "2026-11-25",
    customer: "Test buyer", local: source === "LS", amount: 367, currency: "AED", method: "cash", reference: "A-301",
  };
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith("/api/erp/sales/orders?")) return body({ salesOrders: rows, nextCursor: null });
    if (url.startsWith(`/api/erp/sales/orders/${source}-CL/payments`)) return body({ payments: [{
      id: "existing-receipt", kind: "credit", entry_date: "2026-11-25", amount: 367, currency_code: "AED",
      status: "posted", receipt, roznamcha_entries: { status: "posted", voucher_no: receipt.number },
    }] });
    return body([]);
  });
  render(FinalPage());
  const bill = await screen.findByRole("button", { name: `S#${source}-CL` });
  fireEvent.click(bill.closest("tr")!);
  const actions = await screen.findByLabelText("Payment actions");
  const menu = actions.closest("details")!;
  menu.open = true;
  fireEvent.click(within(menu).getByRole("button", { name: "Print Receipt" }));
  menu.open = true;
  fireEvent.click(within(menu).getByRole("button", { name: "Print Receipt" }));
  expect(printCopies).toHaveBeenCalledTimes(2);
  expect(printCopies).toHaveBeenNthCalledWith(1, receipt, "en");
  expect(printCopies).toHaveBeenNthCalledWith(2, receipt, "en");
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

it.each([
  ["AED", false, "Entry: 20.00 USD", "Entry: 73.40 AED"],
  ["AED", true, "Entry: 73.40 AED", "Entry: 73.40 AED"],
  ["KWD", false, "Entry: 73.40 KWD", "Entry: —"],
] as const)("keeps history in verified bill currencies for %s settlement (no verified inverse = %s)", async (currency, missingRate, expectedOriginal, expectedBase) => {
  const record = order("LS", "RE", "Advance", 30, 30);
  if (missingRate) Object.assign(record.form_data.transferTrace.settlement, { exchangeRate: 0 });
  fetchMock.mockImplementation((url: string) => url.startsWith("/api/erp/sales/orders?")
    ? body({ salesOrders: [record], nextCursor: null })
    : url.includes("/LS-RE/payments") ? body({ payments: [{
      id: "persisted-fx", kind: "remaining", entry_date: "2026-11-25", amount: 73.4,
      currency_code: currency, exchange_rate: 1, status: "posted", reference_no: "QA-73",
    }] }) : body([]));
  render(FinalPage());
  fireEvent.click((await screen.findByRole("button", { name: "S#LS-RE" })).closest("tr")!);
  const paymentRow = (await screen.findByText("Ref: QA-73")).closest("tr")!;
  expect(paymentRow.textContent).toContain(expectedOriginal);
  expect(paymentRow.textContent).toContain(expectedBase);
  expect(paymentRow.textContent).not.toContain("Entry: 73.40 USD");
});


const cents = (source: "SB" | "LS", tag: string, method: string, open = true) => {
  const record = order(source, tag, method, method === "Advance" ? 30 : 0, 100);
  const fx = source === "LS";
  const due = open ? (fx ? 0.0027 : 0.01) : 0;
  return {
    ...record, payment_status: "partially_paid", paid_amount: 100 - due, remaining_amount: due,
    form_data: { ...record.form_data, transferTrace: { settlement: {
      ...record.form_data.transferTrace.settlement,
      originalCurrency: fx ? "USD" : "AED", finalAmount: fx ? 367 : 100, exchangeRate: fx ? 3.67 : 1,
    } } },
  };
};

it.each([
  ["Cash", "cash"],
  ["Account Transfer", "account-transfer"],
  ["Advance", "remaining"],
  ["Credit", "credit"],
] as const)("%s keeps a payable final cent on both Sales sources and removes zero", async (method, lane) => {
  const fixtureOrders = (["SB", "LS"] as const).flatMap(source => [cents(source, "CENT", method), cents(source, "ZERO", method, false)]);
  fetchMock.mockImplementation((url: string) => url.startsWith("/api/erp/sales/orders?")
    ? body({ salesOrders: fixtureOrders, nextCursor: null }) : body([]));
  render(lane === "remaining" ? await RemainingPage({ searchParams: Promise.resolve({}) }) :
    lane === "credit" ? CreditPage() : await AdvancePage({ searchParams: Promise.resolve({ payment: lane }) }));
  await screen.findByRole("button", { name: "S#SB-CENT" });
  for (const source of ["SB", "LS"]) {
    expect(screen.queryByRole("button", { name: `S#${source}-ZERO` })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Payment Entry ${source}-CENT` }));
    const entry = await screen.findByRole("dialog", { name: "New Roznamcha Entry" });
    const form = within(entry);
    const balance = form.getByText("Outstanding Balance");
    expect(balance.parentElement?.textContent).toMatch(/(?:AED\s*0\.01|0\.01\s*AED)/);
    const type = form.getByLabelText("Roznamcha Type") as HTMLSelectElement;
    const channel = form.getByLabelText("Payment Type / Channel") as HTMLSelectElement;
    const condition = form.getByLabelText("Payment Condition") as HTMLInputElement;
    const locked = lane === "cash" || lane === "account-transfer";
    expect(condition.value).toBe(lane === "credit" ? "Credit Payment" : "Remaining Payment");
    expect(condition.readOnly).toBe(true);
    expect([type.disabled, channel.disabled]).toEqual([locked, locked]);
    expect([type.value, channel.value]).toEqual(Array(2).fill(lane === "account-transfer" ? "bank" : "cash"));
    if (!locked) {
      fireEvent.change(type, { target: { value: "bank" } });
      expect(channel.value).toBe("bank");
      expect(form.getByText("Bank Account", { exact: true })).toBeTruthy();
      expect(form.queryByPlaceholderText("Enter name")).toBeNull();
      expect(condition.value).toBe(lane === "credit" ? "Credit Payment" : "Remaining Payment");
    } else if (lane === "cash") {
      expect(form.getByPlaceholderText("Enter name")).toBeTruthy();
      expect(form.queryByText("Bank Account", { exact: true })).toBeNull();
    } else {
      expect(form.getByText("Bank Account", { exact: true })).toBeTruthy();
      expect(form.queryByPlaceholderText("Enter name")).toBeNull();
    }
    fireEvent.click(form.getByRole("button", { name: "Close" }));
  }
  expect(moduleHeader.mock.calls.at(-1)?.[0]).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "LS-CENT", due: 0.01, paid: 366.99, total: 367, currency: "AED", settled: false }),
    expect.objectContaining({ id: "SB-CENT", due: 0.01, settled: false }),
    expect.objectContaining({ id: "LS-ZERO", due: 0, settled: true }),
    expect.objectContaining({ id: "SB-ZERO", due: 0, settled: true }),
  ]));
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

const shortcutInvoiceId = "d3c6b091-4f48-42cc-9bea-c42ab19cb934";
const shortcutOrderId = "5edac6a2-4013-4a24-bd70-58176dd90d8d";
async function invoiceShortcut(source: "SB" | "LS", billState: "ready" | "zero" | "draft" | "missing-review", invoiceState: string) {
  let record = { ...cents(source, "INV", "Invoice", billState !== "zero"), id: shortcutOrderId };
  if (billState === "draft") record.ledger_posting_status = "draft";
  if (billState === "missing-review") record = { ...record, form_data: { ...record.form_data, transferTrace: {} } } as typeof record;
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith(`/api/erp/sales/orders/${shortcutOrderId}?transfer=1`)) return body({ order: record });
    if (url.startsWith(`/api/erp/business-edit-invoices/${shortcutInvoiceId}`)) return body({ invoice: {
      id: shortcutInvoiceId, sourceId: record.id, sourceTable: "sales_orders", txnKind: "sales",
      sourceModule: source === "LS" ? "local_sales" : "sales_booking", status: invoiceState, docType: "commercial_invoice",
    } });
    return body([]);
  });
  render(await RemainingPage({ searchParams: Promise.resolve({ orderId: record.id, invoiceId: shortcutInvoiceId }) }));
}

it.each(["SB", "LS"] as const)("opens the %s finalized invoice shortcut only for its reviewed payable cent", async source => {
  await invoiceShortcut(source, "ready", "finalized");
  expect(await screen.findByRole("dialog", { name: "New Roznamcha Entry" })).toBeTruthy();
  expect(fetchMock.mock.calls.some(([url]) => url.includes(shortcutInvoiceId))).toBe(true);
});

it.each(["zero", "draft", "missing-review"] as const)("does not open or offer an invoice receipt for a %s bill", async state => {
  await invoiceShortcut("LS", state, "finalized");
  await screen.findByText("Receipt is not available for this sales bill and payment stage.");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(fetchMock.mock.calls.some(([url]) => url.includes(shortcutInvoiceId))).toBe(false);
});

it("does not open a draft invoice shortcut even if the original bill itself has one payable cent", async () => {
  await invoiceShortcut("SB", "ready", "draft");
  await screen.findByText("A finalized invoice linked to the original sales bill is required.");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("does not let a bare bill-number URL bypass the selected payment stage", async () => {
  window.history.replaceState({}, "", "/?salesOrderNo=LS-CR");
  render(await RemainingPage({ searchParams: Promise.resolve({}) }));
  expect(await screen.findByRole("button", { name: "S#LS-RE" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "S#LS-CR" })).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});


it("keeps a zero-balance bill visible for Final reconciliation without a payment shortcut", async () => {
  const record = cents("LS", "ZERO", "Cash", false);
  fetchMock.mockImplementation((url: string) => url.startsWith("/api/erp/sales/orders?")
    ? body({ salesOrders: [record], nextCursor: null }) : body({ payments: [] }));
  render(FinalPage());
  fireEvent.click((await screen.findByRole("button", { name: "S#LS-ZERO" })).closest("tr")!);
  expect(await screen.findByText(/No payment transactions posted yet/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /payment entry/i })).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it.each(["SB", "LS"] as const)("opens the matching Roznamcha fields and keeps the bill condition for %s", async source => {
  render(await AdvancePage({ searchParams: Promise.resolve({}) }));
  fireEvent.click(await screen.findByRole("button", { name: `Payment Entry ${source}-AD` }));
  const form = within(await screen.findByRole("dialog", { name: "New Roznamcha Entry" }));
  const condition = form.getByLabelText("Payment Condition") as HTMLInputElement;
  const type = form.getByLabelText("Roznamcha Type") as HTMLSelectElement;
  const channel = form.getByLabelText("Payment Type / Channel") as HTMLSelectElement;

  expect(condition.readOnly).toBe(true);
  expect(condition.value).toBe("Advance Payment");
  expect([type.value, channel.value]).toEqual(["cash", "cash"]);
  expect(form.getByPlaceholderText("Enter name")).toBeTruthy();
  expect(form.queryByText("Bank Account", { exact: true })).toBeNull();
  fireEvent.change(type, { target: { value: "bank" } });
  expect([type.value, channel.value]).toEqual(["bank", "bank"]);
  expect(form.getByText("Bank Account", { exact: true })).toBeTruthy();
  expect(form.queryByPlaceholderText("Enter name")).toBeNull();
  expect(condition.value).toBe("Advance Payment");
  fireEvent.change(channel, { target: { value: "cash" } });
  expect([type.value, channel.value]).toEqual(["cash", "cash"]);
  expect(form.getByPlaceholderText("Enter name")).toBeTruthy();
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

it.each([
  ["SB", "stock"],
  ["SB", "endorse"],
  ["LS", "local"],
] as const)("shows channel controls in the actual classic Advance row action for %s / %s", async (source, saleSource) => {
  const payType = saleSource === "endorse" ? "Endorsement" : "Advance";
  const { transferTrace: _unused, ...legacyData } = order(source, "LEGACY", payType, 30, 0).form_data;
  const record = { ...order(source, "LEGACY", payType, 30, 0), form_data: {
    ...legacyData, form: { ...legacyData.form, saleSource, saleType: saleSource }
  } };
  fetchMock.mockImplementation((url: string) => url.startsWith("/api/erp/sales/orders?")
    ? body({ salesOrders: [record], nextCursor: null }) : body({ payments: [] }));
  render(await AdvancePage({ searchParams: Promise.resolve({}) }));
  const bill = await screen.findByRole("button", { name: `S#${source}-LEGACY` });
  fireEvent.click(within(bill.closest("tr")!).getByRole("button", { name: "Row actions" }));
  fireEvent.click(await screen.findByRole("button", { name: "Payment Entry", exact: true }));
  await screen.findByRole("heading", { name: /Payment Entry - PO/ });
  const form = within(screen.getByLabelText("Roznamcha Type").closest("form")!);
  const condition = form.getByLabelText("Payment Condition") as HTMLInputElement;
  const type = form.getByLabelText("Roznamcha Type") as HTMLSelectElement;
  const channel = form.getByLabelText("Payment Type / Channel") as HTMLSelectElement;
  expect(condition.readOnly).toBe(true);
  expect(condition.value).toBe(saleSource === "endorse" ? "Endorsement" : "Advance Payment");
  expect(form.getByLabelText("Party Name")).toBeTruthy();
  expect(form.getByLabelText("Mobile No.")).toBeTruthy();
  expect(form.getByLabelText("Download ID")).toBeTruthy();
  fireEvent.change(type, { target: { value: "bank_transfer" } });
  expect(channel.value).toBe("bank_transfer");
  expect(form.getByText(/Bank Transfer Details/)).toBeTruthy();
  expect(form.queryByLabelText("Party Name")).toBeNull();
  expect(condition.value).toBe(saleSource === "endorse" ? "Endorsement" : "Advance Payment");
  fireEvent.change(channel, { target: { value: "cash" } });
  expect(type.value).toBe("cash");
  expect(form.getByLabelText("Party Name")).toBeTruthy();
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

describe.each(["SB", "LS"] as const)("existing %s payment routes", source => {
  it.each([
    ["Credit Payment", "Credit", 0, 0, () => CreditPage()],
    ["Remaining Payment", "Advance", 30, 30, () => RemainingPage({ searchParams: Promise.resolve({}) })],
    ["Final Payment", "Credit", 0, 0, () => FinalPage()],
  ] as const)("keeps the %s stage when opening the classic form", async (stage, method, advance, paid, page) => {
    const original = order(source, "OLD", method, advance, paid);
    // Classic balances are already expressed in the order total's currency.
    if (stage === "Remaining Payment") Object.assign(original, { paid_amount: 115, remaining_amount: 252 });
    const { transferTrace: _unused, ...oldData } = original.form_data;
    fetchMock.mockImplementation((url: string) => url.startsWith("/api/erp/sales/orders?")
      ? body({ salesOrders: [{ ...original, form_data: oldData }], nextCursor: null }) :
        url.startsWith("/api/erp/sales/loading-records?") ? body({ records: [{
          id: "test-loading", loading_status: "loaded", loading_record_no: "QA-01",
          report_payload: { loadedQuantity: 1, netWeight: 20, grossWeight: 21, priceRateC1: 100 }
        }] }) : body({ payments: [] }));
    render(await page());
    const bill = await screen.findByRole("button", { name: `S#${source}-OLD` });
    fireEvent.click(within(bill.closest("tr")!).getByRole("button", { name: "Row actions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Payment Entry", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Open Existing Payment Form" }));
    if (stage === "Remaining Payment") fireEvent.click(await screen.findByRole("button", { name: /Container #QA-01/ }));
    const channel = await screen.findByLabelText("Payment Type / Channel") as HTMLSelectElement;
    fireEvent.change(channel, { target: { value: "bank_transfer" } });
    expect((screen.getByLabelText("Payment Condition") as HTMLInputElement).value).toBe(stage);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
});
