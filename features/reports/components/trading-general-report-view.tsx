"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type Source = "purchase-booking" | "local-purchase" | "sales-booking";
type TradeRow = {
  key: string; source: Source; bill: string; date: string; account: string;
  goods: string; quantity: number | null; unit: string; gross: number | null;
  net: number | null; currency: string; amount: number | null; status: string;
  loadingCountry: string; receivingCountry: string; port: string; href: string;
  branch: string; user: string;
};
type Tab = "all" | "purchase" | "sales" | "booking" | "local";
const textValue = (...values: unknown[]) => String(values.find(v => v !== null && v !== undefined && String(v).trim() !== "") ?? "");
const numeric = (value: unknown): number | null =>
  value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
const show = (value: string) => value || "—";
const fmt = (value: number | null) => value === null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
function normalize(source: Source, raw: any, index: number): TradeRow {
  const form = raw.form_data?.form ?? raw.form_data ?? {};
  const goods = Array.isArray(raw.form_data?.goodsEntries) ? raw.form_data.goodsEntries : [];
  const first = goods[0] ?? {};
  const bill = textValue(raw.purchaseBookingOrderNumber, raw.purchaseOrderNo, raw.purchase_order_no,
    raw.purchase_no, raw.local_purchase_no, raw.localPurchaseNo, raw.salesBookingOrderNumber,
    raw.salesOrderNo, raw.sales_order_no, raw.contractNo, raw.contract_no, raw.id);
  const date = textValue(raw.purchaseDate, raw.bookingDate, raw.purchase_date,
    raw.salesDate, raw.orderDate, raw.createdAt, raw.created_at);
  const kind = source === "local-purchase" ? "local-purchase" : source;
  const reportPath = source === "sales-booking" ? "/dashboard/sales/sales-booking-journal-report"
    : source === "local-purchase" ? "/dashboard/purchase/local-purchase-journal-report"
    : "/dashboard/purchase/purchase-booking-journal-report";
  return {
    key: source + ":" + textValue(raw.id, bill, index),
    source: kind, bill: bill || "—", date, account: textValue(raw.supplierName, raw.supplier_name,
      raw.purchaseAccountName, raw.customerName, raw.buyerName, raw.salesAccountName),
    goods: textValue(raw.goodsName, raw.goods_name, raw.productName, raw.goodsDescription,
      first.goodsName, first.productName, form.goodsName),
    quantity: numeric(raw.quantity ?? raw.numbers ?? raw.totalQuantity ?? first.qtyNo),
    unit: textValue(raw.unit, raw.quantityName, raw.quantity_name, first.qtyName),
    gross: numeric(raw.totalGrossWeight ?? raw.total_gross_weight),
    net: numeric(raw.totalNetWeight ?? raw.netWeight ?? raw.net_weight ?? raw.totalWeight),
    currency: textValue(raw.purchaseCurrency, raw.purchase_currency, raw.currency,
      raw.localCurrency, raw.local_currency),
    amount: numeric(raw.finalAmount ?? raw.finalCost ?? raw.final_cost ??
      raw.totalSalesAmount ?? raw.totalPurchaseAmount),
    status: textValue(raw.status, raw.bookingStatus, raw.currentStep),
    loadingCountry: textValue(raw.loadingCountry, raw.originCountryName, raw.origin_country_name),
    receivingCountry: textValue(raw.receivingCountry, raw.destinationCountry),
    port: textValue(raw.loadingPort, raw.receivingPort),
    href: reportPath, branch: textValue(raw.branchCode, raw.branch_code, raw.branchName),
    user: textValue(raw.createdByName, raw.audit?.userName),
  };
}
const endpoints: { source: Source; url: string; field: string }[] = [
  { source: "purchase-booking", url: "/api/erp/purchases/booking-journal-report?limit=1500", field: "reports" },
  { source: "local-purchase", url: "/api/erp/purchases/local-purchase", field: "purchases" },
  { source: "sales-booking", url: "/api/erp/sales/booking-journal-report?limit=100", field: "reports" },
];

