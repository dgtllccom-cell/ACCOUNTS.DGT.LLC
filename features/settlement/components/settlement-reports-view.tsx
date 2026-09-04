"use client";

import React, { useState } from "react";
import { ArrowRight, Printer, Download, RefreshCw, Filter, Calendar } from "lucide-react";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { Th } from "@/components/ui/translated-th";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : "0";
};

export function SettlementReportsView() {
  const lang = useActiveLanguage();
  const _ = (key: string, fallback: string) => t(lang, key as never, fallback);
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
      lang,
      title: _("settr.print_title", "Settlement & Reconciliation Consolidated Report"),
      subtitle: `${_("settr.report_period", "Report Period")}: ${fromDate || _("settr.all_time", "All Time")} → ${toDate || _("settr.present", "Present")}`,
      rows: data,
      columns: [
        { label: _("settr.col_date", "Date"), key: "source_date" },
        { label: _("settr.col_reference", "Reference / Serial"), key: "source_reference_no" },
        { label: _("settr.col_module", "Module"), key: "source_module" },
        { label: _("settr.col_party", "Party"), key: "party_name" },
        { label: _("settr.col_dir", "Dir"), key: "direction" },
        { label: _("settr.col_local_amount", "Local Amount"), key: "local_amount" },
        { label: _("settr.col_usd_amount", "USD Amount"), key: "original_usd_amount" },
        { label: _("settr.col_remaining", "Remaining"), key: "remaining_local" },
        { label: _("settr.col_status", "Status"), key: "settlement_status" }
      ]
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{_("settr.title","Settlement & Reconciliation Reports")}</h1>
          <p className="text-xs text-slate-500">{_("settr.subtitle","Universal printable reports, aging analyses, and ledger reconciliation sheets")}</p>
        </div>
      </div>

      {/* Filter panel */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">{_("settr.report_scope","Report Scope")}</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="mt-1 w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
            >
              <option value="consolidated">{_("settr.opt_consolidated","Consolidated Settlement Ledger")}</option>
              <option value="unsettled">{_("settr.opt_unsettled","Unsettled / Discrepancy Aging")}</option>
              <option value="party">{_("settr.opt_party","Party-Wise Reconciliation")}</option>
              <option value="fx">{_("settr.opt_fx","FX Realization Breakdown")}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">{t(lang, "datepick.date_range", "Date Range")}</label>
            <div className="mt-1">
              <ErpDatePicker
                mode="range"
                lang={lang}
                size="sm"
                value={{ from: fromDate || null, to: toDate || null }}
                onApply={(v) => { setFromDate(v.from ?? ""); setToDate(v.to ?? ""); }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition"
            >
              {loading ? _("settr.generating","Generating...") : _("settr.generate","Generate")}
            </button>
            {data.length > 0 && (
              <button
                onClick={handlePrint}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" /> {_("common.print","Print")}
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
                  <Th className="py-3 px-4">Date</Th>
                  <Th className="py-3 px-4">Reference</Th>
                  <Th className="py-3 px-4">Module</Th>
                  <Th className="py-3 px-4">Party</Th>
                  <Th className="py-3 px-4 text-center">Dir</Th>
                  <Th className="py-3 px-4 text-right">Amount</Th>
                  <Th className="py-3 px-4 text-right">Remaining</Th>
                  <Th className="py-3 px-4 text-center">Status</Th>
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
                    <td className="py-3 px-4 text-right font-medium">{r.local_currency} {num(r.local_amount)}</td>
                    <td className="py-3 px-4 text-right font-bold">{r.local_currency} {num(r.remaining_local)}</td>
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
