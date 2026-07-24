"use client";

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
  Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";

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
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");

  const [mainBranches, setMainBranches] = useState<CountryBranchRow[]>([]);
  const [cityBranches, setCityBranches] = useState<CityBranchRow[]>([]);

  const [ledgers, setLedgers] = useState<LedgerLookupRow[]>([]);
  const [loadingLedgers, setLoadingLedgers] = useState(false);
  const [cashLedgerId, setCashLedgerId] = useState("");
  const [counterLedgerId, setCounterLedgerId] = useState("");
  const [selectedLookupLedger, setSelectedLookupLedger] = useState<LedgerLookupRow | null>(null);
  const [accountNoInput, setAccountNoInput] = useState("");
  const [accountLookupError, setAccountLookupError] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState(todayIso());
  const [roznamchaBookType, setRoznamchaBookType] = useState("");
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

  const [paymentType, setPaymentType] = useState<"" | "bank" | "business" | "invoice" | "cash" | "transfer">("");
  const [paymentMode, setPaymentMode] = useState<"" | "DEBIT" | "CREDIT">("");
  const [finalPayment, setFinalPayment] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Payment-type details (reference design panel).
  const [typeDetails, setTypeDetails] = useState<Record<string, string>>({});

  // Currency calculation panel (reference design): amount/price/op.
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
  const [branchLocked, setBranchLocked] = useState(true);

  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);
  const [ledgerRefreshCount, setLedgerRefreshCount] = useState(0);
  const [showPaymentWorkReport, setShowPaymentWorkReport] = useState(true);

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

  useEffect(() => {
    if (!countryId) {
      setBranchLocked(false);
    }
  }, [countryId]);

  const [showRoznamcha, setShowRoznamcha] = useState(false);
  const [roznamchaType, setRoznamchaType] = useState("Cash Book No.");
  const [roznamchaBook, setRoznamchaBook] = useState("CB-001 - Main Cash Book");
  const [roznamchaNumber, setRoznamchaNumber] = useState("000123");

  useEffect(() => {
    setLoginTimeText(new Date().toLocaleString());
  }, []);

  const fetchRecentEntries = async () => {
    try {
      setLoadingEntries(true);
      const params = new URLSearchParams({ limit: "100" });
      if (countryId) params.set("countryId", countryId);
      if (countryBranchId) params.set("countryBranchId", countryBranchId);
      if (cityBranchId) params.set("cityBranchId", cityBranchId);
      const res = await apiGet<{ entries: any[] }>(`/api/erp/roznamcha?${params.toString()}`);
      setRecentEntries(res.entries || []);
    } catch (err) {
      console.error("Failed to fetch recent entries", err);
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    fetchRecentEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, countryBranchId, cityBranchId]);

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
    const label = isDebit ? "Dr (Banam)" : "Cr (Jama)";
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
    !isLocalCurrency &&
    ["USD", "AED", "AFN", "INR", "IRR", "PKR"].includes(currency.toUpperCase());

  const calcFinal = useMemo(() => {
    if (!showCalcPanel) return null;
    const a = Number(calcAmount);
    const p = Number(exchangeRate);
    if (!Number.isFinite(a) || !Number.isFinite(p) || a <= 0 || p <= 0) return null;
    if (calcOp === "div" && p === 0) return null;
    const v = calcOp === "mul" ? a * p : a / p;
    return Number.isFinite(v) ? v : null;
  }, [calcAmount, calcOp, exchangeRate, showCalcPanel]);

  const amount = useMemo(() => {
    if (showCalcPanel && calcFinal !== null) return calcFinal;
    return Number(finalPayment || 0);
  }, [finalPayment, showCalcPanel, calcFinal]);

  const txAmount = useMemo(() => {
    if (showCalcPanel) {
      if (calcAmount) return Number(calcAmount);
      const rate = Number(exchangeRate);
      if (rate > 0) return amount / rate;
      return 0;
    }
    return amount;
  }, [showCalcPanel, calcAmount, exchangeRate, amount]);

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



  const recentTransactions = useMemo(() => [
    {
      date: entryDate.split("-").reverse().join("/"),
      accountCode: selectedCounterLedger?.accountCode || selectedCounterLedger?.ledgerCode || "1102-0001",
      accountName: selectedCounterLedger?.accountName || "ABC Traders",
      voucherNo: lastEntryId || "PV-000123",
      description: remarks.trim() ? remarks.trim() : "Payment to ABC Traders against invoice",
      debit: paymentMode === "DEBIT" ? amount : 0,
      credit: paymentMode === "CREDIT" ? amount : 0,
      balance: paymentMode === "DEBIT" ? 25000 + amount : paymentMode === "CREDIT" ? 25000 - amount : 25000,
      type: paymentMode === "DEBIT" ? "Receipt" : "Payment"
    },
    {
      date: entryDate.split("-").reverse().join("/"),
      accountCode: "1110-0002",
      accountName: "Cash in Hand",
      voucherNo: "RC-000087",
      description: "Cash received from ABC Traders",
      debit: 0,
      credit: 7500,
      balance: 17500,
      type: "Receipt"
    },
    {
      date: entryDate.split("-").reverse().join("/"),
      accountCode: "6300-0001",
      accountName: "Stationery Expenses",
      voucherNo: "JV-000045",
      description: "Stationery purchase",
      debit: 300,
      credit: 0,
      balance: 17800,
      type: "Journal"
    },
    {
      date: entryDate.split("-").reverse().join("/"),
      accountCode: "1120-0003",
      accountName: "Bank Alfalah - Current A/C",
      voucherNo: "BP-000012",
      description: "Bank deposit",
      debit: 0,
      credit: 2650,
      balance: 15150,
      type: "Bank Payment"
    }
  ], [entryDate, selectedCounterLedger, lastEntryId, narration, paymentMode, amount, computedDetails, remarks]);

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
        const rows = await listCountries();
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
    if (!countryId && session.scopes.countryIds?.length) {
      suppressScopeResetRef.current = true;
      setCountryId(session.scopes.countryIds[0]!);
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
    if (!countryId || !countryBranchId) return;

    (async () => {
      setLoadingLedgers(true);
      try {
        const res = await listLedgerReportLedgers({
          reportScope: cityBranchId ? "branch" : "country",
          countryId: countryId || null,
          countryBranchId: countryBranchId || null,
          cityBranchId: cityBranchId || null,
          limit: 2000,
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
    if (session.scopes?.isSuperAdmin) return true;
    const allowedRoles = ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "branch_admin", "admin"];
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
      setAccountLookupError("Account not found in Account Master. Check Account Number, Manual Reference, Customer Number, or Account Name.");
    } catch (error) {
      setAccountLookupError(error instanceof Error ? error.message : "Account lookup failed.");
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
    
    const rowsForPrint: { label: string; value: string }[] = [
      { label: "Entry Serial", value: header.super_admin_serial_number || "-" },
      { label: "Country Serial", value: header.country_transaction_serial_number || "-" },
      { label: "Branch Serial", value: header.branch_transaction_serial_number || "-" },
      { label: "Date", value: header.entry_date || "-" },
      { label: "Voucher No", value: header.voucher_no || "-" },
      { label: "Journal No", value: header.journal_no || "-" },
      { label: "Narration", value: header.narration || "-" },
      { label: "Status", value: header.status || "-" }
    ];
    
    if (firstLine) {
      rowsForPrint.push({
        label: "Counterparty Account",
        value: `${firstLine.account_number || "-"} | ${firstLine.ledgers?.name || "-"} | ${firstLine.debit ? "Debit (Receive)" : "Credit (Pay)"} ${fmtAmount(Number(firstLine.debit || firstLine.credit || 0))} ${firstLine.currency || ""}`
      });
    }
    if (secondLine) {
      rowsForPrint.push({
        label: "Cash/Bank Account",
        value: `${secondLine.account_number || "-"} | ${secondLine.ledgers?.name || "-"} | ${secondLine.debit ? "Debit (Receive)" : "Credit (Pay)"} ${fmtAmount(Number(secondLine.debit || secondLine.credit || 0))} ${secondLine.currency || ""}`
      });
    }
    return rowsForPrint;
  };

  const handleViewA4ById = async (id: string) => {
    try {
      const res = await apiGet<any>(`/api/erp/roznamcha/${id}`);
      if (res.found && res.header) {
        openA4ReportWindow({
          title: "Roznamcha Cash Entry",
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

  const handleEditEntry = (row: any) => {
    setEditEntryId(row.id);
    setShowPaymentWorkReport(true);
    suppressScopeResetRef.current = true;
    if (row.country_id) setCountryId(row.country_id);
    if (row.country_branch_id) setCountryBranchId(row.country_branch_id);
    if (row.city_branch_id) setCityBranchId(row.city_branch_id);
    
    setEntryDate(row.entry_date);
    setReferenceNo(row.reference_no || "");
    
    const narration = row.narration || "";
    setRemarks(parseNarrationRemarks(narration));
    
    const firstLine = row.roznamcha_lines?.[0];
    const secondLine = row.roznamcha_lines?.[1];
    
    if (firstLine) {
      setCounterLedgerId(firstLine.ledger_id);
      
      const type = firstLine.payment_entry_type || "";
      const isDebit = ["cash_receipt", "bank_deposit", "debit"].includes(type);
      
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
      superAdmin: row.super_admin_serial_number,
      country: row.country_transaction_serial_number,
      branch: row.branch_transaction_serial_number
    });

    setActiveCreator(row.profiles?.full_name || "System User");
    setActiveApprover(row.approver_profile?.full_name || (row.status === "approved" ? "Approved" : "Pending"));
    setActiveStatus(row.status || "posted");
    
    setMessage(`Editing entry serials: ${[row.super_admin_serial_number, row.country_transaction_serial_number, row.branch_transaction_serial_number].filter(Boolean).join(" / ")}`);
    
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

  const handleDeleteEntry = async (entryId: string) => {
    if (!entryId || !canEditOrDelete) return;
    const confirmed = window.confirm("Delete this entry by creating a reversal record?");
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
        sourceModule: "cash_entry",
        sourceTransactionType: roznamchaType,
        sourceReferenceNo: roznamchaNumber,
        paymentDetails: {
          roznamchaBookType,
          paymentType: paymentMode === "DEBIT" ? "money_received" : "money_paid",
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
            paymentEntryType: roznamchaBookType === "bank" ? (paymentMode === "DEBIT" ? "bank_deposit" : "bank_cheque") : (paymentMode === "DEBIT" ? "cash_receipt" : "cash_payment"),
            enterpriseAccountId: selectedCounterLedger?.accountId || null,
            ledgerId: counterLedgerId || "",
            description: finalNarration.trim() ? finalNarration.trim() : undefined,
            debit: paymentMode === "CREDIT" ? amount : 0,
            credit: paymentMode === "DEBIT" ? amount : 0,
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
      fetchRecentEntries();
      setLedgerRefreshCount((c) => c + 1);
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

  const isSuperAdmin = session?.scopes?.isSuperAdmin ?? false;
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
    return ledgers.map((row) => {
      const code = row.accountCode || row.ledgerCode || "";
      const name = row.accountName || row.ledgerName || "";
      const branchName = row.cityBranchName || row.countryBranchName || "";
      const suffix = branchName ? ` (${branchName})` : "";
      const label = (code ? `${code} — ${name}` : name) + suffix;
      const keywords = `${row.accountCode} ${row.ledgerCode} ${row.accountName} ${row.ledgerName} ${row.manualReferenceNumber} ${row.customerNumber} ${branchName}`;
      return { value: row.ledgerId, label, keywords };
    });
  }, [ledgers]);
  const actionButtons = (
    <div id="erp-page-actions-portal-content" className="flex items-center gap-1.5">
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1.5 rounded-lg px-3 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.location.href = "/dashboard/roznamcha/cash-entry";
          }
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        New
      </Button>
    </div>
  );

  return (
    <div className="mx-auto w-full bg-[#f8fbff] dark:bg-slate-950/40 text-slate-950 dark:text-slate-50 min-h-screen">
      {portalNode ? createPortal(actionButtons, portalNode) : null}

      {/* Super Admin Scope Modal */}
      {isSuperAdmin && (!countryId || !countryBranchId) && (
        <SimpleModal
          onClose={() => {}} // Cannot close without selecting
          title="Super Admin: Select Working Scope"
          className="max-w-md"
        >
          <div className="space-y-4 p-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Please select the Country and Branch you want to work in for Cash Entry.
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-black">Country</Label>
                <select
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none"
                >
                  <option value="">Select Country...</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.currency_code})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-black">Branch</Label>
                <select
                  value={countryBranchId}
                  onChange={(e) => setCountryBranchId(e.target.value)}
                  disabled={!countryId}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none"
                >
                  <option value="">Select Branch...</option>
                  {mainBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* Horizontal Scope & Session Grid */}
      <div className="mx-4 mt-4 mb-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
          
          {/* Group 1: Branch Details & Transaction Info */}
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-xs font-semibold">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right self-center">Country</span>
              <div className="relative flex items-center">
                <select
                  value={countryId}
                  disabled={loadingCountries || (effectiveScopeMode !== "super_admin" && !isSuperAdmin)}
                  onChange={(e) => setCountryId(e.target.value)}
                  className="bg-transparent border-none p-0 outline-none font-bold text-blue-600 dark:text-blue-400 cursor-pointer appearance-none text-xs hover:underline"
                >
                  <option value="" className="text-slate-900">
                    {!isSuperAdmin && (!session?.scopes.countryIds || session.scopes.countryIds.length === 0) 
                      ? "No Country Assigned" 
                      : "Select Country"}
                  </option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id} className="text-slate-900">{c.name}</option>
                  ))}
                </select>
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right self-center">Branch Name</span>
              <div className="relative flex items-center">
                <select
                  value={countryBranchId}
                  disabled={!countryId}
                  onChange={(e) => setCountryBranchId(e.target.value)}
                  className="bg-transparent border-none p-0 outline-none font-bold text-slate-850 dark:text-slate-200 cursor-pointer appearance-none text-xs hover:underline"
                >
                  <option value="" className="text-slate-900">Select Branch</option>
                  {mainBranches.map((b) => (
                    <option key={b.id} value={b.id} className="text-slate-900">{b.name}</option>
                  ))}
                </select>
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Branch Code</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150">
                {selectedMainBranch?.code || "—"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right self-center">City Branch</span>
              <div className="relative flex items-center">
                <select
                  value={cityBranchId}
                  disabled={!countryBranchId}
                  onChange={(e) => setCityBranchId(e.target.value)}
                  className="bg-transparent border-none p-0 outline-none font-bold text-slate-850 dark:text-slate-200 cursor-pointer appearance-none text-xs hover:underline truncate max-w-[200px]"
                >
                  <option value="" className="text-slate-900">Select City Branch</option>
                  {cityBranches.map((b) => (
                    <option key={b.id} value={b.id} className="text-slate-900">{b.name}</option>
                  ))}
                </select>
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">City Code</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150">
                {selectedCityBranch?.code || "—"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Date</span>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="bg-transparent border-none p-0 outline-none font-bold text-slate-850 dark:text-slate-150 cursor-pointer text-xs"
              />
            </div>

            <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-xs font-semibold">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Created By</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate max-w-[120px]" title={activeCreator || session?.user?.fullName || "Current User"}>
                {activeCreator || session?.user?.fullName || "Current User"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Approved By</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate max-w-[120px]" title={activeApprover || "Pending"}>
                {activeApprover || "Pending"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Status</span>
              <div>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border",
                  activeStatus === "approved"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400"
                    : activeStatus === "cancelled"
                    ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-400"
                    : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400"
                )}>
                  {activeStatus || "Draft"}
                </span>
              </div>
            </div>
          </div>

          {/* Group 2: User Context & Exchange Rates */}
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-xs font-semibold">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">User Name</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150">
                {session?.user?.fullName || "System User"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">User ID</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 font-mono">
                {session?.user?.id?.slice(0, 8).toUpperCase() || "ADM-001"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Team</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150">
                Accounts Team
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Time</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150">
                {loginTimeText || "—"}
              </span>
            </div>

            <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-xs font-semibold">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Exchange</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150">
                {getCountryFlag(selectedCountry?.name)} USD / {branchCurrency}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Rate Date</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 font-mono">
                {countryRate?.effectiveDate || entryDate.split("-").reverse().join("/") || "Today"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 text-right">Buy / Sell</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {countryRate?.debitRate ? countryRate.debitRate.toFixed(4) : "—"} / {countryRate?.creditRate ? countryRate.creditRate.toFixed(4) : "—"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 text-right">Budget Rate</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                {countryRate?.buyRate ? ((countryRate.buyRate + (countryRate.sellRate || countryRate.buyRate)) / 2).toFixed(4) : "—"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Cash Ledger</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate max-w-[150px]" title={selectedCashLedger?.ledgerName || "—"}>
                {selectedCashLedger?.ledgerName || "—"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 text-right">Cash Balance</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                {cashBalanceText}
              </span>
            </div>
          </div>

          {/* Group 3: Serials */}
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-xs font-semibold">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 text-right">Journal Serial</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono">{savedSerials?.superAdmin || "Pending Save"}</span>

              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 text-right">Country Serial</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono">{savedSerials?.country || "Pending Save"}</span>

              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 text-right">Branch Serial</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono">{savedSerials?.branch || "Pending Save"}</span>

              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 text-right">Main Branch Sr</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono">{(savedSerials as any)?.mainBranch || "Pending Save"}</span>

              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 text-right">City Branch Sr</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono">{(savedSerials as any)?.cityBranch || "Pending Save"}</span>

              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 text-right">Entry Serial</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{(savedSerials as any)?.entrySerial || "Pending Save"}</span>
            </div>
          </div>
          {/* Group 3: Customer Details */}
          {selectedCounterLedger && (
            <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-xs font-semibold border-l pl-6 border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Customer</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate max-w-[150px]" title={selectedCounterLedger.accountName || selectedCounterLedger.ledgerName || "-"}>
                {selectedCounterLedger.accountName || selectedCounterLedger.ledgerName || "-"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Account No</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 font-mono">
                {selectedCounterLedger.accountCode || selectedCounterLedger.ledgerCode || "-"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Customer No</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 font-mono">
                {selectedCounterLedger.customerNumber || "-"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Currency</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150">
                {selectedCounterLedger.ledgerCurrency || "-"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 text-right">Balance</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {fmtAmount(selectedCounterLedger.currentBalance || 0)}
              </span>
            </div>
          )}

          {/* Group 4: Company & Contact Details */}
          {selectedCounterLedger && (
            <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-xs font-semibold border-l pl-6 border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Company</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate max-w-[150px]" title={selectedCounterLedger.companyName || "-"}>
                {selectedCounterLedger.companyName || "-"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Mobile / Ph</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate max-w-[150px]">
                {Array.isArray(selectedCounterLedger.contacts) ? selectedCounterLedger.contacts.find((c: any) => c.type === "mobile")?.value || selectedCounterLedger.contacts.find((c: any) => c.type === "phone")?.value || "-" : "-"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Email</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate max-w-[150px]">
                {Array.isArray(selectedCounterLedger.contacts) ? selectedCounterLedger.contacts.find((c: any) => c.type === "email")?.value || "-" : "-"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Location</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 truncate max-w-[150px]">
                {selectedCounterLedger.countryName || selectedCountry?.name || "-"} / {selectedCounterLedger.cityBranchName || "-"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Branch Code</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-150 font-mono">
                {selectedCounterLedger.branchSerialNumber || "-"}
              </span>
            </div>
          )}

        </div>

        </div>

      <div className="space-y-3 px-4 pb-4">
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





        {/* Main Workspace layout */}
        {showPaymentWorkReport ? (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          {/* Left Column: Payment Entry Form */}
          <div className="space-y-4">

            {/* Payment Entry Card */}
            <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-4 py-2 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  📋 Payment Work Entry
                </h3>
              </div>
              <CardContent className="p-4 space-y-4">
                {/* Row 1: Search Account & Daily Payment Date */}
                <div className="grid gap-4 grid-cols-2">
                  <FieldBlock label={t(lang, "form.search_account")} required>
                    <SearchSelect
                      label=""
                      value={counterLedgerId}
                      placeholder="Search by Account Name or Number..."
                      options={accountOptions}
                      disabled={loadingLedgers}
                      onValueChange={handleCounterLedgerChange}
                      onSearchValueChange={setAccountNoInput}
                      createLabel="Search on Server"
                      onCreateNew={lookupAccountNo}
                    />
                  </FieldBlock>

                  <FieldBlock label={t(lang, "form.daily_payment_date")} required>
                    <Input
                      className="h-10 text-xs font-semibold w-full"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      type="date"
                    />
                  </FieldBlock>
                </div>

                {accountLookupError && (
                  <p className="text-xs text-red-600 font-semibold">{accountLookupError}</p>
                )}

                {/* Row 2: Roznamcha Type & Roznamcha Number */}
                <div className="grid gap-4 grid-cols-2">
                  <FieldBlock label={t(lang, "form.roznamcha_type")} required>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none"
                      value={roznamchaType}
                      onChange={(e) => setRoznamchaType(e.target.value)}
                    >
                      <option value="Roznamcha Book No.">Roznamcha Book No.</option>
                      <option value="Cash Book No.">Cash Book No.</option>
                      <option value="Receipt No.">Receipt No.</option>
                    </select>
                  </FieldBlock>

                  <FieldBlock label={t(lang, "form.roznamcha_number")} required>
                    <Input
                      className="h-10 text-xs font-semibold w-full"
                      value={roznamchaNumber}
                      onChange={(e) => setRoznamchaNumber(e.target.value)}
                      placeholder="e.g. 000123"
                    />
                  </FieldBlock>
                </div>



                {/* Transaction entry details (category, currency, amount) */}
                <div className="border-t border-slate-100 pt-4 space-y-4 dark:border-slate-800">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldBlock label={t(lang, "form.roznamcha_category")} required>
                      <select
                        className="h-10 w-full max-w-[220px] rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none"
                        value={paymentType}
                        disabled={!selectedCounterLedger}
                        onChange={(event) => {
                          const value = event.target.value as "" | "cash" | "bank" | "business" | "invoice" | "transfer";
                          setPaymentType(value);
                          setTypeDetails({});
                          setAttachmentFile(null);
                          setRoznamchaBookType(value ? "branch_payment_voucher" : "");
                          setFinalPayment("");
                          setPaymentMode("");
                        }}
                      >
                        <option value="">Select Category</option>
                        <option value="cash">Cash Roznamcha</option>
                        <option value="bank">Bank Roznamcha</option>
                        <option value="business">Business Roznamcha</option>
                        <option value="invoice">Invoice Journal</option>
                        <option value="transfer">Transfer</option>
                      </select>
                    </FieldBlock>

                    <FieldBlock label={t(lang, "form.currency_type")} required>
                      <select
                        className={cn(
                          "h-10 w-full max-w-[220px] rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none",
                          currencyError ? "border-red-300" : ""
                        )}
                        value={currency}
                        disabled={!selectedCounterLedger}
                        onChange={(e) => {
                          setCurrency(e.target.value);
                          setFinalPayment("");
                        }}
                      >
                        <option value="">Select Currency</option>
                        {[...allowedCurrencies].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </FieldBlock>
                  </div>

                  {/* Dynamic Type Panel */}
                  {selectedCounterLedger && paymentType && (
                    <div className="rounded-lg border bg-slate-50/50 p-3 dark:bg-slate-900/20">
                      <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        {paymentType === "cash" && "Cash Details"}
                        {paymentType === "bank" && "Bank Details"}
                        {paymentType === "business" && "Business Details"}
                        {paymentType === "invoice" && "Invoice Details"}
                        {paymentType === "transfer" && "Transfer Details"}
                      </div>
                      
                      {paymentType === "cash" && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <FieldBlock label="Receiver / Sender Name">
                            <Input className="h-9 text-xs" value={typeDetails.receiverSenderName || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, receiverSenderName: e.target.value }))} placeholder="Receiver or sender name" />
                          </FieldBlock>
                          <FieldBlock label="Mobile Number">
                            <Input className="h-9 text-xs" value={typeDetails.mobileNumber || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, mobileNumber: e.target.value }))} placeholder="Mobile number" />
                          </FieldBlock>
                          <FieldBlock label="WhatsApp Number">
                            <Input className="h-9 text-xs" value={typeDetails.whatsappNumber || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, whatsappNumber: e.target.value }))} placeholder="WhatsApp number" />
                          </FieldBlock>
                          <FieldBlock label="ID Card Copy Upload">
                            <div className="flex items-center gap-2">
                              <Label className="cursor-pointer flex w-max items-center justify-center h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 border text-slate-500 shadow-sm transition gap-1.5 text-[10px] font-semibold">
                                <Paperclip className="h-3 w-3" />
                                <span>Attach</span>
                                <Input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    setAttachmentFile(file);
                                    setTypeDetails((p) => ({ ...p, idCardCopyName: file?.name || "" }));
                                  }}
                                />
                              </Label>
                              {typeDetails.idCardCopyName && <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1.5 rounded border truncate max-w-[200px]">{typeDetails.idCardCopyName}</span>}
                            </div>
                          </FieldBlock>
                        </div>
                      )}

                      {paymentType === "bank" && (
                        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500">Bank Name</Label>
                            <select
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] font-semibold outline-none"
                              value={typeDetails.bankName || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "__new_bank__") {
                                  openAddOption("bank");
                                } else {
                                  setTypeDetails((prev) => ({ ...prev, bankName: val }));
                                }
                              }}
                            >
                              <option value="">Select Bank</option>
                              {selectedCountry?.iso2 === "AE" && ["Dubai Islamic Bank", "Emirates NBD", "ADCB", "Mashreq Bank", "FAB"].map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                              {selectedCountry?.iso2 === "PK" && ["HBL", "MCB", "UBL", "Meezan", "Bank Alfalah"].map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                              {selectedCountry?.iso2 === "IN" && ["State Bank of India", "HDFC", "ICICI", "Axis Bank"].map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                              {selectedCountry?.iso2 === "AF" && ["Da Afghanistan Bank", "Azizi Bank", "Kabul Bank", "AIB"].map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                              {(!selectedCountry?.iso2 || !["AE", "PK", "IN", "AF"].includes(selectedCountry.iso2)) && ["Central Bank", "Commercial Bank", "National Bank"].map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                              {savedBanks.map((bank, index) => (
                                <option key={`${bank.name}-${index}`} value={bank.name}>{bank.name}</option>
                              ))}
                              <option value="__new_bank__" className="text-blue-700 font-bold">+ New Bank</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500">Method</Label>
                            <select
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] font-semibold outline-none"
                              value={typeDetails.method || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "__new_method__") {
                                  openAddOption("method");
                                } else {
                                  setTypeDetails((prev) => ({ ...prev, method: val }));
                                }
                              }}
                            >
                              <option value="">Select Method</option>
                              {["Cheque", "Mobile Transfer", "Online Transfer", "Bank Transfer"].map((method) => (
                                <option key={method} value={method}>{method}</option>
                              ))}
                              {savedMethods.map((method, index) => (
                                <option key={`${method}-${index}`} value={method}>{method}</option>
                              ))}
                              <option value="__new_method__" className="text-blue-700 font-bold">+ New Method</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500">Ref. No.</Label>
                            <Input
                              className="h-8 text-[11px] font-semibold w-full"
                              value={typeDetails.refNo || ""}
                              onChange={(e) => setTypeDetails((prev) => ({ ...prev, refNo: e.target.value }))}
                              placeholder="Trx number"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500">Upload</Label>
                            <div className="flex items-center gap-2">
                              <Label className="cursor-pointer flex w-max items-center justify-center h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 border text-slate-500 shadow-sm transition gap-1.5 text-[10px] font-semibold">
                                <Paperclip className="h-3 w-3" />
                                <span>Attach</span>
                                <Input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    setAttachmentFile(file);
                                    setTypeDetails((p) => ({ ...p, bankAttachmentName: file?.name || "" }));
                                  }}
                                />
                              </Label>
                              {typeDetails.bankAttachmentName && <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1.5 rounded border truncate max-w-[150px]">{typeDetails.bankAttachmentName}</span>}
                            </div>
                          </div>
                        </div>
                      )}

                      {(paymentType === "business" || paymentType === "invoice") && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <FieldBlock label="Invoice Number">
                            <Input className="h-9 text-xs" value={typeDetails.invoiceNumber || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, invoiceNumber: e.target.value }))} placeholder="Invoice number" />
                          </FieldBlock>
                          <FieldBlock label="Purchase Information">
                            <Input className="h-9 text-xs" value={typeDetails.purchaseInfo || typeDetails.businessName || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, purchaseInfo: e.target.value, businessName: e.target.value }))} placeholder="Purchase information" />
                          </FieldBlock>
                        </div>
                      )}

                      {paymentType === "transfer" && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <FieldBlock label={t(lang, "form.from")}>
                            <Input className="h-9 text-xs" value={typeDetails.from || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, from: e.target.value }))} placeholder="From account" />
                          </FieldBlock>
                          <FieldBlock label={t(lang, "form.to")}>
                            <Input className="h-9 text-xs" value={typeDetails.to || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, to: e.target.value }))} placeholder="To account" />
                          </FieldBlock>
                          <FieldBlock label="Reference" className="md:col-span-2">
                            <Input className="h-9 text-xs" value={typeDetails.ref || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, ref: e.target.value }))} placeholder="Reference" />
                          </FieldBlock>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Currency Rate / Calculations */}
                  {selectedCounterLedger && currency && showCalcPanel && (
                    <div className="rounded-lg border bg-slate-50/50 p-3 dark:bg-slate-900/20">
                      <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Transaction Conversion Details (Local Calculation) ({currency} ➔ {branchCurrency})
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <FieldBlock label={t(lang, "form.quantity")}>
                          <Input className="h-9 text-xs font-semibold" value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} type="number" step="0.0001" min="0" placeholder="e.g. 100" />
                        </FieldBlock>
                        <FieldBlock label={t(lang, "form.transaction_rate")}>
                          <Input className="h-9 text-xs font-semibold" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} type="number" step="0.0001" min="0" disabled={isLocalCurrency} />
                        </FieldBlock>
                        <FieldBlock label={t(lang, "form.operation")}>
                          <select
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-semibold outline-none"
                            value={calcOp}
                            onChange={(e) => setCalcOp(e.target.value as any)}
                          >
                            <option value="mul">Multiply (*)</option>
                            <option value="div">Divide (/)</option>
                          </select>
                        </FieldBlock>
                      </div>
                    </div>
                  )}

                  {/* Amount, Debit/Credit Selector */}
                  {selectedCounterLedger && currency && (
                    <div className="space-y-3">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FieldBlock label={t(lang, "form.debit_credit")} required>
                          <div className="grid grid-cols-2 gap-2 h-10">
                            <Button
                              type="button"
                              variant={paymentMode === "DEBIT" ? "default" : "outline"}
                              className={cn("h-10 text-[11px] font-black", paymentMode === "DEBIT" ? "bg-emerald-700 hover:bg-emerald-800 text-white" : "")}
                              onClick={() => {
                                setPaymentMode("DEBIT");
                                setRoznamchaBookType("branch_payment_voucher");
                              }}
                            >
                              Debit
                              <span className="block text-[9px] opacity-75 font-medium">(Receive)</span>
                            </Button>
                            <Button
                              type="button"
                              variant={paymentMode === "CREDIT" ? "default" : "outline"}
                              className={cn("h-10 text-[11px] font-black", paymentMode === "CREDIT" ? "bg-red-700 hover:bg-red-800 text-white" : "")}
                              onClick={() => {
                                setPaymentMode("CREDIT");
                                setRoznamchaBookType("branch_payment_voucher");
                              }}
                            >
                              Credit
                              <span className="block text-[9px] opacity-75 font-medium">(Pay)</span>
                            </Button>
                          </div>
                        </FieldBlock>

                        <FieldBlock label={t(lang, "form.final_amount")} required>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                              {branchCurrency}
                            </span>
                            <Input
                              className="h-10 pl-12 text-right text-xs font-black"
                              value={showCalcPanel && calcFinal !== null ? calcFinal.toFixed(2) : finalPayment}
                              onChange={(e) => setFinalPayment(e.target.value)}
                              placeholder="0.00"
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={showCalcPanel && calcFinal !== null}
                            />
                          </div>
                        </FieldBlock>
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500">
                        Credit = جمع رقم (Money Paid) | Debit = ادا رقم (Money Received)
                      </div>
                    </div>
                  )}

                  {/* Details and Remarks */}
                  {selectedCounterLedger && currency && (
                    <div className="space-y-4">
                      <FieldBlock label={t(lang, "form.remarks_notes")}>
                        <textarea
                          rows={3}
                          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Manually add additional descriptions, comments, explanations, or transaction notes..."
                        />
                      </FieldBlock>

                      <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 justify-end">
                        <Button
                          type="button"
                          onClick={() => {
                            resetPaymentDraft();
                            setMessage("Form reset.");
                          }}
                          variant="outline"
                          className="h-10 px-4 rounded-lg font-bold gap-2 text-xs"
                        >
                          <RefreshCw className="h-4 w-4" />
                          {t(lang, "form.reset")}
                        </Button>
                        <Button
                          type="button"
                          disabled={!canSave || saving}
                          onClick={async () => {
                            const newId = await save();
                            if (newId) {
                              resetPaymentDraft();
                              setMessage(`کامیابی سے منظور ہو گیا! آپ اگلی ٹرانزیکشن درج کر سکتے ہیں۔`); // "Accepted successfully! You can enter the next transaction."
                            }
                          }}
                          className="h-10 px-8 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs"
                        >
                          <Save className="h-4 w-4" />
                          {saving ? "Processing..." : "Accept"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">


            {/* Live Payment Report Card */}
            {selectedCounterLedger ? (
              <div className="space-y-4">
                <Card className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="border-b border-blue-200 bg-gradient-to-r from-blue-50 to-white px-4 py-2 dark:from-slate-900 dark:to-slate-950">
                    <CardTitle className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                      <span>📄 Professional Live Payment Report</span>
                      <span className="text-[10px] normal-case text-slate-500 font-semibold">{session?.user?.email ?? "-"}</span>
                    </CardTitle>
                  </div>
                  <CardContent className="p-3 space-y-3">
                    <div className="grid gap-3">
                      <ReportBox
                        rows={[
                          ["Amount", txAmount ? `${fmtAmount(txAmount)} ${currency.toUpperCase()}` : "-"],
                          ...(showCalcPanel && amount ? [["Final Payment (Converted)", `${fmtAmount(amount)} ${targetAccountCurrency}`]] : []),
                          ["Payment Type", paymentType ? `${paymentType[0]!.toUpperCase()}${paymentType.slice(1)} Roznamcha` : "-"]
                        ].filter(Boolean) as Array<[string, string]>}
                      />
                    </div>

                    {paymentMode && paymentType && (
                      <ReportBox
                        title="Ledger Entry Impact"
                        rows={[
                          ["Transaction Type", paymentMode === "DEBIT" ? "Debit (Money Received)" : "Credit (Money Paid)"],
                          ["Amount", amount ? `${fmtAmount(amount)} ${targetAccountCurrency}` : "-"],
                          ["Balance Effect", paymentMode === "DEBIT" ? "Add to account balance" : "Reduce account balance"]
                        ]}
                      />
                    )}
                    
                    <ReportBox title="Narration / Remarks" rows={[["", [computedDetails, remarks].filter(Boolean).join("\n") || "-"]]} />

                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-black gap-2"
                      onClick={() => {
                        const payload = {
                          countryId,
                          countryBranchId,
                          cityBranchId,
                          entryDate,
                          roznamchaBookType,
                          attachmentName: attachmentFile?.name ?? null,
                          transactionType: paymentMode,
                          roznamchaCategory: paymentType,
                          paymentDetails: typeDetails,
                          currency,
                          exchangeRate,
                          exchangeRateSource,
                          exchangeRateEffectiveAt,
                          quantity: 1,
                          finalPayment: amount,
                          narration: [computedDetails, remarks].filter(Boolean).join("\n"),
                          referenceNo
                        };
                        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `cash-entry-${entryDate || "draft"}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <DownloadActionIcon className="h-4 w-4" />
                      Export Draft (JSON)
                    </Button>
                  </CardContent>
                </Card>

                {/* Report Summary Card */}
                {paymentMode && amount && currency ? (
                  <Card className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="border-b border-slate-200 bg-white px-4 py-2 dark:from-slate-900 dark:to-slate-950">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        📊 Report Summary
                      </h3>
                    </div>
                    <CardContent className="p-3 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                        <span className="font-semibold text-slate-500">Total Debit (Received)</span>
                        <span className="font-black text-emerald-700 text-sm">
                          {paymentMode === "DEBIT" ? `${fmtAmount(amount)} ${targetAccountCurrency}` : "0.00"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                        <span className="font-semibold text-slate-500">Total Credit (Paid)</span>
                        <span className="font-black text-red-700 text-sm">
                          {paymentMode === "CREDIT" ? `${fmtAmount(amount)} ${targetAccountCurrency}` : "0.00"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 font-bold bg-white dark:bg-slate-900 p-2 rounded-lg border">
                        <span className="font-black text-slate-800 dark:text-slate-100">Net Amount</span>
                        <span className="font-black text-blue-700 text-base">
                          {fmtAmount(amount)} {targetAccountCurrency}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : (
              <Card className="overflow-hidden rounded-xl border-dashed border-slate-200 bg-white/70 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 h-full min-h-[300px] grid place-items-center">
                <div className="p-6 text-center text-xs font-semibold text-slate-400 space-y-2">
                  <p className="text-sm">🔍 Live Payment Report Preview</p>
                  <p className="max-w-[280px]">Select Account, Payment Category, Currency, Amount and Debit/Credit to display the live report.</p>
                </div>
              </Card>
            )}
          </div>
        </div>
        ) : null}

        {/* Recent Cash Entries Table Card */}
        <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-4 py-3 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                📋 Recent Cash Entries
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                <span className="bg-white border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 px-2.5 py-1 rounded flex gap-1 items-center">
                  Total Entries: <span className="font-bold text-slate-900 dark:text-slate-100">{recentEntriesSummary.count}</span>
                </span>
                <span className="bg-rose-50 border border-rose-100 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 px-2.5 py-1 rounded flex gap-1 items-center">
                  Total CR: <span className="font-bold">{fmtAmount(recentEntriesSummary.totalCredit)}</span>
                </span>
                <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 px-2.5 py-1 rounded flex gap-1 items-center">
                  Total DR: <span className="font-bold">{fmtAmount(recentEntriesSummary.totalDebit)}</span>
                </span>
                <span className="bg-blue-50 border border-blue-100 text-blue-700 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300 px-2.5 py-1 rounded flex gap-1 items-center">
                  Balance: <span className="font-bold">{fmtAmount(recentEntriesSummary.balance)}</span> <span className="text-[9px] uppercase">{recentEntriesSummary.balanceType}</span>
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {!showPaymentWorkReport && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-7 px-3 text-[10px] font-black bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    resetPaymentDraft();
                    setShowPaymentWorkReport(true);
                  }}
                >
                  + New Entry
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[10px] font-bold"
                onClick={fetchRecentEntries}
                disabled={loadingEntries}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loadingEntries ? "animate-spin" : "")} />
                Refresh
              </Button>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                <thead className="bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <tr className="text-left">
                    <th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Date & History</th>
                    <th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Serials & Vouchers</th>
                    <th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Roznamcha Category</th>
                    <th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Account Details</th>
                    <th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Numbers</th>
                    <th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Details</th>
                    <th className="p-3 font-bold text-center border border-slate-200 dark:border-slate-800">Credit/Debit</th>
                    <th className="p-3 font-bold text-right border border-slate-200 dark:border-slate-800">Payment</th>
                    <th className="p-3 font-bold text-center border border-slate-200 dark:border-slate-800">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingEntries ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-medium italic border border-slate-200 dark:border-slate-800">
                        Loading entries...
                      </td>
                    </tr>
                  ) : recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-medium italic border border-slate-200 dark:border-slate-800">
                        No entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentEntries.flatMap((row) => {
                      return (row.roznamcha_lines || []).map((line: any, idx: number) => {
                        const isDebit = Number(line.debit || 0) > 0;
                        const isCredit = Number(line.credit || 0) > 0;
                        const amountVal = isDebit ? Number(line.debit) : Number(line.credit);
                        
                        const type = line.payment_entry_type || row.type || "";
                        const sign = isDebit ? "+" : isCredit ? "-" : "";
                        const amountStr = `${sign}${fmtAmount(amountVal)} ${line.currency || ""}`;
                        
                        const typeBadge = isDebit ? (
                          <span className="rounded bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Debit
                          </span>
                        ) : isCredit ? (
                          <span className="rounded bg-rose-50 px-2.5 py-0.5 font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                            Credit
                          </span>
                        ) : (
                          <span className="rounded bg-slate-50 px-2.5 py-0.5 font-bold text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
                            {type || "-"}
                          </span>
                        );

                        return (
                          <tr key={`${row.id}-${line.id || idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                            <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{new Date(row.created_at).toLocaleString()}</div>
                              <div className="text-[10px] text-muted-foreground mt-1">Creator: {row.profiles?.full_name || row.created_by || "System"}</div>
                              <div className="text-[10px] text-muted-foreground">Location: {row.countries?.name || "-"} | {row.city_branches?.name || row.country_branches?.name || "-"}</div>
                            </td>
                            <td className="p-3 font-mono text-[10.5px] border border-slate-200 dark:border-slate-800 align-top">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between rounded bg-blue-50/50 px-1.5 py-0.5 dark:bg-blue-900/20">
                                  <span className="font-bold text-blue-600/70 dark:text-blue-400/70" title="Journal / Country Serial">JRN/CTRY:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate ml-2 max-w-[120px]">{row.country_transaction_serial_number || row.super_admin_serial_number || row.journal_no || "-"}</span>
                                </div>
                                <div className="flex items-center justify-between rounded bg-slate-50 px-1.5 py-0.5 dark:bg-slate-800/50">
                                  <span className="font-bold text-slate-500" title="Branch / Main Serial">BRN/MAIN:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate ml-2 max-w-[120px]">{row.branch_transaction_serial_number || row.voucher_no || "-"}</span>
                                </div>
                                <div className="flex items-center justify-between rounded bg-slate-50 px-1.5 py-0.5 dark:bg-slate-800/50">
                                  <span className="font-bold text-slate-500" title="Account Country Serial">ACC-CTY:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate ml-2 max-w-[120px]">{line.country_serial_number || "-"}</span>
                                </div>
                                <div className="flex items-center justify-between rounded bg-slate-50 px-1.5 py-0.5 dark:bg-slate-800/50">
                                  <span className="font-bold text-slate-500" title="Account Branch Serial">ACC-BRN:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate ml-2 max-w-[120px]">{line.branch_serial_number || "-"}</span>
                                </div>
                              </div>
                            </td>
                          <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                            <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-[11px] font-bold text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/30">
                              {getRoznamchaCategoryLabel(row)}
                            </span>
                          </td>
                          <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                              <div className="flex flex-col gap-2">
                                <div>
                                  <span className={cn(
                                    "text-[9px] font-bold uppercase tracking-wider mr-1",
                                    isDebit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                  )}>
                                    {isDebit ? "DR" : "CR"}
                                  </span>
                                  <span className={cn(
                                    "inline-flex max-w-fit items-center rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-bold shadow-sm",
                                    isDebit ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300" :
                                    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/30 dark:bg-rose-950/20 dark:text-rose-300"
                                  )}>
                                    {line.account_number || "—"}
                                  </span>
                                  <span className={cn(
                                    "text-[10px] font-bold mt-0.5 line-clamp-2 block",
                                    isDebit ? "text-emerald-900 dark:text-emerald-100" : "text-rose-900 dark:text-rose-100"
                                  )}>
                                    {line.ledgers?.name || "—"}
                                  </span>
                                </div>
                              </div>
                            </td>
                          <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                            <div className="flex flex-col gap-1">
                              {row.source_reference_no ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-bold uppercase text-slate-400">Order:</span>
                                  <span className="font-mono text-[10.5px] font-bold text-blue-700 dark:text-blue-400" title="Source Booking/Order">
                                    {row.source_reference_no}
                                  </span>
                                </div>
                              ) : null}
                              {line.manual_reference_number ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-bold uppercase text-slate-400">Manual:</span>
                                  <span className="font-mono text-[10.5px] font-bold text-slate-700 dark:text-slate-300" title="Manual Number">
                                    {line.manual_reference_number}
                                  </span>
                                </div>
                              ) : null}
                              {line.customer_number ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-bold uppercase text-slate-400">Cust:</span>
                                  <span className="font-mono text-[10.5px] font-bold text-slate-500 dark:text-slate-400" title="Customer Number">
                                    {line.customer_number}
                                  </span>
                                </div>
                              ) : null}
                              {!row.source_reference_no && !line.manual_reference_number && !line.customer_number ? (
                                <span className="text-[10px] text-slate-400 italic">—</span>
                              ) : null}
                            </div>
                          </td>
                            <td className="p-3 text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-400 max-w-[200px] border border-slate-200 dark:border-slate-800" title={line.description || row.narration || ""}>
                              <div className="line-clamp-3">
                                {line.description || row.narration || "-"}
                              </div>
                            </td>
                          <td className="p-3 text-center whitespace-nowrap border border-slate-200 dark:border-slate-800">
                            {typeBadge}
                          </td>
                          <td className={cn(
                            "p-3 text-right font-black whitespace-nowrap border border-slate-200 dark:border-slate-800",
                            isDebit ? "text-emerald-700 dark:text-emerald-450" : isCredit ? "text-red-650 dark:text-red-400" : "text-slate-900 dark:text-slate-100"
                          )}>
                            {amountStr}
                          </td>
                          <td className="p-3 text-center border border-slate-200 dark:border-slate-800">
                            {idx === 0 ? (
                              <div className="flex items-center justify-center gap-1.5">
                                {canEditOrDelete && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] font-bold border-slate-200 text-blue-600 hover:bg-slate-50 dark:border-slate-800"
                                    onClick={() => handleEditEntry(row)}
                                  >
                                    Edit
                                  </Button>
                                )}
                                
                                <div className="relative">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 border-none hover:bg-slate-100 dark:hover:bg-slate-900"
                                    onClick={() => setActiveRowMenuId(activeRowMenuId === row.id ? null : row.id)}
                                  >
                                    <MoreVertical className="h-4 w-4 text-slate-400" />
                                  </Button>
                                  
                                  {activeRowMenuId === row.id && (
                                    <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-md border border-slate-200 bg-white shadow-lg outline-none dark:border-slate-700 dark:bg-slate-900">
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        onClick={() => {
                                          setActiveRowMenuId(null);
                                          openA4ReportWindow(row.id);
                                        }}
                                      >
                                        <Printer className="h-3.5 w-3.5" />
                                        Print A4
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
                                          Delete
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
                <Label className="text-xs font-black">Bank Name</Label>
                <Input
                  className="text-xs font-semibold"
                  value={addOptionValue}
                  onChange={(e) => setAddOptionValue(e.target.value)}
                  placeholder="e.g. HBL Karachi Branch"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-black">Bank Address</Label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={addOptionAddress}
                  onChange={(e) => setAddOptionAddress(e.target.value)}
                  placeholder="Enter bank physical branch address..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setAddOptionOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs" onClick={commitAddOption}>
                  Save Bank
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 pb-3 border-b">
                <Label className="text-xs font-black">Add New Payment Method</Label>
                <div className="flex gap-2">
                  <Input
                    className="text-xs font-semibold"
                    value={addOptionValue}
                    onChange={(e) => setAddOptionValue(e.target.value)}
                    placeholder="e.g. EasyPaisa / JazzCash"
                  />
                  <Button type="button" className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs" onClick={commitAddOption}>
                    Add
                  </Button>
                </div>
              </div>

              {savedMethods.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs font-black">Custom Methods List (Click text to rename, or Blur to save)</Label>
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
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-400 italic text-center py-2">
                  No custom payment methods added yet.
                </p>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setAddOptionOpen(false)}>
                  Close
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


