"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Send, ShieldCheck, XCircle, Zap } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet, apiPost } from "@/lib/api/client";
import { FilterBar, fmtAed, useEntitiesAndPeriods } from "@/features/uae-tax/components/uae-tax-shared";

type Mode = "invoices" | "credit_notes" | "asp_status";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800",
  validated: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  ready: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  submitted: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  processing: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  error: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  retry_required: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

export function UaeEInvoiceView({ lang: langProp, mode }: { lang?: SupportedLanguage; mode: Mode }) {
  const s = useErpScreen("tax_einv", langProp);
  const f = useEntitiesAndPeriods();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const titleKey = mode === "credit_notes" ? "nav_credit_notes" : mode === "asp_status" ? "nav_asp_fta_status" : "nav_e_invoices";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (f.entityId) qs.set("taxEntityId", f.entityId);
      if (mode === "credit_notes") qs.set("documentType", "tax_credit_note");
      const r = await apiGet<{ rows: any[] }>(`/api/erp/uae-tax/e-invoices?${qs.toString()}`);
      let items = r.rows ?? [];
      if (mode === "asp_status") items = items.filter((i) => i.status !== "draft");
      if (mode === "invoices") items = items.filter((i) => i.document_type !== "tax_credit_note");
      setRows(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [f.entityId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "validate" | "submit" | "status") => {
    setBusyId(id);
    setError(null);
    try {
      await apiPost(`/api/erp/uae-tax/e-invoices/${id}/${action}`, {});
      await load();
      if (selected?.id === id) await openDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const buildDrafts = async () => {
    setBusyId("build");
    try {
      await apiPost("/api/erp/uae-tax/e-invoices", { taxEntityId: f.entityId || undefined });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const d = await apiGet<{ invoice: any; events: any[] }>(`/api/erp/uae-tax/e-invoices/${id}`);
      setSelected(d.invoice);
      setEvents(d.events ?? []);
    } catch {
      /* ignore */
    }
  };

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t(titleKey, "e-Invoices")}</h1>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.t("uae", "United Arab Emirates")} · PINT-AE</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />
              {s.t("cc_refresh", "Refresh")}
            </button>
            {mode === "invoices" ? (
              <button type="button" onClick={() => void buildDrafts()} disabled={busyId === "build"} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                {busyId === "build" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {s.t("ei_build_drafts", "Build Drafts from Sales")}
              </button>
            ) : null}
          </div>
        </header>

        <FilterBar {...f} entityLabel={s.t("cc_entity", "Tax Entity")} periodLabel={s.t("cc_period", "Tax Period")} allEntities={s.t("cc_all_entities", "All Entities")} allPeriods={s.t("cc_all_periods", "All Periods")} />

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("ei_col_number", "Invoice No")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("ei_col_type", "Type")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("ei_col_buyer", "Buyer")}</th>
                <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("ei_col_total", "Total (AED)")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("set_col_status", "Status")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("ei_col_asp", "ASP Ref")}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-400">{s.t("ei_empty", "No e-invoices. Use \"Build Drafts from Sales\".")}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" onClick={() => void openDetail(r.id)}>
                    <td className="px-4 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.invoice_number || r.source_reference_no || "—"}</td>
                    <td className="px-4 py-2 text-slate-500">{s.t(`ei_type_${r.document_type}`, r.document_type)}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.buyer_name || "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtAed(r.total_incl_vat)}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status] ?? "bg-slate-100"}`}>{s.t(`ei_status_${r.status}`, r.status)}</span></td>
                    <td className="px-4 py-2 font-mono text-slate-400">{r.asp_reference || "—"}</td>
                    <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {["draft", "error"].includes(r.status) ? (
                          <IconBtn busy={busyId === r.id} onClick={() => act(r.id, "validate")} icon={ShieldCheck} label={s.t("ei_validate", "Validate")} />
                        ) : null}
                        {["validated", "ready", "retry_required", "error"].includes(r.status) ? (
                          <IconBtn busy={busyId === r.id} onClick={() => act(r.id, "submit")} icon={Send} label={s.t("ei_submit", "Submit")} tone="bg-blue-600 text-white" />
                        ) : null}
                        {["submitted", "processing", "delivered"].includes(r.status) ? (
                          <IconBtn busy={busyId === r.id} onClick={() => act(r.id, "status")} icon={RefreshCw} label={s.t("ei_refresh_status", "Refresh Status")} />
                        ) : null}
                        {r.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
                        {r.status === "rejected" ? <XCircle className="h-4 w-4 text-rose-500" /> : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selected ? (
          <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/40" dir={s.dir} onClick={() => setSelected(null)}>
            <div className="flex w-full max-w-md flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="font-mono font-bold text-slate-800 dark:text-slate-100">{selected.invoice_number || selected.source_reference_no}</p>
                <p className="text-[11px] text-slate-400">{s.t(`ei_type_${selected.document_type}`, selected.document_type)} · {fmtAed(selected.total_incl_vat)} AED</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
                {Array.isArray(selected.validation_errors) && selected.validation_errors.length ? (
                  <div className="rounded-lg bg-rose-50 p-2 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    <p className="font-bold">{s.t("ei_validation_errors", "Validation errors")}</p>
                    <ul className="mt-1 list-disc ps-4">
                      {selected.validation_errors.map((e: any, i: number) => <li key={i}>{e.code}: {e.message}</li>)}
                    </ul>
                  </div>
                ) : null}
                {selected.last_error ? <p className="rounded-lg bg-amber-50 p-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{selected.last_error}</p> : null}
                <div>
                  <p className="mb-1 text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("ei_timeline", "Status timeline")}</p>
                  <ol className="space-y-1.5 border-s border-slate-200 ps-3 dark:border-slate-700">
                    {events.map((ev) => (
                      <li key={ev.id} className="relative text-slate-600 dark:text-slate-300">
                        <span className="absolute -start-[17px] top-1 h-2 w-2 rounded-full bg-blue-500" />
                        <span className="font-semibold">{ev.new_status || ev.event}</span>
                        <span className="ms-1 text-slate-400">{new Date(ev.created_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                {selected.pint_ae_payload ? (
                  <details>
                    <summary className="cursor-pointer text-[11px] font-bold text-slate-500">{s.t("ei_view_payload", "PINT-AE payload")}</summary>
                    <pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-950 p-2 text-[10px] text-slate-200">{JSON.stringify(selected.pint_ae_payload, null, 2)}</pre>
                  </details>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function IconBtn({ busy, onClick, icon: Icon, label, tone }: { busy: boolean; onClick: () => void; icon: typeof Send; label: string; tone?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={label}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold disabled:opacity-50 ${tone ?? "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"}`}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      {label}
    </button>
  );
}
