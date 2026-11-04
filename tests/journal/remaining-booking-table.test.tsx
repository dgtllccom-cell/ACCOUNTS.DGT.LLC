import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { remainingBookingRow, uniqueBookingRows } from "@/lib/journal/remaining-booking-table";
import { SourceFilteredTable } from "@/features/journal/components/source-filtered-table";
import { RemainingBookingTable } from "@/features/journal/components/remaining-booking-table";
import { PurchasePaymentEntryDocument } from "@/features/journal/components/purchase-payment-entry-document";
import { buildPaymentEntryModel } from "@/lib/journal/purchase-payment-entry-model";

const bill = (over: Record<string, any> = {}) => ({
  id: "bill-one", purchase_order_no: "AE-001-0007", currency_code: "USD", base_currency: "AED", exchange_rate: 3.67,
  order_total: 4252612.5, advance_paid: 115875, remaining_paid: 0, remaining_due: 1042875,
  form_data: { form: { loadingCountry: "China", loadingPort: "Tianjin", receivedCountry: "UAE", receivedPort: "Jebel Ali", receivedDate: "2026-11-04" },
    goodsEntries: [{ goodsName: "Walnuts", qtyNo: 22500, qtyName: "Bags", grossWeight: 23000, netWeight: 22500, totalAmount: 1158750 }] },
  ...over,
});
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const due = (loadings: any[] = [
  { id: "L1", loadingNo: "LD-1", container: "C1", quantity: 2250, grossWeightKg: 2300, netWeightKg: 2250, value: 115875, advanceAllocated: 11587.5, paid: 1000, outstanding: 103287.5 },
  { id: "L2", loadingNo: "LD-2", container: "C2", quantity: 2250, grossWeightKg: 2300, netWeightKg: 2250, value: 115875, advanceAllocated: 11587.5, paid: 0, outstanding: 104287.5 },
]) => ({ id: "bill-one", currency: "USD", loadings });

describe("Remaining totals only eligible saved loading entries", () => {
  it("sums two partial loadings instead of the full 22500 booking", () => {
    expect(remainingBookingRow(bill(), [], due())).toMatchObject({ quantity: 4500, grossKg: 4600, netKg: 4500, total: 231750, paid: 24175, balance: 207575, currency: "USD" });
  });
  it("never falls back to full contract totals while due records are absent", () => {
    expect(remainingBookingRow(bill())).toMatchObject({ quantity: 0, total: 0, paid: 0, balance: 0, entries: [] });
  });
  it("retains each loading ID and only attaches matching real routes", () => {
    const records = [{ id: "L1", purchase_order_id: "bill-one", bl_number: "BL-1", loading_location: "Ningbo" }, { id: "L2", purchase_order_id: "other", loading_location: "Wrong" }];
    const result = remainingBookingRow(bill(), records, due());
    expect(result.entries[0]).toMatchObject({ id: "L1", blNo: "BL-1", route: { loadingPort: "Ningbo" } });
    expect(result.entries[1].route).toBeUndefined();
    expect(uniqueBookingRows([bill(), bill()])).toHaveLength(1);
  });
  it("shows saved loading and receiving gates without inventing unknown locations", () => {
    const records = [{ id: "L1", purchase_order_id: "bill-one", report_payload: {
      loadingCountry: "China", loadingPort: "Tianjin", loadingGate: "East Gate",
      receivingCountry: "UAE", receivingPort: "Jebel Ali", receivingGate: "Gate 4",
    }}];
    const result = remainingBookingRow(bill(), records, due([{ id: "L1", outstanding: 300 }]));
    expect(result.routes[0]).toMatchObject({ loadingGate: "East Gate", receivingGate: "Gate 4" });
    const missing = remainingBookingRow(bill({ form_data: { form: {} } }), [], due([{ id: "L1", outstanding: 300 }]));
    expect(missing.routes).toHaveLength(0);
  });
  it("uses actual entry value and advance allocation rather than quantity proportions", () => {
    const result = remainingBookingRow(bill(), [], due([{ id: "L1", quantity: 100, value: 800, advanceAllocated: 200, paid: 150, outstanding: 450 }]));
    expect(result).toMatchObject({ quantity: 100, total: 800, paid: 350, balance: 450, grossKg: null });
  });
  it("keeps settled siblings in details without making them payable again", () => {
    const result = remainingBookingRow(bill(), [], due([{ id: "L1", value: 100, advanceAllocated: 10, paid: 90, outstanding: 0, complete: true }, { id: "L2", value: 100, advanceAllocated: 10, paid: 0, outstanding: 90 }]));
    expect(result.balance).toBe(90);
    expect(result.entries).toHaveLength(2);
  });
});

it("expands one bill to two loading entries and opens the selected loading", () => {
  const onSelectLoading = vi.fn();
  render(<RemainingBookingTable rows={[bill(), bill()]} loadingRecords={[]} dueBills={[due()]} lang="en" onSelectOrder={vi.fn()} onSelectLoading={onSelectLoading} />);
  expect(screen.getAllByRole("cell", { name: "AE-001-0007" })).toHaveLength(1); // General is a summary table; Journal is the detail action.
  fireEvent.click(screen.getByRole("button", { name: "AE-001-0007" }));
  const details = screen.getByTestId("remaining-loading-details");
  expect(within(details).getByText("LD-1")).toBeTruthy();
  expect(within(details).getByText("LD-2")).toBeTruthy();
  fireEvent.click(within(details).getAllByRole("button", { name: "Journal" })[1]);
  expect(onSelectLoading).toHaveBeenCalledWith("bill-one", "L2");
});

