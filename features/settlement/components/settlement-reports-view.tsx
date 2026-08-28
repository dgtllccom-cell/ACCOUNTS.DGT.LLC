"use client";

import React, { useState } from "react";
import { ArrowRight, Printer, Download, RefreshCw, Filter, Calendar } from "lucide-react";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";

export function SettlementReportsView() {
  const [reportType, setReportType] = useState("consolidated");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/settlement?limit=100&fromDate=${fromDate}&toDate=${toDate}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data?.items || json.items || []);
      }
    } catch (e) {
      console.error("Report generation failed", e);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    openUniversalPrintReport({
      title: "Settlement & Reconciliation Consolidated Report",
      subtitle: `Report Period: ${fromDate || "All Time"} to ${toDate || "Present"}`,
      rows: data,
      columns: [
        { label: "Date", key: "source_date" },
        { label: "Reference / Serial", key: "source_reference_no" },
        { label: "Module", key: "source_module" },
        { label: "Party", key: "party_name" },
        { label: "Dir", key: "direction" },
        { label: "Local Amount", key: "local_amount" },
        { label: "USD Amount", key: "original_usd_amount" },
        { label: "Remaining", key: "remaining_local" },
        { label: "Status", key: "settlement_status" }
      ]
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settlement & Reconciliation Reports</h1>
          <p className="text-xs text-slate-500">Universal printable reports, aging analyses, and ledger reconciliation sheets</p>
        </div>
      </div>

      {/* Filter panel */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Report Scope</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="mt-1 w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
            >
              <option value="consolidated">Consolidated Settlement Ledger</option>
              <option value="unsettled">Unsettled / Discrepancy Aging</option>
              <option value="party">Party-Wise Reconciliation</option>
              <option value="fx">FX Realization Breakdown</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition"
            >
              {loading ? "Generating..." : "Generate"}
            </button>
            {data.length > 0 && (
              <button
                onClick={handlePrint}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Generated Report Table */}
      {data.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4 text-center">Dir</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Remaining</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">{r.source_date}</td>
                    <td className="py-3 px-4 font-semibold">{r.source_reference_no || r.source_id.substring(0, 8)}</td>
                    <td className="py-3 px-4 uppercase">{r.source_module}</td>
                    <td className="py-3 px-4">{r.party_name || "—"}</td>
                    <td className="py-3 px-4 text-center uppercase font-bold">{r.direction}</td>
                    <td className="py-3 px-4 text-right font-medium">{r.local_currency} {Number(r.local_amount).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold">{r.local_currency} {Number(r.remaining_local).toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-800">
                        {r.settlement_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
