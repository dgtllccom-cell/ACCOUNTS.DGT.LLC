"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Plus, 
  Save, 
  Settings2, 
  Building2, 
  Loader2, 
  ArrowRightLeft, 
  RefreshCw, 
  Filter,
  Eye,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Coins
} from "lucide-react";
import { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { SimpleModal } from "@/components/ui/simple-modal";
import { cn } from "@/lib/utils";
import { PersonPicker } from "@/components/erp/person-picker";
import { BankPicker } from "@/features/banks/components/bank-picker";
import { getBankById } from "@/features/banks/bank-api";

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
  created_at?: string;
};

type SessionInfo = {
  user: { id: string; email: string | null; fullName: string | null };
  roles: string[];
  scopes: any;
};

export function MoneyExchangeForm({ lang: _initialLang }: { lang: SupportedLanguage }) {
  const lang = useActiveLanguage();
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  
  // Modal & View States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<MoneyExchangeEntry | null>(null);

  // Locations states
  const [purchaseCountryId, setPurchaseCountryId] = useState("");
  const [receivedCountryId, setReceivedCountryId] = useState("");

  // Scoping & context
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchCurrency, setBranchCurrency] = useState("PKR");
  const [entrySerial, setEntrySerial] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Loading & Data states
  const [saving, setSaving] = useState(false);
  const [loadingBills, setLoadingBills] = useState(false);
  const [recentBills, setRecentBills] = useState<MoneyExchangeEntry[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
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
  
  const [receiptName, setReceiptName] = useState("");
  const [receiptPersonId, setReceiptPersonId] = useState("");
  const [receiptBankId, setReceiptBankId] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [mobile, setMobile] = useState("");
  const [details, setDetails] = useState("");
  const [profit, setProfit] = useState<number | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQtyCur, setSearchQtyCur] = useState("");
  const [searchExCur, setSearchExCur] = useState("");

  useEffect(() => {
    setPortalNode(document.getElementById("erp-page-actions-slot"));
  }, []);

  // Fetch Session & Initial Data
  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<any>("/api/erp/auth/session"),
      apiGet<any>("/api/erp/locations/countries"),
      apiGet<any>("/api/branch-management/city-branches")
    ]).then(([sess, cRes, bRes]) => {
      if (!active) return;
      setSessionInfo(sess);
      setCountries(cRes?.countries || cRes?.data || []);
      
      const branchesList = bRes?.cityBranches || bRes?.entries || bRes?.data || [];
      setBranches(branchesList);
      
      // Default to user's branch if possible
      let defaultBranchId = sess?.scopes?.cityBranchIds?.[0] || sess?.scopes?.countryBranchIds?.[0] || "";
      if (!defaultBranchId && !sess?.scopes?.isSuperAdmin) {
        defaultBranchId = branchesList?.[0]?.id || "";
      }
      if (!defaultBranchId && branchesList?.length === 1) {
        defaultBranchId = branchesList[0].id;
      }
      setSelectedBranch(defaultBranchId);
      if (defaultBranchId) {
        const br = branchesList?.find((x: any) => x.id === defaultBranchId);
        if (br) {
          setSelectedCountry(br.country_id);
          setBranchCurrency(br.currency_code || "PKR");
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
    // Generate Serial when branch changes
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
      const res = await apiGet<any>(`/api/erp/money-exchange?branchId=${selectedBranch}`);
      if (res && res.entries) {
        setRecentBills(res.entries);
      }
    } catch (err) {
      console.error("Failed to fetch recent entries", err);
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchRecentBills();
  }, [selectedBranch]);

  // Calculations
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
  };

  // Save Entry
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return alert(tr("money_exchange.err_select_branch", "Please select a valid Branch."));
    if (!entrySerial) return alert(tr("money_exchange.err_no_serial", "Serial number not generated."));
    if (!qtyCurrency || !exCurrency || finalAmount <= 0) return alert(tr("money_exchange.err_formula", "Please complete formula fields properly."));
    
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
        receivedOfficeNumbers: receivedOfficeNumberValue.trim() ? `${receivedOfficeNumberType}: ${receivedOfficeNumberValue.trim()}` : null
      };
      
      await apiPost("/api/erp/money-exchange", payload);
      
      // Close modal on success
      setIsModalOpen(false);
      resetForm();
      
      setSuccessMessage(tr("money_exchange.save_success", "Money exchange entry saved successfully!"));
      setTimeout(() => setSuccessMessage(null), 4000);

      // refresh table immediately
      fetchRecentBills();
    } catch (err: any) {
      alert(err.message || tr("money_exchange.err_save", "Failed to save entry."));
    } finally {
      setSaving(false);
    }
  };

  // Filtered entries
  const filteredBills = useMemo(() => {
    return recentBills.filter(b => {
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
    });
  }, [recentBills, searchQtyCur, searchExCur, filterType, searchQuery]);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalPurchases = 0;
    let totalSales = 0;
    recentBills.forEach(b => {
      if (b.transaction_type === "Purchase") totalPurchases += Number(b.final_amount || 0);
      if (b.transaction_type === "Sale") totalSales += Number(b.final_amount || 0);
    });
    return {
      count: recentBills.length,
      totalPurchases,
      totalSales
    };
  }, [recentBills]);

  return (
    <div className="mx-auto w-full max-w-[1700px] p-4 space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Header Action Strip Portal */}
      {portalNode && createPortal(
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="h-8 px-3.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3]" />
            <span>{tr("money_exchange.new_entry_btn", "+ New Entry")}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchRecentBills}
            disabled={loadingBills}
            className="h-8 px-3 text-xs font-bold gap-1"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loadingBills && "animate-spin")} />
            <span>{tr("common.refresh", "Refresh")}</span>
          </Button>
        </div>,
        portalNode
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Top Statistics & Branch Context */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{tr("money_exchange.branch_label", "Branch Scope")}</span>
            <Building2 className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <select 
              className="font-black text-sm bg-transparent border-0 text-slate-900 dark:text-slate-100 p-0 focus:ring-0 cursor-pointer" 
              value={selectedBranch} 
              onChange={e => setSelectedBranch(e.target.value)}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {branchCurrency}
            </span>
          </div>
        </Card>

        <Card className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{tr("money_exchange.total_entries", "Total Transactions")}</span>
            <Coins className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
            {summary.count}
          </div>
        </Card>

        <Card className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 shadow-sm dark:border-emerald-950 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{tr("money_exchange.purchase_volume", "Total Purchases")}</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-lg font-black text-emerald-800 dark:text-emerald-300">
            {summary.totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-semibold">{branchCurrency}</span>
          </div>
        </Card>

        <Card className="rounded-xl border border-rose-100 bg-rose-50/50 p-3.5 shadow-sm dark:border-rose-950 dark:bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">{tr("money_exchange.sale_volume", "Total Sales")}</span>
            <TrendingDown className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-1 text-lg font-black text-rose-800 dark:text-rose-300">
            {summary.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-semibold">{branchCurrency}</span>
          </div>
        </Card>
      </div>

      {/* Main Full-Width Table Card */}
      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-4 py-3 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                📋 {tr("money_exchange.exchange_report_title", "Money Exchange Journal & Report")}
              </h3>
              <p className="text-[10px] font-medium text-slate-500">
                {tr("money_exchange.table_subtitle", "All purchase & sale currency transactions for current branch")}
              </p>
            </div>
          </div>

          {/* Quick Filters and New Entry Trigger */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border bg-white px-2 py-1 dark:bg-slate-900 shadow-2xs">
              <Filter className="h-3 w-3 text-slate-400" />
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="ALL">{tr("money_exchange.all_types", "All Types")}</option>
                <option value="Purchase">{tr("money_exchange.purchase_only", "Purchase Only")}</option>
                <option value="Sale">{tr("money_exchange.sale_only", "Sale Only")}</option>
              </select>
            </div>

            <Input 
              placeholder={tr("money_exchange.search_qty_cur_placeholder", "Qty Cur (AED, PKR...)")} 
              className="h-8 text-xs w-28 bg-white dark:bg-slate-900" 
              value={searchQtyCur} 
              onChange={e => setSearchQtyCur(e.target.value)} 
            />

            <Input 
              placeholder={tr("money_exchange.search_ex_cur_placeholder", "Ex Cur (USD, EUR...)")} 
              className="h-8 text-xs w-28 bg-white dark:bg-slate-900" 
              value={searchExCur} 
              onChange={e => setSearchExCur(e.target.value)} 
            />

            <Input 
              placeholder={tr("money_exchange.search_party_placeholder", "Search Party / Serial...")} 
              className="h-8 text-xs w-44 bg-white dark:bg-slate-900" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />

            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8 px-3.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-1.5"
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
              <span>{tr("money_exchange.new_entry_btn", "+ New Entry")}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-bold"
              onClick={fetchRecentBills}
              disabled={loadingBills}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loadingBills && "animate-spin")} />
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse border border-slate-200 dark:border-slate-800 text-xs">
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <tr className="text-left">
                  <Th className="p-3 font-bold border border-slate-200 dark:border-slate-800">{tr("money_exchange.serial_date_header", "Serial & Date")}</Th>
                  <Th className="p-3 font-bold text-center border border-slate-200 dark:border-slate-800">{tr("money_exchange.type_header", "Type")}</Th>
                  <Th className="p-3 font-bold border border-slate-200 dark:border-slate-800">{tr("money_exchange.exchange_formula_header", "Exchange Formula & Currencies")}</Th>
                  <Th className="p-3 font-bold text-right border border-slate-200 dark:border-slate-800">{tr("money_exchange.final_amount_header", "Final Amount")}</Th>
                  <Th className="p-3 font-bold border border-slate-200 dark:border-slate-800">{tr("money_exchange.party_details_header", "Party / Received From")}</Th>
                  <Th className="p-3 font-bold border border-slate-200 dark:border-slate-800">{tr("money_exchange.location_details_header", "Location & Office")}</Th>
                  <Th className="p-3 font-bold text-center border border-slate-200 dark:border-slate-800">{tr("common.actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {loadingBills ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400 font-medium italic">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                      {tr("common.loading", "Loading transactions...")}
                    </td>
                  </tr>
                ) : filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400 font-medium italic">
                      {tr("money_exchange.no_entries_found", "No exchange entries found.")}
                    </td>
                  </tr>
                ) : (
                  filteredBills.map((b) => {
                    const isPurchase = b.transaction_type === "Purchase";
                    return (
                      <tr key={b.id || b.serial_no} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition">
                        {/* Serial & Date */}
                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                          <div className="font-mono font-bold text-blue-700 dark:text-blue-400 text-[11px]">
                            {b.serial_no}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {b.entry_date}
                          </div>
                        </td>

                        {/* Transaction Type */}
                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top text-center">
                          <span className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                            isPurchase 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
                          )}>
                            {isPurchase ? tr("money_exchange.badge_purchase", "PURCHASE") : tr("money_exchange.badge_sale", "SALE")}
                          </span>
                        </td>

                        {/* Formula & Currencies */}
                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-800">{b.qty_currency}</span>
                            <span className="text-slate-400">&rarr;</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-800">{b.ex_currency}</span>
                          </div>
                          <div className="mt-1 text-[10.5px] text-slate-600 dark:text-slate-400">
                            <span className="font-medium">{tr("money_exchange.qty_label_short", "Qty")}:</span> <span className="font-bold">{b.quantity}</span>
                            <span className="mx-1 text-slate-300">|</span>
                            <span className="font-medium">{tr("money_exchange.op_short", "Op")}:</span> <span className="font-bold">{b.operation === "divide" ? "÷" : "×"}</span>
                            <span className="mx-1 text-slate-300">|</span>
                            <span className="font-medium">{tr("money_exchange.rate_label_short", "Rate")}:</span> <span className="font-bold">{b.rate}</span>
                          </div>
                        </td>

                        {/* Final Amount */}
                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top text-right">
                          <div className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                            {Number(b.final_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">
                            {b.ex_currency || branchCurrency}
                          </div>
                        </td>

                        {/* Party / Received Details */}
                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {b.receipt_name || b.received_from || "—"}
                          </div>
                          {b.received_type && (
                            <span className="inline-block text-[9.5px] font-semibold text-purple-700 dark:text-purple-300 mt-0.5">
                              {tr("money_exchange.type_prefix", "Type:")} {b.received_type}
                            </span>
                          )}
                          {b.mobile && (
                            <div className="text-[10px] text-slate-500">
                              📞 {b.mobile}
                            </div>
                          )}
                          {b.details && (
                            <div className="text-[10px] text-slate-500 italic truncate max-w-[200px]" title={b.details}>
                              {b.details}
                            </div>
                          )}
                        </td>

                        {/* Location Details */}
                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                          {(b.purchase_country || b.purchase_city) && (
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">
                              <span className="font-bold text-slate-400">{tr("money_exchange.purchased_prefix", "Purchased:")}</span> {b.purchase_city || ""}{b.purchase_city && b.purchase_country ? ", " : ""}{b.purchase_country || ""}
                            </div>
                          )}
                          {(b.received_country || b.received_city) && (
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">
                              <span className="font-bold text-slate-400">{tr("money_exchange.recv_prefix", "Recv:")}</span> {b.received_city || ""}{b.received_city && b.received_country ? ", " : ""}{b.received_country || ""}
                            </div>
                          )}
                          {b.received_office_name && (
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">
                              <span className="font-bold text-slate-400">{tr("money_exchange.office_prefix", "Office:")}</span> {b.received_office_name}
                            </div>
                          )}
                          {b.received_office_numbers && (
                            <div className="text-[9.5px] font-mono text-slate-500">
                              {b.received_office_numbers}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                            onClick={() => setViewEntry(b)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            <span>{tr("money_exchange.view_btn", "View")}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* On-Demand Money Exchange Entry Modal / Drawer */}
      {isModalOpen && (
        <SimpleModal
          title={tr("money_exchange.modal_title", "New Money Exchange Entry")}
          onClose={() => setIsModalOpen(false)}
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          <form onSubmit={handleSave} className="space-y-4 p-1">
            {/* Section 1: Branch & Session Details */}
            <Card className="shadow-xs border border-indigo-100 dark:border-indigo-900/50 bg-slate-50/50 dark:bg-slate-900/40">
              <CardHeader className="py-2.5 px-3.5 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900 border-b border-indigo-100 dark:border-indigo-900/40">
                <CardTitle className="text-xs uppercase font-black text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    {tr("money_exchange.section1_title", "1. Branch & Session Details")}
                  </span>
                  <span className="bg-white dark:bg-slate-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    {entrySerial || tr("money_exchange.pending", "Pending...")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 font-medium">{tr("money_exchange.branch_label", "Branch")}</span>
                    <select 
                      className="border-0 bg-transparent text-right font-bold text-slate-800 dark:text-slate-200 p-0 focus:ring-0 cursor-pointer" 
                      value={selectedBranch} 
                      onChange={e => setSelectedBranch(e.target.value)}
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 font-medium">{tr("money_exchange.base_currency_label", "Base Currency")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{branchCurrency}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 font-medium">{tr("money_exchange.user_label", "User")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{sessionInfo?.user?.fullName || "Admin"}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 font-medium">{tr("money_exchange.date_label", "Date")}</span>
                    <input 
                      type="date" 
                      value={entryDate} 
                      onChange={e => setEntryDate(e.target.value)} 
                      className="border-0 bg-transparent text-right font-bold text-slate-800 dark:text-slate-200 p-0 h-4 focus:ring-0 w-28" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Exchange Entry Formula */}
            <Card className="shadow-xs border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-950">
              <CardHeader className="py-2.5 px-3.5 bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900 border-b border-amber-100 dark:border-amber-900/40">
                <CardTitle className="text-xs uppercase font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-amber-600" />
                  {tr("money_exchange.section2_title", "2. Exchange Entry (Simple Formula)")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 space-y-4">
                <div className="w-48 space-y-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{tr("money_exchange.transaction_type_label", "Transaction Type")}</Label>
                  <select 
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-bold text-slate-900 dark:text-slate-100" 
                    value={transactionType} 
                    onChange={e => setTransactionType(e.target.value as any)}
                  >
                    <option value="Purchase">{tr("money_exchange.opt_purchase", "Purchase")}</option>
                    <option value="Sale">{tr("money_exchange.opt_sale", "Sale")}</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                  <div className="space-y-1 col-span-1">
                    <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{tr("money_exchange.qty_cur_label", "Qty Cur.")}</Label>
                    <select 
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" 
                      value={qtyCurrency} 
                      onChange={e => setQtyCurrency(e.target.value)}
                    >
                      <option value="">--</option>
                      <option value="AED">AED</option>
                      <option value="PKR">PKR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="AFN">AFN</option>
                    </select>
                  </div>
                  <div className="space-y-1 col-span-1">
                    <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{tr("money_exchange.ex_cur_label", "Ex. Cur.")}</Label>
                    <select 
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" 
                      value={exCurrency} 
                      onChange={e => setExCurrency(e.target.value)}
                    >
                      <option value="">--</option>
                      <option value="AED">AED</option>
                      <option value="PKR">PKR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="AFN">AFN</option>
                    </select>
                  </div>
                  <div className="space-y-1 col-span-1">
                    <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{tr("money_exchange.op_label", "Op")}</Label>
                    <select 
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" 
                      value={operation} 
                      onChange={e => setOperation(e.target.value as any)}
                    >
                      <option value="multiply">×</option>
                      <option value="divide">÷</option>
                    </select>
                  </div>
                  <div className="space-y-1 col-span-1">
                    <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{tr("money_exchange.rate_label", "Rate")}</Label>
                    <Input 
                      type="number" 
                      step="0.000001" 
                      className="h-8 text-xs font-mono font-bold" 
                      value={rate} 
                      onChange={e => setRate(e.target.value ? Number(e.target.value) : "")} 
                    />
                  </div>
                  <div className="space-y-1 col-span-1">
                    <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{tr("money_exchange.quantity_label", "Quantity")}</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      className="h-8 text-xs font-mono font-bold" 
                      value={quantity} 
                      onChange={e => setQuantity(e.target.value ? Number(e.target.value) : "")} 
                    />
                  </div>
                  <div className="space-y-1 col-span-1">
                    <Label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{tr("money_exchange.final_amount_label", "Final Amount")}</Label>
                    <Input 
                      readOnly 
                      value={finalAmount > 0 ? finalAmount.toFixed(2) : ""} 
                      className="h-8 text-xs font-mono font-black bg-indigo-50/50 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800" 
                    />
                  </div>
                </div>

                {/* Received & Location Details */}
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {tr("money_exchange.received_details_title", "3. Received & Party Details")}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.recv_type_label", "Recv. Type")}</Label>
                      <select 
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" 
                        value={receivedType}
                        onChange={e => {
                          setReceivedType(e.target.value);
                          setReceiptPersonId("");
                          setReceiptBankId("");
                          setReceiptName("");
                        }}
                      >
                        <option value="Name">{tr("money_exchange.opt_name", "Name")}</option>
                        <option value="Agent">{tr("money_exchange.opt_agent", "Agent")}</option>
                        <option value="Bank">{tr("money_exchange.opt_bank", "Bank")}</option>
                        <option value="Other">{tr("money_exchange.opt_other", "Other")}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      {receivedType === "Bank" ? (
                        <BankPicker
                          label={tr("money_exchange.name_label", "Name")}
                          value={receiptBankId}
                          onValueChange={async (bankId) => {
                            setReceiptBankId(bankId);
                            setReceiptPersonId("");
                            if (!bankId) return;
                            try {
                              const bank = await getBankById(bankId);
                              if (bank?.bank_name) setReceiptName(bank.bank_name);
                            } catch { /* ignore */ }
                          }}
                        />
                      ) : receivedType === "Name" ? (
                        <PersonPicker
                          label={tr("money_exchange.name_label", "Name")}
                          value={receiptPersonId}
                          onValueChange={async (personId) => {
                            setReceiptPersonId(personId);
                            setReceiptBankId("");
                            if (!personId) return;
                            try {
                              const res = await apiGet<{ customer: { customer_name?: string } }>(`/api/erp/customers/${personId}`);
                              if (res?.customer?.customer_name) setReceiptName(res.customer.customer_name);
                            } catch { /* ignore */ }
                          }}
                        />
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
                      <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.details_label", "Details")}</Label>
                      <Input className="h-8 text-xs font-semibold" value={details} onChange={e => setDetails(e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.purchase_country_label", "Purchase Country")}</Label>
                      <select 
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold"
                        value={purchaseCountryId}
                        onChange={e => {
                          setPurchaseCountryId(e.target.value);
                          if(e.target.value) {
                            const opt = e.target.options[e.target.selectedIndex];
                            setPurchaseCountry(opt.text);
                          } else {
                            setPurchaseCountry("");
                          }
                          setPurchaseCity("");
                        }}
                      >
                        <option value="">--</option>
                        {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.purchase_city_label", "Purchase City")}</Label>
                      <Input className="h-8 text-xs font-semibold" placeholder={tr("money_exchange.type_city_placeholder", "Type city...")} value={purchaseCity} onChange={e => setPurchaseCity(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <PersonPicker
                        label={tr("money_exchange.purchased_from_label", "Purchased From")}
                        value={purchasedFromPersonId}
                        onValueChange={async (personId) => {
                          setPurchasedFromPersonId(personId);
                          if (!personId) return;
                          try {
                            const res = await apiGet<{ customer: { customer_name?: string } }>(`/api/erp/customers/${personId}`);
                            if (res?.customer?.customer_name) setPurchasedFrom(res.customer.customer_name);
                          } catch { /* ignore */ }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.recv_country_label", "Recv. Country")}</Label>
                      <select 
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold"
                        value={receivedCountryId}
                        onChange={e => {
                          setReceivedCountryId(e.target.value);
                          if(e.target.value) {
                            const opt = e.target.options[e.target.selectedIndex];
                            setReceivedCountry(opt.text);
                          } else {
                            setReceivedCountry("");
                          }
                          setReceivedCity("");
                        }}
                      >
                        <option value="">--</option>
                        {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.recv_city_label", "Recv. City")}</Label>
                      <Input className="h-8 text-xs font-semibold" placeholder={tr("money_exchange.type_city_placeholder", "Type city...")} value={receivedCity} onChange={e => setReceivedCity(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.recv_office_name_label", "Recv. Office Name")}</Label>
                      <Input className="h-8 text-xs font-semibold" value={receivedOfficeName} onChange={e => setReceivedOfficeName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9.5px] uppercase font-bold text-slate-500">{tr("money_exchange.office_number_label", "Office Number")}</Label>
                      <div className="flex gap-1">
                        <select className="w-2/5 h-8 text-[10px] font-bold rounded-md border bg-background px-1" value={receivedOfficeNumberType} onChange={e => setReceivedOfficeNumberType(e.target.value)}>
                          <option value="Mobile">{tr("money_exchange.opt_mobile", "Mobile")}</option>
                          <option value="WhatsApp">{tr("money_exchange.opt_whatsapp", "WhatsApp")}</option>
                          <option value="Office 1">{tr("money_exchange.opt_office1", "Office 1")}</option>
                          <option value="Office 2">{tr("money_exchange.opt_office2", "Office 2")}</option>
                        </select>
                        <Input className="flex-1 h-8 text-xs px-1.5" placeholder={tr("money_exchange.number_placeholder", "Number...")} value={receivedOfficeNumberValue} onChange={e => setReceivedOfficeNumberValue(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={resetForm} 
                disabled={saving}
                className="font-bold text-xs"
              >
                {tr("money_exchange.clear_button", "Clear")}
              </Button>
              <Button 
                type="submit" 
                size="sm" 
                disabled={saving || !qtyCurrency || !exCurrency || finalAmount <= 0} 
                className="font-black text-xs px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {tr("money_exchange.saving_label", "Saving...")}
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {tr("money_exchange.save_button", "Save Exchange Entry")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {/* View Detail Modal */}
      {viewEntry && (
        <SimpleModal
          title={`${tr("money_exchange.detail_title", "Exchange Entry Details")}: ${viewEntry.serial_no}`}
          onClose={() => setViewEntry(null)}
          className="max-w-md"
        >
          <div className="space-y-3 p-1 text-xs">
            <div className="grid grid-cols-2 gap-2 border-b pb-2">
              <div>
                <span className="text-slate-400 font-medium">{tr("money_exchange.detail_serial", "Serial:")}</span>
                <div className="font-mono font-bold text-blue-700 dark:text-blue-400">{viewEntry.serial_no}</div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">{tr("money_exchange.detail_date", "Date:")}</span>
                <div className="font-bold text-slate-800 dark:text-slate-200">{viewEntry.entry_date}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b pb-2">
              <div>
                <span className="text-slate-400 font-medium">{tr("money_exchange.detail_txn_type", "Transaction Type:")}</span>
                <div className="font-black text-slate-900 dark:text-slate-100">{viewEntry.transaction_type}</div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">{tr("money_exchange.detail_final", "Final Amount:")}</span>
                <div className="font-mono font-black text-sm text-emerald-600">
                  {Number(viewEntry.final_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {viewEntry.ex_currency}
                </div>
              </div>
            </div>

            <div className="border-b pb-2">
              <span className="text-slate-400 font-medium">{tr("money_exchange.detail_formula", "Formula:")}</span>
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {viewEntry.quantity} {viewEntry.qty_currency} {viewEntry.operation === "divide" ? "÷" : "×"} {viewEntry.rate} = {viewEntry.final_amount} {viewEntry.ex_currency}
              </div>
            </div>

            {(viewEntry.receipt_name || viewEntry.received_from || viewEntry.mobile) && (
              <div className="border-b pb-2">
                <span className="text-slate-400 font-medium">{tr("money_exchange.detail_party", "Party / Recv Info:")}</span>
                <div className="font-bold text-slate-800 dark:text-slate-200">{viewEntry.receipt_name || viewEntry.received_from || "-"}</div>
                {viewEntry.mobile && <div className="text-slate-500 font-mono">{tr("money_exchange.detail_phone", "Phone:")} {viewEntry.mobile}</div>}
              </div>
            )}

            {viewEntry.details && (
              <div>
                <span className="text-slate-400 font-medium">{tr("money_exchange.detail_notes", "Details / Notes:")}</span>
                <div className="text-slate-700 dark:text-slate-300 italic">{viewEntry.details}</div>
              </div>
            )}
          </div>
        </SimpleModal>
      )}
    </div>
  );
}
