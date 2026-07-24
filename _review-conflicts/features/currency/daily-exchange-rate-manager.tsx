"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp, Save, RefreshCw, Globe,
  CheckCircle, AlertCircle, Clock, ArrowUpRight, ArrowDownLeft,
  Search, Printer, User, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type CountryRate = {
  id: string;
  country_id: string;
  user_name?: string;
  branch_name?: string;
  rate_date: string;
  rate_time?: string;
  buying_rate: number;
  selling_rate: number;
  credit_rate: number;
  debit_rate: number;
  updated_at: string;
  countries?: { name: string; currency_code: string; iso2?: string | null };
};

type CountryOption = {
  id: string;
  name: string;
  currency_code: string;
  iso2: string | null;
};

const DEFAULT_COUNTRIES: CountryOption[] = [
  { id: "c-af", name: "Afghanistan", currency_code: "AFN", iso2: "AF" },
  { id: "c-pk", name: "Pakistan", currency_code: "PKR", iso2: "PK" },
  { id: "c-ae", name: "United Arab Emirates", currency_code: "AED", iso2: "AE" },
  { id: "c-us", name: "United States", currency_code: "USD", iso2: "US" },
  { id: "c-sa", name: "Saudi Arabia", currency_code: "SAR", iso2: "SA" },
  { id: "c-om", name: "Oman", currency_code: "OMR", iso2: "OM" },
  { id: "c-gb", name: "United Kingdom", currency_code: "GBP", iso2: "GB" },
  { id: "c-cn", name: "China", currency_code: "CNY", iso2: "CN" },
];

