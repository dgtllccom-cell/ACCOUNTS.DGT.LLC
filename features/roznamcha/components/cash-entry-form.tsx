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
  Calendar,
  AlertCircle,
  Lock,
  ShieldCheck,
  Globe2,
  ExternalLink,
  BookOpen,
  ArrowUp,
  ArrowDown,
  Equal,
  Crown,
  TrendingUp,
  Info,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Table2
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
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { BankPicker } from "@/features/banks/components/bank-picker";
import { getBankById, type BankRecord } from "@/features/banks/bank-api";
import { useIntakeDraft } from "@/lib/document-intelligence/use-intake-draft";
import { LocationBackdrop } from "@/components/location-backdrop";
import { VoiceFormFill } from "@/components/voice-form-fill";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";
import { openScopedGenericReport } from "@/lib/reports/open-scoped-report";
import { RoznamchaReportsDropdown } from "@/features/roznamcha/components/roznamcha-reports-dropdown";
import {
  CjActionsMenu, CjFiltersButton, CjFiltersDialog, CjHeading, CjPagination, CjSummaryCard,
  cjActiveFilterCount
} from "@/features/roznamcha/components/cash-journal-design";
import { TransferDetailsSection } from "@/features/roznamcha/components/transfer-details-section";

import {
  EMPTY_JOURNAL_FILTERS, entriesWithLines, filterJournalEntries, journalFilterOptions, pageSlice, summarizeJournalUsd,
  type JournalFilters
} from "@/features/roznamcha/lib/journal-view";
import { Th } from "@/components/ui/translated-th";
import { resolveVerifiedTranslation } from "@/lib/i18n/verified-record-translations";
import { translateNarrationBlock, translateHeader } from "@/lib/i18n/table-headers";
import { translateValue } from "@/lib/i18n/table-values";
import { localizeCountryName } from "@/lib/i18n/country-names";
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
  const lower = name.trim().toLowerCase();
  if (lower === "pk" || lower === "pak" || lower.includes("pakistan")) return "🇵🇰";
  if (lower === "af" || lower === "afg" || lower.includes("afghanistan")) return "🇦🇫";
  if (lower === "ir" || lower === "irn" || lower.includes("iran")) return "🇮🇷";
  if (lower === "ae" || lower === "uae" || lower.includes("emirates") || lower.includes("uae") || lower.includes("dubai") || lower.includes("abu dhabi")) return "🇦🇪";
  if (lower === "sa" || lower === "ksa" || lower.includes("saudi") || lower.includes("riyadh")) return "🇸🇦";
  if (lower === "in" || lower === "ind" || lower.includes("india")) return "🇮🇳";
  if (lower === "cn" || lower === "chn" || lower.includes("china")) return "🇨🇳";
  if (lower === "tr" || lower === "tur" || lower.includes("turkey")) return "🇹🇷";
  if (lower === "om" || lower.includes("oman")) return "🇴🇲";
  if (lower === "kw" || lower.includes("kuwait")) return "🇰🇼";
  if (lower === "qa" || lower.includes("qatar")) return "🇶🇦";
  if (lower === "bh" || lower.includes("bahrain")) return "🇧🇭";
  return "🏳️";
}

