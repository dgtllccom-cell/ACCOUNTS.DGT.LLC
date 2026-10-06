"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp, Save, RefreshCw, Globe,
  CheckCircle, AlertCircle, Clock, ArrowUpRight, ArrowDownLeft,
  Search, Printer, User, ShieldCheck, History, Edit3, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { apiGet, apiPost } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { openGenericErpReport } from "@/lib/reports/open-generic-erp-report";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

type CountryRate = {
  id: string;
  country_id: string;
  country_branch_id?: string | null;
  user_name?: string;
  branch_name?: string;
  rate_date: string;
  rate_time?: string;
  effective_from?: string | null;
  superseded_at?: string | null;
  currency_code?: string | null;
  buying_rate: number;
  selling_rate: number;
  credit_rate: number;
  debit_rate: number;
  updated_at: string;
  countries?: { id?: string; name: string; currency_code: string; iso2?: string | null };
};

type CountryStatus = {
  countryId: string;
  countryName: string;
  currencyCode: string;
  iso2: string | null;
  rateDate: string;
  status: "APPROVED" | "PENDING_MISSING";
  creditRate: number | null;
  debitRate: number | null;
  rateTime: string | null;
  enteredBy: string | null;
  updatedAt: string | null;
};

type AuditRecord = {
  id: string;
  country_id: string;
  from_currency: string;
  to_currency: string;
  old_rate?: number | null;
  old_credit_rate?: number | null;
  old_debit_rate?: number | null;
  new_rate?: number | null;
  new_credit_rate?: number | null;
  new_debit_rate?: number | null;
  effective_date: string;
  changed_by?: string | null;
  user_name?: string | null;
  reason?: string | null;
  created_at: string;
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
  const [countriesStatus, setCountriesStatus] = useState<CountryStatus[]>([]);
  const [auditHistory, setAuditHistory] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"rates" | "audit">("rates");

  // Form Fields State
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [rateDate, setRateDate] = useState<string>(isoToday());
  const [rateTime, setRateTime] = useState<string>(currentTimeString());
  const [creditPrice, setCreditPrice] = useState<string>("");
  const [debitPrice, setDebitPrice] = useState<string>("");
  const [correctionReason, setCorrectionReason] = useState<string>("");
  const [operatorUser, setOperatorUser] = useState<string>("");

  // Table Filter & Search State
  const [filterCountryId, setFilterCountryId] = useState<string>("all");
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

  const isSuperAdmin = Boolean(sessionInfo?.scopes?.isSuperAdmin);
  const userCountryId = sessionInfo?.scopes?.summary?.countryId || sessionInfo?.scopes?.countryIds?.[0] || "";

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCountryId && filterCountryId !== "all") params.set("countryId", filterCountryId);
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
      if (ratesRes?.countriesStatus) setCountriesStatus(ratesRes.countriesStatus);
      if (ratesRes?.auditHistory) setAuditHistory(ratesRes.auditHistory);

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

      const availableCountries = cleanCountries.length > 0 ? cleanCountries : fallbackCountry;
      setCountries(availableCountries);
      setSessionInfo(sessionRes);

      if (!operatorUser) {
        setOperatorUser(sessionRes?.user?.fullName || sessionRes?.user?.email || "Country Admin");
      }

      // Lock country for Country Admin; allow Super Admin to select
      const isSuper = Boolean(sessionRes?.scopes?.isSuperAdmin);
      const scopedCountryId = sessionRes?.scopes?.summary?.countryId || sessionRes?.scopes?.countryIds?.[0] || "";
      const defaultId = isSuper
        ? selectedCountryId || availableCountries[0]?.id || scopedCountryId
        : scopedCountryId || availableCountries[0]?.id || "";

      if (defaultId && (!selectedCountryId || !isSuper)) {
        setSelectedCountryId(defaultId);
      }
    } catch (err) {
      console.error("Failed to load exchange rates:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [filterCountryId, dateFrom, dateTo, searchQuery]);

  // Selected Country Master Data
  const selectedCountry = useMemo(() => {
    return countries.find((c) => c.id === selectedCountryId) || null;
  }, [countries, selectedCountryId]);

  // Check if a rate ALREADY exists for the selected country on the selected date
  const existingRateForTargetDate = useMemo(() => {
    if (!selectedCountryId || !rateDate) return null;
    return rates.find((r) => r.country_id === selectedCountryId && r.rate_date === rateDate && !r.superseded_at) || null;
  }, [rates, selectedCountryId, rateDate]);

  const isCorrectionMode = Boolean(existingRateForTargetDate);

  // When selected country or date changes, prefill current rates if available
  useEffect(() => {
    if (existingRateForTargetDate) {
      setCreditPrice(String(existingRateForTargetDate.credit_rate || existingRateForTargetDate.selling_rate));
      setDebitPrice(String(existingRateForTargetDate.debit_rate || existingRateForTargetDate.buying_rate));
      if (existingRateForTargetDate.rate_time) setRateTime(existingRateForTargetDate.rate_time);
    } else {
      setCreditPrice("");
      setDebitPrice("");
      setCorrectionReason("");
      setRateTime(currentTimeString());
    }
  }, [existingRateForTargetDate, selectedCountryId, rateDate]);

  // Countries missing today's rate
  const countriesPendingTodayRate = useMemo(() => {
    const today = isoToday();
    const scopedCountryIds = sessionInfo?.scopes?.isSuperAdmin
      ? null
      : sessionInfo?.scopes?.countryIds ?? null;
    const scoped = scopedCountryIds
      ? countries.filter((c) => scopedCountryIds.includes(c.id))
      : countries;
    const haveTodayRate = new Set(
      rates.filter((r) => r.rate_date === today && !r.superseded_at).map((r) => r.country_id)
    );
    return scoped.filter((c) => !haveTodayRate.has(c.id));
  }, [countries, rates, sessionInfo]);

  async function handleSaveRate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCountryId || !selectedCountry) {
      setMessage({ type: "error", text: "Please select a valid country." });
      return;
    }

    const credit = Number(creditPrice);
    const debit = Number(debitPrice);

    if (!creditPrice || Number.isNaN(credit) || credit <= 0) {
      setMessage({ type: "error", text: `Please enter a valid Credit (Selling) rate (> 0) in ${selectedCountry.currency_code} per USD.` });
      return;
    }

    if (!debitPrice || Number.isNaN(debit) || debit <= 0) {
      setMessage({ type: "error", text: `Please enter a valid Debit (Buying) rate (> 0) in ${selectedCountry.currency_code} per USD.` });
      return;
    }

    if (isCorrectionMode && !correctionReason.trim()) {
      setMessage({ type: "error", text: "Reason for rate correction is mandatory to maintain an authorized audit history." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await apiPost<any>("/api/erp/currency/daily-rates", {
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
        userName: operatorUser || sessionInfo?.user?.fullName || sessionInfo?.user?.email || "Country Admin",
        reason: isCorrectionMode ? correctionReason.trim() : "Initial daily exchange rate entry",
        action: isCorrectionMode ? "correct" : "create",
      });

      setMessage({
        type: "success",
        text: isCorrectionMode
          ? `Exchange rate for ${selectedCountry.name} corrected successfully with complete audit log (Credit: ${credit}, Debit: ${debit} ${selectedCountry.currency_code}/$).`
          : `Today's exchange rate for ${selectedCountry.name} confirmed and published country-wide (Credit: ${credit}, Debit: ${debit} ${selectedCountry.currency_code}/$).`,
      });

      setCorrectionReason("");
      await loadData();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to save exchange rate." });
    } finally {
      setSaving(false);
    }
  }

  function handleSelectRow(rate: CountryRate) {
    if (isSuperAdmin || rate.country_id === userCountryId) {
      setSelectedCountryId(rate.country_id);
      if (rate.rate_date) setRateDate(rate.rate_date);
      if (rate.rate_time) setRateTime(rate.rate_time);
      setCreditPrice(String(rate.credit_rate || rate.selling_rate));
      setDebitPrice(String(rate.debit_rate || rate.buying_rate));
    }
  }

  function handlePrintTable() {
    const reportRows = rates.map((rate) => ({
      date: rate.rate_date,
      effective: (rate as any).effective_from
        ? new Date((rate as any).effective_from).toLocaleString()
        : `${rate.rate_date} ${rate.rate_time || ""}`,
      country: rate.countries?.name || countries.find((country) => country.id === rate.country_id)?.name || "-",
      branch: "Country-wide (All Branches)",
      currency: (rate as any).currency_code || rate.countries?.currency_code || "-",
      user: rate.user_name || "-",
      debitRate: rate.debit_rate,
      creditRate: rate.credit_rate,
      status: (rate as any).superseded_at ? "Superseded" : "Active",
    }));

    openGenericErpReport({
      title: "DAILY EXCHANGE RATE — HISTORY & AUDIT",
      subtitle: "Official ERP Country Exchange Rates. Historical transactions lock the rate effective at posting date.",
      lang,
      columns: [
        { key: "effective", label: "Date & Time" },
        { key: "country", label: "Country" },
        { key: "currency", label: "Currency", align: "center" },
        { key: "debitRate", label: "Debit Rate (Buying)", format: "number", align: "right" },
        { key: "creditRate", label: "Credit Rate (Selling)", format: "number", align: "right" },
        { key: "user", label: "Entered / Approved By" },
        { key: "status", label: "Status", format: "status", align: "center" },
      ],
      rows: reportRows,
      summary: {
        totalEntries: reportRows.length,
        filteredCountries: filterCountryId === "all" ? countries.length : 1,
      },
      filters: [
        { label: "Country", value: filterCountryId === "all" ? "All Countries" : selectedCountry?.name || "Selected" },
        { label: "From Date", value: dateFrom || "Start" },
        { label: "To Date", value: dateTo || "Today" },
      ],
      companyInfo: {
        name: "ACCOUNTS.DGT.LLC ERP",
        printedBy: operatorUser || sessionInfo?.user?.fullName || "ERP User",
        country: selectedCountry?.name || "All Countries",
        reportPeriod: dateFrom || dateTo ? `${dateFrom || "Start"} To ${dateTo || "Today"}` : "Current Period",
      },
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
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5 text-emerald-600", loading && "animate-spin")} />
            {th("Refresh Rates")}
          </Button>
        </div>,
        actionsSlot
      )}

      {/* ── Rule 5 & 6 Info Banner: No Double Conversion & Base Reporting Rule ── */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 shadow-xs">
        <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-black uppercase tracking-wide">
            {th("ERP-WIDE EXCHANGE RATE POLICY & ZERO DOUBLE-CONVERSION GUARANTEE")}
          </span>
          <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90">
            Country Admin enters the authoritative Country Rate once daily. All branches, business operations, shipping lines, and Roznamcha automatically consume this approved rate. Operations remain in local currency, while Super Admin consolidated reporting automatically uses historical rate: <span className="font-mono font-bold">USD Base = Local Amount ÷ Daily Rate</span>.
          </p>
        </div>
      </div>

      {/* ── Rule 7: Country Status Board ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-150 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              {isSuperAdmin ? th("GLOBAL COUNTRY DAILY RATE STATUS BOARD") : th("TODAY'S COUNTRY RATE STATUS")}
            </h3>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              ({isoToday()})
            </span>
          </div>
          {countriesPendingTodayRate.length > 0 ? (
            <span className="text-[10px] font-black uppercase bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-2.5 py-0.5 rounded-full border border-red-300 dark:border-red-800 flex items-center gap-1.5 animate-pulse">
              <AlertCircle className="w-3 h-3" />
              {countriesPendingTodayRate.length} {th("COUNTRY RATE(S) PENDING / MISSING")}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3" />
              {th("ALL SCOPED RATES APPROVED TODAY")}
            </span>
          )}
        </div>

        {/* Status Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {countriesStatus.map((cs) => {
            const isPending = cs.status === "PENDING_MISSING";
            const isSelected = cs.countryId === selectedCountryId;
            return (
              <div
                key={cs.countryId}
                onClick={() => {
                  if (isSuperAdmin || cs.countryId === userCountryId) {
                    setSelectedCountryId(cs.countryId);
                    setRateDate(isoToday());
                  }
                }}
                className={cn(
                  "p-3 rounded-xl border transition-all cursor-pointer relative",
                  isSelected
                    ? "border-blue-600 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20 ring-2 ring-blue-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-slate-300",
                  isPending && "border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10"
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{getFlag(cs.iso2)}</span>
                    <span className="text-xs font-black uppercase text-slate-900 dark:text-white">
                      {cs.countryName}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] font-extrabold bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                    {cs.currencyCode}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[10px] font-semibold text-slate-500">
                    {th("Status:")}
                  </span>
                  {isPending ? (
                    <span className="font-black text-[9px] uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800">
                      {th("PENDING / MISSING")}
                    </span>
                  ) : (
                    <span className="font-black text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      {th("APPROVED / ACTIVE")}
                    </span>
                  )}
                </div>

                {!isPending && cs.creditRate && cs.debitRate ? (
                  <div className="grid grid-cols-2 gap-1 text-[10px] font-mono pt-1 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[8px] uppercase">CR (Sell)</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{money(cs.creditRate, 2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[8px] uppercase">DR (Buy)</span>
                      <span className="font-bold text-blue-700 dark:text-blue-400">{money(cs.debitRate, 2)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-red-600 font-semibold italic pt-1 border-t border-red-100 dark:border-red-950">
                    {th("Waiting for Country Admin...")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── Left Column (4 Cols): Rate Entry & Controlled Correction Form ── */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-150 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              {isCorrectionMode ? th("CONTROLLED RATE CORRECTION") : th("EXCHANGE RATE ENTRY FORM")}
            </h3>
            {isCorrectionMode ? (
              <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                <Edit3 className="w-3 h-3" />
                {th("AUDITED CORRECTION")}
              </span>
            ) : (
              <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                {th("NEW DAILY RATE")}
              </span>
            )}
          </div>

          {/* Controlled Correction Notice */}
          {isCorrectionMode && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-black uppercase text-[10px]">
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                {th("Rate already recorded for this date")}
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Current active rates: <strong>Credit {money(existingRateForTargetDate?.credit_rate || 0, 2)}</strong> | <strong>Debit {money(existingRateForTargetDate?.debit_rate || 0, 2)}</strong>. Enter new values and a mandatory reason below.
              </p>
            </div>
          )}

          <form onSubmit={handleSaveRate} className="space-y-3.5">
            
            {/* 1. Country Selection (Locked for Country Admin; selectable for Super Admin) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>{th("1. COUNTRY")} {!isSuperAdmin && <span className="text-blue-600 font-bold">(Locked to your country)</span>}</span>
                {selectedCountry && (
                  <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                    Currency: {selectedCountry.currency_code}
                  </span>
                )}
              </Label>
              <select
                value={selectedCountryId}
                disabled={!isSuperAdmin && countries.length <= 1}
                onChange={(e) => setSelectedCountryId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-100 shadow-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer uppercase disabled:opacity-85 disabled:cursor-not-allowed"
              >
                <option value="" disabled hidden>
                  {countries.length ? "-- SELECT COUNTRY --" : "NO COUNTRIES AVAILABLE"}
                </option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold py-1">
                    {getFlag(c.iso2)} {c.name} ({c.currency_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Scope allocation indicator: Country-wide, no branch duplication */}
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px]">
              <span className="text-slate-500 font-bold uppercase">{th("Scope Allocation:")}</span>
              <span className="font-extrabold text-blue-700 dark:text-blue-400 uppercase">
                {th("Country-wide (All Branches)")}
              </span>
            </div>

            {/* 2. Date & Time 2-col Row */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                  {th("2. TRANSACTION DATE")}
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
                  placeholder="e.g. 10:49 AM"
                  value={rateTime}
                  onChange={(e) => setRateTime(e.target.value)}
                  className="h-9 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            {/* Operator User */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                {th("OPERATOR / COUNTRY ADMIN")}
              </Label>
              <Input
                type="text"
                value={operatorUser}
                onChange={(e) => setOperatorUser(e.target.value)}
                className="h-9 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800"
              />
            </div>

            {/* 3. Credit Rate (Selling / Outflow) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {selectedCountry ? `4. CREDIT RATE (SELLING RATE)` : th("4. CREDIT RATE (LOCAL PER USD)")}
                </span>
                <span className="text-[9px] font-bold text-slate-400">
                  {selectedCountry ? `1 USD = ? ${selectedCountry.currency_code}` : "Local / USD"}
                </span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder={selectedCountry ? `e.g. Rate in ${selectedCountry.currency_code}` : "Select country first"}
                  value={creditPrice}
                  onChange={(e) => setCreditPrice(e.target.value)}
                  className="h-10 text-xs font-black font-mono text-emerald-700 dark:text-emerald-400 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 focus:border-emerald-500 pr-24"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-mono font-black text-emerald-700 dark:text-emerald-400">
                  {selectedCountry ? `${selectedCountry.currency_code} / $` : "LOCAL / $"}
                </span>
              </div>
              {selectedCountry && creditPrice && Number(creditPrice) > 0 && (
                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  ⚡ 1.00 USD = {money(Number(creditPrice), 2)} {selectedCountry.currency_code} (Credit / Selling)
                </p>
              )}
            </div>

            {/* 4. Debit Rate (Buying / Inflow) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-blue-700 dark:text-blue-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  {selectedCountry ? `5. DEBIT RATE (BUYING RATE)` : th("5. DEBIT RATE (LOCAL PER USD)")}
                </span>
                <span className="text-[9px] font-bold text-slate-400">
                  {selectedCountry ? `1 USD = ? ${selectedCountry.currency_code}` : "Local / USD"}
                </span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder={selectedCountry ? `e.g. Rate in ${selectedCountry.currency_code}` : "Select country first"}
                  value={debitPrice}
                  onChange={(e) => setDebitPrice(e.target.value)}
                  className="h-10 text-xs font-black font-mono text-blue-700 dark:text-blue-400 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 focus:border-blue-500 pr-24"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-mono font-black text-blue-700 dark:text-blue-400">
                  {selectedCountry ? `${selectedCountry.currency_code} / $` : "LOCAL / $"}
                </span>
              </div>
              {selectedCountry && debitPrice && Number(debitPrice) > 0 && (
                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400">
                  ⚡ 1.00 USD = {money(Number(debitPrice), 2)} {selectedCountry.currency_code} (Debit / Buying)
                </p>
              )}
            </div>

            {/* Mandatory Reason for Rate Correction */}
            {isCorrectionMode && (
              <div className="space-y-1 animate-in fade-in duration-200">
                <Label className="text-[11px] font-black uppercase text-amber-700 dark:text-amber-400 flex items-center justify-between">
                  <span>{th("REASON FOR CORRECTION (MANDATORY)")}</span>
                  <span className="text-[9px] font-bold text-red-500">* Required for audit</span>
                </Label>
                <textarea
                  rows={2}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Central Bank revised closing rate, or corrected entry typo..."
                  className="w-full text-xs font-medium p-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={saving}
              className={cn(
                "w-full h-10 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 pt-1",
                isCorrectionMode
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : isCorrectionMode ? <Edit3 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving
                ? th("SAVING EXCHANGE RATE...")
                : isCorrectionMode
                ? th("SAVE AUTHORIZED CORRECTION")
                : th("CONFIRM & PUBLISH TODAY'S RATE")}
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

        {/* ── Right Column (8 Cols): Tables & Audit History Tabs ── */}
        <div className="lg:col-span-8 space-y-3">
          
          {/* Header Controls Bar */}
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={activeTab === "rates" ? "default" : "outline"}
                  onClick={() => setActiveTab("rates")}
                  className={cn(
                    "h-8 text-xs font-black uppercase rounded-lg",
                    activeTab === "rates" ? "bg-emerald-600 text-white" : "text-slate-600"
                  )}
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  {th("Active Daily Rates")}
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "audit" ? "default" : "outline"}
                  onClick={() => setActiveTab("audit")}
                  className={cn(
                    "h-8 text-xs font-black uppercase rounded-lg",
                    activeTab === "audit" ? "bg-blue-600 text-white" : "text-slate-600"
                  )}
                >
                  <History className="w-3.5 h-3.5 mr-1.5" />
                  {th("Audit History")} ({auditHistory.length})
                </Button>
              </div>
              <span className="text-[10px] font-mono font-black bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                {activeTab === "rates" ? `${th("TOTAL ENTRIES:")} ${rates.length}` : `${th("AUDIT LOGS:")} ${auditHistory.length}`}
              </span>
            </div>

            {/* Filter Dropdowns Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-800 dark:text-slate-100">
              
              {/* Country Filter */}
              <div>
                <select
                  value={filterCountryId}
                  onChange={(e) => setFilterCountryId(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer uppercase shadow-xs"
                >
                  <option value="all">{th("ALL COUNTRIES")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold py-1">
                      {c.name} ({c.currency_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date range */}
              <div>
                <ErpDatePicker
                  mode="range"
                  lang={lang}
                  size="sm"
                  value={{ from: dateFrom || null, to: dateTo || null }}
                  onApply={(v) => {
                    setDateFrom(v.from ?? "");
                    setDateTo(v.to ?? "");
                  }}
                />
              </div>

              {/* Search Query */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <Input
                  type="text"
                  placeholder={th("Search country, user...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-[11px] font-bold pl-8 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-lg placeholder:text-slate-400 shadow-xs"
                />
              </div>

            </div>
          </div>

          {/* Tab 1: Consolidated Rates Table */}
          {activeTab === "rates" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[9px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                      <th className="py-2.5 px-3 text-center">{th("SR NO")}</th>
                      <th className="py-2.5 px-3">{th("COUNTRY")}</th>
                      <th className="py-2.5 px-3 text-center">{th("CURRENCY")}</th>
                      <th className="py-2.5 px-3">{th("DATE & TIME")}</th>
                      <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">{th("CREDIT RATE (SELLING)")}</th>
                      <th className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">{th("DEBIT RATE (BUYING)")}</th>
                      <th className="py-2.5 px-3">{th("OPERATOR")}</th>
                      <th className="py-2.5 px-3 text-center">{th("SCOPE")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                    {rates.map((r, idx) => {
                      const matchedCountry = countries.find((country) => country.id === r.country_id) || null;
                      const countryName = r.countries?.name ?? matchedCountry?.name ?? "-";
                      const currencyCode = r.countries?.currency_code ?? matchedCountry?.currency_code ?? "-";
                      const iso2 = r.countries?.iso2 ?? matchedCountry?.iso2;
                      const isSelected = r.country_id === selectedCountryId && r.rate_date === rateDate;

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
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[9px]">
                              {currencyCode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                            {r.rate_date || isoToday()} {r.rate_time || "09:00 AM"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-[11px]">
                            {money(r.credit_rate || r.selling_rate, 2)} {currencyCode}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400 text-[11px]">
                            {money(r.debit_rate || r.buying_rate, 2)} {currencyCode}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[10px] text-slate-700 dark:text-slate-300 uppercase">
                            {r.user_name || "Country Admin"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              Country-wide
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {rates.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                          {th("NO EXCHANGE RATES RECORDED MATCHING YOUR SEARCH CRITERIA.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Controlled Audit History Table (Requirement 8) */}
          {activeTab === "audit" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {th("CONTROLLED CORRECTION AUDIT TRAIL (OLD RATE → NEW RATE → REASON)")}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {th("All authorized changes are permanently logged.")}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[9px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                      <th className="py-2.5 px-3 text-center">{th("DATE / TIME")}</th>
                      <th className="py-2.5 px-3">{th("COUNTRY")}</th>
                      <th className="py-2.5 px-3">{th("OPERATOR")}</th>
                      <th className="py-2.5 px-3 text-right">{th("PREVIOUS RATE (CR / DR)")}</th>
                      <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">{th("REVISED RATE (CR / DR)")}</th>
                      <th className="py-2.5 px-3">{th("REASON FOR CHANGE")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                    {auditHistory.map((ah, idx) => (
                      <tr key={ah.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                          {new Date(ah.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[11px] whitespace-nowrap">
                          {ah.countries?.name || countries.find(c => c.id === ah.country_id)?.name || "-"} ({ah.from_currency})
                        </td>
                        <td className="py-2.5 px-3 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {ah.user_name || "Country Admin"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[10px] text-slate-500 whitespace-nowrap">
                          {ah.old_credit_rate != null
                            ? `${money(ah.old_credit_rate, 2)} / ${money(ah.old_debit_rate || 0, 2)}`
                            : ah.old_rate != null ? money(ah.old_rate, 2) : "Initial Entry"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px] whitespace-nowrap">
                          {ah.new_credit_rate != null
                            ? `${money(ah.new_credit_rate, 2)} / ${money(ah.new_debit_rate || 0, 2)}`
                            : money(ah.new_rate || 0, 2)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-800 dark:text-slate-200 max-w-xs truncate">
                          {ah.reason || "-"}
                        </td>
                      </tr>
                    ))}

                    {auditHistory.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                          {th("NO AUDIT RECORDS FOUND.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
