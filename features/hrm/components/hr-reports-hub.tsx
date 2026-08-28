"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Col = { key: string; label: string; align?: "right" };
type Row = Record<string, any>;

const REPORTS = [
  { id: "employee_directory", needs: [] as string[] },
  { id: "attendance", needs: ["dates"] },
  { id: "leave", needs: ["dates"] },
  { id: "overtime", needs: ["dates"] },
  { id: "payroll_register", needs: ["period"] },
  { id: "salary_slip", needs: ["employee", "period"] },
  { id: "employee_ledger", needs: ["employee"] },
  { id: "expiring_documents", needs: [] },
  { id: "gratuity", needs: [] },
  { id: "audit_history", needs: [] },
];

const EXTERNAL = [
  { href: "/dashboard/general-office/contracts", key: "rpt_contracts" },
  { href: "/dashboard/general-office/employee-kyc", key: "rpt_kyc" },
  { href: "/dashboard/general-office/leave-attendance", key: "rpt_leave_balances" },
  { href: "/dashboard/general-office/payroll-tax", key: "rpt_payroll_tax" },
];

export function HrReportsHub({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [report, setReport] = useState("employee_directory");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [employees, setEmployees] = useState<Row[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def = REPORTS.find((r) => r.id === report)!;

  useEffect(() => {
    apiGet<{ rows: Row[] }>("/api/erp/hr/employees").then((r) => setEmployees(r.rows ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (def.needs.includes("employee") && !employeeId) { setError(s.t("rpt_need_employee", "Select an employee for this report.")); setRows([]); return; }
    if (def.needs.includes("period") && !period) { setError(s.t("rpt_need_period", "Select a period (YYYY-MM) for this report.")); setRows([]); return; }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ type: report });
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (period) qs.set("periodMonth", period);
      if (employeeId) qs.set("employeeId", employeeId);
      if (status) qs.set("status", status);
      const res = await apiGet<{ columns: Col[]; rows: Row[] }>(`/api/erp/hr/reports?${qs.toString()}`);
      setCols(res.columns ?? []);
      setRows(res.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [report, from, to, period, employeeId, status, def, s]);

  useEffect(() => { void load(); }, [load]);

  const printConfig = () => ({
    moduleType: "hr_payroll" as const,
    reportType: (report === "salary_slip" ? "single_document" : "register") as "single_document" | "register",
    title: s.t(`rpt_${report}`, report),
    subtitle: s.t("rpt_hub_subtitle", "HRM Reports"),
    lang: s.lang,
    orientation: "landscape" as const,
    scope: { dateRange: from && to ? `${from} — ${to}` : period || undefined },
    columns: cols.map((c) => ({ key: c.key, label: c.label, align: c.align })),
    rows,
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className={s.textStart}>
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("rpt_hub_title", "HRM Reports")}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{s.t("rpt_hub_blurb", "Every report supports active filters, Print, PDF, HTML, Excel and CSV, with Page X of Y and the five languages. Amounts are in each employee's official country currency.")}</p>
        </header>

        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-[14rem]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("rpt_select", "Report")}</label>
            <select value={report} onChange={(e) => { setReport(e.target.value); setRows([]); }} className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800">
              {REPORTS.map((r) => <option key={r.id} value={r.id}>{s.t(`rpt_${r.id}`, r.id)}</option>)}
            </select>
          </div>
          {def.needs.includes("dates") ? (
            <>
              <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("rpt_from", "From")}</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" /></div>
              <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("rpt_to", "To")}</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" /></div>
            </>
          ) : null}
          {def.needs.includes("period") || report === "expiring_documents" ? (
            <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{report === "expiring_documents" ? s.t("rpt_until", "Until") : s.t("rpt_period", "Period (YYYY-MM)")}</label>
              {report === "expiring_documents"
                ? <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
                : <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />}
            </div>
          ) : null}
          {def.needs.includes("employee") || ["attendance", "leave", "overtime"].includes(report) ? (
            <div className="min-w-[14rem]"><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("employee", "Employee")}</label>
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800">
                <option value="">{def.needs.includes("employee") ? s.t("select_employee", "Select employee…") : s.t("rpt_all_employees", "All employees")}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}
              </select>
            </div>
          ) : null}
          {["leave", "gratuity"].includes(report) ? (
            <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("status_label", "Status")}</label>
              <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder={s.t("rpt_any", "any")} className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" /></div>
          ) : null}
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
            <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Run")}
          </button>
          <UniversalPrintActionButton reportConfig={printConfig} />
        </div>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                {cols.map((c) => <Th key={c.key} className={`px-3 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>{c.label}</Th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={cols.length || 1} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={cols.length || 1} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("rpt_no_records", "No records found for the selected filters.")}</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    {cols.map((c) => (
                      <td key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : "text-slate-600 dark:text-slate-300"}`}>
                        {r[c.key] == null || r[c.key] === "" ? "—" : String(r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400">{s.t("rpt_row_count", "{n} rows").replace("{n}", String(rows.length))}</p>

        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("rpt_more", "More HRM registers")}</p>
          <div className="flex flex-wrap gap-2">
            {EXTERNAL.map((x) => (
              <Link key={x.href} href={x.href} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                <ExternalLink className="h-3 w-3" />{s.t(x.key, x.key)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
