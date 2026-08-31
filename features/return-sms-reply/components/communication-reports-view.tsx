"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  MessageSquare,
  Mail,
  Sparkles,
  Printer,
  Download,
  Share2,
  Table2,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet
} from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";

type Props = {
  lang: SupportedLanguage;
};

export function CommunicationReportsView({ lang }: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; date: string; user: string; action: string; channel: string; recipient: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/erp/communication-center/overview", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const body = d?.data ?? d ?? {};
        setMetrics(body.metrics ?? {});
        setAuditLogs(
          (body.recentMessages ?? []).map((m: any) => ({
            id: String(m.id),
            date: m.created_at ?? "",
            user: m.sender_name || "—",
            action: [m.linked_module, m.linked_document_no].filter(Boolean).join(" ") || m.subject || (m.direction === "outgoing" ? "Outgoing message" : "Incoming message"),
            channel: m.channel || "—",
            recipient: m.recipient_to || "—",
            status: m.delivery_status || m.read_status || "—",
          })),
        );
      })
      .catch(() => { if (!cancelled) { setMetrics({}); setAuditLogs([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const num = (v: number | undefined) => (typeof v === "number" ? v.toLocaleString() : "0");
  const kpis = useMemo(() => [
    { label: _("crv.email_delivered", "Emails Sent"), value: num(metrics.emailsSent), icon: <Mail className="h-4 w-4" />, color: "text-blue-600 bg-blue-50 border-blue-200" },
    { label: _("crv.wa_delivered", "WhatsApp Sent"), value: num(metrics.whatsappsSent), icon: <MessageSquare className="h-4 w-4" />, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { label: _("crv.total_msgs", "Open Leads"), value: num(metrics.openLeads), icon: <BarChart3 className="h-4 w-4" />, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
    { label: _("crv.reminders_sent", "Due Follow-ups"), value: num(metrics.dueFollowups), icon: <Clock className="h-4 w-4" />, color: "text-purple-600 bg-purple-50 border-purple-200" },
    { label: _("crv.ai_drafted", "Campaigns"), value: num(metrics.campaigns), icon: <Sparkles className="h-4 w-4" />, color: "text-amber-600 bg-amber-50 border-amber-200" },
    { label: _("crv.avg_response", "Failed Messages"), value: num(metrics.failedMessages), icon: <AlertCircle className="h-4 w-4" />, color: "text-rose-600 bg-rose-50 border-rose-200" }
  ], [metrics, lang]);

  const handlePrint = () => {
    void import("@/lib/reports/open-generic-erp-report").then(({ openGenericErpReport }) => {
      openGenericErpReport({
        title: _("crv.audit_trail", "Communication Audit Trail & Delivery History"),
        lang,
        orientation: "landscape",
        columns: [
          { key: "date", label: "Date", format: "date" },
          { key: "user", label: "User" },
          { key: "action", label: "Action" },
          { key: "channel", label: "Channel" },
          { key: "recipient", label: "Recipient" },
          { key: "status", label: "Status", format: "status" },
        ],
        rows: auditLogs as unknown as Record<string, unknown>[],
        filters: [{ label: "Records", value: String(auditLogs.length) }],
      });
    });
  };

  const handleExportCsv = () => {
    const headers = "ID,Date,User,Action,Channel,Recipient,Status\n";
    const rows = auditLogs.map((l) => `${l.id},${l.date},${l.user},${l.action},${l.channel},${l.recipient},${l.status}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `communication-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500">{kpi.label}</span>
              <div className={cn("rounded-xl p-1.5 border", kpi.color)}>
                {kpi.icon}
              </div>
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-2">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Controls & Export Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b pb-3 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-500" />
          {_("crv.audit_trail", "Communication Audit Trail & Delivery History")}
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-400 shadow-sm"
          >
            <Table2 className="h-3.5 w-3.5" /> {_("crv.export_csv", "Export CSV")}
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" /> {_("crv.print_audit", "Print Audit Report")}
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-slate-100 dark:bg-slate-950">
              <Th className="px-4 py-3 text-left font-black uppercase">Timestamp</Th>
              <Th className="px-4 py-3 text-left font-black uppercase">User</Th>
              <Th className="px-4 py-3 text-left font-black uppercase">Action</Th>
              <Th className="px-4 py-3 text-center font-black uppercase">Channel</Th>
              <Th className="px-4 py-3 text-left font-black uppercase">Recipient</Th>
              <Th className="px-4 py-3 text-center font-black uppercase">Delivery Result</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(loading || auditLogs.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {loading ? _("common.loading", "Loading…") : _("common.no_records", "No records found.")}
                </td>
              </tr>
            )}
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 font-mono text-slate-500">{new Date(log.date).toLocaleString()}</td>
                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{log.user}</td>
                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{log.action}</td>
                <td className="px-4 py-3 text-center uppercase font-bold">{log.channel}</td>
                <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{log.recipient}</td>
                <td className="px-4 py-3 text-center">
                  <span className="text-[10px] font-black rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
