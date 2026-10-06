"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Printer, BarChart3, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { formatErpRange } from "@/lib/datetime/erp-date";

const REPORT_KEYS = [
  "bill_wise_expense",
  "bill_wise_final_cost",
  "purchase_cost",
  "sales_and_profit",
  "expense_type",
  "country_wise",
  "branch_wise",
  "party_wise",
  "container_shipment_cost",
  "currency_wise_expense",
  "outstanding_unpaid_expense",
  "profit_loss_by_bill"
] as const;
type ReportKey = (typeof REPORT_KEYS)[number];

const MODULES = ["all", "purchase_booking", "local_purchase", "sales_booking", "local_sales", "shipping_bl", "clearing_bill"] as const;
const EXPENSE_TYPES = ["all", "shipping", "loading", "clearing", "transport", "customs", "handling", "storage", "insurance", "other"] as const;
const BILL_STATUSES = ["all", "open", "in_progress", "closed"] as const;
const POSTING_STATUSES = ["all", "posted", "unposted"] as const;

/** column key → [i18n sub-key, English fallback] */
const COL_LABEL: Record<string, [string, string]> = {
  billNo: ["rc_billno", "Bill No."],
  module: ["rc_source", "Source"],
  date: ["rc_date", "Date"],
  party: ["rc_party", "Party"],
  branchLabel: ["rc_branch", "Branch"],
  group: ["rc_group", "Group"],
  bills: ["rc_bills", "Bills"],
  lines: ["rc_lines", "Lines"],
  lineCount: ["rc_lines", "Lines"],
  purchasedQty: ["rc_qty", "Qty"],
  original: ["rc_original", "Original"],
  originalFunctional: ["rc_original_bill", "Original Bill"],
  posted: ["rc_posted_expenses", "Posted Expenses"],
  postedExpense: ["rc_posted_expenses", "Posted Expenses"],
  draftExpense: ["rc_unposted_expenses", "Unposted Expenses"],
  unposted: ["rc_unposted", "Unposted"],
  landed: ["rc_landed", "Landed Cost"],
  revenue: ["rc_revenue", "Revenue"],
  costOfSold: ["rc_cost_of_sold", "Cost of Sold"],
  profit: ["rc_profit", "Profit / Loss"],
  total: ["rc_total", "Total"],
  functional: ["rc_functional", "Functional"],
  currency: ["rc_currency", "Currency"],
  expenseType: ["rc_expense_type", "Expense Type"],
  details: ["rc_details", "Details"],
  grand: ["rc_grand", "Grand (Functional)"],
  postingStatus: ["rc_posting", "Posting"]
};

function fmtMoney(v: any) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtQty(v: any) {
  return Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}
function fmtDate(v: any) {
  return v ? new Date(v).toLocaleDateString("en-GB") : "—";
}

