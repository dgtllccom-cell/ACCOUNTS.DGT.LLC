"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, Scale } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";

type Row = Record<string, any>;

const CHECK_TONE: Record<string, string> = {
  balanced: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  unbalanced: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  not_posted: "bg-slate-100 text-slate-500 dark:bg-slate-800",
};

/**
 * Payroll ↔ Accounting ↔ Tax reconciliation report. Read-only: shows the trace
 * Payroll Register → Salary Due → Roznamcha (accrual / payment) with a Dr/Cr
 * balance check per line. No posting happens here.
 */
export function PayrollReconciliationView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Row>({});
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = period ? `?periodMonth=${encodeURIComponent(period)}` : "";
      const r = await apiGet<{ rows: Row[]; summary: Row }>(`/api/erp/hr/payroll/reconciliation${qs}`);
      setRows(r.rows ?? []);
      setSummary(r.summary ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [period]);
  useEffect(() => { void load(); }, [load]);

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="inline-flex items-center gap-2 text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
              <Scale className="h-5 w-5 text-slate-400" />{s.t("recon_title", "Payroll ↔ Accounting ↔ Tax Reconciliation")}
            </h1>
            <p className="mt-0.5 max-w-3xl text-xs text-slate-500">
              {s.t("recon_blurb", "Payroll Register → Salary Due → Roznamcha → Journal / Ledger → Payroll Tax. Each posted line is checked for Total Debit = Total Credit. This report does not post anything.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" className="w-28 rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs dark:border-slate-700" />
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}
            </button>
          </div>
        </header>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Kpi label={s.t("recon_k_lines", "Lines")} value={summary.lines ?? 0} />
          <Kpi label={s.t("recon_k_balanced", "Balanced")} value={summary.balanced ?? 0} tone="text-emerald-600" icon={CheckCircle2} />
          <Kpi label={s.t("recon_k_unbalanced", "Unbalanced")} value={summary.unbalanced ?? 0} tone="text-rose-600" icon={AlertTriangle} />
          <Kpi label={s.t("recon_k_not_posted", "Not Posted")} value={summary.not_posted ?? 0} />
          <Kpi label={s.t("recon_k_gross", "Gross")} value={summary.total_gross ?? 0} />
          <Kpi label={s.t("recon_k_tax", "Tax")} value={summary.total_tax ?? 0} />
          <Kpi label={s.t("recon_k_net", "Net")} value={summary.total_net ?? 0} />
        </div>

        {Number(summary.total_dr_minus_cr ?? 0) !== 0 ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            {s.t("recon_dr_cr_warn", "Total Debit − Credit across posted payroll entries is not zero")}: {summary.total_dr_minus_cr}
          </p>
        ) : Number(summary.balanced ?? 0) > 0 ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{s.t("recon_dr_cr_ok", "All posted payroll accrual entries balance (Debit = Credit).")}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <Th className="px-3 py-2.5">{s.t("recon_c_run", "Run")}</Th>
                <Th className="px-3 py-2.5">{s.t("recon_c_period", "Period")}</Th>
                <Th className="px-3 py-2.5">{s.t("recon_c_emp", "Employee")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("recon_c_gross", "Gross")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("recon_c_tax", "Tax")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("recon_c_net", "Net")}</Th>
                <Th className="px-3 py-2.5">{s.t("recon_c_due", "Salary Due")}</Th>
                <Th className="px-3 py-2.5">{s.t("recon_c_accrual", "Accrual Voucher")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("recon_c_drcr", "Dr − Cr")}</Th>
                <Th className="px-3 py-2.5">{s.t("recon_c_check", "Check")}</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("recon_empty", "No payroll lines for this filter. Run and post a payroll to see the reconciliation trace.")}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.run_line_id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.run_no}</td>
                  <td className="px-3 py-2 text-slate-500">{r.period_month}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.employee_code}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.gross_salary} {r.line_currency}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.tax_employee}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.net_salary}</td>
                  <td className="px-3 py-2 text-slate-500">{r.salary_due_status || "—"}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{r.accrual_voucher_no || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.accrual_dr_minus_cr ?? "—"}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CHECK_TONE[r.accrual_balance_check] || CHECK_TONE.not_posted}`}>{s.t(`recon_chk_${r.accrual_balance_check}`, r.accrual_balance_check)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value, tone, icon: Icon }: { label: string; value: number | string; tone?: string; icon?: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className={`h-3.5 w-3.5 ${tone || "text-slate-400"}`} /> : null}
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-50">{value}</div>
    </div>
  );
}
