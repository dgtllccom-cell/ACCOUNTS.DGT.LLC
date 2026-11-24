import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
// @ts-expect-error JSX view module
import { SalesBookingStep1 } from "@/features/sales/components/sales-booking-step1.jsx";

vi.mock("@/components/voice-form-fill", () => ({ VoiceFormFill: () => null }));

afterEach(cleanup);

it("keeps the account selectors and displays account details only in the report cards", () => {
  render(<SalesBookingStep1
    form={{ customerAccountNo: "CUS-1", customerAccountName: "Selected customer",
      salesAccountNo: "SAL-1", salesAccountName: "Selected sales account" }}
    dbAccounts={[
      { accountCode: "CUS-1", accountName: "Selected customer", address: "Customer address" },
      { accountCode: "SAL-1", accountName: "Selected sales account", address: "Sales address" },
    ]}
    setForm={vi.fn()}
  />);

  const customerCard = screen.getByRole("heading", { name: "Customer / Purchase Account" }).closest("section")!;
  const salesCard = screen.getByRole("heading", { name: "Sales Account Details" }).closest("section")!;
  expect(within(customerCard).getByText("Selected customer")).toBeTruthy();
  expect(within(salesCard).getByText("Selected sales account")).toBeTruthy();
  expect(screen.getByRole("button", { name: /CUS-1.*Selected customer/i })).toBeTruthy();
  expect(screen.getByRole("button", { name: /SAL-1.*Selected sales account/i })).toBeTruthy();
  expect(screen.queryByText("Customer address")).toBeNull();
  expect(screen.queryByText("Sales address")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Loading Details" })).toBeNull();

  const labels = within(screen.getByRole("table")).getAllByRole("columnheader").map(header => header.textContent);
  expect(labels.slice(-5, -1)).toEqual(["Unit Price", "Total Sales Amount", "Exchange Rate", "Final Amount"]);
});
