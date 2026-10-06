/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * UAE WPS & SIF — final stage of the existing payroll run.
 * Generate: approved UAE run + MOHRE establishment → WPS validation → SIF (EDR + SCR) file.
 * Register: download the file, then record what the WPS agent did (the ERP does not transmit it).
 * Setup: MOHRE establishments (per company) and each UAE employee's WPS details.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, Download, FileCheck2, History, Landmark, Loader2, Plus, RefreshCw, ShieldCheck, X, XCircle } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";

type Row = Record<string, any>;
type Tab = "generate" | "register" | "setup";
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800";
const AMT = (v: any) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);

const STATUS_TONE: Record<string, string> = {
  generated: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  downloaded: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  submitted: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  accepted: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  partially_paid: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};
const NEXT_ACTIONS: Record<string, string[]> = {
  generated: ["submit", "cancel"],
  downloaded: ["submit", "cancel"],
  submitted: ["accept", "reject", "partially_paid"],
  accepted: ["paid", "partially_paid"],
  partially_paid: ["paid"],
};

export function WpsSifView({ lang }: { lang?: string }) {
  const s = useErpScreen("wps", lang);
  const [tab, setTab] = useState<Tab>("generate");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const statusLabel = useCallback((st: string) => s.t(`st_${st}`, st), [s]);
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "generate", label: s.t("tab_generate", "Validate & Generate SIF") },
    { id: "register", label: s.t("tab_register", "Submission Register") },
    { id: "setup", label: s.t("tab_setup", "Establishments & Employee WPS Details") },
  ];

  return (
    <div dir={s.dir} className="space-y-4" data-testid="wps-view">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white"><Landmark className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{s.t("title", "UAE WPS & SIF")}</h1>
            <p className="text-xs text-slate-500">{s.t("subtitle", "Final payroll stage: validate an approved UAE payroll run against the Wage Protection System rules and produce the Salary Information File for your WPS agent.")}</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" data-testid="wps-external-note">
        <b>{s.t("external_title", "Transmission is external.")}</b> {s.t("external_body", "The ERP generates and records the SIF; you upload it to your bank or exchange house WPS portal. No file is sent automatically and no payment or accounting entry is made here.")}
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        {tabs.map((t) => (
          <button key={t.id} type="button" data-testid={`wps-tab-${t.id}`} onClick={() => { setTab(t.id); setError(null); setNotice(null); }}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === t.id ? "bg-teal-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {error && <p data-testid="wps-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {notice && <p data-testid="wps-notice" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}
      {tab === "generate" && <GenerateTab s={s} setError={setError} setNotice={setNotice} onGenerated={() => setTab("register")} statusLabel={statusLabel} />}
      {tab === "register" && <RegisterTab s={s} setError={setError} setNotice={setNotice} statusLabel={statusLabel} />}
      {tab === "setup" && <SetupTab s={s} setError={setError} setNotice={setNotice} />}
    </div>
  );
}

type TabProps = { s: ReturnType<typeof useErpScreen>; setError: (e: string | null) => void; setNotice: (n: string | null) => void };

function GenerateTab({ s, setError, setNotice, onGenerated, statusLabel }: TabProps & { onGenerated: () => void; statusLabel: (st: string) => string }) {
  const [runs, setRuns] = useState<Row[]>([]);
  const [ests, setEsts] = useState<Row[]>([]);
  const [runId, setRunId] = useState("");
  const [estId, setEstId] = useState("");
  const [result, setResult] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([apiGet<{ runs: Row[] }>("/api/erp/hr/wps/runs"), apiGet<{ establishments: Row[] }>("/api/erp/hr/wps/establishments")])
      .then(([r, e]) => { setRuns(r.runs ?? []); setEsts((e.establishments ?? []).filter((x) => x.is_active)); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [setError]);

  const validate = async () => {
    setBusy(true); setError(null); setNotice(null); setResult(null);
    try { setResult(await apiGet<Row>(`/api/erp/hr/wps/validate?runId=${runId}&establishmentId=${estId}`)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const r = await apiPost<Row>("/api/erp/hr/wps/sif", { runId, establishmentId: estId });
      setNotice(`${s.t("generated_ok", "SIF generated")}: ${r.fileNo} · ${r.fileName} · ${r.edrCount} ${s.t("employees", "employees")} · AED ${AMT(r.total)}`);
      onGenerated();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  if (loading) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-teal-700" />;
  const run = runs.find((r) => r.id === runId);
  const issueText = (i: Row) => s.t(`issue_${i.code}`, i.message);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("payroll_run", "Approved payroll run (UAE)")}</label>
          <select data-testid="wps-run" className={INP} value={runId} onChange={(e) => { setRunId(e.target.value); setResult(null); }}>
            <option value="">{s.t("select", "Select…")}</option>
            {runs.map((r) => <option key={r.id} value={r.id}>{r.run_no} · {r.period_month} · {r.city_branch_name ?? ""} · {statusLabel(r.status)}{r.sif_status ? ` · SIF ${statusLabel(r.sif_status)}` : ""}</option>)}
          </select>
          {runs.length === 0 && <p className="mt-1 text-[11px] text-slate-500">{s.t("no_runs", "No approved UAE payroll runs in your scope. Approve a run in Payroll Runs first.")}</p>}
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("establishment", "MOHRE establishment")}</label>
          <select data-testid="wps-est" className={INP} value={estId} onChange={(e) => { setEstId(e.target.value); setResult(null); }}>
            <option value="">{s.t("select", "Select…")}</option>
            {ests.map((e) => <option key={e.id} value={e.id}>{e.company_name} · {e.establishment_id}</option>)}
          </select>
          {ests.length === 0 && <p className="mt-1 text-[11px] text-slate-500">{s.t("no_est", "No establishment set up. Add one under Establishments & Employee WPS Details.")}</p>}
        </div>
        <div className="flex items-end gap-2">
          <button type="button" data-testid="wps-validate" disabled={!runId || !estId || busy} onClick={() => void validate()} className="inline-flex items-center gap-1.5 rounded-xl border border-teal-700 px-3.5 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40">
            <ShieldCheck className="h-4 w-4" /> {s.t("validate", "Validate")}
          </button>
          <button type="button" data-testid="wps-generate" disabled={!result?.ok || busy || !!run?.sif_status} onClick={() => void generate()} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} {s.t("generate", "Generate SIF")}
          </button>
        </div>
      </section>

      {result && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" data-testid="wps-result" data-ok={result.ok ? "1" : "0"}>
          <div className="flex flex-wrap items-center gap-3">
            {result.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
            <p className="text-sm font-bold">{result.ok ? s.t("valid", "Ready for WPS") : s.t("invalid", "Not ready — fix the errors below")}</p>
            <div className="ms-auto flex flex-wrap gap-2 text-[11px]">
              {[
                ["lines", s.t("sum_lines", "Lines"), result.summary?.lines],
                ["ready", s.t("sum_ready", "Ready"), result.summary?.ready],
                ["errors", s.t("sum_errors", "Errors"), result.summary?.errors],
                ["warnings", s.t("sum_warnings", "Warnings"), result.summary?.warnings],
              ].map(([k, l, v]) => <span key={k as string} data-testid={`wps-sum-${k}`} className="rounded-lg bg-slate-100 px-2 py-1 font-semibold dark:bg-slate-800">{l}: <b className="tabular-nums">{v}</b></span>)}
              <span className="rounded-lg bg-teal-50 px-2 py-1 font-semibold text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">AED <b className="tabular-nums" dir="ltr">{AMT(result.summary?.total)}</b></span>
            </div>
          </div>
          {run?.sif_status && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{s.t("already_sif", "This run already has a live SIF — see the Submission Register.")}</p>}
          {(result.issues ?? []).length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[600px] text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>{[s.t("level", "Level"), s.t("employee", "Employee"), s.t("issue", "Issue")].map((h) => <Th key={h} className={`px-3 py-2 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
                </thead>
                <tbody>
                  {(result.issues as Row[]).map((i, n) => (
                    <tr key={n} data-testid="wps-issue" data-code={i.code} data-level={i.level} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{i.level === "error" ? <span className="inline-flex items-center gap-1 font-bold text-rose-600"><XCircle className="h-3.5 w-3.5" />{s.t("lvl_error", "Error")}</span> : <span className="inline-flex items-center gap-1 font-bold text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />{s.t("lvl_warning", "Warning")}</span>}</td>
                      <td className="px-3 py-2 font-mono">{i.employeeCode ?? "—"}</td>
                      <td className="px-3 py-2">{issueText(i)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function RegisterTab({ s, setError, setNotice, statusLabel }: TabProps & { statusLabel: (st: string) => string }) {
  const [files, setFiles] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Row | null>(null);
  const [pending, setPending] = useState<{ id: string; action: string } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setFiles((await apiGet<{ files: Row[] }>("/api/erp/hr/wps/sif")).files ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { void load(); }, [load]);

  const openDetail = async (id: string) => {
    try { setDetail(await apiGet<Row>(`/api/erp/hr/wps/sif/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const download = async (f: Row) => {
    setError(null);
    try {
      const res = await fetch(`/api/erp/hr/wps/sif/${f.id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = f.file_name;
      a.click();
      URL.revokeObjectURL(a.href);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const actionLabel = (a: string) => s.t(`act_${a}`, a);
  const needsText = (a: string) => ["submit", "reject", "partially_paid"].includes(a);
  const run = async (id: string, action: string, value?: string) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await apiPatch(`/api/erp/hr/wps/sif/${id}`, { action, reference: action === "submit" ? value : null, response: action !== "submit" ? value || null : null });
      setNotice(`${actionLabel(action)} ✓`);
      setPending(null); setText("");
      await load();
      if (detail?.file?.id === id) await openDetail(id);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-slate-800">
          <h3 className="text-sm font-bold">{s.t("tab_register", "Submission Register")}</h3>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold dark:border-slate-700"><RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs" data-testid="wps-register">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>{[s.t("file_no", "File No."), s.t("file_name", "SIF file"), s.t("payroll_run_short", "Payroll run"), s.t("company", "Company"), s.t("salary_month", "Salary month"), s.t("edr_count", "Employees"), s.t("total", "Total (AED)"), s.t("status", "Status"), s.t("reference", "Agent reference"), s.t("actions", "Actions")].map((h) => <Th key={h} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-teal-700" /></td></tr>
              ) : files.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-400">{s.t("no_files", "No SIF files generated yet.")}</td></tr>
              ) : files.map((f) => (
                <tr key={f.id} data-testid="wps-file" data-status={f.status} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="px-3 py-2 font-mono font-semibold">{f.file_no}</td>
                  <td className="px-3 py-2 font-mono" dir="ltr">{f.file_name}</td>
                  <td className="px-3 py-2">{f.run_no}</td>
                  <td className="px-3 py-2">{f.company_name}<div className="font-mono text-[10px] text-slate-400" dir="ltr">{f.mohre_id}</div></td>
                  <td className="px-3 py-2 font-mono">{f.salary_month}</td>
                  <td className="px-3 py-2 tabular-nums">{f.edr_count}</td>
                  <td className="px-3 py-2 tabular-nums" dir="ltr">{AMT(f.total_amount)}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[f.status] ?? STATUS_TONE.generated}`}>{statusLabel(f.status)}</span></td>
                  <td className="px-3 py-2">{f.submission_reference ?? "—"}{f.agent_response ? <div className="text-[10px] text-slate-500">{f.agent_response}</div> : null}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" data-testid="wps-download" onClick={() => void download(f)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold hover:bg-slate-50 dark:border-slate-700"><Download className="h-3 w-3" />{s.t("download", "Download SIF")}</button>
                      <button type="button" onClick={() => void openDetail(f.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold hover:bg-slate-50 dark:border-slate-700"><History className="h-3 w-3" />{s.t("details", "Lines & history")}</button>
                      {(NEXT_ACTIONS[f.status] ?? []).map((a) => (
                        <button key={a} type="button" data-testid={`wps-act-${a}`} disabled={busy} onClick={() => (needsText(a) ? (setPending({ id: f.id, action: a }), setText("")) : void run(f.id, a))}
                          className={`rounded-lg px-2 py-1 text-[10px] font-bold disabled:opacity-50 ${a === "reject" || a === "cancel" ? "border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300" : "bg-teal-700 text-white"}`}>{actionLabel(a)}</button>
                      ))}
                    </div>
                    {pending && pending.id === f.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <input data-testid="wps-act-text" className={`${INP} w-56`} value={text} onChange={(e) => setText(e.target.value)} placeholder={pending.action === "submit" ? s.t("ref_placeholder", "Agent submission reference") : s.t("resp_placeholder", "Agent response / reason")} />
                        <button type="button" data-testid="wps-act-confirm" disabled={!text.trim() || busy} onClick={() => void run(f.id, pending.action, text.trim())} className="rounded-lg bg-teal-700 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50">{s.t("confirm", "Confirm")}</button>
                        <button type="button" aria-label={s.t("close", "Close")} onClick={() => setPending(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" data-testid="wps-detail">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">{detail.file.file_no} · <span className="font-mono" dir="ltr">{detail.file.file_name}</span></h3>
            <button type="button" aria-label={s.t("close", "Close")} onClick={() => setDetail(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>{["#", s.t("employee", "Employee"), s.t("person_id", "Person ID"), s.t("routing", "Routing code"), s.t("account", "IBAN / account"), s.t("days", "Days"), s.t("fixed", "Fixed"), s.t("variable", "Variable"), s.t("leave_days", "Leave days")].map((h) => <Th key={h} className={`px-3 py-2 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
              </thead>
              <tbody>
                {(detail.lines as Row[]).map((l) => (
                  <tr key={l.id} data-testid="wps-line" className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-1.5 tabular-nums">{l.line_no}</td>
                    <td className="px-3 py-1.5">{l.employee_name}<div className="font-mono text-[10px] text-slate-400">{l.employee_code}</div></td>
                    <td className="px-3 py-1.5 font-mono" dir="ltr">{l.person_id}</td>
                    <td className="px-3 py-1.5 font-mono" dir="ltr">{l.routing_code}</td>
                    <td className="px-3 py-1.5 font-mono" dir="ltr">{l.account}</td>
                    <td className="px-3 py-1.5 tabular-nums">{l.days_in_period}</td>
                    <td className="px-3 py-1.5 tabular-nums" dir="ltr">{AMT(l.fixed_amount)}</td>
                    <td className="px-3 py-1.5 tabular-nums" dir="ltr">{AMT(l.variable_amount)}</td>
                    <td className="px-3 py-1.5 tabular-nums">{l.leave_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <PaymentResultsSection s={s} detail={detail} onReconciled={async () => { await Promise.all([openDetail(detail.file.id), load()]); }} />
          </div>

          <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">{s.t("history", "Audit history")}</h4>
          <ul className="mt-2 space-y-1 text-xs" data-testid="wps-events">
            {(detail.events as Row[]).map((e) => (
              <li key={e.id} className="flex flex-wrap gap-2 border-s-2 border-teal-600 ps-2">
                <span className="tabular-nums text-slate-500">{new Date(e.created_at).toLocaleString()}</span>
                <b>{s.t(`ev_${e.action}`, e.action)}</b>
                {e.from_status && <span>{statusLabel(e.from_status)} → {statusLabel(e.to_status)}</span>}
                {e.actor_name && <span className="text-slate-500">· {e.actor_name}</span>}
                {e.detail?.reference && <span className="font-mono">· {e.detail.reference}</span>}
                {e.detail?.response && <span>· {e.detail.response}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type PayRowState = { status: "" | "paid" | "rejected"; reason: string; bankRef: string; amount: string };

function PaymentResultsSection({ s, detail, onReconciled }: { s: ReturnType<typeof useErpScreen>; detail: Row; onReconciled: () => Promise<void> }) {
  const file = detail.file as Row;
  const lines = (detail.lines ?? []) as Row[];
  const existing = (detail.paymentResults ?? []) as Row[];
  const existingByEmp = useMemo(() => new Map(existing.map((r) => [r.employee_id, r])), [existing]);
  const reconcilable = ["submitted", "accepted", "partially_paid"].includes(file.status);

  const [ledgers, setLedgers] = useState<Row[]>([]);
  const [paymentLedgerId, setPaymentLedgerId] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Record<string, PayRowState>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!reconcilable || ledgers.length) return;
    apiGet<{ ledgers?: Row[]; rows?: Row[] }>("/api/erp/ledgers").then((l) => setLedgers(l.ledgers ?? l.rows ?? [])).catch(() => {});
  }, [reconcilable, ledgers.length]);

  const defaultFor = (l: Row): PayRowState => ({ status: "", reason: "", bankRef: "", amount: String(Number(l.fixed_amount || 0) + Number(l.variable_amount || 0)) });
  const set = (l: Row, patch: Partial<PayRowState>) =>
    setRows((p) => ({ ...p, [l.employee_id]: { ...defaultFor(l), ...p[l.employee_id], ...patch } }));

  const submit = async () => {
    setErr(null); setNotice(null);
    if (!paymentLedgerId) { setErr(s.t("pay_need_ledger", "Select a payment ledger first.")); return; }
    const results = lines
      .filter((l) => !existingByEmp.has(l.employee_id) && rows[l.employee_id]?.status)
      .map((l) => {
        const r = rows[l.employee_id];
        return {
          employeeId: l.employee_id,
          resultStatus: r.status as "paid" | "rejected",
          resultReason: r.reason.trim() || null,
          bankReference: r.bankRef.trim() || null,
          amount: r.amount.trim() ? Number(r.amount) : null,
        };
      });
    if (results.length === 0) { setErr(s.t("pay_need_one", "Report at least one employee's result.")); return; }
    setBusy(true);
    try {
      await apiPost(`/api/erp/hr/wps/sif/${file.id}/payment-results`, { paymentLedgerId, paymentDate, results });
      setNotice(s.t("pay_submit_ok", "Payment results recorded."));
      setRows({});
      await onReconciled();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  if (!reconcilable) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" data-testid="wps-pay-section">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.t("pay_title", "Payment Results (bank reconciliation)")}</h4>
        <p className="mt-2 text-xs text-slate-500">{s.t("pay_not_reconcilable", "Payment results can be recorded once this file has been submitted to the WPS agent.")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" data-testid="wps-pay-section">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.t("pay_title", "Payment Results (bank reconciliation)")}</h4>
      <p className="mt-1 text-[11px] text-slate-500">{s.t("pay_hint", "Record what the bank/WPS agent reported for each employee. Paid posts the real accounting entry and closes the payroll line; Rejected records the reason with no accounting impact.")}</p>
      {err && <p data-testid="wps-pay-error" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}
      {notice && <p data-testid="wps-pay-notice" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("pay_ledger", "Payment ledger (cash / bank)")}</label>
          <select data-testid="wps-pay-ledger" className={INP} value={paymentLedgerId} onChange={(e) => setPaymentLedgerId(e.target.value)}>
            <option value="">{s.t("select", "Select…")}</option>
            {ledgers.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("pay_date", "Payment date")}</label>
          <input data-testid="wps-pay-date" type="date" className={INP} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[880px] text-xs" data-testid="wps-pay-rows">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>{[s.t("employee", "Employee"), s.t("pay_result", "Result"), s.t("pay_reason_ph", "Reason (if rejected)"), s.t("pay_bankref_ph", "Bank reference"), s.t("pay_amount", "Amount")].map((h) => <Th key={h} className={`px-3 py-2 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const ex = existingByEmp.get(l.employee_id);
              if (ex) {
                return (
                  <tr key={l.id} data-testid="wps-pay-row" data-status="recorded" className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-1.5">{l.employee_name}<div className="font-mono text-[10px] text-slate-400">{l.employee_code}</div></td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ex.result_status === "paid" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"}`}>
                        {ex.result_status === "paid" ? s.t("st_paid", "Paid") : s.t("pay_rejected", "Rejected")}
                      </span>
                      <div className="mt-0.5 text-[10px] text-slate-400">{s.t("pay_already_badge", "Already recorded")}</div>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">{ex.result_reason ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-500" dir="ltr">{ex.bank_reference ?? "—"}</td>
                    <td className="px-3 py-1.5 tabular-nums text-slate-500" dir="ltr">{ex.amount != null ? AMT(ex.amount) : "—"}</td>
                  </tr>
                );
              }
              const r = rows[l.employee_id] ?? defaultFor(l);
              return (
                <tr key={l.id} data-testid="wps-pay-row" data-status="pending" className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-1.5">{l.employee_name}<div className="font-mono text-[10px] text-slate-400">{l.employee_code}</div></td>
                  <td className="px-3 py-1.5">
                    <select data-testid="wps-pay-status" className={`${INP} w-32`} value={r.status} onChange={(e) => set(l, { status: e.target.value as PayRowState["status"] })}>
                      <option value="">{s.t("pay_unset", "— not reported —")}</option>
                      <option value="paid">{s.t("st_paid", "Paid")}</option>
                      <option value="rejected">{s.t("pay_rejected", "Rejected")}</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5"><input data-testid="wps-pay-reason" className={`${INP} w-40`} disabled={r.status !== "rejected"} value={r.reason} onChange={(e) => set(l, { reason: e.target.value })} /></td>
                  <td className="px-3 py-1.5"><input data-testid="wps-pay-bankref" className={`${INP} w-32 font-mono`} dir="ltr" disabled={!r.status} value={r.bankRef} onChange={(e) => set(l, { bankRef: e.target.value })} /></td>
                  <td className="px-3 py-1.5"><input data-testid="wps-pay-amount" type="number" step="0.01" className={`${INP} w-24 font-mono`} dir="ltr" disabled={!r.status} value={r.amount} onChange={(e) => set(l, { amount: e.target.value })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" data-testid="wps-pay-submit" disabled={busy} onClick={() => void submit()} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} {s.t("pay_submit", "Submit payment results")}
      </button>
    </section>
  );
}

function SetupTab({ s, setError, setNotice }: TabProps) {
  const [ests, setEsts] = useState<Row[]>([]);
  const [emps, setEmps] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState({ companyId: "", establishmentId: "", employerRoutingCode: "", agentName: "", employerReference: "" });
  const [edit, setEdit] = useState<Record<string, Row>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, m] = await Promise.all([apiGet<{ establishments: Row[] }>("/api/erp/hr/wps/establishments"), apiGet<{ employees: Row[] }>("/api/erp/hr/wps/employees")]);
      setEsts(e.establishments ?? []);
      setEmps(m.employees ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!showAdd || companies.length) return;
    apiGet<any>("/api/branch-management/countries").then(async (r) => {
      const uae = (r?.countries ?? []).find((c: Row) => String(c.iso2 ?? "").toUpperCase() === "AE");
      if (!uae) return;
      const c = await apiGet<any>(`/api/erp/companies?countryId=${uae.id}&limit=200`);
      setCompanies(c?.companies ?? []);
    }).catch(() => setCompanies([]));
  }, [showAdd, companies.length]);

  const addEst = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await apiPost("/api/erp/hr/wps/establishments", { ...f, agentName: f.agentName || null, employerReference: f.employerReference || null });
      setShowAdd(false);
      setF({ companyId: "", establishmentId: "", employerRoutingCode: "", agentName: "", employerReference: "" });
      setNotice(s.t("est_saved", "Establishment saved."));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const saveEmp = async (id: string) => {
    const v = edit[id];
    setBusy(true); setError(null); setNotice(null);
    try {
      await apiPatch(`/api/erp/hr/wps/employees/${id}`, { personId: v.wps_person_id || null, routingCode: v.wps_routing_code || null, iban: v.wps_iban || null, establishmentId: v.wps_establishment_id || null });
      setEdit((p) => { const n = { ...p }; delete n[id]; return n; });
      setNotice(s.t("emp_saved", "Employee WPS details saved."));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const missingLabel = useMemo(() => ({
    person_id: s.t("miss_person_id", "Person ID"),
    routing_code: s.t("miss_routing", "Routing code"),
    account: s.t("miss_account", "IBAN / account"),
    establishment: s.t("miss_establishment", "Establishment"),
  } as Record<string, string>), [s]);

  if (loading) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-teal-700" />;
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-slate-800">
          <h3 className="text-sm font-bold">{s.t("establishments", "MOHRE establishments")}</h3>
          <button type="button" data-testid="wps-est-add" onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white"><Plus className="h-4 w-4" />{s.t("add_est", "Add establishment")}</button>
        </div>
        {showAdd && (
          <div className="grid grid-cols-1 gap-2 border-b border-slate-100 p-3 dark:border-slate-800 md:grid-cols-5">
            <select data-testid="wps-f-company" className={INP} value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
              <option value="">{s.t("company", "Company")}…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name ?? c.company_name}</option>)}
            </select>
            <input data-testid="wps-f-estid" className={INP} dir="ltr" inputMode="numeric" maxLength={13} placeholder={s.t("est_id_ph", "MOHRE ID (13 digits)")} value={f.establishmentId} onChange={(e) => setF({ ...f, establishmentId: e.target.value.replace(/\D/g, "") })} />
            <input data-testid="wps-f-routing" className={INP} dir="ltr" inputMode="numeric" maxLength={9} placeholder={s.t("routing_ph", "Agent routing (9 digits)")} value={f.employerRoutingCode} onChange={(e) => setF({ ...f, employerRoutingCode: e.target.value.replace(/\D/g, "") })} />
            <input className={INP} placeholder={s.t("agent_ph", "WPS agent (bank / exchange house)")} value={f.agentName} onChange={(e) => setF({ ...f, agentName: e.target.value })} />
            <button type="button" data-testid="wps-f-save" disabled={busy || !f.companyId || f.establishmentId.length !== 13 || f.employerRoutingCode.length !== 9} onClick={() => void addEst()} className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{s.t("save", "Save")}</button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>{[s.t("company", "Company"), s.t("est_id", "MOHRE establishment ID"), s.t("routing", "Routing code"), s.t("agent", "WPS agent"), s.t("employees", "employees")].map((h) => <Th key={h} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
            </thead>
            <tbody>
              {ests.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">{s.t("no_est_rows", "No establishments yet.")}</td></tr>
              ) : ests.map((e) => (
                <tr key={e.id} data-testid="wps-est-row" className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{e.company_name}</td>
                  <td className="px-3 py-2 font-mono" dir="ltr">{e.establishment_id}</td>
                  <td className="px-3 py-2 font-mono" dir="ltr">{e.employer_routing_code}</td>
                  <td className="px-3 py-2">{e.agent_name ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{e.employee_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-3 dark:border-slate-800">
          <h3 className="text-sm font-bold">{s.t("emp_details", "Employee WPS details (UAE)")}</h3>
          <p className="text-[11px] text-slate-500">{s.t("emp_details_hint", "Person ID = MOHRE labour card personal number. The routing code and IBAN / account are the employee's salary account at the WPS agent.")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-xs" data-testid="wps-emps">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>{[s.t("employee", "Employee"), s.t("person_id", "Person ID"), s.t("routing", "Routing code"), s.t("account", "IBAN / account"), s.t("establishment", "MOHRE establishment"), s.t("missing", "Missing"), ""].map((h, i) => <Th key={i} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
            </thead>
            <tbody>
              {emps.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">{s.t("no_emps", "No UAE employees in your scope.")}</td></tr>
              ) : emps.map((e) => {
                const v = edit[e.id] ?? e;
                const set = (k: string, val: string) => setEdit((p) => ({ ...p, [e.id]: { ...(p[e.id] ?? e), [k]: val } }));
                return (
                  <tr key={e.id} data-testid="wps-emp-row" data-code={e.employee_code} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-1.5">{e.name}<div className="font-mono text-[10px] text-slate-400">{e.employee_code}</div></td>
                    <td className="px-3 py-1.5"><input data-testid="wps-e-person" className={`${INP} w-36 font-mono`} dir="ltr" maxLength={14} value={v.wps_person_id ?? ""} onChange={(x) => set("wps_person_id", x.target.value.replace(/\D/g, ""))} /></td>
                    <td className="px-3 py-1.5"><input data-testid="wps-e-routing" className={`${INP} w-28 font-mono`} dir="ltr" maxLength={9} value={v.wps_routing_code ?? ""} onChange={(x) => set("wps_routing_code", x.target.value.replace(/\D/g, ""))} /></td>
                    <td className="px-3 py-1.5"><input data-testid="wps-e-iban" className={`${INP} w-56 font-mono`} dir="ltr" maxLength={34} value={v.wps_iban ?? ""} onChange={(x) => set("wps_iban", x.target.value.toUpperCase())} /></td>
                    <td className="px-3 py-1.5">
                      <select data-testid="wps-e-est" className={`${INP} w-48`} value={v.wps_establishment_id ?? ""} onChange={(x) => set("wps_establishment_id", x.target.value)}>
                        <option value="">—</option>
                        {ests.map((x) => <option key={x.id} value={x.id}>{x.company_name} · {x.establishment_id}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">{(e.issues ?? []).length ? <span className="text-amber-700 dark:text-amber-300">{(e.issues as string[]).map((k) => missingLabel[k] ?? k).join(", ")}</span> : <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />{s.t("complete", "Complete")}</span>}</td>
                    <td className="px-3 py-1.5">{edit[e.id] && <button type="button" data-testid="wps-e-save" disabled={busy} onClick={() => void saveEmp(e.id)} className="rounded-lg bg-teal-700 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-50">{s.t("save", "Save")}</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
