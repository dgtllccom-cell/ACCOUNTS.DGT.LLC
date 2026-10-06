"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet, apiPost } from "@/lib/api/client";
import { FilterBar, fmtAed, useEntitiesAndPeriods } from "@/features/uae-tax/components/uae-tax-shared";

const STATUSES = [
  "recoverable", "pending", "claimed", "carry_forward",
  "refund_requested", "refund_received", "rejected", "adjusted",
] as const;

export function UaeVatRecoveryView({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("tax_einv", langProp);
  const f = useEntitiesAndPeriods();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ status: "recoverable" as string, amountAed: "", ftaReference: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiGet<{ rows: any[] }>(`/api/erp/uae-tax/recovery${f.entityId ? `?taxEntityId=${f.entityId}` : ""}`);
      setRows(r.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [f.entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (id?: string, status?: string) => {
    if (!id && !f.entityId) {
      setError(s.t("rc_pick_entity", "Select a tax entity first."));
      return;
    }
    setSaving(true);
    try {
      const src = id ? rows.find((x) => x.id === id) : null;
      await apiPost("/api/erp/uae-tax/recovery", {
        id,
        taxEntityId: src?.tax_entity_id ?? f.entityId,
        taxPeriodId: src?.tax_period_id ?? f.periodId ?? null,
        status: status ?? form.status,
        amountAed: id ? Number(src?.amount_aed) || 0 : Number(form.amountAed) || 0,
        ftaReference: id ? src?.fta_reference ?? null : form.ftaReference || null,
        notes: id ? src?.notes ?? null : form.notes || null,
      });
      setAdding(false);
      setForm({ status: "recoverable", amountAed: "", ftaReference: "", notes: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const totals = rows.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + (Number(r.amount_aed) || 0);
    return a;
  }, {} as Record<string, number>);

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("nav_vat_recovery", "VAT Recovery / Refund")}</h1>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.t("uae", "United Arab Emirates")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />{s.t("cc_refresh", "Refresh")}
            </button>
            <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" />{s.t("rc_add", "Add Recovery Item")}
            </button>
          </div>
        </header>

        <FilterBar {...f} entityLabel={s.t("cc_entity", "Tax Entity")} periodLabel={s.t("cc_period", "Tax Period")} allEntities={s.t("cc_all_entities", "All Entities")} allPeriods={s.t("cc_all_periods", "All Periods")} />

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["recoverable", "claimed", "refund_requested", "refund_received"] as const).map((k) => (
            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{s.t(`rc_status_${k}`, k)}</p>
              <p className="mt-1 text-base font-black tabular-nums text-slate-800 dark:text-slate-100">{fmtAed(totals[k] || 0)}</p>
            </div>
          ))}
        </div>

        {adding ? (
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {s.t("set_col_status", "Status")}
              <select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                {STATUSES.map((v) => <option key={v} value={v}>{s.t(`rc_status_${v}`, v)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {s.t("rc_amount", "Amount (AED)")}
              <input type="number" value={form.amountAed} onChange={(e) => setForm((v) => ({ ...v, amountAed: e.target.value }))} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {s.t("vr_fta_ref", "FTA Reference")}
              <input value={form.ftaReference} onChange={(e) => setForm((v) => ({ ...v, ftaReference: e.target.value }))} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <div className="flex items-end">
              <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{s.tGlobal("common.save", "Save")}
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("cc_period", "Tax Period")}</th>
                <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("rc_amount", "Amount (AED)")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("set_col_status", "Status")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("vr_fta_ref", "FTA Reference")}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">{s.t("rc_empty", "No recovery items yet.")}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-300">{r.period_code || "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-bold">{fmtAed(r.amount_aed)}</td>
                    <td className="px-4 py-2">
                      <select
                        value={r.status}
                        onChange={(e) => void save(r.id, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-800"
                      >
                        {STATUSES.map((v) => <option key={v} value={v}>{s.t(`rc_status_${v}`, v)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-500">{r.fta_reference || "—"}</td>
                    <td className="px-4 py-2 text-slate-400">{r.notes || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
