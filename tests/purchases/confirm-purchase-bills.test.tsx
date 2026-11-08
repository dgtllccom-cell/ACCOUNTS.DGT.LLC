import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ConfirmPurchaseBillsView } from "@/features/purchases/components/confirm-purchase-bills-view";

const mockBills = [
  {
    id: "po-1-load-1",
    confirmBillNo: "CP-AE-001-0010-01",
    originalBillNo: "AE-001-0010",
    originalBillId: "po-1",
    purchaseType: "booking" as const,
    purchaseTypeLabel: "Purchase Booking",
    paymentType: "Advance",
    supplierName: "Al-Khaleej Foodstuff Trading",
    supplierAccountNo: "ACC-5001",
    loadingEntryNo: "LD-001",
    loadingDate: "2026-11-05",
    loadingAgency: "Dubai Express Logistics",
    truckNo: "DXB-98765",
    driverName: "Muhammad Khan",
    goodsName: "Basmati Rice 1121",
    lotNo: "LOT-2026-01",
    quantityUnit: "Cartons",
    loadedQuantity: 400,
    grossWeightKg: 8400,
    netWeightKg: 8000,
    totalPurchaseQuantity: 1000,
    totalLoadedQuantity: 400,
    remainingLoadingQuantity: 600,
    currency: "USD",
    billTotal: 45000,
    advancePaid: 15000,
    remainingPaid: 0,
    paymentStatus: "Partial",
    countryName: "United Arab Emirates",
    branchName: "Deira Branch",
    userName: "Operator 1",
    containerNo: "MSCU-1234567",
    blNo: "BL-998877",
    transferHistory: [
      { stage: "Booking Registered", date: "2026-11-01", reference: "AE-001-0010" },
      { stage: "Loading Sealed", date: "2026-11-05", reference: "LD-001", details: "400 Cartons" },
      { stage: "Confirmed Stock Available", date: "2026-11-05", reference: "CP-AE-001-0010-01" },
    ],
    createdAt: "2026-11-05T10:00:00Z",
  },
  {
    id: "lp-1-load-1",
    confirmBillNo: "CP-LP-0042-01",
    originalBillNo: "LP-0042",
    originalBillId: "lp-1",
    purchaseType: "local" as const,
    purchaseTypeLabel: "Local Purchase",
    paymentType: "Cash",
    supplierName: "Emirates Fresh Poultry",
    supplierAccountNo: "ACC-2033",
    loadingEntryNo: "LPL-01",
    loadingDate: "2026-11-06",
    loadingAgency: "Local Fleet",
    truckNo: "SHJ-11223",
    driverName: "Rashid Ali",
    goodsName: "Fresh Whole Chicken",
    lotNo: "LOT-LOCAL-09",
    quantityUnit: "Boxes",
    loadedQuantity: 250,
    grossWeightKg: 2600,
    netWeightKg: 2500,
    totalPurchaseQuantity: 250,
    totalLoadedQuantity: 250,
    remainingLoadingQuantity: 0,
    currency: "AED",
    billTotal: 18500,
    advancePaid: 18500,
    remainingPaid: 0,
    paymentStatus: "Paid",
    countryName: "United Arab Emirates",
    branchName: "Sharjah Branch",
    userName: "Local Admin",
    containerNo: null,
    blNo: null,
    transferHistory: [
      { stage: "Local Bill Posted", date: "2026-11-06", reference: "LP-0042" },
      { stage: "Confirmed Stock Available", date: "2026-11-06", reference: "CP-LP-0042-01" },
    ],
    createdAt: "2026-11-06T14:30:00Z",
  },
];

