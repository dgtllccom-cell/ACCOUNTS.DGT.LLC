"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileText, Receipt, RefreshCw, Printer, Plus, Eye, Trash2, MoreHorizontal,
  Link2, Building2, Calculator, BadgePercent, Search, CheckCircle2, Undo2, BookCheck, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";
import { printStore } from "@/lib/store/print-store";

type SourceModule =
  | "purchase_booking"
  | "local_purchase"
  | "sales_booking"
  | "local_sales"
  | "shipping_bl"
  | "clearing_bill";

type BillRow = {
  id: string;
  sourceModule: SourceModule;
  billNo: string | null;
  manualBillNo: string | null;
  transactionDate: string | null;
  countryName: string | null;
  branchLabel: string;
  partyName: string | null;
  partyAccountNo: string | null;
  currency: string | null;
  originalBillAmount: number;
  expenseTotal: number;
  expenseCount: number;
  eligibility: "active" | "withdrawn";
  status: "open" | "in_progress" | "closed";
};

type Line = {
  id: string;
  rowSerial: number;
  expenseType: string;
  details: string | null;
  currency: string;
  amount: number;
  exchangeRate: number;
  localAmount: number;
  taxPct: number;
  taxAmount: number;
  grandAmount: number;
  postingStatus: "unposted" | "posted" | "void";
  roznamchaEntryId?: string | null;
};

const EXPENSE_TYPES = ["shipping", "loading", "clearing", "transport", "customs", "handling", "storage", "insurance", "other"] as const;

function money(n: number | null | undefined) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHtml(v: unknown) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type BcpSection = "all" | "purchase" | "sales" | "expenses";

/** Which source modules each top-menu section shows. */
const SECTION_MODULES: Record<BcpSection, SourceModule[] | null> = {
  all: null,
  purchase: ["purchase_booking", "local_purchase", "shipping_bl", "clearing_bill"],
  sales: ["sales_booking", "local_sales"],
  expenses: null // consolidated: bill_expenses register + Daily-Payment expenses_bills
};

