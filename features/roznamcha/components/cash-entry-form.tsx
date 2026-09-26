"use client";

import { pl } from "@/lib/reports/print-label";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Menu,
  Printer,
  RefreshCw,
  Save,
  Search,
  User,
  X,
  MoreVertical,
  Globe,
  Clock,
  Eye,
  Send,
  CheckCircle,
  Share2,
  Plus,
  Paperclip,
  Trash2,
  Hash,
  Users,
  CircleDollarSign,
  Banknote,
  ArrowLeftRight,
  BarChart3,
  MapPin,
  CheckCircle2,
  Pencil,
  Mic,
  Calendar
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import {
  listLedgerReportLedgers,
  type LedgerLookupRow
} from "@/features/reports/ledger-report/ledger-report-api";
import { apiGet, apiPost } from "@/lib/api/client";
import type { RoznamchaType } from "@/lib/accounting/roznamcha-flow";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { BankPicker } from "@/features/banks/components/bank-picker";
import { getBankById } from "@/features/banks/bank-api";
import { useIntakeDraft } from "@/lib/document-intelligence/use-intake-draft";
import { LocationBackdrop } from "@/components/location-backdrop";
import { VoiceFormFill } from "@/components/voice-form-fill";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";
import { openScopedGenericReport } from "@/lib/reports/open-scoped-report";
import { RoznamchaReportsDropdown } from "@/features/roznamcha/components/roznamcha-reports-dropdown";
import { Th } from "@/components/ui/translated-th";
import { resolveVerifiedTranslation } from "@/lib/i18n/verified-record-translations";
import { translateNarrationBlock, translateHeader } from "@/lib/i18n/table-headers";
import { localizeTerm } from "@/lib/i18n/transliteration";

function getRoznamchaCategoryLabel(row: any) {
  const sm = (row.source_module || "").toLowerCase();
  const stt = (row.source_transaction_type || "").toLowerCase();
  const t = (row.type || "").toLowerCase();
  const pet = (row.roznamcha_lines?.[0]?.payment_entry_type || "").toLowerCase();

  if (sm === "purchase" || sm === "purchase_bill" || t === "purchase_bill" || pet.includes("purchase") || stt.includes("purchase")) return "Business Roznamcha";
  if (sm === "advance_payment" || t === "advance_payment") {
    if (t.includes("bank") || pet.includes("bank")) return "Advance (Bank)";
    if (t.includes("cash") || pet.includes("cash")) return "Advance (Cash)";
    return "Advance";
  }
  if (t === "bank_payment" || t === "bank_receipt" || t.includes("bank") || pet.includes("bank")) return "Bank";
  if (t === "cash_payment" || t === "cash_receipt" || t.includes("cash") || pet.includes("cash")) return "Cash";
  if (t === "journal_voucher" || t === "contra_voucher" || t.includes("journal") || pet.includes("journal") || t === "business") return "Business Roznamcha";
  
  if (t === "invoice" || t.includes("invoice") || sm.includes("invoice")) return "Purchase Booking";
  
  let label = t ? t.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : "-";
  if (label.includes("Invoice")) label = label.replace("Invoice", "Purchase Booking");
  return label;
}

function getCountryFlag(name?: string) {
  if (!name) return "🏳️";
  const lower = name.toLowerCase();
  if (lower.includes("pakistan")) return "🇵🇰";
  if (lower.includes("afghanistan")) return "🇦🇫";
  if (lower.includes("iran")) return "🇮🇷";
  if (lower.includes("emirates") || lower.includes("uae") || lower.includes("dubai")) return "🇦🇪";
  if (lower.includes("india")) return "🇮🇳";
  return "🏳️";
}

const SAVED_BANKS_KEY = "erp_saved_banks_v1";
const SAVED_METHODS_KEY = "erp_saved_payment_methods_v1";

// Display-only currency full names for the "Selected Account" bar — presentation
// data, not a new master/lookup table, so this is safe alongside the "no DB/API
// changes" rule for this redesign.
const CURRENCY_FULL_NAMES: Record<string, string> = {
  USD: "United States Dollar",
  PKR: "Pakistani Rupee",
  AED: "United Arab Emirates Dirham",
  AFN: "Afghan Afghani",
  EUR: "Euro",
  GBP: "British Pound",
  SAR: "Saudi Riyal",
  INR: "Indian Rupee",
  CNY: "Chinese Yuan",
  TRY: "Turkish Lira",
  IRR: "Iranian Rial",
  OMR: "Omani Rial",
  KWD: "Kuwaiti Dinar",
  QAR: "Qatari Riyal",
  BHD: "Bahraini Dinar"
};

// NOTE: the free-text COUNTRY_BANKS list this used to hold was removed —
// the Bank Details section now uses the real Bank Master via BankPicker
// (see "RULE: Always use BankPicker — never create a free-text bank input"
// in features/banks/components/bank-picker.tsx).

type SessionResponse = {
  user: { id: string; email: string | null; fullName: string | null };
  roles: string[];
  scopes: {
    countryIds: string[];
    countryBranchIds: string[];
    cityBranchIds: string[];
    isSuperAdmin: boolean;
  };
};

type CountryBranchRow = {
  id: string;
  country_id: string;
  name: string;
  code: string;
  local_currency: string;
  is_main: boolean;
};

type CityBranchRow = {
  id: string;
  country_id: string;
  country_branch_id: string;
  city_name: string;
  name: string;
  code: string;
  local_currency: string;
};

type RoznamchaPostResponse = {
  mode: "post" | "validate";
  balanced: boolean;
  entryId?: string;
  superAdminSerialNumber?: string | null;
  countryTransactionSerialNumber?: string | null;
  branchTransactionSerialNumber?: string | null;
};

type AccountLookupResponse = {
  found: boolean;
  account: LedgerLookupRow | null;
  query: string;
};

type LatestRateResponse = {
  rate: number;
  buyRate?: number;
  sellRate?: number;
  creditRate?: number;
  debitRate?: number;
  effectiveDate?: string | null;
  source: string;
};

type CashEntryScopeMode = "auto" | "super_admin" | "country" | "branch";
type CashEntryViewScope = Exclude<CashEntryScopeMode, "auto">;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function generateCode(prefix: string) {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

function toLedgerOption(row: LedgerLookupRow): SearchSelectOption {
  const account = row.accountName || row.ledgerName || "";
  const accountNo = row.accountCode || row.ledgerCode || "";
  const manualRef = row.manualReferenceNumber || "";
  const customerNo = row.customerNumber || "";
  const branch = row.cityBranchName || row.countryBranchName || "";
  const country = row.countryName || "";
  const city = row.cityName || "";
  const company = row.companyName || "";

  const label = `${accountNo} - ${account}${branch ? ` (${branch})` : ""}`;
  const keywords = [accountNo, manualRef, customerNo, account, company, branch, city, country, row.ledgerCode, row.ledgerName]
    .filter(Boolean)
    .join(" ");

  return { value: row.ledgerId, label, keywords };
}

function fmtAmount(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function readLocalList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeLocalList(key: string, values: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // ignore
  }
}

export type SavedBankItem = { name: string; address?: string };

function readLocalBankList(key: string): SavedBankItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalBankList(key: string, values: SavedBankItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // ignore
  }
}

