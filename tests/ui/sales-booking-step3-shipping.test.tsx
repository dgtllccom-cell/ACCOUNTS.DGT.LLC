import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
// @ts-expect-error JSX view module
import { SalesBookingStep3 } from "@/features/sales/components/sales-booking-step3.jsx";

afterEach(cleanup);

it("keeps vessel, voyage and bill of lading separate and shows bill details above the goods table", () => {
  const setForm = vi.fn();
  render(<SalesBookingStep3
    form={{ vesselName: "Test Vessel", voyageNo: "VY-TEST", billOfLadingNo: "BL-OLD",
      salesCurrency: "USD", secondaryCurrency: "AED", exchangeRate: 3.673, advancePercent: 0 }}
    setForm={setForm}
    goodsEntries={[{ goodsName: "Test goods", lotNo: "LOT-TEST", totalAmount: 1250,
      finalAmount: 4591.25, salesCurrency: "USD", secondaryCurrency: "AED", exchangeRate: 3.673 }]}
  />);

  expect((screen.getByLabelText("Vessel Name") as HTMLInputElement).value).toBe("Test Vessel");
  expect((screen.getByLabelText("Voyage No") as HTMLInputElement).value).toBe("VY-TEST");
  const billOfLading = screen.getByLabelText(/Bill of Lading/i) as HTMLInputElement;
  expect(billOfLading.value).toBe("BL-OLD");
  fireEvent.change(billOfLading, { target: { value: "BL-NEW" } });
  expect(setForm.mock.calls[0][0]({ vesselName: "Test Vessel", voyageNo: "VY-TEST" })).toEqual({
    vesselName: "Test Vessel", voyageNo: "VY-TEST", blNo: "BL-NEW", billOfLadingNo: "BL-NEW",
  });

  expect(screen.getByText("USD 0.00")).toBeTruthy();
  const table = screen.getByRole("table");
  expect(table.querySelector("tfoot")).toBeNull();
  expect(within(table).getByText("LOT-TEST")).toBeTruthy();
  expect(within(table).getByText("AED 4,591.25")).toBeTruthy();
  const billDetails = screen.getByRole("heading", { name: "Bill Details" }).closest("section")!;
  expect(within(billDetails).getByText("BL-OLD")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Summary Totals" })).toBeNull();
});
