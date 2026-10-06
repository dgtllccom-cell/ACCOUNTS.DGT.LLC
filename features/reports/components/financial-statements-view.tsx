"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Printer, FileSpreadsheet, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { formatErpRange } from "@/lib/datetime/erp-date";

const STATEMENTS = ["profit_loss", "balance_sheet", "cash_flow"] as const;
type Statement = (typeof STATEMENTS)[number];

type StatementRow = {
  ledger_id?: string;
  code: string | null;
  name: string | null;
  currency: string | null;
  kind?: string;
  amount?: number;
  closing_balance?: number;
  opening_balance?: number;
  period_debit?: number;
  period_credit?: number;
};

function fmtMoney(v: any) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function yearStartIso() {
  const d = new Date();
  d.setMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Financial Statements — CLAUDE.md Master Requirement Section A.
 * One screen, three real reports (Profit & Loss, Balance Sheet, Cash & Bank
 * Position), each backed by app/api/erp/accounting/reports/{profit-and-loss,
 * balance-sheet,cash-flow}/route.ts. Follows the exact filter-bar / report-
 * picker / Universal Print pattern already used by
 * features/expenses/components/bill-cost-reports-view.tsx -- no second
 * report engine, no second print pipeline.
 */
export function FinancialStatementsView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("finstmt", langProp);
  const scope = useErpScope();

  const [statement, setStatement] = useState<Statement>("profit_loss");
  const [from, setFrom] = useState(yearStartIso());
  const [to, setTo] = useState(todayIso());

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statementLabel = (k: Statement) =>
    k === "profit_loss" ? s.t("stmt_pl", "Profit & Loss") : k === "balance_sheet" ? s.t("stmt_bs", "Balance Sheet") : s.t("stmt_cf", "Cash & Bank Position");

  const scopeParam = scope.mode === "unknown" ? "city_branch" : scope.mode;

  const load = useCallback(async () => {
    if (scope.loading) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ scope: scopeParam });
      if (scope.lockedCountryId) qs.set("countryId", scope.lockedCountryId);
      if (scope.lockedCountryBranchId) qs.set("countryBranchId", scope.lockedCountryBranchId);
      if (scope.lockedCityBranchId) qs.set("cityBranchId", scope.lockedCityBranchId);

      let url = "";
      if (statement === "balance_sheet") {
        qs.set("asOfDate", to);
        url = `/api/erp/accounting/reports/balance-sheet?${qs.toString()}`;
      } else {
        qs.set("fromDate", from);
        qs.set("toDate", to);
        url = `/api/erp/accounting/reports/${statement === "profit_loss" ? "profit-and-loss" : "cash-flow"}?${qs.toString()}`;
      }

      const res = await fetch(url);
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);
      setData(j.data);
    } catch (e: any) {
      setError(e?.message || s.t("load_failed", "Failed to load"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [statement, from, to, scope.loading, scope.lockedCountryId, scope.lockedCountryBranchId, scope.lockedCityBranchId, scopeParam]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statement, scope.loading]);

  // Build a uniform (label, rows[], total) section list per statement, so
  // the render + print logic below doesn't need three separate branches.
  const sections = useMemo(() => {
    if (!data) return [] as { label: string; rows: StatementRow[]; total: number; tone?: "profit" | "loss" }[];
    if (statement === "profit_loss") {
      return [
        { label: s.t("sec_income", "Income"), rows: data.income as StatementRow[], total: data.totals.totalIncome },
        { label: s.t("sec_expense", "Expense"), rows: data.expense as StatementRow[], total: data.totals.totalExpense }
      ];
    }
    if (statement === "balance_sheet") {
      return [
        { label: s.t("sec_assets", "Assets"), rows: data.assets as StatementRow[], total: data.totals.totalAssets },
        { label: s.t("sec_liabilities", "Liabilities"), rows: data.liabilities as StatementRow[], total: data.totals.totalLiabilities },
        { label: s.t("sec_equity", "Equity"), rows: data.equity as StatementRow[], total: data.totals.totalEquity }
      ];
    }
    return [
      { label: s.t("sec_bank", "Bank Accounts"), rows: data.bankAccounts as StatementRow[], total: data.bankAccounts.reduce((sum: number, r: StatementRow) => sum + Number(r.closing_balance || 0), 0) },
      { label: s.t("sec_cash", "Cash Accounts"), rows: data.cashAccounts as StatementRow[], total: data.cashAccounts.reduce((sum: number, r: StatementRow) => sum + Number(r.closing_balance || 0), 0) }
    ];
  }, [data, statement, s]);

  function rowAmount(r: StatementRow) {
    return statement === "profit_loss" ? Number(r.amount || 0) : Number(r.closing_balance || 0);
  }

  function printStatement() {
    if (!data) return;
    const columns: GenericReportColumn[] = [
      { key: (r: any) => r.code || "—", label: s.t("col_code", "Code"), align: "left" },
      { key: (r: any) => r.name || "—", label: s.t("col_name", "Ledger"), align: "left" },
      { key: (r: any) => r.currency || "—", label: s.t("col_currency", "Currency"), align: "center" },
      { key: (r: any) => fmtMoney(rowAmount(r)), label: s.t("col_amount", "Amount"), align: "right" }
    ];

    const rows: Record<string, unknown>[] = [];
    for (const section of sections) {
      if (!section.rows.length) continue;
      rows.push({ code: "", name: `— ${section.label} —`, currency: "", amount: "" });
      for (const r of section.rows) rows.push(r as unknown as Record<string, unknown>);
      rows.push({ code: "", name: s.t("row_subtotal", "Subtotal"), currency: "", amount: fmtMoney(section.total) });
    }

    const summary: Record<string, string> = {};
    if (statement === "profit_loss") {
      summary[s.t("sum_total_income", "Total Income")] = fmtMoney(data.totals.totalIncome);
      summary[s.t("sum_total_expense", "Total Expense")] = fmtMoney(data.totals.totalExpense);
      summary[s.t("sum_net_profit", "Net Profit / (Loss)")] = fmtMoney(data.totals.netProfit);
    } else if (statement === "balance_sheet") {
      summary[s.t("sum_total_assets", "Total Assets")] = fmtMoney(data.totals.totalAssets);
      summary[s.t("sum_total_liabilities", "Total Liabilities")] = fmtMoney(data.totals.totalLiabilities);
      summary[s.t("sum_total_equity", "Total Equity")] = fmtMoney(data.totals.totalEquity);
      summary[s.t("sum_difference", "Difference (Assets − Liab − Equity)")] = fmtMoney(data.totals.difference);
    } else {
      summary[s.t("sum_opening", "Opening Balance")] = fmtMoney(data.totals.openingBalance);
      summary[s.t("sum_closing", "Closing Balance")] = fmtMoney(data.totals.closingBalance);
      summary[s.t("sum_net_movement", "Net Movement")] = fmtMoney(data.totals.netMovement);
    }

    void openScopedGenericReport({
      title: statementLabel(statement),
      subtitle: s.t("report_subtitle", "Financial Statements"),
      lang: langProp,
      columns,
      rows,
      orientation: "portrait",
      countryId: scope.lockedCountryId,
      countryBranchId: scope.lockedCountryBranchId,
      cityBranchId: scope.lockedCityBranchId,
      countryName: scope.countryName,
      branchName: scope.branchDisplayName,
      printedBy: scope.userName,
      filters: [
        {
          label: s.t("col_period", "Period"),
          value: statement === "balance_sheet" ? s.t("as_of", "As of {date}").replace("{date}", to) : formatErpRange({ from, to }, s.lang)
        },
        { label: s.t("col_scope", "Scope"), value: scope.scopeLabel || scopeParam }
      ],
      summary
    });
  }

  const showDifferenceWarning = statement === "balance_sheet" && data && Math.abs(Number(data.totals.difference || 0)) > 0.01;

  return (
    <section dir={s.dir} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-indigo-500" />
          <h1 className="text-lg font-semibold">{s.t("title", "Financial Statements")}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <RefreshCw className="me-1 h-4 w-4" />}
            {s.t("run", "Run")}
          </Button>
          <Button variant="outline" size="sm" onClick={printStatement} disabled={!data || !sections.some((sec) => sec.rows.length)}>
            <Printer className="me-1 h-4 w-4" /> {s.t("print", "Print / PDF")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATEMENTS.map((k) => (
          <button
            key={k}
            onClick={() => setStatement(k)}
            className={`rounded-full border px-3 py-1 text-xs ${
              statement === k
                ? "border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {statementLabel(k)}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-slate-500">
            {s.t("scope_label", "Scope")}: {scope.scopeLabel || scopeParam}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          {statement === "balance_sheet" ? (
            <div className="min-w-[15rem]">
              <ErpDatePicker mode="single" lang={langProp} label={s.t("as_of_date", "As of Date")} value={{ from: to }} onApply={(v) => setTo(v.from ?? to)} size="sm" />
            </div>
          ) : (
            <div className="min-w-[15rem]">
              <ErpDatePicker
                mode="range"
                lang={langProp}
                label={s.t("col_period", "Period")}
                value={{ from: from || null, to: to || null }}
                onApply={(v) => {
                  setFrom(v.from ?? from);
                  setTo(v.to ?? to);
                }}
                size="sm"
              />
            </div>
          )}
          <Button size="sm" onClick={() => void load()} disabled={loading}>{s.t("apply", "Apply")}</Button>
        </CardContent>
      </Card>

      {statement === "cash_flow" && (
        <p className="text-[11px] text-slate-400">
          {s.t("cf_methodology_note", "Direct method: real opening vs closing balance of every bank-linked and cash-named ledger. Not an indirect-method Operating/Investing/Financing statement — the ERP does not yet tag accounts by activity type.")}
        </p>
      )}

      {showDifferenceWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {s.t("bs_out_of_balance", "Assets do not equal Liabilities + Equity for this scope (difference: {amount}). This reflects the underlying ledger data — the same discrepancy appears in the existing Trial Balance report for this scope — and is not something this screen can silently correct.").replace("{amount}", fmtMoney(data.totals.difference))}
          </span>
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> {s.t("loading", "Loading…")}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-rose-600">{error}</p>
          ) : !data || !sections.some((sec) => sec.rows.length) ? (
            <p className="py-10 text-center text-sm text-slate-500">{s.t("no_rows", "No data for the selected period / scope.")}</p>
          ) : (
            <div className="space-y-6">
              {sections.map((section) =>
                section.rows.length ? (
                  <div key={section.label}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{section.label}</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-slate-500">
                          <th className={s.textStart + " py-1.5"}>{s.t("col_code", "Code")}</th>
                          <th className={s.textStart + " py-1.5"}>{s.t("col_name", "Ledger")}</th>
                          <th className="text-center py-1.5">{s.t("col_currency", "Currency")}</th>
                          <th className={s.textEnd + " py-1.5"}>{s.t("col_amount", "Amount")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((r) => (
                          <tr key={r.ledger_id || r.code} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-1.5 font-mono">{r.code || "—"}</td>
                            <td className="py-1.5">{r.name || "—"}</td>
                            <td className="py-1.5 text-center">{r.currency || "—"}</td>
                            <td className={s.textEnd + " py-1.5 tabular-nums"}>{fmtMoney(rowAmount(r))}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-semibold">
                          <td colSpan={3} className={s.textStart + " py-1.5"}>{s.t("row_subtotal", "Subtotal")}</td>
                          <td className={s.textEnd + " py-1.5 tabular-nums"}>{fmtMoney(section.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : null
              )}

              <div className="rounded-lg border bg-muted/30 p-3 text-sm font-bold">
                {statement === "profit_loss" && (
                  <span className={data.totals.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    {s.t("sum_net_profit", "Net Profit / (Loss)")}: {fmtMoney(data.totals.netProfit)}
                  </span>
                )}
                {statement === "balance_sheet" && (
                  <span>{s.t("sum_total_assets", "Total Assets")}: {fmtMoney(data.totals.totalAssets)}</span>
                )}
                {statement === "cash_flow" && (
                  <span className={data.totals.netMovement >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    {s.t("sum_net_movement", "Net Movement")}: {fmtMoney(data.totals.netMovement)}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
