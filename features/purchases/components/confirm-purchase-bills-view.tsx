"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2, Search, Printer, Eye, Ship, Package, RefreshCw,
  FileText, ArrowLeft, Building2, Globe, Truck, ArrowRightLeft,
  ChevronDown, ExternalLink, Calendar, MapPin, User, DollarSign,
  Layers, ShieldCheck, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";
import type { ConfirmPurchaseBillItem } from "@/app/api/erp/purchases/confirm-purchase/route";
import "@/components/purchase-ui/purchase-table-skin.css";

export function ConfirmPurchaseBillsView({ sessionInfo }: { sessionInfo?: { userId?: string; userName?: string; role?: string } } = {}) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tr = (text: string) => translateHeader(lang, text) || text;

  const [bills, setBills] = useState<ConfirmPurchaseBillItem[]>([]);
  const [summary, setSummary] = useState({
    totalBills: 0,
    bookingBills: 0,
    localBills: 0,
    totalLoadedQuantity: 0,
    totalGrossWeightKg: 0,
    totalNetWeightKg: 0,
  });
  const [loading, setLoading] = useState(true);
  // Confirm Purchase lists Purchase Booking loadings only (Local Purchase goes directly to Consignment).
  const sourceFilter = "booking" as const;
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState<ConfirmPurchaseBillItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  async function fetchBills() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("source", sourceFilter);
      if (searchQuery.trim()) params.set("query", searchQuery.trim());
      params.set("lang", lang);

      const res = await fetch(`/api/erp/purchases/confirm-purchase?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        setBills(json.data.bills || []);
        if (json.data.summary) {
          setSummary(json.data.summary);
        }
      }
    } catch (err) {
      console.error("Failed to fetch confirm purchase bills:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchBills();
  }, [sourceFilter, lang]);

  // Handle client-side filtering for payment condition
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (paymentFilter === "all") return true;
      const pt = (b.paymentType || "").toLowerCase();
      if (paymentFilter === "cash") return pt.includes("cash");
      if (paymentFilter === "credit") return pt.includes("credit");
      if (paymentFilter === "advance") return pt.includes("advance") || pt.includes("remaining");
      return true;
    });
  }, [bills, paymentFilter]);

  function handleOpenDetails(bill: ConfirmPurchaseBillItem) {
    setSelectedBill(bill);
    setIsDetailModalOpen(true);
  }

  function handleOpenPrint(bill: ConfirmPurchaseBillItem) {
    setSelectedBill(bill);
    setIsPrintModalOpen(true);
  }

  function handlePrintDirect() {
    window.print();
  }

  return (
    <div className={cn("w-full space-y-4 font-sans text-xs pb-10", isRtl ? "rtl" : "ltr")} dir={isRtl ? "rtl" : "ltr"}>
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {tr("Confirm Purchase Bills")}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {filteredBills.length} {tr("Confirmed Bills")}
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
              {tr("Purchase Booking loadings awaiting confirmation. Local Purchase loadings go directly to the Consignment page.")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBills()}
            disabled={loading}
            className="h-8 gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span>{tr("Refresh")}</span>
          </Button>
        </div>
      </div>

      {/* Top 5 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            <span>{tr("Total Confirmed Bills")}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100">{summary.totalBills}</span>
            <span className="text-[10px] text-slate-400 font-semibold">{tr("Bills")}</span>
          </div>
        </Card>

        <Card className="p-3 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Ship className="h-3.5 w-3.5 text-indigo-600" />
            <span>{tr("Purchase Booking Bills")}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-indigo-700 dark:text-indigo-400">{summary.bookingBills}</span>
            <span className="text-[10px] text-indigo-500/80 font-semibold">{tr("Booking")}</span>
          </div>
        </Card>

        <Card className="p-3 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-amber-600" />
            <span>{tr("Total Loaded Quantity")}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-amber-700 dark:text-amber-400">
              {summary.totalLoadedQuantity.toLocaleString()}
            </span>
            <span className="text-[10px] text-amber-600/80 font-semibold">{tr("Units")}</span>
          </div>
        </Card>

        <Card className="p-3 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-purple-600" />
            <span>{tr("Total Weight (Gross / Net)")}</span>
          </div>
          <div className="mt-2 flex flex-col">
            <span className="text-sm font-black text-slate-900 dark:text-slate-100">
              G: {summary.totalGrossWeightKg.toLocaleString()} kg
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              N: {summary.totalNetWeightKg.toLocaleString()} kg
            </span>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Purchase Booking only — Local Purchase loadings go straight to Consignment */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <span className="px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-600 text-white shadow-xs">
            {tr("Purchase Booking")} ({summary.bookingBills})
          </span>
        </div>

        {/* Payment Condition Filter */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">{tr("Payment Type")}:</span>
          {(["all", "advance", "cash", "credit"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPaymentFilter(mode)}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-bold uppercase transition-all",
                paymentFilter === mode
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              )}
            >
              {tr(mode)}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={tr("Search by Bill No, Supplier, Truck, Driver, Goods...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void fetchBills();
            }}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">{tr("Confirm Bill No")}</th>
                <th className="py-2.5 px-3">{tr("Original Bill No")}</th>
                <th className="py-2.5 px-3">{tr("Purchase Type")}</th>
                <th className="py-2.5 px-3">{tr("Payment Type")}</th>
                <th className="py-2.5 px-3">{tr("Supplier")}</th>
                <th className="py-2.5 px-3">{tr("Goods & Quantity")}</th>
                <th className="py-2.5 px-3 text-right">{tr("Loaded Qty")}</th>
                <th className="py-2.5 px-3 text-right">{tr("Total / Remaining")}</th>
                <th className="py-2.5 px-3 text-right">{tr("Gross / Net (kg)")}</th>
                <th className="py-2.5 px-3">{tr("Loading Details")}</th>
                <th className="py-2.5 px-3">{tr("Payment Status")}</th>
                <th className="py-2.5 px-3 text-center">{tr("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-500 mb-2" />
                    <span>{tr("Loading Confirm Purchase Bills...")}</span>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 font-medium">
                    <Package className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">
                      {tr("No Confirm Purchase Bills Found")}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {tr("When a Purchase Booking loading entry is saved, its confirm bill appears here automatically.")}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill, index) => {
                  const isBooking = bill.purchaseType === "booking";
                  const remainingDue = Math.max(0, bill.totalPurchaseQuantity - bill.totalLoadedQuantity);
                  const isFullyLoaded = remainingDue === 0;

                  return (
                    <tr
                      key={bill.id}
                      className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Row Index */}
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[10.5px]">
                        {index + 1}
                      </td>

                      {/* Confirm Bill No */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-xs">
                          {bill.confirmBillNo}
                        </span>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          <span>{bill.loadingDate}</span>
                        </div>
                      </td>

                      {/* Original Purchase Bill No */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {bill.originalBillNo}
                        </span>
                        <div className="text-[9.5px] text-slate-400">
                          {bill.countryName} · {bill.branchName}
                        </div>
                      </td>

                      {/* Purchase Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isBooking ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                            <Ship className="h-3 w-3" />
                            Booking
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            <Truck className="h-3 w-3" />
                            Local
                          </span>
                        )}
                      </td>

                      {/* Payment Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={cn(
                          "inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase",
                          bill.paymentType.toLowerCase().includes("cash") && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
                          bill.paymentType.toLowerCase().includes("credit") && "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300",
                          bill.paymentType.toLowerCase().includes("advance") && "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300"
                        )}>
                          {bill.paymentType}
                        </span>
                      </td>

                      {/* Supplier */}
                      <td className="py-2.5 px-3 min-w-[140px]">
                        <div className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {bill.supplierName}
                        </div>
                        {bill.supplierAccountNo && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Acc: {bill.supplierAccountNo}
                          </div>
                        )}
                      </td>

                      {/* Goods & Lot */}
                      <td className="py-2.5 px-3 min-w-[140px]">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                          {bill.goodsName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Lot: {bill.lotNo}
                        </div>
                      </td>

                      {/* Loaded Quantity */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span className="font-black text-xs text-blue-700 dark:text-blue-400">
                          {bill.loadedQuantity.toLocaleString()}
                        </span>{" "}
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {bill.quantityUnit}
                        </span>
                      </td>

                      {/* Total vs Remaining Qty */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                          PO: {bill.totalPurchaseQuantity.toLocaleString()}
                        </div>
                        <div className={cn(
                          "text-[10px] font-semibold",
                          isFullyLoaded ? "text-emerald-600" : "text-amber-600"
                        )}>
                          Rem: {remainingDue.toLocaleString()} {bill.quantityUnit}
                        </div>
                      </td>

                      {/* Weights */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-[10.5px]">
                          G: {bill.grossWeightKg.toLocaleString()} kg
                        </div>
                        <div className="text-[10px] text-slate-400">
                          N: {bill.netWeightKg.toLocaleString()} kg
                        </div>
                      </td>

                      {/* Loading Details (Truck, Driver, Agency) */}
                      <td className="py-2.5 px-3 min-w-[130px]">
                        <div className="font-mono text-[10.5px] font-semibold text-slate-800 dark:text-slate-200">
                          {bill.truckNo}
                        </div>
                        <div className="text-[9.5px] text-slate-400 line-clamp-1">
                          {bill.driverName} · {bill.loadingAgency}
                        </div>
                      </td>

                      {/* Payment Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={cn(
                          "inline-block px-1.5 py-0.5 rounded text-[10px] font-bold capitalize",
                          bill.paymentStatus.toLowerCase().includes("paid") || bill.paymentStatus.toLowerCase() === "completed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                            : bill.paymentStatus.toLowerCase().includes("partial")
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                        )}>
                          {bill.paymentStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetails(bill)}
                            className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
                            title={tr("View Details")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenPrint(bill)}
                            className="h-7 w-7 p-0 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800"
                            title={tr("Print Bill")}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // The next destination (Warehouse / Re-export) is chosen on the common Consignment page.
                              const params = new URLSearchParams({ tab: "loadings", source: "purchase_booking", q: bill.loadingEntryNo || bill.originalBillNo });
                              window.open(`/dashboard/consignment?${params}`, "_self");
                            }}
                            className="h-7 px-2 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                            title={tr("Transfer")}
                          >
                            <ArrowRightLeft className="h-3 w-3 mr-1" />
                            {tr("Transfer")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW DETAILS MODAL (16 FIELDS) */}
      {selectedBill && (
        <SimpleModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`${tr("Confirm Bill No")}: ${selectedBill.confirmBillNo}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4 text-xs">
            {/* Top Badge Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  {tr("Confirm Bill No")}
                </span>
                <p className="font-mono text-base font-black text-blue-700 dark:text-blue-400">
                  {selectedBill.confirmBillNo}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-black uppercase",
                  selectedBill.purchaseType === "booking"
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                )}>
                  {selectedBill.purchaseTypeLabel}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
                  {selectedBill.paymentType}
                </span>
              </div>
            </div>

            {/* 4 Information Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Block 1: Bill Identification & Origin */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 border-b pb-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  <span>{tr("1. Bill & Supplier Information")}</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">{tr("Original Purchase Bill:")}</span>
                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedBill.originalBillNo}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Purchase Type:")}</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedBill.purchaseTypeLabel}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Supplier Name:")}</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{selectedBill.supplierName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Supplier Account ID:")}</span>
                    <p className="font-mono font-semibold text-slate-700 dark:text-slate-300">{selectedBill.supplierAccountNo || "—"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Country & Branch:")}</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedBill.countryName} · {selectedBill.branchName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Recorded By / Date:")}</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedBill.userName} · {selectedBill.createdAt?.slice(0, 10)}</p>
                  </div>
                </div>
              </div>

              {/* Block 2: Loading & Logistics Details */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 border-b pb-1.5">
                  <Truck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{tr("2. Loading & Logistics Details")}</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">{tr("Loading Entry No:")}</span>
                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedBill.loadingEntryNo}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Loading Date:")}</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedBill.loadingDate}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Truck Number:")}</span>
                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedBill.truckNo}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Driver Name:")}</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedBill.driverName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Clearing Agent / Agency:")}</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedBill.loadingAgency}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Container / BL No:")}</span>
                    <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedBill.containerNo || selectedBill.blNo || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Block 3: Goods & Quantities Breakdown */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 border-b pb-1.5">
                  <Package className="h-3.5 w-3.5 text-amber-600" />
                  <span>{tr("3. Goods & Quantity Confirmation")}</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">{tr("Goods Name:")}</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{selectedBill.goodsName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Lot Number:")}</span>
                    <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedBill.lotNo}</p>
                  </div>
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded border border-blue-200 dark:border-blue-900">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">{tr("This Loading Qty:")}</span>
                    <p className="text-base font-black text-blue-700 dark:text-blue-300">
                      {selectedBill.loadedQuantity.toLocaleString()} {selectedBill.quantityUnit}
                    </p>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 font-bold">{tr("Total Booked / Remaining:")}</span>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Booked: {selectedBill.totalPurchaseQuantity.toLocaleString()} | Rem: {selectedBill.remainingLoadingQuantity.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Gross Weight:")}</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{selectedBill.grossWeightKg.toLocaleString()} kg</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Net Weight:")}</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{selectedBill.netWeightKg.toLocaleString()} kg</p>
                  </div>
                </div>
              </div>

              {/* Block 4: Financial Status & Transfer History */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 border-b pb-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-purple-600" />
                  <span>{tr("4. Financial Status & Transfer History")}</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                  <div>
                    <span className="text-slate-400">{tr("Bill Total")}: ({selectedBill.currency})</span>
                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedBill.billTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Payment Status:")}</span>
                    <p className="font-black text-emerald-700 dark:text-emerald-400">{selectedBill.paymentStatus}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Advance Paid:")}</span>
                    <p className="font-mono font-semibold text-slate-700 dark:text-slate-300">{selectedBill.advancePaid.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">{tr("Remaining Paid:")}</span>
                    <p className="font-mono font-semibold text-slate-700 dark:text-slate-300">{selectedBill.remainingPaid.toLocaleString()}</p>
                  </div>
                </div>

                <div className="border-t pt-2 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{tr("Transfer & Lifecycle History")}</span>
                  <div className="space-y-1">
                    {selectedBill.transferHistory.map((th, i) => (
                      <div key={i} className="flex items-center justify-between text-[10.5px] bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">✓ {th.stage}</span>
                        <span className="text-slate-400 font-mono">{th.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
              >
                {tr("Close")}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setIsPrintModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{tr("Print Bill")}</span>
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* PRINTABLE VOUCHER MODAL */}
      {selectedBill && (
        <SimpleModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title={`${tr("Print Bill")}: ${selectedBill.confirmBillNo}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="flex justify-end gap-2 no-print">
              <Button
                onClick={handlePrintDirect}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5"
                size="sm"
              >
                <Printer className="h-4 w-4" />
                <span>{tr("Print A4 Voucher")}</span>
              </Button>
            </div>

            {/* A4 Printable Sheet */}
            <div className="p-6 bg-white border border-slate-300 rounded text-slate-900 font-sans print:border-none print:p-0">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
                <h2 className="text-xl font-black uppercase tracking-wider">{tr("DAMAAN GENERAL TRADING L.L.C")}</h2>
                <p className="text-[11px] text-slate-600">{tr("Enterprise Resource Planning · Trade, Purchase & Logistics Management")}</p>
                <div className="mt-2 inline-block px-4 py-1 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded">
                  {tr("CONFIRMED PURCHASE BILL / RECEIPT")}
                </div>
              </div>

              {/* Bill Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs mb-4 p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="space-y-1">
                  <div><span className="font-bold">{tr("Confirm Bill No")}:</span> <span className="font-mono font-black text-blue-700">{selectedBill.confirmBillNo}</span></div>
                  <div><span className="font-bold">{tr("Original Purchase Bill")}:</span> <span className="font-mono font-bold">{selectedBill.originalBillNo}</span></div>
                  <div><span className="font-bold">{tr("Purchase Type")}:</span> {selectedBill.purchaseTypeLabel}</div>
                  <div><span className="font-bold">{tr("Payment Condition")}:</span> {selectedBill.paymentType}</div>
                  <div><span className="font-bold">{tr("Supplier")}:</span> {selectedBill.supplierName} ({selectedBill.supplierAccountNo || "—"})</div>
                </div>
                <div className="space-y-1">
                  <div><span className="font-bold">{tr("Loading Entry No")}:</span> <span className="font-mono">{selectedBill.loadingEntryNo}</span></div>
                  <div><span className="font-bold">{tr("Loading Date")}:</span> {selectedBill.loadingDate}</div>
                  <div><span className="font-bold">{tr("Truck / Driver")}:</span> {selectedBill.truckNo} / {selectedBill.driverName}</div>
                  <div><span className="font-bold">{tr("Clearing Agent")}:</span> {selectedBill.loadingAgency}</div>
                  <div><span className="font-bold">{tr("Country / Branch")}:</span> {selectedBill.countryName} · {selectedBill.branchName}</div>
                </div>
              </div>

              {/* Table of Goods */}
              <table className="w-full text-xs border border-slate-300 mb-6 border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left font-bold">
                    <th className="p-2 border-r border-slate-300">{tr("Goods Description")}</th>
                    <th className="p-2 border-r border-slate-300">{tr("Lot No")}</th>
                    <th className="p-2 border-r border-slate-300 text-right">{tr("Confirmed Qty")}</th>
                    <th className="p-2 border-r border-slate-300 text-right">{tr("Gross Wt (kg)")}</th>
                    <th className="p-2 border-r border-slate-300 text-right">{tr("Net Wt (kg)")}</th>
                    <th className="p-2 text-right">{tr("Remaining to Load")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200 font-bold">{selectedBill.goodsName}</td>
                    <td className="p-2 border-r border-slate-200 font-mono">{selectedBill.lotNo}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-black text-blue-700">
                      {selectedBill.loadedQuantity.toLocaleString()} {selectedBill.quantityUnit}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-semibold">{selectedBill.grossWeightKg.toLocaleString()}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-semibold">{selectedBill.netWeightKg.toLocaleString()}</td>
                    <td className="p-2 text-right text-slate-500 font-semibold">
                      {selectedBill.remainingLoadingQuantity.toLocaleString()} {selectedBill.quantityUnit}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 3 Signature Blocks */}
              <div className="pt-12 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="border-t-2 border-slate-400 pt-2">
                  <p className="font-bold text-slate-800">{tr("Prepared By")}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{selectedBill.userName || "Operator"}</p>
                </div>
                <div className="border-t-2 border-slate-400 pt-2">
                  <p className="font-bold text-slate-800">{tr("Checked By")}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{tr("Accounts Department")}</p>
                </div>
                <div className="border-t-2 border-slate-400 pt-2">
                  <p className="font-bold text-slate-800">{tr("Authorized By")}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{tr("Director / Country Admin")}</p>
                </div>
              </div>
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}
