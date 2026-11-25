// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SalesPaymentTransferRegister } from "@/features/sales/components/sales-payment-transfer-register";

const { apiGet, print } = vi.hoisted(() => ({ apiGet: vi.fn(), print: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiGet }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/lib/reports/print-dom-fragment", () => ({ printDomFragmentViaModal: print }));

const order = {
  id: "order-1", sales_order_no: "SB-0042", ledger_posting_status: "posted", order_total: 367.25,
  currency_code: "AED", paid_amount: 20, customer_name: "Example Customer",
  form_data: {
    form: { salesCurrency: "USD", exchangeRate: 3.6725, customerAccountNo: "CUST-1" },
    goodsEntries: [{ goodsName: "Walnut kernels", qtyNo: 1, qtyName: "Carton" }],
    transferTrace: { paymentId: "booking-payment", debitLedgerCode: "CUST-1", creditLedgerCode: "SALES-01", paymentKind: "advance",
      voucherNo: "SO-42", settlement: { originalAmount: 100, originalCurrency: "USD", finalAmount: 367.25, finalCurrency: "AED", exchangeRate: 3.6725, operator: "*" } },
  },
};

describe("Existing Sales Payment Transfer register", () => {
  beforeEach(() => { apiGet.mockReset(); print.mockReset(); });
  afterEach(cleanup);

  it("loads the posted-only Sales section and searches the incoming register by sales booking", async () => {
    apiGet.mockResolvedValue({ salesOrders: [order, { ...order, id: "draft", ledger_posting_status: "draft", sales_order_no: "DRAFT-001" }] });
    render(<SalesPaymentTransferRegister />);
    expect(await screen.findByText("SB-0042")).toBeTruthy();
    expect(screen.queryByText("DRAFT-001")).toBeNull();
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining("/api/erp/sales/orders?transferred=1"));
    expect(screen.getByRole("link", { name: "View" }).getAttribute("href")).toBe("/dashboard/sales/sales-order/view?id=order-1&transfer=1");
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "SB-0042" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(expect.stringContaining("q=SB-0042")));
  });

  it("uses the financial transfer detail lane and routes the remaining receipt to the existing journal", async () => {
    apiGet.mockImplementation(async (url: string) => url.includes("/payments")
      ? { payments: [{ id: "advance-1", status: "posted", payment_kind: "advance", currency_code: "AED", amount: 73.45 }] }
      : { order });
    render(<SalesPaymentTransferRegister orderId="order-1" />);
    expect(await screen.findByRole("heading", { name: /Sales Payment Transfer · SB-0042/ })).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith("/api/erp/sales/orders/order-1?transfer=1");
    expect(screen.getByRole("link", { name: "Post Payment Entry" }).getAttribute("href"))
      .toBe("/dashboard/journal/sales-order-payment/remaining?salesOrderNo=SB-0042");
    expect(screen.getAllByText("73.45 AED").length).toBeGreaterThan(0);
    expect(screen.getByText("293.8 AED")).toBeTruthy();
  });

  it("summarizes each booking once and never combines currencies or treats missing receipts as zero", async () => {
    const eur = { ...order, id: "order-2", sales_order_no: "SB-0043", order_total: 150, currency_code: "EUR",
      transferReceiptSummary: { received: null }, form_data: { form: {}, goodsEntries: [{ goodsName: "Beans" }] } };
    const aed = { ...order, transferReceiptSummary: { received: 73.45 }, form_data: {
      ...order.form_data, goodsEntries: [{ goodsName: "Walnut kernels" }, { goodsName: "Almond kernels" }],
    } };
    apiGet.mockResolvedValue({ salesOrders: [aed, eur] });
    render(<SalesPaymentTransferRegister />);
    const summary = within(await screen.findByRole("region", { name: "Transfers on this page" }));
    expect(summary.getByText("2")).toBeTruthy();
    expect(summary.getByText("367.25 AED")).toBeTruthy();
    expect(summary.getByText("150.00 EUR")).toBeTruthy();
    expect(summary.getAllByText("— EUR")).toHaveLength(2);
  });

  it("keeps the register compact by stacking goods, quantity and weights without losing their values", async () => {
    const goods = { goodsName: "Walnut kernels", brand: "Example Brand", lotNo: "LOT-42", qtyNo: 500, qtyName: "Boxes", grossWeight: 1200, netWeight: 1160 };
    apiGet.mockResolvedValue({ salesOrders: [{ ...order, form_data: { ...order.form_data, goodsEntries: [goods] } }] });
    render(<SalesPaymentTransferRegister />);
    const table = within(await screen.findByRole("table"));
    expect(table.getAllByRole("columnheader")).toHaveLength(12);
    const row = within(table.getByRole("row", { name: /SB-0042/ }));
    const goodsCell = row.getByRole("cell", { name: /Walnut kernels.*Example Brand.*LOT-42/ });
    expect(within(goodsCell).getByText("LOT-42")).toBeTruthy();
    const quantityCell = row.getByRole("cell", { name: /500.*Boxes/ });
    expect(within(quantityCell).getByText("500")).toBeTruthy();
    const weightCell = row.getByRole("cell", { name: /1,200 kg.*1,160 kg/ });
    expect(within(weightCell).getByText("1,160 kg")).toBeTruthy();
  });
});
