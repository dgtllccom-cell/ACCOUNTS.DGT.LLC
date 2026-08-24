"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Building2,
  Plus,
  Search,
  Eye,
  PencilLine,
  Printer,
  Trash2,
  Copy,
  RotateCcw,
  Calendar,
  Layers,
  Users,
  FileText,
  DollarSign,
  ShieldCheck,
  MoreVertical,
  Loader2,
  X,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiGet, apiDelete } from "@/lib/api/client";
import type { CompanyRow } from "@/lib/repositories/companies-repository";
import { printStore } from "@/lib/store/print-store";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { transliterateProperNoun } from "@/lib/i18n/transliteration";
import { Party360Modal } from "@/features/customers/components/party-360-modal";
import { Mail, Phone, MessageSquare, MoreHorizontal, Globe } from "lucide-react";

export type CompanyRegistryItem = {
  id: string;
  accountNo: string;
  consortium: string;
  branchRules: string;
  accountName: string;
  companiesCount: number;
  contractsCount: number;
  primaryContact: string;
  email: string;
  country: string;
  state: string;
  city: string;
  address: string;
  raw?: CompanyRow;
};

// Mock fallback data matching the reference screenshot exactly when DB is empty
const INITIAL_DEMO_COMPANIES: CompanyRegistryItem[] = [
  {
    id: "comp-1",
    accountNo: "1001001",
    consortium: "Al-Razi Consortium",
    branchRules: "Multi Branch Allowed",
    accountName: "Al-Razi Trading LLC",
    companiesCount: 5,
    contractsCount: 8,
    primaryContact: "+971 50 123 4567",
    email: "info@alrazi.ae",
    country: "UAE",
    state: "Dubai",
    city: "Dubai",
    address: "Business Bay, Tower 4, Suite 1201"
  },
  {
    id: "comp-2",
    accountNo: "1001002",
    consortium: "Ghani Group",
    branchRules: "Branch by Country",
    accountName: "Ghani International",
    companiesCount: 6,
    contractsCount: 10,
    primaryContact: "+92 300 1234567",
    email: "contact@ghani.com.pk",
    country: "Pakistan",
    state: "Punjab",
    city: "Lahore",
    address: "Gulberg III, Main Boulevard"
  },
  {
    id: "comp-3",
    accountNo: "1001003",
    consortium: "Shahbaz Consortium",
    branchRules: "Single Country Only",
    accountName: "Shahbaz Industries Ltd.",
    companiesCount: 4,
    contractsCount: 6,
    primaryContact: "+92 321 9876543",
    email: "info@shahbaz.com",
    country: "Pakistan",
    state: "Sindh",
    city: "Karachi",
    address: "SITE Industrial Area"
  },
  {
    id: "comp-4",
    accountNo: "1001004",
    consortium: "Damaan Group",
    branchRules: "All Branches Allowed",
    accountName: "Damaan Business Group",
    companiesCount: 7,
    contractsCount: 12,
    primaryContact: "+971 55 765 4321",
    email: "info@damaan.com",
    country: "UAE",
    state: "Dubai",
    city: "Deira Hub",
    address: "Al Maktoum Road"
  },
  {
    id: "comp-5",
    accountNo: "1001005",
    consortium: "Iqbal Consortium",
    branchRules: "City Branch Rule",
    accountName: "Iqbal Corporation",
    companiesCount: 3,
    contractsCount: 5,
    primaryContact: "+92 333 1112223",
    email: "admin@iqbalcorp.com",
    country: "Pakistan",
    state: "KPK",
    city: "Peshawar",
    address: "University Road"
  },
  {
    id: "comp-6",
    accountNo: "1001006",
    consortium: "Khan Brothers",
    branchRules: "Branch by Country",
    accountName: "Khan Brothers LLC",
    companiesCount: 5,
    contractsCount: 9,
    primaryContact: "+971 52 654 7890",
    email: "info@khanbrothers.ae",
    country: "UAE",
    state: "Sharjah",
    city: "Sharjah",
    address: "Industrial Area 3"
  },
  {
    id: "comp-7",
    accountNo: "1001007",
    consortium: "Sial Traders",
    branchRules: "Multi Branch Allowed",
    accountName: "Sial Traders International",
    companiesCount: 2,
    contractsCount: 4,
    primaryContact: "+92 344 5556677",
    email: "contact@sialtraders.com",
    country: "Pakistan",
    state: "Punjab",
    city: "Sialkot",
    address: "Kashmir Road"
  },
  {
    id: "comp-8",
    accountNo: "1001008",
    consortium: "Malik Enterprises",
    branchRules: "All Branches Allowed",
    accountName: "Malik Enterprises Ltd.",
    companiesCount: 6,
    contractsCount: 11,
    primaryContact: "+92 300 7654321",
    email: "info@malikent.com",
    country: "Pakistan",
    state: "Islamabad",
    city: "Islamabad",
    address: "Blue Area, G-7"
  },
  {
    id: "comp-9",
    accountNo: "1001009",
    consortium: "Global Links",
    branchRules: "Single Country Only",
    accountName: "Global Links FZCO",
    companiesCount: 4,
    contractsCount: 7,
    primaryContact: "+971 56 987 1234",
    email: "info@globallinks.ae",
    country: "UAE",
    state: "Dubai",
    city: "JAFZA",
    address: "Jebel Ali Free Zone"
  },
  {
    id: "comp-10",
    accountNo: "1001010",
    consortium: "Future Vision",
    branchRules: "City Branch Rule",
    accountName: "Future Vision Group",
    companiesCount: 8,
    contractsCount: 15,
    primaryContact: "+92 311 2223344",
    email: "info@futurevision.com",
    country: "Pakistan",
    state: "Punjab",
    city: "Rawalpindi",
    address: "Saddar Cantt"
  }
];

