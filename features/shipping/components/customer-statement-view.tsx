"use client";

import { useState } from "react";
import { Printer, Search, Loader2, FileBarChart } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { Th } from "@/components/ui/translated-th";
import { CustomerPicker } from "@/features/customers/components/customer-picker";
import { openCustomerLedgerPrintReport, type CustomerLedgerReportData } from "@/lib/reports/open-customer-ledger-print-report";

export function CustomerStatementView({ lang: langProp }: { lang: SupportedLanguage }) {
  const activeLang = useActiveLanguage();
  const lang = activeLang !== "en" ? activeLang : langProp;
  const tt = (key: string, fallback: string) => t(lang, ("shipstmt." + key) as never, fallback);
  const dir = getLanguageDirection(lang);

  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CustomerLedgerReportData | null>(null);

  async function handleFetch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!customerId) {
      setError(tt("err_customer_required", "Select a customer first."));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ customerId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/erp/reports/customer-statement?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load statement");
      setReport(json.data);
    } catch (err: any) {
      setError(err.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    if (!report) return;
    openCustomerLedgerPrintReport({ report, lang });
  }

  return (
    <div dir={dir} className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 border border-slate-700/50 rounded-2xl p-6 shadow-xl text-white">
        <div className="space-y-1">
          <span className="bg-blue-500/20 text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-blue-500/30">
            {tt("module_badge", "Shipping / Clearing Reports")}
          </span>
          <h1 className="text-2xl font-bold tracking-tight">{tt("title", "Combined Customer Statement")}</h1>
          <p className="text-slate-400 text-sm">
            {tt("subtitle", "Every posted Business and Shipping transaction for one customer, in one running-balance statement.")}
          </p>
        </div>
      </div>

      {error ? <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm font-medium">{error}</div> : null}

      <form onSubmit={handleFetch} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("customer", "Customer")} *</label>
            <CustomerPicker label="" value={customerId} onValueChange={setCustomerId} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("from_date", "From Date")}</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("to_date", "To Date")}</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          {report ? (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700"
            >
              <Printer className="w-4 h-4" />
              {tt("print", "Print Statement")}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {tt("load_statement", "Load Statement")}
          </button>
        </div>
      </form>

      {report ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileBarChart className="w-5 h-5 text-blue-400" />
                {report.customerName} ({report.customerCode})
              </h2>
              <p className="text-xs text-slate-400">{report.address}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="block text-[11px] text-slate-500 uppercase">{tt("total_debit", "Total Debit")}</span>
                <span className="font-mono font-bold text-white">
                  {report.currency} {report.totalDebit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 uppercase">{tt("total_credit", "Total Credit")}</span>
                <span className="font-mono font-bold text-white">
                  {report.currency} {report.totalCredit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 uppercase">{tt("closing_balance", "Closing Balance")}</span>
                <span className={`font-mono font-bold ${report.closingDcType === "Dr" ? "text-amber-400" : "text-emerald-400"}`}>
                  {report.currency} {report.closingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} {report.closingDcType}
                </span>
              </div>
            </div>
          </div>

          {report.rows.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">{tt("empty", "No transactions found for this customer in the selected range.")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/90 text-slate-200 uppercase font-bold border-b border-slate-700">
                  <tr>
                    <Th className="px-3 py-2.5">#</Th>
                    <Th className="px-3 py-2.5">{tt("th_date", "Date")}</Th>
                    <Th className="px-3 py-2.5">{tt("th_source", "Source")}</Th>
                    <Th className="px-3 py-2.5">{tt("th_remarks", "Remarks")}</Th>
                    <Th className="px-3 py-2.5 text-right">{tt("th_debit", "Debit")}</Th>
                    <Th className="px-3 py-2.5 text-right">{tt("th_credit", "Credit")}</Th>
                    <Th className="px-3 py-2.5 text-right">{tt("th_balance", "Balance")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {report.rows.map((row) => (
                    <tr key={row.srNo}>
                      <td className="px-3 py-2">{row.srNo}</td>
                      <td className="px-3 py-2 font-mono">{String(row.date).slice(0, 10)}</td>
                      <td className="px-3 py-2 font-mono">{row.roznamachaNameAndNo}</td>
                      <td className="px-3 py-2">{row.remarks}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.debit ? row.debit.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.credit ? row.credit.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {row.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} {row.dcType}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
