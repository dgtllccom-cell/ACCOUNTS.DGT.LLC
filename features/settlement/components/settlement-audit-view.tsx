"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, RefreshCw, Clock, Filter } from "lucide-react";

export function SettlementAuditView() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/settlement/audit?limit=50");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data || data || []);
      }
    } catch (e) {
      console.error("Failed to load audit history", e);
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settlement Audit Trail</h1>
          <p className="text-xs text-slate-500">Immutable chronological log of all settlement links, adjustments, and review actions</p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
        >
          <RefreshCw className="h-4 w-4" /> Refresh Log
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Ref / Entity</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status Change</th>
                <th className="py-3 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading audit trail...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No audit log entries recorded yet.</td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-[11px]">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="py-3 px-4 font-medium">{row.actor_name || "System User"}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold uppercase text-[9px]">
                        {row.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{row.source_reference_no || row.party_name || "Link Match"}</td>
                    <td className="py-3 px-4 text-right font-medium">
                      {row.currency ? `${row.currency} ` : ""}{row.amount_involved ? Number(row.amount_involved).toLocaleString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-[10px]">
                      {row.previous_status ? `${row.previous_status} → ${row.new_status}` : row.new_status || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate">{row.reason || "—"}</td>
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
