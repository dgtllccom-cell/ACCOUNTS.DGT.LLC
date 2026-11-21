"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { translateHeader } from "@/lib/i18n/table-headers";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { branchCodeLabel, groupRegister, type RegisterGroup, type WarehouseBalanceRow } from "@/lib/stock/warehouse-register";
import {
  DESTINATION_CATEGORIES,
  type DestinationCategory,
  type DestinationGroup,
  type PurchaseRow,
} from "@/lib/stock/purchase-movements";

type LoadTotals = { bills: number; loaded: number; inLanes: number };

const CATEGORY_LABEL: Record<DestinationCategory, string> = {
  warehouse: "WAREHOUSE",
  re_export: "RE-EXPORT",
  local_sale: "LOCAL SALE",
  in_transit: "IN TRANSIT",
  hold: "HOLD",
};
const CATEGORY_TONE: Record<DestinationCategory, "blue" | "amber" | "rose" | "emerald" | "slate"> = {
  warehouse: "emerald",
  re_export: "blue",
  local_sale: "amber",
  in_transit: "rose",
  hold: "slate",
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
    <div className={`rounded-xl border px-3 py-2.5 shadow-sm ${tones[tone]}`}>
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
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
      <h2 className="bg-teal-800 px-3 py-1.5 text-[11px] font-black uppercase text-white tracking-wide">{title}</h2>
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

function SerialTooltip({ purchase, rowIdx, t }: { purchase: PurchaseRow; rowIdx: number; t: (label: string) => string }) {
  const [open, setOpen] = useState(false);
  const parts = [
    { label: t("SA/SERIAL"), val: purchase.serials.superAdmin },
    { label: t("COUNTRY SERIAL"), val: purchase.serials.country },
    { label: t("BRANCH SERIAL"), val: purchase.serials.branch },
    { label: t("ENTRY SERIAL"), val: purchase.serials.entry || String(rowIdx).padStart(5, "0") },
  ];
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="cursor-help rounded-md px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-700 bg-slate-100 hover:bg-teal-100 hover:text-teal-900 transition">
        {rowIdx}
      </span>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-xl backdrop-blur-md">
          <div className="mb-1.5 text-[9px] font-black uppercase text-teal-800 tracking-wider">
            {t("AUDIT SERIALS")}
          </div>
          <div className="space-y-1">
            {parts.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-0.5 text-[10px]">
                <span className="text-slate-500 font-medium">{p.label}:</span>
                <span className="font-mono font-bold text-slate-900">{p.val || DASH}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SerialDetails({ purchase, onClose, t }: { purchase: PurchaseRow; onClose: () => void; t: (label: string) => string }) {
  const parts = [
    [t("SA/SERIAL"), purchase.serials.superAdmin],
    [t("COUNTRY SERIAL"), purchase.serials.country],
    [t("BRANCH SERIAL"), purchase.serials.branch],
    [t("ENTRY SERIAL"), purchase.serials.entry],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="warehouse-serial-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 bg-gradient-to-r from-teal-900 to-teal-700 px-5 py-4 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded-md px-2 py-1 text-xs font-black ${purchase.billType === "booking" ? "bg-blue-100 text-blue-900" : "bg-amber-100 text-amber-900"}`}>
                {purchase.billType === "booking" ? "B" : "L"}
              </span>
              <h2 id="warehouse-serial-title" className="font-mono text-lg font-black">{purchase.purchaseNo}</h2>
            </div>
            <p className="mt-1 text-xs text-teal-100">{purchase.purchaseDate || DASH}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("CLOSE")} className="grid h-8 w-8 place-items-center rounded-full border border-white/30 text-xl hover:bg-white/10">×</button>
        </header>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {parts.map(([label, value], index) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{index + 1}. {label}</div>
                <div className="mt-1 break-all font-mono text-sm font-black text-slate-950">{value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-teal-100 bg-teal-50 p-3 text-xs">
            <div><span className="block text-[10px] font-black uppercase text-teal-700">{t("MAIN BRANCH")}</span><span className="font-mono font-black text-slate-950">{purchase.mainBranchCode}</span></div>
            <div><span className="block text-[10px] font-black uppercase text-teal-700">{t("CITY BRANCH")}</span><span className="font-mono font-black text-slate-950">{purchase.cityBranchCode}</span></div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">{t("CLOSE")}</button>
            <Link href={billHref(purchase)} className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-black text-white">{t("VIEW")} {t("DETAILS")}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function WarehouseStockRegisterPage() {
  const lang = useActiveLanguage();
  const t = (label: string) => translateHeader(lang, label);
  // status codes (loaded, customs_pending, re_export, completed ...) are shown as translated labels, never as raw codes
  const statusLabel = (code: string) => (code === DASH ? DASH : code === "re_export" ? t("RE-EXPORT") : t(code.replace(/_/g, " ").toUpperCase()));
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [role, setRole] = useState<"super_admin" | "country_admin" | "branch_admin">("super_admin");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [rows, setRows] = useState<WarehouseBalanceRow[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<PurchaseRow[]>([]);
  const [destinations, setDestinations] = useState<DestinationGroup[]>([]);
  const [destTotals, setDestTotals] = useState<Partial<Record<DestinationCategory, number>>>({});
  const [view, setView] = useState<"purchase" | "destination">("purchase");
  const [openDest, setOpenDest] = useState<Set<string>>(new Set());
  const [loadTotals, setLoadTotals] = useState<LoadTotals>({ bills: 0, loaded: 0, inLanes: 0 });
  const [totals, setTotals] = useState({ lines: 0, onHand: 0, reserved: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [serialPurchase, setSerialPurchase] = useState<PurchaseRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetch(`/api/erp/stock/warehouse-register?lang=${encodeURIComponent(lang)}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body?.ok) throw new Error("load failed");
        if (!cancelled) {
          if (body.data?.role) setRole(body.data.role);
          setRows(body.data.rows);
          setTotals(body.data.totals);
          setPurchaseRows(body.data.purchases ?? []);
          setDestinations(body.data.destinations ?? []);
          setDestTotals(body.data.destinationTotals ?? {});
          setLoadTotals(body.data.loadTotals ?? { bills: 0, loaded: 0, inLanes: 0 });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setPurchaseRows([]);
          setDestinations([]);
          setDestTotals({});
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
    () => groupRegister(adminRows, (r) => `${r.countryBranchId}|${r.cityBranchId}`, branchCodeLabel),
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
          p.mainBranchCode,
          p.cityBranchCode,
          p.countryName,
          p.buyerAccount?.name ?? "",
          p.buyerAccount?.number ?? "",
          p.supplierAccount?.name ?? "",
          p.supplierAccount?.number ?? "",
          ...Object.values(p.serials),
          ...p.goodsNames,
          ...p.entries.flatMap((e) => [e.entryNo, e.lot, e.lotName, e.lotNo, e.brand, e.size, e.destination]),
          ...p.movements.flatMap((m) => [m.refNo, m.destination]),
        ])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purchaseRows, q]
  );
  const shownDestinations = useMemo(
    () =>
      destinations
        .map((g) => ({ ...g, rows: g.rows.filter((r) => matches([g.destination, r.purchaseNo, r.refNo, r.goodsName, r.lot, r.brand, r.size])) }))
        .filter((g) => g.rows.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destinations, q]
  );

  const unitLabel = useMemo(() => {
    const units = [...new Set(purchaseRows.map((p) => p.unit).filter(Boolean))];
    return units.length === 1 ? units[0] : "";
  }, [purchaseRows]);

  const purchaseGrand = useMemo(
    () =>
      shownPurchases.reduce(
        (s, p) => ({
          qty: s.qty + p.qty,
          gross: s.gross + p.gross,
          net: s.net + p.net,
          loadedQty: s.loadedQty + p.loadedQty,
          loadedGross: s.loadedGross + p.loadedGross,
          loadedNet: s.loadedNet + p.loadedNet,
          remaining: s.remaining + p.remaining,
          remainingGross: s.remainingGross + p.remainingGross,
          remainingNet: s.remainingNet + p.remainingNet,
        }),
        { qty: 0, gross: 0, net: 0, loadedQty: 0, loadedGross: 0, loadedNet: 0, remaining: 0, remainingGross: 0, remainingNet: 0 }
      ),
    [shownPurchases]
  );

  const isSuperAdmin = role === "super_admin";
  const isCountryAdmin = role === "country_admin";
  const showBranch = isSuperAdmin || isCountryAdmin;
  const totalCols = 12 + (showBranch ? 1 : 0);
  const preColspan = 6 + (showBranch ? 1 : 0);

  const toggleDest = (key: string) =>
    setOpenDest((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Print through the one universal engine: every row of the active tab (not only the expanded ones), A4 landscape, active language.
  const printRegister = () => {
    const kind = (k: "loading" | "transfer") => (k === "loading" ? t("LOADING") : t("TRANSFER"));
    const qty = (n: number, unit: string) => `${fmt(n)} ${unit}`.trim();
    if (view === "purchase") {
      const rows = shownPurchases.flatMap((p) => [
        {
          no: p.purchaseNo,
          type: p.billType === "booking" ? "B" : "L",
          date: p.purchaseDate || DASH,
          buyer: p.buyerAccount.name || DASH,
          supplier: p.supplierAccount.name || DASH,
          mainBranch: p.mainBranchCode,
          cityBranch: p.cityBranchCode,
          entry: "",
          lot: p.entries[0]?.lotName || p.entries[0]?.lotNo || DASH,
          loadingDate: p.loadingDate || DASH,
          goods: p.goodsNames.join(", "),
          brand: p.entries[0]?.brand || DASH,
          size: p.entries[0]?.size || DASH,
          qty: qty(p.qty, p.unit),
          gross: fmt(p.gross),
          net: fmt(p.net),
          loadedQty: `${fmt(p.loadedQty)} ${p.unit}`.trim(),
          destination: p.entries[0]?.destination || DASH,
          remaining: `${fmt(p.remaining)} ${p.unit} (G:${fmt(p.remainingGross)} N:${fmt(p.remainingNet)})`,
        },
        ...p.entries.map((e) => ({
          no: "",
          type: "",
          date: "",
          buyer: "",
          supplier: "",
          mainBranch: "",
          cityBranch: "",
          entry: e.entryNo,
          lot: e.lotName || e.lotNo,
          loadingDate: e.loadingDate || DASH,
          goods: e.goodsName,
          brand: e.brand,
          size: e.size,
          qty: qty(e.qty, e.unit),
          gross: fmt(e.gross),
          net: fmt(e.net),
          loadedQty: `${fmt(e.loadedQty)} ${e.unit}`.trim(),
          destination: e.destination,
          remaining: `${fmt(e.remaining)} ${e.unit} (G:${fmt(e.remainingGross)} N:${fmt(e.remainingNet)})`,
        })),
        ...p.movements.map((m) => ({
          no: "",
          type: kind(m.kind),
          date: "",
          buyer: "",
          supplier: "",
          mainBranch: "",
          cityBranch: "",
          entry: m.refNo,
          lot: m.lot,
          loadingDate: m.date || DASH,
          goods: m.goodsName,
          brand: m.brand,
          size: m.size,
          qty: qty(m.qty, m.unit),
          gross: fmt(m.gross),
          net: fmt(m.net),
          loadedQty: "",
          destination: m.destination === DASH ? t(CATEGORY_LABEL[m.category]) : `${t(CATEGORY_LABEL[m.category])} · ${m.destination}`,
          remaining: statusLabel(m.status),
        })),
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
          { key: "no", label: t("PURCHASE NO.") }, { key: "type", label: t("TYPE") }, { key: "date", label: t("PURCHASE DATE") },
          { key: "buyer", label: t("BUYER") }, { key: "supplier", label: t("SUPPLIER") },
          ...(showBranch ? [{ key: "mainBranch", label: t("MAIN BRANCH") }, { key: "cityBranch", label: t("CITY BRANCH") }] : []),
          { key: "entry", label: t("ENTRY NO.") }, { key: "lot", label: t("LOT NAME") }, { key: "loadingDate", label: t("LOADING DATE") },
          { key: "goods", label: t("GOODS NAME") }, { key: "brand", label: t("BRAND") }, { key: "size", label: t("SIZE") },
          { key: "qty", label: t("QTY"), align: "right" }, { key: "gross", label: t("GROSS WT (KG)"), align: "right" },
          { key: "net", label: t("NET WT (KG)"), align: "right" }, { key: "loadedQty", label: t("LOADED QTY"), align: "right" },
          { key: "destination", label: t("DESTINATION") }, { key: "remaining", label: t("REMAINING BALANCE"), align: "right" },
        ],
        rows,
        totals: {
          no: t("GRAND TOTAL"),
          qty: fmt(purchaseGrand.qty),
          gross: fmt(purchaseGrand.gross),
          net: fmt(purchaseGrand.net),
          loadedQty: fmt(purchaseGrand.loadedQty),
          remaining: fmt(purchaseGrand.remaining),
        },
      });
      return;
    }
    const rows = shownDestinations.flatMap((g) => [
      { destination: g.destination === DASH ? t(CATEGORY_LABEL[g.category]) : `${t(CATEGORY_LABEL[g.category])} · ${g.destination}`, type: "", no: "", date: "", entry: "", movedOn: "", goods: "", brand: "", size: "", lot: "", qty: fmt(g.qty), gross: fmt(g.gross), net: fmt(g.net), status: "" },
      ...g.rows.map((r) => ({ destination: "", type: kind(r.kind), no: r.purchaseNo, date: r.purchaseDate || DASH, entry: r.refNo, movedOn: r.date || DASH, goods: r.goodsName, brand: r.brand, size: r.size, lot: r.lot, qty: qty(r.qty, r.unit), gross: fmt(r.gross), net: fmt(r.net), status: statusLabel(r.status) })),
    ]);
    openUniversalPrintReport({
      moduleType: "inventory", reportType: "register", orientation: "landscape", lang,
      title: t("WAREHOUSE STOCK REGISTER"), subtitle: t("DESTINATION & RE-EXPORT STOCK"),
      kpis: DESTINATION_CATEGORIES.map((c) => ({ label: t(CATEGORY_LABEL[c]), value: fmt(destTotals[c] ?? 0) })),
      columns: [
        { key: "destination", label: t("DESTINATION") }, { key: "type", label: "" }, { key: "no", label: t("PURCHASE NO.") }, { key: "date", label: t("PURCHASE DATE") },
        { key: "entry", label: t("ENTRY NO.") }, { key: "movedOn", label: t("DATE") }, { key: "goods", label: t("GOODS NAME") }, { key: "brand", label: t("BRAND") },
        { key: "size", label: t("SIZE") }, { key: "lot", label: t("LOT NAME") }, { key: "qty", label: t("QTY"), align: "right" }, { key: "gross", label: t("GROSS WT (KG)"), align: "right" },
        { key: "net", label: t("NET WT (KG)"), align: "right" }, { key: "status", label: t("STATUS") },
      ],
      rows,
    });
  };

  const emptyText = t("NO STOCK IN WAREHOUSES YET");

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="w-full space-y-3 p-3 md:p-4">
      {/* ══ CONSOLIDATED TOP WHITE TOOLBAR ══ */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
        {/* Left: Back button + Title & Subtitle */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/stock"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
          >
            <span>←</span>
            <span>{t("BACK")}</span>
          </Link>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">
              {t("WAREHOUSE STOCK REGISTER")}
            </h1>
            <p className="text-[10px] font-semibold text-slate-500">
              {t("PURCHASE • LOT • LOADING • TRANSFER • STOCK BALANCE")}
            </p>
          </div>
        </div>

        {/* Right: Search, Refresh, Print, Actions menu */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("SEARCH BILL NO., SUPPLIER, GOODS...")}
              className="h-8.5 w-48 rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-3 text-[11px] font-semibold text-slate-800 shadow-2xs outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100 sm:w-56"
            />
            <svg className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-teal-800 disabled:opacity-50"
          >
            <span>↻</span>
            <span>{t("REFRESH")}</span>
          </button>
          <button
            type="button"
            onClick={printRegister}
            disabled={loading}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-teal-800 px-3.5 text-[11px] font-black text-white shadow-xs transition hover:bg-teal-700 active:scale-95 disabled:opacity-50"
          >
            <span>⎙</span>
            <span>{t("PRINT")}</span>
          </button>
          {/* Actions 3 dots */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActionsOpen((v) => !v)}
              className="grid h-8.5 w-8.5 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
              title={t("ACTIONS")}
            >
              <span className="text-sm font-black">⋮</span>
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-10 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg animate-in fade-in zoom-in-95 duration-150">
                <Link
                  href="/dashboard/stock/reports"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => setActionsOpen(false)}
                >
                  <span>📊</span>
                  <span>{t("STOCK REPORTS")}</span>
                </Link>
                <Link
                  href="/dashboard/purchase/purchase-booking-journal-report"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => setActionsOpen(false)}
                >
                  <span>📑</span>
                  <span>{t("PURCHASE JOURNAL")}</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {failed && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-800">
          {t("WAREHOUSE STOCK COULD NOT BE LOADED. PRESS REFRESH TO TRY AGAIN.")}
        </div>
      )}

      {/* ══ TOP 4 KPI CARDS ══ */}
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label={t("TOTAL PURCHASE")} value={fmt(purchaseRows.length)} unit={t("BILLS")} tone="blue" />
        <Kpi label={t("TOTAL LOADING")} value={fmt(loadTotals.loaded)} unit={unitLabel} tone="amber" />
        <Kpi label={t("REMAINING")} value={fmt(loadTotals.inLanes)} unit={unitLabel} tone="rose" />
        <Kpi label={t("WAREHOUSE STOCK (AVAILABLE)")} value={fmt(totals.available)} unit={unitLabel} tone="emerald" />
      </section>

      {/* ══ 3 SUMMARY PANELS (Role-Based Visibility) ══ */}
      {!loading && (
        <section
          className={`grid gap-3 ${
            role === "super_admin"
              ? "grid-cols-1 md:grid-cols-3"
              : role === "country_admin"
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1"
          }`}
        >
          {/* SUPER ADMIN PANEL */}
          {role === "super_admin" && (
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
          )}

          {/* COUNTRY ADMIN PANEL */}
          {(role === "super_admin" || role === "country_admin") && (
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
          )}

          {/* BRANCH SUMMARY PANEL */}
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

      {/* ══ VIEW TABS ══ */}
      <nav className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist">
        {(["purchase", "destination"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase transition ${view === v ? "bg-teal-800 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
          >
            {v === "purchase" ? t("PURCHASE STOCK DETAILS") : t("DESTINATION & RE-EXPORT STOCK")}
          </button>
        ))}
      </nav>

      {/* ══ PURCHASE STOCK DETAILS TABLE ══ */}
      {view === "purchase" && (
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full min-w-[1340px] text-[11px]">
              <thead className="sticky top-0 z-10 bg-teal-900 text-[10px] font-black uppercase tracking-wide text-white">
                <tr>
                  <th className="px-2 py-2 text-start w-10">#</th>
                  <th className="px-2.5 py-2 text-start">{t("PURCHASE NO.")} / {t("PURCHASE DATE")}</th>
                  <th className="px-2.5 py-2 text-start">{t("BUYER / SUPPLIER")}</th>
                  {showBranch && (
                    <th className="px-2 py-2 text-start">
                      {isSuperAdmin ? t("MAIN / CITY BRANCH") : t("CITY BRANCH")}
                    </th>
                  )}
                  <th className="px-2 py-2 text-center">NC / {t("ENTRY NO.")}</th>
                  <th className="px-2 py-2 text-start">{t("LOT (NAME & NO.)")}</th>
                  <th className="px-2.5 py-2 text-start">{t("GOODS (BRAND · SIZE)")}</th>
                  <th className="px-2 py-2 text-end">{t("QTY")}</th>
                  <th className="px-2 py-2 text-end">{t("GROSS / NET (KG)")}</th>
                  <th className="px-2 py-2 text-end">{t("LOADING (DATE · QTY · WT)")}</th>
                  <th className="px-2 py-2 text-start">{t("DESTINATION")}</th>
                  <th className="px-2.5 py-2 text-end">{t("REMAINING BALANCE (QTY · WT)")}</th>
                  <th className="px-2 py-2 text-center">{t("VIEW")}</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={totalCols} className="px-2 py-4 text-center text-slate-500">{t("LOADING")}</td>
                  </tr>
                )}
                {!loading && !failed && shownPurchases.length === 0 && (
                  <tr>
                    <td colSpan={totalCols} className="px-2 py-4 text-center text-slate-500">{t("NO PURCHASE RECORDS FOUND")}</td>
                  </tr>
                )}
                {shownPurchases.map((p, idx) => {
                  const showEntries = p.entries.length > 1;
                  return (
                    <Fragment key={p.key}>
                      <tr className="border-t border-slate-200 bg-slate-50/80 font-semibold transition hover:bg-teal-50/60">
                        {/* 1. # with Serial hover popup */}
                        <td className="whitespace-nowrap px-2 py-2 text-slate-500">
                          <SerialTooltip purchase={p} rowIdx={idx + 1} t={t} />
                        </td>

                        {/* 2. Purchase No. / Date */}
                        <td className="whitespace-nowrap px-2.5 py-2 text-black">
                          <button type="button" onClick={() => setSerialPurchase(p)} className="group text-start" title={t("DETAILS")}>
                            <span className="flex items-center gap-1.5">
                              <span className={`grid h-5 min-w-5 place-items-center rounded-md px-1 text-[10px] font-black ${p.billType === "booking" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
                                {p.billType === "booking" ? "B" : "L"}
                              </span>
                              <span className="font-mono font-black text-teal-900 underline decoration-dotted underline-offset-2 group-hover:text-teal-600">{p.purchaseNo}</span>
                            </span>
                            <span className="mt-0.5 block ps-6.5 font-mono text-[10px] font-medium text-slate-500">{p.purchaseDate || DASH}</span>
                          </button>
                        </td>

                        {/* 3. Account (Buyer / Supplier) */}
                        <td className="px-2.5 py-1.5 text-[10px] min-w-[140px]">
                          <div className="flex flex-col gap-0.5" title={`Buyer: ${p.buyerAccount.name} (${p.buyerAccount.number})\nSupplier: ${p.supplierAccount.name} (${p.supplierAccount.number})`}>
                            <div className="truncate">
                              <span className="font-bold text-slate-400">B: </span>
                              <span className="font-semibold text-slate-900">{p.buyerAccount.name || DASH}</span>
                              {p.buyerAccount.number && <span className="font-mono text-[9px] text-slate-500"> ({p.buyerAccount.number})</span>}
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-slate-400">S: </span>
                              <span className="font-semibold text-slate-800">{p.supplierAccount.name || DASH}</span>
                              {p.supplierAccount.number && <span className="font-mono text-[9px] text-slate-500"> ({p.supplierAccount.number})</span>}
                            </div>
                          </div>
                        </td>

                        {/* 4. Branch (Role-based) */}
                        {showBranch && (
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px]">
                            {isSuperAdmin ? (
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900">{p.mainBranchCode || DASH}</span>
                                <span className="text-[9px] text-slate-500">{p.cityBranchCode || DASH}</span>
                              </div>
                            ) : (
                              <span className="font-black text-slate-900">{p.cityBranchCode || DASH}</span>
                            )}
                          </td>
                        )}

                        {/* 5. NC / Entry No. */}
                        <td className="px-2 py-1.5 font-mono text-center text-slate-600 text-[10px]">
                          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-bold">
                            {p.entries.length}
                          </span>
                        </td>

                        {/* 6. Lot (Name & No.) */}
                        <td className="px-2 py-1.5 text-[10px] min-w-[110px]">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 truncate">{p.entries[0]?.lotName || p.entries[0]?.lot || DASH}</span>
                            <span className="font-mono text-[9px] text-slate-500">{p.entries[0]?.lotNo || DASH}</span>
                          </div>
                        </td>

                        {/* 7. Goods (Brand · Size) */}
                        <td className="px-2.5 py-1.5 text-[10px] min-w-[130px]">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900">{p.goodsNames.join(", ") || DASH}</span>
                            <span className="text-[9px] text-slate-500">
                              {[p.entries[0]?.brand, p.entries[0]?.size].filter(Boolean).join(" · ") || DASH}
                            </span>
                          </div>
                        </td>

                        {/* 8. Qty (Qty / Unit) */}
                        <td className="whitespace-nowrap px-2 py-1.5 text-end font-mono">
                          <span className="block text-[11px] font-black text-slate-950">{fmt(p.qty)}</span>
                          <span className="block text-[9px] font-bold text-slate-500 uppercase">{p.unit || DASH}</span>
                        </td>

                        {/* 9. Gross / Net (KG) */}
                        <td className="whitespace-nowrap px-2 py-1.5 text-end font-mono text-[10px]">
                          <span className="block font-bold text-slate-900">G: {fmt(p.gross)}</span>
                          <span className="block text-[9px] text-slate-600">N: {fmt(p.net)}</span>
                        </td>

                        {/* 10. Loading (Date · Qty · Wt) */}
                        <td className="whitespace-nowrap px-2 py-1.5 text-end font-mono text-[10px]">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-900">{p.loadingDate || DASH} · {fmt(p.loadedQty)}</span>
                            <span className="text-[9px] text-slate-500">G: {fmt(p.loadedGross)} | N: {fmt(p.loadedNet)}</span>
                          </div>
                        </td>

                        {/* 11. Destination */}
                        <td className="px-2 py-1.5 text-[10px] text-slate-800 max-w-[120px] truncate">
                          {p.entries[0]?.destination || DASH}
                        </td>

                        {/* 12. Remaining Balance (Qty · Wt) */}
                        <td className="whitespace-nowrap px-2.5 py-1.5 text-end font-mono text-[10px]">
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-black ${p.remaining > 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {fmt(p.remaining)} {p.unit}
                          </span>
                          <span className="mt-0.5 block text-[9px] text-slate-500">
                            G: {fmt(p.remainingGross)} | N: {fmt(p.remainingNet)}
                          </span>
                        </td>

                        {/* 13. View */}
                        <td className="whitespace-nowrap px-2 py-1.5 text-center">
                          <Link href={billHref(p)} className="inline-block rounded-lg border border-teal-300 bg-teal-50 px-2 py-1 text-[10px] font-black text-teal-900 hover:bg-teal-100 transition shadow-2xs">
                            {t("VIEW")}
                          </Link>
                        </td>
                      </tr>

                      {/* SUB-ENTRIES ROWS */}
                      {showEntries &&
                        p.entries.map((e, k) => (
                          <tr key={e.id} className="border-t border-slate-100 bg-slate-50/40 text-[10px]">
                            <td className="px-2 py-1.5 text-slate-500 font-mono">{`${idx + 1}.${k + 1}`}</td>
                            <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-500">
                              <span className="font-mono text-slate-700">{p.purchaseNo}</span>
                              <span className="block font-mono text-[9px] text-slate-400">{p.purchaseDate || DASH}</span>
                            </td>
                            <td className="px-2.5 py-1.5 text-[9px] text-slate-500">
                              <div className="truncate">{p.buyerAccount.name || DASH}</div>
                              <div className="truncate">{p.supplierAccount.name || DASH}</div>
                            </td>
                            {showBranch && (
                              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[9px] text-slate-500">
                                {isSuperAdmin ? (
                                  <div>{p.mainBranchCode} / {p.cityBranchCode}</div>
                                ) : (
                                  <div>{p.cityBranchCode}</div>
                                )}
                              </td>
                            )}
                            <td className="whitespace-nowrap px-2 py-1.5 font-mono text-center text-slate-700 font-bold">{e.entryNo}</td>
                            <td className="px-2 py-1.5 text-[10px]">
                              <div className="font-bold text-slate-800">{e.lotName || e.lot}</div>
                              <div className="font-mono text-[9px] text-slate-400">{e.lotNo}</div>
                            </td>
                            <td className="px-2.5 py-1.5 text-slate-900">
                              <div className="font-semibold">{e.goodsName}</div>
                              <div className="text-[9px] text-slate-500">{[e.brand, e.size].filter(Boolean).join(" · ") || DASH}</div>
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-end font-mono text-black">
                              <span className="font-bold">{fmt(e.qty)}</span>
                              <span className="block text-[9px] text-slate-500 uppercase">{e.unit}</span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-end font-mono text-[9px]">
                              <div>G: {fmt(e.gross)}</div>
                              <div className="text-slate-500">N: {fmt(e.net)}</div>
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-end font-mono text-[9px]">
                              <div>{e.loadingDate || DASH} · {fmt(e.loadedQty)}</div>
                              <div className="text-slate-500">G: {fmt(e.loadedGross)} | N: {fmt(e.loadedNet)}</div>
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 truncate max-w-[120px]">{e.destination}</td>
                            <td className="whitespace-nowrap px-2.5 py-1.5 text-end font-mono">
                              <span className={`inline-block rounded px-1 py-0.5 text-[9px] font-bold ${e.remaining > 0 ? "text-rose-700 bg-rose-50" : "text-emerald-700 bg-emerald-50"}`}>
                                {fmt(e.remaining)} {e.unit}
                              </span>
                              <span className="block text-[9px] text-slate-400">G: {fmt(e.remainingGross)} | N: {fmt(e.remainingNet)}</span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-center">
                              <Link href={billHref(p)} className="rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-800">{t("VIEW")}</Link>
                            </td>
                          </tr>
                        ))}

                      {/* MOVEMENTS ROWS */}
                      {p.movements.length > 0 && (
                        <tr className="border-t border-slate-200 bg-teal-50/60">
                          <td colSpan={totalCols} className="px-3 py-1 text-[10px] font-black uppercase text-teal-900 tracking-wider">
                            {t("LOADING & STOCK TRANSFER ENTRIES")}
                          </td>
                        </tr>
                      )}
                      {p.movements.map((m) => (
                        <tr key={m.id} className="border-t border-slate-100 bg-teal-50/20 text-[10px]">
                          <td className="px-2 py-1">
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${m.kind === "loading" ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800"}`}>
                              {m.kind === "loading" ? t("LOADING") : t("TRANSFER")}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-1 text-slate-500">
                            <span className="font-mono text-slate-700">{p.purchaseNo}</span>
                            <span className="block font-mono text-[9px] text-slate-400">{p.purchaseDate || DASH}</span>
                          </td>
                          <td className="px-2.5 py-1 text-[9px] text-slate-500 truncate">{p.buyerAccount.name || DASH}</td>
                          {showBranch && (
                            <td className="whitespace-nowrap px-2 py-1 font-mono text-[9px] text-slate-500">
                              {p.mainBranchCode} / {p.cityBranchCode}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-2 py-1 font-mono text-black font-semibold text-center">{m.refNo}</td>
                          <td className="px-2 py-1 text-slate-700 font-mono text-[9px]">{m.lot || DASH}</td>
                          <td className="px-2.5 py-1 text-slate-900 font-medium">{m.goodsName}</td>
                          <td className="whitespace-nowrap px-2 py-1 text-end font-mono text-black">{fmt(m.qty)} {m.unit}</td>
                          <td className="px-2 py-1 text-end font-mono text-[9px]">G: {fmt(m.gross)} | N: {fmt(m.net)}</td>
                          <td className="px-2 py-1 text-end font-mono text-[9px]">{m.date || DASH}</td>
                          <td className="px-2 py-1 text-slate-800">
                            <span className="font-semibold">{t(CATEGORY_LABEL[m.category])}</span>
                            {m.destination !== DASH && <span className="text-slate-600"> · {m.destination}</span>}
                          </td>
                          <td className="px-2.5 py-1 text-end text-[10px] uppercase font-bold text-slate-600">{statusLabel(m.status)}</td>
                          <td className="whitespace-nowrap px-2 py-1 text-center">
                            <Link href={movementHref(p, m)} className="rounded border border-teal-300 bg-teal-50 px-1.5 py-0.5 text-[9px] font-black text-teal-900">{t("VIEW")}</Link>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}

                {/* ══ GRAND TOTAL ROW ══ */}
                {shownPurchases.length > 0 && (
                  <tr className="border-t-2 border-emerald-300 bg-emerald-100 font-black text-[10px]">
                    <td className="px-2.5 py-2 text-slate-950 font-black" colSpan={preColspan}>
                      {t("GRAND TOTAL")}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-end font-mono">
                      <span className="block text-[11px] font-black text-black">{fmt(purchaseGrand.qty)}</span>
                      <span className="block text-[9px] font-bold text-slate-700 uppercase">{unitLabel}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-end font-mono">
                      <span className="block font-bold text-black">G: {fmt(purchaseGrand.gross)}</span>
                      <span className="block text-[9px] text-slate-700">N: {fmt(purchaseGrand.net)}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-end font-mono">
                      <span className="block font-bold text-black">{fmt(purchaseGrand.loadedQty)}</span>
                      <span className="block text-[9px] text-slate-700">G: {fmt(purchaseGrand.loadedGross)} | N: {fmt(purchaseGrand.loadedNet)}</span>
                    </td>
                    <td className="px-2 py-2" />
                    <td className="whitespace-nowrap px-2.5 py-2 text-end font-mono">
                      <span className="block text-[11px] font-black text-black">{fmt(purchaseGrand.remaining)}</span>
                      <span className="block text-[9px] text-slate-700">G: {fmt(purchaseGrand.remainingGross)} | N: {fmt(purchaseGrand.remainingNet)}</span>
                    </td>
                    <td className="px-2 py-2" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ══ DESTINATION & RE-EXPORT VIEW ══ */}
      {view === "destination" && (
        <>
          <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {DESTINATION_CATEGORIES.map((c) => (
              <Kpi key={c} label={t(CATEGORY_LABEL[c])} value={fmt(destTotals[c] ?? 0)} unit={unitLabel} tone={CATEGORY_TONE[c]} />
            ))}
          </section>
          <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="max-h-[640px] overflow-auto">
              <table className="w-full min-w-[1400px] text-[11px]">
                <thead className="sticky top-0 z-10 bg-teal-50 text-[10px] font-black uppercase text-slate-700">
                  <tr>
                    <th className="px-2 py-1 text-start">#</th>
                    <th className="px-2 py-1 text-start">{t("DESTINATION")}</th>
                    <th className="px-2 py-1 text-start">{t("PURCHASE NO.")}</th>
                    <th className="px-2 py-1 text-start">{t("PURCHASE DATE")}</th>
                    <th className="px-2 py-1 text-start">{t("ENTRY NO.")}</th>
                    <th className="px-2 py-1 text-start">{t("DATE")}</th>
                    <th className="px-2 py-1 text-start">{t("GOODS NAME")}</th>
                    <th className="px-2 py-1 text-start">{t("BRAND")}</th>
                    <th className="px-2 py-1 text-start">{t("SIZE")}</th>
                    <th className="px-2 py-1 text-start">{t("LOT NAME")}</th>
                    <th className="px-2 py-1 text-end">{t("QTY")}</th>
                    <th className="px-2 py-1 text-end">{t("GROSS WT (KG)")}</th>
                    <th className="px-2 py-1 text-end">{t("NET WT (KG)")}</th>
                    <th className="px-2 py-1 text-start">{t("STATUS")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={14} className="px-2 py-4 text-center text-slate-500">{t("LOADING")}</td>
                    </tr>
                  )}
                  {!loading && !failed && shownDestinations.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-2 py-4 text-center text-slate-500">{t("NO LOADING OR TRANSFER ENTRIES FOUND")}</td>
                    </tr>
                  )}
                  {shownDestinations.map((g, idx) => {
                    const key = `${g.category}|${g.destination}`;
                    const open = openDest.has(key);
                    return (
                      <Fragment key={key}>
                        <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                          <td className="whitespace-nowrap px-2 py-1">
                            <button
                              type="button"
                              onClick={() => toggleDest(key)}
                              aria-expanded={open}
                              aria-label={g.destination}
                              className="me-1 inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-[11px] font-black text-black"
                            >
                              {open ? "−" : "+"}
                            </button>
                            {idx + 1}
                          </td>
                          <td className="px-2 py-1 font-black text-black" colSpan={9}>
                            {t(CATEGORY_LABEL[g.category])}
                            {g.destination !== DASH && <span className="font-semibold text-slate-700"> · {g.destination}</span>}
                            <span className="ms-2 text-[10px] font-normal text-slate-500">({g.rows.length})</span>
                          </td>
                          <td className="px-2 py-1 text-end font-mono text-black">{fmt(g.qty)}</td>
                          <td className="px-2 py-1 text-end font-mono text-black">{fmt(g.gross)}</td>
                          <td className="px-2 py-1 text-end font-mono text-black">{fmt(g.net)}</td>
                          <td className="px-2 py-1" />
                        </tr>
                        {open &&
                          g.rows.map((r, k) => (
                            <tr key={r.id} className="border-t border-slate-100">
                              <td className="px-2 py-1 text-slate-500">{`${idx + 1}.${k + 1}`}</td>
                              <td className="px-2 py-1">
                                <span className={`rounded px-1 text-[9px] font-black uppercase ${r.kind === "loading" ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800"}`}>
                                  {r.kind === "loading" ? t("LOADING") : t("TRANSFER")}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-2 py-1 font-semibold text-black">{r.purchaseNo}</td>
                              <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{r.purchaseDate || DASH}</td>
                              <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{r.refNo}</td>
                              <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{r.date || DASH}</td>
                              <td className="px-2 py-1 text-black">{r.goodsName}</td>
                              <td className="px-2 py-1 text-black">{r.brand}</td>
                              <td className="px-2 py-1 text-black">{r.size}</td>
                              <td className="px-2 py-1 text-black">{r.lot}</td>
                              <td className="whitespace-nowrap px-2 py-1 text-end font-mono text-black">{fmt(r.qty)} {r.unit}</td>
                              <td className="px-2 py-1 text-end font-mono text-black">{fmt(r.gross)}</td>
                              <td className="px-2 py-1 text-end font-mono text-black">{fmt(r.net)}</td>
                              <td className="px-2 py-1 text-[10px] uppercase text-slate-600">{statusLabel(r.status)}</td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="text-[10px] text-slate-500">{t("STOCK ENTERS THIS REGISTER ONLY THROUGH A CONFIRMED WAREHOUSE TRANSFER.")}</p>
      {serialPurchase && <SerialDetails purchase={serialPurchase} onClose={() => setSerialPurchase(null)} t={t} />}
    </div>
  );
}
