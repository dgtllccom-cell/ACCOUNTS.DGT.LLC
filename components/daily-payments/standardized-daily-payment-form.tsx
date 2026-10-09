"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Coins,
  CreditCard,
  DollarSign,
  FileCheck2,
  FileText,
  HelpCircle,
  Info,
  Landmark,
  Lock,
  Minus,
  Paperclip,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  Upload,
  User,
  Wallet,
  X,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { BankPicker } from "@/features/banks/components/bank-picker";
import { getBankById, type BankRecord } from "@/features/banks/bank-api";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { rtlLanguages } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

export type PaymentScopeType = "purchase" | "sales";
export type PaymentOrderType = "purchase_booking" | "local_purchase" | "sales_booking" | "local_sales";
export type PaymentConditionType = "advance" | "endorsement" | "credit" | "remaining" | "final";
export type PaymentMethodType = "cash" | "bank_transfer" | "tt_swift" | "mobile_wallet" | "cheque" | "internal_transfer";

export interface StandardizedDailyPaymentFormProps {
  scope: PaymentScopeType;
  orderType: PaymentOrderType;
  order: any;
  condition: PaymentConditionType;
  ledgers: any[];
  countryId?: string | null;
  countryName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  baseCurrency?: string;
  onSuccess: (result: any) => void;
  onCancel?: () => void;
  className?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(val: unknown): boolean {
  if (typeof val !== "string") return false;
  return UUID_REGEX.test(val.trim());
}

export function StandardizedDailyPaymentForm({
  scope,
  orderType,
  order,
  condition,
  ledgers = [],
  countryId,
  countryName = "United Arab Emirates",
  branchId,
  branchName = "Main Branch",
  baseCurrency = "AED",
  onSuccess,
  onCancel,
  className
}: StandardizedDailyPaymentFormProps) {
  const currentLang = useActiveLanguage();
  const isRTL = (rtlLanguages as any).includes ? (rtlLanguages as any).includes(currentLang) : Boolean((rtlLanguages as any)?.has?.(currentLang));
  const th = (key: string) => translateHeader(currentLang, key);
  const tr = (key: string) => translateHeader(currentLang, key);

  // Form State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cash");
  const [paymentSourceLedgerId, setPaymentSourceLedgerId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<string>(baseCurrency);
  const [exchangeRate, setExchangeRate] = useState<string>("1");
  const [amountInput, setAmountInput] = useState<string>("");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Method-Specific Details
  const [bankId, setBankId] = useState<string>("");
  const [selectedBankRecord, setSelectedBankRecord] = useState<BankRecord | null>(null);
  const [ttReference, setTtReference] = useState<string>("");
  const [chequeNumber, setChequeNumber] = useState<string>("");
  const [chequeDate, setChequeDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [chequePayee, setChequePayee] = useState<string>("");
  const [chequeStatus, setChequeStatus] = useState<string>("Pending");
  const [walletProvider, setWalletProvider] = useState<string>("EasyPaisa");
  const [walletAccount, setWalletAccount] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [internalAccountId, setInternalAccountId] = useState<string>("");
  const [internalTransferRef, setInternalTransferRef] = useState<string>("");

  // UI / Status State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [lastPaymentResult, setLastPaymentResult] = useState<any>(null);
  const idempotencyKeyRef = useRef<string>("");

  // Extract Order Data
  const orderFormData = order?.form_data?.form || order?.form || {};
  const orderTotals = order?.form_data?.totals || {};
  const billNumber =
    order?.purchase_order_no
      ? `P#${order.purchase_order_no}`
      : order?.sales_order_no
      ? `S#${order.sales_order_no}`
      : order?.contract_no
      ? `LP#${order.contract_no}`
      : order?.id || "N/A";

  const totalOrderAmount = Number(
    order?.order_total ||
    order?.final_cost ||
    order?.purchase_cost ||
    orderFormData?.totalAmount ||
    0
  );

  const totalPaidSoFar = Number(
    (Number(order?.advance_paid || 0) + Number(order?.remaining_paid || 0)) ||
    order?.advance_amount ||
    0
  );

  const remainingDue = Math.max(0, totalOrderAmount - totalPaidSoFar);

  // --- AUTOMATIC PARTY ACCOUNT RESOLUTION (LOCKED) ---
  // Purchase Payment: Supplier/Party Account MUST be DEBIT (DR)
  // Sales Payment: Customer/Sales Account MUST be CREDIT (CR)
  const resolvedPartyAccount = useMemo(() => {
    let partyCode = "";
    let partyName = "";
    let partyLedgerId = "";

    if (scope === "purchase") {
      partyCode =
        orderFormData?.purchaseAccountNo ||
        orderFormData?.supplierAccountNo ||
        orderFormData?.salesAccountNo ||
        order?.purchase_account_no ||
        "";
      partyName =
        orderFormData?.supplierName ||
        orderFormData?.purchaseAccountName ||
        orderFormData?.salesAccountName ||
        order?.supplier_name ||
        order?.partyName ||
        "Supplier / Party Account";
      partyLedgerId =
        orderFormData?.supplierAccountId ||
        orderFormData?.supplierLedgerId ||
        orderFormData?.purchaseAccountLedgerId ||
        orderFormData?.salesAccountLedgerId ||
        order?.supplier_ledger_id ||
        order?.supplierLedgerId ||
        "";
    } else {
      partyCode =
        orderFormData?.customerAccountNo ||
        orderFormData?.salesAccountNo ||
        order?.sales_account_no ||
        "";
      partyName =
        orderFormData?.customerName ||
        orderFormData?.salesAccountName ||
        order?.customer_name ||
        order?.partyName ||
        "Customer / Sales Account";
      partyLedgerId =
        orderFormData?.customerAccountId ||
        orderFormData?.customerLedgerId ||
        orderFormData?.salesAccountLedgerId ||
        order?.customer_ledger_id ||
        "";
    }

    // Attempt to match with ledgers if ledger ID is not explicit
    let matchedLedger = ledgers.find((l) => isUuid(l.id) && l.id === partyLedgerId);
    if (!matchedLedger && (partyCode || partyName)) {
      matchedLedger = ledgers.find((l) => {
        const c = String(l.code || l.accountCode || "").toLowerCase().trim();
        const n = String(l.name || l.accountName || "").toLowerCase().trim();
        if (partyCode && c && c === partyCode.toLowerCase().trim()) return true;
        if (partyName && n && n === partyName.toLowerCase().trim()) return true;
        return false;
      });
    }

    return {
      code: matchedLedger?.code || partyCode || "N/A",
      name: matchedLedger?.name || partyName || "Party Account",
      ledgerId: matchedLedger?.id || (isUuid(partyLedgerId) ? partyLedgerId : ""),
      hasValidMapping: Boolean(matchedLedger?.id || isUuid(partyLedgerId))
    };
  }, [scope, order, orderFormData, ledgers]);

  // Selected Cash/Bank/Wallet Ledger
  const selectedSourceLedger = useMemo(() => {
    return ledgers.find((l) => (l.id === paymentSourceLedgerId || l.ledgerId === paymentSourceLedgerId)) || null;
  }, [ledgers, paymentSourceLedgerId]);

  // Filtered Source/Receiving Ledger Options
  const sourceLedgerOptions: SearchSelectOption[] = useMemo(() => {
    return ledgers
      .filter((l) => {
        if (!l || !isUuid(l.id)) return false;
        // Exclude the party ledger itself
        if (resolvedPartyAccount.ledgerId && l.id === resolvedPartyAccount.ledgerId) return false;

        const name = String(l.name || l.accountName || "").toLowerCase();
        const type = String(l.account_type || l.nature || l.type || "").toLowerCase();
        const code = String(l.code || l.accountCode || "").toLowerCase();

        if (paymentMethod === "cash") {
          return name.includes("cash") || type.includes("cash") || code.includes("cash");
        }
        if (paymentMethod === "bank_transfer" || paymentMethod === "tt_swift" || paymentMethod === "cheque") {
          return name.includes("bank") || type.includes("bank") || code.includes("bank") || l.bank_id != null;
        }
        if (paymentMethod === "mobile_wallet") {
          return name.includes("wallet") || name.includes("easypaisa") || name.includes("jazzcash") || type.includes("wallet") || name.includes("cash");
        }
        return true;
      })
      .map((l) => {
        const code = l.code || l.accountCode || "";
        const name = l.name || l.accountName || "";
        const branch = l.cityBranchName || l.city_branch_name || l.countryBranchName || l.country_branch_name || "";
        const ccy = l.currency || "";
        const label = branch ? `[${branch}] ${code} — ${name} (${ccy})` : `${code} — ${name} (${ccy})`;
        return {
          value: l.id,
          label,
          keywords: `${code} ${name} ${branch} ${ccy}`
        };
      });
  }, [ledgers, paymentMethod, resolvedPartyAccount.ledgerId]);

  // Auto-default currency when source ledger changes
  useEffect(() => {
    if (selectedSourceLedger?.currency) {
      setCurrency(String(selectedSourceLedger.currency).toUpperCase());
    }
  }, [selectedSourceLedger]);

  // Single Currency Conversion Calculations
  const isSameCurrency = currency.toUpperCase() === baseCurrency.toUpperCase();
  const numericAmount = Number(amountInput || 0);
  const numericRate = isSameCurrency ? 1 : Number(exchangeRate || 1);
  const baseCurrencyAmount = useMemo(() => {
    if (isSameCurrency) return numericAmount;
    return Math.round(numericAmount * (numericRate > 0 ? numericRate : 1) * 100) / 100;
  }, [isSameCurrency, numericAmount, numericRate]);

  // Sync bank record details when Bank is selected
  useEffect(() => {
    if (bankId && isUuid(bankId)) {
      getBankById(bankId)
        .then((b) => setSelectedBankRecord(b || null))
        .catch(() => setSelectedBankRecord(null));
    } else {
      setSelectedBankRecord(null);
    }
  }, [bankId]);

  // Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // 1. Mandatory Control: Validate Ledger Mapping
    if (!resolvedPartyAccount.hasValidMapping || !resolvedPartyAccount.ledgerId) {
      setErrorMessage(
        `Missing Account Ledger: The party account "${resolvedPartyAccount.name} (${resolvedPartyAccount.code})" does not have a valid ledger in the Chart of Accounts. Payment is blocked until this account is setup.`
      );
      return;
    }

    if (!paymentSourceLedgerId || !isUuid(paymentSourceLedgerId)) {
      setErrorMessage("Please select a valid Cash/Bank/Wallet Account for the transaction.");
      return;
    }

    if (!numericAmount || numericAmount <= 0) {
      setErrorMessage("Please enter a valid payment amount greater than zero.");
      return;
    }

    // 2. Validate TT/SWIFT specific fields
    if (paymentMethod === "tt_swift" && !ttReference.trim()) {
      setErrorMessage("A valid TT/Transaction Reference is required for TT / SWIFT payments.");
      return;
    }

    // 3. Direction of Double-Entry Accounts:
    // Purchase Payment: Supplier = DR, Selected Source = CR
    // Sales Payment: Selected Receiving = DR, Customer = CR
    const debitLedgerId = scope === "purchase" ? resolvedPartyAccount.ledgerId : paymentSourceLedgerId;
    const creditLedgerId = scope === "purchase" ? paymentSourceLedgerId : resolvedPartyAccount.ledgerId;

    if (debitLedgerId === creditLedgerId) {
      setErrorMessage("Debit and Credit accounts must be distinct accounts.");
      return;
    }

    setIsSubmitting(true);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    try {
      const payload = {
        targetType: orderType,
        targetId: order.id,
        direction: scope === "purchase" ? "purchase_payment" : "sales_payment",
        condition,
        method: paymentMethod,
        entryDate: paymentDate,
        amount: numericAmount,
        currencyCode: currency,
        exchangeRate: numericRate,
        debitLedgerId,
        creditLedgerId,
        referenceNo: referenceNo.trim() || ttReference.trim() || undefined,
        narration: narration.trim() || undefined,
        methodDetails: {
          bankId: bankId || selectedBankRecord?.id || null,
          bankName: selectedBankRecord?.bank_name || null,
          accountTitle: selectedBankRecord?.account_title || null,
          accountNumber: selectedBankRecord?.account_number || null,
          iban: selectedBankRecord?.iban_number || null,
          ttReference: ttReference.trim() || null,
          chequeNumber: chequeNumber.trim() || null,
          chequeDate: chequeDate || null,
          chequePayee: chequePayee.trim() || null,
          chequeStatus,
          walletProvider,
          walletAccount: walletAccount.trim() || null,
          transactionId: transactionId.trim() || null,
          internalAccountId: internalAccountId || null,
          transferReference: internalTransferRef.trim() || null
        }
      };

      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      if (attachmentFile) {
        formData.append("attachment", attachmentFile);
      }

      const res = await fetch("/api/erp/daily-payments/post", {
        method: "POST",
        body: formData,
        headers: {
          "X-Idempotency-Key": idempotencyKeyRef.current
        }
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error?.message || data.message || "Failed to process payment posting.");
      }

      setSuccessMessage(data.data?.message || "Payment posted and balanced in Roznamcha successfully!");
      setLastPaymentResult(data.data);
      idempotencyKeyRef.current = ""; // Reset for next transaction
      setAmountInput("");
      setReferenceNo("");
      setTtReference("");
      setNarration("");
      setAttachmentFile(null);

      if (onSuccess) {
        onSuccess(data.data);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during payment processing.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={cn(
        "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] shadow-xl overflow-hidden font-sans transition-all",
        className
      )}
    >
      {/* ── HEADER STRIP ── */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
            {scope === "purchase" ? <Receipt className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-black text-sm tracking-tight flex items-center gap-2">
              <span>{scope === "purchase" ? th("Purchase Payment") : th("Sales Payment")}</span>
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {condition.toUpperCase()}
              </span>
            </h3>
            <p className="text-[11px] text-blue-100 font-medium">
              {billNumber} • {branchName} ({countryName})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="bg-white/10 rounded-lg px-3 py-1 border border-white/15">
            <span className="text-[10px] uppercase text-blue-200 block font-bold">{th("Remaining Balance")}</span>
            <span className="font-mono font-black text-xs text-white">
              {remainingDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} {baseCurrency}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* ── MANDATORY CONTROL: MISSING ACCOUNT LEDGER WARNING ── */}
        {!resolvedPartyAccount.hasValidMapping && (
          <div className="rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <div className="font-black text-sm mb-1">{th("Payment Blocked: Missing Ledger Mapping")}</div>
              <p className="leading-relaxed">
                The account <strong className="font-mono underline">{resolvedPartyAccount.name}</strong> ({resolvedPartyAccount.code}) has no valid ledger mapped in the Chart of Accounts. As per mandatory enterprise controls, automated account creation is blocked. Please create or link this account in <a href="/dashboard/ledger/new" className="underline font-bold hover:text-rose-900">Ledgers Setup</a> before proceeding.
              </p>
            </div>
          </div>
        )}

        {/* ── ROW 1: LOCKED AUTO PARTY ACCOUNT & USER-SELECTED SOURCE ACCOUNT ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          {/* Party Account (LOCKED) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>{scope === "purchase" ? `${th("Supplier / Party Account")} (DR)` : `${th("Customer Account")} (CR)`}</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                <Lock className="h-2.5 w-2.5" /> {th("Auto & Locked")}
              </span>
            </label>
            <div className="relative">
              <Input
                disabled
                value={`${resolvedPartyAccount.name} (${resolvedPartyAccount.code})`}
                className="h-9 font-bold text-xs bg-slate-150/80 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 cursor-not-allowed shadow-inner"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              {scope === "purchase" ? "Auto-assigned from purchase order. Direction: DEBIT (DR)" : "Auto-assigned from sales order. Direction: CREDIT (CR)"}
            </p>
          </div>

          {/* Payment Source / Receiving Account (MANUAL SELECTION) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>{scope === "purchase" ? `${th("Payment Source Account")} (CR)` : `${th("Receiving Account")} (DR)`}</span>
              <span className="text-red-500 font-bold">*</span>
            </label>
            <SearchSelect
              label=""
              value={paymentSourceLedgerId}
              onValueChange={setPaymentSourceLedgerId}
              options={sourceLedgerOptions}
              placeholder={scope === "purchase" ? "Select Cash / Bank / Wallet account (CR)..." : "Select Receiving Cash / Bank account (DR)..."}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-slate-500">
              {scope === "purchase" ? "Authorized branch source account. Direction: CREDIT (CR)" : "Authorized branch receiving account. Direction: DEBIT (DR)"}
            </p>
          </div>
        </div>

        {/* ── ROW 2: PAYMENT METHOD SELECTOR (DYNAMIC FIELDS ENGINE) ── */}
        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
            {th("Payment Method")} <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { id: "cash", label: th("Cash"), icon: Wallet },
              { id: "bank_transfer", label: th("Bank Transfer"), icon: Landmark },
              { id: "tt_swift", label: th("TT / SWIFT"), icon: Building2 },
              { id: "mobile_wallet", label: th("Mobile Wallet"), icon: Smartphone },
              { id: "cheque", label: th("Cheque"), icon: CreditCard },
              { id: "internal_transfer", label: th("Internal Account Transfer"), icon: RefreshCw },
            ].map((m) => {
              const Icon = m.icon;
              const isSelected = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as PaymentMethodType)}
                  className={cn(
                    "flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <Icon className="h-4 w-4 mb-1" />
                  <span className="text-[11px] text-center leading-tight">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CONDITIONAL FIELDS: BANK TRANSFER & TT / SWIFT ── */}
        {(paymentMethod === "bank_transfer" || paymentMethod === "tt_swift") && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3 animate-in fade-in duration-150">
            <div className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              <span>{paymentMethod === "tt_swift" ? "TT / SWIFT Banking Wire Details" : "Bank Transfer Authorization"}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {th("Select Bank Name")} <span className="text-red-500">*</span>
                </label>
                <BankPicker
                  label=""
                  value={bankId}
                  onValueChange={setBankId}
                  countryId={countryId || undefined}
                />
              </div>

              {/* Resolved Bank Account (Read-only, no manual typing required) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {th("Linked Bank Account & Title")}
                </label>
                <Input
                  disabled
                  value={selectedBankRecord ? `${selectedBankRecord.account_title || "Primary"} • ${selectedBankRecord.account_number || "—"}` : "Select Bank above to resolve account..."}
                  className="h-8 text-xs font-mono font-bold bg-white dark:bg-slate-900"
                />
              </div>

              {/* Resolved IBAN / SWIFT (Read-only) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {th("IBAN / SWIFT BIC")}
                </label>
                <Input
                  disabled
                  value={selectedBankRecord?.iban_number || selectedBankRecord?.swift_bic || "Auto-resolved from bank master"}
                  className="h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>

              {/* Real TT / Transaction Reference */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {paymentMethod === "tt_swift" ? "TT / SWIFT Wire Reference *" : "Transaction Slip / Ref No."}
                </label>
                <Input
                  required={paymentMethod === "tt_swift"}
                  value={ttReference}
                  onChange={(e) => setTtReference(e.target.value)}
                  placeholder="e.g. TT-984214-DXB"
                  className="h-8 text-xs font-mono font-bold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── CONDITIONAL FIELDS: MOBILE WALLET ── */}
        {paymentMethod === "mobile_wallet" && (
          <div className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-4 space-y-3 animate-in fade-in duration-150">
            <div className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span>{tr("Mobile Wallet / Digital Transfer")}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {tr("Wallet Provider")} <span className="text-red-500">*</span>
                </label>
                <select
                  value={walletProvider}
                  onChange={(e) => setWalletProvider(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
                >
                  <option value="EasyPaisa">{tr("EasyPaisa")}</option>
                  <option value="JazzCash">{tr("JazzCash")}</option>
                  <option value="e& money">{tr("e& money (UAE)")}</option>
                  <option value="PayBy">{tr("PayBy / Botim")}</option>
                  <option value="Custom">{tr("Custom Provider")}</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {tr("Mobile / Wallet Account Number")} <span className="text-red-500">*</span>
                </label>
                <Input
                  value={walletAccount}
                  onChange={(e) => setWalletAccount(e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                  className="h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {tr("Wallet Transaction ID (TxID)")}
                </label>
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. TID-764839"
                  className="h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── CONDITIONAL FIELDS: CHEQUE ── */}
        {paymentMethod === "cheque" && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3 animate-in fade-in duration-150">
            <div className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span>{tr("Cheque Issuance / Deposit Details")}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {tr("Cheque Number")} <span className="text-red-500">*</span>
                </label>
                <Input
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="e.g. CHQ-0045812"
                  className="h-8 text-xs font-mono bg-white dark:bg-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {tr("Cheque Date")} <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="h-8 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {tr("Payee Name")}
                </label>
                <Input
                  value={chequePayee}
                  onChange={(e) => setChequePayee(e.target.value)}
                  placeholder="e.g. Supplier / Customer name"
                  className="h-8 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  {tr("Cheque Status")}
                </label>
                <select
                  value={chequeStatus}
                  onChange={(e) => setChequeStatus(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
                >
                  <option value="Pending">{tr("Pending Clearance")}</option>
                  <option value="Cleared">{tr("Cleared")}</option>
                  <option value="Post-Dated">{tr("Post-Dated Cheque (PDC)")}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── ROW 3: AMOUNTS, CURRENCY, FX RATE (CONVERT ONCE) & DATE ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              {th("Payment Date")} <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="h-9 text-xs font-semibold bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              {th("Payment Currency")}
            </label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="e.g. AED, USD, PKR"
              className="h-9 text-xs font-mono font-bold uppercase bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              {th("Exchange Rate")} {isSameCurrency && <span className="text-slate-400 text-[10px]">(Rate 1.0)</span>}
            </label>
            <Input
              type="number"
              step="0.0001"
              min="0"
              disabled={isSameCurrency}
              value={isSameCurrency ? "1" : exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="1.0"
              className="h-9 text-xs font-mono font-bold bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              {th("Amount")} ({currency}) <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0.00"
              className="h-9 text-xs font-mono font-black text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        {/* Currency Single Conversion Preview Badge */}
        {!isSameCurrency && numericAmount > 0 && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-2.5 text-xs flex items-center justify-between">
            <span className="font-semibold text-blue-800 dark:text-blue-300">
              Single Currency Conversion (@ {numericRate}):
            </span>
            <span className="font-mono font-black text-blue-900 dark:text-blue-200">
              {numericAmount.toFixed(2)} {currency} = {baseCurrencyAmount.toFixed(2)} {baseCurrency}
            </span>
          </div>
        )}

        {/* ── ROW 4: REFERENCE, ATTACHMENT & REMARKS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              {th("Receipt / Voucher Reference")}
            </label>
            <Input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. REC-9872"
              className="h-9 text-xs font-mono bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              {th("Upload Receipt / SWIFT Copy")}
            </label>
            <Input
              type="file"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              className="h-9 text-xs bg-white dark:bg-slate-900 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              {th("Remarks / Narration")}
            </label>
            <Input
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Payment for invoice"
              className="h-9 text-xs bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        {/* ── DOUBLE-ENTRY VISUAL BALANCING CARD ── */}
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-200 dark:border-indigo-900/40 mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-300">
              Double-Entry Ledger Balanced Status
            </span>
            <span className="bg-emerald-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Balanced
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
            {/* DEBIT (DR) SIDE */}
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-black text-blue-600 block">DEBIT (DR) ACCOUNT</span>
              <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                {scope === "purchase" ? resolvedPartyAccount.name : selectedSourceLedger?.name || "Please Select Receiving Account"}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Code: {scope === "purchase" ? resolvedPartyAccount.code : selectedSourceLedger?.code || "—"}
              </div>
            </div>

            {/* CREDIT (CR) SIDE */}
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-black text-rose-600 block">CREDIT (CR) ACCOUNT</span>
              <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                {scope === "purchase" ? selectedSourceLedger?.name || "Please Select Payment Source" : resolvedPartyAccount.name}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Code: {scope === "purchase" ? selectedSourceLedger?.code || "—" : resolvedPartyAccount.code}
              </div>
            </div>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
            {lastPaymentResult && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer shadow-xs"
              >
                <Printer className="h-3 w-3" />
                <span>{th("Print Voucher")}</span>
              </button>
            )}
          </div>
        )}

        {/* ── ACTION BUTTONS ── */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="h-10 px-5 text-xs font-bold"
            >
              {th("Cancel")}
            </Button>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || !resolvedPartyAccount.hasValidMapping || !paymentSourceLedgerId || numericAmount <= 0}
            className="h-10 px-6 font-bold text-xs uppercase shadow-md bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Processing...</span>
              </span>
            ) : (
              <span>Post {condition.toUpperCase()} Payment Voucher</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
