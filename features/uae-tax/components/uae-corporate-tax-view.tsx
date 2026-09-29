/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * UAE Corporate Tax — inside the existing UAE Tax & E-Invoicing module. Tax entity (company + TRN)
 * and financial year → taxable-income working → document checklist → review → recorded filing and
 * payment. The ERP does not file with the FTA and posts no accounting entry.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Landmark, Loader2, Plus, Trash2, X } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Row = Record<string, any>;
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800";
const AED = (v: any) => (v == null || v === "" ? "—" : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v)));
const d10 = (v: any) => (v ? String(v).slice(0, 10) : "—");
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

export function UaeCorporateTaxView({ lang }: { lang?: string }) {
  const s = useErpScreen("uaect", lang);
  const params = useSearchParams();
  const [data, setData] = useState<Row | null>(null);
  const [openId, setOpenId] = useState<string | null>(params?.get("return") ?? null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const statusLabel = useCallback((st: string) => s.t(`st_${st}`, st), [s]);

  const load = useCallback(async () => {
    try { setData(await apiGet<Row>("/api/erp/uae-tax/corporate-tax")); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const dash = data?.dashboard;
  return (
    <section dir={s.dir} className="space-y-4" data-testid="ct-view">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400"><Landmark className="h-5 w-5" /></span>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{s.t("title", "UAE Corporate Tax")}</h1>
            <p className="text-xs text-slate-500">{s.t("subtitle", "Taxable-income working, document checklist, review and filing record per company and financial year — 9% above AED 375,000.")}</p>
          </div>
        </div>
        <button type="button" data-testid="ct-new" onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />{s.t("new", "New CT return")}</button>
      </header>
      <p className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" data-testid="ct-fta-note">
        <b>{s.t("fta_title", "No automatic FTA filing.")}</b> {s.t("fta_body", "File and pay on EmaraTax, then record the reference here. Tax payments are posted through the existing Roznamcha / Journal, not from this screen.")}
      </p>
      {error && <p data-testid="ct-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {notice && <p data-testid="ct-notice" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}

      {openId ? (
        <ReturnDetail s={s} id={openId} statusLabel={statusLabel} onClose={() => { setOpenId(null); void load(); }} setError={setError} setNotice={setNotice} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6" data-testid="ct-kpis">
            {[
              ["open", s.t("k_open", "Open returns"), dash?.open],
              ["due60", s.t("k_due60", "Due within 60 days"), dash?.dueIn60],
              ["overdue", s.t("k_overdue", "Overdue"), dash?.overdue],
              ["missing", s.t("k_missing", "Missing documents"), dash?.missingDocs],
              ["payable", s.t("k_payable", "Tax payable (open, AED)"), AED(dash?.taxPayableOpen)],
              ["next", s.t("k_next", "Next deadline"), dash?.nextDeadline ?? "—"],
            ].map(([k, l, v]) => (
              <div key={k as string} data-testid={`ct-kpi-${k}`} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[11px] font-semibold text-slate-500">{l}</p>
                <p className="mt-1 text-lg font-bold tabular-nums" dir="ltr">{v ?? "—"}</p>
              </div>
            ))}
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-xs" data-testid="ct-list">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>{[s.t("return_no", "Return No."), s.t("entity", "Company / TRN"), s.t("fy", "Financial year"), s.t("deadline", "Filing deadline"), s.t("status", "Status"), s.t("taxable_income", "Taxable income"), s.t("tax_payable", "Tax payable"), s.t("missing_docs", "Missing docs"), s.t("responsible", "Responsible")].map((h) => <Th key={h} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
                </thead>
                <tbody>
                  {!data ? (
                    <tr><td colSpan={9} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-blue-600" /></td></tr>
                  ) : (data.returns ?? []).length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">{s.t("empty", "No Corporate Tax returns yet.")}</td></tr>
                  ) : (data.returns as Row[]).map((r) => {
                    const days = Number(r.days_to_deadline);
                    const open = !["filed", "paid", "cancelled"].includes(r.status);
                    return (
                      <tr key={r.id} data-testid="ct-row" data-status={r.status} onClick={() => setOpenId(r.id)} className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-blue-950/20">
                        <td className="px-3 py-2 font-mono font-semibold">{r.return_no}</td>
                        <td className="px-3 py-2">{r.company_name ?? r.legal_name}<div className="font-mono text-[10px] text-slate-400" dir="ltr">{r.trn}</div></td>
                        <td className="px-3 py-2 font-mono" dir="ltr">{d10(r.fy_start)} → {d10(r.fy_end)}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono" dir="ltr">{d10(r.filing_deadline)}</span>
                          {open && <span className={`ms-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${days < 0 ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : days <= 60 ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{days < 0 ? s.t("overdue_by", "overdue") : `${days} ${s.t("days_left", "days left")}`}</span>}
                        </td>
                        <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status]}`}>{statusLabel(r.status)}</span></td>
                        <td className="px-3 py-2 tabular-nums" dir="ltr">{AED(r.taxable_income)}</td>
                        <td className="px-3 py-2 font-semibold tabular-nums" dir="ltr">{AED(r.tax_payable)}</td>
                        <td className="px-3 py-2 tabular-nums">{r.missing_docs > 0 ? <span className="font-bold text-amber-700 dark:text-amber-300">{r.missing_docs}</span> : 0}</td>
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
  const [adj, setAdj] = useState<Row[]>([]);
  const [companyDocs, setCompanyDocs] = useState<Row[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<Row>(`/api/erp/uae-tax/corporate-tax/${id}`);
      setD(r);
      const c = r.ctReturn;
      setW({
        accountingProfit: c.accounting_profit ?? "", accountingProfitSource: c.accounting_profit_source ?? "", revenue: c.revenue ?? "",
        smallBusinessRelief: !!c.small_business_relief, qualifyingFreeZone: !!c.qualifying_free_zone, qualifyingIncome: c.qualifying_income ?? 0,
        taxLossesBroughtForward: c.tax_losses_brought_forward ?? 0, ctTrn: c.ct_trn ?? "",
      });
      setAdj((r.adjustments ?? []).map((a: Row) => ({ ...a })));
      if (c.company_id) {
        const res = await fetch(`/api/documents?companyId=${c.company_id}`, { credentials: "include" });
        if (res.ok) setCompanyDocs(((await res.json())?.documents ?? []) as Row[]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [id, setError]);
  useEffect(() => { void load(); }, [load]);

  const computed = useMemo(() => {
    if (!d) return null;
    const c = d.ctReturn;
    const sum = (k: string) => (d.adjustments as Row[]).filter((a) => a.category === k).reduce((x, a) => x + Number(a.amount), 0);
    return { addBacks: sum("add_back"), deductions: sum("deduction"), exempt: sum("exempt_income"), taxable: c.taxable_income, relief: c.loss_relief_used, tax: c.tax_payable };
  }, [d]);

  if (!d) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-600" />;
  const c = d.ctReturn;
  const m = d.meta ?? {};
  const editable = !!d.editable;
  const num = (v: any) => (v === "" || v == null ? null : Number(v));

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true); setError(null); setNotice(null);
    try { await fn(); await load(); setNotice(ok); }
    catch (e: any) {
      const missing = e?.details?.missing ?? e?.body?.error?.details?.missing;
      setError((e instanceof Error ? e.message : String(e)) + (Array.isArray(missing) ? ` (${missing.map((k: string) => s.t(`doc_${k}`, k)).join(", ")})` : ""));
    }
    finally { setBusy(false); }
  };
  const save = () => run(() => apiPatch(`/api/erp/uae-tax/corporate-tax/${id}`, {
    accountingProfit: num(w.accountingProfit), accountingProfitSource: w.accountingProfitSource || null, revenue: num(w.revenue),
    smallBusinessRelief: !!w.smallBusinessRelief, qualifyingFreeZone: !!w.qualifyingFreeZone, qualifyingIncome: Number(w.qualifyingIncome || 0),
    taxLossesBroughtForward: Number(w.taxLossesBroughtForward || 0), ctTrn: w.ctTrn || null,
    adjustments: adj.map((a) => ({ category: a.category, description: a.description, amount: Number(a.amount || 0), reference: a.reference || null })),
  }), s.t("saved", "Working saved and tax recomputed."));
  const doAction = (a: string, extra: Row = {}) => run(() => apiPost(`/api/erp/uae-tax/corporate-tax/${id}/action`, { action: a, ...extra }), s.t(`done_${a}`, "Done."));
  const setDoc = (docKey: string, status: string, documentId: string | null, notes: string | null) =>
    run(() => apiPatch(`/api/erp/uae-tax/corporate-tax/${id}/documents`, { docKey, status, documentId, notes }), s.t("doc_saved", "Checklist updated."));

  const printConfig = () => ({
    moduleType: "register" as const, reportType: "register" as const, lang: s.lang, orientation: "portrait" as const,
    title: `${s.t("title", "UAE Corporate Tax")} — ${c.return_no}`,
    subtitle: `${m.company_name ?? m.legal_name ?? ""} · TRN ${m.trn ?? ""} · ${d10(c.fy_start)} → ${d10(c.fy_end)} · ${s.t("deadline", "Filing deadline")} ${d10(c.filing_deadline)} · ${statusLabel(c.status)}`,
    columns: [{ key: "label", label: s.t("line", "Line") }, { key: "amount", label: "AED" }],
    rows: [
      { label: s.t("accounting_profit", "Accounting profit"), amount: AED(c.accounting_profit) },
      { label: s.t("add_backs", "Add-backs (non-deductible)"), amount: AED(computed?.addBacks) },
      { label: s.t("deductions", "Deductions"), amount: AED(computed?.deductions) },
      { label: s.t("exempt_income", "Exempt income"), amount: AED(computed?.exempt) },
      { label: s.t("loss_relief", "Tax loss relief used"), amount: AED(c.loss_relief_used) },
      { label: s.t("taxable_income", "Taxable income"), amount: AED(c.taxable_income) },
      { label: s.t("tax_payable", "Tax payable"), amount: AED(c.tax_payable) },
    ],
  });

  const field = (key: string, label: string, props: Row = {}) => (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      <input data-testid={`ct-w-${key}`} disabled={!editable} className={INP} value={w[key] ?? ""} onChange={(e) => setW({ ...w, [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <div className="space-y-4" data-testid="ct-detail" data-status={c.status}>
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="font-mono text-xs text-slate-500">{c.return_no}</p>
          <h2 className="text-base font-bold">{m.company_name ?? m.legal_name} <span className="font-mono text-xs text-slate-400" dir="ltr">TRN {m.trn}</span></h2>
          <p className="text-xs text-slate-500"><span dir="ltr">{d10(c.fy_start)} → {d10(c.fy_end)}</span> · <CalendarClock className="inline h-3.5 w-3.5" /> {s.t("deadline", "Filing deadline")}: <b dir="ltr" data-testid="ct-deadline">{d10(c.filing_deadline)}</b> · {s.t("responsible", "Responsible")}: {m.responsible_name ?? "—"}{m.reminder_task_no ? <> · {s.t("reminder", "Reminder")}: <span className="font-mono" data-testid="ct-reminder">{m.reminder_task_no}</span></> : null}</p>
        </div>
        <div className="flex items-center gap-2">
          <span data-testid="ct-status" className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[c.status]}`}>{statusLabel(c.status)}</span>
          <UniversalPrintActionButton reportConfig={printConfig as any} />
          <button type="button" aria-label={s.t("close", "Close")} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h3 className="text-sm font-bold">{s.t("working", "Taxable income working")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {field("accountingProfit", s.t("accounting_profit", "Accounting profit (AED)"), { type: "number", dir: "ltr" })}
            <div className="sm:col-span-2">{field("accountingProfitSource", s.t("profit_source", "Source of the profit figure"), { placeholder: s.t("profit_source_ph", "e.g. Audited financial statements FY2025") })}</div>
            {field("revenue", s.t("revenue", "Revenue for the year (AED)"), { type: "number", dir: "ltr" })}
            {field("taxLossesBroughtForward", s.t("losses_bf", "Tax losses brought forward (AED)"), { type: "number", dir: "ltr" })}
            {field("ctTrn", s.t("ct_trn", "Corporate Tax TRN (15 digits)"), { dir: "ltr", maxLength: 15 })}
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="inline-flex items-center gap-2"><input data-testid="ct-w-sbr" type="checkbox" disabled={!editable} checked={!!w.smallBusinessRelief} onChange={(e) => setW({ ...w, smallBusinessRelief: e.target.checked, qualifyingFreeZone: e.target.checked ? false : w.qualifyingFreeZone })} />{s.t("sbr", "Small Business Relief (revenue ≤ AED 3,000,000)")}</label>
            <label className="inline-flex items-center gap-2"><input data-testid="ct-w-qfz" type="checkbox" disabled={!editable} checked={!!w.qualifyingFreeZone} onChange={(e) => setW({ ...w, qualifyingFreeZone: e.target.checked, smallBusinessRelief: e.target.checked ? false : w.smallBusinessRelief })} />{s.t("qfz", "Qualifying Free Zone Person")}</label>
            {w.qualifyingFreeZone && <div className="w-48">{field("qualifyingIncome", s.t("qualifying_income", "Qualifying income (AED)"), { type: "number", dir: "ltr" })}</div>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>{[s.t("adj_category", "Adjustment"), s.t("description", "Description"), s.t("amount", "Amount (AED)"), s.t("reference", "Reference"), ""].map((h, i) => <Th key={i} className={`px-2 py-2 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
              </thead>
              <tbody>
                {adj.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">{s.t("no_adj", "No adjustments.")}</td></tr>}
                {adj.map((a, i) => (
                  <tr key={i} data-testid="ct-adj" className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1.5"><select data-testid="ct-adj-cat" disabled={!editable} className={`${INP} w-44`} value={a.category} onChange={(e) => setAdj((x) => x.map((y, j) => (j === i ? { ...y, category: e.target.value } : y)))}>{["add_back", "deduction", "exempt_income"].map((k) => <option key={k} value={k}>{s.t(`cat_${k}`, k)}</option>)}</select></td>
                    <td className="px-2 py-1.5"><input data-testid="ct-adj-desc" disabled={!editable} className={INP} value={a.description ?? ""} onChange={(e) => setAdj((x) => x.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} /></td>
                    <td className="px-2 py-1.5"><input data-testid="ct-adj-amt" disabled={!editable} type="number" min={0} dir="ltr" className={`${INP} w-32`} value={a.amount ?? ""} onChange={(e) => setAdj((x) => x.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} /></td>
                    <td className="px-2 py-1.5"><input disabled={!editable} className={`${INP} w-32`} value={a.reference ?? ""} onChange={(e) => setAdj((x) => x.map((y, j) => (j === i ? { ...y, reference: e.target.value } : y)))} /></td>
                    <td className="px-2 py-1.5">{editable && <button type="button" aria-label={s.t("remove", "Remove")} onClick={() => setAdj((x) => x.filter((_, j) => j !== i))} className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <button type="button" data-testid="ct-adj-add" onClick={() => setAdj((x) => [...x, { category: "add_back", description: "", amount: "" }])} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold dark:border-slate-700"><Plus className="h-3.5 w-3.5" />{s.t("add_adj", "Add adjustment")}</button>
              <button type="button" data-testid="ct-save" disabled={busy} onClick={() => void save()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{s.t("save_compute", "Save & compute")}</button>
            </div>
          )}
        </section>

        <section className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-xs dark:border-blue-900/50 dark:bg-blue-950/20" data-testid="ct-computation">
          <h3 className="text-sm font-bold">{s.t("computation", "Computation")}</h3>
          {[
            ["accounting_profit", s.t("accounting_profit", "Accounting profit (AED)"), c.accounting_profit],
            ["add_backs", s.t("add_backs", "Add-backs (non-deductible)"), computed?.addBacks],
            ["deductions", s.t("deductions", "Deductions"), computed?.deductions],
            ["exempt", s.t("exempt_income", "Exempt income"), computed?.exempt],
            ["relief", s.t("loss_relief", "Tax loss relief used"), c.loss_relief_used],
            ["taxable", s.t("taxable_income", "Taxable income"), c.taxable_income],
          ].map(([k, l, v]) => <div key={k as string} className="flex justify-between gap-2"><span>{l}</span><b className="tabular-nums" dir="ltr">{AED(v)}</b></div>)}
          <div className="flex justify-between gap-2 border-t border-blue-200 pt-2 text-sm dark:border-blue-900/50"><span className="font-bold">{s.t("tax_payable", "Tax payable")}</span><b className="tabular-nums" dir="ltr" data-testid="ct-tax">{AED(c.tax_payable)}</b></div>
          <p className="text-[11px] text-slate-500">{c.small_business_relief ? s.t("rule_sbr", "Small Business Relief: taxable income treated as nil.") : c.qualifying_free_zone ? s.t("rule_qfz", "Qualifying Free Zone Person: 0% on qualifying income, 9% on the rest.") : s.t("rule_std", "0% up to AED 375,000, 9% above. Loss relief is capped at 75% of taxable income.")}</p>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" data-testid="ct-docs">
        <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-blue-600" />{s.t("checklist", "Document checklist")}</h3>
          {c.company_id && <a href={`/dashboard/documents?companyId=${c.company_id}`} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">{s.t("open_dm", "Open Document Manager")}</a>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60"><tr>{[s.t("document", "Document"), s.t("doc_status", "Status"), s.t("dm_file", "Document Manager file"), s.t("notes", "Notes")].map((h) => <Th key={h} className={`px-3 py-2 font-bold ${s.textStart}`}>{h}</Th>)}</tr></thead>
            <tbody>
              {(d.documents as Row[]).map((doc) => (
                <DocRow key={doc.doc_key} s={s} doc={doc} companyDocs={companyDocs} locked={["filed", "paid", "cancelled"].includes(c.status)} onSave={setDoc} />
              ))}
            </tbody>
          </table>
        </div>
        {d.missingDocuments.length > 0 && <p className="border-t border-slate-100 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-slate-800 dark:text-amber-300" data-testid="ct-missing"><AlertTriangle className="me-1 inline h-3.5 w-3.5" />{s.t("missing_list", "Missing")}: {d.missingDocuments.map((k: string) => s.t(`doc_${k}`, k)).join(", ")}</p>}
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        {(NEXT[c.status] ?? []).map((a) => (
          <button key={a} type="button" data-testid={`ct-act-${a}`} disabled={busy} onClick={() => (a === "file" || a === "pay" ? (setPending(a), setRef(""), setAmount(a === "pay" && c.tax_payable != null ? String(c.tax_payable) : "")) : void doAction(a))}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold disabled:opacity-50 ${a === "cancel" || a === "back" ? "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200" : "bg-blue-600 text-white"}`}>{s.t(`act_${a}`, a)}</button>
        ))}
        {pending && (
          <div className="flex w-full flex-wrap items-center gap-2">
            <input data-testid="ct-act-ref" className={`${INP} w-60`} dir="ltr" placeholder={pending === "file" ? s.t("filing_ref_ph", "EmaraTax filing reference") : s.t("payment_ref_ph", "Payment reference")} value={ref} onChange={(e) => setRef(e.target.value)} />
            {pending === "pay" && <input data-testid="ct-act-amount" type="number" dir="ltr" className={`${INP} w-40`} value={amount} onChange={(e) => setAmount(e.target.value)} />}
            <button type="button" data-testid="ct-act-confirm" disabled={!ref.trim() || busy} onClick={() => { void doAction(pending, { reference: ref.trim(), amount: pending === "pay" ? Number(amount) : null }); setPending(null); }} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{s.t("confirm", "Confirm")}</button>
            <button type="button" aria-label={s.t("close", "Close")} onClick={() => setPending(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {c.filing_reference && <span className="text-xs"><CheckCircle2 className="me-1 inline h-3.5 w-3.5 text-teal-600" />{s.t("filed_ref", "Filed")}: <b className="font-mono" dir="ltr">{c.filing_reference}</b></span>}
        {c.payment_reference && <span className="text-xs"><CheckCircle2 className="me-1 inline h-3.5 w-3.5 text-emerald-600" />{s.t("paid_ref", "Paid")}: <b className="font-mono" dir="ltr">{c.payment_reference} · AED {AED(c.paid_amount)}</b></span>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.t("history", "Audit history")}</h4>
        <ul className="mt-2 space-y-1 text-xs" data-testid="ct-events">
          {(d.events as Row[]).map((e) => (
            <li key={e.id} className="flex flex-wrap gap-2 border-s-2 border-blue-600 ps-2">
              <span className="tabular-nums text-slate-500">{new Date(e.created_at).toLocaleString()}</span>
              <b>{s.t(`ev_${e.action}`, e.action)}</b>
              {e.from_status && e.from_status !== e.to_status && <span>{statusLabel(e.from_status)} → {statusLabel(e.to_status)}</span>}
              {e.actor_name && <span className="text-slate-500">· {e.actor_name}</span>}
              {e.detail?.reference && <span className="font-mono" dir="ltr">· {e.detail.reference}</span>}
              {e.detail?.reminderTask && <span className="font-mono">· {e.detail.reminderTask}</span>}
              {e.detail?.docKey && <span>· {s.t(`doc_${e.detail.docKey}`, e.detail.docKey)}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DocRow({ s, doc, companyDocs, locked, onSave }: { s: ReturnType<typeof useErpScreen>; doc: Row; companyDocs: Row[]; locked: boolean; onSave: (k: string, st: string, id: string | null, notes: string | null) => Promise<void> }) {
  const [st, setSt] = useState(doc.status);
  const [docId, setDocId] = useState(doc.document_id ?? "");
  const [notes, setNotes] = useState(doc.notes ?? "");
  const dirty = st !== doc.status || (docId || null) !== (doc.document_id ?? null) || (notes || null) !== (doc.notes ?? null);
  const tone = st === "received" ? "text-emerald-700 dark:text-emerald-300" : st === "missing" ? "text-amber-700 dark:text-amber-300" : "text-slate-500";
  return (
    <tr data-testid="ct-doc" data-key={doc.doc_key} data-status={doc.status} className="border-t border-slate-100 dark:border-slate-800">
      <td className="px-3 py-1.5 font-semibold">{s.t(`doc_${doc.doc_key}`, doc.doc_key)}</td>
      <td className="px-3 py-1.5">
        <select data-testid="ct-doc-status" disabled={locked} className={`${INP} w-36 ${tone}`} value={st} onChange={(e) => setSt(e.target.value)}>
          {["missing", "received", "not_applicable"].map((k) => <option key={k} value={k}>{s.t(`ds_${k}`, k)}</option>)}
        </select>
      </td>
      <td className="px-3 py-1.5">
        <select data-testid="ct-doc-file" disabled={locked} className={`${INP} w-56`} value={docId} onChange={(e) => setDocId(e.target.value)}>
          <option value="">—</option>
          {companyDocs.map((f) => <option key={f.id} value={f.id}>{f.title ?? f.file_name ?? f.id}</option>)}
        </select>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex gap-1">
          <input data-testid="ct-doc-notes" disabled={locked} className={INP} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {dirty && !locked && <button type="button" data-testid="ct-doc-save" onClick={() => void onSave(doc.doc_key, st, docId || null, notes || null)} className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">{s.t("save", "Save")}</button>}
        </div>
      </td>
    </tr>
  );
}

function NewReturnModal({ s, onClose, onCreated }: { s: ReturnType<typeof useErpScreen>; onClose: () => void; onCreated: (id: string, msg: string) => void }) {
  const [entities, setEntities] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const y = new Date().getFullYear() - 1;
  const [f, setF] = useState({ taxEntityId: "", fyStart: `${y}-01-01`, fyEnd: `${y}-12-31`, ctTrn: "", responsibleUserId: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    apiGet<{ entities: Row[] }>("/api/erp/uae-tax/entities").then((r) => setEntities(r.entities ?? [])).catch(() => setEntities([]));
    apiGet<{ users: Row[] }>("/api/erp/user-tasks/assignees").then((r) => setUsers(r.users ?? [])).catch(() => setUsers([]));
  }, []);
  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await apiPost<Row>("/api/erp/uae-tax/corporate-tax", { taxEntityId: f.taxEntityId, fyStart: f.fyStart, fyEnd: f.fyEnd, ctTrn: f.ctTrn || null, responsibleUserId: f.responsibleUserId || null });
      onCreated(r.id, `${r.returnNo} · ${s.t("deadline", "Filing deadline")} ${r.filingDeadline}${r.reminderTask ? ` · ${s.t("reminder", "Reminder")} ${r.reminderTask}` : ""}`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };
  const L = ({ label, children }: { label: string; children: React.ReactNode }) => <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>{children}</div>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" dir={s.dir}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" data-testid="ct-new-modal">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-bold">{s.t("new", "New CT return")}</h3><button type="button" aria-label={s.t("close", "Close")} onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><L label={s.t("entity", "Company / TRN")}>
            <select data-testid="ct-f-entity" className={INP} value={f.taxEntityId} onChange={(e) => setF({ ...f, taxEntityId: e.target.value })}>
              <option value="">{s.t("select", "Select…")}</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.legal_name ?? e.legalName} · {e.trn}</option>)}
            </select>
          </L></div>
          <L label={s.t("fy_start", "Financial year start")}><input data-testid="ct-f-start" type="date" className={INP} value={f.fyStart} onChange={(e) => setF({ ...f, fyStart: e.target.value })} /></L>
          <L label={s.t("fy_end", "Financial year end")}><input data-testid="ct-f-end" type="date" className={INP} value={f.fyEnd} onChange={(e) => setF({ ...f, fyEnd: e.target.value })} /></L>
          <L label={s.t("ct_trn", "Corporate Tax TRN (15 digits)")}><input className={INP} dir="ltr" maxLength={15} value={f.ctTrn} onChange={(e) => setF({ ...f, ctTrn: e.target.value.replace(/\D/g, "") })} /></L>
          <L label={s.t("responsible", "Responsible")}>
            <select data-testid="ct-f-resp" className={INP} value={f.responsibleUserId} onChange={(e) => setF({ ...f, responsibleUserId: e.target.value })}>
              <option value="">{s.t("me", "Me")}</option>
              {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name ?? u.user_id}</option>)}
            </select>
          </L>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">{s.t("deadline_rule", "The filing and payment deadline is 9 months after the financial year end. A reminder task is created for the responsible person.")}</p>
        {err && <p data-testid="ct-new-error" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" data-testid="ct-f-save" disabled={saving || !f.taxEntityId} onClick={() => void submit()} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("create", "Create return")}</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel_btn", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}
