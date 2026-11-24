import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
(globalThis as any).React = React;
import { SalesBookingStep2 } from "@/features/sales/components/sales-booking-step2";

const walnutLot = {
  purchaseAccountName: "Walnut supplier", purchaseAccountNo: "PUR-WAL",
  id: "lot-1", lotNo: "LOT-WAL-001", source: "lot", goodsId: "g1", goodsName: "Walnut Kernels", brand: "Chaman Gold", size: "Light",
  origin: "Afghanistan", hsCode: "080232", qtyName: "BAGS", availableQty: 500, remainingQty: 500, qtyKgs: 50, emptyKgs: 0.2,
  netWeight: 0, location: "Rack A", warehouseName: "Dubai WH", stockRef: "LP-0001", containerNo: null, currencyType: "AED", exchangeRate: 1, coursePrice: 0, status: "ok",
};
const fetched: string[] = [];

function Harness() {
  const [form, setForm] = React.useState<any>({ salesCurrency: "USD", secondaryCurrency: "AED", exchangeRate: 3.673, operator: "*" });
  const [goods, setGoods] = React.useState<any[]>([]);
  return <SalesBookingStep2 form={form} setForm={setForm} goodsEntries={goods} setGoodsEntries={setGoods} lang="en" onNext={() => {}} onBack={() => {}} />;
}

beforeEach(() => {
  fetched.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    fetched.push(String(url));
    const lots = String(url).includes("source=warehouse_all") ? [walnutLot] : [];
    return { ok: true, status: 200, json: async () => ({ ok: true, data: { lots } }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Sales Booking step 2 — stock first, then item search", () => {
  it("starts empty (no sample goods) and searches the chosen stock's real records", async () => {
    render(<Harness />);
    expect(document.body.textContent).not.toMatch(/Almond|Pistachio|Raisins/);
    const search = screen.getByTestId("sales-item-search");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "walnut" } });
    const list = await screen.findByTestId("sales-item-suggestions");
    expect(await within(list).findByText("Walnut Kernels")).toBeTruthy();
    expect(fetched.some((u) => u.includes("source=warehouse_all"))).toBe(true);

    fireEvent.click(within(list).getByText("Walnut Kernels"));
    expect((search as HTMLInputElement).value).toBe("Walnut Kernels");
    expect(document.body.textContent).toContain("LOT-WAL-001");
  });

  it("Booking Stock loads purchase-booking stock", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Booking Stock"));
    await vi.waitFor(() => expect(fetched.some((u) => u.includes("source=booking"))).toBe(true));
  });

  it("opens the stock picker as an overlay outside the booking form", async () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open Stock" }));
    const picker = screen.getByRole("dialog", { name: "Select Stock to Sell" });
    expect(picker.parentElement).toBe(document.body);
    expect(container.contains(picker)).toBe(false);
    expect(await within(picker).findByText("Walnut Kernels")).toBeTruthy();
    fireEvent.click(within(picker).getByTestId("stock-panel-close"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the lot and both currency amounts without a totals row", async () => {
    render(<Harness />);
    const search = screen.getByTestId("sales-item-search");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "wal" } });
    fireEvent.click(await within(await screen.findByTestId("sales-item-suggestions")).findByText("Walnut Kernels"));

    const form = screen.getByRole("heading", { name: /goods entry details/i }).parentElement!.parentElement!;
    const numberInput = (label: RegExp) => within(form).getAllByRole("spinbutton").find(
      input => label.test(input.closest("div")?.querySelector("label")?.textContent ?? "")
    )!;
    fireEvent.change(numberInput(/quantity/i), { target: { value: "100" } });
    fireEvent.change(numberInput(/^unit price$/i), { target: { value: "12.5" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add Goods Item to Table" }));

    const table = screen.getByRole("table");
    const row = within(table).getByText("Walnut Kernels").closest("tr")!;
    expect(within(row).getByText("LOT-WAL-001")).toBeTruthy();
    expect(within(row).getByText("USD 1,250.00")).toBeTruthy();
    expect(screen.queryByText(/exchange rate/i)).toBeNull();
    expect(screen.queryByText(/sales currency/i)).toBeNull();
    expect(within(row).getByText("AED 4,591.25")).toBeTruthy();
    expect(table.querySelector("tfoot")).toBeNull();
    const accounts = screen.getByRole("heading", { name: "Customer / Purchase Account" }).closest("section")!;
    expect(within(accounts).getByText("Walnut supplier")).toBeTruthy();
    expect(within(accounts).getByText("PUR-WAL")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Summary Totals" })).toBeNull();
  });

  it("the same lot cannot be added twice", async () => {
    render(<Harness />);
    const search = screen.getByTestId("sales-item-search");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "wal" } });
    fireEvent.click(await within(await screen.findByTestId("sales-item-suggestions")).findByText("Walnut Kernels"));
    const qty = document.querySelectorAll('input[type="number"]');
    // quantity field: set 100 on whichever number input carries qtyNo
    const qtyInput = Array.from(qty).find((el) => (el as HTMLInputElement).closest("div")?.textContent?.match(/quantity/i)) as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { value: "100" } });
    fireEvent.click(screen.getByText("Add Goods Item to Table"));
    expect(screen.getAllByText("Walnut Kernels").length).toBeGreaterThan(0);
    // pick the same lot again and try to add it
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "wal" } });
    fireEvent.click(await within(await screen.findByTestId("sales-item-suggestions")).findByText("Walnut Kernels"));
    fireEvent.change(qtyInput, { target: { value: "50" } });
    fireEvent.click(screen.getByText("Add Goods Item to Table"));
    expect(document.body.textContent).toContain("already in the table");
  });
});
