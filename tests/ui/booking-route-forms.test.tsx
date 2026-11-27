import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NativeSearchSelect, routeMasterResponse } from "../location-master/route-fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/components/ui/search-select", () => ({ SearchSelect: (p: any) => NativeSearchSelect(p) }));
vi.mock("@/components/voice-form-fill", () => ({ VoiceFormFill: () => null }));
vi.mock("@/features/companies/components/company-picker", () => ({ CompanyPicker: () => null }));
vi.mock("@/features/shipping/components/shipping-line-picker", () => ({ ShippingLinePicker: () => null }));
vi.mock("@/lib/purchases/lane-client", () => ({ fetchLaneStates: async () => ({}), ensureLaneForLoading: vi.fn(), laneReportHref: () => "#" }));

import { resetRouteCountryCache } from "@/features/location-master/components/booking-route-fields";
// @ts-expect-error JSX view module
import { SalesBookingStep3 } from "@/features/sales/components/sales-booking-step3.jsx";
import { SalesLoadingEntry } from "@/features/sales/components/sales-loading-entry";
import { LoadDetailsModal } from "@/features/purchases/components/purchase-loading-records-view";
import { toLoadingOrder } from "@/lib/sales/loading-workflow";
import { PurchaseOrderWizard } from "@/features/purchases/components/purchase-order-wizard.jsx";

let posted: any = null;
beforeEach(() => {
  posted = null;
  resetRouteCountryCache();
  vi.stubGlobal("React", React);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    if (init?.method && init.method !== "GET") {
      posted = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ ok: true, data: { records: [{ id: "saved" }] } }), { status: 200 });
    }
    const data = routeMasterResponse(input) || { records: [], ports: [], countries: [], trucks: [] };
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const optionTexts = (el: HTMLElement) => Array.from((el as HTMLSelectElement).options).map((o) => o.text);

describe("Sales Booking — shipping step", () => {
  it("prefills a legacy name-only route and switches ports → borders with the shipping mode", async () => {
    let latest: any = {};
    function Step() {
      const [form, setForm] = useState<any>({ shippingMode: "By Sea", loadingCountry: "United Arab Emirates", loadingPort: "Jebel Ali Port", receivedCountry: "Pakistan", receivedPort: "Karachi Port" });
      latest = form;
      return <SalesBookingStep3 form={form} setForm={setForm} goodsEntries={[]} />;
    }
    render(<Step />);
    const loading = within(screen.getByTestId("sales-booking-loading-route"));
    await waitFor(() => expect(latest.loadingLocationId).toBe("l-jea"));
    expect(latest).toMatchObject({ loadingCountryId: "c-ae", loadingCountry: "United Arab Emirates", loadingPort: "Jebel Ali Port",
      receivedCountryId: "c-pk", receivedLocationId: "l-khi", receivedPort: "Karachi Port" });

    fireEvent.change(screen.getByLabelText("Shipping Mode"), { target: { value: "By Road" } });
    const recv = within(screen.getByTestId("sales-booking-receiving-route"));
    await waitFor(() => expect(latest).toMatchObject({ receivedLocationId: "", receivedPort: "", loadingLocationId: "", loadingPort: "" }));
    await waitFor(() => expect(optionTexts(recv.getByLabelText("Receiving Border"))).toContain("Torkham Border"));
    fireEvent.change(recv.getByLabelText("Receiving Border"), { target: { value: "l-tor" } });
    expect(latest).toMatchObject({ receivedLocationId: "l-tor", receivedPort: "Torkham Border", receivingBorder: "Torkham Border" });
    expect(loading.getByLabelText("Loading Border")).toBeTruthy();
  });
});

describe("Purchase Booking — shipping step", () => {
  const country = "c-ae", main = "0ae00000-0000-4000-8000-000000000002", city = "0ae00000-0000-4000-8000-000000000003";
  const account = (id: string, code: string, name: string) => ({ id, country_id: country, country_branch_id: main, city_branch_id: city, code, name, operational_domain: "business", status: "active", currency: "AED", kind: "asset" });
  it("shows the Route & Location Master pickers for loading and receiving", async () => {
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") throw new Error("No database writes in this test");
      const url = new URL(input, "http://localhost");
      let data: Record<string, unknown> = routeMasterResponse(input) || {};
      if (url.pathname.endsWith("/branches/main")) data = { branches: [{ id: main, name: "Dubai Main", country_id: country, code: "AE-DXB-001" }] };
      if (url.pathname.endsWith("/branches/city")) data = { cityBranches: [{ id: city, city_name: "Al Ras", code: "DXB-ALR-001" }] };
      if (url.pathname.endsWith("/accounting/accounts")) data = { accounts: [account("A1", "A-PUR", "Business Purchase"), account("A2", "A-SAL", "Business Sales")], limit: 1000 };
      return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    }));
    render(<PurchaseOrderWizard startOnForm session={{ isSuperAdmin: true, scopes: { isSuperAdmin: true }, roles: ["super_admin"] }} />);
    const title = await screen.findByRole("heading", { name: /Select Working Scope/i });
    const scope = within(title.parentElement!.parentElement!);
    const [countrySelect, mainSelect, citySelect] = scope.getAllByRole("combobox");
    fireEvent.change(countrySelect, { target: { value: country } });
    await waitFor(() => expect((mainSelect as HTMLSelectElement).options.length).toBeGreaterThan(1));
    fireEvent.change(mainSelect, { target: { value: main } });
    await waitFor(() => expect((citySelect as HTMLSelectElement).options.length).toBeGreaterThan(1));
    fireEvent.change(citySelect, { target: { value: city } });
    fireEvent.click(scope.getByRole("button", { name: /Confirm Scope/i }));
    await screen.findByPlaceholderText("Business Purchase (A-PUR)");
    fireEvent.click(screen.getAllByRole("button", { name: /3 Shipping & Payment/ })[0]);

    const loading = within(await screen.findByTestId("purchase-booking-loading-route"));
    const loadingCountry = loading.getByLabelText(/Loading Country/) as HTMLSelectElement;
    await waitFor(() => expect(optionTexts(loadingCountry)).toContain("Pakistan (PK)"));
    fireEvent.change(loadingCountry, { target: { value: "c-ae" } });
    await waitFor(() => expect(optionTexts(loading.getByLabelText("Loading Port"))).toContain("Jebel Ali Port"));
    fireEvent.change(loading.getByLabelText("Loading Port"), { target: { value: "l-jea" } });
    expect((loading.getByLabelText("Loading Port") as HTMLSelectElement).value).toBe("l-jea");
    const receiving = within(screen.getByTestId("purchase-booking-receiving-route"));
    fireEvent.change(receiving.getByLabelText(/Receiving Country/), { target: { value: "c-pk" } });
    await waitFor(() => expect(optionTexts(receiving.getByLabelText("Receiving Port"))).toContain("Karachi Port"));
  });
});