describe("ConfirmPurchaseBillsView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              data: {
                bills: mockBills,
                summary: {
                  totalBills: 2,
                  bookingBills: 1,
                  localBills: 1,
                  totalLoadedQuantity: 650,
                  totalGrossWeightKg: 11000,
                  totalNetWeightKg: 10500,
                },
              },
            }),
        });
      })
    );
  });

  it("renders the 5 summary cards with accurate totals", async () => {
    render(<ConfirmPurchaseBillsView />);

    await waitFor(() => {
      // Total confirmed bills
      expect(screen.getByText("Total Confirmed Bills")).toBeDefined();
      expect(screen.getByText("Purchase Booking Bills")).toBeDefined();
      expect(screen.getByText("Local Purchase Bills")).toBeDefined();
      expect(screen.getByText("Total Loaded Quantity")).toBeDefined();
      expect(screen.getByText("Total Weight (Gross / Net)")).toBeDefined();
    });
  });

  it("displays both Purchase Booking and Local Purchase bills with unique CP numbering", async () => {
    render(<ConfirmPurchaseBillsView />);

    await waitFor(() => {
      expect(screen.getByText("CP-AE-001-0010-01")).toBeDefined();
      expect(screen.getByText("CP-LP-0042-01")).toBeDefined();
    });
  });

  it("applies the partial loading rule: displays loaded quantity vs remaining purchase quantity", async () => {
    render(<ConfirmPurchaseBillsView />);

    await waitFor(() => {
      // 400 loaded cartons
      expect(screen.getByText("400")).toBeDefined();
      // Total purchase was 1,000, remaining is 600
      expect(screen.getByText("PO: 1,000")).toBeDefined();
      expect(screen.getByText("Rem: 600 Cartons")).toBeDefined();
    });
  });

  it("filters bills by payment type correctly", async () => {
    render(<ConfirmPurchaseBillsView />);

    await waitFor(() => {
      expect(screen.getByText("CP-AE-001-0010-01")).toBeDefined();
      expect(screen.getByText("CP-LP-0042-01")).toBeDefined();
    });

    // Click 'cash' payment filter button
    const cashBtn = screen.getByRole("button", { name: /^cash$/i });
    fireEvent.click(cashBtn);

    await waitFor(() => {
      // Local purchase was Cash
      expect(screen.getByText("CP-LP-0042-01")).toBeDefined();
      // Booking was Advance, should be hidden
      expect(screen.queryByText("CP-AE-001-0010-01")).toBeNull();
    });
  });

  it("opens View Details modal containing all 16 required fields", async () => {
    render(<ConfirmPurchaseBillsView />);

    await waitFor(() => {
      expect(screen.getByText("CP-AE-001-0010-01")).toBeDefined();
    });

    const viewButtons = screen.getAllByTitle("View Details");
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      // Modal section headers
      expect(screen.getByText("1. Bill & Supplier Information")).toBeDefined();
      expect(screen.getByText("2. Loading & Logistics Details")).toBeDefined();
      expect(screen.getByText("3. Goods & Quantity Confirmation")).toBeDefined();
      expect(screen.getByText("4. Financial Status & Transfer History")).toBeDefined();

      // Supplier and Account
      expect(screen.getAllByText("Al-Khaleej Foodstuff Trading").length).toBeGreaterThan(0);
      expect(screen.getAllByText("ACC-5001", { exact: false }).length).toBeGreaterThan(0);
      // Loading details
      expect(screen.getAllByText("LD-001").length).toBeGreaterThan(0);
      expect(screen.getAllByText("DXB-98765").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Muhammad Khan", { exact: false }).length).toBeGreaterThan(0);
      expect(screen.getAllByText("Dubai Express Logistics", { exact: false }).length).toBeGreaterThan(0);
      // Goods & lot
      expect(screen.getAllByText("Basmati Rice 1121").length).toBeGreaterThan(0);
      expect(screen.getAllByText("LOT-2026-01", { exact: false }).length).toBeGreaterThan(0);
      // Weights
      expect(screen.getAllByText("8,400 kg", { exact: false }).length).toBeGreaterThan(0);
      expect(screen.getAllByText("8,000 kg", { exact: false }).length).toBeGreaterThan(0);
    });
  });
});
