import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
// @ts-expect-error JSX view module
import { SalesBookingStep4 } from "@/features/sales/components/sales-booking-step4.jsx";

afterEach(cleanup);

it("reviews lot amounts in their currencies and saves the four reports through the booking draft", () => {
  const saveDraft = vi.fn();
  function Review() {
    const [form, setForm] = React.useState({
      salesCurrency: "USD", secondaryCurrency: "AED", exchangeRate: 3.673, advancePercent: 10,
      loadingPort: "Test loading port", receivedPort: "Test receiving port", salesOrderNo: "SB-TEST",
      bookingSerials: { superAdminSerialNumber: "SA-TEST" },
      customerAccountName: "Test customer", salesAccountName: "Test sales account",
    });
    return <SalesBookingStep4 form={form} setForm={setForm} onSaveDraft={() => saveDraft(form)}
      goodsEntries={[{ goodsName: "Test item", lotNo: "TEST-LOT", origin: "UAE", totalAmount: 1250,
        purchaseAccountName: "Test purchase account", finalAmount: 4591.25, salesCurrency: "USD", secondaryCurrency: "AED", exchangeRate: 3.673 }]} />;
  }
  render(<Review />);

  const headings = screen.getAllByRole("heading", { level: 3 }).map(heading => heading.textContent);
  expect(headings.slice(1, 5)).toEqual([
    "Sales Booking", "Branch Details", "Sales Account Details", "Customer / Purchase Account",
  ]);
  expect(screen.getByText("SA-TEST")).toBeTruthy();
  expect(screen.getByText("Test sales account")).toBeTruthy();
  expect(screen.getByText("Test customer")).toBeTruthy();
  expect(screen.getByText("Test purchase account")).toBeTruthy();

  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("columnheader").slice(-4).map(header => header.textContent))
    .toEqual(["Unit Price", "Total Sales Amount", "Exchange Rate", "Final Amount"]);
  expect(within(table).getByText("TEST-LOT")).toBeTruthy();
  expect(within(table).getByText("AED 4,591.25")).toBeTruthy();
  expect(table.querySelector("tfoot")).toBeNull();
  expect(screen.getByText("Test receiving port")).toBeTruthy();
  expect(screen.getByText("USD 125.00")).toBeTruthy();
  expect(document.getElementById("sales-booking-voucher-root")?.contains(table)).toBe(true);

  for (const title of ["Loading Report", "Payment Report", "Goods Report", "Notify Party Report"]) {
    const field = screen.getByLabelText(title);
    fireEvent.change(field, { target: { value: title + " example" } });
    const card = field.closest("section")!;
    fireEvent.click(within(card).getByRole("button", { name: "View" }));
    expect(within(card).getByText(title + " example")).toBeTruthy();
  }
  fireEvent.click(screen.getAllByRole("button", { name: "Save Draft" })[0]);
  expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
    loadingReport: "Loading Report example", paymentReport: "Payment Report example",
    orderReportRemarks: "Goods Report example", notifyPartyReport: "Notify Party Report example",
  }));
});
