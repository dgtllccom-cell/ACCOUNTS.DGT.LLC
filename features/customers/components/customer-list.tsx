"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import {
  Building2,
  Search,
  Eye,
  Printer,
  Trash2,
  Users,
  UserCheck,
  Plus,
  MoreVertical,
  MoreHorizontal,
  FileText,
  Download,
  Layers,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  Calendar,
  Pencil,
  UserPlus,
  Clock,
  Sparkles,
  Copy,
  Globe,
  CheckCircle2,
  PhoneCall,
  Loader2
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
import { resolveCustomerName, readBilingualNamesPreference, writeBilingualNamesPreference, BILINGUAL_NAMES_STORAGE_KEY } from "@/lib/i18n/customer-name";
import { SavedText } from "@/components/i18n/saved-text";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { formatErpDate, toIso } from "@/lib/datetime/erp-date";

type CustomerRow = {
  id: string;
  is_active?: boolean;
  country_id: string;
  state_province_id: string | null;
  city_id: string | null;
  area_location_id: string | null;
  country_name?: string | null;
  state_province_name?: string | null;
  city_name?: string | null;
  customer_name: string;
  original_customer_name?: string | null;
  customer_name_en?: string | null;
  customer_name_ur?: string | null;
  customer_name_ar?: string | null;
  customer_name_fa?: string | null;
  customer_name_ps?: string | null;
  native_customer_name?: string | null;
  name_translation_authorized?: boolean;
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
  employee_code?: string | null;
  employee_designation?: string | null;
  employee_department?: string | null;
  is_employee?: boolean;
  is_truck_owner?: boolean;
  is_truck_driver?: boolean;
  accounts_count?: number;
  banks_count?: number;
  is_clearing_agent?: boolean;
  companies_count?: number;
  linked_companies?: Array<{
    id: string;
    name: string;
    code?: string | null;
    legal_name?: string | null;
    country_id?: string | null;
  }>;
  branches_count?: number;
  linked_branches?: Array<{
    id: string;
    name: string;
    code?: string | null;
    type: string;
    country_id?: string | null;
    country_name?: string | null;
    company_id?: string | null;
    company_name?: string | null;
  }>;
};

// Map countries to flag emojis and ISO short codes
function getCountryBadge(countryStr?: string | null, lang: SupportedLanguage = "en"): { flag: string; code: string; name: string } {
  if (!countryStr) return { flag: "🌐", code: "AE", name: "UAE" };
  const c = countryStr.toLowerCase().trim();
  if (c.includes("afghanistan") || c.includes("af")) {
    const name = lang === "ur" ? "افغانستان" : lang === "ar" ? "أفغانستان" : lang === "fa" ? "افغانستان" : lang === "ps" ? "افغانستان" : "Afghanistan";
    return { flag: "🇦🇫", code: "AF", name };
  }
  if (c.includes("pakistan") || c.includes("pk") || c.includes("karachi") || c.includes("quetta") || c.includes("sialkot")) {
    const name = lang === "ur" ? "پاکستان" : lang === "ar" ? "باكستان" : lang === "fa" ? "پاکستان" : lang === "ps" ? "پاکستان" : "Pakistan";
    return { flag: "🇵🇰", code: "PK", name };
  }
  if (c.includes("emirates") || c.includes("uae") || c.includes("dubai") || c.includes("abu dhabi")) {
    const name = lang === "ur" ? "متحدہ عرب امارات" : lang === "ar" ? "الإمارات" : lang === "fa" ? "امارات" : lang === "ps" ? "متحده عربي امارات" : "UAE";
    return { flag: "🇦🇪", code: "AE", name };
  }
  if (c.includes("china") || c.includes("cn") || c.includes("dalian")) {
    const name = lang === "ur" ? "چین" : lang === "ar" ? "الصين" : lang === "fa" ? "چین" : lang === "ps" ? "چین" : "China";
    return { flag: "🇨🇳", code: "CN", name };
  }
  if (c.includes("saudi") || c.includes("ksa") || c.includes("riyadh")) {
    const name = lang === "ur" ? "سعودی عرب" : lang === "ar" ? "المملكة العربية السعودية" : lang === "fa" ? "عربستان" : lang === "ps" ? "سعودي عربستان" : "Saudi Arabia";
    return { flag: "🇸🇦", code: "SA", name };
  }
  return { flag: "🌐", code: "GL", name: countryStr };
}

// Generate 2-letter initials from customer name
function getInitials(name: string): string {
  if (!name) return "CU";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Soft avatar color palettes matching Screenshot 2
const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
  "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
  "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800"
];

function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

const STATUS_TABS = [
  { id: "all", en: "All Customers" },
  { id: "Active", en: "Active" },
  { id: "Inactive", en: "Inactive" },
  { id: "New", en: "New" },
  { id: "Contacted", en: "Contacted" },
  { id: "Qualified", en: "Qualified" },
  { id: "Proposal", en: "Proposal" },
  { id: "Negotiation", en: "Negotiation" },
  { id: "Closed", en: "Closed" },
  { id: "Lost", en: "Lost" }
];

