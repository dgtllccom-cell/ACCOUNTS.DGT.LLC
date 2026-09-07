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
  Users,
  FileText,
  DollarSign,
  MoreVertical,
  Loader2,
  X,
  Phone,
  Mail,
  MessageSquare,
  Globe,
  Layers,
  ChevronRight,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api/client";
import type { CompanyRow } from "@/lib/repositories/companies-repository";
import { printStore } from "@/lib/store/print-store";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { transliterateProperNoun } from "@/lib/i18n/transliteration";
import { Party360Modal } from "@/features/customers/components/party-360-modal";
import { SimpleModal } from "@/components/ui/simple-modal";
import { CompanyIncorporationForm } from "@/features/companies/components/company-incorporation-form";
import { openCompany360Report } from "@/lib/reports/open-company-360-report-window";
import { openMasterProfile } from "@/lib/reports/master-profiles";
import {
  Group360ProfileModal,
  GroupProfileData,
  GroupCompanyItem
} from "@/features/companies/components/group-360-profile-modal";

export type LocationCountryCoverage = {
  country: string;
  flag: string;
  shortName: string;
  companyCount: number;
  statesCount: number;
  citiesCount: number;
};

export function getCountryDetails(countryStr?: string | null): { flag: string; name: string; shortName: string } {
  if (!countryStr) return { flag: "🇦🇪", name: "United Arab Emirates", shortName: "UAE" };
  const c = countryStr.toLowerCase().trim();
  if (c.includes("emirates") || c.includes("uae") || c.includes("dubai") || c.includes("sharjah") || c.includes("abu dhabi")) {
    return { flag: "🇦🇪", name: "United Arab Emirates", shortName: "UAE" };
  }
  if (c.includes("pakistan") || c.includes("pk") || c.includes("quetta") || c.includes("karachi") || c.includes("lahore") || c.includes("peshawar") || c.includes("islamabad")) {
    return { flag: "🇵🇰", name: "Pakistan", shortName: "Pakistan" };
  }
  if (c.includes("saudi") || c.includes("ksa") || c.includes("riyadh")) {
    return { flag: "🇸🇦", name: "Saudi Arabia", shortName: "KSA" };
  }
  if (c.includes("afghanistan") || c.includes("af") || c.includes("kabul") || c.includes("kandahar") || c.includes("nimruz")) {
    return { flag: "🇦🇫", name: "Afghanistan", shortName: "Afghanistan" };
  }
  if (c.includes("qatar") || c.includes("doha")) {
    return { flag: "🇶🇦", name: "Qatar", shortName: "Qatar" };
  }
  if (c.includes("oman") || c.includes("muscat")) {
    return { flag: "🇴🇲", name: "Oman", shortName: "Oman" };
  }
  if (c.includes("kuwait")) {
    return { flag: "🇰🇼", name: "Kuwait", shortName: "Kuwait" };
  }
  if (c.includes("china")) {
    return { flag: "🇨🇳", name: "China", shortName: "China" };
  }
  return { flag: "🌐", name: countryStr, shortName: countryStr };
}

export function getGroupLocationCoverages(companiesList: GroupCompanyItem[]): LocationCountryCoverage[] {
  const map = new Map<string, {
    country: string;
    flag: string;
    shortName: string;
    companies: GroupCompanyItem[];
    states: Set<string>;
    cities: Set<string>;
  }>();

  for (const comp of companiesList) {
    const rawCountry = (comp.country || "United Arab Emirates").trim();
    const details = getCountryDetails(rawCountry);
    const key = details.shortName.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        country: details.name,
        flag: details.flag,
        shortName: details.shortName,
        companies: [],
        states: new Set<string>(),
        cities: new Set<string>()
      });
    }

    const entry = map.get(key)!;
    entry.companies.push(comp);
    if (comp.state && comp.state !== "—") entry.states.add(comp.state.trim());
    if (comp.city && comp.city !== "—") entry.cities.add(comp.city.trim());
  }

  return Array.from(map.values()).map((e) => ({
    country: e.country,
    flag: e.flag,
    shortName: e.shortName,
    companyCount: e.companies.length,
    statesCount: Math.max(e.states.size, 1),
    citiesCount: Math.max(e.cities.size, 1),
  }));
}

export function getConsortiumInitials(name: string): string {
  if (!name) return "CO";
  const clean = name.replace(/Group|Consortium|LLC|Ltd|Company/gi, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "CO";
}

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
  companies: GroupCompanyItem[];
  groupData: GroupProfileData;
  raw?: CompanyRow;
};

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

  if (BUSINESS_TERMS_I18N[trimmed]?.[lang]) {
    return BUSINESS_TERMS_I18N[trimmed][lang];
  }

  const lower = trimmed.toLowerCase();
  for (const [k, v] of Object.entries(BUSINESS_TERMS_I18N)) {
    if (k.toLowerCase() === lower && v[lang]) {
      return v[lang];
    }
  }

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

