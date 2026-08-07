"use client";

import { useState } from "react";
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

  const kpis = [
    { label: "Total Messages", value: "1,420", icon: <MessageSquare className="h-4 w-4" />, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
    { label: "WhatsApp Delivered", value: "982", icon: <MessageSquare className="h-4 w-4" />, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { label: "Emails Delivered", value: "438", icon: <Mail className="h-4 w-4" />, color: "text-blue-600 bg-blue-50 border-blue-200" },
    { label: "AI Replies Drafted", value: "1,105", icon: <Sparkles className="h-4 w-4" />, color: "text-amber-600 bg-amber-50 border-amber-200" },
    { label: "Reminders Sent", value: "312", icon: <Clock className="h-4 w-4" />, color: "text-purple-600 bg-purple-50 border-purple-200" },
    { label: "Avg Response Time", value: "1.4 min", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-teal-600 bg-teal-50 border-teal-200" }
  ];

  const mockAuditLogs = [
    { id: "log-1", date: new Date().toISOString(), user: "Super Admin", action: "Approved AI Reply", channel: "WhatsApp", recipient: "+92 300 1234567", status: "Delivered" },
    { id: "log-2", date: new Date().toISOString(), user: "Country Admin (PK)", action: "Payment Reminder Sent", channel: "Email", recipient: "billing@supplier.com", status: "Sent" },
    { id: "log-3", date: new Date().toISOString(), user: "Branch Accountant", action: "Manual Reply", channel: "WhatsApp", recipient: "+971 50 9876543", status: "Delivered" }
  ];

  const handlePrint = () => window.print();

  const handleExportCsv = () => {
    const headers = "ID,Date,User,Action,Channel,Recipient,Status\n";
    const rows = mockAuditLogs.map((l) => `${l.id},${l.date},${l.user},${l.action},${l.channel},${l.recipient},${l.status}`).join("\n");
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
          Communication Audit Trail & Delivery History
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-400 shadow-sm"
          >
            <Table2 className="h-3.5 w-3.5" /> Export CSV
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" /> Print Audit Report
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
            {mockAuditLogs.map((log) => (
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
