"use client";

import { openGenericErpReport } from "@/lib/reports/open-generic-erp-report";
import { t } from "@/lib/i18n/ui";
import { localizeUom } from "@/lib/i18n/uom";
import { escapeHtml } from "@/lib/reports/erp-report-template-builder";
import type { ConsignmentReport } from "@/lib/consignment/types";

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v: unknown, ccy: string) =>
  `${ccy} ${n(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Consignment "Complete Report" → Print Preview / PDF via the shared Universal Print engine.
 * Main table = per-goods stock position; containers / expenses / sales / receipts are
 * rendered as break-inside-avoid sub-tables in the footer notes. Five-language + RTL are
 * handled by openGenericErpReport (lang drives dir + header translation).
 */
export function openConsignmentReport(report: ConsignmentReport, lang: string) {
  const c = report.consignment;
  const ccy = c.base_currency || "USD";
  const T = report.totals;

  const subTable = (title: string, head: string[], rows: string[][]) => `
    <div style="margin-top:10px;page-break-inside:avoid;">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#1e3a8a;margin-bottom:3px;">${escapeHtml(title)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:8pt;">
        <thead><tr>${head
          .map((h) => `<th style="border:1px solid #cbd5e1;background:#0f172a;color:#fff;padding:3px 4px;text-align:start;">${escapeHtml(h)}</th>`)
          .join("")}</tr></thead>
        <tbody>${
          rows.length
            ? rows
                .map(
                  (r) =>
                    `<tr>${r.map((cell) => `<td style="border:1px solid #cbd5e1;padding:3px 4px;">${escapeHtml(cell)}</td>`).join("")}</tr>`,
                )
                .join("")
            : `<tr><td colspan="${head.length}" style="border:1px solid #cbd5e1;padding:6px;text-align:center;color:#64748b;">—</td></tr>`
        }</tbody>
      </table>
    </div>`;

  const containersHtml = subTable(
    t(lang, "cns.containers", "Containers"),
    [
      t(lang, "cns.container_no", "Container No"),
      t(lang, "cns.bl_no", "BL No"),
      t(lang, "cns.loading_date", "Loading Date"),
      t(lang, "cns.total_cartons", "Total Cartons"),
      t(lang, "cns.net_weight", "Net Weight"),
      t(lang, "cns.container_status", "Container Status"),
      t(lang, "cns.goods", "Goods"),
    ],
    report.containers.map((ct) => [
      ct.container_no || "—",
      ct.bl_no || "—",
      String(ct.loading_date || "").slice(0, 10) || "—",
      ct.total_cartons != null ? String(ct.total_cartons) : "—",
      ct.total_net_weight != null ? String(ct.total_net_weight) : "—",
      t(lang, `cns.cs_${ct.status}`, ct.status),
      ct.goods.map((g) => `${g.goods_name} (${n(g.quantity)} ${g.unit_label ? localizeUom(lang, g.unit_label) : ""})`).join("; ") || "—",
    ]),
  );

  const expensesHtml = subTable(
    t(lang, "cns.expenses", "Expenses"),
    [t(lang, "cns.expense_date", "Expense Date"), t(lang, "cns.expense_type", "Expense Type"), t(lang, "cns.description", "Description"), t(lang, "cns.currency", "Currency"), t(lang, "cns.amount", "Amount")],
    report.expenses.map((e) => [
      String(e.expense_date).slice(0, 10),
      t(lang, `cns.et_${e.expense_type}`, e.expense_type),
      e.description || "—",
      e.currency,
      n(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    ]),
  );

  const salesHtml = subTable(
    t(lang, "cns.sales", "Sales"),
    [t(lang, "cns.sale_date", "Sale Date"), t(lang, "cns.buyer_name", "Buyer"), t(lang, "cns.goods_name", "Goods Name"), t(lang, "cns.quantity", "Quantity"), t(lang, "cns.rate", "Rate"), t(lang, "cns.amount", "Amount")],
    report.sales.map((sl) => [
      String(sl.sale_date).slice(0, 10),
      sl.buyer_name || "—",
      sl.goods_name,
      n(sl.quantity).toLocaleString(),
      sl.rate != null ? String(sl.rate) : "—",
      money(sl.amount, sl.currency),
    ]),
  );

  const receiptsHtml = subTable(
    t(lang, "cns.receipts", "Receipts / Collections"),
    [t(lang, "cns.receipt_date", "Receipt Date"), t(lang, "cns.method", "Method"), t(lang, "cns.currency", "Currency"), t(lang, "cns.amount", "Amount")],
    report.receipts.map((r) => [
      String(r.receipt_date).slice(0, 10),
      t(lang, `cns.m_${r.method}`, r.method),
      r.currency,
      n(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    ]),
  );

  openGenericErpReport({
    title: t(lang, "cns.report", "Consignment Report"),
    subtitle: `${c.consignment_no} · ${c.party_name}`,
    lang,
    orientation: "portrait",
    columns: [
      { key: "goodsName", label: t(lang, "cns.goods_name", "Goods Name"), align: "left" },
      { key: "unit", label: t(lang, "cns.unit", "Unit"), align: "left" },
      { key: "received", label: t(lang, "cns.received", "Received"), align: "right", format: "number" },
      { key: "sold", label: t(lang, "cns.sold", "Sold"), align: "right", format: "number" },
      { key: "remaining", label: t(lang, "cns.remaining", "Remaining"), align: "right", format: "number" },
    ],
    rows: report.stockByGoods.map((g) => ({
      goodsName: g.goodsName,
      unit: g.unit ? localizeUom(lang, g.unit) : "—",
      received: g.received,
      sold: g.sold,
      remaining: g.remaining,
    })),
    summary: {
      [t(lang, "cns.col_containers", "Containers")]: T.containerCount,
      [t(lang, "cns.remaining_stock", "Remaining Stock (Qty)")]: T.remainingStockQty,
      [t(lang, "cns.total_sales", "Total Sales Value")]: money(T.totalSales, ccy),
      [t(lang, "cns.total_expenses", "Total Expenses")]: money(T.totalExpenses, ccy),
      [t(lang, "cns.total_receipts", "Total Receipts")]: money(T.totalReceipts, ccy),
      [t(lang, "cns.remaining_receivable", "Remaining Receivable")]: money(T.remainingReceivable, ccy),
    },
    filters: [
      { label: t(lang, "cns.col_no", "Consignment No"), value: c.consignment_no },
      { label: t(lang, "cns.party", "Party"), value: c.party_name },
      { label: t(lang, "cns.consignment_date", "Consignment Date"), value: String(c.consignment_date).slice(0, 10) },
      { label: t(lang, "cns.status", "Status"), value: t(lang, `cns.status_${c.status}`, c.status) },
    ],
    footerNotesHtml: containersHtml + expensesHtml + salesHtml + receiptsHtml,
  });
}