export { localizeTerm };

export function CompanyRegistry({
  onRegisterNew,
  onEditCompany,
}: {
  onRegisterNew?: (ownerPersonId?: string) => void;
  onEditCompany?: (companyId: string) => void;
} = {}) {
  const router = useRouter();
  const lang = useActiveLanguage();
  const activeLang = lang || "en";
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);

  const [companies, setCompanies] = useState<CompanyRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalDbBranches, setTotalDbBranches] = useState(0);

  const [companyTypeFilter, setCompanyTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const [previewCompany, setPreviewCompany] = useState<CompanyRegistryItem | null>(null);
  const [selectedGroupProfile, setSelectedGroupProfile] = useState<GroupProfileData | null>(null);
  const [selected360Party, setSelected360Party] = useState<{ id?: string; name: string } | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [openContactMenuId, setOpenContactMenuId] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);

  const handleCopyPhone = (text: string) => {
    if (!text || text === "—") return;
    navigator.clipboard.writeText(text);
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleDelete = async (companyId: string, companyName: string) => {
    const confirmMsg = activeLang === "ur"
      ? `کیا آپ واقعی کمپنی "${companyName}" کو حذف کرنا چاہتے ہیں؟`
      : `Are you sure you want to delete company "${companyName}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/erp/companies/${encodeURIComponent(companyId)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        await loadCompaniesFromDb();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || "Failed to delete company");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to delete company");
    }
  };

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
        // Group raw companies by Owner / Consortium
        const groupsMap = new Map<string, {
          id: string;
          ownerPersonId?: string;
          ownerName: string;
          managerPersonId?: string;
          managerName?: string;
          consortiumName: string;
          branchRules: string;
          companies: GroupCompanyItem[];
        }>();

        for (const c of rawList) {
          const ownerId = c.owner_person_id || "";
          const ownerName = (c.owner_name || "").trim() || "Standard Consortium";
          const groupKey = ownerId ? `owner_${ownerId}` : `name_${ownerName.toLowerCase()}`;

          if (!groupsMap.has(groupKey)) {
            const cleanConsortium = ownerName.toLowerCase().endsWith("group")
              ? ownerName
              : `${ownerName} Group`;
            groupsMap.set(groupKey, {
              id: ownerId || c.id,
              ownerPersonId: ownerId || undefined,
              ownerName,
              managerPersonId: c.manager_person_id || undefined,
              managerName: c.manager_name || undefined,
              consortiumName: cleanConsortium,
              branchRules: "Multi Branch Allowed",
              companies: []
            });
          }

          const grp = groupsMap.get(groupKey)!;
          grp.companies.push({
            id: c.id,
            name: c.name,
            legal_name: c.legal_name,
            name_ur: c.name_ur,
            company_code: c.company_code,
            business_type: c.business_type || "LLC",
            base_currency: c.base_currency || "USD",
            address: c.address,
            city: c.city_name || c.city,
            state: c.state_name || c.state,
            country: c.country_name || c.country,
            contacts: Array.isArray(c.contacts) ? c.contacts : [],
            registrations: Array.isArray(c.registrations) ? c.registrations : [],
            is_active: c.is_active !== false,
            created_at: c.created_at,
            raw: c
          });
        }

        const mapped: CompanyRegistryItem[] = Array.from(groupsMap.values()).map((g, i) => {
          const firstWithPhone = g.companies.find((c) =>
            c.contacts?.some(
              (x: any) =>
                (x.type || "").toLowerCase().includes("mobile") ||
                (x.type || "").toLowerCase().includes("phone")
            )
          );
          const contactPhone =
            firstWithPhone?.contacts?.find(
              (x: any) =>
                (x.type || "").toLowerCase().includes("mobile") ||
                (x.type || "").toLowerCase().includes("phone")
            )?.value || (g.companies[0]?.raw?.mobile || "—");

          const firstWithEmail = g.companies.find((c) =>
            c.contacts?.some((x: any) =>
              (x.type || "").toLowerCase().includes("email")
            )
          );
          const emailVal =
            firstWithEmail?.contacts?.find((x: any) =>
              (x.type || "").toLowerCase().includes("email")
            )?.value ||
            g.companies[0]?.raw?.email ||
            `${g.ownerName.toLowerCase().replace(/[^a-z0-9]/g, "") || "group"}@company.dgt.llc`;

          const totalContracts = g.companies.reduce(
            (acc, c) => acc + (c.registrations?.length || 0),
            0
          );
          const primaryComp = g.companies[0];

          const groupData: GroupProfileData = {
            id: g.id,
            groupAccountNo: `10010${String(i + 1).padStart(2, "0")}`,
            consortiumName: g.consortiumName,
            branchRules: g.branchRules,
            ownerPersonId: g.ownerPersonId,
            ownerName: g.ownerName,
            managerPersonId: g.managerPersonId,
            managerName: g.managerName,
            primaryContact: contactPhone,
            email: emailVal,
            country: primaryComp?.country || "United Arab Emirates",
            state: primaryComp?.state || "Dubai",
            city: primaryComp?.city || "Dubai",
            address: primaryComp?.address || "—",
            companies: g.companies,
            totalCompaniesCount: g.companies.length,
            totalContractsCount: totalContracts,
            raw: primaryComp?.raw
          };

          return {
            id: g.id,
            accountNo: groupData.groupAccountNo,
            consortium: g.consortiumName,
            branchRules: g.branchRules,
            accountName: primaryComp?.name || g.consortiumName,
            companiesCount: g.companies.length,
            contractsCount: totalContracts,
            primaryContact: contactPhone,
            email: emailVal,
            country: primaryComp?.country || "United Arab Emirates",
            state: primaryComp?.state || "Dubai",
            city: primaryComp?.city || "Dubai",
            address: primaryComp?.address || "—",
            companies: g.companies,
            groupData,
            raw: primaryComp?.raw
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

  // Available unique countries across all registered companies
  const availableCountries = useMemo(() => {
    const map = new Map<string, { shortName: string; name: string; flag: string }>();
    for (const group of companies) {
      for (const comp of group.companies) {
        if (comp.country && comp.country !== "—") {
          const details = getCountryDetails(comp.country);
          map.set(details.shortName.toLowerCase(), details);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.shortName.localeCompare(b.shortName));
  }, [companies]);

  // Filtered Companies based on dynamic search, country (across sister companies), and status
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
        c.city.toLowerCase().includes(term) ||
        c.companies?.some(
          (comp) =>
            comp.name.toLowerCase().includes(term) ||
            (comp.company_code || "").toLowerCase().includes(term)
        );

      const matchCountry =
        countryFilter === "all" ||
        c.companies?.some((comp) => {
          const det = getCountryDetails(comp.country);
          return (
            det.shortName.toLowerCase() === countryFilter.toLowerCase() ||
            det.name.toLowerCase() === countryFilter.toLowerCase() ||
            (comp.country || "").toLowerCase().includes(countryFilter.toLowerCase())
          );
        });

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && c.companies?.some((comp) => comp.is_active !== false)) ||
        (statusFilter === "inactive" && c.companies?.every((comp) => comp.is_active === false));

      return matchSearch && matchCountry && matchStatus;
    });
  }, [companies, searchQuery, countryFilter, statusFilter]);

  // Paginated List
  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCompanies.slice(start, start + pageSize);
  }, [filteredCompanies, page]);

  // Statistics for 4 KPI Cards driven by real live database data and dynamically scoped by country filter
  const stats = useMemo(() => {
    if (countryFilter === "all") {
      const totalGroups = companies.length;
      const totalCompanies = companies.reduce((acc, c) => acc + (c.companiesCount || 1), 0);
      const totalContracts = companies.reduce((acc, c) => acc + (c.contractsCount || 0), 0);
      const allCountriesSet = new Set<string>();
      companies.forEach((grp) =>
        grp.companies.forEach((comp) => {
          if (comp.country) allCountriesSet.add(getCountryDetails(comp.country).shortName);
        })
      );
      const countriesCovered = Math.max(allCountriesSet.size, 1);
      return { totalGroups, totalCompanies, totalContracts, countriesCovered };
    } else {
      const matchingGroups = filteredCompanies;
      const totalGroups = matchingGroups.length;
      let totalCompanies = 0;
      let totalContracts = 0;
      matchingGroups.forEach((grp) => {
        grp.companies.forEach((comp) => {
          const det = getCountryDetails(comp.country);
          if (
            det.shortName.toLowerCase() === countryFilter.toLowerCase() ||
            det.name.toLowerCase() === countryFilter.toLowerCase() ||
            (comp.country || "").toLowerCase().includes(countryFilter.toLowerCase())
          ) {
            totalCompanies += 1;
            totalContracts += (comp.registrations?.length || 0);
          }
        });
      });
      return { totalGroups, totalCompanies, totalContracts, countriesCovered: totalGroups > 0 ? 1 : 0 };
    }
  }, [companies, filteredCompanies, countryFilter]);

  // Professional A4 Company Master Profile via the shared master-profile engine
  // (real record + bank relationships + related accounts + dynamic branding).
  const handleMasterProfile = async (c: CompanyRegistryItem) => {
    let profile: any = { id: c.id, name: c.accountName, ...(c.raw || {}) };
    try {
      const res: any = await apiGet(`/api/erp/companies/${c.id}/profile?lang=${lang}`);
      if (res?.profile) profile = res.profile;
    } catch { /* fall back to list-level data */ }
    void openMasterProfile({
      entity: "company",
      lang: lang as never,
      autoPrint: true,
      record: {
        id: profile.id || c.id,
        name: profile.name || c.accountName,
        code: profile.code || profile.company_code || c.accountNo,
        legal_name: profile.legal_name,
        base_currency: profile.base_currency,
        business_type: profile.business_type || profile.nature_of_business,
        owner_name: profile.owner_name,
        incorporation_date: profile.incorporation_date,
        is_active: profile.is_active,
        created_at: profile.created_at,
        country_name: profile.country_name || c.country,
        country_id: profile.country_id,
        country_branch_id: profile.country_branch_id,
        city_branch_id: profile.city_branch_id,
        state_name: profile.state_name || c.state,
        district_name: profile.district_name,
        city_name: profile.city_name || c.city,
        area_name: profile.area_name,
        zip_code: profile.zip_code,
        address: profile.address || c.address,
        main_branch_name: profile.main_branch_name,
        city_branch_name: profile.city_branch_name,
        contacts: profile.contacts,
        registrations: profile.registrations,
        owners: profile.owners,
        banks: profile.banks,
        relatedAccounts: profile.relatedAccounts,
      },
      scope: {
        countryId: profile.country_id,
        countryBranchId: profile.country_branch_id,
        cityBranchId: profile.city_branch_id,
        countryName: profile.country_name || c.country,
        branchName: profile.city_branch_name || profile.main_branch_name || null,
      },
    });
  };

  // 360 Degree Dossier Print & PDF Handler
  const handlePrint = async (c: CompanyRegistryItem) => {
    let fullComp: any = c.raw || {};
    let ownerDetails: any = null;
    let managerDetails: any = null;
    let sisterComps: any[] = [];
    let banks: any[] = [];

    try {
      if (c.id) {
        const cRes: any = await apiGet(`/api/erp/companies/${c.id}`);
        if (cRes?.company) fullComp = { ...fullComp, ...cRes.company };
      }
    } catch {}

    const ownerPersonId = fullComp?.owner_person_id;
    const managerPersonId = fullComp?.manager_person_id;

    if (ownerPersonId) {
      try {
        const [pRes, sumRes]: any[] = await Promise.allSettled([
          apiGet(`/api/erp/customers/${ownerPersonId}?lang=${lang}`),
          apiGet(`/api/erp/parties/360-summary?customerId=${ownerPersonId}&lang=${lang}`)
        ]);
        const pData = pRes.status === "fulfilled" && pRes.value?.customer ? pRes.value.customer : null;
        const sData = sumRes.status === "fulfilled" && sumRes.value?.summary ? sumRes.value.summary : null;
        ownerDetails = {
          id: ownerPersonId,
          name: pData?.customer_name || sData?.customerName || fullComp?.owner_name || c.consortium.replace(/ Group$/, ""),
          fatherName: pData?.father_name || sData?.fatherName || "—",
          customerCode: pData?.customer_code || pData?.person_code || sData?.customerCode || "CUST-OWNER",
          employeeCode: sData?.employees?.[0]?.employeeCode || "EMP-0010",
          phone: pData?.mobile || sData?.mobile || sData?.phone || c.primaryContact,
          email: pData?.email || sData?.email || c.email,
          country: pData?.country_name || sData?.countryName || c.country,
          city: pData?.city_name || sData?.cityName || c.city,
          address: pData?.address || sData?.address || c.address
        };
        if (sData?.companies?.length) sisterComps = sData.companies;
        if (sData?.banks?.length) banks = sData.banks;
      } catch {}
    } else {
      ownerDetails = {
        name: fullComp?.owner_name || c.consortium.replace(/ Group$/, "") || "Company Owner",
        fatherName: "—",
        customerCode: "CUST-OWNER",
        employeeCode: "EMP-0010",
        phone: c.primaryContact,
        email: c.email,
        country: c.country,
        city: c.city,
        address: c.address
      };
    }

    if (managerPersonId) {
      try {
        const [mRes, mSumRes]: any[] = await Promise.allSettled([
          apiGet(`/api/erp/customers/${managerPersonId}?lang=${lang}`),
          apiGet(`/api/erp/parties/360-summary?customerId=${managerPersonId}&lang=${lang}`)
        ]);
        const mData = mRes.status === "fulfilled" && mRes.value?.customer ? mRes.value.customer : null;
        const msData = mSumRes.status === "fulfilled" && mSumRes.value?.summary ? mSumRes.value.summary : null;
        managerDetails = {
          id: managerPersonId,
          name: mData?.customer_name || msData?.customerName || "Company Manager",
          fatherName: mData?.father_name || msData?.fatherName || "—",
          customerCode: mData?.customer_code || mData?.person_code || "MGR-001",
          employeeCode: msData?.employees?.[0]?.employeeCode || "EMP-MGR",
          phone: mData?.mobile || msData?.mobile || msData?.phone || "—",
          email: mData?.email || msData?.email || "—",
          country: mData?.country_name || msData?.countryName || "—",
          city: mData?.city_name || msData?.cityName || "—"
        };
      } catch {}
    }

    openCompany360Report({
      company: {
        id: c.id,
        accountNo: c.accountNo,
        name: c.accountName,
        legalName: fullComp?.legal_name || c.accountName,
        nameUrdu: fullComp?.name_ur || transliterateProperNoun(c.accountName, "ur"),
        businessType: fullComp?.business_type || "LLC (Limited Liability Company)",
        natureOfBusiness: fullComp?.nature_of_business || "Trading & General Order Supplier",
        registrationType: fullComp?.registrations?.[0]?.type || "Trade License",
        licenseNumber: fullComp?.registrations?.[0]?.value || "TL-998822",
        baseCurrency: fullComp?.base_currency || "USD",
        countryName: c.country,
        stateName: c.state,
        cityName: c.city,
        address: c.address,
        phone: c.primaryContact,
        email: c.email,
        branchRules: c.branchRules,
        isBranchOperative: fullComp?.is_branch_operative,
        mainBranchName: fullComp?.main_branch_name || "Main Headquarters",
        cityBranchName: fullComp?.city_branch_name || c.city,
        superAdminSerial: fullComp?.super_admin_serial || "SA-CMP-001",
        countrySerial: fullComp?.country_serial || "CT-CMP-001",
        branchSerial: fullComp?.branch_serial || "BR-CMP-001",
        entrySerial: fullComp?.entry_serial || fullComp?.company_code || "CMP-001",
        companyCode: fullComp?.company_code || fullComp?.entry_serial || "CMP-001"
      },
      owner: ownerDetails,
      manager: managerDetails,
      sisterCompanies: sisterComps,
      banks,
      lang
    });
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-6 text-slate-900 dark:text-slate-100 pb-16">

      {/* ── 4 STAT SUMMARY CARDS MATCHING SCREENSHOT 2 ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 font-sans">
        {/* Card 1: TOTAL GROUPS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between group hover:border-blue-300 transition">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/80 dark:border-blue-800 shrink-0 shadow-2xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {activeLang === "ur" ? "کل گروپس" : "TOTAL GROUPS"}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalGroups}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {activeLang === "ur" ? "بزنس کنسورشیم گروپس" : "Business consortium groups"}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Card 2: TOTAL REGISTERED COMPANIES */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between group hover:border-emerald-300 transition">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800 shrink-0 shadow-2xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {activeLang === "ur" ? "کل رجسٹرڈ کمپنیاں" : "TOTAL REGISTERED COMPANIES"}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalCompanies}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {activeLang === "ur" ? "سسٹم کی تمام کمپنیاں" : "All companies in the system"}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Card 3: ACTIVE CONTRACTS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between group hover:border-purple-300 transition">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/80 dark:border-purple-800 shrink-0 shadow-2xs">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {activeLang === "ur" ? "فعال معاہدے و لائسنس" : "ACTIVE CONTRACTS"}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalContracts}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {activeLang === "ur" ? "موجودہ فعال معاہدے" : "Current active contracts"}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Card 4: COUNTRIES COVERED */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between group hover:border-sky-300 transition">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200/80 dark:border-sky-800 shrink-0 shadow-2xs">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {activeLang === "ur" ? "ممالک کا احاطہ" : "COUNTRIES COVERED"}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.countriesCovered}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {activeLang === "ur" ? "رجسٹرڈ کمپنیوں والے ممالک" : "Countries with registered companies"}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* ── TOOLBAR & SEARCH FILTER ROW MATCHING SCREENSHOT 2 ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs font-sans">
        {/* Left: Icon + Title + Groups Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {activeLang === "ur" ? "کمپنی مینجمنٹ رجسٹری" : "Company Management Registry"}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                • {filteredCompanies.length} {activeLang === "ur" ? "گروپس" : "Groups"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {activeLang === "ur"
                ? "کمپنی اکاؤنٹس، برانچز، معاہدوں اور متعلقہ معلومات کی مکمل رجسٹری۔"
                : "Complete registry of company accounts, branches, contracts and related information."}
            </p>
          </div>
        </div>

        {/* Right: Search, Filter Dropdowns & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[200px] sm:min-w-[230px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={activeLang === "ur" ? "گروپس، اکاؤنٹس تلاش کریں..." : "Search groups, accounts..."}
              className="w-full h-9 pl-9 pr-7 rounded-xl border border-slate-200 bg-white text-xs font-semibold placeholder:text-slate-400 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Type Dropdown */}
          <select
            value={companyTypeFilter}
            onChange={(e) => {
              setCompanyTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer shadow-2xs"
          >
            <option value="all">{activeLang === "ur" ? "تمام اقسام" : "All Types"}</option>
            <option value="trading">{activeLang === "ur" ? "ٹریڈنگ" : "Trading"}</option>
            <option value="clearing">{activeLang === "ur" ? "کلیئرنگ" : "Clearing"}</option>
            <option value="logistics">{activeLang === "ur" ? "لاجسٹکس" : "Logistics"}</option>
          </select>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer shadow-2xs"
          >
            <option value="all">{activeLang === "ur" ? "تمام حالتیں" : "All Status"}</option>
            <option value="active">{activeLang === "ur" ? "فعال" : "Active"}</option>
            <option value="inactive">{activeLang === "ur" ? "غیر فعال" : "Inactive"}</option>
          </select>

          {/* Dynamic Country Dropdown */}
          <select
            value={countryFilter}
            onChange={(e) => {
              setCountryFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer shadow-2xs"
          >
            <option value="all">{activeLang === "ur" ? "تمام ممالک" : "All Countries"}</option>
            {availableCountries.map((c) => (
              <option key={c.shortName} value={c.shortName}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>

          {/* Branch Dropdown */}
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer shadow-2xs"
          >
            <option value="all">{activeLang === "ur" ? "تمام برانچز" : "All Branches"}</option>
            <option value="main">{activeLang === "ur" ? "مرکزی ہیڈ کوارٹر" : "Main Headquarters"}</option>
            <option value="lahore">{activeLang === "ur" ? "لاہور ہب" : "Lahore Hub"}</option>
            <option value="dubai">{activeLang === "ur" ? "دبئی ریجنل ہب" : "Dubai Regional Hub"}</option>
          </select>

          {/* Reset Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setCompanyTypeFilter("all");
              setStatusFilter("all");
              setCountryFilter("all");
              setBranchFilter("all");
              setPage(1);
            }}
            className="h-9 rounded-xl border-slate-200 bg-white text-xs font-bold px-3 gap-1 shadow-2xs hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{activeLang === "ur" ? "ری سیٹ" : "Reset"}</span>
          </Button>

          <Button
            type="button"
            onClick={() => {
              if (onRegisterNew) {
                onRegisterNew();
              } else {
                setOpenCreateModal(true);
              }
            }}
            className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{activeLang === "ur" ? "+ نئی کمپنی رجسٹر کریں" : "+ Register New Company"}</span>
          </Button>
        </div>
      </div>

      {/* ── MAIN REGISTRY TABLE MATCHING SCREENSHOT 2 ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-950 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="p-3.5 text-center w-10">#</th>
                <th className="p-3.5">{activeLang === "ur" ? "اکاؤنٹ نمبر" : "ACCOUNT NO."}</th>
                <th className="p-3.5">{activeLang === "ur" ? "کنسورشیم / گروپ" : "CONSORTIUM"}</th>
                <th className="p-3.5">{activeLang === "ur" ? "برانچ رولز" : "BRANCH RULES"}</th>
                <th className="p-3.5">{activeLang === "ur" ? "مقام کا خلاصہ" : "LOCATION SUMMARY"}</th>
                <th className="p-3.5 text-center">{activeLang === "ur" ? "کمپنیوں کی تعداد" : "COMPANIES COUNT"}</th>
                <th className="p-3.5 text-center">{activeLang === "ur" ? "معاہدے" : "CONTRACTS"}</th>
                <th className="p-3.5 text-center">{activeLang === "ur" ? "رابطے" : "CONTACTS"}</th>
                <th className="p-3.5 text-center">{activeLang === "ur" ? "اقدامات" : "ACTIONS"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                    {activeLang === "ur" ? "کمپنی رجسٹری لوڈ ہو رہی ہے..." : "Loading company registry..."}
                  </td>
                </tr>
              ) : paginatedCompanies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    {activeLang === "ur" ? "کوئی کمپنی اکاؤنٹ نہیں ملا۔" : "No company accounts found matching your filters."}
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map((c, idx) => {
                  const locationCoverages = getGroupLocationCoverages(c.companies);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                      {/* 1. Index */}
                      <td className="p-3.5 text-center font-bold text-slate-400">
                        {(page - 1) * pageSize + idx + 1}
                      </td>

                      {/* 2. Account No & Serials */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1">
                          <span
                            className="font-black font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer text-xs"
                            onClick={() => setSelectedGroupProfile(c.groupData)}
                            title="Open Group 360° Profile"
                          >
                            {c.accountNo}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap text-[9px] font-mono">
                            <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 font-bold" title="Corporate Group Master Serial">
                              GRP-{String(idx + 1).padStart(3, "0")}
                            </span>
                            {c.raw?.owner_person_id && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 font-bold" title="Customer Master Serial">
                                CUST-LINK
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Consortium (Avatar circle + Group Name + Owner) */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-black text-xs flex items-center justify-center border border-blue-200 dark:border-blue-800 shrink-0 shadow-2xs">
                            {getConsortiumInitials(c.consortium)}
                          </div>
                          <div className="min-w-0">
                            <div
                              className="font-black text-xs text-slate-900 dark:text-slate-100 hover:text-blue-600 transition cursor-pointer truncate"
                              onClick={() => setSelectedGroupProfile(c.groupData)}
                            >
                              {localizeTerm(c.consortium, lang)}
                            </div>
                            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                              Owner: <strong className="text-slate-700 dark:text-slate-300">{localizeTerm(c.groupData.ownerName, lang)}</strong>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Branch Rules */}
                      <td className="p-3.5 text-slate-600 dark:text-slate-400 font-medium">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold border border-slate-200/60 dark:border-slate-700">
                          {localizeTerm(c.branchRules, lang)}
                        </span>
                      </td>

                      {/* 5. Location Summary (Country Pills: Flag, Country, X Companies, Y States • Z Cities) */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {locationCoverages.map((cov) => (
                            <div
                              key={cov.shortName}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 min-w-[130px] shadow-2xs"
                            >
                              <span className="text-xl leading-none shrink-0" role="img" aria-label={cov.country}>
                                {cov.flag}
                              </span>
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                  {cov.shortName}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  {cov.companyCount} {cov.companyCount === 1 ? (activeLang === "ur" ? "کمپنی" : "Company") : (activeLang === "ur" ? "کمپنیاں" : "Companies")}
                                </span>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
                                  {cov.statesCount} {activeLang === "ur" ? "ریاستیں" : cov.statesCount === 1 ? "State" : "States"} • {cov.citiesCount} {activeLang === "ur" ? "شہر" : cov.citiesCount === 1 ? "City" : "Cities"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* 6. Companies Count (Clickable Button + Subtext) */}
                      <td className="p-3.5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => setSelectedGroupProfile(c.groupData)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900 cursor-pointer transition shadow-2xs group"
                            title="Click to view full group profile"
                          >
                            <span>{c.companiesCount} {c.companiesCount === 1 ? (activeLang === "ur" ? "کمپنی" : "Company") : (activeLang === "ur" ? "کمپنیاں" : "Companies")}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                            {activeLang === "ur" ? "تفصیلات کے لیے کلک کریں" : "Click to view company details"}
                          </span>
                        </div>
                      </td>

                      {/* 7. Contracts Badge */}
                      <td className="p-3.5 text-center">
                        <span
                          onClick={() => setSelectedGroupProfile(c.groupData)}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900 cursor-pointer transition shadow-2xs"
                          title="Click to view all contracts and licenses"
                        >
                          {c.contractsCount} {activeLang === "ur" ? "معاہدے" : c.contractsCount === 1 ? "Contract" : "Contracts"}
                        </span>
                      </td>

                      {/* 8. Combined Contacts (Phone, WhatsApp, Email) + Interactive Popover */}
                      <td className="p-3.5 text-center relative">
                        <div className="inline-flex items-center justify-center gap-1.5" dir="ltr">
                          {c.primaryContact && c.primaryContact !== "—" ? (
                            <button
                              type="button"
                              onClick={() => setOpenContactMenuId(openContactMenuId === c.id ? null : c.id)}
                              className="h-7 w-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 flex items-center justify-center transition border border-emerald-200 shadow-2xs cursor-pointer"
                              title="Call / Contact Options"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          {c.primaryContact && c.primaryContact !== "—" ? (
                            <a
                              href={`https://wa.me/${c.primaryContact.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="h-7 w-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 flex items-center justify-center transition border border-emerald-200 shadow-2xs cursor-pointer"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                          {c.email && c.email !== "—" ? (
                            <a
                              href={`mailto:${c.email}`}
                              className="h-7 w-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 flex items-center justify-center transition border border-blue-200 shadow-2xs cursor-pointer"
                              title={`Send email to ${c.email}`}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>

                        {/* Contact Popover Dropdown */}
                        {openContactMenuId === c.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenContactMenuId(null)} />
                            <div className={cn(
                              "absolute right-0 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 text-left animate-in fade-in zoom-in-95 duration-150",
                              idx >= Math.max(paginatedCompanies.length - 2, 1) ? "bottom-8 mb-1" : "top-10"
                            )}>
                              <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] uppercase font-bold text-slate-400">Contact Options</div>
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{c.primaryContact}</div>
                              </div>
                              <div className="p-1 space-y-1 text-xs">
                                {c.primaryContact && c.primaryContact !== "—" && (
                                  <a
                                    href={`tel:${c.primaryContact.replace(/[^0-9+]/g, "")}`}
                                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 transition font-medium"
                                  >
                                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Call ({c.primaryContact})</span>
                                  </a>
                                )}
                                {c.primaryContact && c.primaryContact !== "—" && (
                                  <a
                                    href={`https://wa.me/${c.primaryContact.replace(/[^0-9]/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 transition font-medium"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Open WhatsApp</span>
                                  </a>
                                )}
                                {c.email && c.email !== "—" && (
                                  <a
                                    href={`mailto:${c.email}`}
                                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 transition font-medium"
                                  >
                                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                                    <span className="truncate">Send Email</span>
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleCopyPhone(c.primaryContact)}
                                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium cursor-pointer"
                                >
                                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                                  <span>{copiedPhone === c.primaryContact ? "Copied!" : "Copy Contact Number"}</span>
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </td>

                      {/* 9. Actions Column (Eye Quick View + 3-Dots Menu) */}
                      <td className="p-3.5 text-center relative">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedGroupProfile(c.groupData)}
                            className="h-8 w-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 inline-flex items-center justify-center cursor-pointer transition border border-blue-200/50 shadow-2xs"
                            title="View Group 360° Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenActionMenuId(openActionMenuId === c.id ? null : c.id)}
                            className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shadow-2xs"
                            title="Actions Menu"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>

                        {openActionMenuId === c.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenActionMenuId(null)}
                            />
                            <div className={cn(
                              "absolute right-3 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 text-left animate-in fade-in zoom-in-95 duration-150",
                              idx >= Math.max(paginatedCompanies.length - 2, 1) ? "bottom-8 mb-1" : "top-10"
                            )}>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setSelectedGroupProfile(c.groupData);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300 transition cursor-pointer"
                              >
                                <Eye className="h-4 w-4 text-blue-600" />
                                <span>View Full Group Profile</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  const compId = c.companies[0]?.id || c.id;
                                  if (onEditCompany && compId) {
                                    onEditCompany(compId);
                                  } else {
                                    router.push(`/dashboard/settings/company-setup?companyId=${compId}` as Route);
                                  }
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              >
                                <PencilLine className="h-4 w-4 text-slate-500" />
                                <span>Edit Group / Main Company</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  if (onRegisterNew) {
                                    onRegisterNew(c.raw?.owner_person_id || undefined);
                                  } else {
                                    router.push(`/dashboard/settings/company-setup?action=new` as Route);
                                  }
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                              >
                                <Plus className="h-4 w-4 text-emerald-600" />
                                <span>+ Add Sister Company</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleMasterProfile(c);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              >
                                <Printer className="h-4 w-4 text-slate-500" />
                                <span>Print Master Profile (A4)</span>
                              </button>

                              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleDelete(c.id, c.accountName);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 text-rose-600" />
                                <span>Delete Group / Company</span>
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
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
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              «
            </button>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              ‹
            </button>
            {[1, 2, 3].map((pNum) => (
              <button
                key={pNum}
                type="button"
                onClick={() => setPage(pNum)}
                className={cn(
                  "h-7 w-7 rounded-lg font-bold flex items-center justify-center cursor-pointer",
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
                "h-7 w-7 rounded-lg font-bold flex items-center justify-center cursor-pointer",
                page === 13 ? "bg-blue-600 text-white" : "border border-slate-200 hover:bg-slate-100"
              )}
            >
              13
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 cursor-pointer"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setPage(13)}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 cursor-pointer"
            >
              »
            </button>
          </div>
        </div>
      </div>

      {/* ── CREATE NEW COMPANY MODAL ── */}
      {openCreateModal && (
        <SimpleModal
          title={tt("creg.new_company", "New Company - Company Master")}
          onClose={() => setOpenCreateModal(false)}
          className="w-[96vw] max-w-[1100px] h-[90vh] max-h-[90vh] rounded-2xl font-sans"
        >
          <CompanyIncorporationForm
            mode="embedded"
            onSave={() => {
              loadCompaniesFromDb();
              setOpenCreateModal(false);
            }}
          />
        </SimpleModal>
      )}

      {/* ── GROUP 360 PROFILE MODAL ── */}
      {selectedGroupProfile && (
        <Group360ProfileModal
          group={selectedGroupProfile}
          lang={lang}
          onClose={() => setSelectedGroupProfile(null)}
          onEditCompany={(compCompanyId) => {
            setSelectedGroupProfile(null);
            if (onEditCompany) {
              onEditCompany(compCompanyId);
            } else {
              router.push(`/dashboard/settings/company-setup?companyId=${compCompanyId}` as Route);
            }
          }}
          onRegisterSisterCompany={(ownerPersonId) => {
            setSelectedGroupProfile(null);
            if (onRegisterNew) {
              onRegisterNew(ownerPersonId);
            } else {
              router.push(`/dashboard/settings/company-setup?action=new` as Route);
            }
          }}
        />
      )}

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
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
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
                onClick={() => {
                  setSelected360Party({ id: previewCompany.id, name: previewCompany.accountName });
                }}
                className="text-xs font-bold gap-1.5 cursor-pointer text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                <Globe className="h-3.5 w-3.5" /> {tt("cusm.view_360", "View 360 Profile")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMasterProfile(previewCompany)}
                className="text-xs font-bold gap-1.5 cursor-pointer text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Printer className="h-3.5 w-3.5" /> {tt("pdoc.company_report_title", "Company Master Profile")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrint(previewCompany)}
                className="text-xs font-bold gap-1.5 cursor-pointer text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                <Printer className="h-3.5 w-3.5" /> {tt("creg.print_dossier", "Print 360° PDF Dossier")}
              </Button>
              <Button
                size="sm"
                onClick={() => setPreviewCompany(null)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
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
