"use client";

import { useEffect, useMemo, useState } from "react";
import { FileBarChart, Printer, RefreshCcw, Search } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { UniversalReportModal, type ReportColumn } from "@/components/ui/universal-report-modal";

function buildTt(lang: string) {
  return (key: string, fb: string) => t((lang || "en") as any, key as any, fb);
}

type ReportRow = {
  purchase_order_id: string;
  purchase_order_no: string;
  purchase_contract_no?: string | null;
  currency_code?: string | null;
  order_total?: string | number | null;
  advance_paid?: string | number | null;
  remaining_paid?: string | number | null;
  credit_amount?: string | number | null;
  remaining_due?: string | number | null;
  payment_status?: string | null;
  created_at?: string | null;
  source_country_name?: string | null;
  source_branch_name?: string | null;
  dest_country_name?: string | null;
  dest_branch_name?: string | null;
  goods_name?: string | null;
  supplier_name?: string | null;
  purchased_qty?: string | number | null;
  loaded_qty?: string | number | null;
  in_transit_qty?: string | number | null;
  received_qty?: string | number | null;
  transport_modes?: string | null;
  latest_loading_status?: string | null;
};

function num(v: unknown) {
  return Number(v || 0);
}
function money(v: unknown, currency?: string | null) {
  return `${num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? " " + currency : ""}`;
}

const STATUS_LABEL_KEYS: Record<string, [string, string]> = {
  pending: ["ctimeline.status_pending", "Pending"],
  partial: ["ctimeline.status_partial", "Partial"],
  unpaid: ["ctimeline.status_unpaid", "Unpaid"],
  paid: ["ctimeline.status_paid", "Paid"],
  completed: ["ctimeline.status_completed", "Completed"]
};
function renderStatus(tt: (k: string, f: string) => string, status: string | null | undefined) {
  const key = STATUS_LABEL_KEYS[String(status || "pending").trim().toLowerCase()];
  return key ? tt(key[0], key[1]) : String(status || "pending").replace(/_/g, " ");
}

const TRANSPORT_LABEL_KEYS: Record<string, [string, string]> = {
  "by road": ["plr.by_road", "By Road"],
  "by sea": ["plr.by_sea", "By Sea"],
  "by air": ["plr.by_air", "By Air"]
};
function renderTransportModes(tt: (k: string, f: string) => string, modes: string | null | undefined) {
  if (!modes) return "-";
  return modes
    .split(",")
    .map((m) => {
      const trimmed = m.trim();
      const key = TRANSPORT_LABEL_KEYS[trimmed.toLowerCase()];
      return key ? tt(key[0], key[1]) : trimmed;
    })
    .join(", ");
}

