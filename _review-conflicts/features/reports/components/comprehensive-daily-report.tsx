"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchSelect } from "@/components/ui/search-select";
import { Download, Printer, Filter, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoznamchaEntryRow } from "@/features/roznamcha/roznamcha-api";

type TabType = "summary" | "branch" | "user";

export function ComprehensiveDailyReportView() {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<RoznamchaEntryRow[]>([]);
  
  // Filters
  const [fromDate, setFromDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [countryId, setCountryId] = useState<string>("all");
  const [branchId, setBranchId] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [voucherType, setVoucherType] = useState<string>("all");
  const [targetCurrency, setTargetCurrency] = useState<string>("USD");

  const [activeTab, setActiveTab] = useState<TabType>("summary");

  // Options
  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    // Load metadata for filters
    apiGet<{ countries: any[] }>("/api/branch-management/countries")
      .then((res) => setCountries(res.countries || []))
      .catch(console.error);

    apiGet<{ entries: any[] }>("/api/branch-management/city-branches?limit=100")
      .then((res) => setBranches(res.entries || []))
      .catch(console.error);
  }, []);

  const loadData = () => {
    setLoading(true);
    const qp = new URLSearchParams();
    if (fromDate) qp.set("fromDate", fromDate);
    if (toDate) qp.set("toDate", toDate);
    if (countryId && countryId !== "all") qp.set("countryId", countryId);
    if (branchId && branchId !== "all") qp.set("cityBranchId", branchId);
    qp.set("limit", "1000");

    apiGet<{ entries: RoznamchaEntryRow[] }>(`/api/erp/roznamcha?${qp.toString()}`)
      .then(res => {
        setEntries(res.entries || []);
        // Extract users from entries
        const uniqueUsers = new Map();
        (res.entries || []).forEach(e => {
          if (e.created_by && e.profiles?.full_name) {
            uniqueUsers.set(e.created_by, e.profiles.full_name);
          }
        });
        setUsers(Array.from(uniqueUsers.entries()).map(([id, name]) => ({ id, name })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [fromDate, toDate, countryId, branchId]);

  // Apply frontend filters
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (userId !== "all" && e.created_by !== userId) return false;
      // Extract voucher prefix
      if (voucherType !== "all") {
        const type = e.voucher_no.substring(0, 2).toLowerCase();
        if (voucherType === "cr" && type !== "cr") return false;
        if (voucherType === "cp" && type !== "cp") return false;
        if (voucherType === "br" && type !== "br") return false;
        if (voucherType === "bp" && type !== "bp") return false;
        if (voucherType === "jv" && type !== "jv") return false;
      }
      return true;
    });
  }, [entries, userId, voucherType]);

  // Summaries Calculations
  const dailySummary = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number; count: number }>();
    filteredEntries.forEach(e => {
      const date = e.entry_date;
      if (!map.has(date)) map.set(date, { debit: 0, credit: 0, count: 0 });
      const stats = map.get(date)!;
      stats.count++;
      
      e.roznamcha_lines?.forEach(l => {
        const d = targetCurrency === "USD" ? l.usd_amount * (l.debit > 0 ? 1 : 0) : l.debit;
        const c = targetCurrency === "USD" ? l.usd_amount * (l.credit > 0 ? 1 : 0) : l.credit;
        stats.debit += d;
        stats.credit += c;
      });
    });
    return Array.from(map.entries()).map(([date, stats]) => ({ date, ...stats })).sort((a,b) => a.date.localeCompare(b.date));
  }, [filteredEntries, targetCurrency]);

  const branchSummary = useMemo(() => {
    const map = new Map<string, { name: string; country: string; code: string; debit: number; credit: number; count: number }>();
    filteredEntries.forEach(e => {
      const bid = e.city_branch_id || e.country_branch_id || "unassigned";
      if (!map.has(bid)) {
        map.set(bid, {
          name: e.city_branches?.name || e.country_branches?.name || "Unassigned Branch",
          code: e.city_branches?.code || e.country_branches?.code || "N/A",
          country: e.countries?.name || "Unknown",
          debit: 0, credit: 0, count: 0
        });
      }
      const stats = map.get(bid)!;
      stats.count++;
      
      e.roznamcha_lines?.forEach(l => {
        const d = targetCurrency === "USD" ? l.usd_amount * (l.debit > 0 ? 1 : 0) : l.debit;
        const c = targetCurrency === "USD" ? l.usd_amount * (l.credit > 0 ? 1 : 0) : l.credit;
        stats.debit += d;
        stats.credit += c;
      });
    });
    return Array.from(map.values()).sort((a,b) => b.count - a.count);
  }, [filteredEntries, targetCurrency]);

  const userSummary = useMemo(() => {
    const map = new Map<string, { name: string; debit: number; credit: number; count: number }>();
    filteredEntries.forEach(e => {
      const uid = e.created_by || "system";
      if (!map.has(uid)) {
        map.set(uid, {
          name: e.profiles?.full_name || "System/Unknown User",
          debit: 0, credit: 0, count: 0
        });
      }
      const stats = map.get(uid)!;
      stats.count++;
      
      e.roznamcha_lines?.forEach(l => {
        const d = targetCurrency === "USD" ? l.usd_amount * (l.debit > 0 ? 1 : 0) : l.debit;
        const c = targetCurrency === "USD" ? l.usd_amount * (l.credit > 0 ? 1 : 0) : l.credit;
        stats.debit += d;
        stats.credit += c;
      });
    });
    return Array.from(map.values()).sort((a,b) => b.count - a.count);
  }, [filteredEntries, targetCurrency]);

  const handleExportCSV = () => {
    let dataToExport: any[] = [];
    if (activeTab === "summary") dataToExport = dailySummary;
    if (activeTab === "branch") dataToExport = branchSummary;
    if (activeTab === "user") dataToExport = userSummary;

    if (dataToExport.length === 0) return;
    const keys = Object.keys(dataToExport[0]);
    const csv = "data:text/csv;charset=utf-8," + [keys.join(","), ...dataToExport.map(row => keys.map(k => `"${String((row as any)[k]).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", `comprehensive_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fmtCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", { style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-500">Date Range</label>
          <div className="flex items-center gap-1">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 rounded-md border border-slate-200 text-xs px-2" />
            <span className="text-slate-400">-</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 rounded-md border border-slate-200 text-xs px-2" />
          </div>
        </div>

        <div className="space-y-1 w-40">
          <label className="text-[10px] font-black uppercase text-slate-500">Country</label>
          <select value={countryId} onChange={e => setCountryId(e.target.value)} className="h-8 w-full rounded-md border border-slate-200 text-xs px-2 outline-none">
            <option value="all">All Countries</option>
            {countries.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 w-40">
          <label className="text-[10px] font-black uppercase text-slate-500">Branch</label>
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className="h-8 w-full rounded-md border border-slate-200 text-xs px-2 outline-none">
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 w-40">
          <label className="text-[10px] font-black uppercase text-slate-500">User</label>
          <select value={userId} onChange={e => setUserId(e.target.value)} className="h-8 w-full rounded-md border border-slate-200 text-xs px-2 outline-none">
            <option value="all">All Users</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 w-32">
          <label className="text-[10px] font-black uppercase text-slate-500">Voucher Type</label>
          <select value={voucherType} onChange={e => setVoucherType(e.target.value)} className="h-8 w-full rounded-md border border-slate-200 text-xs px-2 outline-none">
            <option value="all">All</option>
            <option value="cr">Cash Receipt (CR)</option>
            <option value="cp">Cash Payment (CP)</option>
            <option value="br">Bank Receipt (BR)</option>
            <option value="bp">Bank Payment (BP)</option>
            <option value="jv">Journal Voucher (JV)</option>
          </select>
        </div>
        
        <div className="space-y-1 w-32">
          <label className="text-[10px] font-black uppercase text-slate-500">Currency Mode</label>
          <select value={targetCurrency} onChange={e => setTargetCurrency(e.target.value)} className="h-8 w-full rounded-md border border-slate-200 text-xs px-2 outline-none font-bold text-indigo-600 bg-indigo-50">
            <option value="USD">USD (Converted)</option>
            <option value="LOCAL">Local Currency</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={handleExportCSV} className="h-8 flex items-center gap-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-md transition-colors">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button onClick={() => window.print()} className="h-8 flex items-center gap-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md transition-colors shadow-sm">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(["summary", "branch", "user"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-black uppercase tracking-wider rounded-t-lg transition-colors",
              activeTab === tab ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            {tab === "summary" ? "Daily Summary" : tab === "branch" ? "Branch-wise Report" : "User-wise Report"}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 font-bold text-sm">
            Loading report data...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {activeTab === "summary" && (
                    <>
                      <th className="px-4 py-3 font-black uppercase text-slate-500">Date</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500">Transactions</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500 text-right">Total Debit ({targetCurrency})</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500 text-right">Total Credit ({targetCurrency})</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500 text-right">Net Balance ({targetCurrency})</th>
                    </>
                  )}
                  {activeTab === "branch" && (
                    <>
                      <th className="px-4 py-3 font-black uppercase text-slate-500">Branch Name</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500">Branch Code</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500">Country</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500">Transactions</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500 text-right">Total Debit ({targetCurrency})</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500 text-right">Total Credit ({targetCurrency})</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500 text-right">Net Balance ({targetCurrency})</th>
                    </>
                  )}
                  {activeTab === "user" && (
                    <>
                      <th className="px-4 py-3 font-black uppercase text-slate-500">User Name</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500">Transactions Created</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500 text-right">Total Debit ({targetCurrency})</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500 text-right">Total Credit ({targetCurrency})</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-500 text-right">Net Balance ({targetCurrency})</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeTab === "summary" && dailySummary.map(row => (
                  <tr key={row.date} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-bold">{row.date}</td>
                    <td className="px-4 py-2">{row.count}</td>
                    <td className="px-4 py-2 text-right font-mono text-rose-600">{fmtCurrency(row.debit)}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600">{fmtCurrency(row.credit)}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">{fmtCurrency(Math.abs(row.debit - row.credit))}</td>
                  </tr>
                ))}
                {activeTab === "branch" && branchSummary.map(row => (
                  <tr key={row.name + row.code} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-bold">{row.name}</td>
                    <td className="px-4 py-2 font-mono text-slate-500">{row.code}</td>
                    <td className="px-4 py-2 text-indigo-600 font-semibold">{row.country}</td>
                    <td className="px-4 py-2">{row.count}</td>
                    <td className="px-4 py-2 text-right font-mono text-rose-600">{fmtCurrency(row.debit)}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600">{fmtCurrency(row.credit)}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">{fmtCurrency(Math.abs(row.debit - row.credit))}</td>
                  </tr>
                ))}
                {activeTab === "user" && userSummary.map(row => (
                  <tr key={row.name} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-bold">{row.name}</td>
                    <td className="px-4 py-2">{row.count}</td>
                    <td className="px-4 py-2 text-right font-mono text-rose-600">{fmtCurrency(row.debit)}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600">{fmtCurrency(row.credit)}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">{fmtCurrency(Math.abs(row.debit - row.credit))}</td>
                  </tr>
                ))}
                {(activeTab === "summary" ? dailySummary : activeTab === "branch" ? branchSummary : userSummary).length === 0 && !loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500 italic">No transactions found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