it("does not list unloaded or fully settled bills as collectible", () => {
  const { rerender } = render(<RemainingBookingTable rows={[bill()]} loadingRecords={[]} lang="en" onSelectOrder={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "AE-001-0007" })).toBeNull();
  rerender(<RemainingBookingTable rows={[bill()]} loadingRecords={[]} dueBills={[due([{ id: "L1", outstanding: 0 }])]} lang="en" onSelectOrder={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "AE-001-0007" })).toBeNull();
});

it("uses loaded totals in All Sources too and does not repeat the contract row", () => {
  render(<SourceFilteredTable sourceFilter="all" onSourceChange={vi.fn()} rows={[bill()]} counts={{ all: 1, booking: 1, local: 0 }} lang="en" onSelectOrder={vi.fn()} onOpenFullBill={vi.fn()} onPrintStatement={vi.fn()} tGlobal={(_lang, _key, fallback) => fallback} activeMode="remaining" loadingRecords={[]} dueBills={[due()]} />);
  expect(screen.getAllByRole("button", { name: "AE-001-0007" })).toHaveLength(1);
  expect(screen.getAllByText("4,500")).toHaveLength(2); // Qty and net weight, but only one bill row.
  expect(screen.getAllByRole("button", { name: "Journal" })).toHaveLength(1);
  expect(screen.queryByRole("columnheader", { name: "Loading Country" })).toBeNull();
  expect(screen.queryByRole("columnheader", { name: "Loading Port" })).toBeNull();
  expect(screen.queryByText("4,252,612.50")).toBeNull();
});

it("keeps transport details only in Purchase Booking and never duplicates All Sources", () => {
  const props = {
    sourceFilter: "all" as const, onSourceChange: vi.fn(), rows: [bill(), bill()], counts: { all: 1, booking: 1, local: 0 },
    lang: "en", onSelectOrder: vi.fn(), onOpenFullBill: vi.fn(), onPrintStatement: vi.fn(),
    tGlobal: (_lang: string, _key: string, fallback: string) => fallback, activeMode: "remaining",
    loadingRecords: [], dueBills: [due()],
  };
  const { rerender } = render(<SourceFilteredTable {...props} />);
  expect(screen.getAllByRole("button", { name: "Journal" })).toHaveLength(1);
  expect(screen.queryByText("Tianjin")).toBeNull();
  rerender(<SourceFilteredTable {...props} sourceFilter="purchase_booking" />);
  expect(screen.getByRole("columnheader", { name: "Loading Country" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Loading Gate" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Receiving Gate" })).toBeTruthy();
});

it("shows the Remaining payment due date instead of the Advance date", () => {
  render(<SourceFilteredTable sourceFilter="all" onSourceChange={vi.fn()} rows={[bill({
    form_data: { form: { advanceDueDate: "2026-11-01", remainingDueDate: "2026-11-22", supplierName: "Supplier" } },
  })]} counts={{ all: 1, booking: 1, local: 0 }} lang="en"
    onSelectOrder={vi.fn()} onOpenFullBill={vi.fn()} onPrintStatement={vi.fn()}
    tGlobal={(_lang, _key, fallback) => fallback} activeMode="remaining" loadingRecords={[]} dueBills={[due()]} />);
  expect(screen.getByText("2026-11-22")).toBeTruthy();
  expect(screen.queryByText("2026-11-01")).toBeNull();
});

it("shows the bill's Remaining entries while the running balance still accounts for its advance", () => {
  const payments = [
    { id: "advance", kind: "advance", amount: 200, amtUSD: 200, amtAED: 734, paymentNo: 1, entry_date: "2026-11-01", reference_no: "ADV-ONE" },
    { id: "remaining", kind: "remaining", amount: 100, amtUSD: 100, amtAED: 367, paymentNo: 2, entry_date: "2026-11-02", reference_no: "REM-ONE" },
  ];
  const model = buildPaymentEntryModel({ mode: "remaining", contractTotal: 1000, contractTotalLocal: 3670, rate: 3.67, percent: 20, endorsementOrder: false, goods: [],
    payments: payments.map(p => ({ id: p.id, kind: p.kind, amountPurchase: p.amtUSD, amountLocal: p.amtAED, date: p.entry_date })), totalPaid: 300, balance: 700 });
  render(<PurchasePaymentEntryDocument lang="en" isRtl={false} mode="remaining" model={model} limit={null} purchaseCurrency="USD" baseCurrency="AED" rate={3.67} percent={20} endorsementOrder={false} orderNo="PO-ONE" branchName="" countryName="" purchaseAccount="" paymentDate="2026-11-04" supplier={{ accountNo: "", name: "", country: "", contact: "" }} contract={{ no: "", date: "", goods: "", origin: "" }} payments={payments} ledgerLabel={() => ""} saving={false} saveDisabled={false} onBack={vi.fn()} onPrint={vi.fn()} onSave={vi.fn()} onNewPayment={vi.fn()} onEdit={vi.fn()} onLimitChange={vi.fn()} />);
  const rows = screen.getAllByTestId("ppe-payment-row");
  expect(rows).toHaveLength(1);
  expect(within(rows[0]).getByText("REM-ONE")).toBeTruthy();
  expect(screen.queryByText("ADV-ONE")).toBeNull();
  expect(within(rows[0]).getByTestId("ppe-remaining-after").textContent).toBe("700.00");
});
