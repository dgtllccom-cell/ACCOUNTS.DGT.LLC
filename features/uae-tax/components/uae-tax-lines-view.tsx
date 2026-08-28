"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  ExternalLink,
  FileWarning,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";
import type {
  UaeRecoverability,
  UaeTaxLine,
  UaeTaxLineDirection,
  UaeTransactionCategory,
} from "@/features/uae-tax/types/uae-tax";

function fmt(v: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
}

const RECOVER_TONE: Record<UaeRecoverability, string> = {
  recoverable: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  partial: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  non_recoverable: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  pending_review: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function UaeTaxLinesView({
  lang: langProp,
  titleKey,
  direction,
  category,
  showSync = true,
}: {
  lang?: SupportedLanguage;
  titleKey: string;
  direction?: UaeTaxLineDirection;
  category?: UaeTransactionCategory;
  showSync?: boolean;
}) {
  const s = useErpScreen("tax_einv", langProp);

  const [rows, setRows] = useState<UaeTaxLine[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editing, setEditing] = useState<UaeTaxLine | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "200" });
      if (direction) qs.set("direction", direction);
      if (category) qs.set("transactionCategory", category);
      if (search) qs.set("search", search);
      if (fromDate) qs.set("fromDate", fromDate);
      if (toDate) qs.set("toDate", toDate);
      const res = await apiGet<{ items: UaeTaxLine[]; total: number }>(`/api/erp/uae-tax?${qs.toString()}`);
      setRows(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [direction, category, search, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      await apiPost("/api/erp/uae-tax/sync", { fromDate: fromDate || null });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }, [fromDate, load]);

  const saveEdit = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!editing) return;
      setSavingEdit(true);
      try {
        await apiPatch(`/api/erp/uae-tax/lines/${editing.id}`, patch);
        setEditing(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSavingEdit(false);
      }
    },
    [editing, load],
  );

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.taxable += Number(r.aed_taxable_amount) || 0;
        acc.vat += Number(r.aed_vat_amount) || 0;
        acc.recoverable += Number(r.recoverable_amount) || 0;
        if (r.document_status === "missing") acc.missing += 1;
        return acc;
      },
      { taxable: 0, vat: 0, recoverable: 0, missing: 0 },
    );
  }, [rows]);

  const sourceHref = (r: UaeTaxLine): string => {
    switch (r.source_module) {
      case "expenses_bill":
        return `/dashboard/roznamcha/expenses?bill=${r.source_id}`;
      case "local_purchase":
        return `/dashboard/purchase/local-purchase?id=${r.source_id}`;
      case "purchase_order":
        return `/dashboard/purchase/purchase-order?id=${r.source_id}`;
      case "sales_order":
        return `/dashboard/sales/sales-order?id=${r.source_id}`;
      default:
        return "#";
    }
  };

  const printConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: s.t(titleKey.replace(/^tax_einv\./, ""), "UAE VAT Lines"),
    subtitle: s.t("uae", "United Arab Emirates"),
    lang: s.lang,
    orientation: "landscape" as const,
    scope: { country: "United Arab Emirates", currency: "AED", dateRange: fromDate && toDate ? `${fromDate} – ${toDate}` : undefined },
    kpis: [
      { label: s.t("ln_taxable_aed", "Taxable (AED)"), value: fmt(totals.taxable), color: "blue" as const },
      { label: s.t("ln_vat_aed", "VAT (AED)"), value: fmt(totals.vat), color: "emerald" as const },
      { label: s.t("ln_recoverable_aed", "Recoverable (AED)"), value: fmt(totals.recoverable), color: "amber" as const },
      { label: s.t("cc_k_missing_documents", "Missing Documents"), value: totals.missing, color: "red" as const },
    ],
    columns: [
      { key: "source_date", label: "Date", format: "date" as const },
      { key: "source_reference_no", label: "Bill Number" },
      { key: "party_name", label: "Party" },
      { key: "description", label: "Description" },
      { key: "vat_rate", label: "VAT %", align: "right" as const },
      { key: "aed_taxable_amount", label: "Taxable (AED)", align: "right" as const, format: "currency" as const },
      { key: "aed_vat_amount", label: "VAT (AED)", align: "right" as const, format: "currency" as const },
      { key: "recoverability", label: "Recoverability" },
      { key: "document_status", label: "Document" },
    ],
    rows,
    totals: { aed_taxable_amount: fmt(totals.taxable), aed_vat_amount: fmt(totals.vat) },
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
              {s.t(titleKey.replace(/^tax_einv\./, ""), "")}
            </h1>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {s.t("uae", "United Arab Emirates")} · {total} {s.t("ln_records", "records")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UniversalPrintActionButton reportConfig={printConfig} />
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {s.t("cc_refresh", "Refresh")}
            </button>
            {showSync ? (
              <button
                type="button"
                onClick={() => void runSync()}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
              >
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                {syncing ? s.t("cc_syncing", "Syncing…") : s.t("cc_run_sync", "Sync from ERP")}
              </button>
            ) : null}
          </div>
        </header>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={s.t("ln_taxable_aed", "Taxable (AED)")} value={fmt(totals.taxable)} />
          <Stat label={s.t("ln_vat_aed", "VAT (AED)")} value={fmt(totals.vat)} />
          <Stat label={s.t("ln_recoverable_aed", "Recoverable (AED)")} value={fmt(totals.recoverable)} />
          <Stat label={s.t("cc_k_missing_documents", "Missing Documents")} value={String(totals.missing)} tone="text-rose-600" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-slate-200 px-2 dark:border-slate-700">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={s.t("ln_search", "Search bill no, party, description…")}
              className="flex-1 bg-transparent py-1.5 text-xs outline-none"
            />
          </div>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <Th className="px-3 py-2.5">{s.t("ln_col_date", "Date")}</Th>
                <Th className="px-3 py-2.5">{s.t("ln_col_bill", "Bill Number")}</Th>
                <Th className="px-3 py-2.5">{s.t("ln_col_party", "Party / Account")}</Th>
                <Th className="px-3 py-2.5">{s.t("ln_col_description", "Description")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("ln_col_rate", "VAT %")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("ln_col_taxable", "Taxable (AED)")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("ln_col_vat", "VAT (AED)")}</Th>
                <Th className="px-3 py-2.5">{s.t("ln_col_recoverability", "Recoverability")}</Th>
                <Th className="px-3 py-2.5">{s.t("ln_col_document", "Document")}</Th>
                <Th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-xs text-slate-400">
                    {s.t("ln_empty", "No taxable lines. Run “Sync from ERP” to pull them from the source bills.")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.source_date}</td>
                    <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">
                      <Link href={sourceHref(r)} className="inline-flex items-center gap-1 hover:text-blue-600">
                        {r.source_reference_no || "—"}
                        <ExternalLink className="h-3 w-3 text-slate-300" />
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.party_name || r.account_name || "—"}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-slate-500">{r.description || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{Number(r.vat_rate) || 0}%</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">{fmt(r.aed_taxable_amount)}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{fmt(r.aed_vat_amount)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${RECOVER_TONE[r.recoverability]}`}>
                        {s.t(`rec_${r.recoverability}`, r.recoverability)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.document_status === "missing" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                          <FileWarning className="h-3 w-3" />
                          {s.t("doc_missing", "Missing")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {s.t(`doc_${r.document_status}`, r.document_status)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-slate-50 dark:border-slate-700"
                        title={s.t("ln_classify", "Classify")}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <ClassifyDrawer
          s={s}
          line={editing}
          saving={savingEdit}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      ) : null}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-black tabular-nums ${tone ?? "text-slate-800 dark:text-slate-100"}`}>{value}</p>
    </div>
  );
}

