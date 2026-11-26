import React from "react";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSalesLoadingSchema, toLoadingOrder } from "@/lib/sales/loading-workflow";
import { SalesLoadingView } from "@/features/sales/components/sales-loading-view";

vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const order = { ...toLoadingOrder({ id: "e73b8a60-042e-4ff5-a7e1-fce71c64a502", sales_order_no: "SO-QA-077", customer_name: "Local Buyer", country_id: "ae", country_name: "UAE", order_date: "2026-11-26",
  form_data: { form: { saleMode: "local", saleSource: "local", shippingMode: "By Road", secondaryCurrency: "AED" }, goodsEntries: [{ goodsName: "Walnut kernels", lotNo: "LOT-100", qtyNo: 1000, qtyName: "Cartons", finalAmount: 47000 }] } }, true), readiness: "ready" };
const response = (x: unknown) => new Response(JSON.stringify({ ok: true, data: x }), { status: 200 });
const data = { orders: [order], records: [], nextCursor: null, scopeKey: "QA", locations: [{ countryId: order.countryId, country: order.country, mainBranchId: order.mainBranchId, mainBranch: order.mainBranch, cityBranchId: order.cityBranchId, cityBranch: order.cityBranch }], canLoad: true, financials: true };
const registered = { id: "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b", truck_number: "DXB-A-12345", driver_name: "Rahim Khan", driver_mobile: "+971500000001", owner_name: "Khan Transport", transport_company: "Khan Transport LLC", truck_type: "Trailer" };

async function openNewLoading(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  render(<SalesLoadingView source="local"/>);
  await screen.findByText("SO-QA-077");
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Loading" }));
  const entry = within(screen.getByTestId("sales-loading-entry"));
  for (const next of ["Next: Parties", "Next: Goods", "Next: New Loading"]) fireEvent.click(entry.getByRole("button", { name: next }));
  return entry;
}
function fillGoods(entry: ReturnType<typeof within>) {
  fireEvent.change(entry.getByLabelText("Loading Date"), { target: { value: "2026-11-26" } });
  fireEvent.click(entry.getByRole("checkbox", { name: /Walnut kernels/ }));
  for (const [labelText, value] of [["Loading Quantity *", "200"], ["Gross Weight (KG)", "5000"], ["Net Weight (KG)", "4900"]]) fireEvent.change(entry.getByLabelText(labelText), { target: { value } });
}

it("Local Sales loading picks a permanent truck from Truck Registration and its data fills in", async () => {
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => path.startsWith("/api/erp/master-data/trucks") ? new Response(JSON.stringify({ trucks: [registered] }), { status: 200 })
    : response(init?.method === "POST" ? { records: [{ id: "saved" }] } : data));
  const entry = await openNewLoading(fetchMock);
  expect(entry.getByText("Truck Entry (By Road)")).toBeTruthy();
  expect(entry.getByRole("button", { name: "Permanent / Registered Truck" })).toBeTruthy();
  expect(entry.getByRole("button", { name: "Temporary Truck" })).toBeTruthy();
  expect(entry.queryByLabelText("Vehicle No.")).toBeNull(); // the picker replaces the free-text truck fields
  fireEvent.change(entry.getByPlaceholderText(/Type truck number/), { target: { value: "DXB" } });
  fireEvent.click(await entry.findByRole("button", { name: /DXB-A-12345/ }));
  expect((entry.getByLabelText("Truck / Container No. *") as HTMLInputElement).value).toBe("DXB-A-12345");
  expect((entry.getByLabelText("Container Type") as HTMLSelectElement).value).toBe("Truck");
  fillGoods(entry);
  fireEvent.click(entry.getByRole("button", { name: "Save Loading" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body));
  expect(body).toMatchObject({ source: "local", containers: [{ containerNumber: "DXB-A-12345", containerType: "Truck", truckRegistrationType: "registered", truckId: registered.id,
    vehicle: "DXB-A-12345", driver: "Rahim Khan", driverMobile: "+971500000001", truckOwner: "Khan Transport", transportCompany: "Khan Transport LLC" }] });
  expect(createSalesLoadingSchema.safeParse(body).success).toBe(true);
});

it("Local Sales loading accepts a temporary truck typed in by hand", async () => {
  const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => response(init?.method === "POST" ? { records: [{ id: "saved" }] } : data));
  const entry = await openNewLoading(fetchMock);
  fireEvent.click(entry.getByRole("button", { name: "Temporary Truck" }));
  fireEvent.change(entry.getByPlaceholderText("e.g. TKM-4821"), { target: { value: "sharjah 777" } });
  fillGoods(entry);
  fireEvent.click(entry.getByRole("button", { name: "Save Loading" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body));
  expect(body.containers[0]).toMatchObject({ truckRegistrationType: "temporary", truckId: "", vehicle: "SHARJAH 777", containerNumber: "SHARJAH777" });
});

it("does not save a registered-truck loading until a truck is selected", async () => {
  const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => response(init?.method === "POST" ? { records: [{ id: "saved" }] } : data));
  const entry = await openNewLoading(fetchMock);
  fireEvent.change(entry.getByLabelText("Truck / Container No. *"), { target: { value: "TRK1" } });
  fillGoods(entry);
  fireEvent.click(entry.getByRole("button", { name: "Save Loading" }));
  expect(await entry.findByText(/Select a registered truck, or enter the temporary truck number/)).toBeTruthy();
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

it("the server schema rejects a registered truck without its id and a temporary truck without a number", () => {
  const base = { containerNumber: "T1", containerType: "Truck", loadingDate: "2026-11-26", items: [{ line: 0, quantity: 1, gross: 1, net: 1 }] };
  expect(createSalesLoadingSchema.safeParse({ source: "local", orderId: order.id, containers: [{ ...base, truckRegistrationType: "registered" }] }).success).toBe(false);
  expect(createSalesLoadingSchema.safeParse({ source: "local", orderId: order.id, containers: [{ ...base, truckRegistrationType: "temporary" }] }).success).toBe(false);
  expect(createSalesLoadingSchema.safeParse({ source: "local", orderId: order.id, containers: [{ ...base, truckRegistrationType: "temporary", vehicle: "TMP-1" }] }).success).toBe(true);
  expect(createSalesLoadingSchema.safeParse({ source: "booking", orderId: order.id, containers: [{ ...base, containerType: "40 FT" }] }).success).toBe(true);
});
