"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  Coins,
  FileSpreadsheet,
  Globe,
  Receipt,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  ArrowRight,
  Lock,
  Printer
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import { translateHeader } from "@/lib/i18n/table-headers";

export interface ReportItem {
  id: string;
  title: string;
  description: string;
  category: "Financial & Ledger" | "Sales & Revenue" | "Purchase & Stock" | "Branch & Country" | "Audit & System";
  href: string;
  icon: any;
  allowedRoles: string[]; // ['super_admin', 'country_admin', 'main_branch_admin', 'city_branch_admin', 'accountant', 'cashier', 'auditor_viewer']
}

export const ALL_REPORTS_CATALOG: ReportItem[] = [
  // Financial & Ledger
  {
    id: "cash-entry",
    title: "Daily Payment Entry (Roznamcha)",
    description: "Daily debit and credit transactions log with filter controls",
    category: "Financial & Ledger",
    href: "/dashboard/reports?type=cash-entry",
    icon: Wallet,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
  },
  {
    id: "receipts",
    title: "Receipts General Ledger",
    description: "Inward cash and bank receipts list per branch and country",
    category: "Financial & Ledger",
    href: "/dashboard/reports?type=receipts",
    icon: Receipt,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
  },
  {
    id: "payments",
    title: "Payments Ledger",
    description: "Outward payouts, supplier bills, and corporate expenses",
    category: "Financial & Ledger",
    href: "/dashboard/reports?type=payments",
    icon: Coins,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
  },
  {
    id: "financial-summaries",
    title: "Trial Balance & Financial Summaries",
    description: "Account balance summaries, trial balances, and net income",
    category: "Financial & Ledger",
    href: "/dashboard/reports?type=financial-summaries",
    icon: FileSpreadsheet,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "auditor_viewer"]
  },
  {
    id: "financial-statements",
    title: "Financial Statements (P&L, Balance Sheet, Cash Flow)",
    description: "Profit & Loss, Balance Sheet, and Cash & Bank Position for the selected scope and period",
    category: "Financial & Ledger",
    href: "/dashboard/reports/financial-statements",
    icon: BookOpen,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "auditor_viewer"]
  },
  {
    id: "exchange-rates",
    title: "Global & Pakistan Exchange Rates",
    description: "Daily USD conversion rates, buying & selling logs",
    category: "Financial & Ledger",
    href: "/dashboard/reports?type=exchange-rates",
    icon: Globe,
    allowedRoles: ["super_admin", "country_admin"]
  },

  // Sales & Revenue
  {
    id: "sales-booking-register",
    title: "Sales Booking Journal Register",
    description: "Customer sales orders, invoices, and payment tracking",
    category: "Sales & Revenue",
    href: "/dashboard/sales/sales-booking-journal-report",
    icon: ClipboardList,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
  },
  {
    id: "customer-accounts",
    title: "Customer Account Ledgers",
    description: "Customer balances, manual references & account ledgers",
    category: "Sales & Revenue",
    href: "/dashboard/reports?type=customer-accounts",
    icon: Users,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
  },

  // Purchase & Stock
  {
    id: "purchase-booking-register",
    title: "Purchase Booking Register",
    description: "Wholesaler / Import Export / Container Trading register",
    category: "Purchase & Stock",
    href: "/dashboard/reports?type=purchase-booking-register",
    icon: ClipboardList,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
  },
  {
    id: "journal-stock-salesman",
    title: "Journal Stock Salesman Report",
    description: "Inventory stock levels filtered by salesman assignments",
    category: "Purchase & Stock",
    href: "/dashboard/inventory/stock-reports/salesman",
    icon: BarChart3,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]
  },
  {
    id: "journal-stock-country",
    title: "Journal Stock Country Report",
    description: "Nationwide stock balances and warehouse summary",
    category: "Purchase & Stock",
    href: "/dashboard/inventory/stock-reports/country",
    icon: Globe,
    allowedRoles: ["super_admin", "country_admin"]
  },
  {
    id: "journal-stock-branch",
    title: "Journal Stock Branch Report",
    description: "City branch stock inventory tracking and bill checking",
    category: "Purchase & Stock",
    href: "/dashboard/inventory/stock-reports/branch",
    icon: Building2,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]
  },

  // Branch & Country
  {
    id: "branch-general-report",
    title: "Branch General Management Report",
    description: "Comprehensive multi-tier branch network breakdown",
    category: "Branch & Country",
    href: "/dashboard/branch-management/general-report",
    icon: ShieldCheck,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]
  },
  {
    id: "branch-transactions",
    title: "Branch Transaction Performance",
    description: "Total volumes and branch-wise transactions count",
    category: "Branch & Country",
    href: "/dashboard/reports?type=branch-transactions",
    icon: BarChart3,
    allowedRoles: ["super_admin", "country_admin", "main_branch_admin"]
  },

  // Audit & System
  {
    id: "audit-logs",
    title: "Audit Trail Logs & System Activity",
    description: "Database transaction logs, user actions & IP audit trails",
    category: "Audit & System",
    href: "/dashboard/reports?type=audit-logs",
    icon: ShieldAlert,
    allowedRoles: ["super_admin"]
  },
  {
    id: "user-activity",
    title: "User Live Activity Journal",
    description: "Staff role logins, permissions, and active operational sessions",
    category: "Audit & System",
    href: "/dashboard/reports?type=user-activity",
    icon: Users,
    allowedRoles: ["super_admin", "country_admin"]
  }
];

