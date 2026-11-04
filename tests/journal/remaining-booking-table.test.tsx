import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { remainingBookingRow, uniqueBookingRows } from "@/lib/journal/remaining-booking-table";
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

describe("Remaining Booking registry reads saved bill data", () => {
  it("reads goodsEntries quantities and weight, not absent top-level placeholders", () => {
    expect(remainingBookingRow(bill())).toMatchObject({ goods: "Walnuts", quantity: 22500, unit: "Bags", grossKg: 23000, netKg: 22500 });
  });
  it("keeps USD contract total, paid and balance in the same currency when order_total is AED", () => {
    expect(remainingBookingRow(bill())).toMatchObject({ currency: "USD", total: 1158750, paid: 115875, balance: 1042875 });
  });
  it("adds multiple real goods lines once", () => {
    const row = bill(); row.form_data.goodsEntries.push({ goodsName: "Almonds", qtyNo: 50, qtyName: "Bags", grossWeight: 60, netWeight: 55, totalAmount: 100 });
    expect(remainingBookingRow(row)).toMatchObject({ goods: "Walnuts, Almonds", quantity: 22550, grossKg: 23060, netKg: 22555 });
  });
  it("preserves explicit zero weights and shows missing measurements as missing", () => {
    const row = bill({ form_data: { goodsEntries: [{ qtyNo: 0, grossWeight: 0, netWeight: 0 }] } });
    expect(remainingBookingRow(row)).toMatchObject({ quantity: 0, grossKg: 0, netKg: 0 });
    expect(remainingBookingRow(bill({ form_data: {} })).grossKg).toBeNull();
  });
  it("uses real loading/receiving overrides linked by the original bill ID", () => {
    const record = { id: "L1", purchase_order_id: "bill-one", loaded_at: "2026-11-03T09:00:00Z", received_at: "2026-11-04T12:00:00Z", loading_location: "Ningbo", receiving_location: "Karachi", report_payload: { loadingCountry: "China", receivingCountry: "Pakistan" } };
    expect(remainingBookingRow(bill(), [record]).routes[0]).toMatchObject({ loadingPort: "Ningbo", receivingCountry: "Pakistan", receivingPort: "Karachi", receivedDate: "2026-11-04T12:00:00Z" });
  });
  it("does not attach another bill's loading even when its display number matches", () => {
    const records = [{ id: "foreign", purchase_order_id: "another-id", purchase_order_no: "AE-001-0007", loading_location: "Wrong Port" }];
    expect(remainingBookingRow(bill(), records).routes[0].loadingPort).toBe("Tianjin");
  });
  it("keeps multiple saved routes and deduplicates repeated loading IDs", () => {
    const record = { id: "L1", purchase_order_id: "bill-one", loading_location: "Port One" };
    const row = bill({ loading_records: [record], __loadingRecord: record });
    expect(remainingBookingRow(row, [record, { ...record, id: "L2", loading_location: "Port Two" }]).routes).toHaveLength(2);
    expect(uniqueBookingRows([row, { ...row, __rowKey: "another-loading" }])).toHaveLength(1);
  });
  it("does not invent route values, loading quantities or actual receipt dates", () => {
    const row = bill({ form_data: { form: { arrivalDate: "2026-12-01" } } });
    const result = remainingBookingRow(row, [{ id: "synthetic-pending", purchase_order_id: row.id, loading_location: "Fake" }]);
    expect(result.routes[0]).toMatchObject({ loadingCountry: "", loadingPort: "", loadingDate: "", receivingCountry: "", receivingPort: "", receivedDate: "" });
  });
});

it("renders six separate route columns and opens the original bill from its number", () => {
  const onSelectOrder = vi.fn();
  render(<RemainingBookingTable rows={[bill()]} loadingRecords={[]} lang="en" onSelectOrder={onSelectOrder} />);
  for (const name of ["Loading Country", "Loading Port", "Loading Date", "Receiving Country", "Receiving Port", "Received Date"]) expect(screen.getByRole("columnheader", { name })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "AE-001-0007" }));
  expect(onSelectOrder).toHaveBeenCalledWith("bill-one");
  expect(screen.queryByText("Shanghai")).toBeNull();
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
