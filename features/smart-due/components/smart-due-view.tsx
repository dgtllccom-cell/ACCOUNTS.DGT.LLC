"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { DueItem } from "@/app/api/erp/smart-due/items/route";

type Summary = {
  total: number;
  overdue: number;
  dueToday: number;
  dueTomorrow: number;
  upcoming: number;
  pending: number;
};

type UrgencyClass = "all" | "overdue" | "due_today" | "due_tomorrow" | "upcoming" | "pending";
type ModuleType = "all" | "cheque" | "purchase" | "sales" | "shipping_bl" | "shipping_line" | "followup";

const URGENCY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  overdue: { bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700" },
  due_today: { bg: "bg-orange-50 dark:bg-orange-950", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  due_tomorrow: { bg: "bg-yellow-50 dark:bg-yellow-950", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-300 dark:border-yellow-700" },
  upcoming: { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700" },
  pending: { bg: "bg-gray-50 dark:bg-gray-900", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" },
  completed: { bg: "bg-green-50 dark:bg-green-950", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" },
};

function formatAmount(n: number, currency: string) {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + " " + currency;
}

function UrgencyBadge({ urgencyClass, lang }: { urgencyClass: string; lang: string }) {
  const colors = URGENCY_COLORS[urgencyClass] ?? URGENCY_COLORS.pending;
  const labelKey = `smart_due.urgency_${urgencyClass}` as never;
  const label = t(lang, labelKey, urgencyClass.replace(/_/g, " "));
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      {label}
    </span>
  );
}

function SummaryCard({ label, count, urgency, active, onClick }: { label: string; count: number; urgency: string; active: boolean; onClick: () => void }) {
  const colors = URGENCY_COLORS[urgency] ?? URGENCY_COLORS.pending;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all text-center min-w-[90px] ${
        active
          ? `${colors.bg} ${colors.border} shadow-md`
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-400"
      }`}
    >
      <span className={`text-2xl font-bold ${active ? colors.text : "text-gray-800 dark:text-gray-100"}`}>{count}</span>
      <span className={`text-xs mt-0.5 font-medium ${active ? colors.text : "text-gray-500 dark:text-gray-400"}`}>{label}</span>
    </button>
  );
}

export function SmartDueView() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const router = useRouter();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<DueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [urgency, setUrgency] = useState<UrgencyClass>("all");
  const [module, setModule] = useState<ModuleType>("all");
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/erp/smart-due/summary");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.data ?? data);
      }
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        urgency,
        module,
        lang,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/erp/smart-due/items?${params}`);
      if (res.ok) {
        const data = await res.json();
        const payload = data.data ?? data;
        setItems(payload.items ?? []);
        setTotal(payload.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [urgency, module, lang, page]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { setPage(1); }, [urgency, module]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleRowClick = (item: DueItem) => {
    if (item.sourceHref) router.push(item.sourceHref);
  };

  const urgencyOptions: { value: UrgencyClass; label: string }[] = [
    { value: "all", label: tt("smart_due.all_urgency", "All Urgency") },
    { value: "overdue", label: tt("smart_due.card_overdue", "Overdue") },
    { value: "due_today", label: tt("smart_due.card_due_today", "Due Today") },
    { value: "due_tomorrow", label: tt("smart_due.card_due_tomorrow", "Due Tomorrow") },
    { value: "upcoming", label: tt("smart_due.card_upcoming", "Upcoming") },
    { value: "pending", label: tt("smart_due.card_pending", "Pending") },
  ];

  const moduleOptions: { value: ModuleType; label: string }[] = [
    { value: "all", label: tt("smart_due.all_modules", "All Modules") },
    { value: "cheque", label: tt("smart_due.cheque", "Bank Cheque") },
    { value: "purchase", label: tt("smart_due.purchase", "Purchase Order") },
    { value: "sales", label: tt("smart_due.sales", "Sales Order") },
    { value: "shipping_bl", label: tt("smart_due.shipping_bl", "Shipping BL") },
    { value: "shipping_line", label: tt("smart_due.shipping_line", "Shipping Line") },
    { value: "followup", label: tt("smart_due.followup", "Follow-up") },
  ];

  const summaryCards = [
    { key: "overdue" as const, label: tt("smart_due.card_overdue", "Overdue"), urgency: "overdue" },
    { key: "dueToday" as const, label: tt("smart_due.card_due_today", "Due Today"), urgency: "due_today" },
    { key: "dueTomorrow" as const, label: tt("smart_due.card_due_tomorrow", "Due Tomorrow"), urgency: "due_tomorrow" },
    { key: "upcoming" as const, label: tt("smart_due.card_upcoming", "Upcoming"), urgency: "upcoming" },
    { key: "pending" as const, label: tt("smart_due.card_pending", "Pending"), urgency: "pending" },
  ];

  const totalActionable = summary ? summary.overdue + summary.dueToday + summary.dueTomorrow : 0;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="flex flex-col gap-4 p-4 min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{tt("smart_due.title", "Smart Due / Follow-up Control Center")}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{tt("smart_due.subtitle", "All pending, overdue, and upcoming items")}</p>
        </div>
        <button
          onClick={() => { fetchSummary(); fetchItems(); }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {tt("smart_due.refresh", "Refresh")}
        </button>
      </div>

      {/* Management alert */}
      {!summaryLoading && summary && totalActionable > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            {tt("smart_due.management_alert", "Management Summary")}: {totalActionable} {tt("smart_due.items_need_action", "items require action")}
            {summary.overdue > 0 && <span className="ms-2 font-bold">({summary.overdue} {tt("smart_due.card_overdue", "Overdue")})</span>}
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="flex flex-wrap gap-3">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.key}
            label={card.label}
            count={summary ? summary[card.key] : 0}
            urgency={card.urgency}
            active={urgency === card.urgency}
            onClick={() => setUrgency(urgency === card.urgency ? "all" : (card.urgency as UrgencyClass))}
          />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{tt("smart_due.filter_urgency", "Urgency")}</label>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as UrgencyClass)}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          >
            {urgencyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{tt("smart_due.filter_module", "Module")}</label>
          <select
            value={module}
            onChange={(e) => setModule(e.target.value as ModuleType)}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          >
            {moduleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                {[
                  ["smart_due.col_due_date", "Due Date"],
                  ["smart_due.filter_urgency", "Urgency"],
                  ["smart_due.col_module", "Module / Type"],
                  ["smart_due.col_reference", "Reference"],
                  ["smart_due.col_party", "Party"],
                  ["smart_due.col_country", "Country"],
                  ["smart_due.col_branch", "Branch"],
                  ["smart_due.col_total", "Total"],
                  ["smart_due.col_paid", "Paid"],
                  ["smart_due.col_remaining", "Remaining"],
                  ["smart_due.col_status", "Status"],
                  ["smart_due.col_user", "User"],
                  ["smart_due.col_remarks", "Remarks"],
                ].map(([key, fallback]) => (
                  <th key={key} className="px-3 py-2 text-start font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs uppercase tracking-wide">
                    {tt(key, fallback)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-gray-400 dark:text-gray-500">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="mt-2 text-sm">{tt("smart_due.loading", "Loading items...")}</div>
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm">
                    {tt("smart_due.no_items", "No items found.")}
                  </td>
                </tr>
              )}
              {!loading && items.map((item) => (
                <tr
                  key={`${item.sourceType}-${item.sourceId}`}
                  onClick={() => handleRowClick(item)}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300 font-mono text-xs">
                    {item.dueDate ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <UrgencyBadge urgencyClass={item.urgencyClass} lang={lang} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                    {tt(item.moduleLabelKey, item.sourceType)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {item.referenceNo || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[140px] truncate">
                    {item.partyName || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {item.countryName || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {item.branchName || "—"}
                  </td>
                  <td className="px-3 py-2 text-end font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {formatAmount(item.totalAmount, item.currency)}
                  </td>
                  <td className="px-3 py-2 text-end font-mono text-xs text-green-700 dark:text-green-400 whitespace-nowrap">
                    {item.paidAmount > 0 ? formatAmount(item.paidAmount, item.currency) : "—"}
                  </td>
                  <td className="px-3 py-2 text-end font-mono text-xs text-red-700 dark:text-red-400 whitespace-nowrap">
                    {item.remainingAmount > 0 ? formatAmount(item.remainingAmount, item.currency) : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap capitalize">
                    {item.status || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {item.responsibleUser || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-500 max-w-[160px] truncate text-xs">
                    {item.remarks || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {tt("smart_due.page", "Page")} {page} {tt("smart_due.of_pages", "of")} {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-300"
              >
                ‹
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-300"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
