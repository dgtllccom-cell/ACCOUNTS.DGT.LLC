"use client";

import React, { useState, useEffect } from "react";
import { Clock, RefreshCw, Filter, CheckCircle2, Printer } from "lucide-react";
import type { SettlementDailySummary } from "../types/settlement";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";
import { DataEmptyState } from "@/components/ui/data-empty-state";

export function DailySettlementView() {
  const [dailyRows, setDailyRows] = useState<SettlementDailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const lang = useActiveLanguage();
  const th = (x: string) => translateHeader(lang, x);
  const scope = useErpScope();

  function printReport() {
    const num = (v: number) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const columns: GenericReportColumn[] = [
      { key: (r: any) => r.txn_date ? new Date(r.txn_date).toLocaleDateString(`${lang}-u-ca-gregory-nu-latn`, { calendar: "gregory", numberingSystem: "latn" }) : "", label: th("Date") },
      { key: (r: any) => [r.branch_name || r.city_branch_name || "—", r.country_name].filter(Boolean).join(" — "), label: th("Country & Branch") },
      { key: "total_entries", label: th("Entries"), align: "center" },
      { key: (r: any) => `${r.local_currency || ""} ${num(r.total_cr_local)}`, label: th("Total CR"), align: "right" },
      { key: (r: any) => `${r.local_currency || ""} ${num(r.total_dr_local)}`, label: th("Total DR"), align: "right" },
      { key: (r: any) => `${r.local_currency || ""} ${num(r.remaining_cr_local || r.remaining_dr_local || 0)}`, label: th("Open Balance"), align: "right" },
      { key: (r: any) => `${r.count_settled ?? 0} / ${r.count_unsettled ?? 0}`, label: th("Settled / Open"), align: "center" },
      { key: (r: any) => `+$${Number(r.total_fx_gain_usd || 0).toFixed(2)}`, label: th("FX Realized"), align: "right" },
    ];
    void openScopedGenericReport({
      title: th("Daily Branch Settlement & Closing"),
      subtitle: "Day-by-day reconciliation summary per branch with status breakdown and realized FX",
      lang,
      columns,
      rows: dailyRows as unknown as Record<string, unknown>[],
      orientation: "landscape",
      countryId: scope.lockedCountryId,
      countryBranchId: scope.lockedCountryBranchId,
      cityBranchId: scope.lockedCityBranchId,
      countryName: scope.countryName,
      branchName: scope.branchDisplayName,
      printedBy: scope.userName,
      summary: {
        "Days": String(dailyRows.length),
        "Total Entries": String(dailyRows.reduce((s, r) => s + Number(r.total_entries || 0), 0)),
      },
    });
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/settlement/daily");
      if (res.ok) {
        const data = await res.json();
        setDailyRows(data.data || data || []);
      }
    } catch (e) {
      console.error("Failed to load daily settlement", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{th("Daily Branch Settlement & Closing")}</h1>
          <p className="text-xs text-slate-500">Day-by-day reconciliation summary per branch with status breakdown and realized FX</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={printReport}
            className="inline-flex items-center gap-2 p-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-blue-600 disabled:opacity-40"
          >
            <Printer className="h-4 w-4" /> {th("Print Report")}
          </button>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
          >
            <RefreshCw className="h-4 w-4" /> {th("Refresh")}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">{th("Date")}</th>
                <th className="py-3 px-4">{th("Country & Branch")}</th>
                <th className="py-3 px-4 text-center">{th("Entries")}</th>
                <th className="py-3 px-4 text-right">{th("Total CR")}</th>
                <th className="py-3 px-4 text-right">{th("Total DR")}</th>
                <th className="py-3 px-4 text-right">{th("Open Balance")}</th>
                <th className="py-3 px-4 text-center">{th("Settled / Open")}</th>
                <th className="py-3 px-4 text-right">{th("FX Realized")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">{th("Loading daily summaries...")}</td>
                </tr>
              ) : dailyRows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <DataEmptyState title={th("No daily settlement summaries found")} hint={th("Settlement summaries appear here once branch entries are posted for a day.")} />
                  </td>
                </tr>
              ) : (
                dailyRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold">{r.txn_date}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">{r.branch_name || r.city_branch_name || "—"}</div>
                      <div className="text-[10px] text-slate-400">{r.country_name || "Country"}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold">{r.total_entries}</td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-600">
                      {r.local_currency} {Number(r.total_cr_local).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-rose-600">
                      {r.local_currency} {Number(r.total_dr_local).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      {r.local_currency} {Number(r.remaining_cr_local || r.remaining_dr_local || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] font-bold text-emerald-600">{r.count_settled}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-[10px] font-bold text-rose-600">{r.count_unsettled}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      +${Number(r.total_fx_gain_usd || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
