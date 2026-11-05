"use client";

/**
 * Purchase Journal Booking Stock (issue #38) - Purchase Booking bills only, table first.
 * Three compact panels (Purchase Summary, Confirm Stock, Country-wise Purchase Stock) above one parent row per bill; "+" opens the bill overview,
 * its loading / receipt entries (<Purchase No>-01, -02 ...) and the read-only invoice detail. Data = GET /api/erp/inventory/journal-stock?view=bills,
 * i.e. the canonical, server-scoped Stock Journal regrouped per bill (lib/stock-journal/booking-register.ts). No payment column, no stock action here:
 * stock is confirmed / issued in the Stock Journal (Purchase General Stock).
 */
import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Search, X } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";
import type { BillStatus, CountryStock, EntryConfirmation, EntryReceiving, RegisterBill, RegisterEntry, RegisterPanels, UnitQty, Weighted } from "@/lib/stock-journal/booking-register";

type Resp = { bills: RegisterBill[]; panels: RegisterPanels; pagination: { page: number; limit: number; totalRecords: number; totalPages: number } };
const PAGE = 25;
const STATUSES: BillStatus[] = ["draft", "booked", "partially_loaded", "in_transit", "partially_received", "received", "partially_confirmed", "confirmed"];
const STATUS_TONE: Record<BillStatus, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  booked: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  partially_loaded: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  in_transit: "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900",
  partially_received: "bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  received: "bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100",
  partially_confirmed: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  confirmed: "bg-emerald-600 text-white",
};

const nq = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2 });
const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "—");
const fmtQty = (q: UnitQty | undefined) => {
  const parts = Object.entries(q ?? {}).filter(([, v]) => Math.abs(v) > 0.0001);
  return parts.length ? parts.map(([u, v]) => `${nq(v)} ${u === "-" ? "" : u}`.trim()).join(" · ") : "0";
};
const kg = (v: number) => `${nq(v)} kg`;

function Qty({ q, strong }: { q: UnitQty | undefined; strong?: boolean }) {
  return <span dir="ltr" className={`tabular-nums ${strong ? "font-black" : "font-semibold"}`}>{fmtQty(q)}</span>;
}

