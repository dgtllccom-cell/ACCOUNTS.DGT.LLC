"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Printer,
  Eye,
  Pencil,
  MoreVertical,
  Globe2,
  Building2,
  Users,
  Package,
  Receipt,
  Scale,
  Check,
  X,
  Download,
  RefreshCw,
  ArrowLeft,
  Layers,
  CreditCard,
  Wallet,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";

export interface LocalPurchaseTransferPaymentViewProps {
  session?: any;
  goodsList?: any[];
  countryBranches?: any[];
  cityBranches?: any[];
  companies?: any[];
  countries?: any[];
}

type PaymentOptionCategory = "invoice" | "credit" | "final" | "cash";

interface ResolvedPaymentMeta {
  category: PaymentOptionCategory;
  optionLabel: string;
  destinationLabel: string;
  pillClass: string;
  totalPayment: number;
  actualPaid: number;
  balance: number;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function deriveCountryCode(countryName?: string | null, isoCode?: string | null): string {
  const iso = String(isoCode || "").trim().toUpperCase();
  if (iso && iso.length <= 3) return iso;
  const s = String(countryName || "").trim().toUpperCase();
  if (!s) return "AE";
  if (s.includes("EMIRATES") || s.includes("UAE") || s === "AE") return "AE";
  if (s.includes("PAKISTAN") || s === "PK") return "PK";
  if (s.includes("AFGHANISTAN") || s === "AF") return "AF";
  if (s.includes("IRAN") || s === "IR") return "IR";
  if (s.includes("INDIA") || s === "IN") return "IN";
  if (s.includes("CHINA") || s === "CN") return "CN";
  if (s.includes("OMAN") || s === "OM") return "OM";
  if (s.includes("UZBEKISTAN") || s === "UZ") return "UZ";
  if (s.includes("TAJIKISTAN") || s === "TJ") return "TJ";
  if (s.includes("TURKEY") || s === "TR") return "TR";
  return s.slice(0, 2);
}

function deriveBranchCode(row: any, countryCode: string): string {
  const rawCode = String(row.city_branch_code || row.branch_code || "").trim().toUpperCase();
  if (rawCode) {
    if (rawCode.startsWith(countryCode + "-")) return rawCode;
    if (/^[A-Z]{2}-\d+/.test(rawCode)) return rawCode;
    return `${countryCode}-${rawCode}`;
  }
  return `${countryCode}-001`;
}

function formatBillNo(row: any, indexFallback?: number): string {
  // Do not display Invoice Number or transaction Reference in this register;
  // show the original Bill / Entry No.
  const candidates = [
    row.bill_no,
    row.entry_serial,
    row.branch_serial_no,
    row.branch_serial,
    row.country_serial_no,
    row.country_serial,
    row.super_admin_serial,
    row.journal_serial_no,
  ];
  for (const c of candidates) {
    const val = String(c || "").trim();
    if (val) return val;
  }
  const idStr = String(row.id || "").replace(/[^0-9a-f]/gi, "");
  if (idStr.length >= 4) {
    const num = (parseInt(idStr.slice(-4), 16) % 9000) + 1000;
    return `LP-${String(num).padStart(4, "0")}`;
  }
  return `LP-${String((indexFallback ?? 0) + 1).padStart(4, "0")}`;
}

function formatDisplayDate(raw?: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoneyAmount(currency: string, amount: number): string {
  const cur = String(currency || "AED").trim().toUpperCase() || "AED";
  const rounded = Math.round((Number(amount) || 0) * 100) / 100;
  const hasDecimals = Math.abs(rounded % 1) > 0.001;
  return `${cur} ${rounded.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function resolvePaymentMeta(row: any): ResolvedPaymentMeta {
  const totalPayment = Math.max(0, toNum(row.final_cost ?? row.finalCost ?? row.purchase_cost ?? row.purchaseCost));
  const rawMode = String(row.payment_mode ?? row.paymentMode ?? "Cash").trim();
  const modeLower = rawMode.toLowerCase();
  const latestKind = String(row.latest_payment_kind || "").toLowerCase();
  const statusLower = String(row.status || row.bill_status || "draft").toLowerCase();
  const isPosted = ["posted", "accepted", "transferred", "completed", "paid"].includes(statusLower);

  // Determine actual posted paid amount (never treat a bill transfer or credit allocation as paid money)
  let actualPaid = 0;
  if (row.paid_amount !== undefined && row.paid_amount !== null) {
    actualPaid = Math.min(totalPayment, Math.max(0, toNum(row.paid_amount)));
  } else if (toNum(row.posted_payment_count) > 0) {
    actualPaid = Math.min(totalPayment, Math.max(0, toNum(row.posted_paid_amount)));
  } else if (modeLower.includes("credit")) {
    actualPaid = 0;
  } else if (
    modeLower.includes("advance") ||
    modeLower.includes("invoice") ||
    modeLower.includes("final") ||
    modeLower.includes("remaining")
  ) {
    const advAmt = Math.max(0, toNum(row.advance_amount ?? row.advanceAmount));
    actualPaid = isPosted && advAmt > 0 ? Math.min(totalPayment, advAmt) : 0;
  } else if (modeLower.includes("cash") || modeLower.includes("bank") || modeLower.includes("hawala")) {
    actualPaid = isPosted && Boolean(row.roznamcha_entry_id) ? totalPayment : 0;
  }

  const balance = Math.max(0, totalPayment - actualPaid);

  // Classify option & destination
  if (modeLower.includes("credit") || latestKind === "credit") {
    return {
      category: "credit",
      optionLabel: "Credit",
      destinationLabel: "Credit Payment",
      pillClass: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
      totalPayment,
      actualPaid,
      balance,
    };
  }

  if (
    modeLower.includes("final") ||
    modeLower.includes("remaining") ||
    latestKind === "remaining" ||
    latestKind === "final"
  ) {
    return {
      category: "final",
      optionLabel: "Final Payment",
      destinationLabel: "Final Payment",
      pillClass: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
      totalPayment,
      actualPaid,
      balance,
    };
  }

  if (modeLower.includes("advance") || modeLower.includes("invoice") || latestKind === "advance") {
    return {
      category: "invoice",
      optionLabel: "Invoice Payment",
      destinationLabel: "Invoice Payment",
      pillClass: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
      totalPayment,
      actualPaid,
      balance,
    };
  }

  if (modeLower.includes("bank")) {
    return {
      category: "cash",
      optionLabel: "Bank Transfer",
      destinationLabel: "Bank / Cheque Roznamcha",
      pillClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
      totalPayment,
      actualPaid,
      balance,
    };
  }

  if (modeLower.includes("hawala")) {
    return {
      category: "cash",
      optionLabel: "Hawala / Transfer",
      destinationLabel: "Hawala Roznamcha",
      pillClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
      totalPayment,
      actualPaid,
      balance,
    };
  }

  return {
    category: "cash",
    optionLabel: "Cash",
    destinationLabel: "Cash Roznamcha",
    pillClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    totalPayment,
    actualPaid,
    balance,
  };
}

export function LocalPurchaseTransferPaymentView({
  session,
  goodsList = [],
  countryBranches = [],
  cityBranches = [],
  countries = [],
}: LocalPurchaseTransferPaymentViewProps) {
  const { lang, isRtl } = useErpScreen("lp_transfer");
  const tr = useCallback((label: string) => translateHeader(lang, label), [lang]);
  const searchParams = useSearchParams();
  const highlightBillId = searchParams?.get("billId") || searchParams?.get("highlight") || "";

  // Role detection: each user sees only one set of three cards for their signed-in role and permitted scope.
  const roleTier = useMemo<"super_admin" | "country_admin" | "branch_admin">(() => {
    if (!session) return "super_admin";
    const roles: string[] = Array.isArray(session.roles) ? session.roles.map(String) : [];
    const primaryRole = String(session.role || session.user?.role || "").toLowerCase();
    if (
      session.isSuperAdmin ||
      session.scopes?.isSuperAdmin ||
      roles.includes("super_admin") ||
       roles.includes("business_super_admin") ||
      primaryRole === "super_admin"
    ) {
      return "super_admin";
    }
    if (
      roles.includes("country_admin") ||
      roles.includes("country_manager") ||
      roles.includes("country_user") ||
      primaryRole.includes("country") ||
      ((session.countryIds?.length ?? 0) > 0 &&
        (session.cityBranchIds?.length ?? 0) === 0 &&
        (session.countryBranchIds?.length ?? 0) === 0)
    ) {
      return "country_admin";
    }
    return "branch_admin";
  }, [session]);

  const canEditBill = roleTier === "super_admin" || roleTier === "country_admin";

  // Data state
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState<string>("all");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [selectedPaymentCategory, setSelectedPaymentCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Super Admin country-to-branch drilldown state inside Card 3
  const [drilledCountryId, setDrilledCountryId] = useState<string | null>(null);

  // Popovers & Menus
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);

  const filterRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Modals (View Bill, Edit Bill, Print A4)
  const [viewingBill, setViewingBill] = useState<any | null>(null);
  const [editingBill, setEditingBill] = useState<any | null>(null);
  const [printingBill, setPrintingBill] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    goodsName: "",
    supplierName: "",
    purchaseAccountNo: "",
    salesAccountNo: "",
    quantityName: "Cartons",
    numbers: "",
    totalGrossWeight: "",
    emptyKgs: "",
    netWeight: "",
    purchaseRate: "",
    localCurrency: "AED",
    paymentMode: "Cash",
    advanceAmount: "",
    contractNo: "",
    remarks: "",
  });

  // Pagination
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/purchases/local-purchase?lang=${encodeURIComponent(lang)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || "Failed to load Local Purchase Transfer Register.");
      }
      const list = Array.isArray(json.data) ? json.data : [];
      setRows(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) {
        setFilterOpen(false);
      }
      if (actionsRef.current && !actionsRef.current.contains(target)) {
        setActionsOpen(false);
      }
      if (!(target as HTMLElement)?.closest?.("[data-row-action-menu]")) {
        setOpenRowMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Transferred / Posted bills for the Transfer Payment Register
  // When a Local Purchase bill is transferred, it appears here automatically.
  // If all rows in a dev environment are draft, we still include them if status filter is 'all' and no posted rows exist,
  // or show all Local Purchase bills with their accurate Posting & Transfer status counts.
  const enrichedRows = useMemo(() => {
    return rows.map((r, idx) => {
      const countryCode = deriveCountryCode(r.country_name, r.country_code);
      const branchCode = deriveBranchCode(r, countryCode);
      const billNo = formatBillNo(r, rows.length - 1 - idx);
      const paymentMeta = resolvePaymentMeta(r);
      const currency = String(r.local_currency || r.purchase_currency || "AED").trim().toUpperCase() || "AED";
      const qty = toNum(r.numbers || r.quantity_kgs);
      const unit = String(r.quantity_name || "Cartons").trim() || "Cartons";
      const grossKg = toNum(r.total_gross_weight || r.quantity_kgs);
      const netKg = toNum(r.net_weight || r.total_gross_weight);

      return {
        ...r,
        _billNo: billNo,
        _countryCode: countryCode,
        _branchCode: branchCode,
        _currency: currency,
        _qty: qty,
        _unit: unit,
        _grossKg: grossKg,
        _netKg: netKg,
        _drName: r.purchase_account_name || "Purchase Inventory",
        _drCode: r.purchase_account_code || "DR-001",
        _crName: r.sales_account_name || r.supplier_name || "Local Supplier",
        _crCode: r.sales_account_code || "CR-101",
        _paymentMeta: paymentMeta,
      };
    });
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return enrichedRows.filter((r) => {
      if (selectedCountryId !== "all" && String(r.country_id || "") !== selectedCountryId) {
        return false;
      }
      if (
        selectedBranchId !== "all" &&
        String(r.country_branch_id || "") !== selectedBranchId &&
        String(r.city_branch_id || "") !== selectedBranchId
      ) {
        return false;
      }
      if (selectedPaymentCategory !== "all" && r._paymentMeta.category !== selectedPaymentCategory) {
        return false;
      }
      if (selectedStatus !== "all") {
        const st = String(r.status || "draft").toLowerCase();
        if (selectedStatus === "posted" && !["posted", "accepted", "transferred", "paid"].includes(st)) {
          return false;
        }
        if (selectedStatus === "draft" && st !== "draft") {
          return false;
        }
        if (selectedStatus === "pending" && ["posted", "accepted", "transferred", "paid", "draft"].includes(st)) {
          return false;
        }
      }
      if (dateFrom) {
        const d = String(r.transfer_date || r.created_at || "").slice(0, 10);
        if (d && d < dateFrom) return false;
      }
      if (dateTo) {
        const d = String(r.transfer_date || r.created_at || "").slice(0, 10);
        if (d && d > dateTo) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = [
          r._billNo,
          r._countryCode,
          r._branchCode,
          r._drName,
          r._drCode,
          r._crName,
          r._crCode,
          r.goods_name,
          r.supplier_name,
          r._paymentMeta.optionLabel,
          r._paymentMeta.destinationLabel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    enrichedRows,
    selectedCountryId,
    selectedBranchId,
    selectedPaymentCategory,
    selectedStatus,
    dateFrom,
    dateTo,
    searchQuery,
  ]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCountryId, selectedBranchId, selectedPaymentCategory, selectedStatus, dateFrom, dateTo]);

  // Scope Subtitle for the 3 top cards
  const scopeSubtitle = useMemo(() => {
    if (roleTier === "super_admin") {
      if (selectedCountryId !== "all") {
        const c = countries.find((x: any) => String(x.id) === selectedCountryId);
        const code = deriveCountryCode(c?.name, c?.iso_code);
        return `${code} — ${tr("Authorized branches — Current period")}`;
      }
      return tr("All authorized countries — Current period");
    }
    if (roleTier === "country_admin") {
      const firstCountry = countries[0] || countryBranches[0];
      const code = deriveCountryCode(
        firstCountry?.name || firstCountry?.country_name,
        firstCountry?.iso_code || firstCountry?.country_code
      );
      return `${code} — ${tr("Authorized branches — Current period")}`;
    }
    // branch_admin
    const firstBranch = cityBranches[0] || countryBranches[0];
    const cCode = deriveCountryCode(firstBranch?.country_name, firstBranch?.country_code);
    const bCode = firstBranch?.code
      ? String(firstBranch.code).toUpperCase().startsWith(cCode)
        ? String(firstBranch.code).toUpperCase()
        : `${cCode}-${String(firstBranch.code).toUpperCase()}`
      : enrichedRows[0]?._branchCode || `${cCode}-001`;
    return `${bCode} — ${tr("Current period")}`;
  }, [roleTier, selectedCountryId, countries, countryBranches, cityBranches, enrichedRows, tr]);

  // Dashboard Metrics for the 3 Approved Top Cards
  const dashboardMetrics = useMemo(() => {
    const primaryCurrency =
      filteredRows[0]?._currency ||
      enrichedRows[0]?._currency ||
      (roleTier === "branch_admin" || roleTier === "country_admin" ? "AED" : "AED");

    let totalFinalAmount = 0;
    let postedAcceptedCount = 0;
    let draftCount = 0;
    let pendingCount = 0;

    let invoiceOptionTotal = 0;
    let remainingOptionTotal = 0;
    let creditOptionTotal = 0;
    let paidOptionTotal = 0;

    let actualPaidTotal = 0;
    let balanceTotal = 0;

    const suppliersSet = new Set<string>();
    const goodsSet = new Set<string>();
    const unitTotals = new Map<string, number>();

    filteredRows.forEach((r) => {
      const amt = r._paymentMeta.totalPayment;
      totalFinalAmount += amt;
      actualPaidTotal += r._paymentMeta.actualPaid;
      balanceTotal += r._paymentMeta.balance;

      const st = String(r.status || "draft").toLowerCase();
      if (["posted", "accepted", "transferred", "paid", "completed"].includes(st)) {
        postedAcceptedCount++;
      } else if (st === "draft") {
        draftCount++;
      } else {
        pendingCount++;
      }

      if (r._paymentMeta.category === "invoice") {
        invoiceOptionTotal += amt;
      } else if (r._paymentMeta.category === "final") {
        remainingOptionTotal += amt;
      } else if (r._paymentMeta.category === "credit") {
        creditOptionTotal += amt;
      } else {
        paidOptionTotal += amt;
      }

      if (r._crName) suppliersSet.add(String(r._crName).toLowerCase());
      if (r.goods_name) goodsSet.add(String(r.goods_name).toLowerCase());
      const u = r._unit || "Cartons";
      unitTotals.set(u, (unitTotals.get(u) || 0) + r._qty);
    });

    const totalBills = filteredRows.length;
    const avgBillAmount = totalBills > 0 ? totalFinalAmount / totalBills : 0;

    const pct = (part: number) => (totalFinalAmount > 0 ? Math.round((part / totalFinalAmount) * 100) : 0);

    // Format total quantity summary for Branch Admin card
    let totalQuantityLabel = "0";
    if (unitTotals.size === 1) {
      const [[u, q]] = Array.from(unitTotals.entries());
      totalQuantityLabel = `${q.toLocaleString("en-US")} ${u}`;
    } else if (unitTotals.size > 1) {
      totalQuantityLabel = Array.from(unitTotals.entries())
        .map(([u, q]) => `${q.toLocaleString("en-US")} ${u}`)
        .join(" • ");
    }

    // Country breakdown for Super Admin
    const countryMap = new Map<
      string,
      { id: string; code: string; name: string; count: number; amount: number; currency: string }
    >();
    countries.forEach((c: any) => {
      const code = deriveCountryCode(c.name, c.iso_code);
      countryMap.set(String(c.id), {
        id: String(c.id),
        code,
        name: c.name || code,
        count: 0,
        amount: 0,
        currency: primaryCurrency,
      });
    });
    enrichedRows.forEach((r) => {
      const cid = String(r.country_id || r._countryCode);
      const existing = countryMap.get(cid);
      if (existing) {
        existing.count += 1;
        existing.amount += r._paymentMeta.totalPayment;
        existing.currency = r._currency || existing.currency;
      } else {
        countryMap.set(cid, {
          id: cid,
          code: r._countryCode,
          name: r.country_name || r._countryCode,
          count: 1,
          amount: r._paymentMeta.totalPayment,
          currency: r._currency || primaryCurrency,
        });
      }
    });
    const countrySummaries = Array.from(countryMap.values()).sort((a, b) => b.count - a.count);

    // Branch breakdown for Country Admin or drilled-down Super Admin
    const targetCountryId =
      roleTier === "country_admin"
        ? String(countries[0]?.id || countryBranches[0]?.country_id || "")
        : drilledCountryId;

    const branchMap = new Map<
      string,
      { id: string; code: string; name: string; countryId: string; count: number; amount: number; currency: string }
    >();
    countryBranches
      .filter((b: any) => !targetCountryId || String(b.country_id || "") === targetCountryId)
      .forEach((b: any) => {
        const cCode = deriveCountryCode(b.country_name, b.country_code);
        const rawCode = String(b.code || "").trim().toUpperCase();
        const code = rawCode
          ? rawCode.startsWith(cCode + "-")
            ? rawCode
            : `${cCode}-${rawCode}`
          : `${cCode}-001`;
        branchMap.set(String(b.id), {
          id: String(b.id),
          code,
          name: b.name || code,
          countryId: String(b.country_id || ""),
          count: 0,
          amount: 0,
          currency: primaryCurrency,
        });
      });

    enrichedRows
      .filter((r) => !targetCountryId || String(r.country_id || "") === targetCountryId)
      .forEach((r) => {
        const bid = String(r.country_branch_id || r.city_branch_id || r._branchCode);
        const existing = branchMap.get(bid);
        if (existing) {
          existing.count += 1;
          existing.amount += r._paymentMeta.totalPayment;
          existing.currency = r._currency || existing.currency;
        } else {
          branchMap.set(bid, {
            id: bid,
            code: r._branchCode,
            name: r.branch_name || r.city_branch_name || r._branchCode,
            countryId: String(r.country_id || ""),
            count: 1,
            amount: r._paymentMeta.totalPayment,
            currency: r._currency || primaryCurrency,
          });
        }
      });
    const branchSummaries = Array.from(branchMap.values()).sort((a, b) => b.count - a.count);

    return {
      primaryCurrency,
      totalBills,
      totalFinalAmount,
      avgBillAmount,
      postedAcceptedCount,
      draftCount,
      pendingCount,
      invoiceOptionTotal,
      invoicePct: pct(invoiceOptionTotal),
      remainingOptionTotal,
      remainingPct: pct(remainingOptionTotal),
      creditOptionTotal,
      creditPct: pct(creditOptionTotal),
      paidOptionTotal,
      paidPct: pct(paidOptionTotal),
      actualPaidTotal,
      balanceTotal,
      totalSuppliers: suppliersSet.size,
      totalGoodsItems: goodsSet.size,
      totalQuantityLabel,
      countrySummaries,
      branchSummaries,
    };
  }, [filteredRows, enrichedRows, roleTier, countries, countryBranches, drilledCountryId]);

  // Paginated rows
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Open Edit Modal handler (Super Admin & authorized Country Admin only)
  const handleOpenEdit = useCallback(
    (row: any) => {
      if (!canEditBill) return;
      setEditingBill(row);
      setEditForm({
        goodsName: String(row.goods_name || ""),
        supplierName: String(row.supplier_name || row._crName || ""),
        purchaseAccountNo: String(row.purchase_account_no || row._drCode || ""),
        salesAccountNo: String(row.sales_account_no || row.broker_account_no || row._crCode || ""),
        quantityName: String(row.quantity_name || "Cartons"),
        numbers: String(toNum(row.numbers || row.quantity_kgs)),
        totalGrossWeight: String(toNum(row.total_gross_weight || row.quantity_kgs)),
        emptyKgs: String(toNum(row.empty_kgs)),
        netWeight: String(toNum(row.net_weight || row.total_gross_weight)),
        purchaseRate: String(toNum(row.purchase_rate)),
        localCurrency: String(row.local_currency || row.purchase_currency || "AED"),
        paymentMode: String(row.payment_mode || "Cash"),
        advanceAmount: String(toNum(row.advance_amount)),
        contractNo: String(row.contract_no || ""),
        remarks: String(row.remarks || ""),
      });
    },
    [canEditBill]
  );

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill || !canEditBill) return;
    setSavingEdit(true);
    try {
      const qty = Math.max(0, toNum(editForm.numbers));
      const gross = Math.max(0, toNum(editForm.totalGrossWeight));
      const empty = Math.max(0, toNum(editForm.emptyKgs));
      const net = Math.max(0, toNum(editForm.netWeight) || Math.max(0, gross - empty));
      const rate = Math.max(0, toNum(editForm.purchaseRate));
      const rateType = String(editingBill.rate_type || "per_kg");
      const divideKgs = Math.max(1, toNum(editingBill.divide_kgs) || 1);

      let purchaseCost = toNum(editingBill.purchase_cost || editingBill.final_cost);
      if (rate > 0) {
        if (rateType === "per_bag" || rateType === "per_unit") {
          purchaseCost = qty * rate;
        } else if (rateType === "per_maund") {
          purchaseCost = (net / divideKgs) * rate;
        } else {
          purchaseCost = net * rate;
        }
      }
      const taxAmount = toNum(editingBill.tax_amount);
      const finalCost = Math.round((purchaseCost + taxAmount) * 100) / 100;
      const advAmt = Math.max(0, toNum(editForm.advanceAmount));

      const payload = {
        countryBranchId: editingBill.country_branch_id,
        cityBranchId: editingBill.city_branch_id ?? null,
        goodsId: editingBill.goods_id ?? null,
        purchaseAccountNo: editForm.purchaseAccountNo.trim() || editingBill.purchase_account_no || "DR-001",
        salesAccountNo: editForm.salesAccountNo.trim() || editingBill.sales_account_no || "CR-101",
        brokerAccountNo: editingBill.broker_account_no ?? null,
        contractNo: editForm.contractNo.trim() || null,
        brand: editingBill.brand ?? null,
        size: editingBill.size ?? null,
        chassisCode: editingBill.chassis_code ?? null,
        lotNo: editingBill.lot_no ?? null,
        goodsName: editForm.goodsName.trim() || editingBill.goods_name,
        supplierName: editForm.supplierName.trim() || null,
        paymentMode: editForm.paymentMode,
        shippingMode: editingBill.shipping_mode || "Local Market",
        originCountryId: editingBill.origin_country_id ?? null,
        originCountryName: editingBill.origin_country_name || "Local",
        advancePercentage: finalCost > 0 ? Math.round((advAmt / finalCost) * 10000) / 100 : 0,
        advanceAmount: advAmt,
        remainingBalance: Math.max(0, finalCost - advAmt),
        warehouseName: editingBill.warehouse_name ?? null,
        warehouseId: editingBill.warehouse_id ?? null,
        supplierPersonId: editingBill.supplier_person_id ?? null,
        warehousePlotNo: editingBill.warehouse_plot_no ?? null,
        transferDate: editingBill.transfer_date ?? null,
        truckNo: editingBill.truck_no ?? null,
        driverName: editingBill.driver_name ?? null,
        quantityName: editForm.quantityName.trim() || "Cartons",
        quantityKgs: qty,
        totalGrossWeight: gross,
        emptyKgs: empty,
        netWeight: net,
        divideKgs,
        numbers: qty,
        rateType,
        purchaseRate: rate,
        purchaseCurrency: editForm.localCurrency,
        exchangeRate: toNum(editingBill.exchange_rate) || 1,
        localCurrency: editForm.localCurrency,
        purchaseCost,
        applyTax: editingBill.apply_tax || "No",
        taxType: editingBill.tax_type || "VAT",
        taxPercentage: toNum(editingBill.tax_percentage),
        taxAmount,
        finalCost,
        lineItems: Array.isArray(editingBill.line_items) ? editingBill.line_items : [],
        extraCharges: Array.isArray(editingBill.extra_charges) ? editingBill.extra_charges : [],
        loadingDetails: editingBill.loading_details || {},
        loadingDate: editingBill.loading_date ?? null,
        remarks: editForm.remarks.trim() || null,
        fromTransferRegister: true,
      };

      const res = await fetch(`/api/erp/purchases/local-purchase/${editingBill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || "Failed to update bill.");
      }
      setEditingBill(null);
      await fetchBills();
    } catch (err: any) {
      alert(err?.message || "Failed to update bill.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Export CSV helper
  const handleExportCsv = () => {
    const headers = [
      "Bill / Entry No.",
      "Country",
      "Branch",
      "Date",
      "Purchase Account (DR)",
      "DR Code",
      "Supplier Account (CR)",
      "CR Code",
      "Goods",
      "Qty",
      "Unit",
      "Gross kg",
      "Net kg",
      "Final Amount",
      "Payment Option",
      "Destination",
      "Total Payment",
      "Paid",
      "Balance",
    ];
    const csvRows = [
      headers.join(","),
      ...filteredRows.map((r) =>
        [
          r._billNo,
          r._countryCode,
          r._branchCode,
          formatDisplayDate(r.transfer_date || r.created_at),
          `"${String(r._drName).replace(/"/g, '""')}"`,
          r._drCode,
          `"${String(r._crName).replace(/"/g, '""')}"`,
          r._crCode,
          `"${String(r.goods_name || "").replace(/"/g, '""')}"`,
          r._qty,
          r._unit,
          r._grossKg,
          r._netKg,
          r._paymentMeta.totalPayment,
          `"${r._paymentMeta.optionLabel}"`,
          `"${r._paymentMeta.destinationLabel}"`,
          r._paymentMeta.totalPayment,
          r._paymentMeta.actualPaid,
          r._paymentMeta.balance,
        ].join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `local-purchase-transfer-payment-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print A4 helper for a single bill without dashboard navigation
  const handlePrintA4Bill = (bill: any) => {
    setPrintingBill(bill);
    setTimeout(() => {
      window.print();
    }, 120);
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-[#f4f7fb] dark:bg-slate-950 p-3 sm:p-5 space-y-4 text-slate-900 dark:text-slate-100"
    >
      {/* ── Print-Only Compact A4 Bill Sheet (hides dashboard navigation when printing a bill) ── */}
      {printingBill && (
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #lp-transfer-a4-print-sheet, #lp-transfer-a4-print-sheet * { visibility: visible !important; }
            #lp-transfer-a4-print-sheet {
              position: fixed !important;
              inset: 0 !important;
              width: 100% !important;
              background: #ffffff !important;
              color: #0f172a !important;
              padding: 18mm !important;
              z-index: 99999 !important;
            }
          }
        `}</style>
      )}

      {printingBill && (
        <div
          id="lp-transfer-a4-print-sheet"
          className="hidden print:block bg-white text-slate-900 p-6 border border-slate-300 rounded-xl"
        >
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">
                {tr("Local Purchase Bill Voucher")}
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                {tr("Local Purchase Transfer Payment Register")} • {printingBill._countryCode} / {printingBill._branchCode}
              </p>
            </div>
            <div className="text-right font-mono">
              <div className="text-sm font-black text-blue-700">{printingBill._billNo}</div>
              <div className="text-xs text-slate-600">
                {formatDisplayDate(printingBill.transfer_date || printingBill.created_at)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="font-bold text-slate-500 uppercase text-[10px] mb-1">
                {tr("Purchase Account (DR / Debit)")}
              </div>
              <div className="font-black text-sm text-slate-900">{printingBill._drName}</div>
              <div className="font-mono text-slate-600">{printingBill._drCode}</div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="font-bold text-slate-500 uppercase text-[10px] mb-1">
                {tr("Supplier / Sales Account (CR / Credit)")}
              </div>
              <div className="font-black text-sm text-slate-900">{printingBill._crName}</div>
              <div className="font-mono text-slate-600">{printingBill._crCode}</div>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-xs mb-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2.5 py-2 text-left">{tr("Goods")}</th>
                <th className="border border-slate-300 px-2.5 py-2 text-right">{tr("Qty")}</th>
                <th className="border border-slate-300 px-2.5 py-2 text-left">{tr("Unit")}</th>
                <th className="border border-slate-300 px-2.5 py-2 text-right">{tr("Gross kg")}</th>
                <th className="border border-slate-300 px-2.5 py-2 text-right">{tr("Net kg")}</th>
                <th className="border border-slate-300 px-2.5 py-2 text-right">{tr("Rate")}</th>
                <th className="border border-slate-300 px-2.5 py-2 text-right">{tr("Final Amount")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 px-2.5 py-2 font-bold">{printingBill.goods_name}</td>
                <td className="border border-slate-300 px-2.5 py-2 text-right font-mono">
                  {printingBill._qty.toLocaleString()}
                </td>
                <td className="border border-slate-300 px-2.5 py-2">{printingBill._unit}</td>
                <td className="border border-slate-300 px-2.5 py-2 text-right font-mono">
                  {printingBill._grossKg.toLocaleString()}
                </td>
                <td className="border border-slate-300 px-2.5 py-2 text-right font-mono">
                  {printingBill._netKg.toLocaleString()}
                </td>
                <td className="border border-slate-300 px-2.5 py-2 text-right font-mono">
                  {toNum(printingBill.purchase_rate).toLocaleString()}
                </td>
                <td className="border border-slate-300 px-2.5 py-2 text-right font-mono font-black">
                  {formatMoneyAmount(printingBill._currency, printingBill._paymentMeta.totalPayment)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-4 gap-3 text-xs border-t border-slate-200 pt-3">
            <div>
              <div className="text-slate-500 font-semibold">{tr("Payment Option")}</div>
              <div className="font-black">{printingBill._paymentMeta.optionLabel}</div>
              <div className="text-[11px] text-slate-600">
                {tr("Destination")}: {printingBill._paymentMeta.destinationLabel}
              </div>
            </div>
            <div>
              <div className="text-blue-700 font-bold">{tr("Total Payment")}</div>
              <div className="font-mono font-black text-blue-700 text-sm">
                {formatMoneyAmount(printingBill._currency, printingBill._paymentMeta.totalPayment)}
              </div>
            </div>
            <div>
              <div className="text-emerald-700 font-bold">{tr("Paid")}</div>
              <div className="font-mono font-black text-emerald-700 text-sm">
                {formatMoneyAmount(printingBill._currency, printingBill._paymentMeta.actualPaid)}
              </div>
            </div>
            <div>
              <div className="text-rose-700 font-bold">{tr("Balance")}</div>
              <div className="font-mono font-black text-rose-700 text-sm">
                {formatMoneyAmount(printingBill._currency, printingBill._paymentMeta.balance)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Page Header Bar ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 px-4 py-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              {tr("Local Purchase Transfer Page")}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {tr("Transferred purchase bills and payment tracking")}
            </p>
          </div>
        </div>

        {/* Search, Filter & Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr("Search bill no., supplier, goods...")}
              className="h-9 w-56 sm:w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 pl-8 pr-3 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 outline-none transition"
            />
          </div>

          {/* Filter Popover */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => {
                setFilterOpen((v) => !v);
                setActionsOpen(false);
              }}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span>{tr("Filter")}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {filterOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-4 z-50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    {tr("Filter")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCountryId("all");
                      setSelectedBranchId("all");
                      setSelectedPaymentCategory("all");
                      setSelectedStatus("all");
                      setDateFrom("");
                      setDateTo("");
                      setDrilledCountryId(null);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    {tr("Reset")}
                  </button>
                </div>

                {roleTier === "super_admin" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">{tr("Country")}</label>
                    <select
                      value={selectedCountryId}
                      onChange={(e) => {
                        setSelectedCountryId(e.target.value);
                        setSelectedBranchId("all");
                      }}
                      className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold"
                    >
                      <option value="all">{tr("All Countries")}</option>
                      {countries.map((c: any) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {roleTier !== "branch_admin" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">{tr("Branch")}</label>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold"
                    >
                      <option value="all">{tr("All Branches")}</option>
                      {countryBranches
                        .filter(
                          (b: any) =>
                            selectedCountryId === "all" || String(b.country_id || "") === selectedCountryId
                        )
                        .map((b: any) => (
                          <option key={b.id} value={String(b.id)}>
                            {b.code ? `${b.code} — ${b.name}` : b.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{tr("Payment Option")}</label>
                  <select
                    value={selectedPaymentCategory}
                    onChange={(e) => setSelectedPaymentCategory(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold"
                  >
                    <option value="all">{tr("All Payment Options")}</option>
                    <option value="invoice">{tr("Invoice Payment")}</option>
                    <option value="final">{tr("Final Payment")}</option>
                    <option value="credit">{tr("Credit")}</option>
                    <option value="cash">{tr("Cash")}</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">{tr("From Date")}</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">{tr("To Date")}</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions Dropdown */}
          <div className="relative" ref={actionsRef}>
            <button
              type="button"
              onClick={() => {
                setActionsOpen((v) => !v);
                setFilterOpen(false);
              }}
              className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <span>{tr("Actions")}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {actionsOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-50 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    setPrintingBill(null);
                    setTimeout(() => window.print(), 60);
                  }}
                  className="w-full px-3.5 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-blue-600" />
                  <span>{tr("Print Register")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    handleExportCsv();
                  }}
                  className="w-full px-3.5 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{tr("Export CSV")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    fetchBills();
                  }}
                  className="w-full px-3.5 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                  <span>{tr("Refresh")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Three Approved Dashboard Cards (Role-Scoped: only the signed-in role's card set is shown) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 print:hidden">
        {/* CARD 1: Total Local Purchase Bills (Gold / Amber) */}
        <section className="lg:col-span-5 rounded-2xl border border-amber-200/90 dark:border-amber-900/50 bg-gradient-to-br from-[#fffdf7] via-[#fffaf0] to-[#fef6e4] dark:from-slate-900 dark:to-slate-900 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                  {tr("Total Local Purchase Bills")}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{scopeSubtitle}</p>
              </div>
            </div>
            <div className="flex items-end gap-0.5 h-5 px-1">
              <span className="w-1 h-2 bg-amber-300 rounded-full" />
              <span className="w-1 h-3 bg-amber-400 rounded-full" />
              <span className="w-1 h-4 bg-amber-500 rounded-full" />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2.5 items-stretch">
            {/* Total Bills Count */}
            <div className="col-span-3 bg-white/90 dark:bg-slate-800/80 rounded-xl border border-amber-100 dark:border-slate-700 p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                <span>{tr("Total Bills")}</span>
                <ChevronRight className="h-3 w-3 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono my-1" dir="ltr">
                {dashboardMetrics.totalBills}
              </div>
              {roleTier === "super_admin" && dashboardMetrics.countrySummaries.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {dashboardMetrics.countrySummaries.slice(0, 3).map((c) => (
                    <span
                      key={c.id}
                      className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold"
                      dir="ltr"
                    >
                      {c.code}: {c.count}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] font-semibold text-slate-400 truncate">
                  {tr("Active Scope")}
                </div>
              )}
            </div>

            {/* Total Final Amount */}
            <div className="col-span-5 bg-white/90 dark:bg-slate-800/80 rounded-xl border border-amber-100 dark:border-slate-700 p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                <span>{tr("Total Final Amount")}</span>
                <ChevronRight className="h-3 w-3 text-slate-400" />
              </div>
              <div
                className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight my-1 truncate"
                dir="ltr"
              >
                {formatMoneyAmount(dashboardMetrics.primaryCurrency, dashboardMetrics.totalFinalAmount)}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 font-mono truncate" dir="ltr">
                {tr("Avg")}: {formatMoneyAmount(dashboardMetrics.primaryCurrency, dashboardMetrics.avgBillAmount)}
              </div>
            </div>

            {/* Posting & Transfer Status */}
            <div className="col-span-4 bg-white/90 dark:bg-slate-800/80 rounded-xl border border-amber-100 dark:border-slate-700 p-2.5 flex flex-col justify-between space-y-1">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 truncate">
                {tr("Posting & Transfer Status")}
              </div>
              <button
                type="button"
                onClick={() => setSelectedStatus((s) => (s === "posted" ? "all" : "posted"))}
                className="w-full flex items-center justify-between px-2 py-1 rounded-md bg-emerald-50/90 dark:bg-emerald-950/40 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{tr("Posted / Accepted")}</span>
                </span>
                <span className="font-mono font-black ml-1" dir="ltr">
                  {dashboardMetrics.postedAcceptedCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus((s) => (s === "draft" ? "all" : "draft"))}
                className="w-full flex items-center justify-between px-2 py-1 rounded-md bg-amber-50/90 dark:bg-amber-950/40 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">{tr("Draft Bills")}</span>
                </span>
                <span className="font-mono font-black ml-1" dir="ltr">
                  {dashboardMetrics.draftCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus((s) => (s === "pending" ? "all" : "pending"))}
                className="w-full flex items-center justify-between px-2 py-1 rounded-md bg-rose-50/90 dark:bg-rose-950/40 text-[11px] font-bold text-rose-800 dark:text-rose-300 hover:bg-rose-100 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="truncate">{tr("Pending Bills")}</span>
                </span>
                <span className="font-mono font-black ml-1" dir="ltr">
                  {dashboardMetrics.pendingCount}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* CARD 2: Payment Type (Sky / Blue) */}
        <section className="lg:col-span-4 rounded-2xl border border-blue-200/90 dark:border-blue-900/50 bg-gradient-to-br from-[#f7fbff] via-[#f2f8ff] to-[#eaf3ff] dark:from-slate-900 dark:to-slate-900 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Layers className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                  {tr("Payment Type")}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{scopeSubtitle}</p>
              </div>
            </div>
            <div className="flex items-end gap-0.5 h-5 px-1">
              <span className="w-1 h-2 bg-blue-300 rounded-full" />
              <span className="w-1 h-3 bg-blue-400 rounded-full" />
              <span className="w-1 h-4 bg-blue-600 rounded-full" />
            </div>
          </div>

          <div className="space-y-1.5 bg-white/85 dark:bg-slate-800/80 rounded-xl border border-blue-100 dark:border-slate-700 p-2.5">
            <button
              type="button"
              onClick={() =>
                setSelectedPaymentCategory((c) => (c === "invoice" ? "all" : "invoice"))
              }
              className={cn(
                "w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs transition cursor-pointer",
                selectedPaymentCategory === "invoice"
                  ? "bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-300"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
              )}
            >
              <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <span className="h-5 w-5 rounded-md bg-violet-600 text-white flex items-center justify-center text-[10px]">
                  <CreditCard className="h-3 w-3" />
                </span>
                <span>{tr("Invoice Payment")}</span>
              </span>
              <span className="font-mono font-black text-blue-800 dark:text-blue-300" dir="ltr">
                {formatMoneyAmount(dashboardMetrics.primaryCurrency, dashboardMetrics.invoiceOptionTotal)}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedPaymentCategory((c) => (c === "final" ? "all" : "final"))
              }
              className={cn(
                "w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs transition cursor-pointer",
                selectedPaymentCategory === "final"
                  ? "bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-300"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
              )}
            >
              <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <span className="h-5 w-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[10px]">
                  <Wallet className="h-3 w-3" />
                </span>
                <span>{tr("Remaining")}</span>
              </span>
              <span className="font-mono font-black text-blue-700 dark:text-blue-300" dir="ltr">
                {formatMoneyAmount(dashboardMetrics.primaryCurrency, dashboardMetrics.remainingOptionTotal)}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedPaymentCategory((c) => (c === "credit" ? "all" : "credit"))
              }
              className={cn(
                "w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs transition cursor-pointer",
                selectedPaymentCategory === "credit"
                  ? "bg-rose-50 dark:bg-rose-950/40 ring-1 ring-rose-300"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
              )}
            >
              <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <span className="h-5 w-5 rounded-md bg-rose-600 text-white flex items-center justify-center text-[10px]">
                  <Receipt className="h-3 w-3" />
                </span>
                <span>{tr("Credit")}</span>
              </span>
              <span className="font-mono font-black text-rose-600 dark:text-rose-400" dir="ltr">
                {formatMoneyAmount(dashboardMetrics.primaryCurrency, dashboardMetrics.creditOptionTotal)}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedPaymentCategory((c) => (c === "cash" ? "all" : "cash"))
              }
              className={cn(
                "w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs transition cursor-pointer",
                selectedPaymentCategory === "cash"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-300"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
              )}
            >
              <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <span className="h-5 w-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                  <Check className="h-3 w-3" />
                </span>
                <span>{tr("Paid Payment")}</span>
              </span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                {formatMoneyAmount(dashboardMetrics.primaryCurrency, dashboardMetrics.paidOptionTotal)}
              </span>
            </button>
          </div>

          <div className="mt-2 pt-1.5 border-t border-blue-200/60 dark:border-slate-800 flex items-center justify-center gap-2 text-[11px] font-bold">
            <span>
              {tr("Actual paid")}:{" "}
              <strong className="font-mono text-emerald-700 dark:text-emerald-400" dir="ltr">
                {formatMoneyAmount(dashboardMetrics.primaryCurrency, dashboardMetrics.actualPaidTotal)}
              </strong>
            </span>
            <span className="text-slate-400">•</span>
            <span>
              {tr("Balance")}:{" "}
              <strong className="font-mono text-rose-600 dark:text-rose-400" dir="ltr">
                {formatMoneyAmount(dashboardMetrics.primaryCurrency, dashboardMetrics.balanceTotal)}
              </strong>
            </span>
          </div>
        </section>

        {/* CARD 3: Role-Specific Summary Card (Mint / Emerald) */}
        <section className="lg:col-span-3 rounded-2xl border border-emerald-200/90 dark:border-emerald-900/50 bg-gradient-to-br from-[#f6fef9] via-[#f0fdf6] to-[#e6faee] dark:from-slate-900 dark:to-slate-900 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Globe2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                  {roleTier === "super_admin"
                    ? drilledCountryId
                      ? tr("Branches Summary")
                      : tr("Countries Summary")
                    : roleTier === "country_admin"
                    ? tr("Branches Summary")
                    : tr("Branch Summary")}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{scopeSubtitle}</p>
              </div>
            </div>
            {roleTier === "super_admin" && drilledCountryId ? (
              <button
                type="button"
                onClick={() => {
                  setDrilledCountryId(null);
                  setSelectedCountryId("all");
                  setSelectedBranchId("all");
                }}
                className="text-[11px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>{tr("Countries")}</span>
              </button>
            ) : (
              <div className="flex items-end gap-0.5 h-5 px-1">
                <span className="w-1 h-2 bg-emerald-300 rounded-full" />
                <span className="w-1 h-3 bg-emerald-400 rounded-full" />
                <span className="w-1 h-4 bg-emerald-600 rounded-full" />
              </div>
            )}
          </div>

          <div className="bg-white/85 dark:bg-slate-800/80 rounded-xl border border-emerald-100 dark:border-slate-700 p-2.5 space-y-1.5 flex-1 flex flex-col justify-center">
            {roleTier === "super_admin" && !drilledCountryId ? (
              dashboardMetrics.countrySummaries.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">{tr("No countries found")}</div>
              ) : (
                dashboardMetrics.countrySummaries.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setDrilledCountryId(c.id);
                      setSelectedCountryId(c.id);
                      setSelectedBranchId("all");
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-emerald-50/80 dark:hover:bg-slate-700/60 text-xs transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-black text-slate-700 dark:text-slate-200 w-6 text-left">
                        {c.code}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {c.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0" dir="ltr">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {c.count} {tr("bills")}
                      </span>
                      <span className="font-mono font-black text-slate-900 dark:text-white min-w-[85px] text-right">
                        {c.amount > 0 ? formatMoneyAmount(c.currency, c.amount) : "—"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </button>
                ))
              )
            ) : roleTier === "country_admin" || (roleTier === "super_admin" && drilledCountryId) ? (
              dashboardMetrics.branchSummaries.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">{tr("No branches found")}</div>
              ) : (
                dashboardMetrics.branchSummaries.slice(0, 4).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      setSelectedBranchId((prev) => (prev === b.id ? "all" : b.id))
                    }
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition cursor-pointer",
                      selectedBranchId === b.id
                        ? "bg-emerald-100/80 dark:bg-emerald-950/50 ring-1 ring-emerald-300"
                        : "hover:bg-emerald-50/80 dark:hover:bg-slate-700/60"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100 truncate">
                        {b.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0" dir="ltr">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {b.count} {tr("bills")}
                      </span>
                      <span className="font-mono font-black text-slate-900 dark:text-white min-w-[85px] text-right">
                        {b.amount > 0 ? formatMoneyAmount(b.currency, b.amount) : "—"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </button>
                ))
              )
            ) : (
              /* Branch Admin: 4 rows (Total Suppliers, Total Goods Items, Avg Invoice Amount, Total Quantity) */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-2 py-1 rounded-lg text-xs">
                  <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{tr("Total Suppliers")}</span>
                  </span>
                  <span className="font-mono font-black text-slate-900 dark:text-white" dir="ltr">
                    {dashboardMetrics.totalSuppliers}
                  </span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded-lg text-xs">
                  <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                    <Package className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{tr("Total Goods Items")}</span>
                  </span>
                  <span className="font-mono font-black text-slate-900 dark:text-white" dir="ltr">
                    {dashboardMetrics.totalGoodsItems}
                  </span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded-lg text-xs">
                  <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                    <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{tr("Avg Invoice Amount")}</span>
                  </span>
                  <span className="font-mono font-black text-slate-900 dark:text-white" dir="ltr">
                    {formatMoneyAmount(dashboardMetrics.primaryCurrency, dashboardMetrics.avgBillAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded-lg text-xs">
                  <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                    <Scale className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{tr("Total Quantity")}</span>
                  </span>
                  <span className="font-mono font-black text-slate-900 dark:text-white" dir="ltr">
                    {dashboardMetrics.totalQuantityLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Local Purchase Transfer Payment Register Table Card ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden print:border-none print:shadow-none">
        {/* Table Heading Bar */}
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs">
              <CreditCard className="h-4 w-4" />
            </div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
              {tr("Local Purchase Transfer Payment Register")}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setPrintingBill(null);
              setTimeout(() => window.print(), 60);
            }}
            className="h-8 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer print:hidden"
          >
            <Printer className="h-3.5 w-3.5 text-blue-600" />
            <span>{tr("Print")}</span>
          </button>
        </div>

        {/* 17-Column Register Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-3 text-left whitespace-nowrap">{tr("Bill / Entry No.")}</th>
                <th className="py-2.5 px-2.5 text-left whitespace-nowrap">{tr("Country")}</th>
                <th className="py-2.5 px-2.5 text-left whitespace-nowrap">{tr("Branch")}</th>
                <th className="py-2.5 px-3 text-left whitespace-nowrap">{tr("Date")}</th>
                <th className="py-2.5 px-3 text-left whitespace-nowrap">
                  {tr("Purchase Account (DR / Debit)")}
                </th>
                <th className="py-2.5 px-3 text-left whitespace-nowrap">
                  {tr("Supplier / Sales Account (CR / Credit)")}
                </th>
                <th className="py-2.5 px-3 text-left whitespace-nowrap">{tr("Goods")}</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">{tr("Qty")}</th>
                <th className="py-2.5 px-2.5 text-left whitespace-nowrap">{tr("Unit")}</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">{tr("Gross kg")}</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">{tr("Net kg")}</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">{tr("Final Amount")}</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap uppercase tracking-wider">
                  {tr("Payment Option")}
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap uppercase tracking-wider bg-blue-50/80 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300">
                  {tr("Total Payment")}
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap uppercase tracking-wider bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
                  {tr("Paid")}
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap uppercase tracking-wider bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300">
                  {tr("Balance")}
                </th>
                <th className="py-2.5 px-2.5 text-center whitespace-nowrap print:hidden">
                  {tr("Actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-slate-400 font-medium">
                    {tr("Loading Local Purchase Transfer Payment Register...")}
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-rose-600 font-semibold">
                    {error}
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-slate-400 font-medium">
                    {tr("No transferred purchase bills match the current filters.")}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const isHighlighted = highlightBillId && String(row.id) === String(highlightBillId);
                  const menuOpen = openRowMenuId === String(row.id);

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition",
                        isHighlighted && "bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-300"
                      )}
                    >
                      {/* 1. Bill / Entry No. */}
                      <td className="py-3 px-3 font-mono font-black text-blue-700 dark:text-blue-400 whitespace-nowrap">
                        {row._billNo}
                      </td>

                      {/* 2. Country (compact code) */}
                      <td className="py-3 px-2.5 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row._countryCode}
                      </td>

                      {/* 3. Branch (compact code) */}
                      <td className="py-3 px-2.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {row._branchCode}
                      </td>

                      {/* 4. Date */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDisplayDate(row.transfer_date || row.created_at)}
                      </td>

                      {/* 5. Purchase Account (DR / Debit): Account Name on top, Code below */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-white leading-tight">
                          {row._drName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {row._drCode}
                        </div>
                      </td>

                      {/* 6. Supplier / Sales Account (CR / Credit): Account Name on top, Code below */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-white leading-tight">
                          {row._crName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {row._crCode}
                        </div>
                      </td>

                      {/* 7. Goods */}
                      <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {row.goods_name || "—"}
                      </td>

                      {/* 8. Qty */}
                      <td className="py-3 px-2.5 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {row._qty.toLocaleString("en-US")}
                      </td>

                      {/* 9. Unit */}
                      <td className="py-3 px-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {row._unit}
                      </td>

                      {/* 10. Gross kg */}
                      <td className="py-3 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row._grossKg.toLocaleString("en-US")}
                      </td>

                      {/* 11. Net kg */}
                      <td className="py-3 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row._netKg.toLocaleString("en-US")}
                      </td>

                      {/* 12. Final Amount */}
                      <td
                        className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white whitespace-nowrap"
                        dir="ltr"
                      >
                        {formatMoneyAmount(row._currency, row._paymentMeta.totalPayment)}
                      </td>

                      {/* 13. Payment Option + Destination below */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={cn(
                              "px-3 py-0.5 rounded-full border text-[11px] font-bold leading-snug",
                              row._paymentMeta.pillClass
                            )}
                          >
                            {tr(row._paymentMeta.optionLabel)}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            {tr("Destination")}:{" "}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {tr(row._paymentMeta.destinationLabel)}
                            </strong>
                          </span>
                        </div>
                      </td>

                      {/* 14. Total Payment (Blue column) */}
                      <td
                        className="py-3 px-3 text-right font-mono font-black bg-blue-50/55 dark:bg-blue-950/20 text-slate-900 dark:text-blue-200 whitespace-nowrap"
                        dir="ltr"
                      >
                        {formatMoneyAmount(row._currency, row._paymentMeta.totalPayment)}
                      </td>

                      {/* 15. Paid (Green column) */}
                      <td
                        className="py-3 px-3 text-right font-mono font-black bg-emerald-50/55 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 whitespace-nowrap"
                        dir="ltr"
                      >
                        {formatMoneyAmount(row._currency, row._paymentMeta.actualPaid)}
                      </td>

                      {/* 16. Balance (Red column) */}
                      <td
                        className="py-3 px-3 text-right font-mono font-black bg-rose-50/55 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 whitespace-nowrap"
                        dir="ltr"
                      >
                        {formatMoneyAmount(row._currency, row._paymentMeta.balance)}
                      </td>

                      {/* 17. Actions (Three-dot menu: View Bill, Edit Bill [Super/Country Admin only], Print A4) */}
                      <td
                        className="py-3 px-2.5 text-center whitespace-nowrap relative print:hidden"
                        data-row-action-menu
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenRowMenuId((prev) =>
                              prev === String(row.id) ? null : String(row.id)
                            )
                          }
                          aria-label={tr("Actions")}
                          className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-2xs cursor-pointer"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>

                        {menuOpen && (
                          <div className="absolute right-3 mt-1 w-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50 text-left">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenRowMenuId(null);
                                setViewingBill(row);
                              }}
                              className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-600" />
                              <span>{tr("View Bill")}</span>
                            </button>

                            {canEditBill && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenRowMenuId(null);
                                  handleOpenEdit(row);
                                }}
                                className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                                <span>{tr("Edit Bill")}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setOpenRowMenuId(null);
                                handlePrintA4Bill(row);
                              }}
                              className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5 text-blue-600" />
                              <span>{tr("Print A4")}</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Pagination */}
        <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 print:hidden">
          <div>
            {tr("Showing")}{" "}
            <strong className="text-slate-700 dark:text-slate-200">
              {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(filteredRows.length, currentPage * pageSize)}
            </strong>{" "}
            {tr("of")} <strong className="text-slate-700 dark:text-slate-200">{filteredRows.length}</strong>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>{tr("Rows per page")}:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>{tr("Previous")}</span>
              </button>
              <span className="h-7 min-w-7 px-2 rounded-lg bg-blue-600 text-white font-bold inline-flex items-center justify-center text-xs">
                {currentPage}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{tr("Next")}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── MODAL 1: View Complete Original Bill (Centered Modal with Print inside) ── */}
      {viewingBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-blue-600">
                  {tr("Original Local Purchase Bill")}
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{viewingBill._billNo}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {viewingBill._countryCode} • {viewingBill._branchCode}
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintA4Bill(viewingBill)}
                  className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>{tr("Print")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingBill(null)}
                  aria-label={tr("Close")}
                  className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Retained Invoice / Contract / Reference Metadata inside the original bill */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/70 dark:border-slate-800">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{tr("Bill / Entry No.")}</div>
                  <div className="font-mono font-black text-blue-700 dark:text-blue-400 mt-0.5">
                    {viewingBill._billNo}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{tr("Date")}</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {formatDisplayDate(viewingBill.transfer_date || viewingBill.created_at)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{tr("Invoice / Contract No.")}</div>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {viewingBill.contract_no || viewingBill.manual_bill_no || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{tr("Journal Reference")}</div>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {viewingBill.journal_serial_no || viewingBill.super_admin_serial || "—"}
                  </div>
                </div>
              </div>

              {/* Linked DR & CR Accounts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    {tr("Purchase Account (DR / Debit)")}
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-1">
                    {viewingBill._drName}
                  </div>
                  <div className="font-mono text-xs text-slate-500 mt-0.5">{viewingBill._drCode}</div>
                </div>

                <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {tr("Supplier / Sales Account (CR / Credit)")}
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-1">
                    {viewingBill._crName}
                  </div>
                  <div className="font-mono text-xs text-slate-500 mt-0.5">{viewingBill._crCode}</div>
                </div>
              </div>

              {/* Goods, Weights & Amounts */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                      <th className="p-2.5 text-left">{tr("Goods")}</th>
                      <th className="p-2.5 text-right">{tr("Qty")}</th>
                      <th className="p-2.5 text-left">{tr("Unit")}</th>
                      <th className="p-2.5 text-right">{tr("Gross kg")}</th>
                      <th className="p-2.5 text-right">{tr("Net kg")}</th>
                      <th className="p-2.5 text-right">{tr("Rate")}</th>
                      <th className="p-2.5 text-right">{tr("Final Amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-200 dark:border-slate-800">
                      <td className="p-2.5 font-bold">{viewingBill.goods_name}</td>
                      <td className="p-2.5 text-right font-mono">{viewingBill._qty.toLocaleString("en-US")}</td>
                      <td className="p-2.5">{viewingBill._unit}</td>
                      <td className="p-2.5 text-right font-mono">{viewingBill._grossKg.toLocaleString("en-US")}</td>
                      <td className="p-2.5 text-right font-mono">{viewingBill._netKg.toLocaleString("en-US")}</td>
                      <td className="p-2.5 text-right font-mono">
                        {toNum(viewingBill.purchase_rate).toLocaleString("en-US")}
                      </td>
                      <td className="p-2.5 text-right font-mono font-black">
                        {formatMoneyAmount(viewingBill._currency, viewingBill._paymentMeta.totalPayment)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Summary Box */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">{tr("Payment Option")}</div>
                  <div className="font-black text-slate-900 dark:text-white mt-1">
                    {tr(viewingBill._paymentMeta.optionLabel)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {tr("Destination")}: {tr(viewingBill._paymentMeta.destinationLabel)}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/30 p-3">
                  <div className="text-[10px] font-bold uppercase text-blue-700">{tr("Total Payment")}</div>
                  <div className="font-mono font-black text-sm text-blue-800 dark:text-blue-300 mt-1" dir="ltr">
                    {formatMoneyAmount(viewingBill._currency, viewingBill._paymentMeta.totalPayment)}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30 p-3">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">{tr("Paid")}</div>
                  <div className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400 mt-1" dir="ltr">
                    {formatMoneyAmount(viewingBill._currency, viewingBill._paymentMeta.actualPaid)}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/30 p-3">
                  <div className="text-[10px] font-bold uppercase text-rose-700">{tr("Balance")}</div>
                  <div className="font-mono font-black text-sm text-rose-600 dark:text-rose-400 mt-1" dir="ltr">
                    {formatMoneyAmount(viewingBill._currency, viewingBill._paymentMeta.balance)}
                  </div>
                </div>
              </div>

              {/* Payment History Entries (if any) */}
              {Array.isArray(viewingBill.payment_entries) && viewingBill.payment_entries.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    {tr("Posted Payment History")}
                  </div>
                  <div className="space-y-1.5">
                    {viewingBill.payment_entries.map((pe: any) => (
                      <div
                        key={pe.id}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-blue-600">
                            {pe.entry_serial || pe.reference_no || "PAY"}
                          </span>
                          <span className="mx-2 text-slate-400">•</span>
                          <span className="uppercase font-semibold text-slate-600 dark:text-slate-300">
                            {pe.kind}
                          </span>
                          <span className="mx-2 text-slate-400">•</span>
                          <span className="text-slate-500">{formatDisplayDate(pe.entry_date)}</span>
                        </div>
                        <div className="font-mono font-black text-emerald-700" dir="ltr">
                          {formatMoneyAmount(pe.currency_code || viewingBill._currency, toNum(pe.amount))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Edit Bill (Super Admin & Authorized Country Admin Only) ── */}
      {editingBill && canEditBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600">
                  {tr("Edit Bill")}
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {editingBill._billNo} ({editingBill._countryCode} • {editingBill._branchCode})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBill(null)}
                aria-label={tr("Close")}
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {tr("Goods")}
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.goodsName}
                    onChange={(e) => setEditForm((f) => ({ ...f, goodsName: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {tr("Supplier / Sales Account (CR / Credit)")}
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.supplierName}
                    onChange={(e) => setEditForm((f) => ({ ...f, supplierName: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{tr("Qty")}</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.numbers}
                    onChange={(e) => setEditForm((f) => ({ ...f, numbers: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{tr("Unit")}</label>
                  <input
                    type="text"
                    value={editForm.quantityName}
                    onChange={(e) => setEditForm((f) => ({ ...f, quantityName: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{tr("Gross kg")}</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.totalGrossWeight}
                    onChange={(e) => setEditForm((f) => ({ ...f, totalGrossWeight: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{tr("Net kg")}</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.netWeight}
                    onChange={(e) => setEditForm((f) => ({ ...f, netWeight: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{tr("Rate")}</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.purchaseRate}
                    onChange={(e) => setEditForm((f) => ({ ...f, purchaseRate: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {tr("Payment Option")}
                  </label>
                  <select
                    value={editForm.paymentMode}
                    onChange={(e) => setEditForm((f) => ({ ...f, paymentMode: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-semibold"
                  >
                    <option value="Invoice Payment">{tr("Invoice Payment")}</option>
                    <option value="Credit">{tr("Credit")}</option>
                    <option value="Final Payment">{tr("Final Payment")}</option>
                    <option value="Cash">{tr("Cash")}</option>
                    <option value="Bank Transfer">{tr("Bank Transfer")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {tr("Advance / Paid Amount")}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.advanceAmount}
                    onChange={(e) => setEditForm((f) => ({ ...f, advanceAmount: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingBill(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {tr("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? tr("Saving...") : tr("Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default LocalPurchaseTransferPaymentView;
