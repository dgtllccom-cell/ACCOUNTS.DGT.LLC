"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import {
  Building2,
  Search,
  Eye,
  PencilLine,
  Printer,
  Trash2,
  Users,
  UserCheck,
  Plus,
  Mail,
  MessageSquare,
  MoreVertical,
  MoreHorizontal,
  Phone,
  FileText,
  Download,
  Layers,
  Send,
  ArrowLeft,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Globe,
  MapPin,
  Check,
  PhoneCall,
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { CustomerProfile } from "./customer-profile";
import { Party360Modal } from "./party-360-modal";
import { UniversalPartyDirectoryReport } from "./universal-party-directory-report";
import { SendToCustomerModal } from "./send-to-customer-modal";
import { apiGet, apiDelete } from "@/lib/api/client";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLabel } from "./translations";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { cn } from "@/lib/utils";

type CustomerRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  city_id: string | null;
  area_location_id: string | null;
  country_name?: string | null;
  state_province_name?: string | null;
  city_name?: string | null;
  customer_name: string;
  first_name: string | null;
  last_name: string | null;
  father_name: string | null;
  person_code: string | null;
  company_name: string | null;
  gender: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Map countries to flag emojis and short codes
function getCountryFlagAndName(countryStr?: string | null): { flag: string; name: string } {
  if (!countryStr) return { flag: "🌐", name: "UAE" };
  const c = countryStr.toLowerCase().trim();
  if (c.includes("emirates") || c.includes("uae") || c.includes("dubai")) return { flag: "🇦🇪", name: "UAE" };
  if (c.includes("pakistan") || c.includes("pk") || c.includes("karachi")) return { flag: "🇵🇰", name: "Pakistan" };
  if (c.includes("saudi") || c.includes("ksa") || c.includes("riyadh")) return { flag: "🇸🇦", name: "Saudi Arabia" };
  if (c.includes("qatar") || c.includes("doha")) return { flag: "🇶🇦", name: "Qatar" };
  if (c.includes("oman") || c.includes("muscat")) return { flag: "🇴🇲", name: "Oman" };
  if (c.includes("kuwait")) return { flag: "🇰🇼", name: "Kuwait" };
  if (c.includes("bahrain")) return { flag: "🇧🇭", name: "Bahrain" };
  if (c.includes("tajikistan")) return { flag: "🇹🇯", name: "Tajikistan" };
  if (c.includes("china")) return { flag: "🇨🇳", name: "China" };
  if (c.includes("united states") || c.includes("usa") || c.includes("us")) return { flag: "🇺🇸", name: "USA" };
  if (c.includes("united kingdom") || c.includes("uk") || c.includes("britain")) return { flag: "🇬🇧", name: "UK" };
  if (c.includes("afghanistan")) return { flag: "🇦🇫", name: "Afghanistan" };
  return { flag: "🌐", name: countryStr };
}

// Generate 2-letter initials from customer name
function getInitials(name: string): string {
  if (!name) return "CU";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Soft avatar color palettes
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800",
  "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
];

function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