function money(value: number, digits = 4) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function currentTimeString() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFlag(iso2: string | null | undefined) {
  if (!iso2) return "🌐";
  return iso2
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

export function DailyExchangeRateManager() {
  const [rates, setRates] = useState<CountryRate[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>(DEFAULT_COUNTRIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Fields State
  const [selectedCountryId, setSelectedCountryId] = useState<string>("c-af");
  const [rateDate, setRateDate] = useState<string>(isoToday());
  const [rateTime, setRateTime] = useState<string>(currentTimeString());
  const [creditPrice, setCreditPrice] = useState<string>("67.00");
  const [debitPrice, setDebitPrice] = useState<string>("68.00");
  const [operatorUser, setOperatorUser] = useState<string>("SUPER ADMIN");
  const [operatorBranch, setOperatorBranch] = useState<string>("Pakistan Main Branch");

  // Table Filter & Search State
  const [filterCountryId, setFilterCountryId] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Header Portal Slots
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTitleSlot(document.getElementById("erp-page-title-slot"));
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCountryId && filterCountryId !== "all") params.set("countryId", filterCountryId);
      if (filterBranch && filterBranch !== "all") params.set("branchName", filterBranch);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (searchQuery) params.set("query", searchQuery);

      const [ratesRes, countriesRes] = await Promise.all([
        apiGet<any>(`/api/erp/currency/daily-rates?${params.toString()}`),
        apiGet<any>("/api/erp/admin/countries?limit=100"),
      ]);
      
      const ratesList: CountryRate[] = Array.isArray(ratesRes) 
        ? ratesRes 
        : ratesRes?.rates ?? ratesRes?.data ?? [];
      
      if (ratesList.length > 0) {
        setRates(ratesList);
      }

      const fetchedCountries: CountryOption[] = Array.isArray(countriesRes)
        ? countriesRes
        : countriesRes?.countries ?? countriesRes?.data ?? [];
      const mergedCountries = fetchedCountries.length > 0 ? fetchedCountries : DEFAULT_COUNTRIES;
      setCountries(mergedCountries);

      if (mergedCountries.length > 0 && !selectedCountryId) {
        setSelectedCountryId(mergedCountries[0].id);
      }
    } catch (err) {
      console.error("Failed to load exchange rates:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [filterCountryId, filterBranch, dateFrom, dateTo, searchQuery]);

  // Update form inputs when selected country changes
  const selectedCountry = useMemo(() => {
    return countries.find(c => c.id === selectedCountryId) || DEFAULT_COUNTRIES[0];
  }, [countries, selectedCountryId]);

  useEffect(() => {
    const existingRate = rates.find(r => r.country_id === selectedCountryId);
    if (existingRate) {
      setCreditPrice(String(existingRate.credit_rate || existingRate.selling_rate));
      setDebitPrice(String(existingRate.debit_rate || existingRate.buying_rate));
      if (existingRate.rate_date) setRateDate(existingRate.rate_date);
      if (existingRate.rate_time) setRateTime(existingRate.rate_time);
      if (existingRate.user_name) setOperatorUser(existingRate.user_name);
      if (existingRate.branch_name) setOperatorBranch(existingRate.branch_name);
    } else {
      if (selectedCountry.currency_code === "AFN") { setCreditPrice("67.00"); setDebitPrice("68.00"); }
      else if (selectedCountry.currency_code === "PKR") { setCreditPrice("280.00"); setDebitPrice("278.50"); }
      else if (selectedCountry.currency_code === "AED") { setCreditPrice("3.68"); setDebitPrice("3.67"); }
      else if (selectedCountry.currency_code === "SAR") { setCreditPrice("3.76"); setDebitPrice("3.75"); }
      else { setCreditPrice("1.00"); setDebitPrice("1.00"); }
      setRateTime(currentTimeString());
    }
  }, [selectedCountryId]);

  async function handleSaveRate(e: React.FormEvent) {
    e.preventDefault();
    const credit = Number(creditPrice);
    const debit = Number(debitPrice);

    if (!credit || !debit) {
      setMessage({ type: "error", text: "Please enter valid Credit ($) and Debit ($) rates." });
      return;
    }

    setSaving(true);
    setMessage(null);

    const newRateEntry: CountryRate = {
      id: `rate-${Date.now()}`,
      country_id: selectedCountryId,
      user_name: operatorUser || "SUPER ADMIN",
      branch_name: operatorBranch || "Pakistan Main Branch",
      rate_date: rateDate || isoToday(),
      rate_time: rateTime || currentTimeString(),
      buying_rate: debit,
      selling_rate: credit,
      credit_rate: credit,
      debit_rate: debit,
      updated_at: new Date().toISOString(),
      countries: {
        name: selectedCountry.name,
        currency_code: selectedCountry.currency_code,
        iso2: selectedCountry.iso2
      }
    };

    // 1. Immediately update local component state so table renders record instantly!
    setRates(prev => [newRateEntry, ...prev.filter(r => r.country_id !== selectedCountryId || r.rate_date !== newRateEntry.rate_date)]);
    
    // Clear search filters so nothing hides the new record
    setFilterCountryId("all");
    setFilterBranch("all");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");

    try {
      await apiPost("/api/erp/currency/daily-rates", {
        countryId: selectedCountryId,
        rateDate: rateDate || isoToday(),
        rateTime: rateTime || currentTimeString(),
        buyingRate: debit,
        sellingRate: credit,
        creditRate: credit,
        debitRate: debit,
        countryName: selectedCountry.name,
        currencyCode: selectedCountry.currency_code,
        iso2: selectedCountry.iso2,
        userName: operatorUser || "SUPER ADMIN",
        branchName: operatorBranch || "Pakistan Main Branch"
      });

      setMessage({
        type: "success",
        text: `Exchange Rate Saved & Accepted to Database! (${selectedCountry.name}: Credit $${credit} / Debit $${debit} ${selectedCountry.currency_code} by ${operatorUser})`
      });

      await loadData();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to save exchange rate." });
    } finally {
      setSaving(false);
    }
  }

  function handleSelectRow(rate: CountryRate) {
    setSelectedCountryId(rate.country_id);
    setCreditPrice(String(rate.credit_rate || rate.selling_rate));
    setDebitPrice(String(rate.debit_rate || rate.buying_rate));
    if (rate.rate_date) setRateDate(rate.rate_date);
    if (rate.rate_time) setRateTime(rate.rate_time);
    if (rate.user_name) setOperatorUser(rate.user_name);
    if (rate.branch_name) setOperatorBranch(rate.branch_name);
  }

  function handlePrintTable() {
    window.print();
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* ── ERP Top Header Title Portal ── */}
      {titleSlot && createPortal(
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
            DAILY EXCHANGE RATE MANAGEMENT
          </h1>
        </div>,
        titleSlot
      )}

      {/* ── ERP Top Header Actions Portal ── */}
      {actionsSlot && createPortal(
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrintTable}
            variant="outline"
            className="h-8 text-[11px] font-black uppercase bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Print Rate Table
          </Button>
          <Button
            onClick={loadData}
            variant="outline"
            className="h-8 text-[11px] font-black uppercase bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Refresh Rates
          </Button>
        </div>,
        actionsSlot
      )}

      {/* Main 2-Column Split Workspace (Left: 4 Cols Form | Right: 8 Cols Expanded Super Admin Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── Left Column (4 Cols): Rate Entry Form ── */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-150 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              EXCHANGE RATE ENTRY FORM
            </h3>
            <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
              INTRA-DAY LIVE ENTRY
            </span>
          </div>

          <form onSubmit={handleSaveRate} className="space-y-3.5">
            
            {/* 1. Country Selection */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                1. COUNTRY NAME
              </Label>
              <select
                value={selectedCountryId}
                onChange={(e) => setSelectedCountryId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-all uppercase"
              >
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getFlag(c.iso2)} {c.name} ({c.currency_code})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Date & Time 2-col Row */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                  2. DATE
                </Label>
                <Input
                  type="date"
                  value={rateDate}
                  onChange={(e) => setRateDate(e.target.value)}
                  className="h-9 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                  3. TIME
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. 10:49 PM"
                  value={rateTime}
                  onChange={(e) => setRateTime(e.target.value)}
                  className="h-9 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            {/* User & Branch Info */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  OPERATOR USER
                </Label>
                <Input
                  type="text"
                  value={operatorUser}
                  onChange={(e) => setOperatorUser(e.target.value)}
                  className="h-9 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  BRANCH NAME
                </Label>
                <Input
                  type="text"
                  value={operatorBranch}
                  onChange={(e) => setOperatorBranch(e.target.value)}
                  className="h-9 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            {/* 3. Credit Dollar Price ($) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                4. CREDIT DOLLAR PRICE ($)
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="e.g. 280.00"
                  value={creditPrice}
                  onChange={(e) => setCreditPrice(e.target.value)}
                  className="h-10 text-xs font-black font-mono text-emerald-700 dark:text-emerald-400 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 focus:border-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-mono font-bold text-slate-400">
                  {selectedCountry.currency_code}
                </span>
              </div>
            </div>

            {/* 4. Debit Dollar Price ($) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                5. DEBIT DOLLAR PRICE ($)
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="e.g. 278.50"
                  value={debitPrice}
                  onChange={(e) => setDebitPrice(e.target.value)}
                  className="h-10 text-xs font-black font-mono text-blue-700 dark:text-blue-400 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 focus:border-blue-500"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-mono font-bold text-slate-400">
                  {selectedCountry.currency_code}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <Button
              type="submit"
              disabled={saving}
              className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 pt-1"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "SAVING EXCHANGE RATE..." : "SAVE EXCHANGE RATE"}
            </Button>
          </form>

          {message && (
            <div className={cn(
              "flex items-center gap-2 text-xs font-bold p-3 rounded-xl border animate-in fade-in duration-150",
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
            )}>
              {message.type === "success" ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
              )}
              <span>{message.text}</span>
            </div>
          )}
        </div>

        {/* ── Right Column (8 Cols): Expanded Super Admin Table with Header Search Filters ── */}
        <div className="lg:col-span-8 space-y-3">
          
          {/* Header Filter Controls Bar */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide flex items-center gap-2 text-emerald-400">
                  <Clock className="w-4 h-4" />
                  SUPER ADMIN LIVE EXCHANGE RATES TABLE
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Audited intra-day exchange rates recorded by users and branch terminals worldwide.
                </p>
              </div>
              <span className="text-[10px] font-mono font-black bg-slate-800 text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-700 shadow-xs">
                TOTAL ENTRIES: {rates.length}
              </span>
            </div>

            {/* Filter Dropdowns Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-slate-800 dark:text-slate-100">
              
              {/* Country Filter */}
              <div>
                <select
                  value={filterCountryId}
                  onChange={(e) => setFilterCountryId(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 text-[11px] font-bold outline-none uppercase"
                >
                  <option value="all">ALL COUNTRIES</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.currency_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch Filter */}
              <div>
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 text-[11px] font-bold outline-none uppercase"
                >
                  <option value="all">ALL BRANCHES</option>
                  <option value="Pakistan Main Branch">PAKISTAN MAIN</option>
                  <option value="Dubai Central Branch">DUBAI CENTRAL</option>
                  <option value="USA Division">USA DIVISION</option>
                  <option value="Riyadh Branch">RIYADH BRANCH</option>
                  <option value="Muscat Terminal">MUSCAT TERMINAL</option>
                  <option value="Kabul Main Branch">KABUL MAIN</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <Input
                  type="date"
                  placeholder="Date From"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 text-[10px] font-bold bg-slate-800 text-slate-100 border-slate-700 rounded-lg"
                />
              </div>

              {/* Search Query */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search user, branch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-[11px] font-bold pl-8 bg-slate-800 text-slate-100 border-slate-700 rounded-lg placeholder:text-slate-500"
                />
              </div>

            </div>
          </div>

          {/* Consolidated Rates Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[9px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    <th className="py-2.5 px-3 text-center">SR NO</th>
                    <th className="py-2.5 px-3">COUNTRY NAME</th>
                    <th className="py-2.5 px-3">BRANCH NAME</th>
                    <th className="py-2.5 px-3">USER NAME</th>
                    <th className="py-2.5 px-3 text-center">CURRENCY</th>
                    <th className="py-2.5 px-3">DATE & TIME</th>
                    <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">CREDIT RATE ($)</th>
                    <th className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">DEBIT RATE ($)</th>
                    <th className="py-2.5 px-3 text-right">LAST UPDATED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                  {rates.map((r, idx) => {
                    const countryName = r.countries?.name ?? DEFAULT_COUNTRIES.find(c => c.id === r.country_id)?.name ?? "Country";
                    const currencyCode = r.countries?.currency_code ?? DEFAULT_COUNTRIES.find(c => c.id === r.country_id)?.currency_code ?? "USD";
                    const iso2 = r.countries?.iso2 ?? DEFAULT_COUNTRIES.find(c => c.id === r.country_id)?.iso2;
                    const isSelected = r.country_id === selectedCountryId;

                    return (
                      <tr
                        key={r.id || idx}
                        onClick={() => handleSelectRow(r)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-850",
                          isSelected && "bg-blue-50/50 dark:bg-blue-950/30"
                        )}
                      >
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold flex items-center gap-2 text-[11px]">
                          <span className="text-base">{getFlag(iso2)}</span>
                          <span className="uppercase">{countryName}</span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase">
                          {r.branch_name || "Pakistan Main Branch"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[10px] text-blue-700 dark:text-blue-400 uppercase">
                          {r.user_name || "SUPER ADMIN"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[9px]">
                            {currencyCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                          {r.rate_date || isoToday()} {r.rate_time || "09:00 AM"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-[11px]">
                          ${money(r.credit_rate || r.selling_rate, 2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400 text-[11px]">
                          ${money(r.debit_rate || r.buying_rate, 2)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[9px] text-slate-400 font-mono">
                          {new Date(r.updated_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })}

                  {rates.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                        No exchange rates recorded matching your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
