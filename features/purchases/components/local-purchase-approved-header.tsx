"use client";

import React, { useMemo, useRef, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  FileText, ChevronRight, Filter, MoreVertical, Search,
  ShoppingCart, Layers, Building2, Globe2, Printer, Download,
  FileSpreadsheet, Plus, RotateCcw, Package, Users, Scale, Receipt,
  Check, X, Calendar, Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { unitFor, valueIn, fmtMoney, fmtInt, fmtPct, type RateOf } from "@/lib/purchase-ui/money-unit";
import { countryLabel } from "@/lib/purchase-ui/country-name";
import { localizeCountryName } from "@/lib/i18n/country-names";
import "@/components/purchase-ui/purchase-approved.css";

function getCountryFlag(nameOrCode?: string): string {
  const s = String(nameOrCode || "").toUpperCase();
  if (s.includes("EMIRATES") || s.includes("UAE") || s === "AE") return "🇦🇪";
  if (s.includes("PAKISTAN") || s === "PK") return "🇵🇰";
  if (s.includes("AFGHANISTAN") || s === "AF") return "🇦🇫";
  if (s.includes("UNITED STATES") || s === "USA" || s === "US") return "🇺🇸";
  if (s.includes("CHINA") || s === "CN") return "🇨🇳";
  if (s.includes("INDIA") || s === "IN") return "🇮🇳";
  if (s.includes("IRAN") || s === "IR") return "🇮🇷";
  if (s.includes("UZBEKISTAN") || s === "UZ") return "🇺🇿";
  if (s.includes("OMAN") || s === "OM") return "🇴🇲";
  return "🌐";
}

export interface DrilldownRow {
  id: string;
  name: string;
  subname?: string;
  icon: ReactNode;
  count: number;
  amount: number;
  percentage: number;
  onSelect: () => void;
}

export interface DrilldownState {
  title: string;
  metricLabel: string;
  metricValue: string;
  scopeBadge: string;
  rows: DrilldownRow[];
}

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
    session?.isGlobalScope ||
    session?.roles?.some?.((r: string) => String(r).toLowerCase().includes("super_admin") || String(r).toLowerCase().includes("global")) ||
    String(session?.role || "").toLowerCase().includes("super_admin")
  );

  const [mounted, setMounted] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);

  const filtersRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Close drill-down drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDrilldown(null);
      }
    }
    if (drilldown) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [drilldown]);

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

    let postedCount = 0;
    let draftCount = 0;
    let pendingCount = 0;

    rows.forEach((r) => {
      const cost = amountOf(r);
      const st = String(r.status || r.bill_status || "").toLowerCase();
      const pMode = String(r.payment_mode || r.paymentMode || "").toLowerCase();
      const isCompleted = ["posted", "accepted", "transferred", "completed"].includes(st);

      if (isCompleted) {
        postedCount++;
      } else if (st === "draft") {
        draftCount++;
      } else {
        pendingCount++;
      }

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
      postedCount,
      draftCount,
      pendingCount,
      totalSuppliers: supplierSet.size,
      totalGoodsItems: goodsSet.size,
      avgInvoiceAmount,
      totalQtyKgs,
      totalNetWeightKgs,
    };
  }, [filteredPurchases, usdRates]);

  // Country breakdown summary
  const countryBreakdownSummary = useMemo(() => {
    const map = new Map<string, { id: string; name: string; flag: string; count: number; totalAmount: number }>();
    (countryOptions || []).forEach((c) => {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        flag: getCountryFlag(c.name || c.code),
        count: 0,
        totalAmount: 0,
      });
    });
    purchases.forEach((p) => {
      const cid = p.country_id || p.countryId;
      const cname = p.country_name || p.countryName;
      const amt = Number(p.final_cost || p.finalCost || p.purchase_cost || p.purchaseCost || 0);
      let entry = cid ? map.get(cid) : undefined;
      if (!entry && cname) {
        for (const it of map.values()) {
          if (it.name.toLowerCase() === cname.toLowerCase()) {
            entry = it;
            break;
          }
        }
      }
      if (!entry) {
        entry = {
          id: cid || cname || "other",
          name: cname || "Other",
          flag: getCountryFlag(cname),
          count: 0,
          totalAmount: 0,
        };
        if (cid) map.set(cid, entry);
      }
      entry.count += 1;
      entry.totalAmount += amt;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || b.totalAmount - a.totalAmount);
  }, [countryOptions, purchases]);

  // Branch breakdown summary
  const branchBreakdownSummary = useMemo(() => {
    const map = new Map<string, { id: string; name: string; countryId?: string; count: number; totalAmount: number }>();
    (countryBranches || []).forEach((b) => {
      map.set(b.id, {
        id: b.id,
        name: b.name || b.branchName || b.branch_name,
        countryId: b.country_id,
        count: 0,
        totalAmount: 0,
      });
    });
    purchases.forEach((p) => {
      if (selectedCountryId && p.country_id !== selectedCountryId && p.countryId !== selectedCountryId) {
        return;
      }
      const bid = p.branch_id || p.branchId;
      const bname = p.branch_name || p.branchName;
      const amt = Number(p.final_cost || p.finalCost || p.purchase_cost || p.purchaseCost || 0);
      let entry = bid ? map.get(bid) : undefined;
      if (!entry && bname) {
        for (const it of map.values()) {
          if (it.name.toLowerCase() === bname.toLowerCase()) {
            entry = it;
            break;
          }
        }
      }
      if (!entry) {
        entry = {
          id: bid || bname || "other",
          name: bname || "Branch",
          countryId: p.country_id || p.countryId,
          count: 0,
          totalAmount: 0,
        };
        if (bid) map.set(bid, entry);
      }
      entry.count += 1;
      entry.totalAmount += amt;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || b.totalAmount - a.totalAmount);
  }, [countryBranches, purchases, selectedCountryId]);

  // Current scope type: "branch" | "country" | "super_admin"
  const currentScopeType = useMemo(() => {
    if (selectedBranchId) return "branch";
    if (selectedCountryId) return "country";
    if (scopeBranchName && scopeBranchName !== "All Branches") return "branch";
    if (scopeCountryName && scopeCountryName !== "All Countries") return "country";
    return isSuperAdmin ? "super_admin" : "country";
  }, [selectedBranchId, selectedCountryId, scopeBranchName, scopeCountryName, isSuperAdmin]);

  // Dynamic scope label
  const scopeLabel = useMemo(() => {
    if (currentScopeType === "branch") {
      const bname = countryBranches.find((b) => String(b.id) === String(selectedBranchId))?.name || scopeBranchName || activeBranch?.name;
      return bname || "Branch";
    }
    if (currentScopeType === "country") {
      const cname = countryOptions.find((c) => String(c.id) === String(selectedCountryId))?.name || scopeCountryName;
      return countryLabel(cname, (k, d) => tx(k as any, d));
    }
    return tx("pap.allCountries", "All Countries");
  }, [currentScopeType, countryBranches, selectedBranchId, scopeBranchName, activeBranch, countryOptions, selectedCountryId, scopeCountryName, lang]);

  const scopeBadgeText = useMemo(() => {
    if (currentScopeType === "branch") {
      return `${tx("common.branch", "Branch")}: ${scopeLabel}`;
    }
    if (currentScopeType === "country") {
      return `${tx("common.country", "Country")}: ${scopeLabel}`;
    }
    return `${tx("pap.allCountries", "All Countries")} (${isSuperAdmin ? "Super Admin" : "Global"})`;
  }, [currentScopeType, scopeLabel, isSuperAdmin, lang]);

  const pageTitle = useMemo(() => {
    if (currentScopeType === "branch") {
      return `${tx("nav.local_purchase", "Local Purchase")} - ${scopeLabel}`;
    }
    if (currentScopeType === "country") {
      return `${tx("nav.local_purchase", "Local Purchase")} - ${scopeLabel}`;
    }
    return tx("nav.local_purchase", "Local Purchase");
  }, [currentScopeType, scopeLabel, lang]);

  const currentPeriodText = tx("pap.currentPeriod", "Current Period");

  // Mini chips in Card 1 for instant sub-breakdown
  const scopeChips = useMemo(() => {
    if (!selectedCountryId && isSuperAdmin) {
      return countryBreakdownSummary.slice(0, 4).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCountryChange(c.id);
          }}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition-all",
            selectedCountryId === c.id
              ? "bg-amber-600 text-white"
              : "bg-amber-200/70 hover:bg-amber-300 text-amber-950 dark:bg-amber-900/40 dark:text-amber-200"
          )}
          title={localizeCountryName(c.name, lang)}
        >
          <span>{c.flag}</span>
          <span>{localizeCountryName(c.name, lang).split(" ")[0]}:</span>
          <span className="font-mono font-black" dir="ltr">{c.count}</span>
        </button>
      ));
    }

    if (selectedCountryId && !selectedBranchId) {
      return branchBreakdownSummary.slice(0, 3).map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBranchChange(b.id);
          }}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition-all",
            selectedBranchId === b.id
              ? "bg-amber-600 text-white"
              : "bg-amber-200/70 hover:bg-amber-300 text-amber-950 dark:bg-amber-900/40 dark:text-amber-200"
          )}
          title={b.name}
        >
          <Building2 className="h-2.5 w-2.5 opacity-70" />
          <span>{b.name.split(" ")[0]}:</span>
          <span className="font-mono font-black" dir="ltr">{b.count}</span>
        </button>
      ));
    }

    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-950 dark:bg-amber-900/40 dark:text-amber-200 text-[11px] font-bold">
        <Building2 className="h-2.5 w-2.5 opacity-70" />
        <span>{scopeLabel}</span>
      </span>
    );
  }, [selectedCountryId, isSuperAdmin, countryBreakdownSummary, branchBreakdownSummary, selectedBranchId, scopeLabel, onCountryChange, onBranchChange]);

  // ── Drilldown Openers ──
  const handleOpenBillsDrilldown = () => {
    if (currentScopeType === "super_admin") {
      const rows: DrilldownRow[] = countryBreakdownSummary.map((c) => ({
        id: c.id,
        name: c.name,
        icon: <span className="text-xl">{c.flag}</span>,
        count: c.count,
        amount: c.totalAmount,
        percentage: metrics.totalBillsCount > 0 ? Math.round((c.count / metrics.totalBillsCount) * 100) : 0,
        onSelect: () => {
          onCountryChange(c.id);
          onBranchChange("");
        },
      }));
      setDrilldown({
        title: tx("lp.total_bills", "Total Bills"),
        metricLabel: tx("lp.total_bills", "Total Bills"),
        metricValue: `${fmtInt(metrics.totalBillsCount)} ${tx("lp.bills_label", "Bills")}`,
        scopeBadge: scopeBadgeText,
        rows,
      });
    } else if (currentScopeType === "country") {
      const rows: DrilldownRow[] = branchBreakdownSummary.map((b) => ({
        id: b.id,
        name: b.name,
        icon: <Building2 className="h-5 w-5 text-blue-600" />,
        count: b.count,
        amount: b.totalAmount,
        percentage: metrics.totalBillsCount > 0 ? Math.round((b.count / metrics.totalBillsCount) * 100) : 0,
        onSelect: () => {
          onBranchChange(b.id);
        },
      }));
      setDrilldown({
        title: tx("lp.total_bills", "Total Bills"),
        metricLabel: tx("lp.total_bills", "Total Bills"),
        metricValue: `${fmtInt(metrics.totalBillsCount)} ${tx("lp.bills_label", "Bills")}`,
        scopeBadge: scopeBadgeText,
        rows,
      });
    } else {
      const supMap = new Map<string, { count: number; amount: number }>();
      filteredPurchases.forEach((p) => {
        const sName = String(p.supplier_name || p.supplierName || "Supplier").trim();
        const amt = Number(p.final_cost || p.finalCost || p.purchase_cost || p.purchaseCost || 0);
        const e = supMap.get(sName) || { count: 0, amount: 0 };
        e.count++;
        e.amount += amt;
        supMap.set(sName, e);
      });
      const rows: DrilldownRow[] = Array.from(supMap.entries()).map(([name, data]) => ({
        id: name,
        name,
        icon: <Users className="h-5 w-5 text-emerald-600" />,
        count: data.count,
        amount: data.amount,
        percentage: metrics.totalBillsCount > 0 ? Math.round((data.count / metrics.totalBillsCount) * 100) : 0,
        onSelect: () => {
          onSupplierChange(name);
        },
      }));
      setDrilldown({
        title: tx("lp.total_bills", "Total Bills"),
        metricLabel: tx("lp.total_bills", "Total Bills"),
        metricValue: `${fmtInt(metrics.totalBillsCount)} ${tx("lp.bills_label", "Bills")}`,
        scopeBadge: scopeBadgeText,
        rows,
      });
    }
  };

  const handleOpenAmountDrilldown = () => {
    if (currentScopeType === "super_admin") {
      const rows: DrilldownRow[] = countryBreakdownSummary.map((c) => ({
        id: c.id,
        name: c.name,
        icon: <span className="text-xl">{c.flag}</span>,
        count: c.count,
        amount: c.totalAmount,
        percentage: metrics.totalAmount && metrics.totalAmount > 0 ? Math.round((c.totalAmount / metrics.totalAmount) * 100) : 0,
        onSelect: () => {
          onCountryChange(c.id);
          onBranchChange("");
        },
      }));
      setDrilldown({
        title: tx("lp.total_final_amount", "Total Final Amount"),
        metricLabel: tx("lp.total_final_amount", "Total Final Amount"),
        metricValue: fmtMoney(metrics.unit, metrics.totalAmount),
        scopeBadge: scopeBadgeText,
        rows,
      });
    } else if (currentScopeType === "country") {
      const rows: DrilldownRow[] = branchBreakdownSummary.map((b) => ({
        id: b.id,
        name: b.name,
        icon: <Building2 className="h-5 w-5 text-blue-600" />,
        count: b.count,
        amount: b.totalAmount,
        percentage: metrics.totalAmount && metrics.totalAmount > 0 ? Math.round((b.totalAmount / metrics.totalAmount) * 100) : 0,
        onSelect: () => {
          onBranchChange(b.id);
        },
      }));
      setDrilldown({
        title: tx("lp.total_final_amount", "Total Final Amount"),
        metricLabel: tx("lp.total_final_amount", "Total Final Amount"),
        metricValue: fmtMoney(metrics.unit, metrics.totalAmount),
        scopeBadge: scopeBadgeText,
        rows,
      });
    } else {
      const supMap = new Map<string, { count: number; amount: number }>();
      filteredPurchases.forEach((p) => {
        const sName = String(p.supplier_name || p.supplierName || "Supplier").trim();
        const amt = Number(p.final_cost || p.finalCost || p.purchase_cost || p.purchaseCost || 0);
        const e = supMap.get(sName) || { count: 0, amount: 0 };
        e.count++;
        e.amount += amt;
        supMap.set(sName, e);
      });
      const rows: DrilldownRow[] = Array.from(supMap.entries()).map(([name, data]) => ({
        id: name,
        name,
        icon: <Users className="h-5 w-5 text-emerald-600" />,
        count: data.count,
        amount: data.amount,
        percentage: metrics.totalAmount && metrics.totalAmount > 0 ? Math.round((data.amount / metrics.totalAmount) * 100) : 0,
        onSelect: () => {
          onSupplierChange(name);
        },
      }));
      setDrilldown({
        title: tx("lp.total_final_amount", "Total Final Amount"),
        metricLabel: tx("lp.total_final_amount", "Total Final Amount"),
        metricValue: fmtMoney(metrics.unit, metrics.totalAmount),
        scopeBadge: scopeBadgeText,
        rows,
      });
    }
  };

  const handleOpenPaymentDrilldown = (mode: string, label: string, val: number | null) => {
    if (currentScopeType === "super_admin") {
      const map = new Map<string, { count: number; amount: number; flag: string; name: string }>();
      countryBreakdownSummary.forEach((c) => {
        map.set(c.id, { count: 0, amount: 0, flag: c.flag, name: c.name });
      });
      filteredPurchases.forEach((p) => {
        const pMode = String(p.payment_mode || p.paymentMode || "").toLowerCase();
        const cost = Number(p.final_cost || p.finalCost || p.purchase_cost || p.purchaseCost || 0);
        const cid = p.country_id || p.countryId;
        const entry = map.get(cid);
        if (entry) {
          if (mode === "credit" && pMode === "credit") {
            entry.count++;
            entry.amount += cost;
          } else if (mode === "advance" && pMode === "advance") {
            entry.count++;
            entry.amount += Number(p.advance_amount || cost);
          } else if (mode === "paid") {
            entry.count++;
            entry.amount += cost;
          } else if (mode === "remaining") {
            entry.count++;
            entry.amount += cost;
          }
        }
      });
      const rows: DrilldownRow[] = Array.from(map.entries()).map(([cid, data]) => ({
        id: cid,
        name: data.name,
        icon: <span className="text-xl">{data.flag}</span>,
        count: data.count,
        amount: data.amount,
        percentage: val && val > 0 ? Math.round((data.amount / val) * 100) : 0,
        onSelect: () => {
          onCountryChange(cid);
          onBranchChange("");
          if (mode === "credit") onPaymentModeChange("Credit");
          else if (mode === "advance") onPaymentModeChange("Advance");
        },
      }));
      setDrilldown({
        title: label,
        metricLabel: label,
        metricValue: fmtMoney(metrics.unit, val),
        scopeBadge: scopeBadgeText,
        rows,
      });
    } else {
      const map = new Map<string, { count: number; amount: number; name: string }>();
      branchBreakdownSummary.forEach((b) => {
        map.set(b.id, { count: 0, amount: 0, name: b.name });
      });
      filteredPurchases.forEach((p) => {
        const pMode = String(p.payment_mode || p.paymentMode || "").toLowerCase();
        const cost = Number(p.final_cost || p.finalCost || p.purchase_cost || p.purchaseCost || 0);
        const bid = p.branch_id || p.branchId;
        const entry = map.get(bid);
        if (entry) {
          if (mode === "credit" && pMode === "credit") {
            entry.count++;
            entry.amount += cost;
          } else if (mode === "advance" && pMode === "advance") {
            entry.count++;
            entry.amount += Number(p.advance_amount || cost);
          } else if (mode === "paid") {
            entry.count++;
            entry.amount += cost;
          } else if (mode === "remaining") {
            entry.count++;
            entry.amount += cost;
          }
        }
      });
      const rows: DrilldownRow[] = Array.from(map.entries()).map(([bid, data]) => ({
        id: bid,
        name: data.name,
        icon: <Building2 className="h-5 w-5 text-blue-600" />,
        count: data.count,
        amount: data.amount,
        percentage: val && val > 0 ? Math.round((data.amount / val) * 100) : 0,
        onSelect: () => {
          onBranchChange(bid);
          if (mode === "credit") onPaymentModeChange("Credit");
          else if (mode === "advance") onPaymentModeChange("Advance");
        },
      }));
      setDrilldown({
        title: label,
        metricLabel: label,
        metricValue: fmtMoney(metrics.unit, val),
        scopeBadge: scopeBadgeText,
        rows,
      });
    }
  };

  const handleOpenSuppliersDrilldown = () => {
    const supMap = new Map<string, { count: number; amount: number }>();
    filteredPurchases.forEach((p) => {
      const sName = String(p.supplier_name || p.supplierName || "Supplier").trim();
      const amt = Number(p.final_cost || p.finalCost || p.purchase_cost || p.purchaseCost || 0);
      const e = supMap.get(sName) || { count: 0, amount: 0 };
      e.count++;
      e.amount += amt;
      supMap.set(sName, e);
    });
    const rows: DrilldownRow[] = Array.from(supMap.entries()).map(([name, data]) => ({
      id: name,
      name,
      icon: <Users className="h-5 w-5 text-emerald-600" />,
      count: data.count,
      amount: data.amount,
      percentage: metrics.totalBillsCount > 0 ? Math.round((data.count / metrics.totalBillsCount) * 100) : 0,
      onSelect: () => {
        onSupplierChange(name);
      },
    }));
    setDrilldown({
      title: tx("lp.total_suppliers", "Total Suppliers"),
      metricLabel: tx("lp.total_suppliers", "Total Suppliers"),
      metricValue: `${fmtInt(metrics.totalSuppliers)}`,
      scopeBadge: scopeBadgeText,
      rows,
    });
  };

  const handleOpenGoodsDrilldown = () => {
    const gMap = new Map<string, { count: number; amount: number; id: string }>();
    filteredPurchases.forEach((p) => {
      const gName = String(p.goods_name || p.goodsName || p.goods_id || "Goods Item").trim();
      const gid = p.goods_id || p.goodsId || gName;
      const amt = Number(p.final_cost || p.finalCost || p.purchase_cost || p.purchaseCost || 0);
      const e = gMap.get(gName) || { count: 0, amount: 0, id: gid };
      e.count++;
      e.amount += amt;
      gMap.set(gName, e);
    });
    const rows: DrilldownRow[] = Array.from(gMap.entries()).map(([name, data]) => ({
      id: data.id,
      name,
      icon: <Package className="h-5 w-5 text-emerald-600" />,
      count: data.count,
      amount: data.amount,
      percentage: metrics.totalBillsCount > 0 ? Math.round((data.count / metrics.totalBillsCount) * 100) : 0,
      onSelect: () => {
        onGoodsChange(data.id);
      },
    }));
    setDrilldown({
      title: tx("lp.total_goods_items", "Total Goods Items"),
      metricLabel: tx("lp.total_goods_items", "Total Goods Items"),
      metricValue: `${fmtInt(metrics.totalGoodsItems)}`,
      scopeBadge: scopeBadgeText,
      rows,
    });
  };

  const handleOpenQtyDrilldown = () => {
    if (currentScopeType === "super_admin") {
      const map = new Map<string, { count: number; amount: number; qty: number; flag: string; name: string }>();
      countryBreakdownSummary.forEach((c) => {
        map.set(c.id, { count: 0, amount: 0, qty: 0, flag: c.flag, name: c.name });
      });
      filteredPurchases.forEach((p) => {
        const cid = p.country_id || p.countryId;
        const entry = map.get(cid);
        if (entry) {
          entry.count++;
          entry.amount += Number(p.final_cost || p.purchase_cost || 0);
          entry.qty += Number(p.quantity_kgs || p.quantityKgs || p.numbers || 0);
        }
      });
      const rows: DrilldownRow[] = Array.from(map.entries()).map(([cid, data]) => ({
        id: cid,
        name: data.name,
        subname: `${fmtInt(data.qty)} KG`,
        icon: <span className="text-xl">{data.flag}</span>,
        count: data.count,
        amount: data.amount,
        percentage: metrics.totalQtyKgs > 0 ? Math.round((data.qty / metrics.totalQtyKgs) * 100) : 0,
        onSelect: () => {
          onCountryChange(cid);
          onBranchChange("");
        },
      }));
      setDrilldown({
        title: tx("lp.total_qty", "Total Quantity"),
        metricLabel: tx("lp.total_qty", "Total Quantity"),
        metricValue: `${fmtInt(metrics.totalQtyKgs)} KG`,
        scopeBadge: scopeBadgeText,
        rows,
      });
    } else {
      const map = new Map<string, { count: number; amount: number; qty: number; name: string }>();
      branchBreakdownSummary.forEach((b) => {
        map.set(b.id, { count: 0, amount: 0, qty: 0, name: b.name });
      });
      filteredPurchases.forEach((p) => {
        const bid = p.branch_id || p.branchId;
        const entry = map.get(bid);
        if (entry) {
          entry.count++;
          entry.amount += Number(p.final_cost || p.purchase_cost || 0);
          entry.qty += Number(p.quantity_kgs || p.quantityKgs || p.numbers || 0);
        }
      });
      const rows: DrilldownRow[] = Array.from(map.entries()).map(([bid, data]) => ({
        id: bid,
        name: data.name,
        subname: `${fmtInt(data.qty)} KG`,
        icon: <Building2 className="h-5 w-5 text-emerald-600" />,
        count: data.count,
        amount: data.amount,
        percentage: metrics.totalQtyKgs > 0 ? Math.round((data.qty / metrics.totalQtyKgs) * 100) : 0,
        onSelect: () => {
          onBranchChange(bid);
        },
      }));
      setDrilldown({
        title: tx("lp.total_qty", "Total Quantity"),
        metricLabel: tx("lp.total_qty", "Total Quantity"),
        metricValue: `${fmtInt(metrics.totalQtyKgs)} KG`,
        scopeBadge: scopeBadgeText,
        rows,
      });
    }
  };

  const handleOpenWeightDrilldown = () => {
    if (currentScopeType === "super_admin") {
      const map = new Map<string, { count: number; amount: number; weight: number; flag: string; name: string }>();
      countryBreakdownSummary.forEach((c) => {
        map.set(c.id, { count: 0, amount: 0, weight: 0, flag: c.flag, name: c.name });
      });
      filteredPurchases.forEach((p) => {
        const cid = p.country_id || p.countryId;
        const entry = map.get(cid);
        if (entry) {
          entry.count++;
          entry.amount += Number(p.final_cost || p.purchase_cost || 0);
          entry.weight += Number(p.net_weight || p.netWeight || p.total_gross_weight || 0);
        }
      });
      const rows: DrilldownRow[] = Array.from(map.entries()).map(([cid, data]) => ({
        id: cid,
        name: data.name,
        subname: `${fmtInt(data.weight)} KG`,
        icon: <span className="text-xl">{data.flag}</span>,
        count: data.count,
        amount: data.amount,
        percentage: metrics.totalNetWeightKgs > 0 ? Math.round((data.weight / metrics.totalNetWeightKgs) * 100) : 0,
        onSelect: () => {
          onCountryChange(cid);
          onBranchChange("");
        },
      }));
      setDrilldown({
        title: tx("lp.total_net_weight", "Total Net Weight"),
        metricLabel: tx("lp.total_net_weight", "Total Net Weight"),
        metricValue: `${fmtInt(metrics.totalNetWeightKgs)} KG`,
        scopeBadge: scopeBadgeText,
        rows,
      });
    } else {
      const map = new Map<string, { count: number; amount: number; weight: number; name: string }>();
      branchBreakdownSummary.forEach((b) => {
        map.set(b.id, { count: 0, amount: 0, weight: 0, name: b.name });
      });
      filteredPurchases.forEach((p) => {
        const bid = p.branch_id || p.branchId;
        const entry = map.get(bid);
        if (entry) {
          entry.count++;
          entry.amount += Number(p.final_cost || p.purchase_cost || 0);
          entry.weight += Number(p.net_weight || p.netWeight || p.total_gross_weight || 0);
        }
      });
      const rows: DrilldownRow[] = Array.from(map.entries()).map(([bid, data]) => ({
        id: bid,
        name: data.name,
        subname: `${fmtInt(data.weight)} KG`,
        icon: <Building2 className="h-5 w-5 text-emerald-600" />,
        count: data.count,
        amount: data.amount,
        percentage: metrics.totalNetWeightKgs > 0 ? Math.round((data.weight / metrics.totalNetWeightKgs) * 100) : 0,
        onSelect: () => {
          onBranchChange(bid);
        },
      }));
      setDrilldown({
        title: tx("lp.total_net_weight", "Total Net Weight"),
        metricLabel: tx("lp.total_net_weight", "Total Net Weight"),
        metricValue: `${fmtInt(metrics.totalNetWeightKgs)} KG`,
        scopeBadge: scopeBadgeText,
        rows,
      });
    }
  };

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
            <span>{tx("nav.dashboard", "Dashboard")}</span>
            <ChevronRight aria-hidden="true" />
            <span>{tx("nav.purchase", "Purchase")}</span>
            <ChevronRight aria-hidden="true" />
            <span>{tx("nav.local_purchase", "Local Purchase")}</span>
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
              placeholder={tx("lp.search_placeholder", "Search PO#, Supplier, Goods...")}
              aria-label={tx("common.search", "Search")}
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
              aria-label={tx("common.filter", "Filters")}
            >
              <Filter aria-hidden="true" />
              <span>{tx("common.filter", "Filters")}</span>
              {activeFiltersCount > 0 && (
                <span className="ms-1 px-1.5 py-0.5 rounded-full text-[11px] font-black bg-blue-600 text-white" dir="ltr">
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
                    {tx("common.filter", "Filters")}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={onResetFilters}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{tx("common.reset", "Reset")}</span>
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
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {tx("lp.col_supplier_name", "Supplier")}
                    </label>
                    <select
                      value={selectedSupplier}
                      onChange={(e) => onSupplierChange(e.target.value)}
                      className="w-full"
                    >
                      <option value="">{tx("lp.all_suppliers", "All Suppliers")}</option>
                      {uniqueSuppliers.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Goods filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {tx("lp.col_goods_name", "Goods")}
                    </label>
                    <select
                      value={selectedGoodsId}
                      onChange={(e) => onGoodsChange(e.target.value)}
                      className="w-full"
                    >
                      <option value="">{tx("lp.all_goods", "All Goods")}</option>
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
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        {tx("common.country", "Country")}
                      </label>
                      <select
                        value={selectedCountryId}
                        onChange={(e) => onCountryChange(e.target.value)}
                        className="w-full"
                      >
                        <option value="">{tx("lp.all_purchases", "All Countries")}</option>
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
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {tx("common.branch", "Branch")}
                    </label>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => onBranchChange(e.target.value)}
                      className="w-full"
                    >
                      <option value="">{tx("lp.all_branches", "All Branches")}</option>
                      {countryBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.branchName || b.branch_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {tx("lp.col_status", "Status")}
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => onStatusChange(e.target.value)}
                      className="w-full"
                    >
                      <option value="all">{tx("lp.all_purchases", "All Statuses")}</option>
                      <option value="draft">{tx("lp.draft_bills", "Draft")}</option>
                      <option value="pending">{tx("lp.pending_bills", "Pending")}</option>
                      <option value="posted">{tx("lp.col_posted", "Posted")}</option>
                      <option value="accepted">{tx("lp.posted_accepted", "Accepted")}</option>
                    </select>
                  </div>

                  {/* Payment Mode filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {tx("lp.reg_payment_mode", "Payment Mode")}
                    </label>
                    <select
                      value={selectedPaymentMode}
                      onChange={(e) => onPaymentModeChange(e.target.value)}
                      className="w-full"
                    >
                      <option value="all">{tx("lp.all_payment_modes", "All Payment Modes")}</option>
                      <option value="Cash">{tx("lp.cash", "Cash")}</option>
                      <option value="Bank Transfer">{tx("lp.bank_transfer", "Bank Transfer")}</option>
                      <option value="Advance">{tx("lp.advance", "Advance")}</option>
                      <option value="Credit">{tx("lp.credit", "Credit")}</option>
                    </select>
                  </div>

                  {/* Date range filters */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        {tx("common.date_from", "From Date")}
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => onDateFromChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        {tx("common.date_to", "To Date")}
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
                      {tx("common.apply", "Apply")}
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
              aria-label={tx("pa.actions", "Actions")}
            >
              <MoreVertical aria-hidden="true" />
              <span>{tx("pa.actions", "Actions")}</span>
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
                  <span>{tx("lp.create_button", "New Local Purchase")}</span>
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
                  <span>{tx("common.print", "Print Register")}</span>
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
                  <span>{tx("pap.exportExcel", "Export to Excel / CSV")}</span>
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
                  <span>{tx("pap.printPdf", "Download PDF Report")}</span>
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
          aria-label={tx("lp.total_local_purchase_bills", "Total Local Purchase")}
        >
          <div className="dgt-pa-card-head">
            <div className="dgt-pa-symbol" aria-hidden="true">
              <ShoppingCart />
            </div>
            <div className="min-w-0 flex-1">
              <div className="dgt-pa-headname">
                {tx("lp.total_local_purchase_bills", "Total Local Purchase")}
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
              <div
                role="button"
                tabIndex={0}
                className="dgt-pa-kp-interactive"
                onClick={handleOpenBillsDrilldown}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOpenBillsDrilldown();
                  }
                }}
                title={tx("common.view", "View")}
              >
                <div className="dgt-pa-kp-name flex items-center justify-between w-full">
                  <span>{tx("lp.total_bills", "Total Bills")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-amber-700 opacity-60 flex-none" />
                </div>
                <div className="dgt-pa-kp-value t-dark flex items-baseline gap-1.5" dir="ltr">
                  <span>{fmtInt(metrics.totalBillsCount)}</span>
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    {tx("lp.bills_label", "Bills")}
                  </span>
                </div>
                {/* Mini scope chips */}
                <div className="flex items-center gap-1 flex-wrap pt-0.5" onClick={(e) => e.stopPropagation()}>
                  {scopeChips}
                </div>
              </div>
            </div>

            {/* 2. Total Final Purchase Amount */}
            <div className="dgt-pa-kp">
              <div
                role="button"
                tabIndex={0}
                className="dgt-pa-kp-interactive"
                onClick={handleOpenAmountDrilldown}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOpenAmountDrilldown();
                  }
                }}
                title={tx("common.view", "View")}
              >
                <div className="dgt-pa-kp-name flex items-center justify-between w-full">
                  <span>{tx("lp.total_final_amount", "Total Final Amount")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-amber-700 opacity-60 flex-none" />
                </div>
                <div className="dgt-pa-kp-value t-dark" dir="ltr">
                  {fmtMoney(metrics.unit, metrics.totalAmount)}
                </div>
                <div className="dgt-pa-kp-note t-dark text-[11px] opacity-80" dir="ltr">
                  {metrics.avgInvoiceAmount !== null
                    ? `${tx("lp.avg_invoice_amount", "Avg")}: ${fmtMoney(metrics.unit, metrics.avgInvoiceAmount)}`
                    : "—"}
                </div>
              </div>
            </div>

            {/* 3. Bill Lifecycle Status: Posted, Draft, Pending */}
            <div className="dgt-pa-kp">
              <div className="dgt-pa-kp-name">
                {tx("lp.col_posting_status", "Bill Status Lifecycle")}
              </div>
              <div className="dgt-pa-status-pills">
                {/* Posted */}
                <button
                  type="button"
                  onClick={() => onStatusChange(selectedStatus === "posted" ? "all" : "posted")}
                  className={cn(
                    "dgt-pa-status-pill posted",
                    selectedStatus === "posted" && "active"
                  )}
                  title={tx("lp.posted_accepted", "Posted")}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 flex-none" />
                    <span className="truncate">{tx("lp.posted_accepted", "Posted")}</span>
                  </span>
                  <span className="font-mono font-black flex-none" dir="ltr">
                    {fmtInt(metrics.postedCount)}
                  </span>
                </button>

                {/* Draft */}
                <button
                  type="button"
                  onClick={() => onStatusChange(selectedStatus === "draft" ? "all" : "draft")}
                  className={cn(
                    "dgt-pa-status-pill draft",
                    selectedStatus === "draft" && "active"
                  )}
                  title={tx("lp.draft_bills", "Draft")}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="h-2 w-2 rounded-full bg-amber-500 flex-none" />
                    <span className="truncate">{tx("lp.draft_bills", "Draft")}</span>
                  </span>
                  <span className="font-mono font-black flex-none" dir="ltr">
                    {fmtInt(metrics.draftCount)}
                  </span>
                </button>

                {/* Pending */}
                <button
                  type="button"
                  onClick={() => onStatusChange(selectedStatus === "pending" ? "all" : "pending")}
                  className={cn(
                    "dgt-pa-status-pill pending",
                    selectedStatus === "pending" && "active"
                  )}
                  title={tx("lp.pending_bills", "Pending")}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="h-2 w-2 rounded-full bg-rose-500 flex-none" />
                    <span className="truncate">{tx("lp.pending_bills", "Pending")}</span>
                  </span>
                  <span className="font-mono font-black flex-none" dir="ltr">
                    {fmtInt(metrics.pendingCount)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Card 2 (Sky / Blue): Payment Type Breakdown ── */}
        <section
          className="dgt-pa-card sky"
          aria-label={tx("pap.paymentType", "Payment Type")}
        >
          <div className="dgt-pa-card-head">
            <div className="dgt-pa-symbol" aria-hidden="true">
              <Layers />
            </div>
            <div>
              <div className="dgt-pa-headname">{tx("pap.paymentType", "Payment Type")}</div>
              <div className="dgt-pa-sub">{scopeLabel} &mdash; {currentPeriodText}</div>
            </div>
            <span className="dgt-pa-bars" aria-hidden="true">
              <span /><span /><span />
            </span>
          </div>

          <div className="dgt-pa-rows">
            {/* 1. Invoices Payment */}
            <button
              type="button"
              onClick={() => handleOpenPaymentDrilldown("advance", tx("pap.invoicePayment", "Invoices Payment"), metrics.invoicePaymentsVal)}
              className="dgt-pa-row"
            >
              <span className="dgt-pa-row-icon purple" aria-hidden="true">☰</span>
              <span className="dgt-pa-row-label">{tx("pap.invoicePayment", "Invoices Payment")}</span>
              <span className="dgt-pa-row-amt t-blue" dir="ltr">{fmtMoney(metrics.unit, metrics.invoicePaymentsVal)}</span>
              <span className="dgt-pa-row-count" dir="ltr">
                {fmtPct(metrics.invoicePaymentsVal, metrics.totalAmount) || "—"}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </button>

            {/* 2. Remaining */}
            <button
              type="button"
              onClick={() => handleOpenPaymentDrilldown("remaining", tx("pap.remaining", "Remaining"), metrics.remainingVal)}
              className="dgt-pa-row"
            >
              <span className="dgt-pa-row-icon blue" aria-hidden="true">▵</span>
              <span className="dgt-pa-row-label">{tx("pap.remaining", "Remaining")}</span>
              <span className="dgt-pa-row-amt t-blue" dir="ltr">{fmtMoney(metrics.unit, metrics.remainingVal)}</span>
              <span className="dgt-pa-row-count" dir="ltr">
                {fmtPct(metrics.remainingVal, metrics.totalAmount) || "—"}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </button>

            {/* 3. Credit */}
            <button
              type="button"
              onClick={() => handleOpenPaymentDrilldown("credit", tx("pap.credit", "Credit"), metrics.creditVal)}
              className="dgt-pa-row"
            >
              <span className="dgt-pa-row-icon red" aria-hidden="true">◎</span>
              <span className="dgt-pa-row-label">{tx("pap.credit", "Credit")}</span>
              <span className="dgt-pa-row-amt t-red" dir="ltr">{fmtMoney(metrics.unit, metrics.creditVal)}</span>
              <span className="dgt-pa-row-count" dir="ltr">
                {fmtPct(metrics.creditVal, metrics.totalAmount) || "—"}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </button>

            {/* 4. Paid Payment */}
            <button
              type="button"
              onClick={() => handleOpenPaymentDrilldown("paid", tx("pap.paid", "Paid Payment"), metrics.paidVal)}
              className="dgt-pa-row"
            >
              <span className="dgt-pa-row-icon green" aria-hidden="true">✓</span>
              <span className="dgt-pa-row-label">{tx("pap.paid", "Paid Payment")}</span>
              <span className="dgt-pa-row-amt t-green" dir="ltr">{fmtMoney(metrics.unit, metrics.paidVal)}</span>
              <span className="dgt-pa-row-count" dir="ltr">
                {fmtPct(metrics.paidVal, metrics.totalAmount) || "—"}
              </span>
              <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
            </button>
          </div>
        </section>

        {/* ── Card 3 (Mint / Green): Branch Summary / Country Summary ── */}
        <section
          className="dgt-pa-card mint"
          aria-label={currentScopeType === "super_admin" ? tx("lp.countries_label", "Country Summary") : tx("common.branch", "Branch Summary")}
        >
          <div className="dgt-pa-card-head">
            <div className="dgt-pa-symbol" aria-hidden="true">
              {currentScopeType === "super_admin" ? <Globe2 /> : <Building2 />}
            </div>
            <div>
              <div className="dgt-pa-headname">
                {currentScopeType === "super_admin"
                  ? `${tx("lp.countries_label", "Country")} ${tx("lp.summary_word", "Summary")}`
                  : `${tx("common.branch", "Branch")} ${tx("lp.summary_word", "Summary")}`}
              </div>
              <div className="dgt-pa-sub">{scopeLabel} &mdash; {currentPeriodText}</div>
            </div>
            <span className="dgt-pa-bars" aria-hidden="true">
              <span /><span /><span />
            </span>
          </div>

          <div className="dgt-pa-rows">
            {currentScopeType === "super_admin" ? (
              countryBreakdownSummary.slice(0, 4).map((c) => {
                const isSelected = selectedCountryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onCountryChange("");
                        onBranchChange("");
                      } else {
                        onCountryChange(c.id);
                        onBranchChange("");
                      }
                    }}
                    className={cn(
                      "dgt-pa-row",
                      isSelected && "bg-emerald-100/70 dark:bg-emerald-950/50 font-bold"
                    )}
                    title={localizeCountryName(c.name, lang)}
                  >
                    <span className="text-base flex-none leading-none">{c.flag}</span>
                    <span className="dgt-pa-row-label">{localizeCountryName(c.name, lang)}</span>
                    <span className="dgt-pa-row-amt t-green font-mono font-bold" dir="ltr">
                      {c.totalAmount > 0 ? fmtMoney(metrics.unit, c.totalAmount) : "—"}
                    </span>
                    <span className="dgt-pa-row-count" dir="ltr">
                      {c.count} {tx("lp.bills_label", "Bills")}
                    </span>
                    <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
                  </button>
                );
              })
            ) : currentScopeType === "country" ? (
              branchBreakdownSummary.slice(0, 4).map((b) => {
                const isSelected = selectedBranchId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onBranchChange("");
                      } else {
                        onBranchChange(b.id);
                      }
                    }}
                    className={cn(
                      "dgt-pa-row",
                      isSelected && "bg-emerald-100/70 dark:bg-emerald-950/50 font-bold"
                    )}
                    title={b.name}
                  >
                    <Building2 className="h-4 w-4 text-emerald-600 flex-none" />
                    <span className="dgt-pa-row-label">{b.name}</span>
                    <span className="dgt-pa-row-amt t-green font-mono font-bold" dir="ltr">
                      {b.totalAmount > 0 ? fmtMoney(metrics.unit, b.totalAmount) : "—"}
                    </span>
                    <span className="dgt-pa-row-count" dir="ltr">
                      {b.count} {tx("lp.bills_label", "Bills")}
                    </span>
                    <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
                  </button>
                );
              })
            ) : (
              <>
                {/* 1. Total Suppliers */}
                <button
                  type="button"
                  onClick={handleOpenSuppliersDrilldown}
                  className="dgt-pa-row"
                >
                  <Users className="h-4 w-4 text-emerald-600 flex-none" />
                  <span className="dgt-pa-row-label">{tx("lp.total_suppliers", "Total Suppliers")}</span>
                  <span className="dgt-pa-row-amt t-dark font-mono font-bold" dir="ltr">
                    {fmtInt(metrics.totalSuppliers)}
                  </span>
                  <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
                </button>

                {/* 2. Total Goods Items */}
                <button
                  type="button"
                  onClick={handleOpenGoodsDrilldown}
                  className="dgt-pa-row"
                >
                  <Package className="h-4 w-4 text-emerald-600 flex-none" />
                  <span className="dgt-pa-row-label">{tx("lp.total_goods_items", "Total Goods Items")}</span>
                  <span className="dgt-pa-row-amt t-dark font-mono font-bold" dir="ltr">
                    {fmtInt(metrics.totalGoodsItems)}
                  </span>
                  <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
                </button>

                {/* 3. Avg. Invoice Amount */}
                <button
                  type="button"
                  onClick={handleOpenAmountDrilldown}
                  className="dgt-pa-row"
                >
                  <Receipt className="h-4 w-4 text-emerald-600 flex-none" />
                  <span className="dgt-pa-row-label">{tx("lp.avg_invoice_amount", "Avg. Invoice Amount")}</span>
                  <span className="dgt-pa-row-amt t-dark font-mono font-bold" dir="ltr">
                    {metrics.avgInvoiceAmount !== null ? fmtMoney(metrics.unit, metrics.avgInvoiceAmount) : "—"}
                  </span>
                  <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
                </button>

                {/* 4. Total Quantity */}
                <button
                  type="button"
                  onClick={handleOpenQtyDrilldown}
                  className="dgt-pa-row"
                >
                  <Scale className="h-4 w-4 text-emerald-600 flex-none" />
                  <span className="dgt-pa-row-label">{tx("lp.total_qty", "Total Quantity")}</span>
                  <span className="dgt-pa-row-amt t-dark font-mono font-bold" dir="ltr">
                    {fmtInt(metrics.totalQtyKgs)} KG
                  </span>
                  <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      {/* ── Slide-over Drill-Down Drawer ("پردہ") rendered via Portal to document.body ── */}
      {mounted && drilldown && createPortal(
        <>
          <div
            className="dgt-pa-drawer-backdrop"
            onClick={() => setDrilldown(null)}
            aria-hidden="true"
          />
          <aside
            className="dgt-pa-drawer"
            dir={isRtl ? "rtl" : "ltr"}
            role="dialog"
            aria-modal="true"
            aria-label={drilldown.title}
          >
            {/* Drawer Header */}
            <div className="dgt-pa-drawer-head">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black uppercase tracking-wider text-blue-200">
                  {drilldown.scopeBadge}
                </div>
                <div className="text-base font-extrabold text-white mt-0.5 truncate">
                  {drilldown.title}
                </div>
                <div className="text-xs font-mono font-bold text-blue-100/90 mt-0.5" dir="ltr">
                  {drilldown.metricValue}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrilldown(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label={tx("common.close", "Close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body: list of cards */}
            <div className="dgt-pa-drawer-body">
              {drilldown.rows.length === 0 ? (
                <div className="dgt-pa-empty text-center py-8">
                  {tx("common.no_records", "No breakdown records available.")}
                </div>
              ) : (
                drilldown.rows.map((row) => (
                  <div key={row.id} className="dgt-pa-drawer-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-none">{row.icon}</span>
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs truncate">
                            {row.name}
                          </div>
                          {row.subname && (
                            <div className="text-[11px] text-slate-500 truncate">
                              {row.subname}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-end flex-none">
                        <div className="text-xs font-black font-mono" dir="ltr">
                          {fmtMoney(metrics.unit, row.amount)}
                        </div>
                        <div className="text-[11px] text-slate-500" dir="ltr">
                          {fmtInt(row.count)} {tx("lp.bills_label", "Bills")}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, row.percentage))}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 flex-none" dir="ltr">
                        {row.percentage}%
                      </span>
                    </div>

                    {/* Action button */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          row.onSelect();
                          setDrilldown(null);
                        }}
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Eye className="h-3 w-3" />
                        <span>{tx("common.view", "View")} {tx("lp.bills_label", "Bills")}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer */}
            <div className="dgt-pa-drawer-foot">
              <button
                type="button"
                onClick={() => {
                  onResetFilters();
                  setDrilldown(null);
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{tx("common.reset", "Reset Filters")}</span>
              </button>
              <button
                type="button"
                onClick={() => setDrilldown(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                {tx("common.close", "Close")}
              </button>
            </div>
          </aside>
        </>,
        document.body
      )}
    </section>
  );
}
