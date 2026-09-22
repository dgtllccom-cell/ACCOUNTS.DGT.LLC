"use client";

/**
 * Purchase Order Payment Journal — restyle to match the owner-approved reference
 * design, for mode="remaining" only. Additive/self-contained: does not touch any
 * posting/payment-creation logic. Reads real data from:
 *   - GET /api/erp/purchases/payments (new, read-only, flat payment-per-row list —
 *     see app/api/erp/purchases/payments/route.ts)
 *   - the existing `orders`/`ledgers` already loaded by the parent
 *     PurchaseOrderPaymentJournal, passed in as props for cross-linking to the
 *     unchanged "View Full Details" modal and the existing print functions.
 *
 * "View Full Details" opens the parent's existing big detail modal unchanged
 * (via onOpenFullDetails -> selectOrder). Print / Download PDF call the parent's
 * existing handlePrintReceipt / handleOpenA4PDF, unchanged.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Home,
  Users,
  Wallet,
  ClipboardList,
  BookOpen,
  Globe2,
  Search,
  RefreshCw,
  RotateCcw,
  Plus,
  Printer,
  Download,
  Eye,
  X,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Th } from "@/components/ui/translated-th";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { t, type LanguageCode } from "@/features/i18n/purchase-journal-translations";

type FlatPayment = {
  id: string;
  purchase_order_id: string;
  kind: string;
  entry_date: string | null;
  amount: number | string | null;
  currency_code: string | null;
  exchange_rate: number | string | null;
  debit_ledger_id: string | null;
  credit_ledger_id: string | null;
  roznamcha_entry_id: string | null;
  status: string | null;
  reference_no: string | null;
  narration: string | null;
  super_admin_serial: string | null;
  country_serial: string | null;
  branch_serial: string | null;
  entry_serial: string | null;
  created_at: string | null;
  purchase_order_no: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  order_total: number | string | null;
  advance_paid: number | string | null;
  remaining_due: number | string | null;
  po_currency_code: string | null;
  vendor_name: string | null;
  debit_ledger_name: string | null;
  credit_ledger_name: string | null;
  journal_no: string | null;
  journal_posted_at: string | null;
  payment_method_name: string | null;
  created_by_name: string | null;
};

export type PurchasePaymentJournalRemainingViewProps = {
  lang: LanguageCode;
  session: any;
  isSuperAdmin: boolean;
  orders: any[];
  ledgers: any[];
  baseCurrency: string;
  countryOptions: string[];
  branchOptions: string[];
  onOpenFullDetails: (orderId: string) => void;
  onPrintReceipt: (payment: any, orderRow: any) => void;
  onDownloadPdf: (orderRow: any) => void;
};

function money(v: number | string | null | undefined) {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Real payment.status is the document_status enum: draft | posted | cancelled.
// Displayed as Pending / Posted / Cancelled — no invented "Cleared" bucket.
function statusLabel(status: string | null, lang: LanguageCode) {
  const s = (status || "").toLowerCase();
  if (s === "posted") return t("status_posted", lang);
  if (s === "cancelled") return t("status_cancelled", lang);
  return t("status_pending", lang);
}

function statusBadgeClass(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "posted") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
  if (s === "cancelled") return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";
  return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
}

function KpiCard({
  icon,
  tone,
  title,
  badge,
  rows,
  footer
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  badge?: React.ReactNode;
  rows: { label: string; value: React.ReactNode }[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs hover:shadow-md transition">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-xs", tone)}>
              {icon}
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {title}
            </span>
          </div>
          {badge}
        </div>
        <div className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
              <span className="font-bold font-mono text-slate-900 dark:text-white text-right">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
      {footer ? <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80">{footer}</div> : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
      <span className="text-slate-500 dark:text-slate-400 font-semibold">{label}</span>
      <span className="text-slate-900 dark:text-white font-bold text-right">{value}</span>
    </div>
  );
}

function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1 mb-3">
      <div className="flex items-center gap-2 mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export function PurchasePaymentJournalRemainingView({
  lang,
  session,
  isSuperAdmin,
  orders,
  ledgers,
  baseCurrency,
  countryOptions,
  branchOptions,
  onOpenFullDetails,
  onPrintReceipt,
  onDownloadPdf
}: PurchasePaymentJournalRemainingViewProps) {
  const tt = (key: string, fallback: string) => t(key, lang) || fallback;

  const [payments, setPayments] = useState<FlatPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [checkedId, setCheckedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function loadPayments() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/purchases/payments?lang=${lang}&limit=200`, { credentials: "include" });
      const body = await res.json();
      if (!body?.ok) throw new Error(body?.error?.message || "Failed to load payments");
      setPayments(body.data.payments || []);
    } catch (e: any) {
      setError(e?.message || tt("err_load", "Unable to load payments"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderById = useMemo(() => {
    const m = new Map<string, any>();
    for (const o of orders) m.set(o.id, o);
    return m;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => {
      if (q) {
        const hay = `${p.purchase_order_no || ""} ${p.vendor_name || ""} ${p.super_admin_serial || ""} ${p.reference_no || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (countryFilter) {
        const order = orderById.get(p.purchase_order_id);
        const countryName = order?.countryName || order?.country_name || "";
        if (countryName !== countryFilter) return false;
      }
      if (branchFilter) {
        const order = orderById.get(p.purchase_order_id);
        const branchName = order?.branchName || order?.branch_name || "";
        if (branchName !== branchFilter) return false;
      }
      if (statusFilter && (p.status || "").toLowerCase() !== statusFilter) return false;
      if (dateRange.from && p.entry_date && p.entry_date < dateRange.from) return false;
      if (dateRange.to && p.entry_date && p.entry_date > dateRange.to) return false;
      return true;
    });
  }, [payments, query, countryFilter, branchFilter, statusFilter, dateRange, orderById]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, countryFilter, branchFilter, statusFilter, dateRange]);

  // ── KPI aggregation (read-only display math over already-loaded data) ──────────
  const kpi = useMemo(() => {
    const posted = filtered.filter((p) => (p.status || "").toLowerCase() === "posted");
    const pending = filtered.filter((p) => (p.status || "").toLowerCase() !== "posted" && (p.status || "").toLowerCase() !== "cancelled");
    const cancelled = filtered.filter((p) => (p.status || "").toLowerCase() === "cancelled");

    const totalPoValue = orders.reduce((sum, o) => sum + Number(o.order_total || 0), 0);
    const paidAmount = orders.reduce((sum, o) => sum + Number(o.advance_paid || 0) + Number(o.remaining_paid || 0), 0);
    const balanceAmount = orders.reduce((sum, o) => sum + Number(o.remaining_due || 0), 0);
    const overdueCount = orders.filter((o) => Number(o.remaining_due || 0) > 0).length;

    const debitTotal = posted.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const creditTotal = debitTotal; // balanced double-entry: debit total == credit total for posted payments

    const branchNames = new Set(orders.map((o) => o.branchName || o.branch_name).filter(Boolean));
    const countryNames = new Set(orders.map((o) => o.countryName || o.country_name).filter(Boolean));
    const activeUsers = new Set(payments.map((p) => p.created_by_name).filter(Boolean));

    return {
      totalPayments: filtered.length,
      paid: posted.length,
      pending: pending.length,
      cleared: cancelled.length,
      totalPoValue,
      paidAmount,
      balanceAmount,
      overdueCount,
      postedCount: posted.length,
      pendingCount: pending.length,
      debitTotal,
      creditTotal,
      countryCount: countryNames.size,
      branchCount: branchNames.size,
      activeUserCount: activeUsers.size
    };
  }, [filtered, orders, payments]);

  const checked = useMemo(() => payments.find((p) => p.id === checkedId) || null, [payments, checkedId]);
  const checkedOrder = checked ? orderById.get(checked.purchase_order_id) : null;

  function handleCheckRow(id: string) {
    if (checkedId === id) {
      setCheckedId(null);
      setDrawerOpen(false);
      return;
    }
    setCheckedId(id);
    setDrawerOpen(true);
  }

  return (
    <div dir={["ur", "ar", "fa", "ps"].includes(lang) ? "rtl" : "ltr"} className="w-full space-y-5 px-4 sm:px-6 pt-4 pb-2">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
        <Link href="/dashboard" className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400">
          <Home className="h-3.5 w-3.5" /> {tt("breadcrumb_home", "Home")}
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
        <Link href="/dashboard/purchase" className="hover:text-blue-600 dark:hover:text-blue-400">
          {tt("breadcrumb_purchase_mgmt", "Purchase Management")}
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
        <span className="text-blue-600 dark:text-blue-400 font-bold">{tt("page_title_v3", "Purchase Order Payment Journal")}</span>
      </nav>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl md:text-[28px] font-black tracking-tight text-slate-900 dark:text-white">
          {tt("page_title_v3", "Purchase Order Payment Journal")}
        </h1>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
          {tt("page_subtitle_v3", "Track and manage payments made against purchase orders")}
        </p>
      </div>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          tone="bg-purple-600"
          title={tt("card_branch_user", "Branch & User Details")}
          rows={[
            { label: tt("col_country", "Country"), value: session?.scopes?.summary?.countryName || (session?.scopes?.isSuperAdmin ? tt("global", "Global") : "—") },
            { label: tt("col_branch", "Branch"), value: session?.scopes?.summary?.branchDisplayName || (session?.scopes?.isSuperAdmin ? tt("global", "Global") : "—") },
            { label: tt("col_user", "User"), value: session?.user?.fullName || session?.user?.email || "—" },
            { label: tt("col_role", "Role"), value: session?.roles?.[0] || "—" }
          ]}
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          tone="bg-emerald-600"
          title={tt("card_payment_summary", "Payment Summary")}
          rows={[
            { label: tt("total_payments", "Total Payments"), value: kpi.totalPayments },
            { label: tt("status_posted", "Paid"), value: kpi.paid },
            { label: tt("status_pending", "Pending"), value: kpi.pending },
            { label: tt("status_cancelled", "Cancelled"), value: kpi.cleared }
          ]}
        />
        <KpiCard
          icon={<ClipboardList className="h-4 w-4" />}
          tone="bg-blue-600"
          title={tt("card_po_summary", "Purchase Order Summary")}
          rows={[
            { label: tt("total_po_value", "Total PO Value"), value: `${money(kpi.totalPoValue)} ${baseCurrency}` },
            { label: tt("paid_amount", "Paid Amount"), value: `${money(kpi.paidAmount)} ${baseCurrency}` },
            { label: tt("balance", "Balance"), value: `${money(kpi.balanceAmount)} ${baseCurrency}` },
            { label: tt("overdue", "Overdue"), value: kpi.overdueCount }
          ]}
        />
        <KpiCard
          icon={<BookOpen className="h-4 w-4" />}
          tone="bg-amber-500"
          title={tt("card_ledger_summary", "Ledger Posting Summary")}
          rows={[
            { label: tt("status_posted", "Posted"), value: kpi.postedCount },
            { label: tt("status_pending", "Pending"), value: kpi.pendingCount },
            { label: tt("debit", "Debit"), value: `${money(kpi.debitTotal)} ${baseCurrency}` },
            { label: tt("credit", "Credit"), value: `${money(kpi.creditTotal)} ${baseCurrency}` }
          ]}
        />
        {isSuperAdmin ? (
          <KpiCard
            icon={<Globe2 className="h-4 w-4" />}
            tone="bg-rose-600"
            title={tt("card_country_branch", "Country/Branch Report")}
            badge={
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800 text-[9px] font-black uppercase tracking-wider">
                {tt("super_admin_only", "Super Admin Only")}
              </span>
            }
            rows={[
              { label: tt("countries", "Countries"), value: kpi.countryCount },
              { label: tt("branches", "Branches"), value: kpi.branchCount },
              { label: tt("active_users", "Active Users"), value: kpi.activeUserCount },
              { label: tt("current_branch", "Current Branch"), value: session?.scopes?.summary?.branchDisplayName || (session?.scopes?.isSuperAdmin ? tt("global", "Global") : "—") }
            ]}
          />
        ) : null}
      </div>

      {/* Inline filter bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tt("search_placeholder_v3", "Search by PO No, Vendor, Payment No...")}
            className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 ps-8 pe-3 text-xs font-semibold"
          />
        </div>
        <ErpDatePicker
          mode="range"
          value={{ from: dateRange.from as any, to: dateRange.to as any }}
          onChange={(v: any) => setDateRange({ from: v.from || null, to: v.to || null })}
          size="sm"
          presets
        />
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs font-semibold">
          <option value="">{tt("all_countries", "All Countries")}</option>
          {countryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs font-semibold">
          <option value="">{tt("all_branches", "All Branches")}</option>
          {branchOptions.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs font-semibold">
          <option value="">{tt("all_status", "All Status")}</option>
          <option value="posted">{tt("status_posted", "Posted")}</option>
          <option value="draft">{tt("status_pending", "Pending")}</option>
          <option value="cancelled">{tt("status_cancelled", "Cancelled")}</option>
        </select>
        <button
          type="button"
          onClick={() => void loadPayments()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
          title={tt("refresh", "Refresh")}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery(""); setCountryFilter(""); setBranchFilter(""); setStatusFilter(""); setDateRange({ from: null, to: null });
          }}
          className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          <RotateCcw className="h-3.5 w-3.5" /> {tt("reset_all", "Reset")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (orders[0]) onOpenFullDetails(orders[0].id);
          }}
          className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 text-xs font-black text-white shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" /> {tt("new_payment", "New Payment")}
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>
      ) : null}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-300">
          {tt("purchase_order_payments", "Purchase Order Payments")} ({filtered.length})
        </div>
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <Th className="px-2.5 py-2 text-center w-8"> </Th>
              <Th className="px-2.5 py-2 text-center w-10">#</Th>
              <Th className="px-2.5 py-2 text-start">{tt("payment_no", "Payment No.")}</Th>
              <Th className="px-2.5 py-2 text-start">{tt("payment_date", "Payment Date")}</Th>
              <Th className="px-2.5 py-2 text-start">{tt("purchase_order_no", "Purchase Order No.")}</Th>
              <Th className="px-2.5 py-2 text-start">{tt("vendor", "Vendor")}</Th>
              <Th className="px-2.5 py-2 text-end">{tt("amount", "Amount")} ({baseCurrency})</Th>
              <Th className="px-2.5 py-2 text-start">{tt("payment_method", "Payment Method")}</Th>
              <Th className="px-2.5 py-2 text-start">{tt("status", "Status")}</Th>
              <Th className="px-2.5 py-2 text-start">{tt("reference", "Reference")}</Th>
              <Th className="px-2.5 py-2 text-center">{tt("actions", "Actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-400">{tt("loading", "Loading…")}</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-400">{tt("empty", "No payments found.")}</td></tr>
            ) : (
              pageRows.map((p, idx) => {
                const isChecked = checkedId === p.id;
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-t border-slate-100 dark:border-slate-800 cursor-pointer transition",
                      isChecked ? "bg-blue-50/80 dark:bg-blue-950/30" : idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/50 dark:bg-slate-900/40"
                    )}
                    onClick={() => handleCheckRow(p.id)}
                  >
                    <td className="px-2.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isChecked} onChange={() => handleCheckRow(p.id)} className="h-3.5 w-3.5 rounded border-slate-300" />
                    </td>
                    <td className="px-2.5 py-2 text-center text-slate-400 font-mono">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-2.5 py-2 font-bold text-blue-600 dark:text-blue-400 font-mono whitespace-nowrap">
                      {p.super_admin_serial || p.entry_serial || "—"}
                    </td>
                    <td className="px-2.5 py-2 font-mono whitespace-nowrap text-slate-600 dark:text-slate-300">{fmtDate(p.entry_date || p.created_at)}</td>
                    <td className="px-2.5 py-2 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">{p.purchase_order_no || "—"}</td>
                    <td className="px-2.5 py-2 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{p.vendor_name || "—"}</td>
                    <td className="px-2.5 py-2 text-end font-mono font-bold text-slate-900 dark:text-white">{money(p.amount)}</td>
                    <td className="px-2.5 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{p.payment_method_name || "—"}</td>
                    <td className="px-2.5 py-2">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border", statusBadgeClass(p.status))}>
                        {statusLabel(p.status, lang)}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{p.reference_no || "—"}</td>
                    <td className="px-2.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => handleCheckRow(p.id)} className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3.5 py-2.5 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            {tt("showing", "Showing")} {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} {tt("to", "to")}{" "}
            {Math.min(page * pageSize, filtered.length)} {tt("of", "of")} {filtered.length} {tt("entries", "entries")}
          </span>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-7 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-1.5 text-[11px]">
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / {tt("page", "page")}</option>
              ))}
            </select>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-7 px-2 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40">
              ‹
            </button>
            <span className="font-bold">{page}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="h-7 px-2 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40">
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Purchase Order Summary (Selected Payment) */}
      {checked && checkedOrder ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            {tt("po_summary_selected", "Purchase Order Summary (Selected Payment)")}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <div className="text-slate-500 dark:text-slate-400 font-semibold">{tt("purchase_order_no", "Purchase Order No.")}</div>
              <div className="font-mono font-bold text-blue-600 dark:text-blue-400">{checked.purchase_order_no || "—"}</div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400 font-semibold">{tt("vendor", "Vendor")}</div>
              <div className="font-bold text-slate-900 dark:text-white">{checked.vendor_name || "—"}</div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400 font-semibold">{tt("po_amount", "PO Amount")}</div>
              <div className="font-mono font-bold text-slate-900 dark:text-white">{money(checkedOrder.order_total)} {checked.po_currency_code || baseCurrency}</div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400 font-semibold">{tt("paid_amount", "Paid Amount")}</div>
              <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {money(Number(checkedOrder.advance_paid || 0) + Number(checkedOrder.remaining_paid || 0))} {checked.po_currency_code || baseCurrency}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400 font-semibold">{tt("balance_amount", "Balance Amount")}</div>
              <div className="font-mono font-bold text-rose-600 dark:text-rose-400">{money(checkedOrder.remaining_due)} {checked.po_currency_code || baseCurrency}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Compact "Payment Details" drawer */}
      {checked ? (
        <DetailDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={tt("payment_details", "Payment Details")}
          subtitle={checked.super_admin_serial || checked.entry_serial || undefined}
          actions={
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border", statusBadgeClass(checked.status))}>
                {statusLabel(checked.status, lang)}
              </span>
              <button
                type="button"
                onClick={() => onOpenFullDetails(checked.purchase_order_id)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Eye className="h-3.5 w-3.5" /> {tt("view_full_details", "View Full Details")}
              </button>
              <button
                type="button"
                onClick={() => checkedOrder && onPrintReceipt(checked, checkedOrder)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Printer className="h-3.5 w-3.5" /> {tt("print", "Print")}
              </button>
              <button
                type="button"
                onClick={() => checkedOrder && onDownloadPdf(checkedOrder)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" /> {tt("download_pdf", "Download PDF")}
              </button>
            </div>
          }
        >
          <DetailSection icon={<Wallet className="h-3.5 w-3.5 text-blue-600" />} title={tt("payment_overview", "Payment Overview")}>
            <DetailRow label={tt("payment_no", "Payment No.")} value={checked.super_admin_serial || checked.entry_serial} />
            <DetailRow label={tt("payment_date", "Payment Date")} value={fmtDate(checked.entry_date || checked.created_at)} />
            <DetailRow label={tt("amount", "Amount")} value={`${money(checked.amount)} ${checked.currency_code || baseCurrency}`} />
            <DetailRow label={tt("payment_method", "Payment Method")} value={checked.payment_method_name} />
            <DetailRow label={tt("status", "Status")} value={statusLabel(checked.status, lang)} />
            <DetailRow label={tt("reference_no", "Reference No.")} value={checked.reference_no} />
            <DetailRow label={tt("remarks", "Remarks")} value={checked.narration} />
          </DetailSection>

          <DetailSection icon={<ClipboardList className="h-3.5 w-3.5 text-blue-600" />} title={tt("purchase_order_details", "Purchase Order Details")}>
            <DetailRow label={tt("purchase_order_no", "PO No.")} value={checked.purchase_order_no} />
            <DetailRow label={tt("po_date", "PO Date")} value={checkedOrder ? fmtDate(checkedOrder.created_at) : undefined} />
            <DetailRow label={tt("vendor", "Vendor")} value={checked.vendor_name} />
            <DetailRow label={tt("po_amount", "PO Amount")} value={checkedOrder ? `${money(checkedOrder.order_total)} ${checked.po_currency_code || baseCurrency}` : undefined} />
            <DetailRow label={tt("paid_amount", "Paid Amount")} value={checkedOrder ? `${money(Number(checkedOrder.advance_paid || 0) + Number(checkedOrder.remaining_paid || 0))} ${checked.po_currency_code || baseCurrency}` : undefined} />
            <DetailRow label={tt("balance_amount", "Balance Amount")} value={checkedOrder ? `${money(checkedOrder.remaining_due)} ${checked.po_currency_code || baseCurrency}` : undefined} />
          </DetailSection>

          <DetailSection icon={<BookOpen className="h-3.5 w-3.5 text-blue-600" />} title={tt("ledger_posting", "Ledger Posting")}>
            <DetailRow label={tt("journal_entry", "Journal Entry")} value={checked.journal_no} />
            <DetailRow label={tt("posting_date", "Posting Date")} value={fmtDate(checked.journal_posted_at)} />
            <DetailRow label={tt("debit_account", "Debit Account")} value={checked.debit_ledger_name} />
            <DetailRow label={tt("credit_account", "Credit Account")} value={checked.credit_ledger_name} />
            <DetailRow label={tt("amount", "Amount")} value={`${money(checked.amount)} ${checked.currency_code || baseCurrency}`} />
            <DetailRow label={tt("narration", "Narration")} value={checked.narration} />
          </DetailSection>

          <DetailSection icon={<Users className="h-3.5 w-3.5 text-blue-600" />} title={tt("audit_trail", "Audit Trail")}>
            <DetailRow label={tt("created_by", "Created By")} value={checked.created_by_name} />
            <DetailRow label={tt("created_on", "Created On")} value={fmtDate(checked.created_at)} />
          </DetailSection>
        </DetailDrawer>
      ) : null}
    </div>
  );
}
