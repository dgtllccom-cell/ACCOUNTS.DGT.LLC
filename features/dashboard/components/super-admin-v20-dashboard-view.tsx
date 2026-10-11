"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Globe, Building2, Users2, Users, Building, Activity,
  ShoppingCart, ShoppingBag, Wallet, CreditCard, TrendingUp, Coins,
  ChevronDown, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import {
  SuperAdminOverviewCharts,
  type CountryFinancialSummary,
  type MonthlyFinancialSummary
} from "@/features/dashboard/components/super-admin-overview-charts";
import { SyncLedgersButton } from "@/features/dashboard/components/sync-ledgers-button";
import { SuperAdminDashboardSettingsPanel, DashboardWidget } from "@/features/dashboard/components/super-admin-dashboard-settings";

export interface DashboardV20Data {
  counts: {
    countries: number;
    branches: number;
    users: number;
    customers: number;
    suppliers: number;
    purchasesCount: number;
  };
  totals: {
    sales: number;
    purchases: number;
    debit: number;
    credit: number;
    balance: number;
  };
  activeUsers: number;
  countries: CountryFinancialSummary[];
  companies?: { id: string; name: string }[];
  monthly: MonthlyFinancialSummary[];
  error: string | null;
}

function money(value: number) {
  const rounded = Math.round(value);
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.abs(rounded));
  return `${rounded < 0 ? "-" : ""}$${formatted}`;
}

function formatDate(d: Date): string {
  try {
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return "10 OCT 2026";
  }
}