function getCustomerTabLabel(id: string, en: string, lang: SupportedLanguage = "en"): string {
  if (id === "all") return lang === "ur" ? "تمام کسٹمرز" : lang === "ar" ? "جميع العملاء" : lang === "fa" ? "همه مشتریان" : lang === "ps" ? "ټول پیرودونکي" : "All Customers";
  if (id === "Active") return lang === "ur" ? "فعال کسٹمرز" : lang === "ar" ? "العملاء النشطون" : lang === "fa" ? "مشتریان فعال" : lang === "ps" ? "فعال پیرودونکي" : "Active Customers";
  if (id === "Inactive") return lang === "ur" ? "غیر فعال کسٹمرز" : lang === "ar" ? "العملاء غير النشطين" : lang === "fa" ? "مشتریان غیرفعال" : lang === "ps" ? "غیر فعال پیرودونکي" : "Inactive Customers";
  if (id === "New") return lang === "ur" ? "نیا" : lang === "ar" ? "جديد" : lang === "fa" ? "جدید" : lang === "ps" ? "نوی" : "New";
  if (id === "Contacted") return lang === "ur" ? "رابطہ شدہ" : lang === "ar" ? "تم الاتصال" : lang === "fa" ? "تماس گرفته شد" : lang === "ps" ? "اړیکه ونیول شوه" : "Contacted";
  if (id === "Qualified") return lang === "ur" ? "اہل" : lang === "ar" ? "مؤهل" : lang === "fa" ? "واجد شرایط" : lang === "ps" ? "وړ" : "Qualified";
  if (id === "Proposal") return lang === "ur" ? "تجویز" : lang === "ar" ? "عرض أسعار" : lang === "fa" ? "پیشنهاد" : lang === "ps" ? "وړاندیز" : "Proposal";
  if (id === "Negotiation") return lang === "ur" ? "مذاکرات" : lang === "ar" ? "تفاوض" : lang === "fa" ? "مذاکره" : lang === "ps" ? "خبرې اترې" : "Negotiation";
  if (id === "Closed") return lang === "ur" ? "بند شدہ" : lang === "ar" ? "مغلق" : lang === "fa" ? "بسته" : lang === "ps" ? "تړل شوی" : "Closed";
  if (id === "Lost") return lang === "ur" ? "ضائع شدہ" : lang === "ar" ? "مفقود" : lang === "fa" ? "از دست رفته" : lang === "ps" ? "له لاسه وتلی" : "Lost";
  return en;
}

