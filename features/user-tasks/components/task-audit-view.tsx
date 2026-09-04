"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ScrollText, RefreshCw, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";
import { fmtDateTime } from "../lib/shared";

export function TaskAuditView({ lang: langProp }: { lang?: string }) {
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
      const r = await fetch(`/api/erp/user-tasks/audit?${qs.toString()}`, { credentials: "include" });
      const j = await r.json();
      if (j.ok) setRows(j.data.rows || []);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function print() {
    const columns: GenericReportColumn[] = [
      { key: (r: any) => fmtDateTime(r.created_at), label: s.t("col_updated", "When") },
      { key: (r: any) => r.task_no || "", label: s.t("col_task_no", "Task No") },
      { key: (r: any) => r.title || "", label: s.t("col_task", "Task") },
      { key: (r: any) => s.t(`ev_${r.event_type}`, r.event_type.replace(/_/g, " ")), label: "Event" },
      { key: (r: any) => [r.from_status, r.to_status].filter(Boolean).join(" → "), label: s.t("col_status", "Status") },
      { key: (r: any) => r.actor_name || "", label: "By" },
      { key: (r: any) => r.assignee_name || "", label: s.t("col_assignee", "Assignee") },
      { key: (r: any) => r.note || "", label: s.t("f_remarks", "Remarks") },
    ];
    void openScopedGenericReport({
      title: s.t("audit", "Task Audit History"),
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
        { label: "Events", value: String(rows.length) },
      ],
    });
  }

  return (
    <div dir={s.dir} className="min-h-screen bg-slate-50 p-4 text-sm font-sans md:p-6 dark:bg-slate-950">
      <div className="print:hidden space-y-4">
        {portalNode && createPortal(
          <div className="flex items-center gap-2">
            <span className="me-1 hidden items-center gap-1.5 text-xs font-semibold text-slate-500 sm:flex">
              <ScrollText className="h-3.5 w-3.5" /> {s.t("audit", "Task Audit History")}
            </span>
            <Button size="sm" variant="outline" onClick={load} className="h-7"><RefreshCw className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={print} className="h-7 bg-blue-600 text-white hover:bg-blue-700"><Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{s.t("print_report", "Print Report")}</span></Button>
          </div>,
          portalNode
        )}

        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{s.t("audit", "Task Audit History")}</h1>
          <p className="text-xs text-slate-500">{s.t("subtitle", "Assign work, track progress, and verify completion across your team.")}</p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap items-end gap-3 p-3">
            <label className="text-xs">
              <span className="mb-1 block font-semibold uppercase text-slate-500">{s.tGlobal("datepick.date_range", "Date Range")}</span>
              <ErpDatePicker
                mode="range"
                lang={s.lang}
                size="sm"
                value={{ from: from || null, to: to || null }}
                onApply={(v) => {
                  setFrom(v.from ?? "");
                  setTo(v.to ?? "");
                }}
              />
            </label>
            <Button size="sm" onClick={load} className="h-8 bg-slate-700 text-white hover:bg-slate-800">{s.t("refresh", "Refresh")}</Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-start font-semibold">{s.t("col_updated", "When")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{s.t("col_task", "Task")}</th>
                  <th className="px-3 py-2 text-start font-semibold">Event</th>
                  <th className="px-3 py-2 text-start font-semibold">{s.t("col_status", "Status")}</th>
                  <th className="px-3 py-2 text-start font-semibold">By</th>
                  <th className="px-3 py-2 text-start font-semibold">{s.t("col_assignee", "Assignee")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{s.t("f_remarks", "Remarks")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <tr><td colSpan={7} className="py-10 text-center text-slate-400">…</td></tr>}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-xs text-slate-400">{s.t("no_history", "No history yet.")}</td></tr>
                )}
                {!loading && rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{fmtDateTime(r.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-800">{r.title}</span>
                      <span className="ms-1 text-[11px] text-slate-400">{r.task_no}</span>
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-slate-700">{s.t(`ev_${r.event_type}`, r.event_type.replace(/_/g, " "))}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{[r.from_status, r.to_status].filter(Boolean).join(" → ") || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{r.actor_name || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{r.assignee_name || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.note || "—"}</td>
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
