"use client";

/**
 * Smart Operations — Control Checks. Read-only detectors (duplicate invoices, unbalanced entries,
 * missing posting / FX, overdue receivables & payables, pending approvals, stale CRM follow-ups,
 * ETA passed, payroll & attendance exceptions, document / licence expiry, tax deadlines …).
 * Every finding links to the original record; corrections happen there, through the module's own
 * permission and approval workflow. Nothing on this panel edits or posts.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AlertOctagon, BellRing, CheckCircle2, ChevronDown, ChevronRight, Eye, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { cn } from "@/lib/utils";

type Finding = { detector: string; severity: string; reference: string; detail: string | null; date: string | null; href: string; country: string | null };
type Result = { detector: string; group: string; severity: "critical" | "needs_review" | "reminder"; count: number; findings: Finding[]; error?: boolean };

const SEV_TONE = {
  critical: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  needs_review: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  reminder: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  resolved: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
} as const;

export function ControlChecksPanel() {
  const s = useErpScreen("sops");
  const [data, setData] = useState<{ generatedAt: string; results: Result[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState("all");
  const [sev, setSev] = useState<"all" | "critical" | "needs_review" | "reminder" | "resolved">("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet(`/api/erp/smart-operations/control-checks`));
    } catch (e: any) {
      setError(e?.message || s.t("load_failed", "Control checks could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [s]);
  useEffect(() => {
    void load();
  }, [load]);

  const name = (d: string) =>
    ({
      unbalanced_entry: s.t("d_unbalanced", "Unbalanced financial entry"),
      missing_fx_rate: s.t("d_fx", "Missing / wrong historical FX rate"),
      duplicate_invoice: s.t("d_dup_invoice", "Duplicate invoice / bill number"),
      missing_posting: s.t("d_missing_posting", "Purchase / sales not posted to Roznamcha"),
      payment_without_posting: s.t("d_payment_posting", "Payment posted but Roznamcha / transfer missing"),
      settlement_discrepancy: s.t("d_settlement", "Settlement / reconciliation discrepancy"),
      overdue_receivable: s.t("d_receivable", "Overdue receivable"),
      overdue_payable: s.t("d_payable", "Overdue payable"),
      incomplete_workflow: s.t("d_incomplete", "Incomplete purchase / sales workflow"),
      pending_approval: s.t("d_approval", "Pending approval (over 2 days)"),
      stale_crm_followup: s.t("d_crm", "Stale CRM follow-up"),
      low_stock_alert: s.t("d_low_stock", "Low stock / reorder alert"),
      eta_passed_no_update: s.t("d_eta", "ETA passed without tracking update"),
      missing_shipping_document: s.t("d_ship_doc", "Missing shipping / clearing document data"),
      payroll_exception: s.t("d_payroll", "Payroll exception"),
      missing_attendance_before_payroll: s.t("d_attendance", "Missing attendance before payroll"),
      employee_document_expired: s.t("d_emp_doc", "Employee document expired / expiring"),
      company_license_expiry: s.t("d_company", "Company licence expired / expiring"),
      tax_filing_deadline: s.t("d_tax", "Tax / compliance filing deadline"),
      wps_exception: s.t("d_wps", "WPS exception"),
    })[d] ?? d;
  const groupName = (g: string) =>
    ({ all: s.t("g_all", "All"), accounting: s.t("g_accounting", "Accounting"), receivables: s.t("g_receivables", "Receivables, Payables & Workflow"), crm: s.t("g_crm", "CRM"), inventory: s.t("g_inventory", "Inventory"), shipping: s.t("g_shipping", "Shipping & Clearing"), hr: s.t("g_hr", "HR & Payroll"), compliance: s.t("g_compliance", "Company & Tax Compliance") })[g] ?? g;
  const sevName = (v: string) =>
    ({ all: s.t("s_all", "All"), critical: s.t("s_critical", "Critical"), needs_review: s.t("s_review", "Needs review"), reminder: s.t("s_reminder", "Reminder"), resolved: s.t("s_resolved", "Resolved") })[v] ?? v;

  const rows = useMemo(() => {
    const r = data?.results ?? [];
    return r.filter((x) => (group === "all" || x.group === group) && (sev === "all" || (sev === "resolved" ? x.count === 0 && !x.error : x.count > 0 && x.severity === sev)));
  }, [data, group, sev]);
  const totals = useMemo(() => {
    const r = data?.results ?? [];
    return {
      critical: r.filter((x) => x.severity === "critical").reduce((a, x) => a + x.count, 0),
      needs_review: r.filter((x) => x.severity === "needs_review").reduce((a, x) => a + x.count, 0),
      reminder: r.filter((x) => x.severity === "reminder").reduce((a, x) => a + x.count, 0),
      resolved: r.filter((x) => x.count === 0 && !x.error).length,
    };
  }, [data]);
  const groups = ["all", "accounting", "receivables", "crm", "inventory", "shipping", "hr", "compliance"];

  return (
    <section dir={s.dir} data-testid="control-checks" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="h-5 w-5 text-blue-600" /> {s.t("title", "Control Checks")}
          </h2>
          <p className="text-xs text-slate-500">{s.t("subtitle", "Automatic read-only checks across your country / branch. Open a finding to correct it in its own module.")}</p>
        </div>
        <button type="button" data-testid="cc-refresh" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />} {s.t("run_now", "Run checks now")}
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["critical", "needs_review", "reminder", "resolved"] as const).map((k) => (
          <button key={k} type="button" data-testid={`cc-sev-${k}`} onClick={() => setSev(sev === k ? "all" : k)} className={cn("rounded-xl border p-2.5 text-start", SEV_TONE[k], sev === k && "ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-slate-900")}>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide">
              {sevName(k)}
              {k === "critical" ? <AlertOctagon className="h-4 w-4" /> : k === "resolved" ? <CheckCircle2 className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums">{totals[k]}</div>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <button key={g} type="button" onClick={() => setGroup(g)} className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", group === g ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}>
            {groupName(g)}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!data && loading && (
        <div className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {s.t("loading", "Running control checks…")}</div>
      )}
      {data && rows.length === 0 && <p className="p-3 text-xs text-slate-500">{s.t("empty", "No checks match this filter.")}</p>}
      <div className="space-y-1.5">
        {rows.map((r) => {
          const resolved = r.count === 0 && !r.error;
          const isOpen = open[r.detector];
          return (
            <div key={r.detector} data-testid={`cc-${r.detector}`} data-count={r.count} className={cn("rounded-xl border", resolved ? SEV_TONE.resolved : SEV_TONE[r.severity])}>
              <button type="button" disabled={resolved} onClick={() => setOpen((o) => ({ ...o, [r.detector]: !o[r.detector] }))} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-xs">
                <span className="flex items-center gap-2 font-semibold">
                  {!resolved && (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                  {name(r.detector)}
                </span>
                <span className="font-bold tabular-nums">
                  {r.error ? s.t("check_failed", "Check unavailable") : resolved ? sevName("resolved") : `${sevName(r.severity)} · ${r.count}${r.count >= 25 ? "+" : ""}`}
                </span>
              </button>
              {isOpen && r.findings.length > 0 && (
                <div className="overflow-x-auto border-t border-current/20 bg-white/70 dark:bg-slate-900/60">
                  <table className="w-full min-w-[560px] text-xs text-slate-800 dark:text-slate-200">
                    <tbody>
                      {r.findings.map((f, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-1.5 font-mono font-semibold">{f.reference}</td>
                          <td className="px-3 py-1.5">{f.detail ?? "—"}</td>
                          <td className="px-3 py-1.5 tabular-nums">{f.date ?? "—"}</td>
                          <td className="px-3 py-1.5">{f.country ?? ""}</td>
                          <td className="px-3 py-1.5 text-end">
                            <Link href={f.href as Route} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-300">
                              <Eye className="h-3.5 w-3.5" /> {s.t("open", "Open")}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {data && <p className="mt-2 text-[11px] text-slate-400">{s.t("generated", "Checked at")} {new Date(data.generatedAt).toLocaleString(s.lang === "en" ? "en-GB" : `${s.lang}-u-nu-latn`)}</p>}
    </section>
  );
}
