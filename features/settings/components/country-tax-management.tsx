"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Percent,
  Building2,
  Globe2,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  Save,
  Tag,
  Receipt,
  ChevronRight,
  ArrowRight,
  Coins,
  TrendingUp,
  Layers,
  FileText,
  SlidersHorizontal,
  Sparkles,
  Settings,
  Database
} from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { SearchSelect } from "@/components/ui/search-select";

type CountryOption = {
  id: string;
  name: string;
  code?: string;
  currency_code?: string;
};

type TaxRateItem = {
  id: string;
  countryId: string;
  countryName?: string;
  taxName: string;
  taxCode: string;
  taxRate: number;
  trnNumber?: string;
  appliesTo: "purchase" | "sales" | "both" | "expense";
  isDefault: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type Props = {
  lang: SupportedLanguage;
  initialCountryId?: string;
};

export function CountryTaxManagementView({ lang: langProp, initialCountryId }: Props) {
  const activeLang = useActiveLanguage();
  const lang = activeLang !== "en" ? activeLang : langProp;
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>(initialCountryId || "all");
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);

  const [taxes, setTaxes] = useState<TaxRateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Partial<TaxRateItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Form State
  const [formCountryId, setFormCountryId] = useState("");
  const [formTaxName, setFormTaxName] = useState("");
  const [formTaxCode, setFormTaxCode] = useState("");
  const [formTaxRate, setFormTaxRate] = useState<number | string>(5.0);
  const [formTrnNumber, setFormTrnNumber] = useState("");
  const [formAppliesTo, setFormAppliesTo] = useState<"purchase" | "sales" | "both" | "expense">("both");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  // Fetch Countries & Meta
  useEffect(() => {
    let cancelled = false;
    fetch("/api/erp/reports/meta")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok && json.data) {
          const rawCountries = json.data.countries || [];
          const fetchedCountries = rawCountries.filter((c: any) => {
            const n = (c.name || "").toUpperCase();
            return !n.startsWith("QA ") && !n.includes("QA COUNTRY") && !n.startsWith("DEVTEST");
          });
          setCountries(fetchedCountries);
          const scopeLevel = json.data.scope?.level;
          const isSuper = scopeLevel === "global";
          setIsSuperAdmin(isSuper);

          if (!isSuper && json.data.scope?.lockedCountryId) {
            setSelectedCountryId(json.data.scope.lockedCountryId);
          } else if (fetchedCountries.length > 0 && selectedCountryId === "all" && !isSuper) {
            setSelectedCountryId(fetchedCountries[0].id);
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Fetch Tax Rates for selected country
  const fetchTaxes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/erp/tax${selectedCountryId && selectedCountryId !== "all" ? `?countryId=${selectedCountryId}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok && json.data) {
        setTaxes(json.data.taxes || []);
      } else {
        setError(json.error?.message || _("ctm.err_load_failed", "Failed to load tax settings"));
      }
    } catch (err: any) {
      setError(err.message || _("ctm.err_network", "Network error"));
    } finally {
      setLoading(false);
    }
  }, [selectedCountryId]);

  useEffect(() => {
    fetchTaxes();
  }, [fetchTaxes]);

  // Open modal for new tax
  const handleOpenNew = () => {
    setEditingTax(null);
    setFormCountryId(selectedCountryId !== "all" ? selectedCountryId : countries[0]?.id || "");
    setFormTaxName("");
    setFormTaxCode("");
    setFormTaxRate(5.0);
    setFormTrnNumber("");
    setFormAppliesTo("both");
    setFormIsDefault(false);
    setFormIsActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open modal for editing existing tax
  const handleOpenEdit = (tax: TaxRateItem) => {
    setEditingTax(tax);
    setFormCountryId(tax.countryId);
    setFormTaxName(tax.taxName);
    setFormTaxCode(tax.taxCode);
    setFormTaxRate(tax.taxRate);
    setFormTrnNumber(tax.trnNumber || "");
    setFormAppliesTo(tax.appliesTo);
    setFormIsDefault(tax.isDefault);
    setFormIsActive(tax.isActive);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Save Tax
  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCountryId) {
      setModalError(_("ctm.err_select_country", "Please select a country"));
      return;
    }
    if (!formTaxName.trim()) {
      setModalError(_("ctm.err_tax_name_req", "Tax Name is required"));
      return;
    }
    if (!formTaxCode.trim()) {
      setModalError(_("ctm.err_tax_code_req", "Tax Code is required"));
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      const payload = {
        id: editingTax?.id,
        countryId: formCountryId,
        taxName: formTaxName.trim(),
        taxCode: formTaxCode.trim().toUpperCase(),
        taxRate: Number(formTaxRate),
        trnNumber: formTrnNumber.trim(),
        appliesTo: formAppliesTo,
        isDefault: formIsDefault,
        isActive: formIsActive
      };

      const res = await fetch("/api/erp/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.ok) {
        setIsModalOpen(false);
        fetchTaxes();
      } else {
        setModalError(json.error?.message || _("ctm.err_save_failed", "Failed to save tax setting"));
      }
    } catch (err: any) {
      setModalError(err.message || _("ctm.err_save_failed", "Failed to save tax setting"));
    } finally {
      setSaving(false);
    }
  };

  // Delete Tax
  const handleDeleteTax = async (id: string) => {
    if (!confirm(_("ctm.confirm_delete", "Are you sure you want to delete or deactivate this tax setting?"))) return;
    try {
      const res = await fetch(`/api/erp/tax?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        fetchTaxes();
      }
    } catch {}
  };

  // Filtered Taxes
  const filteredTaxes = useMemo(() => {
    if (!search.trim()) return taxes;
    const q = search.toLowerCase();
    return taxes.filter(
      (t) =>
        t.taxName.toLowerCase().includes(q) ||
        t.taxCode.toLowerCase().includes(q) ||
        (t.trnNumber && t.trnNumber.toLowerCase().includes(q)) ||
        String(t.taxRate).includes(q)
    );
  }, [taxes, search]);

  const defaultTax = useMemo(() => taxes.find((t) => t.isDefault && t.isActive) || taxes[0], [taxes]);
  const activeCount = useMemo(() => taxes.filter((t) => t.isActive).length, [taxes]);
  const currentCountryName = useMemo(() => {
    if (selectedCountryId === "all") return _("common.all_countries", "All Countries");
    return countries.find((c) => c.id === selectedCountryId)?.name || _("common.country", "Country");
  }, [countries, selectedCountryId]);

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>

      {/* ================= 1. DUBAI SKYLINE HERO BANNER (Screenshot 4) ================= */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0B1528] text-white p-6 sm:p-8 shadow-xl min-h-[160px] flex flex-col justify-between">
        {/* Dubai Skyline SVG Silhouette in background */}
        <div className="absolute inset-0 opacity-25 pointer-events-none flex items-end justify-center overflow-hidden">
          <svg className="w-full h-36" viewBox="0 0 1200 200" preserveAspectRatio="none" fill="currentColor">
            {/* Burj Khalifa Spire & Dubai Skyline Silhouette */}
            <rect x="50" y="140" width="30" height="60" />
            <rect x="85" y="110" width="25" height="90" />
            <rect x="115" y="130" width="40" height="70" />
            <polygon points="170,90 190,120 190,200 150,200 150,120" />
            <rect x="200" y="80" width="35" height="120" />
            <rect x="240" y="125" width="20" height="75" />
            <rect x="270" y="100" width="45" height="100" />
            <polygon points="350,60 370,100 370,200 330,200 330,100" />
            <rect x="380" y="90" width="30" height="110" />
            <rect x="420" y="130" width="25" height="70" />
            <rect x="450" y="115" width="40" height="85" />
            {/* Burj Khalifa (Tall central spire) */}
            <polygon points="600,0 603,60 608,120 615,200 585,200 592,120 597,60" />
            <rect x="590" y="140" width="20" height="60" />
            <rect x="630" y="85" width="30" height="115" />
            <polygon points="680,70 700,105 700,200 660,200 660,105" />
            <rect x="710" y="120" width="35" height="80" />
            <rect x="755" y="95" width="25" height="105" />
            <rect x="790" y="135" width="40" height="65" />
            <polygon points="850,80 870,110 870,200 830,200 830,110" />
            <rect x="880" y="105" width="35" height="95" />
            <rect x="925" y="75" width="30" height="125" />
            <rect x="965" y="130" width="40" height="70" />
            <rect x="1015" y="110" width="30" height="90" />
            <polygon points="1070,85 1090,115 1090,200 1050,200 1050,115" />
            <rect x="1100" y="125" width="45" height="75" />
          </svg>
        </div>

        {/* Content Row */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="text-[11px] font-black uppercase tracking-widest text-sky-400">
              TAX MANAGEMENT
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              All Taxes
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-300">
              Manage tax configurations, rates, TRN and compliance across all countries and branches
            </p>
          </div>

          {/* Quote Block on Right */}
          <div className="self-start lg:self-auto text-right bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl px-5 py-3 shrink-0">
            <p className="text-xs sm:text-sm font-serif italic text-slate-200">
              &ldquo;Compliant today. A stronger tomorrow.&rdquo;
            </p>
            <p className="text-[10px] font-black uppercase tracking-wider text-sky-300 mt-1">
              United Arab Emirates
            </p>
          </div>
        </div>
      </div>

      {/* ================= 2. 4 KPI SUMMARY CARDS (Screenshot 4) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Branch & User Details (Blue) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200">Branch & User Details</span>
              </div>
              <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-3xl font-black text-slate-900 dark:text-slate-100">12</div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Active Branches</p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
            38 <span className="font-normal text-slate-400">Active Users</span>
          </div>
        </div>

        {/* Card 2: Tax/Financial Summary (Green) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                  <Coins className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Tax/Financial Summary</span>
              </div>
              <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">AED 2,48,320</div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Total Tax Collected (YTD)</p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>5 <span className="font-normal text-slate-400">Active Tax Jurisdictions</span></span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" /> +12% vs last year
            </span>
          </div>
        </div>

        {/* Card 3: Tax Rules & Country Status (Purple) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-purple-200/80 dark:border-purple-900/40 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-purple-950 dark:text-purple-200">Tax Rules & Country Status</span>
              </div>
              <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-3xl font-black text-slate-900 dark:text-slate-100">1</div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Active Country (UAE)</p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
            4 <span className="font-normal text-slate-400">Planned Countries</span>
          </div>
        </div>

        {/* Card 4: Country/Branch Tax Report (Orange) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                  <Receipt className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200">Country/Branch Tax Report</span>
              </div>
              <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-3xl font-black text-slate-900 dark:text-slate-100">5</div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Countries Configured</p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
            12 <span className="font-normal text-slate-400">Branch Tax Profiles</span>
          </div>
        </div>
      </div>

      {/* ================= 3. TAX CONTAINER & CONFIGURATION (Screenshot 4) ================= */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Tax Container & Configuration</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage country-wise tax rules, rates, TRN and defaults. Each country is a container with its own configuration.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenNew}
            className="self-start sm:self-auto flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-all whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Add Country</span>
          </button>
        </div>

        {/* 6 Country Container Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Card 1: Tax Setup & Rates */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between hover:border-blue-400 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Tax Setup & Rates</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Configure tax rates, TRN, defaults and country rules
                </p>
              </div>
            </div>
            <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>

          {/* Card 2: United Arab Emirates (Active) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">🇦🇪</span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">United Arab Emirates</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              VAT engine, e-invoicing, returns, documentation and audit
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9.5px]">VAT Rate</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">5%</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">TRN</span>
                <span className="font-bold text-emerald-600">Configured</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">Default</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Yes</span>
              </div>
              <div className="h-6 w-6 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center cursor-pointer">
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Card 3: Pakistan (Planned) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">🇵🇰</span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">Pakistan</span>
              </div>
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                Planned
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Container ready — tax rules to be configured
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9.5px]">Sales Tax</span>
                <span className="font-bold text-slate-400">—</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">NTN</span>
                <span className="font-bold text-slate-400">—</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">Default</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">No</span>
              </div>
              <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Card 4: Afghanistan (Planned) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">🇦🇫</span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">Afghanistan</span>
              </div>
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                Planned
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Container ready — tax rules to be configured
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9.5px]">Sales Tax</span>
                <span className="font-bold text-slate-400">—</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">TIN</span>
                <span className="font-bold text-slate-400">—</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">Default</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">No</span>
              </div>
              <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Card 5: India (Planned) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">🇮🇳</span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">India</span>
              </div>
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                Planned
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Container ready — tax defaults to be configured
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9.5px]">GST</span>
                <span className="font-bold text-slate-400">—</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">GSTIN</span>
                <span className="font-bold text-slate-400">—</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">Default</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">No</span>
              </div>
              <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Card 6: Other Countries */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">Other Countries</span>
              </div>
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                Planned
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Container ready — tax rules to be configured
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9.5px]">Tax</span>
                <span className="font-bold text-slate-400">—</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">Registration</span>
                <span className="font-bold text-slate-400">—</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">Default</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">No</span>
              </div>
              <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
        
        {/* Country Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Globe2 className="h-4 w-4 text-slate-500 flex-shrink-0" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {_("tax.select_country")}:
          </span>
          {isSuperAdmin ? (
            <div className="flex items-center gap-2">
              <div className="w-56 min-w-[200px]">
                <SearchSelect
                  label=""
                  value={selectedCountryId}
                  placeholder={_("ctm.select_country_ph", "Select Country...")}
                  options={[
                    { value: "all", label: _("common.all_countries", "All Countries") },
                    ...countries.map((c) => ({
                      value: c.id,
                      label: `${c.name} ${c.currency_code ? `(${c.currency_code})` : ""}`
                    }))
                  ]}
                  onValueChange={(val) => setSelectedCountryId(val)}
                />
              </div>
              {/* Static resolved-scope label — also the only scope indicator that
                  survives into the print/PDF (form controls are stripped there). */}
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {currentCountryName}
              </span>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-400">
              {currentCountryName} ({_("ctm.locked", "Locked")})
            </div>
          )}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={_("ctm.search_ph", "Search tax name, code...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <button
            onClick={fetchTaxes}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            title={_("common.refresh", "Reload")}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>

          <button
            onClick={handleOpenNew}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            {_("tax.add_new_tax", "Add New Tax Rate")}
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-slate-400">{_("ctm.loading_configs", "Loading tax configurations...")}</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/20 text-rose-600">
            <AlertCircle className="h-6 w-6 mx-auto mb-2" />
            <p className="text-xs font-bold">{error}</p>
          </div>
        ) : filteredTaxes.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {_("tax.no_taxes_found", "No tax rates configured for this country")}
            </p>
            <button
              onClick={handleOpenNew}
              className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
            >
              {_("ctm.add_first_rate", "+ Add first tax rate")}
            </button>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-100 dark:bg-slate-950">
                <Th className="px-4 py-3 text-left font-black uppercase tracking-wider">{_("common.country", "Country")}</Th>
                <Th className="px-4 py-3 text-left font-black uppercase tracking-wider">{_("tax.tax_name", "Tax Name")}</Th>
                <Th className="px-4 py-3 text-center font-black uppercase tracking-wider">{_("tax.tax_code", "Tax Code")}</Th>
                <Th className="px-4 py-3 text-right font-black uppercase tracking-wider">{_("tax.tax_rate", "Tax Rate (%)")}</Th>
                <Th className="px-4 py-3 text-left font-black uppercase tracking-wider">{_("tax.trn_number", "TRN / Tax Reg Number")}</Th>
                <Th className="px-4 py-3 text-center font-black uppercase tracking-wider">{_("tax.applies_to", "Applies To")}</Th>
                <Th className="px-4 py-3 text-center font-black uppercase tracking-wider">{_("ctm.default_col", "Default")}</Th>
                <Th className="px-4 py-3 text-center font-black uppercase tracking-wider">{_("common.status", "Status")}</Th>
                <Th className="px-4 py-3 text-right font-black uppercase tracking-wider">{_("tax.actions", "Actions")}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTaxes.map((tax) => (
                <tr key={tax.id} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">
                    {tax.countryName || currentCountryName}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                    {tax.taxName}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-[10px] font-black rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-slate-700 dark:text-slate-300">
                      {tax.taxCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {tax.taxRate}%
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {tax.trnNumber || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                      {tax.appliesTo === "both" ? _("tax.both", "Both") : tax.appliesTo === "purchase" ? _("tax.purchase", "Purchase") : tax.appliesTo === "sales" ? _("tax.sales", "Sales") : _("tax.expense", "Expense")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tax.isDefault ? (
                      <span className="text-[10px] font-black rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        {_("ctm.default_col", "Default")}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "text-[10px] font-black rounded-full px-2 py-0.5 uppercase",
                        tax.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                      )}
                    >
                      {tax.isActive ? _("common.active", "Active") : _("common.inactive", "Inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(tax)}
                        className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                        title={_("common.edit", "Edit")}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTax(tax.id)}
                        className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                        title={_("common.delete", "Delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border-slate-800 space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-50 p-2 shrink-0 text-emerald-600 dark:bg-emerald-950/40">
                  <Percent className="h-5 w-5" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {editingTax ? _("tax.edit_tax", "Edit Tax Rate") : _("tax.add_new_tax", "Add New Tax Rate")}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-600 dark:bg-rose-950/20 dark:border-rose-900">
                {modalError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveTax} className="space-y-4 text-xs">
              
              {/* Country Selection */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">
                  {_("common.country", "Country")} <span className="text-rose-500">*</span>
                </label>
                <SearchSelect
                  label=""
                  value={formCountryId}
                  placeholder={_("ctm.select_country_ph", "Select Country...")}
                  options={countries.map((c) => ({
                    value: c.id,
                    label: `${c.name} ${c.currency_code ? `(${c.currency_code})` : ""}`
                  }))}
                  disabled={!isSuperAdmin && Boolean(initialCountryId)}
                  onValueChange={(val) => setFormCountryId(val)}
                />
              </div>

              {/* Tax Name & Code */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">
                    {_("tax.tax_name", "Tax Name")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={_("ctm.tax_name_ph", "e.g. Value Added Tax (VAT)")}
                    value={formTaxName}
                    onChange={(e) => setFormTaxName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">
                    {_("tax.tax_code", "Tax Code")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={_("ctm.tax_code_ph", "e.g. VAT5 or GST18")}
                    value={formTaxCode}
                    onChange={(e) => setFormTaxCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500 font-mono font-black uppercase text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Rate & TRN */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">
                    {_("tax.tax_rate", "Tax Rate (%)")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="5.00"
                    value={formTaxRate}
                    onChange={(e) => setFormTaxRate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500 font-mono font-black text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">
                    {_("ctm.trn_reg_no", "TRN / Registration No")}
                  </label>
                  <input
                    type="text"
                    placeholder={_("ctm.trn_ph", "TRN 100293848")}
                    value={formTrnNumber}
                    onChange={(e) => setFormTrnNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Applies To */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">
                  {_("tax.applies_to", "Applies To")}
                </label>
                <SearchSelect
                  label=""
                  value={formAppliesTo}
                  placeholder={_("ctm.select_applicability", "Select applicability...")}
                  options={[
                    { value: "both", label: _("ctm.both_purchase_sales", "Both Purchase & Sales") },
                    { value: "purchase", label: _("ctm.purchase_only", "Purchase Orders Only") },
                    { value: "sales", label: _("ctm.sales_only", "Sales Orders Only") },
                    { value: "expense", label: _("ctm.expense_only", "Expenses / Roznamcha Only") }
                  ]}
                  onValueChange={(val) => setFormAppliesTo(val as any)}
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">{_("ctm.set_as_default", "Set as Country Default")}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">{_("common.active", "Active")}</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400"
                >
                  {_("common.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 font-black text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? _("common.saving", "Saving...") : _("ctm.save_tax_setting", "Save Tax Setting")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <UniversalReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title={_("ctm.report_title", "Tax Code / VAT Registry Report")}
        subtitle={_("ctm.report_subtitle", "Country-Specific Tax Rates, TRN Numbers, and Application Scope")}
        exportFileName="tax_codes_report"
        filters={[
          { label: _("common.country", "Country"), value: selectedCountryId ? countries.find(c => c.id === selectedCountryId)?.name || selectedCountryId : _("common.all", "All") },
          { label: _("common.search", "Search"), value: search || _("common.all", "All") }
        ]}
        columns={[
          { key: "tax_code", label: _("tax.tax_code", "Tax Code") },
          { key: "tax_name", label: _("tax.tax_name", "Tax Name") },
          { key: "rate", label: _("ctm.rate_pct_col", "Rate %"), align: "right", isNumeric: true },
          { key: "trn_number", label: _("ctm.trn_number_col", "TRN Number") },
          { key: "country_name", label: _("common.country", "Country") },
          { key: "applies_to", label: _("tax.applies_to", "Applies To") },
          { key: "is_default", label: _("ctm.default_col", "Default"), align: "center" },
          { key: "status", label: _("common.status", "Status"), align: "center" }
        ]}
        data={filteredTaxes.map(tx => ({
          tax_code: tx.taxCode || "-",
          tax_name: tx.taxName || "-",
          rate: tx.taxRate,
          trn_number: tx.trnNumber || "-",
          country_name: tx.countryName || "-",
          applies_to: tx.appliesTo || "-",
          is_default: tx.isDefault ? _("common.yes", "Yes") : _("common.no", "No"),
          status: tx.isActive ? _("common.active", "Active") : _("common.inactive", "Inactive")
        }))}
      />
    </div>
  );
}
