"use client";

import { pl } from "@/lib/reports/print-label";
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Save,
  Building2,
  Loader2,
  ArrowRightLeft,
  RefreshCw,
  Search,
  Eye,
  CheckCircle2,
  Coins,
  Printer,
  FileDown,
  FileSpreadsheet,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  ChevronDown,
  X,
  Radio,
  Wallet,
  ArrowRight
} from "lucide-react";
import { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { SimpleModal } from "@/components/ui/simple-modal";
import { cn } from "@/lib/utils";
import { PersonPicker } from "@/components/erp/person-picker";
import { BankPicker } from "@/features/banks/components/bank-picker";
import { getBankById } from "@/features/banks/bank-api";
import { VoiceDictateButton } from "@/components/voice-dictate-button";

const CCY = ["AED", "USD", "PKR", "EUR", "GBP", "AFN", "SAR", "INR"];

type MoneyExchangeEntry = {
  id?: string;
  serial_no: string;
  branch_id: string;
  entry_date: string;
  transaction_type: string;
  account_no?: string;
  qty_currency: string;
  ex_currency: string;
  operation: string;
  rate: number;
  quantity: number;
  final_amount: number;
  receipt_name?: string;
  received_from?: string;
  mobile?: string;
  details?: string;
  profit_base_currency?: number;
  received_type?: string;
  purchase_country?: string;
  purchase_city?: string;
  purchased_from?: string;
  received_country?: string;
  received_city?: string;
  received_office_name?: string;
  received_office_numbers?: string;
  purchase_account_id?: string | null;
  sales_account_id?: string | null;
  purchase_account_code?: string | null;
  purchase_account_name?: string | null;
  sales_account_code?: string | null;
  sales_account_name?: string | null;
  status?: string;
  created_at?: string;
};

type SessionInfo = {
  user: { id: string; email: string | null; fullName: string | null };
  roles: string[];
  scopes: any;
};

type StockRow = { currency: string; opening: number; purchased: number; sold: number; available: number; avgRate: number };
type Kpis = { todaysPurchases: number; todaysPurchasesCount: number; todaysSales: number; todaysSalesCount: number };
type AccountOpt = { id: string; code: string; name: string; currency?: string | null; city_branch_id?: string | null };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmtNum(v: number) {
  return (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Real Account Master search box — filters the already-loaded enterprise_accounts list client-side. */
function AccountSelect({
  label,
  accounts,
  value,
  onSelect,
  placeholder
}: {
  label: string;
  accounts: AccountOpt[];
  value: AccountOpt | null;
  onSelect: (acc: AccountOpt | null) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? accounts.filter(a => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)) : accounts;
    return pool.slice(0, 30);
  }, [accounts, query]);

  return (
    <div className="space-y-1 relative" ref={boxRef}>
      <Label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          value={value ? `${value.code} - ${value.name}` : query}
          onChange={(e) => { setQuery(e.target.value); onSelect(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs font-bold outline-none"
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full min-w-[260px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {filtered.length === 0 ? (
            <div className="p-2.5 text-[11px] text-slate-400">{query ? "No matching account." : "Start typing to search…"}</div>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { onSelect(a); setQuery(""); setOpen(false); }}
                className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="font-bold text-slate-800 dark:text-slate-200">{a.code} - {a.name}</span>
                {a.currency ? <span className="text-[10px] text-slate-400">{a.currency}</span> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function MoneyExchangeForm({ lang: _initialLang }: { lang: SupportedLanguage }) {
  const lang = useActiveLanguage();
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<MoneyExchangeEntry | null>(null);

  const [purchaseCountryId, setPurchaseCountryId] = useState("");
  const [receivedCountryId, setReceivedCountryId] = useState("");

  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchCurrency, setBranchCurrency] = useState("PKR");
  const [entrySerial, setEntrySerial] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso());

  // Page-level (dashboard) date-range + transaction-type filters
  const [dashDateFrom, setDashDateFrom] = useState(todayIso());
  const [dashDateTo, setDashDateTo] = useState(todayIso());
  const [dashTxnType, setDashTxnType] = useState("all");

  const [saving, setSaving] = useState(false);
  const [loadingBills, setLoadingBills] = useState(false);
  const [recentBills, setRecentBills] = useState<MoneyExchangeEntry[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ todaysPurchases: 0, todaysPurchasesCount: 0, todaysSales: 0, todaysSalesCount: 0 });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [transactionType, setTransactionType] = useState<"Purchase" | "Sale">("Purchase");
  const [receivedType, setReceivedType] = useState("Name");
  const [purchaseCountry, setPurchaseCountry] = useState("");
  const [purchaseCity, setPurchaseCity] = useState("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
  const [purchasedFromPersonId, setPurchasedFromPersonId] = useState("");
  const [receivedCountry, setReceivedCountry] = useState("");
  const [receivedCity, setReceivedCity] = useState("");
  const [receivedOfficeName, setReceivedOfficeName] = useState("");
  const [receivedOfficeNumberType, setReceivedOfficeNumberType] = useState("Mobile");
  const [receivedOfficeNumberValue, setReceivedOfficeNumberValue] = useState("");

  const [qtyCurrency, setQtyCurrency] = useState("");
  const [exCurrency, setExCurrency] = useState("");
  const [operation, setOperation] = useState<"multiply" | "divide">("multiply");
  const [rate, setRate] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [finalAmount, setFinalAmount] = useState<number>(0);

  const [purchaseAccount, setPurchaseAccount] = useState<AccountOpt | null>(null);
  const [salesAccount, setSalesAccount] = useState<AccountOpt | null>(null);
  const [saleOption, setSaleOption] = useState<"stock" | "credit">("stock");

  const [receiptName, setReceiptName] = useState("");
  const [receiptPersonId, setReceiptPersonId] = useState("");
  const [receiptBankId, setReceiptBankId] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [mobile, setMobile] = useState("");
  const [details, setDetails] = useState("");
  const [profit, setProfit] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQtyCur, setSearchQtyCur] = useState("");
  const [searchExCur, setSearchExCur] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<any>("/api/erp/auth/session"),
      apiGet<any>("/api/erp/locations/countries?withBranchesOnly=true"),
      apiGet<any>("/api/branch-management/city-branches"),
      apiGet<any>("/api/erp/accounting/accounts?limit=1000")
    ]).then(([sess, cRes, bRes, aRes]) => {
      if (!active) return;
      setSessionInfo(sess);
      setCountries(cRes?.countries || cRes?.data || []);
      setAccounts((aRes?.accounts || []).map((a: any) => ({ id: a.id, code: a.code, name: a.name, currency: a.currency, city_branch_id: a.city_branch_id })));

      const branchesList = bRes?.cityBranches || bRes?.entries || bRes?.data || [];
      setBranches(branchesList);

      let defaultBranchId = sess?.scopes?.cityBranchIds?.[0] || sess?.scopes?.countryBranchIds?.[0] || "";
      if (!defaultBranchId) {
        defaultBranchId = branchesList?.[0]?.id || "";
      }
      setSelectedBranch(defaultBranchId);
      if (defaultBranchId) {
        const br = branchesList?.find((x: any) => x.id === defaultBranchId);
        if (br) {
          setSelectedCountry(br.country_id);
          setBranchCurrency(br.local_currency || br.currency_code || "PKR");
        } else if (sess?.scopes?.countryIds?.[0]) {
          setSelectedCountry(sess.scopes.countryIds[0]);
        }
      } else if (sess?.scopes?.countryIds?.[0]) {
        setSelectedCountry(sess.scopes.countryIds[0]);
      }
    }).catch(console.error);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      const brCode = branches.find(b => b.id === selectedBranch)?.code || "BR";
      const random = String(Math.floor(Math.random() * 9000) + 1000);
      const period = entryDate.replace(/-/g, "").slice(0, 6);
      setEntrySerial(`${brCode}-EX-${period}-${random}`);
    }
  }, [selectedBranch, entryDate, branches]);

  const fetchRecentBills = async () => {
    if (!selectedBranch) return;
    try {
      setLoadingBills(true);
      const qs = new URLSearchParams({ branchId: selectedBranch });
      if (dashDateFrom) qs.set("dateFrom", dashDateFrom);
      if (dashDateTo) qs.set("dateTo", dashDateTo);
      if (dashTxnType !== "all") qs.set("transactionType", dashTxnType);
      const res = await apiGet<any>(`/api/erp/money-exchange?${qs.toString()}`);
      if (res && res.entries) {
        setRecentBills(res.entries);
        setStock(res.stock || []);
        setKpis(res.kpis || { todaysPurchases: 0, todaysPurchasesCount: 0, todaysSales: 0, todaysSalesCount: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch recent entries", err);
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchRecentBills();
  }, [selectedBranch, dashDateFrom, dashDateTo, dashTxnType]);

  useEffect(() => {
    const r = Number(rate) || 0;
    const q = Number(quantity) || 0;
    if (r > 0 && q > 0) {
      const f = operation === "divide" ? q / r : q * r;
      setFinalAmount(f);
    } else {
      setFinalAmount(0);
    }
  }, [rate, quantity, operation]);

  const handleBranchChange = (branchId: string) => {
    setSelectedBranch(branchId);
    const br = branches.find((x: any) => x.id === branchId);
    if (br) {
      setSelectedCountry(br.country_id);
      setBranchCurrency(br.local_currency || br.currency_code || "PKR");
    }
  };

  const resetForm = () => {
    setRate("");
    setQuantity("");
    setFinalAmount(0);
    setReceiptName("");
    setReceiptPersonId("");
    setReceiptBankId("");
    setReceivedFrom("");
    setMobile("");
    setDetails("");
    setPurchasedFrom("");
    setPurchasedFromPersonId("");
    setReceivedOfficeName("");
    setReceivedOfficeNumberValue("");
    setQtyCurrency("");
    setExCurrency("");
    setSaleOption("stock");
    setFormError(null);
  };

  const branchAccounts = useMemo(
    () => accounts.filter(a => !a.city_branch_id || a.city_branch_id === selectedBranch),
    [accounts, selectedBranch]
  );

  // Real stock for the currently selected "sell" currency, from the dashboard's real stock aggregate
  const availableStockForSale = useMemo(() => {
    const row = stock.find(s => s.currency === qtyCurrency);
    return row ? row.available : 0;
  }, [stock, qtyCurrency]);

  const save = async (status: "draft" | "posted") => {
    setFormError(null);
    if (!selectedBranch) return setFormError(tr("money_exchange.err_select_branch", "Please select a valid Branch."));
    if (!entrySerial) return setFormError(tr("money_exchange.err_no_serial", "Serial number not generated."));
    if (!qtyCurrency || !exCurrency || finalAmount <= 0) return setFormError(tr("money_exchange.err_formula", "Please complete formula fields properly."));
    if (transactionType === "Sale" && saleOption === "stock" && Number(quantity) > availableStockForSale) {
      return setFormError(
        tr("money_exchange.err_insufficient_stock", "Insufficient stock. Available: {qty} {cur}. Switch to Invoice / Credit Sale to proceed.")
          .replace("{qty}", fmtNum(availableStockForSale)).replace("{cur}", qtyCurrency)
      );
    }

    setSaving(true);
    try {
      const payload = {
        serialNo: entrySerial,
        branchId: selectedBranch,
        entryDate,
        transactionType,
        qtyCurrency,
        exCurrency,
        operation,
        rate: Number(rate),
        quantity: Number(quantity),
        finalAmount,
        receiptName: receiptName.trim() || null,
        receiptPersonId: receiptPersonId || null,
        receiptBankId: receiptBankId || null,
        receivedFrom: receivedFrom.trim() || null,
        mobile: mobile.trim() || null,
        details: details.trim() || null,
        profitBaseCurrency: profit || 0,
        receivedType: receivedType || null,
        purchaseCountry: purchaseCountry.trim() || null,
        purchaseCity: purchaseCity.trim() || null,
        purchasedFrom: purchasedFrom.trim() || null,
        purchasedFromPersonId: purchasedFromPersonId || null,
        receivedCountry: receivedCountry.trim() || null,
        receivedCity: receivedCity.trim() || null,
        receivedOfficeName: receivedOfficeName.trim() || null,
        receivedOfficeNumbers: receivedOfficeNumberValue.trim() ? `${receivedOfficeNumberType}: ${receivedOfficeNumberValue.trim()}` : null,
        purchaseAccountId: purchaseAccount?.id || null,
        salesAccountId: salesAccount?.id || null,
        status
      };

      await apiPost("/api/erp/money-exchange", payload);

      setIsModalOpen(false);
      resetForm();

      setSuccessMessage(status === "draft"
        ? tr("money_exchange.save_draft_success", "Draft saved.")
        : tr("money_exchange.save_success", "Money exchange entry saved successfully!"));
      setTimeout(() => setSuccessMessage(null), 4000);

      fetchRecentBills();
    } catch (err: any) {
      setFormError(err.message || tr("money_exchange.err_save", "Failed to save entry."));
    } finally {
      setSaving(false);
    }
  };

  const billMatches = (b: MoneyExchangeEntry) => {
      const matchQty = searchQtyCur ? b.qty_currency?.toLowerCase().includes(searchQtyCur.toLowerCase()) : true;
      const matchEx = searchExCur ? b.ex_currency?.toLowerCase().includes(searchExCur.toLowerCase()) : true;
      const matchType = filterType === "ALL" ? true : b.transaction_type === filterType;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = q ? (
        b.serial_no?.toLowerCase().includes(q) ||
        b.receipt_name?.toLowerCase().includes(q) ||
        b.received_from?.toLowerCase().includes(q) ||
        b.details?.toLowerCase().includes(q) ||
        b.mobile?.toLowerCase().includes(q)
      ) : true;

      return matchQty && matchEx && matchType && matchSearch;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredBills = useMemo(() => recentBills.filter(billMatches), [recentBills, searchQtyCur, searchExCur, filterType, searchQuery]);

  const billPrintRow = (b: MoneyExchangeEntry) => {
    const isPurchase = b.transaction_type === "Purchase";
    return {
      ...b,
      account: isPurchase
        ? (b.purchase_account_code ? `${b.purchase_account_code}-${b.purchase_account_name}` : "")
        : (b.sales_account_code ? `${b.sales_account_code}-${b.sales_account_name}` : ""),
      party: b.receipt_name || b.received_from || "",
      type_label: isPurchase ? tr("money_exchange.badge_purchase", "Purchase") : tr("money_exchange.badge_sale", "Sale"),
      status_label: (b.status || "posted") === "posted" ? tr("money_exchange.dash_completed", "Completed") : tr("money_exchange.dash_pending", "Pending"),
    } as unknown as Record<string, unknown>;
  };

  const stockValueInBranchCurrency = useMemo(
    () => stock.reduce((sum, s) => sum + s.available * (s.avgRate || 0), 0),
    [stock]
  );

  const lowStockRows = useMemo(
    () => stock.filter(s => s.available > 0 && s.purchased > 0 && s.available < s.purchased * 0.15),
    [stock]
  );

  function stockStatusOf(s: StockRow): "out" | "low" | "in" {
    if (s.available <= 0) return "out";
    if (s.purchased > 0 && s.available < s.purchased * 0.15) return "low";
    return "in";
  }

  const selectedBranchLabel = branches.find(b => b.id === selectedBranch);
  const selectedCountryLabel = countries.find(c => c.id === selectedCountry)?.name || "—";

  const exportCsv = () => {
    const headers = [
      tr("money_exchange.serial_date_header", "Serial & Date"),
      tr("money_exchange.type_header", "Type"),
      tr("money_exchange.qty_cur_label", "Qty Cur."),
      tr("money_exchange.ex_cur_label", "Ex. Cur."),
      tr("money_exchange.quantity_label", "Quantity"),
      tr("money_exchange.rate_label", "Rate"),
      tr("money_exchange.final_amount_label", "Final Amount"),
      tr("money_exchange.party_details_header", "Party / Received From"),
      tr("money_exchange.dash_status", "Status")
    ];
    const rows = filteredBills.map(b => [
      `${b.serial_no} ${b.entry_date}`, b.transaction_type, b.qty_currency, b.ex_currency,
      String(b.quantity), String(b.rate), String(b.final_amount),
      b.receipt_name || b.received_from || "", b.status || "posted"
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `money_exchange_${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-[1700px] p-4 space-y-4" dir={isRtl ? "rtl" : "ltr"}>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header: title + filters + actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {tr("money_exchange.dash_title", "Money Exchange Dashboard")}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {tr("money_exchange.dash_subtitle", "Manage currency stock, purchase & sales transactions for your branch.")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => { resetForm(); setIsModalOpen(true); }} size="sm" className="h-9 px-3.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-1.5">
            <Plus className="h-3.5 w-3.5 stroke-[3]" />
            <span>{tr("money_exchange.new_entry_btn", "New Entry")}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="h-9 px-3 text-xs font-bold gap-1.5">
            <Printer className="h-3.5 w-3.5" /> {tr("money_exchange.dash_print", "Print")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="h-9 px-3 text-xs font-bold gap-1.5">
            <FileDown className="h-3.5 w-3.5" /> {tr("money_exchange.dash_pdf", "PDF")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} className="h-9 px-3 text-xs font-bold gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" /> {tr("money_exchange.dash_excel", "Excel")}
          </Button>
        </div>
      </div>

      {/* Filter row: Branch / Date Range / Transaction Type */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{tr("money_exchange.branch_label", "Branch")}</Label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-bold" value={selectedBranch} onChange={e => handleBranchChange(e.target.value)}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{tr("money_exchange.dash_date_range", "Date Range")}</Label>
          <div className="flex items-center gap-1.5">
            <input type="date" value={dashDateFrom} onChange={e => setDashDateFrom(e.target.value)} className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs font-bold" />
            <span className="text-slate-400">–</span>
            <input type="date" value={dashDateTo} onChange={e => setDashDateTo(e.target.value)} className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs font-bold" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{tr("money_exchange.dash_transaction_type", "Transaction Type")}</Label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-bold" value={dashTxnType} onChange={e => setDashTxnType(e.target.value)}>
            <option value="all">{tr("money_exchange.all_types", "All Types")}</option>
            <option value="Purchase">{tr("money_exchange.opt_purchase", "Purchase")}</option>
            <option value="Sale">{tr("money_exchange.opt_sale", "Sale")}</option>
          </select>
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-blue-600" /> {tr("money_exchange.dash_branch_user_details", "Branch & User Details")}
            </span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between"><span className="text-slate-500">{tr("money_exchange.branch_label", "Branch")}</span><span className="font-bold text-slate-800 dark:text-slate-200">{selectedBranchLabel?.name || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{tr("money_exchange.dash_country", "Country")}</span><span className="font-bold text-slate-800 dark:text-slate-200">{selectedCountryLabel}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{tr("money_exchange.dash_user", "User")}</span><span className="font-bold text-slate-800 dark:text-slate-200">{sessionInfo?.user?.fullName || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{tr("money_exchange.dash_role", "Role")}</span><span className="font-bold text-slate-800 dark:text-slate-200">{sessionInfo?.roles?.[0]?.replace(/_/g, " ") || "—"}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 shadow-sm dark:border-emerald-950 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-100/70 dark:border-emerald-900/40">
            <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-emerald-600" /> {tr("money_exchange.dash_stock_value", "Currency Stock Value")}
            </span>
          </div>
          <div className="text-lg font-black text-emerald-800 dark:text-emerald-300">
            {branchCurrency} {fmtNum(stockValueInBranchCurrency)}
          </div>
          <div className="text-[10px] text-slate-500">{tr("money_exchange.dash_approx_value", "(Approx. value, weighted by purchase rate)")}</div>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 shadow-sm dark:border-blue-950 dark:bg-blue-950/20">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-100/70 dark:border-blue-900/40">
            <span className="text-xs font-black text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <ArrowDownCircle className="h-3.5 w-3.5 text-blue-600" /> {tr("money_exchange.dash_todays_purchases", "Today's Purchases")}
            </span>
          </div>
          <div className="text-lg font-black text-blue-800 dark:text-blue-300">{branchCurrency} {fmtNum(kpis.todaysPurchases)}</div>
          <div className="text-[10px] text-slate-500">{kpis.todaysPurchasesCount} {tr("money_exchange.dash_transactions", "Transactions")}</div>
        </div>

        <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3.5 shadow-sm dark:border-purple-950 dark:bg-purple-950/20">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-purple-100/70 dark:border-purple-900/40">
            <span className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
              <ArrowUpCircle className="h-3.5 w-3.5 text-purple-600" /> {tr("money_exchange.dash_todays_sales", "Today's Sales")}
            </span>
          </div>
          <div className="text-lg font-black text-purple-800 dark:text-purple-300">{branchCurrency} {fmtNum(kpis.todaysSales)}</div>
          <div className="text-[10px] text-slate-500">{kpis.todaysSalesCount} {tr("money_exchange.dash_transactions", "Transactions")}</div>
        </div>
      </div>

      {/* Two-column: main tables + side live report */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Currency Stock by Branch */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-blue-600" /> {tr("money_exchange.dash_currency_stock_by_branch", "Currency Stock by Branch")}
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={fetchRecentBills} disabled={loadingBills} className="h-7 px-2.5 text-[11px] font-bold gap-1">
                <RefreshCw className={cn("h-3 w-3", loadingBills && "animate-spin")} /> {tr("common.refresh", "Refresh")}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr className="text-left">
                    <Th className="p-2.5 font-bold">{tr("money_exchange.dash_currency", "Currency")}</Th>
                    <Th className="p-2.5 font-bold text-right">{tr("money_exchange.dash_opening_stock", "Opening Stock")}</Th>
                    <Th className="p-2.5 font-bold text-right">{tr("money_exchange.dash_purchased", "Purchased")}</Th>
                    <Th className="p-2.5 font-bold text-right">{tr("money_exchange.dash_sold", "Sold")}</Th>
                    <Th className="p-2.5 font-bold text-right">{tr("money_exchange.dash_available_stock", "Available Stock")}</Th>
                    <Th className="p-2.5 font-bold text-right">{tr("money_exchange.dash_reserved", "Reserved")}</Th>
                    <Th className="p-2.5 font-bold text-right">{tr("money_exchange.dash_avg_rate", "Average Rate")}</Th>
                    <Th className="p-2.5 font-bold text-center">{tr("money_exchange.dash_stock_status", "Stock Status")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stock.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-400 italic">{tr("money_exchange.dash_no_stock", "No stock movement yet for this branch.")}</td></tr>
                  ) : stock.map(s => {
                    const status = stockStatusOf(s);
                    return (
                      <tr key={s.currency} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/50">
                        <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">{s.currency}</td>
                        <td className="p-2.5 text-right font-mono">{fmtNum(s.opening)}</td>
                        <td className="p-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">{fmtNum(s.purchased)}</td>
                        <td className="p-2.5 text-right font-mono text-rose-700 dark:text-rose-400">{fmtNum(s.sold)}</td>
                        <td className="p-2.5 text-right font-mono font-black text-slate-900 dark:text-slate-100">{fmtNum(s.available)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-400">0.00</td>
                        <td className="p-2.5 text-right font-mono">{fmtNum(s.avgRate)}</td>
                        <td className="p-2.5 text-center">
                          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black",
                            status === "in" && "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
                            status === "low" && "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
                            status === "out" && "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                          )}>
                            {status === "in" ? tr("money_exchange.dash_in_stock", "In Stock") : status === "low" ? tr("money_exchange.dash_low_stock", "Low Stock") : tr("money_exchange.dash_out_of_stock", "Out of Stock")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exchange Transactions Report */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ArrowRightLeft className="h-4 w-4 text-blue-600" /> {tr("money_exchange.exchange_report_title", "Exchange Transactions Report")}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <Input placeholder={tr("money_exchange.search_party_placeholder", "Search by currency, party, account...")} className="h-8 w-56 text-xs" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-[11px] font-bold">
                  <option value="ALL">{tr("money_exchange.all_types", "All Types")}</option>
                  <option value="Purchase">{tr("money_exchange.opt_purchase", "Purchase")}</option>
                  <option value="Sale">{tr("money_exchange.opt_sale", "Sale")}</option>
                </select>
                <JournalPrintButton
                  title={tr("money_exchange.exchange_report_title", "Exchange Transactions Report")}
                  subtitle={selectedBranchLabel ? `${selectedBranchLabel.name} (${selectedBranchLabel.code})` : undefined}
                  columns={[
                    { key: "serial_no", label: tr("money_exchange.dash_serial", "Serial"), align: "center" },
                    { key: "entry_date", label: tr("money_exchange.detail_date", "Date"), align: "center", format: "date" },
                    { key: "type_label", label: tr("money_exchange.type_header", "Type"), align: "center" },
                    { key: "qty_currency", label: tr("money_exchange.dash_buy_currency", "Buy Currency"), align: "center" },
                    { key: "ex_currency", label: tr("money_exchange.dash_sell_currency", "Sell Currency"), align: "center" },
                    { key: "quantity", label: tr("money_exchange.quantity_label", "Quantity"), align: "right", format: "number" },
                    { key: "rate", label: tr("money_exchange.rate_label", "Rate"), align: "right", format: "number" },
                    { key: "final_amount", label: tr("money_exchange.final_amount_header", "Final Amount"), align: "right", format: "number" },
                    { key: "account", label: tr("money_exchange.dash_account", "Account") },
                    { key: "party", label: tr("money_exchange.dash_party", "Party") },
                    { key: "status_label", label: tr("money_exchange.dash_status", "Status"), align: "center" },
                  ]}
                  rows={filteredBills.map(billPrintRow)}
                  fetchFullData={async () => {
                    if (!selectedBranch) return [];
                    const qs = new URLSearchParams({ branchId: selectedBranch, limit: "5000" });
                    if (dashDateFrom) qs.set("dateFrom", dashDateFrom);
                    if (dashDateTo) qs.set("dateTo", dashDateTo);
                    if (dashTxnType !== "all") qs.set("transactionType", dashTxnType);
                    const res = await apiGet<any>(`/api/erp/money-exchange?${qs.toString()}`);
                    return ((res?.entries ?? []) as MoneyExchangeEntry[]).filter(billMatches).map(billPrintRow);
                  }}
                  filters={[
                    ...(dashDateFrom ? [{ label: tr("money_exchange.dash_date_range", "Date Range"), value: `${dashDateFrom} - ${dashDateTo || ""}` }] : []),
                    ...(filterType !== "ALL" ? [{ label: tr("money_exchange.type_header", "Type"), value: filterType }] : []),
                    ...(searchQuery.trim() ? [{ label: pl("Search"), value: searchQuery.trim() }] : []),
                  ]}
                  orientation="landscape"
                />
                <Button type="button" variant="outline" size="sm" onClick={fetchRecentBills} disabled={loadingBills} className="h-8 px-2 text-[11px] font-bold">
                  <RefreshCw className={cn("h-3.5 w-3.5", loadingBills && "animate-spin")} />
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr className="text-left">
                    <Th className="p-2.5 font-bold">{tr("money_exchange.dash_serial", "Serial")}</Th>
                    <Th className="p-2.5 font-bold">{tr("money_exchange.detail_date", "Date")}</Th>
                    <Th className="p-2.5 font-bold text-center">{tr("money_exchange.type_header", "Type")}</Th>
                    <Th className="p-2.5 font-bold">{tr("money_exchange.dash_buy_currency", "Buy Currency")}</Th>
                    <Th className="p-2.5 font-bold">{tr("money_exchange.dash_sell_currency", "Sell Currency")}</Th>
                    <Th className="p-2.5 font-bold text-right">{tr("money_exchange.quantity_label", "Quantity")}</Th>
                    <Th className="p-2.5 font-bold text-right">{tr("money_exchange.rate_label", "Rate")}</Th>
                    <Th className="p-2.5 font-bold text-right">{tr("money_exchange.final_amount_header", "Final Amount")}</Th>
                    <Th className="p-2.5 font-bold">{tr("money_exchange.dash_account", "Account")}</Th>
                    <Th className="p-2.5 font-bold">{tr("money_exchange.dash_party", "Party")}</Th>
                    <Th className="p-2.5 font-bold text-center">{tr("money_exchange.dash_status", "Status")}</Th>
                    <Th className="p-2.5 font-bold text-center">{tr("common.actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingBills ? (
                    <tr><td colSpan={12} className="p-10 text-center text-slate-400 italic"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />{tr("common.loading", "Loading transactions...")}</td></tr>
                  ) : filteredBills.length === 0 ? (
                    <tr><td colSpan={12} className="p-10 text-center text-slate-400 italic">{tr("money_exchange.no_entries_found", "No exchange entries found.")}</td></tr>
                  ) : filteredBills.map((b, idx) => {
                    const isPurchase = b.transaction_type === "Purchase";
                    const acct = isPurchase
                      ? (b.purchase_account_code ? `${b.purchase_account_code}-${b.purchase_account_name}` : "—")
                      : (b.sales_account_code ? `${b.sales_account_code}-${b.sales_account_name}` : "—");
                    const isPosted = (b.status || "posted") === "posted";
                    return (
                      <tr key={b.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                        <td className="p-2.5 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{b.entry_date ? String(b.entry_date).slice(0, 10) : "—"}</td>
                        <td className="p-2.5 text-center">
                          <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase",
                            isPurchase ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300")}>
                            {isPurchase ? tr("money_exchange.badge_purchase", "Purchase") : tr("money_exchange.badge_sale", "Sale")}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono font-bold">{b.qty_currency}</td>
                        <td className="p-2.5 font-mono font-bold">{b.ex_currency}</td>
                        <td className="p-2.5 text-right font-mono">{fmtNum(b.quantity)}</td>
                        <td className="p-2.5 text-right font-mono">{b.rate}</td>
                        <td className="p-2.5 text-right font-mono font-black">{fmtNum(b.final_amount)}</td>
                        <td className="p-2.5 text-[11px] text-slate-600 dark:text-slate-400">{acct}</td>
                        <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{b.receipt_name || b.received_from || "—"}</td>
                        <td className="p-2.5 text-center">
                          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black",
                            isPosted ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300")}>
                            {isPosted ? tr("money_exchange.dash_completed", "Completed") : tr("money_exchange.dash_pending", "Pending")}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-blue-600" onClick={() => setViewEntry(b)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />{tr("money_exchange.view_btn", "View")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{tr("money_exchange.dash_map_accounts_notice", "Every branch must map its ERP Purchase and Sales accounts before entry.")}</span>
          </div>
        </div>

        {/* Right: Live Branch Report */}
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-emerald-500" /> {tr("money_exchange.dash_live_branch_report", "Live Branch Report")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {tr("money_exchange.dash_live", "Live")}
              </span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-slate-500">{tr("money_exchange.branch_label", "Branch")}</span><span className="font-bold text-slate-800 dark:text-slate-200">{selectedBranchLabel?.name || "—"}</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="text-xs font-black text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-blue-600" /> {tr("money_exchange.dash_current_stock_qty", "Current Currency Stock (Qty)")}
            </div>
            <div className="space-y-1.5">
              {stock.slice(0, 6).map(s => (
                <div key={s.currency} className="flex items-center justify-between text-[11px]">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{s.currency}</span>
                  <span className="font-mono font-black text-slate-900 dark:text-slate-100">{fmtNum(s.available)}</span>
                </div>
              ))}
              {stock.length === 0 && <div className="text-[11px] text-slate-400 italic">{tr("money_exchange.dash_no_stock", "No stock movement yet for this branch.")}</div>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="text-xs font-black text-slate-800 dark:text-slate-100 mb-2">{tr("money_exchange.dash_todays_totals", "Today's Totals")} ({branchCurrency})</div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-slate-500">{tr("money_exchange.dash_todays_purchases", "Today's Purchases")}</span><span className="font-mono font-black text-blue-700 dark:text-blue-400">{fmtNum(kpis.todaysPurchases)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{tr("money_exchange.dash_todays_sales", "Today's Sales")}</span><span className="font-mono font-black text-purple-700 dark:text-purple-400">{fmtNum(kpis.todaysSales)}</span></div>
            </div>
          </div>

          {lowStockRows.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> {tr("money_exchange.dash_low_stock_alert", "Low Stock Alert")}
                </span>
                <span className="rounded-full bg-amber-600 px-1.5 text-[10px] font-black text-white">{lowStockRows.length}</span>
              </div>
              <div className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                {lowStockRows.map(r => `${r.currency} (${fmtNum(r.available)})`).join(", ")} {tr("money_exchange.dash_running_low", "running low")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* On-Demand Money Exchange Entry Modal */}
      {isModalOpen && (
        <SimpleModal
          title={tr("money_exchange.modal_title", "New Money Exchange Entry")}
          onClose={() => setIsModalOpen(false)}
          className="max-w-6xl max-h-[92vh] overflow-y-auto"
        >
          <div className="grid grid-cols-1 gap-4 p-1 lg:grid-cols-[1fr_300px]">
            <div className="space-y-4">
              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {formError}
                </div>
              )}

              {/* Section 1 */}
              <div className="rounded-xl border border-indigo-100 bg-slate-50/50 shadow-xs dark:border-indigo-900/50 dark:bg-slate-900/40">
                <div className="flex items-center justify-between py-2.5 px-3.5 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900 border-b border-indigo-100 dark:border-indigo-900/40 rounded-t-xl">
                  <span className="text-xs uppercase font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" /> {tr("money_exchange.section1_title", "1. Branch, User & Account Mapping")}
                  </span>
                  <span className="bg-white dark:bg-slate-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    {entrySerial || tr("money_exchange.pending", "Pending...")}
                  </span>
                </div>
                <div className="p-3.5 space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">{tr("money_exchange.branch_label", "Branch")}</Label>
                      <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" value={selectedBranch} onChange={e => handleBranchChange(e.target.value)}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">{tr("money_exchange.dash_country", "Country")}</Label>
                      <div className="h-9 flex items-center rounded-md border border-input bg-slate-50 dark:bg-slate-900 px-2 text-xs font-bold text-slate-700 dark:text-slate-300">{selectedCountryLabel}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">{tr("money_exchange.dash_user", "User")}</Label>
                      <div className="h-9 flex items-center rounded-md border border-input bg-slate-50 dark:bg-slate-900 px-2 text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{sessionInfo?.user?.fullName || "—"}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">{tr("money_exchange.date_label", "Date")}</Label>
                      <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <AccountSelect
                      label={tr("money_exchange.dash_purchase_account", "Purchase Account *")}
                      accounts={branchAccounts}
                      value={purchaseAccount}
                      onSelect={setPurchaseAccount}
                      placeholder={tr("money_exchange.dash_search_account", "Search Account Master…")}
                    />
                    <AccountSelect
                      label={tr("money_exchange.dash_sales_account", "Sales Account *")}
                      accounts={branchAccounts}
                      value={salesAccount}
                      onSelect={setSalesAccount}
                      placeholder={tr("money_exchange.dash_search_account", "Search Account Master…")}
                    />
                  </div>
                  <p className="text-[10.5px] text-slate-500">{tr("money_exchange.dash_erp_account_note", "ERP accounts are branch-specific and required before transaction.")}</p>
                </div>
              </div>

              {/* Section 2 */}
              <div className="rounded-xl border border-amber-200 bg-white shadow-xs dark:border-amber-900/50 dark:bg-slate-950">
                <div className="py-2.5 px-3.5 bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900 border-b border-amber-100 dark:border-amber-900/40 rounded-t-xl">
                  <span className="text-xs uppercase font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    {tr("money_exchange.section2_title", "2. Transaction Type")}
                  </span>
                </div>
                <div className="p-3.5 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setTransactionType("Purchase")}
                      className={cn("flex items-center justify-center gap-2 rounded-lg h-10 text-xs font-black transition",
                        transactionType === "Purchase" ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
                      <ArrowDownCircle className="h-4 w-4" /> {tr("money_exchange.opt_purchase", "Purchase")}
                    </button>
                    <button type="button" onClick={() => setTransactionType("Sale")}
                      className={cn("flex items-center justify-center gap-2 rounded-lg h-10 text-xs font-black transition",
                        transactionType === "Sale" ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
                      <ArrowUpCircle className="h-4 w-4" /> {tr("money_exchange.opt_sale", "Sale")}
                    </button>
                  </div>

                  <div className={cn("rounded-lg px-3 py-2 text-[11px] font-semibold flex items-center gap-1.5",
                    transactionType === "Purchase" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300")}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {transactionType === "Purchase"
                      ? tr("money_exchange.dash_purchase_increases_stock", "Purchase increases selected currency stock directly.")
                      : tr("money_exchange.dash_sale_decreases_stock", "Sale decreases selected currency stock directly.")}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        {transactionType === "Purchase" ? tr("money_exchange.dash_purchase_currency", "Purchase Currency") : tr("money_exchange.dash_sale_currency", "Sale Currency")}
                      </Label>
                      <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" value={qtyCurrency} onChange={e => setQtyCurrency(e.target.value)}>
                        <option value="">--</option>
                        {CCY.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        {transactionType === "Purchase" ? tr("money_exchange.dash_pay_currency", "Pay Currency") : tr("money_exchange.dash_receive_currency", "Receive Currency")}
                      </Label>
                      <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" value={exCurrency} onChange={e => setExCurrency(e.target.value)}>
                        <option value="">--</option>
                        {CCY.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{tr("money_exchange.op_label", "Op")}</Label>
                      <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" value={operation} onChange={e => setOperation(e.target.value as any)}>
                        <option value="multiply">×</option>
                        <option value="divide">÷</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{tr("money_exchange.rate_label", "Rate")}</Label>
                      <Input type="number" step="0.000001" className="h-8 text-xs font-mono font-bold" value={rate} onChange={e => setRate(e.target.value ? Number(e.target.value) : "")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{tr("money_exchange.quantity_label", "Quantity")}</Label>
                      <Input type="number" step="0.01" className="h-8 text-xs font-mono font-bold" value={quantity} onChange={e => setQuantity(e.target.value ? Number(e.target.value) : "")} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-1">
                      <Label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{tr("money_exchange.final_amount_label", "Final Amount")}</Label>
                      <Input readOnly value={finalAmount > 0 ? finalAmount.toFixed(2) : ""} className="h-8 text-xs font-mono font-black bg-indigo-50/50 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800" />
                    </div>
                    {transactionType === "Sale" && (
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{tr("money_exchange.dash_available_stock", "Available Stock")}</Label>
                        <div className="h-8 flex items-center rounded-md border border-emerald-200 bg-emerald-50/60 px-2 text-xs font-black text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                          {qtyCurrency || "—"} {fmtNum(availableStockForSale)}
                        </div>
                      </div>
                    )}
                  </div>

                  {transactionType === "Sale" && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => setSaleOption("stock")}
                        className={cn("rounded-lg border px-3 py-2 text-left text-[11px] font-bold",
                          saleOption === "stock" ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-slate-200 text-slate-600 dark:border-slate-700")}>
                        {tr("money_exchange.dash_sell_from_stock", "Sell from Stock")}
                        <div className="text-[10px] font-medium text-slate-500">{tr("money_exchange.dash_sufficient_stock", "Sufficient stock required")}</div>
                      </button>
                      <button type="button" onClick={() => setSaleOption("credit")}
                        className={cn("rounded-lg border px-3 py-2 text-left text-[11px] font-bold",
                          saleOption === "credit" ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" : "border-slate-200 text-slate-600 dark:border-slate-700")}>
                        {tr("money_exchange.dash_invoice_credit_sale", "Invoice / Credit Sale")}
                        <div className="text-[10px] font-medium text-slate-500">{tr("money_exchange.dash_bypass_stock_check", "Bypasses the stock check")}</div>
                      </button>
                    </div>
                  )}

                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      {tr("money_exchange.dash_source_party_details", "Source Party Details")}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.dash_party_type", "Party Type")}</Label>
                        <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" value={receivedType}
                          onChange={e => { setReceivedType(e.target.value); setReceiptPersonId(""); setReceiptBankId(""); setReceiptName(""); }}>
                          <option value="Name">{tr("money_exchange.opt_name", "Customer")}</option>
                          <option value="Agent">{tr("money_exchange.opt_agent", "Agent")}</option>
                          <option value="Bank">{tr("money_exchange.opt_bank", "Bank")}</option>
                          <option value="Other">{tr("money_exchange.opt_other", "Other")}</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        {receivedType === "Bank" ? (
                          <BankPicker label={tr("money_exchange.name_label", "Name")} value={receiptBankId}
                            onValueChange={async (bankId) => {
                              setReceiptBankId(bankId); setReceiptPersonId("");
                              if (!bankId) return;
                              try { const bank = await getBankById(bankId); if (bank?.bank_name) setReceiptName(bank.bank_name); } catch { /* ignore */ }
                            }} />
                        ) : receivedType === "Name" ? (
                          <PersonPicker label={tr("money_exchange.name_label", "Name")} value={receiptPersonId}
                            onValueChange={async (personId) => {
                              setReceiptPersonId(personId); setReceiptBankId("");
                              if (!personId) return;
                              try { const res = await apiGet<{ customer: { customer_name?: string } }>(`/api/erp/customers/${personId}`); if (res?.customer?.customer_name) setReceiptName(res.customer.customer_name); } catch { /* ignore */ }
                            }} />
                        ) : (
                          <>
                            <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.name_label", "Name")}</Label>
                            <Input className="h-8 text-xs font-semibold" value={receiptName} onChange={e => setReceiptName(e.target.value)} />
                          </>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.mobile_whatsapp_label", "Mobile/WhatsApp")}</Label>
                        <Input className="h-8 text-xs font-semibold" value={mobile} onChange={e => setMobile(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.details_label", "Details / Reference")}</Label>
                          <VoiceDictateButton context="roznamcha" lang={lang} value={details} onChange={setDetails} />
                        </div>
                        <Input className="h-8 text-xs font-semibold" value={details} onChange={e => setDetails(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Live Stock & Posting Preview */}
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs font-black text-slate-800 dark:text-slate-100 mb-0.5 flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-emerald-500" /> {tr("money_exchange.dash_live_stock_posting_preview", "Live Stock & Posting Preview")}
                </div>
                <p className="text-[10px] text-slate-500 mb-2">{tr("money_exchange.dash_posting_preview_subtitle", "Current branch currency stock and estimated accounting impact")}</p>
                <div className="space-y-1.5">
                  {stock.slice(0, 5).map(s => (
                    <div key={s.currency} className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{s.currency}</span>
                      <span className="font-mono font-black text-slate-900 dark:text-slate-100">{fmtNum(s.available)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs font-black text-slate-800 dark:text-slate-100 mb-2">{tr("money_exchange.dash_posting_preview", "Posting Preview")} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800">{tr("money_exchange.dash_informational_only", "informational only")}</span></div>
                {finalAmount > 0 && (purchaseAccount || salesAccount) ? (
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{transactionType === "Purchase" ? "Dr" : "Cr"} {(transactionType === "Purchase" ? purchaseAccount : salesAccount)?.code || "—"}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fmtNum(finalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{transactionType === "Purchase" ? "Cr" : "Dr"} {qtyCurrency ? `${tr("money_exchange.dash_currency_stock", "Currency Stock")} (${qtyCurrency})` : "—"}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fmtNum(finalAmount)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">{tr("money_exchange.dash_complete_form_preview", "Complete the form to see the estimated posting.")}</div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs font-black text-slate-800 dark:text-slate-100 mb-2">{tr("money_exchange.dash_balance_after_entry", "Branch Balance After Entry")} <span className="text-[10px] font-normal text-slate-400">({tr("money_exchange.dash_estimate", "Estimate")})</span></div>
                {qtyCurrency ? (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{qtyCurrency}</span>
                    <span className="flex items-center gap-1 font-mono">
                      {fmtNum(availableStockForSale)} <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className={cn("font-black", transactionType === "Purchase" ? "text-emerald-600" : "text-rose-600")}>
                        {fmtNum(transactionType === "Purchase" ? availableStockForSale + Number(quantity || 0) : availableStockForSale - Number(quantity || 0))}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">—</div>
                )}
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-500 dark:bg-slate-900">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                  {tr("money_exchange.dash_preview_only_note", "Preview only — no ledger posting is created by this screen.")}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={saving} className="font-bold text-xs">
              {tr("money_exchange.cancel_button", "Cancel")}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={saving || !qtyCurrency || !exCurrency || finalAmount <= 0} onClick={() => save("draft")} className="font-black text-xs px-4">
              {tr("money_exchange.dash_save_draft", "Save Draft")}
            </Button>
            <Button type="button" size="sm" disabled={saving || !qtyCurrency || !exCurrency || finalAmount <= 0} onClick={() => save("posted")} className="font-black text-xs px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-md">
              {saving ? (<><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{tr("money_exchange.saving_label", "Saving...")}</>) : (<><Save className="h-3.5 w-3.5 mr-1.5" />{tr("money_exchange.dash_save_and_post", "Save & Post")}</>)}
            </Button>
          </div>
        </SimpleModal>
      )}

      {/* View Detail Modal */}
      {viewEntry && (
        <SimpleModal title={`${tr("money_exchange.detail_title", "Exchange Entry Details")}: ${viewEntry.serial_no}`} onClose={() => setViewEntry(null)} className="max-w-md">
          <div className="space-y-3 p-1 text-xs">
            <div className="grid grid-cols-2 gap-2 border-b pb-2">
              <div><span className="text-slate-400 font-medium">{tr("money_exchange.detail_serial", "Serial:")}</span><div className="font-mono font-bold text-blue-700 dark:text-blue-400">{viewEntry.serial_no}</div></div>
              <div><span className="text-slate-400 font-medium">{tr("money_exchange.detail_date", "Date:")}</span><div className="font-bold text-slate-800 dark:text-slate-200">{viewEntry.entry_date}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-b pb-2">
              <div><span className="text-slate-400 font-medium">{tr("money_exchange.detail_txn_type", "Transaction Type:")}</span><div className="font-black text-slate-900 dark:text-slate-100">{viewEntry.transaction_type}</div></div>
              <div><span className="text-slate-400 font-medium">{tr("money_exchange.detail_final", "Final Amount:")}</span><div className="font-mono font-black text-sm text-emerald-600">{fmtNum(viewEntry.final_amount || 0)} {viewEntry.ex_currency}</div></div>
            </div>
            <div className="border-b pb-2">
              <span className="text-slate-400 font-medium">{tr("money_exchange.detail_formula", "Formula:")}</span>
              <div className="font-bold text-slate-800 dark:text-slate-200">{viewEntry.quantity} {viewEntry.qty_currency} {viewEntry.operation === "divide" ? "÷" : "×"} {viewEntry.rate} = {viewEntry.final_amount} {viewEntry.ex_currency}</div>
            </div>
            {(viewEntry.purchase_account_code || viewEntry.sales_account_code) && (
              <div className="border-b pb-2">
                <span className="text-slate-400 font-medium">{tr("money_exchange.dash_account", "Account")}:</span>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  {viewEntry.transaction_type === "Purchase"
                    ? (viewEntry.purchase_account_code ? `${viewEntry.purchase_account_code} - ${viewEntry.purchase_account_name}` : "—")
                    : (viewEntry.sales_account_code ? `${viewEntry.sales_account_code} - ${viewEntry.sales_account_name}` : "—")}
                </div>
              </div>
            )}
            {(viewEntry.receipt_name || viewEntry.received_from || viewEntry.mobile) && (
              <div className="border-b pb-2">
                <span className="text-slate-400 font-medium">{tr("money_exchange.detail_party", "Party / Recv Info:")}</span>
                <div className="font-bold text-slate-800 dark:text-slate-200">{viewEntry.receipt_name || viewEntry.received_from || "-"}</div>
                {viewEntry.mobile && <div className="text-slate-500 font-mono">{tr("money_exchange.detail_phone", "Phone:")} {viewEntry.mobile}</div>}
              </div>
            )}
            {viewEntry.details && (
              <div><span className="text-slate-400 font-medium">{tr("money_exchange.detail_notes", "Details / Notes:")}</span><div className="text-slate-700 dark:text-slate-300 italic">{viewEntry.details}</div></div>
            )}
          </div>
        </SimpleModal>
      )}
    </div>
  );
}
