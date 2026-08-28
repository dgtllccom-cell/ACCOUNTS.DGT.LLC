"use client";

import React, { useState, useEffect } from "react";
import { Clock, RefreshCw, Filter, CheckCircle2 } from "lucide-react";
import type { SettlementDailySummary } from "../types/settlement";

export function DailySettlementView() {
  const [dailyRows, setDailyRows] = useState<SettlementDailySummary[]>([]);
  const [loading, setLoading] = useState(true);

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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Daily Branch Settlement & Closing</h1>
          <p className="text-xs text-slate-500">Day-by-day reconciliation summary per branch with status breakdown and realized FX</p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Country & Branch</th>
                <th className="py-3 px-4 text-center">Entries</th>
                <th className="py-3 px-4 text-right">Total CR</th>
                <th className="py-3 px-4 text-right">Total DR</th>
                <th className="py-3 px-4 text-right">Open Balance</th>
                <th className="py-3 px-4 text-center">Settled / Open</th>
                <th className="py-3 px-4 text-right">FX Realized</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading daily summaries...</td>
                </tr>
              ) : dailyRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No daily settlement summaries found.</td>
                </tr>
              ) : (
                dailyRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold">{r.txn_date}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">{r.branch_name || r.city_branch_name || "Main Branch"}</div>
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
