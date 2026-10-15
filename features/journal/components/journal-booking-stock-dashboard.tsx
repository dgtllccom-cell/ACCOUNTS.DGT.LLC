"use client";

/**
 * Stock Journal — Purchase Booking & Local Purchase → Loading → Receiving & Customs → Confirm Stock → Sale / Export.
 * One screen for every /dashboard/purchase/stock/* page (the route only chooses the opening tab).
 * All numbers come from /api/erp/inventory/journal-stock (scope-enforced on the server); this component only presents them and
 * sends the authorized events (Confirm Stock / Goods Issue / Reverse / Customs) to the service. Every label goes through the
 * central i18n dictionary (namespace "sj") so the whole screen follows EN / UR / AR / FA / PS with RTL.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowLeftRight, Boxes, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Clock, Download, ExternalLink,
  FileText, Filter, History, Loader2, Package, PackageCheck, Printer, RefreshCw, RotateCcw, Search, ShieldCheck, Ship, ShoppingBag,
  Truck, Undo2, Warehouse as WarehouseIcon,
} from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { openScopedGenericReport } from "@/lib/reports/open-scoped-report";
import type { CardTotals, StockJournalRow, StockJournalSummary } from "@/lib/services/stock-journal-service";
import type { DestinationType, StockStage } from "@/lib/stock-journal/model";

export type StockTab = "all" | "booking" | "confirmed_booking" | "transit" | "receiving" | "ready" | "available" | "sold";
export type DashboardStageProp = StockTab;

type Warehouse = { id: string; warehouse_name: string; warehouse_code?: string; country_id?: string | null };
type Perms = { confirm: boolean; issue: boolean; reverse: boolean };
type ApiRows = { rows: StockJournalRow[]; summary: StockJournalSummary; warehouses: Warehouse[]; permissions: Perms; pagination: { page: number; limit: number; totalRecords: number; totalPages: number } };
type Group = {
  productName: string; unit: string; warehouseId: string | null; warehouseName: string | null; countryName: string; branchName: string; available: number; reserved: number;
  sources: { bookingNo: string; sourceType: string; sourceId: string; container: string; stage: string; quantity: number; transferNo: string | null; destination: string | null; customer: string | null; transferId: string | null; loadingRecordId: string | null; canIssue: boolean; canReverse: boolean; lineKey: string }[];
};
type HistoryEvent = { at: string; type: string; title: string; quantity?: number; unit?: string; reference?: string | null; warehouse?: string | null; actor?: string | null; note?: string | null };

const emptyCard: CardTotals = { lines: 0, qty: 0, byUnit: {} };
const fmtNum = (n: number | string | null | undefined, d = 2) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(Number(n) || 0);
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d).slice(0, 10) : dt.toISOString().slice(0, 10);
};
/** The unit with the most quantity (what the card shows large) + how many other units hide behind it. */
const topUnit = (c: CardTotals) => {
  const e = Object.entries(c.byUnit).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (e.length === 0) return { text: "0", more: 0 };
  return { text: `${fmtNum(e[0][1])} ${e[0][0] === "—" ? "" : e[0][0]}`.trim(), more: e.length - 1 };
};
const byUnitText = (c: CardTotals) => {
  const parts = Object.entries(c.byUnit).filter(([, v]) => v > 0).map(([u, v]) => `${fmtNum(v)} ${u === "—" ? "" : u}`.trim());
  return parts.length ? parts.join(" · ") : "0";
};
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`);

async function api<T = any>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; message?: string }> {
  try {
    const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!r.ok || j?.ok === false) return { ok: false, status: r.status, message: j?.error?.message || j?.message || `Request failed (${r.status})` };
    return { ok: true, status: r.status, data: (j?.data ?? j) as T };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
}

/* ─────────────────────────── small presentational pieces ─────────────────────────── */

const STAGE_STYLE: Record<StockStage, { cls: string; icon: React.ComponentType<any> }> = {
  booking: { cls: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800", icon: FileText },
  transit: { cls: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800", icon: Truck },
  receiving: { cls: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800", icon: ShieldCheck },
  ready: { cls: "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-200 dark:border-cyan-800", icon: ClipboardCheck },
  available: { cls: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800", icon: Boxes },
  reserved: { cls: "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-800", icon: Ship },
  sold: { cls: "bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500", icon: PackageCheck },
};

function Dot({ tone, label, title }: { tone: "red" | "amber" | "green" | "black" | "gray"; label: string; title: string }) {
  const color = { red: "bg-red-500", amber: "bg-amber-500", green: "bg-emerald-500", black: "bg-black dark:bg-white", gray: "bg-slate-400" }[tone];
  return (
    <span title={title} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-slate-700 dark:text-slate-200">
      <span className={`inline-block h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-800 ${color}`} aria-hidden />
      {label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, tone, active, onClick, id, title }: { icon: React.ComponentType<any>; label: string; value: string; sub: string; tone: string; active: boolean; onClick: () => void; id: string; title?: string }) {
  return (
    <button
      type="button"
      id={id}
      title={title}
      onClick={onClick}
      className={`flex w-full min-w-0 items-center gap-3 rounded-xl border p-3.5 text-start shadow-xs transition ${active ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:bg-blue-950/40" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"}`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white ${tone}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
        <span className="block truncate text-[18px] font-black tabular-nums text-slate-900 dark:text-slate-50" dir="ltr">{value}</span>
        <span className="block text-[12px] font-semibold text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">{sub}</span>
      </span>
    </button>
  );
}

/* ─────────────────────────── main ─────────────────────────── */

export function JournalBookingStockDashboard({ session, initialStage = "all", initialDestination, lang: langProp }: { session?: unknown; initialStage?: StockTab; initialDestination?: DestinationType; lang?: string }) {
  const s = useErpScreen("sj", langProp);
  const [tab, setTab] = useState<StockTab>(initialStage);
  const [destination, setDestination] = useState<DestinationType | "">(initialDestination ?? "");
  const [availableView, setAvailableView] = useState<"report" | "rows">("report");
  const [data, setData] = useState<ApiRows | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [f, setF] = useState({ search: "", goodsName: "", purchaseOrderNo: "", containerNo: "", warehouseId: "", dateFrom: "", dateTo: "" });
  const [applied, setApplied] = useState(f);
  const [confirmRow, setConfirmRow] = useState<StockJournalRow | null>(null);
  const [issueRow, setIssueRow] = useState<{ id: string; label: string; qty: number; unit: string; salesOrderNo: string | null } | null>(null);
  const [reverseRow, setReverseRow] = useState<{ id: string; label: string } | null>(null);
  const [customsRow, setCustomsRow] = useState<StockJournalRow | null>(null);
  const [historyRow, setHistoryRow] = useState<{ sourceType: string; sourceId: string; loadingRecordId?: string | null; title: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const LIMIT = 50;

  const stageLabel = useCallback((st: StockStage) => ({
    booking: s.t("stage_booking", "Booking Stock"),
    transit: s.t("stage_transit", "Loading / Transit"),
    receiving: s.t("stage_receiving", "Receiving / Customs"),
    ready: s.t("stage_ready", "Ready for Confirmation"),
    available: s.t("stage_available", "Available"),
    reserved: s.t("stage_reserved", "Reserved"),
    sold: s.t("stage_sold", "Sold / Exported"),
  }[st]), [s]);
  const destLabel = useCallback((d: string | null) => ({
    warehouse: s.t("dest_warehouse", "Warehouse Storage"),
    local_sales: s.t("dest_local", "Local Market Stock"),
    export: s.t("dest_export", "Export Stock"),
    direct_sale: s.t("dest_direct", "Direct Sale / Delivery"),
  } as Record<string, string>)[d || ""] || "—", [s]);
  const customsLabel = useCallback((c: string) => ({
    pending: s.t("customs_pending", "Customs: Pending"),
    submitted: s.t("customs_submitted", "Customs: Submitted"),
    cleared: s.t("customs_cleared", "Customs: Cleared"),
    not_applicable: s.t("customs_na", "Customs: Not required"),
    not_recorded: s.t("customs_not_recorded", "Customs: Not recorded"),
  } as Record<string, string>)[c] || c, [s]);

  const query = useCallback((pg: number, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    if (tab !== "all" && !(tab === "available" && availableView === "report")) p.set("stage", tab);
    if (destination) p.set("destination", destination);
    for (const [k, v] of Object.entries(applied)) if (v) p.set(k, v);
    p.set("page", String(pg));
    p.set("limit", String(LIMIT));
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  }, [tab, destination, applied, availableView]);

  const load = useCallback(async (pg = 1) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    const wantsReport = tab === "available" && availableView === "report";
    // the cards always come from the rows call; the Available report is a second, grouped view of the same stock
    const [rowsRes, repRes] = await Promise.all([
      api<ApiRows>(`/api/erp/inventory/journal-stock?${query(pg)}`, { signal: ac.signal }),
      wantsReport ? api<{ groups: Group[] }>(`/api/erp/inventory/journal-stock?${query(1, { view: "available", limit: "2000" })}`, { signal: ac.signal }) : Promise.resolve(null),
    ]);
    if (ac.signal.aborted) return;
    if (!rowsRes.ok) setError(rowsRes.message || s.t("load_failed", "The stock could not be loaded."));
    else {
      setData(rowsRes.data!);
      setPage(pg);
    }
    setGroups(repRes && repRes.ok ? repRes.data!.groups : null);
    setLoading(false);
  }, [query, tab, availableView, s]);

  useEffect(() => { void load(1); }, [load]);

  const summary = data?.summary;
  const perms = data?.permissions ?? { confirm: false, issue: false, reverse: false };
  const warehouses = data?.warehouses ?? [];
  const rows = data?.rows ?? [];

  const flash = (m: string) => { setBanner(m); window.setTimeout(() => setBanner(null), 7000); };
  const refreshAfter = (m: string) => { flash(m); void load(page); };

  const goTab = (t: StockTab) => { setTab(t); setPage(1); setExpanded(null); if (t !== "available") setDestination(""); };

  const exportCsv = async () => {
    const res = await api<ApiRows>(`/api/erp/inventory/journal-stock?${query(1, { limit: "2000" })}`);
    if (!res.ok) return setError(res.message || "");
    const head = [s.t("col_bill", "Purchase No."), s.t("col_type", "Type"), s.t("col_supplier", "Supplier"), s.t("col_product", "Product"), s.t("col_qty", "Quantity"), s.t("col_unit", "Unit"), s.t("col_currency", "Currency"), s.t("col_country", "Country"), s.t("col_branch", "Branch"), s.t("col_date", "Date"), s.t("col_status", "Status"), s.t("col_loaded", "Loaded"), s.t("col_received", "Received"), s.t("col_damage", "Damage"), s.t("col_shortage", "Shortage"), s.t("col_outstanding", "Outstanding"), s.t("col_customs", "Customs"), s.t("col_container", "Container / Truck"), s.t("col_warehouse", "Warehouse")];
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = res.data!.rows.map((r) => [r.billNumber, r.sourceType === "local_purchase" ? s.t("type_local", "Local Purchase") : s.t("type_booking", "Purchase Booking"), r.supplierName, r.productName, r.quantity, r.unit, r.currencyCode, r.countryName, r.branchName, fmtDate(r.date), stageLabel(r.stage), r.loadedQuantity, r.receivedQuantity, r.damagedQuantity, r.shortageQuantity, r.outstandingQuantity, customsLabel(r.customsStatus), r.truckOrContainer, r.warehouseName ?? ""].map(q).join(","));
    const blob = new Blob(["﻿" + [head.map(q).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stock_journal_${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const printReport = async () => {
    const res = await api<ApiRows>(`/api/erp/inventory/journal-stock?${query(1, { limit: "2000" })}`);
    if (!res.ok) return setError(res.message || "");
    const sm = res.data!.summary;
    await openScopedGenericReport({
      title: s.t("title", "Stock Journal"),
      subtitle: `${tabLabel(tab)} · ${s.t("subtitle_print", "Purchase Booking → Loading → Receiving → Warehouse → Sale / Export")}`,
      orientation: "landscape",
      lang: s.lang,
      columns: [
        { key: "index", label: s.t("col_no", "Sr."), align: "center" },
        { key: "dateText", label: s.t("col_date", "Date"), align: "center" },
        { key: "billNumber", label: s.t("col_bill", "Purchase No.") },
        { key: "supplierName", label: s.t("col_supplier", "Supplier") },
        { key: "productName", label: s.t("col_product", "Product") },
        { key: "quantity", label: s.t("col_qty", "Quantity"), align: "right", format: "number" },
        { key: "unit", label: s.t("col_unit", "Unit"), align: "center" },
        { key: "stageText", label: s.t("col_status", "Status") },
        { key: "receivedQuantity", label: s.t("col_received", "Received"), align: "right", format: "number" },
        { key: "damagedQuantity", label: s.t("col_damage", "Damage"), align: "right", format: "number" },
        { key: "shortageQuantity", label: s.t("col_shortage", "Shortage"), align: "right", format: "number" },
        { key: "customsText", label: s.t("col_customs", "Customs") },
        { key: "truckOrContainer", label: s.t("col_container", "Container / Truck") },
        { key: "warehouseName", label: s.t("col_warehouse", "Warehouse") },
        { key: "countryName", label: s.t("col_country", "Country") },
        { key: "branchName", label: s.t("col_branch", "Branch") },
      ],
      rows: res.data!.rows.map((r, i) => ({ ...r, index: i + 1, dateText: fmtDate(r.date), stageText: stageLabel(r.stage), customsText: customsLabel(r.customsStatus), warehouseName: r.warehouseName ?? "" })),
      summary: {
        [s.t("card_booking", "Booking Stock")]: byUnitText(sm.booking),
        [s.t("card_confirmed_booking", "Confirmed Booking")]: byUnitText(sm.confirmedBooking),
        [s.t("card_transit", "Loading / Transit Stock")]: byUnitText(sm.transit),
        [s.t("card_receiving", "Receiving / Customs Stock")]: byUnitText(sm.receivingCustoms),
        [s.t("card_available", "Available / Mixed Stock")]: byUnitText(sm.availableMixed),
        [s.t("card_sold", "Sold / Exported Stock")]: byUnitText(sm.soldExported),
      },
    } as any);
  };

  const tabLabel = (t: StockTab) => ({
    all: s.t("tab_all", "All Stock"),
    booking: s.t("tab_booking", "Booking Stock"),
    confirmed_booking: s.t("tab_confirmed_booking", "Confirmed Booking"),
    transit: s.t("tab_transit", "Loading / Transit"),
    receiving: s.t("tab_receiving", "Receiving & Customs"),
    ready: s.t("tab_ready", "Ready for Confirmation"),
    available: s.t("tab_available", "Available / Mixed"),
    sold: s.t("tab_sold", "Sold / Exported"),
  }[t]);

  const TABS: StockTab[] = ["all", "booking", "confirmed_booking", "transit", "receiving", "ready", "available", "sold"];

  const payTone = (p: StockJournalRow["paymentStatus"]) => (p === "paid" ? "black" : p === "partial" ? "amber" : "red");
  const Indicators = ({ r }: { r: StockJournalRow }) => (
    <div className="flex flex-col gap-1">
      <Dot tone={r.bookingStatus === "confirmed" ? "green" : "amber"} label={r.bookingStatus === "confirmed" ? s.t("ind_booking_confirmed", "Booking confirmed") : s.t("ind_booking_draft", "Booking draft")} title={s.t("ind_booking_title", "Booking confirmation")} />
      <Dot tone={r.invoiceStatus === "posted" ? "green" : "gray"} label={r.invoiceStatus === "posted" ? s.t("ind_invoice_posted", "Invoice posted") : s.t("ind_invoice_open", "Invoice not posted")} title={s.t("ind_invoice_title", "Invoice status")} />
      <Dot tone={payTone(r.paymentStatus)} label={r.paymentStatus === "paid" ? s.t("ind_paid", "Paid") : r.paymentStatus === "partial" ? s.t("ind_partial", "Part paid") : s.t("ind_unpaid", "Unpaid")} title={s.t("ind_payment_title", "Payment status — payment is not stock receipt")} />
    </div>
  );

  const StagePill = ({ st }: { st: StockStage }) => {
    const m = STAGE_STYLE[st];
    const Icon = m.icon;
    return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-bold ${m.cls}`}><Icon className="h-3.5 w-3.5" />{stageLabel(st)}</span>;
  };

  const Actions = ({ r }: { r: StockJournalRow }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" data-testid="sj-history" onClick={() => setHistoryRow({ sourceType: r.sourceType, sourceId: r.sourceId, loadingRecordId: r.loadingRecordId, title: `${r.billNumber} · ${r.productName}` })} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
        <History className="h-3.5 w-3.5" />{s.t("act_history", "History")}
      </button>
      {r.stage === "ready" && r.canConfirm && (
        <button type="button" data-testid="sj-confirm" onClick={() => setConfirmRow(r)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-700">
          <ClipboardCheck className="h-3.5 w-3.5" />{s.t("act_confirm", "Confirm Stock")}
        </button>
      )}
      {(r.stage === "receiving" || r.stage === "ready" || r.stage === "transit") && r.loadingRecordId && perms.confirm && (
        <button type="button" data-testid="sj-customs" onClick={() => setCustomsRow(r)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-2.5 text-[12px] font-bold text-orange-900 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
          <ShieldCheck className="h-3.5 w-3.5" />{s.t("act_customs", "Customs")}
        </button>
      )}
      {r.canIssue && r.transferId && (
        <button type="button" data-testid="sj-issue" onClick={() => setIssueRow({ id: r.transferId!, label: `${r.transferNo} · ${r.productName}`, qty: r.quantity, unit: r.unit, salesOrderNo: r.salesOrderNo })} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[12px] font-bold text-white hover:bg-blue-700">
          <Truck className="h-3.5 w-3.5" />{s.t("act_issue", "Issue / Dispatch")}
        </button>
      )}
      {r.canReverse && r.transferId && (
        <button type="button" data-testid="sj-reverse" onClick={() => setReverseRow({ id: r.transferId!, label: `${r.transferNo} · ${r.productName}` })} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-2.5 text-[12px] font-bold text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <Undo2 className="h-3.5 w-3.5" />{s.t("act_reverse", "Reverse")}
        </button>
      )}
      {r.goodsTransferHref && (r.stage === "available" || r.stage === "booking" || r.stage === "transit") && (
        <a href={r.goodsTransferHref} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 text-[12px] font-bold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <ExternalLink className="h-3.5 w-3.5" />{s.t("act_goods_journal", "Goods Transfer Journal")}
        </a>
      )}
    </div>
  );

  const cards: { id: string; icon: React.ComponentType<any>; label: string; c: CardTotals; tone: string; tab: StockTab; sub: string }[] = [
    { id: "sj-card-booking", icon: FileText, label: s.t("card_booking", "Booking Stock"), c: summary?.booking ?? emptyCard, tone: "bg-blue-600", tab: "booking", sub: "" },
    { id: "sj-card-confirmed", icon: CheckCircle2, label: s.t("card_confirmed_booking", "Confirmed Booking"), c: summary?.confirmedBooking ?? emptyCard, tone: "bg-indigo-600", tab: "confirmed_booking", sub: "" },
    { id: "sj-card-transit", icon: Truck, label: s.t("card_transit", "Loading / Transit Stock"), c: summary?.transit ?? emptyCard, tone: "bg-amber-600", tab: "transit", sub: "" },
    { id: "sj-card-receiving", icon: ShieldCheck, label: s.t("card_receiving", "Receiving / Customs Stock"), c: summary?.receivingCustoms ?? emptyCard, tone: "bg-orange-600", tab: "receiving", sub: summary ? `${s.t("card_ready_sub", "Ready for confirmation")}: ${topUnit(summary.readyForConfirmation).text}` : "" },
    { id: "sj-card-available", icon: Boxes, label: s.t("card_available", "Available / Mixed Stock"), c: summary?.availableMixed ?? emptyCard, tone: "bg-emerald-600", tab: "available", sub: summary ? `${s.t("card_reserved_sub", "Reserved")}: ${topUnit(summary.reserved).text}` : "" },
    { id: "sj-card-sold", icon: PackageCheck, label: s.t("card_sold", "Sold / Exported Stock"), c: summary?.soldExported ?? emptyCard, tone: "bg-slate-700", tab: "sold", sub: "" },
  ];

  const colHead = "px-3 py-2.5 text-start text-[12px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300 whitespace-nowrap";

  return (
    <div dir={s.dir} data-testid="stock-journal" className="mx-auto min-h-screen max-w-[1920px] space-y-4 p-3 sm:p-6">
      {/* header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-800 sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-[#0d2d6b] p-2.5 text-white"><Package className="h-6 w-6" /></span>
            <div>
              <h1 className="text-[22px] font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("title", "Stock Journal")}</h1>
              <p className="max-w-3xl text-[14px] text-slate-600 dark:text-slate-300">{s.t("subtitle", "Purchase Booking and Local Purchase stock, from booking to loading, receiving and customs, confirmation, and final sale or export.")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void load(page)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{s.t("refresh", "Refresh")}</button>
            <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"><Filter className="h-4 w-4" />{s.t("filters", "Filters")}<ChevronDown className={`h-4 w-4 transition ${filtersOpen ? "rotate-180" : ""}`} /></button>
            <button type="button" onClick={() => void exportCsv()} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"><Download className="h-4 w-4" />{s.t("export_csv", "Export CSV")}</button>
            <button type="button" data-testid="sj-print" onClick={() => void printReport()} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0d2d6b] px-4 text-[13px] font-bold text-white hover:bg-[#0a2253]"><Printer className="h-4 w-4" />{s.t("print_pdf", "Print / PDF")}</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 pt-3 text-[12px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <span className="font-bold">{s.t("legend", "Indicators")}:</span>
          <Dot tone="red" label={s.t("ind_unpaid", "Unpaid")} title="" />
          <Dot tone="amber" label={s.t("ind_partial", "Part paid")} title="" />
          <Dot tone="black" label={s.t("ind_paid", "Paid")} title="" />
          <span className="text-slate-500">{s.t("legend_note", "Payment is separate from physical receipt — paid stock is still Booking or Transit until it is received.")}</span>
        </div>
      </div>

      {banner && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{banner}</span><button type="button" onClick={() => setBanner(null)} aria-label={s.t("close", "Close")}>×</button></div>}
      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span><button type="button" onClick={() => void load(page)} className="underline">{s.t("retry", "Try again")}</button></div>}

      {/* six cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((c) => (
          <SummaryCard key={c.id} id={c.id} icon={c.icon} label={c.label} value={topUnit(c.c).text} title={byUnitText(c.c)} sub={`${c.c.lines} ${s.t("lines", "lines")}${topUnit(c.c).more ? ` · +${topUnit(c.c).more} ${s.t("more_units", "more units")}` : ""}${c.sub ? " · " + c.sub : ""}`} tone={c.tone} active={tab === c.tab} onClick={() => goTab(c.tab)} />
        ))}
      </div>

      {/* filters */}
      {filtersOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["goodsName", s.t("col_product", "Product")],
              ["purchaseOrderNo", s.t("col_bill", "Purchase No.")],
              ["containerNo", s.t("col_container", "Container / Truck")],
            ] as const).map(([k, label]) => (
              <label key={k} className="space-y-1"><span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{label}</span>
                <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] dark:border-slate-600 dark:bg-slate-900" /></label>
            ))}
            <label className="space-y-1"><span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{s.t("col_warehouse", "Warehouse")}</span>
              <select value={f.warehouseId} onChange={(e) => setF({ ...f, warehouseId: e.target.value })} className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] dark:border-slate-600 dark:bg-slate-900">
                <option value="">{s.t("all_warehouses", "All warehouses")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
              </select></label>
            <label className="space-y-1"><span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{s.t("date_from", "From date")}</span>
              <input type="date" value={f.dateFrom} onChange={(e) => setF({ ...f, dateFrom: e.target.value })} className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] dark:border-slate-600 dark:bg-slate-900" /></label>
            <label className="space-y-1"><span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{s.t("date_to", "To date")}</span>
              <input type="date" value={f.dateTo} onChange={(e) => setF({ ...f, dateTo: e.target.value })} className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] dark:border-slate-600 dark:bg-slate-900" /></label>
            <label className="space-y-1"><span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{s.t("destination", "Destination")}</span>
              <select value={destination} onChange={(e) => setDestination(e.target.value as DestinationType | "")} className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] dark:border-slate-600 dark:bg-slate-900">
                <option value="">{s.t("all_destinations", "All destinations")}</option>
                {(["warehouse", "local_sales", "export", "direct_sale"] as const).map((d) => <option key={d} value={d}>{destLabel(d)}</option>)}
              </select></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setApplied(f); setPage(1); }} className="min-h-[40px] rounded-lg bg-blue-600 px-4 text-[13px] font-bold text-white hover:bg-blue-700">{s.t("apply", "Apply filters")}</button>
            <button type="button" onClick={() => { const z = { search: "", goodsName: "", purchaseOrderNo: "", containerNo: "", warehouseId: "", dateFrom: "", dateTo: "" }; setF(z); setApplied(z); setDestination(""); }} className="min-h-[40px] rounded-lg border border-slate-300 px-4 text-[13px] font-bold text-slate-700 dark:border-slate-600 dark:text-slate-100">{s.t("reset", "Reset")}</button>
          </div>
        </div>
      )}

      {/* tabs + search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} type="button" data-testid={`sj-tab-${t}`} onClick={() => goTab(t)} className={`min-h-[40px] shrink-0 rounded-lg px-3.5 text-[13px] font-bold transition ${tab === t ? "bg-[#0d2d6b] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100"}`}>{tabLabel(t)}</button>
            ))}
          </div>
          <div className="relative w-full xl:w-96">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input data-testid="sj-search" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { setApplied({ ...f }); setPage(1); } }} placeholder={s.t("search_ph", "Search purchase no., product, supplier, container, customer…")} className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white ps-9 pe-3 text-[14px] dark:border-slate-600 dark:bg-slate-900" />
          </div>
        </div>
        {tab === "available" && (
          <div className="mt-3 flex gap-1.5">
            {(["report", "rows"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setAvailableView(v)} className={`min-h-[36px] rounded-lg px-3 text-[12px] font-bold ${availableView === v ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100"}`}>{v === "report" ? s.t("view_report", "Consolidated report") : s.t("view_rows", "Transaction rows")}</button>
            ))}
          </div>
        )}
      </div>

      {/* body */}
      {tab === "available" && availableView === "report" ? (
        <div className="space-y-2" data-testid="sj-available-report">
          {loading && !groups ? <div className="flex items-center justify-center gap-2 rounded-2xl border bg-white p-10 text-slate-500 dark:bg-slate-800"><Loader2 className="h-5 w-5 animate-spin" />{s.t("loading", "Loading…")}</div> : null}
          {groups && groups.length === 0 && <div className="rounded-2xl border bg-white p-10 text-center text-[14px] text-slate-500 dark:bg-slate-800">{s.t("empty", "No stock records match these filters.")}</div>}
          {(groups ?? []).map((g, gi) => {
            const key = `${g.productName}|${g.warehouseId}|${gi}`;
            const open = expanded === key;
            return (
              <div key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <button type="button" data-testid="sj-group" onClick={() => setExpanded(open ? null : key)} className="grid w-full grid-cols-2 items-center gap-3 p-3.5 text-start hover:bg-slate-50 dark:hover:bg-slate-700/40 md:grid-cols-6">
                  <span className="col-span-2 min-w-0 md:col-span-2"><span className="block truncate text-[15px] font-black text-slate-900 dark:text-slate-50">{g.productName || "—"}</span><span className="block truncate text-[12px] text-slate-500">{g.countryName} · {g.branchName}</span></span>
                  <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200"><WarehouseIcon className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{g.warehouseName || "—"}</span></span>
                  <span><span className="block text-[11px] font-bold uppercase text-slate-500">{s.t("avail_available", "Available")}</span><span className="text-[16px] font-black tabular-nums text-emerald-700 dark:text-emerald-300" dir="ltr">{fmtNum(g.available)} {g.unit}</span></span>
                  <span><span className="block text-[11px] font-bold uppercase text-slate-500">{s.t("avail_reserved", "Reserved")}</span><span className="text-[16px] font-black tabular-nums text-violet-700 dark:text-violet-300" dir="ltr">{fmtNum(g.reserved)} {g.unit}</span></span>
                  <span className="flex items-center justify-between gap-2 text-[12px] font-bold text-slate-500"><span>{g.sources.length} {s.t("sources", "sources")}</span><ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} /></span>
                </button>
                {open && (
                  <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-700">
                    <table className="w-full min-w-[720px] text-[13px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/50"><tr>
                        {[s.t("col_bill", "Purchase No."), s.t("col_container", "Container / Truck"), s.t("col_status", "Status"), s.t("col_qty", "Quantity"), s.t("col_transfer", "Allocation"), s.t("col_customer", "Customer"), ""].map((h, i) => <th key={i} className={colHead}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {g.sources.map((src, si) => (
                          <tr key={si} className="border-t border-slate-100 dark:border-slate-700">
                            <td className="px-3 py-2 font-bold">{src.bookingNo}</td>
                            <td className="px-3 py-2">{src.container || "—"}</td>
                            <td className="px-3 py-2"><StagePill st={src.stage as StockStage} /></td>
                            <td className="px-3 py-2 tabular-nums" dir="ltr">{fmtNum(src.quantity)} {g.unit}</td>
                            <td className="px-3 py-2">{src.transferNo ? `${src.transferNo}${src.destination ? " · " + destLabel(src.destination) : ""}` : "—"}</td>
                            <td className="px-3 py-2">{src.customer || "—"}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1.5">
                                <button type="button" data-testid="sj-source-history" onClick={() => setHistoryRow({ sourceType: src.sourceType, sourceId: src.sourceId, loadingRecordId: src.loadingRecordId, title: `${src.bookingNo} · ${g.productName}` })} className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-[12px] font-bold text-slate-700 dark:border-slate-600 dark:text-slate-100"><History className="h-3.5 w-3.5" />{s.t("act_history", "History")}</button>
                                {src.canIssue && src.transferId && <button type="button" onClick={() => setIssueRow({ id: src.transferId!, label: `${src.transferNo} · ${g.productName}`, qty: src.quantity, unit: g.unit, salesOrderNo: null })} className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-[12px] font-bold text-white"><Truck className="h-3.5 w-3.5" />{s.t("act_issue", "Issue / Dispatch")}</button>}
                                {src.canReverse && src.transferId && <button type="button" onClick={() => setReverseRow({ id: src.transferId!, label: `${src.transferNo} · ${g.productName}` })} className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 text-[12px] font-bold text-red-800"><Undo2 className="h-3.5 w-3.5" />{s.t("act_reverse", "Reverse")}</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* desktop table */}
          <div aria-busy={loading} className={`hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs transition-opacity dark:border-slate-700 dark:bg-slate-800 md:block ${loading ? "opacity-50" : ""}`}>
            <table className="w-full min-w-[1400px] text-[13px]" data-testid="sj-table">
              <thead className="bg-slate-50 dark:bg-slate-900/60"><tr>
                {[s.t("col_bill", "Purchase No."), s.t("col_product", "Product"), s.t("col_supplier", "Supplier"), s.t("col_qty", "Quantity"), s.t("col_currency", "Currency"), s.t("col_country_branch", "Country / Branch"), s.t("col_date", "Date"), s.t("col_status", "Status"), s.t("col_indicators", "Booking · Invoice · Payment"), s.t("col_receiving", "Loaded / Received / Damage / Shortage / Outstanding"), s.t("col_customs", "Customs"), s.t("col_container", "Container / Truck"), s.t("col_warehouse", "Warehouse"), s.t("col_actions", "Actions")].map((h, i) => <th key={i} className={colHead}>{h}</th>)}
              </tr></thead>
              <tbody>
                {loading && rows.length === 0 && <tr><td colSpan={14} className="p-10 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={14} className="p-10 text-center text-[14px] text-slate-500">{s.t("empty", "No stock records match these filters.")}</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} data-testid="sj-row" data-stage={r.stage} className="border-t border-slate-100 align-top hover:bg-slate-50/70 dark:border-slate-700 dark:hover:bg-slate-700/30">
                    <td className="min-w-[150px] px-3 py-3"><div className="font-black text-slate-900 dark:text-slate-50 [overflow-wrap:anywhere]" dir="ltr">{r.systemBillNumber}</div>{r.manualBillNumber && r.manualBillNumber !== "-" && r.manualBillNumber !== r.systemBillNumber && <div className="text-[12px] text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300" dir="ltr">{r.manualBillNumber}</div>}<div className="text-[11px] font-semibold text-slate-500">{r.sourceType === "local_purchase" ? s.t("type_local", "Local Purchase") : s.t("type_booking", "Purchase Booking")}</div></td>
                    <td className="min-w-[120px] px-3 py-3"><div className="font-bold">{r.productName || <span className="text-amber-700">{s.t("goods_not_entered", "Goods not entered")}</span>}</div><div className="text-[11px] text-slate-500">{[r.brand, r.size].filter(Boolean).join(" · ")}</div></td>
                    <td className="px-3 py-3">{r.supplierName || "—"}</td>
                    <td className="min-w-[110px] px-3 py-3 tabular-nums" dir="ltr"><span className="text-[15px] font-black">{fmtNum(r.quantity)}</span> <span className="text-slate-500">{r.unit}</span>{r.quantityNotEntered && <div className="text-[11px] font-bold text-amber-700">{s.t("qty_not_entered", "Quantity not entered yet")}</div>}{r.overLoaded && <div className="text-[11px] font-bold text-red-700">{s.t("over_loaded", "Loaded above booked quantity")}</div>}</td>
                    <td className="px-3 py-3">{r.currencyCode || "—"}</td>
                    <td className="px-3 py-3"><div>{r.countryName || "—"}</div><div className="text-[11px] text-slate-500">{r.branchName}</div></td>
                    <td className="px-3 py-3 whitespace-nowrap" dir="ltr">{fmtDate(r.date)}</td>
                    <td className="px-3 py-3"><StagePill st={r.stage} />{r.destinationType && <div className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{destLabel(r.destinationType)}{r.customerName ? ` · ${r.customerName}` : ""}{r.transferNo ? ` · ${r.transferNo}` : ""}</div>}</td>
                    <td className="px-3 py-3"><Indicators r={r} /></td>
                    <td className="px-3 py-3 tabular-nums text-[12px]" dir="ltr">{r.loadingRecordId ? <div className="grid grid-cols-5 gap-x-2 text-center"><span title={s.t("col_loaded", "Loaded")}>{fmtNum(r.loadedQuantity)}</span><span title={s.t("col_received", "Received")}>{fmtNum(r.receivedQuantity)}</span><span title={s.t("col_damage", "Damage")} className={r.damagedQuantity > 0 ? "font-bold text-red-700" : ""}>{fmtNum(r.damagedQuantity)}</span><span title={s.t("col_shortage", "Shortage")} className={r.shortageQuantity > 0 ? "font-bold text-red-700" : ""}>{fmtNum(r.shortageQuantity)}</span><span title={s.t("col_outstanding", "Outstanding")} className={r.outstandingQuantity > 0 ? "font-bold text-amber-700" : ""}>{fmtNum(r.outstandingQuantity)}</span></div> : "—"}</td>
                    <td className="px-3 py-3 text-[12px] font-semibold">{r.loadingRecordId ? customsLabel(r.customsStatus) : "—"}</td>
                    <td className="px-3 py-3">{r.truckOrContainer || "—"}{r.loadingRecordNo && <div className="text-[11px] text-slate-500">{r.loadingRecordNo}</div>}</td>
                    <td className="px-3 py-3">{r.warehouseName || "—"}</td>
                    <td className="px-3 py-3"><Actions r={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <div aria-busy={loading} className={`space-y-3 transition-opacity md:hidden ${loading ? "opacity-50" : ""}`} data-testid="sj-cards">
            {!loading && rows.length === 0 && <div className="rounded-2xl border bg-white p-8 text-center text-[14px] text-slate-500 dark:bg-slate-800">{s.t("empty", "No stock records match these filters.")}</div>}
            {rows.map((r) => (
              <div key={r.id} data-testid="sj-row" data-stage={r.stage} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="truncate text-[15px] font-black text-slate-900 dark:text-slate-50">{r.billNumber}</div><div className="truncate text-[13px] font-bold">{r.productName || s.t("goods_not_entered", "Goods not entered")}</div><div className="truncate text-[12px] text-slate-500">{r.supplierName}</div></div>
                  <StagePill st={r.stage} />
                </div>
                <div className="flex items-baseline gap-2" dir="ltr"><span className="text-[20px] font-black tabular-nums">{fmtNum(r.quantity)}</span><span className="text-[13px] text-slate-500">{r.unit}</span>{r.currencyCode && <span className="text-[12px] text-slate-500">· {r.currencyCode}</span>}</div>
                {r.quantityNotEntered && <div className="text-[12px] font-bold text-amber-700">{s.t("qty_not_entered", "Quantity not entered yet")}</div>}
                <Indicators r={r} />
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-slate-600 dark:text-slate-300">
                  <span>{r.countryName} · {r.branchName}</span><span dir="ltr">{fmtDate(r.date)}</span>
                  {r.truckOrContainer && <span>{r.truckOrContainer}</span>}{r.warehouseName && <span>{r.warehouseName}</span>}
                  {r.loadingRecordId && <span className="col-span-2" dir="ltr">{s.t("col_loaded", "Loaded")} {fmtNum(r.loadedQuantity)} · {s.t("col_received", "Received")} {fmtNum(r.receivedQuantity)} · {s.t("col_damage", "Damage")} {fmtNum(r.damagedQuantity)} · {s.t("col_shortage", "Shortage")} {fmtNum(r.shortageQuantity)}</span>}
                  {r.loadingRecordId && <span className="col-span-2 font-semibold">{customsLabel(r.customsStatus)}</span>}
                </div>
                <Actions r={r} />
              </div>
            ))}
          </div>

          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold dark:border-slate-700 dark:bg-slate-800">
              <span>{s.t("page", "Page")} {data.pagination.page} / {data.pagination.totalPages} · {data.pagination.totalRecords} {s.t("lines", "lines")}</span>
              <span className="flex gap-1.5">
                <button type="button" disabled={page <= 1} onClick={() => void load(page - 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-30 dark:border-slate-600" aria-label={s.t("prev", "Previous")}>{s.isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
                <button type="button" disabled={page >= data.pagination.totalPages} onClick={() => void load(page + 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-30 dark:border-slate-600" aria-label={s.t("next", "Next")}>{s.isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
              </span>
            </div>
          )}
        </>
      )}

      {confirmRow && <ConfirmModal s={s} row={confirmRow} warehouses={warehouses} destLabel={destLabel} onClose={() => setConfirmRow(null)} onDone={(m) => { setConfirmRow(null); refreshAfter(m); }} />}
      {issueRow && <IssueModal s={s} row={issueRow} onClose={() => setIssueRow(null)} onDone={(m) => { setIssueRow(null); refreshAfter(m); }} />}
      {reverseRow && <ReverseModal s={s} row={reverseRow} onClose={() => setReverseRow(null)} onDone={(m) => { setReverseRow(null); refreshAfter(m); }} />}
      {customsRow && <CustomsModal s={s} row={customsRow} onClose={() => setCustomsRow(null)} onDone={(m) => { setCustomsRow(null); refreshAfter(m); }} />}
      {historyRow && <HistoryModal s={s} target={historyRow} onClose={() => setHistoryRow(null)} />}
    </div>
  );
}

/* ─────────────────────────── modals ─────────────────────────── */

type S = ReturnType<typeof useErpScreen>;
const inputCls = "min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] dark:border-slate-600 dark:bg-slate-900";
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block space-y-1"><span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{label}</span>{children}{hint && <span className="block text-[12px] text-slate-500">{hint}</span>}</label>
);
const ErrorBox = ({ msg }: { msg: string | null }) => (msg ? <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-[13px] font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{msg}</div> : null);
const SubmitBar = ({ s, busy, disabled, label, onCancel, tone = "bg-emerald-600 hover:bg-emerald-700", testId }: { s: S; busy: boolean; disabled?: boolean; label: string; onCancel: () => void; tone?: string; testId: string }) => (
  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
    <button type="button" onClick={onCancel} className="min-h-[44px] rounded-lg border border-slate-300 px-4 text-[14px] font-bold text-slate-700 dark:border-slate-600 dark:text-slate-100">{s.t("cancel", "Cancel")}</button>
    <button type="submit" data-testid={testId} disabled={busy || disabled} className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 text-[14px] font-bold text-white disabled:opacity-50 ${tone}`}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{label}</button>
  </div>
);

function ConfirmModal({ s, row, warehouses, destLabel, onClose, onDone }: { s: S; row: StockJournalRow; warehouses: Warehouse[]; destLabel: (d: string | null) => string; onClose: () => void; onDone: (m: string) => void }) {
  const [dest, setDest] = useState<DestinationType>("warehouse");
  const [warehouseId, setWarehouseId] = useState(row.warehouseId ?? "");
  const [qty, setQty] = useState(String(row.quantity));
  const [customerQ, setCustomerQ] = useState("");
  const [customer, setCustomer] = useState<{ id: string | null; name: string } | null>(null);
  const [results, setResults] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [salesNo, setSalesNo] = useState("");
  const [docRef, setDocRef] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = useRef(newKey());
  const holding = row.warehouseId; // stock physically sits here (received)
  const needsCustomer = dest === "direct_sale";
  const options: { v: DestinationType; icon: React.ComponentType<any>; label: string; hint: string }[] = [
    { v: "warehouse", icon: WarehouseIcon, label: s.t("dest_warehouse", "Warehouse Storage"), hint: s.t("dest_warehouse_hint", "Store in a warehouse (moves stock if it is a different warehouse).") },
    { v: "local_sales", icon: ShoppingBag, label: s.t("dest_local", "Local Market Stock"), hint: s.t("dest_local_hint", "Keep as local-market stock for branch sales.") },
    { v: "export", icon: Ship, label: s.t("dest_export", "Export Stock"), hint: s.t("dest_export_hint", "Reserve for an export shipment.") },
    { v: "direct_sale", icon: ArrowLeftRight, label: s.t("dest_direct", "Direct Sale / Delivery"), hint: s.t("dest_direct_hint", "Reserve for a customer sale or delivery.") },
  ];

  useEffect(() => {
    if (customerQ.trim().length < 2) { setResults([]); return; }
    const ac = new AbortController();
    const id = window.setTimeout(async () => {
      const r = await api<any>(`/api/erp/customers?q=${encodeURIComponent(customerQ.trim())}&limit=12`, { signal: ac.signal });
      const list = r.ok ? (r.data?.customers ?? r.data?.rows ?? r.data ?? []) : [];
      setResults((Array.isArray(list) ? list : []).slice(0, 12).map((c: any) => ({ id: c.id, name: c.customer_name || c.name || [c.first_name, c.last_name].filter(Boolean).join(" "), code: c.person_code })));
    }, 250);
    return () => { window.clearTimeout(id); ac.abort(); };
  }, [customerQ]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const q = Number(qty);
    if (!(q > 0) || q > row.quantity + 0.0001) return setErr(`${s.t("err_qty", "Quantity must be between 0 and")} ${fmtNum(row.quantity)}`);
    if (dest === "warehouse" && !warehouseId) return setErr(s.t("err_warehouse", "Select the warehouse."));
    if (needsCustomer && !customer && !customerQ.trim()) return setErr(s.t("err_customer", "Select the customer for a Direct Sale / Delivery."));
    if (!authorized) return setErr(s.t("err_authorize", "Tick the authorization box to confirm the allocation."));
    setBusy(true);
    const res = await api<any>("/api/erp/inventory/journal-stock/confirm", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: key.current, purchaseOrderId: row.sourceId, loadingRecordId: row.loadingRecordId, lineKey: row.lineKey, destinationType: dest,
        warehouseId: dest === "warehouse" ? warehouseId : holding || warehouseId || null, quantity: q,
        customerId: customer?.id ?? null, customerName: customer?.name || customerQ.trim() || null, salesOrderNo: salesNo.trim() || null,
        documentRef: docRef.trim() || null, remarks: remarks.trim() || null, transferDate: date, authorized: true,
      }),
    });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(`${s.t("ok_confirmed", "Stock confirmed")}: ${res.data?.transfer?.transfer_no ?? ""}`);
  };

  return (
    <SimpleModal title={s.t("confirm_title", "Confirm Stock")} onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={submit} className="space-y-4" data-testid="sj-confirm-form">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-[13px] dark:bg-slate-900/50 sm:grid-cols-3">
          <div><div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_bill", "Purchase No.")}</div><div className="font-black">{row.billNumber}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_product", "Product")}</div><div className="font-black">{row.productName}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_container", "Container / Truck")}</div><div className="font-black">{row.truckOrContainer || "—"}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_country_branch", "Country / Branch")}</div><div className="font-black">{row.countryName} · {row.branchName}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-slate-500">{s.t("ready_qty", "Ready to confirm")}</div><div className="font-black tabular-nums" dir="ltr">{fmtNum(row.quantity)} {row.unit}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_customs", "Customs")}</div><div className="font-black">{s.t("customs_cleared", "Customs: Cleared")}</div></div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{s.t("destination", "Destination")}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((o) => {
              const Icon = o.icon;
              return (
                <button type="button" key={o.v} data-testid={`sj-dest-${o.v}`} aria-pressed={dest === o.v} onClick={() => setDest(o.v)} className={`flex min-h-[64px] items-start gap-3 rounded-xl border p-3 text-start transition ${dest === o.v ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 dark:bg-emerald-950/30" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"}`}>
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <span><span className="block text-[14px] font-black">{o.label}</span><span className="block text-[12px] text-slate-600 dark:text-slate-300">{o.hint}</span></span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={s.t("col_warehouse", "Warehouse")} hint={dest !== "warehouse" && holding ? s.t("stays_in_wh", "The stock stays in the warehouse that holds it.") : undefined}>
            <select data-testid="sj-warehouse" value={dest === "warehouse" ? warehouseId : holding || warehouseId} disabled={dest !== "warehouse" && !!holding} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
              <option value="">{s.t("select_warehouse", "Select warehouse")}</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
            </select>
          </Field>
          <Field label={s.t("col_qty", "Quantity")}>
            <div className="flex gap-2"><input data-testid="sj-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} dir="ltr" /><button type="button" onClick={() => setQty(String(row.quantity))} className="min-h-[44px] shrink-0 rounded-lg border border-slate-300 px-3 text-[12px] font-bold dark:border-slate-600">{s.t("max", "All")}</button></div>
          </Field>
        </div>

        {(dest === "direct_sale" || dest === "export") && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={`${s.t("col_customer", "Customer")}${needsCustomer ? " *" : ""}`}>
              <div className="relative">
                <input data-testid="sj-customer" value={customer ? customer.name : customerQ} onChange={(e) => { setCustomer(null); setCustomerQ(e.target.value); }} placeholder={s.t("customer_ph", "Type 2+ letters to search")} className={inputCls} />
                {!customer && results.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
                    {results.map((c) => <li key={c.id}><button type="button" onClick={() => { setCustomer({ id: c.id, name: c.name }); setResults([]); }} className="block min-h-[40px] w-full px-3 text-start text-[13px] hover:bg-slate-100 dark:hover:bg-slate-700">{c.name}{c.code ? ` · ${c.code}` : ""}</button></li>)}
                  </ul>
                )}
              </div>
            </Field>
            <Field label={s.t("sales_ref", "Sales booking no.")}><input data-testid="sj-salesno" value={salesNo} onChange={(e) => setSalesNo(e.target.value)} className={inputCls} dir="ltr" /></Field>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={s.t("doc_ref", "Document reference")}><input data-testid="sj-docref" value={docRef} onChange={(e) => setDocRef(e.target.value)} className={inputCls} dir="ltr" /></Field>
          <Field label={s.t("col_date", "Date")}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label={s.t("remarks", "Remarks")}><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={`${inputCls} py-2`} /></Field>

        <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <input data-testid="sj-authorize" type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{s.t("authorize", "I am an authorized user and I confirm this allocation of")} {fmtNum(Number(qty) || 0)} {row.unit} → {destLabel(dest)}.</span>
        </label>
        <ErrorBox msg={err} />
        <SubmitBar s={s} busy={busy} label={s.t("confirm_submit", "Confirm allocation")} onCancel={onClose} testId="sj-confirm-submit" />
      </form>
    </SimpleModal>
  );
}

function IssueModal({ s, row, onClose, onDone }: { s: S; row: { id: string; label: string; qty: number; unit: string; salesOrderNo: string | null }; onClose: () => void; onDone: (m: string) => void }) {
  const [type, setType] = useState<"goods_issue" | "dispatch" | "delivery">("delivery");
  const [ref, setRef] = useState("");
  const [so, setSo] = useState(row.salesOrderNo ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!ref.trim()) return setErr(s.t("err_issue_ref", "Enter the document reference."));
    setBusy(true);
    const res = await api<any>("/api/erp/inventory/journal-stock/issue", { method: "POST", body: JSON.stringify({ transferId: row.id, issueType: type, issueRef: ref.trim(), salesOrderNo: so.trim() || null }) });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(`${s.t("ok_issued", "Stock issued")}: ${res.data?.transfer?.transfer_no ?? ""}`);
  };
  return (
    <SimpleModal title={s.t("issue_title", "Goods Issue / Dispatch / Delivery")} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-4" data-testid="sj-issue-form">
        <div className="rounded-xl bg-slate-50 p-3 text-[13px] font-bold dark:bg-slate-900/50">{row.label} · <span dir="ltr">{fmtNum(row.qty)} {row.unit}</span></div>
        <p className="text-[13px] text-slate-600 dark:text-slate-300">{s.t("issue_note", "Physical stock is deducted only now, once. Issuing the same allocation again changes nothing.")}</p>
        <Field label={s.t("issue_type", "Event")}>
          <select data-testid="sj-issue-type" value={type} onChange={(e) => setType(e.target.value as any)} className={inputCls}>
            <option value="goods_issue">{s.t("issue_goods_issue", "Goods Issue")}</option>
            <option value="dispatch">{s.t("issue_dispatch", "Dispatch")}</option>
            <option value="delivery">{s.t("issue_delivery", "Delivery")}</option>
          </select>
        </Field>
        <Field label={`${s.t("doc_ref", "Document reference")} *`}><input data-testid="sj-issue-ref" value={ref} onChange={(e) => setRef(e.target.value)} className={inputCls} dir="ltr" /></Field>
        <Field label={s.t("sales_ref", "Sales booking no.")}><input value={so} onChange={(e) => setSo(e.target.value)} className={inputCls} dir="ltr" /></Field>
        <ErrorBox msg={err} />
        <SubmitBar s={s} busy={busy} label={s.t("issue_submit", "Issue stock")} onCancel={onClose} tone="bg-blue-600 hover:bg-blue-700" testId="sj-issue-submit" />
      </form>
    </SimpleModal>
  );
}

function ReverseModal({ s, row, onClose, onDone }: { s: S; row: { id: string; label: string }; onClose: () => void; onDone: (m: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (reason.trim().length < 3) return setErr(s.t("err_reason", "Enter the reason for the reversal."));
    setBusy(true);
    const res = await api<any>("/api/erp/inventory/journal-stock/reverse", { method: "POST", body: JSON.stringify({ transferId: row.id, reason: reason.trim() }) });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(`${s.t("ok_reversed", "Allocation reversed")}: ${res.data?.transfer?.transfer_no ?? ""}`);
  };
  return (
    <SimpleModal title={s.t("reverse_title", "Reverse allocation")} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-4" data-testid="sj-reverse-form">
        <div className="rounded-xl bg-slate-50 p-3 text-[13px] font-bold dark:bg-slate-900/50">{row.label}</div>
        <p className="text-[13px] text-slate-600 dark:text-slate-300">{s.t("reverse_note", "The reservation is released and any warehouse move is put back. The record stays in the audit trail.")}</p>
        <Field label={`${s.t("reason", "Reason")} *`}><textarea data-testid="sj-reverse-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputCls} py-2`} /></Field>
        <ErrorBox msg={err} />
        <SubmitBar s={s} busy={busy} label={s.t("reverse_submit", "Reverse")} onCancel={onClose} tone="bg-red-600 hover:bg-red-700" testId="sj-reverse-submit" />
      </form>
    </SimpleModal>
  );
}

function CustomsModal({ s, row, onClose, onDone }: { s: S; row: StockJournalRow; onClose: () => void; onDone: (m: string) => void }) {
  const [status, setStatus] = useState<"pending" | "submitted" | "cleared" | "not_applicable">(row.customsStatus === "not_recorded" ? "cleared" : (row.customsStatus as any));
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await api<any>("/api/erp/inventory/journal-stock/customs", { method: "POST", body: JSON.stringify({ loadingRecordId: row.loadingRecordId, customsStatus: status, reference: ref.trim() || null }) });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(s.t("ok_customs", "Customs status saved"));
  };
  return (
    <SimpleModal title={s.t("customs_title", "Customs status")} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4" data-testid="sj-customs-form">
        <div className="rounded-xl bg-slate-50 p-3 text-[13px] font-bold dark:bg-slate-900/50">{row.billNumber} · {row.truckOrContainer || row.loadingRecordNo}</div>
        <Field label={s.t("col_status", "Status")}>
          <select data-testid="sj-customs-status" value={status} onChange={(e) => setStatus(e.target.value as any)} className={inputCls}>
            <option value="pending">{s.t("customs_pending", "Customs: Pending")}</option>
            <option value="submitted">{s.t("customs_submitted", "Customs: Submitted")}</option>
            <option value="cleared">{s.t("customs_cleared", "Customs: Cleared")}</option>
            <option value="not_applicable">{s.t("customs_na", "Customs: Not required")}</option>
          </select>
        </Field>
        <Field label={s.t("doc_ref", "Document reference")}><input value={ref} onChange={(e) => setRef(e.target.value)} className={inputCls} dir="ltr" /></Field>
        <ErrorBox msg={err} />
        <SubmitBar s={s} busy={busy} label={s.t("save", "Save")} onCancel={onClose} tone="bg-orange-600 hover:bg-orange-700" testId="sj-customs-submit" />
      </form>
    </SimpleModal>
  );
}

function HistoryModal({ s, target, onClose }: { s: S; target: { sourceType: string; sourceId: string; loadingRecordId?: string | null; title: string }; onClose: () => void }) {
  const [state, setState] = useState<{ loading: boolean; error?: string; head?: any; events?: HistoryEvent[] }>({ loading: true });
  useEffect(() => {
    let alive = true;
    const p = new URLSearchParams({ sourceType: target.sourceType, sourceId: target.sourceId });
    if (target.loadingRecordId) p.set("loadingRecordId", target.loadingRecordId);
    void api<any>(`/api/erp/inventory/journal-stock/history?${p}`).then((r) => {
      if (!alive) return;
      setState(r.ok ? { loading: false, head: r.data.head, events: r.data.events } : { loading: false, error: r.message });
    });
    return () => { alive = false; };
  }, [target]);
  const title = (e: HistoryEvent) => {
    const dest = e.title.replace(/^confirmed_/, "");
    const map: Record<string, string> = {
      booking_created: s.t("ev_booking", "Purchase booking created"),
      loaded: s.t("ev_loaded", "Loaded"),
      received: s.t("ev_received", "Received at destination"),
      customs_cleared: s.t("ev_customs_cleared", "Customs cleared"),
      customs_pending: s.t("ev_customs_pending", "Customs pending"),
      customs_submitted: s.t("ev_customs_submitted", "Customs submitted"),
      customs_not_applicable: s.t("ev_customs_na", "Customs not required"),
      stock_in: s.t("ev_stock_in", "Warehouse stock in"),
      stock_out: s.t("ev_stock_out", "Warehouse stock out"),
      reversed: s.t("ev_reversed", "Allocation reversed"),
      issued_goods_issue: s.t("ev_goods_issue", "Goods issued"),
      issued_dispatch: s.t("ev_dispatch", "Dispatched"),
      issued_delivery: s.t("ev_delivery", "Delivered"),
    };
    if (e.title.startsWith("confirmed_")) return `${s.t("ev_confirmed", "Stock confirmed")} → ${({ warehouse: s.t("dest_warehouse", "Warehouse Storage"), local_sales: s.t("dest_local", "Local Market Stock"), export: s.t("dest_export", "Export Stock"), direct_sale: s.t("dest_direct", "Direct Sale / Delivery") } as Record<string, string>)[dest] || dest}`;
    if (e.title.startsWith("lot_")) return `${s.t("ev_lot", "Goods Transfer Journal")}: ${e.title.slice(4)}`;
    return map[e.title] || e.title;
  };
  const tone = (t: string) => ({ booking: "bg-blue-600", loading: "bg-amber-600", received: "bg-orange-600", customs: "bg-orange-500", stock_in: "bg-emerald-600", stock_out: "bg-slate-600", confirmed: "bg-emerald-700", issued: "bg-blue-700", reversed: "bg-red-600", lot_move: "bg-teal-600", payment: "bg-violet-600" } as Record<string, string>)[t] || "bg-slate-500";
  return (
    <SimpleModal title={`${s.t("history_title", "Transaction history")} — ${target.title}`} onClose={onClose} maxWidth="max-w-3xl">
      <div data-testid="sj-history-modal" className="space-y-3">
        {state.loading && <div className="flex items-center justify-center gap-2 p-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />{s.t("loading", "Loading…")}</div>}
        {state.error && <ErrorBox msg={state.error} />}
        {state.head && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-[13px] dark:bg-slate-900/50 sm:grid-cols-4">
            <div><div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_bill", "Purchase No.")}</div><div className="font-black">{state.head.billNo}</div></div>
            <div><div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_supplier", "Supplier")}</div><div className="font-black">{state.head.supplier || "—"}</div></div>
            <div><div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_country", "Country")}</div><div className="font-black">{state.head.country || "—"}</div></div>
            <div><div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_product", "Product")}</div><div className="font-black">{(state.head.goods || []).map((g: any) => `${g.name} ${fmtNum(g.booked)} ${g.unit}`).join(" · ") || "—"}</div></div>
          </div>
        )}
        {state.events && state.events.length === 0 && <div className="p-6 text-center text-[14px] text-slate-500">{s.t("empty", "No stock records match these filters.")}</div>}
        <ol className="space-y-2">
          {(state.events ?? []).map((e, i) => (
            <li key={i} data-testid="sj-event" className="flex gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${tone(e.type)}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-[14px] font-black">{title(e)}</span><span className="text-[12px] text-slate-500" dir="ltr">{new Date(e.at).toISOString().replace("T", " ").slice(0, 16)}</span></div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-slate-600 dark:text-slate-300">
                  {e.quantity != null && <span dir="ltr">{fmtNum(e.quantity)} {e.unit || ""}</span>}
                  {e.reference && <span>{e.reference}</span>}
                  {e.warehouse && <span>{e.warehouse}</span>}
                  {e.actor && <span>{e.actor}</span>}
                  {e.note && <span className="text-slate-500">{e.note}</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </SimpleModal>
  );
}
