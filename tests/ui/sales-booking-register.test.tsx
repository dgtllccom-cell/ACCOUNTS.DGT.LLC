// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SalesBookingGlobalRegisterView } from "@/features/sales/components/sales-booking-global-register-view";
import { translateHeader } from "@/lib/i18n/table-headers";

const mocks = vi.hoisted(() => ({ push: vi.fn(), apiGet: vi.fn(), print: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api/client", () => ({ apiGet: mocks.apiGet }));
vi.mock("@/lib/reports/universal-print-engine", () => ({ openUniversalPrintReport: mocks.print }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/features/sales/components/sales-order-wizard.jsx", () => ({ SalesOrderWizard: () => null }));
vi.mock("@/features/document-intelligence/components/entry-method-selector", () => ({ EntryMethodSelector: () => null }));

const row = {
  id: "draft", salesBookingOrderNumber: "SO-245", systemBillNumber: "SO-245", canEdit: true,
  superAdminSerialNo: "SA-130", countrySerialNo: "AE-52", cityBranchSerialNo: "DXB-40",
  countryName: "United Arab Emirates", countryCode: "AE",
  countryMainBranchName: "UAE Main", countryMainBranchCode: "MB001",
  cityBranchName: "Dubai", cityBranchCode: "DXB",
  customerName: "Customer One", customerAccountNumber: "DR-12",
  salesAccountName: "Wholesale", salesAccountNumber: "CR-14",
  purchaseAccountName: "Supplier One", purchaseAccountNumber: "PA-18",
  productName: "Walnuts", quantity: 12, unit: "Bags", totalGrossWeight: 255, totalNetWeight: 240,
  currency: "PKR", totalSalesAmount: 77200, finalCurrency: "AED", finalAmount: 1000,
  purchaseCurrency: "AED", purchaseAmount: 800, exchange_rate: 77.2, exchangeRateOperator: "/",
  form_data: { form: { saleMode: "local" } },
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Sales Booking Register", () => {
  it("shows stored serials, branch/account details, and amounts without converting them again", async () => {
    mocks.apiGet.mockResolvedValue({ reports: [row] });
    render(<SalesBookingGlobalRegisterView session={{}} lang="en" />);
    const bill = await screen.findByRole("button", { name: "SO-245" });
    fireEvent.click(bill);
    const popup = await screen.findByText("Bill serial numbers");
    const serials = within(popup.parentElement!);
    expect(serials.getByText("SA-130")).toBeTruthy();
    expect(serials.getByText("AE-52")).toBeTruthy();
    expect(serials.getByText("DXB-40")).toBeTruthy();
    expect(serials.getByText("Country Main Branch").parentElement?.textContent).toContain("—");

    const record = within(bill.closest("tr")!);
    for (const value of ["UAE Main · MB001", "Dubai · DXB", "Supplier One · PA-18",
      "PKR 77,200.00", "AED 800.00", "AED 1,000.00", "PKR ÷ 77.2 → AED", "255.00", "240.00"]) {
      expect(record.getByText(value)).toBeTruthy();
    }
    expect(record.queryByRole("button", { name: "Print Invoice" })).toBeNull();
    fireEvent.click(bill);
    fireEvent.click(record.getByRole("button", { name: "Edit" }));
    expect(mocks.push).toHaveBeenCalledWith("/dashboard/sales/new-sales-booking-order?salesOrderId=draft");
  });

  it.each(["ur", "ar", "fa", "ps"])("uses translated RTL controls and withholds Edit when locked (%s)", async lang => {
    mocks.apiGet.mockResolvedValue({ reports: [{ ...row, canEdit: false, status: "posted" }] });
    const { container } = render(<SalesBookingGlobalRegisterView session={{}} lang={lang} />);
    const bill = await screen.findByRole("button", { name: "SO-245" });
    expect(container.querySelector("[dir=rtl]")).toBeTruthy();
    expect(screen.queryByRole("button", { name: translateHeader(lang, "Edit") })).toBeNull();

    const actions = within(bill.closest("tr")!).getByRole("button", { name: translateHeader(lang, "Actions") });
    fireEvent.keyDown(actions, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: translateHeader(lang, "Print Invoice") })).toBeTruthy();
    fireEvent.click(within(menu).getByRole("menuitem", { name: translateHeader(lang, "View") }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
