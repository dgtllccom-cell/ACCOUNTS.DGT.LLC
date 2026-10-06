"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Route, ShieldAlert, ShieldCheck } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";

type Row = Record<string, any>;
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800";

const INSURANCE_TONE: Record<string, string> = {
  covered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  expiring: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  expired: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  missing: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  not_required: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export function RouteBorderInsuranceReportView({ lang }: { lang?: string }) {
  const s = useErpScreen("rbi", lang);
  const [rows, setRows] = useState<Row[]>([]);
  const [countries, setCountries] = useState<Row[]>([]);
  const [countryId, setCountryId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [clearanceType, setClearanceType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const insLabel = useCallback((st: string) => s.t(`ins_${st}`, st), [s]);
  const modeLabel = useCallback((m: string) => s.t(`mode_${m}`, m ?? "—"), [s]);
  const clearanceLabel = useCallback((c: string) => s.t(`clearance_${c}`, c ?? "—"), [s]);
  const customsLabel = useCallback((c: string) => s.t(`customs_${c}`, c ?? "—"), [s]);

  useEffect(() => {
    apiGet<any>("/api/branch-management/countries").then((r) => setCountries(r?.countries ?? [])).catch(() => setCountries([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (countryId) params.set("countryId", countryId);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (clearanceType) params.set("clearanceType", clearanceType);
      const r = await apiGet<{ rows: Row[] }>(`/api/erp/reports/route-border-insurance?${params.toString()}`);
      setRows(r.rows ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [countryId, fromDate, toDate, clearanceType]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => ({
    total: rows.length,
    missing: rows.filter((r) => r.insurance_status === "missing").length,
    expiring: rows.filter((r) => r.insurance_status === "expiring").length,
  }), [rows]);

  return (
    <div dir={s.dir} className="space-y-4" data-testid="rbi-view">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white"><Route className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{s.t("title", "Route, Border & Insurance Report")}</h1>
            <p className="text-xs text-slate-500">{s.t("subtitle", "Real per-leg route, customs/border and cargo insurance status across every customer order.")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span data-testid="rbi-sum-total" className="rounded-lg bg-slate-100 px-2 py-1 font-semibold dark:bg-slate-800">{s.t("total_legs", "Total Legs")}: <b className="tabular-nums">{summary.total}</b></span>
          <span data-testid="rbi-sum-missing" className="rounded-lg bg-rose-50 px-2 py-1 font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{s.t("legs_missing_insurance", "Missing Insurance")}: <b className="tabular-nums">{summary.missing}</b></span>
          <span data-testid="rbi-sum-expiring" className="rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{s.t("legs_expiring", "Expiring Soon")}: <b className="tabular-nums">{summary.expiring}</b></span>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("filter_country", "Country")}</label>
          <select data-testid="rbi-f-country" className={INP} value={countryId} onChange={(e) => setCountryId(e.target.value)}>
            <option value="">{s.t("all_countries", "All Countries")}</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("filter_from_date", "From date")}</label>
          <input data-testid="rbi-f-from" type="date" className={INP} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("filter_to_date", "To date")}</label>
          <input data-testid="rbi-f-to" type="date" className={INP} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("filter_clearance_type", "Clearance type")}</label>
          <select data-testid="rbi-f-clearance" className={INP} value={clearanceType} onChange={(e) => setClearanceType(e.target.value)}>
            <option value="">{s.t("all_types", "All Types")}</option>
            <option value="import">{s.t("clearance_import", "Import")}</option>
            <option value="export">{s.t("clearance_export", "Export")}</option>
            <option value="transit">{s.t("clearance_transit", "Transit")}</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="button" data-testid="rbi-refresh" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-800">
            <RefreshCw className="h-4 w-4" /> {s.t("refresh", "Refresh")}
          </button>
        </div>
      </section>

      {error && <p data-testid="rbi-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-xs" data-testid="rbi-table">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                {[
                  s.t("col_order", "Order No."), s.t("col_customer", "Customer"), s.t("col_leg", "Leg"),
                  s.t("col_route", "Route"), s.t("col_mode", "Mode"), s.t("col_border", "Border / Customs Point"),
                  s.t("col_clearance_type", "Clearance"), s.t("col_customs_status", "Customs Status"),
                  s.t("col_duty", "Duty"), s.t("col_insurance", "Insurance"), s.t("col_coverage", "Coverage To"),
                ].map((h) => <Th key={h} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-teal-700" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-400">{s.t("no_rows", "No route legs found for the selected filters.")}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.leg_id} data-testid="rbi-row" data-insurance-status={r.insurance_status} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-mono font-semibold">{r.order_no}</td>
                  <td className="px-3 py-2">{r.customer_name}</td>
                  <td className="px-3 py-2 tabular-nums text-center">{r.leg_no}</td>
                  <td className="px-3 py-2">{r.from_country_name ?? r.from_location_text ?? "—"} → {r.to_country_name ?? r.to_location_text ?? "—"}</td>
                  <td className="px-3 py-2">{modeLabel(r.transport_mode)}</td>
                  <td className="px-3 py-2">{r.customs_point_text ?? "—"}</td>
                  <td className="px-3 py-2">{r.clearance_type ? clearanceLabel(r.clearance_type) : "—"}</td>
                  <td className="px-3 py-2">{customsLabel(r.customs_status)}</td>
                  <td className="px-3 py-2 tabular-nums" dir="ltr">{r.duty_amount != null ? `${r.duty_currency ?? ""} ${Number(r.duty_amount).toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${INSURANCE_TONE[r.insurance_status] ?? INSURANCE_TONE.not_required}`}>
                      {r.insurance_status === "missing" ? <ShieldAlert className="h-3 w-3" /> : r.insurance_status === "covered" ? <ShieldCheck className="h-3 w-3" /> : null}
                      {insLabel(r.insurance_status)}
                    </span>
                    {r.policy_no && <div className="mt-0.5 text-[10px] text-slate-400">{r.policy_no} · {r.insurer_name}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-500">{r.coverage_to ? new Date(r.coverage_to).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
