"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { printStore } from "@/lib/store/print-store";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Building2, Search, Eye, PencilLine, Printer, Trash2, Users, UserCheck, UserMinus, Plus, Mail, MessageSquare, MoreHorizontal, Phone, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedActionMenu } from "@/components/ui/unified-action-menu";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { CustomerProfile } from "./customer-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DocumentAttachmentIcon } from "@/components/documents/document-attachment-icon";
import { apiGet, apiDelete } from "@/lib/api/client";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLabel } from "./translations";
import { t } from "@/lib/i18n/ui";
import { Th } from "@/components/ui/translated-th";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";

type CustomerRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  city_id: string | null;
  area_location_id: string | null;
  customer_name: string;
  company_name: string | null;
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

export function CustomerList({ lang }: { lang: SupportedLanguage }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  
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
        fatherName: c.contact_person || "",
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

      // Explicitly compute customer account code derived from ID
      meta.customerAccountNumber = "CUST-" + c.id.slice(0, 6).toUpperCase();

      return {
        ...c,
        meta
      };
    });
  }, [customers]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = parsedCustomers.length;
    const active = parsedCustomers.filter((c) => c.meta.status === "Active").length;
    const inactive = total - active;
    const business = parsedCustomers.filter((c) => c.meta.customerType === "Business").length;
    const individual = total - business;

    return { total, active, inactive, business, individual };
  }, [parsedCustomers]);

  // Filter & Search
  const filteredCustomers = useMemo(() => {
    let list = parsedCustomers;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          c.meta.customerAccountNumber.toLowerCase().includes(q) ||
          (c.mobile && c.mobile.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((c) => c.meta.status.toLowerCase() === statusFilter.toLowerCase());
    }

    return list;
  }, [searchQuery, statusFilter, parsedCustomers]);

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

  // Custom A4 printable window generator
  const handlePrint = (c: typeof parsedCustomers[0]) => {
    const contactsHtml = c.meta.contacts
      .map(
        (cn) => `
        <div class="field">
          <div class="label">${cn.type}</div>
          <div class="value">${cn.value || "-"}</div>
        </div>
      `
      )
      .join("");

    const docsHtml = c.meta.documents
      .map(
        (d) => `
        <div class="field">
          <div class="label">${d.type}</div>
          <div class="value">${d.number || "-"} ${d.upload ? `(${d.upload})` : ""}</div>
        </div>
      `
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>Customer Profile - ${c.customer_name}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              line-height: 1.5;
              font-size: 13px;
              background-color: #f8fafc;
            }
            .certificate-container {
              border: 1px solid #e2e8f0;
              padding: 30px;
              border-radius: 12px;
              background-color: #ffffff;
              max-width: 800px;
              margin: 20px auto;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
            }
            .header {
              border-bottom: 2px solid #0f766e;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .title {
              font-size: 24px;
              font-weight: 800;
              color: #0f766e;
              margin: 0;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-top: 3px;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 11px;
              font-weight: 700;
              color: #0f766e;
              border-bottom: 1.5px solid #cbd5e1;
              padding-bottom: 4px;
              margin-bottom: 12px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .grid {
              display: grid;
              grid-template-cols: repeat(2, 1fr);
              gap: 20px;
            }
            .field {
              margin-bottom: 8px;
            }
            .label {
              font-size: 9px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 700;
              letter-spacing: 0.05em;
            }
            .value {
              font-size: 13px;
              font-weight: 600;
              color: #0f172a;
              margin-top: 1px;
            }
            @media print {
              body {
                background: none;
                margin: 0;
              }
              .certificate-container {
                border: none;
                padding: 0;
                box-shadow: none;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="certificate-container">
            <div class="header">
              <h1 class="title">${c.customer_name}</h1>
              <div class="subtitle">${getLabel("officialCustomerProfileCertificate", lang)}</div>
            </div>

            <div class="grid">
              <div class="section">
                <div class="section-title">${getLabel("personalInfo", lang)}</div>
                <div class="field">
                  <div class="label">${getLabel("customerAccountCode", lang)}</div>
                  <div class="value">${c.meta.customerAccountNumber}</div>
                </div>
                <div class="field">
                  <div class="label">${getLabel("customerType", lang)}</div>
                  <div class="value">${c.meta.customerType}</div>
                </div>
                <div class="field">
                  <div class="label">${t(lang, "hr.f_full_name", "Full Name")}</div>
                  <div class="value">${c.customer_name}</div>
                </div>
                <div class="field">
                  <div class="label">${getLabel("fatherNameRepresentative", lang)}</div>
                  <div class="value">${c.meta.fatherName || "-"}</div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">${getLabel("locationInfo", lang)}</div>
                <div class="field">
                  <div class="label">${getLabel("fullAddress", lang)}</div>
                  <div class="value">${c.address || "-"}</div>
                </div>
                <div class="field">
                  <div class="label">${getLabel("zipCityCode", lang)}</div>
                  <div class="value">${c.meta.cityCode || "-"}</div>
                </div>
                <div class="field">
                  <div class="label">${getLabel("countryStateCity", lang)}</div>
                  <div class="value">${[c.meta.city, c.meta.stateProvince, c.meta.country].filter(Boolean).join(", ") || "-"}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">${getLabel("contactInfo", lang)}</div>
              <div class="grid" style="grid-template-cols: repeat(3, 1fr);">
                ${contactsHtml || `<div class="value">${getLabel("noContactsRegistered", lang)}</div>`}
              </div>
            </div>

            <div class="section">
              <div class="section-title">${getLabel("documentInfo", lang)}</div>
              <div class="grid" style="grid-template-cols: repeat(3, 1fr);">
                ${docsHtml || `<div class="value">${getLabel("noDocumentsRegistered", lang)}</div>`}
              </div>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;
    printStore.openPrint(html, `Customer Profile - ${c.customer_name}`);
  };

  const isRtl = lang !== "en";

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">{t(lang, "cusm.settings_management", "Settings / Management")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {getLabel("customersTitle", lang)}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {getLabel("createOrUpdateCustomerSub", lang)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowReport(true)}
            className="gap-2 border-slate-700 hover:bg-slate-800 text-slate-200 font-medium shadow-sm h-10 px-4 rounded-lg text-xs"
          >
            <Printer className="h-4 w-4 text-cyan-400" />
            {t(lang, "wh.print_report", "Print / Report")}
          </Button>
          <Button
            type="button"
            onClick={() => router.push("/dashboard/settings/customers/setup" as Route)}
            className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm h-10 px-4 rounded-lg text-xs"
          >
            <Plus className="h-4 w-4" />
            {t(lang, "bdash.qa_add_customer", "Add Customer")}
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

        {/* Card 3: TYPE BREAKDOWN */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-purple-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">3. {getLabel("typeBreakdown", lang)}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-amber-600 font-bold">
              <span>{getLabel("corporateBusinessLabel", lang)}:</span>
              <span>{stats.business}</span>
            </div>
            <div className="flex justify-between text-indigo-600 font-bold">
              <span>{getLabel("individualPersonalLabel", lang)}:</span>
              <span>{stats.individual}</span>
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

      {/* Main Table */}
      <Card className="rounded-xl border shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b px-5 py-4 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">{getLabel("customerListDirectory", lang)}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{getLabel("useActionsToViewEditPrintMsg", lang)}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className={`absolute ${isRtl ? "right-3" : "left-3"} top-2.5 h-4 w-4 text-muted-foreground`} />
                <Input
                  placeholder={getLabel("searchPlaceholder", lang)}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${isRtl ? "pr-9" : "pl-9"} h-9 text-xs bg-white text-slate-900 border-slate-200 focus:border-teal-500`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
              >
                <option value="all">{getLabel("allStatuses", lang)}</option>
                <option value="active">{getLabel("activeStatus", lang)}</option>
                <option value="inactive">{getLabel("inactiveStatus", lang)}</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <Th className="px-5 py-3.5">#</Th>
                  <Th className="px-5 py-3.5">{getLabel("customerCode", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("customerName", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("customerType", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("country", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("stateProvince", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("city", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("contacts", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("documents", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("status", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("createdDate", lang)}</Th>
                  <Th className="px-5 py-3.5 text-center">{getLabel("actions", lang)}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-5 py-10 text-center text-slate-500 font-medium italic">
                      {getLabel("loadingCustomerRegistryDirectory", lang)}
                    </td>
                  </tr>
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c, i) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-semibold text-slate-500">{i + 1}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 font-mono">
                        {c.meta.customerAccountNumber}
                      </td>
                      <td className="px-5 py-3.5 font-extrabold text-slate-900">
                        {translateCustomerText(c.customer_name, lang)}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800">{translateCustomerText(c.meta.customerType, lang)}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {translateCustomerText(c.meta.country, lang)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {translateCustomerText(c.meta.stateProvince, lang)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {translateCustomerText(c.meta.city, lang)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
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
                      <td className="px-5 py-3.5 text-slate-600">
                        <DocumentAttachmentIcon entityType="customers" entityId={c.id} />
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                            c.meta.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {c.meta.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono font-medium">
                        {new Date(c.created_at).toLocaleDateString(undefined, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                          <UnifiedActionMenu
                            onView={() => setSelectedCustomerId(c.id)}
                            onEdit={() => router.push(`/dashboard/settings/customers/setup?customerId=${c.id}` as Route)}
                            onPrint={() => handlePrint(c)}
                            onDelete={() => void handleDelete(c.id, c.customer_name)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="px-5 py-10 text-center text-slate-500 font-medium italic">
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
    </div>
  );
}