export function BillCostReportsView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("bexp", langProp);
  const scope = useErpScope();

  const [report, setReport] = useState<ReportKey>("bill_wise_expense");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [moduleF, setModuleF] = useState<(typeof MODULES)[number]>("all");
  const [party, setParty] = useState("");
  const [expenseType, setExpenseType] = useState<(typeof EXPENSE_TYPES)[number]>("all");
  const [currency, setCurrency] = useState("all");
  const [status, setStatus] = useState<(typeof BILL_STATUSES)[number]>("all");
  const [postingStatus, setPostingStatus] = useState<(typeof POSTING_STATUSES)[number]>("all");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportLabel = (k: string) => s.t(`rpt_${k}`, k.replace(/_/g, " "));
  const colLabel = (key: string, apiLabel: string) => {
    const m = COL_LABEL[key];
    return m ? s.t(m[0], m[1]) : apiLabel;
  };
  const moduleLabel = (m: string) => (m === "all" ? s.t("tab_all", "All") : s.t(`tab_${m}`, m));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ report });
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (moduleF !== "all") qs.set("module", moduleF);
      if (party.trim()) qs.set("party", party.trim());
      if (expenseType !== "all") qs.set("expenseType", expenseType);
      if (currency !== "all") qs.set("currency", currency);
      if (status !== "all") qs.set("status", status);
      if (postingStatus !== "all") qs.set("postingStatus", postingStatus);
      const res = await fetch(`/api/erp/bill-expenses/reports?${qs.toString()}`);
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);
      setData(j.data);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [report, from, to, moduleF, party, expenseType, currency, status, postingStatus]);

  useEffect(() => {
    void load();
  }, [report]); // eslint-disable-line react-hooks/exhaustive-deps

  const cellText = (col: any, row: any) => {
    const v = row[col.key];
    if (col.kind === "money") return v == null ? "—" : fmtMoney(v);
    if (col.kind === "qty") return v == null ? "—" : fmtQty(v);
    if (col.kind === "date") return fmtDate(v);
    if (col.key === "module") return s.t(`tab_${v}`, v);
    if (col.key === "expenseType") return s.t(`etype_${v}`, v);
    if (col.key === "postingStatus") return v === "posted" ? s.t("posting_posted", "Posted") : s.t("posting_unposted", "Not posted");
    return v == null || v === "" ? "—" : String(v);
  };

  function printReport() {
    if (!data) return;
    const columns: GenericReportColumn[] = data.columns.map((c: any) => ({
      key: (r: any) => cellText(c, r),
      label: colLabel(c.key, c.label),
      align: c.align === "right" ? "right" : c.align === "center" ? "center" : "left"
    }));
    const summary: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.totals || {})) {
      summary[colLabel(k, k)] = typeof v === "number" ? fmtMoney(v) : String(v);
    }
    void openScopedGenericReport({
      title: reportLabel(report),
      subtitle: s.t("rc_suite", "Bill Cost, Expenses & Profit — Report Suite"),
      lang: langProp,
      columns,
      rows: data.rows as Record<string, unknown>[],
      orientation: data.columns.length > 6 ? "landscape" : "portrait",
      countryId: scope.lockedCountryId,
      countryBranchId: scope.lockedCountryBranchId,
      cityBranchId: scope.lockedCityBranchId,
      countryName: scope.countryName,
      branchName: scope.branchDisplayName,
      printedBy: scope.userName,
      currency: data.functionalCurrency,
      filters: [
        { label: s.t("rc_report", "Report"), value: reportLabel(report) },
        { label: s.t("rc_period", "Period"), value: from || to ? formatErpRange({ from: from || null, to: to || null }, s.lang) : s.t("rc_all_dates", "All dates") },
        { label: s.t("rc_source", "Source"), value: moduleLabel(moduleF) },
        { label: s.t("rc_party", "Party"), value: party.trim() || s.t("rc_all", "All") },
        { label: s.t("rc_rows", "Rows"), value: String(data.rowCount) }
      ],
      summary
    });
  }

  const selectCls =
    "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800";

  return (
    <section dir={s.dir} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          <h1 className="text-lg font-semibold">{s.t("rc_title", "Bill Cost, Expenses & Profit — Reports")}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <RefreshCw className="me-1 h-4 w-4" />}
            {s.t("rc_run", "Run")}
          </Button>
          <Button variant="outline" size="sm" onClick={printReport} disabled={!data || !data.rows.length}>
            <Printer className="me-1 h-4 w-4" /> {s.t("rc_print", "Print / PDF")}
          </Button>
        </div>
      </div>

      {/* Report picker */}
      <div className="flex flex-wrap gap-2">
        {REPORT_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setReport(k)}
            className={`rounded-full border px-3 py-1 text-xs ${
              report === k
                ? "border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {reportLabel(k)}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5" /> {s.t("rc_filters", "Filters")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[15rem]">
            <ErpDatePicker
              mode="range"
              lang={langProp}
              label={s.t("rc_period", "Period")}
              value={{ from: from || null, to: to || null }}
              onApply={(v) => {
                setFrom(v.from ?? "");
                setTo(v.to ?? "");
              }}
              size="sm"
            />
          </div>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            {s.t("rc_source", "Source")}
            <select value={moduleF} onChange={(e) => setModuleF(e.target.value as any)} className={selectCls}>
              {MODULES.map((m) => (
                <option key={m} value={m}>{moduleLabel(m)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            {s.t("rc_party", "Party")}
            <input value={party} onChange={(e) => setParty(e.target.value)} placeholder={s.t("rc_party_ph", "name contains…")} className={selectCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            {s.t("rc_expense_type", "Expense Type")}
            <select value={expenseType} onChange={(e) => setExpenseType(e.target.value as any)} className={selectCls}>
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>{t === "all" ? s.t("rc_all", "All") : s.t(`etype_${t}`, t)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            {s.t("rc_currency", "Currency")}
            <input value={currency === "all" ? "" : currency} onChange={(e) => setCurrency(e.target.value.trim() ? e.target.value.toUpperCase() : "all")} placeholder="ALL" className={`${selectCls} w-20`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            {s.t("rc_bill_status", "Bill Status")}
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={selectCls}>
              {BILL_STATUSES.map((t) => (
                <option key={t} value={t}>{t === "all" ? s.t("rc_all", "All") : s.t(`status_${t}`, t)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            {s.t("rc_posting", "Posting")}
            <select value={postingStatus} onChange={(e) => setPostingStatus(e.target.value as any)} className={selectCls}>
              {POSTING_STATUSES.map((t) => (
                <option key={t} value={t}>{t === "all" ? s.t("rc_all", "All") : t === "posted" ? s.t("posting_posted", "Posted") : s.t("posting_unposted", "Not posted")}</option>
              ))}
            </select>
          </label>
          <Button size="sm" onClick={() => void load()} disabled={loading}>{s.t("rc_apply", "Apply")}</Button>
        </CardContent>
      </Card>

      {/* Result */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> {s.t("loading", "Loading…")}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-rose-600">{error}</p>
          ) : !data || !data.rows.length ? (
            <p className="py-10 text-center text-sm text-slate-500">{s.t("rc_no_rows", "No data for the selected filters.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    {data.columns.map((c: any) => (
                      <th key={c.key} className={c.align === "right" ? s.textEnd : c.align === "center" ? "text-center" : s.textStart + " py-1.5"}>
                        {colLabel(c.key, c.label)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                      {data.columns.map((c: any) => (
                        <td
                          key={c.key}
                          className={`py-1.5 ${c.align === "right" ? s.textEnd + " tabular-nums" : c.align === "center" ? "text-center" : s.textStart} ${
                            c.key === "profit" ? (Number(row[c.key]) < 0 ? "text-rose-600" : "text-emerald-600") : ""
                          }`}
                        >
                          {cellText(c, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold">
                    {data.columns.map((c: any, idx: number) => {
                      const t = data.totals?.[c.key];
                      return (
                        <td key={c.key} className={`py-1.5 ${c.align === "right" ? s.textEnd + " tabular-nums" : s.textStart}`}>
                          {idx === 0 ? s.t("rc_total_row", "Total") : t == null ? "" : c.kind === "money" ? `${data.functionalCurrency} ${fmtMoney(t)}` : fmtQty(t)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-slate-400">
                {s.t("rc_footnote", "All functional-currency figures are read as posted — no exchange rate is recomputed.")} · {data.functionalCurrency} · {data.rowCount} {s.t("rc_rows", "rows")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
