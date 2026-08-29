"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { printStore } from "@/lib/store/print-store";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Building2, Search, Eye, PencilLine, Printer, Trash2, Users, UserCheck, UserMinus, Plus, Mail, MessageSquare, MoreHorizontal, Phone, FileText, Download, Layers, Send, ArrowLeft, SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedActionMenu } from "@/components/ui/unified-action-menu";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { CustomerProfile } from "./customer-profile";
import { Party360Modal } from "./party-360-modal";
import { UniversalPartyDirectoryReport } from "./universal-party-directory-report";
import { SendToCustomerModal } from "./send-to-customer-modal";
import { SmartSearchFilter, type SmartFilterState } from "@/components/ui/smart-search-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DocumentAttachmentIcon } from "@/components/documents/document-attachment-icon";
import { apiGet, apiDelete } from "@/lib/api/client";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLabel } from "./translations";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { Th } from "@/components/ui/translated-th";
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

const CUSTOMER_I18N_TERMS: Record<string, Record<string, string>> = {
  "asmatullah abdullah": { ur: "عصمت اللہ عبداللہ", ar: "عصمت الله عبد الله", fa: "عصمت‌الله عبدالله", ps: "عصمت الله عبد الله" },
  "asmatullah": { ur: "عصمت اللہ", ar: "عصمت الله", fa: "عصمت‌الله", ps: "عصمت الله" },
  "ismatullah abdullah": { ur: "عصمت اللہ عبداللہ", ar: "عصمت الله عبد الله", fa: "عصمت‌الله عبدالله", ps: "عصمت الله عبد الله" },
  "muhammad anees": { ur: "محمد انیس", ar: "محمد أنيس", fa: "محمد انیس", ps: "محمد انیس" },
  "muhammad idrees": { ur: "محمد ادریس", ar: "محمد إدريس", fa: "محمد ادریس", ps: "محمد ادریس" },
  "muhammad haroon": { ur: "محمد ہارون", ar: "محمد هارون", fa: "محمد هارون", ps: "محمد هارون" },
  "najeebullah": { ur: "نجیب اللہ", ar: "نجيب الله", fa: "نجیب‌الله", ps: "نجیب الله" },
  "najeeb ullah": { ur: "نجیب اللہ", ar: "نجيب الله", fa: "نجیب‌الله", ps: "نجیب الله" },
  "sana shahbaz": { ur: "ثناء شہباز", ar: "ثناء شهباز", fa: "ثناء شهباز", ps: "ثناء شهباز" },
  "asmatullah andcopany": { ur: "عصمت اللہ اینڈ کمپنی", ar: "شركة عصمت الله", fa: "شرکت عصمت‌الله", ps: "عصمت الله او شرکت" },
  "kamil khan": { ur: "کامل خان", ar: "كامل خان", fa: "کامل خان", ps: "کامل خان" },
  "tariq jamil": { ur: "طارق جمیل", ar: "طارق جميل", fa: "طارق جمیل", ps: "طارق جمیل" },
  "abdullah": { ur: "عبداللہ", ar: "عبد الله", fa: "عبدالله", ps: "عبد الله" },
  "male": { ur: "مرد", ar: "ذكر", fa: "مرد", ps: "نارینه" },
  "female": { ur: "عورت", ar: "أنثى", fa: "زن", ps: "ښځینه" },
  "business": { ur: "کاروباری ادارہ", ar: "مؤسسة تجارية", fa: "کسب و کار", ps: "سوداګریز شرکت" },
  "pakistan": { ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" },
  "united arab emirates": { ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" },
  "uae": { ur: "متحدہ عرب امارات", ar: "الإمارات", fa: "امارات", ps: "امارات" },
  "dubai": { ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دوبۍ" },
  "karachi": { ur: "کراچی", ar: "كراتشي", fa: "کراچی", ps: "کراچۍ" },
  "lahore": { ur: "لاہور", ar: "لاهور", fa: "لاهور", ps: "لاهور" },
  "quetta": { ur: "کوئٹہ", ar: "كويته", fa: "کویته", ps: "کوټه" },
  "peshawar": { ur: "پشاور", ar: "بيشاور", fa: "پیشاور", ps: "پېښور" },
  "chaman": { ur: "چمن", ar: "تچمن", fa: "چمن", ps: "چمن" },
  "punjab": { ur: "پنجاب", ar: "البنجاب", fa: "پنجاب", ps: "پنجاب" },
  "sindh": { ur: "سندھ", ar: "السند", fa: "سند", ps: "سند" },
  "balochistan": { ur: "بلوچستان", ar: "بلوشستان", fa: "بلوچستان", ps: "بلوچستان" },
  "kpk": { ur: "خیبر پختونخوا", ar: "خيبر بختونخوا", fa: "خیبر پختونخوا", ps: "خیبر پښتونخوا" },
  "emirate of dubai": { ur: "امارتِ دبئی", ar: "إمارة دبي", fa: "امارت دبی", ps: "د دوبۍ امارت" },
  "active": { ur: "فعال", ar: "نشط", fa: "فعال", ps: "فعال" }
};

function translateCustomerText(value: string | null | undefined, targetLang: SupportedLanguage): string {
  if (!value) return "-";
  if (targetLang === "en") return value;
  const key = value.trim().toLowerCase();
  const found = CUSTOMER_I18N_TERMS[key];
  if (found && found[targetLang]) return found[targetLang];
  return value;
}

export function CustomerList({ lang: langProp }: { lang: SupportedLanguage }) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  const lang = (activeLang !== "en" ? activeLang : langProp) as SupportedLanguage;
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [filterState, setFilterState] = useState<SmartFilterState>({
    query: "",
    country: "all",
    branch: "all",
    mainBranch: "all",
    status: "all"
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [selected360Party, setSelected360Party] = useState<{ id?: string; name: string } | null>(null);
  const [showUniversalDirectory, setShowUniversalDirectory] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Calculate active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterState.query?.trim()) count++;
    if (filterState.country && filterState.country !== "all") count++;
    if (filterState.branch && filterState.branch !== "all") count++;
    if (filterState.mainBranch && filterState.mainBranch !== "all") count++;
    if (filterState.status && filterState.status !== "all") count++;
    return count;
  }, [filterState]);

  // Reset filters handler
  const handleResetFilters = () => {
    setFilterState({
      query: "",
      country: "all",
      branch: "all",
      mainBranch: "all",
      status: "all"
    });
  };

  // State to track which row action menu is open
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClose = () => setOpenMenuId(null);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, []);

  // Fetch all customers from DB
  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Query limit=250 to get a large set for stats & registry calculation
      const res = await apiGet<{ customers: CustomerRow[] }>(`/api/erp/customers?limit=250&lang=${encodeURIComponent(lang || "en")}`);
      setCustomers(res.customers ?? []);
    } catch (e: any) {
      setError(e.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [lang]);

  // Parse custom metadata for each customer
  const parsedCustomers = useMemo(() => {
    return customers.map((c) => {
      let meta = {
        customerType: c.company_name ? "Business" : "Male",
        firstName: c.customer_name.split(" ")[0] || c.customer_name,
        lastName: c.customer_name.split(" ").slice(1).join(" ") || "",
        fatherName: c.father_name || c.contact_person || "",
        customerAccountNumber: "",
        country: "",
        stateProvince: "",
        city: "",
        cityCode: "-",
        contacts: [] as Array<{ type: string; value: string }>,
        documents: [] as Array<{ type: string; number: string; upload: string }>,
        status: "Active",
        remarks: c.notes || ""
      };

      if (c.notes) {
        try {
          const parsed = JSON.parse(c.notes);
          if (parsed && typeof parsed === "object") {
            meta = { ...meta, ...parsed };
          }
        } catch {
          // Keep default parsed details
        }
      }

      if (!meta.country && c.country_name) meta.country = c.country_name;
      if (!meta.stateProvince && c.state_province_name) meta.stateProvince = c.state_province_name;
      if (!meta.city && c.city_name) meta.city = c.city_name;
      if (!meta.fatherName && c.father_name) meta.fatherName = c.father_name;

      // Backwards compatibility fallbacks
      if (!meta.contacts || !meta.contacts.length) {
        const fallback = [];
        if (c.mobile) fallback.push({ type: "Mobile", value: c.mobile });
        if (c.whatsapp) fallback.push({ type: "WhatsApp", value: c.whatsapp });
        if (c.email) fallback.push({ type: "Email", value: c.email });
        if (fallback.length === 0) fallback.push({ type: "Mobile", value: "" });
        meta.contacts = fallback;
      }

      if (!meta.documents || !meta.documents.length) {
        meta.documents = [
          {
            type: (meta as any).documentType || "CNIC",
            number: (meta as any).documentNumber || "-",
            upload: (meta as any).documentUpload || ""
          }
        ];
      }

      // Clean customerType: ensure it only holds customer types (Male, Female, Corporate, Individual)
      // and remove any internal role strings (Branch Owner, Country Owner, Employee, etc.)
      const rawType = String((meta as any).personType || meta.customerType || c.gender || (c.company_name ? "Corporate" : "Male")).toLowerCase();
      let cleanCustomerType = "Male";
      if (rawType.includes("female") || rawType === "woman") cleanCustomerType = "Female";
      else if (rawType.includes("corp") || rawType.includes("business") || c.company_name) cleanCustomerType = "Corporate";
      else if (rawType.includes("male") || rawType === "man") cleanCustomerType = "Male";
      else cleanCustomerType = "Male";

      meta.customerType = cleanCustomerType;

      // Use the real person_code (PER-XXXXXX) when available; fall back to UUID-derived code
      // for legacy rows that predate the person-master migration and have not been backfilled.
      meta.customerAccountNumber = c.person_code || ("CUST-" + c.id.slice(0, 6).toUpperCase());

      return {
        ...c,
        meta
      };
    });
  }, [customers]);

  // Statistics Summary with 360 linkages
  const stats = useMemo(() => {
    const total = parsedCustomers.length;
    const active = parsedCustomers.filter((c) => c.meta.status === "Active").length;
    const inactive = total - active;
    const totalLinkedCompanies = parsedCustomers.reduce((acc, c: any) => acc + (c.partiesDir?.companies_count || 0), 0);
    const totalLinkedEmployees = parsedCustomers.reduce((acc, c: any) => acc + (c.partiesDir?.employees_count || 0), 0);
    const totalLinkedBanks = parsedCustomers.reduce((acc, c: any) => acc + (c.partiesDir?.banks_count || 0), 0);

    return { total, active, inactive, totalLinkedCompanies, totalLinkedEmployees, totalLinkedBanks };
  }, [parsedCustomers]);

  // Filter & Search
  const filteredCustomers = useMemo(() => {
    let list = parsedCustomers;

    const q = (filterState.query || "").trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          c.meta.customerAccountNumber.toLowerCase().includes(q) ||
          (c.person_code && c.person_code.toLowerCase().includes(q)) ||
          (c.father_name && c.father_name.toLowerCase().includes(q)) ||
          (c.meta.fatherName && c.meta.fatherName.toLowerCase().includes(q)) ||
          (c.mobile && c.mobile.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
      );
    }

    if (filterState.status && filterState.status !== "all") {
      list = list.filter((c) => c.meta.status.toLowerCase() === filterState.status?.toLowerCase());
    }

    if (filterState.country && filterState.country !== "all") {
      const countryNeedle = filterState.country.toLowerCase();
      list = list.filter((c) => {
        const countryName = (c.country_name || "").toLowerCase();
        const countryId = (c.country_id || "").toLowerCase();
        return countryName.includes(countryNeedle) || countryId.includes(countryNeedle);
      });
    }

    return list;
  }, [filterState, parsedCustomers]);

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

  // Centralized A4 Customer Master Profile via the shared engine.
  const handlePrint = async (c: (typeof parsedCustomers)[number]) => {
    const { openMasterProfile } = await import("@/lib/reports/master-profiles");
    const cc = c as any;
    void openMasterProfile({
      entity: 'customer',
      lang: lang,
      autoPrint: true,
      scope: { countryId: cc.country_id ?? null, countryName: cc.country_name ?? null },
      record: {
        id: cc.id,
        customer_name: cc.customer_name,
        customer_number: cc.customer_number,
        company_name: cc.company_name || cc.meta?.companyName,
        father_name: cc.father_name || cc.meta?.fatherName,
        customer_type: cc.meta?.customerType,
        national_id: cc.national_id,
        trn: cc.trn || cc.meta?.companyTaxNo,
        is_active: cc.is_active,
        created_at: cc.created_at,
        mobile: cc.mobile,
        whatsapp: cc.whatsapp,
        email: cc.email,
        address: cc.address || cc.meta?.companyAddress,
        city_name: cc.city_name || cc.meta?.city,
        country_name: cc.country_name || cc.meta?.country,
        country_id: cc.country_id,
        contacts: Array.isArray(cc.meta?.contacts) ? cc.meta.contacts : [],
        documents: Array.isArray(cc.meta?.documents) ? cc.meta.documents.map((d: any) => ({ type: d.type, number: d.number })) : [],
      },
    });
  };

  const isRtl = lang !== "en";

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Header Strip with Integrated Actions & Navigation */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Left Side: Back button + Title */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="gap-1.5 h-9 px-3 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold text-xs shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{getLabel("backButton", lang) || "Back"}</span>
          </Button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-teal-600">{t(lang, "cusm.settings_management", "Settings / Management")}</p>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {getLabel("customersTitle", lang)}
              <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {filteredCustomers.length}
              </span>
            </h1>
          </div>
        </div>

        {/* Right Side: Action Buttons & Filter Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Reset Filters button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleResetFilters}
            title={getLabel("resetFilters", lang) || "Reset Filters"}
            className="gap-1.5 h-9 px-3 border-slate-300 dark:border-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-xs transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{getLabel("resetFilters", lang) || "Reset"}</span>
          </Button>

          {/* Search & Filter Dropdown Toggle Button */}
          <Button
            type="button"
            variant={showFilterDropdown ? "default" : "outline"}
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={cn(
              "gap-1.5 h-9 px-3.5 rounded-xl font-bold text-xs shadow-xs transition-all",
              showFilterDropdown
                ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{getLabel("filterToggle", lang) || "Search & Filter"}</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-500 text-white text-[10px] rounded-full font-black">
                {activeFiltersCount}
              </span>
            )}
            {showFilterDropdown ? <ChevronUp className="h-3.5 w-3.5 ml-0.5 opacity-70" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5 opacity-70" />}
          </Button>

          {/* 360 Parties Directory */}
          <Button
            type="button"
            onClick={() => setShowUniversalDirectory(true)}
            className="gap-1.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-800 text-white font-bold shadow-md h-9 px-3.5 rounded-xl text-xs"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">{t(lang, "p360.universal_directory", "360° Universal Parties Directory")}</span>
            <span className="xl:hidden">360° Directory</span>
          </Button>

          {/* Print / Report */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowReport(true)}
            className="gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium shadow-xs h-9 px-3 rounded-xl text-xs"
          >
            <Printer className="h-3.5 w-3.5 text-cyan-500" />
            <span className="hidden sm:inline">{t(lang, "wh.print_report", "Print / Report")}</span>
          </Button>

          {/* SEND TO CUSTOMER */}
          <Button
            type="button"
            onClick={() => setShowSendModal(true)}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md h-9 px-3.5 rounded-xl text-xs"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{lang === "ur" ? "کسٹمر کو بھیجیں" : lang === "ar" ? "إرسال للعميل" : lang === "fa" ? "ارسال به مشتری" : lang === "ps" ? "پیرودونکي ته لیږل" : "SEND TO CUSTOMER"}</span>
          </Button>

          {/* Add Customer */}
          <Button
            type="button"
            onClick={() => router.push("/dashboard/settings/customers/setup" as Route)}
            className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md h-9 px-3.5 rounded-xl text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>{t(lang, "bdash.qa_add_customer", "Add Customer")}</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {/* Standardized 5 KPI Summary Cards Grid */}
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* MANDATORY Card 1: BRANCH & USER DETAILS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">1. {getLabel("branchUserDetails", lang)}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>{getLabel("country", lang)}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">Pakistan</span>
            </div>
            <div className="flex justify-between">
              <span>{getLabel("branchName", lang)}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 uppercase">Karachi Main</span>
            </div>
            <div className="flex justify-between">
              <span>{getLabel("userIdName", lang)}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[110px]" title="USR-001 (Admin User)">USR-001 (Admin)</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>{getLabel("status", lang)}:</span>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px]">{getLabel("activeSessionText", lang)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: TOTAL CUSTOMERS & PERSONS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">2. {getLabel("personsSummary", lang)}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{getLabel("totalPersonsLabel", lang)}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{stats.total}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{getLabel("activePersonsLabel", lang)}:</span>
              <span>{stats.active}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>{getLabel("inactivePersonsLabel", lang)}:</span>
              <span>{stats.inactive}</span>
            </div>
          </div>
        </div>

        {/* Card 3: 360 LINKAGES */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-purple-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">3. {t(lang, "p360.system_linkages", "System Linkages")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-indigo-600 font-bold">
              <span>{t(lang, "p360.companies_label", "Companies")}:</span>
              <span>{stats.totalLinkedCompanies}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{t(lang, "p360.employees_label", "Employees")}:</span>
              <span>{stats.totalLinkedEmployees}</span>
            </div>
            <div className="flex justify-between text-purple-600 font-bold">
              <span>{t(lang, "p360.banks_label", "Banks")}:</span>
              <span>{stats.totalLinkedBanks}</span>
            </div>
          </div>
        </div>

        {/* Card 4: BRANCHES */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">4. {getLabel("branchesTitle", lang)}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{getLabel("totalBranchesLabel", lang)}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">12</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{getLabel("activeBranchesLabel", lang)}:</span>
              <span>10</span>
            </div>
          </div>
        </div>

        {/* Card 5: QUICK INFO */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <FileText className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">5. {getLabel("quickInfoTitle", lang)}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>{getLabel("currencyLabel", lang)}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">USD</span>
            </div>
            <div className="flex justify-between">
              <span>{getLabel("companyLabel", lang)}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[110px]">DGT LLC</span>
            </div>
            <div className="flex justify-between">
              <span>{getLabel("financialYearLabel", lang)}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">2025-26</span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Dropdown Search & Filter Container */}
      {showFilterDropdown && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {getLabel("filterToggle", lang) || "Smart Search & Filter"}
              </span>
              {activeFiltersCount > 0 && (
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-900">
                  {activeFiltersCount} active filter{activeFiltersCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-7 text-[11px] text-slate-500 hover:text-rose-600 gap-1 px-2"
              >
                <RotateCcw className="h-3 w-3" />
                {getLabel("resetFilters", lang) || "Clear"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowFilterDropdown(false)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <SmartSearchFilter
            value={filterState}
            onChange={setFilterState}
            placeholder={getLabel("searchPlaceholder", lang)}
            hideRiskLevel
            hideModule
            hideCurrency
          />
        </div>
      )}

      {/* Main Table */}
      <Card className="rounded-2xl border shadow-sm overflow-hidden bg-white dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="border-b px-5 py-3.5 bg-slate-50/70 dark:bg-slate-950/60 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">{getLabel("customerListDirectory", lang)}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{getLabel("useActionsToViewEditPrintMsg", lang)}</p>
            </div>
            <div className="flex items-center gap-3">
              {!showFilterDropdown && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilterDropdown(true)}
                  className="h-7 text-xs font-semibold gap-1.5 rounded-lg border-slate-200 dark:border-slate-700"
                >
                  <Search className="h-3 w-3 text-teal-600" />
                  <span>{getLabel("filterToggle", lang) || "Search & Filter"}</span>
                </Button>
              )}
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                {filteredCustomers.length} {t(lang, "hr.records_found", "records found")}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800">
                <tr>
                  <Th className="px-3.5 py-3.5">#</Th>
                  <Th className="px-4 py-3.5">{getLabel("customerCode", lang)}</Th>
                  <Th className="px-4 py-3.5">{getLabel("customerType", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("customerName", lang)}</Th>
                  <Th className="px-4 py-3.5">{getLabel("fatherNameOnly", lang) || "Father / Guardian Name"}</Th>
                  <Th className="px-4 py-3.5">{getLabel("country", lang)}</Th>
                  <Th className="px-4 py-3.5">{getLabel("stateProvince", lang)}</Th>
                  <Th className="px-4 py-3.5">{getLabel("city", lang)}</Th>
                  <Th className="px-4 py-3.5">{getLabel("contacts", lang)}</Th>
                  <Th className="px-4 py-3.5">{getLabel("documents", lang)}</Th>
                  <Th className="px-4 py-3.5">{getLabel("status", lang)}</Th>
                  <Th className="px-4 py-3.5">{getLabel("createdDate", lang)}</Th>
                  <Th className="px-4 py-3.5 text-center">{getLabel("actions", lang)}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={13} className="px-5 py-10 text-center text-slate-500 font-medium italic">
                      {getLabel("loadingCustomerRegistryDirectory", lang)}
                    </td>
                  </tr>
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c, i) => {
                    const cType = c.meta.customerType || "Male";
                    const fName = c.father_name || c.meta.fatherName;
                    return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-3.5 py-3.5 font-semibold text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {c.meta.customerAccountNumber}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border",
                            cType === "Female"
                              ? "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800"
                              : cType === "Corporate"
                                ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                          )}
                        >
                          {cType === "Female" ? "👩 " : cType === "Corporate" ? "🏢 " : "👨 "}
                          {translateCustomerText(cType, lang)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-black text-slate-900 dark:text-slate-100 text-[13px]">
                          {translateCustomerText(c.customer_name, lang)}
                        </span>
                      </td>
                      {/* Dedicated Father / Guardian Name Column */}
                      <td className="px-4 py-3.5">
                        {fName ? (
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-slate-800 dark:text-slate-200">
                            <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/40">
                              S/O:
                            </span>
                            <span>{translateCustomerText(fName, lang)}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 font-medium">
                        {translateCustomerText(c.meta.country, lang)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 font-medium">
                        {translateCustomerText(c.meta.stateProvince, lang)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 font-medium">
                        {translateCustomerText(c.meta.city, lang)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        <div className="group relative flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 items-center">
                            {c.meta.contacts.map((cn, idx) => {
                              if (cn.type === "Email") {
                                return (
                                  <a
                                    key={idx}
                                    href={`mailto:${cn.value}`}
                                    title={`Email: ${cn.value}`}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors"
                                  >
                                    <Mail className="h-3.5 w-3.5" />
                                  </a>
                                );
                              }
                              if (cn.type === "WhatsApp") {
                                const cleanNo = cn.value.replace(/[^0-9]/g, "");
                                return (
                                  <a
                                    key={idx}
                                    href={`https://wa.me/${cleanNo}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`WhatsApp: ${cn.value}`}
                                    className="p-1 hover:bg-slate-100 rounded text-teal-500 hover:text-teal-600 transition-colors"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </a>
                                );
                              }
                              return (
                                <a
                                  key={idx}
                                  href={`tel:${cn.value}`}
                                  title={`Phone: ${cn.value}`}
                                  className="p-1 hover:bg-slate-100 rounded text-blue-500 hover:text-blue-600 transition-colors"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              );
                            })}
                          </div>
                          {/* Hover Tooltip listing all contacts */}
                          <div className="pointer-events-none absolute bottom-full mb-1 left-0 w-48 rounded-lg bg-slate-900 p-2.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 z-50 shadow-md">
                            <p className="font-bold border-b border-slate-700 pb-1 mb-1.5 text-teal-400">{getLabel("allContacts", lang)}</p>
                            {c.meta.contacts.map((cn, idx) => (
                              <div key={idx} className="flex justify-between font-mono py-0.5">
                                <span>{cn.type}:</span>
                                <span>{cn.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <DocumentAttachmentIcon entityType="customers" entityId={c.id} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                            c.meta.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {c.meta.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono font-medium">
                        {new Date(c.created_at).toLocaleDateString(undefined, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerId(c.id)}
                            title="View Customer Profile"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/settings/customers/setup?customerId=${c.id}` as Route)}
                            title="Edit Customer"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <UnifiedActionMenu
                            onView={() => setSelectedCustomerId(c.id)}
                            onEdit={() => router.push(`/dashboard/settings/customers/setup?customerId=${c.id}` as Route)}
                            onPrint={() => handlePrint(c)}
                            onDelete={() => void handleDelete(c.id, c.customer_name)}
                            customItems={[
                              {
                                key: "send-form-link",
                                label: lang === "ur" ? "کسٹمر کو فارم لنک بھیجیں" : lang === "ps" ? "پیرودونکي ته د فورم لینک واستوئ" : lang === "fa" ? "ارسال لینک فرم به مشتری" : lang === "ar" ? "إرسال رابط النموذج للعميل" : "Send Form Link to Customer",
                                icon: <Send className="h-3.5 w-3.5 text-teal-600" />,
                                onClick: () => setShowSendModal(true)
                              }
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={13} className="px-5 py-10 text-center text-slate-500 font-medium italic">
                      {getLabel("noCustomersFoundFilterMsg", lang)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
          { label: getLabel("searchQueryLabel", lang), value: filterState.query || t(lang, "purchase.card_none_label", "None") }
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
        data={filteredCustomers.map(c => ({
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
