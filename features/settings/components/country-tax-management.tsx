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
  Receipt
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

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="rounded-2xl p-3 bg-white/20 backdrop-blur-sm w-fit">
            <Percent className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">
              {_("tax.title", "Country Tax Management")}
            </h1>
            <p className="text-sm text-white/80 mt-0.5">
              {_("tax.subtitle", "Configure multi-country tax rates, VAT/GST registration numbers, and country defaults")}
            </p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 px-4 py-2">
              <Globe2 className="h-4 w-4 text-emerald-200" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                {currentCountryName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Tax Rates */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <div className="flex items-start justify-between gap-2 min-h-[2.5rem]">
            <span className="text-xs font-bold uppercase text-slate-500 leading-tight">{_("ctm.configured_rates", "Configured Rates")}</span>
            <div className="rounded-xl bg-emerald-50 p-2 shrink-0 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Tag className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{activeCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{_("ctm.active_configs", "Active tax configurations")}</p>
        </div>

        {/* Default Country Tax Rate */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <div className="flex items-start justify-between gap-2 min-h-[2.5rem]">
            <span className="text-xs font-bold uppercase text-slate-500 leading-tight">{_("ctm.default_rate", "Default Rate")}</span>
            <div className="rounded-xl bg-blue-50 p-2 shrink-0 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {defaultTax ? `${defaultTax.taxRate}%` : "0%"}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">{defaultTax ? defaultTax.taxName : _("ctm.none_set", "None set")}</p>
        </div>

        {/* Primary TRN Number */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <div className="flex items-start justify-between gap-2 min-h-[2.5rem]">
            <span className="text-xs font-bold uppercase text-slate-500 leading-tight">{_("ctm.trn_reg_label", "TRN / Tax Reg #")}</span>
            <div className="rounded-xl bg-violet-50 p-2 shrink-0 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-2 truncate">
            {defaultTax?.trnNumber || _("ctm.not_registered", "Not Registered")}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">{_("ctm.vat_gst_reg", "VAT / GST Registration No")}</p>
        </div>

        {/* Country Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <div className="flex items-start justify-between gap-2 min-h-[2.5rem]">
            <span className="text-xs font-bold uppercase text-slate-500 leading-tight">{_("common.status", "Status")}</span>
            <div className="rounded-xl bg-teal-50 p-2 shrink-0 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">{_("common.active", "Active")}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{_("ctm.engine_ready", "Multi-country Tax Engine Ready")}</p>
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