export function AllReportsView() {
  const lang = useActiveLanguage();
  const tr = (label: string) => translateHeader(lang, label);
  const [userRole, setUserRole] = useState<string>("super_admin");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    async function loadRole() {
      try {
        const res = await apiGet<any>("/api/branch-management/general-report");
        if (res?.summary?.superAdminName) {
          setUserRole("super_admin");
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadRole();
  }, []);

  const categories = [
    "all",
    "Financial & Ledger",
    "Sales & Revenue",
    "Purchase & Stock",
    "Branch & Country",
    "Audit & System"
  ];

  const filteredReports = ALL_REPORTS_CATALOG.filter((report) => {
    const matchesSearch =
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "all" || report.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handlePrintCatalog = () => {
    openUniversalPrintReport({
      title: tr("ERP Reports & Analytics Catalog Directory"),
      subtitle: `${tr("Total Reports")}: ${filteredReports.length}`,
      lang,
      orientation: "portrait",
      moduleType: "register",
      scope: {
        scopeLevel: "Super Admin Reports Directory",
        userName: userRole.replace("_", " ").toUpperCase(),
      },
      kpis: [
        { label: tr("Total Reports"), value: ALL_REPORTS_CATALOG.length, color: "blue" },
        { label: tr("Filtered Count"), value: filteredReports.length, color: "emerald" },
        { label: tr("Category Filter"), value: selectedCategory === "all" ? "All Categories" : selectedCategory, color: "purple" },
      ],
      filters: [
        ...(searchQuery ? [{ label: tr("Search Query"), value: searchQuery }] : []),
        ...(selectedCategory !== "all" ? [{ label: tr("Category"), value: selectedCategory }] : []),
      ],
      columns: [
        { key: "category", label: tr("Category"), width: "20%" },
        { key: "title", label: tr("Report Title"), width: "35%" },
        { key: "description", label: tr("Description & Scope"), width: "45%" },
      ],
      rows: filteredReports.map((r) => ({
        category: r.category,
        title: r.title,
        description: r.description,
      })),
      autoPrint: false,
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{t(lang, "arv.arv_centralized_reports_suite", "Centralized Reports Suite")}</div>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">{t(lang, "arv.arv_all_erp_reports_catalog", "All ERP Reports & Analytical Catalog")}</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Role-based permissions automatically restrict reports to authorized Country or Branch scopes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Print Catalog Button */}
          <button
            onClick={handlePrintCatalog}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Printer className="h-4 w-4 text-blue-600" />
            <span>{t(lang, "common.print", "Print Directory")}</span>
          </button>

          {/* Active Role Scope Badge */}
          <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white font-bold">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span>{t(lang, "arv.arv_active_role_scope_colon", "Active Role Scope:")}</span>
            <span className="text-emerald-400 capitalize">{userRole.replace("_", " ")}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition",
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                )}
              >
                {cat === "all" ? "All Categories" : cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t(lang, "arv.arv_search_reports_ph", "Search reports by title...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredReports.map((report) => {
          const isAllowed = report.allowedRoles.includes(userRole) || userRole === "super_admin";
          const Icon = report.icon;

          return (
            <div
              key={report.id}
              className={cn(
                "rounded-2xl border p-5 transition-all flex flex-col justify-between space-y-4",
                isAllowed
                  ? "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md"
                  : "bg-slate-50 border-slate-200 opacity-60"
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 border text-slate-600">
                    {tr(report.category)}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-slate-900">{tr(report.title)}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{tr(report.description)}</p>
                </div>
              </div>

              <div>
                {isAllowed ? (
                  <Link
                    href={report.href}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    {t(lang, "arv.arv_open_report", "Open Report")} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                    <Lock className="h-3.5 w-3.5" /> {t(lang, "arv.arv_restricted_to_role", "Restricted to Role")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
