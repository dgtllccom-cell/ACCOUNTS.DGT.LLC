"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, CheckCircle2, Clock,
  AlertTriangle, RefreshCw, Layers, DollarSign,
  ArrowRight, ShieldCheck, Scale, ArrowUpRight,
  Filter, Search, ExternalLink, Link2, Unlink
} from "lucide-react";
import type { SettlementKPIs, SettlementTransaction } from "../types/settlement";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

export function SettlementDashboardView() {
  const s = useErpScreen("sett");
  const [kpis, setKpis] = useState<SettlementKPIs | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<SettlementTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    setLoading(true);
    try {
      const [kpiRes, txnRes] = await Promise.all([
        fetch("/api/erp/settlement/dashboard"),
        fetch("/api/erp/settlement?limit=10")
      ]);

      if (kpiRes.ok) {
        const d = await kpiRes.json();
        setKpis(d.data || d);
      }
      if (txnRes.ok) {
        const d = await txnRes.json();
        setRecentTransactions(d.data?.items || d.items || []);
      }
    } catch (e) {
      console.error("Failed to load settlement dashboard", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/erp/settlement/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(data.message || s.t("sync_ok","Sync completed successfully!"));
        loadData();
      } else {
        setSyncMsg(s.t("sync_failed","Sync failed") + ": " + (data.error || s.t("sync_error","Unknown error")));
      }
    } catch (e) {
      setSyncMsg(s.t("sync_error","Sync error"));
    } finally {
      setSyncing(false);
    }
  }

  const netFx = kpis?.netFxUsd ?? 0;
  const isFxGain = netFx >= 0;

  return (
    <div dir={s.dir} className="space-y-6">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-xl border border-slate-700/60">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30">
                <Scale className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {s.t("dash_title","Settlement & Reconciliation Control Center")}
                </h1>
                <p className="text-sm text-slate-300">
                  {s.t("dash_sub","System-wide multi-currency transaction reconciliation, CR/DR matching, and historical FX audit")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/docs/Settlement-and-Reconciliation-System-Report.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-md transition-all"
            >
              <ExternalLink className="h-4 w-4" />
              {s.t("download_pdf","Download System PDF Report")}
            </a>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? s.t("syncing","Syncing ERP…") : s.t("sync_erp","Sync ERP Records")}
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800/80 px-3 py-2.5 text-sm font-medium text-slate-200 border border-slate-700 hover:bg-slate-700 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className="mt-4 rounded-lg bg-blue-500/20 border border-blue-500/30 px-3 py-2 text-xs text-blue-200">
            {syncMsg}
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total CR vs Settled */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.t("total_cr","Total Credit (CR)")}</span>
            <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              ${kpis?.totalCrUsd ? kpis.totalCrUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{s.t("remaining","Remaining")}: ${kpis?.remainingCrUsd?.toLocaleString() ?? "0.00"}</span>
              <span className="font-medium text-emerald-600">
                {kpis?.totalCrUsd ? Math.round(((kpis.totalCrUsd - (kpis.remainingCrUsd || 0)) / kpis.totalCrUsd) * 100) : 0}% {s.t("settled_pct","Settled")}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Total DR vs Settled */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.t("total_dr","Total Debit (DR)")}</span>
            <span className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              ${kpis?.totalDrUsd ? kpis.totalDrUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{s.t("remaining","Remaining")}: ${kpis?.remainingDrUsd?.toLocaleString() ?? "0.00"}</span>
              <span className="font-medium text-rose-600">
                {kpis?.totalDrUsd ? Math.round(((kpis.totalDrUsd - (kpis.remainingDrUsd || 0)) / kpis.totalDrUsd) * 100) : 0}% {s.t("settled_pct","Settled")}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Status Summary */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.t("status_counts","Status Counts")}</span>
            <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-center flex-1">
              <div className="text-lg font-bold text-emerald-600">{kpis?.countSettled ?? 0}</div>
              <div className="text-[10px] text-slate-400 uppercase">{s.t("settled","Settled")}</div>
            </div>
            <div className="text-center flex-1 border-x border-slate-100 dark:border-slate-800">
              <div className="text-lg font-bold text-amber-600">{kpis?.countPartial ?? 0}</div>
              <div className="text-[10px] text-slate-400 uppercase">{s.t("partial","Partial")}</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-lg font-bold text-rose-600">{kpis?.countUnsettled ?? 0}</div>
              <div className="text-[10px] text-slate-400 uppercase">{s.t("unsettled","Unsettled")}</div>
            </div>
          </div>
        </div>

        {/* Card 4: Net FX Gain / Loss */}
        <div className={`rounded-xl border p-5 shadow-sm ${
          isFxGain 
            ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20"
            : "border-rose-200 dark:border-rose-800/50 bg-rose-50/40 dark:bg-rose-950/20"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{s.t("net_fx","Net FX Realized")}</span>
            <span className={`p-2 rounded-lg ${isFxGain ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"}`}>
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold ${isFxGain ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {isFxGain ? "+" : ""}${Math.abs(netFx).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{s.t("gain","Gain")}: +${kpis?.totalFxGainUsd?.toLocaleString() ?? "0.00"}</span>
              <span>{s.t("loss","Loss")}: -${kpis?.totalFxLossUsd?.toLocaleString() ?? "0.00"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Navigation Grid */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
          {s.t("submodules","Settlement Control Center Sub-Modules")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: s.t("m_daily","Daily Settlement"), href: "/dashboard/settlement/daily", icon: Clock, count: null, color: "text-blue-500" },
            { label: s.t("m_cash","Cash / Roznamcha"), href: "/dashboard/settlement/cash", icon: Layers, count: null, color: "text-emerald-500" },
            { label: s.t("m_bank","Bank Settlement"), href: "/dashboard/settlement/bank", icon: Scale, count: null, color: "text-cyan-500" },
            { label: s.t("m_party","Party / Accounts"), href: "/dashboard/settlement/party", icon: DollarSign, count: null, color: "text-indigo-500" },
            { label: s.t("m_purchase","Purchase Settlement"), href: "/dashboard/settlement/purchase", icon: TrendingDown, count: null, color: "text-rose-500" },
            { label: s.t("m_sales","Sales Settlement"), href: "/dashboard/settlement/sales", icon: TrendingUp, count: null, color: "text-amber-500" },
            { label: s.t("m_payments","Payments"), href: "/dashboard/settlement/payment", icon: CheckCircle2, count: null, color: "text-purple-500" },
            { label: s.t("m_expenses","Expenses"), href: "/dashboard/settlement/expense", icon: AlertTriangle, count: null, color: "text-orange-500" },
            { label: s.t("m_fx","Multi-Currency / FX"), href: "/dashboard/settlement/fx", icon: DollarSign, count: null, color: "text-teal-500" },
            { label: s.t("m_unsettled","Unsettled List"), href: "/dashboard/settlement/unsettled", icon: AlertTriangle, count: kpis?.countUnsettled, color: "text-red-500" },
            { label: s.t("m_reports","Reports Hub"), href: "/dashboard/settlement/reports", icon: ArrowRight, count: null, color: "text-slate-500" },
            { label: s.t("m_audit","Audit Trail"), href: "/dashboard/settlement/audit", icon: ShieldCheck, count: null, color: "text-blue-600" }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={idx}
                href={item.href}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-blue-500 hover:shadow-md transition-all group text-center"
              >
                <span className={`p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover:scale-110 transition-transform ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600">
                  {item.label}
                </span>
                {item.count !== null && item.count !== undefined && item.count > 0 && (
                  <span className="mt-1 rounded-full bg-rose-500/10 text-rose-600 px-2 py-0.5 text-[10px] font-bold">
                    {item.count} {s.t("open","open")}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Settlement Transactions Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {s.t("recent_title","Recent Settlement Registry Records")}
            </h2>
            <p className="text-xs text-slate-500">
              {s.t("recent_sub","Live transaction feed linked from Roznamcha, Purchase, Sales, and Banks")}
            </p>
          </div>
          <Link
            href="/dashboard/settlement/unsettled"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {s.t("view_all_open","View All Open Entries")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">{s.t("c_date_ref","Date / Ref")}</th>
                <th className="py-3 px-4">{s.t("c_module_type","Module / Type")}</th>
                <th className="py-3 px-4">{s.t("c_party","Party Name")}</th>
                <th className="py-3 px-4">{s.t("c_dir","Dir")}</th>
                <th className="py-3 px-4 text-right">{s.t("c_local_amount","Local Amount")}</th>
                <th className="py-3 px-4 text-right">{s.t("c_usd_amount","USD Amount")}</th>
                <th className="py-3 px-4 text-right">{s.t("c_remaining","Remaining")}</th>
                <th className="py-3 px-4 text-center">{s.t("c_status","Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-300" />
                    {s.t("loading","Loading settlement records…")}
                  </td>
                </tr>
              ) : recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {s.t("empty", "No settlement records found. Click Sync ERP Records above to populate from existing transactions.")}
                  </td>
                </tr>
              ) : (
                recentTransactions.map((txn) => {
                  const isCr = txn.direction === "cr";
                  const statusColors: Record<string, string> = {
                    settled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
                    partially_settled: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                    unsettled: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
                    difference: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
                    needs_review: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                  };

                  return (
                    <tr key={txn.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {txn.source_reference_no || txn.source_id.substring(0, 8)}
                        </div>
                        <div className="text-[10px] text-slate-400">{txn.source_date}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                          {txn.source_module.replace("_", " ")}
                        </span>
                        <div className="text-[10px] text-slate-400">{txn.settlement_type}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white max-w-[180px] truncate">
                        {txn.party_name || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-black uppercase text-[10px] px-1.5 py-0.5 rounded ${
                          isCr ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        }`}>
                          {txn.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {txn.local_currency} {Number(txn.local_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600 dark:text-slate-300">
                        ${Number(txn.original_usd_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {txn.local_currency} {Number(txn.remaining_local).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[txn.settlement_status] || "bg-slate-100 text-slate-700"}`}>
                          {txn.settlement_status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
