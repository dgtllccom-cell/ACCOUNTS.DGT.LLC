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
