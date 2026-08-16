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
  RefreshCw, 
  ArrowRightLeft, 
  Building2, 
  Eye, 
  Printer, 
  Loader2, 
  Search,
  Calendar,
  DollarSign,
  User,
  CheckCircle2,
  X,
  FileText,
  MapPin,
  Phone
} from "lucide-react";
import { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { SimpleModal } from "@/components/ui/simple-modal";
import { cn } from "@/lib/utils";

type MoneyExchangeEntry = {
  id?: string;
  serial_no: string;
  branch_id: string;
  entry_date: string;
  transaction_type: "Purchase" | "Sale";
  account_no?: string | null;
  qty_currency: string;
  ex_currency: string;
  operation: "multiply" | "divide";
  rate: number;
  quantity: number;
  final_amount: number;
  receipt_name?: string | null;
  received_from?: string | null;
  mobile?: string | null;
  details?: string | null;
  profit_base_currency?: number;
  received_type?: string | null;
  purchase_country?: string | null;
  purchase_city?: string | null;
  purchased_from?: string | null;
  received_country?: string | null;
  received_city?: string | null;
  received_office_name?: string | null;
  received_office_numbers?: string | null;
  created_at?: string;
  created_by?: string;
};

type SessionInfo = {
  user: { id: string; email: string | null; fullName: string | null };
  roles: string[];
  scopes: any;
};

const COMMON_CURRENCIES = ["AED", "PKR", "USD", "EUR", "AFN", "SAR", "GBP", "CNY", "INR", "TRY", "CAD", "AUD"];

export function MoneyExchangeForm({ lang: _initialLang }: { lang: SupportedLanguage }) {
  const lang = useActiveLanguage();
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  
  // State
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  
  // Scoping & context
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchCurrency, setBranchCurrency] = useState("PKR");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entrySerial, setEntrySerial] = useState("");

  // Loading & entries
  const [saving, setSaving] = useState(false);
  const [loadingBills, setLoadingBills] = useState(false);
  const [recentBills, setRecentBills] = useState<MoneyExchangeEntry[]>([]);
  const [successMessage, setSuccessMessage] = useState("");

  // Modal controls
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<MoneyExchangeEntry | null>(null);

  // Form states inside modal
  const [transactionType, setTransactionType] = useState<"Purchase" | "Sale">("Purchase");
  const [qtyCurrency, setQtyCurrency] = useState("");
  const [exCurrency, setExCurrency] = useState("");
  const [operation, setOperation] = useState<"multiply" | "divide">("multiply");
  const [rate, setRate] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [finalAmount, setFinalAmount] = useState<number>(0);
  
  const [receivedType, setReceivedType] = useState("Name");
  const [receiptName, setReceiptName] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [mobile, setMobile] = useState("");
  const [details, setDetails] = useState("");
  
  const [purchaseCountryId, setPurchaseCountryId] = useState("");
  const [purchaseCountry, setPurchaseCountry] = useState("");
  const [purchaseCity, setPurchaseCity] = useState("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
  
  const [receivedCountryId, setReceivedCountryId] = useState("");
  const [receivedCountry, setReceivedCountry] = useState("");
  const [receivedCity, setReceivedCity] = useState("");
  const [receivedOfficeName, setReceivedOfficeName] = useState("");
  const [receivedOfficeNumberType, setReceivedOfficeNumberType] = useState("Mobile");
  const [receivedOfficeNumberValue, setReceivedOfficeNumberValue] = useState("");

  // Filters for Table
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "Purchase" | "Sale">("ALL");

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
          setBranchCurrency(br.currency_code || "PKR");
        }
      }
    }).catch(console.error);
    return () => { active = false; };
  }, []);

  // Generate Serial whenever branch, date or modal changes
  const generateSerial = () => {
    const brCode = branches.find(b => b.id === selectedBranch)?.code || "BR";
    const random = String(Math.floor(Math.random() * 9000) + 1000);
    const period = entryDate.replace(/-/g, "").slice(0, 6);
    return `${brCode}-EX-${period}-${random}`;
  };

  useEffect(() => {
    if (selectedBranch) {
      setEntrySerial(generateSerial());
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

  // Real-time formula calculation
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
    setReceivedFrom("");
    setMobile("");
    setDetails("");
    setPurchasedFrom("");
    setReceivedOfficeName("");
    setReceivedOfficeNumberValue("");
    setEntrySerial(generateSerial());
  };

  // Save Entry Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) {
      alert("Please select a valid Branch.");
      return;
    }
    if (!entrySerial) {
      alert("Serial number not generated.");
      return;
    }
    if (!qtyCurrency || !exCurrency || finalAmount <= 0) {
      alert("Please complete currency and formula fields properly.");
      return;
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
        receivedFrom: receivedFrom.trim() || null,
        mobile: mobile.trim() || null,
        details: details.trim() || null,
        profitBaseCurrency: 0,
        receivedType: receivedType || null,
        purchaseCountry: purchaseCountry.trim() || null,
        purchaseCity: purchaseCity.trim() || null,
        purchasedFrom: purchasedFrom.trim() || null,
        receivedCountry: receivedCountry.trim() || null,
        receivedCity: receivedCity.trim() || null,
        receivedOfficeName: receivedOfficeName.trim() || null,
        receivedOfficeNumbers: receivedOfficeNumberValue.trim() ? `${receivedOfficeNumberType}: ${receivedOfficeNumberValue.trim()}` : null
      };
      
      await apiPost("/api/erp/money-exchange", payload);
      
      setSuccessMessage(`Exchange entry (${entrySerial}) saved successfully!`);
      setTimeout(() => setSuccessMessage(""), 5000);

      resetForm();
      setShowEntryModal(false);
      fetchRecentBills();
    } catch (err: any) {
      alert(err.message || "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  // Filtered entries
  const filteredBills = useMemo(() => {
    return recentBills.filter(b => {
      const matchesSearch = 
        !searchQuery ||
        b.serial_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.qty_currency?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.ex_currency?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.receipt_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.received_from?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.mobile?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.purchased_from?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.details?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = filterType === "ALL" || b.transaction_type === filterType;

      return matchesSearch && matchesType;
    });
  }, [recentBills, searchQuery, filterType]);

  // Statistics Summary
  const summaryStats = useMemo(() => {
    let totalPurchases = 0;
    let totalSales = 0;
    filteredBills.forEach(b => {
      if (b.transaction_type === "Purchase") {
        totalPurchases += Number(b.final_amount || 0);
      } else {
        totalSales += Number(b.final_amount || 0);
      }
    });
    return {
      count: filteredBills.length,
      totalPurchases,
      totalSales
    };
  }, [filteredBills]);

  const selectedBranchName = branches.find(b => b.id === selectedBranch)?.name || "All Branches";

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 space-y-4">
      {/* Top Bar Action Portal */}
      {portalNode && createPortal(
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 px-3.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
            onClick={() => {
              resetForm();
              setShowEntryModal(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>+ {tr("money_exchange.new_entry", "New Exchange Entry")}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs font-bold"
            onClick={fetchRecentBills}
            disabled={loadingBills}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loadingBills && "animate-spin")} />
            <span>{tr("common.refresh", "Refresh")}</span>
          </Button>
        </div>,
        portalNode
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Top Scope & Summary Card */}
      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white px-4 py-3 border-b border-slate-200 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>{tr("money_exchange.page_title", "Money Changer & Currency Exchange")}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  {selectedBranchName}
                </span>
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                {tr("money_exchange.subtitle", "On-demand currency purchase and sale management with live formula calculations.")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-bold text-slate-500">{tr("money_exchange.branch_label", "Branch")}:</span>
              <select 
                className="bg-transparent font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                value={selectedBranch}
                onChange={e => {
                  setSelectedBranch(e.target.value);
                  const br = branches.find(x => x.id === e.target.value);
                  if (br) setBranchCurrency(br.currency_code || "PKR");
                }}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-bold text-slate-500">{tr("money_exchange.date_label", "Date")}:</span>
              <input 
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="bg-transparent font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer text-xs"
              />
            </div>

            <Button
              type="button"
              className="h-8 px-4 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
              onClick={() => {
                resetForm();
                setShowEntryModal(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>+ {tr("money_exchange.new_entry", "New Exchange Entry")}</span>
            </Button>
          </div>
        </div>

        {/* Summary Badges Bar */}
        <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-850 flex flex-wrap items-center gap-4 text-xs font-semibold">
          <span className="bg-white border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 px-2.5 py-1 rounded flex gap-1.5 items-center">
            <span className="text-slate-500">{tr("money_exchange.total_entries", "Total Entries")}:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{summaryStats.count}</span>
          </span>
          <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 px-2.5 py-1 rounded flex gap-1.5 items-center">
            <span>{tr("money_exchange.total_purchases", "Total Purchases")}:</span>
            <span className="font-bold">{summaryStats.totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </span>
          <span className="bg-blue-50 border border-blue-100 text-blue-700 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300 px-2.5 py-1 rounded flex gap-1.5 items-center">
            <span>{tr("money_exchange.total_sales", "Total Sales")}:</span>
            <span className="font-bold">{summaryStats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </span>
          <span className="text-[11px] text-slate-400 ml-auto flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>User: {sessionInfo?.user?.fullName || sessionInfo?.user?.email || "Super Admin"}</span>
          </span>
        </div>
      </Card>

      {/* Main Full-Width Exchange Report Table Card */}
      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              <span>📋 {tr("money_exchange.exchange_report_title", "MONEY EXCHANGE — JOURNAL & REPORT TABLE")}</span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Type Pills */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-bold">
              <button
                type="button"
                className={cn("px-2.5 py-1 rounded-md transition", filterType === "ALL" ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300" : "text-slate-600 hover:text-slate-900 dark:text-slate-400")}
                onClick={() => setFilterType("ALL")}
              >
                All ({recentBills.length})
              </button>
              <button
                type="button"
                className={cn("px-2.5 py-1 rounded-md transition", filterType === "Purchase" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 dark:text-slate-400")}
                onClick={() => setFilterType("Purchase")}
              >
                Purchases
              </button>
              <button
                type="button"
                className={cn("px-2.5 py-1 rounded-md transition", filterType === "Sale" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 dark:text-slate-400")}
                onClick={() => setFilterType("Sale")}
              >
                Sales
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder={tr("money_exchange.search_placeholder", "Search serial, party, currencies...")}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs w-64"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-bold"
              onClick={fetchRecentBills}
              disabled={loadingBills}
              title="Refresh"
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
                  <Th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Date & Location</Th>
                  <Th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Serial No</Th>
                  <Th className="p-3 font-bold text-center border border-slate-200 dark:border-slate-800">Type</Th>
                  <Th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Currencies & Formula</Th>
                  <Th className="p-3 font-bold text-right border border-slate-200 dark:border-slate-800">Rate</Th>
                  <Th className="p-3 font-bold text-right border border-slate-200 dark:border-slate-800">Quantity</Th>
                  <Th className="p-3 font-bold text-right border border-slate-200 dark:border-slate-800">Final Amount</Th>
                  <Th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Received / Party Details</Th>
                  <Th className="p-3 font-bold border border-slate-200 dark:border-slate-800">Origin & Destination</Th>
                  <Th className="p-3 font-bold text-center border border-slate-200 dark:border-slate-800">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {loadingBills ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-medium italic border border-slate-200 dark:border-slate-800">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-600" />
                      Loading money exchange entries...
                    </td>
                  </tr>
                ) : filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-400 font-medium italic border border-slate-200 dark:border-slate-800">
                      <ArrowRightLeft className="h-8 w-8 text-slate-300 mx-auto mb-2 opacity-50" />
                      No money exchange entries recorded yet. Click <strong>"+ New Exchange Entry"</strong> to add a transaction.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map(b => {
                    const isPurchase = b.transaction_type === "Purchase";
                    return (
                      <tr 
                        key={b.id || b.serial_no} 
                        className="hover:bg-blue-50/30 dark:hover:bg-slate-900/40 transition cursor-pointer"
                        onClick={() => setViewingEntry(b)}
                      >
                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{b.entry_date}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {branches.find(x => x.id === b.branch_id)?.name || selectedBranchName}
                          </div>
                        </td>

                        <td className="p-3 font-mono text-[11px] border border-slate-200 dark:border-slate-800 align-top">
                          <span className="font-extrabold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/40 inline-block">
                            {b.serial_no}
                          </span>
                        </td>

                        <td className="p-3 text-center border border-slate-200 dark:border-slate-800 align-top">
                          <span className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                            isPurchase 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" 
                              : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                          )}>
                            {b.transaction_type}
                          </span>
                        </td>

                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono">{b.qty_currency}</span>
                            <span className="text-slate-400">&rarr;</span>
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono">{b.ex_currency}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({b.operation === "divide" ? "÷" : "×"})</span>
                          </div>
                        </td>

                        <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 align-top">
                          {Number(b.rate).toFixed(4)}
                        </td>

                        <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 align-top">
                          {Number(b.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {b.qty_currency}
                        </td>

                        <td className="p-3 text-right font-mono text-xs font-black text-indigo-700 dark:text-indigo-400 border border-slate-200 dark:border-slate-800 align-top">
                          {Number(b.final_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {b.ex_currency}
                        </td>

                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top">
                          <div className="flex flex-col gap-0.5">
                            {b.receipt_name && (
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {b.receipt_name} {b.received_type ? <span className="text-[9px] text-slate-400 font-normal">({b.received_type})</span> : null}
                              </div>
                            )}
                            {b.mobile && (
                              <div className="text-[10.5px] font-mono text-slate-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <span>{b.mobile}</span>
                              </div>
                            )}
                            {b.details && (
                              <div className="text-[10px] text-slate-500 line-clamp-1 italic">
                                {b.details}
                              </div>
                            )}
                            {!b.receipt_name && !b.mobile && !b.details && (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>

                        <td className="p-3 border border-slate-200 dark:border-slate-800 align-top text-[10.5px]">
                          <div className="flex flex-col gap-0.5">
                            {(b.purchase_country || b.purchase_city || b.purchased_from) && (
                              <div className="text-slate-700 dark:text-slate-300">
                                <span className="font-bold text-[9px] uppercase text-slate-400">From: </span>
                                <span>{[b.purchase_city, b.purchase_country, b.purchased_from].filter(Boolean).join(", ")}</span>
                              </div>
                            )}
                            {(b.received_country || b.received_city || b.received_office_name) && (
                              <div className="text-slate-600 dark:text-slate-400">
                                <span className="font-bold text-[9px] uppercase text-slate-400">To: </span>
                                <span>{[b.received_city, b.received_country, b.received_office_name].filter(Boolean).join(", ")}</span>
                              </div>
                            )}
                            {!b.purchase_country && !b.purchase_city && !b.received_country && !b.received_city && (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>

                        <td className="p-3 text-center border border-slate-200 dark:border-slate-800 align-top" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
                              onClick={() => setViewingEntry(b)}
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                          </div>
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

      {/* =========================================================================
          ON-DEMAND NEW EXCHANGE ENTRY MODAL / DRAWER
          ========================================================================= */}
      {showEntryModal && (
        <SimpleModal
          title={tr("money_exchange.modal_title", "💱 New Money Exchange Entry")}
          onClose={() => setShowEntryModal(false)}
          className="max-w-4xl max-h-[92vh] overflow-y-auto"
        >
          <form onSubmit={handleSave} className="space-y-4 p-2">
            {/* Section 1: Session & Serial Details */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <Label className="text-[10px] font-bold uppercase text-slate-500">{tr("money_exchange.branch_label", "Branch")}</Label>
                <select
                  className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold"
                  value={selectedBranch}
                  onChange={e => {
                    setSelectedBranch(e.target.value);
                    const br = branches.find(x => x.id === e.target.value);
                    if (br) setBranchCurrency(br.currency_code || "PKR");
                  }}
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-[10px] font-bold uppercase text-slate-500">{tr("money_exchange.date_label", "Entry Date")}</Label>
                <Input
                  type="date"
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className="mt-1 h-8 text-xs font-bold"
                />
              </div>

              <div>
                <Label className="text-[10px] font-bold uppercase text-slate-500">{tr("money_exchange.serial_label", "Generated Serial No")}</Label>
                <div className="mt-1 flex h-8 items-center px-3 rounded-md bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 font-mono text-xs font-black text-blue-800 dark:text-blue-300">
                  {entrySerial || "Pending..."}
                </div>
              </div>
            </div>

            {/* Section 2: Exchange Formula & Currencies */}
            <Card className="shadow-none border border-slate-200 dark:border-slate-800">
              <CardHeader className="py-2.5 px-4 bg-gradient-to-r from-amber-50 to-white dark:from-slate-900 dark:to-slate-950 border-b">
                <CardTitle className="text-xs uppercase font-black text-amber-900 dark:text-amber-300 flex items-center justify-between">
                  <span>⚡ 2. Exchange Formula & Rates</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Type:</span>
                    <select
                      className="h-7 rounded border border-input bg-background px-2 text-xs font-black text-blue-700"
                      value={transactionType}
                      onChange={e => setTransactionType(e.target.value as any)}
                    >
                      <option value="Purchase">Purchase (خریداری)</option>
                      <option value="Sale">Sale (فروخت)</option>
                    </select>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">{tr("money_exchange.qty_cur_label", "Qty Cur.")} *</Label>
                    <select 
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" 
                      value={qtyCurrency} 
                      onChange={e=>setQtyCurrency(e.target.value)}
                      required
                    >
                      <option value="">Select...</option>
                      {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">{tr("money_exchange.ex_cur_label", "Ex. Cur.")} *</Label>
                    <select 
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" 
                      value={exCurrency} 
                      onChange={e=>setExCurrency(e.target.value)}
                      required
                    >
                      <option value="">Select...</option>
                      {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">{tr("money_exchange.op_label", "Op")} *</Label>
                    <select 
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold" 
                      value={operation} 
                      onChange={e=>setOperation(e.target.value as any)}
                    >
                      <option value="multiply">Multiply (×)</option>
                      <option value="divide">Divide (÷)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">{tr("money_exchange.rate_label", "Rate")} *</Label>
                    <Input 
                      type="number" 
                      step="0.000001" 
                      min="0.000001"
                      className="h-8 text-xs px-2 font-mono font-bold" 
                      placeholder="0.00"
                      value={rate} 
                      onChange={e=>setRate(e.target.value ? Number(e.target.value) : "")} 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">{tr("money_exchange.quantity_label", "Quantity")} *</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      className="h-8 text-xs px-2 font-mono font-bold" 
                      placeholder="0.00"
                      value={quantity} 
                      onChange={e=>setQuantity(e.target.value ? Number(e.target.value) : "")} 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400">{tr("money_exchange.final_amount_label", "Final Amount")}</Label>
                    <div className="flex h-8 items-center px-3 rounded-md bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-900 font-mono text-xs font-black text-indigo-800 dark:text-indigo-300">
                      {finalAmount > 0 ? `${finalAmount.toFixed(2)} ${exCurrency}` : "0.00"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Received / Counterparty Details */}
            <Card className="shadow-none border border-slate-200 dark:border-slate-800">
              <CardHeader className="py-2.5 px-4 bg-slate-50 border-b">
                <CardTitle className="text-xs uppercase font-bold text-slate-700 dark:text-slate-300">
                  👤 3. Received / Counterparty Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                {/* Row 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.recv_type_label", "Recv. Type")}</Label>
                    <select 
                      className="flex h-8 w-full rounded border border-input bg-background px-2 text-xs font-semibold" 
                      value={receivedType} 
                      onChange={e=>setReceivedType(e.target.value)}
                    >
                      <option value="Name">Name (شخص)</option>
                      <option value="Agent">Agent (ایجنٹ)</option>
                      <option value="Bank">Bank (بینک)</option>
                      <option value="Other">Other (دیگر)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.name_label", "Party / Receipt Name")}</Label>
                    <Input 
                      className="h-8 text-xs font-semibold" 
                      placeholder="e.g. Haji Ahmad"
                      value={receiptName} 
                      onChange={e=>setReceiptName(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.mobile_whatsapp_label", "Mobile / WhatsApp")}</Label>
                    <Input 
                      className="h-8 text-xs font-mono font-semibold" 
                      placeholder="+92 300 1234567"
                      value={mobile} 
                      onChange={e=>setMobile(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.details_label", "Notes / Remarks")}</Label>
                    <Input 
                      className="h-8 text-xs font-semibold" 
                      placeholder="Transaction details..."
                      value={details} 
                      onChange={e=>setDetails(e.target.value)} 
                    />
                  </div>
                </div>

                {/* Row 2: Purchase Location */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.purchase_country_label", "Purchase Country")}</Label>
                    <select 
                      className="flex h-8 w-full rounded border border-input bg-background px-2 text-xs"
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
                      <option value="">Select Country...</option>
                      {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.purchase_city_label", "Purchase City")}</Label>
                    <Input 
                      className="h-8 text-xs font-semibold" 
                      placeholder={tr("money_exchange.type_city_placeholder", "Type city name...")} 
                      value={purchaseCity} 
                      onChange={e=>setPurchaseCity(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.purchased_from_label", "Purchased From (Company/Shop)")}</Label>
                    <Input 
                      className="h-8 text-xs font-semibold" 
                      placeholder="Shop / Trader Name"
                      value={purchasedFrom} 
                      onChange={e=>setPurchasedFrom(e.target.value)} 
                    />
                  </div>
                </div>

                {/* Row 3: Destination Location */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.recv_country_label", "Recv. Country")}</Label>
                    <select 
                      className="flex h-8 w-full rounded border border-input bg-background px-2 text-xs"
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
                      <option value="">Select Country...</option>
                      {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.recv_city_label", "Recv. City")}</Label>
                    <Input 
                      className="h-8 text-xs font-semibold" 
                      placeholder={tr("money_exchange.type_city_placeholder", "Type city name...")} 
                      value={receivedCity} 
                      onChange={e=>setReceivedCity(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.recv_office_name_label", "Recv. Office Name")}</Label>
                    <Input 
                      className="h-8 text-xs font-semibold" 
                      placeholder="Office Name"
                      value={receivedOfficeName} 
                      onChange={e=>setReceivedOfficeName(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">{tr("money_exchange.office_number_label", "Office Contact")}</Label>
                    <div className="flex gap-1">
                      <select 
                        className="w-24 h-8 text-[11px] rounded border bg-background px-1" 
                        value={receivedOfficeNumberType} 
                        onChange={e=>setReceivedOfficeNumberType(e.target.value)}
                      >
                        <option value="Mobile">Mobile</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Office 1">Office 1</option>
                        <option value="Office 2">Office 2</option>
                      </select>
                      <Input 
                        className="flex-1 h-8 text-xs font-mono" 
                        placeholder="Number..." 
                        value={receivedOfficeNumberValue} 
                        onChange={e=>setReceivedOfficeNumberValue(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={resetForm} 
                disabled={saving}
                className="h-9 px-4 text-xs font-bold"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {tr("money_exchange.clear_button", "Reset Form")}
              </Button>

              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEntryModal(false)}
                  disabled={saving}
                  className="h-9 px-4 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={saving || !qtyCurrency || !exCurrency || finalAmount <= 0} 
                  className="h-9 px-6 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{tr("money_exchange.saving_label", "Posting Transaction...")}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>{tr("money_exchange.save_button", "Save Exchange Entry")}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </SimpleModal>
      )}

      {/* =========================================================================
          VIEW EXCHANGE ENTRY DETAILS / VOUCHER MODAL
          ========================================================================= */}
      {viewingEntry && (
        <SimpleModal
          title={`📄 Exchange Voucher — ${viewingEntry.serial_no}`}
          onClose={() => setViewingEntry(null)}
          className="max-w-xl"
        >
          <div className="p-4 space-y-4 text-xs">
            {/* Header Voucher Card */}
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-4 dark:border-blue-900 dark:from-slate-900 dark:to-slate-950 space-y-3">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-2.5 dark:border-blue-900/60">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Voucher Serial</span>
                  <div className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">{viewingEntry.serial_no}</div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-black uppercase tracking-wider",
                    viewingEntry.transaction_type === "Purchase" 
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" 
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  )}>
                    {viewingEntry.transaction_type}
                  </span>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{viewingEntry.entry_date}</div>
                </div>
              </div>

              {/* Amount Box */}
              <div className="grid grid-cols-2 gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Source Quantity</div>
                  <div className="font-mono text-sm font-black text-slate-800 dark:text-slate-200">
                    {Number(viewingEntry.quantity).toLocaleString()} {viewingEntry.qty_currency}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Rate: {viewingEntry.rate} ({viewingEntry.operation === "divide" ? "÷" : "×"})
                  </div>
                </div>
                <div className="border-l border-slate-100 dark:border-slate-800 pl-3">
                  <div className="text-[10px] uppercase font-bold text-indigo-500">Converted Final Amount</div>
                  <div className="font-mono text-sm font-black text-indigo-700 dark:text-indigo-400">
                    {Number(viewingEntry.final_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {viewingEntry.ex_currency}
                  </div>
                </div>
              </div>

              {/* Party Details */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Counterparty Information</div>
                <div className="grid grid-cols-2 gap-2 text-[11.5px] font-semibold">
                  <div>
                    <span className="text-slate-500">Name:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{viewingEntry.receipt_name || viewingEntry.received_from || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Type:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{viewingEntry.received_type || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Mobile:</span> <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingEntry.mobile || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Branch:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{branches.find(x => x.id === viewingEntry.branch_id)?.name || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Origin / Destination */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Locations & Route</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="font-bold text-slate-500">Purchased From:</span>
                    <div className="text-slate-800 dark:text-slate-200">{[viewingEntry.purchase_city, viewingEntry.purchase_country, viewingEntry.purchased_from].filter(Boolean).join(", ") || "—"}</div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">Destination:</span>
                    <div className="text-slate-800 dark:text-slate-200">{[viewingEntry.received_city, viewingEntry.received_country, viewingEntry.received_office_name].filter(Boolean).join(", ") || "—"}</div>
                  </div>
                </div>
              </div>

              {viewingEntry.details && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <span className="font-bold text-slate-500">Remarks:</span>
                  <p className="text-slate-700 dark:text-slate-300 italic mt-0.5">{viewingEntry.details}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-bold"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5 mr-1" />
                Print Voucher
              </Button>
              <Button
                type="button"
                size="sm"
                className="text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white"
                onClick={() => setViewingEntry(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}
