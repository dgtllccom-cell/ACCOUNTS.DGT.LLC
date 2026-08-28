"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, Calendar, Globe } from "lucide-react";

export function FxSettlementView() {
  const [fxList, setFxList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/settlement/fx");
      if (res.ok) {
        const data = await res.json();
        setFxList(data.data || data || []);
      }
    } catch (e) {
      console.error("Failed to load FX analysis", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalGain = fxList
    .filter((r) => r.fx_direction === "gain")
    .reduce((sum, r) => sum + Number(r.fx_difference_usd || 0), 0);

  const totalLoss = fxList
    .filter((r) => r.fx_direction === "loss")
    .reduce((sum, r) => sum + Math.abs(Number(r.fx_difference_usd || 0)), 0);

  const netFx = totalGain - totalLoss;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Multi-Currency & FX Gain/Loss Center</h1>
          <p className="text-xs text-slate-500">
            Historical exchange rate preservation and directional currency profit/loss audit
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
        >
          <RefreshCw className="h-4 w-4" /> Refresh FX Data
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="text-xs font-semibold text-emerald-800 uppercase">Realized FX Gains</div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">+${totalGain.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5">
          <div className="text-xs font-semibold text-rose-800 uppercase">Realized FX Losses</div>
          <div className="text-2xl font-bold text-rose-700 mt-2">-${totalLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className={`rounded-xl border p-5 ${netFx >= 0 ? "border-emerald-300 bg-emerald-100/40" : "border-rose-300 bg-rose-100/40"}`}>
          <div className="text-xs font-semibold text-slate-700 uppercase">Net Realized FX Impact</div>
          <div className={`text-2xl font-bold mt-2 ${netFx >= 0 ? "text-emerald-800" : "text-rose-800"}`}>
            {netFx >= 0 ? "+" : ""}${netFx.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-sm">
          Settled Transaction FX Difference Log
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">CR Side (Source)</th>
                <th className="py-3 px-4">DR Side (Target)</th>
                <th className="py-3 px-4 text-right">Linked Local</th>
                <th className="py-3 px-4 text-right">CR Rate</th>
                <th className="py-3 px-4 text-right">DR Rate</th>
                <th className="py-3 px-4 text-right">FX Diff (USD)</th>
                <th className="py-3 px-4 text-center">Direction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading FX data...</td>
                </tr>
              ) : fxList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No settlement links with FX rates recorded yet.</td>
                </tr>
              ) : (
                fxList.map((r) => (
                  <tr key={r.link_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">{r.settlement_date}</td>
                    <td className="py-3 px-4 font-semibold">{r.cr_ref} ({r.cr_party || "CR"})</td>
                    <td className="py-3 px-4 font-semibold">{r.dr_ref} ({r.dr_party || "DR"})</td>
                    <td className="py-3 px-4 text-right font-medium">{r.local_currency} {Number(r.linked_local_amount).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono">{r.cr_usd_rate}</td>
                    <td className="py-3 px-4 text-right font-mono">{r.dr_usd_rate}</td>
                    <td className={`py-3 px-4 text-right font-bold ${r.fx_direction === "gain" ? "text-emerald-600" : r.fx_direction === "loss" ? "text-rose-600" : ""}`}>
                      {r.fx_direction === "gain" ? "+" : ""}${Number(r.fx_difference_usd).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        r.fx_direction === "gain" ? "bg-emerald-100 text-emerald-800" : r.fx_direction === "loss" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
                      }`}>
                        {r.fx_direction}
                      </span>
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
