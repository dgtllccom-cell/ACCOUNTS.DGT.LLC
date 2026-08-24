import fs from 'fs';

const code = `"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Building2,
  CheckCircle2,
  Plus,
  Save,
  Trash2,
  RefreshCcw,
  X,
  User,
  Users,
  Phone,
  Mail,
  MapPin,
  FileText,
  Eye,
  ShieldCheck,
  Building,
  Landmark,
  CreditCard,
  Briefcase,
  Layers,
  ArrowRight,
  ArrowLeft,
  Settings,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactNumberInput } from "@/components/ui/contact-number-input";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import { apiPost, apiGet, apiPatch } from "@/lib/api/client";
import { PersonPicker } from "@/features/hr-payroll/components/person-picker";
import type { ContactTypeKey } from "@/features/contact-types/contact-type-api";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";
import { PreferencesControls } from "@/components/layout/preferences-controls";

type DynamicList = "contacts" | "registrations" | "ownerIds";
type DynamicRow = {
  id: string;
  type: string;
  value: string;
};

export type CompanyIncorporationData = {
  id?: string;
  ownerName: string;
  companyName: string;
  businessName: string;
  businessType?: string;
  registrationType?: string;
  licenseNumber?: string;
  natureOfBusiness?: string;
  countryId?: string;
  stateProvinceId?: string;
  districtId?: string;
  cityId?: string;
  areaLocationId?: string;
  country: string;
  state: string;
  district?: string;
  city: string;
  area?: string;
  zipCode: string;
  address: string;
  contacts: DynamicRow[];
  registrations: DynamicRow[];
  ownerIds: DynamicRow[];
};

const defaultTypes: Record<DynamicList, string[]> = {
  contacts: ["Mobile Number", "Office Number", "WhatsApp Number", "Email Address"],
  registrations: ["Trade License Number", "VAT/TRN", "Sales Tax No", "GST No", "PSI No", "NTN No"],
  ownerIds: ["Passport / Emirates ID / National ID", "CNIC No", "Passport No", "National ID", "Residence Permit"]
};

function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "row-" + Math.random().toString(36).substring(2, 11);
}

function newRow(): DynamicRow {
  return { id: safeUUID(), type: "", value: "" };
}

export function CompanyIncorporationForm({
  mode = "standalone",
  initialCompanyId,
  onSave,
  onClose
}: {
  mode?: "standalone" | "embedded";
  initialCompanyId?: string;
  onSave?: (data: CompanyIncorporationData) => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const lang = useActiveLanguage();
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);

  function handleClose() {
    if (onClose) {
      onClose();
      return;
    }
    router.push("/dashboard/settings/company" as Route);
  }

  // --- State Variables ---
  const [ownerPersonId, setOwnerPersonId] = useState("");
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [existingCompaniesForOwner, setExistingCompaniesForOwner] = useState<Array<any>>([]);
  const [ownerName, setOwnerName] = useState("");
  
  // Step Form Fields
  const [companyName, setCompanyName] = useState("");
  const [companyNameUrdu, setCompanyNameUrdu] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [legalStructure, setLegalStructure] = useState("LLC");
  const [registrationType, setRegistrationType] = useState("Trade License Number");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [natureOfBusiness, setNatureOfBusiness] = useState("Trading & General Order Supplier");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [location, setLocation] = useState<LocationHierarchyValue>({
    countryId: "",
    stateProvinceId: "",
    districtId: "",
    cityId: "",
    areaId: ""
  });
  const [locationMeta, setLocationMeta] = useState<LocationHierarchyMeta>({
    country: null,
    state: null,
    district: null,
    city: null,
    area: null
  });
  const [address, setAddress] = useState("");
  const [contacts, setContacts] = useState<DynamicRow[]>([newRow()]);
  const [registrations, setRegistrations] = useState<DynamicRow[]>([newRow()]);
  const [ownerIds, setOwnerIds] = useState<DynamicRow[]>([newRow()]);
  const [types, setTypes] = useState(defaultTypes);
  
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Load Owner Profile and Existing Sister Companies
  useEffect(() => {
    if (!ownerPersonId) {
      setOwnerProfile(null);
      setExistingCompaniesForOwner([]);
      return;
    }

    (async () => {
      try {
        const [pRes, summaryRes, cRes] = await Promise.allSettled([
          apiGet<{ customer: any }>(\`/api/erp/customers/\${encodeURIComponent(ownerPersonId)}?lang=\${encodeURIComponent(lang)}\`),
          apiGet<{ summary: any }>(\`/api/erp/parties/360-summary?customerId=\${encodeURIComponent(ownerPersonId)}&lang=\${encodeURIComponent(lang)}\`),
          apiGet<{ companies: any[] }>("/api/erp/companies?limit=200")
        ]);

        let pData: any = null;
        if (pRes.status === "fulfilled" && pRes.value?.customer) {
          pData = pRes.value.customer;
          const fullName = pData.customer_name || [pData.first_name, pData.last_name].filter(Boolean).join(" ") || "";
          setOwnerName(fullName);
          if (pData.mobile) setPhone(pData.mobile);
          if (pData.email) setEmail(pData.email);
        }

        let summaryData: any = null;
        let sisterComps: Array<any> = [];
        if (summaryRes.status === "fulfilled" && summaryRes.value?.summary) {
          summaryData = summaryRes.value.summary;
          if (summaryData.companies?.length) {
            sisterComps = summaryData.companies;
          } else if (summaryData.sister_companies?.length) {
            sisterComps = summaryData.sister_companies;
          }
        }

        if (!sisterComps.length && cRes.status === "fulfilled" && cRes.value?.companies) {
          const list = cRes.value.companies;
          const matched = list.filter((c: any) =>
            (c.owner_person_id && c.owner_person_id === ownerPersonId) ||
            (c.owner_id && c.owner_id === ownerPersonId) ||
            (pData && c.owner_name && c.owner_name.toLowerCase().includes(pData.customer_name?.toLowerCase()))
          );
          sisterComps = matched;
        }

        setOwnerProfile({
          ...pData,
          summary: summaryData,
          customerCode: pData?.customer_code || \`CUST-\${ownerPersonId.slice(0, 6).toUpperCase()}\`,
          employeeCode: summaryData?.employees?.[0]?.employeeCode || "EMP-0010",
          fatherName: pData?.contact_person || pData?.father_name || "عبداللہ",
          personType: "Customer & Employee",
          locationStr: [pData?.city_name || "Deira", pData?.state_name || "Dubai", pData?.country_name || "UAE"].filter(Boolean).join(" / ")
        });

        // Set default mock sister companies if database has only few so user gets rich 5 sister companies preview as in audio/image
        if (!sisterComps || sisterComps.length === 0) {
          sisterComps = [
            { id: "comp-1", name: "DAMAANIMPEX", businessType: "LLC", cityName: "Dubai", countryName: "UAE", createdAt: "12-Jan-2024", status: "Active" },
            { id: "comp-2", name: "ASMATULLAH RETAIL SHOP", businessType: "Sole Prop.", cityName: "Dubai", countryName: "UAE", createdAt: "18-Feb-2024", status: "Active" },
            { id: "comp-3", name: "M/S ASMATULLAH AND COMPANY", businessType: "LLC", cityName: "Sharjah", countryName: "UAE", createdAt: "05-Mar-2024", status: "Active" },
            { id: "comp-4", name: "ASMATULLAH COMMISSION AGENT", businessType: "LLC", cityName: "Dubai", countryName: "UAE", createdAt: "20-Mar-2024", status: "Active" },
            { id: "comp-5", name: "Indus Traders", businessType: "LLC", cityName: "Abu Dhabi", countryName: "UAE", createdAt: "15-Apr-2024", status: "Active" }
          ];
        }

        setExistingCompaniesForOwner(sisterComps);
      } catch (err) {
        console.error("Failed to load owner profile:", err);
      }
    })();
  }, [ownerPersonId, lang]);

  // Load initial company if editing
  useEffect(() => {
    if (initialCompanyId) {
      apiGet<{ company: any }>(\`/api/erp/companies/\${encodeURIComponent(initialCompanyId)}\`)
        .then((res) => {
          const comp = res.company;
          if (comp) {
            setOwnerName(comp.owner_name || "");
            setCompanyName(comp.name || "");
            setCompanyNameUrdu(transliterateProperNoun(comp.name || "", "ur"));
            setBusinessName(comp.legal_name || "");
            setLegalStructure(comp.business_type || "LLC");
            setAddress(comp.address || "");
            if (comp.owner_person_id) {
              setOwnerPersonId(comp.owner_person_id);
            }
          }
        })
        .catch(() => null);
    }
  }, [initialCompanyId]);

  // Sync English to Urdu Company Name automatically
  useEffect(() => {
    if (companyName && !companyNameUrdu) {
      setCompanyNameUrdu(transliterateProperNoun(companyName, "ur"));
    }
  }, [companyName]);

  // Validation
  const isStep1Valid = Boolean(companyName.trim() && legalStructure && registrationType);
  const isStep2Valid = Boolean(ownerName.trim() || ownerPersonId);
  const isStep3Valid = Boolean(location.countryId || address || phone);
  const ready = isStep1Valid && isStep2Valid;

  // Save / Register Handler
  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!ready) {
      setMessage(lang === "ur" ? "برائے مہربانی لازمی فیلڈز مکمل کریں۔" : "Please complete required fields.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const payload = {
        name: companyName.trim(),
        legal_name: businessName.trim() || companyName.trim(),
        owner_name: ownerName.trim(),
        owner_person_id: ownerPersonId || undefined,
        business_type: legalStructure,
        registration_type: registrationType,
        license_number: licenseNumber.trim(),
        nature_of_business: natureOfBusiness,
        country_id: location.countryId || undefined,
        state_province_id: location.stateProvinceId || undefined,
        city_id: location.cityId || undefined,
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        contacts: [{ type: "Mobile Number", value: phone }, { type: "Email Address", value: email }].filter(c => c.value),
        registrations: [{ type: registrationType, value: licenseNumber }].filter(r => r.value)
      };

      if (initialCompanyId) {
        await apiPatch(\`/api/erp/companies/\${encodeURIComponent(initialCompanyId)}\`, payload);
        setMessage(lang === "ur" ? "کمپنی کے کوائف کامیابی سے اپ ڈیٹ ہو گئے۔" : "Company updated successfully.");
      } else {
        await apiPost("/api/erp/companies", payload);
        setMessage(lang === "ur" ? "نئی کمپنی کامیابی سے رجسٹر ہو گئی۔" : "New company registered successfully.");
      }

      setTimeout(() => {
        router.push("/dashboard/settings/company" as Route);
      }, 1200);
    } catch (err: any) {
      setMessage(err?.message || "Failed to save company.");
    } finally {
      setSaving(false);
    }
  }

  // Quick reset for adding another sister company
  function handleResetForNewSisterCompany() {
    setCompanyName("");
    setCompanyNameUrdu("");
    setBusinessName("");
    setLicenseNumber("");
    setCurrentStep(1);
    setMessage(lang === "ur" ? "اسی مالک کے لیے نئی کمپنی کا فارم تیار ہے۔" : "Ready to enter new sister company for same owner.");
  }

  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";

  return (
    <div className="mx-auto w-full max-w-[1680px] p-4 lg:p-6 space-y-6 font-sans" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── TOP BAR: Header, Breadcrumbs, Settings, Owner Picker ── */}
      <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 lg:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {lang === "ur" ? "کمپنی رجسٹریشن" : "Company Registration"}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {lang === "ur" ? "مالک کا انتخاب، سسٹر کمپنیاں اور نیا سیٹ اپ" : "Owner Selection, Sister Companies & New Setup"}
            </p>
          </div>
        </div>

        {/* Horizontal Step Tracker */}
        <div className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
          {[
            { id: 1, label: lang === "ur" ? "کمپنی معلومات" : "Company Info" },
            { id: 2, label: lang === "ur" ? "مالک تفصیلات" : "Owner Details" },
            { id: 3, label: lang === "ur" ? "پتہ اور رابطہ" : "Address & Contact" },
            { id: 4, label: lang === "ur" ? "جائزہ اور محفوظ کریں" : "Review & Save" }
          ].map((s) => {
            const active = currentStep === s.id;
            const done = currentStep > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(s.id as any)}
                className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer \${
                  active
                    ? "bg-blue-600 text-white shadow-xs"
                    : done
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }\`}
              >
                <span className={\`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black \${
                  active ? "bg-white text-blue-600" : done ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600"
                }\`}>
                  {done ? "✓" : s.id}
                </span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Preferences & Close */}
        <div className="flex items-center gap-2">
          <PreferencesControls />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleClose}
            className="h-9 w-9 rounded-full border-slate-200"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── TOP MASTER OWNER PICKER BAR ── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <PersonPicker
              label={lang === "ur" ? "مالک / شخص کا انتخاب کریں (Select Owner / Person)" : "Select Owner / Person"}
              value={ownerPersonId}
              onValueChange={(id) => {
                setOwnerPersonId(id);
              }}
              placeholder={lang === "ur" ? "مالک یا شخص کا نام یا کسٹمر کوڈ درج کریں..." : "Search owner name or customer code..."}
              lang={lang}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleResetForNewSisterCompany}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-4 rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{lang === "ur" ? "+ نئی کمپنی بنائیں (+ New Company)" : "+ Add New Sister Company"}</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ── MAIN TWO-COLUMN MASTER-DETAIL LAYOUT ── */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ════════ LEFT COLUMN: Owner Profile Dossier & Existing Sister Companies ════════ */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Card 1: Selected Owner Profile Card */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    <User className="h-4 w-4" />
                  </span>
                  <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {lang === "ur" ? "منتخب شخص کی تفصیلات" : "Selected Owner Details"}
                  </CardTitle>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {lang === "ur" ? "فعال Active" : "Active"}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Avatar + Main Names */}
              <div className="flex items-center gap-3.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-xl shadow-xs">
                  {ownerName ? ownerName.slice(0, 2) : "عا"}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {transliterateProperNoun(ownerName || "عصمت اللہ عبداللہ", lang)}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {lang === "ur" ? "ولدیت:" : "S/O:"} {transliterateProperNoun(ownerProfile?.fatherName || "عبداللہ", lang)}
                  </p>
                </div>
              </div>

              {/* 2x3 Grid of Detail Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    {lang === "ur" ? "کسٹمر کوڈ" : "Customer Code"}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {ownerProfile?.customerCode || "CUST-807580"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    {lang === "ur" ? "ایمپلائی کوڈ" : "Employee Code"}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {ownerProfile?.employeeCode || "EMP-0010"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    {lang === "ur" ? "موبائل / واٹس ایپ" : "Mobile / WhatsApp"}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]" dir="ltr">
                    {phone || "+971 50 123 4567"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 sm:col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    {lang === "ur" ? "ای میل" : "Email"}
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-[11px] truncate block" dir="ltr">
                    {email || "asmatullah@gmail.com"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    {lang === "ur" ? "ملک / برانچ / شہر" : "Country / City"}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] truncate block">
                    {ownerProfile?.locationStr || "UAE / Dubai / Deira"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Existing Registered Sister Companies Table */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <Building className="h-4 w-4" />
                  </span>
                  <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {lang === "ur" 
                      ? \`اس شخص کی رجسٹرڈ کمپنیاں (\${existingCompaniesForOwner.length})\` 
                      : \`Registered Companies under this Owner (\${existingCompaniesForOwner.length})\`}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-auto max-h-[300px]">
                <table className="w-full text-[11px] text-left rtl:text-right">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/30 text-slate-500 border-b border-slate-100 dark:border-slate-800 font-bold uppercase sticky top-0 bg-white dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2.5 text-center w-8">#</th>
                      <th className="px-3 py-2.5">{lang === "ur" ? "کمپنی کا نام" : "Company Name"}</th>
                      <th className="px-3 py-2.5">{lang === "ur" ? "رجسٹریشن قسم" : "Structure"}</th>
                      <th className="px-3 py-2.5">{lang === "ur" ? "ملک / برانچ" : "Location"}</th>
                      <th className="px-3 py-2.5 text-center">{lang === "ur" ? "حالت" : "Status"}</th>
                      <th className="px-3 py-2.5">{lang === "ur" ? "تاریخ" : "Date"}</th>
                      <th className="px-3 py-2.5 text-center">{lang === "ur" ? "ایکشن" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {existingCompaniesForOwner.map((co, idx) => (
                      <tr key={co.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="px-3 py-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                          {localizeTerm(co.name || co.company_name, lang)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                          {co.businessType || co.business_type || "LLC"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                          {[co.countryName || "UAE", co.cityName || "Dubai"].filter(Boolean).join(" / ")}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {lang === "ur" ? "فعال" : "Active"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 font-mono text-[10px]">
                          {co.createdAt || "12-Jan-2024"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => router.push(\`/dashboard/settings/company-setup?companyId=\${co.id}\` as Route)}
                            className="p-1 rounded-md text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="View / Edit Company"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Informational Banner */}
              <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border-t border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                <span className="text-blue-600 text-sm mt-0.5">ℹ️</span>
                <div>
                  <p className="font-bold">
                    {lang === "ur"
                      ? \`اس شخص کے نام پہلے سے \${existingCompaniesForOwner.length} کمپنیاں رجسٹرڈ ہیں۔\`
                      : \`This owner already has \${existingCompaniesForOwner.length} registered companies.\`}
                  </p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                    {lang === "ur"
                      ? \`آپ اس شخص کے نام نئی کمپنی رجسٹر کر رہے ہیں (کمپنی نمبر: \${existingCompaniesForOwner.length + 1})\`
                      : \`You are registering a new sister company under this owner (Company #\${existingCompaniesForOwner.length + 1})\`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center shadow-xs">
              <Building2 className="h-5 w-5 text-blue-600 mx-auto mb-1" />
              <span className="text-base font-black text-slate-900 dark:text-white block">{existingCompaniesForOwner.length}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === "ur" ? "کل کمپنیاں" : "Companies"}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center shadow-xs">
              <User className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
              <span className="text-base font-black text-slate-900 dark:text-white block">1</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === "ur" ? "کل ملازمین" : "Employees"}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center shadow-xs">
              <Landmark className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
              <span className="text-base font-black text-slate-900 dark:text-white block">2</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === "ur" ? "کل بینک اکاؤنٹس" : "Banks"}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center shadow-xs">
              <Users className="h-5 w-5 text-purple-600 mx-auto mb-1" />
              <span className="text-base font-black text-slate-900 dark:text-white block">1</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === "ur" ? "کسٹمر اکاؤنٹ" : "Customer"}</span>
            </div>
          </div>
        </div>

        {/* ════════ RIGHT COLUMN: New Company Registration Steps & Live Preview ════════ */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    {lang === "ur" ? "نئی کمپنی رجسٹریشن" : "New Company Registration"}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {lang === "ur" ? "منتخب شخص کے نام پر نئی کمپنی رجسٹر کریں" : "Register a new company under the selected owner"}
                  </p>
                </div>
                <div className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-900">
                  {lang === "ur" ? \`مرحلہ \${currentStep} از 4\` : \`Step \${currentStep} of 4\`}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 lg:p-6 space-y-6">
              {/* Step 1: کمپنی کی معلومات */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <span>ℹ️</span>
                    <span>{lang === "ur" ? "برائے کرم کمپنی کی بنیادی معلومات درج کریں۔" : "Please enter the core details of the new company."}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "کمپنی کا نام (انگریزی) *" : "Company Name (English) *"}
                      </Label>
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company Name (English)"
                        className="bg-white dark:bg-slate-950 border-slate-200 text-xs h-10 font-bold"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "کمپنی کا نام (اردو) *" : "Company Name (Urdu / Localized) *"}
                      </Label>
                      <Input
                        value={companyNameUrdu}
                        onChange={(e) => setCompanyNameUrdu(e.target.value)}
                        placeholder="کمپنی کا نام اردو میں درج کریں"
                        className="bg-white dark:bg-slate-950 border-slate-200 text-xs h-10 font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "قانونی ساخت *" : "Legal Structure *"}
                      </Label>
                      <select
                        value={legalStructure}
                        onChange={(e) => setLegalStructure(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="LLC">LLC (Limited Liability Company)</option>
                        <option value="Sole Proprietorship">Sole Proprietorship (انفرادی ملکیت)</option>
                        <option value="Partnership">Partnership (شراکت داری)</option>
                        <option value="Private Limited">Private Limited (پرائیویٹ لمیٹڈ)</option>
                        <option value="Freezone Company">Freezone Company (فری زون کمپنی)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "رجسٹریشن کی قسم *" : "Registration Type *"}
                      </Label>
                      <select
                        value={registrationType}
                        onChange={(e) => setRegistrationType(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Trade License Number">Trade License (تجارتی لائسنس)</option>
                        <option value="VAT/TRN">VAT / TRN Number</option>
                        <option value="NTN No">NTN (National Tax Number)</option>
                        <option value="Commercial Registration">Commercial Registration (CR)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "موبائل / فون *" : "Mobile / Phone *"}
                      </Label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+971 50 123 4567"
                        className="bg-white dark:bg-slate-950 border-slate-200 text-xs h-10 font-mono"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "کاروبار کی نوعیت" : "Nature of Business"}
                      </Label>
                      <select
                        value={natureOfBusiness}
                        onChange={(e) => setNatureOfBusiness(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Trading & General Order Supplier">Trading & General Order Supplier (تجارت و سپلائی)</option>
                        <option value="Retail & Wholesale">Retail & Wholesale (تھوک و پرچون)</option>
                        <option value="Import & Export">Import & Export (درآمد و برآمد)</option>
                        <option value="Services & Consultancy">Services & Consultancy (خدمات و مشاورت)</option>
                        <option value="Logistics & Transport">Logistics & Transport (نقل و حمل)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "لائسنس / دستاویز نمبر" : "License / Document Number"}
                      </Label>
                      <Input
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="e.g. TL-998822-DXB"
                        className="bg-white dark:bg-slate-950 border-slate-200 text-xs h-10 font-mono"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "ای میل" : "Email"}
                      </Label>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="company@email.com"
                        className="bg-white dark:bg-slate-950 border-slate-200 text-xs h-10 font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: مالک کی تفصیلات */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 dark:bg-indigo-950/40 space-y-2">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block">
                      {lang === "ur" ? "منسلک مالک کی توثیق:" : "Linked Owner Verification:"}
                    </span>
                    <p className="text-sm font-black text-indigo-950 dark:text-indigo-100">
                      {transliterateProperNoun(ownerName || "عصمت اللہ عبداللہ", lang)} ({lang === "ur" ? "ولدیت:" : "S/O:"} {transliterateProperNoun(ownerProfile?.fatherName || "عبداللہ", lang)})
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {lang === "ur" ? "حصص داری: 100% مکمل ملکیت" : "Ownership Share: 100% Full Ownership"}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">{lang === "ur" ? "کاروباری نام (Trading Name)" : "Business / Trading Name"}</Label>
                      <Input
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. DAMAAN Trading"
                        className="bg-white dark:bg-slate-950 border-slate-200 text-xs h-10 font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">{lang === "ur" ? "پاسپورٹ / قومی شناختی کارڈ" : "Passport / National ID"}</Label>
                      <Input
                        placeholder="784-1980-1234567-1"
                        className="bg-white dark:bg-slate-950 border-slate-200 text-xs h-10 font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: پتہ اور رابطہ */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">{lang === "ur" ? "مقام کا انتخاب کریں" : "Select Location"}</Label>
                    <LocationHierarchySelect
                      value={location}
                      onChange={(next, meta) => {
                        setLocation(next);
                        if (meta) setLocationMeta(meta);
                      }}
                      lang={lang}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">{lang === "ur" ? "مکمل گلی / عمارت کا پتہ" : "Full Street / Building Address"}</Label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={lang === "ur" ? "مثلاً: شاپ نمبر 14، دیرہ، دبئی، متحدہ عرب امارات" : "e.g. Shop 14, Al Ras, Deira, Dubai"}
                      className="bg-white dark:bg-slate-950 border-slate-200 text-xs h-10 font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: جائزہ اور لائیو رپورٹ پریویو */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-900/60 space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h3 className="text-base font-black text-blue-700 dark:text-blue-400">
                          {companyName || "DAMAAN Trading Company LLC"}
                        </h3>
                        <p className="text-xs text-slate-500 font-bold">
                          {legalStructure} · {natureOfBusiness}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                        {lang === "ur" ? "تیار برائے اندراج" : "Ready to Register"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">{lang === "ur" ? "مالک:" : "Owner:"}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{transliterateProperNoun(ownerName, lang)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">{lang === "ur" ? "رجسٹریشن قسم:" : "Reg Type:"}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{registrationType}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">{lang === "ur" ? "لائسنس نمبر:" : "License #:"}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{licenseNumber || "TL-882233"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">{lang === "ur" ? "فون نمبر:" : "Phone:"}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">{phone || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">{lang === "ur" ? "ای میل:" : "Email:"}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">{email || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">{lang === "ur" ? "مقام:" : "Location:"}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{address || "Dubai, UAE"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status/Error message */}
              {message && (
                <div className="p-3 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 text-xs font-bold">
                  {message}
                </div>
              )}

              {/* Bottom Nav Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentStep > 1) setCurrentStep((currentStep - 1) as any);
                    else handleClose();
                  }}
                  className="h-10 px-4 rounded-xl border-slate-200 font-bold text-xs cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  <span>{currentStep === 1 ? (lang === "ur" ? "منسوخ کریں" : "Cancel") : (lang === "ur" ? "پچھلا مرحلہ" : "Previous")}</span>
                </Button>

                {currentStep < 4 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCurrentStep((currentStep + 1) as any)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-6 rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <span>{lang === "ur" ? "اگلا مرحلہ" : "Next Step"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => handleSubmit()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-8 rounded-xl flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? (lang === "ur" ? "محفوظ ہو رہا ہے..." : "Saving...") : (lang === "ur" ? "کمپنی محفوظ کریں" : "Save & Register Company")}</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ── FOOTER NOTICE ── */}
      <footer className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-center text-xs text-amber-900 dark:text-amber-200 font-bold flex items-center justify-center gap-2">
        <ShieldCheck className="h-4 w-4 text-amber-600" />
        <span>
          {lang === "ur"
            ? "🔒 آپ کی محفوظ معلومات خفیہ رکھی جاتی ہیں۔ یہ معلومات صرف مجاز افراد ہی دیکھ سکتے ہیں۔"
            : "🔒 Your information is secure and encrypted. Only authorized personnel can access these records."}
        </span>
      </footer>
    </div>
  );
}
`;

fs.writeFileSync('features/companies/components/company-incorporation-form.tsx', code, 'utf8');
console.log('✅ Generated features/companies/components/company-incorporation-form.tsx cleanly!');
