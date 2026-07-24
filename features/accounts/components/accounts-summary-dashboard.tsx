"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Hash,
  UserRound,
  Building2,
  Landmark,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Eye,
  TrendingUp,
  ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  journalCode: string;
  accountCategory: string;
  subType: string;
  status: string;
  createdAt: string;
  branchName: string;
  branchCode: string;
  branchType: string;
  countryName: string;
  currency: string;
  currentBalance: number;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
};

function fmtNum(v: number) {
  return (Number.isFinite(v) ? v : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  sub: string;
  color: string;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-all group`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${color}/5 to-transparent pointer-events-none`} />
      <p className={`text-[10px] font-bold uppercase tracking-widest ${color.replace("/5", "")} mb-1`}>{label}</p>
      <p className="text-3xl font-extrabold text-slate-900 tabular-nums leading-none mt-1">
        {loading ? (
          <span className="inline-block h-8 w-14 animate-pulse rounded bg-slate-200" />
        ) : (
          value.toLocaleString()
        )}
      </p>
      <p className="mt-1.5 text-[11px] text-slate-500">{sub}</p>
      <div className={`absolute bottom-3 right-3 h-9 w-9 rounded-full ${color.replace("text-", "bg-").replace(/\/\d+/, "/10")} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="absolute top-3 right-12 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
      </div>
    </div>
  );
}

export function AccountsSummaryDashboard() {
  const router = useRouter();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/erp/accounting/reports/accounts/general?limit=1000")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json && json.ok && json.data && Array.isArray(json.data.rows)) setRows(json.data.rows);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── KPI Counts ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      total: rows.length,
      customers: rows.filter((r) => (r.accountCategory ?? "").toLowerCase().includes("customer")).length,
      companies: rows.filter((r) =>
        (r.accountCategory ?? "").toLowerCase().includes("company") ||
        (r.subType ?? "").toLowerCase().includes("company")
      ).length,
      banks: rows.filter((r) => (r.accountCategory ?? "").toLowerCase().includes("bank")).length,
      active: rows.filter((r) => (r.status ?? "").toLowerCase() === "active").length,
      closed: rows.filter((r) => ["closed", "inactive", "suspended"].includes((r.status ?? "").toLowerCase())).length,
      recent: rows.filter((r) => {
        if (!r.createdAt) return false;
        return new Date(r.createdAt) >= thirtyDaysAgo;
      }).length,
    };
  }, [rows]);

  // Unique filter options
  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.accountCategory) set.add(r.accountCategory); });
    return Array.from(set);
  }, [rows]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.status) set.add(r.status); });
    return Array.from(set);
  }, [rows]);

  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.countryName) set.add(r.countryName); });
    return Array.from(set);
  }, [rows]);

  // Filtered rows
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !(r.accountName ?? "").toLowerCase().includes(q) &&
          !(r.accountCode ?? "").toLowerCase().includes(q) &&
          !(r.journalCode ?? "").toLowerCase().includes(q)
        ) return false;
      }
      if (filterType !== "all" && r.accountCategory !== filterType) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterCountry !== "all" && r.countryName !== filterCountry) return false;
      return true;
    });
  }, [rows, search, filterType, filterStatus, filterCountry]);

  const cards = [
    { label: "Total Accounts", value: stats.total, sub: "All registered accounts", color: "text-[#0284c7]", icon: Hash },
    { label: "Customers", value: stats.customers, sub: "Customer accounts", color: "text-emerald-600", icon: UserRound },
    { label: "Companies", value: stats.companies, sub: "Company accounts", color: "text-violet-600", icon: Building2 },
    { label: "Banks", value: stats.banks, sub: "Bank accounts", color: "text-amber-600", icon: Landmark },
    { label: "Active", value: stats.active, sub: "Active accounts", color: "text-teal-600", icon: CheckCircle2 },
    { label: "Closed", value: stats.closed, sub: "Inactive / closed", color: "text-rose-600", icon: XCircle },
    { label: "Recent (30d)", value: stats.recent, sub: "Added in last 30 days", color: "text-indigo-600", icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Accounts</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Accounts Summary Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete overview of all accounts — historical and current records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <TrendingUp className="h-3.5 w-3.5" />
            {loading ? "Loading..." : `${stats.total} Total Accounts`}
          </span>
          <Button
            type="button"
            onClick={() => router.push("/dashboard/accounts/setup")}
            className="rounded-lg bg-primary text-white text-xs font-semibold h-9 px-4"
          >
            + New Account
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} loading={loading} />
        ))}
      </div>

      {/* ── Full Accounts Table ───────────────────────────────────────── */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="bg-[#0f172a] px-5 py-3.5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">All Accounts Register</h2>
            <p className="text-[11px] text-white/60">Historical + Current records — {filtered.length} shown</p>
          </div>
          <span className="text-[10px] text-white/50">
            Generated: {new Date().toISOString().slice(0, 10)}
          </span>
        </div>

        {/* Filters */}
        <div className="bg-slate-50 border-b px-4 py-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-500 font-semibold uppercase">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name / Account No..."
                className="h-8 pl-8 text-xs w-52 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-slate-500 font-semibold uppercase">Account Type</Label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-8 rounded-lg border border-input bg-white px-2.5 text-xs w-36"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-slate-500 font-semibold uppercase">Status</Label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 rounded-lg border border-input bg-white px-2.5 text-xs w-32"
            >
              <option value="all">All Status</option>
              {uniqueStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-slate-500 font-semibold uppercase">Country</Label>
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="h-8 rounded-lg border border-input bg-white px-2.5 text-xs w-36"
            >
              <option value="all">All Countries</option>
              {uniqueCountries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setSearch(""); setFilterType("all"); setFilterStatus("all"); setFilterCountry("all"); }}
            className="h-8 text-xs"
          >
            Reset
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Sr#</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Account No.</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Account Name</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Type</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Sub Type</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Status</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Branch</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Country</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200 text-right">Balance</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Created</th>
                <th className="px-3 py-2.5 font-bold text-center">View</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 11 }).map((__, j) => (
                      <td key={j} className="px-3 py-2.5 border-r border-slate-100">
                        <span className="inline-block h-3.5 w-full animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((row, i) => {
                  const statusColor =
                    (row.status ?? "").toLowerCase() === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : (row.status ?? "").toLowerCase() === "closed"
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-600";

                  return (
                    <tr key={row.accountId} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-500 font-medium">{i + 1}</td>
                      <td className="px-3 py-2 border-r border-slate-200 font-bold font-mono text-blue-700 text-[11px]">
                        {row.journalCode} / {row.accountCode}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-900 max-w-[180px] truncate">
                        {row.accountName}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-600">{row.accountCategory}</td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-500">{row.subType || "-"}</td>
                      <td className="px-3 py-2 border-r border-slate-200">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${statusColor}`}>
                          {row.status || "Active"}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-600 font-medium max-w-[130px] truncate">
                        {row.branchName}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-600">{row.countryName}</td>
                      <td className={`px-3 py-2 border-r border-slate-200 text-right font-bold font-mono text-[11px] ${
                        row.currentBalance < 0 ? "text-red-600" : row.currentBalance > 0 ? "text-emerald-600" : "text-slate-600"
                      }`}>
                        {fmtNum(row.currentBalance)}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-500 text-[10px]">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/accounts/view?accountId=${row.accountId}`)}
                          className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-400">
                    No accounts found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
