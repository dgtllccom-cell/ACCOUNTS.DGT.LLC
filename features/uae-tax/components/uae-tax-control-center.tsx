"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  Building2,
  Calculator,
  FileWarning,
  Loader2,
  Package,
  RefreshCw,
  Send,
  ShoppingBag,
  Coins,
  Receipt,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet, apiPost } from "@/lib/api/client";
import type {
  UaeTaxDashboardKpis,
  UaeTaxEntity,
  UaeTaxPeriod,
} from "@/features/uae-tax/types/uae-tax";

type DashboardResponse = {
  kpis: UaeTaxDashboardKpis;
  entities: UaeTaxEntity[];
  periods: UaeTaxPeriod[];
};

function fmtAed(v: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
}

export function UaeTaxControlCenter({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("tax_einv", langProp);

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [entityId, setEntityId] = useState<string>("");
  const [periodId, setPeriodId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (entityId) qs.set("taxEntityId", entityId);
      if (periodId) qs.set("periodId", periodId);
      if (fromDate) qs.set("fromDate", fromDate);
      if (toDate) qs.set("toDate", toDate);
      const res = await apiGet<DashboardResponse>(`/api/erp/uae-tax/dashboard?${qs.toString()}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [entityId, periodId, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await apiPost<{ synced: number; note?: string }>("/api/erp/uae-tax/sync", {
        taxEntityId: entityId || null,
        fromDate: fromDate || null,
      });
      setSyncNote(res.note ?? s.t("cc_sync_hint", ""));
      await load();
    } catch (e) {
      setSyncNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }, [entityId, fromDate, load, s]);

  const k = data?.kpis;
  const hasEntity = (data?.entities?.length ?? 0) > 0;

  const sections = useMemo(() => {
    if (!k) return [];
    return [
      {
        key: "sales",
        title: s.t("cc_sec_sales", "Sales / Output VAT"),
        icon: Coins,
        tone: "text-emerald-600",
        cards: [
          { label: s.t("cc_k_output_taxable", "Taxable Sales"), value: k.output_taxable_aed },
          { label: s.t("cc_k_output_vat", "Output VAT"), value: k.output_vat_aed },
          { label: s.t("cc_k_zero_rated", "Zero-Rated Sales"), value: k.output_zero_rated_aed },
          { label: s.t("cc_k_exempt", "Exempt Sales"), value: k.output_exempt_aed },
        ],
      },
      {
        key: "purchases",
        title: s.t("cc_sec_purchases", "Purchases / Input VAT"),
        icon: ShoppingBag,
        tone: "text-blue-600",
        cards: [
          { label: s.t("cc_k_input_taxable", "Taxable Purchases"), value: k.input_taxable_aed },
          { label: s.t("cc_k_input_vat", "Input VAT"), value: k.input_vat_aed },
          { label: s.t("cc_k_recoverable", "Recoverable VAT"), value: k.input_recoverable_aed },
          { label: s.t("cc_k_non_recoverable", "Non-Recoverable VAT"), value: k.input_non_recoverable_aed },
        ],
      },
      {
        key: "expenses",
        title: s.t("cc_sec_expenses", "Daily Expenses"),
        icon: Receipt,
        tone: "text-amber-600",
        cards: [{ label: s.t("cc_k_expense_vat", "Expense Input VAT"), value: k.expense_vat_aed }],
      },
      {
        key: "import",
        title: s.t("cc_sec_import", "Import"),
        icon: Package,
        tone: "text-indigo-600",
        cards: [{ label: s.t("cc_k_import_vat", "Import VAT"), value: k.import_vat_aed }],
      },
      {
        key: "export",
        title: s.t("cc_sec_export", "Export / Re-Export"),
        icon: Send,
        tone: "text-cyan-600",
        cards: [
          { label: s.t("cc_k_exports", "Exports"), value: k.export_aed },
          { label: s.t("cc_k_reexports", "Re-Exports"), value: k.re_export_aed },
        ],
      },
    ];
  }, [k, s]);

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <Calculator className="h-5 w-5" />
            </span>
            <div className={s.textStart}>
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
                {s.t("cc_title", "UAE Tax & e-Invoicing Control Center")}
              </h1>
              <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-500">{s.t("cc_subtitle", "")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {s.t("cc_refresh", "Refresh")}
            </button>
            <button
              type="button"
              onClick={() => void runSync()}
              disabled={syncing || !hasEntity}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
              {syncing ? s.t("cc_syncing", "Syncing…") : s.t("cc_run_sync", "Sync from ERP")}
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {s.t("cc_entity", "Tax Entity")}
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{s.t("cc_all_entities", "All Entities")}</option>
              {data?.entities?.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.legal_name} — {ent.trn}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {s.t("cc_period", "Tax Period")}
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{s.t("cc_all_periods", "All Periods")}</option>
              {data?.periods?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.period_code}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {s.t("cc_from", "From")}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {s.t("cc_to", "To")}
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>

        {syncNote ? (
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{syncNote}</p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="h-4 w-4 animate-spin" /> …
          </div>
        ) : !hasEntity ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <Building2 className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
              {s.t("cc_no_entity_title", "No UAE tax entity configured yet")}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">{s.t("cc_no_entity_body", "")}</p>
            <Link
              href="/dashboard/tax-einvoicing/uae/settings"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              {s.t("cc_go_to_settings", "Open UAE Tax Settings")}
            </Link>
          </div>
        ) : (
          <>
            {/* Net VAT headline */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-500">{s.t("cc_k_net_vat", "Net VAT Payable")}</p>
                <p className="mt-1 text-xl font-black tabular-nums text-blue-700 dark:text-blue-300">
                  {fmtAed(k?.net_vat_aed ?? 0)} <span className="text-xs font-bold text-blue-400">AED</span>
                </p>
              </div>
              <MiniStat icon={BadgeCheck} tone="text-slate-600" label={s.t("cc_k_lines_tracked", "Tax Lines Tracked")} value={k?.lines_total ?? 0} />
              <MiniStat icon={FileWarning} tone="text-rose-600" label={s.t("cc_k_missing_documents", "Missing Documents")} value={k?.lines_missing_document ?? 0} />
              <MiniStat icon={AlertTriangle} tone="text-amber-600" label={s.t("cc_k_needs_review", "Needs Review")} value={k?.lines_needs_review ?? 0} />
            </div>

            {sections.map((sec) => {
              const Icon = sec.icon;
              return (
                <div key={sec.key} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <Icon className={`h-4 w-4 ${sec.tone}`} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">{sec.title}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {sec.cards.map((c) => (
                      <div key={c.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</p>
                        <p className="mt-1 text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">
                          {fmtAed(c.value)} <span className="text-[10px] font-bold text-slate-400">AED</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}

function MiniStat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof BadgeCheck;
  tone: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        {label}
      </p>
      <p className="mt-1 text-xl font-black tabular-nums text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
