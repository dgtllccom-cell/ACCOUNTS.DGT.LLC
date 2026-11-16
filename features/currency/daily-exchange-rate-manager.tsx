"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp, Save, RefreshCw, Globe,
  CheckCircle, AlertCircle, Clock, ArrowUpRight, ArrowDownLeft,
  Search, Printer, User, Building2, ChevronDown, Plus, Minus, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { apiGet, apiPost } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { openGenericErpReport } from "@/lib/reports/open-generic-erp-report";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { Th } from "@/components/ui/translated-th";

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
  countries?: { name: string; currency_code: string; iso2?: string | null };
};

type CountryOption = {
  id: string;
  name: string;
  currency_code: string;
  iso2: string | null;
};

// Whole-scope status for the requested date (from the server; not affected by the table filters).
type CountryStatus = {
  countryId: string;
  status: "APPROVED" | "PENDING_MISSING";
  rateDate: string;
  creditRate: number | null;
  debitRate: number | null;
};

// Latest APPROVED (active) rate per country, with its own date. Source for the carry-forward and the summary.
type LatestApproved = {
  countryId: string;
  countryName: string;
  currencyCode: string;
  iso2: string | null;
  rateId: string;
  rateDate: string;
  rateTime: string | null;
  creditRate: number;
  debitRate: number;
  enteredBy: string | null;
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

// The operator's own calendar date (Dubai for UAE operators). toISOString() is UTC, which still reads
// yesterday between 00:00 and 04:00 in Dubai, so a rate entered at 01:26 AM was filed under the previous day.
function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// USD is the base currency: 1 USD = 1.0000 USD by definition, so it never needs a daily rate.
const isBaseCurrency = (code: string | null | undefined) => String(code || "").toUpperCase() === "USD";

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
  const branchLabel = (name: string) => name === "Country-wide (All Branches)" ? t(lang, "fx.country_wide_all_branches", name) : name === "Country level" ? t(lang, "fx.country_level", name) : name;
  const [rates, setRates] = useState<CountryRate[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [countriesStatus, setCountriesStatus] = useState<CountryStatus[]>([]);
  const [latestApproved, setLatestApproved] = useState<LatestApproved[]>([]);
  const [carryTarget, setCarryTarget] = useState<string | null>(null);
  // Set when the server says a rate already exists for this date: the form then asks for a reason and corrects it.
  const [correctionNeeded, setCorrectionNeeded] = useState(false);

  // Form Fields State
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [rateDate, setRateDate] = useState<string>(isoToday());
  const [rateTime, setRateTime] = useState<string>(currentTimeString());
  const [creditPrice, setCreditPrice] = useState<string>("");
  const [debitPrice, setDebitPrice] = useState<string>("");
  const [correctionReason, setCorrectionReason] = useState("");
  const existingSelectedRate = rates.find((r) => r.country_id === selectedCountryId && r.rate_date === rateDate && !r.superseded_at);
  const [operatorUser, setOperatorUser] = useState<string>("");
  const [operatorBranch, setOperatorBranch] = useState<string>("");

  // Table Filter & Search State
  const [filterCountryId, setFilterCountryId] = useState<string>("all");

  // Rates table is grouped by date: one summary row per date, tap "+" to reveal that day's full rate table (collapsed by default).
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const ratesByDate = useMemo(() => {
    const groups = new Map<string, typeof rates>();
    for (const r of rates) {
      const d = r.rate_date || isoToday();
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(r);
    }
    return [...groups.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  }, [rates]);
  const didInitExpand = useRef(false);
  useEffect(() => {
    if (!didInitExpand.current && ratesByDate.length) {
      setExpandedDates(new Set([ratesByDate[0][0]]));
      didInitExpand.current = true;
    }
  }, [ratesByDate]);
  const toggleDate = (d: string) =>
    setExpandedDates((prev) => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });
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
      // The operator's local date: the server's whole-scope status and latest rates are computed for this day.
      params.set("today", isoToday());

      const [ratesRes, countriesRes, sessionRes] = await Promise.all([
        apiGet<any>(`/api/erp/currency/daily-rates?${params.toString()}`),
        apiGet<any>("/api/erp/locations/countries?all=true&limit=100"),
        apiGet<SessionInfo>("/api/erp/auth/session"),
      ]);
      
      const ratesList: CountryRate[] = Array.isArray(ratesRes) 
        ? ratesRes 
        : ratesRes?.rates ?? ratesRes?.data ?? [];
      
      setRates(ratesList);
      setCountriesStatus(Array.isArray(ratesRes?.countriesStatus) ? ratesRes.countriesStatus : []);
      setLatestApproved(Array.isArray(ratesRes?.latestApproved) ? ratesRes.latestApproved : []);

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
      const visibleCountries = cleanCountries.length > 0 ? cleanCountries : fallbackCountry;
      const allowedCountries = sessionRes?.scopes?.countryIds ?? [];
      setCountries(sessionRes?.scopes?.isSuperAdmin ? visibleCountries : visibleCountries.filter((country) => allowedCountries.includes(country.id)));
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

  // In-scope countries with NO approved rate dated today (the server's whole-scope status, so the
  // table filters can never make an approved rate look missing). USD is the base currency: never pending.
  const countriesPendingTodayRate = useMemo(() => {
    const approvedToday = new Set(countriesStatus.filter((s) => s.status === "APPROVED").map((s) => s.countryId));
    return countries.filter((c) => !isBaseCurrency(c.currency_code) && !approvedToday.has(c.id));
  }, [countries, countriesStatus]);
  const latestById = useMemo(() => new Map<string, LatestApproved>(latestApproved.map((l) => [l.countryId, l] as const)), [latestApproved]);
  const statusById = useMemo(() => new Map<string, CountryStatus>(countriesStatus.map((s) => [s.countryId, s] as const)), [countriesStatus]);

  useEffect(() => {
    setCorrectionNeeded(false);
  }, [selectedCountryId, rateDate]);

  useEffect(() => {
    if (!selectedCountryId || !selectedCountry) return;
    const existingRate = rates.find(r => r.country_id === selectedCountryId && r.rate_date === rateDate && !r.superseded_at);
    if (existingRate) {
      setCreditPrice(String(existingRate.credit_rate || existingRate.selling_rate));
      setDebitPrice(String(existingRate.debit_rate || existingRate.buying_rate));
      if (existingRate.rate_time) setRateTime(existingRate.rate_time);
      if (existingRate.branch_name) setOperatorBranch(existingRate.branch_name);
    } else {
      // No rate on file yet for this scope — the operator enters the real rate.
      // Never pre-fill a hard-coded placeholder rate.
      setCreditPrice("");
      setDebitPrice("");
      setRateTime(currentTimeString());
    }
  }, [rates, selectedCountry, selectedCountryId, rateDate]);

  async function handleSaveRate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCountryId || !selectedCountry) {
      setMessage({ type: "error", text: "Please select a valid country from the dropdown." });
      return;
    }
    if (isBaseCurrency(selectedCountry.currency_code)) {
      setMessage({ type: "error", text: t(lang, "fx.base_currency_blocked", "{currency} is the base currency: its rate is fixed at 1.0000 and cannot be entered.").replace("{currency}", "USD") });
      return;
    }
    const credit = Number(creditPrice);
    const debit = Number(debitPrice);

    if (!creditPrice || Number.isNaN(credit) || credit <= 0) {
      setMessage({ type: "error", text: `Please enter a valid Credit rate (> 0) in ${selectedCountry.currency_code} per USD.` });
      return;
    }

    if (!debitPrice || Number.isNaN(debit) || debit <= 0) {
      setMessage({ type: "error", text: `Please enter a valid Debit rate (> 0) in ${selectedCountry.currency_code} per USD.` });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await apiPost("/api/erp/currency/daily-rates", {
        countryId: selectedCountryId,
        rateDate: rateDate || isoToday(),
        rateTime: rateTime || currentTimeString(),
        timeZoneOffsetMinutes: new Date(`${rateDate || isoToday()}T12:00:00`).getTimezoneOffset(),
        action: existingSelectedRate || correctionNeeded ? "correct" : "create",
        reason: existingSelectedRate || correctionNeeded ? correctionReason.trim() : undefined,
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
        text: `Exchange Rate Saved & Accepted! (${selectedCountry.name}: Credit ${credit} ${selectedCountry.currency_code}/$ | Debit ${debit} ${selectedCountry.currency_code}/$ by ${operatorUser || "User"})`
      });

      setCorrectionReason("");
      setCorrectionNeeded(false);
      await loadData();
    } catch (err: any) {
      // The table filters may hide an existing rate from this form. The server then says a rate exists,
      // so switch to correction mode (reason required) instead of asking the operator to re-enter everything.
      if (err?.message === "RATE_EXISTS_CORRECTION_REQUIRED") {
        setCorrectionNeeded(true);
        setMessage({ type: "error", text: t(lang, "fx.correction_needed", "A rate already exists for this date. Enter a reason and save again to supersede it.") });
      } else {
        setMessage({ type: "error", text: err?.message || "Failed to save exchange rate." });
      }
    } finally {
      setSaving(false);
    }
  }

  // Carry-forward: copy the latest APPROVED rate to the date selected in the form (today by default) as a new row.
  // Runs only after the operator confirms. The row keeps its source date in carried_forward_from, and the audit reason says so.
  // No rate is invented: if there is no approved source, the button is not offered.
  async function handleCarryForward(c: CountryOption, src: LatestApproved) {
    const target = rateDate || isoToday();
    if (target <= src.rateDate) {
      setCarryTarget(null);
      setMessage({ type: "error", text: t(lang, "fx.carry_target_after_source", "Choose a date after the approved rate date ({source}).").replace("{source}", src.rateDate) });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await apiPost("/api/erp/currency/daily-rates", {
        countryId: c.id,
        rateDate: target,
        rateTime: currentTimeString(),
        timeZoneOffsetMinutes: new Date(`${target}T12:00:00`).getTimezoneOffset(),
        action: "create",
        carriedForwardFrom: src.rateDate,
        reason: `Carried forward from ${src.rateDate} (latest approved rate)`,
        buyingRate: src.debitRate,
        sellingRate: src.creditRate,
        creditRate: src.creditRate,
        debitRate: src.debitRate,
        countryName: c.name,
        currencyCode: c.currency_code,
        iso2: c.iso2,
        userName: operatorUser || sessionInfo?.user?.fullName || sessionInfo?.user?.email || "ERP USER",
        branchName: operatorBranch || sessionInfo?.scopes?.summary?.branchDisplayName || "",
      });
      setCarryTarget(null);
      setMessage({ type: "success", text: t(lang, "fx.carry_forward_done", "Rate carried forward to {date} for {country}.").replace("{date}", target).replace("{country}", c.name) });
      await loadData();
    } catch (err: any) {
      setCarryTarget(null);
      setMessage({
        type: "error",
        text: err?.message === "RATE_EXISTS_CORRECTION_REQUIRED"
          ? t(lang, "fx.correction_needed", "A rate already exists for this date. Enter a reason and save again to supersede it.")
          : err?.message || "Failed to carry forward the rate.",
      });
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
    if (rate.branch_name) setOperatorBranch(rate.branch_name);
  }

  function handlePrintTable() {
    const reportRows = rates.map((rate) => ({
      date: rate.rate_date,
      effective: (rate as any).effective_from
        ? new Date((rate as any).effective_from).toLocaleString()
        : `${rate.rate_date}${rate.rate_time ? " " + rate.rate_time : ""}`,
      country: rate.countries?.name || countries.find((country) => country.id === rate.country_id)?.name || "-",
      branch: rate.branch_name || "-",
      currency: (rate as any).currency_code || rate.countries?.currency_code || rate.countries?.iso2 || "-",
      user: rate.user_name || "-",
      debitRate: rate.debit_rate,
      creditRate: rate.credit_rate,
      status: (rate as any).superseded_at ? "Superseded" : "Active",
    }));

    openGenericErpReport({
      title: "DAILY EXCHANGE RATE — HISTORY & AUDIT",
      subtitle: "Every rate entered, with effective time and who entered it. Superseded rates are retained — historical transactions keep the rate they were posted against.",
      lang,
      columns: [
        { key: "effective", label: "Effective From (Date / Time)" },
        { key: "country", label: "Country" },
        { key: "branch", label: "Branch" },
        { key: "currency", label: "Currency", align: "center" },
        { key: "debitRate", label: "Debit Rate (Local/$)", format: "number", align: "right" },
        { key: "creditRate", label: "Credit Rate (Local/$)", format: "number", align: "right" },
        { key: "user", label: "Entered By" },
        { key: "status", label: "Status", format: "status", align: "center" },
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
        name: "",
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

      {/* Today's-rate panel: red until every in-scope country has an approved rate dated today (then it disappears).
          For each pending country it shows the latest approved rate WITH ITS DATE and offers a carry-forward that
          the operator confirms, so a rate that already exists never has to be re-typed. */}
      {!loading && countriesPendingTodayRate.length > 0 && (
        <div data-testid="fx-pending-panel" className="space-y-2 rounded-2xl border-2 border-red-400 bg-red-50 px-4 py-3 shadow-sm dark:border-red-800 dark:bg-red-950/40">
          <div className="flex flex-wrap items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <span className="text-xs font-black uppercase tracking-wide text-red-700 dark:text-red-300">
              {th("Today's Exchange Rate Pending")}
            </span>
            <span className="text-[11px] font-mono font-bold text-red-600/90 dark:text-red-400/90">{isoToday()}</span>
          </div>
          {countriesPendingTodayRate.map((c) => {
            const src = latestById.get(c.id);
            const confirming = carryTarget === c.id && Boolean(src);
            const key = c.iso2 ?? c.id;
            return (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-white/80 px-3 py-2 dark:border-red-900 dark:bg-slate-900/70">
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[12px] font-black text-slate-900 dark:text-slate-100">
                    {getFlag(c.iso2)} {c.name} <span className="font-mono text-slate-500">({c.currency_code})</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {src
                      ? t(lang, "fx.latest_from", "Latest approved: {date} · Credit {credit} · Debit {debit}")
                          .replace("{date}", src.rateDate)
                          .replace("{credit}", money(src.creditRate, 4))
                          .replace("{debit}", money(src.debitRate, 4))
                      : t(lang, "fx.latest_approved_none", "No approved rate on file")}
                  </div>
                  {confirming && src && (
                    <div data-testid={`fx-carry-confirm-text-${key}`} className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      {t(lang, "fx.carry_forward_confirm", "Save {credit} / {debit} as {date} for {country}? This copies the latest approved rate from {source}.")
                        .replace("{credit}", money(src.creditRate, 4))
                        .replace("{debit}", money(src.debitRate, 4))
                        .replace("{date}", isoToday())
                        .replace("{country}", c.name)
                        .replace("{source}", src.rateDate)}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {src && !confirming && (
                    <Button type="button" data-testid={`fx-carry-forward-${key}`} disabled={saving} onClick={() => setCarryTarget(c.id)} className="h-8 text-[11px] font-black uppercase bg-amber-500 hover:bg-amber-600 text-white">
                      {t(lang, "fx.carry_forward_btn", "Carry forward to today")}
                    </Button>
                  )}
                  {confirming && src && (
                    <>
                      <Button type="button" data-testid={`fx-carry-confirm-${key}`} disabled={saving} onClick={() => handleCarryForward(c, src)} className="h-8 text-[11px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white">
                        {t(lang, "fx.confirm_carry_forward", "Confirm carry-forward")}
                      </Button>
                      <Button type="button" variant="outline" disabled={saving} onClick={() => setCarryTarget(null)} className="h-8 text-[11px] font-black uppercase">
                        {t(lang, "common.cancel", "Cancel")}
                      </Button>
                    </>
                  )}
                  <Button type="button" variant="outline" disabled={saving} onClick={() => { setSelectedCountryId(c.id); setRateDate(isoToday()); setCarryTarget(null); }} className="h-8 text-[11px] font-black uppercase">
                    {t(lang, "fx.enter_today_rate", "Enter today's rate")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
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
            <span className="text-[11px] font-black uppercase bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 whitespace-nowrap">
              {th("INTRA-DAY LIVE ENTRY")}
            </span>
          </div>

          <form onSubmit={handleSaveRate} className="space-y-3.5">
            
            {/* 1. Country Selection */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>{th("1. COUNTRY NAME")}</span>
                {selectedCountry && (
                  <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                    Currency: {selectedCountry.currency_code}
                  </span>
                )}
              </Label>
              <select
                value={selectedCountryId}
                onChange={(e) => setSelectedCountryId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-100 shadow-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer uppercase"
              >
                <option value="" disabled hidden>
                  {countries.length ? th("-- SELECT COUNTRY --") : th("NO COUNTRIES AVAILABLE")}
                </option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold py-1">
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

            {/* 3. Credit Rate (Selling / Outflow) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {selectedCountry ? `4. CREDIT RATE (SELLING RATE)` : th("4. CREDIT RATE (LOCAL PER USD)")}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {selectedCountry ? `1 USD = ? ${selectedCountry.currency_code}` : "Local / USD"}
                </span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder={selectedCountry ? t(lang, "fx.rate_in_placeholder", "e.g. Rate in {code}").replace("{code}", String(selectedCountry.currency_code)) : th("Select country first")}
                  value={creditPrice}
                  onChange={(e) => setCreditPrice(e.target.value)}
                  className="h-10 text-xs font-black font-mono text-emerald-700 dark:text-emerald-400 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 focus:border-emerald-500 pr-24"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-mono font-black text-emerald-700 dark:text-emerald-400">
                  {selectedCountry ? `${selectedCountry.currency_code} / $` : "LOCAL / $"}
                </span>
              </div>
              {selectedCountry && creditPrice && Number(creditPrice) > 0 && (
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  ⚡ Conversion: 1.00 USD = {money(Number(creditPrice), 2)} {selectedCountry.currency_code} (Credit / Selling)
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
                <span className="text-[11px] font-bold text-slate-400">
                  {selectedCountry ? `1 USD = ? ${selectedCountry.currency_code}` : "Local / USD"}
                </span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder={selectedCountry ? t(lang, "fx.rate_in_placeholder", "e.g. Rate in {code}").replace("{code}", String(selectedCountry.currency_code)) : th("Select country first")}
                  value={debitPrice}
                  onChange={(e) => setDebitPrice(e.target.value)}
                  className="h-10 text-xs font-black font-mono text-blue-700 dark:text-blue-400 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 focus:border-blue-500 pr-24"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-mono font-black text-blue-700 dark:text-blue-400">
                  {selectedCountry ? `${selectedCountry.currency_code} / $` : "LOCAL / $"}
                </span>
              </div>
              {selectedCountry && debitPrice && Number(debitPrice) > 0 && (
                <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                  ⚡ Conversion: 1.00 USD = {money(Number(debitPrice), 2)} {selectedCountry.currency_code} (Debit / Buying)
                </p>
              )}
            </div>

            {(existingSelectedRate || correctionNeeded) && (
              <label className="block space-y-1 text-xs">
                <span>{t(lang, "report.reason", "Reason")}</span>
                <Input required value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />
              </label>
            )}
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
          
          {/* Latest APPROVED rate per country and currency, with its own date. Whole scope: the table filters below never change it. */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wide flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Globe className="w-4 h-4 text-blue-600" />
              {t(lang, "fx.latest_approved_title", "LATEST APPROVED RATE PER COUNTRY")}
            </h3>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0">
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[11px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    <Th className="py-2 px-3">{th("COUNTRY NAME")}</Th>
                    <Th className="py-2 px-3 text-center">{th("CURRENCY")}</Th>
                    <Th className="py-2 px-3">{t(lang, "fx.col_rate_date", "RATE DATE")}</Th>
                    <Th className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400">{th("CREDIT RATE (LOCAL/$)")}</Th>
                    <Th className="py-2 px-3 text-right text-blue-600 dark:text-blue-400">{th("DEBIT RATE (LOCAL/$)")}</Th>
                    <Th className="py-2 px-3">{th("STATUS")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                  {countries.map((c) => {
                    const src = latestById.get(c.id);
                    const approvedToday = statusById.get(c.id)?.status === "APPROVED";
                    const base = isBaseCurrency(c.currency_code);
                    return (
                      <tr key={c.id} data-testid={`fx-latest-${c.iso2 ?? c.id}`} className="text-[11px]">
                        <td className="py-2 px-3 font-bold uppercase">{getFlag(c.iso2)} {c.name}</td>
                        <td className="py-2 px-3 text-center font-mono font-black">{c.currency_code}</td>
                        <td className="py-2 px-3 font-mono">{base ? "-" : src?.rateDate ?? "-"}</td>
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{base ? money(1, 4) : src ? money(src.creditRate, 4) : "-"}</td>
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400">{base ? money(1, 4) : src ? money(src.debitRate, 4) : "-"}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {base ? (
                            <span className="text-slate-500 dark:text-slate-400">{t(lang, "fx.base_currency_short", "Base currency")}</span>
                          ) : approvedToday ? (
                            <span className="font-black text-emerald-700 dark:text-emerald-400">{t(lang, "fx.status_today_ok", "Approved for today")}</span>
                          ) : src ? (
                            <span className="font-black text-amber-700 dark:text-amber-400">{t(lang, "fx.status_missing_today", "Missing today")}</span>
                          ) : (
                            <span className="font-black text-red-700 dark:text-red-400">{t(lang, "fx.latest_approved_none", "No approved rate on file")}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Header Filter Controls Bar */}
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Clock className="w-4 h-4" />
                  {th("SUPER ADMIN LIVE EXCHANGE RATES TABLE")}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {th("Audited intra-day exchange rates recorded by users and branch terminals worldwide.")}
                </p>
              </div>
              <span className="text-[11px] font-mono font-black bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
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

              {/* Branch Filter */}
              <div>
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer uppercase shadow-xs"
                >
                  <option value="all">{th("ALL BRANCHES")}</option>
                  {branchOptions.map((branchName) => (
                    <option key={branchName} value={branchName} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold py-1">{branchLabel(branchName)}</option>
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
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder={th("Search user, branch...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-[11px] font-bold pl-8 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-lg placeholder:text-slate-400 shadow-xs"
                />
              </div>

            </div>
          </div>

          {/* Rates grouped by date: one summary row per date; tap "+" to reveal that day's complete rate table, tap again to collapse. */}
          <div className="space-y-2">
            {ratesByDate.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-8 text-center text-slate-400 font-medium shadow-xs">
                {th("NO EXCHANGE RATES RECORDED MATCHING YOUR SEARCH CRITERIA.")}
              </div>
            ) : (
              ratesByDate.map(([date, dayRates]) => {
                const open = expandedDates.has(date);
                const dayCurrencies = [...new Set(dayRates.map((r) => {
                  const mc = countries.find((c) => c.id === r.country_id) || null;
                  return r.countries?.currency_code ?? mc?.currency_code;
                }).filter(Boolean))];
                return (
                  <div key={date} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <button
                      type="button"
                      onClick={() => toggleDate(date)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <span className={cn("h-6 w-6 shrink-0 rounded-md flex items-center justify-center text-white", open ? "bg-slate-500" : "bg-blue-600")}>
                          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </span>
                        <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap font-mono">{date}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 whitespace-nowrap">
                          {dayRates.length} {dayRates.length === 1 ? th("RATE") : th("RATES")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden sm:inline text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate max-w-[220px]">{dayCurrencies.join(" / ")}</span>
                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
                      </div>
                    </button>
                    {open && (
                      <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[11px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                              <Th className="py-2.5 px-3 text-center">{th("SR NO")}</Th>
                              <Th className="py-2.5 px-3">{th("COUNTRY NAME")}</Th>
                              <Th className="py-2.5 px-3">{th("BRANCH NAME")}</Th>
                              <Th className="py-2.5 px-3">{th("USER NAME")}</Th>
                              <Th className="py-2.5 px-3 text-center">{th("CURRENCY")}</Th>
                              <Th className="py-2.5 px-3">{th("DATE & TIME")}</Th>
                              <Th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">{th("CREDIT RATE (LOCAL/$)")}</Th>
                              <Th className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">{th("DEBIT RATE (LOCAL/$)")}</Th>
                              <Th className="py-2.5 px-3 text-right">{th("LAST UPDATED")}</Th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                            {dayRates.map((r, idx) => {
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
                                    isSelected && "bg-blue-50/50 dark:bg-blue-950/30",
                                    r.superseded_at && "opacity-60"
                                  )}
                                >
                                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 font-bold flex items-center gap-2 text-[11px]">
                                    <span className="text-base">{getFlag(iso2)}</span>
                                    <span className="uppercase">{countryName}</span>
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-[11px] text-slate-600 dark:text-slate-300 uppercase">
                                    {r.branch_name ? branchLabel(r.branch_name) : "-"}
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-[11px] text-blue-700 dark:text-blue-400 uppercase">
                                    {r.user_name || "-"}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="font-mono font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
                                      {currencyCode}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                    {r.rate_date || isoToday()} {r.rate_time || "09:00 AM"}
                                    {r.superseded_at ? (
                                      <span className="ml-2 inline-flex px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px] font-black uppercase">{t(lang, "fx.status_superseded", "Superseded")}</span>
                                    ) : (
                                      <span className="ml-2 inline-flex px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black uppercase">{t(lang, "fx.status_active", "Active")}</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                    {money(r.credit_rate || r.selling_rate, 2)} {currencyCode}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400 text-[11px]">
                                    {money(r.debit_rate || r.buying_rate, 2)} {currencyCode}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-[11px] text-slate-400 font-mono">
                                    {new Date(r.updated_at || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
