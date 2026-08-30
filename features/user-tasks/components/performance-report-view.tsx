"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, RefreshCw, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";

export function PerformanceReportView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("utask", langProp);
  const erpScope = useErpScope();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  useEffect(() => { setPortalNode(document.getElementById("erp-page-actions-slot")); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const r = await fetch(`/api/erp/user-tasks/performance?${qs.toString()}`, { credentials: "include" });
      const j = await r.json();
      if (j.ok) setRows(j.data.rows || []);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const pct = (v: number) => `${Math.round((Number(v) || 0) * 100)}%`;

  function print() {
    const columns: GenericReportColumn[] = [
      { key: (r: any) => r.user_name || "", label: s.t("col_assignee", "Assignee") },
      { key: (r: any) => r.country_name || "", label: s.t("col_country", "Country") },
      { key: (r: any) => String(r.total_assigned), label: s.t("k_assigned", "Assigned"), align: "right" },
      { key: (r: any) => String(r.completed), label: s.t("k_completed", "Completed"), align: "right" },
      { key: (r: any) => String(r.verified), label: s.t("k_verified", "Verified"), align: "right" },
      { key: (r: any) => String(r.in_progress), label: s.t("k_in_progress", "In Progress"), align: "right" },
      { key: (r: any) => String(r.pending), label: s.t("k_pending", "Pending"), align: "right" },
      { key: (r: any) => String(r.overdue), label: s.t("k_overdue", "Overdue"), align: "right" },
      { key: (r: any) => String(r.returned), label: s.t("k_returned", "Returned"), align: "right" },
      { key: (r: any) => pct(r.on_time_rate), label: s.t("k_on_time", "On-time Rate"), align: "right" },
    ];
    void openScopedGenericReport({
      title: s.t("performance", "User Performance"),
      subtitle: s.t("subtitle", "User Tasks"),
      lang: s.lang,
      columns,
      rows: rows as unknown as Record<string, unknown>[],
      orientation: "landscape",
      countryId: erpScope.lockedCountryId,
      countryBranchId: erpScope.lockedCountryBranchId,
      cityBranchId: erpScope.lockedCityBranchId,
      countryName: erpScope.countryName,
      branchName: erpScope.branchDisplayName,
      printedBy: erpScope.userName,
      filters: [
        ...(from ? [{ label: "From", value: from }] : []),
        ...(to ? [{ label: "To", value: to }] : []),
        { label: "Users", value: String(rows.length) },
      ],
    });
  }

  return (
    <div dir={s.dir} className="min-h-screen bg-slate-50 p-4 text-sm font-sans md:p-6 dark:bg-slate-950">
      <div className="print:hidden space-y-4">
        {portalNode && createPortal(
          <div className="flex items-center gap-2">
            <span className="me-1 hidden items-center gap-1.5 text-xs font-semibold text-slate-500 sm:flex">
              <BarChart3 className="h-3.5 w-3.5" /> {s.t("performance", "User Performance")}
            </span>
            <Button size="sm" variant="outline" onClick={load} className="h-7"><RefreshCw className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={print} className="h-7 bg-blue-600 text-white hover:bg-blue-700"><Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{s.t("print_report", "Print Report")}</span></Button>
          </div>,
          portalNode
        )}

        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{s.t("performance", "User Performance")}</h1>
          <p className="text-xs text-slate-500">{s.t("subtitle", "Assign work, track progress, and verify completion across your team.")}</p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap items-end gap-3 p-3">
            <label className="text-xs">
              <span className="mb-1 block font-semibold uppercase text-slate-500">From</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-semibold uppercase text-slate-500">To</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
            <Button size="sm" onClick={load} className="h-8 bg-slate-700 text-white hover:bg-slate-800">{s.t("refresh", "Refresh")}</Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-start font-semibold">{s.t("col_assignee", "Assignee")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{s.t("col_country", "Country")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{s.t("k_assigned", "Assigned")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{s.t("k_completed", "Completed")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{s.t("k_verified", "Verified")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{s.t("k_in_progress", "In Progress")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{s.t("k_pending", "Pending")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{s.t("k_overdue", "Overdue")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{s.t("k_returned", "Returned")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{s.t("k_on_time", "On-time Rate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <tr><td colSpan={10} className="py-10 text-center text-slate-400">…</td></tr>}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={10} className="py-12 text-center text-xs text-slate-400">{s.t("empty", "No tasks yet.")}</td></tr>
                )}
                {!loading && rows.map((r) => (
                  <tr key={r.user_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{r.user_name || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{r.country_name || "—"}</td>
                    <td className="px-3 py-2 text-right">{r.total_assigned}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{r.completed}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{r.verified}</td>
                    <td className="px-3 py-2 text-right text-indigo-600">{r.in_progress}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{r.pending}</td>
                    <td className="px-3 py-2 text-right text-rose-600">{r.overdue}</td>
                    <td className="px-3 py-2 text-right text-amber-600">{r.returned}</td>
                    <td className="px-3 py-2 text-right font-semibold">{pct(r.on_time_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