const BUSINESS_TERMS_I18N: Record<string, Record<string, string>> = {
  "Multi Branch Allowed": { ur: "ملٹی برانچز کی اجازت ہے", ar: "يسمح بالفروع المتعددة", ps: "د څو څانګو اجازه شته", fa: "چندین شعبه مجاز است" },
  "Branch by Country": { ur: "ملک کے لحاظ سے برانچ", ar: "فرع حسب الدولة", ps: "د هیواد له مخې څانګه", fa: "شعبه بر اساس کشور" },
  "Single Country Only": { ur: "صرف ایک ملک", ar: "دولة واحدة فقط", ps: "یوازې یو هیواد", fa: "فقط یک کشور" },
  "All Branches Allowed": { ur: "تمام برانچز کی اجازت ہے", ar: "جميع الفروع مسموح بها", ps: "ټولو څانګو ته اجازه شته", fa: "همه شعب مجاز هستند" },
  "City Branch Rule": { ur: "سٹی برانچ کے قواعد", ar: "قواعد فروع المدن", ps: "د ښار د څانګې قواعد", fa: "قوانین شعب شهری" },
  "Standard Consortium": { ur: "معیاری کنسورشیم", ar: "اتحاد قياسي", ps: "معیاري کنسورشیم", fa: "کنسرسیوم استاندارد" },
  "Company Account": { ur: "کمپنی اکاؤنٹ", ar: "حساب الشركة", ps: "د شرکت حساب", fa: "حساب شرکت" },

  // Famous Consortiums & Companies
  "DAMAAN Trading Company LLC": { ur: "دامان ٹریڈنگ کمپنی ایل ایل سی", ar: "شركة دامان التجارية ذ.م.م", ps: "دامان سوداګریز شرکت LLC", fa: "شرکت بازرگانی دامان با مسئولیت محدود" },
  "Damaan Trading Company LLC": { ur: "دامان ٹریڈنگ کمپنی ایل ایل سی", ar: "شركة دامان التجارية ذ.م.م", ps: "دامان سوداګریز شرکت LLC", fa: "شرکت بازرگانی دامان با مسئولیت محدود" },
  "Asmat Khan Group": { ur: "عصمت خان گروپ", ar: "مجموعة عصمت خان", ps: "عصمت خان ګروپ", fa: "گروه عصمت خان" },
  "Njyb Allah Group": { ur: "نجیب اللہ گروپ", ar: "مجموعة نجيب الله", ps: "نجيب الله ګروپ", fa: "گروه نجیب الله" },
  "Njyb Allah Aind Company": { ur: "نجیب اللہ اینڈ کمپنی", ar: "شركة نجيب الله", ps: "نجيب الله او شرکت", fa: "شرکت نجیب الله" },
  "Najeeb Allah Group": { ur: "نجیب اللہ گروپ", ar: "مجموعة نجيب الله", ps: "نجيب الله ګروپ", fa: "گروه نجیب الله" },
  "Najeeb Allah And Company": { ur: "نجیب اللہ اینڈ کمپنی", ar: "شركة نجيب الله", ps: "نجيب الله او شرکت", fa: "شرکت نجیب الله" },
  "Al-Razi Consortium": { ur: "الرازی کنسورشیم", ar: "اتحاد الرازي", ps: "الرازي کنسورشیم", fa: "کنسرسیوم الرازی" },
  "Al-Razi Trading LLC": { ur: "الرازی ٹریڈنگ ایل ایل سی", ar: "شركة الرازي التجارية ذ.م.م", ps: "الرازي سوداګریز شرکت", fa: "شرکت بازرگانی الرازی" },
  "Ghani Group": { ur: "غنی گروپ", ar: "مجموعة غني", ps: "غني ګروپ", fa: "گروه غنی" },
  "Ghani International": { ur: "غنی انٹرنیشنل", ar: "غني العالمية", ps: "غني انټرنیشنل", fa: "غنی بین‌المللی" },
  "Shahbaz Consortium": { ur: "شہباز کنسورشیم", ar: "اتحاد شهباز", ps: "شهباز کنسورشیم", fa: "کنسرسیوم شهباز" },
  "Shahbaz Industries Ltd.": { ur: "شہباز انڈسٹریز لمیٹڈ", ar: "شركة شهباز للصناعات المحدودة", ps: "شهباز انډسټریز لمیټډ", fa: "صنایع شهباز با مسئولیت محدود" },
  "Damaan Group": { ur: "دامان گروپ", ar: "مجموعة دامان", ps: "دامان ګروپ", fa: "گروه دامان" },
  "Damaan Business Group": { ur: "دامان بزنس گروپ", ar: "مجموعة أعمال دامان", ps: "دامان بزنس ګروپ", fa: "گروه کسب‌وکار دامان" },
  "Iqbal Consortium": { ur: "اقبال کنسورشیم", ar: "اتحاد إقبال", ps: "اقبال کنسورشیم", fa: "کنسرسیوم اقبال" },
  "Iqbal Corporation": { ur: "اقبال کارپوریشن", ar: "مؤسسة إقبال", ps: "اقبال کارپوریشن", fa: "شرکت اقبال" },
  "Khan Brothers": { ur: "خان برادرز", ar: "إخوان خان", ps: "خان برادرز", fa: "برادران خان" },
  "Khan Brothers LLC": { ur: "خان برادرز ایل ایل سی", ar: "شركة إخوان خان ذ.م.م", ps: "خان برادرز LLC", fa: "شرکت برادران خان" },
  "Sial Traders": { ur: "سیال ٹریڈرز", ar: "تجار سيال", ps: "سیال سوداګر", fa: "بازرگانان سیال" },
  "Sial Traders International": { ur: "سیال ٹریڈرز انٹرنیشنل", ar: "سيال التجارية العالمية", ps: "سیال سوداګر نړیوال", fa: "سیال تریدرز بین‌المللی" },
  "Malik Enterprises": { ur: "ملک انٹرپرائزز", ar: "مؤسسة مالك", ps: "ملک تصدۍ", fa: "شرکت‌های ملک" },
  "Malik Enterprises Ltd.": { ur: "ملک انٹرپرائزز لمیٹڈ", ar: "شركة مالك للمشاريع المحدودة", ps: "ملک انټرپرازیز لمیټډ", fa: "ملک اینترپرایزز لیمیتد" },
  "Global Links": { ur: "گلوبل لنکس", ar: "الروابط العالمية", ps: "نړیوالې اړیکې", fa: "پیوندهای جهانی" },
  "Global Links FZCO": { ur: "گلوبل لنکس ایف زیڈ سی او", ar: "غلوبال لينكس ش.م.ح", ps: "ګلوبل لنکس FZCO", fa: "گلوبال لینکس FZCO" },
  "Future Vision": { ur: "فیوچر وژن", ar: "رؤية المستقبل", ps: "راتلونکی لید", fa: "چشم‌انداز آینده" },
  "Future Vision Group": { ur: "فیوچر وژن گروپ", ar: "مجموعة رؤية المستقبل", ps: "فیوچر ویژن ګروپ", fa: "گروه چشم‌انداز آینده" },

  // Word level mappings
  "Group": { ur: "گروپ", ar: "مجموعة", ps: "ګروپ", fa: "گروه" },
  "Company": { ur: "کمپنی", ar: "شركة", ps: "شرکت", fa: "شرکت" },
  "Trading": { ur: "ٹریڈنگ", ar: "التجارية", ps: "سوداګریز", fa: "بازرگانی" },
  "LLC": { ur: "ایل ایل سی", ar: "ذ.م.م", ps: "LLC", fa: "با مسئولیت محدود" },
  "Ltd": { ur: "لیمیٹڈ", ar: "المحدودة", ps: "لیمیټډ", fa: "با مسئولیت محدود" },
  "Limited": { ur: "لیمیٹڈ", ar: "المحدودة", ps: "لیمیټډ", fa: "با مسئولیت محدود" },
  "Enterprises": { ur: "انٹرپرائزز", ar: "المشاريع", ps: "تصدۍ", fa: "شرکت‌های" },
  "Industries": { ur: "انڈسٹریز", ar: "الصناعات", ps: "انډسټریز", fa: "صنایع" },
  "International": { ur: "انٹرنیشنل", ar: "العالمية", ps: "انټرنیشنل", fa: "بین‌المللی" },
  "Consortium": { ur: "کنسورشیم", ar: "اتحاد", ps: "کنسورشیم", fa: "کنسرسیوم" },
  "Brothers": { ur: "برادرز", ar: "إخوان", ps: "برادرز", fa: "برادران" },
  "Traders": { ur: "ٹریڈرز", ar: "تجار", ps: "سوداګر", fa: "بازرگانان" },
  "And": { ur: "اینڈ", ar: "و", ps: "او", fa: "و" },
  "Aind": { ur: "اینڈ", ar: "و", ps: "او", fa: "و" },
  "Allah": { ur: "اللہ", ar: "الله", ps: "الله", fa: "الله" },
  "Njyb": { ur: "نجیب", ar: "نجيب", ps: "نجيب", fa: "نجیب" },
  "Najeeb": { ur: "نجیب", ar: "نجيب", ps: "نجيب", fa: "نجیب" },
  "Asmat": { ur: "عصمت", ar: "عصمت", ps: "عصمت", fa: "عصمت" },
  "Khan": { ur: "خان", ar: "خان", ps: "خان", fa: "خان" },
  "DAMAAN": { ur: "دامان", ar: "دامان", ps: "دامان", fa: "دامان" },
  "Damaan": { ur: "دامان", ar: "دامان", ps: "دامان", fa: "دامان" },
  "Bilal": { ur: "بلال", ar: "بلال", ps: "بلال", fa: "بلال" }
};

