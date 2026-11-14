"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { translateHeader } from "@/lib/i18n/table-headers";
import { CurrentStockTab, SalesTab, useLotRegister } from "./lot-current-stock";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { branchLabel, groupRegister, type RegisterGroup, type WarehouseBalanceRow } from "@/lib/stock/warehouse-register";
import { type DestinationCategory, type PurchaseRow } from "@/lib/stock/purchase-movements";

type LoadTotals = { bills: number; loaded: number; inLanes: number };

const CATEGORY_LABEL: Record<DestinationCategory, string> = {
  warehouse: "WAREHOUSE",
  re_export: "RE-EXPORT",
  local_sale: "LOCAL SALE",
  in_transit: "IN TRANSIT",
  hold: "HOLD",
};
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
const DASH = "—";

function Kpi({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: "blue" | "amber" | "rose" | "emerald" | "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50",
    blue: "border-blue-200 bg-blue-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    emerald: "border-emerald-200 bg-emerald-50",
  } as const;
  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <div className="text-[10px] font-bold uppercase text-slate-600">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-mono text-lg font-black text-black">{value}</span>
        {unit && <span className="text-[10px] font-bold uppercase text-slate-600">{unit}</span>}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <h2 className="bg-teal-800 px-3 py-1.5 text-[11px] font-black uppercase text-white">{title}</h2>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const VIEW_BASE = "/dashboard/stock/warehouse-register/view";

/** View of a whole purchase bill (all its loading and transfer entries). */
const billHref = (p: { billType: string; billId: string }) => `${VIEW_BASE}?kind=bill&type=${p.billType}&id=${p.billId}`;

/** View of one entry: a loading entry (lane:<id>) or a stock transfer (stock:<id>). Goods transfers open their bill. */
const movementHref = (p: { billType: string; billId: string }, m: { id: string }) => {
  if (m.id.startsWith("lane:")) return `${VIEW_BASE}?kind=loading&id=${m.id.slice(5)}`;
  if (m.id.startsWith("stock:")) return `${VIEW_BASE}?kind=transfer&id=${m.id.slice(6)}`;
  return billHref(p);
};

export default function WarehouseStockRegisterPage() {
  const lang = useActiveLanguage();
  const t = (label: string) => translateHeader(lang, label);
  // status codes (loaded, customs_pending, re_export, completed ...) are shown as translated labels, never as raw codes
  const statusLabel = (code: string) => (code === DASH ? DASH : code === "re_export" ? t("RE-EXPORT") : t(code.replace(/_/g, " ").toUpperCase()));
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [rows, setRows] = useState<WarehouseBalanceRow[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<PurchaseRow[]>([]);
  const [view, setView] = useState<"current" | "purchase" | "sales">("current");
  const lot = useLotRegister();
  const [loadTotals, setLoadTotals] = useState<LoadTotals>({ bills: 0, loaded: 0, inLanes: 0 });
  const [totals, setTotals] = useState({ lines: 0, onHand: 0, reserved: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetch(`/api/erp/stock/warehouse-register?lang=${encodeURIComponent(lang)}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body?.ok) throw new Error("load failed");
        if (!cancelled) {
          setRows(body.data.rows);
          setTotals(body.data.totals);
          setPurchaseRows(body.data.purchases ?? []);
          setLoadTotals(body.data.loadTotals ?? { bills: 0, loaded: 0, inLanes: 0 });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setPurchaseRows([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, refreshKey]);

  // Summary panels use every balance row the caller can see; the search box filters the details table only.
  const adminRows = useMemo(() => rows, [rows]);
  const countryGroups: RegisterGroup[] = useMemo(() => groupRegister(adminRows, (r) => r.countryName, (r) => r.countryName), [adminRows]);
  const branchGroups: RegisterGroup[] = useMemo(
    () => groupRegister(adminRows, (r) => `${r.countryBranchId}|${r.cityBranchId}`, branchLabel),
    [adminRows]
  );

  const q = query.trim().toLowerCase();
  const matches = (values: string[]) => !q || values.some((v) => v.toLowerCase().includes(q));
  const shownPurchases = useMemo(
    () =>
      purchaseRows.filter((p) =>
        matches([
          p.purchaseNo,
          p.manualNo,
          p.branch,
          p.countryName,
          ...p.goodsNames,
          ...p.entries.flatMap((e) => [e.entryNo, e.lot, e.brand, e.size, e.destination]),
          ...p.movements.flatMap((m) => [m.refNo, m.destination]),
        ])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purchaseRows, q]
  );
  const unitLabel = useMemo(() => {
    const units = [...new Set(purchaseRows.map((p) => p.unit).filter(Boolean))];
    return units.length === 1 ? units[0] : "";
  }, [purchaseRows]);

  const purchaseGrand = useMemo(
    () =>
      shownPurchases.reduce(
        (s, p) => ({ qty: s.qty + p.qty, gross: s.gross + p.gross, net: s.net + p.net, remaining: s.remaining + p.remaining }),
        { qty: 0, gross: 0, net: 0, remaining: 0 }
      ),
    [shownPurchases]
  );

  // Print through the one universal engine: every row of the active tab (not only the expanded ones), A4 landscape, active language.
  const printRegister = () => {
    const kind = (k: "loading" | "transfer") => (k === "loading" ? t("LOADING") : t("TRANSFER"));
    const qty = (n: number, unit: string) => `${fmt(n)} ${unit}`.trim();
    if (view === "purchase") {
      const rows = shownPurchases.flatMap((p) => [
        { no: `${p.purchaseNo} · ${p.purchaseDate || DASH}`, type: p.billType === "booking" ? t("PURCHASE BOOKING") : t("LOCAL PURCHASE"), entry: "", lot: "", goods: p.goodsNames.join(", "), brand: "", size: "", qty: qty(p.qty, p.unit), net: fmt(p.net), gross: fmt(p.gross), branch: p.branch, loadingDate: "", destination: "", remaining: fmt(p.remaining) },
        ...p.entries.map((e) => ({ no: "", type: "", entry: e.entryNo, lot: e.lot, goods: e.goodsName, brand: e.brand, size: e.size, qty: qty(e.qty, e.unit), net: fmt(e.net), gross: fmt(e.gross), branch: p.branch, loadingDate: e.loadingDate || DASH, destination: e.destination, remaining: fmt(e.remaining) })),
        ...p.movements.map((m) => ({ no: "", type: kind(m.kind), entry: m.refNo, lot: m.lot, goods: m.goodsName, brand: m.brand, size: m.size, qty: qty(m.qty, m.unit), net: fmt(m.net), gross: fmt(m.gross), branch: p.branch, loadingDate: m.date || DASH, destination: m.destination === DASH ? t(CATEGORY_LABEL[m.category]) : `${t(CATEGORY_LABEL[m.category])} · ${m.destination}`, remaining: statusLabel(m.status) })),
      ]);
      openUniversalPrintReport({
        moduleType: "inventory", reportType: "register", orientation: "landscape", lang,
        title: t("WAREHOUSE STOCK REGISTER"), subtitle: t("PURCHASE STOCK DETAILS"),
        kpis: [
          { label: t("TOTAL PURCHASE"), value: purchaseRows.length, color: "blue" },
          { label: t("TOTAL LOADING"), value: fmt(loadTotals.loaded), color: "amber" },
          { label: t("REMAINING"), value: fmt(loadTotals.inLanes), color: "red" },
          { label: t("WAREHOUSE STOCK (AVAILABLE)"), value: fmt(totals.available), color: "emerald" },
        ],
        columns: [
          { key: "no", label: t("PURCHASE NO. / DATE") }, { key: "type", label: "" },
          { key: "entry", label: t("ENTRY NO.") }, { key: "lot", label: t("LOT NAME") }, { key: "goods", label: t("GOODS NAME") }, { key: "brand", label: t("BRAND") },
          { key: "size", label: t("SIZE") }, { key: "qty", label: t("QTY"), align: "right" }, { key: "net", label: t("NET WT (KG)"), align: "right" }, { key: "gross", label: t("GROSS WT (KG)"), align: "right" },
          { key: "branch", label: t("BRANCH") }, { key: "loadingDate", label: t("LOADING DATE") }, { key: "destination", label: t("DESTINATION") }, { key: "remaining", label: t("REMAINING BALANCE"), align: "right" },
        ],
        rows,
        totals: { no: t("GRAND TOTAL"), qty: fmt(purchaseGrand.qty), gross: fmt(purchaseGrand.gross), net: fmt(purchaseGrand.net), remaining: fmt(purchaseGrand.remaining) },
      });
      return;
    }
  };

  const emptyText = t("NO STOCK IN WAREHOUSES YET");

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="w-full space-y-3 p-3 md:p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-black text-black">{t("WAREHOUSE STOCK REGISTER")}</h1>
          <p className="text-[11px] text-slate-500">{t("PURCHASE • LOT • LOADING • TRANSFER • STOCK BALANCE")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("SEARCH")}
            className="h-8 w-56 rounded-md border border-slate-300 bg-white px-2 text-[11px]"
          />
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            className="h-8 rounded-md border border-slate-300 bg-white px-3 text-[11px] font-semibold disabled:opacity-50"
          >
            {t("REFRESH")}
          </button>
          <button
            type="button"
            onClick={printRegister}
            disabled={loading}
            className="h-8 rounded-md bg-teal-800 px-3 text-[11px] font-bold text-white"
          >
            {t("PRINT")}
          </button>
        </div>
      </header>

      {failed && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-800">
          {t("WAREHOUSE STOCK COULD NOT BE LOADED. PRESS REFRESH TO TRY AGAIN.")}
        </div>
      )}

      {view === "purchase" && (
      <>
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label={t("TOTAL PURCHASE")} value={fmt(purchaseRows.length)} unit={t("BILLS")} tone="blue" />
        <Kpi label={t("TOTAL LOADING")} value={fmt(loadTotals.loaded)} unit={unitLabel} tone="amber" />
        <Kpi label={t("REMAINING")} value={fmt(loadTotals.inLanes)} unit={unitLabel} tone="rose" />
        <Kpi label={t("WAREHOUSE STOCK (AVAILABLE)")} value={fmt(totals.available)} unit={unitLabel} tone="emerald" />
      </section>

      {!loading && (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel title={`${t("SUPER ADMIN")} — ${t("ALL COUNTRIES")}`}>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                <tr>
                  <th className="px-2 py-1 text-start">{t("STOCK TYPE")}</th>
                  <th className="px-2 py-1 text-end">{t("QUANTITY")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-2 py-1 text-black">{t("ON HAND")}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(totals.onHand)}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-2 py-1 text-black">{t("RESERVED")}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(totals.reserved)}</td>
                </tr>
                <tr className="border-t border-emerald-200 bg-emerald-100 font-black">
                  <td className="px-2 py-1 text-black">{t("AVAILABLE")}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(totals.available)}</td>
                </tr>
              </tbody>
            </table>
          </Panel>

          <Panel title={t("COUNTRY ADMIN")}>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                <tr>
                  <th className="px-2 py-1 text-start">{t("COUNTRY")}</th>
                  <th className="px-2 py-1 text-end">{t("AVAILABLE")}</th>
                </tr>
              </thead>
              <tbody>
                {countryGroups.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-2 py-3 text-center text-slate-500">{emptyText}</td>
                  </tr>
                )}
                {countryGroups.map((g) => (
                  <tr key={g.key} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-black">{g.label}</td>
                    <td className="px-2 py-1 text-end font-mono text-black">{fmt(g.available)}</td>
                  </tr>
                ))}
                <tr className="border-t border-emerald-200 bg-emerald-100 font-black">
                  <td className="px-2 py-1 text-black">{t("TOTAL")}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(totals.available)}</td>
                </tr>
              </tbody>
            </table>
          </Panel>

          <Panel title={t("BRANCH SUMMARY")}>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                <tr>
                  <th className="px-2 py-1 text-start">{t("BRANCH (MAIN / CITY)")}</th>
                  <th className="px-2 py-1 text-end">{t("AVAILABLE")}</th>
                </tr>
              </thead>
              <tbody>
                {branchGroups.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-2 py-3 text-center text-slate-500">{emptyText}</td>
                  </tr>
                )}
                {branchGroups.map((g) => (
                  <tr key={g.key} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-black">{g.label}</td>
                    <td className="px-2 py-1 text-end font-mono text-black">{fmt(g.available)}</td>
                  </tr>
                ))}
                <tr className="border-t border-emerald-200 bg-emerald-100 font-black">
                  <td className="px-2 py-1 text-black">{t("TOTAL")}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(totals.available)}</td>
                </tr>
              </tbody>
            </table>
          </Panel>
        </section>
      )}
      </>
      )}

      <nav className="flex gap-1 border-b border-slate-200" role="tablist">
        {(["current", "purchase", "sales"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-t-md px-3 py-1.5 text-[11px] font-black uppercase ${view === v ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {v === "current" ? t("CURRENT STOCK") : v === "purchase" ? t("PURCHASE STOCK DETAILS") : t("SALES")}
          </button>
        ))}
      </nav>

      {view === "current" && <CurrentStockTab data={lot.data} loading={lot.loading} failed={lot.failed} t={t} isRtl={isRtl} />}
      {view === "sales" && <SalesTab data={lot.data} loading={lot.loading} failed={lot.failed} t={t} isRtl={isRtl} />}

      {view === "purchase" && (
        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full min-w-[1400px] text-[11px]">
              <thead className="sticky top-0 z-10 bg-teal-50 text-[10px] font-black uppercase text-slate-700">
                <tr>
                  <th className="px-2 py-1 text-start">{t("PURCHASE NO. / DATE")}</th>
                  <th className="px-2 py-1 text-start">{t("ENTRY NO.")}</th>
                  <th className="px-2 py-1 text-start">{t("LOT NAME")}</th>
                  <th className="px-2 py-1 text-start">{t("GOODS NAME")}</th>
                  <th className="px-2 py-1 text-start">{t("BRAND")}</th>
                  <th className="px-2 py-1 text-start">{t("SIZE")}</th>
                  <th className="px-2 py-1 text-end">{t("QTY")}</th>
                  <th className="px-2 py-1 text-end">{t("NET WT (KG)")}</th>
                  <th className="px-2 py-1 text-end">{t("GROSS WT (KG)")}</th>
                  <th className="px-2 py-1 text-start">{t("BRANCH")}</th>
                  <th className="px-2 py-1 text-start">{t("LOADING DATE")}</th>
                  <th className="px-2 py-1 text-start">{t("DESTINATION")}</th>
                  <th className="px-2 py-1 text-end">{t("REMAINING BALANCE")}</th>
                  <th className="px-2 py-1 text-start">{t("VIEW")}</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={14} className="px-2 py-4 text-center text-slate-500">{t("LOADING")}</td>
                  </tr>
                )}
                {!loading && !failed && shownPurchases.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-2 py-4 text-center text-slate-500">{t("NO PURCHASE RECORDS FOUND")}</td>
                  </tr>
                )}
                {shownPurchases.map((p) => {
                  // Column order: purchase no and date in one cell, then each entry (Entry N, lot, goods, brand, size, qty, net, gross),
                  // then branch, loading date, destination and balance. Entries are always shown. A bill with one goods line is already
                  // its purchase row, so that single entry is not repeated underneath it.
                  const showEntries = p.entries.length > 1;
                  return (
                    <Fragment key={p.key}>
                      <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                        <td className="whitespace-nowrap px-2 py-1 text-black">
                          <div className="font-black">
                            {p.purchaseNo}
                            <span className={`ms-1 rounded px-1 text-[9px] font-black uppercase ${p.billType === "booking" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
                              {p.billType === "booking" ? t("PURCHASE BOOKING") : t("LOCAL PURCHASE")}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] font-semibold text-slate-600">{p.purchaseDate || DASH}</div>
                        </td>
                        <td className="px-2 py-1 text-slate-500">{p.entries.length}</td>
                        <td className="px-2 py-1" />
                        <td className="px-2 py-1 text-black">{p.goodsNames.join(", ") || DASH}</td>
                        <td className="px-2 py-1" />
                        <td className="px-2 py-1" />
                        <td className="whitespace-nowrap px-2 py-1 text-end font-mono text-black">{fmt(p.qty)} {p.unit}</td>
                        <td className="px-2 py-1 text-end font-mono text-black">{fmt(p.net)}</td>
                        <td className="px-2 py-1 text-end font-mono text-black">{fmt(p.gross)}</td>
                        <td className="px-2 py-1 text-black">{p.branch}</td>
                        <td className="px-2 py-1" />
                        <td className="px-2 py-1" />
                        <td className={`px-2 py-1 text-end font-mono font-black ${p.remaining > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {fmt(p.remaining)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1">
                          <Link href={billHref(p)} className="rounded border border-teal-300 bg-teal-50 px-1.5 py-0.5 text-[10px] font-black text-teal-900">{t("VIEW")}</Link>
                        </td>
                      </tr>
                      {showEntries &&
                        p.entries.map((e) => (
                          <tr key={e.id} className="border-t border-slate-100">
                            <td className="px-2 py-1" />
                            <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{e.entryNo}</td>
                            <td className="px-2 py-1 text-black">{e.lot}</td>
                            <td className="px-2 py-1 text-black">{e.goodsName}</td>
                            <td className="px-2 py-1 text-black">{e.brand}</td>
                            <td className="px-2 py-1 text-black">{e.size}</td>
                            <td className="whitespace-nowrap px-2 py-1 text-end font-mono text-black">{fmt(e.qty)} {e.unit}</td>
                            <td className="px-2 py-1 text-end font-mono text-black">{fmt(e.net)}</td>
                            <td className="px-2 py-1 text-end font-mono text-black">{fmt(e.gross)}</td>
                            <td className="px-2 py-1 text-slate-500">{p.branch}</td>
                            <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{e.loadingDate || DASH}</td>
                            <td className="px-2 py-1 text-black">{e.destination}</td>
                            <td className={`px-2 py-1 text-end font-mono font-bold ${e.remaining > 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmt(e.remaining)}</td>
                            <td className="whitespace-nowrap px-2 py-1">
                              <Link href={billHref(p)} className="rounded border border-teal-300 bg-teal-50 px-1.5 py-0.5 text-[10px] font-black text-teal-900">{t("VIEW")}</Link>
                            </td>
                          </tr>
                        ))}
                      {p.movements.length > 0 && (
                        <tr className="border-t border-slate-200 bg-teal-50/60">
                          <td colSpan={14} className="px-2 py-0.5 text-[10px] font-black uppercase text-teal-900">{t("LOADING & STOCK TRANSFER ENTRIES")}</td>
                        </tr>
                      )}
                      {p.movements.map((m) => (
                        <tr key={m.id} className="border-t border-slate-100 bg-teal-50/30">
                          <td className="px-2 py-1">
                            <span className={`rounded px-1 text-[9px] font-black uppercase ${m.kind === "loading" ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800"}`}>
                              {m.kind === "loading" ? t("LOADING") : t("TRANSFER")}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{m.refNo}</td>
                          <td className="px-2 py-1 text-black">{m.lot}</td>
                          <td className="px-2 py-1 text-black">{m.goodsName}</td>
                          <td className="px-2 py-1 text-black">{m.brand}</td>
                          <td className="px-2 py-1 text-black">{m.size}</td>
                          <td className="whitespace-nowrap px-2 py-1 text-end font-mono text-black">{fmt(m.qty)} {m.unit}</td>
                          <td className="px-2 py-1 text-end font-mono text-black">{fmt(m.net)}</td>
                          <td className="px-2 py-1 text-end font-mono text-black">{fmt(m.gross)}</td>
                          <td className="px-2 py-1 text-slate-500">{p.branch}</td>
                          <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{m.date || DASH}</td>
                          <td className="px-2 py-1 text-black">
                            <span className="font-semibold">{t(CATEGORY_LABEL[m.category])}</span>
                            {m.destination !== DASH && <span className="text-slate-600"> · {m.destination}</span>}
                          </td>
                          <td className="px-2 py-1 text-end text-[10px] uppercase text-slate-600">{statusLabel(m.status)}</td>
                          <td className="whitespace-nowrap px-2 py-1">
                            <Link href={movementHref(p, m)} className="rounded border border-teal-300 bg-teal-50 px-1.5 py-0.5 text-[10px] font-black text-teal-900">{t("VIEW")}</Link>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                {shownPurchases.length > 0 && (
                  <tr className="border-t-2 border-emerald-300 bg-emerald-100 font-black">
                    <td className="px-2 py-1" colSpan={6}>
                      <span className="text-black">{t("GRAND TOTAL")}</span>
                    </td>
                    <td className="px-2 py-1 text-end font-mono text-black">{fmt(purchaseGrand.qty)} {unitLabel}</td>
                    <td className="px-2 py-1 text-end font-mono text-black">{fmt(purchaseGrand.net)}</td>
                    <td className="px-2 py-1 text-end font-mono text-black">{fmt(purchaseGrand.gross)}</td>
                    <td className="px-2 py-1" colSpan={3} />
                    <td className="px-2 py-1 text-end font-mono text-black">{fmt(purchaseGrand.remaining)}</td>
                    <td className="px-2 py-1" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-[10px] text-slate-500">{t("STOCK ENTERS THIS REGISTER ONLY THROUGH A CONFIRMED WAREHOUSE TRANSFER.")}</p>
    </div>
  );
}