export function CashEntryForm({
  lang,
  pageTitle,
  postingType = "branch",
  scopeMode = "auto",
  onSaved
}: {
  lang: SupportedLanguage;
  pageTitle: string;
  postingType?: RoznamchaType;
  // auto: infer visibility from session roles; super_admin/country/branch: force scope rules for dedicated pages.
  scopeMode?: CashEntryScopeMode;
  onSaved?: (entryId: string | null) => void;
}) {
  const router = useRouter();
  // When we auto-derive scope from the selected account/ledger, avoid wiping selections
  // in the "country changed" reset effect.
  const suppressScopeResetRef = useRef(false);
  const savingRef = useRef(false);

  const [loadingScope, setLoadingScope] = useState(true);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [manualViewScope, setManualViewScope] = useState<CashEntryViewScope | null>(null);
  const [loginTimeText, setLoginTimeText] = useState("-");

  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalNode(document.getElementById("erp-page-actions-slot"));
  }, []);

  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);

  const [countryId, setCountryId] = useState("");
  const [branchCategory, setBranchCategory] = useState<"business" | "agent">("business");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [showScopeModal, setShowScopeModal] = useState(false);

  const [mainBranches, setMainBranches] = useState<CountryBranchRow[]>([]);
  const [cityBranches, setCityBranches] = useState<CityBranchRow[]>([]);

  // Load Countries (Only countries with active branches)
  useEffect(() => {
    let cancelled = false;
    setLoadingCountries(true);
    fetch("/api/erp/locations/countries?withBranchesOnly=true")
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = res?.countries || res?.data?.countries || [];
        setCountries(list);
        if (list.length > 0 && !countryId) {
          setCountryId(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCountries(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Load Main Branches when Country changes
  useEffect(() => {
    if (!countryId) {
      setMainBranches([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/erp/locations/branches/main?countryId=${encodeURIComponent(countryId)}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.branches || res?.branches || [];
        setMainBranches(list);
        if (list.length > 0 && !countryBranchId) {
          setCountryBranchId(list[0].id);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [countryId]);

  // Load City Branches when Country, Main Branch, or Category changes
  useEffect(() => {
    if (!countryId) {
      setCityBranches([]);
      return;
    }
    let cancelled = false;
    const qp = new URLSearchParams({ countryId, scope: branchCategory });
    if (countryBranchId) qp.set("countryBranchId", countryBranchId);
    fetch(`/api/erp/locations/branches/city?${qp.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.cityBranches || res?.data?.branches || res?.cityBranches || [];
        setCityBranches(list);
        if (list.length > 0 && (!cityBranchId || !list.some((b: any) => b.id === cityBranchId))) {
          setCityBranchId(list[0].id);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [countryId, countryBranchId, branchCategory]);

  const [ledgers, setLedgers] = useState<LedgerLookupRow[]>([]);
  const [loadingLedgers, setLoadingLedgers] = useState(false);
  const [cashLedgerId, setCashLedgerId] = useState("");
  const [counterLedgerId, setCounterLedgerId] = useState("");
  const [selectedLookupLedger, setSelectedLookupLedger] = useState<LedgerLookupRow | null>(null);
  const [accountNoInput, setAccountNoInput] = useState("");
  const [accountLookupError, setAccountLookupError] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState(todayIso());
  const [roznamchaBookType, setRoznamchaBookType] = useState("branch_payment_voucher");
  const [referenceNo, setReferenceNo] = useState("");
  const [narration, setNarration] = useState("");
  const [remarks, setRemarks] = useState("");

  const [currency, setCurrency] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [exchangeRateSource, setExchangeRateSource] = useState("default");
  const [exchangeRateEffectiveAt, setExchangeRateEffectiveAt] = useState<string | null>(null);
  const [currencyError, setCurrencyError] = useState(false);
  const [dailyUsdRates, setDailyUsdRates] = useState<{
    buyingRate?: number;
    sellingRate?: number;
    creditRate?: number;
    debitRate?: number;
  } | null>(null);

  const [countryRate, setCountryRate] = useState<{
    buyRate?: number;
    sellRate?: number;
    creditRate?: number;
    debitRate?: number;
    effectiveDate?: string | null;
    lastUpdatedBy?: string;
  } | null>(null);

  const [activeCreator, setActiveCreator] = useState<string>("");
  const [activeApprover, setActiveApprover] = useState<string>("");
  const [activeStatus, setActiveStatus] = useState<string>("");

  const [paymentType, setPaymentType] = useState<"" | "bank" | "business" | "invoice" | "cash" | "transfer">("cash");
  const [paymentMode, setPaymentMode] = useState<"" | "DEBIT" | "CREDIT">("DEBIT");
  const [finalPayment, setFinalPayment] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Payment-type details (clean initial state)
  const [typeDetails, setTypeDetails] = useState<Record<string, string>>({});

  // Currency calculation panel
  const [calcAmount, setCalcAmount] = useState("");
  const [calcPrice, setCalcPrice] = useState("");
  const [calcOp, setCalcOp] = useState<"mul" | "div">("mul");

  // Local cache for Bank/Method quick add (until centralized management tables are wired in).
  const [savedBanks, setSavedBanks] = useState<SavedBankItem[]>([]);
  const [savedMethods, setSavedMethods] = useState<string[]>([]);
  const [addOptionOpen, setAddOptionOpen] = useState(false);
  const [addOptionType, setAddOptionType] = useState<"bank" | "method">("bank");
  const [addOptionValue, setAddOptionValue] = useState("");
  const [addOptionAddress, setAddOptionAddress] = useState("");

  const [saving, setSaving] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastEntryId, setLastEntryId] = useState<string | null>(null);
  const [savedSerials, setSavedSerials] = useState<{
    superAdmin?: string | null;
    country?: string | null;
    branch?: string | null;
    mainBranch?: string | null;
    cityBranch?: string | null;
    entrySerial?: string | null;
  } | null>(null);

  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [showFormSection, setShowFormSection] = useState(true);

  // ── AI Document Intake → Cash Entry bridge ──
  // When the reviewer chose "Continue Saved Draft" for a roznamcha document, the
  // reviewed values arrive here. We prefill only the safe scalar fields; the
  // human still picks the counter ledger and confirms before the form's own
  // save posts the balanced DR/CR through /api/erp/roznamcha. AI never posts.
  const intakeDraft = useIntakeDraft("roznamcha_entries");
  const [intakeApplied, setIntakeApplied] = useState(false);
  const [intakeBannerDismissed, setIntakeBannerDismissed] = useState(false);
  const intakeSuggestedParty = (intakeDraft.payload?.counterpartyName as string) || null;

  useEffect(() => {
    if (!intakeDraft.draft || intakeApplied) return;
    const p = intakeDraft.payload || {};
    if (p.finalAmount != null && p.finalAmount !== "") setCalcAmount(String(p.finalAmount));
    if (typeof p.originalCurrency === "string" && p.originalCurrency) setCurrency(String(p.originalCurrency).toUpperCase());
    if (p.exchangeRate != null && Number(p.exchangeRate) > 0) setExchangeRate(String(p.exchangeRate));
    if (typeof p.entryDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(p.entryDate)) setEntryDate(p.entryDate.slice(0, 10));
    const ref = (p.billNumber || p.manualBillNumber || p.sourceReference) as string | undefined;
    if (ref) setReferenceNo(String(ref));
    const narrationBits = [
      p.counterpartyName ? `Party: ${p.counterpartyName}` : null,
      ref ? `Ref: ${ref}` : null,
      intakeDraft.draftNo ? `(from document ${intakeDraft.draftNo})` : null,
    ].filter(Boolean);
    if (narrationBits.length) setNarration((prev) => prev || narrationBits.join(" · "));
    // direction: "debit" (cash received) → Receipt = DEBIT ; "credit" (cash paid) → Payment = CREDIT
    if (p.transactionType === "debit") setPaymentMode("DEBIT");
    else if (p.transactionType === "credit") setPaymentMode("CREDIT");
    setIntakeApplied(true);
  }, [intakeDraft.draft, intakeDraft.payload, intakeDraft.draftNo, intakeApplied]);

  // Branch-wise cash summary (Total Credit / Debit / Balance / Entry count) for the
  // selected country + branch + date. Sourced from the DB function get_branch_cash_summary
  // via /api/erp/roznamcha/cash-summary so totals are accurate across ALL entries, not just
  // the recent 100 loaded into the table.
  type CashSummary = {
    totalDebit: number;
    totalCredit: number;
    balance: number;
    balanceType: string;
    entryCount: number;
  };
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Daily exchange rate (buying / selling / debit / credit) for the selected country + branch
  // + date, entered in the Daily Exchange Rate module. Auto-displayed; never manually set here.
  type DailyRate = {
    found: boolean;
    buyingRate: number | null;
    sellingRate: number | null;
    creditRate: number | null;
    debitRate: number | null;
    rateDate: string | null;
    isExactDate: boolean | null;
    isBranchSpecific: boolean | null;
  };
  const [dailyRate, setDailyRate] = useState<DailyRate | null>(null);
  const [loadingDailyRate, setLoadingDailyRate] = useState(false);

  type SummaryOverviewBranch = {
    branchId: string;
    branchName: string;
    branchCode: string;
    localCurrency: string;
    totalCredit: number;
    totalDebit: number;
    balance: number;
    balanceRaw: number;
    balanceType: string;
    entryCount: number;
  };

  type SummaryOverviewCountry = {
    countryId: string;
    countryName: string;
    iso2: string;
    currencyCode: string;
    totalCredit: number;
    totalDebit: number;
    balance: number;
    balanceRaw: number;
    balanceType: string;
    entryCount: number;
    rates: {
      buyingRate: number | null;
      sellingRate: number | null;
      creditRate: number | null;
      debitRate: number | null;
    };
    branches: SummaryOverviewBranch[];
  };

  const [summaryOverview, setSummaryOverview] = useState<{
    isSuperAdmin: boolean;
    date: string;
    countries: SummaryOverviewCountry[];
  } | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [expandedCountryId, setExpandedCountryId] = useState<string | null>(null);

  const fetchSummaryOverview = async () => {
    try {
      setLoadingOverview(true);
      const res = await apiGet<any>(`/api/erp/roznamcha/summary-overview?date=${entryDate}`);
      if (res && Array.isArray(res.countries)) {
        setSummaryOverview(res);
      }
    } catch (err) {
      console.error("Failed to fetch summary overview", err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchSummaryOverview();
  }, [entryDate]);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === countryId) ?? null,
    [countries, countryId]
  );

  const selectedMainBranch = useMemo(
    () => mainBranches.find((b) => b.id === countryBranchId) ?? null,
    [countryBranchId, mainBranches]
  );

  const selectedCityBranch = useMemo(
    () => cityBranches.find((b) => b.id === cityBranchId) ?? null,
    [cityBranchId, cityBranches]
  );

  const activeCountryIso = useMemo(() => {
    return ((selectedCountry as any)?.iso2 || (selectedCountry as any)?.code || "AE").toUpperCase();
  }, [selectedCountry]);

  const backdropSelection = useMemo(() => ({
    iso2: (selectedCountry as { iso2?: string } | null)?.iso2 ?? null,
    countryName: (selectedCountry as { name?: string } | null)?.name ?? null,
    cityName: (selectedCityBranch as { city_name?: string; name?: string } | null)?.city_name
      ?? (selectedCityBranch as { name?: string } | null)?.name ?? null,
    branchName: (selectedCityBranch as { branch_name?: string; name?: string } | null)?.branch_name
      ?? (selectedMainBranch as { name?: string } | null)?.name ?? null,
  }), [selectedCountry, selectedCityBranch, selectedMainBranch]);

  const liveSerials = useMemo(() => {
    const nextSeq = recentEntries.length + 1;
    const cIso = selectedCountry?.iso2 || "GLOBAL";
    const mCode = selectedMainBranch?.code || "MB";
    const cityCode = selectedCityBranch?.code || "CB";
    const bCode = selectedCityBranch?.code ? `BR-${selectedCityBranch.code}` : selectedMainBranch?.code ? `MAIN-${selectedMainBranch.code}` : "BR";

    return {
      superAdmin: `JRN-2026-${String(nextSeq).padStart(4, "0")}`,
      country: `${cIso}-SR-${String(nextSeq).padStart(4, "0")}`,
      branch: `${bCode}-SR-${String(nextSeq).padStart(4, "0")}`,
      mainBranch: `${mCode}-SR-${String(nextSeq).padStart(4, "0")}`,
      cityBranch: `${cityCode}-SR-${String(nextSeq).padStart(4, "0")}`,
      entrySerial: `CE-${String(nextSeq).padStart(5, "0")}`
    };
  }, [recentEntries.length, selectedCountry, selectedMainBranch, selectedCityBranch]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);
  const [ledgerRefreshCount, setLedgerRefreshCount] = useState(0);
  const [showPaymentWorkReport, setShowPaymentWorkReport] = useState(false);

  // Live Users / Current Work states
  const [liveUsersRoleFilter, setLiveUsersRoleFilter] = useState("all");
  const [liveUsersOpFilter, setLiveUsersOpFilter] = useState("all");
  const [liveUsersList, setLiveUsersList] = useState<any[]>([
    {
      id: "live-1",
      userId: "BE340D15",
      branchCode: "HQ-001",
      date: "25/09/2026",
      time: "12:45",
      userType: "Business",
      userName: "Super Admin",
      currentWork: "Roznamcha / Global Review",
      status: "Online",
    },
    {
      id: "live-2",
      userId: "PK-A102",
      branchCode: "PK-001",
      date: "25/09/2026",
      time: "12:41",
      userType: "Business",
      userName: "Country Admin",
      currentWork: "Daily Payment Entry",
      status: "Online",
    },
    {
      id: "live-3",
      userId: "PK-S207",
      branchCode: "PK-001",
      date: "25/09/2026",
      time: "12:38",
      userType: "Shipping Line",
      userName: "Shipping Admin",
      currentWork: "Shipping Ledger",
      status: "Online",
    },
    {
      id: "live-4",
      userId: "DXB-B31",
      branchCode: "DXB-01",
      date: "25/09/2026",
      time: "12:36",
      userType: "Business",
      userName: "Branch Admin",
      currentWork: "Cash Entry",
      status: "Online",
    },
    {
      id: "live-5",
      userId: "DXB-S44",
      branchCode: "DXB-01",
      date: "25/09/2026",
      time: "12:30",
      userType: "Shipping Line",
      userName: "Shipping User",
      currentWork: "Shipping Payment",
      status: "Online",
    },
  ]);

  // Serial Numbers & Country Rates states
  const [serialRoleFilter, setSerialRoleFilter] = useState("Super Admin");
  const [showSerialsDropdown, setShowSerialsDropdown] = useState(false);
  const [countryRatesList, setCountryRatesList] = useState<any[]>([
    { country: "PK", date: "25/09/2026 10:00", drRate: "279.80", crRate: "279.20" },
    { country: "AF", date: "25/09/2026 09:30", drRate: "69.00", crRate: "68.40" },
    { country: "IN", date: "25/09/2026 10:15", drRate: "83.70", crRate: "83.30" },
    { country: "AE", date: "25/09/2026 11:20", drRate: "3.6725", crRate: "3.6700" },
    { country: "IR", date: "25/09/2026 09:45", drRate: "42000", crRate: "41800" },
  ]);
  const [editingRateCountry, setEditingRateCountry] = useState<string | null>(null);
  const [editDrRateVal, setEditDrRateVal] = useState("");
  const [editCrRateVal, setEditCrRateVal] = useState("");

  // Daily Cash Position states
  const [cashPositionRoleFilter, setCashPositionRoleFilter] = useState("Super Admin");
  const [cashPositionCountryFilter, setCashPositionCountryFilter] = useState("all");
  const [cashPositionsList, setCashPositionsList] = useState<any[]>([
    { country: "PK", creditLocal: "2,450,000 PKR", debitLocal: "2,650,000 PKR", creditUsd: "$8,757.45", debitUsd: "$9,481.22" },
    { country: "AF", creditLocal: "212,000 AFN", debitLocal: "180,000 AFN", creditUsd: "$3,128.45", debitUsd: "$2,612.48" },
    { country: "IN", creditLocal: "425,000 INR", debitLocal: "380,000 INR", creditUsd: "$5,077.66", debitUsd: "$4,539.38" },
    { country: "AE", creditLocal: "42,000 AED", debitLocal: "35,000 AED", creditUsd: "$11,436.35", debitUsd: "$9,530.73" },
    { country: "IR", creditLocal: "600,000,000 IRR", debitLocal: "610,000,000 IRR", creditUsd: "$14,533.91", debitUsd: "$14,832.01" },
  ]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/erp/users/live-presence")
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res?.ok && Array.isArray(res.data) && res.data.length > 0) {
          setLiveUsersList(res.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartEditRate = (r: any) => {
    setEditingRateCountry(r.country);
    setEditDrRateVal(String(r.drRate));
    setEditCrRateVal(String(r.crRate));
  };

  const handleSaveRate = () => {
    if (!editingRateCountry) return;
    setCountryRatesList((prev) =>
      prev.map((item) =>
        item.country === editingRateCountry
          ? {
              ...item,
              drRate: editDrRateVal,
              crRate: editCrRateVal,
              date: `${todayIso().split("-").reverse().join("/")} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
            }
          : item
      )
    );
    setEditingRateCountry(null);
  };

  const filteredLiveUsers = useMemo(() => {
    return liveUsersList.filter((u) => {
      if (liveUsersRoleFilter !== "all" && !u.userName.toLowerCase().includes(liveUsersRoleFilter.toLowerCase())) {
        return false;
      }
      if (
        liveUsersOpFilter !== "all" &&
        !u.userType.toLowerCase().includes(liveUsersOpFilter.toLowerCase()) &&
        !u.currentWork.toLowerCase().includes(liveUsersOpFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [liveUsersList, liveUsersRoleFilter, liveUsersOpFilter]);

  const filteredCashPositions = useMemo(() => {
    if (cashPositionCountryFilter === "all") return cashPositionsList;
    return cashPositionsList.filter((p) => p.country.toLowerCase() === cashPositionCountryFilter.toLowerCase());
  }, [cashPositionsList, cashPositionCountryFilter]);

  const isSuperAdmin = session?.scopes?.isSuperAdmin ?? false;

  const userRoleLevel: "operator" | "branch" | "country" | "super_admin" = useMemo(() => {
    if (isSuperAdmin || session?.scopes?.isSuperAdmin) return "super_admin";
    const roles = session?.roles || [];
    if (roles.includes("country_admin") || (session?.scopes?.countryIds && session.scopes.countryIds.length > 0 && (!session.scopes.countryBranchIds || session.scopes.countryBranchIds.length === 0))) {
      return "country";
    }
    if (roles.includes("branch_admin") || roles.includes("manager") || (session?.scopes?.countryBranchIds && session.scopes.countryBranchIds.length > 0)) {
      return "branch";
    }
    return "operator";
  }, [isSuperAdmin, session]);

  const recentEntriesSummary = useMemo(() => {
    let totalCredit = 0;
    let totalDebit = 0;

    recentEntries.forEach(row => {
      const firstLine = row.roznamcha_lines?.[0];
      const debitVal = Number(firstLine?.debit || 0);
      const creditVal = Number(firstLine?.credit || 0);

      if (debitVal > 0) totalDebit += debitVal;
      else if (creditVal > 0) totalCredit += creditVal;
    });

    const balance = Math.abs(totalCredit - totalDebit);
    const balanceType = totalCredit > totalDebit ? "Cr" : (totalDebit > totalCredit ? "Dr" : "-");

    return {
      count: recentEntries.length,
      totalCredit,
      totalDebit,
      balance,
      balanceType
    };
  }, [recentEntries]);

  // Compact top-bar search — client-side filter over the already-loaded entries
  // (no new API call), matching against whatever's already visible in the table.
  const filteredRecentEntries = useMemo(() => {
    const q = tableSearchQuery.trim().toLowerCase();
    if (!q) return recentEntries;
    return recentEntries.filter((row) => {
      const haystack = [
        row.voucher_no,
        row.journal_no,
        row.super_admin_serial_number,
        row.country_transaction_serial_number,
        row.branch_transaction_serial_number,
        row.narration,
        row.created_by,
        row.profiles?.full_name,
        ...(row.roznamcha_lines || []).flatMap((line: any) => [
          line.account_number,
          line.ledgers?.name,
          line.entry_serial_number
        ])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [recentEntries, tableSearchQuery]);

  const [showRoznamcha, setShowRoznamcha] = useState(false);
  const [roznamchaType, setRoznamchaType] = useState("Cash Book No.");
  const [roznamchaBook, setRoznamchaBook] = useState("CB-001 - Main Cash Book");
  const [roznamchaNumber, setRoznamchaNumber] = useState("000123");

  // Entry table date filtering state: defaults to 1 day ("day") as required
  const [tableDateMode, setTableDateMode] = useState<"day" | "range" | "all">("day");
  const [tableDate, setTableDate] = useState(todayIso());
  const [tableFromDate, setTableFromDate] = useState(todayIso());
  const [tableToDate, setTableToDate] = useState(todayIso());

  const shiftTableDay = (delta: number) => {
    const base = tableDate || entryDate || todayIso();
    const parts = base.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + delta);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const nextStr = `${yyyy}-${mm}-${dd}`;
    setTableDate(nextStr);
    setEntryDate(nextStr);
  };

  const setTableDatePreset = (preset: "today" | "yesterday" | "this_week" | "this_month" | "last_30_days") => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (preset === "today") {
      setTableDateMode("day");
      setTableDate(todayStr);
      setEntryDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
      setTableDateMode("day");
      setTableDate(yStr);
      setEntryDate(yStr);
    } else if (preset === "this_week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
      setTableDateMode("range");
      setTableFromDate(startStr);
      setTableToDate(todayStr);
    } else if (preset === "this_month") {
      const startStr = `${yyyy}-${mm}-01`;
      setTableDateMode("range");
      setTableFromDate(startStr);
      setTableToDate(todayStr);
    } else if (preset === "last_30_days") {
      const start30 = new Date(now);
      start30.setDate(now.getDate() - 30);
      const startStr = `${start30.getFullYear()}-${String(start30.getMonth() + 1).padStart(2, "0")}-${String(start30.getDate()).padStart(2, "0")}`;
      setTableDateMode("range");
      setTableFromDate(startStr);
      setTableToDate(todayStr);
    }
  };

  useEffect(() => {
    setLoginTimeText(new Date().toLocaleString());
  }, []);

  const fetchRecentEntries = async () => {
    try {
      setLoadingEntries(true);
      const params = new URLSearchParams({ limit: "500" });
      params.set("language", lang);
      if (countryId) params.set("countryId", countryId);
      if (countryBranchId) params.set("countryBranchId", countryBranchId);
      if (cityBranchId) params.set("cityBranchId", cityBranchId);

      // Apply 1-day (default) or date-range filtering as requested
      if (tableDateMode === "day") {
        const targetDate = tableDate || entryDate || todayIso();
        params.set("fromDate", targetDate);
        params.set("toDate", targetDate);
      } else if (tableDateMode === "range") {
        if (tableFromDate) params.set("fromDate", tableFromDate);
        if (tableToDate) params.set("toDate", tableToDate);
      }
      // "all" mode does not set fromDate/toDate

      const res = await apiGet<{ entries: any[] }>(`/api/erp/roznamcha?${params.toString()}`);
      setRecentEntries(res.entries || []);
    } catch (err) {
      console.error("Failed to fetch recent entries", err);
    } finally {
      setLoadingEntries(false);
    }
  };

  const fetchCashSummary = async () => {
    if (!countryId) {
      setCashSummary(null);
      return;
    }
    try {
      setLoadingSummary(true);
      const params = new URLSearchParams({ countryId });
      if (countryBranchId) params.set("countryBranchId", countryBranchId);
      const effectiveDate = tableDateMode === "day" ? (tableDate || entryDate) : entryDate;
      if (effectiveDate) params.set("date", effectiveDate);
      const res = await apiGet<CashSummary>(`/api/erp/roznamcha/cash-summary?${params.toString()}`);
      setCashSummary(res);
    } catch (err) {
      console.error("Failed to fetch cash summary", err);
      setCashSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchDailyRate = async () => {
    if (!countryId) {
      setDailyRate(null);
      return;
    }
    try {
      setLoadingDailyRate(true);
      const params = new URLSearchParams({ countryId });
      if (countryBranchId) params.set("countryBranchId", countryBranchId);
      const effectiveDate = tableDateMode === "day" ? (tableDate || entryDate) : entryDate;
      if (effectiveDate) params.set("date", effectiveDate);
      const res = await apiGet<DailyRate>(`/api/erp/currency/daily-rate?${params.toString()}`);
      setDailyRate(res);
    } catch (err) {
      console.error("Failed to fetch daily rate", err);
      setDailyRate(null);
    } finally {
      setLoadingDailyRate(false);
    }
  };

  useEffect(() => {
    fetchRecentEntries();
    fetchCashSummary();
    fetchDailyRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, countryBranchId, cityBranchId, tableDateMode, tableDate, tableFromDate, tableToDate, entryDate]);

  const ledgerRowsWithAccount = useMemo(
    () => ledgers.filter((row) => Boolean(row.accountId && row.ledgerId)),
    [ledgers]
  );
  const cashBankLedgerRows = useMemo(
    () =>
      ledgerRowsWithAccount.filter((row) => {
        const text = [
          row.ledgerName,
          row.ledgerCode,
          row.accountName,
          row.accountCode,
          row.accountKind,
          row.scope
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes("cash") || text.includes("bank");
      }),
    [ledgerRowsWithAccount]
  );

  const cashBankLedgerOptions = useMemo(
    () => cashBankLedgerRows.map(toLedgerOption),
    [cashBankLedgerRows]
  );

  const selectedCashLedger = useMemo(
    () => {
      // Exclude the selected counterparty ledger from cash/bank selection to prevent duplicate ledger posting
      const validRows = ledgerRowsWithAccount.filter((row) => row.ledgerId !== counterLedgerId);

      const match = validRows.find((row) => row.ledgerId === cashLedgerId);
      if (match) return match;

      // Fallback: pick the first "cash" or "bank" ledger
      const cashFallback = validRows.find((r) => {
        const txt = [r.ledgerName, r.accountName].filter(Boolean).join(" ").toLowerCase();
        return txt.includes("cash") || txt.includes("bank");
      });
      if (cashFallback) return cashFallback;

      return null;
    },
    [ledgerRowsWithAccount, cashLedgerId, counterLedgerId]
  );

  const selectedCounterLedger = useMemo(
    () =>
      selectedLookupLedger?.ledgerId === counterLedgerId
        ? selectedLookupLedger
        : ledgerRowsWithAccount.find((row) => row.ledgerId === counterLedgerId) ?? null,
    [ledgerRowsWithAccount, counterLedgerId, selectedLookupLedger]
  );

  const isSamePostingLedger = Boolean(
    selectedCashLedger?.ledgerId &&
      selectedCounterLedger?.ledgerId &&
      selectedCashLedger.ledgerId === selectedCounterLedger.ledgerId
  );

  const branchCurrency =
    selectedCityBranch?.local_currency ||
    selectedMainBranch?.local_currency ||
    selectedCountry?.currency_code ||
    "USD";

  const cashBalanceText = useMemo(() => {
    if (!selectedCashLedger) return "—";
    const bal = selectedCashLedger.currentBalance ?? 0;
    const isCreditNormal = selectedCashLedger.normalBalance === "credit";
    let isDebit = bal >= 0;
    if (isCreditNormal) {
      isDebit = bal < 0;
    }
    const label = isDebit ? t(lang, "roz.balance_dr_banam", "Dr (Banam)") : t(lang, "roz.balance_cr_jama", "Cr (Jama)");
    return `${fmtAmount(Math.abs(bal))} ${selectedCashLedger.ledgerCurrency || branchCurrency} ${label}`;
  }, [selectedCashLedger, branchCurrency]);

  const targetAccountCurrency =
    selectedCounterLedger?.ledgerCurrency ||
    branchCurrency;

  const allowedCurrencies = useMemo(() => {
    const list = [
      branchCurrency,
      targetAccountCurrency,
      // Support multi-currency operations across the ERP
      "USD", "AED", "PKR", "AFN", "INR", "IRR"
    ]
      .map((v) => (v ?? "").toString().trim().toUpperCase())
      .filter(Boolean);
    return new Set(list);
  }, [branchCurrency, targetAccountCurrency]);

  const normalizedCurrency = currency.trim().toUpperCase();
  const isLocalCurrency = normalizedCurrency === targetAccountCurrency.toUpperCase();

  const showCalcPanel =
    Boolean(currency) &&
    ["USD", "AED", "AFN", "INR", "IRR", "PKR"].includes(currency.toUpperCase());

  const calcFinal = useMemo(() => {
    const cleanAmt = String(calcAmount || "").replace(/,/g, "").trim();
    const a = Number(cleanAmt);
    if (!Number.isFinite(a) || a <= 0) return null;

    const cleanRate = String(exchangeRate || "").replace(/,/g, "").trim();
    const p = Number(cleanRate);
    const rate = Number.isFinite(p) && p > 0 ? p : 1;

    if (calcOp === "div" && rate === 0) return null;
    const v = calcOp === "mul" ? a * rate : a / rate;
    return Number.isFinite(v) ? v : null;
  }, [calcAmount, calcOp, exchangeRate]);

  const amount = useMemo(() => {
    if (calcFinal !== null) return calcFinal;
    const cleanAmt = String(calcAmount || "").replace(/,/g, "").trim();
    const a = Number(cleanAmt);
    if (Number.isFinite(a) && a > 0) return a;
    return Number(finalPayment || 0);
  }, [calcFinal, calcAmount, finalPayment]);

  const txAmount = useMemo(() => {
    if (calcAmount) {
      const cleanAmt = String(calcAmount).replace(/,/g, "").trim();
      const a = Number(cleanAmt);
      if (Number.isFinite(a)) return a;
    }
    const rate = Number(String(exchangeRate || "1").replace(/,/g, ""));
    if (rate > 0) return amount / rate;
    return amount;
  }, [calcAmount, exchangeRate, amount]);

  useEffect(() => {
    if (!selectedCounterLedger) return;
    const code = selectedCounterLedger.accountCode || selectedCounterLedger.manualReferenceNumber || selectedCounterLedger.ledgerCode || "";
    setAccountNoInput(code);
    setAccountLookupError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCounterLedger?.ledgerId]);

  useEffect(() => {
    if (!cashLedgerId) return;
    if (selectedCounterLedger?.ledgerId && cashLedgerId === selectedCounterLedger.ledgerId) {
      setCashLedgerId("");
      return;
    }
    if (ledgerRowsWithAccount.some((row) => row.ledgerId === cashLedgerId)) return;
    setCashLedgerId("");
  }, [ledgerRowsWithAccount, cashLedgerId, selectedCounterLedger?.ledgerId]);

  const computedDetails = useMemo(() => {
    if (!paymentType) return "";
    let base = "";
    if (paymentType === "bank") {
      const bankName = typeDetails.bankName || "";
      const bankAccount = typeDetails.bankAccount || "";
      const transferType = typeDetails.method || typeDetails.transferType || "Bank Transfer";
      const transferNumber = typeDetails.transferReferenceNumber || typeDetails.refNo || typeDetails.ref || "";
      const attachment = attachmentFile?.name || typeDetails.bankAttachmentName || "";
      base = `Bank: ${bankName || "-"}${bankAccount ? ` (A/C: ${bankAccount})` : ""} | Transfer Type: ${transferType} | Transfer Number: ${transferNumber || "-"} | Attachment: ${attachment || "-"}`;
    } else if (paymentType === "cash") {
      const debitAcc = paymentMode === "DEBIT" 
        ? (selectedCounterLedger?.ledgerName || selectedCounterLedger?.accountName || "-")
        : (selectedCashLedger?.ledgerName || selectedCashLedger?.accountName || "-");
      const creditAcc = paymentMode === "CREDIT"
        ? (selectedCounterLedger?.ledgerName || selectedCounterLedger?.accountName || "-")
        : (selectedCashLedger?.ledgerName || selectedCashLedger?.accountName || "-");
      const receiverSender = typeDetails.receiverSenderName || typeDetails.receiver || "";
      const mobile = typeDetails.mobileNumber || "";
      base = `Debit Account: ${debitAcc} | Credit Account: ${creditAcc} | Amount: ${amount || 0} ${currency || ""} | Receiver/Sender: ${receiverSender || "-"} | Mobile: ${mobile || "-"}`;
    } else if (paymentType === "business" || paymentType === "invoice") {
      const invoiceNumber = typeDetails.invoiceNumber || "";
      const purchaseInfo = typeDetails.purchaseInfo || typeDetails.businessName || "";
      const transferInfo = typeDetails.transferInfo || typeDetails.receiptNumber || "";
      base = `Invoice Number: ${invoiceNumber || "-"} | Purchase Info: ${purchaseInfo || "-"} | Transfer Info: ${transferInfo || "-"}`;
    } else if (paymentType === "transfer") {
      const fromAcc = typeDetails.from || "";
      const toAcc = typeDetails.to || "";
      const ref = typeDetails.ref || "";
      base = `From: ${fromAcc || "-"} | To: ${toAcc || "-"} | Reference: ${ref || "-"}`;
    }

    return base;
  }, [
    paymentType,
    paymentMode,
    selectedCounterLedger,
    selectedCashLedger,
    amount,
    currency,
    typeDetails,
    attachmentFile
  ]);

  // Sync calculation details directly to remarks textarea dynamically
  useEffect(() => {
    if (showCalcPanel && calcAmount && exchangeRate && calcFinal !== null) {
      setRemarks((prev) => {
        const opSymbol = calcOp === "mul" ? "×" : "÷";
        const newCalcLine = `Calculation: ${Number(calcAmount).toLocaleString()} ${currency.toUpperCase()} ${opSymbol} ${Number(exchangeRate).toLocaleString()} = ${calcFinal.toFixed(2)} ${targetAccountCurrency}`;
        
        // Remove any existing lines starting with "Calculation:"
        const lines = prev.split("\n").map((l) => l.trim()).filter((l) => !l.startsWith("Calculation:"));
        lines.push(newCalcLine);
        return lines.filter(Boolean).join("\n");
      });
    } else {
      // If the calculation is no longer active/valid, remove any stale calculation lines
      setRemarks((prev) => {
        const lines = prev.split("\n").map((l) => l.trim()).filter((l) => !l.startsWith("Calculation:"));
        return lines.filter(Boolean).join("\n");
      });
    }
  }, [showCalcPanel, calcAmount, exchangeRate, calcOp, currency, calcFinal, targetAccountCurrency]);

  const detailsString = useMemo(() => {
    if (!paymentType) return "";
    if (paymentType === "bank") {
      const bankName = typeDetails.bankName || "";
      const method = typeDetails.method || "";
      const refNo = typeDetails.refNo || "";
      const payDate = typeDetails.payDate || entryDate;
      const formattedDate = payDate ? payDate.split("-").reverse().join("/") : "";
      const attachment = attachmentFile?.name || typeDetails.bankAttachmentName || "";
      
      const parts = [
        bankName && `Bank: ${bankName}`,
        method && `Method: ${method}`,
        refNo && `Ref: ${refNo}`,
        formattedDate && `Date: ${formattedDate}`,
        attachment && `Attachment: ${attachment}`
      ].filter(Boolean);
      
      return parts.length ? `Bank Details: ${parts.join(" | ")}` : "";
    }
    if (paymentType === "cash") {
      const receiver = typeDetails.receiverSenderName || "";
      const mobile = typeDetails.mobileNumber || "";
      const whatsapp = typeDetails.whatsappNumber || "";
      
      const parts = [
        receiver && `Receiver/Sender: ${receiver}`,
        mobile && `Mobile: ${mobile}`,
        whatsapp && `WhatsApp: ${whatsapp}`
      ].filter(Boolean);
      
      return parts.length ? `Cash Details: ${parts.join(" | ")}` : "";
    }
    if (paymentType === "transfer") {
      const fromVal = typeDetails.from || "";
      const toVal = typeDetails.to || "";
      const refVal = typeDetails.ref || "";
      
      const parts = [
        fromVal && `From: ${fromVal}`,
        toVal && `To: ${toVal}`,
        refVal && `Ref: ${refVal}`
      ].filter(Boolean);
      
      return parts.length ? `Transfer Details: ${parts.join(" | ")}` : "";
    }
    if (paymentType === "business" || paymentType === "invoice") {
      const invNo = typeDetails.invoiceNumber || "";
      const purInfo = typeDetails.purchaseInfo || typeDetails.businessName || "";
      
      const parts = [
        invNo && `Invoice #: ${invNo}`,
        purInfo && `Info: ${purInfo}`
      ].filter(Boolean);
      
      return parts.length ? `Invoice/Business Details: ${parts.join(" | ")}` : "";
    }
    return "";
  }, [paymentType, typeDetails, entryDate, attachmentFile]);

  // Sync category details directly to remarks textarea dynamically
  useEffect(() => {
    setRemarks((prev) => {
      const lines = prev.split("\n").map((l) => l.trim()).filter((l) => {
        return !l.startsWith("Bank Details:") &&
               !l.startsWith("Cash Details:") &&
               !l.startsWith("Transfer Details:") &&
               !l.startsWith("Invoice/Business Details:") &&
               !l.startsWith("Invoice Details:");
      });
      
      if (detailsString) {
        lines.push(detailsString);
      }
      return lines.filter(Boolean).join("\n");
    });
  }, [detailsString]);




  const computed = useMemo(() => {
    if (!selectedCounterLedger) return null;
    if (!amount || !(amount > 0)) return null;
    if (!paymentMode) return null;

    const entryType =
      paymentType === "bank"
        ? paymentMode === "DEBIT"
          ? "bank_deposit"
          : "bank_cheque"
        : (paymentType === "business" || paymentType === "invoice")
          ? paymentMode === "DEBIT"
            ? "debit"
            : "credit"
          : paymentMode === "DEBIT"
            ? "cash_receipt"
            : "cash_payment";

    const counter = {
      ledgerId: selectedCounterLedger.ledgerId,
      enterpriseAccountId: selectedCounterLedger.accountId!,
      debit: paymentMode === "DEBIT" ? amount : 0,
      credit: paymentMode === "CREDIT" ? amount : 0
    };

    return { entryType, counter };
  }, [
    amount,
    paymentMode,
    paymentType,
    selectedCounterLedger
  ]);

  // Load session + countries + global accounts once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingScope(true);
      try {
        const sessionRes = await apiGet<any>("/api/erp/auth/session");
        if (!cancelled) {
          setSession(sessionRes as SessionResponse);
        }
      } finally {
        if (!cancelled) setLoadingScope(false);
      }
    })();

    (async () => {
      setLoadingCountries(true);
      try {
        const rows = await listCountries({ withBranchesOnly: true });
        if (!cancelled) setCountries(rows);
      } finally {
        if (!cancelled) setLoadingCountries(false);
      }
    })();

    // Ledgers are now only fetched when the branch scope is selected (in the second useEffect).
    // This prevents global ledgers from overwriting branch-specific ledgers.

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch selected country daily USD rates
  useEffect(() => {
    if (!countries.length || !countryId) return;
    const currentCountry = countries.find(c => c.id === countryId);
    if (!currentCountry) return;
    (async () => {
      try {
        const params = new URLSearchParams({
          countryId: currentCountry.id,
          currency: "USD",
          branchCurrency: branchCurrency
        });
        const res = await apiGet<any>(`/api/erp/currency/latest-rate?${params.toString()}`);
        setCountryRate(res);
      } catch (err) {
        console.error("Failed to fetch country exchange rates", err);
      }
    })();
  }, [countries, countryId, branchCurrency]);

  // Load saved bank/method options (local cache until management setup tables are wired in).
  useEffect(() => {
    setSavedBanks(readLocalBankList(SAVED_BANKS_KEY));
    setSavedMethods(readLocalList(SAVED_METHODS_KEY));
  }, []);

  const inferredScopeMode = useMemo<CashEntryViewScope>(() => {
    if (session?.scopes?.isSuperAdmin) return "super_admin";
    // Country-level users can choose main/city within their assigned country (if multiple).
    if (session?.roles?.some((r) => r === "country_admin" || r === "main_branch_admin")) return "country";
    return "branch";
  }, [session]);

  const effectiveScopeMode = useMemo<CashEntryViewScope>(() => {
    if (scopeMode !== "auto") return scopeMode;
    return manualViewScope ?? inferredScopeMode;
  }, [inferredScopeMode, manualViewScope, scopeMode]);

  useEffect(() => {
    if (scopeMode !== "auto") return;
    setManualViewScope((current) => current ?? inferredScopeMode);
  }, [inferredScopeMode, scopeMode]);

  // If the user is not Super Admin, their country scope is fixed from login/session.
  useEffect(() => {
    if (!session) return;
    if (session.scopes.isSuperAdmin) return;

    // Country is fixed. If multiple are assigned, pick the first deterministically.
    // Branch-scoped users have no countryIds — fall back to their branch's own
    // country (branchCountryId, display/pre-fill only; scope stays server-enforced).
    const fixedCountryId =
      session.scopes.countryIds?.[0] ?? (session.scopes as any)?.summary?.branchCountryId ?? null;
    if (!countryId && fixedCountryId) {
      suppressScopeResetRef.current = true;
      setCountryId(fixedCountryId);
    }

    const branchIds = session.scopes.countryBranchIds ?? [];
    const cityIds = session.scopes.cityBranchIds ?? [];

    // For branch-level pages/users we must pick a concrete branch automatically.
    const forcePickBranch = effectiveScopeMode === "branch";

    // Country-level users can choose when multiple exist.
    if (!countryBranchId && branchIds.length) {
      if (forcePickBranch || branchIds.length === 1 || !session.scopes.isSuperAdmin) setCountryBranchId(branchIds[0]!);
    }

    if (!cityBranchId && cityIds.length) {
      if (forcePickBranch || cityIds.length === 1 || !session.scopes.isSuperAdmin) setCityBranchId(cityIds[0]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, effectiveScopeMode]);

  // When country changes, reset branch scope and currency.
  useEffect(() => {
    const suppress = suppressScopeResetRef.current;
    suppressScopeResetRef.current = false;

    if (!suppress) {
      setCountryBranchId("");
      setCityBranchId("");
      setCashLedgerId("");
      setCounterLedgerId("");
      setSelectedLookupLedger(null);
    }
    setMainBranches([]);
    setCityBranches([]);

    // Keep currency empty until an account is selected (matches reference UX).
    if (!suppress) setCurrency("");
    setCurrencyError(false);
    setExchangeRate("1");
     
  }, [countryId]);

  // Load main branches for selected country.
  useEffect(() => {
    let cancelled = false;
    if (!countryId) return;

    (async () => {
      const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}`, {
        cache: "no-store"
      });
      if (!res.ok) return;
      const json = (await res.json()) as { countryBranches?: CountryBranchRow[] };
      const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
      const mains = list.filter((b) => b.is_main);
      if (!cancelled) {
        setMainBranches(mains);
        const assignedBranchIds = session?.scopes?.countryBranchIds ?? [];
        const assignedBranch = assignedBranchIds.length
          ? mains.find((branch) => assignedBranchIds.includes(branch.id))
          : null;
        if (!countryBranchId && assignedBranch) setCountryBranchId(assignedBranch.id);
        else if (!countryBranchId && mains.length === 1) setCountryBranchId(mains[0]!.id);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countryId, countryBranchId, session]);

  // Load city branches for selected main branch.
  useEffect(() => {
    let cancelled = false;
    if (!countryId || !countryBranchId) return;

    (async () => {
      const res = await fetch(
        `/api/branch-management/city-branches?countryId=${encodeURIComponent(countryId)}&countryBranchId=${encodeURIComponent(
          countryBranchId
        )}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = (await res.json()) as { cityBranches?: CityBranchRow[] };
      const list = Array.isArray(json.cityBranches) ? json.cityBranches : [];
      if (!cancelled) {
        setCityBranches(list);
        const assignedCityIds = session?.scopes?.cityBranchIds ?? [];
        const assignedCity = assignedCityIds.length
          ? list.find((branch) => assignedCityIds.includes(branch.id))
          : null;
        if (!cityBranchId && assignedCity) setCityBranchId(assignedCity.id);
        else if (!cityBranchId && list.length === 1) setCityBranchId(list[0]!.id);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countryId, countryBranchId, session]);

  // Load ledgers once the branch scope is selected.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingLedgers(true);
      try {
        const res = await listLedgerReportLedgers({
          reportScope: countryId ? "country" : "super_admin",
          countryId: countryId || null,
          countryBranchId: null,
          cityBranchId: null,
          limit: 3000,
          language: lang
        });
        if (!cancelled) {
          const rows = Array.isArray(res.ledgers) ? res.ledgers : [];
          
          // Ensure selected lookup ledger is kept in the list
          const selectedRow = selectedLookupLedger || ledgers.find(r => r.ledgerId === counterLedgerId);
          const finalRows = [...rows];
          if (selectedRow && !finalRows.some(r => r.ledgerId === selectedRow.ledgerId)) {
            finalRows.unshift(selectedRow);
          }

          setLedgers(finalRows);

          // Sensible defaults: pick first "cash" ledger that has a linked account.
          const validRows = finalRows.filter((row) => Boolean(row.accountId && row.ledgerId));
          const cashGuess =
            validRows.find((r) => (r.ledgerName ?? "").toLowerCase().includes("cash")) ??
            validRows.find((r) => (r.accountName ?? "").toLowerCase().includes("cash")) ??
            null;
          if (cashGuess?.ledgerId) setCashLedgerId(cashGuess.ledgerId);
          else if (validRows[0]?.ledgerId) setCashLedgerId(validRows[0].ledgerId);
        }
      } finally {
        if (!cancelled) setLoadingLedgers(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cityBranchId, countryId, countryBranchId, ledgerRefreshCount]);

  // Keep currency aligned with ledger currency when a ledger is selected.
  useEffect(() => {
    const next = (selectedCounterLedger?.ledgerCurrency || selectedCashLedger?.ledgerCurrency || "").trim();
    if (next && next.length === 3) setCurrency(next.toUpperCase());
  }, [selectedCashLedger, selectedCounterLedger]);

  const canSave =
    Boolean(countryId && countryBranchId) &&
    Boolean(selectedCounterLedger?.ledgerId) &&
    Boolean(paymentMode) &&
    Boolean(paymentType) &&
    Boolean(amount && amount > 0) &&
    currency.trim().length === 3 &&
    Number(exchangeRate) > 0 &&
    !saving;

  useEffect(() => {
    console.log("canSave check details:", {
      countryBranch: Boolean(countryId && countryBranchId),
      selectedCounter: Boolean(selectedCounterLedger?.ledgerId),
      paymentMode: Boolean(paymentMode),
      paymentType: Boolean(paymentType),
      amountVal: Boolean(amount && amount > 0),
      currencyLen: (currency || "").trim().length === 3,
      exchangeRateVal: Number(exchangeRate) > 0,
      saving: !saving,
      amount,
      currency,
      exchangeRate,
      selectedCounterLedger
    });
  }, [countryId, countryBranchId, selectedCounterLedger, paymentMode, paymentType, amount, currency, exchangeRate, saving]);

  const canEditOrDelete = useMemo(() => {
    if (!session) return false;
    if (session.scopes?.isSuperAdmin || (session as any).isSuperAdmin) return true;
    const perms = (session as any).permissions || [];
    if (perms.includes("*:*") || perms.includes("roznamcha:*") || perms.includes("roznamcha:update") || perms.includes("roznamcha:delete")) {
      return true;
    }
    const allowedRoles = ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "branch_admin", "admin", "accountant"];
    return session.roles?.some((role) => allowedRoles.includes(role)) ?? false;
  }, [session]);

  function applyScopeFromLedger(row: LedgerLookupRow) {
    if (!row.countryId || !row.countryBranchId) return;

    const needsCountry = row.countryId !== countryId;
    const needsMain = row.countryBranchId !== countryBranchId;
    const nextCityBranchId = row.cityBranchId ?? "";
    const needsCity = nextCityBranchId !== cityBranchId;

    suppressScopeResetRef.current = true;
    if (needsCountry) setCountryId(row.countryId);
    if (needsMain) setCountryBranchId(row.countryBranchId);
    if (needsCity) setCityBranchId(nextCityBranchId);
  }

  function applyPostingLedger(row: LedgerLookupRow) {
    setLedgers((current) => {
      if (current.some((item) => item.ledgerId === row.ledgerId)) return current;
      return [row, ...current];
    });
    const code = row.accountCode || row.manualReferenceNumber || row.customerNumber || row.ledgerCode || "";
    setSelectedLookupLedger(row);
    setCounterLedgerId(row.ledgerId);
    setAccountNoInput(code);
    setAccountLookupError(null);
    applyScopeFromLedger(row);

    const nextCur = (row.ledgerCurrency || "").trim();
    if (nextCur.length === 3) setCurrency(nextCur.toUpperCase());
    setRoznamchaBookType((current) => current || "branch_payment_voucher");
  }

  function handleCounterLedgerChange(nextId: string) {
    setCounterLedgerId(nextId);
    const row = ledgers.find((r) => r.ledgerId === nextId) ?? null;
    setSelectedLookupLedger(row);
    if (!row) return;

    applyPostingLedger(row);
  }

  function clearSelectedAccount() {
    setCounterLedgerId("");
    setSelectedLookupLedger(null);
    setAccountNoInput("");
    setAccountLookupError(null);
    setPaymentType("");
    setPaymentMode("");
    setFinalPayment("");
    setTypeDetails({});
    setCurrency("");
    setCurrencyError(false);
    setCalcAmount("");
    setCalcPrice("");
    setCalcOp("mul");
    setExchangeRate("1");
    setAttachmentFile(null);
    setActiveCreator("");
    setActiveApprover("");
    setActiveStatus("");
  }

  function resetPaymentDraft() {
    clearSelectedAccount();
    setRoznamchaBookType("");
    setRoznamchaType("Cash Book No.");
    setRoznamchaNumber("");
    setEntryDate(todayIso());
    setReferenceNo("");
    setNarration("");
    setRemarks("");
    setAttachmentFile(null);
    setMessage(null);
    setActionMenuOpen(false);
    setLedgerRefreshCount((c) => c + 1);
  }

  async function lookupAccountNo() {
    const queryValue = accountNoInput;
    const needle = queryValue.trim().toLowerCase();
    if (!needle) return;

    const match =
      ledgerRowsWithAccount.find((row) => {
        const exactKeys = [
          row.accountCode,
          row.rawAccountCode,
          row.ledgerCode,
          row.manualReferenceNumber,
          row.customerNumber
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        if (exactKeys.includes(needle)) return true;

        const fuzzy = [row.accountName, row.ledgerName, row.countrySerialNumber, row.branchSerialNumber]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return fuzzy.includes(needle);
      }) ?? null;

    if (match?.ledgerId) {
      applyPostingLedger(match);
      return;
    }

    try {
      setAccountLookupError(null);
      const params = new URLSearchParams({ q: queryValue.trim(), limit: "500" });
      if (!isSuperAdmin) {
        if (countryId) params.set("countryId", countryId);
        if (countryBranchId) params.set("countryBranchId", countryBranchId);
        if (cityBranchId) params.set("cityBranchId", cityBranchId);
      }
      const res = await apiGet<AccountLookupResponse>(`/api/erp/accounting/accounts/lookup?${params.toString()}`);
      if (res.found && res.account?.ledgerId) {
        applyPostingLedger(res.account);
        return;
      }
      setAccountLookupError(t(lang, "cef.account_not_found", "Account not found in Account Master. Check Account Number, Manual Reference, Customer Number, or Account Name."));
    } catch (error) {
      setAccountLookupError(error instanceof Error ? error.message : t(lang, "cef.account_lookup_failed", "Account lookup failed."));
    }
  }

  function openAddOption(type: "bank" | "method") {
    setAddOptionType(type);
    setAddOptionValue("");
    setAddOptionAddress("");
    setAddOptionOpen(true);
  }

  function commitAddOption() {
    const value = addOptionValue.trim();
    if (!value) return;

    if (addOptionType === "bank") {
      const exists = savedBanks.some((b) => b.name.toLowerCase() === value.toLowerCase());
      if (!exists) {
        const next = [...savedBanks, { name: value, address: addOptionAddress.trim() }];
        setSavedBanks(next);
        writeLocalBankList(SAVED_BANKS_KEY, next);
      }
      setTypeDetails((prev) => ({ ...prev, bankName: value }));
    } else {
      const exists = savedMethods.some((m) => m.toLowerCase() === value.toLowerCase());
      if (!exists) {
        const next = [...savedMethods, value];
        setSavedMethods(next);
        writeLocalList(SAVED_METHODS_KEY, next);
      }
      setTypeDetails((prev) => ({ ...prev, method: value }));
    }

    setAddOptionOpen(false);
  }

  function renameCustomMethod(oldName: string, newName: string) {
    const cleanedNew = newName.trim();
    if (!cleanedNew) return;
    const next = savedMethods.map((m) => (m === oldName ? cleanedNew : m));
    setSavedMethods(next);
    writeLocalList(SAVED_METHODS_KEY, next);
    if (typeDetails.method === oldName) {
      setTypeDetails((prev) => ({ ...prev, method: cleanedNew }));
    }
  }

  function deleteCustomMethod(name: string) {
    const next = savedMethods.filter((m) => m !== name);
    setSavedMethods(next);
    writeLocalList(SAVED_METHODS_KEY, next);
    if (typeDetails.method === name) {
      setTypeDetails((prev) => ({ ...prev, method: "" }));
    }
  }

  function parseNarrationRemarks(narration: string | null | undefined) {
    if (!narration) return "";
    const lines = narration.split("\n").filter(l => 
      !l.trim().startsWith("[Audit Trail") &&
      !l.trim().startsWith("Calculation:") &&
      !l.trim().startsWith("Bank Details:") &&
      !l.trim().startsWith("Cash Details:") &&
      !l.trim().startsWith("Transfer Details:") &&
      !l.trim().startsWith("Invoice/Business Details:") &&
      !l.trim().startsWith("Invoice Details:")
    );
    if (lines.length === 0) return "";
    
    const firstLine = lines[0];
    const hasDetails = firstLine.includes(" | ") || 
                       /^(Bank|Debit Account|Invoice Number|From):/i.test(firstLine);
                       
    const remarksLines = hasDetails ? lines.slice(1) : lines;
    return remarksLines.join("\n").trim();
  }

  function parseAuditTrail(narration: string | null | undefined) {
    if (!narration) return null;
    const match = narration.match(/\[Audit Trail - Qty:\s*([0-9.,]+)\s*\|\s*Currency:\s*([A-Z]{3})\s*\|\s*Rate:\s*([0-9.,]+)\s*\|\s*Op:\s*([×÷*\/])\s*\|\s*Converted:\s*[0-9.,]+\s*[A-Z]{3}\]/i);
    if (match) {
      return {
        qty: match[1].replace(/,/g, ""),
        currency: match[2].toUpperCase(),
        rate: match[3].replace(/,/g, ""),
        op: match[4] === "÷" || match[4] === "/" ? ("div" as const) : ("mul" as const)
      };
    }
    return null;
  }

  function parseNarrationDetails(narration: string | null | undefined) {
    const details: Record<string, string> = {};
    if (!narration) return details;
    
    const lines = narration.split("\n").filter(l => !l.trim().startsWith("[Audit Trail"));
    if (lines.length === 0) return details;

    const detailsLine = lines.find(l => 
      l.startsWith("Bank Details:") || 
      l.startsWith("Cash Details:") || 
      l.startsWith("Transfer Details:") || 
      l.startsWith("Invoice/Business Details:") ||
      l.startsWith("Invoice Details:")
    );

    let lineToParse = lines[0];
    if (detailsLine) {
      const colonIdx = detailsLine.indexOf(":");
      lineToParse = detailsLine.slice(colonIdx + 1).trim();
    }

    const parts = lineToParse.split(" | ");
    
    for (const part of parts) {
      const colonIdx = part.indexOf(":");
      if (colonIdx === -1) continue;
      const rawKey = part.slice(0, colonIdx).trim().toLowerCase();
      let val = part.slice(colonIdx + 1).trim();
      if (val === "-") val = "";
      
      if (rawKey === "bank") {
        const acMatch = val.match(/^(.*?)\s*\(A\/C:\s*(.*?)\)$/);
        if (acMatch) {
          details.bankName = acMatch[1].trim() === "-" ? "" : acMatch[1].trim();
          details.bankAccount = acMatch[2].trim() === "-" ? "" : acMatch[2].trim();
        } else {
          details.bankName = val;
        }
      } else if (rawKey === "transfer type" || rawKey === "method") {
        details.method = val;
        details.transferType = val;
      } else if (rawKey === "transfer number" || rawKey === "reference" || rawKey === "transfer info" || rawKey === "ref") {
        details.transferReferenceNumber = val;
        details.refNo = val;
        details.ref = val;
      } else if (rawKey === "attachment") {
        details.bankAttachmentName = val;
      } else if (rawKey === "receiver/sender" || rawKey === "receiver") {
        details.receiverSenderName = val;
        details.receiver = val;
      } else if (rawKey === "mobile") {
        details.mobileNumber = val;
      } else if (rawKey === "whatsapp") {
        details.whatsappNumber = val;
      } else if (rawKey === "invoice number" || rawKey === "invoice #") {
        details.invoiceNumber = val;
      } else if (rawKey === "purchase info" || rawKey === "business name" || rawKey === "info") {
        details.purchaseInfo = val;
        details.businessName = val;
      } else if (rawKey === "from") {
        details.from = val;
      } else if (rawKey === "to") {
        details.to = val;
      } else if (rawKey === "date") {
        if (val.includes("/")) {
          const dParts = val.split("/");
          if (dParts.length === 3) {
            details.payDate = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
          }
        } else {
          details.payDate = val;
        }
      }
    }
    return details;
  }

  const buildA4RowsForEntry = (data: any) => {
    const header = data.header || {};
    const lines = data.lines || [];
    const firstLine = lines[0];
    const secondLine = lines[1];
    
    const isDebit = Number(firstLine?.debit || 0) > 0;
    const entrySerial = firstLine?.entry_serial_number || (isDebit ? `DR-${header.id?.slice(0, 6)?.toUpperCase()}` : `CR-${header.id?.slice(0, 6)?.toUpperCase()}`);

    const rowsForPrint: { label: string; value: string }[] = [
      { label: t(lang, "cef.print_global_serial", "Global Serial (Super Admin)"), value: header.super_admin_serial_number || "-" },
      { label: t(lang, "cef.print_country_serial", "Country Serial"), value: header.country_transaction_serial_number || "-" },
      { label: t(lang, "cef.print_branch_serial", "Branch Serial"), value: header.branch_transaction_serial_number || "-" },
      { label: t(lang, "cef.print_entry_serial", "Entry Serial (DR/CR)"), value: entrySerial || "-" },
      { label: t(lang, "cef.print_date", "Date"), value: header.entry_date || "-" },
      { label: t(lang, "cef.print_voucher_no", "Voucher No"), value: header.voucher_no || "-" },
      { label: t(lang, "cef.print_journal_no", "Journal No"), value: header.journal_no || "-" },
      { label: t(lang, "cef.print_narration", "Narration"), value: resolveVerifiedTranslation(header.translations?.narration, lang) || translateNarrationBlock(header.narration, lang) || "-" },
      { label: t(lang, "cef.print_status", "Status"), value: header.status || "-" }
    ];

    if (firstLine) {
      rowsForPrint.push({
        label: t(lang, "cef.print_counterparty_account", "Counterparty Account"),
        value: `${firstLine.account_number || "-"} | ${firstLine.ledgers?.name || "-"} | ${firstLine.debit ? t(lang, "cef.print_debit_receive", "Debit (Receive)") : t(lang, "cef.print_credit_pay", "Credit (Pay)")} ${fmtAmount(Number(firstLine.debit || firstLine.credit || 0))} ${firstLine.currency || ""}`
      });
    }
    if (secondLine) {
      rowsForPrint.push({
        label: t(lang, "cef.print_cash_bank_account", "Cash/Bank Account"),
        value: `${secondLine.account_number || "-"} | ${secondLine.ledgers?.name || "-"} | ${secondLine.debit ? t(lang, "cef.print_debit_receive", "Debit (Receive)") : t(lang, "cef.print_credit_pay", "Credit (Pay)")} ${fmtAmount(Number(secondLine.debit || secondLine.credit || 0))} ${secondLine.currency || ""}`
      });
    }
    return rowsForPrint;
  };

  const handleViewA4ById = async (id: string) => {
    try {
      const res = await apiGet<any>(`/api/erp/roznamcha/${id}`);
      if (res.found && res.header) {
        openA4ReportWindow({
          title: t(lang, "cef.print_title", "Roznamcha Cash Entry"),
          subtitle: `${res.header.voucher_no || ""} · ${res.header.entry_date || ""}`,
          rows: buildA4RowsForEntry(res),
          autoPrint: false,
          lang
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Compact top-bar Print/PDF — print the currently-loaded/filtered register as
  // one A4 report (reuses the same openA4ReportWindow print engine as the
  // per-row "Print A4" action; autoPrint controls whether the browser print
  // dialog opens immediately or the user picks "Save as PDF" themselves).
  const handlePrintRegister = (_autoPrint: boolean) => {
    // One journal-register row per posted line, using the shared journal print standard.
    const rows: Record<string, unknown>[] = [];
    filteredRecentEntries.forEach((row) => {
      (row.roznamcha_lines || []).forEach((line: any) => {
        rows.push({
          date: row.entry_date || row.created_at,
          voucher: row.voucher_no || row.journal_no || row.reference_no || "-",
          user: row.profiles?.full_name || row.created_by || "-",
          account: line.ledgers?.name || "-",
          accountNo: line.account_number || "-",
          narration: row.narration || "-",
          currency: line.currency || branchCurrency,
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
        });
      });
    });
    const totalDebit = rows.reduce((sum, r) => sum + Number(r.debit || 0), 0);
    const totalCredit = rows.reduce((sum, r) => sum + Number(r.credit || 0), 0);
    const period =
      tableDateMode === "day"
        ? (tableDate || entryDate || todayIso())
        : tableDateMode === "range"
          ? `${tableFromDate || "…"} → ${tableToDate || "…"}`
          : t(lang, "common.all", "All");
    void openScopedGenericReport({
      title: t(lang, "roz.cef_backdrop_title", "Cash / Roznamcha Entry"),
      subtitle: `${selectedCountry?.name || ""} ${selectedMainBranch ? "· " + selectedMainBranch.name : ""} ${selectedCityBranch ? "· " + selectedCityBranch.name : ""}`.trim(),
      lang,
      orientation: "landscape",
      countryId: countryId || null,
      countryBranchId: countryBranchId || null,
      cityBranchId: cityBranchId || null,
      countryName: selectedCountry?.name,
      branchName: selectedCityBranch?.name || selectedMainBranch?.name,
      reportPeriod: period,
      filters: [
        { label: pl("Period"), value: period },
        ...(tableSearchQuery.trim() ? [{ label: pl("Search"), value: tableSearchQuery.trim() }] : []),
      ],
      columns: [
        { key: "date", label: pl("Date"), format: "date", align: "center" },
        { key: "voucher", label: pl("Voucher No"), align: "center" },
        { key: "user", label: pl("User") },
        { key: "account", label: pl("Account") },
        { key: "accountNo", label: pl("Account No"), align: "center" },
        { key: "narration", label: pl("Narration") },
        { key: "currency", label: pl("Currency"), align: "center" },
        { key: "debit", label: pl("Debit"), format: "number", align: "right" },
        { key: "credit", label: pl("Credit"), format: "number", align: "right" },
      ],
      rows,
      totalsRow: { debit: totalDebit, credit: totalCredit },
    });
  };

  const handleEditEntry = (row: any) => {
    const h = row.header || row;
    const lines = row.roznamcha_lines || row.lines || [];
    setEditEntryId(h.id || row.id);
    setShowPaymentWorkReport(true);
    suppressScopeResetRef.current = true;
    if (h.country_id) setCountryId(h.country_id);
    if (h.country_branch_id) setCountryBranchId(h.country_branch_id);
    if (h.city_branch_id) setCityBranchId(h.city_branch_id);
    
    setEntryDate(h.entry_date);
    setReferenceNo(h.reference_no || "");
    
    const narration = h.narration || "";
    setRemarks(parseNarrationRemarks(narration));
    
    const firstLine = lines[0];
    const secondLine = lines[1];
    
    if (firstLine) {
      setCounterLedgerId(firstLine.ledger_id);
      
      const type = firstLine.payment_entry_type || "";
      const isDebit = Number(firstLine.debit || 0) > 0 || ["cash_receipt", "bank_deposit", "debit"].includes(type);
      
      setPaymentMode(isDebit ? "DEBIT" : "CREDIT");
      
      let cat = "";
      if (["cash_receipt", "cash_payment"].includes(type)) {
        cat = "cash";
      } else if (["bank_deposit", "bank_cheque"].includes(type)) {
        cat = "bank";
      } else if (["debit", "credit"].includes(type)) {
        if (narration.includes("From:") && narration.includes("To:")) {
          cat = "transfer";
        } else if (narration.includes("Invoice Number:")) {
          cat = "invoice";
        } else {
          cat = "business";
        }
      }
      setPaymentType(cat as any);
      
      setTypeDetails(parseNarrationDetails(narration));
      
      const audit = parseAuditTrail(narration);
      if (audit) {
        setCurrency(audit.currency);
        setCalcAmount(audit.qty);
        setExchangeRate(audit.rate);
        setCalcOp(audit.op);
        const amt = Number(firstLine.debit || firstLine.credit || 0);
        setFinalPayment(String(amt));
      } else {
        setCurrency(firstLine.currency || "");
        const amt = Number(firstLine.debit || firstLine.credit || 0);
        setFinalPayment(String(amt));
        setCalcAmount("");
        setExchangeRate("1");
        setCalcOp("mul");
      }
    }
    
    if (secondLine) {
      setCashLedgerId(secondLine.ledger_id);
    }
    
    setSavedSerials({
      superAdmin: h.super_admin_serial_number || row.super_admin_serial_number,
      country: h.country_transaction_serial_number || row.country_transaction_serial_number,
      branch: h.branch_transaction_serial_number || row.branch_transaction_serial_number
    });

    setActiveCreator(h.profiles?.full_name || row.profiles?.full_name || "System User");
    setActiveApprover(h.approver_profile?.full_name || row.approver_profile?.full_name || (h.status === "approved" ? "Approved" : "Pending"));
    setActiveStatus(h.status || row.status || "posted");
    
    setMessage(`Editing entry serials: ${[h.super_admin_serial_number || row.super_admin_serial_number, h.country_transaction_serial_number || row.country_transaction_serial_number, h.branch_transaction_serial_number || row.branch_transaction_serial_number].filter(Boolean).join(" / ")}`);
    
    const formElement = document.querySelector("h3")?.closest(".Card") || document.querySelector(".Payment-Work-Entry-card");
    formElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleEditLastEntry = async () => {
    if (!lastEntryId) return;
    try {
      const res = await apiGet<any>(`/api/erp/roznamcha/${lastEntryId}`);
      if (res.found && res.header) {
        handleEditEntry(res);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const searchParams = useSearchParams();
  const urlEntryId = searchParams.get("entryId") || searchParams.get("id");

  useEffect(() => {
    if (!urlEntryId) return;
    let alive = true;
    apiGet<any>(`/api/erp/roznamcha/${encodeURIComponent(urlEntryId)}`)
      .then((res) => {
        if (!alive) return;
        if (res?.found && res?.header) {
          handleEditEntry(res);
        }
      })
      .catch((err) => {
        console.error("Failed to auto-load roznamcha entry for edit:", err);
      });
    return () => { alive = false; };
  }, [urlEntryId]);

  const handleDeleteEntry = async (entryId: string) => {
    if (!entryId || !canEditOrDelete) return;
    const confirmed = window.confirm(t(lang, "roz.cef_confirm_delete_reversal", "Delete this entry by creating a reversal record?"));
    if (!confirmed) return;

    try {
      setMessage(null);
      const res = await fetch(`/api/erp/roznamcha/${entryId}`, { method: "DELETE" });
      if (!res.ok) {
        const errText = await res.text();
        setMessage(`Failed to delete entry: ${errText}`);
        return;
      }
      setMessage("Entry deleted successfully.");
      setActiveRowMenuId(null);
      fetchRecentEntries();
      fetchCashSummary();
    } catch (error: any) {
      setMessage(`Failed to delete entry: ${error?.message || "Unknown error"}`);
    }
  };
  async function save() {
    if (savingRef.current) return null;
    savingRef.current = true;
    setMessage(null);
    setLastEntryId(null);

    if (!canSave) {
      setMessage("Please select account, Debit/Credit transaction type, currency, and amount.");
      savingRef.current = false;
      return null;
    }


    if (editEntryId) {
      try {
        const delRes = await fetch(`/api/erp/roznamcha/${editEntryId}`, { method: "DELETE" });
        if (!delRes.ok) {
          const errText = await delRes.text();
          setMessage(`Failed to reverse old entry for edit: ${errText}`);
          return null;
        }
      } catch (e: any) {
        setMessage(`Failed to reverse old entry: ${e.message}`);
        return null;
      }
    }

    // Voucher / Journal numbers are generated automatically; do not ask the user to enter them.
    const effectiveVoucher = generateCode("V");
    const effectiveJournal = generateCode("J");

    setSaving(true);
    try {
      let auditTrail = "";
      if (showCalcPanel && calcFinal !== null) {
        const opSymbol = calcOp === "mul" ? "×" : "÷";
        auditTrail = `[Audit Trail - Qty: ${calcAmount} | Currency: ${currency.toUpperCase()} | Rate: ${exchangeRate} | Op: ${opSymbol} | Converted: ${amount.toFixed(2)} ${branchCurrency}]`;
      } else {
        auditTrail = `[Audit Trail - Final Amount: ${amount.toFixed(2)} ${branchCurrency} (Local Currency Entry)]`;
      }
      const combinedNarration = remarks.trim();
      const finalNarration = `${combinedNarration.trim()}\n${auditTrail}`;
      
      let effectivePostingType = postingType || "branch";
      if (selectedCounterLedger?.scope === "super_admin") effectivePostingType = "super_admin";
      else if (selectedCounterLedger?.scope === "country") effectivePostingType = "country";
      else if (selectedCounterLedger?.scope === "main_branch" || selectedCounterLedger?.scope === "city_branch" || selectedCounterLedger?.scope === "country_branch" || selectedCounterLedger?.scope === "branch") effectivePostingType = "branch";

      const payload = {
        mode: "post" as const,
        type: effectivePostingType,
        countryId: effectivePostingType === "super_admin" ? null : (selectedCounterLedger?.countryId || countryId || null),
        countryBranchId: (effectivePostingType === "super_admin" || effectivePostingType === "country") ? null : (selectedCounterLedger?.countryBranchId || countryBranchId || null),
        cityBranchId: (effectivePostingType === "super_admin" || effectivePostingType === "country") ? null : (selectedCounterLedger?.cityBranchId || cityBranchId || null),
        entryDate,
        roznamchaBookType,
        journalNo: effectiveJournal,
        voucherNo: effectiveVoucher,
        paymentMethodId: null,
        referenceNo: referenceNo.trim() ? referenceNo.trim() : undefined,
        narration: finalNarration.trim() ? finalNarration.trim() : undefined,
        originalLanguage: lang,
        sourceModule: "cash_entry",
        sourceTransactionType: roznamchaType,
        sourceReferenceNo: roznamchaNumber,
        paymentDetails: {
          roznamchaBookType,
          paymentType: paymentMode === "DEBIT" ? "money_paid" : "money_received",
          roznamchaCategory: paymentType || null,
          paymentMode,
          quantity: 1,
          finalAmount: amount,
          currency,
          exchangeRate: Number(exchangeRate),
          exchangeRateSource,
          exchangeRateEffectiveAt,
          counterLedgerId,
          receiverSenderName: typeDetails.receiverSenderName ?? typeDetails.receiver ?? null,
          mobileNumber: typeDetails.mobileNumber ?? null,
          whatsappNumber: typeDetails.whatsappNumber ?? null,
          idCardCopyName: typeDetails.idCardCopyName ?? null,
          bankId: typeDetails.bankId ?? null,
          bankName: typeDetails.bankName ?? null,
          bankAccount: typeDetails.bankAccount ?? null,
          transferReferenceNumber: typeDetails.transferReferenceNumber ?? typeDetails.refNo ?? typeDetails.ref ?? null,
          paymentReference: typeDetails.transferReferenceNumber ?? typeDetails.refNo ?? typeDetails.ref ?? null,
          paymentDate: typeDetails.payDate ?? null,
          bankAttachmentName: typeDetails.bankAttachmentName ?? null,
          receiver: typeDetails.receiverSenderName ?? typeDetails.receiver ?? null,
          purpose: typeDetails.purpose ?? null,
          transferFrom: typeDetails.from ?? null,
          transferTo: typeDetails.to ?? null,
          businessName: typeDetails.businessName ?? typeDetails.bizName ?? null,
          invoiceNumber: typeDetails.invoiceNumber ?? null,
          invoiceName: typeDetails.invoiceName ?? null,
          receiptNumber: typeDetails.receiptNumber ?? null,
          attachmentName: attachmentFile?.name ?? null,
          transferType: typeDetails.transferType ?? null,
          invoiceType: typeDetails.invoiceType ?? null,
          purchaseInfo: typeDetails.purchaseInfo ?? null,
          transferInfo: typeDetails.transferInfo ?? null
        },
        lines: [
          {
            paymentEntryType: roznamchaBookType === "bank" ? (paymentMode === "DEBIT" ? "bank_cheque" : "bank_deposit") : (paymentMode === "DEBIT" ? "cash_payment" : "cash_receipt"),
            enterpriseAccountId: selectedCounterLedger?.accountId || null,
            ledgerId: counterLedgerId || "",
            description: finalNarration.trim() ? finalNarration.trim() : undefined,
            debit: paymentMode === "DEBIT" ? amount : 0,
            credit: paymentMode === "CREDIT" ? amount : 0,
            currency: targetAccountCurrency.trim().toUpperCase(),
            exchangeRate: Number(exchangeRate),
            accountNumber: selectedCounterLedger?.accountCode || selectedCounterLedger?.rawAccountCode || null,
            manualReferenceNumber: selectedCounterLedger?.manualReferenceNumber || null,
            customerNumber: selectedCounterLedger?.customerNumber || null,
            countrySerialNumber: selectedCounterLedger?.countrySerialNumber || null,
            branchSerialNumber: selectedCounterLedger?.branchSerialNumber || null
          }
        ]
      };

      const res = await apiPost<RoznamchaPostResponse>("/api/erp/roznamcha", payload);
      setLastEntryId(res.entryId ?? null);
      setEditEntryId(null);
      const incrementSerial = (serial: string | null | undefined) => {
        if (!serial) return null;
        const parts = serial.split("-");
        if (parts.length === 2) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num)) {
            return `${parts[0]}-${(num + 1).toString().padStart(parts[1].length, "0")}`;
          }
        }
        return serial;
      };

      setSavedSerials({
        superAdmin: incrementSerial(res.superAdminSerialNumber),
        country: incrementSerial(res.countryTransactionSerialNumber),
        branch: incrementSerial(res.branchTransactionSerialNumber),
        mainBranch: incrementSerial((res as any).mainBranchTransactionSerialNumber),
        cityBranch: incrementSerial((res as any).cityBranchTransactionSerialNumber),
        entrySerial: incrementSerial((res as any).entrySerialNumber)
      });
      const roleName = session?.roles?.[0] ? session.roles[0].replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "User";
      setActiveCreator(`${session?.user?.fullName || "System User"} | ${roleName}`);
      setActiveApprover(res.balanced ? "System / Auto Approved" : "Pending");
      setActiveStatus("posted");
      const serialText = [res.superAdminSerialNumber, res.countryTransactionSerialNumber, res.branchTransactionSerialNumber, (res as any).mainBranchTransactionSerialNumber, (res as any).cityBranchTransactionSerialNumber, (res as any).entrySerialNumber]
        .filter(Boolean)
        .join(" / ");
      setMessage(`Saved successfully. Serials: ${serialText || res.entryId || "N/A"}`);
      window.dispatchEvent(
        new CustomEvent("erp:posting-saved", {
          detail: { source: "roznamcha", entryId: res.entryId ?? null }
        })
      );
      onSaved?.(res.entryId ?? null);
      // Link the AI intake document to the real roznamcha entry it produced
      // (job → 'linked', draft → 'consumed'). Never fails the user's save.
      if (intakeDraft.draft && res.entryId) {
        void intakeDraft.consume(res.entryId);
        setIntakeApplied(false);
        setIntakeBannerDismissed(true);
      }
      fetchRecentEntries();
      fetchCashSummary();
      // Auto-clear form fields for next entry and close modal
      setShowPaymentWorkReport(false);
      setEditEntryId(null);
      setCounterLedgerId("");
      setSelectedLookupLedger(null);
      setCalcAmount("");
      setCalcPrice("");
      setReferenceNo("");
      setRemarks("");
      setTypeDetails({});
      setAttachmentFile(null);
      setFinalPayment("");

      return res.entryId ?? null;
    } catch (e: any) {
      setMessage(e?.message || "Save failed");
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const countryOptions: SearchSelectOption[] = useMemo(
    () => countries.map((c) => ({ value: c.id, label: `${c.name} (${c.currency_code})` })),
    [countries]
  );

  const mainBranchOptions: SearchSelectOption[] = useMemo(
    () => mainBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
    [mainBranches]
  );

  const cityBranchOptions: SearchSelectOption[] = useMemo(
    () => cityBranches.map((b) => ({ value: b.id, label: `${b.city_name} - ${b.name} (${b.code})` })),
    [cityBranches]
  );

  // (branchCurrency / isLocalCurrency / targetAccountCurrency are already declared earlier in this
  //  component near the top; the duplicate re-declarations that were here caused a build failure.)

  const actionButtons = (
    <div id="erp-page-actions-portal-content" className="flex items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={tableSearchQuery}
          onChange={(e) => setTableSearchQuery(e.target.value)}
          placeholder={t(lang, "roz.search_entries_placeholder", "Search entries...")}
          className="h-8 w-[160px] rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 shadow-sm"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold border-slate-250 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 shadow-sm"
        onClick={() => handlePrintRegister(true)}
      >
        <Printer className="h-3.5 w-3.5" />
        {t(lang, "common.print", "Print")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold border-slate-250 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 shadow-sm"
        onClick={() => handlePrintRegister(false)}
      >
        <Download className="h-3.5 w-3.5" />
        {t(lang, "urs.a_download_pdf", "Download PDF")}
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1.5 rounded-lg px-3.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
        onClick={() => {
          resetPaymentDraft();
          setEditEntryId(null);
          setShowPaymentWorkReport(true);
        }}
      >
        <Plus className="h-4 w-4" />
        {t(lang, "roz.new_entry", "New Entry")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold border-slate-250 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 shadow-sm"
        onClick={() => {
          fetchRecentEntries();
          fetchCashSummary();
        }}
        disabled={loadingEntries}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", loadingEntries ? "animate-spin" : "")} />
        {t(lang, "common.refresh", "Refresh")}
      </Button>
      <RoznamchaReportsDropdown lang={lang} />
    </div>
  );


  const viewScopeLabel =
    effectiveScopeMode === "super_admin" ? "Super Admin" : effectiveScopeMode === "country" ? "Country" : "City";
  const hasFixedCityScope = Boolean(!isSuperAdmin && session?.scopes?.cityBranchIds?.length);
  const showScopeSelectors = effectiveScopeMode !== "branch" || isSuperAdmin || !hasFixedCityScope;
  const showCountrySelector = effectiveScopeMode === "super_admin" || isSuperAdmin;

  const saUsdRate = useMemo(() => {
    if (!dailyUsdRates) return null;
    return paymentMode === "DEBIT"
      ? (dailyUsdRates.debitRate || dailyUsdRates.buyingRate)
      : (dailyUsdRates.creditRate || dailyUsdRates.sellingRate);
  }, [dailyUsdRates, paymentMode]);

  const saUsdAmount = useMemo(() => {
    if (!saUsdRate || saUsdRate <= 0) return null;
    return amount / saUsdRate;
  }, [amount, saUsdRate]);

  // Enforce currency rules and keep derived fields in sync with the reference behavior.
  useEffect(() => {
    const selected = normalizedCurrency;

    if (!selected) {
      setCurrencyError(false);
      setCalcAmount("");
      setCalcPrice("");
      setFinalPayment("");
      setExchangeRate("1");
      setExchangeRateSource("default");
      setExchangeRateEffectiveAt(null);
      return;
    }

    if (!allowedCurrencies.has(selected)) {
      setCurrencyError(true);
      setCalcAmount("");
      setCalcPrice("");
      setFinalPayment("");
      setExchangeRate("1");
      setExchangeRateSource("default");
      setExchangeRateEffectiveAt(null);
      return;
    }

    setCurrencyError(false);
     
  }, [allowedCurrencies, normalizedCurrency]);

  useEffect(() => {
    if (!normalizedCurrency || !allowedCurrencies.has(normalizedCurrency)) return;
    if (!countryId) return;

    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          countryId,
          currency: normalizedCurrency,
          branchCurrency
        });
        if (countryBranchId) params.set("countryBranchId", countryBranchId);
        const res = await apiGet<LatestRateResponse>(`/api/erp/currency/latest-rate?${params.toString()}`);
        if (!cancelled) {
          setExchangeRate(isLocalCurrency ? "1" : String(res.rate || 1));
          setExchangeRateSource(isLocalCurrency ? "local_currency" : (res.source || "default"));
          setExchangeRateEffectiveAt(isLocalCurrency ? null : (res.effectiveDate ?? null));
          setDailyUsdRates({
            buyingRate: res.buyRate,
            sellingRate: res.sellRate,
            creditRate: res.creditRate,
            debitRate: res.debitRate
          });
        }
      } catch {
        if (!cancelled) {
          setExchangeRate(isLocalCurrency ? "1" : exchangeRate || "1");
          setExchangeRateSource(isLocalCurrency ? "local_currency" : "manual_or_default");
          setExchangeRateEffectiveAt(null);
          setDailyUsdRates(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchCurrency, countryBranchId, countryId, isLocalCurrency, normalizedCurrency]);

  const branchFullName = [
    selectedCountry?.name ? `${selectedCountry.name} (${branchCurrency})` : null,
    selectedMainBranch?.name ? `${selectedMainBranch.name} (${selectedMainBranch.code})` : null,
    selectedCityBranch?.name ? `${selectedCityBranch.city_name} - ${selectedCityBranch.name} (${selectedCityBranch.code})` : null
  ]
    .filter(Boolean)
    .join(" | ");

  const scopeTitle = `${viewScopeLabel} Scope`;
  const scopeAccessText =
    effectiveScopeMode === "super_admin"
      ? "Global cash entry access across countries, branches, cities, reports, and audit."
      : effectiveScopeMode === "country"
        ? "Country-level cash entry access filtered to assigned country, branches, cities, approvals, and reports."
        : "City-level cash entry access filtered to assigned city branch operations and transactions.";

  const accountOptions = useMemo(() => {
    // Authorized country account codes across PK, AE, AF, IN
    const ALLOWED_COUNTRY_ACCOUNT_CODES = new Set([
      "PAK-CORP-GEN-001", "CT-INTER-PK",
      "UAE-CORP-GEN-001", "CT-INTER-AE",
      "AFG-CORP-GEN-001", "CT-INTER-AF",
      "IND-CORP-GEN-001", "0005-IND-HUB", "CT-INTER-IN"
    ]);

    // Filter user accounts: Include user-created accounts and all 4 authorized Country Accounts
    const userAccounts = ledgers.filter((row) => {
      const code = (row.accountCode || row.ledgerCode || "").toUpperCase();
      const rawCode = (row.rawAccountCode || "").toUpperCase();
      const name = (row.accountName || row.ledgerName || "").toLowerCase();

      // Explicitly allow authorized Country Accounts
      const isCountryAcc =
        ALLOWED_COUNTRY_ACCOUNT_CODES.has(code) ||
        ALLOWED_COUNTRY_ACCOUNT_CODES.has(rawCode) ||
        (row as any).isCountryAccount === true ||
        (row as any).branchType === "Country" ||
        code.startsWith("CT-INTER-") ||
        code.startsWith("PAK-CORP-") ||
        code.startsWith("UAE-CORP-") ||
        code.startsWith("AFG-CORP-") ||
        code.startsWith("IND-CORP-");

      if (isCountryAcc) return true;

      // Exclude automatic internal branch system ledgers
      if (
        code.startsWith("BR-BANK") ||
        code.startsWith("BR-CASH") ||
        code.startsWith("CT-MAIN") ||
        code.startsWith("CT-INVEST") ||
        name.includes("main branch cash") ||
        name.includes("main branch bank") ||
        name.includes("investment account") ||
        name.includes("inter-city branch clearing") ||
        name.includes("investment clearing")
      ) {
        return false;
      }

      // Must be an actual user-created account or ledger
      return Boolean(row.accountId || row.accountCode || row.ledgerId);
    });

    // Sort A to Z by account code and name
    const sorted = [...userAccounts].sort((a, b) => {
      const codeA = (a.accountCode || a.ledgerCode || "").toLowerCase();
      const codeB = (b.accountCode || b.ledgerCode || "").toLowerCase();
      if (codeA && codeB) return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
      const nameA = (a.accountName || a.ledgerName || "").toLowerCase();
      const nameB = (b.accountName || b.ledgerName || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return sorted.map((row) => {
      const code = row.accountCode || row.ledgerCode || "";
      const rawCode = row.rawAccountCode || "";
      const name = row.accountName || row.ledgerName || "";
      const manualRef = row.manualReferenceNumber ? ` [Ref: ${row.manualReferenceNumber}]` : "";
      const branchName = row.cityBranchName || row.countryBranchName || "";
      const country = row.countryName || "";
      const locPart = branchName ? ` (${branchName})` : country ? ` (${country})` : "";
      const curr = row.ledgerCurrency ? ` • ${row.ledgerCurrency}` : "";
      const kind = row.accountKind ? ` [${row.accountKind.toUpperCase()}]` : "";
      const label = `${code ? `${code} — ` : ""}${name}${manualRef}${locPart}${curr}${kind}`;

      // Country keywords matching for searches like "Pakistan", "Afghanistan", "India", "Dubai", "UAE", "PK", "AF", "IN", "AE"
      const upperCode = (code || "").toUpperCase();
      const lowerName = (name || "").toLowerCase();
      const lowerCtry = (country || "").toLowerCase();

      const isPak = upperCode.includes("PAK") || upperCode.includes("-PK") || lowerCtry.includes("pakistan") || lowerName.includes("pakistan");
      const isUae = upperCode.includes("UAE") || upperCode.includes("-AE") || lowerCtry.includes("emirates") || lowerCtry.includes("uae") || lowerName.includes("dubai") || lowerName.includes("emirates");
      const isAfg = upperCode.includes("AFG") || upperCode.includes("-AF") || lowerCtry.includes("afghanistan") || lowerName.includes("afghanistan") || lowerName.includes("kabul");
      const isInd = upperCode.includes("IND") || upperCode.includes("-IN") || lowerCtry.includes("india") || lowerName.includes("india") || lowerName.includes("delhi") || lowerName.includes("mumbai");

      const countrySynonyms = [
        isPak ? "Pakistan Pakistani Pak PK" : "",
        isUae ? "UAE United Arab Emirates Emirates Dubai Abu Dhabi AE" : "",
        isAfg ? "Afghanistan Afghan Kabul AF" : "",
        isInd ? "India Indian Bharat IN" : "",
        upperCode.startsWith("CT-INTER-") || (row as any).isCountryAccount ? "Country Account Inter Country Inter-Country" : ""
      ].filter(Boolean).join(" ");

      const keywords = `${code} ${rawCode} ${row.manualReferenceNumber || ""} ${row.customerNumber || ""} ${name} ${row.companyName || ""} ${branchName} ${country} ${countrySynonyms} ${row.ledgerCurrency || ""} ${row.accountKind || ""}`;

      return {
        value: row.ledgerId,
        label,
        keywords,
        primaryText: name,
        secondaryText: `${locPart ? `${locPart} • ` : ""}${manualRef ? `${manualRef} • ` : ""}${curr || ""}`.trim(),
        code: code,
        country: country || (isPak ? "Pakistan" : isUae ? "United Arab Emirates" : isAfg ? "Afghanistan" : isInd ? "India" : undefined),
        branch: branchName
      };
    });
  }, [ledgers]);

  return (
    <div className="mx-auto w-full bg-[#f8fbff] dark:bg-slate-950/40 text-slate-950 dark:text-slate-50 min-h-screen">
      {portalNode ? createPortal(actionButtons, portalNode) : null}

      {/* Super Admin Scope Modal */}
      {isSuperAdmin && showScopeModal && (
        <SimpleModal
          onClose={() => setShowScopeModal(false)}
          title={t(lang, "roz.select_working_scope_title", "Super Admin: Select Working Scope")}
          className="max-w-md"
        >
          <div className="space-y-4 p-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t(lang, "roz.select_scope_subtitle", "Please select the Country and Branch you want to work in for Cash Entry.")}
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-black">{t(lang, "common.country", "Country")}</Label>
                <select
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none"
                >
                  <option value="">{t(lang, "roz.select_country_placeholder", "Select Country...")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.currency_code})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-black">{t(lang, "roz.branch_category", "Branch Category")}</Label>
                <select
                  value={branchCategory}
                  onChange={(e) => {
                    setBranchCategory(e.target.value as "business" | "agent");
                    setCityBranchId("");
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none"
                >
                  <option value="business">🏢 {t(lang, "roz.business_branch", "Business Branch")}</option>
                  <option value="agent">🚢 {t(lang, "roz.clearing_agent_branch", "Clearing Agent")}</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-black">{t(lang, "common.branch", "Branch")}</Label>
                <select
                  value={countryBranchId}
                  onChange={(e) => setCountryBranchId(e.target.value)}
                  disabled={!countryId}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none"
                >
                  <option value="">{t(lang, "roz.select_branch_placeholder", "Select Branch...")}</option>
                  {(cityBranches.length > 0 ? cityBranches : mainBranches).map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({(b as any).code || ""})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* ============================================================
          Branch-Wise Cash Summary (mandatory, always visible at top).
          Totals for the selected Country + Branch + Date, sourced from the
          get_branch_cash_summary DB function; auto-refreshes after each save.
      ============================================================ */}


      {/* Back to Register Button */}
      <div className="mx-4 mt-2.5 mb-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard/roznamcha" as any)}
          className="h-7 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 border-slate-200 dark:border-slate-800 shadow-2xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t(lang, "cer.back_to_register", "Back to Register")}
        </Button>
      </div>

      {/* Scope & Session Cards - Branch/User Info, Live Users, Serial Numbers, Daily Cash Position */}
      {showFormSection && (
      <div className="mx-4 mb-4 grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">

        {/* ════════ COLUMN 1: BRANCH / USER INFO + LIVE USERS / CURRENT WORK (xl:col-span-4) ════════ */}
        <div className="xl:col-span-4 flex flex-col gap-4">

          {/* Card 1A: Branch & User Information */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
              <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                {t(lang, "roz.branch_user_info", "BRANCH / USER INFORMATION")}
              </h4>
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Left Column: Branch Details */}
              <div className="grid grid-cols-[95px_1fr] gap-x-2 gap-y-1.5 font-semibold">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">{t(lang, "common.country", "COUNTRY")}</span>
                <div className="relative flex items-center">
                  <select
                    value={countryId}
                    disabled={loadingCountries || (effectiveScopeMode !== "super_admin" && !isSuperAdmin)}
                    onChange={(e) => setCountryId(e.target.value)}
                    className="bg-transparent border-none p-0 outline-none font-bold text-blue-600 dark:text-blue-400 cursor-pointer appearance-none text-xs hover:underline truncate"
                  >
                    <option value="" className="text-slate-900">
                      {isSuperAdmin
                        ? "All Countries (Super Admin View)"
                        : (!session?.scopes.countryIds || session.scopes.countryIds.length === 0)
                        ? "No Country Assigned"
                        : "Select Country"}
                    </option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id} className="text-slate-900">{c.name}</option>
                    ))}
                  </select>
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">{t(lang, "roz.branch_category", "BRANCH CATEGORY")}</span>
                <div className="relative flex items-center">
                  <select
                    value={branchCategory}
                    onChange={(e) => {
                      setBranchCategory(e.target.value as "business" | "agent");
                      setCityBranchId("");
                    }}
                    className="bg-transparent border-none p-0 outline-none font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer appearance-none text-xs hover:underline"
                  >
                    <option value="business" className="text-slate-900">🏢 Business Branch</option>
                    <option value="agent" className="text-slate-900">🚢 Clearing Agent Branch</option>
                  </select>
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">{t(lang, "roz.branch_name", "BRANCH NAME")}</span>
                <div className="relative flex items-center">
                  <select
                    value={countryBranchId}
                    disabled={!countryId}
                    onChange={(e) => setCountryBranchId(e.target.value)}
                    className="bg-transparent border-none p-0 outline-none font-bold text-slate-850 dark:text-slate-200 cursor-pointer appearance-none text-xs hover:underline truncate"
                  >
                    <option value="" className="text-slate-900">Select Branch</option>
                    {mainBranches.map((b) => (
                      <option key={b.id} value={b.id} className="text-slate-900">{b.name}</option>
                    ))}
                  </select>
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">{t(lang, "roz.branch_code", "BRANCH CODE")}</span>
                <span className="font-extrabold text-slate-850 dark:text-slate-150">
                  {selectedMainBranch?.code || "—"}
                </span>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">{t(lang, "roz.city_branch", "CITY BRANCH")}</span>
                <div className="relative flex items-center">
                  <select
                    value={cityBranchId}
                    disabled={!countryBranchId}
                    onChange={(e) => setCityBranchId(e.target.value)}
                    className="bg-transparent border-none p-0 outline-none font-bold text-slate-850 dark:text-slate-200 cursor-pointer appearance-none text-xs hover:underline truncate"
                  >
                    <option value="" className="text-slate-900">Select City Branch</option>
                    {cityBranches.map((b) => (
                      <option key={b.id} value={b.id} className="text-slate-900">{b.name}</option>
                    ))}
                  </select>
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">{t(lang, "common.date", "DATE")}</span>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="bg-transparent border-none p-0 outline-none font-bold text-slate-850 dark:text-slate-150 cursor-pointer text-xs"
                />
              </div>

              {/* Right Column: User Context & Approval */}
              <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1.5 font-semibold sm:border-l sm:border-slate-100 sm:pl-3 dark:sm:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">CREATED BY</span>
                <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate" title={activeCreator || session?.user?.fullName || "Super Admin (Global Group)"}>
                  {activeCreator || session?.user?.fullName || "Super Admin (Global Group)"}
                </span>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">APPROVED BY</span>
                <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate" title={activeApprover || "Pending"}>
                  {activeApprover || "Pending"}
                </span>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">STATUS</span>
                <div>
                  <span className="inline-flex items-center rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
                    {activeStatus?.toUpperCase() || "DRAFT"}
                  </span>
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">USER NAME</span>
                <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate">
                  {session?.user?.fullName || "Super Admin (Global Group)"}
                </span>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">USER ID</span>
                <span className="font-extrabold text-slate-850 dark:text-slate-150 font-mono">
                  {session?.user?.id?.slice(0, 8).toUpperCase() || "BE340D15"}
                </span>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">TIME</span>
                <span className="font-extrabold text-slate-850 dark:text-slate-150">
                  {loginTimeText || "12:46:46 AM"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 1B: Live Users / Current Work (Dark theme matching screenshot) */}
          <div className="flex flex-col rounded-xl border border-slate-800 bg-[#0b1626] text-white shadow-md overflow-hidden">
            <div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80 bg-[#07111e]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" />
                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                  LIVE USERS / CURRENT WORK
                </h4>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {filteredLiveUsers.length} Online
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={liveUsersRoleFilter}
                  onChange={(e) => setLiveUsersRoleFilter(e.target.value)}
                  className="bg-[#112238] border border-slate-700/80 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-200 outline-none cursor-pointer"
                >
                  <option value="all">Super Admin</option>
                  <option value="country">Country Admin</option>
                  <option value="branch">Branch Admin</option>
                  <option value="shipping">Shipping</option>
                </select>
                <select
                  value={liveUsersOpFilter}
                  onChange={(e) => setLiveUsersOpFilter(e.target.value)}
                  className="bg-[#112238] border border-slate-700/80 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-200 outline-none cursor-pointer"
                >
                  <option value="all">All Operations</option>
                  <option value="Business">Business</option>
                  <option value="Shipping Line">Shipping Line</option>
                  <option value="Payment">Payment</option>
                  <option value="Ledger">Ledger</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0d1c2e] text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-2 px-2.5 whitespace-nowrap">USER ID</th>
                    <th className="py-2 px-2 whitespace-nowrap">BRANCH CODE</th>
                    <th className="py-2 px-2 whitespace-nowrap">DATE</th>
                    <th className="py-2 px-2 whitespace-nowrap">TIME</th>
                    <th className="py-2 px-2 whitespace-nowrap">USER TYPE</th>
                    <th className="py-2 px-2 whitespace-nowrap">USER NAME</th>
                    <th className="py-2 px-2.5 whitespace-nowrap">CURRENT WORK</th>
                    <th className="py-2 px-2 whitespace-nowrap text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredLiveUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-2.5 font-mono font-bold text-cyan-300 whitespace-nowrap">
                        {user.userId}
                      </td>
                      <td className="py-2 px-2 font-mono font-bold text-white whitespace-nowrap">
                        {user.branchCode}
                      </td>
                      <td className="py-2 px-2 text-slate-300 whitespace-nowrap">
                        {user.date}
                      </td>
                      <td className="py-2 px-2 text-slate-300 font-mono whitespace-nowrap">
                        {user.time}
                      </td>
                      <td className="py-2 px-2 text-slate-300 whitespace-nowrap">
                        {user.userType}
                      </td>
                      <td className="py-2 px-2 font-bold text-white whitespace-nowrap">
                        {user.userName}
                      </td>
                      <td className="py-2 px-2.5 text-slate-300 whitespace-nowrap">
                        {user.currentWork}
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Online
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ════════ COLUMN 2: SERIAL NUMBERS & COUNTRY RATES (xl:col-span-4) ════════ */}
        <div className="xl:col-span-4 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-900/10">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600 inline-block" />
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                SERIAL NUMBERS &amp; COUNTRY RATES
              </h4>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-500">Role:</span>
              <select
                value={serialRoleFilter}
                onChange={(e) => setSerialRoleFilter(e.target.value)}
                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="Super Admin">Super Admin</option>
                <option value="Country Admin">Country Admin</option>
                <option value="Branch Admin">Branch Admin</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
            <div>
              {/* Current Serial & View Serials */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-150 dark:border-slate-750 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    CURRENT SERIAL
                  </span>
                  <span className="font-mono text-xs font-black text-blue-700 dark:text-blue-400">
                    SA-000003
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSerialsDropdown((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 transition"
                >
                  View Serials <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {/* View Serials Expanded Box */}
              {showSerialsDropdown && (
                <div className="mb-3 p-2.5 rounded-lg border border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20 text-xs grid grid-cols-2 gap-2 font-mono">
                  <div><span className="text-[10px] text-slate-500 block">Super Admin:</span> <strong className="text-blue-700 dark:text-blue-300">SA-000003</strong></div>
                  <div><span className="text-[10px] text-slate-500 block">Country:</span> <strong className="text-blue-700 dark:text-blue-300">{savedSerials?.country || liveSerials.country}</strong></div>
                  <div><span className="text-[10px] text-slate-500 block">Main Branch:</span> <strong className="text-blue-700 dark:text-blue-300">{(savedSerials as any)?.mainBranch || liveSerials.mainBranch}</strong></div>
                  <div><span className="text-[10px] text-slate-500 block">City Branch:</span> <strong className="text-blue-700 dark:text-blue-300">{(savedSerials as any)?.cityBranch || liveSerials.cityBranch}</strong></div>
                </div>
              )}

              {/* Country Rates Table */}
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-3">Country</th>
                      <th className="py-2 px-2.5">Date</th>
                      <th className="py-2 px-2.5">DR Rate</th>
                      <th className="py-2 px-2.5">CR Rate</th>
                      <th className="py-2 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {countryRatesList.map((r) => (
                      <tr key={r.country} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {r.country}
                        </td>
                        <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                          {r.date}
                        </td>
                        <td className="py-2 px-2.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                          {r.drRate}
                        </td>
                        <td className="py-2 px-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {r.crRate}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleStartEditRate(r)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Edit Rate"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Edit Rate Inline Modal/Form */}
              {editingRateCountry && (
                <div className="mt-2 p-2.5 rounded-lg border border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20 text-xs flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Edit {editingRateCountry} Rate:
                  </span>
                  <input
                    type="text"
                    value={editDrRateVal}
                    onChange={(e) => setEditDrRateVal(e.target.value)}
                    placeholder="DR Rate"
                    className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={editCrRateVal}
                    onChange={(e) => setEditCrRateVal(e.target.value)}
                    placeholder="CR Rate"
                    className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSaveRate}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRateCountry(null)}
                    className="px-2 py-1 rounded border border-slate-300 text-slate-600 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Dark Voice Banner (matching reference design) */}
            <div className="mt-3 rounded-lg bg-[#0b1626] border border-blue-900/50 p-2.5 flex items-center justify-between text-white shadow-inner">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200">Speak to fill this form</span>
                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  MIC READY
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetPaymentDraft();
                  setEditEntryId(null);
                  setShowPaymentWorkReport(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition shadow-sm cursor-pointer"
              >
                <Mic className="h-3.5 w-3.5" />
                Voice
              </button>
            </div>
          </div>
        </div>

        {/* ════════ COLUMN 3: DAILY CASH POSITION (xl:col-span-4) ════════ */}
        <div className="xl:col-span-4 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" />
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                DAILY CASH POSITION
              </h4>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={cashPositionRoleFilter}
                onChange={(e) => setCashPositionRoleFilter(e.target.value)}
                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="Super Admin">Super Admin</option>
                <option value="Country Admin">Country Admin</option>
                <option value="Branch Admin">Branch Admin</option>
              </select>
              <select
                value={cashPositionCountryFilter}
                onChange={(e) => setCashPositionCountryFilter(e.target.value)}
                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">All Countries</option>
                <option value="PK">PK</option>
                <option value="AF">AF</option>
                <option value="IN">IN</option>
                <option value="AE">AE</option>
                <option value="IR">IR</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 space-y-3">
            {/* 4 Summary Stats Blocks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">TOTAL CREDIT (USD)</span>
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  $60,505.74
                </span>
              </div>
              <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">TOTAL DEBIT (USD)</span>
                <span className="text-xs font-black text-rose-700 dark:text-rose-400 font-mono">
                  $41,095.82
                </span>
              </div>
              <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">SCOPE</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {cashPositionCountryFilter === "all" ? "All Countries" : cashPositionCountryFilter}
                </span>
              </div>
              <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">ENTRIES</span>
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
                  27
                </span>
              </div>
            </div>

            {/* Multi-Country Breakdown Table */}
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-2 px-3">Country</th>
                    <th className="py-2 px-2.5">Credit Local</th>
                    <th className="py-2 px-2.5">Debit Local</th>
                    <th className="py-2 px-2.5 text-right">Credit USD</th>
                    <th className="py-2 px-2.5 text-right">Debit USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredCashPositions.map((pos) => (
                    <tr key={pos.country} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {pos.country}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                        {pos.creditLocal}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-rose-700 dark:text-rose-400">
                        {pos.debitLocal}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400 text-right">
                        {pos.creditUsd}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[11px] font-bold text-rose-700 dark:text-rose-400 text-right">
                        {pos.debitUsd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
      )}

      {/* Selected Account bar — shown when counter ledger is picked */}
      {selectedCounterLedger && (
        <div className="mx-4 mb-3 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-900/10">
            <div className="bg-purple-600 p-1 rounded-full text-white">
              <Users className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400">
              {t(lang, "roz.selected_account", "Selected Account")}
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">{t(lang, "rozrep.account_no", "Account No")}</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 font-mono text-xs">
                {selectedCounterLedger.accountCode || selectedCounterLedger.ledgerCode || "-"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">{t(lang, "roz.account_name", "Account Name")}</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 text-xs truncate max-w-[180px]" title={selectedCounterLedger.accountName || selectedCounterLedger.ledgerName || "-"}>
                {selectedCounterLedger.accountName || selectedCounterLedger.ledgerName || "-"}
              </span>
            </div>
            {selectedCounterLedger.accountKind && (
              <div className="flex flex-col">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">{t(lang, "common.category", "Category")}</span>
                <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                  {localizeTerm(selectedCounterLedger.accountKind, lang)}
                </span>
              </div>
            )}
            <div className="h-8 w-px bg-slate-150 dark:bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">{t(lang, "roz.owner_customer", "Owner / Customer")}</span>
              <span className="inline-flex items-center gap-1.5 font-extrabold text-slate-850 dark:text-slate-150 text-xs">
                <User className="h-3 w-3 text-slate-400" />
                <span className="truncate max-w-[160px]" title={selectedCounterLedger.accountName || selectedCounterLedger.ledgerName || "-"}>
                  {selectedCounterLedger.accountName || selectedCounterLedger.ledgerName || "-"}
                </span>
                {selectedCounterLedger.customerNumber && (
                  <span className="font-mono text-[10px] text-slate-400">({selectedCounterLedger.customerNumber})</span>
                )}
              </span>
            </div>
            {selectedCounterLedger.companyName && (
              <div className="flex flex-col">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">{t(lang, "hr.pp_company", "Company")}</span>
                <span className="inline-flex items-center gap-1.5 font-extrabold text-slate-850 dark:text-slate-150 text-xs">
                  <Building2 className="h-3 w-3 text-slate-400" />
                  <span className="truncate max-w-[160px]" title={selectedCounterLedger.companyName}>{selectedCounterLedger.companyName}</span>
                </span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">{t(lang, "hr.f_currency", "Currency")}</span>
              <span className="inline-flex items-center gap-1.5 font-extrabold text-slate-850 dark:text-slate-150 text-xs">
                <CircleDollarSign className="h-3 w-3 text-slate-400" />
                {selectedCounterLedger.ledgerCurrency || "-"}
                {selectedCounterLedger.ledgerCurrency && CURRENCY_FULL_NAMES[selectedCounterLedger.ledgerCurrency] && (
                  <span className="font-medium text-slate-400">— {CURRENCY_FULL_NAMES[selectedCounterLedger.ledgerCurrency]}</span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 px-4 pb-4">

        {intakeDraft.draft && !intakeBannerDismissed ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-xs dark:border-violet-800 dark:bg-violet-950/20">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-bold text-violet-900 dark:text-violet-300">
                  {t(lang, "roz.cef_intake_banner_title", "Prefilled from reviewed document")} {intakeDraft.draftNo ? `· ${intakeDraft.draftNo}` : ""}
                </p>
                <p className="text-violet-700 dark:text-violet-400">
                  {t(lang, "roz.cef_intake_banner_body", "Amount, currency, date and reference were carried over from the AI document review. Verify every field and choose the counter ledger before saving — nothing posts until you confirm.")}
                </p>
                {intakeSuggestedParty ? (
                  <p className="font-semibold text-violet-800 dark:text-violet-300">
                    {t(lang, "roz.cef_intake_suggested_party", "Suggested party")}: {intakeSuggestedParty}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setIntakeBannerDismissed(true)}
                className="shrink-0 rounded p-1 text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900"
                aria-label={t(lang, "roz.cef_dismiss", "Dismiss")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
        {message ? (
          <div className={cn(
            "rounded-lg border px-4 py-2.5 text-xs font-semibold flex items-center gap-2",
            message.toLowerCase().includes("fail") || message.toLowerCase().includes("error")
              ? "border-rose-200 bg-rose-50 text-rose-900 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-400"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400"
          )}>
            <CheckCircle className={cn(
              "h-4 w-4",
              message.toLowerCase().includes("fail") || message.toLowerCase().includes("error") ? "text-rose-600 hidden" : "text-emerald-600"
            )} />
            <span>{message}</span>
          </div>
        ) : null}





        {/* ── NEW CASH ENTRY MODAL (MATCHING REFERENCE DESIGN IMAGE 2) ── */}
        {showPaymentWorkReport && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 overflow-y-auto backdrop-blur-xs font-sans">
            <div className="relative w-full max-w-[1220px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl my-auto flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden">
              
              {/* ── MODAL HEADER ── */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 bg-white dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs shrink-0">
                    <Banknote className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                      New Cash Entry
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Record cash transaction in Roznamcha
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentWorkReport(false);
                    setEditEntryId(null);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* ── MODAL BODY (TWO COLUMNS: LEFT 7 COLS, RIGHT 5 COLS) ── */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  
                  {/* ════════ LEFT COLUMN: MAIN ENTRY FLOW (STEPS 1 TO 6) ════════ */}
                  <div className="lg:col-span-7 space-y-4">
                    
                    {/* Step 1: Entry Scope & Branch */}
                    <div className="space-y-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black shrink-0">
                            1
                          </span>
                          <div>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              Entry Scope &amp; Branch
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Select the operating branch for this entry
                            </p>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase">
                          <Building2 className="h-3 w-3" />
                          <span>
                            {selectedCountry ? `${selectedCountry.name.toUpperCase()} - ${selectedCityBranch?.name?.toUpperCase() || selectedMainBranch?.name?.toUpperCase() || "DEIRA CITY BRANCH"}` : "UNITED ARAB EMIRATES - DEIRA CITY BRANCH"}
                          </span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Country</Label>
                          <select
                            value={countryId}
                            disabled={loadingCountries || (!isSuperAdmin && effectiveScopeMode !== "super_admin")}
                            onChange={(e) => {
                              setCountryId(e.target.value);
                              setCountryBranchId("");
                              setCityBranchId("");
                              setCounterLedgerId("");
                              setSelectedLookupLedger(null);
                            }}
                            className="h-8.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
                          >
                            <option value="">{t(lang, "roz.all_countries", "All Countries")}</option>
                            {countries.map((c) => (
                              <option key={c.id} value={c.id}>
                                {getCountryFlag(c.name)} {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Main Branch</Label>
                          <select
                            value={countryBranchId}
                            disabled={!countryId}
                            onChange={(e) => {
                              setCountryBranchId(e.target.value);
                              setCityBranchId("");
                            }}
                            className="h-8.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
                          >
                            <option value="">{t(lang, "cef.select_branch_ellipsis", "Select Branch...")}</option>
                            {mainBranches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.branch_category", "Branch Category")}</Label>
                          <select
                            value={branchCategory}
                            onChange={(e) => {
                              setBranchCategory(e.target.value as "business" | "agent");
                              setCityBranchId("");
                            }}
                            className="h-8.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
                          >
                            <option value="business">{t(lang, "cef.business_branch", "Business Branch")}</option>
                            <option value="agent">{t(lang, "cef.clearing_agent", "Clearing Agent")}</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.city_branch_label", "City / Branch")}</Label>
                          <select
                            value={cityBranchId}
                            disabled={!countryBranchId && cityBranches.length === 0}
                            onChange={(e) => setCityBranchId(e.target.value)}
                            className="h-8.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none truncate"
                          >
                            <option value="">{t(lang, "cef.select_city_ellipsis", "Select City...")}</option>
                            {cityBranches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Search & Select Account */}
                    <div className="space-y-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black shrink-0">
                          2
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            Search &amp; Select Account
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Choose the account to post this transaction
                          </p>
                        </div>
                      </div>

                      <SearchSelect
                        label=""
                        value={counterLedgerId}
                        placeholder={t(lang, "cef.search_account_ph", "Search account code or name...")}
                        options={accountOptions}
                        disabled={loadingLedgers}
                        onValueChange={handleCounterLedgerChange}
                        onSearchValueChange={setAccountNoInput}
                      />

                      {/* Account Selected Confirmation Banner */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs shadow-2xs">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="font-extrabold text-emerald-900 dark:text-emerald-200">Account Selected</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            {selectedCounterLedger?.accountCode || selectedCounterLedger?.ledgerCode || "UAE-DET-AC-0003"}
                          </span>
                          <span className="font-black text-slate-900 dark:text-white">
                            {selectedCounterLedger?.accountName || selectedCounterLedger?.ledgerName || "Rex Trading LLC"}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                          Verified ✓
                        </span>
                      </div>
                    </div>

                    {/* Step 3: Roznamcha Details */}
                    <div className="space-y-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black shrink-0">
                            3
                          </span>
                          <div>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              Roznamcha Details
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Transaction type, category and reference information
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] font-black text-slate-500 uppercase">
                            Daily Payment Date <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              type="date"
                              value={entryDate}
                              onChange={(e) => setEntryDate(e.target.value)}
                              className="h-8 text-xs font-bold w-36 bg-white dark:bg-slate-950"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">
                            Roznamcha Type <span className="text-red-500">*</span>
                          </Label>
                          <select
                            value={roznamchaType}
                            onChange={(e) => setRoznamchaType(e.target.value)}
                            className="h-8.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
                          >
                            <option value="Cash Book No.">Cash Book No.</option>
                            <option value="Roznamcha Book No.">Roznamcha Book No.</option>
                            <option value="Receipt No.">Receipt No.</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">
                            Roznamcha Number <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={roznamchaNumber}
                            onChange={(e) => setRoznamchaNumber(e.target.value)}
                            placeholder="213"
                            className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">
                            Roznamcha Category <span className="text-red-500">*</span>
                          </Label>
                          <select
                            value={paymentType}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setPaymentType(val);
                              setRoznamchaBookType(val ? "branch_payment_voucher" : "");
                            }}
                            className="h-8.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
                          >
                            <option value="cash">{t(lang, "cef.opt_cash_roznamcha", "Cash Roznamcha")}</option>
                            <option value="bank">{t(lang, "cef.opt_bank_roznamcha", "Bank Roznamcha")}</option>
                            <option value="business">{t(lang, "cef.opt_business_roznamcha", "Business Roznamcha")}</option>
                            <option value="invoice">{t(lang, "cef.opt_invoice_journal", "Invoice Journal")}</option>
                            <option value="transfer">{t(lang, "cef.opt_transfer", "Transfer")}</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">
                            Currency Type <span className="text-red-500">*</span>
                          </Label>
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="h-8.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
                          >
                            <option value="USD">USD</option>
                            <option value="AED">AED</option>
                            <option value="PKR">PKR</option>
                            <option value="INR">INR</option>
                            <option value="SAR">SAR</option>
                            <option value="AFN">AFN</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Step 4: Category Details (Dynamic based on Roznamcha Category) */}
                    <div className="space-y-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black shrink-0">
                          4
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            {paymentType === "bank"
                              ? "Bank Details"
                              : paymentType === "business" || paymentType === "invoice"
                              ? "Business / Invoice Details"
                              : paymentType === "transfer"
                              ? "Transfer Details"
                              : "Cash Details"}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {paymentType === "bank"
                              ? `Bank account, method and reference for ${activeCountryIso || "local"} banking`
                              : paymentType === "business" || paymentType === "invoice"
                              ? "Invoice number, vendor and receipt information"
                              : paymentType === "transfer"
                              ? "Transfer source, destination and reference"
                              : "Receiver / Sender identification and contact information"}
                          </p>
                        </div>
                      </div>

                      {paymentType === "bank" ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">
                                Bank ({activeCountryIso || "Bank"}) <span className="text-red-500">*</span>
                              </Label>
                              <BankPicker
                                label=""
                                value={typeDetails.bankId || ""}
                                countryId={countryId || undefined}
                                onValueChange={async (bankId) => {
                                  setTypeDetails((p) => ({ ...p, bankId }));
                                  if (!bankId) return;
                                  try {
                                    const bank = await getBankById(bankId);
                                    setTypeDetails((p) => ({
                                      ...p,
                                      bankName: bank?.bank_name || p.bankName,
                                      bankAccount: bank?.account_number || bank?.iban_number || p.bankAccount
                                    }));
                                  } catch {
                                    // ignore — bankId is still saved, account/name populate on next successful lookup
                                  }
                                }}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.bank_account_iban", "Bank Account / IBAN")}</Label>
                              <Input
                                value={typeDetails.bankAccount || ""}
                                readOnly
                                placeholder={t(lang, "cef.select_bank_autofill_ph", "Select a bank to auto-fill")}
                                title={t(lang, "cef.bank_autofill_title", "Populated automatically from the Bank Master — edit the bank record to change it")}
                                className="h-8.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.transfer_method", "Transfer Method")}</Label>
                              <select
                                value={typeDetails.method || "Online Transfer"}
                                onChange={(e) => setTypeDetails((p) => ({ ...p, method: e.target.value }))}
                                className="h-8.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
                              >
                                <option value="Online Transfer">{t(lang, "cef.opt_online_transfer", "Online Transfer")}</option>
                                <option value="Cheque">{t(lang, "cef.opt_cheque", "Cheque")}</option>
                                <option value="Wire Transfer / TT">{t(lang, "cef.opt_wire_transfer", "Wire Transfer / TT")}</option>
                                <option value="Cash Deposit">{t(lang, "cef.opt_cash_deposit_slip", "Cash Deposit Slip")}</option>
                                <option value="RTGS / NEFT">{t(lang, "cef.opt_rtgs_neft", "RTGS / NEFT")}</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.cheque_ref_number", "Cheque / Ref Number")}</Label>
                              <Input
                                value={typeDetails.transferReferenceNumber || typeDetails.refNo || ""}
                                onChange={(e) => setTypeDetails((p) => ({ ...p, transferReferenceNumber: e.target.value, refNo: e.target.value }))}
                                placeholder={t(lang, "cef.cheque_ref_ph", "CHK-883492 or TXN-99482")}
                                className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.bank_receipt_upload", "Bank Receipt / Slip Upload")}</Label>
                              <label className="flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold cursor-pointer transition">
                                <Paperclip className="h-3.5 w-3.5" />
                                <span>{attachmentFile ? attachmentFile.name.slice(0, 16) : "Upload Deposit / Cheque Slip"}</span>
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    setAttachmentFile(file);
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      ) : paymentType === "business" || paymentType === "invoice" ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Invoice / Bill Number</Label>
                            <Input
                              value={typeDetails.invoiceNumber || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, invoiceNumber: e.target.value }))}
                              placeholder="INV-2026-001"
                              className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.business_vendor_name", "Business / Vendor Name")}</Label>
                            <Input
                              value={typeDetails.purchaseInfo || typeDetails.businessName || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, purchaseInfo: e.target.value, businessName: e.target.value }))}
                              placeholder={t(lang, "cef.supplier_ph", "Supplier LLC")}
                              className="h-8.5 text-xs font-bold bg-white dark:bg-slate-950"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.contact_person", "Contact Person")}</Label>
                            <Input
                              value={typeDetails.receiverSenderName || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, receiverSenderName: e.target.value }))}
                              placeholder={t(lang, "cef.representative_name_ph", "Representative name")}
                              className="h-8.5 text-xs font-bold bg-white dark:bg-slate-950"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.invoice_copy_upload", "Invoice Copy Upload")}</Label>
                            <label className="flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold cursor-pointer transition">
                              <Paperclip className="h-3.5 w-3.5" />
                              <span>{attachmentFile ? attachmentFile.name.slice(0, 12) : t(lang, "cef.attach_file", "Attach File")}</span>
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  setAttachmentFile(file);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ) : paymentType === "transfer" ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.from_account_branch", "From Account / Branch")}</Label>
                            <Input
                              value={typeDetails.from || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, from: e.target.value }))}
                              placeholder={t(lang, "cef.source_ph", "Source")}
                              className="h-8.5 text-xs font-bold bg-white dark:bg-slate-950"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.to_account_branch", "To Account / Branch")}</Label>
                            <Input
                              value={typeDetails.to || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, to: e.target.value }))}
                              placeholder={t(lang, "cef.destination_ph", "Destination")}
                              className="h-8.5 text-xs font-bold bg-white dark:bg-slate-950"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.reference_number", "Reference Number")}</Label>
                            <Input
                              value={typeDetails.ref || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, ref: e.target.value }))}
                              placeholder="TRF-00123"
                              className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Transfer Advice Upload</Label>
                            <label className="flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold cursor-pointer transition">
                              <Paperclip className="h-3.5 w-3.5" />
                              <span>{attachmentFile ? attachmentFile.name.slice(0, 12) : "Attach File"}</span>
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  setAttachmentFile(file);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.receiver_sender_name", "Receiver / Sender Name")}</Label>
                            <Input
                              value={typeDetails.receiverSenderName || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, receiverSenderName: e.target.value }))}
                              placeholder={t(lang, "cef.full_name_ph", "Full name")}
                              className="h-8.5 text-xs font-bold bg-white dark:bg-slate-950"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Mobile Number</Label>
                            <Input
                              value={typeDetails.mobileNumber || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, mobileNumber: e.target.value }))}
                              placeholder="05643616644"
                              className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                              dir="ltr"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">WhatsApp Number</Label>
                            <Input
                              value={typeDetails.whatsappNumber || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, whatsappNumber: e.target.value }))}
                              placeholder="1321"
                              className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                              dir="ltr"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">ID Card Copy Upload</Label>
                            <label className="flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold cursor-pointer transition">
                              <Paperclip className="h-3.5 w-3.5" />
                              <span>{attachmentFile ? attachmentFile.name.slice(0, 12) : "Attach File"}</span>
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  setAttachmentFile(file);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 5: Transaction Conversion (Local Calculation) */}
                    <div className="space-y-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black shrink-0">
                          5
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            Transaction Conversion (Local Calculation)
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Enter amount and conversion rate (1 {currency || "USD"} = {exchangeRate || "3.6730"})
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className={cn("space-y-1", isLocalCurrency ? "sm:col-span-6" : "sm:col-span-3")}>
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">
                            {isLocalCurrency ? "Amount" : "Quantity (Foreign Amount)"} <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={calcAmount}
                            onChange={(e) => setCalcAmount(e.target.value)}
                            placeholder="45,000.00"
                            className="h-9 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                          />
                        </div>

                        {/* Rate / operation toggle only apply to a real currency conversion —
                            a same-currency entry has no rate, so hide them and free the space
                            for the Amount and Converted Amount fields. */}
                        {!isLocalCurrency && (
                          <>
                            <div className="sm:col-span-3 space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">
                                Transaction Rate ({branchCurrency || "AED"}) <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                value={exchangeRate}
                                onChange={(e) => setExchangeRate(e.target.value)}
                                placeholder="3.6730"
                                className="h-9 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                              />
                            </div>

                            <div className="sm:col-span-1 flex justify-center pb-0.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setCalcOp(calcOp === "mul" ? "div" : "mul")}
                                className="h-9 w-9 rounded-xl border-slate-200 dark:border-slate-700"
                                title={t(lang, "cef.toggle_operation", "Toggle Operation")}
                              >
                                <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                              </Button>
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">Operation</Label>
                              <select
                                value={calcOp}
                                onChange={(e) => setCalcOp(e.target.value as any)}
                                className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs font-bold outline-none"
                              >
                                <option value="mul">Multiply (x)</option>
                                <option value="div">Divide (/)</option>
                              </select>
                            </div>
                          </>
                        )}

                        <div className={cn(isLocalCurrency ? "sm:col-span-6" : "sm:col-span-3")}>
                          <div className="p-2 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-right">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                              {isLocalCurrency ? "Final Amount" : "Converted Amount"}
                            </span>
                            <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                              {calcFinal !== null ? fmtAmount(calcFinal) : (finalPayment ? fmtAmount(Number(finalPayment)) : "165,375.00")} {branchCurrency || "AED"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 6: Debit / Credit Entry */}
                    <div className="space-y-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black shrink-0">
                          6
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            Debit / Credit Entry
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Select transaction nature and confirm amount
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-7 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMode("DEBIT");
                              setRoznamchaBookType("branch_payment_voucher");
                            }}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer",
                              paymentMode === "DEBIT" || !paymentMode
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                            <span>Debit (Money Paid)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMode("CREDIT");
                              setRoznamchaBookType("branch_payment_voucher");
                            }}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-xs font-bold transition cursor-pointer",
                              paymentMode === "CREDIT"
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <span className="h-2 w-2 rounded-full border border-current" />
                            <span>Credit (Money Received)</span>
                          </button>
                        </div>

                        <div className="sm:col-span-5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Final Amount</span>
                          <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            {branchCurrency || "AED"} {calcFinal !== null ? fmtAmount(calcFinal) : (finalPayment ? fmtAmount(Number(finalPayment)) : "165,375.00")}
                          </span>
                        </div>
                      </div>

                      {/* Remarks / Notes Textarea */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Remarks / Notes</Label>
                        <textarea
                          rows={2}
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Cash payment to Rex Trading LLC for invoice #INV-2026-001. Receiver: Amrullah Abdullah | Mobile: 05643616644 | WhatsApp: 1321"
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="text-right text-[10px] font-mono text-slate-400">
                          {remarks.length}/500
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            resetPaymentDraft();
                            setMessage(t(lang, "cef.form_reset_msg", "Form reset."));
                          }}
                          className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>{t(lang, "common.reset", "Reset")}</span>
                        </Button>

                        <Button
                          type="button"
                          disabled={saving}
                          onClick={save}
                          className="h-9 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black gap-2 shadow-xs cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{saving ? "Posting..." : "Post Entry"}</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* ════════ RIGHT COLUMN: SELECTED ACCOUNT DETAILS & FINANCIAL SNAPSHOT ════════ */}
                  <div className="lg:col-span-5 space-y-4">
                    
                    {/* Card 1: Selected Account Details */}
                    <Card className="border-slate-200 dark:border-slate-800 shadow-2xs rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                      <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div>
                            <CardTitle className="text-xs font-black text-slate-900 dark:text-white">
                              Selected Account Details
                            </CardTitle>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Complete information for the selected account
                            </p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-4">
                        {/* Account Name Header Card */}
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-black shadow-xs shrink-0">
                            <Building2 className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {selectedCounterLedger?.accountName || selectedCounterLedger?.ledgerName || "Rex Trading LLC"}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                                Customer
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                Active
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 font-bold mt-0.5">
                              Account No. {selectedCounterLedger?.accountCode || selectedCounterLedger?.ledgerCode || "UAE-DET-AC-0003"}
                            </p>
                          </div>
                        </div>

                        {/* Identity & Location Details */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
                            <MapPin className="h-3.5 w-3.5 text-blue-600" />
                            <span>Identity &amp; Location Details</span>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">Account Name</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {selectedCounterLedger?.accountName || "Rex Trading LLC"}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">Account No.</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {selectedCounterLedger?.accountCode || "UAE-DET-AC-0003"}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">Country</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedCounterLedger?.countryName || selectedCountry?.name || "United Arab Emirates"}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">State / Province</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedCounterLedger?.stateName || "Dubai"}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">City</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedCounterLedger?.cityName || "Deira"}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">Permanent Address</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px] leading-snug">
                                {selectedCounterLedger?.address || "Office City Branch, Al Maktoum Street, Deira, Dubai, UAE"}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">Branch Name</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedMainBranch?.name || "Deira City Branch"}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">Branch Code</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {selectedMainBranch?.code || "DCB-001"}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">Created Date</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                15 Jan 2023
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1">
                              <span className="text-slate-500 font-semibold">Currency</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {selectedCounterLedger?.ledgerCurrency || branchCurrency || "AED"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card 2: Financial Snapshot */}
                    <Card className="border-slate-200 dark:border-slate-800 shadow-2xs rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                      <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                            <BarChart3 className="h-4 w-4" />
                          </span>
                          <CardTitle className="text-xs font-black text-slate-900 dark:text-white">
                            Financial Snapshot
                          </CardTitle>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 font-semibold">Old Balance</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            120,000.00
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 font-semibold">Total Credit</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            542,520.90
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 font-semibold">Total Debit</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            420,100.00
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-800 dark:text-slate-200 font-black text-xs">Current Balance</span>
                          <span className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                            240,430.90
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-500 font-semibold">Last Transaction Date</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            10 Sep 2026
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

    {/* Recent Cash Entries Table Card */}
    <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">

      {/* Date Filter & Day-by-Day Scope Toolbar */}
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Table Title & Filter Mode Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <span>📋 {t(lang, "roz.journal_roznamcha_entry_table", "JOURNAL ROZNAMCHA — ENTRY TABLE")}</span>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {recentEntriesSummary.count} {t(lang, "creg.entries", "Entries")}
            </span>
          </h3>

          <div className="inline-flex rounded-lg bg-slate-200/80 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setTableDateMode("day")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all",
                tableDateMode === "day"
                  ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              📅 {t(lang, "roz.filter_one_day", "1 Day (Single Date)")}
            </button>
            <button
              type="button"
              onClick={() => setTableDateMode("range")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all",
                tableDateMode === "range"
                  ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              📆 {t(lang, "roz.filter_date_range", "Date Range (From - To)")}
            </button>
            <button
              type="button"
              onClick={() => setTableDateMode("all")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all",
                tableDateMode === "all"
                  ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              🌐 {t(lang, "roz.filter_all_dates", "All Dates")}
            </button>
          </div>

          {/* Active scope indicator badge */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span>
              {tableDateMode === "day"
                ? `${t(lang, "cef.showing_date", "Showing")}: ${tableDate || entryDate} (1 Day)`
                : tableDateMode === "range"
                ? `${tableFromDate} ➔ ${tableToDate}`
                : t(lang, "cef.all_historical_entries", "All Historical Entries")}
            </span>
          </div>
        </div>

        {/* Right: Date Pickers & Navigation Buttons based on active mode */}
        <div className="flex flex-wrap items-center gap-2">
          {tableDateMode === "day" && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => shiftTableDay(-1)}
                title={t(lang, "cef.previous_day", "Previous Day")}
              >
                ◀ {t(lang, "roz.prev_day", "Prev Day")}
              </Button>
              <input
                type="date"
                value={tableDate}
                onChange={(e) => {
                  setTableDate(e.target.value);
                  setEntryDate(e.target.value);
                }}
                className="h-7 px-2 text-xs font-bold bg-transparent border-x border-slate-200 dark:border-slate-800 outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-xs font-bold",
                  tableDate === todayIso() ? "text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50 dark:bg-blue-950/40" : "text-slate-700 dark:text-slate-300"
                )}
                onClick={() => setTableDatePreset("today")}
              >
                📅 {t(lang, "roz.today", "Today")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => shiftTableDay(1)}
                title={t(lang, "cef.next_day", "Next Day")}
              >
                {t(lang, "roz.next_day", "Next Day")} ▶
              </Button>
            </div>
          )}

          {tableDateMode === "range" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs text-xs">
                <span className="text-[11px] font-bold text-slate-500">{t(lang, "cef.from_colon", "From:")}</span>
                <input
                  type="date"
                  value={tableFromDate}
                  onChange={(e) => setTableFromDate(e.target.value)}
                  className="h-6 text-xs font-bold bg-transparent outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-500 ms-1">{t(lang, "cef.to_colon", "To:")}</span>
                <input
                  type="date"
                  value={tableToDate}
                  onChange={(e) => setTableToDate(e.target.value)}
                  className="h-6 text-xs font-bold bg-transparent outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px] font-semibold"
                  onClick={() => setTableDatePreset("this_week")}
                >
                  {t(lang, "cef.this_week", "This Week")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px] font-semibold"
                  onClick={() => setTableDatePreset("this_month")}
                >
                  {t(lang, "cef.this_month", "This Month")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px] font-semibold"
                  onClick={() => setTableDatePreset("last_30_days")}
                >
                  {t(lang, "cef.last_30_days", "Last 30 Days")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse border border-slate-200 dark:border-slate-800 text-xs">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <tr className="text-left text-xs">
                <Th className="p-2.5 font-bold border border-slate-200 dark:border-slate-800 whitespace-nowrap">Date &amp; Time</Th>
                <Th className="p-2.5 font-bold border border-slate-200 dark:border-slate-800 whitespace-nowrap">User Name</Th>
                <Th className="p-2.5 font-bold border border-slate-200 dark:border-slate-800 whitespace-nowrap">Branch Code</Th>
                <Th className="p-2.5 font-bold border border-slate-200 dark:border-slate-800 whitespace-nowrap">Entry Serial</Th>
                <Th className="p-2.5 font-bold border border-slate-200 dark:border-slate-800 whitespace-nowrap">B2B</Th>
                <Th className="p-2.5 font-bold border border-slate-200 dark:border-slate-800 whitespace-nowrap">Number</Th>
                <Th className="p-2.5 font-bold border border-slate-200 dark:border-slate-800 min-w-[200px]">Details</Th>
                <Th className="p-2.5 font-bold text-right border border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">Credit</Th>
                <Th className="p-2.5 font-bold text-right border border-slate-200 dark:border-slate-800 text-rose-700 dark:text-rose-400 whitespace-nowrap">Debit</Th>
                <Th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-800 whitespace-nowrap">Exchange Rate</Th>
                <Th className="p-2.5 font-bold text-right border border-slate-200 dark:border-slate-800 text-emerald-600 whitespace-nowrap">USD Credit</Th>
                <Th className="p-2.5 font-bold text-right border border-slate-200 dark:border-slate-800 text-rose-600 whitespace-nowrap">USD Debit</Th>
                <Th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-800 whitespace-nowrap">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loadingEntries ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 font-medium italic border border-slate-200 dark:border-slate-800">
                    {t(lang, "roz.loading_entries", "Loading entries...")}
                  </td>
                </tr>
              ) : filteredRecentEntries.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-slate-400 font-medium border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <span>{t(lang, "roz.no_entries_found", "No Roznamcha journal entries found for the selected filter / date.")}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecentEntries.flatMap((row) => {
                  return (row.roznamcha_lines || []).map((line: any, idx: number) => {
                    const isDebit = Number(line.debit || 0) > 0;
                    const isCredit = Number(line.credit || 0) > 0;
                    const amountVal = isDebit ? Number(line.debit) : Number(line.credit);
                    
                    const type = line.payment_entry_type || row.type || "";
                    const sign = isDebit ? "+" : isCredit ? "-" : "";
                    const amountStr = `${sign}${fmtAmount(amountVal)} ${line.currency || ""}`;
                    
                    const lineExchangeRate = line.exchange_rate ?? line.usd_rate ?? row.exchange_rate ?? null;
                    const lineUsdAmount = line.usd_amount ?? (lineExchangeRate ? amountVal / Number(lineExchangeRate) : null);
                    const usdCredit = isCredit ? (lineUsdAmount ? `$${fmtAmount(lineUsdAmount)}` : (lineExchangeRate ? `$${fmtAmount(amountVal / Number(lineExchangeRate))}` : null)) : null;
                    const usdDebit = isDebit ? (lineUsdAmount ? `$${fmtAmount(lineUsdAmount)}` : (lineExchangeRate ? `$${fmtAmount(amountVal / Number(lineExchangeRate))}` : null)) : null;

                    // Clean RZ reference
                    const rzRef = line.entry_serial_number || (row.journal_no ? (row.journal_no.startsWith("RZ-") ? row.journal_no : `RZ-${row.journal_no.slice(-6)}`) : (isDebit ? `DR-${row.id?.slice(0, 6)?.toUpperCase()}` : `CR-${row.id?.slice(0, 6)?.toUpperCase()}`));
                    const rzhType = row.type ? (row.type.charAt(0).toUpperCase() + row.type.slice(1)) : "Cash";

                    const isPur = (rzhType || "").toLowerCase().includes("purchase");
                    const isSale = (rzhType || "").toLowerCase().includes("sale");
                    const isCash = (rzhType || "").toLowerCase().includes("cash");

                    return (
                      <tr key={`${row.id}-${line.id || idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        {/* 1. Date & Time */}
                        <td className="p-2.5 border border-slate-200 dark:border-slate-800 align-top whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {row.entry_date ? String(row.entry_date).slice(0, 10) : new Date(row.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </td>

                        {/* 2. User Name */}
                        <td className="p-2.5 border border-slate-200 dark:border-slate-800 align-top whitespace-nowrap">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {row.profiles?.full_name || row.created_by || t(lang, "common.system", "System")}
                          </span>
                        </td>

                        {/* 3. Branch Code */}
                        <td className="p-2.5 border border-slate-200 dark:border-slate-800 align-top whitespace-nowrap">
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            {row.city_branches?.code || row.country_branches?.code || row.countries?.iso2 || "HQ-001"}
                          </span>
                        </td>

                        {/* 4. Entry Serial / RZ Reference */}
                        <td className="p-2.5 font-mono text-[11px] border border-slate-200 dark:border-slate-800 align-top whitespace-nowrap">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-black border",
                            isDebit
                              ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300"
                              : "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-300"
                          )}>
                            {rzRef} <ChevronDown className="h-3 w-3" />
                          </span>
                        </td>

                        {/* 5. B2B */}
                        <td className="p-2.5 border border-slate-200 dark:border-slate-800 align-top whitespace-nowrap">
                          <span className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset",
                            isPur ? "bg-purple-50 text-purple-700 ring-purple-700/10 dark:bg-purple-400/10 dark:text-purple-400" :
                            isSale ? "bg-pink-50 text-pink-700 ring-pink-700/10 dark:bg-pink-400/10 dark:text-pink-400" :
                            isCash ? "bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400" :
                            "bg-slate-100 text-slate-700 ring-slate-700/10 dark:bg-slate-800 dark:text-slate-300"
                          )}>
                            {rzhType}
                          </span>
                        </td>

                        {/* 6. Number */}
                        <td className="p-2.5 font-mono text-[11px] border border-slate-200 dark:border-slate-800 align-top whitespace-nowrap">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {line.account_number || line.manual_reference_number || row.voucher_no || row.journal_no || "—"}
                          </span>
                        </td>

                        {/* 7. Details */}
                        <td className="p-2.5 text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-400 min-w-[200px] border border-slate-200 dark:border-slate-800 align-top" title={translateNarrationBlock(line.description || row.narration, lang) || ""}>
                          <div className="line-clamp-2">
                            {resolveVerifiedTranslation(row.translations?.[`lines.${idx}.description`] || row.translations?.narration, lang) || translateNarrationBlock(line.description || row.narration, lang) || line.ledgers?.name || "-"}
                          </div>
                          {(line.customer_number || row.source_reference_no) && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {line.customer_number ? `Cust: ${line.customer_number}` : ""} {row.source_reference_no ? `Ref: ${row.source_reference_no}` : ""}
                            </div>
                          )}
                        </td>

                        {/* 8. Credit */}
                        <td className="p-2.5 text-right font-black whitespace-nowrap border border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400 align-top">
                          {isCredit ? `${fmtAmount(Number(line.credit))} ${line.currency || ""}` : <span className="text-slate-300 dark:text-slate-700">—</span>}
                        </td>

                        {/* 9. Debit */}
                        <td className="p-2.5 text-right font-black whitespace-nowrap border border-slate-200 dark:border-slate-800 text-rose-700 dark:text-rose-400 align-top">
                          {isDebit ? `${fmtAmount(Number(line.debit))} ${line.currency || ""}` : <span className="text-slate-300 dark:text-slate-700">—</span>}
                        </td>

                        {/* 10. Exchange Rate */}
                        <td className="p-2.5 text-center whitespace-nowrap border border-slate-200 dark:border-slate-800 align-top">
                          {lineExchangeRate ? (
                            <div className="text-[11px] font-mono font-bold text-blue-700 dark:text-blue-400 leading-tight">
                              <span>{Number(lineExchangeRate).toFixed(4)}</span>
                              <span className="block text-[9px] text-slate-400 font-sans">{line.currency || "AED"}/USD</span>
                            </div>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                              {translateHeader(lang, "Rate Missing")}
                            </span>
                          )}
                        </td>

                        {/* 11. USD Credit */}
                        <td className="p-2.5 text-right font-black whitespace-nowrap border border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 align-top">
                          {isCredit ? (
                            usdCredit || <span className="text-amber-600 dark:text-amber-400 text-[10px] font-semibold">{translateHeader(lang, "Rate Missing")}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">—</span>
                          )}
                        </td>

                        {/* 12. USD Debit */}
                        <td className="p-2.5 text-right font-black whitespace-nowrap border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 align-top">
                          {isDebit ? (
                            usdDebit || <span className="text-amber-600 dark:text-amber-400 text-[10px] font-semibold">{translateHeader(lang, "Rate Missing")}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">—</span>
                          )}
                        </td>

                        {/* 13. Actions */}
                        <td className="p-2.5 text-center border border-slate-200 dark:border-slate-800 align-top whitespace-nowrap">
                          {idx === 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              {canEditOrDelete && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px] font-bold border-slate-200 text-blue-600 hover:bg-slate-50 dark:border-slate-800"
                                  onClick={() => handleEditEntry(row)}
                                >
                                  {t(lang, "common.edit", "Edit")}
                                </Button>
                              )}
                              
                              <div className="relative">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 border-none hover:bg-slate-100 dark:hover:bg-slate-900"
                                  onClick={() => setActiveRowMenuId(activeRowMenuId === row.id ? null : row.id)}
                                >
                                  <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                                </Button>
                                
                                {activeRowMenuId === row.id && (
                                  <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-md border border-slate-200 bg-white shadow-lg outline-none dark:border-slate-700 dark:bg-slate-900">
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                                      onClick={() => {
                                        setActiveRowMenuId(null);
                                        handleViewA4ById(row.id);
                                      }}
                                    >
                                      <Printer className="h-3.5 w-3.5" />
                                      {t(lang, "roz.cef_print_a4", "Print A4")}
                                    </button>
                                    {canEditOrDelete && (
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        onClick={() => {
                                          setActiveRowMenuId(null);
                                          handleDeleteEntry(row.id);
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        {t(lang, "common.delete", "Delete")}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {addOptionOpen ? (
        <SimpleModal
          title={addOptionType === "bank" ? "Add New Bank" : "Payment Method Manager"}
          onClose={() => setAddOptionOpen(false)}
          className="max-w-md"
        >
          {addOptionType === "bank" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-black">{t(lang, "bank.bank_name", "Bank Name")}</Label>
                <Input
                  className="text-xs font-semibold"
                  value={addOptionValue}
                  onChange={(e) => setAddOptionValue(e.target.value)}
                  placeholder={t(lang, "roz.cef_bank_branch_example_ph", "e.g. HBL Karachi Branch")}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-black">{t(lang, "roz.cef_bank_address", "Bank Address")}</Label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={addOptionAddress}
                  onChange={(e) => setAddOptionAddress(e.target.value)}
                  placeholder={t(lang, "roz.cef_bank_address_ph", "Enter bank physical branch address...")}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setAddOptionOpen(false)}>
                  {t(lang, "common.cancel", "Cancel")}
                </Button>
                <Button type="button" className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs" onClick={commitAddOption}>
                  {t(lang, "bank.save_bank", "Save Bank")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 pb-3 border-b">
                <Label className="text-xs font-black">{t(lang, "roz.cef_add_new_payment_method", "Add New Payment Method")}</Label>
                <div className="flex gap-2">
                  <Input
                    className="text-xs font-semibold"
                    value={addOptionValue}
                    onChange={(e) => setAddOptionValue(e.target.value)}
                    placeholder={t(lang, "roz.cef_method_example_ph", "e.g. EasyPaisa / JazzCash")}
                  />
                  <Button type="button" className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs" onClick={commitAddOption}>
                    {t(lang, "company_form.add_button", "Add")}
                  </Button>
                </div>
              </div>

              {savedMethods.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs font-black">{t(lang, "roz.cef_custom_methods_list", "Custom Methods List (Click text to rename, or Blur to save)")}</Label>
                  <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1">
                    {savedMethods.map((m) => (
                      <div key={m} className="flex items-center gap-2">
                        <Input
                          defaultValue={m}
                          className="h-8 text-xs font-semibold"
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== m) {
                              renameCustomMethod(m, val);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] font-bold"
                          onClick={() => deleteCustomMethod(m)}
                        >
                          {t(lang, "common.delete", "Delete")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-400 italic text-center py-2">
                  {t(lang, "roz.cef_no_custom_methods", "No custom payment methods added yet.")}
                </p>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setAddOptionOpen(false)}>
                  {t(lang, "purchase.close_btn", "Close")}
                </Button>
              </div>
            </div>
          )}
        </SimpleModal>
      ) : null}
    </div>
  );
}

function AddressLine({
  icon,
  label,
  value,
  strong = false
}: {
  icon: string;
  label?: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="grid grid-cols-[18px_1fr] items-start gap-1.5 text-[11px] text-slate-900 dark:text-slate-100">
      <span className="text-center text-xs text-blue-600 dark:text-blue-300">{icon}</span>
      <div className={strong ? "text-sm font-extrabold" : ""}>
        {label ? <>{label}: </> : null}
        <b>{value || "-"}</b>
      </div>
    </div>
  );
}

function AddressContact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[18px_72px_8px_1fr] items-center gap-1.5 text-[11px] text-slate-900 dark:text-slate-100">
      <span className="text-center text-xs text-blue-600 dark:text-blue-300">{icon}</span>
      <span>{label}</span>
      <span>:</span>
      <b className="min-w-0 break-words">{value || "-"}</b>
    </div>
  );
}

function HeaderSelect({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-black text-white/95">{label}</span>
      {children}
    </label>
  );
}

function ProfilePanel({
  title,
  icon,
  badge,
  rows,
  tone
}: {
  title: string;
  icon: ReactNode;
  badge?: string;
  rows: Array<[string, string]>;
  tone: "blue" | "purple";
}) {
  const toneClass =
    tone === "purple"
      ? "text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/40"
      : "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40";

  return (
    <Card className="overflow-hidden rounded-lg border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-white py-2 dark:bg-slate-950">
        <CardTitle className="flex items-center gap-2 text-sm font-black uppercase">
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg", toneClass)}>{icon}</span>
          {title}
        </CardTitle>
        {badge ? <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">{badge}</span> : null}
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={`${label}-${value}`} className="grid grid-cols-[105px_8px_1fr] items-start gap-1.5 text-[11px]">
              <span className="font-black text-slate-700 dark:text-slate-300">{label}</span>
              <span>:</span>
              <span className="break-words font-semibold text-slate-950 dark:text-slate-50">{value || "-"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: "red" | "green" | "blue" }) {
  const toneClass =
    tone === "red"
      ? "text-red-600"
      : tone === "green"
        ? "text-emerald-700"
        : "text-blue-700";

  return (
    <div className="rounded-lg border bg-white p-2 text-center shadow-sm dark:bg-slate-950">
      <div className="text-[10px] font-black text-slate-700 dark:text-slate-300">{label}</div>
      <div className={cn("mt-2 text-base font-black", toneClass)}>{value}</div>
    </div>
  );
}

function FieldBlock({ label, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function ReportBox({ title, rows }: { title?: string; rows: Array<[string, string]> }) {
  return (
    <div className="min-h-[96px] rounded-lg border bg-white p-3 text-xs shadow-sm dark:bg-slate-950">
      {title ? <div className="mb-2 text-[11px] font-black uppercase text-blue-800 dark:text-blue-300">{title}</div> : null}
      <div className="space-y-2">
        {rows.map(([label, value], index) => (
          <div key={`${label}-${index}`} className={cn("grid gap-1.5", label ? "grid-cols-[92px_8px_1fr]" : "grid-cols-1")}>
            {label ? (
              <>
                <span className="font-black">{label}</span>
                <span>:</span>
              </>
            ) : null}
            <span className="break-words font-semibold">{value || "-"}</span>
          </div>
          ))}
      </div>
    </div>
  );
}


