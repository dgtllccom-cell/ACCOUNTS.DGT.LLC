"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Printer, Download, FileSpreadsheet, Send, Share2, Eye,
  Building2, Globe, CalendarDays, RefreshCcw, Search,
  ClipboardList, Ship, Coins, Wallet, FileText, CheckCircle2,
  Filter, Layers, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Import all 6 Report Handlers
import { openCustomerLedgerPrintReport, type CustomerLedgerReportData } from "@/lib/reports/open-customer-ledger-print-report";
import { openLoadingRecordsPrintReport, type PurchaseLoadingReportRow } from "@/lib/reports/open-loading-records-print-report";
import { openFinalizedPOPrintReport, type FinalizedPORow } from "@/lib/reports/open-finalized-po-print-report";
import { openTransferPaymentPrintReport, type TransferPaymentRecord } from "@/lib/reports/open-transfer-payment-print-report";
import { openRecentCashEntriesPrintReport, type CashEntryLine } from "@/lib/reports/open-cash-entries-print-report";
import { openPurchaseBookingOrderPrintReport, type PurchaseBookingOrderData } from "@/lib/reports/open-purchase-booking-print-report";

export default function PrintReportsHubPage() {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");
  const [selectedBranch, setSelectedBranch] = useState("All Branches");

  // Sample/Live datasets
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const fetchLiveData = async () => {
    setLoading(true);
    try {
      const [poRes, lrRes, payRes] = await Promise.all([
        fetch("/api/erp/purchases/orders?limit=300", { cache: "no-store" }).catch(() => null),
        fetch("/api/erp/purchases/loading-records?limit=300", { cache: "no-store" }).catch(() => null),
        fetch("/api/erp/purchases/local-purchase", { cache: "no-store" }).catch(() => null)
      ]);

      if (poRes?.ok) {
        const poData = await poRes.json();
        setOrders(Array.isArray(poData?.data?.orders) ? poData.data.orders : Array.isArray(poData?.data) ? poData.data : []);
      }
      if (lrRes?.ok) {
        const lrData = await lrRes.json();
        setLoadingRecords(lrData?.data?.records || []);
      }
      if (payRes?.ok) {
        const payData = await payRes.json();
        setPayments(payData?.data?.purchases || []);
      }
    } catch (e) {
      console.error("Error loading print report datasets:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLiveData();
  }, []);

  // 1. Customer Ledger Report Handler
  const handlePrintCustomerLedger = () => {
    const reportData: CustomerLedgerReportData = {
      customerName: "Fareedullah Trading LLC",
      customerCode: "CUS-00015",
      taxNo: "1234567-8",
      phone: "+971 50 123 4567",
      address: "Al Ras, Deira, Dubai, UAE",
      openingBalance: 25000.00,
      openingDcType: "Dr",
      totalCredit: 185750.00,
      totalDebit: 165250.00,
      closingBalance: 45500.00,
      closingDcType: "Dr",
      country: selectedCountry === "All Countries" ? "UAE" : selectedCountry,
      branch: selectedBranch === "All Branches" ? "AL.RAS" : selectedBranch,
      currency: "AED",
      exchangeRateType: "Daily Rate",
      salesAccount: "UAE-DET-SALES-001",
      customerAccount: "UAE-DET-CUS-001",
      roznamachaName: "Customer Ledger",
      roznamachaNo: "CLR-2026-00015",
      rows: [
        { srNo: 1, date: "2026-07-01", branchEntryNo: "ALR-0001", userName: "asmat", branchName: "AL.RAS", roznamachaNameAndNo: "Sales Invoice SI-2026-0156", remarks: "Sale of Almond Kernel 10 MT", credit: 25000.00, balance: 25000.00, dcType: "Cr" },
        { srNo: 2, date: "2026-07-02", branchEntryNo: "ALR-0002", userName: "asmat", branchName: "AL.RAS", roznamachaNameAndNo: "Payment Receipt PR-2026-0087", remarks: "Payment received against Invoice SI-2026-0156", debit: 10000.00, balance: 15000.00, dcType: "Cr" },
        { srNo: 3, date: "2026-07-03", branchEntryNo: "ALR-0003", userName: "asmat", branchName: "AL.RAS", roznamachaNameAndNo: "Sales Invoice SI-2026-0157", remarks: "Sale of Pistachio 5 MT", credit: 42500.00, balance: 57500.00, dcType: "Cr" },
        { srNo: 4, date: "2026-07-04", branchEntryNo: "ALR-0004", userName: "admin", branchName: "AL.RAS", roznamachaNameAndNo: "Payment Receipt PR-2026-0088", remarks: "Payment received by Bank Transfer", debit: 20000.00, balance: 37500.00, dcType: "Cr" },
        { srNo: 5, date: "2026-07-06", branchEntryNo: "ALR-0005", userName: "asmat", branchName: "AL.RAS", roznamachaNameAndNo: "Sales Invoice SI-2026-0158", remarks: "Sale of Cashew Nuts 3 MT", credit: 65250.00, balance: 102750.00, dcType: "Cr" },
        { srNo: 6, date: "2026-07-07", branchEntryNo: "ALR-0006", userName: "admin", branchName: "AL.RAS", roznamachaNameAndNo: "Payment Receipt PR-2026-0089", remarks: "Cash payment received", debit: 15000.00, balance: 87750.00, dcType: "Cr" },
        { srNo: 7, date: "2026-07-09", branchEntryNo: "ALR-0007", userName: "asmat", branchName: "AL.RAS", roznamachaNameAndNo: "Sales Invoice SI-2026-0159", remarks: "Sale of Walnut 2 MT", credit: 53000.00, balance: 140750.00, dcType: "Cr" },
        { srNo: 8, date: "2026-07-10", branchEntryNo: "ALR-0008", userName: "admin", branchName: "AL.RAS", roznamachaNameAndNo: "Payment Receipt PR-2026-0090", remarks: "Payment received by Cheque", debit: 30000.00, balance: 110750.00, dcType: "Cr" },
        { srNo: 9, date: "2026-07-12", branchEntryNo: "ALR-0009", userName: "asmat", branchName: "AL.RAS", roznamachaNameAndNo: "Sales Return Credit SRC-2026-0005", remarks: "Sales return against SI-2026-0158", credit: 5000.00, balance: 115750.00, dcType: "Cr" },
        { srNo: 10, date: "2026-07-14", branchEntryNo: "ALR-0010", userName: "admin", branchName: "AL.RAS", roznamachaNameAndNo: "Payment Receipt PR-2026-0091", remarks: "Final payment received", debit: 70250.00, balance: 45500.00, dcType: "Dr" }
      ]
    };

    openCustomerLedgerPrintReport({
      report: reportData,
      companyInfo: {
        name: "DIGITAL DOCK ERP",
        tagline: "Smart Business, Strong Future",
        branch: "AL.RAS",
        printedBy: "asmat (Country Admin)"
      }
    });
  };

  // 2. Purchase Loading Records Handler
  const handlePrintLoadingRecords = () => {
    const loadingRows: PurchaseLoadingReportRow[] = [
      { id: "1", country: "UAE", branch: "AL.RAS", purchaseBookingNo: "PB-2026-6789", salesAccount: "UAE-DET-AC-0003", purchaseAccount: "UAE-DET-AC-0003", goods: "Almond Kernel California", contractQty: 10000, grossWeight: 10500, tareWeight: 1000, netWeight: 9500, purchasePriceRate: 5.20, totalPurchaseFc: 49400, advanceFc: 20000, remainingFc: 29400, exchangeRate: 3.6725, finalAmountLc: 181560.50, finalAdvanceLc: 73450.00, finalRemainingLc: 108110.50, loadedQty: 4000, remainingToLoad: 6000, loadingStatus: "Partially Loaded" },
      { id: "2", country: "UAE", branch: "AL.RAS", purchaseBookingNo: "PB-2026-6788", salesAccount: "UAE-DET-AC-0003", purchaseAccount: "UAE-DET-AC-0003", goods: "Walnut USA", contractQty: 8000, grossWeight: 8400, tareWeight: 900, netWeight: 7500, purchasePriceRate: 4.80, totalPurchaseFc: 36000, advanceFc: 10000, remainingFc: 26000, exchangeRate: 3.6725, finalAmountLc: 132210.00, finalAdvanceLc: 36725.00, finalRemainingLc: 95485.00, loadedQty: 7500, remainingToLoad: 500, loadingStatus: "Almost Complete" },
      { id: "3", country: "Pakistan", branch: "CHAMAN", purchaseBookingNo: "PB-2026-6787", salesAccount: "PAK-DET-AC-0003", purchaseAccount: "PAK-DET-AC-0003", goods: "Pistachio Iran", contractQty: 5000, grossWeight: 5250, tareWeight: 700, netWeight: 4550, purchasePriceRate: 10.00, totalPurchaseFc: 50000, advanceFc: 25000, remainingFc: 25000, exchangeRate: 3.6725, finalAmountLc: 183625.00, finalAdvanceLc: 91812.50, finalRemainingLc: 91812.50, loadedQty: 2000, remainingToLoad: 3000, loadingStatus: "Partially Loaded" },
      { id: "4", country: "Pakistan", branch: "KARACHI", purchaseBookingNo: "PB-2026-6786", salesAccount: "PAK-DET-AC-0003", purchaseAccount: "PAK-DET-AC-0003", goods: "Chick Peas Kabuli", contractQty: 12000, grossWeight: 12600, tareWeight: 1100, netWeight: 11500, purchasePriceRate: 1.20, totalPurchaseFc: 14400, advanceFc: 7200, remainingFc: 7200, exchangeRate: 3.6725, finalAmountLc: 52902.00, finalAdvanceLc: 26451.00, finalRemainingLc: 26451.00, loadedQty: 11500, remainingToLoad: 500, loadingStatus: "Completed" },
      { id: "5", country: "Afghanistan", branch: "KABUL", purchaseBookingNo: "PB-2026-6785", salesAccount: "AFG-DET-AC-0003", purchaseAccount: "AFG-DET-AC-0003", goods: "Raisins Afghan", contractQty: 3000, grossWeight: 3150, tareWeight: 500, netWeight: 2650, purchasePriceRate: 2.50, totalPurchaseFc: 7500, advanceFc: 2500, remainingFc: 5000, exchangeRate: 3.6725, finalAmountLc: 27543.75, finalAdvanceLc: 9181.25, finalRemainingLc: 18362.50, loadedQty: 0, remainingToLoad: 3000, loadingStatus: "Not Loaded" }
    ];

    openLoadingRecordsPrintReport({
      rows: loadingRows,
      companyInfo: {
        name: "DIGITAL DOCK ERP",
        tagline: "Import | Export | Trading | ERP Solutions",
        printedBy: "asmat (Country Admin)"
      }
    });
  };

  // 3. Finalized Purchase Orders Handler
  const handlePrintFinalizedPO = () => {
    const finalizedRows: FinalizedPORow[] = [
      { id: "1", poNumber: "PO-2026-9001", soNumber: "SO-101", country: "UAE", branch: "AL.RAS", supplier: "Global Commodities FZE", purchaseAccount: "PURCHASE-UAE-01", salesAccount: "SALES-UAE-01", goods: "Cardamom Guatemala Bold", contractQty: 15000, grossWeight: 15750, tareWeight: 750, netWeight: 15000, purchaseRate: 14.50, totalPurchaseFc: 217500, advanceFc: 100000, remainingFc: 117500, currencyFc: "USD", exchangeRate: 3.6725, finalAmountLc: 798768.75, finalAdvanceLc: 367250.00, finalRemainingLc: 431518.75, currencyLc: "AED", status: "Completed" },
      { id: "2", poNumber: "PO-2026-9002", soNumber: "SO-102", country: "Pakistan", branch: "KARACHI", supplier: "Al-Rehman Foods Pvt Ltd", purchaseAccount: "PURCHASE-PK-01", salesAccount: "SALES-PK-01", goods: "Basmati Rice Super Kernel", contractQty: 25000, grossWeight: 25500, tareWeight: 500, netWeight: 25000, purchaseRate: 1.15, totalPurchaseFc: 28750, advanceFc: 15000, remainingFc: 13750, currencyFc: "USD", exchangeRate: 3.6725, finalAmountLc: 105584.38, finalAdvanceLc: 55087.50, finalRemainingLc: 50496.88, currencyLc: "AED", status: "Completed" }
    ];

    openFinalizedPOPrintReport({
      rows: finalizedRows,
      companyInfo: {
        name: "DIGITAL DOCK ERP",
        branch: "ALL BRANCHES",
        printedBy: "SUPER ADMIN"
      }
    });
  };

  // 4. Transfer Payment Voucher Handler
  const handlePrintTransferPayment = () => {
    openTransferPaymentPrintReport({
      record: {
        id: "PAY-9901",
        voucherNo: "VOUCHER-PAY-9901",
        billNo: "PB-2026-6789",
        transferDate: new Date().toISOString(),
        supplierName: "Fareedullah Trading LLC",
        supplierAccountNo: "UAE-DET-CUS-001",
        branchName: "AL.RAS",
        countryName: "UAE",
        goodsName: "Almond Kernel California",
        paymentMode: "BANK TRANSFER",
        bankOrCashAccount: "1010 - EMIRATES NBD BANK",
        amountFc: 20000,
        currencyFc: "USD",
        exchangeRate: 3.6725,
        amountLc: 73450,
        currencyLc: "AED",
        amountInWords: "AED SEVENTY THREE THOUSAND FOUR HUNDRED FIFTY ONLY",
        purchaseAccountNo: "UAE-DET-AC-0003",
        salesAccountNo: "UAE-DET-SALES-001",
        narration: "Advance transfer payment against Purchase Booking Order PB-2026-6789 under Al Ras branch.",
        userFullName: "asmat (Country Admin)"
      },
      companyInfo: {
        name: "DIGITAL DOCK ERP",
        branch: "AL.RAS",
        printedBy: "asmat (Country Admin)"
      }
    });
  };

  // 5. Recent Cash Entries Handler
  const handlePrintCashEntries = () => {
    const cashLines: CashEntryLine[] = [
      { id: "1", voucherNo: "CE-2026-001", entryDate: "2026-07-20", accountCode: "1010-CASH", accountTitle: "Main Cash Drawer", debit: 50000, credit: 0, currency: "AED", narration: "Daily cash receipts from Al Ras store counter", user: "asmat", branch: "AL.RAS" },
      { id: "2", voucherNo: "CE-2026-002", entryDate: "2026-07-20", accountCode: "5020-EXP", accountTitle: "Warehouse Freight & Packing Expenses", debit: 0, credit: 12500, currency: "AED", narration: "Cash payment for local port transport & labor charges", user: "admin", branch: "AL.RAS" },
      { id: "3", voucherNo: "CE-2026-003", entryDate: "2026-07-21", accountCode: "2010-PAY", accountTitle: "Supplier Cash Settlement Account", debit: 0, credit: 37500, currency: "AED", narration: "Partial cash advance paid for container unloading", user: "asmat", branch: "AL.RAS" }
    ];

    openRecentCashEntriesPrintReport({
      entries: cashLines,
      companyInfo: {
        name: "DIGITAL DOCK ERP",
        branch: "AL.RAS",
        printedBy: "SUPER ADMIN"
      }
    });
  };

  // 6. New Purchase Booking Order Handler
  const handlePrintPurchaseBooking = () => {
    openPurchaseBookingOrderPrintReport({
      order: {
        id: "PB-9090",
        systemBillNo: "PB-2026-6789",
        manualBillNo: "PC-2026-6789",
        superAdminSerialNo: "SUP-2026-0089",
        countrySerialNo: "CTY-UAE-0442",
        branchSerialNo: "BR-ALR-1024",
        bookingDate: "2026-07-14",
        supplierName: "Fareedullah Trading LLC",
        supplierContact: "+971 50 123 4567",
        buyerName: "DAMAN BUSINESS GROUP",
        purchaseAccountNo: "UAE-DET-AC-0003",
        purchaseAccountName: "Dubai Purchase Account",
        salesAccountNo: "UAE-DET-AC-0003",
        salesAccountName: "Damaan Sales Account",
        countryName: "UAE",
        branchName: "AL_RAS",
        shippingMode: "By Sea",
        containerNumbers: "TCLU-492019-2 / MSCU-881920-1",
        vesselName: "MSC BARCELONA V.204",
        loadingCountryPort: "USA / Port of Oakland",
        receivedCountryPort: "UAE / Jebel Ali Port",
        goodsItems: [
          { srNo: 1, goodsName: "Almond Kernel California", grade: "Extra No.1", origin: "USA", quantity: 10000, unit: "BAGS", grossWeight: 10500, tareWeight: 1000, netWeight: 9500, rateKg: 5.20, amountFc: 49400, currencyFc: "USD", exchangeRate: 3.6725, amountLc: 181560.50, currencyLc: "AED" }
        ],
        totalPurchaseFc: 49400,
        currencyFc: "USD",
        totalPurchaseLc: 181560.50,
        currencyLc: "AED",
        advancePercent: 40,
        advanceAmountFc: 20000,
        advanceAmountLc: 73450,
        remainingAmountFc: 29400,
        remainingAmountLc: 108110.50,
        advancePaymentDate: "2026-07-15",
        remainingDueDate: "2026-08-01",
        status: "Accepted",
        remarks: "Special shipment inspection required prior to warehouse loading."
      },
      companyInfo: {
        name: "DIGITAL DOCK ERP",
        branch: "AL_RAS",
        printedBy: "asmat (Country Admin)"
      }
    });
  };

  const reportCards = [
    {
      id: "customer-ledger",
      title: "Customer Ledger Report & Account Statement",
      subtitle: "Roznamacha / Account Statement",
      description: "Complete customer financial statement showing opening balance, debit/credit transactions, closing balance, and Dr/Cr status.",
      format: "A4 Landscape",
      icon: BookOpen,
      color: "from-blue-600 to-indigo-700",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
      onPrint: handlePrintCustomerLedger
    },
    {
      id: "loading-records",
      title: "Purchase Loading Records Report",
      subtitle: "Container Loading & Status Register",
      description: "23-column landscape report for tracking loading status, contract qty, gross/tare/net weights, rates, FC & LC amounts.",
      format: "A4 Landscape",
      icon: Ship,
      color: "from-emerald-600 to-teal-700",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      onPrint: handlePrintLoadingRecords
    },
    {
      id: "finalized-po",
      title: "Finalized Purchase Orders Report",
      subtitle: "Completed Purchase Contracts",
      description: "Comprehensive summary of finalized purchase orders with DR/CR account breakdown, currency conversions, and completion status.",
      format: "A4 Landscape",
      icon: ClipboardList,
      color: "from-purple-600 to-violet-700",
      badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
      onPrint: handlePrintFinalizedPO
    },
    {
      id: "transfer-payment",
      title: "Purchase Transfer Payment Voucher",
      subtitle: "Official GL Settlement Voucher",
      description: "Official voucher document with amount in digits and words (English), GL posting double-entry table, and cashier/manager signatures.",
      format: "A4 Portrait",
      icon: Coins,
      color: "from-amber-600 to-orange-700",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      onPrint: handlePrintTransferPayment
    },
    {
      id: "cash-entries",
      title: "Recent Cash Entries (Roznamcha) Report",
      subtitle: "Daily Cash Journal Sheet",
      description: "Daily cash debit & credit transactions sheet featuring balanced status check, branch code postings, and narration log.",
      format: "A4 Portrait",
      icon: Wallet,
      color: "from-cyan-600 to-blue-700",
      badgeColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
      onPrint: handlePrintCashEntries
    },
    {
      id: "purchase-booking",
      title: "New Purchase Booking Order Document",
      subtitle: "Order Confirmation Sheet",
      description: "Full purchase order document containing supplier/buyer cards, goods breakdown, payment terms schedule, and GL postings.",
      format: "A4 Portrait",
      icon: FileText,
      color: "from-rose-600 to-red-700",
      badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
      onPrint: handlePrintPurchaseBooking
    }
  ];

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return reportCards;
    const q = searchQuery.toLowerCase();
    return reportCards.filter(c => c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [searchQuery]);

  return (
    <div className="space-y-6 p-4 sm:p-6 text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-950 min-h-screen">
      
      {/* Top Banner Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
            <span>Dashboard</span>
            <span>›</span>
            <span>Reports Hub</span>
            <span>›</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">Print Reports Hub</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Printer className="h-7 w-7 text-blue-600" />
            Print Reports Hub & PDF Generator
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Preview, print, and download official A4 ERP business reports with letterheads and digital signatures.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchLiveData()}
            className="h-9 text-xs font-semibold"
          >
            <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 text-slate-600 ${loading ? "animate-spin" : ""}`} /> Refresh Data
          </Button>
        </div>
      </div>

      {/* Filter Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search report name, description or format..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition"
            />
          </div>

          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
          >
            <option value="All Countries">All Countries</option>
            <option value="UAE">United Arab Emirates (UAE)</option>
            <option value="Pakistan">Pakistan</option>
            <option value="Afghanistan">Afghanistan</option>
            <option value="India">India</option>
          </select>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
          >
            <option value="All Branches">All Branches</option>
            <option value="AL.RAS">AL.RAS Branch</option>
            <option value="KARACHI">KARACHI Branch</option>
            <option value="CHAMAN">CHAMAN Branch</option>
            <option value="KABUL">KABUL Branch</option>
          </select>
        </div>

        <div className="text-[11px] font-bold text-slate-500">
          Showing <span className="text-slate-900 dark:text-white font-extrabold">{filteredCards.length}</span> Official ERP Reports
        </div>
      </div>

      {/* 6 Report Cards Grid */}
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
            >
              <div>
                {/* Card Top Header Banner */}
                <div className={`p-4 bg-gradient-to-r ${card.color} text-white flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black tracking-tight leading-snug">{card.title}</h3>
                      <p className="text-[10px] text-white/80 font-medium">{card.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* Card Body Details */}
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${card.badgeColor}`}>
                      {card.format}
                    </span>
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Letterhead Auto-Load
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-normal">
                    {card.description}
                  </p>
                </CardContent>
              </div>

              {/* Card Actions Footer */}
              <div className="p-4 pt-0 gap-2 flex flex-col border-t border-slate-100 dark:border-slate-800/60 mt-2">
                <Button
                  type="button"
                  onClick={card.onPrint}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4" /> Open Preview & Print Report
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={card.onPrint}
                    className="h-8 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center gap-1"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" /> Save PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={card.onPrint}
                    className="h-8 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center gap-1"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" /> Export Excel
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* System Note & Disclaimer Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 font-bold">
            💡
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white">How Print & PDF Downloads Work:</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Clicking <strong>"Open Preview & Print Report"</strong> or <strong>"Save PDF"</strong> opens an A4 formatted window complete with your official company letterhead, signature strips, and a sticky toolbar for 1-click Printing, PDF saving, Excel export, Emailing, and WhatsApp sharing.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