// Source badge colors (visible label comes from the i18n dictionary — cl.src_*)
const SOURCE_MAP: Record<string, { bg: string }> = {
  Website: { bg: "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" },
  Facebook: { bg: "bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800" },
  WhatsApp: { bg: "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" },
  Instagram: { bg: "bg-pink-50 text-pink-600 border border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800" },
  Referral: { bg: "bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" },
  Other: { bg: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" }
};

// Status pill badge colors matching screenshot
const STATUS_STYLES: Record<string, string> = {
  New: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  Contacted: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  Qualified: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  Proposal: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800",
  Negotiation: "bg-peach-50 text-amber-700 bg-amber-50/80 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  Closed: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  Active: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  Lost: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
  Inactive: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
};

const STATUS_TABS = [
  { id: "all", en: "All Leads" },
  { id: "New", en: "New" },
  { id: "Contacted", en: "Contacted" },
  { id: "Qualified", en: "Qualified" },
  { id: "Proposal", en: "Proposal" },
  { id: "Negotiation", en: "Negotiation" },
  { id: "Closed", en: "Closed" },
  { id: "Lost", en: "Lost" }
];

export function CustomerList({ lang: langProp }: { lang: SupportedLanguage }) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  const lang = (activeLang !== "en" ? activeLang : langProp) as SupportedLanguage;
  const isRtl = lang !== "en";

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  type SessionInfo = {
    user?: { fullName?: string | null };
    scopes?: { isSuperAdmin?: boolean; summary?: { branchDisplayName?: string | null } };
  };
  const [session, setSession] = useState<SessionInfo | null>(null);
  useEffect(() => {
    fetch("/api/erp/auth/session")
      .then((r) => r.json())
      .then((json) => setSession(json?.data ?? json ?? null))
      .catch(() => setSession(null));
  }, []);
  const isSuperAdmin = !!session?.scopes?.isSuperAdmin;

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusTab, setSelectedStatusTab] = useState("all");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("all");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("all");
  const [selectedAssignedFilter, setSelectedAssignedFilter] = useState("all");

  // Selection & Pagination state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals & Drawers
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [selected360Party, setSelected360Party] = useState<{ id?: string; name: string } | null>(null);
  const [showUniversalDirectory, setShowUniversalDirectory] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("view") === "journal") {
      setShowUniversalDirectory(true);
    }
  }, [searchParams]);

  // Fetch customers from API
  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ customers: CustomerRow[] }>(
        `/api/erp/customers?limit=300&lang=${encodeURIComponent(lang || "en")}`
      );
      setCustomers(res.customers ?? []);
    } catch (e: any) {
      setError(e.message || "Failed to load customer registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [lang]);

  // Close active row menus on outside click
  useEffect(() => {
    const handleOutside = () => setActiveMenuId(null);
    window.addEventListener("click", handleOutside);
    return () => window.removeEventListener("click", handleOutside);
  }, []);

  // Parse custom metadata for each customer
  const parsedCustomers = useMemo(() => {
    return customers.map((c) => {
      let meta: any = {};
      if (c.notes) {
        try {
          const parsed = JSON.parse(c.notes);
          if (parsed && typeof parsed === "object") meta = parsed;
        } catch {}
      }

      // Only real, saved values — no synthetic/mock assignment.
      const source = meta.source || "";
      const leadStatus = meta.leadStatus || meta.status || "";
      const assignedStaff = meta.assignedTo || "";
      const phone = c.mobile || c.whatsapp || meta.phone || "—";

      const countryName = c.country_name || meta.country || "";
      const stateName = c.state_province_name || meta.stateProvince || "";
      const cityName = c.city_name || meta.city || "";

      return {
        ...c,
        meta: {
          ...meta,
          source,
          leadStatus,
          assignedStaff,
          phone,
          countryName,
          stateName,
          cityName
        }
      };
    });
  }, [customers]);

  // Status Tab Counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: parsedCustomers.length };
    STATUS_TABS.forEach((tab) => {
      if (tab.id !== "all") {
        counts[tab.id] = parsedCustomers.filter(
          (c) => c.meta.leadStatus?.toLowerCase() === tab.id.toLowerCase()
        ).length;
      }
    });
    return counts;
  }, [parsedCustomers]);

  // Country / Branch Report stats
  const geoStats = useMemo(() => {
    const countryCounts: Record<string, number> = {};
    const branchSet = new Set<string>();
    parsedCustomers.forEach((c) => {
      const country = c.meta.countryName;
      if (country) countryCounts[country] = (countryCounts[country] || 0) + 1;
      if (c.meta.cityName) branchSet.add(c.meta.cityName);
    });
    const topEntry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      countries: Object.keys(countryCounts).length,
      branches: branchSet.size,
      topCountry: topEntry ? `${topEntry[0]} (${topEntry[1]})` : "—",
    };
  }, [parsedCustomers]);

  // Filtered List
  const filteredList = useMemo(() => {
    let list = parsedCustomers;

    // Search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          (c.company_name && c.company_name.toLowerCase().includes(q)) ||
          (c.person_code && c.person_code.toLowerCase().includes(q)) ||
          (c.meta.phone && c.meta.phone.toLowerCase().includes(q)) ||
          (c.meta.countryName && c.meta.countryName.toLowerCase().includes(q)) ||
          (c.meta.cityName && c.meta.cityName.toLowerCase().includes(q)) ||
          (c.meta.assignedStaff && c.meta.assignedStaff.toLowerCase().includes(q))
      );
    }

    // Status Tab filter
    if (selectedStatusTab !== "all") {
      list = list.filter(
        (c) => c.meta.leadStatus?.toLowerCase() === selectedStatusTab.toLowerCase()
      );
    }

    // Country filter
    if (selectedCountryFilter !== "all") {
      list = list.filter(
        (c) => c.meta.countryName?.toLowerCase() === selectedCountryFilter.toLowerCase()
      );
    }

    // Branch (city) filter
    if (selectedBranchFilter !== "all") {
      list = list.filter(
        (c) => c.meta.cityName?.toLowerCase() === selectedBranchFilter.toLowerCase()
      );
    }

    // Assigned user filter
    if (selectedAssignedFilter !== "all") {
      list = list.filter(
        (c) => c.meta.assignedStaff?.toLowerCase() === selectedAssignedFilter.toLowerCase()
      );
    }

    return list;
  }, [parsedCustomers, searchQuery, selectedStatusTab, selectedCountryFilter, selectedBranchFilter, selectedAssignedFilter]);

  // Real filter-option lists, derived from actual customer records (never a fixed sample list).
  const filterOptions = useMemo(() => {
    const uniq = (vals: (string | undefined)[]) =>
      Array.from(new Set(vals.filter((v): v is string => !!v))).sort();
    return {
      countries: uniq(parsedCustomers.map((c) => c.meta.countryName)),
      branches: uniq(parsedCustomers.map((c) => c.meta.cityName)),
      assignees: uniq(parsedCustomers.map((c) => c.meta.assignedStaff)),
    };
  }, [parsedCustomers]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Select all handler
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(paginatedCustomers.map((c) => c.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  // Row toggle handler
  const handleToggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRows(next);
  };

  // Delete Action
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete customer "${name}"?`)) return;
    try {
      await apiDelete(`/api/erp/customers/${id}`);
      void loadCustomers();
    } catch (e: any) {
      alert(e.message || "Failed to delete customer.");
    }
  };

  // Export CSV Action
  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Company", "Source", "Status", "Assigned To", "Country", "State", "City", "Phone", "Created At"];
    const rows = filteredList.map(c => [
      c.person_code || c.id,
      `"${c.customer_name.replace(/"/g, '""')}"`,
      `"${(c.company_name || "").replace(/"/g, '""')}"`,
      c.meta.source,
      c.meta.leadStatus,
      `"${c.meta.assignedStaff}"`,
      `"${c.meta.countryName}"`,
      `"${c.meta.stateName}"`,
      `"${c.meta.cityName}"`,
      `"${c.meta.phone}"`,
      new Date(c.created_at).toLocaleDateString()
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customers_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Profile Action
  const handlePrint = async (c: (typeof parsedCustomers)[number]) => {
    const { openMasterProfile } = await import("@/lib/reports/master-profiles");
    void openMasterProfile({
      entity: "customer",
      lang: lang,
      autoPrint: true,
      scope: { countryId: c.country_id ?? null, countryName: c.country_name ?? null },
      record: {
        id: c.id,
        customer_name: c.customer_name,
        company_name: c.company_name || c.meta?.companyName,
        father_name: c.father_name || c.meta?.fatherName,
        mobile: c.mobile,
        whatsapp: c.whatsapp,
        email: c.email,
        address: c.address,
        city_name: c.meta?.cityName,
        country_name: c.meta?.countryName
      }
    });
  };

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* ================= BREADCRUMB & HEADER (Matching Image 2) ================= */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 transition"
          >
            <span className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs font-bold text-[11px]">&larr; {t(lang, "common.back", "Back")}</span>
            <span className="text-xs text-slate-500 font-semibold">
              {t(lang, "common.home", "Home")} / {t(lang, "cl.breadcrumb_sales_crm", "Sales & CRM")} / {t(lang, "cl.customer_management", "Customer Management")}
            </span>
          </button>

          {/* Right Header Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/settings/customers/setup" as Route)}
              className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 gap-1.5"
            >
              <Download className="h-3.5 w-3.5 rotate-180 text-blue-600" />
              <span>{t(lang, "cl.import", "Import")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUniversalDirectory(true)}
              className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 gap-1.5"
            >
              <span>{t(lang, "cl.more_actions", "More Actions")}</span>
              <span className="text-[10px]">▼</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ================= TITLE AREA ================= */}
      <div className="flex items-center gap-3.5">
        <div className="h-12 w-12 rounded-2xl bg-[#8b5cf6] flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {t(lang, "cl.customer_management", "Customer Management")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            {t(lang, "cl.subtitle", "Manage and track your customers, from inquiry to close.")}
          </p>
        </div>
      </div>

      {/* ================= 4 KPI SUMMARY CARDS (Matching Image 2) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Branch & User Details (Purple) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-xl bg-[#8b5cf6] text-white flex items-center justify-center shadow-xs">
              <Building2 className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Branch &amp; User Details
            </h3>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_branch", "Branch")}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{session?.scopes?.summary?.branchDisplayName || t(lang, "cl.head_office", "Head Office")}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_total_users", "Total Users")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">—</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_active_users", "Active Users")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">—</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_inactive_users", "Inactive Users")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">—</span>
            </div>
          </div>
        </div>

        {/* Card 2: Customer Summary (Green) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-xl bg-[#10b981] text-white flex items-center justify-center shadow-xs">
              <Users className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {t(lang, "cl.kpi_customer_summary", "Customer Summary")}
            </h3>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_total_customers", "Total Customers")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{parsedCustomers.length}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_active_customers", "Active Customers")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {parsedCustomers.filter(c => (c.meta.leadStatus || "").toLowerCase() === "active" || (c.meta.leadStatus || "").toLowerCase() === "closed").length}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_new_this_month", "New This Month")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {parsedCustomers.filter(c => {
                  const d = new Date(c.created_at);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_inactive_customers", "Inactive Customers")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {parsedCustomers.filter(c => (c.meta.leadStatus || "").toLowerCase() === "inactive" || (c.meta.leadStatus || "").toLowerCase() === "lost").length}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Customer Pipeline / Status Summary (Orange) */}
        <div className="bg-[#FFFDF9] dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 p-4 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-xl bg-[#f59e0b] text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-amber-900 dark:text-amber-300">
              {t(lang, "cl.kpi_pipeline_summary", "Customer Pipeline / Status Summary")}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.status_new", "New")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["New"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.status_negotiation", "Negotiation")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Negotiation"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.status_contacted", "Contacted")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Contacted"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.status_closed", "Closed")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Closed"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.status_qualified", "Qualified")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Qualified"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.status_lost", "Lost")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Lost"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.status_proposal", "Proposal")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Proposal"] ?? 0}</span>
            </div>
            <div></div>
          </div>
        </div>

        {/* Card 4: Country / Branch Customer Report (Blue with Super Admin Only Badge) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shadow-xs">
                <Globe className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {t(lang, "cl.kpi_country_branch", "Country / Branch Customer Report")}
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#6366f1] text-white">
              {t(lang, "audit.super_admin_only", "Super Admin Only")}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_total_countries", "Total Countries")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{geoStats.countries}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_total_branches", "Total Branches")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{geoStats.branches}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_customers_this_branch", "Customers (This Branch)")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{parsedCustomers.length}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_top_country", "Top Country")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{geoStats.topCountry}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= STATUS PILLS (Matching Image 2) ================= */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
        {STATUS_TABS.map((tab) => {
          const isSelected = selectedStatusTab.toLowerCase() === tab.id.toLowerCase();
          const count = statusCounts[tab.id] ?? (tab.id === "all" ? 28 : tab.id === "New" ? 8 : tab.id === "Contacted" ? 5 : tab.id === "Qualified" ? 6 : tab.id === "Proposal" ? 4 : tab.id === "Negotiation" ? 3 : tab.id === "Closed" ? 2 : 0);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedStatusTab(tab.id);
                setCurrentPage(1);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs",
                isSelected
                  ? "bg-[#1d63ed] text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"
              )}
            >
              <span>{tab.id === "all" ? "All Leads" : tab.en}</span>
              <span
                className={cn(
                  "text-[10px] font-black px-1.5 py-0.2 rounded-full",
                  isSelected
                    ? "bg-blue-500 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ================= FILTER TOOLBAR (Matching Image 2) ================= */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2.5 rounded-2xl shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t(lang, "cl.search_ph_full", "Search by customer name, company or mobile...")}
            className="w-full h-9 pl-9 pr-3 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 font-medium"
          />
        </div>

        {/* All Countries Select */}
        <div className="relative">
          <select
            value={selectedCountryFilter}
            onChange={(e) => {
              setSelectedCountryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-3 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer appearance-none"
          >
            <option value="all">{t(lang, "cl.all_countries", "All Countries")}</option>
            {filterOptions.countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
        </div>

        {/* All Branches Select */}
        <div className="relative">
          <select
            value={selectedBranchFilter}
            onChange={(e) => {
              setSelectedBranchFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-3 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer appearance-none"
          >
            <option value="all">{t(lang, "cl.all_branches", "All Branches")}</option>
            {filterOptions.branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
        </div>

        {/* Assigned User Select */}
        <div className="relative">
          <select
            value={selectedAssignedFilter}
            onChange={(e) => {
              setSelectedAssignedFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-3 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer appearance-none"
          >
            <option value="all">{t(lang, "cl.assigned_user", "Assigned User")}</option>
            {filterOptions.assignees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
        </div>

        {/* All Statuses Select */}
        <div className="relative">
          <select
            value={selectedStatusTab}
            onChange={(e) => {
              setSelectedStatusTab(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-3 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer appearance-none"
          >
            <option value="all">{t(lang, "cl.all_status", "All Statuses")}</option>
            <option value="New">{t(lang, "cl.status_new", "New")}</option>
            <option value="Contacted">{t(lang, "cl.status_contacted", "Contacted")}</option>
            <option value="Qualified">{t(lang, "cl.status_qualified", "Qualified")}</option>
            <option value="Proposal">{t(lang, "cl.status_proposal", "Proposal")}</option>
            <option value="Negotiation">{t(lang, "cl.status_negotiation", "Negotiation")}</option>
            <option value="Closed">{t(lang, "cl.status_closed", "Closed")}</option>
            <option value="Lost">{t(lang, "cl.status_lost", "Lost")}</option>
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
        </div>

        {/* Refresh Button */}
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadCustomers()}
          className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t(lang, "common.refresh", "Refresh")}</span>
        </Button>

        {/* Filter Button (Reset all filters) */}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSearchQuery("");
            setSelectedStatusTab("all");
            setSelectedCountryFilter("all");
            setSelectedBranchFilter("all");
            setSelectedAssignedFilter("all");
          }}
          className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{t(lang, "cl.reset_all_filters", "Reset all filters")}</span>
        </Button>

        {/* Second Filter Button */}
        <Button
          type="button"
          variant="outline"
          className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{t(lang, "cl.filters", "Filter")}</span>
        </Button>

        {/* + Add Customer Button (Solid Blue) */}
        <Button
          type="button"
          onClick={() => router.push("/dashboard/settings/customers/setup" as Route)}
          className="h-9 px-4 gap-1.5 bg-[#1d63ed] hover:bg-[#1a55cd] text-white font-bold rounded-xl text-xs shadow-xs transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>+ {t(lang, "cl.add_customer", "Add Customer")}</span>
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {/* ================= MAIN CUSTOMERS REGISTER TABLE (Matching Image 2) ================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Top Header Bar */}
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                {t(lang, "cl.customer_register", "Customer Register")}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {t(lang, "cl.customer_register_sub", "Manage and view all registered customers")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{t(lang, "common.print", "Print")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300"
            >
              <FileText className="h-3.5 w-3.5 text-red-500" />
              <span>{t(lang, "wh.pdf", "PDF")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>{t(lang, "asr.excel", "Excel")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUniversalDirectory(true)}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              <span>... {t(lang, "cl.more", "More")}</span>
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                {/* Select All Checkbox */}
                <th className="px-3.5 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      paginatedCustomers.length > 0 &&
                      paginatedCustomers.every((c) => selectedRows.has(c.id))
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    aria-label={t(lang, "cl.aria_select_all", "Select all leads on current page")}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-3.5 w-12 text-slate-400">#</th>
                <th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_customer_id", "Customer ID")}</th>
                <th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_customer_name", "Customer Name")}</th>
                <th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_company", "Company")}</th>
                <th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_country", "Country")}</th>
                <th className="px-4 py-3.5 font-bold">{t(lang, "cl.f_branch", "Branch")}</th>
                <th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_source", "Source")}</th>
                <th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_status", "Status")}</th>
                <th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_assigned_to", "Assigned To")}</th>
                <th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_mobile", "Mobile")}</th>
                <th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_created_date", "Created Date")}</th>
                <th className="px-4 py-3.5 text-center font-bold">{t(lang, "cl.col_actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                    {t(lang, "cl.loading_records", "Loading customer records...")}
                  </td>
                </tr>
              ) : paginatedCustomers.length > 0 ? (
                paginatedCustomers.map((c, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isSelected = selectedRows.has(c.id);
                  const countryInfo = getCountryFlagAndName(c.meta.countryName);
                  const initials = getInitials(c.customer_name);
                  const avatarColor = getAvatarColor(c.customer_name);
                  const source = c.meta.source || "—";
                  const leadStatus = c.meta.leadStatus || "—";
                  const cleanPhone = (c.meta.phone || "").replace(/[^0-9+]/g, "");
                  const customerId = c.person_code || "—";
                  const branch = c.meta.cityName ? `${c.meta.cityName} Branch` : "—";

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={cn(
                        "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer text-slate-700 dark:text-slate-300 font-medium",
                        isSelected && "bg-blue-50/40 dark:bg-blue-950/20"
                      )}
                    >
                      {/* Row Checkbox */}
                      <td className="px-3.5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleRow(c.id, e as any)}
                          aria-label={`Select lead ${c.customer_name}`}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Index */}
                      <td className="px-3 py-3 font-semibold text-slate-400 text-xs">
                        {globalIdx}
                      </td>

                      {/* CUSTOMER ID */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                        {customerId}
                      </td>

                      {/* CUSTOMER NAME with avatar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "grid h-7 w-7 place-items-center rounded-full text-[11px] font-black shrink-0 border",
                              avatarColor
                            )}
                          >
                            {initials}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[160px]">
                            {c.customer_name}
                          </span>
                        </div>
                      </td>

                      {/* COMPANY */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs font-semibold truncate max-w-[150px]">
                        {c.company_name || c.meta.companyName || "—"}
                      </td>

                      {/* COUNTRY with flag */}
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="text-sm leading-none">{countryInfo.flag}</span>
                          <span className="text-slate-700 dark:text-slate-300">{countryInfo.name}</span>
                        </div>
                      </td>

                      {/* BRANCH */}
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {branch}
                      </td>

                      {/* SOURCE */}
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {source}
                      </td>

                      {/* STATUS (styled pill badge with +) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {leadStatus.toLowerCase() === "new" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            + New
                          </span>
                        )}
                        {leadStatus.toLowerCase() === "contacted" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            + Contacted
                          </span>
                        )}
                        {leadStatus.toLowerCase() === "qualified" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            + Qualified
                          </span>
                        )}
                        {leadStatus.toLowerCase() === "proposal" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            + Proposal
                          </span>
                        )}
                        {leadStatus.toLowerCase() === "negotiation" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                            + Negotiation
                          </span>
                        )}
                        {leadStatus.toLowerCase() === "closed" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            + Closed
                          </span>
                        )}
                        {leadStatus.toLowerCase() === "lost" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            + Lost
                          </span>
                        )}
                        {!["new", "contacted", "qualified", "proposal", "negotiation", "closed", "lost"].includes(leadStatus.toLowerCase()) && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            + Active
                          </span>
                        )}
                      </td>

                      {/* ASSIGNED TO */}
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap">
                        {c.meta.assignedStaff || "—"}
                      </td>

                      {/* MOBILE */}
                      <td className="px-4 py-3 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {c.meta.phone || "+971 50 123 4567"}
                      </td>

                      {/* CREATED DATE */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                        {new Date(c.created_at || Date.now()).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === c.id ? null : c.id);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {activeMenuId === c.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 mt-1 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1 z-50 text-left animate-in fade-in zoom-in-95 duration-100"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  router.push(`/dashboard/settings/customers/${c.id}`);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-400" />
                                <span>{t(lang, "common.view", "View")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  router.push(`/dashboard/settings/customers/${c.id}` as Route);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                              >
                                <Pencil className="h-3.5 w-3.5 text-slate-400" />
                                <span>{t(lang, "common.edit", "Edit")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  void handleDelete(c.id, c.customer_name);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>{t(lang, "common.delete", "Delete")}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                    {t(lang, "cl.no_matching_leads", "No matching customer leads found.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ================= PAGINATION FOOTER ================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 text-xs text-slate-500">
          {/* Left: Showing count & per page dropdown */}
          <div className="flex items-center gap-3">
            <span>
              {t(lang, "cl.showing", "Showing")} {filteredList.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} {t(lang, "cl.to_pagination", "to")}{" "}
              {Math.min(currentPage * pageSize, filteredList.length)} {t(lang, "cl.of_records", "of")} {filteredList.length} {t(lang, "cl.customers_group", "Customers")}
            </span>
            <div className="relative inline-block">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                aria-label={t(lang, "cl.aria_per_page", "Leads per page")}
                className="h-7 px-2.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none pr-6 shadow-2xs"
              >
                <option value={10}>{`10 ${t(lang, "cl.per_page_suffix", "per page")}`}</option>
                <option value={25}>{`25 ${t(lang, "cl.per_page_suffix", "per page")}`}</option>
                <option value={50}>{`50 ${t(lang, "cl.per_page_suffix", "per page")}`}</option>
                <option value={100}>{`100 ${t(lang, "cl.per_page_suffix", "per page")}`}</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Right: Page Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label={t(lang, "common.previous_page", "Previous page")}
              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = i + 1;
              const isActive = currentPage === pageNum;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "grid h-7 min-w-[28px] px-1.5 place-items-center rounded-lg text-xs font-bold transition-all shadow-2xs",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}

            {totalPages > 5 && (
              <>
                <span className="px-1 text-slate-400">...</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  className={cn(
                    "grid h-7 min-w-[28px] px-1.5 place-items-center rounded-lg text-xs font-bold transition-all shadow-2xs",
                    currentPage === totalPages
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  )}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label={t(lang, "common.next_page", "Next page")}
              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= DRAWER & MODALS ================= */}
      <DetailDrawer
        isOpen={selectedCustomerId !== null}
        onClose={() => setSelectedCustomerId(null)}
        title={getLabel("customerProfileDetailsTitle", lang)}
        subtitle={getLabel("enterpriseRecordContactVerificationSub", lang)}
      >
        {selectedCustomerId && (
          <CustomerProfile
            lang={lang}
            customerId={selectedCustomerId}
            isDrawer
          />
        )}
      </DetailDrawer>

      <UniversalReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title={getLabel("customerOwnerDirectoryReportTitle", lang)}
        subtitle={getLabel("completeMasterCustomerDirectorySub", lang)}
        exportFileName="customer_directory_report"
        filters={[
          { label: getLabel("searchQueryLabel", lang), value: searchQuery || t(lang, "purchase.card_none_label", "None") }
        ]}
        columns={[
          { key: "customer_name", label: getLabel("customerOwnerNameLabel", lang) },
          { key: "company_name", label: getLabel("companyFirmNameLabel", lang) },
          { key: "contact_person", label: t(lang, "hr.pp_contact_person", "Contact Person") },
          { key: "mobile", label: t(lang, "purchase.f_mobile_number", "Mobile Number") },
          { key: "whatsapp", label: t(lang, "purchase.dd_whatsapp", "WhatsApp") },
          { key: "email", label: getLabel("emailAddress", lang) },
          { key: "address", label: t(lang, "purchase.f_address", "Address") }
        ]}
        data={filteredList.map((c) => ({
          customer_name: c.customer_name,
          company_name: c.company_name || "-",
          contact_person: c.contact_person || "-",
          mobile: c.mobile || "-",
          whatsapp: c.whatsapp || "-",
          email: c.email || "-",
          address: c.address || "-"
        }))}
      />

      {/* 360 Degree Cross-System Party Modal */}
      {selected360Party && (
        <Party360Modal
          customerId={selected360Party.id}
          name={selected360Party.name}
          lang={lang}
          onClose={() => setSelected360Party(null)}
        />
      )}

      {/* Universal 360 Parties Directory Report Modal */}
      {showUniversalDirectory && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-xs">
          <div className="relative w-full max-w-7xl max-h-[94vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 overflow-y-auto">
            <UniversalPartyDirectoryReport
              lang={lang}
              onClose={() => setShowUniversalDirectory(false)}
            />
          </div>
        </div>
      )}

      {/* Send to Customer Modal */}
      <SendToCustomerModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        lang={lang}
        defaultFormType="customer"
      />
    </div>
  );
}
