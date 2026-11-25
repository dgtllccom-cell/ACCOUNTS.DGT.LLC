"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, FileText, Filter, MapPin, MoreVertical, Plus, RefreshCw, Truck } from "lucide-react";
import { AdvancedRegisterSearch, type RegisterSearchField } from "@/components/purchase-ui/advanced-register-search";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { loadingProgress, loadingValues, type LoadedLine, type LoadingOrder, type LoadingRecord, type LoadingStatus } from "@/lib/sales/loading-workflow";
import { translateHeader } from "@/lib/i18n/table-headers";
import { loadSalesLoadingPages, type LoadingRegisterData, type LoadingRegisterOrder } from "@/lib/sales/loading-pagination";
import { SalesLoadingEntry, type LoadingText } from "./sales-loading-entry";

type ViewOrder = LoadingRegisterOrder;
type FilterState = Record<string, string>;
const empty: LoadingRegisterData = { orders: [], records: [], locations: [], canLoad: false, financials: false, complete: true };
const card = "rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900";
const selectClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950";
const btn = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800";
const blue = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800";
const green = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
const statuses: LoadingStatus[] = ["loaded", "partial", "pending"];
const tones = { loaded: "text-emerald-700 dark:text-emerald-400", partial: "text-blue-700 dark:text-blue-400", pending: "text-rose-700 dark:text-rose-400" };
const statusKeys = { loaded: ["sales_loading.complete", "Loaded / Completed"], partial: ["sales_loading.partial", "Partially Loaded"], pending: ["sales_loading.pending", "Pending / Awaiting Loading"] } as const;
const readinessKeys: Record<string, [string, string]> = { awaiting_invoice: ["sales_loading.wait_invoice", "Awaiting finalized invoice"], awaiting_advance: ["sales_loading.wait_advance", "Awaiting required payment"], awaiting_lot: ["sales_loading.wait_lot", "Awaiting source lot"] };
const entryNo = (r?: LoadingRecord) => r?.entry_no != null ? `LE-${String(r.entry_no).padStart(6, "0")}` : "–";
const dateText = (d?: string | null) => d?.slice(0, 10) || "–";
const dollar = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = (n?: number) => n == null ? "–" : n.toLocaleString(undefined, { maximumFractionDigits: 6 });
const includesText = (query: string | undefined, ...values: (string | null | undefined)[]) => {
  const needle = query?.trim().toLowerCase();
  return !needle || values.some(value => value?.toLowerCase().includes(needle));
};
const matchesID = (selection: string | undefined, id: string) => !selection || id === selection;
const optionList = (pairs: readonly (readonly [string, string])[]) => [...new Map(pairs.filter(([id]) => id)).entries()]
  .map(([value, label]) => ({ value, label: label || value })).sort((a, b) => a.label.localeCompare(b.label));

function matchesRecord(order: LoadingOrder, record: LoadingRecord | undefined, filter: FilterState) {
  const goods = record?.goods ?? order.goods;
  const details = record?.details;
  const vessel = details?.vessel || order.vessel;
  const billOfLading = details?.bl || order.bl;
  const date = record?.loading_date?.slice(0, 10);
  // A booking planned for loading does not match a filter for actual loading/receiving dates.
  const inDates = (!filter.fromDate || (date != null && date >= filter.fromDate)) && (!filter.toDate || (date != null && date <= filter.toDate))
    && (!filter.receivedDate || record?.received_date?.slice(0, 10) === filter.receivedDate);
  return inDates && includesText(filter.booking, order.bookingNo, order.contractNo) && includesText(filter.entry, entryNo(record))
    && includesText(filter.container, record?.container_number) && includesText(filter.vessel, vessel) && includesText(filter.bl, billOfLading)
    && includesText(filter.lot, ...goods.map(line => line.lot)) && includesText(filter.goods, ...goods.map(line => line.goods))
    && includesText(filter.loadingCountry, details?.loadingCountry || order.loadingCountry) && includesText(filter.loadingPort, details?.loadingPort || order.loadingPort)
    && includesText(filter.receivedCountry, details?.receivedCountry || order.receivedCountry) && includesText(filter.receivedPort, details?.receivedPort || order.receivedPort)
    && includesText(filter.query, order.bookingNo, order.contractNo, order.customer, vessel, billOfLading, ...goods.flatMap(line => [line.goods, line.lot]), record?.container_number, entryNo(record));
}
const bookingName = (order: ViewOrder) => [order.bookingNo, order.customer].filter(Boolean).join(" · ");

