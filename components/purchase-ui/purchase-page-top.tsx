"use client";

/**
 * Page top for the Purchase Booking and Local Purchase main pages, following the approved reference layout:
 * title + Super Admin badge + breadcrumb; one toolbar (Reports dropdown, Filter, search, Apply, menu); three cards
 * (Summary, Booking Status, Country Wise). Every figure is computed from the rows the page already loaded, through
 * computePayTotals(). No sample data.
 */

import { useState, type ReactNode } from "react";
import { ShoppingCart, SlidersHorizontal, ChevronDown, ChevronRight, Crown, Search, Check, Layers, BarChart3, Globe, FileText, Wallet } from "lucide-react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { fmtInt, fmtMoney, fmtPct } from "@/lib/purchase-ui/money-unit";
import { computePayTotals, type PayRow } from "@/features/purchases/components/purchase-payments-approved-header";

export type PurchaseReportLink = { label: string; href: string; current?: boolean; more?: boolean };

const REPORT_ICONS = [ShoppingCart, FileText, Wallet] as const;

export function PurchasePageTop({
  lang, title, superAdmin, breadcrumb, rows, rates, reports, search, onSearch, filterCount, onOpenFilters, onApply, menu,
  // Optional and no longer shown in the toolbar (Reset lives in the menu). Kept so existing callers still type-check.
  onReset: _onReset, onRefresh: _onRefresh, loading: _loading,
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
  onApply: () => void;
  menu: ReactNode;
  onReset?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
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
          <ShoppingCart className="h-7 w-7 text-blue-700" aria-hidden="true" />
          <h1 className="text-xl font-black text-blue-700 dark:text-blue-300">{title}</h1>
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

      {/* Toolbar: Reports, Filter | search, Apply, menu */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="relative">
          <button
            type="button"
            onClick={() => setReportsOpen((v) => !v)}
            aria-expanded={reportsOpen}
            className="h-9 px-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-[0_2px_0_0_#1e40af] cursor-pointer"
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            {t("Reports")}
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {reportsOpen && (
            <div className="absolute start-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
              {reports.map((r, i) => {
                const Icon = REPORT_ICONS[i % REPORT_ICONS.length];
                return (
                  <a
                    key={r.href}
                    href={r.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold ${r.current ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"}`}
                  >
                    {r.more ? <BarChart3 className="h-4 w-4 text-blue-600" aria-hidden="true" /> : <Icon className="h-4 w-4 text-blue-600" aria-hidden="true" />}
                    <span className="flex-1">{r.label}</span>
                    {r.more && <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenFilters}
          className="h-9 px-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-[0_2px_0_0_#1e40af] cursor-pointer"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("Filter")}
          {filterCount ? ` (${filterCount})` : ""}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <div className="relative w-56 max-w-full">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={t("Search")}
              className="h-9 w-full ps-8 pe-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800"
            />
          </div>
          <button
            type="button"
            onClick={onApply}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] text-white text-xs font-bold shadow-[0_3px_0_0_#1e40af] cursor-pointer"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {t("Apply")}
          </button>
          {menu}
        </div>
      </div>

      {/* Three cards: Summary, Booking Status, Country Wise */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <section className="rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-3 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-900">
            <Layers className="h-4 w-4 text-amber-600" aria-hidden="true" />
            {t("Purchase Booking Summary")}
          </h2>
          <dl className="space-y-1.5 text-xs">
            <Row k={t("Total Bills")} v={fmtInt(totalBills)} />
            <Row k={t("Total Purchase")} v={fmtMoney(m.unit, m.total)} />
            <Row k={t("Total Paid")} v={fmtMoney(m.unit, m.paid)} />
            <Row k={t("Finalized (Completed)")} v={fmtInt(completed)} />
            <Row k={t("Pending (Remaining)")} v={fmtInt(pending)} />
            <Row k={t("Balance (To Be Paid)")} v={fmtMoney(m.unit, m.due)} strong />
          </dl>
        </section>

        <section className="rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-3 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-900">
            <BarChart3 className="h-4 w-4 text-blue-600" aria-hidden="true" />
            {t("Booking Status")}
          </h2>
          <table className="w-full text-xs">
            <thead className="text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th className="text-start py-1">{t("Status")}</th>
                <th className="text-end py-1">{t("Bills")}</th>
                <th className="text-end py-1">{t("% of Bills")}</th>
              </tr>
            </thead>
            <tbody className="font-semibold text-slate-800">
              <StatusRow label={t("Completed")} n={completed} p={pct(completed)} dot="bg-emerald-500" />
              <StatusRow label={t("Partially Completed")} n={partial} p={pct(partial)} dot="bg-blue-500" />
              <StatusRow label={t("Pending")} n={pending} p={pct(pending)} dot="bg-amber-500" />
              <tr className="border-t-2 border-blue-200 font-black text-slate-900">
                <td className="py-1.5">{t("Total")}</td>
                <td className="py-1.5 text-end font-mono">{fmtInt(totalBills)}</td>
                <td className="py-1.5 text-end font-mono">{totalBills > 0 ? "100.0%" : "—"}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-3 shadow-sm">
          <h2 className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-900">
            <Globe className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {t("Country Wise Purchase Booking")}
            <span className="font-semibold normal-case text-slate-500">({t("Final Currency Wise")})</span>
          </h2>
          {m.countries.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">{t("No records found.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-xs">
                <thead className="text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="text-start py-1">#</th>
                    <th className="text-start py-1">{t("Country")}</th>
                    <th className="text-start py-1">{t("Currency")}</th>
                    <th className="text-end py-1">{t("Total Bills")}</th>
                    <th className="text-end py-1">{t("Purchase Amount")}</th>
                    <th className="text-end py-1">{t("Paid Amount")}</th>
                  </tr>
                </thead>
                <tbody className="font-semibold text-slate-800">
                  {m.countries.map((c, i) => (
                    <tr key={c.name} className="border-t border-emerald-100">
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1">{c.name}</td>
                      <td className="py-1 font-mono">{c.currency}</td>
                      <td className="py-1 text-end font-mono">{fmtInt(c.count)}</td>
                      <td className="py-1 text-end font-mono">{c.text}</td>
                      <td className="py-1 text-end font-mono text-emerald-700">{c.paidText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
      <td className="py-1">
        <span className="inline-flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
          {label}
        </span>
      </td>
      <td className="py-1 text-end font-mono">{fmtInt(n)}</td>
      <td className="py-1 text-end font-mono">{p}</td>
    </tr>
  );
}
