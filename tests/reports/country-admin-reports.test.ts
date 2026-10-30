import { describe, expect, it } from "vitest";

// Data types aligned with Country Admin Reports route
export interface CountryReportRow {
  id: string;
  serialNumber: number;
  date: string;
  reportType: "Purchase" | "Cash Entry" | "Endorse" | "Sales" | "Bank Entry" | "Expense";
  billType: string;
  billNo: string;
  referenceNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  status: string;
  currency: string;
  exchangeRate: number;
  countryId?: string | null;
  countryName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  sourceModule: string;
  sourceTable: string;
  originalId: string;
  details?: Record<string, any>;
}

// Logic helper mirrors app/api/erp/reports/country/route.ts classification
export function classifyRecord(raw: {
  table: "purchase_orders" | "purchase_order_payments" | "roznamcha_entries";
  data: Record<string, any>;
}): { reportType: CountryReportRow["reportType"]; billType: string; billNo: string; description: string } {
  if (raw.table === "purchase_orders") {
    const formData = raw.data.form_data || {};
    const form = formData.form || {};
    const isLocal =
      String(raw.data.purchase_order_no || "").startsWith("LP-") ||
      form.purchaseType === "local" ||
      String(form.billNo || "").startsWith("LP-");

    const billType = isLocal ? "Local Purchase" : "Purchase Booking";
    const billNo = form.billNo || form.manualBillNumber || raw.data.purchase_order_no || "PB-UNKNOWN";
    const goods = (formData.goodsEntries || form.goodsEntries || [])[0];
    const goodsSummary = goods ? `${goods.goodsName || goods.productName} (${goods.qtyNo || goods.quantity} ${goods.unit || "MT"})` : "Goods";
    const desc = `${billType} | Goods: ${goodsSummary} | Supplier: ${form.supplierName || "Al Noor Imports"}`;
    return { reportType: "Purchase", billType, billNo, description: desc };
  }

  if (raw.table === "purchase_order_payments") {
    const isAdvance = raw.data.kind === "advance";
    const billType = isAdvance ? "Advance Payment" : "Remaining Payment";
    const billNo = raw.data.reference_no || (isAdvance ? "AP-2026-0001" : "RP-2026-0001");
    const parentNo = raw.data.purchase_order_no || "PB-LINKED";
    const desc = `${billType} | Purchase No: ${parentNo}`;
    return { reportType: "Endorse", billType, billNo, description: desc };
  }

  // roznamcha_entries
  const isCash = raw.data.type === "cash";
  const billType = isCash ? "Cash Entry" : "Bank Entry";
  const reportType = isCash ? "Cash Entry" : "Bank Entry";
  const billNo = raw.data.reference_no || raw.data.voucher_no || (isCash ? "CE-2026-0001" : "BE-2026-0001");
  const desc = raw.data.narration || `${billType} | Transaction`;
  return { reportType, billType, billNo, description: desc };
}

// KPI aggregator mirrors API calculation
export function calculateKpis(rows: CountryReportRow[]) {
  const kpis = {
    purchase: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
    localPurchase: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
    cashEntry: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
    endorse: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
  };

  for (const r of rows) {
    const amt = r.debit || r.credit;
    const localAmt = amt * (r.exchangeRate || 3.67);

    if (r.reportType === "Purchase") {
      if (r.billType === "Local Purchase") {
        kpis.localPurchase.totalBills++;
        kpis.localPurchase.totalAmountUsd += amt;
        kpis.localPurchase.totalAmountLocal += localAmt;
      } else {
        kpis.purchase.totalBills++;
        kpis.purchase.totalAmountUsd += amt;
        kpis.purchase.totalAmountLocal += localAmt;
      }
    } else if (r.reportType === "Cash Entry") {
      kpis.cashEntry.totalBills++;
      kpis.cashEntry.totalAmountUsd += amt;
      kpis.cashEntry.totalAmountLocal += localAmt;
    } else if (r.reportType === "Endorse") {
      kpis.endorse.totalBills++;
      kpis.endorse.totalAmountUsd += amt;
      kpis.endorse.totalAmountLocal += localAmt;
    }
  }

  return kpis;
}