export function SuperAdminV20DashboardView({ data }: { data: DashboardV20Data }) {
  const lang = useActiveLanguage();
  const rtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = useCallback((key: string, fallback: string) => t(lang, key, fallback), [lang]);

  // V20 Scope / Filter State
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState("all");
  const [selectedRole, setSelectedRole] = useState("Super Admin");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [appliedCountry, setAppliedCountry] = useState("all");

  const todayStr = useMemo(() => formatDate(new Date()), []);

  const handleApply = () => {
    setAppliedCountry(selectedCountry);
    setFlyoutOpen(false);
  };

  const handleReset = () => {
    setSelectedBusiness("all");
    setSelectedRole("Super Admin");
    setSelectedCountry("all");
    setAppliedCountry("all");
    setFlyoutOpen(false);
  };

  // Filter calculations based on applied country
  const filteredData = useMemo(() => {
    if (appliedCountry === "all") return data;
    const matched = data.countries.find((c) => c.id === appliedCountry);
    if (!matched) return data;

    return {
      ...data,
      counts: {
        ...data.counts,
        countries: 1,
        branches: matched.totalBranches,
        users: matched.totalUsers
      },
      totals: {
        sales: matched.totalSales,
        purchases: matched.totalPurchases,
        debit: matched.totalDebit,
        credit: matched.totalCredit,
        balance: matched.totalLedgerBalance
      }
    };
  }, [data, appliedCountry]);

  // V20 Key Business Indicators (6 vibrant cards)
  const kpis = [
    {
      id: "countries",
      label: tt("dash.total_countries", "Active Countries"),
      value: filteredData.counts.countries || 0,
      bg: "bg-[#087ef1]",
      subtitle: tt("dash.live_records", "Live data")
    },
    {
      id: "branches",
      label: tt("dash.total_branches", "Active Branches"),
      value: filteredData.counts.branches || 0,
      bg: "bg-[#03ba8b]",
      subtitle: tt("dash.live_records", "Live data")
    },
    {
      id: "customers",
      label: tt("dash.total_customers", "Customers"),
      value: filteredData.counts.customers || 0,
      bg: "bg-[#8253dd]",
      subtitle: tt("dash.live_records", "Live data")
    },
    {
      id: "suppliers",
      label: tt("dash.companies_suppliers", "Companies / Suppliers"),
      value: filteredData.counts.suppliers || 0,
      bg: "bg-[#ff9113]",
      subtitle: tt("dash.live_records", "Live data")
    },
    {
      id: "purchases",
      label: tt("nav.purchases", "Purchase Bookings"),
      value: filteredData.counts.purchasesCount || 0,
      bg: "bg-[#f43d59]",
      subtitle: tt("dash.live_records", "Live data")
    },
    {
      id: "users",
      label: tt("dash.active_users", "Active Users"),
      value: filteredData.activeUsers || filteredData.counts.users || 0,
      bg: "bg-[#10a5c2]",
      subtitle: tt("dash.live_records", "Live data")
    }
  ];

  // V20 Financial Overview (6 white cards)
  const finances = [
    {
      id: "sales",
      title: tt("dash.total_sales", "Total Sales"),
      value: money(filteredData.totals.sales),
      subtext: "↑ live overview"
    },
    {
      id: "purchases",
      title: tt("dash.total_purchase", "Total Purchases"),
      value: money(filteredData.totals.purchases),
      subtext: "↑ live overview"
    },
    {
      id: "receivables",
      title: tt("dash.total_receivables", "Receivables"),
      value: money(filteredData.totals.debit),
      subtext: "↑ live overview"
    },
    {
      id: "payables",
      title: tt("dash.total_payables", "Payables"),
      value: money(filteredData.totals.credit),
      subtext: "↑ live overview"
    },
    {
      id: "net_ledger",
      title: tt("dash.cash_balance", "Net Ledger"),
      value: money(filteredData.totals.debit - filteredData.totals.credit),
      subtext: "↑ live overview"
    },
    {
      id: "ledger_balance",
      title: tt("dash.ledger_balance", "Ledger Balance"),
      value: money(filteredData.totals.balance),
      subtext: "↑ live overview"
    }
  ];

  return (
    <div className="w-full space-y-4 pb-12 text-[#123a61] dark:text-slate-100" dir={rtl ? "rtl" : "ltr"}>
      {/* 2. V20 APPROVED MARITIME HERO BANNER */}
      <section className="relative rounded-2xl border border-slate-200/80 shadow-md dark:border-slate-800">
        {/* Background layer with rounded corners and clipping */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(2,22,46,0.85) 0%, rgba(4,28,55,0.60) 52%, rgba(3,17,40,0.72) 100%), url('/assets/dgt-maritime-banner.png')`,
            backgroundPosition: "center 52%",
            backgroundSize: "cover"
          }}
        />
        <div className="relative z-10 min-h-[140px] sm:min-h-[160px] md:min-h-[184px] w-full p-4 sm:p-6 md:p-8 flex flex-col justify-between">
          {/* Top Tools: Action Buttons & Enclosed Date/Time */}
          <div className="flex flex-col items-end gap-2 self-end z-20">
            {/* The 3 action buttons in a row */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {/* 1. Business / Admin Scope Flyout */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setFlyoutOpen((prev) => !prev);
                    setSettingsOpen(false);
                  }}
                  aria-expanded={flyoutOpen}
                  className="flex items-center gap-2 rounded-lg border border-[#ffe9a1] bg-gradient-to-r from-[#ffe184] to-[#ffc64b] px-3 py-1.5 text-xs font-extrabold text-[#443418] shadow-md transition hover:from-[#ffe697] hover:to-[#ffd064] cursor-pointer"
                >
                  <span className="grid h-4 w-4 place-items-center rounded bg-white/60 text-[11px]">☷</span>
                  <span className="truncate max-w-[130px] sm:max-w-none">
                    {appliedCountry !== "all"
                      ? data.countries.find((c) => c.id === appliedCountry)?.name || "Country Scoped"
                      : "Business / Admin"}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${flyoutOpen ? "rotate-180" : ""}`} />
                </button>

              {/* Flyout Dialog (Centered Floating Modal, Never Clipped) */}
              {flyoutOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
                  {/* Subtle click-outside backdrop */}
                  <div
                    className="fixed inset-0 -z-10"
                    onClick={() => setFlyoutOpen(false)}
                  />
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-amber-800 text-sm font-black dark:bg-amber-950/60 dark:text-amber-400">
                          ☷
                        </span>
                        <div>
                          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                            DASHBOARD VIEW
                          </span>
                          <strong className="text-sm font-black text-slate-800 dark:text-slate-100">
                            Business / Admin / Country
                          </strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFlyoutOpen(false)}
                        className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        aria-label={tt("common.close", "Close")}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-3.5 text-xs">
                      <label className="block">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Business</span>
                        <select
                          value={selectedBusiness}
                          onChange={(e) => setSelectedBusiness(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="all">{data.companies?.[0]?.name || tt("purchase.damaan_business_group", "Damaan General Trading LLC")}</option>
                          {data.companies?.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Admin Role</span>
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="Super Admin">{tt("sarh.opt_super_admin", "Super Admin")}</option>
                          <option value="Country Admin">{tt("sarh.opt_country_admin", "Country Admin")}</option>
                          <option value="Branch Admin">{tt("sarh.opt_branch_admin", "Branch Admin")}</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{tt("dash.total_countries", "Country")}</span>
                        <select
                          value={selectedCountry}
                          onChange={(e) => setSelectedCountry(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="all">{tt("audit.filter_all_countries", "All Countries")}</option>
                          {data.countries.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-5 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleReset}
                        className="h-9 flex-1 text-xs font-bold"
                      >
                        {tt("common.reset", "Reset")}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleApply}
                        className="h-9 flex-1 bg-blue-600 text-xs font-bold hover:bg-blue-700"
                      >
                        {tt("report.apply_filters", "Apply view")} ✓
                      </Button>
                    </div>

                    <small className="mt-3 block text-center text-[10px] text-slate-400">
                      Live ERP database connected
                    </small>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Dashboard Settings Button */}
            <SuperAdminDashboardSettingsPanel
              isOpen={settingsOpen}
              onOpenChange={(next) => {
                setSettingsOpen(next);
                if (next) setFlyoutOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/40 bg-white/95 px-3 py-1.5 text-xs font-extrabold text-slate-800 shadow-sm backdrop-blur-xs transition hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
            />

            {/* 3. Reloading / Sync Ledgers Button */}
            <SyncLedgersButton
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/40 bg-blue-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-blue-700 cursor-pointer"
            />
          </div>

          {/* Enclosed Date & Time Badge right below the 3 buttons */}
          <div className="flex items-center gap-2 rounded-lg border border-white/25 bg-black/40 px-3 py-1 text-[11px] font-bold text-white shadow-inner backdrop-blur-md">
            <span className="text-[#ffd66a]">📅</span>
            <span>{todayStr}</span>
            <span className="text-white/40">•</span>
            <span className="text-[10px] text-emerald-300 font-semibold tracking-wide flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Sync
            </span>
          </div>
        </div>

          {/* Title with yellow vertical accent bar */}
          <div className="mt-4 max-w-xl rounded-r-2xl border-l-[3.5px] border-[#ffd66a] bg-gradient-to-r from-[#01132d]/40 via-[#01132d]/20 to-transparent p-3 sm:p-4 rtl:border-l-0 rtl:border-r-[3.5px] rtl:rounded-r-none rtl:rounded-l-2xl">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md">
              {tt("nav.super_admin_menu", "Super Admin Dashboard")}
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-200/90 drop-shadow-xs">
              Import • Export • Shipping • Finance
            </p>
          </div>
        </div>
      </section>

      {/* 3. KEY BUSINESS INDICATORS (6 VIBRANT CARDS) */}
      <DashboardWidget id="kpis">
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              KEY BUSINESS INDICATORS
            </h2>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {tt("dash.live_records", "Live records")}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => (
              <div
                key={kpi.id}
                className={`relative overflow-hidden rounded-xl ${kpi.bg} p-2.5 sm:p-3.5 text-white shadow-sm transition hover:shadow-md`}
              >
                {/* Watermark circular arc */}
                <div className="pointer-events-none absolute -right-4 top-2 h-16 w-16 rounded-full border-2 border-white/20 rtl:-left-4 rtl:right-auto" />

                <div className="text-[10px] sm:text-xs font-black opacity-85">◇</div>
                <div className="mt-1 sm:mt-1.5 text-lg sm:text-2xl md:text-3xl font-black tracking-tight leading-none">
                  {kpi.value.toLocaleString()}
                </div>
                <div className="mt-1 text-[10px] sm:text-[11px] font-bold leading-tight truncate">
                  {kpi.label}
                </div>
                <div className="mt-1 text-[8px] sm:text-[9px] font-medium text-white/80 truncate">
                  {kpi.subtitle}
                </div>
              </div>
            ))}
          </div>
        </section>
      </DashboardWidget>

      {/* 4. FINANCIAL OVERVIEW (6 CLEAN WHITE CARDS) */}
      <DashboardWidget id="finance">
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {tt("dash.financial_overview_live", "Financial Overview (Live Records)")}
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
            {finances.map((fin) => (
              <div
                key={fin.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-xs transition hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="text-[10px] sm:text-[11px] font-bold text-[#7394ba] truncate">
                    {fin.title}
                  </div>
                  <div className="mt-1 text-base sm:text-lg md:text-xl font-black text-[#123d70] tracking-tight dark:text-blue-300">
                    {fin.value}
                  </div>
                </div>
                {/* These totals are real ledger/order records — no "sample" wording and no growth arrow (there is no period comparison here). */}
                <div className="mt-2 text-[8px] sm:text-[9px] font-semibold text-slate-400 flex items-center gap-1">
                  <span>{tt("dash.live_records", "Live records")}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </DashboardWidget>

      {/* 5. BUSINESS ANALYTICS & REPORTS (CHARTS) */}
      <section className="space-y-2.5">
        <SuperAdminOverviewCharts
          countrySummaries={data.countries}
          monthlyFinancials={data.monthly}
        />
      </section>
    </div>
  );
}
