"use client";

import React, { useEffect, useState } from "react";
import { ErpSession } from "@/lib/auth/session";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import {
  BarChart3,
  Calendar,
  CreditCard,
  Download,
  Filter,
  Globe2,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  Users,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CrmReportsViewProps {
  session: ErpSession;
}

const REPORT_TYPES = [
  { id: "daily_action", labelKey: "crm.daily_action_report", defaultLabel: "Daily Action Report", icon: CheckCircle2 },
  { id: "overdue", labelKey: "crm.overdue_report", defaultLabel: "Overdue Report", icon: AlertTriangle },
  { id: "cheques", labelKey: "crm.cheque_due_report", defaultLabel: "Cheque Due Report", icon: CreditCard },
  { id: "purchase_due", labelKey: "crm.purchase_due_report", defaultLabel: "Purchase Due Report", icon: ShoppingCart },
  { id: "sales_recovery", labelKey: "crm.sales_recovery_report", defaultLabel: "Sales Recovery Report", icon: Coins },
  { id: "shipping_due", labelKey: "crm.shipping_due_report", defaultLabel: "Shipping Due Report", icon: Truck },
  { id: "country_crm", labelKey: "crm.country_crm_report", defaultLabel: "Country CRM Report", icon: Globe2 },
  { id: "branch_crm", labelKey: "crm.branch_crm_report", defaultLabel: "Branch CRM Report", icon: Building2 },
  { id: "user_followup", labelKey: "crm.user_followup_report", defaultLabel: "User Follow-Up Report", icon: Users },
];

export function CrmReportsView({ session }: CrmReportsViewProps) {
  const lang = useActiveLanguage();
  const th = (s: string) => translateHeader(lang, s);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const [reportType, setReportType] = useState<string>("daily_action");
  const [countryId, setCountryId] = useState<string>("");
  const [cityBranchId, setCityBranchId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        reportType,
        ...(countryId ? { countryId } : {}),
        ...(cityBranchId ? { cityBranchId } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/erp/crm/reports?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load CRM report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, countryId, cityBranchId, startDate, endDate, status]);

  const handleExportCsv = () => {
    if (!data?.records?.length) return;
    const headers = ["Sr #", "Global Serial", "Reference No", "Type", "Party", "Due Date", "Amount", "Paid", "Remaining", "Currency", "Status", "Responsible User"];
    const csvRows = [headers.join(",")];
    data.records.forEach((r: any) => {
      csvRows.push([
        r.srNo,
        `"${r.globalSerial}"`,
        `"${r.referenceNo}"`,
        `"${r.itemType}"`,
        `"${r.partyName}"`,
        r.dueDate,
        r.amount,
        r.paidAmount,
        r.remainingAmount,
        r.currency,
        `"${r.status}"`,
        `"${r.responsibleUser}"`
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm_report_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handlePrintReport = () => {
    const recs = data?.records || [];
    void import("@/lib/reports/open-generic-erp-report").then(({ openGenericErpReport }) => {
      openGenericErpReport({
        title: `${t(lang, "crmr.report_title", "CRM Report")} — ${reportType || t(lang, "crmr.smart_due", "Smart Due")}`,
        lang,
        orientation: "landscape",
        columns: [
          { key: "globalSerial", label: t(lang, "crmr.col_global_serial", "Global Serial") },
          { key: "referenceNo", label: t(lang, "crmr.col_reference_no", "Reference No") },
          { key: "itemType", label: t(lang, "crmr.col_type", "Type") },
          { key: "partyName", label: t(lang, "crmr.col_party", "Party") },
          { key: "dueDate", label: t(lang, "crmr.col_due_date", "Due Date"), format: "date" },
          { key: "amount", label: t(lang, "crmr.col_amount", "Amount"), align: "right", format: "currency" },
          { key: "paidAmount", label: t(lang, "crmr.col_paid", "Paid"), align: "right", format: "currency" },
          { key: "remainingAmount", label: t(lang, "crmr.col_remaining", "Remaining"), align: "right", format: "currency" },
          { key: "currency", label: t(lang, "crmr.col_currency", "Currency") },
          { key: "status", label: t(lang, "crmr.col_status", "Status"), format: "status" },
          { key: "responsibleUser", label: t(lang, "crmr.col_responsible_user", "Responsible User") },
        ],
        rows: recs as Record<string, unknown>[],
        filters: [{ label: t(lang, "crmr.col_report_type", "Report Type"), value: String(reportType || "-") }, { label: t(lang, "crmr.records", "Records"), value: String(recs.length) }],
        totalsRow: {
          amount: recs.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0),
          paidAmount: recs.reduce((s: number, r: any) => s + (Number(r.paidAmount) || 0), 0),
          remainingAmount: recs.reduce((s: number, r: any) => s + (Number(r.remainingAmount) || 0), 0),
        },
      });
    });
  };

  return (
    <div className={`space-y-6 p-4 md:p-8 font-sans ${isRtl ? "rtl" : "ltr"}`}>
      {/* Top Header Card with Universal Traceability */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                {t(lang, "crm.menu_reports", "CRM Universal Reports & Due Center")}
              </h1>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                {t(lang, "crmr.enterprise_live", "Enterprise Live")}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-1">
              {t(lang, "crmr.subtitle", "Multi-Tier Scope Consolidated Reports • 100+ Countries • Universal Print & PDF Ready")}
            </p>
          </div>
        </div>

        {/* Global Serials Bar */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500">GS: <strong className="text-slate-800 dark:text-slate-200">GS-CRM-REP-01</strong></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">USER: <strong className="text-blue-600">{session.fullName || session.email || "SUPERADMIN"}</strong></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">SCOPE: <strong className="text-emerald-600">{session.isSuperAdmin ? "GLOBAL" : "BRANCH"}</strong></span>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
        {REPORT_TYPES.map((rt) => {
          const Icon = rt.icon;
          const active = reportType === rt.id;
          return (
            <button
              key={rt.id}
              onClick={() => setReportType(rt.id)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                active
                  ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600/20"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <Icon className={`h-4 w-4 mb-1.5 ${active ? "text-white" : "text-blue-600"}`} />
              <span className="text-[10px] font-bold leading-tight">
                {t(lang, rt.labelKey, rt.defaultLabel)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Filter className="h-3.5 w-3.5" />
            <span>{t(lang, "crm.filter_by_country", "Filter Scope:")}</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 text-xs font-semibold px-2 border rounded-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            placeholder={t(lang, "crmr.from_date", "From Date")}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 text-xs font-semibold px-2 border rounded-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            placeholder={t(lang, "crmr.to_date", "To Date")}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReport}
            className="h-8 text-xs font-bold gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t(lang, "crm.refresh", "Refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-8 text-xs font-bold gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {t(lang, "crm.btn_export_excel", "Export CSV")}
          </Button>
          <Button
            size="sm"
            onClick={handlePrintReport}
            className="h-8 text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Printer className="h-3.5 w-3.5" />
            {t(lang, "crm.btn_print", "Print / PDF")}
          </Button>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Records</span>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {data?.recordCount || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Value</span>
          <p className="text-2xl font-black text-blue-600 mt-1 font-mono">
            {Number(data?.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Settled / Paid</span>
          <p className="text-2xl font-black text-emerald-600 mt-1 font-mono">
            {Number(data?.totalPaid || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Outstanding Due</span>
          <p className="text-2xl font-black text-rose-600 mt-1 font-mono">
            {Number(data?.totalRemaining || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Main Universal Report Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-slate-800 dark:text-slate-200">
            <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-3 text-center w-12">#</th>
                <th className="px-3 py-3 text-left">{th("Serial / Ref")}</th>
                <th className="px-3 py-3 text-left">{th("Item Type")}</th>
                <th className="px-3 py-3 text-left">{th("Party / Customer")}</th>
                <th className="px-3 py-3 text-left">{th("Country / Branch")}</th>
                <th className="px-3 py-3 text-center">{th("Due Date")}</th>
                <th className="px-3 py-3 text-right">{th("Total Amount")}</th>
                <th className="px-3 py-3 text-right">{th("Paid")}</th>
                <th className="px-3 py-3 text-right">{th("Remaining")}</th>
                <th className="px-3 py-3 text-center">{th("Status")}</th>
                <th className="px-3 py-3 text-left">{th("Assigned User")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-bold">
                    {t(lang, "crmr.loading_records", "Loading universal CRM records...")}
                  </td>
                </tr>
              ) : !data?.records?.length ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-bold">
                    {t(lang, "crmr.no_records", "No CRM records found matching the selected filter criteria.")}
                  </td>
                </tr>
              ) : (
                data.records.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-2.5 text-center font-mono text-slate-400">{r.srNo}</td>
                    <td className="px-3 py-2.5 font-mono">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{r.referenceNo}</div>
                      <div className="text-[9px] text-slate-400">{r.globalSerial}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded font-bold text-[10px]">
                        {r.itemType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{r.partyName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.partyPhone}</div>
                    </td>
                    <td className="px-3 py-2.5 text-[11px]">
                      <div>{r.countryName}</div>
                      <div className="text-[9px] text-slate-400">{r.branchName}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {r.dueDate}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold">
                      {r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} {r.currency}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-600 font-bold">
                      {r.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-600 font-bold">
                      {r.remainingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        r.status === "Completed"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : r.urgency === "overdue"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-600 dark:text-slate-300">
                      {r.responsibleUser}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
