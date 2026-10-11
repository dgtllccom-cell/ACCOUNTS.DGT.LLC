"use client";

import React, { useMemo, useRef, useEffect, useState, type ReactNode } from "react";
import {
  FileText, ChevronRight, Filter, MoreVertical, Search,
  ShoppingCart, Layers, Building2, Globe2, Printer, Download,
  FileSpreadsheet, Plus, RotateCcw, Package, Users, Scale, Receipt,
  Check, X, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { unitFor, valueIn, fmtMoney, fmtInt, fmtPct, type RateOf } from "@/lib/purchase-ui/money-unit";
import { countryLabel } from "@/lib/purchase-ui/country-name";
import "@/components/purchase-ui/purchase-approved.css";

export interface LocalPurchaseApprovedHeaderProps {
  purchases: any[];
  filteredPurchases: any[];
  activeBranch?: any;
  session: any;
  scopeCountryName?: string;
  scopeBranchName?: string;
  usdRates: Record<string, number>;
  // Filter states & setters
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedSupplier: string;
  onSupplierChange: (s: string) => void;
  selectedGoodsId: string;
  onGoodsChange: (g: string) => void;
  selectedCountryId: string;
  onCountryChange: (c: string) => void;
  selectedBranchId: string;
  onBranchChange: (b: string) => void;
  selectedStatus: string;
  onStatusChange: (st: string) => void;
  selectedPaymentMode: string;
  onPaymentModeChange: (pm: string) => void;
  dateFrom: string;
  onDateFromChange: (d: string) => void;
  dateTo: string;
  onDateToChange: (d: string) => void;
  onResetFilters: () => void;
  // Options
  goodsList: any[];
  countryOptions: any[];
  countryBranches: any[];
  // Actions
  onNewPurchase: () => void;
  onPrint: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
}

export function LocalPurchaseApprovedHeader({
  purchases,
  filteredPurchases,
  activeBranch,
  session,
  scopeCountryName,
  scopeBranchName,
  usdRates,
  searchQuery,
  onSearchChange,
  selectedSupplier,
  onSupplierChange,
  selectedGoodsId,
  onGoodsChange,
  selectedCountryId,
  onCountryChange,
  selectedBranchId,
  onBranchChange,
  selectedStatus,
  onStatusChange,
  selectedPaymentMode,
  onPaymentModeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onResetFilters,
  goodsList,
  countryOptions,
  countryBranches,
  onNewPurchase,
  onPrint,
  onExportCsv,
  onExportPdf,
}: LocalPurchaseApprovedHeaderProps) {
  const s = useErpScreen("lp");
  const lang = s.lang;
  const isRtl = s.isRtl;
  const tx = (k: string, fb: string) => k.startsWith("common.") || k.startsWith("nav.") || k.startsWith("pap.") ? s.tGlobal(k, fb) : s.t(k.replace(/^lp\./, ""), fb);
  const isSuperAdmin = Boolean(
    session?.isSuperAdmin ||
    session?.isSuperAdmin === true ||
    session?.scopes?.isSuperAdmin ||
    session?.roles?.includes?.("super_admin") ||
    session?.role === "super_admin"
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close popups on outside click
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, []);

  // Compute active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedSupplier) count++;
    if (selectedGoodsId) count++;
    if (selectedCountryId) count++;
    if (selectedBranchId) count++;
    if (selectedStatus && selectedStatus !== "all") count++;
    if (selectedPaymentMode && selectedPaymentMode !== "all") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [
    searchQuery, selectedSupplier, selectedGoodsId, selectedCountryId,
    selectedBranchId, selectedStatus, selectedPaymentMode, dateFrom, dateTo
  ]);

  // Unique suppliers list from purchases
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    purchases.forEach((p) => {
      const name = String(p.supplier_name || p.supplierName || "").trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [purchases]);

  // Metrics computation for the 3 cards
  const metrics = useMemo(() => {
    const rows = filteredPurchases;
    const curOf = (r: any) => String(r.purchase_currency || r.purchaseCurrency || r.local_currency || r.localCurrency || "AED").toUpperCase();
    const amountOf = (r: any) => Number(r.final_cost || r.finalCost || r.purchase_cost || r.purchaseCost || 0);
    const rateOf: RateOf = (c) => usdRates[c];

    const unit = unitFor(rows, curOf, amountOf, rateOf);
    const totalAmount = valueIn(unit, rows, curOf, amountOf, rateOf);

    // Paid vs Remaining breakdown
    let paidSum = 0;
    let remainingSum = 0;
    let invoicePaymentsSum = 0;
    let creditSum = 0;

    let invoicePaymentsCount = 0;
    let remainingCount = 0;
    let creditCount = 0;
    let paidCount = 0;

    rows.forEach((r) => {
      const cost = amountOf(r);
      const st = String(r.status || r.bill_status || "").toLowerCase();
      const pMode = String(r.payment_mode || r.paymentMode || "").toLowerCase();
      const isCompleted = ["posted", "accepted", "transferred", "completed"].includes(st);

      // Amount paid on this bill
      let paid = 0;
      if (isCompleted) {
        paid = cost;
      } else if (pMode === "cash") {
        paid = cost;
      } else if (Number(r.advance_amount || r.advanceAmount || 0) > 0) {
        paid = Number(r.advance_amount || r.advanceAmount || 0);
      }
      const rem = Math.max(0, cost - paid);

      paidSum += paid;
      remainingSum += rem;

      if (isCompleted || paid > 0) {
        paidCount++;
      }
      if (rem > 0) {
        remainingCount++;
      }
      if (pMode === "credit") {
        creditSum += cost;
        creditCount++;
      }
      if (pMode === "advance" || (paid > 0 && rem > 0)) {
        invoicePaymentsSum += paid;
        invoicePaymentsCount++;
      }
    });

    const paidVal = valueIn(unit, rows, curOf, (r) => {
      const cost = amountOf(r);
      const st = String(r.status || r.bill_status || "").toLowerCase();
      const pMode = String(r.payment_mode || r.paymentMode || "").toLowerCase();
      if (["posted", "accepted", "transferred", "completed"].includes(st) || pMode === "cash") return cost;
      return Number(r.advance_amount || r.advanceAmount || 0);
    }, rateOf);

    const remainingVal = valueIn(unit, rows, curOf, (r) => {
      const cost = amountOf(r);
      const st = String(r.status || r.bill_status || "").toLowerCase();
      const pMode = String(r.payment_mode || r.paymentMode || "").toLowerCase();
      const paid = (["posted", "accepted", "transferred", "completed"].includes(st) || pMode === "cash")
        ? cost
        : Number(r.advance_amount || r.advanceAmount || 0);
      return Math.max(0, cost - paid);
    }, rateOf);

    const invoicePaymentsVal = valueIn(unit, rows, curOf, (r) => {
      const pMode = String(r.payment_mode || r.paymentMode || "").toLowerCase();
      if (pMode === "advance") return Number(r.advance_amount || r.advanceAmount || amountOf(r));
      return Number(r.advance_amount || r.advanceAmount || 0);
    }, rateOf);

    const creditVal = valueIn(unit, rows, curOf, (r) => {
      const pMode = String(r.payment_mode || r.paymentMode || "").toLowerCase();
      return pMode === "credit" ? amountOf(r) : 0;
    }, rateOf);

    // Summary Card 3 metrics
    const supplierSet = new Set<string>();
    const goodsSet = new Set<string>();
    let totalQtyKgs = 0;
    let totalNetWeightKgs = 0;

    rows.forEach((r) => {
      const sName = String(r.supplier_name || r.supplierName || "").trim();
      if (sName) supplierSet.add(sName.toLowerCase());
      const gName = String(r.goods_name || r.goodsName || r.goods_id || "").trim();
      if (gName) goodsSet.add(gName.toLowerCase());
      totalQtyKgs += Number(r.quantity_kgs || r.quantityKgs || r.numbers || 0);
      totalNetWeightKgs += Number(r.net_weight || r.netWeight || r.total_gross_weight || 0);
    });

    const avgInvoiceAmount = rows.length > 0 && totalAmount !== null ? Math.round(totalAmount / rows.length) : null;

    return {
      unit,
      totalAmount,
      paidVal,
      remainingVal,
      invoicePaymentsVal,
      creditVal,
      totalBillsCount: rows.length,
      paidCount,
      remainingCount,
      creditCount,
      invoicePaymentsCount,
      totalSuppliers: supplierSet.size,
      totalGoodsItems: goodsSet.size,
      avgInvoiceAmount,
      totalQtyKgs,
      totalNetWeightKgs,
    };
  }, [filteredPurchases, usdRates]);

  // Dynamic scope label
  const scopeLabel = useMemo(() => {
    if (scopeBranchName && scopeBranchName !== "All Branches") return scopeBranchName;
    if (scopeCountryName && scopeCountryName !== "All Countries") return countryLabel(scopeCountryName, (k, d) => tx( k as any, d));
    if (activeBranch?.name) return activeBranch.name;
    return isSuperAdmin ? tx( "pap.allCountries", "All Countries") : "Main Branch";
  }, [scopeBranchName, scopeCountryName, activeBranch, isSuperAdmin, lang]);

  const pageTitle = useMemo(() => {
    if (scopeBranchName && scopeBranchName !== "All Branches") {
      return `${tx( "nav.local_purchase", "Local Purchase")} - ${scopeBranchName}`;
    }
    if (scopeCountryName && scopeCountryName !== "All Countries") {
      return `${tx( "nav.local_purchase", "Local Purchase")} - ${countryLabel(scopeCountryName, (k, d) => tx( k as any, d))}`;
    }
    return tx( "nav.local_purchase", "Local Purchase");
  }, [scopeBranchName, scopeCountryName, lang]);

  const currentPeriodText = tx( "pap.currentPeriod", "Current Period");

  return (
    <section className="dgt-pa space-y-4" dir={isRtl ? "rtl" : "ltr"} aria-label={pageTitle}>
      {/* ── Top Header: Icon, Titles, Crumbs, and 2 Grouped Dropdowns (Filters & Actions) ── */}
      <div className="dgt-pa-head">
        <div className="dgt-pa-title-icon" aria-hidden="true">
          <FileText />
        </div>
        <div className="dgt-pa-titles">
          <h1>{pageTitle}</h1>
          <div className="dgt-pa-crumbs">
            <span>{tx( "nav.dashboard", "Dashboard")}</span>
            <ChevronRight aria-hidden="true" />
            <span>{tx( "nav.purchase", "Purchase")}</span>
            <ChevronRight aria-hidden="true" />
            <span>{tx( "nav.local_purchase", "Local Purchase")}</span>
          </div>
        </div>

        {/* ── Top Toolbar: Exactly TWO Grouped Dropdowns: FILTERS and ACTIONS ── */}
        <div className="dgt-pa-toolbar">
          {/* Quick-search box on toolbar for instant typing */}
          <div className="dgt-pa-ctrl dgt-pa-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={tx( "lp.search_placeholder", "Search PO#, Supplier, Goods...")}
              aria-label={tx( "common.search", "Search")}
            />
          </div>

          {/* 1. FILTERS Grouped Dropdown */}
          <div className="dgt-pa-pop relative" ref={filtersRef}>
            <button
              type="button"
              onClick={() => {
                setFiltersOpen((prev) => !prev);
                setActionsOpen(false);
              }}
              className={cn(
                "dgt-pa-ctrl",
                activeFiltersCount > 0 && "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
              )}
              aria-expanded={filtersOpen}
              aria-label={tx( "common.filter", "Filters")}
            >
              <Filter aria-hidden="true" />
              <span>{tx( "common.filter", "Filters")}</span>
              {activeFiltersCount > 0 && (
                <span className="ms-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white" dir="ltr">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {filtersOpen && (
              <div
                className="dgt-pa-pop-panel wide shadow-2xl animate-in fade-in"
                style={{ minWidth: "320px", maxWidth: "min(94vw, 420px)" }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-blue-600" />
                    {tx( "common.filter", "Filters")}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={onResetFilters}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {tx( "common.reset", "Reset")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1 text-xs">
                  {/* Supplier filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {tx( "lp.col_supplier_name", "Supplier")}
                    </label>
                    <select
                      value={selectedSupplier}
                      onChange={(e) => onSupplierChange(e.target.value)}
                      className="w-full"
                    >
                      <option value="">{tx( "lp.all_suppliers", "All Suppliers")}</option>
                      {uniqueSuppliers.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Goods filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {tx( "lp.col_goods_name", "Goods")}
                    </label>
                    <select
                      value={selectedGoodsId}
                      onChange={(e) => onGoodsChange(e.target.value)}
                      className="w-full"
                    >
                      <option value="">{tx( "lp.all_goods", "All Goods")}</option>
                      {goodsList.map((g: any) => (
                        <option key={g.id} value={g.id}>
                          {g.goods_name || g.goodsName || g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Country filter (if Super Admin or multiple countries) */}
                  {isSuperAdmin && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {tx( "common.country", "Country")}
                      </label>
                      <select
                        value={selectedCountryId}
                        onChange={(e) => onCountryChange(e.target.value)}
                        className="w-full"
                      >
                        <option value="">{tx( "lp.all_purchases", "All Countries")}</option>
                        {countryOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Branch filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {tx( "common.branch", "Branch")}
                    </label>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => onBranchChange(e.target.value)}
                      className="w-full"
                    >
                      <option value="">{tx( "lp.all_branches", "All Branches")}</option>
                      {countryBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.branchName || b.branch_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {tx( "lp.col_status", "Status")}
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => onStatusChange(e.target.value)}
                      className="w-full"
                    >
                      <option value="all">{tx( "lp.all_purchases", "All Statuses")}</option>
                      <option value="draft">{tx( "lp.draft_bills", "Draft")}</option>
                      <option value="pending">{tx( "lp.pending_bills", "Pending")}</option>
                      <option value="posted">{tx( "lp.col_posted", "Posted")}</option>
                      <option value="accepted">{tx( "lp.posted_accepted", "Accepted")}</option>
                    </select>
                  </div>

                  {/* Payment Mode filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {tx( "lp.reg_payment_mode", "Payment Mode")}
                    </label>
                    <select
                      value={selectedPaymentMode}
                      onChange={(e) => onPaymentModeChange(e.target.value)}
                      className="w-full"
                    >
                      <option value="all">{tx( "lp.all_payment_modes", "All Payment Modes")}</option>
                      <option value="Cash">{tx( "lp.cash", "Cash")}</option>
                      <option value="Bank Transfer">{tx( "lp.bank_transfer", "Bank Transfer")}</option>
                      <option value="Advance">{tx( "lp.advance", "Advance")}</option>
                      <option value="Credit">{tx( "lp.credit", "Credit")}</option>
                    </select>
                  </div>

                  {/* Date range filters */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {tx( "common.date_from", "From Date")}
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => onDateFromChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {tx( "common.date_to", "To Date")}
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => onDateToChange(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="dgt-pa-primary rounded-lg px-3 py-1.5 text-xs font-bold"
                    >
                      {tx( "common.apply", "Apply")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. ACTIONS Grouped Dropdown */}
          <div className="dgt-pa-pop relative" ref={actionsRef}>
            <button
              type="button"
              onClick={() => {
                setActionsOpen((prev) => !prev);
                setFiltersOpen(false);
              }}
              className="dgt-pa-ctrl"
              aria-expanded={actionsOpen}
              aria-label={tx( "pa.actions", "Actions")}
            >
              <MoreVertical aria-hidden="true" />
              <span>{tx( "pa.actions", "Actions")}</span>
            </button>

            {actionsOpen && (
              <div
                className="dgt-pa-pop-panel shadow-2xl animate-in fade-in"
                style={{ minWidth: "220px" }}
              >
                {/* New Local Purchase */}
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    onNewPurchase();
                  }}
                  className="dgt-pa-menu-item text-blue-600 font-black hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  <Plus className="h-4 w-4" />
                  <span>{tx( "lp.create_button", "New Local Purchase")}</span>
                </button>

                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                {/* Print Register */}
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    onPrint();
                  }}
                  className="dgt-pa-menu-item"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  <span>{tx( "common.print", "Print Register")}</span>
                </button>

                {/* Export Excel / CSV */}
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    onExportCsv();
                  }}
                  className="dgt-pa-menu-item"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>{tx( "pap.exportExcel", "Export to Excel / CSV")}</span>
                </button>

                {/* Download PDF */}
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    onExportPdf();
                  }}
                  className="dgt-pa-menu-item"
                >
                  <FileText className="h-4 w-4 text-rose-600" />
                  <span>{tx( "pap.printPdf", "Download PDF Report")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── The THREE Approved Summary Cards (Yellow, Blue, Green) ── */}
      <div className="dgt-pa-cards">
        {/* ── Card 1 (Gold / Yellow): Total Local Purchase ── */}
        <section
          className="dgt-pa-card gold"
          aria-label={tx( "lp.total_local_purchase_bills", "Total Local Purchase")}
        >
          <div className="dgt-pa-card-head">
            <div className="dgt-pa-symbol" aria-hidden="true">
              <ShoppingCart />
            </div>
            <div>
              <div className="dgt-pa-headname">
                {tx( "lp.total_local_purchase_bills", "Total Local Purchase")}
              </div>
              <div className="dgt-pa-sub">{scopeLabel} &mdash; {currentPeriodText}</div>
            </div>
            <span className="dgt-pa-bars" aria-hidden="true">
              <span /><span /><span />
            </span>
          </div>

          <div className="dgt-pa-kps">
            {/* 1. Total Bills */}
            <div className="dgt-pa-kp">
              <div className="dgt-pa-kp-name">{tx( "lp.total_bills", "Total Bills")}</div>
              <div className="dgt-pa-kp-value t-dark" dir="ltr">
                {fmtInt(metrics.totalBillsCount)}
              </div>
              <div className="dgt-pa-kp-note t-dark" dir="ltr">
                {fmtMoney(metrics.unit, metrics.totalAmount)}
              </div>
            </div>

            {/* 2. Paid Amount */}
            <div className="dgt-pa-kp">
              <div className="dgt-pa-kp-name">{tx( "lp.reg_paid", "Paid Amount")}</div>
              <div className="dgt-pa-kp-value t-green" dir="ltr">
                {fmtMoney(metrics.unit, metrics.paidVal)}
              </div>
              <div className="dgt-pa-kp-note t-green" dir="ltr">
                {fmtPct(metrics.paidVal, metrics.totalAmount)
                  ? `${fmtPct(metrics.paidVal, metrics.totalAmount)} ${tx( "lp.reg_paid", "Paid")}`
                  : "—"}
              </div>
            </div>

            {/* 3. Remaining Balance */}
            <div className="dgt-pa-kp">
              <div className="dgt-pa-kp-name">{tx( "lp.remaining_amount", "Remaining Balance")}</div>
              <div className="dgt-pa-kp-value t-red" dir="ltr">
                {fmtMoney(metrics.unit, metrics.remainingVal)}
              </div>
              <div className="dgt-pa-kp-note t-red" dir="ltr">
                {fmtPct(metrics.remainingVal, metrics.totalAmount)
                  ? `${fmtPct(metrics.remainingVal, metrics.totalAmount)} ${tx( "lp.pending_bills", "Pending")}`
                  : "—"}
              </div>
            </div>
          </div>
        </section>

        {/* ── Card 2 (Sky / Blue): Payment Type Breakdown ── */}
        <section
          className="dgt-pa-card sky"
          aria-label={tx( "pap.paymentType", "Payment Type")}
        >
          <div className="dgt-pa-card-head">
            <div className="dgt-pa-symbol" aria-hidden="true">
              <Layers />
            </div>
            <div>
              <div className="dgt-pa-headname">{tx( "pap.paymentType", "Payment Type")}</div>
              <div className="dgt-pa-sub">{scopeLabel} &mdash; {currentPeriodText}</div>
            </div>
            <span className="dgt-pa-bars" aria-hidden="true">
              <span /><span /><span />
            </span>
          </div>

          <div className="dgt-pa-rows">
            {/* 1. Invoices Payment */}
            <div className="dgt-pa-row">
              <span className="dgt-pa-row-icon purple" aria-hidden="true">☰</span>
              <span className="dgt-pa-row-label">{tx( "pap.invoicePayment", "Invoices Payment")}</span>
              <span className="dgt-pa-row-amt t-blue" dir="ltr">{fmtMoney(metrics.unit, metrics.invoicePaymentsVal)}</span>
              <span className="dgt-pa-row-count" dir="ltr">
                {fmtPct(metrics.invoicePaymentsVal, metrics.totalAmount) || "—"}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </div>

            {/* 2. Remaining */}
            <div className="dgt-pa-row">
              <span className="dgt-pa-row-icon blue" aria-hidden="true">▵</span>
              <span className="dgt-pa-row-label">{tx( "pap.remaining", "Remaining")}</span>
              <span className="dgt-pa-row-amt t-blue" dir="ltr">{fmtMoney(metrics.unit, metrics.remainingVal)}</span>
              <span className="dgt-pa-row-count" dir="ltr">
                {fmtPct(metrics.remainingVal, metrics.totalAmount) || "—"}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </div>

            {/* 3. Credit */}
            <div className="dgt-pa-row">
              <span className="dgt-pa-row-icon red" aria-hidden="true">◎</span>
              <span className="dgt-pa-row-label">{tx( "pap.credit", "Credit")}</span>
              <span className="dgt-pa-row-amt t-red" dir="ltr">{fmtMoney(metrics.unit, metrics.creditVal)}</span>
              <span className="dgt-pa-row-count" dir="ltr">
                {fmtPct(metrics.creditVal, metrics.totalAmount) || "—"}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </div>

            {/* 4. Paid Payment */}
            <div className="dgt-pa-row">
              <span className="dgt-pa-row-icon green" aria-hidden="true">✓</span>
              <span className="dgt-pa-row-label">{tx( "pap.paid", "Paid Payment")}</span>
              <span className="dgt-pa-row-amt t-green" dir="ltr">{fmtMoney(metrics.unit, metrics.paidVal)}</span>
              <span className="dgt-pa-row-count" dir="ltr">
                {fmtPct(metrics.paidVal, metrics.totalAmount) || "—"}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </div>
          </div>
        </section>

        {/* ── Card 3 (Mint / Green): Branch Summary / Country Summary ── */}
        <section
          className="dgt-pa-card mint"
          aria-label={tx( "lp.branch_summary", "Branch Summary")}
        >
          <div className="dgt-pa-card-head">
            <div className="dgt-pa-symbol" aria-hidden="true">
              {isSuperAdmin ? <Globe2 /> : <Building2 />}
            </div>
            <div>
              <div className="dgt-pa-headname">
                {isSuperAdmin ? tx( "lp.country_summary", "Country Summary") : tx( "lp.branch_summary", "Branch Summary")}
              </div>
              <div className="dgt-pa-sub">{scopeLabel} &mdash; {currentPeriodText}</div>
            </div>
            <span className="dgt-pa-bars" aria-hidden="true">
              <span /><span /><span />
            </span>
          </div>

          <div className="dgt-pa-rows">
            {/* 1. Total Suppliers */}
            <div className="dgt-pa-row">
              <Users className="h-4 w-4 text-emerald-600 flex-none" />
              <span className="dgt-pa-row-label">{tx( "lp.total_suppliers", "Total Suppliers")}</span>
              <span className="dgt-pa-row-amt t-dark font-mono font-bold" dir="ltr">
                {fmtInt(metrics.totalSuppliers)}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </div>

            {/* 2. Total Goods Items */}
            <div className="dgt-pa-row">
              <Package className="h-4 w-4 text-emerald-600 flex-none" />
              <span className="dgt-pa-row-label">{tx( "lp.total_goods_items", "Total Goods Items")}</span>
              <span className="dgt-pa-row-amt t-dark font-mono font-bold" dir="ltr">
                {fmtInt(metrics.totalGoodsItems)}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </div>

            {/* 3. Avg. Invoice Amount */}
            <div className="dgt-pa-row">
              <Receipt className="h-4 w-4 text-emerald-600 flex-none" />
              <span className="dgt-pa-row-label">{tx( "lp.avg_invoice_amount", "Avg. Invoice Amount")}</span>
              <span className="dgt-pa-row-amt t-dark font-mono font-bold" dir="ltr">
                {metrics.avgInvoiceAmount !== null ? fmtMoney(metrics.unit, metrics.avgInvoiceAmount) : "—"}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </div>

            {/* 4. Total Quantity */}
            <div className="dgt-pa-row">
              <Scale className="h-4 w-4 text-emerald-600 flex-none" />
              <span className="dgt-pa-row-label">{tx( "lp.total_qty", "Total Quantity")}</span>
              <span className="dgt-pa-row-amt t-dark font-mono font-bold" dir="ltr">
                {fmtInt(metrics.totalQtyKgs)} KG
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </div>

            {/* 5. Total Net Weight */}
            <div className="dgt-pa-row">
              <Scale className="h-4 w-4 text-emerald-600 flex-none" />
              <span className="dgt-pa-row-label">{tx( "lp.total_net_weight", "Total Net Weight")}</span>
              <span className="dgt-pa-row-amt t-dark font-mono font-bold" dir="ltr">
                {fmtInt(metrics.totalNetWeightKgs)} KG
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
