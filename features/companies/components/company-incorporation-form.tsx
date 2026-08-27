"use client";

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
  Globe,
  Check,
  Sparkles,
  Printer,
  Compass
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPost, apiGet, apiPatch } from "@/lib/api/client";
import { PersonPicker } from "@/features/hr-payroll/components/person-picker";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";
import { PreferencesControls } from "@/components/layout/preferences-controls";
import { openCompany360Report } from "@/lib/reports/open-company-360-report-window";

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
  countryBranchId?: string;
  cityBranchId?: string;
  isBranchOperative?: boolean;
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
};

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
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";

  function handleClose() {
    if (onClose) {
      onClose();
      return;
    }
    router.push("/dashboard/settings/company" as Route);
  }

  // --- Registration Modes ---
  // Mode A: "owner_portfolio" (Person / Owner & Sister Companies)
  // Mode B: "branch_operative" (Country / Branch Operative Company)
  const [registrationMode, setRegistrationMode] = useState<"owner_portfolio" | "branch_operative">("owner_portfolio");

  // --- Mode A: Owner Portfolio State ---
  const [ownerPersonId, setOwnerPersonId] = useState("");
  const [managerPersonId, setManagerPersonId] = useState("");
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [managerProfile, setManagerProfile] = useState<any>(null);
  const [existingCompaniesForOwner, setExistingCompaniesForOwner] = useState<Array<any>>([]);
  const [ownerBanks, setOwnerBanks] = useState<Array<any>>([]);
  const [ownerName, setOwnerName] = useState("");

  // --- Mode B: Branch Operative State ---
  const [countriesList, setCountriesList] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [cityBranchesList, setCityBranchesList] = useState<any[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedCountryBranchId, setSelectedCountryBranchId] = useState("");
  const [selectedCityBranchId, setSelectedCityBranchId] = useState("");
  const [branchCompanies, setBranchCompanies] = useState<Array<any>>([]);

  // --- Core Company Fields ---
  const [companyName, setCompanyName] = useState("");
  const [companyNameUrdu, setCompanyNameUrdu] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [legalStructure, setLegalStructure] = useState("LLC");
  const [registrationType, setRegistrationType] = useState("Trade License Number");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [natureOfBusiness, setNatureOfBusiness] = useState("Trading & General Order Supplier");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Load Countries
  useEffect(() => {
    async function loadCountries() {
      try {
        const res: any = await apiGet("/api/erp/locations/countries");
        const list = res?.countries || res?.data?.countries || (Array.isArray(res) ? res : []);
        setCountriesList(list);
        if (list.length && !selectedCountryId) {
          setSelectedCountryId(list[0].id);
        }
      } catch {}
    }
    loadCountries();
  }, []);

  // Load Main Branches when Country changes
  useEffect(() => {
    if (!selectedCountryId) {
      setBranchesList([]);
      setSelectedCountryBranchId("");
      return;
    }
    async function loadBranches() {
      try {
        const res: any = await apiGet(`/api/erp/locations/branches/main?countryId=${encodeURIComponent(selectedCountryId)}`);
        const branches = res?.branches || res?.data?.branches || (Array.isArray(res) ? res : []);
        setBranchesList(branches);
        if (branches.length) {
          setSelectedCountryBranchId(branches[0].id);
        } else {
          setSelectedCountryBranchId("");
        }
      } catch {}
    }
    loadBranches();
  }, [selectedCountryId]);

  // Load City Branches when Country or Main Branch changes
  useEffect(() => {
    if (!selectedCountryId) {
      setCityBranchesList([]);
      setSelectedCityBranchId("");
      return;
    }
    async function loadCityBranches() {
      try {
        let url = `/api/erp/locations/branches/city?countryId=${encodeURIComponent(selectedCountryId)}`;
        if (selectedCountryBranchId) {
          url += `&countryBranchId=${encodeURIComponent(selectedCountryBranchId)}`;
        }
        const res: any = await apiGet(url);
        const cityBranches = res?.cityBranches || res?.branches || res?.data?.cityBranches || res?.data?.branches || (Array.isArray(res) ? res : []);
        setCityBranchesList(cityBranches);
        if (cityBranches.length && !selectedCityBranchId) {
          setSelectedCityBranchId(cityBranches[0].id);
        }
      } catch {}
    }
    loadCityBranches();
  }, [selectedCountryId, selectedCountryBranchId]);

  // Load Branch Operative Companies
  useEffect(() => {
    if (registrationMode !== "branch_operative" || (!selectedCountryId && !selectedCountryBranchId)) return;
    async function loadBranchComps() {
      try {
        const qp = new URLSearchParams();
        if (selectedCountryId) qp.set("countryId", selectedCountryId);
        if (selectedCountryBranchId) qp.set("countryBranchId", selectedCountryBranchId);
        const res: any = await apiGet(`/api/erp/companies?${qp.toString()}`);
        const comps = res?.companies || res?.data?.companies || (Array.isArray(res) ? res : []);
        setBranchCompanies(comps);
      } catch {}
    }
    loadBranchComps();
  }, [registrationMode, selectedCountryId, selectedCountryBranchId]);

  // Load Manager Profile Details
  useEffect(() => {
    if (!managerPersonId) {
      setManagerProfile(null);
      return;
    }
    (async () => {
      try {
        const [pRes, summaryRes]: any[] = await Promise.allSettled([
          apiGet(`/api/erp/customers/${encodeURIComponent(managerPersonId)}?lang=${encodeURIComponent(lang)}`),
          apiGet(`/api/erp/parties/360-summary?customerId=${encodeURIComponent(managerPersonId)}&lang=${encodeURIComponent(lang)}`)
        ]);

        let pData: any = null;
        if (pRes.status === "fulfilled" && pRes.value?.customer) {
          pData = pRes.value.customer;
        }

        let summaryData: any = null;
        if (summaryRes.status === "fulfilled" && summaryRes.value?.summary) {
          summaryData = summaryRes.value.summary;
        }

        const mName = pData?.customer_name || [pData?.first_name, pData?.last_name].filter(Boolean).join(" ") || summaryData?.customerName || "";

        setManagerProfile({
          ...pData,
          name: mName,
          customerCode: pData?.customer_code || pData?.person_code || `CUST-${managerPersonId.slice(0, 6).toUpperCase()}`,
          employeeCode: summaryData?.employees?.[0]?.employeeCode || pData?.employee_code || "MGR-001",
          fatherName: pData?.father_name || pData?.contact_person || summaryData?.fatherName || "—",
          mobile: pData?.mobile || summaryData?.mobile || summaryData?.phone || "—",
          email: pData?.email || summaryData?.email || "—",
          locationStr: [pData?.city_name || summaryData?.cityName, pData?.state_name || summaryData?.stateName, pData?.country_name || summaryData?.countryName].filter(Boolean).join(" / ") || "—"
        });
      } catch (e) {
        console.error("Failed to load manager profile", e);
      }
    })();
  }, [managerPersonId, lang]);

  // Load Owner Profile, Sister Companies, and Linked Banks
  useEffect(() => {
    if (!ownerPersonId) {
      setOwnerProfile(null);
      setExistingCompaniesForOwner([]);
      setOwnerBanks([]);
      return;
    }

    (async () => {
      try {
        const [pRes, summaryRes, cRes] = await Promise.allSettled([
          apiGet<{ customer: any }>(`/api/erp/customers/${encodeURIComponent(ownerPersonId)}?lang=${encodeURIComponent(lang)}`),
          apiGet<{ summary: any }>(`/api/erp/parties/360-summary?customerId=${encodeURIComponent(ownerPersonId)}&lang=${encodeURIComponent(lang)}`),
          apiGet<{ companies: any[] }>(`/api/erp/companies?ownerPersonId=${encodeURIComponent(ownerPersonId)}&limit=200`)
        ]);

        let pData: any = null;
        if (pRes.status === "fulfilled" && pRes.value?.customer) {
          pData = pRes.value.customer;
          const fullName = pData.customer_name || [pData.first_name, pData.last_name].filter(Boolean).join(" ") || "";
          setOwnerName(fullName);
          if (pData.mobile) setPhone(pData.mobile);
          if (pData.email) setEmail(pData.email);
        }

        let sisterComps: Array<any> = [];
        let banks: Array<any> = [];
        let summaryData: any = null;

        if (summaryRes.status === "fulfilled" && summaryRes.value?.summary) {
          summaryData = summaryRes.value.summary;
          if (summaryData.companies?.length) sisterComps = [...summaryData.companies];
          if (summaryData.banks?.length) banks = summaryData.banks;
        }

        if (cRes.status === "fulfilled") {
          const comps = (cRes.value as any)?.companies || (cRes.value as any)?.data?.companies || [];
          if (comps.length > 0) {
            const existingIds = new Set(sisterComps.map((s) => s.id));
            for (const c of comps) {
              if (!existingIds.has(c.id)) {
                sisterComps.push(c);
                existingIds.add(c.id);
              }
            }
          }
        }

        if (sisterComps.length === 0 && pData?.customer_name) {
          try {
            const byNameRes: any = await apiGet(`/api/erp/companies?q=${encodeURIComponent(pData.customer_name)}&limit=50`);
            const byNameComps = byNameRes?.companies || byNameRes?.data?.companies || [];
            if (byNameComps.length > 0) {
              sisterComps = byNameComps;
            }
          } catch {}
        }

        setOwnerProfile({
          ...pData,
          summary: summaryData,
          customerCode: pData?.customer_code || pData?.person_code || `CUST-${ownerPersonId.slice(0, 6).toUpperCase()}`,
          employeeCode: summaryData?.employees?.[0]?.employeeCode || pData?.employee_code || "EMP-0010",
          fatherName: pData?.father_name || pData?.contact_person || summaryData?.fatherName || "عبداللہ",
          locationStr: [pData?.city_name || "Deira", pData?.state_name || "Dubai", pData?.country_name || "UAE"].filter(Boolean).join(" / ")
        });

        setExistingCompaniesForOwner(sisterComps);
        setOwnerBanks(banks);
      } catch (err) {
        console.error("Failed to load owner profile:", err);
      }
    })();
  }, [ownerPersonId, lang]);

  // Load initial company if editing
  useEffect(() => {
    if (initialCompanyId) {
      apiGet<{ company: any }>(`/api/erp/companies/${encodeURIComponent(initialCompanyId)}`)
        .then((res) => {
          const comp = res.company;
          if (comp) {
            setOwnerName(comp.owner_name || "");
            setCompanyName(comp.name || "");
            setCompanyNameUrdu(transliterateProperNoun(comp.name || "", "ur"));
            setBusinessName(comp.legal_name || "");
            setLegalStructure(comp.business_type || "LLC");
            setAddress(comp.address || "");
            if (comp.country_id) setSelectedCountryId(comp.country_id);
            if (comp.country_branch_id) setSelectedCountryBranchId(comp.country_branch_id);
            if (comp.city_branch_id) setSelectedCityBranchId(comp.city_branch_id);
            if (comp.is_branch_operative) setRegistrationMode("branch_operative");
            if (comp.owner_person_id) setOwnerPersonId(comp.owner_person_id);
            if (comp.manager_person_id) setManagerPersonId(comp.manager_person_id);
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
  const isStep2Valid = Boolean(ownerName.trim() || ownerPersonId || selectedCountryBranchId);
  const ready = isStep1Valid && isStep2Valid;

  // Save Handler
  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!ready) {
      setMessage(lang === "ur" ? "برائے مہربانی لازمی فیلڈز مکمل کریں۔" : "Please complete required fields.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const isOperative = registrationMode === "branch_operative";
      const payload = {
        name: companyName.trim(),
        legalName: businessName.trim() || companyName.trim(),
        ownerName: ownerName.trim() || (isOperative ? "Branch Corporate Entity" : "Company Owner"),
        ownerPersonId: ownerPersonId || undefined,
        managerPersonId: managerPersonId || undefined,
        businessType: legalStructure,
        countryId: selectedCountryId || undefined,
        countryBranchId: selectedCountryBranchId || undefined,
        cityBranchId: selectedCityBranchId || undefined,
        isBranchOperative: isOperative,
        baseCurrency: baseCurrency || "USD",
        address: address.trim(),
        contacts: [{ type: "Mobile Number", value: phone }, { type: "Email Address", value: email }].filter(c => c.value),
        registrations: [{ type: registrationType, value: licenseNumber }].filter(r => r.value)
      };

      let savedCompanyId = initialCompanyId;
      if (initialCompanyId) {
        await apiPatch(`/api/erp/companies/${encodeURIComponent(initialCompanyId)}`, payload);
        setMessage(lang === "ur" ? "کمپنی کے کوائف کامیابی سے اپ ڈیٹ ہو گئے۔" : "Company updated successfully.");
      } else {
        const res = await apiPost<{ companyId: string }>("/api/erp/companies", payload);
        savedCompanyId = res.companyId ?? (res as any).data?.companyId ?? (res as any)?.id;
        setMessage(lang === "ur" ? "نئی کمپنی کامیابی سے رجسٹر ہو گئی۔" : "New company registered successfully.");
      }

      if (mode === "embedded") {
        onSave?.({
          id: savedCompanyId,
          name: payload.name,
          legalName: payload.legalName,
          baseCurrency: payload.baseCurrency
        } as any);
        return;
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

  // Reset for adding another sister company
  function handleResetForNewSisterCompany() {
    setCompanyName("");
    setCompanyNameUrdu("");
    setBusinessName("");
    setLicenseNumber("");
    setCurrentStep(1);
    setMessage(lang === "ur" ? "اسی مالک کے لیے نئی سسٹر کمپنی کا فارم تیار ہے۔" : "Ready to enter new sister company for same owner.");
  }

  const selectedCountry = countriesList.find((c) => c.id === selectedCountryId);
  const selectedCountryBranch = branchesList.find((b) => b.id === selectedCountryBranchId);
  const selectedCityBranch = cityBranchesList.find((b) => b.id === selectedCityBranchId);

  return (
    <div className="mx-auto w-full max-w-[1680px] p-4 lg:p-6 space-y-6 font-sans" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* ── TOP BAR: Header, Mode Toggle, Step Tracker, Close ── */}
      <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 lg:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {lang === "ur" ? "کمپنی رجسٹریشن و کارپوریٹ سیٹ اپ" : "Company Registration & Corporate Setup"}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {lang === "ur" 
                ? "سسٹر کمپنیوں کا پورٹ فولیو اور برانچ آپریشنل کمپنی کا قیام" 
                : "Owner Sister Companies Portfolio & Branch Operative Entities"}
            </p>
          </div>
        </div>

        {/* Dual Mode Switcher Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black">
          <button
            type="button"
            onClick={() => setRegistrationMode("owner_portfolio")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${
              registrationMode === "owner_portfolio"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <User className="h-4 w-4" />
            <span>{lang === "ur" ? "شخص / مالک سسٹر کمپنیاں (Owner Portfolio)" : "Owner / Sister Companies"}</span>
          </button>

          <button
            type="button"
            onClick={() => setRegistrationMode("branch_operative")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${
              registrationMode === "branch_operative"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Compass className="h-4 w-4" />
            <span>{lang === "ur" ? "برانچ آپریشنل کمپنی (Branch Operative)" : "Branch Operative Company"}</span>
          </button>
        </div>

        {/* Horizontal Step Tracker */}
        <div className="hidden xl:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
          {[
            { id: 1, label: lang === "ur" ? "کمپنی معلومات" : "Company Info" },
            { id: 2, label: lang === "ur" ? "مالک / برانچ" : "Owner / Branch" },
            { id: 3, label: lang === "ur" ? "پتہ و رابطے" : "Address & Contact" },
            { id: 4, label: lang === "ur" ? "جائزہ و محفوظ" : "Review & Save" }
          ].map((s) => {
            const active = currentStep === s.id;
            const done = currentStep > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(s.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  active
                    ? "bg-blue-600 text-white shadow-xs"
                    : done
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${
                  active ? "bg-white text-blue-600" : done ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600"
                }`}>
                  {done ? "✓" : s.id}
                </span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls */}
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

      {/* ── TOP SELECTOR BAR: Dynamic based on Mode ── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        {registrationMode === "owner_portfolio" ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PersonPicker
                label={lang === "ur" ? "مالک / شخص کا انتخاب کریں (Select Owner / Person) *" : "Select Owner / Person *"}
                value={ownerPersonId}
                onValueChange={(id) => setOwnerPersonId(id)}
                placeholder={lang === "ur" ? "مالک کا نام یا کسٹمر کوڈ درج کریں..." : "Search owner name or customer code..."}
                lang={lang}
              />
              <PersonPicker
                label={lang === "ur" ? "کمپنی منیجر (Company Manager)" : "Company Manager"}
                value={managerPersonId}
                onValueChange={(id) => setManagerPersonId(id)}
                placeholder={lang === "ur" ? "منیجر کا نام تلاش کریں..." : "Search manager name..."}
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
                <span>{lang === "ur" ? "+ نئی سسٹر کمپنی بنائیں (+ New Sister Company)" : "+ Add New Sister Company"}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {lang === "ur" ? "ملک کا انتخاب کریں (Country) *" : "Country *"}
                </Label>
                <select
                  value={selectedCountryId}
                  onChange={(e) => setSelectedCountryId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="">{lang === "ur" ? "ملک منتخب کریں..." : "Select Country..."}</option>
                  {countriesList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {lang === "ur" ? "مین برانچ (Main Branch) *" : "Main Branch *"}
                </Label>
                <select
                  value={selectedCountryBranchId}
                  onChange={(e) => setSelectedCountryBranchId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="">{lang === "ur" ? "مین برانچ منتخب کریں..." : "Select Main Branch..."}</option>
                  {branchesList.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} {b.code ? `(${b.code})` : ""}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {lang === "ur" ? "سٹی برانچ (City Branch)" : "City Branch"}
                </Label>
                <select
                  value={selectedCityBranchId}
                  onChange={(e) => setSelectedCityBranchId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="">{lang === "ur" ? "تمام سٹی برانچز..." : "All City Branches..."}</option>
                  {cityBranchesList.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} {b.code ? `(${b.code})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {lang === "ur" ? "برانچ آپریشنل کمپنی موڈ فعال" : "Branch Operative Mode Active"}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── MAIN TWO-COLUMN MASTER-DETAIL LAYOUT ── */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ════════ LEFT COLUMN: Live Profile & Existing Companies ════════ */}
        <div className="lg:col-span-5 space-y-5">
          
          {registrationMode === "owner_portfolio" ? (
            <>
              {/* Card 1: Owner Profile Dossier */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <User className="h-4 w-4" />
                      </span>
                      <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "منتخب مالک / شخص کی تفصیلات" : "Selected Owner Details"}
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
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-lg shadow-xs">
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
                        {phone || ownerProfile?.mobile || "+971 50 123 4567"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                        {lang === "ur" ? "ای میل" : "Email"}
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-[11px] truncate block" dir="ltr">
                        {email || ownerProfile?.email || "owner@company.dgt.llc"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                        {lang === "ur" ? "ملک / شہر" : "Country / City"}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] truncate block">
                        {ownerProfile?.locationStr || "UAE / Dubai / Deira"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 1B: Manager Profile Details (when manager selected) */}
              {managerProfile && (
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border-l-4 border-l-indigo-600">
                  <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/30 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          <Users className="h-3.5 w-3.5" />
                        </span>
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          {lang === "ur" ? "کمپنی منیجر کے کوائف (Manager Details)" : "Selected Company Manager Details"}
                        </CardTitle>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        {lang === "ur" ? "مجاز ایڈمن" : "Authorized"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-sm">
                        {managerProfile?.name ? managerProfile.name.slice(0, 2) : "MG"}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {transliterateProperNoun(managerProfile?.name || "Company Manager", lang)}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {lang === "ur" ? "ولدیت:" : "S/O:"} {transliterateProperNoun(managerProfile?.fatherName || "—", lang)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] font-bold text-slate-400 block">{lang === "ur" ? "منیجر کوڈ" : "Manager Code"}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{managerProfile?.customerCode || managerProfile?.employeeCode || "MGR-001"}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] font-bold text-slate-400 block">{lang === "ur" ? "رابطہ نمبر" : "Mobile"}</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">{managerProfile?.mobile || "—"}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 col-span-2">
                        <span className="text-[9px] font-bold text-slate-400 block">{lang === "ur" ? "ای میل" : "Email"}</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 truncate block" dir="ltr">{managerProfile?.email || "manager@company.dgt.llc"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Card 2: Registered Sister Companies Table */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        <Building className="h-4 w-4" />
                      </span>
                      <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {lang === "ur" 
                          ? `اس شخص کی رجسٹرڈ سسٹر کمپنیاں (${existingCompaniesForOwner.length})` 
                          : `Sister Companies under this Owner (${existingCompaniesForOwner.length})`}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[260px]">
                    <table className="w-full text-[11px] text-left rtl:text-right">
                      <thead className="bg-slate-50/60 dark:bg-slate-800/30 text-slate-500 border-b border-slate-100 dark:border-slate-800 font-bold uppercase sticky top-0 bg-white dark:bg-slate-900">
                        <tr>
                          <th className="px-3 py-2.5 text-center w-8">#</th>
                          <th className="px-3 py-2.5">{lang === "ur" ? "کمپنی کا نام" : "Company Name"}</th>
                          <th className="px-3 py-2.5">{lang === "ur" ? "ساخت" : "Structure"}</th>
                          <th className="px-3 py-2.5">{lang === "ur" ? "مقام" : "Location"}</th>
                          <th className="px-3 py-2.5 text-center">{lang === "ur" ? "حالت" : "Status"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {existingCompaniesForOwner.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                              {lang === "ur" ? "کوئی سسٹر کمپنی رجسٹر نہیں ہے۔ نئی کمپنی درج کریں۔" : "No sister companies registered yet."}
                            </td>
                          </tr>
                        ) : (
                          existingCompaniesForOwner.map((co, idx) => (
                            <tr key={co.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                              <td className="px-3 py-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                                {localizeTerm(co.name || co.company_name, lang)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                                {co.businessType || co.business_type || "LLC"}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                                {[co.countryName || co.country_name || "UAE", co.cityName || co.city_name || "Dubai"].filter(Boolean).join(" / ")}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {lang === "ur" ? "فعال" : "Active"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Informational Banner */}
                  <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border-t border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                    <span className="text-blue-600 text-sm mt-0.5">ℹ️</span>
                    <div>
                      <p className="font-bold">
                        {lang === "ur"
                          ? `اس شخص کے نام پہلے سے ${existingCompaniesForOwner.length} کمپنیاں رجسٹرڈ ہیں۔`
                          : `This owner already has ${existingCompaniesForOwner.length} registered companies.`}
                      </p>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                        {lang === "ur"
                          ? `آپ اس شخص کے نام نئی کمپنی رجسٹر کر رہے ہیں (کمپنی نمبر: ${existingCompaniesForOwner.length + 1})`
                          : `You are registering a new sister company under this owner (Company #${existingCompaniesForOwner.length + 1})`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Linked Banks Summary */}
              {ownerBanks.length > 0 && (
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-emerald-600" />
                      <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? `منسلک بینک اکاؤنٹس (${ownerBanks.length})` : `Linked Bank Accounts (${ownerBanks.length})`}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {ownerBanks.map((b: any, idx: number) => (
                      <div key={b.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{b.bankName}</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{b.accountNumber || b.accountTitle}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            /* Mode B: Branch Operative Left Dossier */
            <>
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <Compass className="h-4 w-4" />
                      </span>
                      <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "منتخب برانچ کے کوائف" : "Selected Branch Details"}
                      </CardTitle>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {lang === "ur" ? "آپریشنل برانچ" : "Operative Branch"}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-3.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-xs">
                      {selectedCountryBranch?.name?.slice(0, 2) || "BR"}
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {selectedCountryBranch?.name || "Select Branch"}
                      </h2>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        {selectedCountry?.name || "Country"} · {selectedCityBranch?.name || "City Branch"}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200">
                    <p className="font-bold mb-1">
                      {lang === "ur" ? "✨ پورے ERP میں اس برانچ کا آپریشنل کردار:" : "✨ ERP-Wide Operative Role:"}
                    </p>
                    <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
                      {lang === "ur" 
                        ? "یہ کمپنی اس برانچ کے تمام پرچیز آرڈرز، سیلز واؤچرز، روزنامچہ انٹریز اور لیٹر ہیڈ پرنٹنگ کے لیے باقاعدہ رجسٹرڈ آپریشنل ادارہ بنے گی۔"
                        : "This company will serve as the official operational entity for purchase orders, sales invoices, roznamcha entries, and voucher prints in this branch."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Existing Operative Companies in this Branch */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-emerald-600" />
                      <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? `اس برانچ کی موجودہ کمپنیاں (${branchCompanies.length})` : `Branch Operative Companies (${branchCompanies.length})`}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[260px]">
                    <table className="w-full text-[11px] text-left rtl:text-right">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">{lang === "ur" ? "کمپنی کا نام" : "Company"}</th>
                          <th className="px-3 py-2">{lang === "ur" ? "ساخت" : "Structure"}</th>
                          <th className="px-3 py-2 text-center">{lang === "ur" ? "حالت" : "Status"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {branchCompanies.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-medium">
                              {lang === "ur" ? "اس برانچ میں ابھی کوئی آپریشنل کمپنی نہیں ہے۔" : "No operative companies registered yet."}
                            </td>
                          </tr>
                        ) : (
                          branchCompanies.map((c, i) => (
                            <tr key={c.id || i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-400 font-bold">{i + 1}</td>
                              <td className="px-3 py-2 font-bold text-slate-800">{c.name}</td>
                              <td className="px-3 py-2 font-mono text-[10px]">{c.business_type || "LLC"}</td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                  {lang === "ur" ? "فعال" : "Active"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* 4 Quick Stat KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center shadow-xs">
              <Building2 className="h-5 w-5 text-blue-600 mx-auto mb-1" />
              <span className="text-base font-black text-slate-900 dark:text-white block">
                {registrationMode === "owner_portfolio" ? existingCompaniesForOwner.length : branchCompanies.length}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === "ur" ? "کل کمپنیاں" : "Companies"}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center shadow-xs">
              <Landmark className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
              <span className="text-base font-black text-slate-900 dark:text-white block">{ownerBanks.length || 1}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === "ur" ? "بینک اکاؤنٹس" : "Banks"}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center shadow-xs">
              <User className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
              <span className="text-base font-black text-slate-900 dark:text-white block">1</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === "ur" ? "کل ملازمین" : "Employees"}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center shadow-xs">
              <ShieldCheck className="h-5 w-5 text-purple-600 mx-auto mb-1" />
              <span className="text-base font-black text-slate-900 dark:text-white block">4-Lvl</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === "ur" ? "سیریل سسٹم" : "Serials"}</span>
            </div>
          </div>
        </div>

        {/* ════════ RIGHT COLUMN: 4-Step Registration Form ════════ */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    {registrationMode === "owner_portfolio" 
                      ? (lang === "ur" ? "نئی سسٹر کمپنی رجسٹریشن" : "New Sister Company Registration")
                      : (lang === "ur" ? "نئی برانچ آپریشنل کمپنی رجسٹریشن" : "New Branch Operative Company Registration")}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {registrationMode === "owner_portfolio"
                      ? (lang === "ur" ? "منتخب مالک کے نام پر نئی سسٹر کمپنی رجسٹر کریں" : "Register a new company under the selected owner")
                      : (lang === "ur" ? "منتخب برانچ کے لیے آپریشنل کمپنی قائم کریں" : "Establish an official operative company for this branch")}
                  </p>
                </div>
                <div className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-900">
                  {lang === "ur" ? `مرحلہ ${currentStep} از 4` : `Step ${currentStep} of 4`}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 lg:p-6 space-y-6">
              {/* Step 1: کمپنی کی بنیادی معلومات */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <span>ℹ️</span>
                    <span>{lang === "ur" ? "برائے کرم کمپنی کا نام اور بنیادی قانونی ساخت درج کریں۔" : "Please enter company name and corporate structure."}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ur" ? "کمپنی کا نام (انگریزی) *" : "Company Name (English) *"}
                      </Label>
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. DAMAAN IMPEX LLC"
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
                        {lang === "ur" ? "بنیادی کرنسی (Base Currency)" : "Base Currency"}
                      </Label>
                      <select
                        value={baseCurrency}
                        onChange={(e) => setBaseCurrency(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200"
                      >
                        <option value="USD">USD ($) - US Dollar</option>
                        <option value="AED">AED (د.إ) - UAE Dirham</option>
                        <option value="PKR">PKR (Rs) - Pakistani Rupee</option>
                        <option value="AFN">AFN (؋) - Afghan Afghani</option>
                        <option value="INR">INR (₹) - Indian Rupee</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: تصدیق و کاروباری نام */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 dark:bg-indigo-950/40 space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 block">
                        {registrationMode === "owner_portfolio" 
                          ? (lang === "ur" ? "منسلک مالک کی تصدیق (Owner):" : "Linked Owner Confirmation:")
                          : (lang === "ur" ? "منسلک برانچ کی تصدیق (Branch):" : "Linked Branch Confirmation:")}
                      </span>
                      <p className="text-sm font-black text-indigo-950 dark:text-indigo-100">
                        {registrationMode === "owner_portfolio"
                          ? `${transliterateProperNoun(ownerName || "عصمت اللہ عبداللہ", lang)} (S/O: ${transliterateProperNoun(ownerProfile?.fatherName || "عبداللہ", lang)})`
                          : `${selectedCountry?.name || "Country"} / ${selectedCountryBranch?.name || "Branch"}`}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {registrationMode === "owner_portfolio"
                          ? (lang === "ur" ? "ملکیت: 100% پرسنل ہولڈنگ / سسٹر کمپنی" : "Ownership: 100% Personal Holding / Sister Entity")
                          : (lang === "ur" ? "حیثیت: پورے ERP میں برانچ انوائسز اور واؤچرز کے لیے مجاز" : "Status: Authorized for Branch Invoicing, POs & Vouchers")}
                      </p>
                    </div>

                    {managerProfile && (
                      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/40 space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 block">
                          {lang === "ur" ? "کمپنی منیجر (Manager):" : "Company Manager Confirmation:"}
                        </span>
                        <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                          {transliterateProperNoun(managerProfile?.name || "Company Manager", lang)} (S/O: {transliterateProperNoun(managerProfile?.fatherName || "—", lang)})
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {lang === "ur" ? `کوڈ: ${managerProfile?.customerCode || "MGR-001"} • موبائل: ${managerProfile?.mobile || "—"}` : `Code: ${managerProfile?.customerCode || "MGR-001"} • Mobile: ${managerProfile?.mobile || "—"}`}
                        </p>
                      </div>
                    )}
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
                      <Label className="text-xs font-bold text-slate-700">{lang === "ur" ? "کاروبار کی نوعیت" : "Nature of Business"}</Label>
                      <select
                        value={natureOfBusiness}
                        onChange={(e) => setNatureOfBusiness(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-semibold"
                      >
                        <option value="Trading & General Order Supplier">Trading & General Order Supplier (تجارت و سپلائی)</option>
                        <option value="Retail & Wholesale">Retail & Wholesale (تھوک و پرچون)</option>
                        <option value="Import & Export">Import & Export (درآمد و برآمد)</option>
                        <option value="Services & Consultancy">Services & Consultancy (خدمات و مشاورت)</option>
                        <option value="Logistics & Transport">Logistics & Transport (نقل و حمل)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: پتہ و رابطہ */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {/* Step 4: جائزہ اور محفوظ کریں */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-900/60 space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h3 className="text-base font-black text-blue-700 dark:text-blue-400">
                          {companyName || "DAMAAN Trading Company LLC"}
                        </h3>
                        <p className="text-xs text-slate-500 font-bold">
                          {companyNameUrdu && `${companyNameUrdu} • `}{legalStructure} · {natureOfBusiness} · {baseCurrency}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            openCompany360Report({
                              company: {
                                name: companyName,
                                legalName: businessName || companyName,
                                nameUrdu: companyNameUrdu,
                                businessType: legalStructure,
                                natureOfBusiness,
                                registrationType,
                                licenseNumber,
                                baseCurrency,
                                countryName: selectedCountry?.name || "United Arab Emirates",
                                mainBranchName: selectedCountryBranch?.name || "Main Headquarters",
                                cityBranchName: selectedCityBranch?.name || "Dubai Hub",
                                address,
                                phone,
                                email,
                                isBranchOperative: registrationMode === "branch_operative"
                              },
                              owner: ownerProfile ? {
                                name: ownerName,
                                fatherName: ownerProfile.fatherName,
                                customerCode: ownerProfile.customerCode,
                                employeeCode: ownerProfile.employeeCode,
                                phone: phone || ownerProfile.mobile,
                                email: email || ownerProfile.email,
                                country: ownerProfile.country_name,
                                city: ownerProfile.city_name,
                                address: ownerProfile.address
                              } : { name: ownerName },
                              manager: managerProfile ? {
                                name: managerProfile.name,
                                fatherName: managerProfile.fatherName,
                                customerCode: managerProfile.customerCode,
                                employeeCode: managerProfile.employeeCode,
                                phone: managerProfile.mobile,
                                email: managerProfile.email,
                                country: managerProfile.country_name,
                                city: managerProfile.city_name
                              } : null,
                              sisterCompanies: existingCompaniesForOwner,
                              banks: ownerBanks,
                              lang
                            });
                          }}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 text-xs font-bold gap-1.5 h-8 rounded-lg cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>{lang === "ur" ? "مکمل 360° پی ڈی ایف رپورٹ" : "Preview 360° PDF"}</span>
                        </Button>
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                          {lang === "ur" ? "تیار برائے رجسٹریشن" : "Ready to Register"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">
                          {registrationMode === "owner_portfolio" ? (lang === "ur" ? "مالک / شخص:" : "Owner / Stakeholder:") : (lang === "ur" ? "برانچ:" : "Branch:")}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {registrationMode === "owner_portfolio" 
                            ? `${transliterateProperNoun(ownerName, lang)} (S/O: ${transliterateProperNoun(ownerProfile?.fatherName || "—", lang)})` 
                            : `${selectedCountry?.name || "Country"} / ${selectedCountryBranch?.name || "Branch"}`}
                        </span>
                      </div>
                      {managerProfile && (
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">{lang === "ur" ? "کمپنی منیجر:" : "Company Manager:"}</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {transliterateProperNoun(managerProfile?.name || "Manager", lang)}
                          </span>
                        </div>
                      )}
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
                        <span className="text-[10px] text-slate-400 font-bold block">{lang === "ur" ? "سیریل ایلوکیشن:" : "Serials:"}</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">4-Level Auto Allocated</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">{lang === "ur" ? "سسٹر کمپنیاں:" : "Sister Companies:"}</span>
                        <span className="font-bold text-blue-600">{existingCompaniesForOwner.length} {lang === "ur" ? "کمپنیاں موجود" : "Companies on Record"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Message Alert */}
              {message && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  message.includes("Error") || message.includes("Failed") || message.includes("برائے مہربانی")
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}>
                  <span>{message.includes("Error") ? "⚠️" : "✅"}</span>
                  <span>{message}</span>
                </div>
              )}

              {/* Navigation Actions Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1) as any)}
                      className="rounded-xl text-xs font-bold gap-1.5 h-10"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>{lang === "ur" ? "پیچھے" : "Back"}</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {currentStep < 4 ? (
                    <Button
                      type="button"
                      onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1) as any)}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold gap-1.5 h-10 px-5 shadow-xs cursor-pointer"
                    >
                      <span>{lang === "ur" ? "اگلا مرحلہ" : "Next Step"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={saving || !ready}
                      onClick={handleSubmit}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black gap-2 h-11 px-6 shadow-md cursor-pointer"
                    >
                      <Save className="h-4 w-4" />
                      <span>{saving ? (lang === "ur" ? "محفوظ ہو رہا ہے..." : "Saving...") : (lang === "ur" ? "کمپنی محفوظ کریں (Save Company)" : "Save & Finalize Company")}</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