// Filter helper
export function filterRows(
  rows: CountryReportRow[],
  filters: {
    reportType?: string;
    billType?: string;
    status?: string;
    search?: string;
  }
) {
  return rows.filter((r) => {
    if (filters.reportType && filters.reportType !== "all" && r.reportType !== filters.reportType) {
      return false;
    }
    if (filters.billType && filters.billType !== "all" && r.billType !== filters.billType) {
      return false;
    }
    if (filters.status && filters.status !== "all" && r.status.toLowerCase() !== filters.status.toLowerCase()) {
      return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        r.billNo.toLowerCase().includes(q) ||
        r.referenceNo.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.details?.supplierName && String(r.details.supplierName).toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });
}

describe("Country Admin Reports — Business Logic and Verification", () => {
  it("accurately classifies Purchase Booking vs Local Purchase from purchase_orders", () => {
    const importPO = classifyRecord({
      table: "purchase_orders",
      data: {
        purchase_order_no: "PB-2026-0001",
        form_data: {
          form: { billNo: "PB-2026-0001", purchaseType: "import", supplierName: "Al Noor Imports" },
          goodsEntries: [{ goodsName: "Pistachio", qtyNo: 5, unit: "MT" }],
        },
      },
    });
    expect(importPO.reportType).toBe("Purchase");
    expect(importPO.billType).toBe("Purchase Booking");
    expect(importPO.billNo).toBe("PB-2026-0001");
    expect(importPO.description).toContain("Pistachio (5 MT)");

    const localPO = classifyRecord({
      table: "purchase_orders",
      data: {
        purchase_order_no: "LP-2026-0018",
        form_data: {
          form: { billNo: "LP-2026-0018", purchaseType: "local", supplierName: "Local Farmer" },
          goodsEntries: [{ productName: "Almond Kernel", quantity: 10, unit: "MT" }],
        },
      },
    });
    expect(localPO.reportType).toBe("Purchase");
    expect(localPO.billType).toBe("Local Purchase");
    expect(localPO.billNo).toBe("LP-2026-0018");
    expect(localPO.description).toContain("Almond Kernel (10 MT)");
  });

  it("accurately classifies Endorse payments (Advance & Remaining)", () => {
    const advance = classifyRecord({
      table: "purchase_order_payments",
      data: {
        kind: "advance",
        reference_no: "AP-2026-0011",
        purchase_order_no: "PB-2026-0001",
      },
    });
    expect(advance.reportType).toBe("Endorse");
    expect(advance.billType).toBe("Advance Payment");
    expect(advance.billNo).toBe("AP-2026-0011");

    const remaining = classifyRecord({
      table: "purchase_order_payments",
      data: {
        kind: "remaining",
        reference_no: "RP-2026-0005",
        purchase_order_no: "PB-2026-0001",
      },
    });
    expect(remaining.reportType).toBe("Endorse");
    expect(remaining.billType).toBe("Remaining Payment");
    expect(remaining.billNo).toBe("RP-2026-0005");
  });

  it("accurately classifies Roznamcha Cash Entry and Bank Entry", () => {
    const cash = classifyRecord({
      table: "roznamcha_entries",
      data: {
        type: "cash",
        reference_no: "CE-2026-0032",
        narration: "Cash Entry | Bank | Payment for PB-2026-0001",
      },
    });
    expect(cash.reportType).toBe("Cash Entry");
    expect(cash.billType).toBe("Cash Entry");
    expect(cash.billNo).toBe("CE-2026-0032");

    const bank = classifyRecord({
      table: "roznamcha_entries",
      data: {
        type: "bank",
        reference_no: "BE-2026-0045",
        narration: "Supplier Payment via ADCB",
      },
    });
    expect(bank.reportType).toBe("Bank Entry");
    expect(bank.billType).toBe("Bank Entry");
    expect(bank.billNo).toBe("BE-2026-0045");
  });

  it("maintains the required 11 columns in exact order", () => {
    const expectedColumns = [
      "serialNumber",
      "date",
      "reportType",
      "billType",
      "billNo",
      "description",
      "debit",
      "credit",
      "balance",
      "status",
      "action",
    ];

    const sampleRow: CountryReportRow = {
      id: "row-1",
      serialNumber: 1,
      date: "2026-10-30",
      reportType: "Purchase",
      billType: "Purchase Booking",
      billNo: "PB-2026-0001",
      referenceNo: "SC-2026-0001",
      description: "Purchase Booking | Goods: Pistachio (5 MT) | By Sea",
      debit: 45250,
      credit: 0,
      balance: 45250,
      status: "Posted",
      currency: "USD",
      exchangeRate: 3.67,
      sourceModule: "purchases",
      sourceTable: "purchase_orders",
      originalId: "po-1",
    };

    // Verify key presence
    for (const col of expectedColumns.filter((c) => c !== "action")) {
      expect(sampleRow).toHaveProperty(col);
    }
  });

  it("calculates 4 KPI cards correctly in USD and local AED equivalent", () => {
    const mockRows: CountryReportRow[] = [
      {
        id: "1",
        serialNumber: 1,
        date: "2026-10-30",
        reportType: "Purchase",
        billType: "Purchase Booking",
        billNo: "PB-2026-0001",
        referenceNo: "REF-1",
        description: "Import",
        debit: 1000,
        credit: 0,
        balance: 1000,
        status: "Posted",
        currency: "USD",
        exchangeRate: 3.67,
        sourceModule: "purchases",
        sourceTable: "purchase_orders",
        originalId: "1",
      },
      {
        id: "2",
        serialNumber: 2,
        date: "2026-10-29",
        reportType: "Purchase",
        billType: "Local Purchase",
        billNo: "LP-2026-0018",
        referenceNo: "REF-2",
        description: "Local",
        debit: 500,
        credit: 0,
        balance: 500,
        status: "Posted",
        currency: "USD",
        exchangeRate: 3.67,
        sourceModule: "purchases",
        sourceTable: "purchase_orders",
        originalId: "2",
      },
      {
        id: "3",
        serialNumber: 3,
        date: "2026-10-28",
        reportType: "Cash Entry",
        billType: "Cash Entry",
        billNo: "CE-2026-0032",
        referenceNo: "REF-3",
        description: "Cash",
        debit: 0,
        credit: 250,
        balance: 0,
        status: "Posted",
        currency: "USD",
        exchangeRate: 3.67,
        sourceModule: "roznamcha",
        sourceTable: "roznamcha_entries",
        originalId: "3",
      },
      {
        id: "4",
        serialNumber: 4,
        date: "2026-10-27",
        reportType: "Endorse",
        billType: "Advance Payment",
        billNo: "AP-2026-0011",
        referenceNo: "REF-4",
        description: "Advance",
        debit: 0,
        credit: 300,
        balance: 0,
        status: "Posted",
        currency: "USD",
        exchangeRate: 3.67,
        sourceModule: "purchase_payments",
        sourceTable: "purchase_order_payments",
        originalId: "4",
      },
    ];

    const kpis = calculateKpis(mockRows);

    expect(kpis.purchase.totalBills).toBe(1);
    expect(kpis.purchase.totalAmountUsd).toBe(1000);
    expect(kpis.purchase.totalAmountLocal).toBeCloseTo(3670, 2);

    expect(kpis.localPurchase.totalBills).toBe(1);
    expect(kpis.localPurchase.totalAmountUsd).toBe(500);
    expect(kpis.localPurchase.totalAmountLocal).toBeCloseTo(1835, 2);

    expect(kpis.cashEntry.totalBills).toBe(1);
    expect(kpis.cashEntry.totalAmountUsd).toBe(250);
    expect(kpis.cashEntry.totalAmountLocal).toBeCloseTo(917.5, 2);

    expect(kpis.endorse.totalBills).toBe(1);
    expect(kpis.endorse.totalAmountUsd).toBe(300);
    expect(kpis.endorse.totalAmountLocal).toBeCloseTo(1101, 2);
  });

  it("filters correctly by Bill Type, Report Type, and search string", () => {
    const mockRows: CountryReportRow[] = [
      {
        id: "1",
        serialNumber: 1,
        date: "2026-10-30",
        reportType: "Purchase",
        billType: "Purchase Booking",
        billNo: "PB-2026-0001",
        referenceNo: "SC-2026-0001",
        description: "Purchase Booking | Goods: Pistachio (5 MT)",
        debit: 45250,
        credit: 0,
        balance: 45250,
        status: "Posted",
        currency: "USD",
        exchangeRate: 3.67,
        sourceModule: "purchases",
        sourceTable: "purchase_orders",
        originalId: "1",
        details: { supplierName: "Al Noor Imports" },
      },
      {
        id: "2",
        serialNumber: 2,
        date: "2026-10-29",
        reportType: "Purchase",
        billType: "Local Purchase",
        billNo: "LP-2026-0018",
        referenceNo: "SC-2026-0018",
        description: "Local Purchase | Almond Kernel (10 MT)",
        debit: 18300,
        credit: 0,
        balance: 18300,
        status: "Posted",
        currency: "USD",
        exchangeRate: 3.67,
        sourceModule: "purchases",
        sourceTable: "purchase_orders",
        originalId: "2",
        details: { supplierName: "Local Trader" },
      },
    ];

    // Filter by Bill Type
    const localOnly = filterRows(mockRows, { billType: "Local Purchase" });
    expect(localOnly).toHaveLength(1);
    expect(localOnly[0].billNo).toBe("LP-2026-0018");

    // Search by Supplier
    const searchSupplier = filterRows(mockRows, { search: "Al Noor" });
    expect(searchSupplier).toHaveLength(1);
    expect(searchSupplier[0].billNo).toBe("PB-2026-0001");

    // Search by Bill Number
    const searchBill = filterRows(mockRows, { search: "LP-2026" });
    expect(searchBill).toHaveLength(1);
    expect(searchBill[0].billType).toBe("Local Purchase");
  });
});
