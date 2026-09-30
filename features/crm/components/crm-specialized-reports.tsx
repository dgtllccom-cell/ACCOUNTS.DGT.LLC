"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  Filter,
  DollarSign,
  Building2,
  Users,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Printer,
  ChevronDown,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Award,
  Globe2,
  Sparkles,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { getCrmTranslation } from "@/lib/crm/crm-i18n";

interface SpecializedReportProps {
  reportType: "executive" | "pipeline" | "payments-recovery" | "city-branch" | "team-performance";
}

export function CrmSpecializedReportView({ reportType }: SpecializedReportProps) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const t = getCrmTranslation(lang);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const [dashRes, c360Res] = await Promise.all([
          fetch("/api/erp/crm/dashboard"),
          fetch("/api/erp/crm/customer-360?pageSize=50")
        ]);
        const [dashJson, c360Json] = await Promise.all([
          dashRes.json(),
          c360Res.json()
        ]);
        if (isMounted) {
          setData({
            dashboard: dashJson?.data || dashJson,
            c360: c360Json?.data || c360Json
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [reportType]);

  const reportTitles: Record<string, { title: string; subtitle: string; icon: any; color: string }> = {
    executive: {
      title: t.executiveDashboard,
      subtitle: "High-level CRM metrics, executive revenue forecasts, and cross-module performance summaries.",
      icon: BarChart3,
      color: "text-blue-600 bg-blue-50"
    },
    pipeline: {
      title: t.leadPipeline,
      subtitle: "Active deal stages, lead qualification funnels, and conversion opportunities.",
      icon: Filter,
      color: "text-indigo-600 bg-indigo-50"
    },
    "payments-recovery": {
      title: t.paymentsRecovery,
      subtitle: "Receivable ageing, collection tracking, promised recovery dates, and cheque maturities.",
      icon: DollarSign,
      color: "text-emerald-600 bg-emerald-50"
    },
    "city-branch": {
      title: t.cityBranchAnalysis,
      subtitle: "Branch-wise portfolio distribution across UAE, Saudi Arabia, Pakistan, Afghanistan, and Oman.",
      icon: Building2,
      color: "text-rose-600 bg-rose-50"
    },
    "team-performance": {
      title: t.teamPerformance,
      subtitle: "Assigned sales reps, daily follow-up completion rates, and response velocity.",
      icon: Award,
      color: "text-teal-600 bg-teal-50"
    }
  };

  const currentMeta = reportTitles[reportType] || reportTitles.executive;
  const Icon = currentMeta.icon;

  const kpis = data?.c360?.kpis || {
    totalCustomers: 0,
    activeCustomers: 0,
    followUpsToday: 0,
    receivableDue: 0,
    receivableDueCurrency: "AED",
    customerHealth: 0
  };

  const customers = data?.c360?.customers || [];
  const actionItems = data?.dashboard?.actionItems || [];
  const teamUsers = data?.c360?.filterOptions?.users || [];

  // Real per-country receivable totals, computed client-side from the already-fetched
  // actionItems (each row carries a real country_name/currency/remaining_amount) —
  // no fabricated per-country figures, no new backend query needed.
  const receivableByCountry = useMemo(() => {
    const map = new Map<string, { country: string; currency: string; amount: number }>();
    for (const item of actionItems as any[]) {
      if (item.is_completed) continue;
      const remaining = Number(item.remaining_amount || 0);
      if (!remaining) continue;
      const country = item.country_name || "Unspecified";
      const currency = item.currency || "AED";
      const key = `${country}__${currency}`;
      const existing = map.get(key) || { country, currency, amount: 0 };
      existing.amount += remaining;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [actionItems]);

  return (
    <div className={`w-full min-h-screen space-y-6 font-sans pb-12 ${isRtl ? "rtl" : "ltr"}`}>
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <Link href="/dashboard" className="hover:text-blue-600">ERP</Link>
            <span>&gt;</span>
            <Link href="/dashboard/crm" className="hover:text-blue-600">{t.crmReports}</Link>
            <span>&gt;</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{currentMeta.title}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${currentMeta.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {currentMeta.title}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentMeta.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReportsMenuOpen(!reportsMenuOpen)}
              className="h-9 px-3.5 rounded-xl border-slate-200 text-xs font-bold gap-2 bg-white"
            >
              <span>{t.allCrmReports}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </Button>
            {reportsMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setReportsMenuOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-56 z-50 rounded-2xl p-1.5 shadow-xl bg-white border border-slate-200 font-sans animate-in fade-in zoom-in-95 duration-100">
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=executive"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <BarChart3 className="h-4 w-4 mr-2 text-blue-600" />
                    {t.executiveDashboard}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=pipeline"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <Filter className="h-4 w-4 mr-2 text-indigo-600" />
                    {t.leadPipeline}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=customer-360"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <Users className="h-4 w-4 mr-2 text-purple-600" />
                    {t.customer360}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=due-followup"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <Clock className="h-4 w-4 mr-2 text-amber-600" />
                    {t.dueFollowUp}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=payments-recovery"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
                    {t.paymentsRecovery}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=city-branch"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <Building2 className="h-4 w-4 mr-2 text-rose-600" />
                    {t.cityBranchAnalysis}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=team-performance"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <Award className="h-4 w-4 mr-2 text-teal-600" />
                    {t.teamPerformance}
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm/reports"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <FileText className="h-4 w-4 mr-2 text-slate-600" />
                    {t.universalReports}
                  </button>
                </div>
              </>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold gap-1.5"
          >
            <Printer className="h-3.5 w-3.5 text-amber-500" />
            <span>{t.printReport}</span>
          </Button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-bold text-slate-500 mb-1">{t.totalCustomers}</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{kpis.totalCustomers.toLocaleString()}</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">{(kpis as any).totalCustomersTrend || "—"}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-bold text-slate-500 mb-1">{t.activeCustomers}</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{kpis.activeCustomers.toLocaleString()}</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">{(kpis as any).activeCustomersTrend || "—"}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-bold text-slate-500 mb-1">{t.receivableDue}</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{kpis.receivableDueCurrency} {Number(kpis.receivableDue).toLocaleString()}</div>
          <p className="text-[11px] text-rose-600 font-semibold mt-1">{(kpis as any).receivableDueTrend || "—"}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-bold text-slate-500 mb-1">{t.customerHealth}</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{kpis.customerHealth}%</div>
          <p className="text-[11px] text-teal-600 font-semibold mt-1">{(kpis as any).customerHealthTrend || "—"}</p>
        </div>
      </div>

      {/* Main Specialized View Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        {/* EXECUTIVE DASHBOARD VIEW */}
        {reportType === "executive" && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Executive CRM Portfolio &amp; Financial Velocity
            </h3>
            {/* Pipeline value / closed-won / conversion rate require a real deal-stage
                data model, which does not exist yet (see the CRM pipeline strengthening
                work). Previously these three cards showed fixed literals (AED 4,820,000 /
                AED 3,240,000 / 68.4%) that never changed with real data — an honest
                no-data state is shown instead until that model is built. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-2">
                <span className="text-xs font-bold text-blue-900">Total Pipeline Value</span>
                <div className="text-xl font-black text-slate-400">—</div>
                <p className="text-[11px] text-slate-400">Requires the deal-pipeline data model (not yet built)</p>
              </div>
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-2">
                <span className="text-xs font-bold text-emerald-900">Closed Won This Period</span>
                <div className="text-xl font-black text-slate-400">—</div>
                <p className="text-[11px] text-slate-400">Requires the deal-pipeline data model (not yet built)</p>
              </div>
              <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/50 space-y-2">
                <span className="text-xs font-bold text-purple-900">Follow-Up Conversion Rate</span>
                <div className="text-xl font-black text-slate-400">—</div>
                <p className="text-[11px] text-slate-400">Requires the deal-pipeline data model (not yet built)</p>
              </div>
            </div>

            {/* Top Customers by Value */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Top Commercial Accounts</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                    <tr>
                      <th className="p-3">Customer ID</th>
                      <th className="p-3">Company</th>
                      <th className="p-3">Country</th>
                      <th className="p-3">Branch</th>
                      <th className="p-3">Assigned User</th>
                      <th className="p-3 text-right">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500">
                          No commercial accounts registered
                        </td>
                      </tr>
                    ) : (
                      customers.slice(0, 6).map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50/60">
                          <td className="p-3 font-mono font-bold text-blue-600">{c.customerCode}</td>
                          <td className="p-3 font-bold text-slate-800">{c.companyName}</td>
                          <td className="p-3">{c.countryFlag} {c.countryName}</td>
                          <td className="p-3">{c.branchName}</td>
                          <td className="p-3">{c.assignedUserName}</td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {c.health}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* LEAD PIPELINE VIEW */}
        {reportType === "pipeline" && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Commercial Deal Pipeline by Stage
            </h3>
            {/* No lead/deal-stage table exists yet — this previously showed 4 fixed
                "0" / "AED 0" stage cards that could never reflect real data no matter
                how many leads existed. Shown honestly as not-yet-built rather than as
                a live-looking but permanently-empty pipeline. */}
            <div className="p-8 text-center text-slate-500 border border-slate-200 rounded-xl">
              Deal-stage pipeline tracking is not yet built for this CRM. No fabricated stage counts are shown.
            </div>
          </div>
        )}

        {/* PAYMENTS & RECOVERY VIEW */}
        {reportType === "payments-recovery" && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Customer Receivable Ageing &amp; Payment Recovery Schedule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                <span className="text-xs font-bold text-emerald-800">Total Receivable Due</span>
                <div className="text-xl font-black text-emerald-700 mt-1">AED {Number(kpis.receivableDue || 0).toLocaleString()}</div>
                <p className="text-[11px] text-emerald-600 mt-1">Pending recovery balances</p>
              </div>
              {/* Day-range ageing buckets (1-30/31-60/60+) require a real per-item due-date
                  calculation that doesn't exist yet — the three cards here previously showed
                  fixed "AED 0" regardless of actual receivables. This one real, currently
                  available figure (all overdue items, no day split) replaces them. */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 md:col-span-3">
                <span className="text-xs font-bold text-rose-800">Overdue (All)</span>
                <div className="text-xl font-black text-rose-700 mt-1">AED {Number((data?.dashboard?.kpis?.overdueAmount) || 0).toLocaleString()}</div>
                <p className="text-[11px] text-rose-600 mt-1">{Number((data?.dashboard?.kpis?.overdueCount) || 0).toLocaleString()} overdue item(s) — day-range ageing (1-30/31-60/60+) not yet built</p>
              </div>
            </div>
          </div>
        )}

        {/* CITY & BRANCH ANALYSIS VIEW */}
        {reportType === "city-branch" && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Regional Commercial Performance by Territory &amp; City Branch
            </h3>
            {receivableByCountry.length === 0 ? (
              <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 text-center text-sm text-slate-500">
                No open receivable balances found across any country for the current scope.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {receivableByCountry.map((row) => (
                  <div key={`${row.country}__${row.currency}`} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <span>{row.country}</span>
                    </div>
                    <div className="text-xl font-black text-slate-900">{row.currency} {row.amount.toLocaleString()}</div>
                    <p className="text-xs text-slate-500">Open receivable balance</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TEAM PERFORMANCE VIEW */}
        {reportType === "team-performance" && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Commercial Team Follow-Up Velocity &amp; Accountability
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {teamUsers.length === 0 ? (
                <div className="col-span-3 p-8 text-center text-slate-500 border border-slate-200 rounded-xl">
                  No active team activities or assignments recorded
                </div>
              ) : (
                teamUsers.map((u: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                        {u.name?.slice(0, 2).toUpperCase() || "U"}
                      </div>
                      <div>
                        <div className="font-bold text-xs">{u.name}</div>
                        <div className="text-[10.5px] text-slate-400">Account Manager</div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t">
                      <span className="text-slate-500">Assigned Accounts:</span>
                      <span className="font-bold text-slate-700">{customers.filter((c: any) => c.assignedUserName === u.name).length}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
