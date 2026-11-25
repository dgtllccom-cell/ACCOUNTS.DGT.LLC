"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Receipt, Search } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { t } from "@/lib/i18n/ui";
import { printDomFragmentViaModal } from "@/lib/reports/print-dom-fragment";
import { resolveSalesBookingPaymentRoute } from "@/lib/services/sales-booking-routing";
import { salesPaymentTransferReport } from "@/lib/sales/payment-transfer-report";

type Row = Record<string, any>;
const path = "/dashboard/sales/sales-order";
const pageSize = 40;
const dash = "—";

function cells(order: Row, item: Row, report: ReturnType<typeof salesPaymentTransferReport>, lang: string) {
  const number = (value: unknown, currency?: string) =>
    value == null || value === "" || !Number.isFinite(Number(value)) ? dash
      : [Number(value).toLocaleString(lang, { maximumFractionDigits: 4 }), currency].filter(Boolean).join(" ");
  const account = (...value: unknown[]) => value.filter(Boolean).join(" · ") || dash;
  const { form, trace, originalCurrency, finalCurrency } = report;
  const purchaseCurrency = item.lotCostCurrency || item.purchaseCurrency;
  return [
    ["Serial Number", order.super_admin_serial_number],
    ["Transfer Number", trace.voucherNo || report.reference],
    ["Transfer Date", report.transferredAt?.slice(0, 10)],
    ["Sales Booking Number", order.sales_order_no],
    ["Original Purchase Reference", item.purchaseReference || item.purchaseBookingNo || item.lotPurchaseId || order.purchase_order_id],
    ["Original Purchase Supplier and Account", account(item.purchaseAccountName, item.purchaseAccountNo)],
    ["Sales Customer and Account", account(order.customer_name || form.customerAccountName, form.customerAccountNo || order.account_number)],
    ["Sales Item", item.goodsName || item.productName || order.product_summary],
    ["Brand", item.brand], ["Lot Name", item.lotName || item.allotName], ["Lot Number", item.stockLotNo || item.lotNo || item.lotRef],
    ["Quantity", number(item.qtyNo ?? item.quantity, item.qtyName || item.unit)],
    ["Gross Weight", number(item.grossWeight, "kg")], ["Net Weight", number(item.netWeight, "kg")],
    ["Purchase Rate", number(item.purchaseRate ?? item.lotUnitCost, purchaseCurrency)],
    ["Total Purchase Amount", number(item.totalPurchaseAmount ?? item.purchaseAmount, purchaseCurrency)],
    ["Sales Rate", number(item.coursePrice ?? item.unitPrice, item.salesCurrency || originalCurrency)],
    ["Total Sales Amount", number(item.totalAmount ?? report.originalAmount, item.salesCurrency || originalCurrency)],
    ["Exchange Rate", report.rate == null ? dash : `${report.operator === "/" ? "÷" : "×"} ${number(report.rate)}`],
    ["Final Currency", finalCurrency], ["Final Transfer Amount", number(report.finalAmount, finalCurrency)],
    ["Payment Condition", translateHeader(lang, report.condition)], ["Payment Method", translateHeader(lang, report.method)],
    ["Advance Payment Received", number(report.advance, finalCurrency)], ["Total Payment Received", number(report.received, finalCurrency)],
    ["Remaining Receivable Balance", number(report.remaining, finalCurrency)],
    ["Debit Reference", trace.debitLedgerCode || trace.debitLedgerId], ["Credit Reference", trace.creditLedgerCode || trace.creditLedgerId],
    ["Business Ledger Reference", trace.voucherNo], ["Business Roznamcha Reference", trace.journalNo || trace.roznamchaEntryId],
    ["Transfer Status", translateHeader(lang, order.ledger_posting_status || "")],
  ] as [string, string | null | undefined][];
}

const labelClass = "whitespace-nowrap border-b border-e border-slate-200 bg-slate-100 px-2 py-2.5 text-start dark:border-slate-700 dark:bg-slate-800";
const cellClass = "max-w-64 border-b border-e border-slate-200 px-2 py-2.5 align-top dark:border-slate-700";
const buttonClass = "rounded border px-3 py-2 text-sm font-semibold disabled:opacity-50";
const headerButton = "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800";
const scopePosted = (order: Row) => ["posted", "transferred"].includes(String(order.ledger_posting_status || "").toLowerCase());