function localizeTerm(term: string, lang: string): string {
  if (!term || lang === "en") return term;
  const trimmed = term.trim();
  if (!trimmed) return "";

  // 1. Direct match
  if (BUSINESS_TERMS_I18N[trimmed]?.[lang]) {
    return BUSINESS_TERMS_I18N[trimmed][lang];
  }

  // 2. Case-insensitive exact match
  const lower = trimmed.toLowerCase();
  for (const [k, v] of Object.entries(BUSINESS_TERMS_I18N)) {
    if (k.toLowerCase() === lower && v[lang]) {
      return v[lang];
    }
  }

  // 3. Multi-word substitution and transliteration
  const words = trimmed.split(/(\s+)/);
  const mapped = words.map((w) => {
    if (/\s+/.test(w)) return w;
    const clean = w.replace(/[^a-zA-Z0-9]/g, "");
    const cleanLower = clean.toLowerCase();
    for (const [k, v] of Object.entries(BUSINESS_TERMS_I18N)) {
      if (k.toLowerCase() === cleanLower && v[lang]) {
        return w.replace(clean, v[lang]);
      }
    }
    return transliterateProperNoun(w, lang as any) || w;
  });

  return mapped.join("");
}

export function CompanyRegistry() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang || "en");

  const [companies, setCompanies] = useState<CompanyRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalDbBranches, setTotalDbBranches] = useState(0);

  const [companyTypeFilter, setCompanyTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const [previewCompany, setPreviewCompany] = useState<CompanyRegistryItem | null>(null);
  const [selected360Party, setSelected360Party] = useState<{ id?: string; name: string } | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadCompaniesFromDb = async () => {
    setLoading(true);
    try {
      const res: any = await apiGet(`/api/erp/companies?lang=${encodeURIComponent(lang || "en")}`);
      const rawList: any[] = Array.isArray(res?.companies) 
        ? res.companies 
        : Array.isArray(res?.data?.companies) 
        ? res.data.companies 
        : [];

      if (rawList.length > 0) {
        const mapped: CompanyRegistryItem[] = rawList.map((c: any, i: number) => {
          const contactEmail = Array.isArray(c.contacts)
            ? c.contacts.find((x: any) => (x.type || "").toLowerCase().includes("email") && x.value)?.value
            : null;
          const safeSlug = (c.raw?.name || c.name || "info").toLowerCase().replace(/[^a-z0-9]/g, "") || "company";
          const email = contactEmail || (c.email || `${safeSlug}@company.dgt.llc`);
          const contactPhone = (Array.isArray(c.contacts) && c.contacts[0]?.value) || c.mobile || "—";

          const rawConsortium = c.owner_name ? `${c.owner_name} Group` : "Standard Consortium";
          const rawRules = "Multi Branch Allowed";
          const rawAccountName = c.name || "Company Account";
          const compCount = Array.isArray(c.owner_companies) ? c.owner_companies.length : 1;
          const contractsCount = Array.isArray(c.registrations) ? c.registrations.length : 0;

          return {
            id: c.id,
            accountNo: `10010${String(i + 1).padStart(2, "0")}`,
            consortium: rawConsortium,
            branchRules: rawRules,
            accountName: rawAccountName,
            companiesCount: compCount,
            contractsCount: contractsCount,
            primaryContact: contactPhone,
            email,
            country: c.country_name || c.country || "—",
            state: c.state_name || c.state || "—",
            city: c.city_name || c.city || "—",
            address: c.address || "—",
            raw: c
          };
        });
        setCompanies(mapped);
      } else {
        setCompanies([]);
      }
    } catch (e) {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompaniesFromDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Filtered Companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const term = searchQuery.toLowerCase().trim();
      const matchSearch =
        !term ||
        c.accountNo.toLowerCase().includes(term) ||
        c.consortium.toLowerCase().includes(term) ||
        c.accountName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.primaryContact.includes(term) ||
        c.city.toLowerCase().includes(term);

      const matchCountry = countryFilter === "all" || c.country.toLowerCase() === countryFilter.toLowerCase();

      return matchSearch && matchCountry;
    });
  }, [companies, searchQuery, countryFilter]);

  // Paginated List
  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCompanies.slice(start, start + pageSize);
  }, [filteredCompanies, page]);

  // Statistics for 5 KPI Cards driven by real live database data
  const stats = useMemo(() => {
    const totalCompanies = companies.length;
    const totalBranches = totalDbBranches || (companies.length > 0 ? companies.length : 0);
    const totalAccounts = new Set(companies.map((c) => c.consortium)).size;
    const totalContracts = companies.reduce((acc, c) => acc + (c.contractsCount || 0), 0);
    const totalInAccounts = companies.reduce((acc, c) => acc + (c.companiesCount || 1), 0);
    return { totalCompanies, totalBranches, totalAccounts, totalContracts, totalInAccounts };
  }, [companies, totalDbBranches]);

  // Print Handler
  const handlePrint = (c: CompanyRegistryItem) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Company Registry - ${c.accountName}</title>
          <style>
            body { font-family: sans-serif; padding: 24px; color: #1e293b; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: 800; color: #0f172a; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
            .label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; }
            .value { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">DAMAAN GROUP • COMPANY REGISTRY DOSSIER</div>
            <div style="font-size: 12px; color: #64748b;">Account No: ${c.accountNo} | Consortium: ${c.consortium}</div>
          </div>
          <div class="grid">
            <div class="card"><div class="label">${tt("creg.account_name", "Account Name")}</div><div class="value">${c.accountName}</div></div>
            <div class="card"><div class="label">${tt("creg.branch_rules", "Branch Rules")}</div><div class="value">${c.branchRules}</div></div>
            <div class="card"><div class="label">${tt("creg.companies_count", "Companies Count")}</div><div class="value">${c.companiesCount} ${tt("creg.companies_word", "Companies")}</div></div>
            <div class="card"><div class="label">${tt("creg.total_contracts", "Total Contracts")}</div><div class="value">${c.contractsCount} ${tt("creg.active_contracts", "Active Contracts")}</div></div>
            <div class="card"><div class="label">${tt("creg.primary_contact", "Primary Contact")}</div><div class="value">${c.primaryContact}</div></div>
            <div class="card"><div class="label">${tt("creg.official_email", "Official Email")}</div><div class="value">${c.email}</div></div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `;
    printStore.openPrint(html, `Company - ${c.accountName}`);
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-6 text-slate-900 dark:text-slate-100 pb-16">

      {/* ── TOP HEADER & CONTROLS TOOLBAR ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs font-sans">
        {/* Left: Icon + Title + Count Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                {tt("creg.title", "Company Management Registry")}
              </h1>
              <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-xs leading-none">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-1.5 shrink-0" />
                {companies.length} {tt("creg.companies_word", "Companies")}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {tt("creg.subtitle", "Complete registry of company accounts, branches, contracts and related information.")}
            </p>
          </div>
        </div>

        {/* Right: Unified Search, Filters & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Integrated Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tt("common.search", "Search company, code, consortium...")}
              className="h-8.5 pl-8.5 pr-2.5 text-xs bg-slate-50/70 dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-xl font-sans"
            />
          </div>

          {/* Company Type Dropdown */}
          <select
            value={companyTypeFilter}
            onChange={(e) => setCompanyTypeFilter(e.target.value)}
            className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 font-sans"
          >
            <option value="all">{tt("creg.all_types", "All Types")}</option>
            <option value="trading">{tt("creg.type_trading", "Trading")}</option>
            <option value="clearing">{tt("creg.type_clearing", "Clearing")}</option>
            <option value="logistics">{tt("creg.type_logistics", "Logistics")}</option>
          </select>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 font-sans"
          >
            <option value="all">{tt("creg.all_status", "All Status")}</option>
            <option value="active">{tt("creg.status_active", "Active")}</option>
            <option value="inactive">{tt("creg.status_inactive", "Inactive")}</option>
          </select>

          {/* Country Dropdown */}
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 font-sans"
          >
            <option value="all">{tt("creg.all_countries", "All Countries")}</option>
            <option value="pakistan">{tt("creg.country_pakistan", "Pakistan")}</option>
            <option value="uae">{tt("creg.country_uae", "United Arab Emirates")}</option>
            <option value="afghanistan">{tt("creg.country_afghanistan", "Afghanistan")}</option>
          </select>

          {/* Branch Dropdown */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 font-sans"
          >
            <option value="all">{tt("creg.all_branches", "All Branches")}</option>
            <option value="main">{tt("creg.branch_main_hq", "Main Headquarters")}</option>
            <option value="lahore">{tt("creg.branch_lahore_hub", "Lahore Hub")}</option>
            <option value="dubai">{tt("creg.branch_dubai_hub", "Dubai Regional Hub")}</option>
          </select>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setCompanyTypeFilter("all");
                setStatusFilter("all");
                setCountryFilter("all");
                setBranchFilter("all");
              }}
              className="h-8.5 rounded-xl border-slate-200 bg-white text-xs font-bold px-3 gap-1 shadow-xs hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 font-sans"
            >
              <RotateCcw className="h-3 w-3" />
              {tt("common.reset", "Reset")}
            </Button>

            <Button
              type="button"
              onClick={() => router.push("/dashboard/settings/company-setup" as Route)}
              className="h-8.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 gap-1.5 shadow-sm font-sans"
            >
              <Plus className="h-3.5 w-3.5" />
              {tt("creg.new_company", "New Company")}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 5 STAT SUMMARY CARDS MATCHING SCREENSHOT 1 ── */}
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: TOTAL COMPANIES */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{tt("creg.kpi_total_companies", "Total Companies")}</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalCompanies}</div>
            <div className="text-[10px] text-muted-foreground">{tt("creg.kpi_total_companies_sub", "All Registered Companies")}</div>
          </div>
        </div>

        {/* Card 2: TOTAL BRANCHES */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{tt("creg.kpi_total_branches", "Total Branches")}</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalBranches}</div>
            <div className="text-[10px] text-muted-foreground">{tt("creg.kpi_total_branches_sub", "All Company Branches")}</div>
          </div>
        </div>

        {/* Card 3: TOTAL ACCOUNTS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{tt("creg.kpi_total_accounts", "Total Accounts")}</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalAccounts}</div>
            <div className="text-[10px] text-muted-foreground">{tt("creg.kpi_total_accounts_sub", "Company Accounts")}</div>
          </div>
        </div>

        {/* Card 4: TOTAL CONTRACTS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{tt("creg.kpi_total_contracts", "Total Contracts")}</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalContracts}</div>
            <div className="text-[10px] text-muted-foreground">{tt("creg.kpi_total_contracts_sub", "Active Contracts")}</div>
          </div>
        </div>

        {/* Card 5: TOTAL COMPANIES IN ACCOUNTS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{tt("creg.kpi_total_in_accounts", "Total Companies in Accounts")}</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalInAccounts}</div>
            <div className="text-[10px] text-muted-foreground">{tt("creg.kpi_total_in_accounts_sub", "Sum of Companies in All Accounts")}</div>
          </div>
        </div>
      </div>

      {/* ── MAIN REGISTRY TABLE MATCHING SCREENSHOT 1 ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-950 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="p-3.5 text-center w-12">#</th>
                <th className="p-3.5">{tt("creg.col_account_no", "Account No.")}</th>
                <th className="p-3.5">{tt("creg.col_consortium", "Consortium")}</th>
                <th className="p-3.5">{tt("creg.col_branch_rules", "Branch Rules")}</th>
                <th className="p-3.5">{tt("creg.col_account_name", "Account Name")}</th>
                <th className="p-3.5 text-center">{tt("creg.col_companies_count", "Companies Count")}</th>
                <th className="p-3.5 text-center">{tt("creg.col_contracts", "Contracts")}</th>
                <th className="p-3.5">{tt("creg.col_primary_contact", "Primary Contact (Mobile)")}</th>
                <th className="p-3.5">{tt("creg.col_email", "E-Mail")}</th>
                <th className="p-3.5 text-center">{tt("creg.col_preview", "Preview")}</th>
                <th className="p-3.5 text-center">{tt("common.actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                    {tt("creg.loading", "Loading company registry...")}
                  </td>
                </tr>
              ) : paginatedCompanies.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    {tt("creg.no_results", "No company accounts found matching your filters.")}
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Index */}
                    <td className="p-3.5 text-center font-bold text-slate-400">
                      {(page - 1) * pageSize + idx + 1}
                    </td>

                    {/* Account No (Linked in blue) */}
                    <td className="p-3.5 font-bold font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                      {c.accountNo}
                    </td>

                    {/* Consortium */}
                    <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">
                      {localizeTerm(c.consortium, lang)}
                    </td>

                    {/* Branch Rules */}
                    <td className="p-3.5 text-slate-600 dark:text-slate-400 font-medium">
                      {localizeTerm(c.branchRules, lang)}
                    </td>

                    {/* Account Name */}
                    <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                      {localizeTerm(c.accountName, lang)}
                    </td>

                    {/* Companies Count Badge */}
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900">
                        <span className="font-mono font-black">{String(c.companiesCount).padStart(2, "0")}</span> {tt("creg.companies_suffix", "Companies")}
                      </span>
                    </td>

                    {/* Contracts Badge */}
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900">
                        <span className="font-mono font-black">{String(c.contractsCount).padStart(2, "0")}</span> {tt("creg.contracts_suffix", "Contracts")}
                      </span>
                    </td>

                    {/* Primary Contact */}
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400" dir="ltr">
                      {c.primaryContact}
                    </td>

                    {/* Email */}
                    <td className="p-3.5 font-mono text-blue-600 dark:text-blue-400" dir="ltr">
                      {c.email}
                    </td>

                    {/* Preview Button */}
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setPreviewCompany(c)}
                        className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer transition"
                        title={tt("creg.crtr_preview_details", "Preview Details")}
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/settings/company-setup?companyId=${c.id}` as Route)}
                          className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-blue-50 text-blue-600 flex items-center justify-center"
                          title={tt("branch.edit", "Edit")}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(c)}
                          className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-emerald-50 text-emerald-600 flex items-center justify-center"
                          title={tt("creg.crtr_duplicate_print", "Duplicate / Print")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`${tt("creg.crtr_confirm_delete_prefix", "Are you sure you want to delete")} ${c.accountName}?`)) {
                              setCompanies((prev) => prev.filter((item) => item.id !== c.id));
                            }
                          }}
                          className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 flex items-center justify-center"
                          title={tt("common.delete", "Delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Showing Count & Pagination */}
        <div className="p-3.5 bg-slate-50/50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground font-medium">
          <div>
            {tt("creg.showing", "Showing")} {filteredCompanies.length ? (page - 1) * pageSize + 1 : 0} {tt("creg.to", "to")} {Math.min(page * pageSize, filteredCompanies.length)} {tt("creg.of", "of")} {filteredCompanies.length} {tt("creg.entries", "entries")}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40"
            >
              «
            </button>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40"
            >
              ‹
            </button>
            {[1, 2, 3].map((pNum) => (
              <button
                key={pNum}
                type="button"
                onClick={() => setPage(pNum)}
                className={cn(
                  "h-7 w-7 rounded-lg font-bold flex items-center justify-center",
                  page === pNum ? "bg-blue-600 text-white" : "border border-slate-200 hover:bg-slate-100"
                )}
              >
                {pNum}
              </button>
            ))}
            <span className="px-1 text-slate-400">...</span>
            <button
              type="button"
              onClick={() => setPage(13)}
              className={cn(
                "h-7 w-7 rounded-lg font-bold flex items-center justify-center",
                page === 13 ? "bg-blue-600 text-white" : "border border-slate-200 hover:bg-slate-100"
              )}
            >
              13
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setPage(13)}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100"
            >
              »
            </button>
          </div>
        </div>
      </div>

      {/* ── PARTY 360 MODAL ── */}
      {selected360Party && (
        <Party360Modal
          name={selected360Party.name}
          lang={lang as any}
          onClose={() => setSelected360Party(null)}
        />
      )}

      {/* ── PREVIEW DETAIL MODAL ── */}
      {previewCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-slate-100">{localizeTerm(previewCompany.accountName, lang)}</h3>
                  <p className="text-xs text-muted-foreground">Account #{previewCompany.accountNo} • {localizeTerm(previewCompany.consortium, lang)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCompany(null)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-sans">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{tt("creg.modal_branch_rules", "Branch Rules:")}</span>
                <div className="font-bold text-slate-800 dark:text-slate-200">{localizeTerm(previewCompany.branchRules, lang)}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{tt("creg.modal_total_companies", "Total Companies:")}</span>
                <div className="font-bold text-blue-600">{previewCompany.companiesCount} {tt("creg.companies_suffix", "Companies")}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{tt("creg.modal_active_contracts", "Active Contracts:")}</span>
                <div className="font-bold text-purple-600">{previewCompany.contractsCount} {tt("creg.contracts_suffix", "Contracts")}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{tt("creg.modal_primary_mobile", "Primary Mobile:")}</span>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{previewCompany.primaryContact}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1 col-span-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{tt("creg.modal_official_email", "Official Email:")}</span>
                <div className="font-mono font-bold text-blue-600">{previewCompany.email}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1 col-span-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{tt("creg.modal_registered_address", "Registered Address:")}</span>
                <div className="font-medium text-slate-700 dark:text-slate-300">{previewCompany.address}, {previewCompany.city}, {previewCompany.state}, {previewCompany.country}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrint(previewCompany)}
                className="text-xs font-bold gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> {tt("creg.print_dossier", "Print Dossier")}
              </Button>
              <Button
                size="sm"
                onClick={() => setPreviewCompany(null)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                {tt("common.close", "Close")}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
