"use client";

import { translateHeader } from "@/lib/i18n/table-headers";
import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  RefreshCw,
  Printer,
  Download,
  Building2,
  Receipt,
  CircleDollarSign,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  FileCheck2,
  CheckCircle,
  ExternalLink,
  Edit3,
  ChevronDown,
  Layers,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import type { CrmPayablesReceivablesPayload } from "@/lib/crm/crm-payables-receivables-service";

interface CrmPayablesReceivablesViewProps {
  onBackToOverview?: () => void;
}

export function CrmPayablesReceivablesView({ onBackToOverview }: CrmPayablesReceivablesViewProps) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CrmPayablesReceivablesPayload | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activePanel, setActivePanel] = useState<"both" | "purchase" | "sales">("both");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDaySlot, setSelectedDaySlot] = useState<string | null>(null);

  // Due Date Edit Modal State
  const [editingItem, setEditingItem] = useState<{
    id: string;
    module: "purchase" | "sales";
    orderType?: "purchase_order" | "local_purchase" | "sales_order";
    refNo: string;
    partyName: string;
    currentDueDate: string | null;
  } | null>(null);
  const [newDueDate, setNewDueDate] = useState<string>("");
  const [savingDueDate, setSavingDueDate] = useState(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  // Localization helper
  const pt = (key: string, fallback: string) => t(lang, `paytrack.${key}` as any, fallback);

  const fetchData = async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (searchQuery) qp.set("search", searchQuery);
      if (selectedCategory !== "all") qp.set("category", selectedCategory);

      const res = await fetch(`/api/erp/crm/payables-receivables?${qp.toString()}`, {
        cache: "no-store"
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load CRM Payables & Receivables:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, selectedCategory]);

  // Handle Due Date Save
  const handleSaveDueDate = async () => {
    if (!editingItem) return;
    setSavingDueDate(true);
    setEditSuccessMsg(null);
    try {
      const res = await fetch("/api/erp/payment-tracking/due-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: editingItem.module,
          orderType: editingItem.orderType,
          orderId: editingItem.id,
          agreedDueDate: newDueDate || null
        })
      });
      const json = await res.json();
      if (json.success) {
        setEditSuccessMsg(pt("due_date_saved", "Agreed due date updated successfully."));
        setTimeout(() => {
          setEditingItem(null);
          setEditSuccessMsg(null);
          fetchData();
        }, 800);
      } else {
        alert(json.error || "Failed to update due date");
      }
    } catch (err: any) {
      alert(err?.message || "Error saving due date");
    } finally {
      setSavingDueDate(false);
    }
  };

  // Filter items for display
  const filteredPurchaseItems = useMemo(() => {
    if (!data?.purchaseItems) return [];
    return data.purchaseItems.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "due_today" && !item.isDueToday) return false;
        if (statusFilter === "overdue" && !item.isOverdue) return false;
        if (statusFilter === "upcoming" && !item.isUpcoming) return false;
        if (statusFilter === "not_set" && item.agreedDueDate !== null) return false;
        if (statusFilter === "fully_paid" && !item.isFullyPaid) return false;
        if (statusFilter === "partially_paid" && !item.isPartiallyPaid) return false;
      }
      if (selectedDaySlot && item.agreedDueDate !== selectedDaySlot) return false;
      return true;
    });
  }, [data?.purchaseItems, selectedCategory, statusFilter, selectedDaySlot]);

  const filteredSalesItems = useMemo(() => {
    if (!data?.salesItems) return [];
    return data.salesItems.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "due_today" && !item.isDueToday) return false;
        if (statusFilter === "overdue" && !item.isOverdue) return false;
        if (statusFilter === "upcoming" && !item.isUpcoming) return false;
        if (statusFilter === "not_set" && item.agreedDueDate !== null) return false;
        if (statusFilter === "fully_paid" && !item.isFullyPaid) return false;
        if (statusFilter === "partially_paid" && !item.isPartiallyPaid) return false;
      }
      if (selectedDaySlot && item.agreedDueDate !== selectedDaySlot) return false;
      return true;
    });
  }, [data?.salesItems, selectedCategory, statusFilter, selectedDaySlot]);

  // Export CSV
  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ["MODULE", "REF NO", "PARTY NAME", "CURRENCY", "TOTAL AMOUNT", "PAID AMOUNT", "OUTSTANDING", "AGREED DUE DATE", "DAYS REMAINING", "STATUS"],
      ...filteredPurchaseItems.map((p) => [
        "PURCHASE",
        p.billOrInvoiceNumber,
        `"${p.supplierOrCustomerName.replace(/"/g, '""')}"`,
        p.currency,
        p.totalPaymentAmount,
        p.amountPaid,
        p.outstandingBalance,
        p.agreedDueDate || "Due Date Not Set",
        p.daysRemaining !== null ? p.daysRemaining : (p.isOverdue ? `-${p.overdueDays}` : "—"),
        p.paymentStatus
      ]),
      ...filteredSalesItems.map((s) => [
        "SALES",
        s.billOrInvoiceNumber,
        `"${s.supplierOrCustomerName.replace(/"/g, '""')}"`,
        s.currency,
        s.totalPaymentAmount,
        s.amountPaid,
        s.outstandingBalance,
        s.agreedDueDate || "Due Date Not Set",
        s.daysRemaining !== null ? s.daysRemaining : (s.isOverdue ? `-${s.overdueDays}` : "—"),
        s.paymentStatus
      ])
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm_payables_receivables_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = data?.summaryCards;
  const forecast = data?.dailyForecast || [];

  return (
    <div className={cn("w-full space-y-6 pb-16 font-sans text-slate-900 dark:text-slate-100", isRtl ? "text-right" : "text-left")} dir={isRtl ? "rtl" : "ltr"}>
      {/* ── TOP EXECUTIVE BANNER ── */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/40">
                <DollarSign className="h-5 w-5" />
              </span>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">
                {pt("crm_payables_receivables", "Purchase Payables & Sales Receivables")}
              </h1>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 font-mono text-[11px]">
                {data?.forecastRange.label || "5-Day Forecast"}
              </Badge>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl font-medium">
              {pt("five_day_forecast", "5-Day Payment Forecast")} &middot; {pt("money_we_must_pay", "Purchase Payments — Money We Must Pay")} &middot; {pt("money_we_must_receive", "Sales Payments — Money We Must Receive")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="h-8 text-xs font-bold border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>{pt("btn_refresh", "Refresh")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-8 text-xs font-bold border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{pt("btn_export", "Export")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 text-xs font-bold border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{pt("btn_print", "Print")}</span>
            </Button>
            {onBackToOverview && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onBackToOverview}
                className="h-8 text-xs font-bold bg-white/10 hover:bg-white/20 text-white"
              >
                {pt("btn_back", "Back")}
              </Button>
            )}
          </div>
        </div>

        {/* ── 5-DAY INTERACTIVE FORECAST STRIP ── */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span>{pt("five_day_forecast", "5-Day Payment Forecast")}</span>
              <span className="text-[11px] font-mono text-blue-300 font-normal">({data?.forecastRange.label})</span>
            </span>
            {selectedDaySlot && (
              <button
                type="button"
                onClick={() => setSelectedDaySlot(null)}
                className="text-[11px] text-blue-300 hover:underline font-bold"
              >
                ✕ {pt("all_categories", "Clear Date Filter")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {forecast.map((f) => {
              const isSelected = selectedDaySlot === f.date;
              const dayTitle = pt(f.dayLabel, f.dayLabel.toUpperCase());
              return (
                <div
                  key={f.date}
                  onClick={() => setSelectedDaySlot(isSelected ? null : f.date)}
                  className={cn(
                    "cursor-pointer rounded-xl p-3 border transition text-left backdrop-blur-xs select-none",
                    isSelected
                      ? "bg-blue-600/40 border-blue-400 shadow-md ring-2 ring-blue-400"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-extrabold text-blue-200 uppercase">{dayTitle}</span>
                    <span className="font-mono text-[11px] text-slate-300">{f.date.slice(5)}</span>
                  </div>

                  <div className="space-y-1">
                    {/* Payables Due */}
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="text-rose-300 flex items-center gap-0.5">
                        <ArrowDownRight className="h-3 w-3 inline" /> {pt("today", "Pay")}
                      </span>
                      <span className="font-mono font-bold text-rose-200">
                        {f.payableAmount > 0 ? f.payableAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
                      </span>
                    </div>

                    {/* Receivables Expected */}
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="text-emerald-300 flex items-center gap-0.5">
                        <ArrowUpRight className="h-3 w-3 inline" /> {pt("today", "Rec")}
                      </span>
                      <span className="font-mono font-bold text-emerald-200">
                        {f.receivableAmount > 0 ? f.receivableAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
                      </span>
                    </div>

                    {/* Net Daily Flow */}
                    <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px] font-mono font-bold">
                      <span className="text-slate-400 text-[11px]">Net:</span>
                      <span className={cn(f.netCashFlow >= 0 ? "text-emerald-300" : "text-rose-300")}>
                        {f.netCashFlow >= 0 ? "+" : ""}{f.netCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 9 EXECUTIVE SUMMARY KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3.5">
        {/* 1. Purchase Payments Due Today */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400/50 transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {pt("pay_due_today", "Purchase Payments Due Today")}
              </p>
              <h3 className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
                {summary?.purchaseDueToday ? summary.purchaseDueToday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 2. Sales Receipts Expected Today */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-400/50 transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {pt("rec_expected_today", "Sales Receipts Expected Today")}
              </p>
              <h3 className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {summary?.salesExpectedToday ? summary.salesExpectedToday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 3. Net Expected Cash Flow (5-Day) */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-400/50 transition bg-gradient-to-br from-indigo-50/40 to-blue-50/20 dark:from-indigo-950/20 dark:to-blue-950/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                {pt("net_expected_cashflow", "Net Expected Cash Flow (5-Day)")}
              </p>
              <h3 className={cn("text-xl font-black font-mono mt-1", (summary?.netExpectedCashFlow || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {(summary?.netExpectedCashFlow || 0) >= 0 ? "+" : ""}{summary?.netExpectedCashFlow ? summary.netExpectedCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 4. Purchase Payments Due Within Next 5 Days */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs hover:border-rose-400/50 transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {pt("pay_due_5days", "Purchase Payments Due (Next 5 Days)")}
              </p>
              <h3 className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                {summary?.purchaseDue5Days ? summary.purchaseDue5Days.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 5. Sales Receipts Expected Within Next 5 Days */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-400/50 transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {pt("rec_expected_5days", "Sales Receipts Expected (Next 5 Days)")}
              </p>
              <h3 className="text-xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
                {summary?.salesExpected5Days ? summary.salesExpected5Days.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 6. Overdue Purchase Payments */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs hover:border-red-500/50 transition bg-red-50/20 dark:bg-red-950/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                {pt("overdue_purchases", "Overdue Purchase Payments")}
              </p>
              <h3 className="text-xl font-black font-mono text-red-600 dark:text-red-400 mt-1">
                {summary?.overduePurchase ? summary.overduePurchase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 7. Overdue Sales Receivables */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-500/50 transition bg-amber-50/20 dark:bg-amber-950/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                {pt("overdue_sales", "Overdue Sales Receivables")}
              </p>
              <h3 className="text-xl font-black font-mono text-amber-700 dark:text-amber-400 mt-1">
                {summary?.overdueSales ? summary.overdueSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 8. Total Outstanding Purchase Payables */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-400 transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {pt("total_out_payables", "Total Outstanding Purchase Payables")}
              </p>
              <h3 className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {summary?.totalOutstandingPurchase ? summary.totalOutstandingPurchase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 9. Total Outstanding Sales Receivables */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-400 transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {pt("total_out_receivables", "Total Outstanding Sales Receivables")}
              </p>
              <h3 className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {summary?.totalOutstandingSales ? summary.totalOutstandingSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CATEGORY BREAKDOWN CARDS ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <span>{pt("category_breakdown", "Payment Category Breakdown")}</span>
          </h2>
          {selectedCategory !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="text-xs text-blue-600 dark:text-blue-400 font-bold"
            >
              {pt("all_categories", "Show All Categories")}
            </Button>
          )}
        </div>

        {/* Purchase Categories */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
            {pt("money_we_must_pay", "Purchase Payments — Money We Must Pay")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {data?.purchaseCategories.map((cat) => {
              const isSelected = selectedCategory === cat.categoryKey;
              return (
                <div
                  key={cat.categoryKey}
                  onClick={() => setSelectedCategory(isSelected ? "all" : cat.categoryKey)}
                  className={cn(
                    "cursor-pointer rounded-xl p-3 border transition text-left select-none",
                    isSelected
                      ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-sm ring-2 ring-rose-400"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      {pt(`cat_${cat.categoryKey}`, cat.categoryLabelEn)}
                    </span>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      {cat.count}
                    </Badge>
                  </div>
                  <div className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
                    {cat.totalOutstanding > 0 ? cat.totalOutstanding.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Due: {cat.dueToday.toLocaleString()}</span>
                    <span className="text-rose-600">Overdue: {cat.overdue.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales Categories */}
        <div className="space-y-2 pt-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {pt("money_we_must_receive", "Sales Payments — Money We Must Receive")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {data?.salesCategories.map((cat) => {
              const isSelected = selectedCategory === cat.categoryKey;
              return (
                <div
                  key={cat.categoryKey}
                  onClick={() => setSelectedCategory(isSelected ? "all" : cat.categoryKey)}
                  className={cn(
                    "cursor-pointer rounded-xl p-3 border transition text-left select-none",
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-sm ring-2 ring-emerald-400"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      {pt(`cat_sales_${cat.categoryKey}`, cat.categoryLabelEn)}
                    </span>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      {cat.count}
                    </Badge>
                  </div>
                  <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {cat.totalOutstanding > 0 ? cat.totalOutstanding.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Due: {cat.dueToday.toLocaleString()}</span>
                    <span className="text-rose-600">Overdue: {cat.overdue.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CONTROLS & FILTER ROW ── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
        {/* Panel Switcher (Both / Purchase Payables / Sales Receivables) */}
        <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs font-bold w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActivePanel("both")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg transition cursor-pointer",
              activePanel === "both" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            {pt("all_categories", "All (Payables & Receivables)")}
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("purchase")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg transition cursor-pointer",
              activePanel === "purchase" ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            {pt("money_we_must_pay", "Purchase Payables")} ({filteredPurchaseItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("sales")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg transition cursor-pointer",
              activePanel === "sales" ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            {pt("money_we_must_receive", "Sales Receivables")} ({filteredSalesItems.length})
          </button>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative min-w-[200px] flex-1 md:flex-initial">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Bill #, Party..."
              className="h-8 pl-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Statuses</option>
            <option value="due_today">Due Today</option>
            <option value="overdue">Overdue</option>
            <option value="upcoming">Upcoming</option>
            <option value="not_set">Due Date Not Set</option>
            <option value="partially_paid">{translateHeader(lang, "Partially Paid")}</option>
            <option value="fully_paid">{translateHeader(lang, "Fully Paid")}</option>
          </select>
        </div>
      </div>

      {/* ── PANEL A: PURCHASE PAYABLES (MONEY WE MUST PAY) ── */}
      {(activePanel === "both" || activePanel === "purchase") && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-600 inline-block" />
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                {pt("money_we_must_pay", "Panel A: Purchase Payments — Money We Must Pay")}
              </h3>
              <Badge variant="outline" className="font-mono text-xs">
                {filteredPurchaseItems.length} Records
              </Badge>
            </div>
            <Link
              href="/dashboard/journal/purchase-order-payment/advance"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>{pt("open_payment_page", "Open Purchase Payments")}</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">{pt("bill_or_invoice_no", "Bill #")}</th>
                  <th className="py-2.5 px-3">{pt("supplier_or_customer", "Supplier Name")}</th>
                  <th className="py-2.5 px-2">Category</th>
                  <th className="py-2.5 px-2">Location</th>
                  <th className="py-2.5 px-2 text-right">{pt("total_payment_amount", "Total Amt")}</th>
                  <th className="py-2.5 px-2 text-right">{pt("amount_paid_received", "Paid")}</th>
                  <th className="py-2.5 px-2 text-right font-black text-rose-600">{pt("outstanding_balance", "Outstanding")}</th>
                  <th className="py-2.5 px-3 text-center">{pt("due_date", "Agreed Due Date")}</th>
                  <th className="py-2.5 px-2 text-center">{pt("days_remaining", "Days / Overdue")}</th>
                  <th className="py-2.5 px-2 text-center">{pt("payment_status", "Payment Status")}</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200 text-[12px]">
                {filteredPurchaseItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 text-xs">
                      No purchase payable obligations matched your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPurchaseItems.map((item) => (
                    <tr key={`${item.sourceType}-${item.id}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.billOrInvoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 font-bold">{item.supplierOrCustomerName}</td>
                      <td className="py-2.5 px-2">
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-[11px] text-slate-500">
                        {item.branchName || item.countryName || "—"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">
                        {item.currency} {item.totalPaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {item.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                        {item.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {item.agreedDueDate ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {item.agreedDueDate}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">{pt("due_date_not_set", "Due Date Not Set")}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-[11px]">
                        {item.isDueToday ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                            {pt("due_today", "Due Today")}
                          </span>
                        ) : item.isOverdue ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold">
                            {item.overdueDays}d {pt("overdue", "Overdue")}
                          </span>
                        ) : item.isUpcoming ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold">
                            {item.daysRemaining}d {pt("days_remaining", "Remaining")}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[11px] font-bold",
                            item.statusBadgeVariant === "emerald" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                            item.statusBadgeVariant === "amber" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                            item.statusBadgeVariant === "rose" && "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
                            item.statusBadgeVariant === "blue" && "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
                            item.statusBadgeVariant === "slate" && "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                          )}
                        >
                          {pt(
                            item.paymentStatus === "Upcoming" ? "status_upcoming" :
                            item.paymentStatus === "Due Today" ? "status_due_today" :
                            item.paymentStatus === "Overdue" ? "status_overdue" :
                            item.paymentStatus === "Partially Paid" ? "status_partially_paid" :
                            item.paymentStatus === "Fully Paid" ? "status_fully_paid" : "due_date_not_set",
                            item.paymentStatus
                          )}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Edit Agreed Due Date"
                            onClick={() => {
                              setEditingItem({
                                id: item.id,
                                module: "purchase",
                                orderType: item.sourceType,
                                refNo: item.billOrInvoiceNumber,
                                partyName: item.supplierOrCustomerName,
                                currentDueDate: item.agreedDueDate
                              });
                              setNewDueDate(item.agreedDueDate || "");
                            }}
                            className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <Link
                            href={
                              item.category === "credit"
                                ? "/dashboard/journal/purchase-order-payment/charges"
                                : item.category === "remaining"
                                ? "/dashboard/journal/purchase-order-payment/remaining"
                                : item.category === "endorsement"
                                ? "/dashboard/journal/purchase-order-payment/endorsement"
                                : "/dashboard/journal/purchase-order-payment/advance"
                            }
                            className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Go to Payment Journal"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PANEL B: SALES RECEIVABLES (MONEY WE MUST RECEIVE) ── */}
      {(activePanel === "both" || activePanel === "sales") && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-600 inline-block" />
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                {pt("money_we_must_receive", "Panel B: Sales Payments — Money We Must Receive")}
              </h3>
              <Badge variant="outline" className="font-mono text-xs">
                {filteredSalesItems.length} Records
              </Badge>
            </div>
            <Link
              href="/dashboard/journal/sales-order-payment/advance"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>{pt("open_payment_page", "Open Sales Receipts")}</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">{pt("bill_or_invoice_no", "Invoice #")}</th>
                  <th className="py-2.5 px-3">{pt("supplier_or_customer", "Customer Name")}</th>
                  <th className="py-2.5 px-2">Category</th>
                  <th className="py-2.5 px-2">Location</th>
                  <th className="py-2.5 px-2 text-right">{pt("total_payment_amount", "Total Amt")}</th>
                  <th className="py-2.5 px-2 text-right">{pt("amount_paid_received", "Received")}</th>
                  <th className="py-2.5 px-2 text-right font-black text-emerald-600">{pt("outstanding_balance", "Outstanding")}</th>
                  <th className="py-2.5 px-3 text-center">{pt("due_date", "Agreed Due Date")}</th>
                  <th className="py-2.5 px-2 text-center">{pt("days_remaining", "Days / Overdue")}</th>
                  <th className="py-2.5 px-2 text-center">{pt("payment_status", "Payment Status")}</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200 text-[12px]">
                {filteredSalesItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 text-xs">
                      No sales receivable collections matched your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSalesItems.map((item) => (
                    <tr key={`${item.sourceType}-${item.id}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.billOrInvoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 font-bold">{item.supplierOrCustomerName}</td>
                      <td className="py-2.5 px-2">
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-[11px] text-slate-500">
                        {item.branchName || item.countryName || "—"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">
                        {item.currency} {item.totalPaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {item.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {item.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {item.agreedDueDate ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {item.agreedDueDate}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">{pt("due_date_not_set", "Due Date Not Set")}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-[11px]">
                        {item.isDueToday ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                            {pt("due_today", "Due Today")}
                          </span>
                        ) : item.isOverdue ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold">
                            {item.overdueDays}d {pt("overdue", "Overdue")}
                          </span>
                        ) : item.isUpcoming ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold">
                            {item.daysRemaining}d {pt("days_remaining", "Remaining")}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[11px] font-bold",
                            item.statusBadgeVariant === "emerald" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                            item.statusBadgeVariant === "amber" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                            item.statusBadgeVariant === "rose" && "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
                            item.statusBadgeVariant === "blue" && "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
                            item.statusBadgeVariant === "slate" && "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                          )}
                        >
                          {pt(
                            item.paymentStatus === "Upcoming" ? "status_upcoming" :
                            item.paymentStatus === "Due Today" ? "status_due_today" :
                            item.paymentStatus === "Overdue" ? "status_overdue" :
                            item.paymentStatus === "Partially Paid" ? "status_partially_paid" :
                            item.paymentStatus === "Fully Paid" ? "status_fully_paid" : "due_date_not_set",
                            item.paymentStatus
                          )}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Edit Agreed Due Date"
                            onClick={() => {
                              setEditingItem({
                                id: item.id,
                                module: "sales",
                                orderType: "sales_order",
                                refNo: item.billOrInvoiceNumber,
                                partyName: item.supplierOrCustomerName,
                                currentDueDate: item.agreedDueDate
                              });
                              setNewDueDate(item.agreedDueDate || "");
                            }}
                            className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <Link
                            href={
                              item.category === "credit"
                                ? "/dashboard/journal/sales-order-payment/charges"
                                : item.category === "remaining"
                                ? "/dashboard/journal/sales-order-payment/remaining"
                                : "/dashboard/journal/sales-order-payment/advance"
                            }
                            className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Go to Sales Payment Journal"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RECENT PAYMENT HISTORY REFERENCE SECTION (ZERO DUPLICATE COUNTING) ── */}
      {data?.recentHistory && data.recentHistory.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <span>Payment History Reference (Settled & Recorded Payments)</span>
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <Link
                href="/dashboard/journal/purchase-order-payment/history"
                className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
              >
                Purchase History &rarr;
              </Link>
              <Link
                href="/dashboard/journal/sales-order-payment/history"
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
              >
                Sales History &rarr;
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2 px-3">Module</th>
                  <th className="py-2 px-3">{pt("bill_or_invoice_no", "Ref #")}</th>
                  <th className="py-2 px-3">{pt("supplier_or_customer", "Party Name")}</th>
                  <th className="py-2 px-2">Payment Type</th>
                  <th className="py-2 px-2 text-right">{pt("amount_paid_received", "Amount")}</th>
                  <th className="py-2 px-3 text-center">{pt("history_payment_date", "Payment Date")}</th>
                  <th className="py-2 px-3 text-center">{pt("history_recorded_due_date", "Recorded Due Date")}</th>
                  <th className="py-2 px-2 text-center">{pt("historical_status", "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300 text-[11.5px]">
                {data.recentHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-3">
                      <Badge variant="outline" className={cn("text-[11px] font-bold uppercase", h.module === "purchase" ? "text-rose-600 border-rose-300" : "text-emerald-600 border-emerald-300")}>
                        {h.module}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{h.billOrInvoiceNumber}</td>
                    <td className="py-2 px-3">{h.partyName}</td>
                    <td className="py-2 px-2 font-mono capitalize">{h.paymentKind}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold">
                      {h.currency} {h.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center font-mono">{h.paymentDate}</td>
                    <td className="py-2 px-3 text-center font-mono text-slate-500">{h.agreedDueDate || "—"}</td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold whitespace-nowrap">
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EDIT AGREED DUE DATE MODAL ── */}
      {editingItem && (
        <Dialog open={Boolean(editingItem)} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
          <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span>{pt("set_due_date", "Set / Update Due Date")}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{pt("bill_or_invoice_no", "Bill / Invoice No")}:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{editingItem.refNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{pt("supplier_or_customer", "Party")}:</span>
                  <span className="font-bold">{editingItem.partyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Due Date:</span>
                  <span className="font-mono">{editingItem.currentDueDate || "Due Date Not Set"}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {pt("agreed_payment_due_date", "Agreed Payment Due Date")}
                </label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="text-xs font-mono font-bold h-9 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                />
                <p className="text-[11px] text-slate-400">
                  Select the actual agreed date by which this payment must be settled. Leave empty to unset.
                </p>
              </div>

              {editSuccessMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{editSuccessMsg}</span>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingItem(null)}
                disabled={savingDueDate}
              >
                {t(lang, "bankroz.cancel", "Cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveDueDate}
                disabled={savingDueDate}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {savingDueDate ? "Saving..." : pt("save_due_date", "Save Due Date")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
