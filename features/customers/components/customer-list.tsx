"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  PhoneCall
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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusTab, setSelectedStatusTab] = useState("all");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("all");

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

    return list;
  }, [parsedCustomers, searchQuery, selectedStatusTab, selectedCountryFilter]);

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
      {/* ================= TOP APPLICATION HEADER STRIP ================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Left: Title & Subtitle */}
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {getLabel("customersTitle", lang) || "Leads"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {t(lang, "cl.subtitle", "Manage and track your leads, from inquiry to close.")}
            </p>
          </div>

          {/* Right: Search, Filter Dropdowns, Export, Add Lead */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t(lang, "cl.search_ph", "Search leads, contacts, companies...")}
                className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={selectedStatusTab}
                onChange={(e) => {
                  setSelectedStatusTab(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label={t(lang, "cl.filter_by_status", "Filter by status")}
                className="h-9 px-3 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none pr-8 shadow-2xs"
              >
                <option value="all">{t(lang, "cl.all_status", "All Status")}</option>
                <option value="New">{t(lang, "cl.status_new", "New")}</option>
                <option value="Contacted">{t(lang, "cl.status_contacted", "Contacted")}</option>
                <option value="Qualified">{t(lang, "cl.status_qualified", "Qualified")}</option>
                <option value="Proposal">{t(lang, "cl.status_proposal", "Proposal")}</option>
                <option value="Negotiation">{t(lang, "cl.status_negotiation", "Negotiation")}</option>
                <option value="Closed">{t(lang, "cl.status_closed", "Closed")}</option>
                <option value="Lost">{t(lang, "cl.status_lost", "Lost")}</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Filters Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedStatusTab("all");
                setSelectedCountryFilter("all");
              }}
              title={t(lang, "cl.reset_all_filters", "Reset all filters")}
              className="h-9 px-3 gap-1.5 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span>{t(lang, "cl.filters", "Filters")}</span>
            </Button>

            {/* Export Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-9 px-3 gap-1.5 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>{t(lang, "common.export", "Export")}</span>
            </Button>

            {/* Primary "+ Add Lead" / "+ Add Customer" Button */}
            <Button
              type="button"
              onClick={() => router.push("/dashboard/settings/customers/setup" as Route)}
              className="h-9 px-4 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t(lang, "cl.add_lead", "Add Lead")}</span>
            </Button>

            {/* More Menu Dropdown */}
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuId(activeMenuId === "top_more" ? null : "top_more");
                }}
                className="h-9 w-9 p-0 border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>

              {activeMenuId === "top_more" && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-1.5 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      setShowUniversalDirectory(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
                  >
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{t(lang, "cl.universal_directory", "360° Universal Directory")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      setShowReport(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
                  >
                    <Printer className="h-3.5 w-3.5 text-cyan-600" />
                    <span>{t(lang, "cl.print_master_report", "Print Master Report")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      setShowSendModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
                  >
                    <Send className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{t(lang, "cl.send_form_link", "Send Form Link")}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= STATUS SEGMENT FILTER PILLS ================= */}
        <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const isSelected = selectedStatusTab.toLowerCase() === tab.id.toLowerCase();
            const count = statusCounts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSelectedStatusTab(tab.id);
                  setCurrentPage(1);
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                )}
              >
                <span>{t(lang, `cl.tab_${tab.id.toLowerCase()}`, tab.en)}</span>
                <span
                  className={cn(
                    "text-[10px] font-black px-1.5 py-0.2 rounded-md",
                    isSelected
                      ? "bg-blue-500/80 text-white"
                      : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {/* ================= MAIN CUSTOMERS TABLE ================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
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
                <th className="px-4 py-3.5">{t(lang, "cl.col_name", "Name")}</th>
                <th className="px-4 py-3.5">{t(lang, "cl.col_company", "Company")}</th>
                <th className="px-4 py-3.5">{t(lang, "cl.col_source", "Source")}</th>
                <th className="px-4 py-3.5">{t(lang, "cl.col_status", "Status")}</th>
                <th className="px-4 py-3.5">{t(lang, "cl.col_assigned_to", "Assigned To")}</th>
                <th className="px-4 py-3.5">{t(lang, "cl.col_country", "Country")}</th>
                <th className="px-4 py-3.5">{t(lang, "cl.col_state", "State")}</th>
                <th className="px-4 py-3.5">{t(lang, "cl.col_city", "City")}</th>
                <th className="px-4 py-3.5">{t(lang, "cl.col_phone", "Phone")}</th>
                <th className="px-4 py-3.5">{t(lang, "cl.col_created_at", "Created At")}</th>
                <th className="px-4 py-3.5 text-center">{t(lang, "cl.col_actions", "Actions")}</th>
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
                  const source = c.meta.source || "";
                  const sourceBadge = source ? (SOURCE_MAP[source] || SOURCE_MAP.Other) : null;
                  const leadStatus = c.meta.leadStatus || "";
                  const statusBadgeClass = leadStatus ? (STATUS_STYLES[leadStatus] || STATUS_STYLES.New) : "";
                  const cleanPhone = (c.meta.phone || "").replace(/[^0-9+]/g, "");

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

                      {/* Name with circular avatar initials */}
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

                      {/* Company */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs font-semibold truncate max-w-[150px]">
                        {c.company_name || c.meta.companyName || "—"}
                      </td>

                      {/* Source Pill */}
                      <td className="px-4 py-3">
                        {sourceBadge ? (
                          <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold", sourceBadge.bg)}>
                            {t(lang, `cl.src_${source.toLowerCase()}`, source)}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Status Pill */}
                      <td className="px-4 py-3">
                        {leadStatus ? (
                          <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border", statusBadgeClass)}>
                            {t(lang, `cl.status_${leadStatus.toLowerCase()}`, leadStatus)}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Assigned To */}
                      <td className="px-4 py-3">
                        {c.meta.assignedStaff ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-200 font-semibold">
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-black text-slate-700 dark:text-slate-200">
                              {getInitials(c.meta.assignedStaff)}
                            </span>
                            <span className="truncate max-w-[110px]">{c.meta.assignedStaff}</span>
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>

                      {/* Country with flag */}
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm leading-none">{countryInfo.flag}</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{countryInfo.name}</span>
                        </div>
                      </td>

                      {/* State / Province */}
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {c.meta.stateName || "—"}
                      </td>

                      {/* City */}
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {c.meta.cityName || "—"}
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {c.meta.phone}
                      </td>

                      {/* Created At */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                        {new Date(c.created_at || Date.now()).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Phone Call */}
                          <a
                            href={`tel:${cleanPhone}`}
                            title={`Call: ${c.meta.phone}`}
                            className="p-1 rounded-lg text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>

                          {/* WhatsApp */}
                          <a
                            href={`https://wa.me/${cleanPhone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`WhatsApp: ${c.meta.phone}`}
                            className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </a>

                          {/* Email */}
                          <a
                            href={`mailto:${c.email || "info@dgt.llc"}`}
                            title={`Email: ${c.email || "info@dgt.llc"}`}
                            className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>

                          {/* Edit Pencil */}
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/settings/customers/setup?customerId=${c.id}` as Route)}
                            title={t(lang, "cl.edit_customer", "Edit Customer")}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </button>

                          {/* 3-dots dropdown */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === c.id ? null : c.id);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
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
                                    setSelectedCustomerId(c.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                                >
                                  <Eye className="h-3.5 w-3.5 text-teal-600" />
                                  <span>{t(lang, "cl.view_profile", "View Profile")}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setSelected360Party({ id: c.id, name: c.customer_name });
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                                >
                                  <Layers className="h-3.5 w-3.5 text-indigo-600" />
                                  <span>{t(lang, "cl.dossier_360", "360° Dossier")}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    void handlePrint(c);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                                >
                                  <Printer className="h-3.5 w-3.5 text-blue-600" />
                                  <span>{t(lang, "cl.print_dossier", "Print Dossier")}</span>
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
              Showing {filteredList.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, filteredList.length)} of {filteredList.length} leads
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
