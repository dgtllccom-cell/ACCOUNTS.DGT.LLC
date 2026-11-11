"use client";

/**
 * Page top for the Purchase Booking and Local Purchase main pages (the approved reference layout):
 * title + Super Admin badge + breadcrumb, one toolbar (Reports, Filter, Search, Reset, Refresh, Apply, menu),
 * a reports panel, and three cards (Summary, Booking Status, Country Wise). Every figure is computed from the rows
 * the page already loaded, through the same computePayTotals() the approved header uses. No sample data.
 */

import { useState, type ReactNode } from "react";
import { ShoppingCart, SlidersHorizontal, RotateCcw, RefreshCw, Search, ChevronDown, Crown, BarChart3 } from "lucide-react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { fmtInt, fmtMoney, fmtPct } from "@/lib/purchase-ui/money-unit";
import { computePayTotals, type PayRow } from "@/features/purchases/components/purchase-payments-approved-header";

export type PurchaseReportLink = { label: string; href: string };

export function PurchasePageTop({
  lang, title, superAdmin, breadcrumb, rows, rates, reports, search, onSearch, filterCount, onOpenFilters,
  onReset, onRefresh, onApply, loading, menu,
}: {
  lang: string;
  title: string;
  superAdmin: boolean;
  breadcrumb: string[];
  rows: PayRow[];
  rates?: Record<string, number>;
  reports: PurchaseReportLink[];
  search: string;
  onSearch: (value: string) => void;
  filterCount: number;
  onOpenFilters: () => void;
  onReset: () => void;
  onRefresh: () => void;
  onApply: () => void;
  loading?: boolean;
  menu: ReactNode;
}) {
  const t = (label: string) => translateHeader(lang, label);
  const [reportsOpen, setReportsOpen] = useState(false);
  const m = computePayTotals(rows, rates);
  const completed = rows.filter((r) => r.settled).length;
  const partial = rows.filter((r) => !r.settled && r.advance + r.remainingPaid + r.credit > 0.005).length;
  const pending = rows.filter((r) => !r.settled && r.advance + r.remainingPaid + r.credit <= 0.005).length;
  const totalBills = rows.length;
  const pct = (n: number): string => fmtPct(n, totalBills) ?? "—";

  return (
    <div className="space-y-3">
      {/* Title row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <ShoppingCart className="h-6 w-6 text-blue-700" aria-hidden="true" />
          <h1 className="text-xl font-black text-blue-800 dark:text-blue-300">{title}</h1>
          {superAdmin && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              {t("Super Admin View")}
            </span>
          )}
        </div>
        <nav aria-label="breadcrumb" className="text-xs font-semibold text-slate-500">
          {breadcrumb.join(" / ")}
        </nav>
      </div>

      {/* One toolbar: Reports, Filter, Search, Reset, Refresh, Apply, menu */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <button type="button" onClick={() => setReportsOpen((v) => !v)} aria-expanded={reportsOpen}
          className="h-9 px-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-[0_2px_0_0_#1e40af] cursor-pointer">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          {t("Reports")}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={onOpenFilters}
          className="h-9 px-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-[0_2px_0_0_#1e40af] cursor-pointer">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("Filter")}{filterCount ? ` (${filterCount})` : ""}
        </button>
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <input type="text" value={search} onChange={(e) => onSearch(e.target.value)} placeholder={t("Search")}
            className="h-9 w-full ps-8 pe-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800" />
        </div>
        <div className="ms-auto flex items-center gap-2">
          <button type="button" onClick={onReset} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t("Reset")}
          </button>
          <button type="button" onClick={onRefresh} className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 cursor-pointer" aria-label={t("Refresh")}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
          <button type="button" onClick={onApply} className="h-9 px-4 inline-flex items-center rounded-lg bg-[#2563eb] text-white text-xs font-bold shadow-[0_3px_0_0_#1e40af] cursor-pointer">
            {t("Apply")}
          </button>
          {menu}
        </div>
      </div>

      {reportsOpen && (
        <div className="grid grid-cols-1 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-950">
          {reports.map((r) => (
            <a key={r.href} href={r.href} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 dark:text-slate-200">
              {r.label}
            </a>
          ))}
        </div>
      )}

      {/* Three cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <section className="rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-3 shadow-sm">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-amber-900">{t("Purchase Booking Summary")}</h2>
          <dl className="space-y-1.5 text-xs">
            <Row k={t("Total Bills")} v={fmtInt(totalBills)} />
            <Row k={t("Total Purchase")} v={fmtMoney(m.unit, m.total)} />
            <Row k={t("Total Paid")} v={fmtMoney(m.unit, m.paid)} />
            <Row k={t("Finalized")} v={fmtInt(completed)} />
            <Row k={t("Pending")} v={fmtInt(pending)} />
            <Row k={t("Balance (To Be Paid)")} v={fmtMoney(m.unit, m.due)} strong />
          </dl>
        </section>

        <section className="rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-3 shadow-sm">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-blue-900">{t("Booking Status")}</h2>
          <table className="w-full text-xs">
            <thead className="text-[10px] font-bold uppercase text-slate-500">
              <tr><th className="text-start py-1">{t("Status")}</th><th className="text-end py-1">{t("Bills")}</th><th className="text-end py-1">{t("% of Bills")}</th></tr>
            </thead>
            <tbody className="font-semibold text-slate-800">
              <StatusRow label={t("Completed")} n={completed} p={pct(completed)} dot="bg-emerald-500" />
              <StatusRow label={t("Partially Completed")} n={partial} p={pct(partial)} dot="bg-blue-500" />
              <StatusRow label={t("Pending")} n={pending} p={pct(pending)} dot="bg-amber-500" />
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-3 shadow-sm">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-emerald-900">{t("Country Wise Purchase Booking")}</h2>
          {m.countries.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">{t("No records found.")}</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] font-bold uppercase text-slate-500">
                <tr><th className="text-start py-1">#</th><th className="text-start py-1">{t("Country")}</th><th className="text-end py-1">{t("Bills")}</th><th className="text-end py-1">{t("Purchase Amount")}</th></tr>
              </thead>
              <tbody className="font-semibold text-slate-800">
                {m.countries.map((c, i) => (
                  <tr key={c.name} className="border-t border-emerald-100">
                    <td className="py-1">{i + 1}</td>
                    <td className="py-1">{c.name}</td>
                    <td className="py-1 text-end font-mono">{fmtInt(c.count)}</td>
                    <td className="py-1 text-end font-mono">{c.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 ${strong ? "rounded-md bg-amber-100/60 px-2 py-1 font-black text-red-700" : ""}`}>
      <dt className="text-slate-600">{k}</dt>
      <dd className="font-mono">{v}</dd>
    </div>
  );
}

function StatusRow({ label, n, p, dot }: { label: string; n: number; p: string; dot: string }) {
  return (
    <tr className="border-t border-blue-100">
      <td className="py-1"><span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />{label}</span></td>
      <td className="py-1 text-end font-mono">{fmtInt(n)}</td>
      <td className="py-1 text-end font-mono">{p}</td>
    </tr>
  );
}