export function SalesLoadingView({ initialOrderId = "", initialAction = "", initialReport = "" }: { initialOrderId?: string; initialAction?: string; initialReport?: string }) {
  const lang = useActiveLanguage();
  const dir = ["ur", "ar", "fa", "ps"].includes(lang) ? "rtl" : "ltr";
  const tt: LoadingText = (key, fallback) => t(lang, key as never, fallback);
  const searchLabel = tt("sales_loading.filter", "Advanced Search & Filter");
  const statusLabel = (status: LoadingStatus) => tt(statusKeys[status][0], statusKeys[status][1]);
  const [data, setData] = useState(empty);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState(false);
  const [filter, setFilter] = useState<FilterState>(initialReport === "confirmed" ? { status: "loaded" } : {});
  const [filterOpen, setFilterOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [menu, setMenu] = useState("");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [entryOrderId, setEntryOrderId] = useState(initialOrderId && initialAction === "loading" ? initialOrderId : "");
  const [picker, setPicker] = useState(initialAction === "loading" && !initialOrderId);
  const [picked, setPicked] = useState("");
  const [directOrderId, setDirectOrderId] = useState(initialAction === "loading" ? initialOrderId : "");
  const requestRef = useRef<AbortController | null>(null);
  const [view, setView] = useState<{ order: string; record?: string } | null>(null);

  const backendQuery = new URLSearchParams({ lang });
  if (directOrderId) backendQuery.set("orderId", directOrderId);
  else for (const [key, value] of Object.entries({ countryId: filter.country, mainBranchId: filter.mainBranch, cityBranchId: filter.cityBranch,
    booking: filter.booking, container: filter.container, fromDate: filter.fromDate, toDate: filter.toDate, receivedDate: filter.receivedDate })) {
    if (value) backendQuery.set(key, value);
  }
  const serializedQuery = backendQuery.toString();
  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setError(false);
    setIsLoading(true);
    // Clear old rows and old authorization capabilities before a new filtered or manual request.
    setData(empty);
    const current = () => requestRef.current === controller && !controller.signal.aborted;
    try {
      const result = await loadSalesLoadingPages(new URLSearchParams(serializedQuery), controller.signal);
      if (current()) setData(result);
    } catch {
      if (current()) { setData(empty); setError(true); }
    } finally {
      if (current()) setIsLoading(false);
    }
  }, [serializedQuery]);
  useEffect(() => {
    void refresh();
    return () => requestRef.current?.abort();
  }, [refresh]);
  useEffect(() => {
    if (!picker && !view && !menu && !reportsOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPicker(false); setView(null); setMenu(""); setReportsOpen(false); }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [picker, view, menu, reportsOpen]);

  const orders = useMemo(() => {
    const index = new Map<string, LoadingRecord[]>();
    for (const record of data.records) {
      const bucket = index.get(record.sales_order_id) ?? [];
      bucket.push(record);
      index.set(record.sales_order_id, bucket);
    }
    return data.orders.map(order => {
      const records = index.get(order.id) ?? [];
      return { order, records, status: loadingProgress(order.goods, records).status };
    });
  }, [data]);
  const choices = orders.filter(row => row.order.canLoad !== false && row.status !== "loaded" && row.order.readiness === "ready" && row.order.goods.length > 0);
  const countryChoices = optionList(data.locations.map(loc => [loc.countryId, loc.country]));
  const scopedChoices = (draft: FilterState) => data.locations.filter(loc => matchesID(draft.country, loc.countryId));
  const searchFields: RegisterSearchField[] = [
    { key: "query", label: tt("sales_loading.search", "Search bill, customer, goods…"), wide: true },
    { key: "booking", label: tt("dintake.f_booking_number", "Booking Number") },
    { key: "entry", label: tt("sales_loading.entry_no", "Loading Entry No. / Date") },
    { key: "container", label: tt("sales.ster_container_number", "Container Number") },
    { key: "country", label: tt("sales_loading.country", "Country"), type: "select", options: countryChoices, clearOnChange: ["mainBranch", "cityBranch"] },
    { key: "mainBranch", label: tt("sales_loading.main_branch", "Main Branch"), type: "select", optionsFor: draft => optionList(scopedChoices(draft).map(loc => [loc.mainBranchId, loc.mainBranch])), clearOnChange: ["cityBranch"] },
    { key: "cityBranch", label: tt("sales_loading.city_branch", "City Branch"), type: "select", optionsFor: draft => optionList(scopedChoices(draft).filter(loc => matchesID(draft.mainBranch, loc.mainBranchId)).map(loc => [loc.cityBranchId, loc.cityBranch])) },
    { key: "status", label: tt("sales_loading.status", "Loading Status"), type: "select", options: statuses.map(value => ({ value, label: statusLabel(value) })) },
    { key: "vessel", label: tt("sales_loading.vessel", "Vessel Name") },
    { key: "bl", label: tt("sales_loading.bl", "B/L Number") },
    { key: "goods", label: tt("sales_loading.goods", "Goods Name") },
    { key: "lot", label: tt("sales_loading.lot", "Lot Name") },
    { key: "loadingCountry", label: tt("sales_loading.loading_country", "Loading Country"), group: "origin" },
    { key: "loadingPort", label: tt("sales_loading.loading_port", "Loading Port"), group: "origin" },
    { key: "receivedCountry", label: tt("sales_loading.received_country", "Receiving Country"), group: "destination" },
    { key: "receivedPort", label: tt("sales_loading.received_port", "Receiving Port"), group: "destination" },
    { key: "fromDate", label: tt("report.filter_date_from", "From Date"), type: "date", group: "dates" },
    { key: "toDate", label: tt("report.filter_date_to", "To Date"), type: "date", group: "dates" },
    { key: "receivedDate", label: tt("sales_loading.received_date", "Actual Received Date"), type: "date", group: "dates" },
  ];
  const visible = orders.flatMap(({ order, records, status }) => {
    if (!matchesID(filter.country, order.countryId) || !matchesID(filter.mainBranch, order.mainBranchId) || !matchesID(filter.cityBranch, order.cityBranchId) || !matchesID(filter.status, status)) return [];
    const recordMatches = records.filter(record => matchesRecord(order, record, filter));
    return (recordMatches.length || (!records.length && matchesRecord(order, undefined, filter))) ? [{ order, records: recordMatches, status }] : [];
  });
  const totals = new Map<string, { loading: number; received: number }>();
  const countries = new Map<string, { country: string; currency: string; bills: number; amount: number }>();
  const statusCounts = { loaded: 0, partial: 0, pending: 0 };
  for (const { order, records, status } of visible) {
    statusCounts[status]++;
    const values = loadingValues(order, records);
    if (order.finalCurrency) {
      const total = totals.get(order.finalCurrency) ?? { loading: 0, received: 0 };
      total.loading += values.loading; total.received += values.received;
      totals.set(order.finalCurrency, total);
    }
    const key = `${order.countryId}/${order.finalCurrency}`;
    const country = countries.get(key) ?? { country: order.country, currency: order.finalCurrency, bills: 0, amount: 0 };
    country.bills++;
    country.amount += values.loading;
    countries.set(key, country);
  }
  const sum = (key: "loading" | "received" | "balance") => [...totals.entries()].map(([cc, value]) => `${cc} ${dollar(key === "balance" ? Math.max(0, value.loading - value.received) : value[key])}`).join(" · ") || "–";
  const exitEntry = () => { setEntryOrderId(""); if (directOrderId) setDirectOrderId(""); };
  const selectedEntry = entryOrderId && choices.find(row => row.order.id === entryOrderId);
  const detail = view && orders.find(row => row.order.id === view.order);
  const detailRecord = detail && view?.record ? detail.records.find(r => r.id === view.record) : undefined;
  let rowIndex = 0;
  const rowCount = visible.reduce((n, r) => n + Math.max(1, r.records.length), 0);

  if (selectedEntry && data.canLoad) return <div dir={dir}><SalesLoadingEntry key={selectedEntry.order.id} order={selectedEntry.order} records={selectedEntry.records} tt={tt} onBack={exitEntry} onSaved={() => { exitEntry(); setNotice(true); if (!directOrderId) void refresh(); }}/></div>;

  return <div dir={dir} className="space-y-3" data-testid="sales-loading-dashboard">
    <div className={`${card} flex flex-wrap items-center gap-2`}>
      <a href="/dashboard/sales/new-sales-booking-order" className={btn}><ArrowLeft className="h-3.5 w-3.5"/>{tt("sales_loading.back", "Back")}</a>
      <h1 className="me-auto flex items-center gap-2 text-base font-extrabold text-blue-800 dark:text-blue-300"><Truck className="h-5 w-5"/>{tt("sales_loading.title", "Sales Loading (Global & Country Wise)")}</h1>
      <div className="relative"><button type="button" className={blue} onClick={() => setReportsOpen(v => !v)} aria-expanded={reportsOpen}><FileText className="h-4 w-4"/>{tt("sales_loading.reports", "Reports")}</button>
        {reportsOpen && <div className="absolute end-0 z-20 mt-1 w-44 rounded-lg border bg-white p-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-950"><button type="button" onClick={() => { setReportsOpen(false); window.print(); }} className="w-full rounded-md p-2 text-start hover:bg-slate-100 dark:hover:bg-slate-800">{tt("sales_loading.print", "Print Register")}</button><button type="button" onClick={() => { setFilter(f => ({ ...f, status: "loaded" })); setReportsOpen(false); }} className="w-full rounded-md p-2 text-start hover:bg-slate-100 dark:hover:bg-slate-800">{tt("sales_loading.confirmed", "Confirmed Sales Loading")}</button></div>}
      </div>
      <button type="button" className={blue} aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => setFilterOpen(true)}><Filter className="h-4 w-4"/>{searchLabel}</button>
      <button type="button" onClick={() => void refresh()} className={btn} aria-label={tt("sales_loading.refresh", "Refresh")}><RefreshCw className="h-4 w-4"/></button>
      {data.canLoad && <button type="button" className={green} disabled={isLoading} onClick={() => { setPicked(""); setPicker(true); }}><Plus className="h-4 w-4"/>{tt("sales_loading.new", "New Loading")}</button>}
    </div>
    {notice && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">{tt("sales_loading.saved", "Sales Loading saved")}</p>}
    {(error || (!isLoading && entryOrderId && !selectedEntry)) && <div role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error ? tt("sales_loading.load_error", "Sales Loading is unavailable. Refresh to try again.") : tt("sales_loading.entry_unavailable", "Loading is not available for this Sales Booking.")}{directOrderId && <button type="button" className={`${btn} ms-3`} onClick={exitEntry}>{tt("plrf.back_to_dashboard", "Dashboard")}</button>}</div>}
    {!data.complete && <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{translateHeader(lang, "Only part of this scope is shown. Narrow by country, branch, booking or date for complete totals.")}</p>}
    <div className="grid gap-3 lg:grid-cols-[0.95fr_1fr_1.1fr]">
      <section className={card}><h2 className="mb-2 text-xs font-extrabold uppercase">{tt("sales_loading.summary", "Sales Loading Summary")}</h2><dl className="space-y-1.5 text-xs sm:text-sm">
        {([["sales_loading.total_bills", "Total Bills", visible.length, ""], ["sales_loading.total_loading", "Total Loading", sum("loading"), "text-blue-700"], ["sales_loading.total_received", "Total Received", sum("received"), "text-emerald-700"], ["sales_loading.balance", "Balance (Remaining)", sum("balance"), "bg-amber-50 dark:bg-amber-950"]] as const).map(([key, name, val, style]) => <div key={key} className={`flex justify-between gap-2 rounded px-2 py-0.5 ${style}`}><dt>{tt(key, name)}</dt><dd className="font-bold tabular-nums" dir="ltr">{data.complete && !isLoading && !error ? val : "–"}</dd></div>)}
      </dl></section>
      <section className={card}><h2 className="mb-2 text-xs font-extrabold uppercase">{tt("sales_loading.status", "Loading Status")}</h2><table className="w-full text-xs sm:text-sm"><thead className="bg-slate-100 text-xs uppercase dark:bg-slate-800"><tr><th className="p-1 text-start">{tt("sales_loading.status_col", "Status")}</th><th className="p-1 text-end">{tt("sales_loading.bills", "Bills")}</th><th className="p-1 text-end">%</th></tr></thead><tbody>{statuses.map(s => <tr key={s}><td className={`p-1 font-semibold ${tones[s]}`}><span className="me-1" aria-hidden>●</span>{statusLabel(s)}</td><td className="p-1 text-end font-bold">{data.complete && !isLoading && !error ? statusCounts[s] : "–"}</td><td className="p-1 text-end font-bold">{data.complete && !isLoading && !error ? `${(visible.length ? statusCounts[s] / visible.length * 100 : 0).toFixed(1)}%` : "–"}</td></tr>)}</tbody></table></section>
      <section className={card}><h2 className="mb-2 text-xs font-extrabold uppercase">{tt("sales_loading.country_summary", "Country Wise Loading")}</h2><div className="max-h-32 overflow-auto"><table className="w-full text-xs sm:text-sm"><thead className="bg-slate-100 text-xs uppercase dark:bg-slate-800"><tr><th className="p-1 text-start">{tt("sales_loading.country", "Country")}</th><th className="p-1 text-end">{tt("sales_loading.currency", "Currency")}</th><th className="p-1 text-end">{tt("sales_loading.bills", "Bills")}</th><th className="p-1 text-end">{tt("sales_loading.amount", "Amount")}</th></tr></thead><tbody>{(data.complete && !isLoading && !error ? [...countries.values()] : []).map((r, i) => <tr key={i} className="font-semibold"><td className="p-1">{r.country || "–"}</td><td className="p-1 text-end">{r.currency || "–"}</td><td className="p-1 text-end">{r.bills}</td><td className="p-1 text-end">{data.financials && r.currency ? dollar(r.amount) : "–"}</td></tr>)}</tbody></table></div></section>
    </div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-700 to-blue-800 px-3 py-2 text-white"><h2 className="flex items-center gap-2 text-sm font-bold uppercase"><Truck className="h-5 w-5"/>{tt("sales_loading.list", "Sales Loading List")}{filter.country ? ` (${countryChoices.find(option => option.value === filter.country)?.label ?? "–"})` : ""}</h2><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{rowCount} {tt("sales_loading.records", "Records")}</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-xs"><thead className="bg-slate-100 text-[11px] dark:bg-slate-800"><tr>{[
        ["", "#"], ["sales_loading.entry_no", "Loading Entry No. / Date"], ["sales_loading.booking_no", "Sales Booking No. / Date"], ["sales_loading.vessel_bl", "Vessel Name / B/L Number"], ["sales_loading.branch", "Branch Name (Main / City Branch)"], ["sales_loading.posted_by", "User Name (Posted By)"], ["sales_loading.purchase_dr", "Purchase DR (Acc. No. / Name)"], ["sales_loading.sales_cr", "Sales CR (Acc. No. / Name)"], ["sales_loading.goods", "Goods Name (Brand / Size)"], ["sales_loading.lot", "Lot Name"], ["sales_loading.qty_unit", "Qty (Unit)"], ["sales_loading.weight", "Weight (KG) Gross / Net"], ["sales_loading.load_route", "Loading Country / Port"], ["sales_loading.receive_route", "Received Country / Port"], ["sales_loading.actions", "Actions"],
      ].map(([key, fallback]) => <th key={key} scope="col" className="border-e border-slate-200 px-2 py-2.5 text-start font-bold dark:border-slate-700">{key ? tt(key, fallback) : fallback}</th>)}</tr></thead><tbody>
        {!visible.length && <tr><td colSpan={15} className="p-8 text-center text-slate-500">{isLoading ? tt("sales_loading.wait", "Loading sales bookings…") : data.complete ? tt("sales_loading.empty", "No matching sales loading records") : "–"}</td></tr>}
        {visible.flatMap(({ order, records, status }) => (records.length ? records : [undefined]).map(r => {
          const rowId = r?.id ?? order.id;
          const goods: LoadedLine[] = r?.goods ?? order.goods;
          const location = (country?: string, port?: string, received = false) => <div className="flex gap-1"><MapPin className={`h-3.5 w-3.5 shrink-0 ${received ? "text-emerald-700" : "text-blue-700"}`}/><Stack value={country} detail={port}/></div>;
          const purchAccounts = [...new Set(goods.map(g => (order.goods.find(line => line.line === g.line)?.purchaseDR ?? []).join(" / ")).filter(Boolean))];
          const loadAllowed = data.canLoad && order.canLoad !== false && status !== "loaded" && order.readiness === "ready" && order.goods.length > 0;
          return <tr key={rowId} className="border-b border-slate-200 align-top odd:bg-white even:bg-slate-50 dark:border-slate-700 dark:odd:bg-slate-900 dark:even:bg-slate-950">
            <Cell>{++rowIndex}</Cell><Cell><Stack value={entryNo(r)} detail={dateText(r?.loading_date)} blueText/></Cell><Cell><Stack value={order.bookingNo} detail={dateText(order.orderDate)} blueText/></Cell>
            <Cell><Stack value={r?.details.vessel || order.vessel} detail={r?.details.bl || order.bl}/></Cell><Cell><Stack value={order.mainBranch} detail={order.cityBranch}/></Cell><Cell>{r?.created_by_name || order.byUser || "–"}</Cell>
            <Cell>{purchAccounts.length ? purchAccounts.map(a => <div key={a}>{a}</div>) : <Stack value={order.purchaseDR[0]} detail={order.purchaseDR[1]} blueText/>}</Cell><Cell><Stack value={order.salesCR[0]} detail={order.salesCR[1]} blueText/></Cell>
            <Cell>{goods.map(g => <Stack key={g.line} value={g.goods} detail={[g.brand, g.size, g.hs ? `HS ${g.hs}` : ""].filter(Boolean).join(" / ")}/>)}</Cell><Cell>{goods.map(g => <div key={g.line} className="mb-1 font-semibold">{g.lot || "–"}</div>)}</Cell>
            <Cell>{goods.map(g => <div key={g.line} className="mb-1"><b className="text-rose-700 dark:text-rose-400">{number(g.quantity)}</b><div>{g.unit || "–"}</div></div>)}</Cell><Cell>{goods.map(g => <div key={g.line} className="mb-1 whitespace-nowrap">G: {number(g.gross)}<br/>N: {number(g.net)}</div>)}</Cell>
            <Cell>{location(r?.details.loadingCountry || order.loadingCountry, r?.details.loadingPort || order.loadingPort)}</Cell><Cell>{location(r?.details.receivedCountry || order.receivedCountry, r?.details.receivedPort || order.receivedPort, true)}</Cell>
            <Cell><div className="relative"><button aria-label={tt("sales_loading.actions", "Actions")} aria-expanded={menu === rowId} type="button" className={btn} onClick={event => {
                const rect = event.currentTarget.getBoundingClientRect();
                setMenuPosition({ left: Math.max(4, Math.min(window.innerWidth - 132, dir === "rtl" ? rect.left : rect.right - 128)), top: rect.bottom + 90 < window.innerHeight ? rect.bottom : Math.max(4, rect.top - 86) });
                setMenu(id => id === rowId ? "" : rowId);
              }}><MoreVertical className="h-4 w-4"/></button>
              {menu === rowId && <div style={menuPosition} className="fixed z-40 w-32 rounded-lg border bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-950"><button type="button" disabled={!loadAllowed} onClick={() => { setEntryOrderId(order.id); setMenu(""); }} className="w-full p-2 text-start font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-40 dark:text-blue-300 dark:hover:bg-slate-800">{tt("sales_loading.loading", "Loading")}</button><button type="button" onClick={() => { setView({ order: order.id, record: r?.id }); setMenu(""); }} className="w-full p-2 text-start font-bold hover:bg-slate-100 dark:hover:bg-slate-800">{tt("sales_loading.view", "View")}</button></div>}
              </div></Cell>
          </tr>;
        }))}
      </tbody></table></div>
    </section>
    <AdvancedRegisterSearch open={filterOpen} onClose={() => setFilterOpen(false)} onApply={setFilter} value={filter} fields={searchFields} lang={lang}/>
    {picker && <Dialog title={tt("sales_loading.new", "New Loading")} onClose={() => setPicker(false)} tt={tt}><form className="space-y-3" onSubmit={event => { event.preventDefault(); if (picked) { setEntryOrderId(picked); setPicker(false); } }}>
      <label className="grid gap-1 text-sm">{tt("sales_loading.select_booking", "Select transferred Sales Booking")}<select autoFocus required className={selectClass} value={picked} onChange={e => setPicked(e.target.value)}><option value="">–</option>{choices.map(({ order }) => <option key={order.id} value={order.id}>{bookingName(order)}</option>)}</select></label>
      {!choices.length && !isLoading && <p className="text-sm text-slate-500">{tt("sales_loading.none_ready", "No transferred booking is ready for loading.")}</p>}
      <button className={green} disabled={!picked}>{tt("sales_loading.loading", "Loading")}</button>
    </form></Dialog>}
    {detail && <Dialog title={`${tt("sales_loading.view", "View")} · ${detail.order.bookingNo}`} onClose={() => setView(null)} tt={tt}>
      <p className={`font-semibold ${tones[detail.status]}`}>{statusLabel(detail.status)}</p>
      {detail.order.readiness !== "ready" && readinessKeys[detail.order.readiness] && <p className="my-2 rounded bg-amber-50 p-2 text-sm text-amber-800">{tt(...readinessKeys[detail.order.readiness])}</p>}
      <p className="my-2 text-sm">{detail.order.customer}</p>
      {(detailRecord ? [detailRecord] : detail.records).map(record => <ReceiveRecord key={record.id} record={record} tt={tt} canLoad={data.canLoad && detail.order.canLoad !== false} onSaved={() => { setView(null); setNotice(true); void refresh(); }}/>) }
      {detail.records.length === 0 && <p className="text-sm text-slate-500">{tt("plrf.no_loading_yet", "No Loading Records Yet")}</p>}
    </Dialog>}
  </div>;
}