export function CountryPurchaseReportsView() {
  const activeLang = useActiveLanguage();
  const tt = buildTt(activeLang);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang || "en");

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500", lang: activeLang || "en" });
      if (query.trim()) params.set("q", query.trim());
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      const res = await fetch(`/api/erp/purchases/country-purchase-reports?${params.toString()}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      setRows(Array.isArray(body?.data?.rows) ? body.data.rows : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLang]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.purchaseAmount += num(r.order_total);
        acc.advance += num(r.advance_paid);
        acc.paid += num(r.remaining_paid);
        acc.credit += num(r.credit_amount);
        acc.remaining += num(r.remaining_due);
        acc.purchasedQty += num(r.purchased_qty);
        acc.loadedQty += num(r.loaded_qty);
        acc.receivedQty += num(r.received_qty);
        return acc;
      },
      { purchaseAmount: 0, advance: 0, paid: 0, credit: 0, remaining: 0, purchasedQty: 0, loadedQty: 0, receivedQty: 0 }
    );
  }, [rows]);

  const columns: ReportColumn<ReportRow>[] = [
    { key: "purchase_order_no", label: tt("creports.bill_no", "Bill No.") },
    { key: "source", label: tt("creports.source", "Source Country/Branch"), format: (_v, r) => `${r.source_country_name || "-"} / ${r.source_branch_name || "-"}` },
    { key: "destination", label: tt("creports.destination", "Destination Country/Branch"), format: (_v, r) => `${r.dest_country_name || "-"} / ${r.dest_branch_name || "-"}` },
    { key: "supplier_name", label: tt("creports.supplier", "Company/Supplier") },
    { key: "goods_name", label: tt("creports.goods", "Goods") },
    { key: "purchased_qty", label: tt("creports.purchased_qty", "Purchased Qty"), isNumeric: true, format: (v) => num(v).toLocaleString() },
    { key: "loaded_qty", label: tt("creports.loaded_qty", "Loaded Qty"), isNumeric: true, format: (v) => num(v).toLocaleString() },
    { key: "in_transit_qty", label: tt("creports.in_transit", "In Transit"), isNumeric: true, format: (v) => num(v).toLocaleString() },
    { key: "received_qty", label: tt("creports.received_qty", "Received Qty"), isNumeric: true, format: (v) => num(v).toLocaleString() },
    { key: "remaining_qty", label: tt("creports.remaining_qty", "Remaining Qty"), isNumeric: true, format: (_v, r) => Math.max(0, num(r.purchased_qty) - num(r.received_qty)).toLocaleString() },
    { key: "order_total", label: tt("creports.purchase_amount", "Purchase Amount"), isNumeric: true, format: (v, r) => money(v, r.currency_code) },
    { key: "advance_paid", label: tt("creports.advance", "Advance"), isNumeric: true, format: (v, r) => money(v, r.currency_code) },
    { key: "remaining_paid", label: tt("creports.paid", "Paid"), isNumeric: true, format: (v, r) => money(v, r.currency_code) },
    { key: "credit_amount", label: tt("creports.credit", "Credit"), isNumeric: true, format: (v, r) => money(v, r.currency_code) },
    { key: "remaining_due", label: tt("creports.remaining_payment", "Remaining Payment"), isNumeric: true, format: (v, r) => money(v, r.currency_code) },
    { key: "transport_modes", label: tt("creports.transportation", "Transportation"), format: (v) => renderTransportModes(tt, v as string | null) },
    { key: "payment_status", label: tt("common.status", "Status"), format: (v) => renderStatus(tt, v as string | null) }
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
            <FileBarChart className="h-5 w-5 text-indigo-600" />
            {tt("creports.title", "Country Purchase Reports")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tt("creports.subtitle", "Source, destination, quantities, transportation and accounting status for every Country-to-Country purchase.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950" />
          <span className="text-xs text-slate-400">{tt("creports.to", "to")}</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950" />
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tt("creports.search", "Search PO / goods / supplier...")}
              className="h-9 rounded-lg border border-slate-200 bg-white ps-8 pe-3 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          <button onClick={() => void load()} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <RefreshCcw className="h-3.5 w-3.5" /> {tt("common.refresh", "Refresh")}
          </button>
          <button onClick={() => setPrintOpen(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700">
            <Printer className="h-3.5 w-3.5" /> {tt("creports.print_preview", "Print Preview")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt("creports.total_records", "Total Records")}</div>
          <div className="text-lg font-black text-slate-900 dark:text-white">{rows.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt("creports.purchase_amount", "Purchase Amount")}</div>
          <div className="text-lg font-black text-slate-900 dark:text-white">{money(totals.purchaseAmount)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt("creports.remaining_payment", "Remaining Payment")}</div>
          <div className="text-lg font-black text-amber-600">{money(totals.remaining)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt("creports.received_qty", "Received Qty")}</div>
          <div className="text-lg font-black text-emerald-600">{totals.receivedQty.toLocaleString()} / {totals.purchasedQty.toLocaleString()}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[1600px] text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 ${c.isNumeric ? "text-end" : "text-start"}`}>{c.label}</th>
              ))}
              <th className="px-3 py-2 text-start">{tt("common.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-slate-400">
                  {tt("creports.empty", "No Country Purchase records found for the selected filters.")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.purchase_order_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${c.isNumeric ? "text-end font-mono" : "text-start"} text-slate-700 dark:text-slate-200`}>
                    {c.format ? c.format((r as any)[c.key], r) : String((r as any)[c.key] ?? "-")}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <a href={`/dashboard/purchase/country-purchase-timeline/${r.purchase_order_id}`} className="text-[11px] font-bold text-indigo-600 hover:underline">
                    {tt("creports.view_timeline", "View Timeline")}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UniversalReportModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={tt("creports.title", "Country Purchase Reports")}
        subtitle={tt("creports.subtitle", "Source, destination, quantities, transportation and accounting status for every Country-to-Country purchase.")}
        fromDate={fromDate}
        toDate={toDate}
        columns={columns}
        data={rows}
        grandTotal={totals.purchaseAmount}
        balanceTotal={totals.remaining}
        showTotals
        exportFileName="country-purchase-report"
      />
    </div>
  );
}
