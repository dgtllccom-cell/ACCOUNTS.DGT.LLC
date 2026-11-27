import React from "react";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { toLoadingOrder } from "@/lib/sales/loading-workflow";
import { SalesLoadingView } from "@/features/sales/components/sales-loading-view";

vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
// The existing shared ERP controls use the browser JSX runtime. Vitest's
// classic SWC transform needs React in the global scope to mount them.
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const order = { ...toLoadingOrder({ id: "e73b8a60-042e-4ff5-a7e1-fce71c64a502", sales_order_no: "SB-QA-055", customer_name: "Sample Buyer", country_id: "ae", country_name: "UAE", order_date: "2026-11-24",
  form_data: { form: { shippingMode: "By Sea", secondaryCurrency: "AED" }, goodsEntries: [{ goodsName: "Walnut kernels", lotNo: "LOT-100", qtyNo: 1000, qtyName: "Cartons", finalAmount: 47000 }] } }, true), readiness: "ready" };
const response = (x: unknown) => new Response(JSON.stringify({ ok: true, data: x }), { status: 200 });
const locationOf = ({countryId, country, mainBranchId, mainBranch, cityBranchId, cityBranch}: typeof order) => ({countryId, country, mainBranchId, mainBranch, cityBranchId, cityBranch});
const getData = (canLoad: boolean) => ({ orders: [order], records: [], nextCursor: null, scopeKey: "QA", locations: [locationOf(order)], canLoad, financials: true });

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
  expect(entry.getAllByRole("tab")).toHaveLength(4);
  expect(entry.getByTestId("loading-receiving-cell")).toBeTruthy();
  fireEvent.click(entry.getByRole("button", { name: "Next: Parties" }));
  expect(entry.getByRole("heading", { name: "Parties (Read Only)" })).toBeTruthy();
  fireEvent.click(entry.getByRole("button", { name: "Next: Goods" }));
  expect(entry.getByRole("heading", { name: "Goods Details (Read Only)" })).toBeTruthy();
  fireEvent.click(entry.getByRole("button", { name: "Next: New Loading" }));
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
  // Only Sales Loading APIs plus read-only Route & Location Master lookups (country → port/border picker).
  expect(mockedFetch.mock.calls.every(([path, init]) => path.startsWith("/api/erp/sales/loading")
    || ((path.startsWith("/api/erp/locations/countries") || path.startsWith("/api/erp/location-master")) && !init?.method))).toBe(true);
});