function Cell({ children }: { children: React.ReactNode }) { return <td className="border-e border-slate-200 px-2 py-2.5 last:border-e-0 dark:border-slate-700">{children}</td>; }
function Stack({ value, detail, blueText }: { value?: string; detail?: string; blueText?: boolean }) { return <div className="mb-0.5"><b className={blueText ? "text-blue-700 dark:text-blue-300" : ""}>{value || "–"}</b>{detail && <div>{detail}</div>}</div>; }
function Dialog({ title, children, onClose, tt }: { title: string; children: React.ReactNode; onClose: () => void; tt: LoadingText }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-3" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-auto rounded-xl bg-white p-4 shadow-xl dark:bg-slate-950"><div className="flex items-center justify-between border-b pb-2 dark:border-slate-700"><h2 className="font-bold">{title}</h2><button type="button" className={btn} onClick={onClose}>{tt("sales_loading.close", "Close")}</button></div>{children}</div></div>;
}
function ReceiveRecord({ record, tt, canLoad, onSaved }: { record: LoadingRecord; tt: LoadingText; canLoad: boolean; onSaved: () => void }) {
  const [receivedDate, setDate] = useState(record.received_date?.slice(0, 10) || "");
  const [receivedCountry, setCountry] = useState(record.details.receivedCountry ?? "");
  const [receivedPort, setPort] = useState(record.details.receivedPort ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(false);
    try {
      const res = await fetch("/api/erp/sales/loading", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: record.id, receivedDate: receivedDate || null, receivedCountry, receivedPort }) });
      if (!res.ok) throw new Error("Save failed");
      onSaved();
    } catch { setError(true); } finally { setSaving(false); }
  }
  return <div className="space-y-2 rounded-lg border p-3 dark:border-slate-700"><strong>{entryNo(record)} · {record.container_number}</strong><p className="text-xs">{dateText(record.loading_date)} · {record.container_type}</p><ul className="space-y-1 text-sm">{record.goods.map(g => <li key={g.line}>{g.goods} · {g.lot || "–"} · {number(g.quantity)} {g.unit}</li>)}</ul>
    {canLoad ? <form className="space-y-2" onSubmit={save}>
      <div className="grid gap-2 sm:grid-cols-3"><label className="grid gap-1 text-xs">{tt("sales_loading.received_date", "Actual Received Date")}<input type="date" className={selectClass} value={receivedDate} min={dateText(record.loading_date)} onChange={e => setDate(e.target.value)}/></label><label className="grid gap-1 text-xs">{tt("sales_loading.received_country", "Receiving Country")}<input className={selectClass} value={receivedCountry} maxLength={160} onChange={e => setCountry(e.target.value)}/></label><label className="grid gap-1 text-xs">{tt("sales_loading.received_port", "Receiving Port")}<input className={selectClass} value={receivedPort} maxLength={160} onChange={e => setPort(e.target.value)}/></label></div>
      {error && <p className="text-sm text-rose-700" role="alert">{tt("sales_loading.save_error", "Could not save loading. Check the fields and try again.")}</p>}
      <button className={blue} disabled={saving}>{saving ? tt("plrf.saving", "Saving…") : tt("sales_loading.save_receiving", "Save Receiving")}</button>
    </form> : <p className="text-sm">{tt("sales_loading.received_date", "Actual Received Date")}: {dateText(record.received_date)} · {record.details.receivedCountry} {record.details.receivedPort}</p>}
  </div>;
}
