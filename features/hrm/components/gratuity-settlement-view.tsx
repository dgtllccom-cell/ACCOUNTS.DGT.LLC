"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Calculator, RefreshCw, X, ShieldCheck, Banknote, ChevronLeft } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Row = Record<string, any>;
const INP = "w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700";
const NUM = (v: any) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);

const TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800",
  calculated: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  approved: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800",
};

export function GratuitySettlementView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiGet<{ rows: Row[] }>("/api/erp/hr/gratuity");
      setRows(r.rows ?? []);
      if (employees.length === 0) {
        const e = await apiGet<{ rows: Row[] }>("/api/erp/hr/employees");
        setEmployees(e.rows ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [employees.length]);

  useEffect(() => { void load(); }, [load]);

  if (openId) return <SettlementDetail s={s} id={openId} onBack={() => { setOpenId(null); void load(); }} />;

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("grat_title", "Gratuity & Final Settlement")}</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
              {s.t("grat_blurb", "End-of-service worksheet: pending salary + paid-leave encashment + gratuity (per the country policy) + other additions − outstanding advances − other deductions = net settlement. Payment posts one balanced Roznamcha entry.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}
            </button>
            <button type="button" onClick={() => setShowCalc(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
              <Calculator className="h-3.5 w-3.5" />{s.t("grat_calc", "Calculate Settlement")}
            </button>
          </div>
        </header>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <Th className="px-3 py-2.5">{s.t("grat_no", "Settlement No")}</Th>
                <Th className="px-3 py-2.5">{s.t("employee", "Employee")}</Th>
                <Th className="px-3 py-2.5">{s.t("grat_type", "Type")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("grat_service", "Service Yrs")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("grat_gratuity", "Gratuity")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("grat_net", "Net Settlement")}</Th>
                <Th className="px-3 py-2.5">{s.t("currency", "Ccy")}</Th>
                <Th className="px-3 py-2.5">{s.t("status_label", "Status")}</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("grat_empty", "No settlements yet.")}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" onClick={() => setOpenId(r.id)}>
                    <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.settlement_no}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.employee_name} <span className="font-mono text-[10px] text-slate-400">{r.employee_code}</span></td>
                    <td className="px-3 py-2 text-slate-500">{s.t(`lc_sub_${r.separation_type}`, r.separation_type)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{Number(r.service_years).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{NUM(r.gratuity_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-slate-100">{NUM(r.net_settlement)}</td>
                    <td className="px-3 py-2 text-slate-500">{r.currency}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[r.status] || TONE.draft}`}>{s.t(`grat_st_${r.status}`, r.status)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCalc ? <CalcForm s={s} employees={employees} onClose={() => setShowCalc(false)} onDone={(id) => { setShowCalc(false); void load(); setOpenId(id); }} /> : null}
    </section>
  );
}

function CalcForm({ s, employees, onClose, onDone }: { s: ReturnType<typeof useErpScreen>; employees: Row[]; onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState<Row>({ employeeId: "", calcAsOf: new Date().toISOString().slice(0, 10), pendingSalaryAmount: 0, noticePayAmount: 0, otherAdditions: 0, otherDeductions: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload = { ...f };
      ["pendingSalaryAmount", "noticePayAmount", "otherAdditions", "otherDeductions"].forEach((k) => { payload[k] = Number(payload[k]) || 0; });
      const r = await apiPost<{ settlement: { id: string } }>("/api/erp/hr/gratuity", payload);
      onDone(r.settlement.id);
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
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{s.t("grat_calc", "Calculate Settlement")}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}
        <div className="mt-4 space-y-3">
          <L label={s.t("employee", "Employee")}>
            <select value={f.employeeId} onChange={(e) => set("employeeId", e.target.value)} className={INP}>
              <option value="">{s.t("select_employee", "Select employee…")}</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}
            </select>
          </L>
          <L label={s.t("grat_as_of", "Calculate As Of")}><input type="date" value={f.calcAsOf} onChange={(e) => set("calcAsOf", e.target.value)} className={INP} /></L>
          <L label={s.t("grat_pending_salary", "Pending Salary")}><input type="number" value={f.pendingSalaryAmount} onChange={(e) => set("pendingSalaryAmount", e.target.value)} className={INP} /></L>
          <L label={s.t("grat_notice_pay", "Notice Pay")}><input type="number" value={f.noticePayAmount} onChange={(e) => set("noticePayAmount", e.target.value)} className={INP} /></L>
          <div className="grid grid-cols-2 gap-2">
            <L label={s.t("grat_other_add", "Other Additions")}><input type="number" value={f.otherAdditions} onChange={(e) => set("otherAdditions", e.target.value)} className={INP} /></L>
            <L label={s.t("grat_other_ded", "Other Deductions")}><input type="number" value={f.otherDeductions} onChange={(e) => set("otherDeductions", e.target.value)} className={INP} /></L>
          </div>
          <p className="text-[10px] text-slate-400">{s.t("grat_hint", "Gratuity, service years, paid-leave encashment and outstanding advances are computed automatically from the employee record + country policy.")}</p>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => void submit()} disabled={saving || !f.employeeId} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("grat_calc", "Calculate")}</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function SettlementDetail({ s, id, onBack }: { s: ReturnType<typeof useErpScreen>; id: string; onBack: () => void }) {
  const [row, setRow] = useState<Row | null>(null);
  const [ledgers, setLedgers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payLedger, setPayLedger] = useState("");
  const [expLedger, setExpLedger] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ settlement: Row }>(`/api/erp/hr/gratuity/${id}`);
      setRow(r.settlement);
      if (ledgers.length === 0) {
        try { const l = await apiGet<{ ledgers?: Row[]; rows?: Row[] }>("/api/erp/ledgers"); setLedgers(l.ledgers ?? l.rows ?? []); } catch { /* optional */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id, ledgers.length]);

  useEffect(() => { void load(); }, [load]);

  const act = async (action: string, extra: Row = {}) => {
    setBusy(true);
    setError(null);
    try { await apiPatch(`/api/erp/hr/gratuity/${id}`, { action, ...extra }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const lines = useMemo(() => {
    if (!row) return [];
    return [
      { k: s.t("grat_pending_salary", "Pending Salary"), v: Number(row.pending_salary_amount), sign: 1 },
      { k: s.t("grat_leave_encash", "Leave Encashment") + ` (${Number(row.leave_encashment_days).toFixed(1)} d)`, v: Number(row.leave_encashment_amount), sign: 1 },
      { k: s.t("grat_gratuity", "Gratuity") + ` (${Number(row.gratuity_days).toFixed(1)} d, ${Number(row.service_years).toFixed(2)} yr)`, v: Number(row.gratuity_amount), sign: 1 },
      { k: s.t("grat_notice_pay", "Notice Pay"), v: Number(row.notice_pay_amount), sign: 1 },
      { k: s.t("grat_other_add", "Other Additions"), v: Number(row.other_additions), sign: 1 },
      { k: s.t("grat_advance_ded", "Outstanding Advance Recovery"), v: Number(row.advance_deduction), sign: -1 },
      { k: s.t("grat_other_ded", "Other Deductions"), v: Number(row.other_deductions), sign: -1 },
    ];
  }, [row, s]);

  const printConfig = () => ({
    moduleType: "hr_payroll" as const,
    reportType: "single_document" as const,
    title: s.t("grat_worksheet", "Final Settlement Worksheet"),
    subtitle: row ? `${row.settlement_no} · ${row.employee_name}` : "",
    lang: s.lang,
    orientation: "portrait" as const,
    partyDetails: row ? { type: "employee" as const, name: row.employee_name, code: row.employee_code } : undefined,
    columns: [
      { key: "k", label: s.t("grat_component", "Component") },
      { key: "amount", label: s.t("col_amount", "Amount"), align: "right" as const, format: "number" as const },
    ],
    rows: lines.map((l) => ({ k: l.k, amount: `${l.sign < 0 ? "-" : ""}${NUM(l.v)}` })),
    totals: row ? ({ amount: `${NUM(row.net_settlement)} ${row.currency}` } as Record<string, string | number>) : undefined,
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"><ChevronLeft className="h-3.5 w-3.5" />{s.t("grat_back", "All Settlements")}</button>

        {loading || !row ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className={s.textStart}>
                <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{row.settlement_no}</h1>
                <p className="text-xs text-slate-500">{row.employee_name} · {row.employee_code} · {s.t(`lc_sub_${row.separation_type}`, row.separation_type)}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[row.status] || TONE.draft}`}>{s.t(`grat_st_${row.status}`, row.status)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <UniversalPrintActionButton reportConfig={printConfig} />
                {row.status === "calculated" ? (
                  <button type="button" disabled={busy} onClick={() => void act("approve")} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"><ShieldCheck className="h-3.5 w-3.5" />{s.t("payroll_approve", "Approve")}</button>
                ) : null}
                {["calculated", "approved"].includes(row.status) ? (
                  <button type="button" disabled={busy} onClick={() => { if (window.confirm(s.t("grat_cancel_confirm", "Cancel this settlement?"))) void act("cancel"); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-700">{s.t("cancel", "Cancel")}</button>
                ) : null}
              </div>
            </header>

            {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-xs">
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="py-2 text-slate-600 dark:text-slate-300">{l.k}</td>
                      <td className={`py-2 text-right tabular-nums ${l.sign < 0 ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>{l.sign < 0 ? "−" : ""}{NUM(l.v)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600">
                    <td className="py-2.5 font-black text-slate-900 dark:text-slate-50">{s.t("grat_net", "Net Settlement")}</td>
                    <td className="py-2.5 text-right font-black tabular-nums text-slate-900 dark:text-slate-50">{NUM(row.net_settlement)} {row.currency}</td>
                  </tr>
                  {row.currency !== "USD" ? (
                    <tr><td className="py-1 text-[10px] text-slate-400">{s.t("grat_usd", "USD equivalent")}</td><td className="py-1 text-right text-[10px] text-slate-400">{NUM(row.usd_amount)} USD @ {Number(row.exchange_rate).toFixed(4)}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {row.status === "approved" ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("grat_pay", "Pay Settlement")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={expLedger} onChange={(e) => setExpLedger(e.target.value)} className={INP + " sm:w-52"}>
                    <option value="">{s.t("grat_exp_ledger", "Expense Ledger (optional)")}</option>
                    {ledgers.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                  </select>
                  <select value={payLedger} onChange={(e) => setPayLedger(e.target.value)} className={INP + " sm:w-52"}>
                    <option value="">{s.t("payroll_pay_ledger", "Cash / Bank Ledger")}</option>
                    {ledgers.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                  </select>
                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={INP + " sm:w-40"} />
                  <button type="button" disabled={busy || !payLedger} onClick={() => void act("pay", { paymentLedgerId: payLedger, expenseLedgerId: expLedger || null, paymentDate: payDate })} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                    <Banknote className="h-3.5 w-3.5" />{s.t("grat_post_pay", "Post & Pay")}
                  </button>
                </div>
              </div>
            ) : null}

            {row.status === "paid" ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {s.t("grat_paid_on", "Paid on")} {row.paid_at ? new Date(row.paid_at).toLocaleDateString() : "—"}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}