function ClassifyDrawer({
  s,
  line,
  saving,
  onClose,
  onSave,
}: {
  s: ReturnType<typeof useErpScreen>;
  line: UaeTaxLine;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [recoverability, setRecoverability] = useState(line.recoverability);
  const [taxCategory, setTaxCategory] = useState(line.tax_category);
  const [reviewStatus, setReviewStatus] = useState(line.review_status);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/40" dir={s.dir}>
      <div className="flex w-full max-w-sm flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{s.t("ln_classify", "Classify")}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
            <p className="font-mono font-bold text-slate-700 dark:text-slate-200">{line.source_reference_no}</p>
            <p className="mt-1 text-slate-500">{line.description}</p>
            <p className="mt-1 text-slate-400">
              {s.t("ln_col_vat", "VAT (AED)")}: <span className="font-bold text-slate-700 dark:text-slate-200">{fmt(line.aed_vat_amount)}</span>
            </p>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.t("ln_col_recoverability", "Recoverability")}</span>
            <select
              value={recoverability}
              onChange={(e) => setRecoverability(e.target.value as UaeRecoverability)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {(["recoverable", "partial", "non_recoverable", "pending_review"] as const).map((v) => (
                <option key={v} value={v}>
                  {s.t(`rec_${v}`, v)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.t("ln_tax_category", "Tax Category")}</span>
            <select
              value={taxCategory}
              onChange={(e) => setTaxCategory(e.target.value as typeof taxCategory)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {(["standard", "zero_rated", "exempt", "reverse_charge", "out_of_scope", "deemed_supply"] as const).map((v) => (
                <option key={v} value={v}>
                  {s.t(`taxcat_${v}`, v)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.t("ln_review_status", "Review Status")}</span>
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value as typeof reviewStatus)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {(["auto", "confirmed", "needs_review", "excluded"] as const).map((v) => (
                <option key={v} value={v}>
                  {s.t(`review_${v}`, v)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {s.tGlobal("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSave({
                recoverability,
                taxCategory,
                reviewStatus,
                recoverableAmount:
                  recoverability === "recoverable"
                    ? Number(line.aed_vat_amount) || 0
                    : recoverability === "non_recoverable"
                      ? 0
                      : undefined,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {s.tGlobal("common.save", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
