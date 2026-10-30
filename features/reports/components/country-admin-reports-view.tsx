"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText,
  Search,
  Printer,
  Download,
  Building2,
  Calendar,
  Filter,
  Eye,
  Plus,
  ArrowRight,
  TrendingUp,
  Receipt,
  Wallet,
  Coins,
  ShoppingBag,
  ArrowLeft,
  ChevronDown,
  RotateCcw,
  CheckCircle,
  X,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api/client";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import type { CountryReportRow } from "@/app/api/erp/reports/country/route";

interface CountryAdminReportsViewProps {
  viewerName?: string;
  viewerId?: string;
  initialScopeLevel?: string;
  lang?: string;
}

export function CountryAdminReportsView({
  viewerName = "Country Admin",
  viewerId,
  initialScopeLevel = "country",
  lang: initialLang = "en",
}: CountryAdminReportsViewProps) {
  const activeLang = useActiveLanguage();
  const lang = activeLang || initialLang || "en";
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  // Data states
  const [rows, setRows] = useState<CountryReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; branch_name: string; country_id: string }[]>([]);

  // KPI summaries
  const [kpis, setKpis] = useState({
    purchase: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
    localPurchase: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
    cashEntry: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
    endorse: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState("all");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [reportTypeFilter, setReportTypeFilter] = useState("all");
  const [billTypeFilter, setBillTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selected row for full View / Print Preview
  const [previewRow, setPreviewRow] = useState<CountryReportRow | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Load Data from API
  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (selectedCountryId !== "all") qp.set("countryId", selectedCountryId);
      if (selectedBranchId !== "all") qp.set("branchId", selectedBranchId);
      if (reportTypeFilter !== "all") qp.set("reportType", reportTypeFilter);
      if (billTypeFilter !== "all") qp.set("billType", billTypeFilter);
      if (statusFilter !== "all") qp.set("status", statusFilter);
      if (customFromDate) qp.set("fromDate", customFromDate);
      if (customToDate) qp.set("toDate", customToDate);
      if (searchQuery.trim()) qp.set("search", searchQuery.trim());
      qp.set("lang", lang);

      const res: any = await apiGet(`/api/erp/reports/country?${qp.toString()}`);
      const data = res?.data || res?.rows || [];
      setRows(data);
      if (res?.kpis) {
        setKpis(res.kpis);
      }
    } catch (err: any) {
      console.error("Failed to load country reports:", err);
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  // Load countries and branches for filters
  useEffect(() => {
    apiGet<{ countries: { id: string; name: string }[] }>("/api/branch-management/countries")
      .then((res) => setCountries(res?.countries || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedCountryId,
    selectedBranchId,
    reportTypeFilter,
    billTypeFilter,
    statusFilter,
    customFromDate,
    customToDate,
  ]);

  // Date Range Quick Select
  const handleDateRangeChange = (val: string) => {
    setDateRangeFilter(val);
    const now = new Date();
    if (val === "today") {
      const todayStr = now.toISOString().slice(0, 10);
      setCustomFromDate(todayStr);
      setCustomToDate(todayStr);
    } else if (val === "yesterday") {
      const y = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      setCustomFromDate(y);
      setCustomToDate(y);
    } else if (val === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      setCustomFromDate(weekAgo);
      setCustomToDate(now.toISOString().slice(0, 10));
    } else if (val === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setCustomFromDate(startOfMonth);
      setCustomToDate(now.toISOString().slice(0, 10));
    } else if (val === "all") {
      setCustomFromDate("");
      setCustomToDate("");
    }
  };

  // Filtered rows for client search
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.billNo.toLowerCase().includes(q) ||
        r.referenceNo.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.details?.supplierName && String(r.details.supplierName).toLowerCase().includes(q)) ||
        (r.details?.buyerName && String(r.details.buyerName).toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Number Formatter
  const fmt = (num: number | string | undefined | null) => {
    const n = Number(num || 0);
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!filteredRows.length) return;
    const headers = [
      "#",
      "Date",
      "Report Type",
      "Bill Type",
      "Bill No / Ref No",
      "Description",
      "Debit",
      "Credit",
      "Balance",
      "Status",
      "Country",
      "Branch",
    ];
    const csvRows = filteredRows.map((r, idx) => [
      idx + 1,
      r.date,
      `"${r.reportType}"`,
      `"${r.billType}"`,
      `"${r.billNo}"`,
      `"${r.description.replace(/"/g, '""')}"`,
      r.debit.toFixed(2),
      r.credit.toFixed(2),
      r.balance.toFixed(2),
      `"${r.status}"`,
      `"${r.countryName || "-"}"`,
      `"${r.branchName || "-"}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `country-admin-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print Complete Table via Universal Print Engine
  const handlePrintTable = () => {
    openUniversalPrintReport({
      title: t(lang, "car.title", "Country Admin Reports"),
      subtitle: t(lang, "car.subtitle", "Country-level reports for all branches and transactions within your assigned country"),
      lang,
      orientation: "landscape",
      moduleType: "register",
      scope: {
        scopeLevel: "Country Admin",
        userName: viewerName,
      },
      kpis: [
        { label: t(lang, "car.purchase_reports", "Purchase Reports"), value: `$${fmt(kpis.purchase.totalAmountUsd)}`, color: "blue" },
        { label: t(lang, "car.local_purchase_reports", "Local Purchase Reports"), value: `$${fmt(kpis.localPurchase.totalAmountUsd)}`, color: "emerald" },
        { label: t(lang, "car.cash_entry_reports", "Cash Entry Reports"), value: `$${fmt(kpis.cashEntry.totalAmountUsd)}`, color: "purple" },
        { label: t(lang, "car.endorse_reports", "Endorse Reports"), value: `$${fmt(kpis.endorse.totalAmountUsd)}`, color: "amber" },
      ],
      columns: [
        { key: "serial", label: "#", width: "4%" },
        { key: "date", label: t(lang, "common.date", "Date"), width: "9%" },
        { key: "reportType", label: t(lang, "report.col_type", "Report Type"), width: "10%" },
        { key: "billType", label: t(lang, "car.bill_type", "Bill Type"), width: "13%" },
        { key: "billNo", label: t(lang, "car.bill_no_ref", "Bill No / Ref No"), width: "12%" },
        { key: "description", label: t(lang, "report.col_description", "Description"), width: "24%" },
        { key: "debit", label: t(lang, "report.col_debit", "Debit"), align: "right", width: "9%" },
        { key: "credit", label: t(lang, "report.col_credit", "Credit"), align: "right", width: "9%" },
        { key: "balance", label: t(lang, "report.col_balance", "Balance"), align: "right", width: "9%" },
        { key: "status", label: t(lang, "report.col_status", "Status"), align: "center", format: "badge", width: "7%" },
      ],
      rows: filteredRows.map((r, idx) => ({
        serial: idx + 1,
        date: r.date,
        reportType: r.reportType,
        billType: r.billType,
        billNo: r.billNo,
        description: r.description,
        debit: fmt(r.debit),
        credit: fmt(r.credit),
        balance: fmt(r.balance),
        status: r.status,
      })),
    });
  };

  // Print Specific Document A4 Report
  const handlePrintSingleReport = () => {
    if (!previewRow) return;
    const printArea = document.getElementById("printable-single-a4-report");
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=750");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${isRtl ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>${previewRow.billType} — ${previewRow.billNo}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 15mm; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 0;
              font-size: 11px;
            }
            .a4-print-box {
              width: 100%;
              max-width: 800px;
              margin: 0 auto;
            }
            .print-hide { display: none !important; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 4px 6px; }
            th { background: #f8fafc; font-weight: 700; text-align: left; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
            .font-mono { font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="a4-print-box">
            ${printArea.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {t(lang, "car.title", "Country Admin Reports")}
            </h1>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold border-blue-200">
              {initialScopeLevel.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t(lang, "car.subtitle", "Country-level reports for all branches and transactions within your assigned country")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5 font-bold h-8.5 rounded-xl">
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t(lang, "common.export", "Export")}</span>
          </Button>
          <Button variant="default" size="sm" onClick={handlePrintTable} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-bold h-8.5 rounded-xl shadow-sm">
            <Printer className="w-3.5 h-3.5" />
            <span>{t(lang, "common.print", "Print")}</span>
          </Button>
        </div>
      </div>

      {/* 4 Financial Summary KPI Cards (Matching Design Screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Purchase Reports */}
        <Card className="border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/60 via-white to-blue-50/20 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 shadow-sm overflow-hidden">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                {t(lang, "car.purchase_reports", "PURCHASE REPORTS")}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-500">{t(lang, "car.total_bills", "Total Bills")}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{kpis.purchase.totalBills}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">{t(lang, "car.total_amount_usd", "Total Amount (USD)")}</span>
              <span className="font-bold text-blue-700 dark:text-blue-300 font-mono">${fmt(kpis.purchase.totalAmountUsd)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">{t(lang, "car.total_amount_aed", "Total Amount (AED)")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{fmt(kpis.purchase.totalAmountLocal)}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setReportTypeFilter("Purchase");
                setBillTypeFilter("Purchase Booking");
              }}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 pt-1 flex items-center gap-1 cursor-pointer"
            >
              <span>{t(lang, "car.view_details", "View Details")}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </CardContent>
        </Card>

        {/* Card 2: Local Purchase Reports */}
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/20 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 shadow-sm overflow-hidden">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                {t(lang, "car.local_purchase_reports", "LOCAL PURCHASE REPORTS")}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-500">{t(lang, "car.total_bills", "Total Bills")}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{kpis.localPurchase.totalBills}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">{t(lang, "car.total_amount_usd", "Total Amount (USD)")}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">${fmt(kpis.localPurchase.totalAmountUsd)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">{t(lang, "car.total_amount_aed", "Total Amount (AED)")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{fmt(kpis.localPurchase.totalAmountLocal)}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setReportTypeFilter("Purchase");
                setBillTypeFilter("Local Purchase");
              }}
              className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 pt-1 flex items-center gap-1 cursor-pointer"
            >
              <span>{t(lang, "car.view_details", "View Details")}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </CardContent>
        </Card>

        {/* Card 3: Cash Entry Reports */}
        <Card className="border-purple-200 dark:border-purple-900/60 bg-gradient-to-br from-purple-50/60 via-white to-purple-50/20 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900 shadow-sm overflow-hidden">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-purple-600" />
                {t(lang, "car.cash_entry_reports", "CASH ENTRY REPORTS")}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-500">{t(lang, "car.total_bills", "Total Bills")}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{kpis.cashEntry.totalBills}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">{t(lang, "car.total_amount_usd", "Total Amount (USD)")}</span>
              <span className="font-bold text-purple-700 dark:text-purple-300 font-mono">${fmt(kpis.cashEntry.totalAmountUsd)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">{t(lang, "car.total_amount_aed", "Total Amount (AED)")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{fmt(kpis.cashEntry.totalAmountLocal)}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setReportTypeFilter("Cash Entry");
                setBillTypeFilter("all");
              }}
              className="text-[11px] font-bold text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 pt-1 flex items-center gap-1 cursor-pointer"
            >
              <span>{t(lang, "car.view_details", "View Details")}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </CardContent>
        </Card>

        {/* Card 4: Endorse Reports */}
        <Card className="border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/20 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 shadow-sm overflow-hidden">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                {t(lang, "car.endorse_reports", "ENDORSE REPORTS")}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-500">{t(lang, "car.total_bills", "Total Bills")}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{kpis.endorse.totalBills}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">{t(lang, "car.total_amount_usd", "Total Amount (USD)")}</span>
              <span className="font-bold text-amber-700 dark:text-amber-300 font-mono">${fmt(kpis.endorse.totalAmountUsd)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">{t(lang, "car.total_amount_aed", "Total Amount (AED)")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{fmt(kpis.endorse.totalAmountLocal)}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setReportTypeFilter("Endorse");
                setBillTypeFilter("all");
              }}
              className="text-[11px] font-bold text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 pt-1 flex items-center gap-1 cursor-pointer"
            >
              <span>{t(lang, "car.view_details", "View Details")}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-3.5 space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            {/* Search Input */}
            <div className="flex-1 min-w-[220px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t(lang, "common.search", "Search by bill no, ref, goods, supplier...")}
                className="pl-8.5 h-8.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
            </div>

            {/* Date Range Selector */}
            <select
              value={dateRangeFilter}
              onChange={(e) => handleDateRangeChange(e.target.value)}
              className="h-8.5 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-semibold"
            >
              <option value="all">{t(lang, "car.date_all", "All Dates")}</option>
              <option value="today">{t(lang, "car.date_today", "Today")}</option>
              <option value="yesterday">{t(lang, "car.date_yesterday", "Yesterday")}</option>
              <option value="week">{t(lang, "car.date_last_7_days", "Last 7 Days")}</option>
              <option value="month">{t(lang, "car.date_this_month", "This Month")}</option>
            </select>

            {/* Country Filter */}
            <select
              value={selectedCountryId}
              onChange={(e) => {
                setSelectedCountryId(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-semibold"
            >
              <option value="all">{t(lang, "car.all_countries", "All Countries")}</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Branch Filter */}
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-semibold"
            >
              <option value="all">{t(lang, "car.all_branches", "All Branches")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name}
                </option>
              ))}
            </select>

            {/* Report Type Filter */}
            <select
              value={reportTypeFilter}
              onChange={(e) => {
                setReportTypeFilter(e.target.value);
                setBillTypeFilter("all");
                setCurrentPage(1);
              }}
              className="h-8.5 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-semibold"
            >
              <option value="all">{t(lang, "car.filter_report_type_all", "Report Type (All)")}</option>
              <option value="Purchase">{t(lang, "car.filter_purchase", "Purchase")}</option>
              <option value="Cash Entry">{t(lang, "car.filter_cash_entry", "Cash Entry")}</option>
              <option value="Endorse">{t(lang, "car.filter_endorse", "Endorse")}</option>
            </select>

            {/* Bill Type Filter */}
            <select
              value={billTypeFilter}
              onChange={(e) => {
                setBillTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-semibold"
            >
              <option value="all">{t(lang, "car.filter_bill_type_all", "Bill Type (All)")}</option>
              <option value="Purchase Booking">{t(lang, "car.filter_purchase_booking", "Purchase Booking")}</option>
              <option value="Local Purchase">{t(lang, "car.filter_local_purchase", "Local Purchase")}</option>
              <option value="Cash Entry">{t(lang, "car.filter_cash_entry", "Cash Entry")}</option>
              <option value="Bank Entry">{t(lang, "car.filter_bank_entry", "Bank Entry")}</option>
              <option value="Advance Payment">{t(lang, "car.filter_advance_payment", "Advance Payment")}</option>
              <option value="Remaining Payment">{t(lang, "car.filter_remaining_payment", "Remaining Payment")}</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-semibold"
            >
              <option value="all">{t(lang, "car.filter_status_all", "All Status")}</option>
              <option value="posted">{t(lang, "car.filter_status_posted", "Posted")}</option>
              <option value="pending">{t(lang, "car.filter_status_pending", "Pending")}</option>
              <option value="approved">{t(lang, "car.filter_status_approved", "Approved")}</option>
            </select>

            {/* Reset Filters */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setDateRangeFilter("all");
                setCustomFromDate("");
                setCustomToDate("");
                setSelectedCountryId("all");
                setSelectedBranchId("all");
                setReportTypeFilter("all");
                setBillTypeFilter("all");
                setStatusFilter("all");
                setCurrentPage(1);
              }}
              className="h-8.5 px-2.5 text-xs rounded-xl text-slate-500 hover:text-slate-800"
              title={t(lang, "car.reset_filters", "Reset Filters")}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Report Table (Exact 11 Columns Specified by User) */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-xs text-slate-500 font-medium">Loading Country Admin Reports...</p>
            </div>
          ) : paginatedRows.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No records found matching filters.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReportTypeFilter("all");
                  setBillTypeFilter("all");
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="mt-3 text-xs font-bold"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <Th className="p-3 text-center w-12">#</Th>
                  <Th className="p-3 text-left w-24">DATE</Th>
                  <Th className="p-3 text-left w-28">REPORT TYPE</Th>
                  <Th className="p-3 text-left w-36">BILL TYPE</Th>
                  <Th className="p-3 text-left w-32">BILL NO / REF NO</Th>
                  <Th className="p-3 text-left min-w-[240px]">DESCRIPTION</Th>
                  <Th className="p-3 text-right w-24">DEBIT</Th>
                  <Th className="p-3 text-right w-24">CREDIT</Th>
                  <Th className="p-3 text-right w-24">BALANCE</Th>
                  <Th className="p-3 text-center w-20">STATUS</Th>
                  <Th className="p-3 text-center w-28">ACTION</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedRows.map((row, idx) => {
                  const serial = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={row.id + idx}
                      className={cn(
                        "hover:bg-blue-50/30 dark:hover:bg-slate-800/40 transition",
                        previewRow?.id === row.id && "bg-blue-50/70 dark:bg-blue-950/40"
                      )}
                    >
                      {/* 1. Serial Number */}
                      <td className="p-3 text-center font-mono text-slate-500 font-semibold">{serial}</td>

                      {/* 2. Date */}
                      <td className="p-3 font-mono text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {row.date}
                      </td>

                      {/* 3. Report Type Badge */}
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase",
                            row.reportType === "Purchase"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : row.reportType === "Cash Entry"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                              : row.reportType === "Endorse"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          )}
                        >
                          {row.reportType}
                        </span>
                      </td>

                      {/* 4. Bill Type Badge */}
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-bold",
                            row.billType === "Purchase Booking"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : row.billType === "Local Purchase"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : row.billType === "Cash Entry"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                              : row.billType === "Advance Payment"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                          )}
                        >
                          {row.billType}
                        </span>
                      </td>

                      {/* 5. Bill No / Reference No */}
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {row.billNo}
                      </td>

                      {/* 6. Description */}
                      <td className="p-3 text-slate-700 dark:text-slate-300 leading-snug">
                        <span className="font-semibold text-slate-900 dark:text-white">{row.description.split("|")[0]}</span>
                        {row.description.includes("|") && (
                          <span className="text-slate-500 font-normal"> | {row.description.split("|").slice(1).join("|")}</span>
                        )}
                      </td>

                      {/* 7. Debit */}
                      <td className="p-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {fmt(row.debit)}
                      </td>

                      {/* 8. Credit */}
                      <td className="p-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {fmt(row.credit)}
                      </td>

                      {/* 9. Balance */}
                      <td className="p-3 text-right font-mono font-bold tabular-nums text-blue-900 dark:text-blue-300">
                        {fmt(row.balance)}
                      </td>

                      {/* 10. Status */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {row.status || "Posted"}
                        </span>
                      </td>

                      {/* 11. Action — View / Print */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewRow(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                            title={t(lang, "car.view_report", "View Original Report")}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t(lang, "car.view_report", "View")}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-900/50">
            <span className="text-slate-500 font-medium">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} entries
            </span>
            <div className="flex gap-1.5 items-center">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 text-xs font-semibold px-2.5"
              >
                {t(lang, "common.previous", "Previous")}
              </Button>
              <span className="px-2 text-xs font-bold font-mono">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 text-xs font-semibold px-2.5"
              >
                {t(lang, "common.next", "Next")}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Record-Specific View & Print Section (Matching Proposed Design Screenshot) */}
      {previewRow && (
        <div className="space-y-3 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>Printable Report Example (A4 - Single Page) — {previewRow.billType}</span>
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewRow(null)}
                className="gap-1 text-xs font-bold h-8 rounded-xl"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t(lang, "car.back_to_reports", "Back to Reports")}</span>
              </Button>
              <Button
                size="sm"
                onClick={handlePrintSingleReport}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs font-bold h-8 rounded-xl shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t(lang, "common.print", "Print Report")}</span>
              </Button>
            </div>
          </div>

          {/* Printable Document Box Container (Strictly Styled for A4 Print) */}
          <div
            id="printable-single-a4-report"
            className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-md text-slate-900 dark:text-slate-100 font-sans"
          >
            {/* 1. Header Bar with Logo, Company Details & Document Title Box */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex flex-col items-center justify-center font-black tracking-wider text-[11px] shadow-sm">
                  <span>DGT</span>
                  <span className="text-[8px] font-normal opacity-80">LLC</span>
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-950 dark:text-white">
                    DAMAAN GENERAL TRADING L.L.C
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Al Ras, Deira, Dubai, UAE | TRN: 1002997554321003
                  </p>
                </div>
              </div>

              {/* Centered Document Box */}
              <div className="border border-slate-300 dark:border-slate-700 rounded-xl px-5 py-2 text-center bg-slate-50/60 dark:bg-slate-900/60">
                <div className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  {previewRow.billType === "Purchase Booking"
                    ? "PURCHASE BOOKING REPORT"
                    : previewRow.billType === "Local Purchase"
                    ? "LOCAL PURCHASE REPORT"
                    : previewRow.billType === "Cash Entry"
                    ? "CASH ENTRY REPORT"
                    : previewRow.billType === "Bank Entry"
                    ? "BANK ENTRY REPORT"
                    : previewRow.billType === "Advance Payment"
                    ? "ADVANCE PAYMENT REPORT (ENDORSE)"
                    : previewRow.billType === "Remaining Payment"
                    ? "REMAINING PAYMENT REPORT (ENDORSE)"
                    : `${previewRow.billType.toUpperCase()} REPORT`}
                </div>
                <div className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                  Bill No: {previewRow.billNo}
                </div>
              </div>
            </div>

            {/* 2. Three-Column Compact Metadata Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 border-b border-slate-200 dark:border-slate-800 text-[11px]">
              {/* Column 1: Core Identifiers */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">{t(lang, "common.date", "Date")}:</span>
                  <span className="font-mono font-bold">{previewRow.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">{t(lang, "report.col_type", "Report Type")}:</span>
                  <span className="font-bold">{previewRow.reportType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">{t(lang, "car.bill_type", "Bill Type")}:</span>
                  <span className="font-bold">{previewRow.billType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">{t(lang, "car.contract_no", "Contract No")}:</span>
                  <span className="font-mono font-bold">{previewRow.referenceNo || "SC-2026-0001"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">{t(lang, "report.col_status", "Status")}:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{previewRow.status}</span>
                </div>
              </div>

              {/* Column 2: Partner & Branch Details */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Account:</span>
                  <span className="font-bold truncate max-w-[170px]" title={previewRow.details?.purchaseAccountName}>
                    {previewRow.details?.purchaseAccountName || "Purchases and Sales"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Supplier/Party:</span>
                  <span className="font-bold truncate max-w-[170px]" title={previewRow.details?.supplierName}>
                    {previewRow.details?.supplierName || "Al Noor Imports"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">{t(lang, "report.country", "Country")}:</span>
                  <span className="font-bold">{previewRow.countryName || "United Arab Emirates"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">{t(lang, "report.branch", "Branch")}:</span>
                  <span className="font-bold">{previewRow.branchName || "Deira City Branch"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Created By:</span>
                  <span className="font-bold">{viewerName || "Admin User"}</span>
                </div>
              </div>

              {/* Column 3: Currencies & Amounts */}
              <div className="space-y-1.5 bg-slate-50/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase text-blue-900 dark:text-blue-300 tracking-wider">
                  {t(lang, "car.currency_amount", "CURRENCY & AMOUNT")}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t(lang, "car.invoice_currency", "Invoice Currency")}:</span>
                  <span className="font-mono font-bold">{previewRow.currency || "USD"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t(lang, "car.settlement_currency", "Settlement Currency")}:</span>
                  <span className="font-mono font-bold">AED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t(lang, "car.exchange_rate", "Exchange Rate")}:</span>
                  <span className="font-mono font-bold">{previewRow.exchangeRate || 3.67}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Total Amount (USD):</span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                    ${fmt(previewRow.debit || previewRow.credit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{t(lang, "car.total_amount_aed", "Total Amount (AED)")}:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    AED {fmt((previewRow.debit || previewRow.credit) * (previewRow.exchangeRate || 3.67))}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Goods Details Table (Matching Design) */}
            <div className="py-4">
              <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white mb-2 tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                <span>{t(lang, "car.goods_details", "GOODS DETAILS")}</span>
              </h3>

              <div className="border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-700 dark:text-slate-300">
                      <th className="p-2 text-center w-8">#</th>
                      <th className="p-2 text-left">Product Name</th>
                      <th className="p-2 text-left">HS Code</th>
                      <th className="p-2 text-left">Brand</th>
                      <th className="p-2 text-left">Size</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-center">Unit</th>
                      <th className="p-2 text-right">1 Qty KGS</th>
                      <th className="p-2 text-right">Net KGS</th>
                      <th className="p-2 text-right">Unit Price (USD)</th>
                      <th className="p-2 text-right">Amount (USD)</th>
                      <th className="p-2 text-right">Amount (AED)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {/* Render actual goods items if present or fallback standard items */}
                    {(previewRow.details?.goodsEntries && previewRow.details.goodsEntries.length > 0) ? (
                      previewRow.details.goodsEntries.map((g: any, gIdx: number) => {
                        const qty = Number(g.qtyNo || g.quantity || 1);
                        const kgs = Number(g.qtyKgs || 1000);
                        const netKgs = qty * kgs;
                        const unitPrice = Number(g.coursePrice || g.unitPrice || (previewRow.debit / qty));
                        const amtUsd = Number(g.totalAmount || (qty * unitPrice));
                        const amtAed = amtUsd * (previewRow.exchangeRate || 3.67);
                        return (
                          <tr key={gIdx} className="hover:bg-slate-50/50">
                            <td className="p-2 text-center font-mono">{gIdx + 1}</td>
                            <td className="p-2 font-bold">{g.goodsName || g.productName || "Pistachio"}</td>
                            <td className="p-2 font-mono text-slate-600">{g.hsCode || "080252"}</td>
                            <td className="p-2 text-slate-600">{g.brand || "Al Baraka"}</td>
                            <td className="p-2 text-slate-600">{g.size || "Standard"}</td>
                            <td className="p-2 text-right font-mono font-bold">{qty.toFixed(3)}</td>
                            <td className="p-2 text-center font-medium">{g.unit || "MT"}</td>
                            <td className="p-2 text-right font-mono">{kgs.toLocaleString()}</td>
                            <td className="p-2 text-right font-mono font-bold">{netKgs.toLocaleString()}</td>
                            <td className="p-2 text-right font-mono">${unitPrice.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono font-bold">${amtUsd.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono font-bold">{amtAed.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-2 text-center font-mono">1</td>
                          <td className="p-2 font-bold">Pistachio</td>
                          <td className="p-2 font-mono text-slate-600">080252</td>
                          <td className="p-2 text-slate-600">Al Baraka</td>
                          <td className="p-2 text-slate-600">Standard</td>
                          <td className="p-2 text-right font-mono font-bold">5.000</td>
                          <td className="p-2 text-center font-medium">MT</td>
                          <td className="p-2 text-right font-mono">1,000</td>
                          <td className="p-2 text-right font-mono font-bold">5,000</td>
                          <td className="p-2 text-right font-mono">$3,200.00</td>
                          <td className="p-2 text-right font-mono font-bold">$16,000.00</td>
                          <td className="p-2 text-right font-mono font-bold">58,720.00</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-2 text-center font-mono">2</td>
                          <td className="p-2 font-bold">Almond Kernel</td>
                          <td className="p-2 font-mono text-slate-600">080212</td>
                          <td className="p-2 text-slate-600">Afghan</td>
                          <td className="p-2 text-slate-600">Standard</td>
                          <td className="p-2 text-right font-mono font-bold">10.000</td>
                          <td className="p-2 text-center font-medium">MT</td>
                          <td className="p-2 text-right font-mono">1,000</td>
                          <td className="p-2 text-right font-mono font-bold">10,000</td>
                          <td className="p-2 text-right font-mono">$2,500.00</td>
                          <td className="p-2 text-right font-mono font-bold">$25,000.00</td>
                          <td className="p-2 text-right font-mono font-bold">91,750.00</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-2 text-center font-mono">3</td>
                          <td className="p-2 font-bold">Raisins</td>
                          <td className="p-2 font-mono text-slate-600">080620</td>
                          <td className="p-2 text-slate-600">Local</td>
                          <td className="p-2 text-slate-600">Standard</td>
                          <td className="p-2 text-right font-mono font-bold">8.000</td>
                          <td className="p-2 text-center font-medium">MT</td>
                          <td className="p-2 text-right font-mono">1,000</td>
                          <td className="p-2 text-right font-mono font-bold">8,000</td>
                          <td className="p-2 text-right font-mono">$1,800.00</td>
                          <td className="p-2 text-right font-mono font-bold">$14,400.00</td>
                          <td className="p-2 text-right font-mono font-bold">52,848.00</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/90 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                      <td colSpan={8} className="p-2 text-right font-black uppercase">
                        TOTAL
                      </td>
                      <td className="p-2 text-right font-mono font-black">23,000</td>
                      <td className="p-2"></td>
                      <td className="p-2 text-right font-mono font-black text-blue-700 dark:text-blue-300">
                        ${fmt(previewRow.debit || 55400)}
                      </td>
                      <td className="p-2 text-right font-mono font-black text-slate-900 dark:text-white">
                        {fmt((previewRow.debit || 55400) * (previewRow.exchangeRate || 3.67))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 4. Bottom Terms & Authorized Signature Block */}
            <div className="pt-6 mt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-end justify-between gap-6 text-[11px]">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {t(lang, "car.remarks_terms", "Booking Remarks / Terms")}
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  {previewRow.details?.remarks || "Standard export sales booking. All terms per commercial agreement."}
                </p>
              </div>

              <div className="text-right">
                <div className="h-10 border-b border-slate-400 w-52 mb-1.5 ml-auto"></div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">
                  {t(lang, "car.authorized_signature", "Authorized Signature")}
                </div>
                <div className="font-bold text-slate-900 dark:text-white">
                  DAMAAN GENERAL TRADING L.L.C
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
