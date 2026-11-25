import React from "react";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { toLoadingOrder } from "@/lib/sales/loading-workflow";
import { SalesLoadingView } from "@/features/sales/components/sales-loading-view";

vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const order = { ...toLoadingOrder({ id: "e73b8a60-042e-4ff5-a7e1-fce71c64a502", sales_order_no: "SB-QA-055", customer_name: "Sample Buyer", country_id: "ae", country_name: "UAE", order_date: "2026-11-24",
  form_data: { form: { shippingMode: "By Sea", secondaryCurrency: "AED" }, goodsEntries: [{ goodsName: "Walnut kernels", lotNo: "LOT-100", qtyNo: 1000, qtyName: "Cartons", finalAmount: 47000 }] } }, true), readiness: "ready" };
const response = (x: unknown) => new Response(JSON.stringify({ ok: true, data: x }), { status: 200 });
const getData = (canLoad: boolean) => ({ orders: [order], records: [], nextOffset: null, canLoad, financials: true });

it("renders the register and shows a read-only View for users without loading write access", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response(getData(false))));
  render(<SalesLoadingView/>);
  await screen.findByText("SB-QA-055");
  for (const title of ["Sales Loading Summary", "Loading Status", "Country Wise Loading"]) expect(screen.getByRole("heading", { name: title })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: /Purchase DR/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /New Loading/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  expect((screen.getByRole("button", { name: "Loading" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "View" }));
  expect(screen.getByRole("dialog", { name: /SB-QA-055/ })).toBeTruthy();
});

it("opens the Purchase-style sales form from the row and saves a container with the original booking ID", async () => {
  const mockedFetch = vi.fn(async (_route: string, init?: RequestInit) => response(init?.method === "POST" ? { records: [{ id: "saved" }] } : getData(true)));
  vi.stubGlobal("fetch", mockedFetch);
  render(<SalesLoadingView/>);
  await screen.findByText("SB-QA-055");
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Loading" }));
  const entry = within(screen.getByTestId("sales-loading-entry"));
  expect(entry.getByRole("heading", { name: /New Sales Loading Entry SB-QA-055/ })).toBeTruthy();
  fireEvent.click(entry.getAllByRole("button", { name: "New Loading" })[0]);
  fireEvent.change(entry.getByLabelText("Container Number *"), { target: { value: "QA123456789" } });
  fireEvent.change(entry.getByLabelText("Loading Date"), { target: { value: "2026-11-25" } });
  fireEvent.click(entry.getByRole("checkbox", { name: /Walnut kernels/ }));
  for (const [labelText, value] of [["Loading Quantity *", "200"], ["Gross Weight (KG)", "5000"], ["Net Weight (KG)", "4900"]]) {
    fireEvent.change(entry.getByLabelText(labelText), { target: { value } });
  }
  fireEvent.click(entry.getByRole("button", { name: "Save Loading" }));
  await waitFor(() => expect(mockedFetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  const post = mockedFetch.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ orderId: order.id, containers: [{ containerNumber: "QA123456789", items: [{ line: 0, quantity: 200, gross: 5000, net: 4900 }] }] });
  expect(await screen.findByText("Sales Loading saved")).toBeTruthy();
});