it("keeps search and scoped filters in one popup, applies them together, and clears them together", async () => {
  const otherOrder = { ...order, id: "eb6072b8-4d29-43a1-a3f0-be89f08953aa", bookingNo: "SB-QA-060", customer: "Another Buyer", countryId: "pk", country: "Pakistan", mainBranchId: "branch-pk", mainBranch: "Pakistan Main", cityBranchId: "branch-pk-city", cityBranch: "Chaman" };
  const scopedOrder = { ...order, mainBranchId: "branch-ae", mainBranch: "UAE Main", cityBranchId: "branch-ae-city", cityBranch: "Dubai" };
  const fetchData = vi.fn(async (path: string) => response({ ...getData(true), locations: [locationOf(scopedOrder), locationOf(otherOrder)], orders: path.includes("countryId=ae") ? [scopedOrder] : [scopedOrder, otherOrder] }));
  vi.stubGlobal("fetch", fetchData);
  render(<SalesLoadingView/>);
  await screen.findByText(order.bookingNo);
  expect(screen.queryByRole("textbox", { name: /Search bill/ })).toBeNull();
  const open = screen.getByRole("button", { name: "Advanced Search & Filter" });
  fireEvent.click(open);
  let popup = within(screen.getByRole("dialog", { name: "Advanced Search & Filter" }));
  fireEvent.change(popup.getByRole("textbox", { name: /Search bill/ }), { target: { value: "Sample Buyer" } });
  fireEvent.change(popup.getByRole("combobox", { name: "Country" }), { target: { value: "ae" } });
  expect(popup.queryByRole("option", { name: "Pakistan Main" })).toBeNull();
  fireEvent.change(popup.getByRole("combobox", { name: "Main Branch" }), { target: { value: "branch-ae" } });
  fireEvent.change(popup.getByRole("combobox", { name: "City Branch" }), { target: { value: "branch-ae-city" } });
  fireEvent.change(popup.getByRole("combobox", { name: "Loading Status" }), { target: { value: "pending" } });
  expect(popup.getByRole("group", { name: "Loading (Origin)" })).toBeTruthy();
  expect(popup.getByRole("group", { name: "Received (Destination)" })).toBeTruthy();
  expect(popup.getByRole("group", { name: "Dates" })).toBeTruthy();
  // Radix marks the underlying register aria-hidden while the modal is open;
  // its rows are only updated after applying search.
  expect(screen.getByText(otherOrder.bookingNo)).toBeTruthy();
  fireEvent.click(popup.getByRole("button", { name: "Search" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(await screen.findByText(order.bookingNo)).toBeTruthy();
  expect(screen.queryByText(otherOrder.bookingNo)).toBeNull();
  expect(fetchData.mock.calls.at(-1)?.[0]).toContain("countryId=ae&mainBranchId=branch-ae&cityBranchId=branch-ae-city");

  fireEvent.click(open);
  popup = within(screen.getByRole("dialog", { name: "Advanced Search & Filter" }));
  expect((popup.getByRole("textbox", { name: /Search bill/ }) as HTMLInputElement).value).toBe("Sample Buyer");
  fireEvent.click(popup.getByRole("button", { name: "Reset" }));
  expect((popup.getByRole("textbox", { name: /Search bill/ }) as HTMLInputElement).value).toBe("");
  expect(popup.getAllByRole("combobox").every(select => !(select as HTMLSelectElement).value)).toBe(true);
  fireEvent.click(popup.getByRole("button", { name: "Search" }));
  expect(await screen.findByText(otherOrder.bookingNo)).toBeTruthy();
  expect(fetchData).toHaveBeenCalledTimes(3);
});

it("matches Sales Loading container and origin, destination and actual dates without showing unrelated containers", async () => {
  const makeRecord = (id: string, entryNo: number, container: string, date: string, receivedDate: string | null, loadingPort: string) => ({
    id, entry_no: entryNo, sales_order_id: order.id, sales_booking_no: order.bookingNo, container_number: container,
    container_type: "40 FT", loading_date: date, received_date: receivedDate, created_by_name: "Tester",
    details: { loadingCountry: "China", loadingPort, receivedCountry: "UAE", receivedPort: "Jebel Ali" },
    goods: [{ ...order.goods[0], quantity: 100 }],
  });
  const records = [makeRecord("first", 101, "SALES-QA-1", "2026-11-18", null, "Shanghai"), makeRecord("second", 102, "SALES-QA-2", "2026-11-25", "2026-11-26", "Qingdao")];
  vi.stubGlobal("fetch", vi.fn(async () => response({ ...getData(true), records })));
  render(<SalesLoadingView/>);
  await screen.findByText("LE-000101");
  fireEvent.click(screen.getByRole("button", { name: "Advanced Search & Filter" }));
  const popup = within(screen.getByRole("dialog", { name: "Advanced Search & Filter" }));
  for (const [label, value] of [["Container Number", "SALES-QA-2"], ["Loading Port", "Qingdao"], ["Receiving Port", "Jebel Ali"], ["From Date", "2026-11-25"], ["To Date", "2026-11-25"], ["Actual Received Date", "2026-11-26"]]) {
    fireEvent.change(popup.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(popup.getByRole("button", { name: "Search" }));
  expect(screen.queryByText("LE-000101")).toBeNull();
  expect(await screen.findByText("LE-000102")).toBeTruthy();
});

it("loads only the original scoped booking from a direct Loading link and returns to the full register", async () => {
  const fetchData = vi.fn(async (_url: string) => response(getData(true)));
  vi.stubGlobal("fetch", fetchData);
  render(<SalesLoadingView initialOrderId={order.id} initialAction="loading"/>);
  const entry = await screen.findByTestId("sales-loading-entry");
  expect(fetchData.mock.calls[0][0]).toContain(`orderId=${order.id}`);
  fireEvent.click(within(entry).getByRole("button", { name: "Dashboard" }));
  await screen.findByText(order.bookingNo);
  expect(fetchData.mock.calls.at(-1)?.[0]).not.toContain("orderId=");
});

it("clears superseded rows and ignores a late response from an aborted refresh", async () => {
  let resolveOld: (response: Response) => void = () => {};
  const newer = { ...order, bookingNo: "SB-QA-NEW" };
  const fetchData = vi.fn(async (_url: string, _init?: RequestInit) => response({ ...getData(false), orders: [newer] }))
    .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  vi.stubGlobal("fetch", fetchData);
  render(<SalesLoadingView/>);
  await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await screen.findByText(newer.bookingNo);
  expect(fetchData.mock.calls[0][1]?.signal?.aborted).toBe(true);
  resolveOld(response(getData(true)));
  await waitFor(() => expect(screen.queryByText(order.bookingNo)).toBeNull());
  expect(screen.queryByRole("button", { name: "New Loading" })).toBeNull();
});

it("does not present partial loading scope as real summary totals", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response({ ...getData(false), limitReached: true, orders: [], records: [] })));
  render(<SalesLoadingView/>);
  expect(await screen.findByText(/Narrow by country, branch, booking or date/)).toBeTruthy();
  const summary = screen.getByRole("heading", { name: "Sales Loading Summary" }).parentElement!;
  expect(within(summary).getAllByText("–")).toHaveLength(4);
  expect(within(summary).queryByText("0")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Advanced Search & Filter" }));
  expect(screen.getByRole("option", { name: "UAE" })).toBeTruthy();
});

it("opens Local Sales Loading by document scope, reuses the entry, and sends Local scope on receipt", async () => {
  const localOrder = { ...order, bookingNo: "LS-QA-005" };
  const localRecord = { id: "local-container", entry_no: 553, sales_order_id: order.id, sales_booking_no: localOrder.bookingNo,
    container_number: "LS-LOCAL-005", container_type: "40 FT", loading_date: "2026-11-25", received_date: null,
    details: {}, goods: [{ ...order.goods[0], quantity: 30 }], created_by_name: "QA" };
  const fetchData = vi.fn(async (_path: string, init?: RequestInit) => response(init?.method === "PATCH" ? { record: localRecord } : {
    ...getData(true), orders: [localOrder], records: [localRecord],
  }));
  vi.stubGlobal("fetch", fetchData);
  render(<SalesLoadingView source="local" initialOrderId={order.id} initialAction="loading"/>);
  const entry = await screen.findByTestId("sales-loading-entry");
  expect(within(entry).getByRole("heading", { name: /New Local Sales Loading Entry LS-QA-005/ })).toBeTruthy();
  expect(fetchData.mock.calls[0][0]).toContain(`source=local&orderId=${order.id}`);
  fireEvent.click(within(entry).getByRole("button", { name: "Dashboard" }));
  await screen.findByText(localOrder.bookingNo);
  expect(screen.getByRole("heading", { name: /Local Sales Loading \(Global/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/dashboard/sales/local-sales");
  expect(screen.getByRole("columnheader", { name: /Local Sales Bill No/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  fireEvent.click(screen.getByRole("button", { name: "View" }));
  const details = within(screen.getByRole("dialog", { name: /LS-QA-005/ }));
  fireEvent.change(details.getByLabelText("Actual Received Date"), { target: { value: "2026-11-26" } });
  fireEvent.click(details.getByRole("button", { name: "Save Receiving" }));
  await waitFor(() => expect(fetchData.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
  const patch = fetchData.mock.calls.find(([, init]) => init?.method === "PATCH");
  expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ source: "local", id: localRecord.id, receivedDate: "2026-11-26" });
});