describe("Sales Loading entry", () => {
  it("defaults each container's route from the booking and saves names + ids", async () => {
    const order = toLoadingOrder({ id: "e73b8a60-042e-4ff5-a7e1-fce71c64a502", sales_order_no: "SB-ROUTE-1", order_date: "2026-11-27",
      form_data: { form: { shippingMode: "By Sea", loadingCountry: "United Arab Emirates", loadingPort: "Jebel Ali Port", receivedCountry: "Pakistan", receivedCountryId: "c-pk", receivedPort: "Karachi Port", receivedLocationId: "l-khi" },
        goodsEntries: [{ goodsName: "Walnut kernels", qtyNo: 100, qtyName: "Cartons" }] } }, false);
    render(<SalesLoadingEntry order={order} records={[]} tt={(_k, f) => f} onBack={vi.fn()} onSaved={vi.fn()} />);
    const entry = within(screen.getByTestId("sales-loading-entry"));
    for (const next of ["Next: Parties", "Next: Goods", "Next: New Loading"]) fireEvent.click(entry.getByRole("button", { name: next }));
    const loading = within(entry.getByTestId("sales-loading-route-0"));
    await waitFor(() => expect((loading.getByLabelText("Loading Port") as HTMLSelectElement).value).toBe("l-jea"));
    fireEvent.change(loading.getByLabelText("Loading Country"), { target: { value: "c-pk" } });
    await waitFor(() => expect(optionTexts(loading.getByLabelText("Loading Port"))).toContain("Karachi Port"));
    fireEvent.change(loading.getByLabelText("Loading Port"), { target: { value: "l-khi" } });

    fireEvent.change(entry.getByLabelText("Container Number *"), { target: { value: "ROUTE1234567" } });
    fireEvent.change(entry.getByLabelText("Loading Date"), { target: { value: "2026-11-27" } });
    fireEvent.click(entry.getByRole("checkbox", { name: /Walnut kernels/ }));
    for (const [label, value] of [["Loading Quantity *", "10"], ["Gross Weight (KG)", "100"], ["Net Weight (KG)", "90"]]) fireEvent.change(entry.getByLabelText(label), { target: { value } });
    await act(async () => { fireEvent.click(entry.getByRole("button", { name: "Save Loading" })); });
    expect(posted.containers[0]).toMatchObject({ loadingCountry: "Pakistan", loadingCountryId: "c-pk", loadingPort: "Karachi Port", loadingLocationId: "l-khi",
      receivedCountry: "Pakistan", receivedCountryId: "c-pk", receivedPort: "Karachi Port", receivedLocationId: "l-khi" });
  });
});

describe("Purchase Loading entry", () => {
  const record: any = { id: "rec-1", loading_record_no: "L1", purchase_order_no: "P-ROUTE", purchase_order_id: "p1", loading_status: "pending", container_number: "", created_at: "2026-11-01", report_payload: {},
    purchase_orders: { id: "p1", order_total: 0, form_data: { form: { shippingMode: "By Road", loadingCountry: "United Arab Emirates", loadingBorder: "Hatta Border", loadingPort: "Hatta Border", receivedCountry: "Pakistan", receivedPort: "Torkham Border" },
      goodsEntries: [{ goodsName: "Walnuts", qtyNo: 100, qtyName: "CARTON" }] } } };
  it("opens with the booking's route preselected and lists borders for a by-road booking", async () => {
    await act(async () => { render(<LoadDetailsModal record={record} onClose={vi.fn()} />); });
    fireEvent.click(screen.getByTestId("new-loading-btn"));
    const recv = within(screen.getByTestId("purchase-receiving-route"));
    fireEvent.change(screen.getByLabelText("Transport Mode"), { target: { value: "By Road" } });
    await waitFor(() => expect((recv.getByLabelText("Receiving Border") as HTMLSelectElement).value).toBe("l-tor"));
    const loading = within(screen.getByTestId("purchase-loading-route"));
    await waitFor(() => expect((loading.getByLabelText("Loading Border") as HTMLSelectElement).value).toBe("l-hatta"));
    expect((loading.getByLabelText("Loading Country") as HTMLSelectElement).value).toBe("c-ae");
  });
});
