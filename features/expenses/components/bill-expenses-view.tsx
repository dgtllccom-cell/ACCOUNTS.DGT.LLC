"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Receipt, RefreshCw, Printer, X, Plus, Trash2, Link2, FileText, Search, ChevronRight
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";
import { DataEmptyState } from "@/components/ui/data-empty-state";

type SourceModule = "purchase_booking" | "local_purchase" | "sales_booking" | "local_sales";

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
};

const EXPENSE_TYPES = ["shipping", "loading", "clearing", "transport", "customs", "handling", "storage", "insurance", "other"] as const;

function money(n: number | null | undefined) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BillExpensesView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("bexp", langProp);
  const lang = s.lang;
  const scope = useErpScope();

  const [rows, setRows] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleTab, setModuleTab] = useState<"all" | SourceModule>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "closed">("all");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<{ originalTotal: number; expenseTotal: number; withExpenses: number } | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (moduleTab !== "all") qs.set("module", moduleTab);
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (search.trim()) qs.set("q", search.trim());
      const res = await fetch(`/api/erp/bill-expenses?${qs.toString()}`);
      const j = await res.json();
      if (j.ok) {
        setRows(j.data.rows || []);
        setSummary(j.data.summary || null);
      }
    } catch {
      /* keep last */
    } finally {
      setLoading(false);
    }
  }, [moduleTab, statusFilter, search]);

  useEffect(() => {
    load();
  }, [moduleTab, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const moduleLabel = (m: SourceModule) =>
    m === "purchase_booking" ? s.t("tab_purchase_booking", "Purchase Booking")
    : m === "local_purchase" ? s.t("tab_local_purchase", "Local Purchase")
    : m === "sales_booking" ? s.t("tab_sales_booking", "Sales Booking")
    : s.t("tab_local_sales", "Local Sales");

  const statusLabel = (st: BillRow["status"]) =>
    st === "open" ? s.t("status_open", "Open")
    : st === "in_progress" ? s.t("status_in_progress", "In Progress")
    : s.t("status_closed", "Closed");

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
    [s, lang] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function printReport() {
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
        { label: s.t("col_status", "Status"), value: statusFilter === "all" ? "—" : statusLabel(statusFilter as any) },
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

  return (
    <section dir={s.dir} className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/50">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{s.t("title", "Bill Expenses")}</h1>
            <p className="max-w-2xl text-xs text-slate-500">{s.t("subtitle", "Additional expenses recorded against submitted Purchase & Sales bills — the original bill is referenced, never re-entered.")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={printReport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
          >
            <Printer className="h-4 w-4" /> {s.t("print_report", "Print Report")}
          </button>
          <button
            onClick={load}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: s.t("summary_bills", "Bills"), value: String(rows.length) },
            { label: s.t("summary_original", "Original Total"), value: money(summary.originalTotal) },
            { label: s.t("summary_expenses", "Expenses Total"), value: money(summary.expenseTotal) },
            { label: s.t("summary_with_expenses", "Bills with Expenses"), value: String(summary.withExpenses) }
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</div>
              <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "purchase_booking", "local_purchase", "sales_booking", "local_sales"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModuleTab(m)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                moduleTab === m
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {m === "all" ? s.t("tab_all", "All Bills") : moduleLabel(m)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className={`absolute top-2.5 h-3.5 w-3.5 text-slate-400 ${s.isRtl ? "right-2.5" : "left-2.5"}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder={`${s.t("col_bill_no", "Bill No.")} / ${s.t("col_party", "Party / Account")}`}
              className={`w-56 rounded-xl border border-slate-200 bg-white py-2 text-xs dark:border-slate-800 dark:bg-slate-900 ${s.isRtl ? "pr-8 pl-3" : "pl-8 pr-3"}`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={`rounded-xl border px-2.5 py-2 text-xs ${
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
            <button
              onClick={() => { setModuleTab("all"); setStatusFilter("all"); setSearch(""); setTimeout(load, 0); }}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              {s.t("clear_filters", "Clear Filters")}
            </button>
          )}
        </div>
      </div>

      {/* Register table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className={`px-3 py-3 ${s.textStart}`}>{s.t("col_source", "Source Module")}</th>
                <th className={`px-3 py-3 ${s.textStart}`}>{s.t("col_bill_no", "Bill No.")}</th>
                <th className={`px-3 py-3 ${s.textStart}`}>{s.t("col_manual_bill", "Manual Bill / Contract")}</th>
                <th className={`px-3 py-3 ${s.textStart}`}>{s.t("col_date", "Date")}</th>
                <th className={`px-3 py-3 ${s.textStart}`}>{s.t("col_branch", "Branch")}</th>
                <th className={`px-3 py-3 ${s.textStart}`}>{s.t("col_party", "Party / Account")}</th>
                <th className="px-3 py-3 text-end">{s.t("col_original_amount", "Original Bill Amount")}</th>
                <th className="px-3 py-3 text-end">{s.t("col_expense_total", "Expense Total")}</th>
                <th className="px-3 py-3 text-center">{s.t("col_status", "Status")}</th>
                <th className="px-3 py-3 text-center">{s.t("col_actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={10} className="py-10 text-center text-slate-400">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-slate-300" />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10}>
                  <DataEmptyState
                    icon={Link2}
                    title={filtersActive ? s.t("empty_filtered", "No bills match the selected filters.") : s.t("empty", "No submitted bills yet.")}
                    hint={filtersActive ? undefined : s.t("empty", "A Purchase or Sales bill appears here automatically once it is booked / confirmed.")}
                  />
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-3">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {moduleLabel(r.sourceModule)}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">{r.billNo || "—"}</td>
                    <td className="px-3 py-3 text-slate-500">{r.manualBillNo || "—"}</td>
                    <td className="px-3 py-3">{r.transactionDate ? new Date(r.transactionDate).toLocaleDateString("en-GB") : "—"}</td>
                    <td className="px-3 py-3">{r.branchLabel}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{r.partyName || "—"}</div>
                      <div className="text-[10px] text-slate-400">{r.partyAccountNo || ""}</div>
                    </td>
                    <td className="px-3 py-3 text-end font-medium">{r.currency} {money(r.originalBillAmount)}</td>
                    <td className="px-3 py-3 text-end font-bold text-rose-600">{money(r.expenseTotal)}
                      {r.expenseCount > 0 && <span className="ms-1 text-[10px] font-normal text-slate-400">({r.expenseCount})</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {r.eligibility === "withdrawn" ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          {s.t("eligibility_withdrawn", "Withdrawn")}
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {statusLabel(r.status)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => setOpenId(r.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700"
                      >
                        {s.t("open_detail", "Open")} <ChevronRight className={`h-3 w-3 ${s.isRtl ? "rotate-180" : ""}`} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openId && (
        <BillExpenseDetail
          id={openId}
          s={s}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </section>
  );
}

/* ── Detail drawer: read-only source bill + additional expense lines + add form ── */
function BillExpenseDetail({
  id, s, onClose, onChanged
}: {
  id: string;
  s: ReturnType<typeof useErpScreen>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({ expenseType: "shipping", details: "", currency: "", amount: "", exchangeRate: "1", taxPct: "0" });

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

  return (
    <div dir={s.dir} className="fixed inset-0 z-[9990] flex justify-end bg-slate-950/60 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-slate-950">
        {/* header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{be?.billNo || "—"}</div>
              <div className="text-[10px] text-slate-400">{be?.branchLabel}</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          {loading || !be ? (
            <div className="py-10 text-center text-slate-400"><RefreshCw className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : (
            <>
              {/* Original bill — read only, auto-filled */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <Link2 className="h-3.5 w-3.5" /> {s.t("original_bill", "Original Bill (auto-filled — read only)")}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {[
                    [s.t("col_bill_no", "Bill No."), be.billNo],
                    [s.t("col_manual_bill", "Manual Bill / Contract"), be.manualBillNo],
                    [s.t("col_date", "Date"), be.transactionDate ? new Date(be.transactionDate).toLocaleDateString("en-GB") : null],
                    [s.t("col_country", "Country"), be.countryName],
                    [s.t("col_party", "Party / Account"), be.partyName || be.partyAccountNo],
                    [s.t("col_currency", "Currency"), be.currency],
                    [s.t("col_original_amount", "Original Bill Amount"), `${be.currency ?? ""} ${money(be.originalBillAmount)}`],
                    ...(src?.goods_name || src?.product_summary ? [["—", src.goods_name || src.product_summary]] : [])
                  ].map(([k, v], i) => (
                    <div key={i} className="flex flex-col">
                      <dt className="text-[10px] uppercase text-slate-400">{k}</dt>
                      <dd className="font-semibold text-slate-800 dark:text-slate-100">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Additional expenses */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{s.t("additional_expenses", "Additional Expenses")}</h3>
                  <span className="text-xs font-bold text-rose-600">{money(be.expenseTotal)}</span>
                </div>
                {lines.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
                    {s.t("no_lines", "No additional expenses recorded against this bill yet.")}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 dark:bg-slate-800/50">
                        <tr>
                          <th className={`px-2 py-2 ${s.textStart}`}>{s.t("expense_type", "Expense Type")}</th>
                          <th className={`px-2 py-2 ${s.textStart}`}>{s.t("f_details", "Details / Narration")}</th>
                          <th className="px-2 py-2 text-end">{s.t("f_grand_amount", "Grand Amount")}</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {lines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-2 py-2 font-semibold">{s.t(`et_${l.expenseType}`, l.expenseType)}</td>
                            <td className="px-2 py-2 text-slate-500">{l.details || "—"}</td>
                            <td className="px-2 py-2 text-end font-bold">{l.currency} {money(l.grandAmount)}</td>
                            <td className="px-2 py-2 text-center">
                              {l.postingStatus !== "posted" && (
                                <button onClick={() => removeLine(l.id)} disabled={busy} className="text-slate-400 hover:text-rose-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add expense form */}
              {be.eligibility === "active" && (
                <div className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    <Plus className="h-3.5 w-3.5" /> {s.t("add_expense", "Add Expense")}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs">
                      <span className="mb-1 block font-semibold text-slate-500">{s.t("expense_type", "Expense Type")}</span>
                      <select
                        value={form.expenseType}
                        onChange={(e) => setForm({ ...form, expenseType: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                      >
                        {EXPENSE_TYPES.map((t) => (
                          <option key={t} value={t}>{s.t(`et_${t}`, t)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block font-semibold text-slate-500">{s.t("col_currency", "Currency")}</span>
                      <input
                        value={form.currency}
                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs uppercase dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <label className="col-span-2 text-xs">
                      <span className="mb-1 block font-semibold text-slate-500">{s.t("f_details", "Details / Narration")}</span>
                      <input
                        value={form.details}
                        onChange={(e) => setForm({ ...form, details: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block font-semibold text-slate-500">{s.t("f_amount", "Amount")}</span>
                      <input
                        type="number" inputMode="decimal" value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block font-semibold text-slate-500">{s.t("f_exchange_rate", "Exchange Rate")}</span>
                      <input
                        type="number" inputMode="decimal" value={form.exchangeRate}
                        onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block font-semibold text-slate-500">{s.t("f_tax_pct", "Tax %")}</span>
                      <input
                        type="number" inputMode="decimal" value={form.taxPct}
                        onChange={(e) => setForm({ ...form, taxPct: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <div className="text-xs">
                      <span className="mb-1 block font-semibold text-slate-500">{s.t("f_grand_amount", "Grand Amount")}</span>
                      <div className="rounded-lg bg-slate-100 px-2.5 py-2 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                        {money(grand)}
                      </div>
                    </div>
                  </div>
                  {err && <p className="mt-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}
                  <button
                    onClick={addExpense}
                    disabled={busy}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> {busy ? s.t("f_saving", "Saving…") : s.t("f_save", "Save Expense")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800">
            {s.t("close", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
