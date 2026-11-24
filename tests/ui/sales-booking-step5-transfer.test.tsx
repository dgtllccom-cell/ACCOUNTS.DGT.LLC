import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
// @ts-expect-error JSX view module
import { SalesBookingStep5 } from "@/features/sales/components/sales-booking-step5.jsx";

afterEach(cleanup);

it("opens the booking preview independently and prevents a second transfer in the UI", () => {
  const preview = vi.fn();
  const transfer = vi.fn();
  const props = {
    form: { salesOrderNo: "SB-TEST", salesDate: "2026-11-24" },
    setForm: vi.fn(),
    onPreviewPdf: preview,
    onConfirmTransfer: transfer,
  };
  const { rerender } = render(<SalesBookingStep5 {...props} />);

  const document = screen.getByRole("region", { name: "Sales Booking Order" });
  fireEvent.click(within(document).getByRole("button", { name: "View" }));
  expect(preview).toHaveBeenCalledTimes(1);
  expect(transfer).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Print / PDF" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Final Amount" })).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: /Exchange Rate/ }));
  expect(screen.queryByRole("columnheader", { name: "Final Amount" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /Sales Transfer Payment/ }));
  expect(transfer).toHaveBeenCalledTimes(1);

  rerender(<SalesBookingStep5 {...props} isTransferred />);
  const transferred = screen.getByRole("button", { name: "Transferred" });
  expect((transferred as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(transferred);
  expect(transfer).toHaveBeenCalledTimes(1);
});

it("opens the transfer report before posting and displays confirmed journal details after posting", () => {
  const post = vi.fn().mockResolvedValue(undefined);
  const props = {
    form: { salesOrderNo: "SB-42", customerAccountName: "Customer DR", salesAccountName: "Sales CR" },
    onConfirmTransfer: post,
    useTransferReport: true,
  };
  const { rerender } = render(<SalesBookingStep5 {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Sales Transfer Payment" }));
  const report = screen.getByRole("dialog", { name: "Sales Booking Transfer Verification Report" });
  expect(within(report).getAllByText("Awaiting Transfer").length).toBeGreaterThan(0);
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(within(report).getByRole("button", { name: "Transfer / Post" }));
  expect(post).toHaveBeenCalledTimes(1);

  rerender(<SalesBookingStep5 {...props} isTransferred transferConfirmation={{
    ledgerPostingStatus: "posted",
    salesOrderNo: "SB-42",
    transferVerification: {
      journalId: "journal-42", voucherNo: "VR-42", debitSerial: "DR-42", creditSerial: "CR-42",
      debitAmount: 100, creditAmount: 100, debitCurrency: "AED", creditCurrency: "AED",
    },
  }} />);
  expect(within(report).getAllByText("Transferred / Completed")).toHaveLength(2);
  expect(within(report).getByRole("link", { name: "VR-42" }).getAttribute("href")).toContain("entryId=journal-42");
  expect(within(report).queryByRole("button", { name: "Transfer / Post" })).toBeNull();
});

it("opens a read-only two-page Sales Booking preview with its document actions", () => {
  const post = vi.fn();
  render(<SalesBookingStep5 form={{ salesOrderNo: "SB-42", branchCompanyName: "QA Trading" }}
    onConfirmTransfer={post} useTransferReport />);
  fireEvent.click(screen.getByRole("button", { name: "View" }));
  const view = within(screen.getByRole("dialog", { name: "Sales Booking – View / PDF Preview" }));
  expect(view.getByRole("heading", { name: "Sales Contract / Booking Report" })).toBeTruthy();
  expect(view.getByRole("heading", { name: "Contract Report & Annexure" })).toBeTruthy();
  expect(view.getAllByText("QA Trading")).toHaveLength(2);
  for (const action of ["Print", "Download PDF", "Invoice", "Email", "WhatsApp"]) {
    expect(view.getByRole("button", { name: action })).toBeTruthy();
  }
  expect(view.queryByRole("button", { name: "Transfer / Post" })).toBeNull();
  expect(post).not.toHaveBeenCalled();
});
