"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileWarning, Loader2, Send } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet, apiPost } from "@/lib/api/client";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";
import { FilterBar, fmtAed, useEntitiesAndPeriods } from "@/features/uae-tax/components/uae-tax-shared";

type Preview = {
  box1_amount: number; box1_vat: number;
  box3_amount: number; box3_vat: number;
  box4_amount: number; box5_amount: number;
  box6_amount: number; box6_vat: number;
  box8_total_output_vat: number;
  box9_amount: number; box9_vat: number;
  box10_imports_vat: number;
  box11_total_input_vat: number;
  box12_net_vat: number;
  lines_total: number; lines_missing_document: number; lines_needs_review: number;
};

export function UaeVatReturnView({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("tax_einv", langProp);
  const f = useEntitiesAndPeriods();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ftaRef, setFtaRef] = useState("");

  const loadPreview = useCallback(async () => {
    if (!f.periodId) {
      setPreview(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const p = await apiGet<{ preview: Preview }>(`/api/erp/uae-tax/vat-return/preview?periodId=${f.periodId}`);
      setPreview(p.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [f.periodId]);

  const loadReturns = useCallback(async () => {
    try {
      const r = await apiGet<{ returns: any[] }>(`/api/erp/uae-tax/vat-return${f.entityId ? `?taxEntityId=${f.entityId}` : ""}`);
      setReturns(r.returns ?? []);
    } catch {
      /* ignore */
    }
  }, [f.entityId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);
  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  const generate = async () => {
    if (!f.periodId) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/erp/uae-tax/vat-return", { periodId: f.periodId });
      await loadReturns();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const fileReturn = async (id: string) => {
    if (!ftaRef.trim()) return;
    setBusy(true);
    try {
      await apiPost(`/api/erp/uae-tax/vat-return/${id}/file`, { ftaReference: ftaRef.trim() });
      setFtaRef("");
      await loadReturns();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const boxes: Array<{ code: string; label: string; amount?: number; vat: number }> = preview
    ? [
        { code: "1", label: s.t("vr_box1", "Standard-rated supplies"), amount: preview.box1_amount, vat: preview.box1_vat },
        { code: "3", label: s.t("vr_box3", "Supplies subject to reverse charge"), amount: preview.box3_amount, vat: preview.box3_vat },
        { code: "4", label: s.t("vr_box4", "Zero-rated supplies"), amount: preview.box4_amount, vat: 0 },
        { code: "5", label: s.t("vr_box5", "Exempt supplies"), amount: preview.box5_amount, vat: 0 },
        { code: "6", label: s.t("vr_box6", "Goods imported into the UAE"), amount: preview.box6_amount, vat: preview.box6_vat },
        { code: "8", label: s.t("vr_box8", "Totals — Output VAT"), vat: preview.box8_total_output_vat },
        { code: "9", label: s.t("vr_box9", "Standard-rated expenses"), amount: preview.box9_amount, vat: preview.box9_vat },
        { code: "10", label: s.t("vr_box10", "Imports — recoverable VAT"), vat: preview.box10_imports_vat },
        { code: "11", label: s.t("vr_box11", "Totals — Input VAT"), vat: preview.box11_total_input_vat },
        { code: "12", label: s.t("vr_box12", "Net VAT payable / (reclaimable)"), vat: preview.box12_net_vat },
      ]
    : [];

  const printConfig = () => ({
    moduleType: "register" as const,
    title: s.t("nav_vat_return", "VAT Return Preparation"),
    subtitle: `${s.t("uae", "United Arab Emirates")} — ${f.periods.find((p) => p.id === f.periodId)?.period_code ?? ""}`,
    lang: s.lang,
    orientation: "portrait" as const,
    columns: [
      { key: "code", label: s.t("vr_col_box", "Box") },
      { key: "label", label: s.t("vr_col_desc", "Description") },
      { key: "amount", label: s.t("vr_col_amount", "Amount (AED)"), align: "right" as const, format: "currency" as const },
      { key: "vat", label: s.t("vr_col_vat", "VAT (AED)"), align: "right" as const, format: "currency" as const },
    ],
    rows: boxes,
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("nav_vat_return", "VAT Return Preparation")}</h1>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.t("uae", "United Arab Emirates")} · FTA VAT 201</p>
          </div>
          <div className="flex items-center gap-2">
            {preview ? <UniversalPrintActionButton reportConfig={printConfig} /> : null}
            <button
              type="button"
              onClick={() => void generate()}
              disabled={busy || !f.periodId}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {s.t("vr_generate", "Generate / Refresh Return")}
            </button>
          </div>
        </header>

        <FilterBar
          {...f}
          entityLabel={s.t("cc_entity", "Tax Entity")}
          periodLabel={s.t("cc_period", "Tax Period")}
          allEntities={s.t("cc_all_entities", "All Entities")}
          allPeriods={s.t("cc_all_periods", "All Periods")}
        />

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        {!f.periodId ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            {s.t("vr_pick_period", "Select a tax period to preview its VAT 201 return.")}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : preview ? (
          <>
            {preview.lines_missing_document > 0 || preview.lines_needs_review > 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <FileWarning className="h-4 w-4" />
                {preview.lines_missing_document} {s.t("vr_missing_docs", "line(s) without evidence")} ·{" "}
                {preview.lines_needs_review} {s.t("vr_needs_review", "line(s) need review")}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {s.t("vr_ready", "All lines have evidence and are reviewed.")}
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("vr_col_box", "Box")}</th>
                    <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("vr_col_desc", "Description")}</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("vr_col_amount", "Amount (AED)")}</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("vr_col_vat", "VAT (AED)")}</th>
                  </tr>
                </thead>
                <tbody>
                  {boxes.map((b) => (
                    <tr key={b.code} className={`border-t border-slate-100 dark:border-slate-800 ${["8", "11", "12"].includes(b.code) ? "bg-slate-50 font-bold dark:bg-slate-800/40" : ""}`}>
                      <td className="px-4 py-2 font-mono text-slate-500">{b.code}</td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{b.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{b.amount === undefined ? "—" : fmtAed(b.amount)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{fmtAed(b.vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {/* Existing returns */}
        {returns.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">{s.t("vr_generated", "Generated Returns")}</h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("cc_period", "Tax Period")}</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("vr_box12", "Net VAT payable")}</th>
                    <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("set_col_status", "Status")}</th>
                    <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("vr_fta_ref", "FTA Reference")}</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.period_code}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-bold">{fmtAed(r.box12_net_vat_payable)}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status === "filed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800"}`}>
                          {s.t(`vr_status_${r.status}`, r.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-500">{r.fta_reference || "—"}</td>
                      <td className="px-4 py-2 text-right">
                        {r.status !== "filed" ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              value={ftaRef}
                              onChange={(e) => setFtaRef(e.target.value)}
                              placeholder={s.t("vr_fta_ref", "FTA Reference")}
                              className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() => void fileReturn(r.id)}
                              disabled={busy || !ftaRef.trim()}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Send className="h-3 w-3" />
                              {s.t("vr_mark_filed", "Mark Filed")}
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