type RegisterField = { key: string; caption?: string };
const field = (key: string, caption?: string): RegisterField => ({ key, caption });
const registerColumns = [
  { labels: ["Sales Booking Number", "Serial Number"], width: "9%", fields: [field("Sales Booking Number"), field("Serial Number")] },
  { labels: ["Transfer Number", "Transfer Date"], width: "8%", fields: [field("Transfer Number"), field("Transfer Date")] },
  { labels: ["Original Purchase Reference", "Supplier / Account"], width: "9%", fields: [field("Original Purchase Reference"), field("Original Purchase Supplier and Account")] },
  { labels: ["Sales Customer and Account"], width: "9%", fields: [field("Sales Customer"), field("Customer Account")] },
  { labels: ["Goods Name", "Brand"], width: "9%", fields: [field("Sales Item"), field("Brand")] },
  { labels: ["Lot Name", "Lot Number"], width: "7%", fields: [field("Lot Name"), field("Lot Number")] },
  { labels: ["Quantity", "Unit"], width: "6%", fields: [field("Quantity"), field("Quantity Unit")] },
  { labels: ["Gross Weight", "Net Weight"], width: "7%", fields: [field("Gross Weight", "Gross"), field("Net Weight", "Net")] },
  { labels: ["Purchase Rate", "Sales Rate"], width: "9%", fields: [field("Purchase Rate", "Purchase"), field("Total Purchase Amount", "Amount"), field("Sales Rate", "Sales"), field("Total Sales Amount", "Amount")] },
  { labels: ["Exchange Rate", "Final Transfer Amount"], width: "8%", fields: [field("Exchange Rate"), field("Final Transfer Amount"), field("Final Currency")] },
  { labels: ["Payment Condition", "Receipts / Balance"], width: "10%", fields: [field("Payment Condition"), field("Payment Method"), field("Advance Payment Received", "Advance"), field("Total Payment Received", "Received"), field("Remaining Receivable Balance", "Balance")] },
  { labels: ["Transfer", "DR / CR"], width: "9%", fields: [field("Transfer OK"), field("Debit Reference", "DR"), field("Credit Reference", "CR")] },
] as const;

const transferSearchFields = [
  ["all", "All Fields"], ["booking", "Sales Booking Number"], ["transfer", "Transfer Number"],
  ["customer", "Sales Customer and Account"], ["goods", "Goods Name"], ["lot", "Lot Name / Number"],
] as const;
type TransferSearchField = (typeof transferSearchFields)[number][0];

const compactHeading = "border-b border-e border-slate-200 bg-slate-100 px-2 py-2.5 text-start align-top text-[11px] leading-tight dark:border-slate-700 dark:bg-slate-800";
const compactCell = "break-words border-b border-e border-slate-200 px-2 py-2.5 align-top leading-snug dark:border-slate-700";

const pageStats = [
  ["finalAmount", "Final Transfer Amount"],
  ["received", "Total Payment Received"],
  ["remaining", "Remaining Receivable Balance"],
] as const;

function TransferPageSummary({ orders, lang }: { orders: Row[]; lang: string }) {
  const groups = new Map<string, Record<(typeof pageStats)[number][0], number | null>>();
  for (const order of orders) {
    const report = salesPaymentTransferReport(order);
    if (!report.finalCurrency) continue;
    const totals = groups.get(report.finalCurrency) ?? { finalAmount: 0, received: 0, remaining: 0 };
    for (const [key] of pageStats) {
      const value = report[key];
      // A missing receipt figure is unknown rather than zero. Do not display a partial total as final.
      totals[key] = value == null || totals[key] == null ? null : (totals[key] as number) + value;
    }
    groups.set(report.finalCurrency, totals);
  }
  return <section aria-label={translateHeader(lang, "Transfers on this page")} className="space-y-2">
    <p className="text-xs text-slate-600 dark:text-slate-300">{translateHeader(lang, "Transfers on this page")}: <bdi className="font-semibold">{orders.length.toLocaleString(lang)}</bdi></p>
    <dl className="grid gap-2 sm:grid-cols-3">
      {pageStats.map(([key, label]) => <div key={key} className="rounded-lg border bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <dt className="text-xs font-semibold text-slate-600 dark:text-slate-300">{translateHeader(lang, label)}</dt>
        <dd className="mt-1 flex flex-wrap gap-x-3 font-bold tabular-nums">
          {groups.size ? [...groups].sort(([left], [right]) => left.localeCompare(right)).map(([code, amounts]) => <bdi key={code}>{amounts[key]?.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? dash} {code}</bdi>) : dash}
        </dd>
      </div>)}
    </dl>
  </section>;
}