function formatDisplayDateShort(isoDate: string) {
  if (!isoDate) return "";
  const parts = isoDate.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return isoDate;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDisplayDateWithDay(isoDate: string) {
  if (!isoDate) return "";
  const parts = isoDate.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return isoDate;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

const SAVED_BANKS_KEY = "erp_saved_banks_v1";
const SAVED_METHODS_KEY = "erp_saved_payment_methods_v1";

// Display-only currency full names for the "Selected Account" bar and Exchange Rate card
const CURRENCY_FULL_NAMES: Record<string, string> = {
  USD: "United States Dollar",
  PKR: "Pakistani Rupee",
  AED: "UAE Dirham",
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

  const tr = (key: string, defaultEn?: string): string => {
    return t(lang, key as any, defaultEn);
  };

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

  // Cross-branch recipient lookup state
  const [accountSearchMode, setAccountSearchMode] = useState<"same_branch" | "cross_branch">("same_branch");
  const [crossBranchQuery, setCrossBranchQuery] = useState("");
  const [crossBranchResults, setCrossBranchResults] = useState<Array<{
    id: string;
    code: string;
    name: string;
    accountNumber: string;
    customerName: string;
    owningBranchName: string;
    owningBranchCode: string;
    cityName: string;
    ledgerId: string;
    currency: string;
    isOwnBranch: boolean;
  }>>([]);
  const [loadingCrossBranch, setLoadingCrossBranch] = useState(false);
  const [selectedCrossBranchAccount, setSelectedCrossBranchAccount] = useState<{
    id: string;
    code: string;
    name: string;
    accountNumber: string;
    customerName: string;
    owningBranchName: string;
    owningBranchCode: string;
    cityName: string;
    ledgerId: string;
    currency: string;
    isOwnBranch: boolean;
  } | null>(null);
  const [crossBranchDropdownOpen, setCrossBranchDropdownOpen] = useState(false);

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
  const [selectedBankRecord, setSelectedBankRecord] = useState<BankRecord | null>(null);

  // Financial snapshot state for Selected Account (live statement query)
  const [accountSnapshot, setAccountSnapshot] = useState<{
    loading: boolean;
    oldBalance: number;
    totalCredit: number;
    totalDebit: number;
    currentBalance: number;
    lastTransactionDate: string | null;
    transactionCount: number;
  }>({
    loading: false,
    oldBalance: 0,
    totalCredit: 0,
    totalDebit: 0,
    currentBalance: 0,
    lastTransactionDate: null,
    transactionCount: 0,
  });

  // Drilldown dialog state for Daily Cash Position
  const [drilldownBranch, setDrilldownBranch] = useState<{
    branchName: string;
    branchCode: string;
    currency: string;
    totalCredit: number;
    totalDebit: number;
    balance: number;
    balanceType: string;
    entryCount: number;
    transactions: any[];
  } | null>(null);

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
  const [message, setMessageText] = useState<string | null>(null);
  // notices are shown in the selected language, so the tone is kept with them instead of being guessed from English words
  const [messageIsError, setMessageIsError] = useState(false);
  const setMessage = (text: string | null, isError = false) => {
    setMessageIsError(isError);
    setMessageText(text);
  };
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
  // Cash Journal design: Filters dialog (client-side, over the rows the scoped API already returned) and journal table paging
  const [journalFilters, setJournalFilters] = useState<JournalFilters>(EMPTY_JOURNAL_FILTERS);
  const [showJournalFilters, setShowJournalFilters] = useState(false);
  const [journalPage, setJournalPage] = useState(1);
  const [journalPageSize, setJournalPageSize] = useState(10);
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

  // Top-bar Country & Branch view filters for Super Admin / Country Admin dashboard
  const [topCountryFilter, setTopCountryFilter] = useState<string>("all");
  const [topBranchFilter, setTopBranchFilter] = useState<string>("all");

  // Connected Daily Exchange Rate module state (/api/erp/currency/daily-rates)
  const [exchangeRateSearchQuery, setExchangeRateSearchQuery] = useState("");
  const [dailyExchangeModuleRates, setDailyExchangeModuleRates] = useState<any[]>([]);
  const [dailyExchangeCountriesStatus, setDailyExchangeCountriesStatus] = useState<any[]>([]);
  const [loadingExchangeModule, setLoadingExchangeModule] = useState(false);

  // Entry table date filtering state: defaults to 1 day ("day") as required
  const [tableDateMode, setTableDateMode] = useState<"day" | "range" | "all">("day");
  const [tableDate, setTableDate] = useState(todayIso());
  const [tableFromDate, setTableFromDate] = useState(todayIso());
  const [tableToDate, setTableToDate] = useState(todayIso());

  const fetchSummaryOverview = async () => {
    try {
      setLoadingOverview(true);
      const targetDate = tableDateMode === "day" ? (tableDate || entryDate) : entryDate;
      const res = await apiGet<any>(`/api/erp/roznamcha/summary-overview?date=${targetDate}`);
      if (res && Array.isArray(res.countries)) {
        setSummaryOverview(res);
      }
    } catch (err) {
      console.error("Failed to fetch summary overview", err);
    } finally {
      setLoadingOverview(false);
    }
  };

  const fetchAllDailyExchangeRates = async () => {
    try {
      setLoadingExchangeModule(true);
      const res = await apiGet<any>("/api/erp/currency/daily-rates");
      if (res) {
        setDailyExchangeModuleRates(Array.isArray(res.rates) ? res.rates : Array.isArray(res.data) ? res.data : []);
        setDailyExchangeCountriesStatus(Array.isArray(res.countriesStatus) ? res.countriesStatus : []);
      }
    } catch (err) {
      console.error("Failed to fetch daily exchange rates from module", err);
    } finally {
      setLoadingExchangeModule(false);
    }
  };

  useEffect(() => {
    fetchSummaryOverview();
    fetchAllDailyExchangeRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryDate, tableDate, tableDateMode]);

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
    const latestEntry = recentEntries[0] || null;
    const nextSeq = recentEntries.length + 1;
    const year = (entryDate || todayIso()).slice(0, 4) || "2026";
    const cIso = selectedCountry?.iso2 || (selectedCountry?.name ? (selectedCountry.name.toLowerCase().includes("emirates") || selectedCountry.name.toLowerCase().includes("uae") ? "UAE" : selectedCountry.name.slice(0, 3).toUpperCase()) : "UAE");
    const mCode = selectedMainBranch?.code || "MB";
    const cityCode = selectedCityBranch?.code || selectedMainBranch?.code || "DB";

    return {
      superAdmin: latestEntry?.super_admin_serial_number || `SA-${year}-${String(nextSeq).padStart(6, "0")}`,
      country: latestEntry?.country_transaction_serial_number || `${cIso}-${year}-${String(nextSeq).padStart(6, "0")}`,
      branch: latestEntry?.branch_transaction_serial_number || `${cityCode}-${year}-${String(nextSeq).padStart(6, "0")}`,
      mainBranch: latestEntry?.main_branch_transaction_serial || `${mCode}-${year}-${String(nextSeq).padStart(6, "0")}`,
      cityBranch: latestEntry?.city_branch_transaction_serial || `${cityCode}-${year}-${String(nextSeq).padStart(6, "0")}`,
      entrySerial: latestEntry?.entry_serial_number || latestEntry?.roznamcha_lines?.[0]?.entry_serial_number || `EN-${year}-${String(nextSeq).padStart(6, "0")}`
    };
  }, [recentEntries, entryDate, selectedCountry, selectedMainBranch, selectedCityBranch]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);
  const [ledgerRefreshCount, setLedgerRefreshCount] = useState(0);
  const [showPaymentWorkReport, setShowPaymentWorkReport] = useState(false);



  // Serial Numbers states
  const [serialRoleFilter, setSerialRoleFilter] = useState("Super Admin");
  const [showSerialsDropdown, setShowSerialsDropdown] = useState(false);

  // Small independent Roznamcha Bank / Payment Master (Parts 9 & 10)
  const DEFAULT_ROZNAMCHA_BANKS: Record<string, string[]> = {
    AE: ["Emirates NBD", "Abu Dhabi Commercial Bank (ADCB)", "Dubai Islamic Bank (DIB)", "First Abu Dhabi Bank (FAB)", "Mashreq Bank", "RAKBank", "Commercial Bank of Dubai"],
    PK: ["Habib Bank Limited (HBL)", "Meezan Bank", "MCB Bank", "United Bank Limited (UBL)", "Allied Bank Limited (ABL)", "Bank Alfalah", "Faysal Bank", "Askari Bank"],
    AF: ["Afghanistan International Bank (AIB)", "Azizi Bank", "New Kabul Bank", "Ghazanfar Bank", "Maiwand Bank", "Bank-e-Millie Afghan"],
    IR: ["Bank Melli Iran", "Bank Mellat", "Bank Saderat Iran", "Bank Tejarat", "Parsian Bank", "Pasargad Bank"],
    IN: ["State Bank of India (SBI)", "HDFC Bank", "ICICI Bank", "Axis Bank", "Punjab National Bank", "Kotak Mahindra Bank"],
    DEFAULT: ["International Bank", "Standard Chartered", "Citibank", "HSBC", "Other Payment Channel"]
  };
  const [customRoznamchaBanks, setCustomRoznamchaBanks] = useState<Record<string, string[]>>({});
  const [showNewBankModal, setShowNewBankModal] = useState(false);
  const [newBankNameInput, setNewBankNameInput] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("erp_roznamcha_custom_banks_v1");
      if (stored) setCustomRoznamchaBanks(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const availableRoznamchaBanks = useMemo(() => {
    const iso = (activeCountryIso || "DEFAULT").toUpperCase();
    const defaults = DEFAULT_ROZNAMCHA_BANKS[iso] || DEFAULT_ROZNAMCHA_BANKS.DEFAULT;
    const custom = customRoznamchaBanks[iso] || [];
    return [...new Set([...defaults, ...custom])];
  }, [activeCountryIso, customRoznamchaBanks]);

  const handleAddCustomBank = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const iso = (activeCountryIso || "DEFAULT").toUpperCase();
    setCustomRoznamchaBanks((prev) => {
      const next = { ...prev, [iso]: [...new Set([...(prev[iso] || []), trimmed])] };
      try {
        localStorage.setItem("erp_roznamcha_custom_banks_v1", JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
    setTypeDetails((p) => ({ ...p, bankName: trimmed }));
    setShowNewBankModal(false);
    setNewBankNameInput("");
  };

  // Daily Cash Position states
  const [cashPositionRoleFilter, setCashPositionRoleFilter] = useState("Super Admin");
  const [cashPositionCountryFilter, setCashPositionCountryFilter] = useState("all");
  const [cashPositionsList] = useState<any[]>([]);

  const isSuperAdmin = session?.scopes?.isSuperAdmin ?? false;

  const assignedCountryCurrency = useMemo(() => {
    const cid = countryId || session?.scopes?.countryIds?.[0] || (session?.scopes as any)?.summary?.branchCountryId;
    const c = countries.find((x) => x.id === cid);
    return c?.currency_code || null;
  }, [countryId, session, countries]);

  const branchCurrency =
    selectedCityBranch?.local_currency ||
    selectedMainBranch?.local_currency ||
    selectedCountry?.currency_code ||
    assignedCountryCurrency ||
    (isSuperAdmin ? "USD" : "PKR");


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

  const isCountryAdmin = useMemo(() => {
    if (isSuperAdmin) return false;
    return Boolean(
      session?.roles?.includes("country_admin") ||
      userRoleLevel === "country" ||
      (!session?.scopes?.isSuperAdmin && session?.scopes?.countryIds && session.scopes.countryIds.length > 0 && (!session.scopes.countryBranchIds || session.scopes.countryBranchIds.length === 0))
    );
  }, [isSuperAdmin, session, userRoleLevel]);

  const canViewUsd = useMemo(() => {
    if (!session) return false;
    if (session.scopes?.isSuperAdmin) return true;
    if (session.roles?.some((r: string) => r === "super_admin" || r === "financial_controller")) return true;
    if ((session as any).permissions?.some((p: string) => p === "reports:view_usd" || p === "view_usd_reporting")) return true;
    return false;
  }, [session]);

  const userRoleLabel = useMemo(() => {
    if (session?.scopes?.isSuperAdmin) return tr("cj.roleSuperAdmin", "Super Admin");
    const primaryRole = session?.roles?.[0] || "";
    if (primaryRole === "country_admin") return tr("cj.roleCountryAdmin", "Country Admin");
    if (primaryRole === "city_branch_admin" || primaryRole === "branch_admin" || primaryRole === "main_branch_admin") {
      return tr("cj.roleBranchAdmin", "Branch Admin");
    }
    if (primaryRole) {
      return translateHeader(lang, primaryRole.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
    }
    return tr("role.staff_user", "Staff User");
  }, [session, tr, lang]);

  const currentSerialDisplay = useMemo(() => {
    if (isSuperAdmin) {
      return savedSerials?.superAdmin || liveSerials.superAdmin;
    }
    if (isCountryAdmin) {
      return savedSerials?.country || liveSerials.country;
    }
    if (userRoleLevel === "branch" || session?.roles?.includes("city_branch_admin") || session?.roles?.includes("main_branch_admin")) {
      return (savedSerials as any)?.cityBranch || liveSerials.cityBranch || savedSerials?.branch || liveSerials.branch;
    }
    return (savedSerials as any)?.entrySerial || liveSerials.entrySerial || (savedSerials as any)?.cityBranch || liveSerials.cityBranch;
  }, [isSuperAdmin, isCountryAdmin, userRoleLevel, session, savedSerials, liveSerials]);

  const canCrossBranchLookup = useMemo(() => {
    if (isSuperAdmin) return true;
    const roles = session?.roles || [];
    return roles.some((r) => ["country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"].includes(r));
  }, [isSuperAdmin, session]);

  // Debounced search for same-country cross-branch recipient
  useEffect(() => {
    if (accountSearchMode !== "cross_branch") return;
    const q = crossBranchQuery.trim();
    if (q.length < 2) {
      setCrossBranchResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoadingCrossBranch(true);
        const params = new URLSearchParams({ q });
        if (countryId) params.set("countryId", countryId);
        const res = await apiGet<{ ok: boolean; accounts: any[] }>(`/api/erp/accounts/cross-branch-lookup?${params.toString()}`);
        if (!cancelled) {
          setCrossBranchResults(res?.accounts || []);
          setCrossBranchDropdownOpen(true);
        }
      } catch (err) {
        console.error("Failed cross-branch account lookup", err);
        if (!cancelled) setCrossBranchResults([]);
      } finally {
        if (!cancelled) setLoadingCrossBranch(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [crossBranchQuery, accountSearchMode, countryId]);

  function handleSelectCrossBranchAccount(acc: (typeof crossBranchResults)[0]) {
    setSelectedCrossBranchAccount(acc);
    setCounterLedgerId(acc.ledgerId);
    setAccountNoInput(acc.accountNumber || acc.code);
    setAccountLookupError(null);
    setCrossBranchDropdownOpen(false);

    // Provide synthetic ledger row for payment calculation without touching originating countryBranchId / cityBranchId
    const syntheticLedger: LedgerLookupRow = {
      accountId: acc.id,
      ledgerId: acc.ledgerId,
      accountName: acc.name || acc.customerName,
      accountCode: acc.code || acc.accountNumber,
      customerNumber: acc.accountNumber,
      ledgerName: acc.name,
      ledgerCode: acc.code,
      ledgerCurrency: acc.currency || branchCurrency,
      countryBranchName: acc.owningBranchName,
      cityBranchName: acc.owningBranchName,
      cityName: acc.cityName,
      countryId: countryId,
      scope: "branch",
      currentBalance: 0,
      debitTotal: 0,
      creditTotal: 0,
      normalBalance: "debit",
      countryName: selectedCountry?.name || "",
      countryBranchId: countryBranchId,
      cityBranchId: cityBranchId || "",
    } as unknown as LedgerLookupRow;
    setSelectedLookupLedger(syntheticLedger);
    const nextCur = (acc.currency || branchCurrency).trim();
    if (nextCur.length === 3) setCurrency(nextCur.toUpperCase());
    setRoznamchaBookType((current) => current || "branch_payment_voucher");
  }

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
  // Top-bar search + Filters dialog, over the rows the scoped API already returned (pure helpers: features/roznamcha/lib/journal-view.ts)
  const filteredRecentEntries = useMemo(
    () => filterJournalEntries(recentEntries, tableSearchQuery, journalFilters),
    [recentEntries, tableSearchQuery, journalFilters]
  );

  // Options for the Filters dialog come from the rows already loaded for this scope (never a fixed list).
  const journalFilterChoices = useMemo(() => journalFilterOptions(recentEntries), [recentEntries]);

  // Active countries & exchange rates connected to the Daily Exchange Rate module (/api/erp/currency/daily-rates)
  const activeExchangeRatesList = useMemo(() => {
    const targetDate = tableDateMode === "day" ? (tableDate || entryDate || todayIso()) : (entryDate || todayIso());
    const map = new Map<string, {
      countryId: string;
      countryName: string;
      iso2: string;
      currencyCode: string;
      currencyFullName: string;
      rate: number | null;
      status: "APPROVED" | "PENDING_MISSING";
    }>();

    // 1. Seed from countries master & summaryOverview
    for (const c of countries) {
      const code = (c.currency_code || "AED").toUpperCase();
      map.set(c.id, {
        countryId: c.id,
        countryName: c.name,
        iso2: (c as any).iso2 || c.name.slice(0, 2).toUpperCase(),
        currencyCode: code,
        currencyFullName: CURRENCY_FULL_NAMES[code] || code,
        rate: null,
        status: "PENDING_MISSING",
      });
    }

    for (const sc of summaryOverview?.countries || []) {
      const code = (sc.currencyCode || "AED").toUpperCase();
      const existing = map.get(sc.countryId);
      const ovRate = sc.rates?.creditRate ?? sc.rates?.debitRate ?? sc.rates?.buyingRate ?? sc.rates?.sellingRate ?? null;
      map.set(sc.countryId, {
        countryId: sc.countryId,
        countryName: sc.countryName || existing?.countryName || "",
        iso2: sc.iso2 || existing?.iso2 || "",
        currencyCode: code,
        currencyFullName: CURRENCY_FULL_NAMES[code] || code,
        rate: ovRate != null && Number(ovRate) > 0 ? Number(ovRate) : (existing?.rate ?? null),
        status: ovRate != null && Number(ovRate) > 0 ? "APPROVED" : (existing?.status ?? "PENDING_MISSING"),
      });
    }

    // 2. Overlay from Daily Exchange Rate module countriesStatus
    for (const cs of dailyExchangeCountriesStatus) {
      if (!cs?.countryId) continue;
      const code = (cs.currencyCode || "AED").toUpperCase();
      const existing = map.get(cs.countryId);
      const modRate = cs.creditRate ?? cs.debitRate ?? null;
      map.set(cs.countryId, {
        countryId: cs.countryId,
        countryName: cs.countryName || existing?.countryName || "",
        iso2: cs.iso2 || existing?.iso2 || "",
        currencyCode: code,
        currencyFullName: CURRENCY_FULL_NAMES[code] || code,
        rate: modRate != null && Number(modRate) > 0 ? Number(modRate) : (existing?.rate ?? null),
        status: modRate != null && Number(modRate) > 0 ? "APPROVED" : (existing?.status ?? "PENDING_MISSING"),
      });
    }

    // 3. Overlay exact-date or latest non-superseded rate from daily_usd_rates table
    for (const [cid, item] of map.entries()) {
      const exactRow = dailyExchangeModuleRates.find(
        (r) => r.country_id === cid && r.rate_date === targetDate && !r.superseded_at
      );
      const latestRow = exactRow || dailyExchangeModuleRates.find(
        (r) => r.country_id === cid && !r.superseded_at
      );
      if (latestRow) {
        const val = latestRow.credit_rate ?? latestRow.debit_rate ?? latestRow.selling_rate ?? latestRow.buying_rate ?? null;
        if (val != null && Number(val) > 0) {
          item.rate = Number(val);
          item.status = "APPROVED";
        }
      }
    }

    const list = Array.from(map.values());
    const q = exchangeRateSearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((it) =>
      it.countryName.toLowerCase().includes(q) ||
      it.iso2.toLowerCase().includes(q) ||
      it.currencyCode.toLowerCase().includes(q) ||
      it.currencyFullName.toLowerCase().includes(q)
    );
  }, [countries, summaryOverview, dailyExchangeCountriesStatus, dailyExchangeModuleRates, entryDate, tableDate, tableDateMode, exchangeRateSearchQuery]);

  // Fast currency -> rate map from Daily Exchange Rate module
  const currencyRateLookup = useMemo(() => {
    const m: Record<string, number> = { USD: 1 };
    for (const r of dailyExchangeModuleRates) {
      const cur = String(r.currency_code || r.countries?.currency_code || "").toUpperCase();
      const val = Number(r.credit_rate ?? r.debit_rate ?? r.selling_rate ?? r.buying_rate ?? 0);
      if (cur && val > 0 && !m[cur]) m[cur] = val;
    }
    for (const sc of summaryOverview?.countries || []) {
      const cur = String(sc.currencyCode || "").toUpperCase();
      const val = Number(sc.rates?.creditRate ?? sc.rates?.debitRate ?? sc.rates?.buyingRate ?? sc.rates?.sellingRate ?? 0);
      if (cur && val > 0 && !m[cur]) m[cur] = val;
    }
    return m;
  }, [dailyExchangeModuleRates, summaryOverview]);

  // "Amount & Payment" card: plain sums of the same USD figures the table's USD Credit / USD Debit columns display.
  const journalSummary = useMemo(() => summarizeJournalUsd(filteredRecentEntries), [filteredRecentEntries]);

  // Primary display lines helper: excludes internal auto-generated "Offset - Source Cash/Bank" duplicate leg
  const getDisplayLinesForEntry = (row: any): any[] => {
    const lines: any[] = row?.roznamcha_lines || [];
    if (lines.length <= 1) return lines;
    const nonOffset = lines.filter((l) => !String(l?.description || "").startsWith("Offset - Source Cash/Bank"));
    return nonOffset.length > 0 ? nonOffset : [lines[0]];
  };

  // USD Position card totals (Total Credit, Total Debit, Net Balance in one USD card)
  const usdCardPosition = useMemo(() => {
    let credit = 0;
    let debit = 0;
    for (const row of filteredRecentEntries) {
      const lines = getDisplayLinesForEntry(row);
      for (const line of lines) {
        const c = Number(line.credit || 0);
        const d = Number(line.debit || 0);
        const cur = String(line.currency || row.countries?.currency_code || branchCurrency || "AED").toUpperCase();
        const rate = Number(line.exchange_rate ?? line.usd_rate ?? row.exchange_rate ?? currencyRateLookup[cur] ?? 0);
        if (c > 0) {
          const usd = line.usd_amount != null && Number(line.usd_amount) > 0
            ? Number(line.usd_amount)
            : cur === "USD"
            ? c
            : rate > 0
            ? c / rate
            : 0;
          credit += usd;
        }
        if (d > 0) {
          const usd = line.usd_amount != null && Number(line.usd_amount) > 0
            ? Number(line.usd_amount)
            : cur === "USD"
            ? d
            : rate > 0
            ? d / rate
            : 0;
          debit += usd;
        }
      }
    }
    return {
      credit,
      debit,
      balance: credit - debit,
    };
  }, [filteredRecentEntries, currencyRateLookup, branchCurrency]);

  // Country Position (Own Currency) rows — each country in its own currency, without extra combined total
  const countryPositionRows = useMemo(() => {
    const ovCountries = summaryOverview?.countries || [];
    // Compute non-offset per-country totals from loaded entries if available, falling back to summaryOverview
    const entryStatsByCountry = new Map<string, { credit: number; debit: number; count: number }>();
    for (const row of recentEntries) {
      const cid = row.country_id || "";
      if (!cid) continue;
      const curStats = entryStatsByCountry.get(cid) || { credit: 0, debit: 0, count: 0 };
      curStats.count += 1;
      for (const line of getDisplayLinesForEntry(row)) {
        curStats.credit += Number(line.credit || 0);
        curStats.debit += Number(line.debit || 0);
      }
      entryStatsByCountry.set(cid, curStats);
    }

    const baseList = ovCountries.length > 0
      ? ovCountries.map((c) => {
          const fromEntries = entryStatsByCountry.get(c.countryId);
          // If summaryOverview had equal credit/debit due to double-entry offset legs, prefer primary entry stats
          const useEntryStats = fromEntries && (c.totalCredit === c.totalDebit && fromEntries.credit !== fromEntries.debit);
          const credit = useEntryStats ? fromEntries.credit : c.totalCredit;
          const debit = useEntryStats ? fromEntries.debit : c.totalDebit;
          const net = credit - debit;
          return {
            ...c,
            totalCredit: credit,
            totalDebit: debit,
            balance: Math.abs(net),
            balanceRaw: net,
            balanceType: net > 0 ? "Cr" : net < 0 ? "Dr" : "-",
          };
        })
      : countries.map((c) => {
          const st = entryStatsByCountry.get(c.id) || { credit: 0, debit: 0, count: 0 };
          const net = st.credit - st.debit;
          return {
            countryId: c.id,
            countryName: c.name,
            iso2: (c as any).iso2 || c.name.slice(0, 2).toUpperCase(),
            currencyCode: c.currency_code || "AED",
            totalCredit: st.credit,
            totalDebit: st.debit,
            balance: Math.abs(net),
            balanceRaw: net,
            balanceType: net > 0 ? "Cr" : net < 0 ? "Dr" : "-",
            entryCount: st.count,
            rates: { buyingRate: null, sellingRate: null, creditRate: null, debitRate: null },
            branches: [],
          };
        });

    if (topCountryFilter !== "all") {
      return baseList.filter((c) => c.countryId === topCountryFilter || c.iso2?.toLowerCase() === topCountryFilter.toLowerCase());
    }
    return baseList;
  }, [summaryOverview, recentEntries, countries, topCountryFilter]);

  // All available branches for the top-bar "All Branches" dropdown
  const allFilterBranches = useMemo(() => {
    const ovCountries = summaryOverview?.countries || [];
    const filteredC = topCountryFilter === "all"
      ? ovCountries
      : ovCountries.filter((c) => c.countryId === topCountryFilter);
    const list: Array<{ id: string; name: string; code: string; countryId: string; countryName: string }> = [];
    for (const c of filteredC) {
      for (const b of c.branches || []) {
        list.push({
          id: b.branchId,
          name: b.branchName,
          code: b.branchCode,
          countryId: c.countryId,
          countryName: c.countryName,
        });
      }
    }
    if (list.length === 0) {
      for (const b of cityBranches) {
        list.push({
          id: b.id,
          name: b.name,
          code: b.code,
          countryId: b.country_id,
          countryName: selectedCountry?.name || "",
        });
      }
    }
    return list;
  }, [summaryOverview, topCountryFilter, cityBranches, selectedCountry]);

  // The table prints one row per posted line, so paging runs over the entries that actually carry lines.
  const journalRowEntries = useMemo(() => entriesWithLines(filteredRecentEntries), [filteredRecentEntries]);
  const journalPaged = useMemo(() => pageSlice(journalRowEntries, journalPage, journalPageSize), [journalRowEntries, journalPage, journalPageSize]);
  const journalPageSafe = journalPaged.page;
  const pagedRecentEntries = journalPaged.rows;

  const [showRoznamcha, setShowRoznamcha] = useState(false);
  const [roznamchaType, setRoznamchaType] = useState("Cash Book No.");
  const [roznamchaBook, setRoznamchaBook] = useState("CB-001 - Main Cash Book");
  const [roznamchaNumber, setRoznamchaNumber] = useState("000123");


  // Back to the first page whenever the visible set changes (search, filters, date scope, page size).
  useEffect(() => {
    setJournalPage(1);
  }, [tableSearchQuery, journalFilters, tableDateMode, tableDate, tableFromDate, tableToDate, journalPageSize]);

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
      const effectiveFilterCountry = isSuperAdmin
        ? (topCountryFilter !== "all" ? topCountryFilter : "")
        : countryId;
      const effectiveFilterCityBranch = (isSuperAdmin || isCountryAdmin)
        ? (topBranchFilter !== "all" ? topBranchFilter : "")
        : cityBranchId;

      if (effectiveFilterCountry) params.set("countryId", effectiveFilterCountry);
      if (!isSuperAdmin && !isCountryAdmin && countryBranchId) params.set("countryBranchId", countryBranchId);
      if (effectiveFilterCityBranch) params.set("cityBranchId", effectiveFilterCityBranch);

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
      setDailyUsdRates(null);
      return;
    }
    try {
      setLoadingDailyRate(true);
      const params = new URLSearchParams({ countryId });
      if (countryBranchId) params.set("countryBranchId", countryBranchId);
      const effectiveDate = entryDate || todayIso();
      if (effectiveDate) params.set("date", effectiveDate);
      const res = await apiGet<DailyRate>(`/api/erp/currency/daily-rate?${params.toString()}`);
      setDailyRate(res);
      if (res && res.found) {
        setDailyUsdRates({
          buyingRate: res.buyingRate ?? undefined,
          sellingRate: res.sellingRate ?? undefined,
          creditRate: res.creditRate ?? undefined,
          debitRate: res.debitRate ?? undefined,
        });
      } else {
        setDailyUsdRates(null);
      }
    } catch (err) {
      console.error("Failed to fetch daily rate", err);
      setDailyRate(null);
      setDailyUsdRates(null);
    } finally {
      setLoadingDailyRate(false);
    }
  };

  const normalizedCurrency = currency.trim().toUpperCase();

  useEffect(() => {
    if (normalizedCurrency === "USD") {
      setExchangeRate("1");
      return;
    }
    if (dailyRate && dailyRate.found) {
      const activeRate = paymentMode === "DEBIT"
        ? (dailyRate.debitRate || dailyRate.buyingRate)
        : (dailyRate.creditRate || dailyRate.sellingRate);
      if (activeRate && activeRate > 0) {
        setExchangeRate(String(activeRate));
      } else {
        setExchangeRate("");
      }
    } else {
      setExchangeRate("");
    }
  }, [dailyRate, paymentMode, normalizedCurrency]);

  useEffect(() => {
    fetchRecentEntries();
    fetchCashSummary();
    fetchDailyRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, countryBranchId, cityBranchId, topCountryFilter, topBranchFilter, isSuperAdmin, isCountryAdmin, tableDateMode, tableDate, tableFromDate, tableToDate, entryDate]);

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

  const selectedCounterLedger = useMemo(() => {
    if (selectedLookupLedger?.ledgerId === counterLedgerId) return selectedLookupLedger;
    const match = ledgers.find((row) => row.ledgerId === counterLedgerId);
    if (match) return match;
    return ledgerRowsWithAccount.find((row) => row.ledgerId === counterLedgerId) ?? null;
  }, [ledgers, ledgerRowsWithAccount, counterLedgerId, selectedLookupLedger]);

  const isSamePostingLedger = Boolean(
    selectedCashLedger?.ledgerId &&
      selectedCounterLedger?.ledgerId &&
      selectedCashLedger.ledgerId === selectedCounterLedger.ledgerId
  );

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
      ...(canViewUsd ? ["USD"] : []),
      "AED", "PKR", "AFN", "INR", "IRR"
    ]
      .map((v) => (v ?? "").toString().trim().toUpperCase())
      .filter(Boolean);
    return new Set(list);
  }, [branchCurrency, targetAccountCurrency, canViewUsd]);

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

  useEffect(() => {
    if (selectedCrossBranchAccount) {
      setAccountSnapshot({
        loading: false,
        oldBalance: 0,
        totalCredit: 0,
        totalDebit: 0,
        currentBalance: 0,
        lastTransactionDate: null,
        transactionCount: 0,
      });
      return;
    }
    const lId = selectedCounterLedger?.ledgerId;
    if (!lId) {
      setAccountSnapshot({
        loading: false,
        oldBalance: 0,
        totalCredit: 0,
        totalDebit: 0,
        currentBalance: 0,
        lastTransactionDate: null,
        transactionCount: 0,
      });
      return;
    }
    let cancelled = false;
    setAccountSnapshot((prev) => ({ ...prev, loading: true }));
    (async () => {
      try {
        const res = await apiGet<any>(`/api/erp/accounting/reports/ledger/statement?ledgerId=${lId}`);
        if (cancelled) return;
        if (res && res.found) {
          const lines = Array.isArray(res.lines) ? res.lines : [];
          const lastLine = lines.length > 0 ? lines[lines.length - 1] : null;
          setAccountSnapshot({
            loading: false,
            oldBalance: Number(res.openingBalance || 0),
            totalCredit: Number(res.totals?.credit || 0),
            totalDebit: Number(res.totals?.debit || 0),
            currentBalance: Number(res.totals?.balance ?? res.openingBalance ?? 0),
            lastTransactionDate: lastLine?.entryDate || (lines.length > 0 ? lines[0]?.entryDate : null),
            transactionCount: lines.length,
          });
        } else {
          setAccountSnapshot({
            loading: false,
            oldBalance: 0,
            totalCredit: 0,
            totalDebit: 0,
            currentBalance: 0,
            lastTransactionDate: null,
            transactionCount: 0,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setAccountSnapshot({
            loading: false,
            oldBalance: 0,
            totalCredit: 0,
            totalDebit: 0,
            currentBalance: 0,
            lastTransactionDate: null,
            transactionCount: 0,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCounterLedger?.ledgerId]);

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
          reportScope: cityBranchId || countryBranchId ? "branch" : countryId ? "country" : "super_admin",
          countryId: countryId || null,
          countryBranchId: countryBranchId || null,
          cityBranchId: cityBranchId || null,
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

          // Sensible defaults: pick cash ledger matching the current branch and country.
          // Never default to a cross-country cash ledger (e.g. PK ledger in UAE session).
          const scopedRows = finalRows.filter((row) => {
            if (countryId && row.countryId && row.countryId !== countryId) return false;
            if (cityBranchId && row.cityBranchId && row.cityBranchId !== cityBranchId) return false;
            if (countryBranchId && row.countryBranchId && row.countryBranchId !== countryBranchId) return false;
            return true;
          });
          const candidateList = scopedRows.length > 0 ? scopedRows : finalRows;
          const validRows = candidateList.filter((row) => Boolean(row.accountId && row.ledgerId));
          const listToSearch = validRows.length > 0 ? validRows : candidateList;
          const cashGuess =
            listToSearch.find((r) => (r.ledgerName ?? "").toLowerCase().includes("cash")) ??
            listToSearch.find((r) => (r.accountName ?? "").toLowerCase().includes("cash")) ??
            listToSearch.find((r) => (r.ledgerCurrency ?? "").toUpperCase() === (branchCurrency || "").toUpperCase()) ??
            listToSearch[0] ??
            null;
          if (cashGuess?.ledgerId) setCashLedgerId(cashGuess.ledgerId);
        }
      } finally {
        if (!cancelled) setLoadingLedgers(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cityBranchId, countryId, countryBranchId, ledgerRefreshCount, branchCurrency]);

  // Keep currency aligned with branch currency or counter ledger currency
  useEffect(() => {
    if (selectedCounterLedger?.ledgerCurrency) {
      setCurrency(selectedCounterLedger.ledgerCurrency.toUpperCase());
    } else if (branchCurrency) {
      setCurrency(branchCurrency.toUpperCase());
    }
  }, [selectedCounterLedger, branchCurrency]);

  // When country or branch changes, re-sync currency to local branch currency
  useEffect(() => {
    if (branchCurrency) {
      setCurrency(branchCurrency.toUpperCase());
    }
  }, [countryId, countryBranchId, cityBranchId, branchCurrency]);

  const isRatePending = !dailyRate || !dailyRate.found || Number(exchangeRate) <= 0;

  const canSave =
    Boolean(countryId && (countryBranchId || cityBranchId)) &&
    Boolean(counterLedgerId || selectedCrossBranchAccount) &&
    Boolean(paymentMode) &&
    Boolean(paymentType) &&
    Boolean(amount && amount > 0) &&
    currency.trim().length === 3 &&
    !isRatePending &&
    Number(exchangeRate) > 0 &&
    !saving;

  useEffect(() => {
    console.log("canSave check details:", {
      countryBranch: Boolean(countryId && (countryBranchId || cityBranchId)),
      selectedCounter: Boolean(selectedCounterLedger?.ledgerId || selectedCrossBranchAccount),
      paymentMode: Boolean(paymentMode),
      paymentType: Boolean(paymentType),
      amountVal: Boolean(amount && amount > 0),
      currencyLen: (currency || "").trim().length === 3,
      exchangeRateVal: Number(exchangeRate) > 0,
      saving: !saving,
      amount,
      currency,
      exchangeRate,
      selectedCounterLedger,
      selectedCrossBranchAccount
    });
  }, [countryId, countryBranchId, cityBranchId, selectedCounterLedger, selectedCrossBranchAccount, paymentMode, paymentType, amount, currency, exchangeRate, saving]);

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
    if (accountSearchMode === "cross_branch" || selectedCrossBranchAccount) return;
    if (!row.countryId || !row.countryBranchId) return;

    const needsCountry = row.countryId !== countryId;
    const needsMain = row.countryBranchId !== countryBranchId;
    const nextCityBranchId = row.cityBranchId ?? "";
    const needsCity = nextCityBranchId !== cityBranchId;

    suppressScopeResetRef.current = true;
    if (needsCountry && isSuperAdmin) setCountryId(row.countryId);
    if (needsMain && isSuperAdmin) setCountryBranchId(row.countryBranchId);
    if (needsCity && isSuperAdmin) setCityBranchId(nextCityBranchId);
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
    setSelectedCrossBranchAccount(null);
    setCrossBranchQuery("");
    setCrossBranchResults([]);
    setCrossBranchDropdownOpen(false);
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
      ...(canViewUsd ? [{ label: t(lang, "cef.print_global_serial", "Global Serial (Super Admin)"), value: header.super_admin_serial_number || "-" }] : []),
      ...((canViewUsd || isCountryAdmin) ? [{ label: t(lang, "cef.print_country_serial", "Country Serial"), value: header.country_transaction_serial_number || "-" }] : []),
      { label: t(lang, "cef.print_branch_serial", "Branch Serial"), value: header.branch_transaction_serial_number || "-" },
      { label: t(lang, "cef.print_entry_serial", "Entry Serial (DR/CR)"), value: entrySerial || "-" },
      { label: t(lang, "cef.print_date", "Date"), value: header.entry_date || "-" },
      { label: t(lang, "cef.print_voucher_no", "Voucher No"), value: header.voucher_no || "-" },
      { label: t(lang, "cef.print_journal_no", "Journal No"), value: header.journal_no || "-" },
      { label: t(lang, "cef.print_narration", "Narration"), value: resolveVerifiedTranslation(header.translations?.narration, lang) || translateNarrationBlock(header.narration, lang) || "-" },
      { label: t(lang, "cef.print_status", "Status"), value: header.status || "-" }
    ];

    if (firstLine) {
      const lineAmt = Number(firstLine.debit || 0) > 0 ? Number(firstLine.debit) : Number(firstLine.credit || 0);
      const isLineDebit = Number(firstLine.debit || 0) > 0;
      rowsForPrint.push({
        label: t(lang, "cef.print_counterparty_account", "Counterparty Account"),
        value: `${firstLine.account_number || firstLine.ledgers?.code || "-"} | ${firstLine.ledgers?.name || "-"} | ${isLineDebit ? t(lang, "cef.print_debit_receive", "Debit (Receive)") : t(lang, "cef.print_credit_pay", "Credit (Pay)")} ${fmtAmount(lineAmt)} ${firstLine.currency || header.countries?.currency_code || branchCurrency || "PKR"}`
      });
    }
    if (secondLine) {
      const lineAmt = Number(secondLine.debit || 0) > 0 ? Number(secondLine.debit) : Number(secondLine.credit || 0);
      const isLineDebit = Number(secondLine.debit || 0) > 0;
      rowsForPrint.push({
        label: t(lang, "cef.print_cash_bank_account", "Cash/Bank Account"),
        value: `${secondLine.account_number || secondLine.ledgers?.code || "-"} | ${secondLine.ledgers?.name || "-"} | ${isLineDebit ? t(lang, "cef.print_debit_receive", "Debit (Receive)") : t(lang, "cef.print_credit_pay", "Credit (Pay)")} ${fmtAmount(lineAmt)} ${secondLine.currency || header.countries?.currency_code || branchCurrency || "PKR"}`
      });
    }
    return rowsForPrint;
  };

  const handleViewA4ById = async (id: string) => {
    try {
      const res = await apiGet<any>(`/api/erp/roznamcha/${id}`);
      if (res.found && res.header) {
        const header = res.header;
        const lines = res.lines || [];

        const counterpartyLine = lines.find((l: any) => l.ledger_id && l.ledger_id === header.counter_ledger_id) || lines[0];
        const cashBankLine = lines.find((l: any) => l.id !== counterpartyLine?.id) || lines[1];

        const financialLines = lines.map((l: any) => {
          const deb = Number(l.debit || 0);
          const cred = Number(l.credit || 0);
          const rate = canViewUsd ? Number(l.usd_rate || header.exchange_rate || 1.0) : 0;
          const conv = canViewUsd ? Number(l.usd_amount || (deb ? deb / (rate || 1) : cred / (rate || 1)) || 0) : 0;
          return {
            description: l.description || header.narration || "Cash Entry",
            accountCode: l.account_number || l.ledgers?.code || "-",
            accountName: l.ledgers?.name || l.accounts?.name || "-",
            currency: l.currency || header.countries?.currency_code || branchCurrency || "PKR",
            debit: deb,
            credit: cred,
            exchangeRate: rate,
            convertedAmount: conv
          };
        });

        const totalDebit = financialLines.reduce((s: number, l: any) => s + l.debit, 0);
        const totalCredit = financialLines.reduce((s: number, l: any) => s + l.credit, 0);
        const diff = totalDebit - totalCredit;
        const balDir: "DR" | "CR" | "—" = diff > 0 ? "DR" : diff < 0 ? "CR" : "—";

        openA4ReportWindow({
          title: t(lang, "cef.print_title", "Roznamcha Cash Entry"),
          subtitle: `${res.header.voucher_no || ""} · ${res.header.entry_date || ""}`,
          rows: buildA4RowsForEntry(res),
          cashEntryData: {
            companyName: "DGT LLC",
            voucherNo: header.voucher_no || "-",
            journalNo: header.journal_no || "-",
            entrySerial: counterpartyLine?.entry_serial_number || header.super_admin_serial_number || header.entry_serial_number || "-",
            entryDate: header.entry_date || "-",
            status: header.status || "posted",
            counterpartyName: counterpartyLine?.ledgers?.name || counterpartyLine?.accounts?.name || "-",
            counterpartyCode: counterpartyLine?.ledgers?.code || counterpartyLine?.account_number || "-",
            accountNo: counterpartyLine?.account_number || "-",
            country: header.countries?.name || "-",
            branch: header.city_branches?.name || header.country_branches?.name || "-",
            bankName: cashBankLine?.ledgers?.name || "-",
            paymentMethod: header.payment_method_id || header.source_transaction_type || "Cash",
            financialLines,
            totalDebit,
            totalCredit,
            balanceDirection: balDir,
            finalBalance: Math.abs(diff) || totalDebit || totalCredit,
            currency: financialLines[0]?.currency || header.countries?.currency_code || branchCurrency || "PKR",
            narration: resolveVerifiedTranslation(header.translations?.narration, lang) || translateNarrationBlock(header.narration, lang) || header.narration || "-",
            createdBy: header.profiles?.full_name || header.created_by || "User",
            approvedBy: header.approver_profile?.full_name || header.approved_by || "System",
            showUsdReporting: canViewUsd
          },
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
    setActiveApprover(h.approver_profile?.full_name || row.approver_profile?.full_name || (h.status === "approved" ? tr("cef.approved", "Approved") : tr("cj.pending", "Pending")));
    setActiveStatus(h.status || row.status || "posted");
    
    setMessage(tr("cef.msg_editing_serials", "Editing entry — serials: {serials}").replace("{serials}", [h.super_admin_serial_number || row.super_admin_serial_number, h.country_transaction_serial_number || row.country_transaction_serial_number, h.branch_transaction_serial_number || row.branch_transaction_serial_number].filter(Boolean).join(" / ")));
    
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
        setMessage(tr("cef.msg_delete_failed", "Failed to delete entry: {error}").replace("{error}", errText), true);
        return;
      }
      setMessage(tr("cef.msg_deleted", "Entry deleted successfully."));
      setActiveRowMenuId(null);
      fetchRecentEntries();
      fetchCashSummary();
    } catch (error: any) {
      setMessage(tr("cef.msg_delete_failed", "Failed to delete entry: {error}").replace("{error}", error?.message || tr("cef.msg_unknown_error", "Unknown error")), true);
    }
  };
  async function save() {
    if (savingRef.current) return null;
    savingRef.current = true;
    setMessage(null);
    setLastEntryId(null);

    if (!canSave) {
      if (!countryId || (!countryBranchId && !cityBranchId)) {
        setMessage(tr("cef.msg_need_country_branch", "Please select a Country and Branch before posting."), true);
      } else if (!counterLedgerId && !selectedCrossBranchAccount) {
        setMessage(tr("cef.msg_need_account", "Please select an Account (Step 2)."), true);
      } else if (!paymentType) {
        setMessage(tr("cef.msg_need_txn_type", "Please select a Transaction Type (Customer, Supplier, etc.)."), true);
      } else if (!paymentMode) {
        setMessage(tr("cef.msg_need_payment_mode", "Please select Payment Mode (Debit or Credit)."), true);
      } else if (!amount || amount <= 0) {
        setMessage(tr("cef.msg_need_amount", "Please enter a valid Amount greater than 0."), true);
      } else if ((currency || "").trim().length !== 3) {
        setMessage(tr("cef.msg_need_currency", "Please select a valid 3-letter currency."), true);
      } else if (isRatePending) {
        setMessage(tr("cj.mRatePendingBody", "No approved exchange rate for {cur} on {date}. Country Admin must enter today's rate in Daily Exchange Rate module before financial postings can be saved.").replace("{cur}", String(currency || branchCurrency)).replace("{date}", String(entryDate)), true);
      } else {
        setMessage(tr("cef.msg_need_all", "Please select account, Debit/Credit transaction type, currency, and amount."), true);
      }
      savingRef.current = false;
      return null;
    }


    if (editEntryId) {
      try {
        const delRes = await fetch(`/api/erp/roznamcha/${editEntryId}`, { method: "DELETE" });
        if (!delRes.ok) {
          const errText = await delRes.text();
          setMessage(tr("cef.msg_reverse_failed", "Failed to reverse the old entry: {error}").replace("{error}", errText), true);
          return null;
        }
      } catch (e: any) {
        setMessage(tr("cef.msg_reverse_failed", "Failed to reverse the old entry: {error}").replace("{error}", String(e?.message || "")), true);
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
      
      const isCrossBranch = Boolean(selectedCrossBranchAccount) || Boolean(
        selectedLookupLedger && (
          (selectedLookupLedger.cityBranchId && cityBranchId && selectedLookupLedger.cityBranchId !== cityBranchId) ||
          (selectedLookupLedger.countryBranchId && countryBranchId && selectedLookupLedger.countryBranchId !== countryBranchId)
        )
      );

      let effectivePostingType = postingType || "branch";
      if (!isCrossBranch) {
        if (selectedCounterLedger?.scope === "super_admin") effectivePostingType = "super_admin";
        else if (selectedCounterLedger?.scope === "country") effectivePostingType = "country";
        else if (selectedCounterLedger?.scope === "main_branch" || selectedCounterLedger?.scope === "city_branch" || selectedCounterLedger?.scope === "country_branch" || selectedCounterLedger?.scope === "branch") effectivePostingType = "branch";
      }

      // Preserve Branch A as originating branch (never allow recipient branch to overwrite)
      const effectiveCountryId = countryId || null;
      const effectiveCountryBranchId = countryBranchId || null;
      const effectiveCityBranchId = cityBranchId || null;

      const postingLines: any[] = [
        {
          paymentEntryType: roznamchaBookType === "bank" ? (paymentMode === "DEBIT" ? "bank_cheque" : "bank_deposit") : (paymentMode === "DEBIT" ? "cash_payment" : "cash_receipt"),
          enterpriseAccountId: selectedCrossBranchAccount?.id || selectedCounterLedger?.accountId || null,
          ledgerId: counterLedgerId || "",
          description: finalNarration.trim() ? finalNarration.trim() : undefined,
          debit: paymentMode === "DEBIT" ? amount : 0,
          credit: paymentMode === "CREDIT" ? amount : 0,
          currency: targetAccountCurrency.trim().toUpperCase(),
          exchangeRate: Number(exchangeRate),
          accountNumber: selectedCrossBranchAccount?.accountNumber || selectedCrossBranchAccount?.code || selectedCounterLedger?.accountCode || selectedCounterLedger?.rawAccountCode || null,
          manualReferenceNumber: selectedCounterLedger?.manualReferenceNumber || null,
          customerNumber: selectedCrossBranchAccount?.accountNumber || selectedCounterLedger?.customerNumber || null,
          countrySerialNumber: selectedCounterLedger?.countrySerialNumber || null,
          branchSerialNumber: selectedCounterLedger?.branchSerialNumber || null
        }
      ];

      // If cross-branch payment, or if selectedCashLedger is chosen, include source bank/cash offset
      if (selectedCashLedger?.ledgerId && (isCrossBranch || selectedCashLedger.ledgerId !== counterLedgerId)) {
        const sourceCurrency = (selectedCashLedger.ledgerCurrency || branchCurrency).trim().toUpperCase();
        postingLines.push({
          paymentEntryType: roznamchaBookType === "bank" ? (paymentMode === "DEBIT" ? "bank_payment" : "bank_deposit") : (paymentMode === "DEBIT" ? "cash_payment" : "cash_receipt"),
          enterpriseAccountId: selectedCashLedger.accountId || null,
          ledgerId: selectedCashLedger.ledgerId,
          description: `Offset - Source Cash/Bank (${selectedMainBranch?.name || "Branch A"})`,
          debit: paymentMode === "CREDIT" ? amount : 0,
          credit: paymentMode === "DEBIT" ? amount : 0,
          currency: sourceCurrency,
          exchangeRate: Number(exchangeRate),
          accountNumber: selectedCashLedger.accountCode || selectedCashLedger.rawAccountCode || null,
          manualReferenceNumber: selectedCashLedger.manualReferenceNumber || null,
          customerNumber: selectedCashLedger.customerNumber || null,
          countrySerialNumber: selectedCashLedger.countrySerialNumber || null,
          branchSerialNumber: selectedCashLedger.branchSerialNumber || null
        });
      }

      const payload = {
        mode: "post" as const,
        type: effectivePostingType,
        countryId: effectivePostingType === "super_admin" ? null : effectiveCountryId,
        countryBranchId: (effectivePostingType === "super_admin" || effectivePostingType === "country") ? null : effectiveCountryBranchId,
        cityBranchId: (effectivePostingType === "super_admin" || effectivePostingType === "country") ? null : effectiveCityBranchId,
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
        lines: postingLines
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
      setActiveApprover(res.balanced ? tr("cef.auto_approved", "System / Auto Approved") : tr("cj.pending", "Pending"));
      setActiveStatus("posted");
      const serialText = [res.superAdminSerialNumber, res.countryTransactionSerialNumber, res.branchTransactionSerialNumber, (res as any).mainBranchTransactionSerialNumber, (res as any).cityBranchTransactionSerialNumber, (res as any).entrySerialNumber]
        .filter(Boolean)
        .join(" / ");
      setMessage(tr("cef.msg_saved_serials", "Saved successfully. Serials: {serials}").replace("{serials}", serialText || res.entryId || "—"));
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
      setMessage(e?.message || tr("cef.msg_save_failed", "Save failed"), true);
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
    <div id="erp-page-actions-portal-content" className="flex flex-wrap items-center gap-2">
      <RoznamchaReportsDropdown lang={lang} />
      <CjFiltersButton lang={lang} count={cjActiveFilterCount(journalFilters)} onClick={() => setShowJournalFilters(true)} />
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={tableSearchQuery}
          onChange={(e) => setTableSearchQuery(e.target.value)}
          placeholder={t(lang, "roz.search_entries_placeholder", "Search entries...")}
          aria-label={t(lang, "roz.search_entries_placeholder", "Search entries...")}
          className="h-8 w-[170px] rounded-lg border border-slate-200 bg-white ps-8 pe-2.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 shadow-sm"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold border-slate-250 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 shadow-sm"
        onClick={() => handlePrintRegister(true)}
        data-testid="print-action"
      >
        <Printer className="h-3.5 w-3.5" />
        {t(lang, "common.print", "Print")}
      </Button>
      <CjActionsMenu
        lang={lang}
        items={[
          { key: "pdf", label: t(lang, "urs.a_download_pdf", "Download PDF"), icon: <Download />, onClick: () => handlePrintRegister(false) },
          { key: "refresh", label: t(lang, "common.refresh", "Refresh"), icon: <RefreshCw className={cn(loadingEntries ? "animate-spin" : "")} />, disabled: loadingEntries, onClick: () => { fetchRecentEntries(); fetchCashSummary(); } }
        ]}
      />
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
    </div>
  );


  const viewScopeLabel =
    effectiveScopeMode === "super_admin" ? tr("cj.roleSuperAdmin", "Super Admin") : effectiveScopeMode === "country" ? translateHeader(lang, "Country") : translateHeader(lang, "City");
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

  // Authoritative daily rate is managed by fetchDailyRate() via /api/erp/currency/daily-rate
  useEffect(() => {
    if (!normalizedCurrency || !allowedCurrencies.has(normalizedCurrency)) return;
    if (!countryId) return;
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
    <div className="dgt-cj mx-auto w-full bg-[#f8fbff] dark:bg-slate-950/40 text-slate-950 dark:text-slate-50 min-h-screen">
      {portalNode ? createPortal(actionButtons, portalNode) : null}
      <CjFiltersDialog
        lang={lang}
        open={showJournalFilters}
        onClose={() => setShowJournalFilters(false)}
        value={journalFilters}
        onApply={setJournalFilters}
        currencies={journalFilterChoices.currencies}
        branches={journalFilterChoices.branches}
      />

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


      {/* ============================================================
          APPROVED ROZNAMCHA HEADER BAR & 4 SUMMARY CARDS
      ============================================================ */}
      <div className="mx-4 mt-2 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {/* Left: Brand Icon + Title & Subtitle */}
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              {tr("cj.roznamchaHeading", "Roznamcha")}
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tr("cj.dailyFinancialRecords", "Daily Financial Records")}
            </p>
          </div>
        </div>

        {/* Right: Date Selector, Serial Info, Country Filter, Branch Filter, Refresh, + New Entry */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Date Picker Box */}
          <label className="relative inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-bold text-slate-800 hover:bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer transition">
            <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span>{formatDisplayDateWithDay(tableDateMode === "day" ? (tableDate || entryDate) : entryDate)}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={tableDateMode === "day" ? (tableDate || entryDate) : entryDate}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setTableDateMode("day");
                  setTableDate(val);
                  setEntryDate(val);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label={t(lang, "common.date", "Date")}
            />
          </label>

          {/* 2. Serial Info Button */}
          <button
            type="button"
            onClick={() => setShowSerialsDropdown((prev) => !prev)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition cursor-pointer",
              showSerialsDropdown
                ? "border-blue-400 bg-blue-100 text-blue-800 dark:border-blue-600 dark:bg-blue-900/60 dark:text-blue-200"
                : "border-blue-200 bg-blue-50/80 text-blue-700 hover:bg-blue-100/80 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
            )}
          >
            <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>{tr("cj.serialInfoBtn", "Serial Info")}</span>
          </button>

          {/* 3. Country Filter Dropdown */}
          <div className="relative inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Globe className="h-3.5 w-3.5 text-slate-500 me-1.5 shrink-0" />
            <select
              value={isSuperAdmin ? topCountryFilter : countryId}
              disabled={loadingCountries || (!isSuperAdmin && effectiveScopeMode !== "super_admin")}
              onChange={(e) => {
                const val = e.target.value;
                if (isSuperAdmin) {
                  setTopCountryFilter(val);
                  setTopBranchFilter("all");
                  if (val !== "all") {
                    setCountryId(val);
                    const cObj = countries.find((c) => c.id === val);
                    setCashPositionCountryFilter((cObj as any)?.iso2 || val);
                  } else {
                    setCashPositionCountryFilter("all");
                  }
                } else {
                  setCountryId(val);
                }
              }}
              className="bg-transparent pr-5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none appearance-none cursor-pointer"
            >
              {isSuperAdmin && (
                <option value="all" className="text-slate-900">
                  {t(lang, "roz.all_countries", "All Countries")}
                </option>
              )}
              {countries.map((c) => (
                <option key={c.id} value={c.id} className="text-slate-900">
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* 4. Branch Filter Dropdown */}
          <div className="relative inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Building2 className="h-3.5 w-3.5 text-slate-500 me-1.5 shrink-0" />
            <select
              value={(isSuperAdmin || isCountryAdmin) ? topBranchFilter : cityBranchId}
              onChange={(e) => {
                const val = e.target.value;
                if (isSuperAdmin || isCountryAdmin) {
                  setTopBranchFilter(val);
                  if (val !== "all") {
                    const matched = allFilterBranches.find((b) => b.id === val);
                    if (matched?.countryId && matched.countryId !== countryId) {
                      setCountryId(matched.countryId);
                    }
                    setCityBranchId(val);
                  }
                } else {
                  setCityBranchId(val);
                }
              }}
              className="bg-transparent pr-5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none appearance-none cursor-pointer max-w-[170px] truncate"
            >
              {(isSuperAdmin || isCountryAdmin) && (
                <option value="all" className="text-slate-900">
                  {tr("cj.fAllBranches", "All Branches")}
                </option>
              )}
              {allFilterBranches.map((b) => (
                <option key={b.id} value={b.id} className="text-slate-900">
                  {b.name} {b.code ? `(${b.code})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* 5. Refresh Button */}
          <button
            type="button"
            onClick={() => {
              fetchRecentEntries();
              fetchCashSummary();
              fetchSummaryOverview();
              fetchDailyRate();
              fetchAllDailyExchangeRates();
            }}
            title={t(lang, "common.refresh", "Refresh")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
          >
            <RefreshCw className={cn("h-4 w-4", (loadingEntries || loadingOverview || loadingExchangeModule) ? "animate-spin text-blue-600" : "")} />
          </button>

          {/* 6. + New Entry Button */}
          <Button
            type="button"
            onClick={() => {
              resetPaymentDraft();
              setEditEntryId(null);
              setShowPaymentWorkReport(true);
            }}
            className="h-9 gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t(lang, "roz.new_entry", "New Entry")}</span>
          </Button>
        </div>
      </div>

      {/* ============================================================
          4 TOP SUMMARY CARDS (APPROVED DESIGN)
          1. Super Admin – USD Position (Total Credit, Debit, Balance in one USD card)
          2. Country Position (Own Currency) (Per-country figures without extra combined total)
          3. Serial & Date Information (Highlighted Current Branch Entry Serial)
          4. Exchange Rate (USD Base) (Connected to Daily Exchange Rate module)
      ============================================================ */}
      {showFormSection && (
        <div className="mx-4 mb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">

          {/* ════════ CARD 1: SUPER ADMIN – USD POSITION ════════ */}
          <div className="flex flex-col justify-between rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/40 via-white to-white p-4 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
            <div className="flex items-center gap-3 mb-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100/90 text-blue-600 font-black text-lg shrink-0 dark:bg-blue-950 dark:text-blue-400">
                $
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {canViewUsd
                    ? tr("cj.superAdminUsdPosition", "Super Admin – USD Position")
                    : `${userRoleLabel} – ${branchCurrency} Position`}
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {isSuperAdmin && topCountryFilter === "all"
                    ? tr("cj.allCountries", "All Countries")
                    : (countries.find((c) => c.id === (isSuperAdmin ? topCountryFilter : countryId))?.name || selectedCountry?.name || tr("cj.allCountries", "All Countries"))}
                  {" | "}
                  {(isSuperAdmin || isCountryAdmin) && topBranchFilter === "all"
                    ? tr("cj.fAllBranches", "All Branches")
                    : (allFilterBranches.find((b) => b.id === topBranchFilter)?.name || selectedCityBranch?.name || selectedMainBranch?.name || tr("cj.fAllBranches", "All Branches"))}
                </p>
              </div>
            </div>

            {/* 3 Vertical Inner Boxes: Total Credit | Total Debit | Net Balance */}
            <div className="grid grid-cols-3 gap-2.5 flex-1 items-stretch">
              {/* Total Credit */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50/60 px-2 py-3.5 text-center dark:border-emerald-900/50 dark:bg-emerald-950/25">
                <span className="mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400">
                  <ArrowUp className="h-3.5 w-3.5 stroke-[2.5]" />
                </span>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {tr("cj.totalCredit", "Total Credit")}
                </span>
                <span className="mt-1 font-mono text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tight" dir="ltr">
                  {fmtAmount(canViewUsd ? usdCardPosition.credit : recentEntriesSummary.totalCredit)}
                </span>
                <span className="mt-0.5 text-[10px] font-bold uppercase text-slate-400">
                  {canViewUsd ? "USD" : branchCurrency}
                </span>
              </div>

              {/* Total Debit */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-rose-100 bg-rose-50/60 px-2 py-3.5 text-center dark:border-rose-900/50 dark:bg-rose-950/25">
                <span className="mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100/80 text-rose-600 dark:bg-rose-900/60 dark:text-rose-400">
                  <ArrowDown className="h-3.5 w-3.5 stroke-[2.5]" />
                </span>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {tr("cj.totalDebit", "Total Debit")}
                </span>
                <span className="mt-1 font-mono text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 tracking-tight" dir="ltr">
                  {fmtAmount(canViewUsd ? usdCardPosition.debit : recentEntriesSummary.totalDebit)}
                </span>
                <span className="mt-0.5 text-[10px] font-bold uppercase text-slate-400">
                  {canViewUsd ? "USD" : branchCurrency}
                </span>
              </div>

              {/* Net Balance */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-blue-100 bg-blue-50/60 px-2 py-3.5 text-center dark:border-blue-900/50 dark:bg-blue-950/25">
                <span className="mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/80 text-blue-600 dark:bg-blue-900/60 dark:text-blue-400">
                  <Equal className="h-3.5 w-3.5 stroke-[2.5]" />
                </span>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {tr("cj.colNetBalance", "Net Balance")}
                </span>
                <span className="mt-1 font-mono text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 tracking-tight" dir="ltr">
                  {fmtAmount(canViewUsd ? usdCardPosition.balance : (recentEntriesSummary.totalCredit - recentEntriesSummary.totalDebit))}
                </span>
                <span className="mt-0.5 text-[10px] font-bold uppercase text-slate-400">
                  {canViewUsd ? "USD" : branchCurrency}
                </span>
              </div>
            </div>
          </div>

          {/* ════════ CARD 2: COUNTRY POSITION (OWN CURRENCY) ════════ */}
          <div className="flex flex-col justify-between rounded-2xl border border-purple-100 bg-gradient-to-b from-purple-50/35 via-white to-white p-4 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100/90 text-purple-600 shrink-0 dark:bg-purple-950 dark:text-purple-400">
                  <Globe2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {tr("cj.countryPositionOwnCurr", "Country Position (Own Currency)")}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {tr("cj.creditDebitBalancePerCountry", "Credit / Debit / Balance per Country")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const firstWithBranch = countryPositionRows.find((c) => c.branches && c.branches.length > 0);
                  if (firstWithBranch?.branches?.[0]) {
                    const b = firstWithBranch.branches[0];
                    setDrilldownBranch({
                      branchName: `${firstWithBranch.countryName} - ${b.branchName}`,
                      branchCode: b.branchCode,
                      currency: firstWithBranch.currencyCode,
                      totalCredit: b.totalCredit,
                      totalDebit: b.totalDebit,
                      balance: b.balance,
                      balanceType: b.balanceType,
                      entryCount: b.entryCount,
                      transactions: (b as any).transactions || [],
                    });
                  }
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-purple-600 dark:border-slate-700 dark:bg-slate-800 cursor-pointer shrink-0"
                title={tr("cj.viewTxTip", "Click to view transactions")}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Clean Per-Country Table (Own Currency Only — No Extra Combined Total) */}
            <div className="flex-1 overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[10.5px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60">
                    <th className="py-2 px-2.5">{tr("cj.colCountry", "Country")}</th>
                    <th className="py-2 px-2">{tr("cj.fCurrency", "Currency")}</th>
                    <th className="py-2 px-2 text-right">{tr("cj.colCredit", "Credit")}</th>
                    <th className="py-2 px-2 text-right">{tr("cj.colDebit", "Debit")}</th>
                    <th className="py-2 px-2.5 text-right">{tr("cj.balanceCol", "Balance")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {countryPositionRows.length > 0 ? (
                    countryPositionRows.map((pos) => {
                      const netVal = pos.totalCredit - pos.totalDebit;
                      return (
                        <tr
                          key={pos.countryId}
                          onClick={() => {
                            if (pos.branches?.[0]) {
                              setDrilldownBranch({
                                branchName: `${pos.countryName} - ${pos.branches[0].branchName}`,
                                branchCode: pos.branches[0].branchCode,
                                currency: pos.currencyCode,
                                totalCredit: pos.branches[0].totalCredit,
                                totalDebit: pos.branches[0].totalDebit,
                                balance: pos.branches[0].balance,
                                balanceType: pos.branches[0].balanceType,
                                entryCount: pos.branches[0].entryCount,
                                transactions: (pos.branches[0] as any).transactions || [],
                              });
                            }
                          }}
                          className="hover:bg-purple-50/40 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                          title={tr("cj.viewTxTip", "Click to view transactions")}
                        >
                          <td className="py-2 px-2.5 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <span>{getCountryFlag(pos.countryName || pos.iso2)}</span>
                              <span>{pos.iso2 === "AE" ? "UAE" : localizeCountryName(pos.countryName, lang)}</span>
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {pos.currencyCode}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                            {fmtAmount(pos.totalCredit)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400" dir="ltr">
                            {fmtAmount(pos.totalDebit)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400" dir="ltr">
                            {fmtAmount(netVal)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                        {tr("cj.noBranchEntries", "No country entries found for selected date.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ════════ CARD 3: SERIAL & DATE INFORMATION ════════ */}
          <div className="flex flex-col justify-between rounded-2xl border border-orange-200/80 bg-gradient-to-b from-orange-50/45 via-white to-white p-4 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-xs shrink-0">
                  <Hash className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {tr("cj.serialDateInfoTitle", "Serial & Date Information")}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {tr("cj.currentRunningNumbers", "Current Running Numbers")}
                  </p>
                </div>
              </div>

              {/* Highlighted Current Branch Entry Serial Box */}
              <div className="rounded-xl border border-orange-200/90 bg-orange-50/70 p-2.5 mb-3 dark:border-orange-900/50 dark:bg-orange-950/25">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-orange-500 text-white text-[9px] font-black">
                      #
                    </span>
                    <span>{tr("cj.currentBranchEntrySerial", "Current Branch Entry Serial")}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSerialsDropdown((prev) => !prev)}
                    className="text-slate-400 hover:text-orange-600 cursor-pointer"
                    title={tr("cj.viewSerials", "View Serials")}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0">
                      <Building2 className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {selectedCityBranch?.name || selectedMainBranch?.name || "Dubai Main"} ({selectedCountry?.iso2 || activeCountryIso})
                    </span>
                  </div>
                  <span
                    className="inline-flex items-center rounded-lg bg-orange-200/85 border border-orange-300 px-2.5 py-1 font-mono text-xs font-black text-orange-950 dark:bg-orange-900/70 dark:border-orange-700 dark:text-orange-100 shrink-0 shadow-2xs"
                    dir="ltr"
                  >
                    {(savedSerials as any)?.entrySerial || liveSerials.entrySerial}
                  </span>
                </div>
              </div>

              {/* 3 Running Serial Rows */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300">
                    <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>{tr("cj.superAdminSerialLabel", "Super Admin Serial")}</span>
                  </span>
                  <span className="rounded-md border border-blue-200 bg-blue-50/80 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300" dir="ltr">
                    {savedSerials?.superAdmin || liveSerials.superAdmin}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300 truncate">
                    <Globe className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">
                      {tr("cj.countrySerialLabel", "Country Serial")} ({selectedCountry?.iso2 || activeCountryIso})
                    </span>
                  </span>
                  <span className="rounded-md border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 shrink-0" dir="ltr">
                    {savedSerials?.country || liveSerials.country}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300 truncate">
                    <Building2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">
                      {tr("cj.branchSerialLabel", "Branch Serial")} ({selectedCityBranch?.name || selectedMainBranch?.name || "Main"})
                    </span>
                  </span>
                  <span className="rounded-md border border-indigo-200 bg-indigo-50/80 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 shrink-0" dir="ltr">
                    {(savedSerials as any)?.cityBranch || savedSerials?.branch || liveSerials.cityBranch || liveSerials.branch}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer: Selected Date */}
            <div className="mt-3 flex items-center justify-between border-t border-orange-200/60 pt-2.5 text-xs dark:border-slate-800">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>{tr("cj.selectedDate", "Selected Date")}</span>
              </span>
              <label className="relative inline-flex items-center gap-1 font-extrabold text-slate-900 dark:text-white cursor-pointer hover:text-blue-600">
                <span>{formatDisplayDateShort(tableDateMode === "day" ? (tableDate || entryDate) : entryDate)}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="date"
                  value={tableDateMode === "day" ? (tableDate || entryDate) : entryDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setTableDateMode("day");
                      setTableDate(val);
                      setEntryDate(val);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
            </div>
          </div>

          {/* ════════ CARD 4: EXCHANGE RATE (USD BASE) — CONNECTED TO DAILY EXCHANGE MODULE ════════ */}
          <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/40 via-white to-white p-4 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100/90 text-emerald-600 shrink-0 dark:bg-emerald-950 dark:text-emerald-400">
                    <ArrowLeftRight className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                      {tr("cj.exchangeRateUsdBase", "Exchange Rate (USD Base)")}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      {tr("cj.activeCountriesFromDailyExchange", "Active Countries (From Daily Exchange)")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/reports/exchange-rate" as any)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 cursor-pointer shrink-0"
                  title={tr("cj.viewAllExchangeRates", "View All Exchange Rates")}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Search Country or Currency */}
              <div className="relative mb-2.5">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={exchangeRateSearchQuery}
                  onChange={(e) => setExchangeRateSearchQuery(e.target.value)}
                  placeholder={tr("cj.searchCountryOrCurrency", "Search Country or currency...")}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Active Country Rates List from Daily Exchange Rate Module */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[148px] overflow-y-auto pr-0.5">
                {activeExchangeRatesList.length > 0 ? (
                  activeExchangeRatesList.map((item) => (
                    <div
                      key={item.countryId}
                      onClick={() => {
                        setCountryId(item.countryId);
                        if (isSuperAdmin) setTopCountryFilter(item.countryId);
                      }}
                      className="flex items-center justify-between py-1.5 px-1 hover:bg-emerald-50/40 dark:hover:bg-slate-800/40 rounded-md cursor-pointer transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">{getCountryFlag(item.countryName || item.iso2)}</span>
                        <span className="font-extrabold text-slate-900 dark:text-white w-9 shrink-0">
                          {item.currencyCode}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                          {item.currencyFullName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-black text-slate-900 dark:text-white" dir="ltr">
                          {item.rate != null && item.rate > 0 ? Number(item.rate).toFixed(4) : "—"}
                        </span>
                        <TrendingUp className={cn("h-3.5 w-3.5", item.rate != null && item.rate > 0 ? "text-emerald-600" : "text-amber-500")} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400">
                    {tr("cj.noMatchingRates", "No matching currencies found.")}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Link to Daily Exchange Rate Module */}
            <button
              type="button"
              onClick={() => router.push("/dashboard/reports/exchange-rate" as any)}
              className="mt-2.5 flex w-full items-center justify-between border-t border-emerald-100 pt-2.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:border-slate-800 dark:text-blue-400 cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                <span>{tr("cj.viewAllExchangeRates", "View All Exchange Rates")}</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
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
            messageIsError
              ? "border-rose-200 bg-rose-50 text-rose-900 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-400"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400"
          )}>
            <CheckCircle className={cn(
              "h-4 w-4",
              messageIsError ? "text-rose-600 hidden" : "text-emerald-600"
            )} />
            <span>{message}</span>
          </div>
        ) : null}





        {/* ── NEW CASH ENTRY MODAL (MATCHING REFERENCE DESIGN IMAGE 2) ── */}
        {showPaymentWorkReport && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 overflow-y-auto backdrop-blur-xs font-sans">
            <div className="dgt-cj-modal relative w-full max-w-[1220px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl my-auto flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden" role="dialog" aria-modal="true">
              
              {/* ── MODAL HEADER ── */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 bg-white dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs shrink-0">
                    <Banknote className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                      {tr("cj.mTitle", "New Cash Entry")}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {tr("cj.mSubtitle", "Record cash transaction in Roznamcha")}
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
                  aria-label={tr("cj.close", "Close")}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* ── MODAL BODY (TWO COLUMNS: LEFT 7 COLS, RIGHT 5 COLS) ── */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {message ? (
                  <div
                    className={cn(
                      "rounded-xl border p-3 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs",
                      messageIsError
                        ? "border-rose-200 bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {messageIsError ? (
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      ) : (
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>{message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMessage(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

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
                              {tr("cj.mStep1", "Entry Scope & Branch")}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {tr("cj.mStep1Sub", "Select the operating branch for this entry")}
                            </p>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase">
                          <Building2 className="h-3 w-3" />
                          <span>
                            {selectedCountry ? `${selectedCountry.name.toUpperCase()} - ${selectedCityBranch?.name?.toUpperCase() || selectedMainBranch?.name?.toUpperCase() || tr("cj.mSelectBranchU", "SELECT BRANCH")}` : tr("cj.mSelectCountryBranchU", "SELECT COUNTRY & BRANCH")}
                          </span>
                          {isCountryAdmin && (
                            <span className="inline-flex items-center gap-0.5 bg-amber-500 text-white rounded px-1.5 py-0.5 text-[8px] font-black tracking-wider">
                              <Lock className="h-2 w-2" />
                              {tr("cj.mLockedU", "LOCKED")}
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "common.country", "Country")}</Label>
                            {isCountryAdmin && (
                              <span className="text-[8px] font-black text-amber-700 dark:text-amber-400 flex items-center gap-0.5">
                                <Lock className="h-2 w-2" />
                                {tr("cj.mLocked", "Locked")}
                              </span>
                            )}
                          </div>
                          <select
                            value={countryId}
                            disabled={loadingCountries || isCountryAdmin || (!isSuperAdmin && effectiveScopeMode !== "super_admin")}
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
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "roz.branch_name", "Main Branch")}</Label>
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black shrink-0">
                            2
                          </span>
                          <div>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              {tr("cef.step2_title", "Search & Select Account")}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {tr("cef.step2_subtitle", "Choose recipient customer or account for payment posting")}
                            </p>
                          </div>
                        </div>

                        {/* Search Mode Toggle */}
                        {canCrossBranchLookup && (
                          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                setAccountSearchMode("same_branch");
                                clearSelectedAccount();
                              }}
                              className={cn(
                                "px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1",
                                accountSearchMode === "same_branch"
                                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs font-black"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                              )}
                            >
                              <Building2 className="h-3 w-3" />
                              <span>{tr("cef.same_branch_accounts", "Same Branch")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAccountSearchMode("cross_branch");
                                clearSelectedAccount();
                              }}
                              className={cn(
                                "px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5",
                                accountSearchMode === "cross_branch"
                                  ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-black"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                              )}
                            >
                              <Globe className="h-3 w-3" />
                              <span>{tr("cef.cross_branch_recipient", "Cross-Branch Recipient")}</span>
                              <span className="text-[8px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1 rounded font-black">
                                {tr("cef.same_country_badge", "Same Country")}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>

                      {accountSearchMode === "same_branch" ? (
                        <SearchSelect
                          label=""
                          value={counterLedgerId}
                          placeholder={t(lang, "cef.search_account_ph", "Search account code or name...")}
                          options={accountOptions}
                          disabled={loadingLedgers}
                          onValueChange={handleCounterLedgerChange}
                          onSearchValueChange={setAccountNoInput}
                        />
                      ) : (
                        /* Restricted Cross-Branch Recipient Lookup */
                        <div className="relative space-y-1.5">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              value={crossBranchQuery}
                              onChange={(e) => {
                                setCrossBranchQuery(e.target.value);
                                setCrossBranchDropdownOpen(true);
                              }}
                              onFocus={() => {
                                if (crossBranchResults.length > 0) setCrossBranchDropdownOpen(true);
                              }}
                              placeholder={tr("cef.cross_branch_search_ph", "Search recipient by account number or customer name in other branches...")}
                              className="h-10 pl-9 pr-8 text-xs font-semibold bg-white dark:bg-slate-950 border-indigo-200 dark:border-indigo-800 focus:border-indigo-500"
                            />
                            {loadingCrossBranch && (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold px-1">
                            <ShieldCheck className="h-3 w-3 text-indigo-600 shrink-0" />
                            <span>{tr("cef.restricted_lookup_hint", "Restricted Lookup: Displays only account number, customer name and branch. Ledger balances and history remain isolated.")}</span>
                          </div>

                          {crossBranchDropdownOpen && crossBranchResults.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1 space-y-1">
                              {crossBranchResults.map((acc) => (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => handleSelectCrossBranchAccount(acc)}
                                  className="w-full text-left p-2.5 rounded-lg hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-transparent hover:border-indigo-100 transition cursor-pointer flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-400">
                                        {acc.accountNumber || acc.code}
                                      </span>
                                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                        {acc.name || acc.customerName}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                      <span>🏢 {acc.owningBranchName} ({acc.owningBranchCode})</span>
                                      {acc.cityName && <span>• {acc.cityName}</span>}
                                      {acc.currency && <span className="font-mono font-bold">• {acc.currency}</span>}
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200">
                                    {tr("cef.select_recipient", "Select Recipient")}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {crossBranchDropdownOpen && !loadingCrossBranch && crossBranchQuery.trim().length >= 2 && crossBranchResults.length === 0 && (
                            <div className="p-3 text-center text-xs text-slate-500 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                              {tr("cef.no_cross_branch_account", "No recipient accounts found in other branches matching your search.")}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Recipient Confirmation Card */}
                      {(selectedCounterLedger || selectedCrossBranchAccount) && (
                        <div className={cn(
                          "p-3 rounded-xl border text-xs shadow-2xs space-y-2 transition-all",
                          selectedCrossBranchAccount
                            ? "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800"
                            : "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                        )}>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CheckCircle className={cn(
                                "h-4 w-4 shrink-0",
                                selectedCrossBranchAccount ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-400"
                              )} />
                              <span className={cn(
                                "font-extrabold uppercase text-[10px] tracking-wide",
                                selectedCrossBranchAccount ? "text-indigo-900 dark:text-indigo-200" : "text-emerald-900 dark:text-emerald-200"
                              )}>
                                {selectedCrossBranchAccount ? tr("cef.cross_branch_confirmed", "Cross-Branch Recipient Confirmed") : tr("cef.account_selected", "Account Selected")}
                              </span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {selectedCrossBranchAccount?.accountNumber || selectedCrossBranchAccount?.code || selectedCounterLedger?.accountCode || selectedCounterLedger?.ledgerCode}
                              </span>
                              <span className="font-black text-slate-950 dark:text-white">
                                {selectedCrossBranchAccount?.name || selectedCrossBranchAccount?.customerName || selectedCounterLedger?.accountName || selectedCounterLedger?.ledgerName}
                              </span>
                            </div>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-black border",
                              selectedCrossBranchAccount
                                ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700"
                                : "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                            )}>
                              {selectedCrossBranchAccount ? tr("cef.cross_branch_badge", "Cross-Branch Authorized") : tr("cef.verified_badge", "Verified ✓")}
                            </span>
                          </div>

                          {/* Recipient Details & Owning Branch Confirmation */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
                            <div>
                              <span className="text-slate-500 font-semibold">{tr("cef.owning_branch", "Recipient Owning Branch")}: </span>
                              <strong className="text-slate-900 dark:text-slate-150">
                                {selectedCrossBranchAccount ? `${selectedCrossBranchAccount.owningBranchName} (${selectedCrossBranchAccount.owningBranchCode})` : (selectedCounterLedger?.cityBranchName || selectedCounterLedger?.countryBranchName || selectedMainBranch?.name || "Same Branch")}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 font-semibold">{tr("cef.originating_branch", "Originating Paying Branch")}: </span>
                              <strong className="text-slate-900 dark:text-slate-150">
                                {selectedCityBranch?.name || selectedMainBranch?.name || "Active Branch"} ({selectedMainBranch?.code || "MB"})
                              </strong>
                            </div>
                          </div>

                          {selectedCrossBranchAccount && (
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/50 dark:bg-indigo-900/30 p-2 rounded-lg">
                              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                              <span>{tr("cef.isolated_ledger_notice", "Confidential Isolation Active: Recipient ledger records and balances remain restricted. Payment will post with inter-branch settlement audit trail.")}</span>
                            </div>
                          )}
                        </div>
                      )}
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
                              {tr("cj.mStep3", "Roznamcha Details")}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {tr("cj.mStep3Sub", "Transaction type, category and reference information")}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] font-black text-slate-500 uppercase">
                            {tr("cj.mDailyDate", "Daily Payment Date")} <span className="text-red-500">*</span>
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
                            {tr("cj.mRozType", "Roznamcha Type")} <span className="text-red-500">*</span>
                          </Label>
                          <select
                            value={roznamchaType}
                            onChange={(e) => setRoznamchaType(e.target.value)}
                            className="h-8.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
                          >
                            <option value="Cash Book No.">{tr("cj.mOptCashBook", "Cash Book No.")}</option>
                            <option value="Roznamcha Book No.">{tr("cj.mOptRozBook", "Roznamcha Book No.")}</option>
                            <option value="Receipt No.">{tr("cj.mOptReceiptNo", "Receipt No.")}</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">
                            {tr("cj.mRozNumber", "Roznamcha Number")} <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={roznamchaNumber}
                            onChange={(e) => setRoznamchaNumber(e.target.value)}
                            placeholder={tr("cj.mRozNumberPh", "Number")}
                            className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">
                            {tr("cj.mRozCategory", "Roznamcha Category")} <span className="text-red-500">*</span>
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
                            {tr("cj.mCurrencyType", "Currency Type")} <span className="text-red-500">*</span>
                          </Label>
                          <select
                            value={currency || branchCurrency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="h-8.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
                          >
                            {canViewUsd && <option value="USD">USD</option>}
                            <option value="PKR">PKR</option>
                            <option value="AED">AED</option>
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
                              ? tr("cj.mBankDetails", "Bank Details")
                              : paymentType === "business" || paymentType === "invoice"
                              ? tr("cj.mBusinessDetails", "Business / Invoice Details")
                              : paymentType === "transfer"
                              ? tr("cj.mTransferDetails", "Transfer Details")
                              : tr("cj.mCashDetails", "Cash Details")}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {paymentType === "bank"
                              ? tr("cj.mBankSub", "Bank account, method and reference for {c} banking").replace("{c}", activeCountryIso || tr("cj.mLocal", "local"))
                              : paymentType === "transfer"
                              ? "Compact three-field layout · Add new names inside dropdowns"
                              : tr("cj.mCashSub", "Receiver / Sender identification and contact information")}
                          </p>
                        </div>
                      </div>

                      {paymentType === "bank" ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <BankPicker
                                label={`${tr("cj.mBank", "Bank")} (${activeCountryIso || tr("cj.mBank", "Bank")})`}
                                value={typeDetails.bankId || ""}
                                countryId={selectedCountry?.id || session?.scopes?.countryIds?.[0] || undefined}
                                onValueChange={async (bankId) => {
                                  if (!bankId) {
                                    setTypeDetails((p) => ({ ...p, bankId: "", bankName: "", bankAccount: "" }));
                                    setSelectedBankRecord(null);
                                    return;
                                  }
                                  try {
                                    const b = await getBankById(bankId);
                                    setSelectedBankRecord(b || null);
                                    setTypeDetails((p) => ({
                                      ...p,
                                      bankId,
                                      bankName: b?.bank_name || p.bankName || "",
                                      bankAccount: b?.account_number || b?.iban_number || p.bankAccount || ""
                                    }));
                                  } catch (e) {
                                    setTypeDetails((p) => ({ ...p, bankId }));
                                  }
                                }}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">{t(lang, "cef.transfer_method", "Transfer Mode")}</Label>
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
                                <option value="IBFT">IBFT</option>
                                <option value="Other">{tr("cj.mOther", "Other")}</option>
                              </select>
                            </div>
                          </div>

                          {/* Bank Master Coordinate Information (Replaces manual IBAN/Account field) */}
                          {selectedBankRecord ? (
                            <div className="p-3 rounded-xl border border-blue-200/80 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20 text-xs">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
                                  <span>{selectedBankRecord.bank_name}</span>
                                  {selectedBankRecord.branch_name && (
                                    <span className="text-[11px] font-normal text-slate-500">({selectedBankRecord.branch_name})</span>
                                  )}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                                  {tr("cj.mBankVerified", "Bank Master Verified ✓")}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-slate-400 block">{tr("cj.mAccountTitle", "Account Title")}</span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                    {selectedBankRecord.account_title || "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-slate-400 block">{tr("cj.mAccountNumber", "Account Number")}</span>
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                                    {selectedBankRecord.account_number || "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-slate-400 block">{tr("cj.mIban", "IBAN Number")}</span>
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block" title={selectedBankRecord.iban_number || ""}>
                                    {selectedBankRecord.iban_number || "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-slate-400 block">{tr("cj.mCurrency", "Currency")}</span>
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
                                    {selectedBankRecord.currency || currency || "AED"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 text-center">
                              {tr("cj.mBankHint", "Select a bank above to automatically load account title, account number, and IBAN from Bank Master.")}
                            </div>
                          )}

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
                                <span>{attachmentFile ? attachmentFile.name.slice(0, 16) : tr("cj.mUploadSlip", "Upload Deposit / Cheque Slip")}</span>
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
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{tr("cj.mInvoiceNumber", "Invoice / Bill Number")}</Label>
                            <Input
                              value={typeDetails.invoiceNumber || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, invoiceNumber: e.target.value }))}
                              placeholder={tr("cj.mInvoicePh", "Invoice number")}
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
                        <TransferDetailsSection
                          bankName={typeDetails.bankName || ""}
                          onBankNameChange={(name) => setTypeDetails((p) => ({ ...p, bankName: name }))}
                          transferMode={typeDetails.method || typeDetails.transferType || "Bank Transfer"}
                          onTransferModeChange={(mode) => setTypeDetails((p) => ({ ...p, method: mode, transferType: mode }))}
                          transactionReference={typeDetails.transferReferenceNumber || typeDetails.refNo || typeDetails.ref || ""}
                          onTransactionReferenceChange={(ref) => setTypeDetails((p) => ({ ...p, transferReferenceNumber: ref, refNo: ref, ref }))}
                          attachmentFile={attachmentFile}
                          onAttachmentChange={(file) => setAttachmentFile(file)}
                          extraBanks={availableRoznamchaBanks}
                          showAttachment={true}
                          lang={lang}
                        />
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
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{tr("cj.mMobile", "Mobile Number")}</Label>
                            <Input
                              value={typeDetails.mobileNumber || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, mobileNumber: e.target.value }))}
                              placeholder={tr("cj.mMobilePh", "Mobile number")}
                              className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                              dir="ltr"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{tr("cj.mWhatsapp", "WhatsApp Number")}</Label>
                            <Input
                              value={typeDetails.whatsappNumber || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, whatsappNumber: e.target.value }))}
                              placeholder={tr("cj.mWhatsappPh", "WhatsApp number")}
                              className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                              dir="ltr"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">{tr("cj.mIdCard", "ID Card Copy Upload")}</Label>
                            <label className="flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold cursor-pointer transition">
                              <Paperclip className="h-3.5 w-3.5" />
                              <span>{attachmentFile ? attachmentFile.name.slice(0, 12) : tr("cj.mAttach", "Attach File")}</span>
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
                            {tr("cj.mStep5", "Transaction Conversion (Local Calculation)")}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {tr("cj.mStep5Sub", "Enter amount and conversion rate")} (1 {currency || "—"} = {exchangeRate || "—"})
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className={cn("space-y-1", isLocalCurrency ? "sm:col-span-6" : "sm:col-span-3")}>
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">
                            {isLocalCurrency ? tr("cj.mAmount", "Amount") : tr("cj.mQuantity", "Quantity (Foreign Amount)")} <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={calcAmount}
                            onChange={(e) => setCalcAmount(e.target.value)}
                            placeholder="0.00"
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
                                {tr("cj.mRate", "Transaction Rate")} ({branchCurrency || "—"}) <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                value={exchangeRate}
                                onChange={(e) => setExchangeRate(e.target.value)}
                                placeholder="0.0000"
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
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">{tr("cj.mOperation", "Operation")}</Label>
                              <select
                                value={calcOp}
                                onChange={(e) => setCalcOp(e.target.value as any)}
                                className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs font-bold outline-none"
                              >
                                <option value="mul">{tr("cj.mMultiply", "Multiply (x)")}</option>
                                <option value="div">{tr("cj.mDivide", "Divide (/)")}</option>
                              </select>
                            </div>
                          </>
                        )}

                        <div className={cn(isLocalCurrency ? "sm:col-span-6" : "sm:col-span-3")}>
                          <div className="p-2 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-right">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                              {isLocalCurrency ? tr("cj.mFinalAmount", "Final Amount") : tr("cj.mConverted", "Converted Amount")}
                            </span>
                            <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                              {calcFinal !== null ? fmtAmount(calcFinal) : (finalPayment ? fmtAmount(Number(finalPayment)) : fmtAmount(0))} {branchCurrency || "AED"}
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
                            {tr("cj.mStep6", "Debit / Credit Entry")}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {tr("cj.mStep6Sub", "Select transaction nature and confirm amount")}
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
                              if (normalizedCurrency !== "USD") {
                                const targetRate = dailyRate?.debitRate ?? dailyRate?.buyingRate;
                                if (targetRate && Number(targetRate) > 0) {
                                  setExchangeRate(String(targetRate));
                                } else {
                                  setExchangeRate("");
                                }
                              }
                            }}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer",
                              paymentMode === "DEBIT" || !paymentMode
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                            <span>{tr("cj.mDebitBtn", "Debit (Money Paid)")}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMode("CREDIT");
                              setRoznamchaBookType("branch_payment_voucher");
                              if (normalizedCurrency !== "USD") {
                                const targetRate = dailyRate?.creditRate ?? dailyRate?.sellingRate;
                                if (targetRate && Number(targetRate) > 0) {
                                  setExchangeRate(String(targetRate));
                                } else {
                                  setExchangeRate("");
                                }
                              }
                            }}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-xs font-bold transition cursor-pointer",
                              paymentMode === "CREDIT"
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <span className="h-2 w-2 rounded-full border border-current" />
                            <span>{tr("cj.mCreditBtn", "Credit (Money Received)")}</span>
                          </button>
                        </div>

                        <div className="sm:col-span-5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{tr("cj.mFinalAmount", "Final Amount")}</span>
                          <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            {branchCurrency || "AED"} {calcFinal !== null ? fmtAmount(calcFinal) : (finalPayment ? fmtAmount(Number(finalPayment)) : fmtAmount(0))}
                          </span>
                        </div>
                      </div>

                      {/* Remarks / Notes Textarea */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">{tr("cj.mRemarks", "Remarks / Notes")}</Label>
                        <textarea
                          rows={2}
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder={tr("cj.mRemarksPh", "Enter transaction details...")}
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="text-right text-[10px] font-mono text-slate-400">
                          {remarks.length}/500
                        </div>
                      </div>

                      {/* Rate Pending Warning Banner */}
                      {isRatePending && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                            <div>
                              <span className="font-bold">{tr("cj.mRatePendingTitle", "TODAY'S EXCHANGE RATE PENDING / MISSING:")}</span>{" "}
                              {tr("cj.mRatePendingBody", "No approved exchange rate for {cur} on {date}. Country Admin must enter today's rate in Daily Exchange Rate module before financial postings can be saved.").replace("{cur}", String(currency || branchCurrency)).replace("{date}", String(entryDate))}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/dashboard/currency/daily-rates")}
                            className="shrink-0 h-8 px-3 rounded-lg text-xs font-bold gap-1.5 border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-slate-900 hover:bg-amber-100/50 text-amber-900 dark:text-amber-100 cursor-pointer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>{t(lang, "nav.super_admin_exchange_rate", "Daily Exchange Rate")}</span>
                          </Button>
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            resetPaymentDraft();
                            setMessage(t(lang, "cef.form_reset_msg", "Form reset."));
                          }}
                          className="h-10 px-4 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>{t(lang, "common.reset", "Reset")}</span>
                        </Button>

                        <div className="flex items-center gap-3">
                          {isRatePending && (
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hidden sm:inline-block">
                              {tr("cj.mRatePendingBtn", "Today's Exchange Rate Pending / Missing")}
                            </span>
                          )}
                          <Button
                            type="button"
                            disabled={saving}
                            onClick={save}
                            className={cn(
                              "h-10 px-6 rounded-xl text-xs font-black gap-2 shadow-xs cursor-pointer",
                              "dgt-cj-post",
                              isRatePending || !canSave
                                ? "dgt-cj-post-pending bg-amber-600 hover:bg-amber-700 text-white"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                            )}
                          >
                            <Send className="h-4 w-4" />
                            <span>
                              {saving
                                ? tr("cj.mPosting", "Posting...")
                                : tr("cj.mPost", "Save Entry")}
                            </span>
                          </Button>
                        </div>
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
                              {tr("cj.mAcctDetails", "Selected Account Details")}
                            </CardTitle>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {tr("cj.mAcctDetailsSub", "Complete information for the selected account")}
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
                                {selectedCrossBranchAccount
                                  ? (selectedCrossBranchAccount.name || selectedCrossBranchAccount.customerName)
                                  : (selectedCounterLedger?.accountName || selectedCounterLedger?.ledgerName || t(lang, "ledger.select_account_ph", "Select account"))}
                              </h4>
                              {selectedCrossBranchAccount ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200">
                                  {tr("cj.mCrossRecipient", "Cross-Branch Recipient")}
                                </span>
                              ) : selectedCounterLedger?.accountKind ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                                  {localizeTerm(selectedCounterLedger.accountKind, lang)}
                                </span>
                              ) : null}
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-bold border",
                                (selectedCrossBranchAccount || selectedCounterLedger)
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200"
                              )}>
                                {(selectedCrossBranchAccount || selectedCounterLedger) ? tr("cj.mActive", "Active") : t(lang, "common.pending", "Pending")}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 font-bold mt-0.5">
                              {tr("cj.mAccountNoDot", "Account No.")}{" "}
                              {selectedCrossBranchAccount
                                ? (selectedCrossBranchAccount.accountNumber || selectedCrossBranchAccount.code)
                                : (selectedCounterLedger?.accountCode || selectedCounterLedger?.ledgerCode || "—")}
                            </p>
                          </div>
                        </div>

                        {/* Identity & Location Details */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
                            <MapPin className="h-3.5 w-3.5 text-blue-600" />
                            <span>{tr("cj.mIdentity", "Identity & Location Details")}</span>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">{tr("cj.mAccountName", "Account Name")}</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {selectedCrossBranchAccount
                                  ? (selectedCrossBranchAccount.name || selectedCrossBranchAccount.customerName)
                                  : (selectedCounterLedger?.accountName || selectedCounterLedger?.ledgerName || "—")}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">{tr("cj.mAccountNoDot", "Account No.")}</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {selectedCrossBranchAccount
                                  ? (selectedCrossBranchAccount.accountNumber || selectedCrossBranchAccount.code)
                                  : (selectedCounterLedger?.accountCode || selectedCounterLedger?.ledgerCode || "—")}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">{tr("cj.mCountry", "Country")}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedCountry?.name || "—"}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">{tr("cj.mCity", "City")}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedCrossBranchAccount ? (selectedCrossBranchAccount.cityName || "—") : (selectedCounterLedger?.cityName || "—")}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">{tr("cj.mOwningBranch", "Owning Branch")}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedCrossBranchAccount ? `${selectedCrossBranchAccount.owningBranchName} (${selectedCrossBranchAccount.owningBranchCode})` : (selectedCounterLedger?.cityBranchName || selectedCounterLedger?.countryBranchName || selectedCityBranch?.name || selectedMainBranch?.name || "—")}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">{tr("cj.mAddress", "Address")}</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px] leading-snug">
                                {selectedCrossBranchAccount ? `🔒 ${tr("cj.mRestricted", "Restricted under enterprise privacy policy")}` : (selectedCounterLedger?.address || "—")}
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr] py-1">
                              <span className="text-slate-500 font-semibold">{tr("cj.mCurrency", "Currency")}</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {selectedCrossBranchAccount ? (selectedCrossBranchAccount.currency || branchCurrency || "AED") : (selectedCounterLedger?.ledgerCurrency || branchCurrency || "AED")}
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
                            {tr("cj.mSnapshot", "Financial Snapshot")}
                          </CardTitle>
                          {accountSnapshot.loading && (
                            <span className="text-[10px] text-blue-500 animate-pulse ms-auto">{tr("cj.mUpdating", "Updating...")}</span>
                          )}
                        </div>
                      </CardHeader>

                      {selectedCrossBranchAccount ? (
                        <CardContent className="p-4 space-y-3 text-xs">
                          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200">
                            <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-black text-xs">{tr("cj.mIsolation", "Ledger Isolation Policy Enforced")}</div>
                              <div className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                                {tr("cj.mIsolationBody1", "Recipient balances, ledger statements, and historical transactions belong to")} <strong>{selectedCrossBranchAccount.owningBranchName}</strong> {tr("cj.mIsolationBody2", "and are strictly isolated.")}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs pt-1">
                            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">{tr("cj.mLedgerVisibility", "Ledger Visibility")}</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                {tr("cj.mRestrictedIso", "Restricted / Isolated")}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">{tr("cj.mRecipientBranch", "Recipient Branch")}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedCrossBranchAccount.owningBranchName}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">{tr("cj.mOriginatingBranch", "Originating Branch")}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedCityBranch?.name || selectedMainBranch?.name}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-semibold">{tr("cj.mSourceAccount", "Source Account")}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={selectedCashLedger?.accountName || "Bank/Cash"}>
                                {selectedCashLedger?.accountName || "Branch Cash/Bank"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-1">
                              <span className="text-slate-500 font-semibold">{tr("cj.mInterBranch", "Inter-Branch Settlement")}</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                {tr("cj.mAuditLogging", "Automatic Audit Logging")}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      ) : (
                        <CardContent className="p-4 space-y-2 text-xs">
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 font-semibold">{tr("cj.mOldBalance", "Old Balance")}</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {accountSnapshot.loading ? "..." : fmtAmount(accountSnapshot.oldBalance)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 font-semibold">{tr("cj.totalCredit", "Total Credit")}</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {accountSnapshot.loading ? "..." : fmtAmount(accountSnapshot.totalCredit)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 font-semibold">{tr("cj.totalDebit", "Total Debit")}</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {accountSnapshot.loading ? "..." : fmtAmount(accountSnapshot.totalDebit)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-800 dark:text-slate-200 font-black text-xs">{tr("cj.mCurrentBalance", "Current Balance")}</span>
                            <span className={cn(
                              "font-mono font-black text-base",
                              accountSnapshot.currentBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            )}>
                              {accountSnapshot.loading ? "..." : fmtAmount(accountSnapshot.currentBalance)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1">
                            <span className="text-slate-500 font-semibold">{tr("cj.mLastTxDate", "Last Transaction Date")}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {accountSnapshot.loading
                                ? "..."
                                : accountSnapshot.lastTransactionDate
                                ? new Date(accountSnapshot.lastTransactionDate).toLocaleDateString()
                                : "—"}
                            </span>
                          </div>
                        </CardContent>
                      )}
                    </Card>

                    {/* Drill-down Modal for Daily Cash Position */}
                    <SimpleModal
                      isOpen={Boolean(drilldownBranch)}
                      onClose={() => setDrilldownBranch(null)}
                      title={`${tr("cj.mDrillTitle", "Branch Cash Position Drill-Down")} — ${drilldownBranch?.branchName || ""} (${drilldownBranch?.branchCode || ""})`}
                    >
                      <div className="space-y-4 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">{tr("cj.colCredit", "Credit")}</span>
                            <span className="text-xs font-black text-emerald-600 font-mono">
                              {drilldownBranch?.currency} {fmtAmount(drilldownBranch?.totalCredit || 0)}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">{tr("cj.colDebit", "Debit")}</span>
                            <span className="text-xs font-black text-rose-600 font-mono">
                              {drilldownBranch?.currency} {fmtAmount(drilldownBranch?.totalDebit || 0)}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">{tr("cj.colNetBalance", "Net Balance")}</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                              {drilldownBranch?.currency} {fmtAmount(drilldownBranch?.balance || 0)} ({drilldownBranch?.balanceType || "—"})
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">{tr("cj.mTotalEntries", "Total Entries")}</span>
                            <span className="text-xs font-black text-blue-600 font-mono">
                              {drilldownBranch?.entryCount || 0}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase text-slate-600 dark:text-slate-300">
                            {tr("cj.mScopedTx", "Relevant Scoped Transactions")}
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                  <th className="py-2 px-2.5">{tr("cj.mVoucher", "Voucher")}</th>
                                  <th className="py-2 px-2.5">{tr("cj.mTime", "Time")}</th>
                                  <th className="py-2 px-2.5">{tr("cj.mParty", "Party / Account")}</th>
                                  <th className="py-2 px-2.5">{tr("cj.mNarration", "Narration")}</th>
                                  <th className="py-2 px-2.5 text-end">{tr("cj.colDebit", "Debit")}</th>
                                  <th className="py-2 px-2.5 text-end">{tr("cj.colCredit", "Credit")}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {drilldownBranch?.transactions && drilldownBranch.transactions.length > 0 ? (
                                  drilldownBranch.transactions.map((tx: any) => (
                                    <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                      <td className="py-1.5 px-2.5 font-mono font-bold text-blue-600">{tx.voucherNo}</td>
                                      <td className="py-1.5 px-2.5 text-slate-400 font-mono text-[10px]">{tx.time}</td>
                                      <td className="py-1.5 px-2.5 font-bold text-slate-800 dark:text-slate-200">{tx.partyName}</td>
                                      <td className="py-1.5 px-2.5 text-slate-500 text-[11px] truncate max-w-[150px]" title={tx.narration}>{tx.narration}</td>
                                      <td className="py-1.5 px-2.5 text-right font-mono text-rose-600 font-bold">
                                        {tx.debit > 0 ? fmtAmount(tx.debit) : "—"}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right font-mono text-emerald-600 font-bold">
                                        {tx.credit > 0 ? fmtAmount(tx.credit) : "—"}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="py-6 text-center text-slate-400 font-medium">
                                      {tr("cj.mNoTx", "No transactions recorded for this branch today.")}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </SimpleModal>

                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

    {/* ============================================================
        ROZNAMCHA ENTRIES TABLE CARD (APPROVED DESIGN)
    ============================================================ */}
    <Card className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950">
      {/* Header Toolbar: Roznamcha Entries | Search... | Filter | Export | ... */}
      <div className="border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Table2 className="h-4 w-4" />
            </span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              {tr("cj.roznamchaEntriesTitle", "Roznamcha Entries")}
            </h3>
          </div>

          {tableDateMode === "range" && (
            <div className="flex items-center gap-2">
              <ErpDatePicker
                mode="range"
                size="sm"
                lang={lang}
                value={{
                  from: tableFromDate || null,
                  to: tableToDate || null,
                }}
                onApply={(val) => {
                  setTableFromDate(val.from ?? "");
                  setTableToDate(val.to ?? "");
                }}
                applyLabel="update"
              />
              <button
                type="button"
                onClick={() => {
                  setTableDateMode("day");
                  setTableDate(todayIso());
                  setEntryDate(todayIso());
                }}
                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                {t(lang, "roz.today", "Today")}
              </button>
            </div>
          )}
        </div>

        {/* Right Controls: Search... | Filter | Export | ... */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              placeholder={t(lang, "common.search_placeholder", "Search...")}
              aria-label={t(lang, "common.search_placeholder", "Search...")}
              className="h-8.5 w-[190px] sm:w-[220px] rounded-xl border border-slate-200 bg-slate-50/60 pl-8.5 pr-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 transition"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowJournalFilters(true)}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span>{tr("cj.filterBtn", "Filter")}</span>
            {cjActiveFilterCount(journalFilters) > 0 && (
              <span className="ml-0.5 rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] font-black text-white">
                {cjActiveFilterCount(journalFilters)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handlePrintRegister(false)}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>{t(lang, "common.export", "Export")}</span>
          </button>

          <CjActionsMenu
            lang={lang}
            items={[
              { key: "print", label: t(lang, "common.print", "Print A4 Register"), icon: <Printer />, onClick: () => handlePrintRegister(true) },
              { key: "pdf", label: t(lang, "urs.a_download_pdf", "Download PDF"), icon: <Download />, onClick: () => handlePrintRegister(false) },
              { key: "today", label: t(lang, "roz.today", "Show Today"), icon: <Calendar />, onClick: () => { setTableDateMode("day"); setTableDate(todayIso()); setEntryDate(todayIso()); } },
              { key: "range", label: t(lang, "roz.filter_date_range", "Filter by Date Range"), icon: <CalendarDays />, onClick: () => setTableDateMode("range") },
              { key: "all_dates", label: t(lang, "roz.filter_all_dates", "Show All Historical Dates"), icon: <Globe />, onClick: () => setTableDateMode("all") },
              { key: "refresh", label: t(lang, "common.refresh", "Refresh"), icon: <RefreshCw className={cn(loadingEntries ? "animate-spin" : "")} />, disabled: loadingEntries, onClick: () => { fetchRecentEntries(); fetchCashSummary(); fetchSummaryOverview(); fetchAllDailyExchangeRates(); } }
            ]}
          />
        </div>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/90 text-left text-[11px] font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <Th className="py-2.5 px-3 font-bold whitespace-nowrap w-10">#</Th>
                <Th className="py-2.5 px-3 font-bold whitespace-nowrap">Date &amp; Time</Th>
                <Th className="py-2.5 px-3 font-bold whitespace-nowrap">Branch</Th>
                <Th className="py-2.5 px-3 font-bold whitespace-nowrap">Country</Th>
                <Th className="py-2.5 px-3 font-bold whitespace-nowrap">Roznamcha Type</Th>
                <Th className="py-2.5 px-3 font-bold min-w-[180px]">Details</Th>
                <Th className="py-2.5 px-2.5 font-bold text-center whitespace-nowrap">Currency</Th>
                {canViewUsd && (
                  <Th className="py-2.5 px-2.5 font-bold text-right whitespace-nowrap">Exchange Rate</Th>
                )}
                <Th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Credit (Local)</Th>
                {canViewUsd && (
                  <Th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Credit (USD)</Th>
                )}
                <Th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Debit (Local)</Th>
                {canViewUsd && (
                  <>
                    <Th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Debit (USD)</Th>
                    <Th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Balance (USD)</Th>
                  </>
                )}
                <Th className="py-2.5 px-3 font-bold text-center whitespace-nowrap">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loadingEntries ? (
                <tr>
                  <td colSpan={canViewUsd ? 14 : 10} className="p-8 text-center text-slate-400 font-medium italic">
                    {t(lang, "roz.loading_entries", "Loading entries...")}
                  </td>
                </tr>
              ) : filteredRecentEntries.length === 0 ? (
                <tr>
                  <td colSpan={canViewUsd ? 14 : 10} className="p-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <span>{t(lang, "roz.no_entries_found", "No Roznamcha journal entries found for the selected filter / date.")}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                (() => {
                  let rowCounter = (journalPageSafe - 1) * journalPageSize;
                  return pagedRecentEntries.flatMap((row) => {
                    const displayLines = getDisplayLinesForEntry(row);
                    return displayLines.map((line: any, idx: number) => {
                      rowCounter += 1;
                      const isDebit = Number(line.debit || 0) > 0;
                      const isCredit = Number(line.credit || 0) > 0;
                      const creditLocal = isCredit ? Number(line.credit || 0) : 0;
                      const debitLocal = isDebit ? Number(line.debit || 0) : 0;
                      const amountVal = isDebit ? debitLocal : creditLocal;

                      const lineCurr = String(line.currency || row.countries?.currency_code || branchCurrency || "AED").toUpperCase();
                      const rawRate = line.exchange_rate ?? line.usd_rate ?? row.exchange_rate ?? currencyRateLookup[lineCurr] ?? (lineCurr === "USD" ? 1 : null);
                      const rateNum = rawRate != null && Number(rawRate) > 0 ? Number(rawRate) : null;

                      const lineUsdVal = line.usd_amount != null && Number(line.usd_amount) > 0
                        ? Number(line.usd_amount)
                        : lineCurr === "USD"
                        ? amountVal
                        : rateNum
                        ? amountVal / rateNum
                        : 0;

                      const creditUsdVal = isCredit ? lineUsdVal : 0;
                      const debitUsdVal = isDebit ? lineUsdVal : 0;
                      const balanceUsdVal = creditUsdVal - debitUsdVal;

                      const categoryLabel = getRoznamchaCategoryLabel(row);
                      const isBankType = categoryLabel.toLowerCase().includes("bank");

                      const dateStr = row.entry_date ? formatDisplayDateShort(String(row.entry_date).slice(0, 10)) : new Date(row.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                      const timeStr = row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

                      const branchDisplay = row.city_branches?.name || row.country_branches?.name || row.city_branches?.code || row.country_branches?.code || "Main Branch";
                      const countryNameRaw = row.countries?.name || selectedCountry?.name || "UAE";
                      const countryDisplay = countryNameRaw.toLowerCase().includes("emirates") ? "UAE" : localizeCountryName(countryNameRaw, lang);

                      const rawNarration = resolveVerifiedTranslation(row.translations?.[`lines.${idx}.description`] || row.translations?.narration, lang) || translateNarrationBlock(line.description || row.narration, lang) || line.ledgers?.name || "-";
                      const cleanNarration = String(rawNarration).split("\n").filter((l) => !l.trim().startsWith("[Audit Trail")).join(" · ").trim() || line.ledgers?.name || "-";

                      return (
                        <tr key={`${row.id}-${line.id || idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors">
                          {/* 1. # */}
                          <td className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {rowCounter}
                          </td>

                          {/* 2. Date & Time */}
                          <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap" dir="ltr">
                            {dateStr} {timeStr}
                          </td>

                          {/* 3. Branch */}
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {branchDisplay}
                          </td>

                          {/* 4. Country */}
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <span>{getCountryFlag(countryNameRaw)}</span>
                              <span>{countryDisplay}</span>
                            </span>
                          </td>

                          {/* 5. Roznamcha Type */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                              {isBankType ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white text-[10px]">
                                  <Building2 className="h-3 w-3" />
                                </span>
                              ) : (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-white text-[10px]">
                                  <Banknote className="h-3 w-3" />
                                </span>
                              )}
                              <span>{isBankType ? tr("cj.mBank", "Bank") : categoryLabel}</span>
                            </span>
                          </td>

                          {/* 6. Details */}
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium max-w-[260px] truncate" title={cleanNarration}>
                            {cleanNarration}
                          </td>

                          {/* 7. Currency */}
                          <td className="py-2.5 px-2.5 text-center font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {lineCurr}
                          </td>

                          {/* 8. Exchange Rate */}
                          {canViewUsd && (
                            <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap" dir="ltr">
                              {rateNum ? rateNum.toFixed(4) : "—"}
                            </td>
                          )}

                          {/* 9. Credit (Local) */}
                          <td className={cn(
                            "py-2.5 px-3 text-right font-mono whitespace-nowrap",
                            creditLocal > 0 ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-slate-400 dark:text-slate-600"
                          )} dir="ltr">
                            {fmtAmount(creditLocal)}
                          </td>

                          {/* 10. Credit (USD) */}
                          {canViewUsd && (
                            <td className={cn(
                              "py-2.5 px-3 text-right font-mono whitespace-nowrap",
                              creditUsdVal > 0 ? "font-semibold text-slate-800 dark:text-slate-200" : "font-medium text-slate-400 dark:text-slate-600"
                            )} dir="ltr">
                              {fmtAmount(creditUsdVal)}
                            </td>
                          )}

                          {/* 11. Debit (Local) */}
                          <td className={cn(
                            "py-2.5 px-3 text-right font-mono whitespace-nowrap",
                            debitLocal > 0 ? "font-bold text-rose-600 dark:text-rose-400" : "font-medium text-slate-400 dark:text-slate-600"
                          )} dir="ltr">
                            {fmtAmount(debitLocal)}
                          </td>

                          {/* 12. Debit (USD) & 13. Balance (USD) */}
                          {canViewUsd && (
                            <>
                              <td className={cn(
                                "py-2.5 px-3 text-right font-mono whitespace-nowrap",
                                debitUsdVal > 0 ? "font-semibold text-slate-800 dark:text-slate-200" : "font-medium text-slate-400 dark:text-slate-600"
                              )} dir="ltr">
                                {fmtAmount(debitUsdVal)}
                              </td>

                              <td className={cn(
                                "py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap",
                                balanceUsdVal < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : balanceUsdVal > 0
                                  ? "text-slate-800 dark:text-slate-200"
                                  : "text-slate-400"
                              )} dir="ltr">
                                {balanceUsdVal < 0 ? `-${fmtAmount(Math.abs(balanceUsdVal))}` : fmtAmount(balanceUsdVal)}
                              </td>
                            </>
                          )}

                          {/* 14. Action */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {idx === 0 ? (
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={() => setActiveRowMenuId(activeRowMenuId === row.id ? null : row.id)}
                                  className="inline-flex h-6 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                                  aria-label={tr("common.actions", "Actions")}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>

                                {activeRowMenuId === row.id && (
                                  <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
                                    {canEditOrDelete && (
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                                        onClick={() => {
                                          setActiveRowMenuId(null);
                                          handleEditEntry(row);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5 text-blue-600" />
                                        {t(lang, "common.edit", "Edit")}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
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
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
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
                            ) : null}
                          </td>
                        </tr>
                      );
                    });
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
            <CjPagination
              lang={lang}
              page={journalPageSafe}
              pageSize={journalPageSize}
              total={journalRowEntries.length}
              onPage={setJournalPage}
              onPageSize={setJournalPageSize}
            />
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


