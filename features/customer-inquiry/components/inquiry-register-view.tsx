"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  MessagesSquare, Plus, RefreshCw, Search, Eye, Printer, Sparkles, Mic,
  CalendarClock, Link2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";
import {
  INQUIRY_STATUS_ORDER, INQUIRY_SOURCES, fmtDate, statusTone,
  type InquiryListItem, type InquiryStatus,
} from "../lib/shared";
import { InquiryForm } from "./inquiry-form";
import { InquiryDetailModal } from "./inquiry-detail-modal";

type Scope = "all" | "mine" | "assigned" | "follow_up";

export function InquiryRegisterView({ scope = "all", lang: langProp }: { scope?: Scope; lang?: string }) {
  const s = useErpScreen("cinq", langProp);
  const [rows, setRows] = useState<InquiryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | InquiryStatus>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | string>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [setupPending, setSetupPending] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => { setPortalNode(document.getElementById("erp-page-actions-slot")); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ scope, lang: s.lang });
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (sourceFilter !== "all") qs.set("source", sourceFilter);
      if (search.trim()) qs.set("q", search.trim());
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/erp/customer-inquiries?${qs}`).then((r) => r.json()),
        fetch(`/api/erp/customer-inquiries/summary`).then((r) => r.json()),
      ]);
      if (listRes?.data?.setupPending || sumRes?.data?.setupPending) { setSetupPending(true); setRows([]); return; }
      setSetupPending(false);
      setRows(listRes?.data?.rows ?? []);
      setSummary(sumRes?.data?.summary ?? {});
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope, s.lang, statusFilter, sourceFilter, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const kpis = useMemo(() => ([
    { key: "total", label: s.t("kpi_total", "Total Inquiries"), value: summary.total ?? 0, tone: "text-slate-700" },
    { key: "in_progress", label: s.t("kpi_open", "In Progress"), value: (summary.in_progress ?? 0) + (summary.confirmed ?? 0), tone: "text-amber-600" },
    { key: "follow_up_overdue", label: s.t("kpi_overdue", "Follow-ups Overdue"), value: summary.follow_up_overdue ?? 0, tone: "text-rose-600" },
    { key: "customer_approved", label: s.t("kpi_approved", "Customer Approved"), value: summary.customer_approved ?? 0, tone: "text-emerald-600" },
    { key: "converted", label: s.t("kpi_converted", "Converted"), value: summary.converted ?? 0, tone: "text-teal-600" },
  ]), [summary, s]);

  function printRegister() {
    const columns: GenericReportColumn[] = [
      { key: "inquiry_no", label: s.t("col_no", "Inquiry #") },
      { key: "customer_name", label: s.t("f_customer_name", "Customer") },
      { key: "company_name", label: s.t("f_company", "Company") },
      { key: "mobile", label: s.t("f_mobile", "Mobile") },
      { key: "business_type", label: s.t("f_business_type", "Business Type") },
      { key: "source", label: s.t("f_source", "Source") },
      { key: "status", label: s.t("col_status", "Status"), format: "status" },
      { key: "inquiry_date", label: s.t("f_inquiry_date", "Inquiry Date"), format: "date" },
      { key: "follow_up_date", label: s.t("f_follow_up", "Follow-up"), format: "date" },
      { key: "assignee_name", label: s.t("f_assigned_to", "Assigned") },
    ];
    openScopedGenericReport({
      title: s.t("register_title", "Customer Inquiry Register"),
      lang: s.lang,
      columns,
      rows: rows.map((r) => ({ ...r, source: s.t(`source_${r.source}`, r.source), status: s.t(`status_${r.status}`, r.status) })),
      filters: [
        { label: s.t("col_status", "Status"), value: statusFilter === "all" ? s.t("all", "All") : s.t(`status_${statusFilter}`, statusFilter) },
        { label: s.t("f_source", "Source"), value: sourceFilter === "all" ? s.t("all", "All") : s.t(`source_${sourceFilter}`, sourceFilter) },
        { label: s.t("search", "Search"), value: search || "—" },
      ],
      summary: { total: rows.length },
    });
  }

  return (
    <div className="space-y-4" dir={s.dir}>
      {portalNode && createPortal(
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={printRegister}><Printer className="h-3.5 w-3.5" />{s.t("print", "Print / PDF")}</Button>
          <Button type="button" size="sm" className="h-8 gap-1" onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5" />{s.t("new_inquiry", "New Inquiry")}</Button>
        </div>,
        portalNode,
      )}

      {setupPending ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          {s.t("setup_pending", "Customer Inquiries is not set up on this database yet. Run the pending migration.")}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {kpis.map((k) => (
              <div key={k.key} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                <div className="text-[10px] font-bold uppercase text-slate-400">{k.label}</div>
                <div className={`mt-1 text-xl font-black ${k.tone}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* filters */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute start-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={s.t("search_ph", "Search customer, company, #, phone…")}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 ps-8 pe-2 py-1.5 text-xs" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs font-semibold">
              <option value="all">{s.t("all_status", "All Status")}</option>
              {INQUIRY_STATUS_ORDER.map((st) => <option key={st} value={st}>{s.t(`status_${st}`, st)}</option>)}
            </select>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs font-semibold">
              <option value="all">{s.t("all_source", "All Sources")}</option>
              {INQUIRY_SOURCES.map((src) => <option key={src} value={src}>{s.t(`source_${src}`, src.replace("_", " "))}</option>)}
            </select>
          </div>

          {/* table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_no", "Inquiry #")}</th>
                  <th className={`px-3 py-2 ${s.textStart}`}>{s.t("f_customer_name", "Customer")}</th>
                  <th className={`px-3 py-2 ${s.textStart}`}>{s.t("f_business_type", "Business Type")}</th>
                  <th className={`px-3 py-2 ${s.textStart}`}>{s.t("f_source", "Source")}</th>
                  <th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_status", "Status")}</th>
                  <th className={`px-3 py-2 ${s.textStart}`}>{s.t("f_follow_up", "Follow-up")}</th>
                  <th className={`px-3 py-2 ${s.textStart}`}>{s.t("f_assigned_to", "Assigned")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">{s.t("loading", "Loading…")}</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">{s.t("empty", "No inquiries found.")}</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => setOpenId(r.id)}>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{r.inquiry_no}</td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                        {r.entry_mode === "ai_voice" && <Mic className="h-3 w-3 text-violet-500" />}
                        {r.entry_mode === "ai_text" && <Sparkles className="h-3 w-3 text-violet-500" />}
                        {r.customer_name}
                        {r.customer_id && <Link2 className="h-3 w-3 text-emerald-500" />}
                      </div>
                      {r.company_name && <div className="text-[10.5px] text-slate-400">{r.company_name}</div>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.business_type || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{s.t(`source_${r.source}`, r.source)}</td>
                    <td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(r.status)}`}>{s.t(`status_${r.status}`, r.status)}</span></td>
                    <td className={`px-3 py-2 ${r.follow_up_overdue ? "text-rose-600 font-bold" : "text-slate-500"}`}>
                      {r.follow_up_date ? <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtDate(r.follow_up_date)}</span> : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.assignee_name || "—"}</td>
                    <td className="px-3 py-2 text-end"><Eye className="inline h-3.5 w-3.5 text-slate-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && portalNode && createPortal(
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
              <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5"><MessagesSquare className="h-4 w-4 text-blue-500" />{s.t("new_inquiry", "New Inquiry")}</span>
              <button type="button" onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4">
              <InquiryForm
                lang={s.lang}
                onCancel={() => setShowForm(false)}
                onSaved={(id) => { setShowForm(false); void load(); setOpenId(id); }}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}

      {openId && <InquiryDetailModal inquiryId={openId} lang={s.lang} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
    </div>
  );
}
