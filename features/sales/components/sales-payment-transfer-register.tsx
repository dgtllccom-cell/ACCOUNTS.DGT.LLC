"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { t } from "@/lib/i18n/ui";
import { printDomFragmentViaModal } from "@/lib/reports/print-dom-fragment";
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
    ["Brand", item.brand], ["Lot Number", item.stockLotNo || item.lotNo],
    ["Quantity", number(item.qtyNo ?? item.quantity, item.qtyName || item.unit)],
    ["Gross Weight", number(item.grossWeight, "kg")], ["Net Weight", number(item.netWeight, "kg")],
    ["Purchase Rate", number(item.purchaseRate ?? item.lotUnitCost, purchaseCurrency)],
    ["Total Purchase Amount", number(item.totalPurchaseAmount ?? item.purchaseAmount, purchaseCurrency)],
    ["Sales Rate", number(item.coursePrice ?? item.unitPrice, item.salesCurrency || originalCurrency)],
    ["Total Sales Amount", number(item.totalAmount ?? report.originalAmount, item.salesCurrency || originalCurrency)],
    ["Exchange Rate", report.rate == null ? dash : `${report.operator === "/" ? "÷" : "×"} ${number(report.rate)}`],
    ["Final Currency", finalCurrency], ["Final Transfer Amount", number(report.finalAmount, finalCurrency)],
    ["Payment Condition", report.condition], ["Payment Method", report.method],
    ["Advance Payment Received", number(report.advance, finalCurrency)], ["Total Payment Received", number(report.received, finalCurrency)],
    ["Remaining Receivable Balance", number(report.remaining, finalCurrency)],
    ["Debit Reference", trace.debitLedgerId], ["Credit Reference", trace.creditLedgerId],
    ["Business Ledger Reference", trace.voucherNo], ["Business Roznamcha Reference", trace.journalNo || trace.roznamchaEntryId],
    ["Transfer Status", order.ledger_posting_status],
  ] as [string, string | null | undefined][];
}

const labelClass = "whitespace-nowrap border-b bg-slate-50 p-2 text-start dark:bg-slate-900";
const cellClass = "max-w-64 border-b p-2 align-top";
const buttonClass = "rounded border px-3 py-2 text-sm font-semibold disabled:opacity-50";
const scopePosted = (order: Row) => ["posted", "transferred"].includes(String(order.ledger_posting_status || "").toLowerCase());

export function SalesPaymentTransferRegister({ orderId }: { orderId?: string }) {
  const lang = useActiveLanguage();
  const tr = (label: string) => translateHeader(lang, label);
  const title = tr("Sales Payment Transfer");
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<{ key: string; orders: Row[]; payments?: Row[]; error?: boolean; more?: boolean }>();
  const key = `${lang}:${orderId || page}`;
  useEffect(() => {
    let current = true;
    const get = async () => {
      try {
        if (orderId) {
          const endpoint = `/api/erp/sales/orders/${encodeURIComponent(orderId)}`;
          const { order } = await apiGet<{ order: Row }>(endpoint);
          if (!scopePosted(order)) throw new Error("Transfer not found");
          const receipt = await apiGet<{ payments: Row[]; limit?: number }>(`${endpoint}/payments?lang=${lang}`).catch(() => undefined);
          if (current) setResults({ key, orders: [order], payments: receipt && (!receipt.limit || receipt.payments.length < receipt.limit) ? receipt.payments : undefined });
        } else {
          const { salesOrders } = await apiGet<{ salesOrders: Row[] }>(
            `/api/erp/sales/orders?transferred=1&limit=${pageSize + 1}&offset=${page * pageSize}&lang=${lang}`);
          if (current) setResults({ key, orders: salesOrders.slice(0, pageSize).filter(scopePosted), more: salesOrders.length > pageSize });
        }
      } catch { if (current) setResults({ key, orders: [], error: true }); }
    };
    void get();
    return () => { current = false; };
  }, [key, lang, orderId, page]);

  const current = results?.key === key ? results : undefined;
  const cellText = (label: string, value: string | null | undefined) => {
    const color = label.startsWith("Debit") ? "text-green-700 dark:text-green-400" : label.startsWith("Credit") ? "text-red-700 dark:text-red-400" : "";
    return <bdi className={color}>{value || dash}</bdi>;
  };
  if (!current || current.error || !current.orders.length) return <section className="space-y-3">
    {orderId && <Link href={path} className={buttonClass}>{tr("Back")}</Link>}
    <h1 className="text-xl font-bold">{title}</h1>
    <p role={current?.error ? "alert" : "status"}>{!current ? tr("Loading") : current.error ? tr("Failed to load") : tr("No records found")}</p>
    {!orderId && page > 0 && <button type="button" className={buttonClass} onClick={() => setPage(page - 1)}>{tr("Previous")}</button>}
  </section>;

  if (orderId) {
    const order = current.orders[0];
    const report = salesPaymentTransferReport(order, current.payments);
    const fields = cells(order, report.items[0], report, lang);
    const itemLabels = new Set(fields.slice(4, 17).filter(([label]) => label !== "Sales Customer and Account").map(([label]) => label));
    return <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Link href={path} className={buttonClass}>{tr("Back")}</Link>
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

  const headings = cells(current.orders[0], {}, salesPaymentTransferReport(current.orders[0]), lang).map(([label]) => label);
  return <section className="space-y-3">
    <h1 className="text-xl font-bold">{title}</h1>
    <div className="overflow-x-auto rounded border">
      <table className="w-full border-collapse text-xs">
        <thead><tr>{[...headings, "View"].map(label => <th scope="col" key={label} className={labelClass}>{tr(label)}</th>)}</tr></thead>
        <tbody>{current.orders.flatMap(order => {
          const report = salesPaymentTransferReport(order);
          return report.items.map((item, index) => <tr key={`${order.id}-${index}`}>
            {cells(order, item, report, lang).map(([label, value]) => <td key={label} className={cellClass}>{cellText(label, value)}</td>)}
            <td className={cellClass}><Link className="font-bold text-blue-700 underline dark:text-blue-400" href={`${path}/view?id=${encodeURIComponent(order.id)}&transfer=1`}>{t(lang, "common.view", "View")}</Link></td>
          </tr>);
        })}</tbody>
      </table>
    </div>
    <div className="flex gap-2">
      <button type="button" className={buttonClass} disabled={page === 0} onClick={() => setPage(page - 1)}>{tr("Previous")}</button>
      <button type="button" className={buttonClass} disabled={!current.more} onClick={() => setPage(page + 1)}>{tr("Next")}</button>
    </div>
  </section>;
}
