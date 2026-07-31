"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Search, AlertTriangle } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { ReportActions } from "@/components/ui/report-actions";

type Row = {
  id: string;
  code: string;
  name: string;
  currency: string;
  countryId: string | null;
  scope: string;
  openingBalance: number;
  outstanding: number;
  side: "debit" | "credit" | "zero";
  debitTotal: number;
  creditTotal: number;
  lastMovementDate: string | null;
  daysOutstanding: number | null;
};

type Resp = {
  rows: Row[];
  summary: { accounts: number; totalReceivable: number; totalPayable: number; overdue10: number };
};

type Tab = "all" | "receivable" | "payable" | "overdue";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function OutstandingRecoveryLedgerView({ lang = "en", pageTitle }: { lang?: string; pageTitle: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Resp["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [overdueDays, setOverdueDays] = useState(10);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiGet<Resp>("/api/erp/accounting/reports/ledger/outstanding");
      setRows(data.rows ?? []);
      setSummary(data.summary ?? null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load outstanding ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (tab === "receivable") r = r.filter((x) => x.outstanding > 0);
    else if (tab === "payable") r = r.filter((x) => x.outstanding < 0);
    else if (tab === "overdue") r = r.filter((x) => (x.daysOutstanding ?? 0) >= overdueDays);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      r = r.filter((x) => x.name?.toLowerCase().includes(s) || x.code?.toLowerCase().includes(s));
    }
    return r;
  }, [rows, tab, overdueDays, q]);

  const reportRows = filtered.map((x) => ({
    code: x.code,
    name: x.name,
    currency: x.currency,
    outstanding: fmt(Math.abs(x.outstanding)),
    type: x.outstanding > 0 ? "Receivable (Dr)" : x.outstanding < 0 ? "Payable (Cr)" : "-",
    last_movement: x.lastMovementDate ?? "-",
    days: x.daysOutstanding ?? "-",
    status: (x.daysOutstanding ?? 0) > 10 ? "OVERDUE" : "Current",
  }));

  const columns = [
    { key: "code", label: "Code" },
    { key: "name", label: "Account" },
    { key: "currency", label: "Curr" },
    { key: "outstanding", label: "Outstanding" },
    { key: "type", label: "Type" },
    { key: "last_movement", label: "Last Movement" },
    { key: "days", label: "Days" },
    { key: "status", label: "Status" },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All Outstanding" },
    { key: "receivable", label: "Recovery (Receivable)" },
    { key: "payable", label: "Payable" },
    { key: "overdue", label: `Overdue > ${overdueDays} days` },
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{pageTitle}</h1>
          <p className="text-xs text-slate-500">Account-wise remaining balances, aging &amp; recovery. Overdue = 10+ days since last transaction.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
          <ReportActions title={pageTitle} rows={reportRows} columns={columns} filename="outstanding_recovery_ledger" lang={lang} subtitle={`${filtered.length} accounts`} />
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Outstanding Accounts" value={String(summary.accounts)} />
          <SummaryCard label="Total Receivable" value={fmt(summary.totalReceivable)} tone="emerald" />
          <SummaryCard label="Total Payable" value={fmt(summary.totalPayable)} tone="amber" />
          <SummaryCard label="Overdue > 10 days" value={String(summary.overdue10)} tone="red" />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === tb.key ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"}`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {tab === "overdue" && (
            <label className="flex items-center gap-1 text-xs text-slate-500">
              Days ≥
              <input type="number" min={0} value={overdueDays} onChange={(e) => setOverdueDays(Number(e.target.value) || 0)} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" />
            </label>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search account…" className="w-48 rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Curr</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Last Movement</th>
              <th className="px-3 py-2 text-right">Days</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : err ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-red-500">{err}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">No outstanding accounts.</td></tr>
            ) : (
              filtered.map((x) => {
                const overdue = (x.daysOutstanding ?? 0) > 10;
                return (
                  <tr key={x.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 font-mono text-xs">{x.code}</td>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{x.name}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{x.currency}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(Math.abs(x.outstanding))}</td>
                    <td className="px-3 py-2 text-xs">{x.outstanding > 0 ? <span className="text-emerald-600">Receivable (Dr)</span> : x.outstanding < 0 ? <span className="text-amber-600">Payable (Cr)</span> : "-"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{x.lastMovementDate ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-xs">{x.daysOutstanding ?? "-"}</td>
                    <td className="px-3 py-2">
                      {overdue ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300"><AlertTriangle className="h-3 w-3" /> OVERDUE</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">Current</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" | "red" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "red" ? "text-red-600" : "text-slate-900 dark:text-slate-100";
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="text-[11px] font-medium uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