export function TradingGeneralReportView() {
  const lang = useActiveLanguage();
  const rtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(endpoints.map(async ({source, url, field}) => {
      try {
        const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const json = await response.json();
        if (json.ok === false) throw new Error("API response failed");
        const data = json.data?.[field] ?? json[field];
        if (!Array.isArray(data)) throw new Error("Unexpected response structure");
        return {source, rows: data.map((r: any, i: number) => normalize(source, r, i)), error: ""};
      } catch (error) {
        return {source, rows: [] as TradeRow[], error: source + ": " + String(error)};
      }
    }));
    setRows(results.flatMap(r => r.rows).sort((a,b) =>
      (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)));
    setErrors(results.filter(r => r.error).map(r => r.error));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => rows.filter(row => {
    const matchesTab = tab === "all" ||
      (tab === "purchase" && row.source !== "sales-booking") ||
      (tab === "sales" && row.source === "sales-booking") ||
      (tab === "booking" && row.source === "purchase-booking") ||
      (tab === "local" && row.source === "local-purchase");
    return matchesTab && [row.bill,row.account,row.goods,row.branch,row.status].join(" ")
      .toLowerCase().includes(search.toLowerCase());
  }), [rows, tab, search]);
  const count = (source: Source) => rows.filter(r => r.source === source).length;
  return <section dir={rtl ? "rtl" : "ltr"} className="w-full space-y-3 px-3 py-4 sm:px-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h1 className="text-xl font-bold">{t(lang, "nav.reports", "Reports")} — Trading General Register</h1>
        <p className="text-xs text-muted-foreground">Read-only purchase and sales register · original source records</p></div>
      <button type="button" onClick={() => void load()} className="rounded-md border px-3 py-2 text-xs font-medium"
        disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {[
        ["All Records", rows.length],["Purchase Booking",count("purchase-booking")],
        ["Local Purchase",count("local-purchase")],["Sales Booking",count("sales-booking")]
      ].map(([label,value]) => <div key={String(label)} className="rounded-lg border bg-card px-3 py-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value}</div></div>)}
    </div>
    <div className="flex flex-wrap gap-2">
      {([["all","All"],["purchase","Purchase"],["sales","Sales"],["booking","Booking"],["local","Local"]] as const)
        .map(([value,label]) => <button key={value} type="button" onClick={() => setTab(value)}
          aria-pressed={tab===value} className={"rounded-md border px-3 py-1.5 text-xs font-medium " +
            (tab===value ? "bg-amber-500 text-black" : "bg-card")}>{label}</button>)}
      <input aria-label="Search bills or accounts" placeholder="Search bill / account / goods" value={search}
        onChange={event => setSearch(event.target.value)}
        className="min-w-44 flex-1 rounded-md border bg-background px-3 py-1.5 text-xs" />
    </div>
    {errors.length > 0 && <div role="alert" className="rounded-md border border-amber-500 p-2 text-xs">
      Some source reports could not load. Totals are incomplete: {errors.join("; ")}
    </div>}
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[1170px] border-collapse text-xs">
        <thead className="bg-amber-100 text-slate-900"><tr>
          {["Bill No.","Date","Type","Account","Goods","Qty","Gross kg","Net kg",
            "Loading Country","Receipt Country","Port","Currency","Net Amount","Status","Details"]
            .map(h => <th key={h} scope="col" className="whitespace-nowrap border-b px-2 py-2 text-start font-semibold">{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map(row => <FragmentRow key={row.key} row={row}
          isExpanded={expanded===row.key} onToggle={() => setExpanded(expanded===row.key ? null : row.key)} />)}
        {!loading && filtered.length===0 && <tr><td colSpan={15} className="p-5 text-center text-muted-foreground">
          No records in this filter.</td></tr>}</tbody>
      </table>
    </div>
    <p className="text-xs text-muted-foreground">Payment, loading, transit, receipt and customer-sale balances are not
      inferred from booking status. Open the original report for verified movements. Local Sales will be added only
      after its canonical data source is confirmed. No mixed-currency totals are calculated.</p>
  </section>;
}
function FragmentRow({row,isExpanded,onToggle}: {row:TradeRow;isExpanded:boolean;onToggle:()=>void}) {
  const date = Date.parse(row.date);
  return <>
    <tr className="border-b hover:bg-muted/40">
      <td className="whitespace-nowrap px-2 py-2"><button type="button" onClick={onToggle}
        aria-expanded={isExpanded} className="me-2 rounded border px-1" aria-label="Expand bill">{isExpanded?"−":"+"}</button>
        <span className="font-semibold">{row.bill}</span></td>
      <td className="whitespace-nowrap px-2">{date ? new Date(date).toLocaleDateString() : show(row.date)}</td>
      <td className="whitespace-nowrap px-2">{row.source.replaceAll("-"," ")}</td>
      <td className="px-2">{show(row.account)}</td><td className="px-2">{show(row.goods)}</td>
      <td className="whitespace-nowrap px-2 text-end tabular-nums">{fmt(row.quantity)} {row.unit}</td>
      <td className="px-2 text-end tabular-nums">{fmt(row.gross)}</td>
      <td className="px-2 text-end tabular-nums">{fmt(row.net)}</td>
      <td className="px-2">{show(row.loadingCountry)}</td><td className="px-2">{show(row.receivingCountry)}</td>
      <td className="px-2">{show(row.port)}</td><td className="px-2">{show(row.currency)}</td>
      <td className="px-2 text-end tabular-nums">{fmt(row.amount)}</td>
      <td className="px-2">{show(row.status)}</td>
      <td className="px-2"><Link href={row.href} className="text-amber-700 underline dark:text-amber-400">
        Source report</Link></td></tr>
    {isExpanded && <tr className="border-b bg-muted/30"><td colSpan={15} className="p-3">
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
        <div><span className="text-muted-foreground">Original Bill: </span>{row.bill}</div>
        <div><span className="text-muted-foreground">Branch: </span>{show(row.branch)}</div>
        <div><span className="text-muted-foreground">User: </span>{show(row.user)}</div>
        <div><span className="text-muted-foreground">Currency: </span>{show(row.currency)}</div>
        <div><span className="text-muted-foreground">Recorded status: </span>{show(row.status)}</div>
        <Link className="font-semibold underline" href={row.href}>Open full original report</Link>
      </div>
    </td></tr>}
  </>;
}
