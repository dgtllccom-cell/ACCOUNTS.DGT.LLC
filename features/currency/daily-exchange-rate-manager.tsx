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
import { openGenericErpReport } from "@/lib/reports/open-generic-erp-report";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

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

type SessionInfo = {
  user?: { fullName?: string | null; email?: string | null };
  scopes?: {
    isSuperAdmin?: boolean;
    countryIds?: string[];
    summary?: {
      countryId?: string | null;
      countryName?: string | null;
      branchDisplayName?: string | null;
      scopeLabel?: string | null;
    };
  };
};

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
  const c = iso2.toUpperCase();
  if (c === "PK") return "🇵🇰";
  if (c === "AE") return "🇦🇪";
  if (c === "AF") return "🇦🇫";
  if (c === "SA") return "🇸🇦";
  if (c === "US") return "🇺🇸";
  if (c === "CN") return "🇨🇳";
  if (c === "IN") return "🇮🇳";
  if (c === "IR") return "🇮🇷";
  if (c === "OM") return "🇴🇲";
  if (c === "GB" || c === "UK") return "🇬🇧";
  if (c.length === 2) {
    return c
      .split("")
      .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
      .join("");
  }
  return "🌐";
}

export function DailyExchangeRateManager() {
  const lang = useActiveLanguage();
  const th = (label: string) => translateHeader(lang, label);
  const [rates, setRates] = useState<CountryRate[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  // Form Fields State
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [rateDate, setRateDate] = useState<string>(isoToday());
  const [rateTime, setRateTime] = useState<string>(currentTimeString());
  const [creditPrice, setCreditPrice] = useState<string>("");
  const [debitPrice, setDebitPrice] = useState<string>("");
  const [operatorUser, setOperatorUser] = useState<string>("");
  const [operatorBranch, setOperatorBranch] = useState<string>("");

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

      const [ratesRes, countriesRes, sessionRes] = await Promise.all([
        apiGet<any>(`/api/erp/currency/daily-rates?${params.toString()}`),
        apiGet<any>("/api/erp/locations/countries?all=true&limit=100"),
        apiGet<SessionInfo>("/api/erp/auth/session"),
      ]);
      
      const ratesList: CountryRate[] = Array.isArray(ratesRes) 
        ? ratesRes 
        : ratesRes?.rates ?? ratesRes?.data ?? [];
      
      setRates(ratesList);

      const fetchedCountries: CountryOption[] = Array.isArray(countriesRes)
        ? countriesRes
        : countriesRes?.countries ?? countriesRes?.data ?? [];
      const cleanCountries = fetchedCountries.filter((c) => {
        const n = (c.name || "").toUpperCase();
        return !n.startsWith("QA ") && !n.includes("QA COUNTRY") && !n.startsWith("DEVTEST") && !n.startsWith("DEV-DEMO");
      });
      const fallbackCountry =
        cleanCountries.length === 0 && sessionRes?.scopes?.summary?.countryId && sessionRes?.scopes?.summary?.countryName
          ? [{
              id: sessionRes.scopes.summary.countryId,
              name: sessionRes.scopes.summary.countryName,
              currency_code: "N/A",
              iso2: null
            }]
          : [];
      setCountries(cleanCountries.length > 0 ? cleanCountries : fallbackCountry);
      setSessionInfo(sessionRes);

      if (!operatorUser) {
        setOperatorUser(sessionRes?.user?.fullName || sessionRes?.user?.email || "ERP USER");
      }
      if (!operatorBranch) {
        setOperatorBranch(sessionRes?.scopes?.summary?.branchDisplayName || sessionRes?.scopes?.summary?.scopeLabel || "");
      }

      const scopedCountryId = sessionRes?.scopes?.summary?.countryId || sessionRes?.scopes?.countryIds?.[0] || "";
      const defaultCountryId = sessionRes?.scopes?.isSuperAdmin
        ? fetchedCountries[0]?.id || fallbackCountry[0]?.id || scopedCountryId
        : scopedCountryId || fetchedCountries[0]?.id || fallbackCountry[0]?.id || "";

      if (!selectedCountryId && defaultCountryId) {
        setSelectedCountryId(defaultCountryId);
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
    return countries.find(c => c.id === selectedCountryId) || null;
  }, [countries, selectedCountryId]);

  const branchOptions = useMemo(() => {
    return [...new Set(rates.map((rate) => rate.branch_name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
  }, [rates]);

  useEffect(() => {
    if (!selectedCountryId || !selectedCountry) return;
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
      else { setCreditPrice(""); setDebitPrice(""); }
      setRateTime(currentTimeString());
    }
  }, [rates, selectedCountry, selectedCountryId]);

  async function handleSaveRate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCountry) {
      setMessage({ type: "error", text: "Please select a country first." });
      return;
    }
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
      user_name: operatorUser || sessionInfo?.user?.fullName || sessionInfo?.user?.email || "ERP USER",
      branch_name: operatorBranch || sessionInfo?.scopes?.summary?.branchDisplayName || "",
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
        userName: operatorUser || sessionInfo?.user?.fullName || sessionInfo?.user?.email || "ERP USER",
        branchName: operatorBranch || sessionInfo?.scopes?.summary?.branchDisplayName || ""
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
    const reportRows = rates.map((rate) => ({
      date: rate.rate_date,
      country: rate.countries?.name || countries.find((country) => country.id === rate.country_id)?.name || "-",
      branch: rate.branch_name || "-",
      user: rate.user_name || "-",
      buyingRate: rate.buying_rate,
      sellingRate: rate.selling_rate,
      creditRate: rate.credit_rate,
      debitRate: rate.debit_rate,
      currency: rate.countries?.currency_code || rate.countries?.iso2 || "-"
    }));

    openGenericErpReport({
      title: "EXCHANGE RATE REPORT",
      subtitle: "Daily exchange rate management and branch-level updates",
      lang: "en",
      columns: [
        { key: "date", label: "Date", format: "date" },
        { key: "country", label: "Country" },
        { key: "branch", label: "Branch" },
        { key: "user", label: "User" },
        { key: "buyingRate", label: "Buying Rate", format: "number", align: "right" },
        { key: "sellingRate", label: "Selling Rate", format: "number", align: "right" },
        { key: "creditRate", label: "Credit Rate", format: "number", align: "right" },
        { key: "debitRate", label: "Debit Rate", format: "number", align: "right" },
        { key: "currency", label: "Currency", align: "center" }
      ],
      rows: reportRows,
      summary: {
        totalEntries: reportRows.length,
        filteredCountries: filterCountryId === "all" ? countries.length : 1,
        branchScope: filterBranch === "all" ? branchOptions.length : 1
      },
      filters: [
        { label: "Country", value: filterCountryId === "all" ? "All Countries" : selectedCountry?.name || countries.find((country) => country.id === filterCountryId)?.name || "Selected Country" },
        { label: "Branch", value: filterBranch === "all" ? "All Branches" : filterBranch },
        { label: "From Date", value: dateFrom || "Start" },
        { label: "To Date", value: dateTo || "Today" },
        { label: "Search", value: searchQuery || "No search filter" }
      ],
      companyInfo: {
        name: "DIGITAL DOCK ERP",
        printedBy: operatorUser || sessionInfo?.user?.fullName || sessionInfo?.user?.email || "ERP User",
        country: filterCountryId === "all" ? "All Countries" : selectedCountry?.name || countries.find((country) => country.id === filterCountryId)?.name || "Selected Country",
        branch: filterBranch === "all" ? "All Branches" : filterBranch,
        reportPeriod: dateFrom || dateTo ? `${dateFrom || "Start"} To ${dateTo || "Today"}` : "Current Period"
      }
    });
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* ── ERP Top Header Title Portal ── */}
      {titleSlot && createPortal(
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
            {th("DAILY EXCHANGE RATE MANAGEMENT")}
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
            {th("Print Rate Table")}
          </Button>
          <Button
            onClick={loadData}
            variant="outline"
            className="h-8 text-[11px] font-black uppercase bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            {th("Refresh Rates")}
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
              {th("EXCHANGE RATE ENTRY FORM")}
            </h3>
            <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
              {th("INTRA-DAY LIVE ENTRY")}
            </span>
          </div>

          <form onSubmit={handleSaveRate} className="space-y-3.5">
            
            {/* 1. Country Selection */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                {th("1. COUNTRY NAME")}
              </Label>
              <select
                value={selectedCountryId}
                onChange={(e) => setSelectedCountryId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-all uppercase"
              >
                <option value="">{countries.length ? "SELECT COUNTRY" : "NO COUNTRIES AVAILABLE"}</option>
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
                  {th("2. DATE")}
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
                  {th("3. TIME")}
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
                  {th("OPERATOR USER")}
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
                  {th("BRANCH NAME")}
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
                {th("4. CREDIT DOLLAR PRICE ($)")}
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
                  {selectedCountry?.currency_code || "---"}
                </span>
              </div>
            </div>

            {/* 4. Debit Dollar Price ($) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                {th("5. DEBIT DOLLAR PRICE ($)")}
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
                  {selectedCountry?.currency_code || "---"}
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
              {saving ? th("SAVING EXCHANGE RATE...") : th("SAVE EXCHANGE RATE")}
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
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Clock className="w-4 h-4" />
                  {th("SUPER ADMIN LIVE EXCHANGE RATES TABLE")}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Audited intra-day exchange rates recorded by users and branch terminals worldwide.
                </p>
              </div>
              <span className="text-[10px] font-mono font-black bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                {th("TOTAL ENTRIES:")} {rates.length}
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
                  <option value="all">{th("ALL COUNTRIES")}</option>
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
                  <option value="all">{th("ALL BRANCHES")}</option>
                  {branchOptions.map((branchName) => (
                    <option key={branchName} value={branchName}>{branchName}</option>
                  ))}
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
                  placeholder={th("Search user, branch...")}
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
                    <th className="py-2.5 px-3 text-center">{th("SR NO")}</th>
                    <th className="py-2.5 px-3">{th("COUNTRY NAME")}</th>
                    <th className="py-2.5 px-3">{th("BRANCH NAME")}</th>
                    <th className="py-2.5 px-3">{th("USER NAME")}</th>
                    <th className="py-2.5 px-3 text-center">{th("CURRENCY")}</th>
                    <th className="py-2.5 px-3">{th("DATE & TIME")}</th>
                    <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">{th("CREDIT RATE ($)")}</th>
                    <th className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">{th("DEBIT RATE ($)")}</th>
                    <th className="py-2.5 px-3 text-right">{th("LAST UPDATED")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                  {rates.map((r, idx) => {
                    const matchedCountry = countries.find((country) => country.id === r.country_id) || null;
                    const countryName = r.countries?.name ?? matchedCountry?.name ?? "-";
                    const currencyCode = r.countries?.currency_code ?? matchedCountry?.currency_code ?? "-";
                    const iso2 = r.countries?.iso2 ?? matchedCountry?.iso2;
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
                          {r.branch_name || "-"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[10px] text-blue-700 dark:text-blue-400 uppercase">
                          {r.user_name || "-"}
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
                        {th("NO EXCHANGE RATES RECORDED MATCHING YOUR SEARCH CRITERIA.")}
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
