"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Search, Filter, Link2, Unlink, RefreshCw, AlertCircle,
  CheckCircle2, ArrowRight, ShieldCheck, DollarSign, Printer
} from "lucide-react";
import type { SettlementTransaction, SettlementLink } from "../types/settlement";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";
import { DataEmptyState } from "@/components/ui/data-empty-state";

interface SettlementModuleViewProps {
  title: string;
  subtitle: string;
  defaultModule?: string;
  defaultDirection?: "cr" | "dr" | "all";
}

export function SettlementModuleView({
  title,
  subtitle,
  defaultModule,
  defaultDirection = "all"
}: SettlementModuleViewProps) {
  const [transactions, setTransactions] = useState<SettlementTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTxn, setSelectedTxn] = useState<SettlementTransaction | null>(null);
  const [activeLinks, setActiveLinks] = useState<SettlementLink[]>([]);
  const [matchingCandidates, setMatchingCandidates] = useState<SettlementTransaction[]>([]);
  const [linkingAmount, setLinkingAmount] = useState<string>("");
  const [targetDrId, setTargetDrId] = useState<string>("");
  const [linkRemarks, setLinkRemarks] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const lang = useActiveLanguage();
  const scope = useErpScope();

  const money = (v: number, ccy?: string) =>
    `${ccy ? ccy + " " : ""}${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const reportColumns: GenericReportColumn[] = useMemo(() => ([
    { key: (r: any) => r.source_reference_no || r.id?.slice(0, 8), label: "Date / Serial" },
    { key: (r: any) => r.source_date ? new Date(r.source_date).toLocaleDateString("en-GB") : "", label: "Date" },
    { key: (r: any) => [r.party_name, r.narration].filter(Boolean).join(" — "), label: "Party & Narration" },
    { key: (r: any) => String(r.direction || "").toUpperCase(), label: "Dir", align: "center" },
    { key: (r: any) => money(r.local_amount, r.local_currency), label: "Total", align: "right" },
    { key: (r: any) => money(r.remaining_local, r.local_currency), label: "Remaining", align: "right" },
    { key: (r: any) => String(r.settlement_status || "").replace(/_/g, " "), label: "Status", align: "center" },
  ]), []);

  function printReport() {
    const rows = transactions as unknown as Record<string, unknown>[];
    const totalCr = transactions.filter((t) => t.direction === "cr").reduce((s, t) => s + Number(t.local_amount || 0), 0);
    const totalDr = transactions.filter((t) => t.direction === "dr").reduce((s, t) => s + Number(t.local_amount || 0), 0);
    const totalRemaining = transactions.reduce((s, t) => s + Number(t.remaining_local || 0), 0);
    void openScopedGenericReport({
      title,
      subtitle,
      lang,
      columns: reportColumns,
      rows,
      orientation: "landscape",
      countryId: scope.lockedCountryId,
      countryBranchId: scope.lockedCountryBranchId,
      cityBranchId: scope.lockedCityBranchId,
      countryName: scope.countryName,
      branchName: scope.branchDisplayName,
      printedBy: scope.userName,
      filters: [
        { label: "Status", value: statusFilter === "all" ? "All" : statusFilter.replace(/_/g, " ") },
        ...(searchTerm ? [{ label: "Search", value: searchTerm }] : []),
        { label: "Records", value: String(transactions.length) },
      ],
      summary: {
        "Total CR": money(totalCr),
        "Total DR": money(totalDr),
        "Total Remaining": money(totalRemaining),
        "Records": String(transactions.length),
      },
    });
  }

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (defaultModule) params.set("module", defaultModule);
      if (defaultDirection !== "all") params.set("direction", defaultDirection);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/erp/settlement?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.data?.items || data.items || []);
      }
    } catch (e) {
      console.error("Error loading settlement transactions", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusFilter, defaultModule, defaultDirection]);

  // Load links and potential matching targets when a transaction is selected
  async function handleSelectTxn(txn: SettlementTransaction) {
    setSelectedTxn(txn);
    setLinkMsg(null);
    setLinkingAmount(String(txn.remaining_local));

    try {
      // 1. Get existing links
      const linksRes = await fetch(`/api/erp/settlement/link?settlementId=${txn.id}`);
      if (linksRes.ok) {
        const linksData = await linksRes.json();
        setActiveLinks(linksData.data || linksData || []);
      }

      // 2. If it's a CR transaction, get available DR candidates for matching
      if (txn.direction === "cr") {
        const oppRes = await fetch(`/api/erp/settlement?direction=dr&status=unsettled&limit=20`);
        if (oppRes.ok) {
          const oppData = await oppRes.json();
          setMatchingCandidates(oppData.data?.items || oppData.items || []);
        }
      }
    } catch (e) {
      console.error("Error loading transaction link details", e);
    }
  }

  async function handleCreateLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTxn || !targetDrId || !linkingAmount) return;

    setLinking(true);
    setLinkMsg(null);
    try {
      const res = await fetch("/api/erp/settlement/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crSettlementId: selectedTxn.id,
          drSettlementId: targetDrId,
          linkAmount: Number(linkingAmount),
          remarks: linkRemarks
        })
      });

      const data = await res.json();
      if (res.ok) {
        setLinkMsg({ text: "Settlement link matched successfully!", type: "success" });
        loadData();
        handleSelectTxn(selectedTxn);
      } else {
        setLinkMsg({ text: data.error || "Failed to create link", type: "error" });
      }
    } catch (e) {
      setLinkMsg({ text: "Network error during settlement linking", type: "error" });
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(linkId: string) {
    if (!confirm("Are you sure you want to remove this settlement link? Both balances will be restored.")) return;

    try {
      const res = await fetch(`/api/erp/settlement/link/${linkId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setLinkMsg({ text: "Link successfully removed and balances reversed", type: "success" });
        loadData();
        if (selectedTxn) handleSelectTxn(selectedTxn);
      }
    } catch (e) {
      console.error("Failed to remove link", e);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ref, party, account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadData()}
              className="pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`text-xs rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              statusFilter !== "all"
                ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            }`}
          >
            <option value="all">All Statuses</option>
            <option value="unsettled">Unsettled Only</option>
            <option value="partially_settled">Partially Settled</option>
            <option value="settled">Settled</option>
            <option value="needs_review">Needs Review</option>
          </select>
          {(statusFilter !== "all" || searchTerm) && (
            <button
              onClick={() => { setStatusFilter("all"); setSearchTerm(""); setTimeout(loadData, 0); }}
              className="inline-flex items-center gap-1.5 p-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <Unlink className="h-3.5 w-3.5" /> {t(lang, "common.clear_selection", "Clear Filters")}
            </button>
          )}
          <button
            onClick={printReport}
            className="inline-flex items-center gap-1.5 p-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-semibold text-blue-600 disabled:opacity-40"
          >
            <Printer className="h-4 w-4" /> Print Report
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-600 dark:text-slate-300"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content Layout: Left Table + Right Matching/Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Transaction Registry Table */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Date / Serial</th>
                  <th className="py-3 px-3">Party & Narration</th>
                  <th className="py-3 px-2 text-center">Dir</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3 text-right">Remaining</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-300" />
                      Loading records...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <DataEmptyState
                        title="No matching records found"
                        hint={statusFilter !== "all" || searchTerm ? "No records match the selected filters. Adjust the status or search and try again." : "Settlement transactions appear here once entries are posted."}
                      />
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => {
                    const isSelected = selectedTxn?.id === txn.id;
                    const isCr = txn.direction === "cr";

                    return (
                      <tr
                        key={txn.id}
                        onClick={() => handleSelectTxn(txn)}
                        className={`cursor-pointer transition ${
                          isSelected 
                            ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-blue-600" 
                            : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {txn.source_reference_no || txn.source_id.substring(0, 8)}
                          </div>
                          <div className="text-[10px] text-slate-400">{txn.source_date}</div>
                        </td>
                        <td className="py-3 px-3 max-w-[180px]">
                          <div className="font-medium text-slate-900 dark:text-white truncate">
                            {txn.party_name || "—"}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {txn.narration || txn.party_account_no || "—"}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`font-black uppercase text-[9px] px-1.5 py-0.5 rounded ${
                            isCr ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}>
                            {txn.direction}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-medium">{txn.local_currency} {Number(txn.local_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          <div className="text-[10px] text-slate-400">${Number(txn.original_usd_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {txn.local_currency} {Number(txn.remaining_local).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {txn.settlement_status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-600"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Match / Link Drawer Panel */}
        <div className="space-y-4">
          {selectedTxn ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Selected Entry</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    selectedTxn.direction === "cr" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {selectedTxn.direction.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {selectedTxn.source_reference_no || selectedTxn.source_id.substring(0, 8)}
                </h3>
                <p className="text-xs text-slate-500">{selectedTxn.party_name || "No party specified"}</p>
              </div>

              {/* Balances card */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Amount:</span>
                  <span className="font-semibold">{selectedTxn.local_currency} {Number(selectedTxn.local_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Historical USD:</span>
                  <span className="font-semibold">${Number(selectedTxn.original_usd_amount).toLocaleString()} (@ {selectedTxn.original_usd_rate})</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">Remaining to Settle:</span>
                  <span className="font-bold text-blue-600">{selectedTxn.local_currency} {Number(selectedTxn.remaining_local).toLocaleString()}</span>
                </div>
              </div>

              {/* Active settlement links */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Active Settlement Links ({activeLinks.length})
                </h4>
                {activeLinks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No links attached yet.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {activeLinks.map((link) => (
                      <div
                        key={link.id}
                        className="p-2 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold">{link.dr_reference_no || "DR Link"}</div>
                          <div className="text-[10px] text-slate-400">
                            {link.linked_local_amount.toLocaleString()} ({link.fx_direction.toUpperCase()} FX: ${link.fx_difference_usd})
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnlink(link.id)}
                          className="p-1 rounded hover:bg-rose-50 text-rose-600"
                          title="Unlink"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CR -> DR Match Form */}
              {selectedTxn.direction === "cr" && selectedTxn.remaining_local > 0 && (
                <form onSubmit={handleCreateLink} className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Match Against Debit (DR)
                  </h4>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Target DR Transaction</label>
                    <select
                      value={targetDrId}
                      onChange={(e) => setTargetDrId(e.target.value)}
                      required
                      className="mt-1 w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an open DR record...</option>
                      {matchingCandidates.map((cand) => (
                        <option key={cand.id} value={cand.id}>
                          {cand.source_reference_no || cand.source_id.substring(0, 8)} — {cand.party_name || "No party"} ({cand.local_currency} {Number(cand.remaining_local).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Link Amount ({selectedTxn.local_currency})</label>
                    <input
                      type="number"
                      step="any"
                      max={selectedTxn.remaining_local}
                      value={linkingAmount}
                      onChange={(e) => setLinkingAmount(e.target.value)}
                      required
                      className="mt-1 w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Settlement Remarks</label>
                    <input
                      type="text"
                      placeholder="Optional notes..."
                      value={linkRemarks}
                      onChange={(e) => setLinkRemarks(e.target.value)}
                      className="mt-1 w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {linkMsg && (
                    <div className={`p-2 rounded text-xs ${
                      linkMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}>
                      {linkMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={linking}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 transition disabled:opacity-50"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {linking ? "Processing..." : "Create Settlement Link"}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
              <DataEmptyState
                icon={Link2}
                title="Transaction Linkage Details"
                hint="Select a transaction on the left to view its linkage details, matching candidates, and FX analysis."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
