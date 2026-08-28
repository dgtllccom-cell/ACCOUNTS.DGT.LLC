"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FileWarning, FolderTree, Loader2, RefreshCw } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet } from "@/lib/api/client";
import { FilterBar, fmtAed, useEntitiesAndPeriods } from "@/features/uae-tax/components/uae-tax-shared";

type Row = {
  tax_entity_name: string;
  period_code: string | null;
  direction: string;
  transaction_category: string;
  expected_lines: number;
  documents_attached: number;
  documents_missing: number;
  needs_review: number;
  vat_aed: number;
  vat_aed_without_evidence: number;
};

export function UaeTaxDocumentationView({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("tax_einv", langProp);
  const f = useEntitiesAndPeriods();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (f.entityId) qs.set("taxEntityId", f.entityId);
      if (f.periodId) qs.set("periodId", f.periodId);
      const r = await apiGet<{ rows: Row[] }>(`/api/erp/uae-tax/completeness?${qs.toString()}`);
      setRows(r.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [f.entityId, f.periodId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = rows.reduce(
    (a, r) => {
      a.expected += Number(r.expected_lines) || 0;
      a.attached += Number(r.documents_attached) || 0;
      a.missing += Number(r.documents_missing) || 0;
      a.vatNoEvidence += Number(r.vat_aed_without_evidence) || 0;
      return a;
    },
    { expected: 0, attached: 0, missing: 0, vatNoEvidence: 0 },
  );

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("nav_tax_documentation", "Tax Documentation")}</h1>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {s.t("uae", "United Arab Emirates")} · {s.t("doc_folder_hint", "Documentation → Tax & e-Invoicing → UAE → Entity → Year → Period")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/documents?module=Tax%20%26%20e-Invoicing"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <FolderTree className="h-3.5 w-3.5" />
              {s.t("doc_open_tree", "Open Document Tree")}
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {s.t("cc_refresh", "Refresh")}
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card label={s.t("doc_expected", "Expected Documents")} value={String(totals.expected)} />
          <Card label={s.t("doc_attached", "Documents Attached")} value={String(totals.attached)} tone="text-emerald-600" />
          <Card label={s.t("doc_missing_c", "Documents Missing")} value={String(totals.missing)} tone="text-rose-600" />
          <Card label={s.t("doc_vat_no_evidence", "VAT without evidence (AED)")} value={fmtAed(totals.vatNoEvidence)} tone="text-amber-600" />
        </div>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("cc_period", "Tax Period")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("ln_tax_category", "Category")}</th>
                <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("doc_expected", "Expected")}</th>
                <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("doc_attached", "Attached")}</th>
                <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("doc_missing_c", "Missing")}</th>
                <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-400">{s.t("ln_vat_aed", "VAT (AED)")}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-400">{s.t("ln_empty", "No taxable lines yet.")}</td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-300">{r.period_code || "—"}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {s.t(`cat_${r.transaction_category}`, r.transaction_category)} · {s.t(`dir_${r.direction}`, r.direction)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.expected_lines}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-600">{r.documents_attached}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-bold text-rose-600">{r.documents_missing}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtAed(r.vat_aed)}</td>
                    <td className="px-4 py-2 text-right">
                      {Number(r.documents_missing) > 0 ? (
                        <Link
                          href={`/dashboard/tax-einvoicing/uae/${r.direction === "output" ? "sales-output-vat" : "purchase-input-vat"}?documentStatus=missing`}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                        >
                          <FileWarning className="h-3 w-3" />
                          {s.t("doc_fix_missing", "Attach")}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />
                      )}
                    </td>
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

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-black tabular-nums ${tone ?? "text-slate-800 dark:text-slate-100"}`}>{value}</p>
    </div>
  );
}