export function CustomerList({ lang: langProp }: { lang: SupportedLanguage }) {
  const router = useRouter();
  const lang = useActiveLanguage(langProp);
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

  // Live dynamic User Counts (distinct users within permitted scope)
  const [userStats, setUserStats] = useState<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
  } | null>(null);
  const [userStatsLoading, setUserStatsLoading] = useState(true);
  const [userStatsError, setUserStatsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setUserStatsLoading(true);
    setUserStatsError(null);
    apiGet<{ summary?: { totalUsers: number; activeUsers: number }; rows?: Array<{ userId: string; userCode?: string; fullName?: string; status: string }> }>(
      "/api/erp/users/journal-report?limit=1000"
    )
      .then((res) => {
        if (!isMounted) return;
        const rows = res.rows ?? [];
        if (rows.length > 0) {
          const distinctUserIds = new Set<string>();
          const activeUserIds = new Set<string>();
          for (const r of rows) {
            // Filter out test fixture accounts to count genuine distinct operational users within permitted scope
            const isTestUser = (r.userCode && (r.userCode.includes("TEST") || r.userCode.startsWith("RBAC-") || r.userCode.startsWith("E2E-") || r.userCode.startsWith("SA-00000"))) ||
                               (r.fullName && (r.fullName.includes("TEST") || r.fullName.includes("[E2E TEST]") || r.fullName.includes("RBAC-TEST")));
            if (isTestUser) continue;

            distinctUserIds.add(r.userId);
            if (r.status === "active") {
              activeUserIds.add(r.userId);
            }
          }
          const total = distinctUserIds.size;
          const active = activeUserIds.size;
          const inactive = Math.max(0, total - active);
          setUserStats({ totalUsers: total, activeUsers: active, inactiveUsers: inactive });
        } else if (res.summary) {
          const total = res.summary.totalUsers ?? 0;
          const active = res.summary.activeUsers ?? 0;
          const inactive = Math.max(0, total - active);
          setUserStats({ totalUsers: total, activeUsers: active, inactiveUsers: inactive });
        } else {
          setUserStats({ totalUsers: 0, activeUsers: 0, inactiveUsers: 0 });
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setUserStatsError(err.message || "Failed to load user summary");
      })
      .finally(() => {
        if (isMounted) setUserStatsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  // One name line by default; the second (other-language) line only appears when the user turns this option on.
  const [bilingualNames, setBilingualNames] = useState(false);
  useEffect(() => {
    setBilingualNames(readBilingualNamesPreference());
    const sync = () => setBilingualNames(readBilingualNamesPreference());
    window.addEventListener("erp:customer-bilingual-names", sync);
    window.addEventListener("storage", (e) => { if (e.key === BILINGUAL_NAMES_STORAGE_KEY) sync(); });
    return () => window.removeEventListener("erp:customer-bilingual-names", sync);
  }, []);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [selectedStatusTab, setSelectedStatusTab] = useState("all");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("all");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("all");
  const [selectedAssignedFilter, setSelectedAssignedFilter] = useState("all");

  // Selection & Pagination state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Top action menus state
  const [showSearchFiltersPopover, setShowSearchFiltersPopover] = useState(false);
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [showDraftsMenu, setShowDraftsMenu] = useState(false);
  const [showAddCustomerMenu, setShowAddCustomerMenu] = useState(false);

  // Modals & Drawers
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [selected360Party, setSelected360Party] = useState<{ id?: string; name: string; displayName?: string } | null>(null);
  const [showUniversalDirectory, setShowUniversalDirectory] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("view") === "journal") {
      setShowUniversalDirectory(true);
    }
    const q = searchParams?.get("search") || searchParams?.get("q");
    if (q) {
      setSearchQuery(q);
    }
    const id = searchParams?.get("id");
    if (id) {
      setSelectedCustomerId(id);
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

  // Close active dropdowns and row menus on outside click
  useEffect(() => {
    const handleOutside = () => {
      setActiveMenuId(null);
      setShowReportsMenu(false);
      setShowDraftsMenu(false);
      setShowAddCustomerMenu(false);
    };
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

      const source = meta.source || "";
      const leadStatus = c.is_active === false || meta.leadStatus?.toLowerCase() === "inactive" || meta.status?.toLowerCase() === "inactive"
        ? "Inactive"
        : (meta.leadStatus || meta.status || "Active");
      const assignedStaff = meta.assignedTo || "";
      const phone = c.mobile || c.whatsapp || meta.phone || "—";

      const countryName = c.country_name || meta.country || "";
      const stateName = c.state_province_name || meta.stateProvince || "";
      const cityName = c.city_name || meta.city || "";

      return {
        ...c,
        // Language-aware name: authorized translation for the selected language, otherwise the saved (legal) name
        nameView: resolveCustomerName(c, lang),
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
  }, [customers, lang]);

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

  // Filtered customer list
  const filteredList = useMemo(() => {
    let list = [...parsedCustomers];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          (c.original_customer_name && c.original_customer_name.toLowerCase().includes(q)) ||
          (c.customer_name_en && c.customer_name_en.toLowerCase().includes(q)) ||
          (c.native_customer_name && c.native_customer_name.toLowerCase().includes(q)) ||
          (c.company_name && c.company_name.toLowerCase().includes(q)) ||
          (c.person_code && c.person_code.toLowerCase().includes(q)) ||
          (c.meta.phone && c.meta.phone.toLowerCase().includes(q)) ||
          (c.meta.countryName && c.meta.countryName.toLowerCase().includes(q)) ||
          (c.meta.cityName && c.meta.cityName.toLowerCase().includes(q)) ||
          (c.meta.assignedStaff && c.meta.assignedStaff.toLowerCase().includes(q)) ||
          (c.linked_companies && c.linked_companies.some((co) => co.name.toLowerCase().includes(q) || (co.code && co.code.toLowerCase().includes(q)))) ||
          (c.linked_branches && c.linked_branches.some((b) => b.name.toLowerCase().includes(q) || (b.code && b.code.toLowerCase().includes(q))))
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

    // Category filter
    if (selectedCategoryFilter !== "all") {
      list = list.filter((c) => {
        const pType = (c.meta?.partyType || c.meta?.party_type || "").toLowerCase();
        if (selectedCategoryFilter === "employee") {
          return c.is_employee || !!c.employee_code || pType.includes("emp") || pType.includes("staff");
        }
        if (selectedCategoryFilter === "driver") {
          return c.is_truck_driver || pType.includes("driver");
        }
        if (selectedCategoryFilter === "owner") {
          return c.is_truck_owner || pType.includes("owner");
        }
        if (selectedCategoryFilter === "bank_accounts") {
          return Boolean((c.accounts_count && c.accounts_count > 0) || (c.banks_count && c.banks_count > 0) || pType.includes("bank") || pType.includes("acc"));
        }
        if (selectedCategoryFilter === "shipping_clearing") {
          return Boolean(c.is_clearing_agent || pType.includes("clear") || pType.includes("ship"));
        }
        if (selectedCategoryFilter === "customer") {
          return pType.includes("cust") || (!c.is_employee && !c.is_truck_driver && !c.is_truck_owner);
        }
        return true;
      });
    }

    return list;
  }, [parsedCustomers, searchQuery, selectedCategoryFilter, selectedStatusTab, selectedCountryFilter, selectedBranchFilter, selectedAssignedFilter]);

  // Derived filter options
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
    const headers = ["ID", "Name", "Company", "Status", "Assigned To", "Country", "Branch", "Phone", "Created At"];
    const rows = filteredList.map(c => [
      c.person_code || c.id,
      `"${c.nameView.primary.replace(/"/g, '""')}"`,
      `"${(c.company_name || "").replace(/"/g, '""')}"`,
      c.meta.leadStatus || "Active",
      `"${c.meta.assignedStaff}"`,
      `"${c.meta.countryName}"`,
      `"${c.meta.cityName}"`,
      `"${c.meta.phone}"`,
      new Date(c.created_at).toLocaleDateString()
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customers_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 5-Language role tag label
  const getRoleBadgeLabel = (role: "driver" | "owner" | "staff") => {
    if (role === "driver") return lang === "ur" ? "ڈرائیور" : lang === "ar" ? "سائق" : lang === "fa" ? "راننده" : lang === "ps" ? "چلوونکی" : "Driver";
    if (role === "owner") return lang === "ur" ? "مالک" : lang === "ar" ? "مالك" : lang === "fa" ? "مالک" : lang === "ps" ? "مالک" : "Owner";
    if (role === "staff") return lang === "ur" ? "ملازم" : lang === "ar" ? "موظف" : lang === "fa" ? "پرسنل" : lang === "ps" ? "کارمند" : "Staff";
  };

  // 5-Language status label
  const getStatusDisplay = (st: string) => {
    const s = (st || "active").toLowerCase();
    if (s === "active") return lang === "ur" ? "فعال" : lang === "ar" ? "نشط" : lang === "fa" ? "فعال" : lang === "ps" ? "فعال" : "Active";
    if (s === "inactive") return lang === "ur" ? "غیر فعال" : lang === "ar" ? "غير نشط" : lang === "fa" ? "غیرفعال" : lang === "ps" ? "غیر فعال" : "Inactive";
    return st || t(lang, "p360.status_active", "Active");
  };

  return (
    <div className="-m-3 sm:-m-4 lg:-m-6 p-3 sm:p-4 lg:p-6 bg-[#f4f7fb] dark:bg-slate-950 min-h-[calc(100vh-64px)] space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* ================= BREADCRUMB & TOP HEADER ACTION BUTTONS (Matching Image 2) ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="hover:text-blue-600 cursor-pointer" onClick={() => router.push("/dashboard" as Route)}>
            {t(lang, "common.home", "Home")}
          </span>
          <span className="text-slate-400">›</span>
          <span className="hover:text-blue-600 cursor-pointer">
            {t(lang, "cl.breadcrumb_sales_crm", "Sales & CRM")}
          </span>
          <span className="text-slate-400">›</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {getLabel("customersTitle", lang) || "Customer Management"}
          </span>
        </div>

        {/* Right: 4 Header Action Dropdown Menus */}
        <div className="flex flex-wrap items-center gap-2 relative">
          {/* Button 1: Search & Filters */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSearchFiltersPopover(!showSearchFiltersPopover);
                setShowReportsMenu(false);
                setShowDraftsMenu(false);
                setShowAddCustomerMenu(false);
              }}
              className={cn(
                "h-9 px-3.5 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition-all shadow-2xs cursor-pointer",
                showSearchFiltersPopover
                  ? "border-blue-600 bg-blue-50/70 text-blue-700 ring-2 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <Search className="h-3.5 w-3.5 text-blue-600" />
              <span>{getLabel("searchAndFilters", lang)}</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {/* Popover Card (Matching Image 2 popover) */}
            {showSearchFiltersPopover && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "fixed inset-x-3 top-28 max-h-[78vh] overflow-y-auto sm:inset-x-auto sm:end-3 sm:w-[400px] lg:absolute lg:top-auto lg:end-auto lg:mt-2 lg:w-[380px] lg:max-h-none lg:overflow-visible rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100",
                  isRtl ? "lg:left-0" : "lg:right-0"
                )}
              >
                <div className="flex items-center justify-between border-b pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-blue-600" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {getLabel("searchAndFilters", lang)}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSearchFiltersPopover(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder={t(lang, "cl.search_ph_full", "Customer name, company, mobile, etc...")}
                      className="w-full h-8 ps-8 pe-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  {/* Bilingual display option — default OFF: one name line in the selected language */}
                  <label className="flex items-start gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bilingualNames}
                      onChange={(e) => writeBilingualNamesPreference(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300"
                    />
                    <span>
                      {t(lang, "cl.show_both_names", "Show both names (second language line)")}
                      <span className="block text-[11px] font-medium text-slate-400">{t(lang, "cl.show_both_names_hint", "Off: one name in the selected language. The saved legal name is never changed.")}</span>
                    </span>
                  </label>

                  {/* 2-column selects */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase">{getLabel("country", lang)}</label>
                      <select
                        value={selectedCountryFilter}
                        onChange={(e) => {
                          setSelectedCountryFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full h-8 mt-1 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-medium"
                      >
                        <option value="all">{t(lang, "cl.all_countries", "All Countries")}</option>
                        {filterOptions.countries.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase">{getLabel("branchAndUserDetails", lang).split(" ")[0] || "Branch"}</label>
                      <select
                        value={selectedBranchFilter}
                        onChange={(e) => {
                          setSelectedBranchFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full h-8 mt-1 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-medium"
                      >
                        <option value="all">{t(lang, "cl.all_branches", "All Branches")}</option>
                        {filterOptions.branches.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase">{getLabel("customerType", lang)}</label>
                      <select
                        value={selectedCategoryFilter}
                        onChange={(e) => {
                          setSelectedCategoryFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full h-8 mt-1 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-medium"
                      >
                        <option value="all">{t(lang, "cl.type_all_parties", "All Parties")}</option>
                        <option value="customer">{t(lang, "cl.type_customers", "Customers")}</option>
                        <option value="employee">{t(lang, "cl.type_employees", "Employees")}</option>
                        <option value="driver">{t(lang, "cl.type_drivers", "Drivers")}</option>
                        <option value="owner">{t(lang, "cl.type_owners", "Owners")}</option>
                        <option value="bank_accounts">{t(lang, "cl.type_banks_accounts", "Banks & Accounts")}</option>
                        <option value="shipping_clearing">{t(lang, "cl.type_shipping_clearing", "Shipping & Clearing")}</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase">{getLabel("status", lang)}</label>
                      <select
                        value={selectedStatusTab}
                        onChange={(e) => {
                          setSelectedStatusTab(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full h-8 mt-1 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-medium"
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
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">{t(lang, "cl.assigned_user", "Assigned User")}</label>
                    <select
                      value={selectedAssignedFilter}
                      onChange={(e) => {
                        setSelectedAssignedFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full h-8 mt-1 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-medium"
                    >
                      <option value="all">{t(lang, "cl.all_users_filter", "All Users")}</option>
                      {filterOptions.assignees.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">{t(lang, "cl.col_created_date", "Created Date")}</label>
                    <button
                      type="button"
                      className="w-full h-8 mt-1 px-2.5 flex items-center justify-between text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-medium text-slate-600"
                    >
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>{t(lang, "nav.all_dates", "All Dates")} ({new Date().getFullYear()})</span>
                      </span>
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    </button>
                  </div>

                  {/* Popover Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCountryFilter("all");
                        setSelectedBranchFilter("all");
                        setSelectedCategoryFilter("all");
                        setSelectedStatusTab("all");
                        setSelectedAssignedFilter("all");
                      }}
                      className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      {getLabel("resetFilters", lang)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSearchFiltersPopover(false)}
                      className="h-8 px-3.5 rounded-lg bg-[#1d63ed] text-white text-xs font-bold shadow-xs hover:bg-blue-700 cursor-pointer"
                    >
                      {t(lang, "cl.apply_filters_btn", "Apply Filters")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Button 2: All Reports */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReportsMenu(!showReportsMenu);
                setShowSearchFiltersPopover(false);
                setShowDraftsMenu(false);
                setShowAddCustomerMenu(false);
              }}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              <span>{getLabel("allReports", lang)}</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {showReportsMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100",
                  isRtl ? "left-0" : "right-0"
                )}
              >
                <div
                  onClick={() => { setShowReportsMenu(false); setShowReport(true); }}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{t(lang, "cl.customer_list_menu", "Customer List")}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("customerListSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => { setShowReportsMenu(false); setSelectedStatusTab("all"); }}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-7 w-7 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("registeredThisMonth", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("registeredThisMonthSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => { setShowReportsMenu(false); setShowUniversalDirectory(true); }}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Globe className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("customerByCountry", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("customerByCountrySub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => { setShowReportsMenu(false); setShowUniversalDirectory(true); }}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("customerByBranch", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("customerByBranchSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => { setShowReportsMenu(false); setShowUniversalDirectory(true); }}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("customerByStatus", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("customerByStatusSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => { setShowReportsMenu(false); handleExportCSV(); }}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start border-t mt-1 pt-1.5"
                >
                  <div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                    <Download className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("exportData", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("exportDataSub", lang)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Button 3: Drafts */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDraftsMenu(!showDraftsMenu);
                setShowSearchFiltersPopover(false);
                setShowReportsMenu(false);
                setShowAddCustomerMenu(false);
              }}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
              <span>{getLabel("drafts", lang)}</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {showDraftsMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100",
                  isRtl ? "left-0" : "right-0"
                )}
              >
                <div
                  onClick={() => setShowDraftsMenu(false)}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("viewDrafts", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("viewDraftsSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => setShowDraftsMenu(false)}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <UserCheck className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("myDrafts", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("myDraftsSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => setShowDraftsMenu(false)}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("draftsByUsers", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("draftsByUsersSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => setShowDraftsMenu(false)}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("todaysDrafts", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("todaysDraftsSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => { setShowDraftsMenu(false); router.push("/dashboard/settings/customers/setup" as Route); }}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-7 w-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("restoreDraft", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("restoreDraftSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => setShowDraftsMenu(false)}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer text-start border-t mt-1 pt-1.5"
                >
                  <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-400">{getLabel("manageDrafts", lang)}</p>
                    <p className="text-[11px] text-rose-400">{getLabel("manageDraftsSub", lang)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Button 4: + Add Customer */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddCustomerMenu(!showAddCustomerMenu);
                setShowSearchFiltersPopover(false);
                setShowReportsMenu(false);
                setShowDraftsMenu(false);
              }}
              className="h-9 px-4 rounded-xl bg-[#1d63ed] hover:bg-[#1a55cd] text-white text-xs font-bold inline-flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{getLabel("addCustomerBtn", lang)}</span>
              <ChevronDown className="h-3 w-3 text-white/80" />
            </button>

            {showAddCustomerMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100",
                  isRtl ? "left-0" : "right-0"
                )}
              >
                <div
                  onClick={() => { setShowAddCustomerMenu(false); router.push("/dashboard/settings/customers/setup" as Route); }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("newCustomer", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("newCustomerSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => { setShowAddCustomerMenu(false); router.push("/dashboard/settings/customers/setup" as Route); }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Download className="h-4 w-4 rotate-180" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("importCustomers", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("importCustomersSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => { setShowAddCustomerMenu(false); router.push("/dashboard/settings/customers/setup" as Route); }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("quickAdd", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("quickAddSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => { setShowAddCustomerMenu(false); }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <Copy className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("duplicateCheck", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("duplicateCheckSub", lang)}</p>
                  </div>
                </div>

                <div
                  onClick={() => { setShowAddCustomerMenu(false); router.push("/dashboard/settings/customers/setup" as Route); }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-start"
                >
                  <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getLabel("openLastDraft", lang)}</p>
                    <p className="text-[11px] text-slate-400">{getLabel("openLastDraftSub", lang)}</p>
                  </div>
                </div>

                {/* Branch Stats Footer */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-1 px-2 space-y-1 text-[11px] text-slate-500 font-medium">
                  <div className="flex justify-between">
                    <span>{getLabel("totalBranches", lang)}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {parsedCustomers.reduce((acc, c) => acc + (c.branches_count || (c.meta.cityName ? 1 : 0)), 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{getLabel("customersThisBranch", lang)}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{parsedCustomers.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{getLabel("topCountry", lang)}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {(() => {
                        const counts: Record<string, number> = {};
                        for (const c of parsedCustomers) {
                          const name = c.country_name || c.meta.countryName;
                          if (name) counts[name] = (counts[name] || 0) + 1;
                        }
                        let top = "—";
                        let max = 0;
                        for (const [k, v] of Object.entries(counts)) {
                          if (v > max) { max = v; top = `${k} (${v})`; }
                        }
                        return top;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= TITLE AREA ================= */}
      <div className="flex items-center gap-3.5 pt-1">
        <div className="h-12 w-12 rounded-2xl bg-[#8b5cf6] flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {getLabel("customersTitle", lang) || "Customer Management"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            {t(lang, "cl.subtitle", "Manage and track your customers, from inquiry to close.")}
          </p>
        </div>
      </div>

      {/* ================= 3 KPI SUMMARY CARDS (Matching Image 2) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Branch & User Details (Purple) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shadow-xs">
                <Building2 className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {getLabel("branchAndUserDetails", lang)}
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              {session?.scopes?.summary?.branchDisplayName || t(lang, "cl.head_office", "Head Office")}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{getLabel("totalUsers", lang)}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {userStatsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-slate-400 inline" />
                ) : userStatsError ? (
                  <span className="text-[11px] text-rose-500 font-medium">{t(lang, "cl.error", "Error")}</span>
                ) : (
                  userStats?.totalUsers ?? 0
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{getLabel("activeUsers", lang)}</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">
                {userStatsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-slate-400 inline" />
                ) : userStatsError ? (
                  "—"
                ) : (
                  userStats?.activeUsers ?? 0
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{getLabel("inactiveUsers", lang)}</span>
              <span className="font-black text-slate-500 dark:text-slate-400">
                {userStatsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-slate-400 inline" />
                ) : userStatsError ? (
                  "—"
                ) : (
                  userStats?.inactiveUsers ?? 0
                )}
              </span>
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
              {getLabel("customerSummary", lang)}
            </h3>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_total_customers", "Total Customers")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {loading ? <Loader2 className="h-3 w-3 animate-spin text-slate-400 inline" /> : error ? <span className="text-[11px] text-rose-500">{t(lang, "cl.error", "Error")}</span> : parsedCustomers.length}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_active_customers", "Active Customers")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {loading ? <Loader2 className="h-3 w-3 animate-spin text-slate-400 inline" /> : error ? "—" : parsedCustomers.filter(c => (c.meta.leadStatus || "active").toLowerCase() === "active").length}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{getLabel("newThisMonth", lang)}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {loading ? <Loader2 className="h-3 w-3 animate-spin text-slate-400 inline" /> : error ? "—" : parsedCustomers.filter(c => {
                  const d = new Date(c.created_at);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{t(lang, "cl.f_inactive_customers", "Inactive Customers")}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {loading ? <Loader2 className="h-3 w-3 animate-spin text-slate-400 inline" /> : error ? "—" : parsedCustomers.filter(c => (c.meta.leadStatus || "").toLowerCase() === "inactive").length}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Status / Pipeline Summary (Orange) */}
        <div className="bg-[#FFFDF9] dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 p-4 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-xl bg-[#f59e0b] text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-amber-900 dark:text-amber-300">
              {t(lang, "cl.kpi_pipeline_summary", "Customer Status & Pipeline Summary")}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{getCustomerTabLabel("Active", "Active", lang)}</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400">{statusCounts["Active"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-500">{getCustomerTabLabel("Inactive", "Inactive", lang)}</span>
              <span className="font-black text-slate-500">{statusCounts["Inactive"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{getCustomerTabLabel("New", "New", lang)}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["New"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{getCustomerTabLabel("Negotiation", "Negotiation", lang)}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Negotiation"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{getCustomerTabLabel("Contacted", "Contacted", lang)}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Contacted"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{getCustomerTabLabel("Closed", "Closed", lang)}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Closed"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{getCustomerTabLabel("Qualified", "Qualified", lang)}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Qualified"] ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>{getCustomerTabLabel("Lost", "Lost", lang)}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{statusCounts["Lost"] ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= STATUS PILLS (Matching Image 2) ================= */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
        {STATUS_TABS.map((tab) => {
          const isSelected = selectedStatusTab.toLowerCase() === tab.id.toLowerCase();
          const count = statusCounts[tab.id] ?? (tab.id === "all" ? parsedCustomers.length : 0);
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
              <span>{getCustomerTabLabel(tab.id, tab.en, lang)}</span>
              <span
                className={cn(
                  "text-[11px] font-black px-1.5 py-0.2 rounded-full",
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
                {getLabel("customerRegisterTitle", lang)}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {getLabel("customerRegisterSubtitle", lang)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{t(lang, "common.print", "Print")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-red-500" />
              <span>{t(lang, "wh.pdf", "PDF")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>{t(lang, "asr.excel", "Excel")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUniversalDirectory(true)}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              <span>... {t(lang, "cl.more", "More")}</span>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse" dir={isRtl ? "rtl" : "ltr"}>
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                {/* Select All Checkbox */}
                <Th className="px-3.5 py-3.5 w-10 text-center">
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
                </Th>
                <Th className="px-3 py-3.5 w-12 text-slate-400">#</Th>
                <Th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_customer_id", "Customer ID")}</Th>
                <Th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_customer_name", "Customer Name")}</Th>
                <Th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_company", "Company")}</Th>
                <Th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_country", "Country")}</Th>
                <Th className="px-4 py-3.5 font-bold">{t(lang, "cl.f_branch", "Branch")}</Th>
                <Th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_status", "Status")}</Th>
                <Th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_assigned_to", "Assigned To")}</Th>
                <Th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_mobile", "Mobile")}</Th>
                <Th className="px-4 py-3.5 font-bold">{t(lang, "cl.col_created_date", "Created Date")}</Th>
                <Th className="px-4 py-3.5 text-center font-bold">{t(lang, "cl.col_actions", "Actions")}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                    {t(lang, "cl.loading_records", "Loading customer records...")}
                  </td>
                </tr>
              ) : paginatedCustomers.length > 0 ? (
                paginatedCustomers.map((c, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isSelected = selectedRows.has(c.id);
                  const countryBadge = getCountryBadge(c.meta.countryName, lang);
                  const initials = getInitials(c.nameView.primary);
                  const avatarColor = getAvatarColor(c.customer_name);
                  const leadStatus = c.meta.leadStatus || "Active";
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
                      {/* Checkbox */}
                      <td className="px-3.5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleRow(c.id, e as any)}
                          aria-label={`${t(lang, "cl.aria_select_row", "Select customer")} ${c.customer_name}`}
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

                      {/* CUSTOMER NAME with avatar & tags */}
                      <td className="px-4 py-3">
                        {(() => {
                          const primaryName = c.nameView.primary;
                          const subName = bilingualNames ? c.nameView.secondary : null;
                          return (
                            <div className="flex items-center gap-2.5 truncate">
                              <span
                                className={cn(
                                  "grid h-7 w-7 place-items-center rounded-full text-[11px] font-black shrink-0 border",
                                  avatarColor
                                )}
                              >
                                {initials}
                              </span>
                              <div className="truncate">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[180px]">
                                    {/* the saved legal name unless an approved variant exists; marked when it is not in the viewer's language */}
                                    <SavedText value={primaryName} lang={lang} kind="name" />
                                  </span>
                                  {c.is_truck_driver && (
                                    <span className="shrink-0 px-1.5 py-0.2 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      {getRoleBadgeLabel("driver")}
                                    </span>
                                  )}
                                  {c.is_truck_owner && (
                                    <span className="shrink-0 px-1.5 py-0.2 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      {getRoleBadgeLabel("owner")}
                                    </span>
                                  )}
                                  {c.is_employee && (
                                    <span className="shrink-0 px-1.5 py-0.2 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      {getRoleBadgeLabel("staff")}
                                    </span>
                                  )}
                                </div>
                                {subName && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px]" dir="auto">
                                    {subName}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* COMPANY */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-semibold max-w-[180px]">
                        {c.linked_companies && c.linked_companies.length > 1 ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap"
                              title={c.linked_companies.map((co) => `${co.name}${co.code ? ` (${co.code})` : ""}`).join("\n")}
                            >
                              <Building2 className="h-3 w-3" />
                              {c.linked_companies.length} {t(lang, "cl.companies", "Companies")}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]" title={c.linked_companies.map((co) => co.name).join(", ")}>
                              {c.linked_companies.map((co) => co.name).join(", ")}
                            </span>
                          </div>
                        ) : c.linked_companies && c.linked_companies.length === 1 ? (
                          <div className="truncate max-w-[160px]" title={c.linked_companies[0].name}>
                            <span className="text-slate-800 dark:text-slate-200 font-bold">{c.linked_companies[0].name}</span>
                            {c.linked_companies[0].code && (
                              <span className="block text-[11px] font-mono text-slate-400">{c.linked_companies[0].code}</span>
                            )}
                          </div>
                        ) : (
                          <span className="truncate">{c.company_name || c.meta.companyName || "—"}</span>
                        )}
                      </td>

                      {/* COUNTRY with flag & code */}
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="font-mono text-[11px] font-bold text-slate-400">{countryBadge.code}</span>
                          <span className="text-slate-700 dark:text-slate-300">{countryBadge.name}</span>
                        </div>
                      </td>

                      {/* BRANCH */}
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 max-w-[180px]">
                        {c.linked_branches && c.linked_branches.length > 1 ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 whitespace-nowrap"
                              title={c.linked_branches.map((b) => `${b.name}${b.country_name ? ` (${b.country_name})` : ""}`).join("\n")}
                            >
                              <Building2 className="h-3 w-3" />
                              {c.linked_branches.length} {t(lang, "cl.branches", "Branches")}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]" title={c.linked_branches.map((b) => b.name).join(", ")}>
                              {c.linked_branches.map((b) => b.name).join(", ")}
                            </span>
                          </div>
                        ) : c.linked_branches && c.linked_branches.length === 1 ? (
                          <div className="truncate max-w-[160px]" title={c.linked_branches[0].name}>
                            <span className="text-slate-800 dark:text-slate-200 font-semibold">{c.linked_branches[0].name}</span>
                            {c.linked_branches[0].code && (
                              <span className="block text-[11px] font-mono text-slate-400">{c.linked_branches[0].code}</span>
                            )}
                          </div>
                        ) : (
                          <span className="truncate">{branch}</span>
                        )}
                      </td>

                      {/* STATUS (styled pill badge with ● matching Image 2) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {getStatusDisplay(leadStatus)}
                        </span>
                      </td>

                      {/* ASSIGNED TO */}
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap">
                        {c.meta.assignedStaff || "—"}
                      </td>

                      {/* MOBILE */}
                      <td className="px-4 py-3 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap" dir="ltr">
                        {c.meta.phone || "—"}
                      </td>

                      {/* CREATED DATE */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                        {formatErpDate(toIso(new Date(c.created_at || Date.now())), lang)}
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
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {activeMenuId === c.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "absolute mt-1 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1 z-50 text-start animate-in fade-in zoom-in-95 duration-100",
                                isRtl ? "left-0" : "right-0"
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setSelected360Party({ id: c.id, name: c.customer_name, displayName: c.nameView.primary });
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg cursor-pointer"
                              >
                                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                                <span>{t(lang, "cl.erp_usage_360", "360° ERP Usage")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  router.push(`/dashboard/settings/customers/view?customerId=${c.id}` as Route);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-400" />
                                <span>{t(lang, "common.view", "View")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  router.push(`/dashboard/settings/customers/setup?customerId=${c.id}` as Route);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
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
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
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
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                    {t(lang, "cl.no_matching_leads", "No matching customer leads found.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ================= PAGINATION FOOTER ================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              {getLabel("showing", lang)} {filteredList.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} {getLabel("to", lang)}{" "}
              {Math.min(currentPage * pageSize, filteredList.length)} {getLabel("of", lang)} {filteredList.length} {getLabel("customersGroup", lang)}
            </span>
            <div className="relative inline-block">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                aria-label={getLabel("perPage", lang)}
                className="h-7 px-2.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none pr-6 shadow-2xs"
              >
                <option value={10}>{`10 ${getLabel("perPage", lang)}`}</option>
                <option value={25}>{`25 ${getLabel("perPage", lang)}`}</option>
                <option value={50}>{`50 ${getLabel("perPage", lang)}`}</option>
                <option value={100}>{`100 ${getLabel("perPage", lang)}`}</option>
              </select>
              <ChevronDown className="absolute end-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
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
                    "grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer",
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
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
                    "grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer",
                    currentPage === totalPages
                      ? "bg-blue-600 text-white shadow-xs"
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
              className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
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
          customer_name: c.nameView.primary,
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
          displayName={selected360Party.displayName}
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