export function PurchaseJournalBookingRegister({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("pjb", langProp);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | BillStatus>("");
  const [place, setPlace] = useState<CountryStock | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const statusLabel = useCallback((st: BillStatus) => s.t(`st_${st}`, st.replace(/_/g, " ")), [s]);
  const receivingLabel = (r: EntryReceiving) => s.t(`rcv_${r}`, r.replace(/_/g, " "));
  const confirmLabel = (c: EntryConfirmation) => s.t(`cnf_${c}`, c.replace(/_/g, " "));
  const modeLabel = (m: string) => {
    const k = m.toLowerCase();
    if (/sea|ship|vessel|container/.test(k)) return s.t("mode_sea", "Sea");
    if (/air|flight|awb/.test(k)) return s.t("mode_air", "Air");
    if (/road|truck|land/.test(k)) return s.t("mode_road", "Road");
    if (/rail|train/.test(k)) return s.t("mode_rail", "Rail");
    return m || "—";
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ view: "bills", page: String(page), limit: String(PAGE), lang: s.lang });
      if (query) qs.set("search", query);
      if (status) qs.set("status", status);
      if (place) qs.set("place", place.key);
      setData(await apiGet<Resp>(`/api/erp/inventory/journal-stock?${qs.toString()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [page, query, status, place, s.lang]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, status, place]);
  useEffect(() => { const h = setTimeout(() => setQuery(search.trim()), 350); return () => clearTimeout(h); }, [search]);

  const panels = data?.panels;
  const bills = data?.bills ?? [];

  // ── print / PDF / Excel: the register and one bill (shared A4 engine) ──
  const registerReport = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: s.t("title", "Purchase Journal Booking Stock"),
    subtitle: [place ? `${place.countryName} / ${place.branchName}` : "", status ? statusLabel(status) : "", query].filter(Boolean).join(" · ") || undefined,
    lang: s.lang,
    orientation: "landscape" as const,
    kpis: panels ? [
      { label: s.t("p_bills", "Bills"), value: String(panels.purchase.bills), color: "slate" as const },
      { label: s.t("p_booked", "Booked"), value: fmtQty(panels.purchase.booked), color: "blue" as const },
      { label: s.t("c_transit", "In Transit"), value: fmtQty(panels.confirm.inTransit.qty), color: "amber" as const },
      { label: s.t("c_confirmed", "Confirmed Stock"), value: fmtQty(panels.confirm.confirmed.qty), color: "emerald" as const },
    ] : [],
    columns: [
      { key: "purchaseNo", label: s.t("col_purchase_no", "Purchase No") },
      { key: "date", label: s.t("col_date", "Date") },
      { key: "place", label: s.t("col_place", "Country / Branch") },
      { key: "supplierName", label: s.t("col_supplier", "Supplier") },
      { key: "goodsText", label: s.t("col_goods", "Goods / Lot") },
      { key: "bookedText", label: s.t("col_qty", "Quantity"), align: "right" as const },
      { key: "grossText", label: s.t("col_gross", "Gross kg"), align: "right" as const },
      { key: "netText", label: s.t("col_net", "Net kg"), align: "right" as const },
      { key: "entriesCount", label: s.t("pr_entries", "Entries"), align: "center" as const },
      { key: "loadedText", label: s.t("pr_loaded", "Loaded"), align: "right" as const },
      { key: "receivedText", label: s.t("pr_received", "Received"), align: "right" as const },
      { key: "confirmedText", label: s.t("pr_confirmed", "Confirmed"), align: "right" as const },
      { key: "pendingText", label: s.t("pr_pending", "Pending"), align: "right" as const },
      { key: "statusText", label: s.t("col_status", "Status") },
    ],
    rows: bills.map((b) => ({
      purchaseNo: b.purchaseNo, date: day(b.date), place: `${b.countryName} / ${b.branchName}`, supplierName: b.supplierName,
      goodsText: b.goods.map((g) => [g.name, g.brand, g.size].filter(Boolean).join(" ")).join(", "), bookedText: fmtQty(b.booked), grossText: nq(b.gross), netText: nq(b.net),
      entriesCount: b.entries.length, loadedText: fmtQty(b.loaded), receivedText: fmtQty(b.received), confirmedText: fmtQty(b.confirmed), pendingText: fmtQty(b.pending),
      statusText: statusLabel(b.status),
    })),
  });
  const billReport = (b: RegisterBill) => () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: `${s.t("bill_print_title", "Purchase Booking Bill")} ${b.purchaseNo}`,
    subtitle: [b.manualNo, day(b.date), `${b.countryName} / ${b.branchName}`, b.supplierName].filter(Boolean).join(" · "),
    lang: s.lang,
    orientation: "portrait" as const,
    kpis: [
      { label: s.t("p_booked", "Booked"), value: fmtQty(b.booked), color: "blue" as const },
      { label: s.t("pr_loaded", "Loaded"), value: fmtQty(b.loaded), color: "slate" as const },
      { label: s.t("pr_received", "Received"), value: fmtQty(b.received), color: "amber" as const },
      { label: s.t("pr_confirmed", "Confirmed"), value: fmtQty(b.confirmed), color: "emerald" as const },
      { label: s.t("pr_pending", "Pending"), value: fmtQty(b.pending), color: "red" as const },
      ...(b.invoice ? [{ label: s.t("inv_purchase_amount", "Purchase invoice amount"), value: b.invoice.purchaseAmount == null ? "—" : `${nq(b.invoice.purchaseAmount)} ${b.invoice.currency}`, color: "slate" as const }] : []),
    ],
    columns: [
      { key: "entryNo", label: s.t("e_entry", "Entry") },
      { key: "date", label: s.t("col_date", "Date") },
      { key: "qty", label: s.t("col_qty", "Quantity"), align: "right" as const },
      { key: "gross", label: s.t("col_gross", "Gross kg"), align: "right" as const },
      { key: "net", label: s.t("col_net", "Net kg"), align: "right" as const },
      { key: "truck", label: s.t("e_truck", "Truck / Container") },
      { key: "route", label: s.t("e_route", "From → To") },
      { key: "receiving", label: s.t("e_receiving", "Receiving") },
      { key: "confirmation", label: s.t("e_confirmation", "Confirmation") },
    ],
    rows: b.entries.map((e) => ({
      entryNo: e.entryNo, date: day(e.date), qty: fmtQty(e.loaded), gross: nq(e.gross), net: nq(e.net), truck: [e.truckOrContainer, e.blNumber].filter(Boolean).join(" · "),
      route: `${e.loadingPlace || "—"} → ${e.receivingPlace || "—"}`, receiving: receivingLabel(e.receiving), confirmation: confirmLabel(e.confirmation),
    })),
  });

  const strip = (tone: string, label: string, w: Weighted | undefined, testid: string, note?: string) => (
    <div data-testid={testid} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg px-2.5 py-1.5 text-[11px] ${tone}`}>
      <span className="font-black uppercase tracking-wide">{label}</span>
      <span className="flex flex-wrap items-center gap-x-3" dir="ltr">
        <Qty q={w?.qty} strong />
        <span className="tabular-nums opacity-90">G {kg(w?.gross ?? 0)}</span>
        <span className="tabular-nums opacity-90">N {kg(w?.net ?? 0)}</span>
      </span>
      {note ? <span className="w-full text-[10px] opacity-80">{note}</span> : null}
    </div>
  );

  return (
    <div dir={s.dir} data-testid="pjb-register" className="mx-auto max-w-[1900px] space-y-3 p-2 text-slate-800 sm:p-4 dark:text-slate-100">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black tracking-tight text-slate-900 dark:text-white">{s.t("title", "Purchase Journal Booking Stock")}</h1>
          <p className="text-[11px] text-slate-500">{s.t("subtitle", "Purchase Booking bills only · booking → loading → receiving → confirmed stock. Local Purchase has its own Goods Transfer Journal.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/purchase/stock/journal" className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            {s.t("open_stock_journal", "Confirm / issue in Stock Journal")}
          </Link>
          <button type="button" onClick={() => void load()} aria-label={s.t("refresh", "Refresh")} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <UniversalPrintActionButton variant="menu" reportConfig={registerReport} />
        </div>
      </div>

      {/* three compact panels */}
      <div className="grid gap-2 lg:grid-cols-3" data-testid="pjb-panels">
        <section data-testid="pjb-panel-purchase" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">{s.t("panel_purchase", "Purchase Summary")}</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-slate-500">{s.t("p_bills", "Bills")}</dt><dd className="text-end font-black tabular-nums">{panels?.purchase.bills ?? "—"}</dd>
            <dt className="text-slate-500">{s.t("p_booked", "Booked")}</dt><dd className="text-end"><Qty q={panels?.purchase.booked} strong /></dd>
            <dt className="text-slate-500">{s.t("p_gross_net", "Gross / Net")}</dt><dd className="text-end tabular-nums" dir="ltr">{panels ? `${kg(panels.purchase.gross)} / ${kg(panels.purchase.net)}` : "—"}</dd>
            <dt className="text-slate-500">{s.t("p_loaded", "Loaded")}</dt><dd className="text-end"><Qty q={panels?.purchase.loaded} /></dd>
            <dt className="text-slate-500">{s.t("p_supplier_pending", "Supplier pending (booked − loaded)")}</dt><dd className="text-end text-rose-600 dark:text-rose-400"><Qty q={panels?.purchase.supplierPending} strong /></dd>
          </dl>
        </section>
        <section data-testid="pjb-panel-confirm" className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">{s.t("panel_confirm", "Confirm Stock")}</h2>
          {strip("bg-slate-900 text-white dark:bg-slate-700", s.t("c_transit", "In Transit"), panels?.confirm.inTransit, "pjb-strip-transit")}
          {strip("border border-emerald-300 bg-white text-emerald-800 dark:border-emerald-800 dark:bg-slate-950 dark:text-emerald-300", s.t("c_confirmed", "Confirmed Stock"), panels?.confirm.confirmed, "pjb-strip-confirmed",
            panels && Object.keys(panels.confirm.sold.qty).length ? `${s.t("c_sold_of_which", "of which issued / sold")}: ${fmtQty(panels.confirm.sold.qty)}` : undefined)}
          <div className="space-y-1 rounded-lg bg-rose-600 p-1.5 text-white" data-testid="pjb-strip-pending">
            <div className="px-1 text-[11px] font-black uppercase tracking-wide">{s.t("c_pending", "Pending")}</div>
            {strip("bg-rose-700/60", s.t("c_not_loaded", "Not loaded yet"), panels?.confirm.notLoaded, "pjb-pending-not-loaded")}
            {strip("bg-rose-700/60", s.t("c_awaiting", "Received, awaiting confirmation"), panels?.confirm.awaiting, "pjb-pending-awaiting")}
          </div>
          {panels && Object.values(panels.confirm).some((w) => w.weightMissing) ? <p className="text-[10px] text-slate-500">{s.t("weight_missing_note", "Some goods have no recorded weight; their kg are not estimated.")}</p> : null}
        </section>
        <section data-testid="pjb-panel-countries" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">{s.t("panel_countries", "Country-wise Purchase Stock")}</h2>
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {(panels?.countries ?? []).map((c) => (
              <button key={c.key} type="button" data-testid="pjb-country" onClick={() => setPlace(place?.key === c.key ? null : c)}
                className={`flex w-full flex-wrap items-center justify-between gap-x-2 rounded-lg border px-2 py-1 text-start text-[11px] ${place?.key === c.key ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"}`}>
                <span className="font-bold" dir="auto">{c.countryName} · {c.branchName || "—"}</span>
                <span className="flex flex-wrap gap-x-2 text-slate-600 dark:text-slate-300" dir="ltr">
                  <span>{c.bills} {s.t("p_bills", "Bills")}</span><Qty q={c.booked} /><span className="tabular-nums">G {kg(c.gross)}</span><span className="tabular-nums">N {kg(c.net)}</span>
                </span>
              </button>
            ))}
            {panels && panels.countries.length === 0 ? <p className="text-xs text-slate-400">{s.t("empty", "No Purchase Booking bills in your scope.")}</p> : null}
          </div>
        </section>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input data-testid="pjb-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={s.t("search_ph", "Search purchase no, supplier, goods, container, BL…")}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pe-2 ps-8 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" />
        </div>
        <select data-testid="pjb-status" value={status} onChange={(e) => setStatus(e.target.value as BillStatus | "")} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900">
          <option value="">{s.t("all_statuses", "All statuses")}</option>
          {STATUSES.map((st) => <option key={st} value={st}>{statusLabel(st)}</option>)}
        </select>
        {place ? (
          <button type="button" onClick={() => setPlace(null)} className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white" data-testid="pjb-place-chip">
            {place.countryName} · {place.branchName} <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

      {/* register: desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[1250px] text-xs" data-testid="pjb-table">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="w-8 p-2" />
              <th className="p-2 text-start">{s.t("col_purchase_no", "Purchase No")}</th>
              <th className="p-2 text-start">{s.t("col_place", "Country / Branch")}</th>
              <th className="p-2 text-start">{s.t("col_supplier", "Supplier")}</th>
              <th className="p-2 text-start">{s.t("col_goods", "Goods / Lot")}</th>
              <th className="p-2 text-end">{s.t("col_qty", "Quantity")}</th>
              <th className="p-2 text-end">{s.t("col_gross", "Gross kg")}</th>
              <th className="p-2 text-end">{s.t("col_net", "Net kg")}</th>
              <th className="p-2 text-start">{s.t("col_progress", "Entries | Loaded | Received | Confirmed | Pending")}</th>
              <th className="p-2 text-start">{s.t("col_status", "Status")}</th>
              <th className="w-10 p-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && bills.length === 0 ? (
              <tr><td colSpan={11} className="p-8 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : bills.length === 0 ? (
              <tr><td colSpan={11} className="p-8 text-center text-slate-400" data-testid="pjb-empty">{s.t("empty", "No Purchase Booking bills in your scope.")}</td></tr>
            ) : bills.map((b) => (
              <Fragment key={b.sourceId}>
                <tr data-testid="pjb-bill" className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="p-2">
                    <button type="button" data-testid="pjb-expand" aria-expanded={!!open[b.sourceId]} aria-label={s.t("expand", "Show entries")} onClick={() => setOpen((o) => ({ ...o, [b.sourceId]: !o[b.sourceId] }))}
                      className="rounded border border-slate-300 p-0.5 dark:border-slate-600">
                      {open[b.sourceId] ? <ChevronDown className="h-3.5 w-3.5" /> : s.isRtl ? <ChevronRight className="h-3.5 w-3.5 rotate-180" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                  <td className="p-2"><div className="font-mono font-black" dir="ltr">{b.purchaseNo}</div><div className="text-[10px] text-slate-500" dir="ltr">{day(b.date)}{b.manualNo ? ` · ${b.manualNo}` : ""}</div></td>
                  <td className="p-2" dir="auto">{b.countryName}<div className="text-[10px] text-slate-500">{b.branchName || "—"}</div></td>
                  <td className="p-2" dir="auto">{b.supplierName || "—"}</td>
                  <td className="p-2" dir="auto">{b.goods.map((g) => <div key={`${g.name}-${g.unit}`}>{g.name}{g.brand || g.size ? <span className="text-[10px] text-slate-500"> · {[g.brand, g.size].filter(Boolean).join(" ")}</span> : null}</div>)}</td>
                  <td className="p-2 text-end"><Qty q={b.booked} strong /></td>
                  <td className="p-2 text-end tabular-nums" dir="ltr">{nq(b.gross)}</td>
                  <td className="p-2 text-end tabular-nums" dir="ltr">{nq(b.net)}</td>
                  <td className="p-2" data-testid="pjb-progress">
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]" dir="ltr">
                      <span title={s.t("pr_entries", "Entries")} className="font-black">{b.entries.length}</span><span className="text-slate-300">|</span>
                      <span title={s.t("pr_loaded", "Loaded")}><Qty q={b.loaded} /></span><span className="text-slate-300">|</span>
                      <span title={s.t("pr_received", "Received")} className="text-sky-700 dark:text-sky-300"><Qty q={b.received} /></span><span className="text-slate-300">|</span>
                      <span title={s.t("pr_confirmed", "Confirmed")} className="text-emerald-700 dark:text-emerald-300"><Qty q={b.confirmed} /></span><span className="text-slate-300">|</span>
                      <span title={s.t("pr_pending", "Pending")} className="text-rose-600 dark:text-rose-400"><Qty q={b.pending} /></span>
                    </div>
                  </td>
                  <td className="p-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[b.status]}`}>{statusLabel(b.status)}</span></td>
                  <td className="p-2"><UniversalPrintActionButton variant="menu" reportConfig={billReport(b)} /></td>
                </tr>
                {open[b.sourceId] ? <tr><td colSpan={11} className="bg-slate-50/70 p-3 dark:bg-slate-950/40"><BillDetail s={s} b={b} modeLabel={modeLabel} receivingLabel={receivingLabel} confirmLabel={confirmLabel} /></td></tr> : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* register: phone cards */}
      <div className="space-y-2 md:hidden" data-testid="pjb-cards">
        {loading && bills.length === 0 ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /> : null}
        {!loading && bills.length === 0 ? <p className="text-center text-xs text-slate-400">{s.t("empty", "No Purchase Booking bills in your scope.")}</p> : null}
        {bills.map((b) => (
          <article key={b.sourceId} data-testid="pjb-bill-card" className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-mono font-black" dir="ltr">{b.purchaseNo}</div><div className="text-[10px] text-slate-500" dir="auto">{day(b.date)} · {b.countryName} · {b.branchName}</div></div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[b.status]}`}>{statusLabel(b.status)}</span>
            </div>
            <p className="mt-1" dir="auto">{b.supplierName} · {b.goods.map((g) => g.name).join(", ")}</p>
            <dl className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
              <div><dt className="text-slate-500">{s.t("col_qty", "Quantity")}</dt><dd><Qty q={b.booked} strong /></dd></div>
              <div><dt className="text-slate-500">{s.t("pr_loaded", "Loaded")}</dt><dd><Qty q={b.loaded} /></dd></div>
              <div><dt className="text-slate-500">{s.t("pr_confirmed", "Confirmed")}</dt><dd><Qty q={b.confirmed} /></dd></div>
              <div><dt className="text-slate-500">{s.t("pr_received", "Received")}</dt><dd><Qty q={b.received} /></dd></div>
              <div><dt className="text-slate-500">{s.t("pr_pending", "Pending")}</dt><dd><Qty q={b.pending} /></dd></div>
              <div><dt className="text-slate-500">{s.t("pr_entries", "Entries")}</dt><dd className="font-black">{b.entries.length}</dd></div>
            </dl>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [b.sourceId]: !o[b.sourceId] }))} className="rounded-lg border border-slate-300 px-2 py-1 font-bold dark:border-slate-600">
                {open[b.sourceId] ? s.t("collapse", "Hide entries") : s.t("expand", "Show entries")}
              </button>
              <UniversalPrintActionButton variant="menu" reportConfig={billReport(b)} />
            </div>
            {open[b.sourceId] ? <div className="mt-2"><BillDetail s={s} b={b} modeLabel={modeLabel} receivingLabel={receivingLabel} confirmLabel={confirmLabel} /></div> : null}
          </article>
        ))}
      </div>

      {/* paging */}
      {data && data.pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{s.t("page_of", "Page {p} of {n}").replace("{p}", String(data.pagination.page)).replace("{n}", String(data.pagination.totalPages))} · {data.pagination.totalRecords} {s.t("p_bills", "Bills")}</span>
          <span className="flex gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40 dark:border-slate-700">{s.t("prev", "Previous")}</button>
            <button type="button" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40 dark:border-slate-700">{s.t("next", "Next")}</button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function BillDetail({ s, b, modeLabel, receivingLabel, confirmLabel }: {
  s: ReturnType<typeof useErpScreen>; b: RegisterBill; modeLabel: (m: string) => string; receivingLabel: (r: EntryReceiving) => string; confirmLabel: (c: EntryConfirmation) => string;
}) {
  const kv = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-2 border-b border-dotted border-slate-200 py-0.5 dark:border-slate-700"><span className="text-slate-500">{label}</span><span className="text-end font-semibold" dir="auto">{value || "—"}</span></div>
  );
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1fr)]" data-testid="pjb-detail">
      <section className="rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-1 text-[11px] font-black uppercase text-slate-500">{s.t("sec_overview", "Purchase Booking Bill Overview")}</h3>
        {kv(s.t("col_purchase_no", "Purchase No"), <span dir="ltr">{b.purchaseNo}</span>)}
        {kv(s.t("ov_manual_no", "Manual bill no"), b.manualNo)}
        {kv(s.t("ov_booking_no", "Booking no"), <span dir="ltr">{b.bookingNo}</span>)}
        {kv(s.t("col_date", "Date"), <span dir="ltr">{day(b.date)}</span>)}
        {kv(s.t("col_supplier", "Supplier"), b.supplierName)}
        {kv(s.t("ov_origin", "Origin"), b.origin)}
        {kv(s.t("ov_booking_status", "Booking"), b.bookingStatus === "confirmed" ? s.t("ov_confirmed", "Confirmed") : s.t("st_draft", "Draft"))}
        <table className="mt-2 w-full">
          <thead><tr className="text-[10px] text-slate-500"><th className="text-start">{s.t("col_goods", "Goods / Lot")}</th><th className="text-end">{s.t("col_qty", "Quantity")}</th><th className="text-end">{s.t("col_gross", "Gross kg")}</th><th className="text-end">{s.t("col_net", "Net kg")}</th></tr></thead>
          <tbody>{b.goods.map((g, i) => <tr key={i}><td dir="auto">{g.name} <span className="text-slate-500">{[g.brand, g.size].filter(Boolean).join(" ")}</span></td><td className="text-end tabular-nums" dir="ltr">{nq(g.booked)} {g.unit}</td><td className="text-end tabular-nums" dir="ltr">{nq(g.gross)}</td><td className="text-end tabular-nums" dir="ltr">{nq(g.net)}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-1 text-[11px] font-black uppercase text-slate-500">{s.t("sec_entries", "Loading & receipt entries")}</h3>
        {b.entries.length === 0 ? <p className="text-slate-400">{s.t("no_entries", "Nothing loaded yet - the whole booking is pending.")}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]" data-testid="pjb-entries">
              <thead className="text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="p-1 text-start">{s.t("e_entry", "Entry")}</th><th className="p-1 text-start">{s.t("col_date", "Date")}</th><th className="p-1 text-start">{s.t("col_goods", "Goods / Lot")}</th>
                  <th className="p-1 text-end">{s.t("col_qty", "Quantity")}</th><th className="p-1 text-end">{s.t("col_gross", "Gross kg")}</th><th className="p-1 text-end">{s.t("col_net", "Net kg")}</th>
                  <th className="p-1 text-start">{s.t("e_truck", "Truck / Container")}</th><th className="p-1 text-start">BL</th><th className="p-1 text-start">{s.t("e_mode", "Mode")}</th>
                  <th className="p-1 text-start">{s.t("e_from", "Loading (place · date)")}</th><th className="p-1 text-start">{s.t("e_to", "Receiving (place · date)")}</th>
                  <th className="p-1 text-start">{s.t("e_receiving", "Receiving")}</th><th className="p-1 text-start">{s.t("e_confirmation", "Confirmation")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {b.entries.map((e: RegisterEntry) => (
                  <tr key={e.loadingRecordId} data-testid="pjb-entry">
                    <td className="p-1 font-mono font-bold" dir="ltr">{e.entryNo}<div className="text-[10px] font-normal text-slate-500">{e.loadingNo}</div></td>
                    <td className="p-1" dir="ltr">{day(e.date)}</td>
                    <td className="p-1" dir="auto">{e.goods}</td>
                    <td className="p-1 text-end"><Qty q={e.loaded} strong />{Object.keys(e.received).length ? <div className="text-[10px] text-sky-700 dark:text-sky-300">{s.t("pr_received", "Received")} <Qty q={e.received} /></div> : null}</td>
                    <td className="p-1 text-end tabular-nums" dir="ltr" title={e.weightRecorded ? "" : s.t("weight_derived", "derived from the booked weight of the same goods")}>{e.weightRecorded ? "" : "≈ "}{nq(e.gross)}</td>
                    <td className="p-1 text-end tabular-nums" dir="ltr">{e.weightRecorded ? "" : "≈ "}{nq(e.net)}</td>
                    <td className="p-1" dir="ltr">{e.truckOrContainer || "—"}</td>
                    <td className="p-1" dir="ltr">{e.blNumber || "—"}</td>
                    <td className="p-1">{modeLabel(e.transportMode)}</td>
                    <td className="p-1" dir="auto">{e.loadingPlace || "—"}<div className="text-[10px] text-slate-500" dir="ltr">{day(e.departureDate)}</div></td>
                    <td className="p-1" dir="auto">{e.receivingPlace || "—"}<div className="text-[10px] text-slate-500" dir="ltr">{day(e.receivedAt ?? e.arrivalDate)}{e.arrivalExpected && !e.receivedAt ? ` (${s.t("e_expected", "expected")})` : ""}</div></td>
                    <td className="p-1">{receivingLabel(e.receiving)}</td>
                    <td className="p-1">{confirmLabel(e.confirmation)}{Object.keys(e.confirmed).length ? <div className="text-[10px] text-emerald-700 dark:text-emerald-300"><Qty q={e.confirmed} /></div> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] dark:border-slate-700 dark:bg-slate-900" data-testid="pjb-invoice">
        <h3 className="mb-1 text-[11px] font-black uppercase text-slate-500">{s.t("sec_invoice", "Invoice & amount (read-only)")}</h3>
        {b.invoice ? (
          <>
            {kv(s.t("inv_no", "Linked invoice"), <span dir="ltr">{b.invoice.invoiceNo || b.invoiceNo}</span>)}
            {kv(s.t("inv_currency", "Original currency"), <span dir="ltr">{b.invoice.currency}</span>)}
            {kv(s.t("inv_rate", "Exchange rate"), <span dir="ltr">{b.invoice.exchangeRate ?? "—"}</span>)}
            {kv(s.t("inv_purchase_amount", "Purchase invoice amount"), <span dir="ltr">{b.invoice.purchaseAmount == null ? "—" : `${nq(b.invoice.purchaseAmount)} ${b.invoice.currency}`}</span>)}
            {kv(s.t("inv_final_amount", "Final invoice amount"), <span dir="ltr">{b.invoice.finalAmount == null ? "—" : `${nq(b.invoice.finalAmount)} ${b.invoice.finalCurrency}`}</span>)}
            {kv(s.t("inv_status", "Invoice"), b.invoiceStatus === "posted" ? s.t("inv_posted", "Posted") : s.t("inv_unposted", "Not posted"))}
          </>
        ) : <p className="text-slate-400">—</p>}
      </section>
    </div>
  );
}
