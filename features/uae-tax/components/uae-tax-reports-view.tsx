"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Scale } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet } from "@/lib/api/client";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";
import { FilterBar, fmtAed, useEntitiesAndPeriods } from "@/features/uae-tax/components/uae-tax-shared";

export function UaeTaxReportsView({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("tax_einv", langProp);
  const f = useEntitiesAndPeriods();
  const [rows, setRows] = useState<any[]>([]);
  const [recon, setRecon] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (f.entityId) qs.set("taxEntityId", f.entityId);
      if (f.periodId) qs.set("periodId", f.periodId);
      const [r, rc] = await Promise.all([
        apiGet<{ rows: any[] }>(`/api/erp/uae-tax/reports?${qs.toString()}`),
        apiGet<{ rows: any[] }>(`/api/erp/uae-tax/reconciliation`),
      ]);
      setRows(r.rows ?? []);
      setRecon(rc.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [f.entityId, f.periodId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grand = useMemo(
    () =>
      rows.reduce(
        (a, r) => {
          a.taxable += Number(r.taxable_aed) || 0;
          a.vat += Number(r.vat_aed) || 0;
          a.recoverable += Number(r.recoverable_aed) || 0;
          a.missing += Number(r.missing_documents) || 0;
          return a;
        },
        { taxable: 0, vat: 0, recoverable: 0, missing: 0 },
      ),
    [rows],
  );

  const printConfig = () => ({
    moduleType: "register" as const,
    title: s.t("nav_tax_reports", "Tax Reports"),
    subtitle: s.t("uae", "United Arab Emirates"),
    lang: s.lang,
    orientation: "landscape" as const,
    columns: [
      { key: "period_code", label: s.t("cc_period", "Tax Period") },
      { key: "direction", label: s.t("rep_direction", "Direction") },
      { key: "transaction_category", label: s.t("ln_tax_category", "Category") },
      { key: "tax_category", label: s.t("rep_tax_cat", "Tax Category") },
      { key: "line_count", label: s.t("rep_lines", "Lines"), align: "right" as const },
      { key: "taxable_aed", label: s.t("ln_taxable_aed", "Taxable (AED)"), align: "right" as const, format: "currency" as const },
      { key: "vat_aed", label: s.t("ln_vat_aed", "VAT (AED)"), align: "right" as const, format: "currency" as const },
      { key: "recoverable_aed", label: s.t("ln_recoverable_aed", "Recoverable (AED)"), align: "right" as const, format: "currency" as const },
    ],
    rows,
    totals: { taxable_aed: fmtAed(grand.taxable), vat_aed: fmtAed(grand.vat), recoverable_aed: fmtAed(grand.recoverable) },
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("nav_tax_reports", "Tax Reports")}</h1>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.t("uae", "United Arab Emirates")}</p>
          </div>
          <div className="flex items-center gap-2">
            <UniversalPrintActionButton reportConfig={printConfig} />
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />{s.t("cc_refresh", "Refresh")}
            </button>
          </div>
        </header>

        <FilterBar {...f} entityLabel={s.t("cc_entity", "Tax Entity")} periodLabel={s.t("cc_period", "Tax Period")} allEntities={s.t("cc_all_entities", "All Entities")} allPeriods={s.t("cc_all_periods", "All Periods")} />

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card label={s.t("ln_taxable_aed", "Taxable (AED)")} value={fmtAed(grand.taxable)} />
          <Card label={s.t("ln_vat_aed", "VAT (AED)")} value={fmtAed(grand.vat)} />
          <Card label={s.t("ln_recoverable_aed", "Recoverable (AED)")} value={fmtAed(grand.recoverable)} tone="text-emerald-600" />
          <Card label={s.t("cc_k_missing_documents", "Missing Documents")} value={String(grand.missing)} tone="text-rose-600" />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("cc_period", "Tax Period")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("rep_direction", "Direction")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("ln_tax_category", "Category")}</th>
                <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("rep_lines", "Lines")}</th>
                <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("ln_taxable_aed", "Taxable (AED)")}</th>
                <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("ln_vat_aed", "VAT (AED)")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">{s.t("ln_empty", "No data yet.")}</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-300">{r.period_code || "—"}</td>
                    <td className="px-4 py-2 text-slate-500">{s.t(`dir_${r.direction}`, r.direction)}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{s.t(`cat_${r.transaction_category}`, r.transaction_category)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.line_count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtAed(r.taxable_aed)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtAed(r.vat_aed)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {recon.length > 0 ? (
          <div className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400">
              <Scale className="h-3.5 w-3.5" />{s.t("rep_reconciliation", "Ledger Reconciliation")}
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("cc_entity", "Tax Entity")}</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("rep_lines_output_vat", "Lines Output VAT")}</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("rep_ledger_output", "Ledger Output")}</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("rep_variance", "Variance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200">{r.tax_entity_name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtAed(r.lines_output_vat_aed)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtAed(r.ledger_output_payable_aed)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums font-bold ${Math.abs(Number(r.output_variance_aed)) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>
                        {fmtAed(r.output_variance_aed)}
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

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-black tabular-nums ${tone ?? "text-slate-800 dark:text-slate-100"}`}>{value}</p>
    </div>
  );
}
