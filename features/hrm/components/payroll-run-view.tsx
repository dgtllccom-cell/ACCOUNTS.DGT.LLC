"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, X, Calculator, ClipboardCheck, ShieldCheck, Banknote, Undo2, ChevronLeft } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Row = Record<string, any>;
const INP = "w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700";
const NUM = (v: any) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);

const STATUS_FLOW = ["draft", "calculated", "reviewed", "approved", "posted", "paid"];
const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  calculated: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  reviewed: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  approved: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  posted: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800",
  reversed: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

export function PayrollRunView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [runs, setRuns] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiGet<{ rows: Row[] }>("/api/erp/hr/payroll");
      setRuns(r.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (openId) {
    return <PayrollRunDetail s={s} runId={openId} onBack={() => { setOpenId(null); void load(); }} />;
  }

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("payroll_title", "Payroll Runs")}</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
              {s.t("payroll_blurb", "Batch payroll with the Draft → Calculated → Reviewed → Approved → Posted → Paid workflow. Only an approved run posts accounting; a run can never post twice; reversal is a controlled contra entry.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
              <Plus className="h-3.5 w-3.5" />{s.t("payroll_new", "New Payroll Run")}
            </button>
          </div>
        </header>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <Th className="px-3 py-2.5">{s.t("payroll_run_no", "Run No")}</Th>
                <Th className="px-3 py-2.5">{s.t("payroll_period", "Period")}</Th>
                <Th className="px-3 py-2.5">{s.t("country", "Country / Branch")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("payroll_emp_count", "Employees")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("payroll_gross", "Gross")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("payroll_net", "Net")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("payroll_net_usd", "Net (USD)")}</Th>
                <Th className="px-3 py-2.5">{s.t("status_label", "Status")}</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : runs.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("payroll_empty", "No payroll runs yet.")}</td></tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" onClick={() => setOpenId(r.id)}>
                    <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.run_no}</td>
                    <td className="px-3 py-2 text-slate-500">{r.period_month}</td>
                    <td className="px-3 py-2 text-slate-500">{[r.country_name, r.city_branch_name || r.country_branch_name].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.employee_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{NUM(r.total_gross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-slate-100">{NUM(r.total_net)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{NUM(r.total_net_usd)}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status] || STATUS_TONE.draft}`}>{s.t(`payroll_st_${r.status}`, r.status)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? <CreateRun s={s} onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); void load(); setOpenId(id); }} /> : null}
    </section>
  );
}

function CreateRun({ s, onClose, onCreated }: { s: ReturnType<typeof useErpScreen>; onClose: () => void; onCreated: (id: string) => void }) {
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const r = await apiPost<{ run: { id: string } }>("/api/erp/hr/payroll", { periodMonth, notes: notes || null });
      onCreated(r.run.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-sm overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{s.t("payroll_new", "New Payroll Run")}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("payroll_period", "Period (YYYY-MM)")}</label>
            <input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className={INP} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("description", "Notes")}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={INP} />
          </div>
          <p className="text-[10px] text-slate-400">{s.t("payroll_scope_note", "The run covers active employees in your assigned country/branch scope.")}</p>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => void submit()} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("save", "Create")}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function PayrollRunDetail({ s, runId, onBack }: { s: ReturnType<typeof useErpScreen>; runId: string; onBack: () => void }) {
  const [data, setData] = useState<{ run: Row; lines: Row[]; events: Row[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<Row[]>([]);
  const [payLedger, setPayLedger] = useState("");
  const [taxLedger, setTaxLedger] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<{ run: Row; lines: Row[]; events: Row[] }>(`/api/erp/hr/payroll/${runId}`);
      setData(d);
      if (ledgers.length === 0) {
        try {
          const l = await apiGet<{ ledgers?: Row[]; rows?: Row[] }>("/api/erp/ledgers");
          setLedgers(l.ledgers ?? l.rows ?? []);
        } catch { /* ledgers optional */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [runId, ledgers.length]);

  useEffect(() => { void load(); }, [load]);

  const act = async (action: string, extra: Row = {}) => {
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/api/erp/hr/payroll/${runId}`, { action, ...extra });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const editLine = async (lineId: string, patch: Row) => {
    try {
      await apiPatch(`/api/erp/hr/payroll/lines/${lineId}`, patch);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const run = data?.run;
  const lines = data?.lines ?? [];
  const st = run?.status;

  const printConfig = () => ({
    moduleType: "hr_payroll" as const,
    reportType: "register" as const,
    title: s.t("payroll_register", "Payroll Register"),
    subtitle: run ? `${run.run_no} · ${run.period_month}` : "",
    lang: s.lang,
    orientation: "landscape" as const,
    scope: { company: run?.country_name || undefined },
    kpis: run ? [
      { label: s.t("payroll_emp_count", "Employees"), value: String(run.employee_count), color: "blue" as const },
      { label: s.t("payroll_gross", "Gross"), value: NUM(run.total_gross), color: "slate" as const },
      { label: s.t("payroll_net", "Net"), value: NUM(run.total_net), color: "emerald" as const },
      { label: s.t("payroll_net_usd", "Net (USD)"), value: NUM(run.total_net_usd), color: "purple" as const },
    ] : [],
    columns: [
      { key: "employee_name", label: s.t("employee", "Employee") },
      { key: "employee_code", label: s.t("code", "Code") },
      { key: "basic_salary", label: s.t("payroll_basic", "Basic"), align: "right" as const, format: "number" as const },
      { key: "allowances_total", label: s.t("payroll_allow", "Allowances"), align: "right" as const, format: "number" as const },
      { key: "overtime_amount", label: s.t("payroll_ot", "Overtime"), align: "right" as const, format: "number" as const },
      { key: "bonus_amount", label: s.t("payroll_bonus", "Bonus"), align: "right" as const, format: "number" as const },
      { key: "advance_recovery", label: s.t("payroll_adv", "Advance Rec."), align: "right" as const, format: "number" as const },
      { key: "tax_employee", label: s.t("payroll_tax", "Tax"), align: "right" as const, format: "number" as const },
      { key: "other_deductions", label: s.t("payroll_ded", "Deductions"), align: "right" as const, format: "number" as const },
      { key: "net_salary", label: s.t("payroll_net", "Net"), align: "right" as const, format: "number" as const },
      { key: "currency", label: s.t("currency", "Ccy") },
      { key: "usd_amount", label: s.t("payroll_net_usd", "Net USD"), align: "right" as const, format: "number" as const },
    ],
    rows: lines,
    totals: (run
      ? { net_salary: NUM(run.total_net), usd_amount: NUM(run.total_net_usd), allowances_total: NUM(run.total_allowances) }
      : undefined) as Record<string, string | number> | undefined,
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          <ChevronLeft className="h-3.5 w-3.5" />{s.t("payroll_back", "All Runs")}
        </button>

        {loading || !run ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className={s.textStart}>
                <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{run.run_no}<span className="ms-2 text-sm font-normal text-slate-400">{run.period_month}</span></h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[run.status] || STATUS_TONE.draft}`}>{s.t(`payroll_st_${run.status}`, run.status)}</span>
                  {STATUS_FLOW.map((f, i) => (
                    <span key={f} className={`text-[10px] ${STATUS_FLOW.indexOf(run.status) >= i ? "font-bold text-emerald-600" : "text-slate-300"}`}>{i > 0 ? "→ " : ""}{s.t(`payroll_st_${f}`, f)}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <UniversalPrintActionButton reportConfig={printConfig} />
                {["draft", "calculated"].includes(st) ? (
                  <button type="button" disabled={busy} onClick={() => void act("calculate")} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Calculator className="h-3.5 w-3.5" />{s.t("payroll_calc", "Calculate")}</button>
                ) : null}
                {st === "calculated" ? (
                  <button type="button" disabled={busy} onClick={() => void act("review")} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"><ClipboardCheck className="h-3.5 w-3.5" />{s.t("payroll_review", "Mark Reviewed")}</button>
                ) : null}
                {st === "reviewed" ? (
                  <button type="button" disabled={busy} onClick={() => void act("approve")} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"><ShieldCheck className="h-3.5 w-3.5" />{s.t("payroll_approve", "Approve")}</button>
                ) : null}
                {st === "approved" ? (
                  <div className="flex items-center gap-1">
                    <select value={taxLedger} onChange={(e) => setTaxLedger(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                      <option value="">{s.t("payroll_tax_ledger", "Tax Payable Ledger (optional)")}</option>
                      {ledgers.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                    </select>
                    <button type="button" disabled={busy} onClick={() => void act("post", { taxPayableLedgerId: taxLedger || null })} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><Banknote className="h-3.5 w-3.5" />{s.t("payroll_post", "Post to Accounting")}</button>
                  </div>
                ) : null}
                {st === "posted" ? (
                  <div className="flex items-center gap-1">
                    <select value={payLedger} onChange={(e) => setPayLedger(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                      <option value="">{s.t("payroll_pay_ledger", "Cash / Bank Ledger")}</option>
                      {ledgers.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                    </select>
                    <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
                    <button type="button" disabled={busy || !payLedger} onClick={() => void act("pay", { paymentLedgerId: payLedger, paymentDate: payDate })} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><Banknote className="h-3.5 w-3.5" />{s.t("payroll_pay", "Mark Paid")}</button>
                  </div>
                ) : null}
                {["posted", "paid"].includes(st) ? (
                  <button type="button" disabled={busy} onClick={() => { const r = window.prompt(s.t("payroll_reverse_reason", "Reversal reason:")); if (r) void act("reverse", { reason: r }); }} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900"><Undo2 className="h-3.5 w-3.5" />{s.t("payroll_reverse", "Reverse")}</button>
                ) : null}
                {["draft", "calculated", "reviewed"].includes(st) ? (
                  <button type="button" disabled={busy} onClick={() => { if (window.confirm(s.t("payroll_cancel_confirm", "Cancel this run?"))) void act("cancel"); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-700">{s.t("cancel", "Cancel")}</button>
                ) : null}
              </div>
            </header>

            {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <Kpi label={s.t("payroll_emp_count", "Employees")} value={run.employee_count} />
              <Kpi label={s.t("payroll_gross", "Gross")} value={NUM(run.total_gross)} />
              <Kpi label={s.t("payroll_allow", "Allowances")} value={NUM(run.total_allowances)} />
              <Kpi label={s.t("payroll_ot", "Overtime")} value={NUM(run.total_overtime)} />
              <Kpi label={s.t("payroll_adv", "Advance Rec.")} value={NUM(run.total_advance_recovery)} />
              <Kpi label={s.t("payroll_tax", "Tax")} value={NUM(run.total_tax_employee)} />
              <Kpi label={s.t("payroll_net", "Net")} value={NUM(run.total_net)} tone="text-emerald-600" />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr className="text-left">
                    <Th className="px-3 py-2.5">{s.t("employee", "Employee")}</Th>
                    <Th className="px-3 py-2.5 text-right">{s.t("payroll_basic", "Basic")}</Th>
                    <Th className="px-3 py-2.5 text-right">{s.t("payroll_allow", "Allow.")}</Th>
                    <Th className="px-3 py-2.5 text-right">{s.t("payroll_ot", "OT")}</Th>
                    <Th className="px-3 py-2.5 text-right">{s.t("payroll_bonus", "Bonus")}</Th>
                    <Th className="px-3 py-2.5 text-right">{s.t("payroll_adv", "Adv. Rec.")}</Th>
                    <Th className="px-3 py-2.5 text-right">{s.t("payroll_tax", "Tax")}</Th>
                    <Th className="px-3 py-2.5 text-right">{s.t("payroll_ded", "Other Ded.")}</Th>
                    <Th className="px-3 py-2.5 text-right">{s.t("payroll_net", "Net")}</Th>
                    <Th className="px-3 py-2.5">{s.t("currency", "Ccy")}</Th>
                    <Th className="px-3 py-2.5 text-right">{s.t("payroll_net_usd", "Net USD")}</Th>
                    <Th className="px-3 py-2.5">{s.t("status_label", "Status")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const editable = ["draft", "calculated", "reviewed"].includes(st);
                    return (
                      <tr key={l.id} className={`border-t border-slate-100 dark:border-slate-800 ${l.status === "excluded" ? "opacity-40" : ""}`}>
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{l.employee_name}<div className="font-mono text-[10px] text-slate-400">{l.employee_code}</div></td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{NUM(l.basic_salary)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{NUM(l.allowances_total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{NUM(l.overtime_amount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {editable ? (
                            <input type="number" defaultValue={Number(l.bonus_amount)} onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(l.bonus_amount)) void editLine(l.id, { bonusAmount: v }); }} className="w-20 rounded border border-slate-200 bg-transparent px-1 py-0.5 text-right text-xs dark:border-slate-700" />
                          ) : NUM(l.bonus_amount)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{NUM(l.advance_recovery)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {editable ? (
                            <input type="number" defaultValue={Number(l.tax_employee)} onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(l.tax_employee)) void editLine(l.id, { taxEmployee: v }); }} className="w-20 rounded border border-slate-200 bg-transparent px-1 py-0.5 text-right text-xs dark:border-slate-700" />
                          ) : NUM(l.tax_employee)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {editable ? (
                            <input type="number" defaultValue={Number(l.other_deductions)} onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(l.other_deductions)) void editLine(l.id, { otherDeductions: v }); }} className="w-20 rounded border border-slate-200 bg-transparent px-1 py-0.5 text-right text-xs dark:border-slate-700" />
                          ) : NUM(l.other_deductions)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-slate-100">{NUM(l.net_salary)}</td>
                        <td className="px-3 py-2 text-slate-500">{l.currency}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{NUM(l.usd_amount)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[l.status] || STATUS_TONE.calculated}`}>{s.t(`payroll_lst_${l.status}`, l.status)}</span>
                          {editable ? (
                            <button type="button" onClick={() => void editLine(l.id, { exclude: l.status !== "excluded" })} className="ms-1 text-[10px] font-bold text-slate-400 hover:text-rose-500">
                              {l.status === "excluded" ? s.t("payroll_include", "include") : s.t("payroll_exclude", "exclude")}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 ? (
                    <tr><td colSpan={12} className="px-3 py-8 text-center text-xs text-slate-400">{s.t("payroll_no_lines", "Run 'Calculate' to populate employee lines.")}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {data?.events?.length ? (
              <div>
                <p className="mb-1 text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("audit_trail", "Audit Trail")}</p>
                <ul className="space-y-1">
                  {data.events.map((ev) => (
                    <li key={ev.id} className="text-[10px] text-slate-500">
                      {new Date(ev.created_at).toLocaleString()} — <span className="font-bold">{s.t(`payroll_ev_${ev.action}`, ev.action)}</span>{ev.actor_name ? ` · ${ev.actor_name}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-black ${tone || "text-slate-900 dark:text-slate-50"}`}>{value}</div>
    </div>
  );
}
