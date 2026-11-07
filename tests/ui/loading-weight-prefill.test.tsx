import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/features/companies/components/company-picker", () => ({ CompanyPicker: () => null }));
vi.mock("@/features/shipping/components/shipping-line-picker", () => ({ ShippingLinePicker: () => null }));
vi.mock("@/lib/purchases/lane-client", () => ({ fetchLaneStates: async () => ({}), ensureLaneForLoading: vi.fn(), laneReportHref: () => "#" }));
import { LoadDetailsModal } from "@/features/purchases/components/purchase-loading-records-view";
const record: any = { id: "saved-pending", loading_record_no: "L1", purchase_order_no: "P1", purchase_order_id: "p1", loading_status: "pending", container_number: "", created_at: "2026-11-01", report_payload: {}, purchase_orders: { id: "p1", order_total: 1000, advance_paid: 100, form_data: { form: { paymentType: "Advance", advancePercent: 10 }, goodsEntries: [
  { goodsName: "Walnuts", qtyNo: 1000, qtyName: "CARTON", grossWeight: 10100, netWeight: 10000 },
  { goodsName: "Almonds", qtyNo: 1000, qtyName: "BAG", qtyKgs: 25, emptyKgs: 0 },
  { goodsName: "Missing", qtyNo: 1000, qtyName: "PCS" },
] } } };
let allowSave = false, savedPayload: any = null, historyRecords: any[] = [];
beforeEach(() => {
  allowSave = false; savedPayload = null; historyRecords = [];
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => { if (options?.method && options.method !== "GET") { if (!allowSave) throw Error("No database writes"); savedPayload = JSON.parse(options.body); } return { ok: true, json: async () => ({ ok: true, data: { records: historyRecords, ports: [], countries: [] } }) }; }));
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function openForm() {
  await act(async () => { render(<LoadDetailsModal record={record} onClose={vi.fn()} />); });
  fireEvent.click(screen.getByTestId("new-loading-btn"));
  fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
}
const value = (id: string) => (screen.getByTestId(id) as HTMLInputElement).value;
it("fills actual gross/net/tare values, recalculates quantity, and resets an explicit override only on an input change", async () => {
  await openForm();
  fireEvent.change(screen.getByTestId("ld-qty"), { target: { value: "100" } });
  expect(value("ld-gross")).toBe("1010"); expect(value("ld-net")).toBe("1000"); expect(value("ld-tare")).toBe("10");
  fireEvent.change(screen.getByTestId("ld-gross"), { target: { value: "1020" } });
  expect(value("ld-gross")).toBe("1020");
  fireEvent.change(screen.getByTestId("ld-qty"), { target: { value: "200" } });
  expect(value("ld-gross")).toBe("2020"); expect(value("ld-net")).toBe("2000");
});
it("clears previous goods packing and weights, preserves zero tare and warns for missing source weights", async () => {
  await openForm();
  fireEvent.change(screen.getByTestId("ld-qty"), { target: { value: "100" } });
  fireEvent.change(screen.getByLabelText("Goods Name"), { target: { value: "Almonds" } });
  expect(value("ld-gross")).toBe("2500"); expect(value("ld-net")).toBe("2500"); expect(value("ld-tare")).toBe("0");
  fireEvent.change(screen.getByLabelText("Goods Name"), { target: { value: "Missing" } });
  expect(value("ld-gross")).toBe(""); expect(value("ld-net")).toBe("");
  expect(screen.getByText("Some goods have no recorded weight; their kg are not estimated.")).toBeTruthy();
});

it("sends the same automatic weights to the existing loading API", async () => {
  allowSave = true;
  await openForm();
  fireEvent.change(screen.getByTestId("ld-qty"), { target: { value: "100" } });
  fireEvent.change(screen.getByTestId("ld-container-no"), { target: { value: "TEST-1" } });
  await act(async () => { fireEvent.click(screen.getByTestId("ld-save")); });
  expect(savedPayload).toMatchObject({ loadedQuantity: 100, grossWeight: 1010, netWeight: 1000, tareWeight: 10 });
  expect(savedPayload.reportPayload.goodsEntries[0]).toMatchObject({ goodsName: "Walnuts", quantityNo: "100" });
  expect(savedPayload).not.toHaveProperty("exchangeRate");
});
it("preserves saved measured weights on Edit until the quantity is deliberately changed", async () => {
  historyRecords = [{ ...record, id: "saved-load", loading_status: "loaded", loaded_quantity: 100, gross_weight: 1015, net_weight: 995, tare_weight: 20, report_payload: { goodsName: "Walnuts", qtyName: "CARTON", oneQtyKgs: "10.1", oneEmptyKgs: 0, loadedQuantity: 100 } }];
  await act(async () => { render(<LoadDetailsModal record={record} onClose={vi.fn()} />); });
  fireEvent.click(await screen.findByTitle("Edit Entry"));
  fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
  expect(value("ld-qty")).toBe("100"); expect(value("ld-gross")).toBe("1015"); expect(value("ld-net")).toBe("995"); expect(value("ld-tare")).toBe("20");
  fireEvent.change(screen.getByTestId("ld-qty"), { target: { value: "50" } });
  expect(value("ld-gross")).toBe("505"); expect(value("ld-net")).toBe("505");
});