export function SalesPaymentTransferRegister({ orderId }: { orderId?: string }) {
  const lang = useActiveLanguage();
  const tr = (label: string) => translateHeader(lang, label);
  const title = tr("Sales Payment Transfer");
  const [page, setPage] = useState(0);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftField, setDraftField] = useState<TransferSearchField>("all");
  const [searchField, setSearchField] = useState<TransferSearchField>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ key: string; orders: Row[]; payments?: Row[]; error?: boolean; more?: boolean }>();
  const key = JSON.stringify([lang, orderId || null, page, search, searchField]);
  useEffect(() => {
    let current = true;
    const get = async () => {
      try {
        if (orderId) {
          const endpoint = `/api/erp/sales/orders/${encodeURIComponent(orderId)}`;
          const { order } = await apiGet<{ order: Row }>(`${endpoint}?transfer=1`);
          if (!scopePosted(order)) throw new Error("Transfer not found");
          const receipt = await apiGet<{ payments: Row[]; limit?: number }>(`${endpoint}/payments?lang=${lang}`).catch(() => undefined);
          if (current) setResults({ key, orders: [order], payments: receipt && (!receipt.limit || receipt.payments.length < receipt.limit) ? receipt.payments : undefined });
        } else {
          const { salesOrders } = await apiGet<{ salesOrders: Row[] }>(
            `/api/erp/sales/orders?transferred=1&limit=${pageSize + 1}&offset=${page * pageSize}&lang=${lang}${search ? `&q=${encodeURIComponent(search)}&searchField=${searchField}` : ""}`);
          if (current) setResults({ key, orders: salesOrders.slice(0, pageSize).filter(scopePosted), more: salesOrders.length > pageSize });
        }
      } catch { if (current) setResults({ key, orders: [], error: true }); }
    };
    void get();
    return () => { current = false; };
  }, [key, lang, orderId, page, search, searchField]);
  useEffect(() => {
    if (!searchOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSearchOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [searchOpen]);

  const current = results?.key === key ? results : undefined;
  const cellText = (label: string, value: string | null | undefined) => {
    if ((label === "Transfer Status" || label === "Transfer OK") && value) return <bdi className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{value}</bdi>;
    const color = label.startsWith("Debit") ? "text-green-700 dark:text-green-400" : label.startsWith("Credit") ? "text-red-700 dark:text-red-400" : "";
    return <bdi className={color}>{value || dash}</bdi>;
  };
  const searchTitle = t(lang, "sales_loading.filter");
  const searchPopup = !orderId && searchOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
    <div role="dialog" aria-modal="true" aria-label={searchTitle} className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto rounded-xl bg-white p-4 shadow-xl dark:bg-slate-950">
      <div className="flex items-center justify-between border-b pb-2 dark:border-slate-700"><h2 className="font-bold">{searchTitle}</h2><button type="button" className={headerButton} onClick={() => setSearchOpen(false)}>{t(lang, "common.close")}</button></div>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); setPage(0); setSearch(draftSearch.trim()); setSearchField(draftField); setSearchOpen(false); }}>
        <label className="grid gap-1 text-sm font-medium">{tr("Search By")}
          <select className="rounded-md border bg-transparent p-2" value={draftField} onChange={event => setDraftField(event.target.value as TransferSearchField)}>
            {transferSearchFields.map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">{t(lang, "common.search_query")}
          <input autoFocus className="rounded-md border bg-transparent p-2" maxLength={120} value={draftSearch} onChange={event => setDraftSearch(event.target.value)} placeholder={tr(transferSearchFields.find(([value]) => value === draftField)?.[1] ?? "All Fields")} />
        </label>
        <div className="flex justify-end gap-2"><button type="button" className={headerButton} onClick={() => { setDraftSearch(""); setDraftField("all"); }}>{t(lang, "sales_loading.reset")}</button>
          <button type="submit" className="min-h-9 rounded-full bg-blue-700 px-4 text-xs font-semibold text-white">{t(lang, "sales_loading.apply")}</button></div>
      </form>
    </div>
  </div>;
  const registerHeader = <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <Link className={headerButton} href="/dashboard/sales/new-sales-booking-order"><ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />{tr("Back")}</Link>
    <h1 className="me-auto flex items-center gap-2 text-base font-extrabold text-blue-800 dark:text-blue-300"><Receipt aria-hidden="true" className="h-5 w-5" />{title}</h1>
    <button type="button" aria-haspopup="dialog" aria-expanded={searchOpen} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-blue-700 px-4 text-xs font-semibold text-white" onClick={() => { setDraftSearch(search); setDraftField(searchField); setSearchOpen(true); }}><Search aria-hidden="true" className="h-4 w-4" />{searchTitle}{search && <span className="rounded-full bg-white/20 px-1.5" aria-hidden="true">1</span>}</button>
  </div>;

  if (!current || current.error || !current.orders.length) return <section className="space-y-3">
    {orderId ? <><Link href={path} className={buttonClass}>{tr("Back")}</Link><h1 className="text-xl font-bold">{title}</h1></> : registerHeader}
    {searchPopup}
    <p role={current?.error ? "alert" : "status"}>{!current ? tr("Loading") : current.error ? tr("Failed to load") : tr("No records found")}</p>
    {!orderId && page > 0 && <button type="button" className={buttonClass} onClick={() => setPage(page - 1)}>{tr("Previous")}</button>}
  </section>;

  if (orderId) {
    const order = current.orders[0];
    const report = salesPaymentTransferReport(order, current.payments);
    const fields = cells(order, report.items[0], report, lang);
    const paymentTarget = resolveSalesBookingPaymentRoute(
      report.advance != null && report.advance > 0 ? "remaining" : report.trace.paymentKind || report.form.paymentType
    );
    const itemLabels = new Set(fields.slice(4, 18).filter(([label]) => label !== "Sales Customer and Account").map(([label]) => label));
    return <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Link href={path} className={buttonClass}>{tr("Back")}</Link>
        {report.remaining != null && report.remaining > 0 && order.sales_order_no && (
          <Link className={buttonClass} href={`${paymentTarget.path}?salesOrderNo=${encodeURIComponent(order.sales_order_no)}`}>{tr("Post Payment Entry")}</Link>
        )}
        <button type="button" className={buttonClass} onClick={() => printDomFragmentViaModal("sales-payment-transfer-document", title, { lang, orientation: "landscape" })}>{tr("Print")} / PDF</button>
      </div>
      <article id="sales-payment-transfer-document" className="space-y-3 rounded border p-4">
        <h1 className="text-xl font-bold">{title} · <bdi>{order.sales_order_no}</bdi></h1>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {fields.filter(([label]) => !itemLabels.has(label)).map(([label, value]) => <div key={label} className="rounded border p-2 text-sm">
            <dt>{tr(label)}</dt><dd className="break-words font-semibold">{cellText(label, value)}</dd>
          </div>)}
        </dl>
        <h2 className="font-bold">{tr("Sales Details")}</h2>
        <div className="overflow-x-auto"><table className="w-full border-collapse text-xs">
          <thead><tr>{[...itemLabels].map(label => <th key={label} className={labelClass}>{tr(label)}</th>)}</tr></thead>
          <tbody>{report.items.map((item, index) => <tr key={index}>
            {cells(order, item, report, lang).filter(([label]) => itemLabels.has(label)).map(([label, value]) => <td key={label} className={cellClass}>{cellText(label, value)}</td>)}
          </tr>)}</tbody>
        </table></div>
        {Array.isArray(report.trace.lines) && <div className="grid gap-2 sm:grid-cols-2">
          {report.trace.lines.map((line: Row) => {
            const debit = Number(line.debit) > 0;
            return <div key={line.ledgerId} className={`rounded border p-2 ${debit ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
              <strong>{tr(debit ? "Debit" : "Credit")}</strong> · <bdi>{debit ? line.debit : line.credit} {line.currency}</bdi><br />
              <bdi>{line.ledgerId}</bdi>
            </div>;
          })}
        </div>}
      </article>
    </section>;
  }

  return <section className="space-y-3">
    {registerHeader}
    <TransferPageSummary orders={current.orders} lang={lang} />
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 bg-gradient-to-r from-blue-700 to-blue-800 px-3 py-2.5 text-sm font-bold text-white"><FileText aria-hidden="true" className="h-5 w-5" />{tr("Sales Transfer Register")}</h2>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[1060px] table-fixed border-collapse text-xs">
        <colgroup>{registerColumns.map(({ labels, width }) => <col key={labels[0]} style={{ width }} />)}</colgroup>
        <thead><tr>{registerColumns.map(({ labels }) => <th scope="col" key={labels[0]} className={compactHeading}>
          {labels.map((label, index) => <span className={`block ${index ? "font-medium text-slate-600 dark:text-slate-300" : "font-bold"}`} key={label}>{tr(label)}</span>)}
        </th>)}</tr></thead>
        <tbody>{current.orders.flatMap(order => {
          const report = salesPaymentTransferReport(order);
          return report.items.map((item, index) => {
            const values = new Map(cells(order, item, report, lang));
            const qty = item.qtyNo ?? item.quantity;
            const unit = item.qtyName || item.unit;
            if (qty != null && qty !== "" && Number.isFinite(Number(qty))) values.set("Quantity", Number(qty).toLocaleString(lang, { maximumFractionDigits: 6 }));
            values.set("Quantity Unit", unit);
            values.set("Sales Customer", order.customer_name || report.form.customerAccountName);
            values.set("Customer Account", report.form.customerAccountNo || order.account_number);
            values.set("Transfer OK", scopePosted(order) ? tr("Transfer OK") : undefined);
            values.set("Debit Reference", report.trace.debitSerialNumber || values.get("Debit Reference"));
            values.set("Credit Reference", report.trace.creditSerialNumber || values.get("Credit Reference"));
            return <tr key={`${order.id}-${index}`} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-950">
              {registerColumns.map(({ labels, fields }) => <td key={labels[0]} className={compactCell}>
                <div className={labels[0] === "Lot Name" ? "rounded border border-blue-100 bg-blue-50 px-1.5 py-1 dark:border-blue-900 dark:bg-blue-950" : undefined}>
                {fields.map(({ key, caption }, position) => {
                  const value = values.get(key);
                  const isReference = key === "Sales Booking Number" || key === "Transfer Number";
                  return <div key={key} className={`mb-0.5 last:mb-0 ${isReference ? "font-bold text-blue-700 dark:text-blue-300" : position === 0 ? "font-semibold" : "text-slate-600 dark:text-slate-300"}`}>
                    {caption && <span className="me-1 text-[10px] font-medium">{tr(caption)}:</span>}{cellText(key, value)}
                  </div>;
                })}
                </div>
                {labels[0] === "Transfer" && <Link className="mt-1 inline-block font-bold text-blue-700 underline dark:text-blue-400" href={`${path}/view?id=${encodeURIComponent(order.id)}&transfer=1`}>{t(lang, "common.view", "View")}</Link>}
              </td>)}
            </tr>;
          });
        })}</tbody>
      </table>
      </div>
    </section>
    <div className="flex gap-2">
      <button type="button" className={buttonClass} disabled={page === 0} onClick={() => setPage(page - 1)}>{tr("Previous")}</button>
      <button type="button" className={buttonClass} disabled={!current.more} onClick={() => setPage(page + 1)}>{tr("Next")}</button>
    </div>
    {searchPopup}
  </section>;
}
