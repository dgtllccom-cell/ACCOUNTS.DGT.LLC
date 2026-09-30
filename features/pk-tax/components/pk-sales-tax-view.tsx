/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Pakistan Monthly Sales Tax — a separate module from Income Tax, mirroring
 * the same architecture. Tax entity (company + STRN) and period -> output/
 * input tax working (both manually entered by the preparer from their own
 * real tax registers — never invented) -> accountant rate confirmation ->
 * review -> recorded filing and payment. The ERP does not file with FBR/IRIS.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, Landmark, Loader2, Plus, ShieldCheck, X } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";

type Row = Record<string, any>;
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800";
const PKR = (v: any) => (v == null || v === "" ? "—" : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v)));
const d10 = (v: any) => (v ? String(v).slice(0, 10) : "—");
const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  in_preparation: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  ready_for_review: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  reviewed: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  filed: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};
const NEXT: Record<string, string[]> = { draft: ["cancel"], in_preparation: ["ready", "cancel"], ready_for_review: ["review", "back"], reviewed: ["file", "back"], filed: ["pay"] };

export function PkSalesTaxView({ lang }: { lang?: string }) {
  const s = useErpScreen("pkst", lang);
  const params = useSearchParams();
  const [data, setData] = useState<Row | null>(null);
  const [openId, setOpenId] = useState<string | null>(params?.get("return") ?? null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const statusLabel = useCallback((st: string) => s.t(`st_${st}`, st), [s]);

  const load = useCallback(async () => {
    try { setData(await apiGet<Row>("/api/erp/pk-tax/sales-tax")); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const dash = data?.dashboard;
  return (
    <section dir={s.dir} className="space-y-4" data-testid="pkst-view">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-600/10 text-green-600 dark:text-green-400"><Landmark className="h-5 w-5" /></span>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{s.t("title", "Pakistan Sales Tax")}</h1>
            <p className="text-xs text-slate-500">{s.t("subtitle", "Monthly output/input tax working, accountant rate confirmation, review and filing record per company and period.")}</p>
          </div>
        </div>
        <button type="button" data-testid="pkst-new" onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-green-700"><Plus className="h-4 w-4" />{s.t("new", "New Sales Tax return")}</button>
      </header>
      <p className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" data-testid="pkst-fbr-note">
        <b>{s.t("fbr_title", "No automatic FBR filing.")}</b> {s.t("fbr_body", "Output and input tax must be entered from your own real sales/purchase tax registers — this screen never invents them. The 18% seed rate is sourced from the Sales Tax Act 1990 but MUST be confirmed by a Pakistani tax accountant before a return can move to review. File and pay on IRIS, then record the reference here.")}
      </p>
      {error && <p data-testid="pkst-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {notice && <p data-testid="pkst-notice" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}

      {openId ? (
        <ReturnDetail s={s} id={openId} statusLabel={statusLabel} onClose={() => { setOpenId(null); void load(); }} setError={setError} setNotice={setNotice} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6" data-testid="pkst-kpis">
            {[
              ["open", s.t("k_open", "Open returns"), dash?.open],
              ["due15", s.t("k_due15", "Due within 15 days"), dash?.dueIn15],
              ["overdue", s.t("k_overdue", "Overdue"), dash?.overdue],
              ["unconfirmed", s.t("k_unconfirmed", "Rate not yet confirmed"), dash?.unconfirmedRates],
              ["payable", s.t("k_payable", "Net payable (open, PKR)"), PKR(dash?.netPayableOpen)],
              ["next", s.t("k_next", "Next deadline"), dash?.nextDeadline ?? "—"],
            ].map(([k, l, v]) => (
              <div key={k as string} data-testid={`pkst-kpi-${k}`} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[11px] font-semibold text-slate-500">{l}</p>
                <p className="mt-1 text-lg font-bold tabular-nums" dir="ltr">{v ?? "—"}</p>
              </div>
            ))}
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs" data-testid="pkst-list">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>{[s.t("return_no", "Return No."), s.t("entity", "Company / STRN"), s.t("period", "Period"), s.t("deadline", "Filing deadline"), s.t("status", "Status"), s.t("net_payable", "Net payable"), s.t("rate_confirmed", "Rate confirmed"), s.t("responsible", "Responsible")].map((h) => <Th key={h} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
                </thead>
                <tbody>
                  {!data ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-green-600" /></td></tr>
                  ) : (data.returns ?? []).length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">{s.t("empty", "No Sales Tax returns yet.")}</td></tr>
                  ) : (data.returns as Row[]).map((r) => {
                    const days = Number(r.days_to_deadline);
                    const open = !["filed", "paid", "cancelled"].includes(r.status);
                    return (
                      <tr key={r.id} data-testid="pkst-row" data-status={r.status} onClick={() => setOpenId(r.id)} className="cursor-pointer border-t border-slate-100 hover:bg-green-50/40 dark:border-slate-800 dark:hover:bg-green-950/20">
                        <td className="px-3 py-2 font-mono font-semibold">{r.return_no}</td>
                        <td className="px-3 py-2">{r.company_name ?? r.legal_name}<div className="font-mono text-[10px] text-slate-400" dir="ltr">{r.strn}</div></td>
                        <td className="px-3 py-2 font-mono" dir="ltr">{MONTHS[r.period_month]} {r.period_year}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono" dir="ltr">{d10(r.filing_deadline)}</span>
                          {open && <span className={`ms-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${days < 0 ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : days <= 15 ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{days < 0 ? s.t("overdue_by", "overdue") : `${days} ${s.t("days_left", "days left")}`}</span>}
                        </td>
                        <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status]}`}>{statusLabel(r.status)}</span></td>
                        <td className="px-3 py-2 font-semibold tabular-nums" dir="ltr">{PKR(r.net_payable)}</td>
                        <td className="px-3 py-2">{r.accountant_confirmed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}</td>
                        <td className="px-3 py-2">{r.responsible_name ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {showNew && <NewReturnModal s={s} onClose={() => setShowNew(false)} onCreated={(id, msg) => { setShowNew(false); setNotice(msg); setOpenId(id); void load(); }} />}
    </section>
  );
}

type Common = { s: ReturnType<typeof useErpScreen>; setError: (e: string | null) => void };

function ReturnDetail({ s, id, statusLabel, onClose, setError, setNotice }: Common & { id: string; statusLabel: (x: string) => string; onClose: () => void; setNotice: (n: string | null) => void }) {
  const [d, setD] = useState<Row | null>(null);
  const [w, setW] = useState<Row>({});
  const [pending, setPending] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<Row>(`/api/erp/pk-tax/sales-tax/${id}`);
      setD(r);
      const c = r.pkReturn;
      setW({
        outputTaxAmount: c.output_tax_amount ?? "", outputTaxSource: c.output_tax_source ?? "",
        inputTaxAmount: c.input_tax_amount ?? "", inputTaxSource: c.input_tax_source ?? "", strn: c.strn ?? "",
      });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [id, setError]);
  useEffect(() => { void load(); }, [load]);

  if (!d) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-green-600" />;
  const c = d.pkReturn;
  const m = d.meta ?? {};
  const editable = !!d.editable;
  const num = (v: any) => (v === "" || v == null ? null : Number(v));

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true); setError(null); setNotice(null);
    try { await fn(); await load(); setNotice(ok); }
    catch (e: any) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const save = () => run(() => apiPatch(`/api/erp/pk-tax/sales-tax/${id}`, {
    outputTaxAmount: num(w.outputTaxAmount), outputTaxSource: w.outputTaxSource || null,
    inputTaxAmount: num(w.inputTaxAmount), inputTaxSource: w.inputTaxSource || null, strn: w.strn || null,
  }), s.t("saved", "Working saved and net payable recomputed. Rate confirmation was reset — please re-confirm."));
  const confirmRate = () => run(() => apiPost(`/api/erp/pk-tax/sales-tax/${id}/confirm-rates`, {}), s.t("rate_confirmed_msg", "Rate confirmed by accountant."));
  const doAction = (a: string, extra: Row = {}) => run(() => apiPost(`/api/erp/pk-tax/sales-tax/${id}/action`, { action: a, ...extra }), s.t(`done_${a}`, "Done."));

  const field = (key: string, label: string, props: Row = {}) => (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      <input data-testid={`pkst-w-${key}`} disabled={!editable} className={INP} value={w[key] ?? ""} onChange={(e) => setW({ ...w, [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <div className="space-y-4" data-testid="pkst-detail" data-status={c.status}>
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="font-mono text-xs text-slate-500">{c.return_no}</p>
          <h2 className="text-base font-bold">{m.company_name ?? m.legal_name} <span className="font-mono text-xs text-slate-400" dir="ltr">STRN {m.strn}</span></h2>
          <p className="text-xs text-slate-500"><span dir="ltr">{MONTHS[c.period_month]} {c.period_year}</span> · <CalendarClock className="inline h-3.5 w-3.5" /> {s.t("deadline", "Filing deadline")}: <b dir="ltr" data-testid="pkst-deadline">{d10(c.filing_deadline)}</b> · {s.t("responsible", "Responsible")}: {m.responsible_name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span data-testid="pkst-status" className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[c.status]}`}>{statusLabel(c.status)}</span>
          <button type="button" aria-label={s.t("close", "Close")} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h3 className="text-sm font-bold">{s.t("working", "Output / input tax working")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("outputTaxAmount", s.t("output_tax", "Output tax (PKR)"), { type: "number", dir: "ltr" })}
            {field("outputTaxSource", s.t("output_source", "Source (e.g. Sales Tax Register)"), { placeholder: s.t("output_source_ph", "e.g. Sales register, period totals") })}
            {field("inputTaxAmount", s.t("input_tax", "Input tax (PKR)"), { type: "number", dir: "ltr" })}
            {field("inputTaxSource", s.t("input_source", "Source (e.g. Purchase Tax Register)"), { placeholder: s.t("input_source_ph", "e.g. Purchase register, period totals") })}
            {field("strn", s.t("strn", "Sales Tax Registration Number (STRN)"), { dir: "ltr" })}
          </div>
          {editable && <button type="button" data-testid="pkst-save" disabled={busy} onClick={() => void save()} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{s.t("save_compute", "Save & compute")}</button>}
        </section>

        <section className="space-y-2 rounded-2xl border border-green-200 bg-green-50/50 p-4 text-xs dark:border-green-900/50 dark:bg-green-950/20" data-testid="pkst-computation">
          <h3 className="text-sm font-bold">{s.t("computation", "Computation")}</h3>
          <div className="flex justify-between gap-2"><span>{s.t("output_tax", "Output tax")}</span><b className="tabular-nums" dir="ltr">{PKR(c.output_tax_amount)}</b></div>
          <div className="flex justify-between gap-2"><span>{s.t("input_tax", "Input tax")}</span><b className="tabular-nums" dir="ltr">{PKR(c.input_tax_amount)}</b></div>
          <div className="flex justify-between gap-2 border-t border-green-200 pt-2 text-sm dark:border-green-900/50"><span className="font-bold">{s.t("net_payable", "Net payable")}</span><b className="tabular-nums" dir="ltr" data-testid="pkst-net">{PKR(c.net_payable)}</b></div>
          {Number(c.net_payable) < 0 && <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">{s.t("credit_note", "Negative value: this is a carry-forward input tax credit, not an amount payable.")}</p>}
          {c.rate_source_note && <p className="text-[10px] text-slate-500">{s.t("source", "Source")}: {c.rate_source_note}</p>}
          <div className="rounded-lg border p-2" data-testid="pkst-confirm-box" style={{ borderColor: c.accountant_confirmed ? undefined : "rgb(245 158 11)" }}>
            {c.accountant_confirmed ? (
              <p className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{s.t("rate_confirmed_by", "Rate confirmed by")} {m.responsible_name ?? c.accountant_confirmed_by} {s.t("on_date", "on")} {d10(c.accountant_confirmed_at)}</p>
            ) : (
              <>
                <p className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle className="h-4 w-4" />{s.t("rate_not_confirmed", "This rate has NOT been confirmed by an accountant yet. The return cannot be marked ready for review until confirmed.")}</p>
                {editable && c.net_payable != null && (
                  <button type="button" data-testid="pkst-confirm-rate" disabled={busy} onClick={() => void confirmRate()} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
                    <ShieldCheck className="h-3.5 w-3.5" />{s.t("confirm_rate_btn", "I am a qualified accountant — confirm this rate")}
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        {(NEXT[c.status] ?? []).map((a) => (
          <button key={a} type="button" data-testid={`pkst-act-${a}`} disabled={busy} onClick={() => (a === "file" || a === "pay" ? (setPending(a), setRef(""), setAmount(a === "pay" && c.net_payable != null ? String(Math.max(0, c.net_payable)) : "")) : void doAction(a))}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold disabled:opacity-50 ${a === "cancel" || a === "back" ? "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200" : "bg-green-600 text-white"}`}>{s.t(`act_${a}`, a)}</button>
        ))}
        {pending && (
          <div className="flex w-full flex-wrap items-center gap-2">
            <input data-testid="pkst-act-ref" className={`${INP} w-60`} dir="ltr" placeholder={pending === "file" ? s.t("filing_ref_ph", "IRIS filing reference") : s.t("payment_ref_ph", "Payment reference")} value={ref} onChange={(e) => setRef(e.target.value)} />
            {pending === "pay" && <input data-testid="pkst-act-amount" type="number" dir="ltr" className={`${INP} w-40`} value={amount} onChange={(e) => setAmount(e.target.value)} />}
            <button type="button" data-testid="pkst-act-confirm" disabled={!ref.trim() || busy} onClick={() => { void doAction(pending, { reference: ref.trim(), amount: pending === "pay" ? Number(amount) : null }); setPending(null); }} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{s.t("confirm", "Confirm")}</button>
            <button type="button" aria-label={s.t("close", "Close")} onClick={() => setPending(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {c.filing_reference && <span className="text-xs"><CheckCircle2 className="me-1 inline h-3.5 w-3.5 text-teal-600" />{s.t("filed_ref", "Filed")}: <b className="font-mono" dir="ltr">{c.filing_reference}</b></span>}
        {c.payment_reference && <span className="text-xs"><CheckCircle2 className="me-1 inline h-3.5 w-3.5 text-emerald-600" />{s.t("paid_ref", "Paid")}: <b className="font-mono" dir="ltr">{c.payment_reference} · PKR {PKR(c.paid_amount)}</b></span>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.t("history", "Audit history")}</h4>
        <ul className="mt-2 space-y-1 text-xs" data-testid="pkst-events">
          {(d.events as Row[]).map((e) => (
            <li key={e.id} className="flex flex-wrap gap-2 border-s-2 border-green-600 ps-2">
              <span className="tabular-nums text-slate-500">{new Date(e.created_at).toLocaleString()}</span>
              <b>{s.t(`ev_${e.action}`, e.action)}</b>
              {e.from_status && e.from_status !== e.to_status && <span>{statusLabel(e.from_status)} → {statusLabel(e.to_status)}</span>}
              {e.actor_name && <span className="text-slate-500">· {e.actor_name}</span>}
              {e.detail?.reference && <span className="font-mono" dir="ltr">· {e.detail.reference}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NewReturnModal({ s, onClose, onCreated }: { s: ReturnType<typeof useErpScreen>; onClose: () => void; onCreated: (id: string, msg: string) => void }) {
  const [entities, setEntities] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const now = new Date();
  const [f, setF] = useState({ taxEntityId: "", periodYear: now.getFullYear(), periodMonth: now.getMonth() + 1, strn: "", responsibleUserId: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    apiGet<{ entities: Row[] }>("/api/erp/pk-tax/entities").then((r) => setEntities(r.entities ?? [])).catch(() => setEntities([]));
    apiGet<{ users: Row[] }>("/api/erp/user-tasks/assignees").then((r) => setUsers(r.users ?? [])).catch(() => setUsers([]));
  }, []);
  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await apiPost<Row>("/api/erp/pk-tax/sales-tax", { taxEntityId: f.taxEntityId, periodYear: Number(f.periodYear), periodMonth: Number(f.periodMonth), strn: f.strn || null, responsibleUserId: f.responsibleUserId || null });
      onCreated(r.id, `${r.returnNo} · ${s.t("deadline", "Filing deadline")} ${r.filingDeadline}${r.reminderTask ? ` · ${s.t("reminder", "Reminder")} ${r.reminderTask}` : ""}`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" dir={s.dir}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" data-testid="pkst-new-modal">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-bold">{s.t("new", "New Sales Tax return")}</h3><button type="button" aria-label={s.t("close", "Close")} onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><L label={s.t("entity", "Company / STRN")}>
            <select data-testid="pkst-f-entity" className={INP} value={f.taxEntityId} onChange={(e) => setF({ ...f, taxEntityId: e.target.value })}>
              <option value="">{s.t("select", "Select…")}</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.legal_name ?? e.legalName} · {e.trn}</option>)}
            </select>
          </L></div>
          <L label={s.t("period_year", "Period year")}><input data-testid="pkst-f-year" type="number" className={INP} dir="ltr" value={f.periodYear} onChange={(e) => setF({ ...f, periodYear: Number(e.target.value) })} /></L>
          <L label={s.t("period_month", "Period month")}>
            <select data-testid="pkst-f-month" className={INP} value={f.periodMonth} onChange={(e) => setF({ ...f, periodMonth: Number(e.target.value) })}>
              {MONTHS.slice(1).map((mm, i) => <option key={i + 1} value={i + 1}>{mm}</option>)}
            </select>
          </L>
          <L label={s.t("strn", "Sales Tax Registration Number (STRN)")}><input className={INP} dir="ltr" value={f.strn} onChange={(e) => setF({ ...f, strn: e.target.value })} /></L>
          <L label={s.t("responsible", "Responsible")}>
            <select data-testid="pkst-f-resp" className={INP} value={f.responsibleUserId} onChange={(e) => setF({ ...f, responsibleUserId: e.target.value })}>
              <option value="">{s.t("me", "Me")}</option>
              {users.map((u) => <option key={u.userId} value={u.userId}>{u.name ?? u.userId}</option>)}
            </select>
          </L>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">{s.t("deadline_rule", "Deadline shown is the 18th of the month following the period — verify against your specific filing category. A reminder task is created for the responsible person.")}</p>
        {err && <p data-testid="pkst-new-error" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" data-testid="pkst-f-save" disabled={saving || !f.taxEntityId} onClick={() => void submit()} className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("create", "Create return")}</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel_btn", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>{children}</div>;
}
