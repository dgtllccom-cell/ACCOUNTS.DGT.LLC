"use client";

import React from "react";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { finalPaymentReconciliation } from "@/lib/journal/final-payment-reconciliation";
import type { RemainingDueBill } from "@/lib/journal/remaining-loading-entry";

type Row = Record<string, any>;
type Source = "all" | "purchase_booking" | "local_purchase";
export function FinalPaymentReconciliation({ rows, dueBills, ready, error, sourceFilter, onSourceChange, lang, onOpenFullBill, onPrintStatement }: {
  rows: Row[]; dueBills: RemainingDueBill[]; ready: boolean; error?: string; sourceFilter: Source;
  onSourceChange: (source: Source) => void; lang: string;
  onOpenFullBill: (row: Row) => void; onPrintStatement: (row: Row) => void;
}) {
  const tr = (key: string, fallback: string) => t(lang as any, key, fallback);
  const label = (text: string) => translateHeader(lang, text);
  const fmt = (value: unknown) => Number(value || 0).toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dueMap = new Map(dueBills.map(bill => [String(bill.id), bill]));
  const unique = [...new Map(rows.map(row => [`${row.order_type}:${row.id}`, row])).values()];
  const summaries = unique.map(row => ({ row, report: finalPaymentReconciliation(row, dueMap.get(String(row.id))) }))
    .filter(({ report }) => sourceFilter === "all" || (sourceFilter === "local_purchase" ? report.local : !report.local));
  const completed = summaries.filter(({ report }) => report.completed.length > 0);
  const cell = "px-3 py-2 whitespace-nowrap border-b border-slate-200 dark:border-slate-700";
  return <section className="mx-3 md:mx-6 mb-6 space-y-4 text-xs">
    <div className="flex flex-wrap gap-2" aria-label={label("Source")}>
      {(["all", "purchase_booking", "local_purchase"] as Source[]).map(source => <button key={source} type="button" aria-pressed={source === sourceFilter} onClick={() => onSourceChange(source)} className={`rounded border px-3 py-2 ${source === sourceFilter ? "bg-blue-800 text-white" : "bg-white text-slate-900"}`}>
        {label(source === "all" ? "All Sources" : source === "purchase_booking" ? "Purchase Booking" : "Local Purchase")}
      </button>)}
    </div>
    <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
      <table className="w-full text-start"><thead className="bg-amber-100 text-slate-900"><tr>
        {[label("Bill No."), label("Date"), label("Supplier"), label("Branch"), label("Currency"), tr("rdue.col_bill_total", "Bill Total"), tr("ppe.f_advance_paid", "Total Advance Paid"), `${tr("ppe.kind_advance", "Advance")} · ${tr("ppe.f_balance", "Balance")}`, tr("ppe.f_remaining_paid", "Total Remaining Paid"), tr("ppe.f_total_paid", "Total Paid"), tr("ppe.f_balance", "Balance"), label("Status"), label("Actions")].map((title, i) => <th className={cell + " text-start"} key={i}>{title}</th>)}
      </tr></thead><tbody>{summaries.map(({ row, report: r }) => <tr key={`${r.local}:${r.id}`}>
        <td className={cell}><button type="button" className="text-blue-700 underline" onClick={() => onOpenFullBill(row)}>{r.billNo}</button></td>
        <td className={cell}>{r.date}</td><td className={cell}>{r.supplier}</td><td className={cell}>{r.branch}</td><td className={cell}>{r.currency}</td>
        {[r.total, r.advancePaid, r.afterAdvance, r.remainingPaid, r.totalPaid, r.outstanding].map((amount, i) => <td className={cell + " text-end tabular-nums"} key={i}>{fmt(amount)}</td>)}
        <td className={cell}>{r.outstanding <= 0.05 && r.total > 0 ? tr("rdue.status_paid", "Paid in full") : label(r.totalPaid > 0 ? "Partially Paid" : "Open")}</td>
        <td className={cell}><button type="button" disabled={!ready || !!error} className="underline disabled:opacity-50" onClick={() => onPrintStatement(row)}>{label("Print")} / PDF</button></td>
      </tr>)}</tbody></table>
    </div>
    <div className="rounded-xl border bg-white p-3 dark:bg-slate-900">
      <h2 className="mb-3 font-bold">{tr("plr.history_title", "Loading History")} · {tr("rdue.status_paid", "Paid in full")}</h2>
      {error ? <p role="alert">{error}</p> : !ready ? <p role="status">{tr("common.loading", "Loading...")}</p> : <>
        <p className="mb-2 tabular-nums">{tr("rdue.col_container", "Container")}: {completed.reduce((sum, item) => sum + item.report.completed.length, 0)}</p>
        {completed.map(({ row, report: r }) => <details key={r.id} open className="mb-3 rounded border p-2">
          <summary className="cursor-pointer font-semibold">{r.billNo} ({r.completed.length}) · {r.supplier} · {r.currency}</summary>
          <div className="overflow-x-auto"><table className="mt-2 w-full text-start"><thead><tr>
            {[tr("rdue.col_loading_no", "Loading No."), tr("rdue.col_container", "Container"), label("Quantity"), tr("rdue.col_value", "Value"), tr("rdue.col_adv_alloc", "Advance Allocated"), tr("ppe.f_remaining_paid", "Total Remaining Paid"), tr("ppe.f_balance", "Balance")].map((title, i) => <th className={cell + " text-start"} key={i}>{title}</th>)}
          </tr></thead><tbody>{r.completed.map(entry => <tr key={entry.id}>
            <td className={cell}>{entry.loadingNo || entry.id}</td><td className={cell}>{entry.container || "—"}</td>
            {[entry.quantity, entry.value, entry.advanceAllocated, entry.paid, entry.outstanding].map((value, i) => <td key={i} className={cell + " text-end tabular-nums"}>{fmt(value)}</td>)}
          </tr>)}</tbody></table></div>
          <button type="button" className="mt-2 underline" onClick={() => onOpenFullBill(row)}>{label("View Full Bill")}</button>
        </details>)}
      </>}
    </div>
  </section>;
}