export function BillExpensesView({ lang: langProp, section = "all" }: { lang?: string; section?: BcpSection }) {
  const s = useErpScreen("bexp", langProp);
  const lang = s.lang;
  const scope = useErpScope();
  const sectionModules = SECTION_MODULES[section];

  const [rows, setRows] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleTab, setModuleTab] = useState<"all" | SourceModule>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "closed">("all");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<{ originalTotal: number; expenseTotal: number; withExpenses: number; byModule: Record<string, number> } | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [openFocusForm, setOpenFocusForm] = useState(false);

  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalNode(document.getElementById("erp-page-actions-slot"));
  }, []);

  const [expensesBills, setExpensesBills] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (moduleTab !== "all") qs.set("module", moduleTab);
      else if (sectionModules) qs.set("modules", sectionModules.join(","));
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (search.trim()) qs.set("q", search.trim());
      const res = await fetch(`/api/erp/bill-expenses?${qs.toString()}`);
      const j = await res.json();
      if (j.ok) {
        setRows(j.data.rows || []);
        setSummary(j.data.summary || null);
      }
      // Consolidated "Expenses" section — also pull the Daily-Payment expenses_bills (read-only)
      if (section === "expenses") {
        const eb = await fetch(`/api/erp/bill-expenses/expenses-bills${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`)
          .then((r) => r.json())
          .catch(() => null);
        setExpensesBills(eb?.ok ? (eb.data.rows || []) : []);
      }
    } catch {
      /* keep last */
    } finally {
      setLoading(false);
    }
  }, [moduleTab, statusFilter, search, section, sectionModules]);

  useEffect(() => {
    load();
  }, [moduleTab, statusFilter, section]); // eslint-disable-line react-hooks/exhaustive-deps

  const moduleLabel = useCallback(
    (m: SourceModule) =>
      m === "purchase_booking" ? s.t("tab_purchase_booking", "Purchase Booking")
      : m === "local_purchase" ? s.t("tab_local_purchase", "Local Purchase")
      : m === "sales_booking" ? s.t("tab_sales_booking", "Sales Booking")
      : m === "local_sales" ? s.t("tab_local_sales", "Local Sales")
      : m === "shipping_bl" ? s.t("tab_shipping_bl", "Shipping / BL")
      : s.t("tab_clearing_bill", "Clearing Bill"),
    [s]
  );

  const statusLabel = useCallback(
    (st: BillRow["status"] | "all") =>
      st === "open" ? s.t("status_open", "Open")
      : st === "in_progress" ? s.t("status_in_progress", "In Progress")
      : st === "closed" ? s.t("status_closed", "Closed")
      : "—",
    [s]
  );

  const reportColumns: GenericReportColumn[] = useMemo(
    () => [
      { key: (r: any) => moduleLabel(r.sourceModule), label: s.t("col_source", "Source Module") },
      { key: "billNo", label: s.t("col_bill_no", "Bill No.") },
      { key: (r: any) => r.manualBillNo || "—", label: s.t("col_manual_bill", "Manual Bill / Contract") },
      { key: (r: any) => (r.transactionDate ? new Date(r.transactionDate).toLocaleDateString("en-GB") : "—"), label: s.t("col_date", "Date") },
      { key: (r: any) => r.countryName || "—", label: s.t("col_country", "Country") },
      { key: "branchLabel", label: s.t("col_branch", "Branch") },
      { key: (r: any) => r.partyName || r.partyAccountNo || "—", label: s.t("col_party", "Party / Account") },
      { key: "currency", label: s.t("col_currency", "Currency"), align: "center" },
      { key: (r: any) => money(r.originalBillAmount), label: s.t("col_original_amount", "Original Bill Amount"), align: "right" },
      { key: (r: any) => money(r.expenseTotal), label: s.t("col_expense_total", "Expense Total"), align: "right" },
      { key: (r: any) => statusLabel(r.status), label: s.t("col_status", "Status"), align: "center" }
    ],
    [s, moduleLabel, statusLabel]
  );

  function printRegister() {
    void openScopedGenericReport({
      title: s.t("report_title", "Bill Expenses Register"),
      subtitle: s.t("subtitle", "Additional expenses recorded against submitted Purchase & Sales bills."),
      lang,
      columns: reportColumns,
      rows: rows as unknown as Record<string, unknown>[],
      orientation: "landscape",
      countryId: scope.lockedCountryId,
      countryBranchId: scope.lockedCountryBranchId,
      cityBranchId: scope.lockedCityBranchId,
      countryName: scope.countryName,
      branchName: scope.branchDisplayName,
      printedBy: scope.userName,
      filters: [
        { label: s.t("col_source", "Source Module"), value: moduleTab === "all" ? s.t("tab_all", "All Bills") : moduleLabel(moduleTab) },
        { label: s.t("col_status", "Status"), value: statusLabel(statusFilter) },
        { label: s.t("summary_bills", "Bills"), value: String(rows.length) }
      ],
      summary: {
        [s.t("summary_bills", "Bills")]: String(rows.length),
        [s.t("summary_original", "Original Total")]: money(summary?.originalTotal),
        [s.t("summary_expenses", "Expenses Total")]: money(summary?.expenseTotal),
        [s.t("summary_with_expenses", "Bills with Expenses")]: String(summary?.withExpenses ?? 0)
      }
    });
  }

  const filtersActive = moduleTab !== "all" || statusFilter !== "all" || !!search.trim();

  const summaryCards = summary
    ? [
        { label: s.t("summary_bills", "Bills"), value: String(rows.length), accent: "border-t-indigo-500", icon: FileText },
        { label: s.t("summary_original", "Original Total"), value: money(summary.originalTotal), accent: "border-t-blue-500", icon: Receipt },
        { label: s.t("summary_expenses", "Expenses Total"), value: money(summary.expenseTotal), accent: "border-t-rose-500", icon: Calculator },
        { label: s.t("summary_with_expenses", "Bills with Expenses"), value: String(summary.withExpenses), accent: "border-t-emerald-500", icon: BadgePercent },
        {
          label: s.t("tab_purchase_booking", "Purchase Booking"),
          value: String(summary.byModule?.purchase_booking ?? 0),
          sub: `${s.t("tab_sales_booking", "Sales Booking")}: ${summary.byModule?.sales_booking ?? 0}`,
          accent: "border-t-amber-400",
          icon: Building2
        }
      ]
    : [];

  return (
    <div dir={s.dir} className="min-h-screen bg-slate-50 p-4 md:p-6 pb-24 text-sm font-sans dark:bg-slate-950">
      <div className="print:hidden space-y-4">
        {/* Page header — into the standard ERP page-actions slot */}
        {portalNode &&
          createPortal(
            <div className="flex items-center gap-2">
              <span className="mr-1 hidden items-center gap-1.5 text-xs font-bold text-slate-500 sm:flex">
                <Receipt className="h-3.5 w-3.5 text-primary" />
                {s.t("title", "Bill Expenses")}
              </span>
              <Button size="sm" onClick={load} variant="outline" className="h-7 text-xs shadow-sm">
                <RefreshCw className="mr-1 h-3 w-3" /> {s.tGlobal("common.refresh", "Refresh")}
              </Button>
              <Button
                size="sm"
                onClick={printRegister}
                className="h-7 bg-blue-600 text-xs text-white shadow-sm hover:bg-blue-700"
              >
                <Printer className="mr-1 h-3 w-3" /> {s.t("print_report", "Print Report")}
              </Button>
            </div>,
            portalNode
          )}

        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
            <Receipt className="h-4 w-4 text-primary" /> {s.t("title", "Bill Expenses")}
          </h2>
          <p className="mt-0.5 max-w-3xl text-xs text-slate-500">{s.t("subtitle", "Additional expenses recorded against submitted Purchase & Sales bills — the original bill is referenced, never re-entered.")}</p>
        </div>

        {/* Summary cards — colored top border, matching the Expenses Bill design family */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {summaryCards.map((c) => (
            <Card key={c.label} className={`border-t-4 ${c.accent} shadow-sm opacity-90 transition-opacity hover:opacity-100`}>
              <CardHeader className="border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                <CardTitle className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300">
                  <c.icon className="h-3.5 w-3.5" /> {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="font-mono text-lg font-black text-slate-800 dark:text-white">{c.value}</div>
                {c.sub && <div className="mt-0.5 text-[10px] text-slate-400">{c.sub}</div>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter bar */}
        <Card className="shadow-sm">
          <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...(sectionModules ?? ["purchase_booking", "local_purchase", "sales_booking", "local_sales", "shipping_bl", "clearing_bill"])] as Array<"all" | SourceModule>).map((m) => (
                <button
                  key={m}
                  onClick={() => setModuleTab(m)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    moduleTab === m
                      ? "bg-primary text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {m === "all" ? s.t("tab_all", "All Bills") : moduleLabel(m)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className={`absolute top-2.5 h-3.5 w-3.5 text-slate-400 ${s.isRtl ? "right-2.5" : "left-2.5"}`} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  placeholder={`${s.t("col_bill_no", "Bill No.")} / ${s.t("col_party", "Party / Account")}`}
                  className={`w-56 rounded-md border border-slate-200 bg-white py-2 text-xs dark:border-slate-800 dark:bg-slate-900 ${s.isRtl ? "pr-8 pl-3" : "pl-8 pr-3"}`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className={`rounded-md border px-2.5 py-2 text-xs ${
                  statusFilter !== "all"
                    ? "border-blue-400 bg-blue-50 font-semibold text-blue-700 dark:border-blue-700 dark:bg-blue-950/40"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <option value="all">{s.t("col_status", "Status")}</option>
                <option value="open">{s.t("status_open", "Open")}</option>
                <option value="in_progress">{s.t("status_in_progress", "In Progress")}</option>
                <option value="closed">{s.t("status_closed", "Closed")}</option>
              </select>
              {filtersActive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setModuleTab("all"); setStatusFilter("all"); setSearch(""); setTimeout(load, 0); }}
                >
                  {s.t("clear_filters", "Clear Filters")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Register table */}
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/60">
                <tr>
                  <th className={`px-4 py-3 font-semibold ${s.textStart}`}>{s.t("col_source", "Source Module")}</th>
                  <th className={`px-4 py-3 font-semibold ${s.textStart}`}>{s.t("col_bill_no", "Bill No.")}</th>
                  <th className={`px-4 py-3 font-semibold ${s.textStart}`}>{s.t("col_manual_bill", "Manual Bill / Contract")}</th>
                  <th className={`px-4 py-3 font-semibold ${s.textStart}`}>{s.t("col_date", "Date")}</th>
                  <th className={`px-4 py-3 font-semibold ${s.textStart}`}>{s.t("col_branch", "Branch")}</th>
                  <th className={`px-4 py-3 font-semibold ${s.textStart}`}>{s.t("col_party", "Party / Account")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{s.t("col_original_amount", "Original Bill Amount")}</th>
                  <th className="px-4 py-3 text-right font-black bg-slate-100 text-slate-800 dark:bg-slate-800">{s.t("col_expense_total", "Expense Total")}</th>
                  <th className="px-4 py-3 text-center font-semibold">{s.t("col_status", "Status")}</th>
                  <th className="px-4 py-3 text-center font-semibold w-24">{s.t("col_actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                      <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-slate-300" />
                      {s.tGlobal("common.loading", "Loading…")}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                      <FileText className="mx-auto mb-3 h-8 w-8 opacity-20" />
                      {filtersActive
                        ? s.t("empty_filtered", "No bills match the selected filters.")
                        : s.t("empty", "No submitted bills yet.")}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <BillExpenseRow
                      key={r.id}
                      r={r}
                      s={s}
                      moduleLabel={moduleLabel}
                      statusLabel={statusLabel}
                      onView={() => { setOpenId(r.id); setOpenFocusForm(false); }}
                      onAdd={() => { setOpenId(r.id); setOpenFocusForm(true); }}
                    />
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-end font-black text-slate-600 dark:text-slate-300">
                    {s.t("summary_expenses", "Expenses Total")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-500">{money(summary?.originalTotal)}</td>
                  <td className="px-4 py-3 text-right font-mono text-lg font-black text-primary">{money(summary?.expenseTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Consolidated view — Daily-Payment Expenses Bills (read-only, no re-posting here) */}
        {section === "expenses" && (
          <Card className="mt-4 overflow-hidden shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
              <CardTitle className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300">
                <Receipt className="h-3.5 w-3.5" /> {s.t("daily_expenses_bills", "Daily Payment — Expenses Bills")}
                <span className="ml-1 rounded bg-slate-200 px-1.5 text-[10px] text-slate-500 dark:bg-slate-700">{expensesBills.length}</span>
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-900/40">
                  <tr>
                    <th className={`px-3 py-2 font-semibold ${s.textStart}`}>{s.t("col_bill_no", "Bill No.")}</th>
                    <th className={`px-3 py-2 font-semibold ${s.textStart}`}>{s.t("f_details", "Details / Narration")}</th>
                    <th className={`px-3 py-2 font-semibold ${s.textStart}`}>{s.t("col_date", "Date")}</th>
                    <th className={`px-3 py-2 font-semibold ${s.textStart}`}>{s.t("col_branch", "Branch")}</th>
                    <th className="px-3 py-2 text-right font-semibold">{s.t("f_grand_amount", "Grand Amount")}</th>
                    <th className="px-3 py-2 text-center font-semibold">{s.t("f_posting", "Accounting")}</th>
                    <th className="px-3 py-2 text-center font-semibold w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expensesBills.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">{s.t("no_daily_expenses", "No Daily-Payment expense bills in your scope.")}</td></tr>
                  ) : (
                    expensesBills.map((b: any) => (
                      <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-mono font-semibold">{b.billSerial || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{b.billTitle || "—"}</td>
                        <td className="px-3 py-2">{b.billDate ? new Date(b.billDate).toLocaleDateString("en-GB") : "—"}</td>
                        <td className="px-3 py-2">{b.branchLabel || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{b.currency || ""} {money(b.grandTotal)}</td>
                        <td className="px-3 py-2 text-center">
                          {b.transferredToRoznamcha ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> {s.t("posting_posted", "Posted")}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">{s.t("posting_unposted", "Not posted")}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <a href="/dashboard/roznamcha/expenses-bill" className="text-[10px] text-blue-600 hover:underline dark:text-blue-400">{s.t("open", "Open")}</a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {openId && (
        <BillExpenseDetailModal
          id={openId}
          s={s}
          focusForm={openFocusForm}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

/* ── Register row: matches the ExpensesBillRow pattern (Eye + MoreHorizontal menu) ── */
function BillExpenseRow({
  r, s, moduleLabel, statusLabel, onView, onAdd
}: {
  r: BillRow;
  s: ReturnType<typeof useErpScreen>;
  moduleLabel: (m: SourceModule) => string;
  statusLabel: (st: BillRow["status"] | "all") => string;
  onView: () => void;
  onAdd: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <td className="px-4 py-3">
        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {moduleLabel(r.sourceModule)}
        </span>
      </td>
      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.billNo || "—"}</td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.manualBillNo || "—"}</td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
        {r.transactionDate ? new Date(r.transactionDate).toLocaleDateString("en-GB") : "—"}
      </td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.branchLabel}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800 dark:text-white">{r.partyName || "—"}</div>
        {r.partyAccountNo && <div className="text-[10px] text-slate-400">{r.partyAccountNo}</div>}
      </td>
      <td className="px-4 py-3 text-right font-mono">
        <span className="mr-1 text-xs font-normal text-slate-400">{r.currency}</span>
        {money(r.originalBillAmount)}
      </td>
      <td className="bg-slate-50/50 px-4 py-3 text-right font-mono font-bold text-rose-600 dark:bg-slate-800/40">
        {money(r.expenseTotal)}
        {r.expenseCount > 0 && <span className="ml-1 text-[10px] font-normal text-slate-400">({r.expenseCount})</span>}
      </td>
      <td className="px-4 py-3 text-center">
        {r.eligibility === "withdrawn" ? (
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {s.t("eligibility_withdrawn", "Withdrawn")}
          </span>
        ) : (
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {statusLabel(r.status)}
          </span>
        )}
      </td>
      <td className="relative px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1" ref={ref}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            onClick={onView}
            title={s.t("open_detail", "Open")}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setMenuOpen(!menuOpen)}>
              <MoreHorizontal className="h-4 w-4 text-slate-500" />
            </Button>
            {menuOpen && (
              <div className={`absolute z-50 mt-1 w-44 overflow-hidden rounded-md border bg-white py-1 text-left text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 ${s.isRtl ? "left-0" : "right-0"}`}>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => { setMenuOpen(false); onView(); }}>
                  <Eye className="h-4 w-4" /> {s.t("open_detail", "Open")}
                </button>
                {r.eligibility === "active" && (
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => { setMenuOpen(false); onAdd(); }}>
                    <Plus className="h-4 w-4" /> {s.t("add_expense", "Add Expense")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ── Detail modal: Original Bill card + Additional Expenses table + Add form ── */
function BillExpenseDetailModal({
  id, s, focusForm, onClose, onChanged
}: {
  id: string;
  s: ReturnType<typeof useErpScreen>;
  focusForm: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ expenseType: "shipping", details: "", currency: "", amount: "", exchangeRate: "1", taxPct: "0" });
  const formRef = useRef<HTMLDivElement>(null);

  // Phase 2 — DR/CR posting
  const [ledgers, setLedgers] = useState<Array<{ id: string; code: string | null; name: string; currency: string | null }>>([]);
  const [postLine, setPostLine] = useState<Line | null>(null);
  const [postForm, setPostForm] = useState({ expenseAccountId: "", counterAccountId: "" });
  const [postBusy, setPostBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/bill-expenses/${id}`);
      const j = await res.json();
      if (j.ok) {
        setData(j.data);
        setForm((f) => ({ ...f, currency: f.currency || j.data.billExpense.currency || "USD" }));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (focusForm && !loading && formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusForm, loading]);

  // Load ledgers scoped to this bill's country/branch for the DR/CR pickers
  const beScope = data?.billExpense;
  useEffect(() => {
    if (!beScope) return;
    const qs = new URLSearchParams();
    if (beScope.countryId) qs.set("countryId", beScope.countryId);
    if (beScope.countryBranchId) qs.set("countryBranchId", beScope.countryBranchId);
    if (beScope.cityBranchId) qs.set("cityBranchId", beScope.cityBranchId);
    fetch(`/api/erp/ledgers?${qs.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        const rows = j?.data?.ledgers ?? j?.ledgers ?? j?.data ?? [];
        if (Array.isArray(rows)) setLedgers(rows.map((l: any) => ({ id: l.id, code: l.code ?? null, name: l.name, currency: l.currency ?? null })));
      })
      .catch(() => {});
  }, [beScope?.countryId, beScope?.countryBranchId, beScope?.cityBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doPost() {
    if (!postLine || !postForm.expenseAccountId || !postForm.counterAccountId) return;
    if (postForm.expenseAccountId === postForm.counterAccountId) {
      setErr(s.t("v_diff_accounts", "The expense account and the counter account must be different."));
      return;
    }
    setPostBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/erp/bill-expenses/${id}/lines/${postLine.id}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postForm)
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.error?.message || "");
      setPostLine(null);
      setPostForm({ expenseAccountId: "", counterAccountId: "" });
      await reload();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : s.t("post_failed", "Could not post this expense to the accounts."));
    } finally {
      setPostBusy(false);
    }
  }

  async function voidLine(lineId: string) {
    if (!confirm(s.t("void_confirm", "Reverse the accounting entry for this expense line? A balanced contra entry is posted; nothing is deleted."))) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/erp/bill-expenses/${id}/lines/${lineId}/void`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.error?.message || "");
      await reload();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : s.t("void_failed", "Could not void this posting."));
    } finally {
      setBusy(false);
    }
  }

  const be = data?.billExpense;
  const lines: Line[] = data?.lines ?? [];
  const src = data?.sourceBill;

  const localAmount = (Number(form.amount) || 0) * (Number(form.exchangeRate) || 0);
  const grand = localAmount + localAmount * ((Number(form.taxPct) || 0) / 100);

  async function addExpense() {
    setErr(null);
    if (!(Number(form.amount) > 0)) return setErr(s.t("v_amount_required", "Enter an amount greater than zero."));
    if (!form.currency.trim()) return setErr(s.t("v_currency_required", "Select a currency."));
    if (!(Number(form.exchangeRate) > 0)) return setErr(s.t("v_rate_required", "Exchange rate must be greater than zero."));
    setBusy(true);
    try {
      const res = await fetch(`/api/erp/bill-expenses/${id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseType: form.expenseType,
          details: form.details || null,
          currency: form.currency.trim().toUpperCase(),
          amount: Number(form.amount),
          exchangeRate: Number(form.exchangeRate),
          taxPct: Number(form.taxPct)
        })
      });
      if (!res.ok) throw new Error();
      setForm((f) => ({ ...f, details: "", amount: "", taxPct: "0" }));
      await reload();
      onChanged();
    } catch {
      setErr(s.t("toast_error", "Could not save the expense. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function removeLine(lineId: string) {
    setBusy(true);
    try {
      await fetch(`/api/erp/bill-expenses/${id}/lines`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId })
      });
      await reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function printBill() {
    if (!be) return;
    const rowsHtml = lines
      .map(
        (l, i) => `<tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${escapeHtml(s.t(`et_${l.expenseType}`, l.expenseType))}</td>
          <td>${escapeHtml(l.details || "-")}</td>
          <td style="text-align:right">${escapeHtml(l.currency)} ${money(l.amount)}</td>
          <td style="text-align:right">${l.exchangeRate}</td>
          <td style="text-align:right">${money(l.localAmount)}</td>
          <td style="text-align:right">${l.taxPct}%</td>
          <td style="text-align:right;font-weight:bold">${money(l.grandAmount)}</td>
        </tr>`
      )
      .join("");
    const html = `<!doctype html><html dir="${s.dir}"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:14mm}
      body{font-family:'Segoe UI',Tahoma,sans-serif;color:#0f172a;font-size:12px}
      h1{font-size:16px;margin:0 0 2px}
      .muted{color:#64748b;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #cbd5e1;padding:6px 8px}
      th{background:#f1f5f9;text-transform:uppercase;font-size:10px;text-align:${s.isRtl ? "right" : "left"}}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;margin-top:8px}
      .grid div span{color:#64748b}
      tfoot td{background:#f8fafc;font-weight:bold}
    </style></head><body>
      <h1>${escapeHtml(s.t("report_title", "Bill Expenses Register"))}</h1>
      <div class="muted">${escapeHtml(be.branchLabel || "")}</div>
      <div class="grid">
        <div><span>${escapeHtml(s.t("col_bill_no", "Bill No."))}:</span> <b>${escapeHtml(be.billNo || "-")}</b></div>
        <div><span>${escapeHtml(s.t("col_manual_bill", "Manual Bill / Contract"))}:</span> <b>${escapeHtml(be.manualBillNo || "-")}</b></div>
        <div><span>${escapeHtml(s.t("col_date", "Date"))}:</span> ${be.transactionDate ? new Date(be.transactionDate).toLocaleDateString("en-GB") : "-"}</div>
        <div><span>${escapeHtml(s.t("col_country", "Country"))}:</span> ${escapeHtml(be.countryName || "-")}</div>
        <div><span>${escapeHtml(s.t("col_party", "Party / Account"))}:</span> ${escapeHtml(be.partyName || be.partyAccountNo || "-")}</div>
        <div><span>${escapeHtml(s.t("col_original_amount", "Original Bill Amount"))}:</span> <b>${escapeHtml(be.currency || "")} ${money(be.originalBillAmount)}</b></div>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>${escapeHtml(s.t("expense_type", "Expense Type"))}</th><th>${escapeHtml(s.t("f_details", "Details / Narration"))}</th>
          <th>${escapeHtml(s.t("f_amount", "Amount"))}</th><th>${escapeHtml(s.t("f_exchange_rate", "Exchange Rate"))}</th>
          <th>${escapeHtml(s.t("f_local_amount", "Local Amount"))}</th><th>${escapeHtml(s.t("f_tax_pct", "Tax %"))}</th><th>${escapeHtml(s.t("f_grand_amount", "Grand Amount"))}</th>
        </tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="8" style="text-align:center;color:#94a3b8">${escapeHtml(s.t("no_lines", "No additional expenses recorded against this bill yet."))}</td></tr>`}</tbody>
        <tfoot><tr><td colspan="7" style="text-align:${s.isRtl ? "left" : "right"}">${escapeHtml(s.t("f_grand_amount", "Grand Amount"))}</td><td style="text-align:right">${money(be.expenseTotal)}</td></tr></tfoot>
      </table>
    </body></html>`;
    printStore.openPrint(html, `${s.t("report_title", "Bill Expenses Register")} — ${be.billNo ?? ""}`.trim(), { lang: s.lang });
  }

  return (
    <SimpleModal
      onClose={onClose}
      title={`${s.t("title", "Bill Expenses")} — ${be?.billNo ?? ""}`.trim()}
      className="max-w-[1100px] w-[95vw]"
    >
      <div dir={s.dir} className="flex flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-50 p-4 dark:bg-slate-950">
          {loading || !be ? (
            <div className="py-10 text-center text-slate-400">
              <RefreshCw className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Original bill — read-only auto-fill card */}
              <Card className="border-t-4 border-t-indigo-500 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                  <CardTitle className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300">
                    <Link2 className="h-3.5 w-3.5" /> {s.t("original_bill", "Original Bill (auto-filled — read only)")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs md:grid-cols-3">
                    {[
                      [s.t("col_source", "Source Module"), be.sourceModule],
                      [s.t("col_bill_no", "Bill No."), be.billNo],
                      [s.t("col_manual_bill", "Manual Bill / Contract"), be.manualBillNo],
                      [s.t("col_date", "Date"), be.transactionDate ? new Date(be.transactionDate).toLocaleDateString("en-GB") : null],
                      [s.t("col_country", "Country"), be.countryName],
                      [s.t("col_branch", "Branch"), be.branchLabel],
                      [s.t("col_party", "Party / Account"), be.partyName || be.partyAccountNo],
                      [s.t("col_currency", "Currency"), be.currency],
                      [s.t("col_original_amount", "Original Bill Amount"), `${be.currency ?? ""} ${money(be.originalBillAmount)}`],
                      ...(src?.goods_name || src?.product_summary ? [[s.t("f_details", "Details / Narration"), src.goods_name || src.product_summary]] : [])
                    ].map(([k, v], i) => (
                      <div key={i} className="flex flex-col">
                        <span className="text-[10px] uppercase text-slate-400">{k}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{v || "—"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Additional expenses table */}
              <Card className="overflow-hidden shadow-sm">
                <CardHeader className="flex-row items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                  <CardTitle className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300">
                    <Calculator className="h-3.5 w-3.5" /> {s.t("additional_expenses", "Additional Expenses")}
                  </CardTitle>
                  <span className="font-mono text-xs font-bold text-rose-600">{money(be.expenseTotal)}</span>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-900/40">
                      <tr>
                        <th className="px-3 py-2 text-center font-semibold w-8">#</th>
                        <th className={`px-3 py-2 font-semibold ${s.textStart}`}>{s.t("expense_type", "Expense Type")}</th>
                        <th className={`px-3 py-2 font-semibold ${s.textStart}`}>{s.t("f_details", "Details / Narration")}</th>
                        <th className="px-3 py-2 text-right font-semibold">{s.t("f_amount", "Amount")}</th>
                        <th className="px-3 py-2 text-right font-semibold">{s.t("f_exchange_rate", "Exchange Rate")}</th>
                        <th className="px-3 py-2 text-right font-semibold">{s.t("f_tax_pct", "Tax %")}</th>
                        <th className="px-3 py-2 text-right font-black bg-slate-100 dark:bg-slate-800">{s.t("f_grand_amount", "Grand Amount")}</th>
                        <th className="px-3 py-2 text-center font-semibold">{s.t("f_posting", "Accounting")}</th>
                        <th className="px-3 py-2 text-center font-semibold w-8">{s.t("col_actions", "Actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-10 text-center text-slate-400">
                            <Calculator className="mx-auto mb-2 h-6 w-6 opacity-20" />
                            {s.t("no_lines", "No additional expenses recorded against this bill yet.")}
                          </td>
                        </tr>
                      ) : (
                        lines.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-3 py-2 text-center font-bold text-slate-400">{l.rowSerial}</td>
                            <td className="px-3 py-2 font-semibold">{s.t(`et_${l.expenseType}`, l.expenseType)}</td>
                            <td className="px-3 py-2 text-slate-500">{l.details || "—"}</td>
                            <td className="px-3 py-2 text-right font-mono">{l.currency} {money(l.amount)}</td>
                            <td className="px-3 py-2 text-right font-mono">{Number(l.exchangeRate).toFixed(4)}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              {l.taxPct > 0 ? (
                                <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">
                                  <BadgePercent className="mr-0.5 h-3 w-3" /> {l.taxPct}%
                                </span>
                              ) : "—"}
                            </td>
                            <td className="bg-slate-50/50 px-3 py-2 text-right font-mono font-bold dark:bg-slate-800/40">{l.currency} {money(l.grandAmount)}</td>
                            <td className="px-3 py-2 text-center">
                              {l.postingStatus === "posted" ? (
                                <span className="inline-flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3" /> {s.t("posting_posted", "Posted")}
                                  </span>
                                  {l.roznamchaEntryId && (
                                    <a
                                      href={`/dashboard/roznamcha/super-admin?entry=${l.roznamchaEntryId}`}
                                      className="text-[9px] font-mono text-blue-600 hover:underline dark:text-blue-400"
                                    >
                                      {s.t("posting_view_journal", "View journal")}
                                    </a>
                                  )}
                                </span>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 gap-1 px-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                                  onClick={() => { setPostForm({ expenseAccountId: "", counterAccountId: "" }); setPostLine(l); }}
                                  disabled={busy || be.eligibility !== "active"}
                                >
                                  <BookCheck className="h-3 w-3" /> {s.t("posting_post", "Post")}
                                </Button>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {l.postingStatus === "posted" ? (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-500 hover:bg-amber-50 hover:text-amber-700" onClick={() => voidLine(l.id)} disabled={busy} title={s.t("posting_void", "Void posting")}>
                                  <Undo2 className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeLine(l.id)} disabled={busy}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Add-expense card */}
              {be.eligibility === "active" && (
                <div ref={formRef}>
                <Card className="border-t-4 border-t-amber-400 shadow-sm">
                  <CardHeader className="border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                    <CardTitle className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300">
                      <Plus className="h-3.5 w-3.5" /> {s.t("add_expense", "Add Expense")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      <label className="text-xs">
                        <span className="mb-1 block font-semibold text-slate-500">{s.t("expense_type", "Expense Type")}</span>
                        <select value={form.expenseType} onChange={(e) => setForm({ ...form, expenseType: e.target.value })} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950">
                          {EXPENSE_TYPES.map((t) => <option key={t} value={t}>{s.t(`et_${t}`, t)}</option>)}
                        </select>
                      </label>
                      <label className="text-xs">
                        <span className="mb-1 block font-semibold text-slate-500">{s.t("col_currency", "Currency")}</span>
                        <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs uppercase dark:border-slate-700 dark:bg-slate-950" />
                      </label>
                      <label className="col-span-2 text-xs md:col-span-1">
                        <span className="mb-1 block font-semibold text-slate-500">{s.t("f_details", "Details / Narration")}</span>
                        <input value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950" />
                      </label>
                      <label className="text-xs">
                        <span className="mb-1 block font-semibold text-slate-500">{s.t("f_amount", "Amount")}</span>
                        <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-right font-mono text-xs dark:border-slate-700 dark:bg-slate-950" />
                      </label>
                      <label className="text-xs">
                        <span className="mb-1 block font-semibold text-slate-500">{s.t("f_exchange_rate", "Exchange Rate")}</span>
                        <input type="number" inputMode="decimal" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-right font-mono text-xs dark:border-slate-700 dark:bg-slate-950" />
                      </label>
                      <label className="text-xs">
                        <span className="mb-1 block font-semibold text-slate-500">{s.t("f_tax_pct", "Tax %")}</span>
                        <input type="number" inputMode="decimal" value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: e.target.value })} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-right font-mono text-xs dark:border-slate-700 dark:bg-slate-950" />
                      </label>
                      <div className="col-span-2 text-xs md:col-span-1">
                        <span className="mb-1 block font-semibold text-slate-500">{s.t("f_grand_amount", "Grand Amount")}</span>
                        <div className="rounded-md bg-primary/5 px-2.5 py-2 text-right font-mono font-bold text-primary">{money(grand)}</div>
                      </div>
                    </div>
                    {err && (
                      <p className="mt-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>
                    )}
                    <div className="mt-3 flex justify-end">
                      <Button onClick={addExpense} disabled={busy} className="px-6 font-bold shadow-md shadow-primary/20">
                        {busy ? s.t("f_saving", "Saving…") : s.t("f_save", "Save Expense")}
                        {!busy && <Plus className="ml-2 h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — Close / Print PDF (mirrors the Expenses Bill view modal) */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 print:hidden">
          <Button variant="outline" onClick={onClose}>{s.t("close", "Close")}</Button>
          <Button onClick={printBill} className="bg-blue-600 text-white shadow-sm hover:bg-blue-700">
            <Printer className="mr-1.5 h-4 w-4" /> {s.t("print_report", "Print Report")}
          </Button>
        </div>
      </div>

      {/* Phase 2 — DR/CR posting modal */}
      {postLine && (
        <SimpleModal onClose={() => setPostLine(null)} title={s.t("posting_title", "Post Expense to Accounts")} className="max-w-md w-[92vw]">
          <div dir={s.dir} className="space-y-3 p-1 text-sm">
            <p className="text-xs text-slate-500">
              {s.t("posting_intro", "Books a balanced double entry through the existing Journal / Ledger / Roznamcha engine. Nothing new is created — the same posting path as a Daily-Payment expense.")}
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex justify-between"><span className="text-slate-500">{s.t("expense_type", "Expense Type")}</span><span className="font-bold">{s.t(`et_${postLine.expenseType}`, postLine.expenseType)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{s.t("f_grand_amount", "Grand Amount")}</span><span className="font-mono font-bold">{postLine.currency} {money(postLine.grandAmount)}</span></div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{s.t("posting_expense_account", "Expense Account (Debit)")}</label>
              <select
                value={postForm.expenseAccountId}
                onChange={(e) => setPostForm((f) => ({ ...f, expenseAccountId: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{s.t("posting_select_account", "Select account…")}</option>
                {ledgers.map((l) => <option key={l.id} value={l.id}>{l.code ? `${l.code} — ` : ""}{l.name}{l.currency ? ` (${l.currency})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{s.t("posting_counter_account", "Counter Account (Credit — payable / bank / cash)")}</label>
              <select
                value={postForm.counterAccountId}
                onChange={(e) => setPostForm((f) => ({ ...f, counterAccountId: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{s.t("posting_select_account", "Select account…")}</option>
                {ledgers.map((l) => <option key={l.id} value={l.id}>{l.code ? `${l.code} — ` : ""}{l.name}{l.currency ? ` (${l.currency})` : ""}</option>)}
              </select>
            </div>
            {postForm.expenseAccountId && postForm.counterAccountId && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] font-mono dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <div>DR {ledgers.find((l) => l.id === postForm.expenseAccountId)?.name} &nbsp; {money(postLine.grandAmount)}</div>
                <div>CR {ledgers.find((l) => l.id === postForm.counterAccountId)?.name} &nbsp; {money(postLine.grandAmount)}</div>
              </div>
            )}
            {err && <p className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setPostLine(null)} disabled={postBusy}>{s.t("cancel", "Cancel")}</Button>
              <Button size="sm" onClick={doPost} disabled={postBusy || !postForm.expenseAccountId || !postForm.counterAccountId} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {postBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <BookCheck className="mr-1.5 h-3.5 w-3.5" />}
                {s.t("posting_confirm", "Post to Accounts")}
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}
    </SimpleModal>
  );
}
