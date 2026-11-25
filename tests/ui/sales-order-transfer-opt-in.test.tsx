// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SalesOrderManagementDashboard } from "@/features/sales/components/sales-order-management-dashboard";

const { apiGet, push, exportRows } = vi.hoisted(() => ({ apiGet: vi.fn(), push: vi.fn(), exportRows: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/client", () => ({ apiGet, apiPatch: vi.fn() }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/lib/hooks/use-erp-scope", () => ({ useErpScope: () => ({ isSuperAdmin: true }) }));
vi.mock("@/lib/purchase-ui/use-usd-rates", () => ({ useUsdRates: () => ({}) }));
vi.mock("@/features/translations/components/record-translation-correction-dialog", () => ({ RecordTranslationCorrectionDialog: () => null }));
vi.mock("@/features/reports/components/trade-document-center", () => ({ TradeDocumentCenter: () => null }));
vi.mock("@/components/reports/journal-print-button", () => ({
  JournalPrintButton: ({ fetchFullData }: { fetchFullData: () => Promise<unknown> }) =>
    <button onClick={() => { void fetchFullData().then(exportRows); }}>Export all</button>,
}));
vi.mock("@/features/expenses/components/add-expense-bill-button", () => ({ AddExpenseBillButton: () => null }));
vi.mock("@/components/purchase-ui/purchase-page-top", () => ({
  PurchasePageTop: ({ title, onOpenFilters, menu }: { title: string; onOpenFilters: () => void; menu: React.ReactNode }) => <header>
    <h1>{title}</h1><button onClick={onOpenFilters}>Open filters</button>{menu}
  </header>,
}));
vi.mock("@/components/purchase-ui/advanced-register-search", () => ({
  AdvancedRegisterSearch: ({ open, onApply }: { open: boolean; onApply: (v: Record<string, string>) => void }) =>
    open ? <button onClick={() => onApply({ bookingNo: "SB-0042", bookingDate: "2026-11-25", originPort: "Jebel Ali", goods: "Walnuts", lot: "Lot-14", account: "A-14", currency: "AED", paymentType: "Credit", paymentStatus: "pending" })}>Apply advanced</button> : null,
}));

const posted = {
  id: "order-1", sales_order_no: "SB-0042", sales_status: "pending", ledger_posting_status: "posted",
  order_total: 367.25, currency_code: "AED", original_currency_code: "USD", total_goods_original: 100, quantity: 1,
  paid_amount: 0, total_weight: 20, exchange_rate: 3.6725, order_date: "2026-11-25",
  form_data: { form: { salesCurrency: "USD", secondaryCurrency: "AED", exchangeRate: 3.6725, loadingPort: "Jebel Ali" } },
};

describe("Sales Transfer is an opt-in lane on the existing register", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    apiGet.mockReset();
    push.mockReset();
    exportRows.mockReset();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("leaves the default management UI and list query in place", async () => {
    apiGet.mockResolvedValue({ salesOrders: [posted] });
    render(<SalesOrderManagementDashboard />);
    expect(screen.getByRole("heading", { name: "Sales Order Management" })).toBeTruthy();
    expect(await screen.findByText("SB-0042")).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith("/api/erp/sales/orders?");
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();
  });

  it("adds a review action on an unposted completed booking without changing its default lane", async () => {
    apiGet.mockResolvedValue({ salesOrders: [{ ...posted, ledger_posting_status: "draft" }] });
    render(<SalesOrderManagementDashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "Sales Transfer Payment" }));
    expect(push).toHaveBeenCalledWith("/dashboard/sales/sales-order/view?id=order-1&transfer=1");
    expect(apiGet).toHaveBeenCalledWith("/api/erp/sales/orders?");
  });

  it("uses the same table, scoped server search and existing report route for transferred bills", async () => {
    apiGet.mockResolvedValue({ salesOrders: [posted] });
    render(<SalesOrderManagementDashboard transferOnly />);
    expect(await screen.findByText("SB-0042")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining("transferred=1"));
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(push).toHaveBeenCalledWith("/dashboard/sales/sales-order/view?id=order-1&transfer=1");
    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply advanced" }));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(expect.stringMatching(/q=SB-0042.*searchField=booking.*bookingDate=2026-11-25.*originPort=Jebel\+Ali.*goods=Walnuts.*lot=Lot-14.*account=A-14.*currency=AED.*paymentType=Credit.*paymentStatus=pending/)));
  });

  it("opens and returns from a later page without duplicating rows, and resets paging for a new filter", async () => {
    const cursor = "2026-11-25T08:15:20.123456Z~c4e61e96-0191-43da-9568-d32d9d913039";
    const second = { ...posted, id: "order-2", sales_order_no: "SB-0099" };
    apiGet.mockImplementation(async (url: string) => {
      const params = new URL(url, "http://localhost").searchParams;
      if (params.has("q")) return { salesOrders: [posted], nextOffset: null };
      if (params.get("offset") === "100") {
        expect(params.get("cursor")).toBe(cursor);
        return { salesOrders: [second], nextOffset: null };
      }
      return { salesOrders: [posted], nextOffset: 100, nextCursor: cursor };
    });
    render(<SalesOrderManagementDashboard transferOnly />);
    fireEvent.click(await screen.findByRole("button", { name: "Next page" }));
    expect(await screen.findByText("SB-0099")).toBeTruthy();
    expect(screen.queryByText("SB-0042")).toBeNull();
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(await screen.findByText("SB-0042")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("SB-0099")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply advanced" }));
    expect(await screen.findByText("SB-0042")).toBeTruthy();
    const lastUrl = apiGet.mock.calls.at(-1)?.[0];
    expect(lastUrl).toContain("bookingDate=2026-11-25");
    expect(lastUrl).not.toContain("offset=100");
  });

  it("ignores a stale page result after new filters finish", async () => {
    type Result = { salesOrders: typeof posted[]; nextOffset: number | null };
    let finish: (result: Result) => void = () => undefined;
    const second = { ...posted, id: "order-2", sales_order_no: "SB-0099" };
    apiGet.mockImplementation((url: string) => {
      const params = new URL(url, "http://localhost").searchParams;
      if (params.has("q")) return Promise.resolve({ salesOrders: [posted], nextOffset: null });
      if (params.get("offset") === "100") return new Promise<Result>(resolve => { finish = resolve; });
      return Promise.resolve({ salesOrders: [posted], nextOffset: 100 });
    });
    render(<SalesOrderManagementDashboard transferOnly />);
    fireEvent.click(await screen.findByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply advanced" }));
    expect(await screen.findByText("SB-0042")).toBeTruthy();
    await act(async () => finish({ salesOrders: [second], nextOffset: 200 }));
    expect(screen.queryByText("SB-0099")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("walks all scoped result pages when exporting, de-duplicating a shifted row", async () => {
    const second = { ...posted, id: "order-2", sales_order_no: "SB-0099" };
    apiGet.mockImplementation(async (url: string) => {
      const params = new URL(url, "http://localhost").searchParams;
      if (params.get("limit") !== "200") return { salesOrders: [posted], nextOffset: 100 };
      expect(params.get("transferred")).toBe("1");
      return params.get("offset") === "200"
        ? { salesOrders: [posted, second], nextOffset: null }
        : { salesOrders: [posted], nextOffset: 200 };
    });
    render(<SalesOrderManagementDashboard transferOnly />);
    expect(await screen.findByText("SB-0042")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export all" }));
    await waitFor(() => expect(exportRows).toHaveBeenCalledWith([
      expect.objectContaining({ sales_order_no: "SB-0042" }),
      expect.objectContaining({ sales_order_no: "SB-0099" }),
    ]));
  });
});
