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
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { BankPicker } from "@/features/banks/components/bank-picker";
import { getBankById, listBanks, type BankRecord } from "@/features/banks/bank-api";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { rtlLanguages } from "@/lib/i18n/languages";
import { openPaymentVoucherPrintReport } from "@/lib/reports/open-payment-voucher-print";
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
  const t = (key: string) => translateHeader(currentLang, key);

  // Form State
  const [paymentSourceLedgerId, setPaymentSourceLedgerId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cash");
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
  const [availableCountryBanks, setAvailableCountryBanks] = useState<BankRecord[]>([]);
  const [bankTransferType, setBankTransferType] = useState<string>("Online Wire / TT");
  const [ttReference, setTtReference] = useState<string>("");
  const [valueDate, setValueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [senderBeneficiaryRef, setSenderBeneficiaryRef] = useState<string>("");
  const [chequeNumber, setChequeNumber] = useState<string>("");
  const [chequeDate, setChequeDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [chequePayee, setChequePayee] = useState<string>("");
  const [chequeStatus, setChequeStatus] = useState<string>("Pending");
  const [walletProvider, setWalletProvider] = useState<string>("EasyPaisa");
  const [walletAccount, setWalletAccount] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
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
    orderFormData?.grandFinal ||
    0
  );

  const totalPaidSoFar = Number(
    (Number(order?.advance_paid || 0) + Number(order?.remaining_paid || 0)) ||
    order?.advance_amount ||
    0
  );

  const remainingDue = Math.max(0, totalOrderAmount - totalPaidSoFar);

  // --- STEP 1: AUTOMATIC PARTY ACCOUNT RESOLUTION (LOCKED) ---
  // Purchase Payment: Supplier/Party Account MUST be DEBIT (DR)
  // Sales Payment: Customer/Sales Account MUST be CREDIT (CR)
  const resolvedPartyAccount = useMemo(() => {
    let partyCode = "";
    let partyName = "";
    let partyLedgerId = "";
    let partyCurrency = baseCurrency;

    if (scope === "purchase") {
      if (orderType === "local_purchase" || order?.contract_no) {
        partyCode =
          order?.sales_account_no ||
          order?.supplier_account_no ||
          orderFormData?.supplierAccountNo ||
          orderFormData?.salesAccountNo ||
          order?.purchase_account_no ||
          "";
        partyName =
          order?.supplier_name ||
          orderFormData?.supplierName ||
          order?.party_name ||
          orderFormData?.partyName ||
          "Local Supplier / Vendor";
        partyLedgerId =
          order?.supplier_ledger_id ||
          order?.credit_ledger_id ||
          orderFormData?.supplierLedgerId ||
          orderFormData?.supplierAccountId ||
          "";
      } else {
        partyCode =
          orderFormData?.supplierAccountNo ||
          orderFormData?.salesAccountNo ||
          orderFormData?.purchaseAccountNo ||
          order?.supplier_account_no ||
          order?.purchase_account_no ||
          "";
        partyName =
          orderFormData?.supplierName ||
          orderFormData?.salesAccountName ||
          orderFormData?.purchaseAccountName ||
          order?.supplier_name ||
          order?.partyName ||
          "Supplier / Party Account";
        partyLedgerId =
          orderFormData?.supplierAccountId ||
          orderFormData?.supplierLedgerId ||
          orderFormData?.salesAccountLedgerId ||
          order?.supplier_ledger_id ||
          order?.supplierLedgerId ||
          "";
      }
    } else {
      partyCode =
        orderFormData?.customerAccountNo ||
        orderFormData?.customerAccountCode ||
        orderFormData?.purchaseAccountNo ||
        orderFormData?.salesAccountNo ||
        order?.customer_account_no ||
        order?.sales_account_no ||
        "";
      partyName =
        orderFormData?.customerName ||
        orderFormData?.buyerName ||
        orderFormData?.purchaseAccountName ||
        orderFormData?.salesAccountName ||
        order?.customer_name ||
        order?.partyName ||
        (orderType === "local_sales" ? "Local Customer" : "Customer / Receivable Account");
      partyLedgerId =
        orderFormData?.customerAccountId ||
        orderFormData?.customerLedgerId ||
        orderFormData?.customerAccountLedgerId ||
        order?.customer_account_id ||
        order?.customer_ledger_id ||
        orderFormData?.salesAccountLedgerId ||
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

    if (matchedLedger?.currency) {
      partyCurrency = matchedLedger.currency;
    }

    return {
      code: matchedLedger?.code || partyCode || "N/A",
      name: matchedLedger?.name || partyName || (scope === "purchase" ? "Supplier Account" : "Customer Account"),
      ledgerId: matchedLedger?.id || (isUuid(partyLedgerId) ? partyLedgerId : ""),
      currency: partyCurrency,
      hasValidMapping: Boolean(matchedLedger?.id || isUuid(partyLedgerId))
    };
  }, [scope, order, orderFormData, ledgers, baseCurrency]);

  // --- STEP 2: USER SELECTS CR SOURCE ACCOUNT (MANUAL SELECTION) ---
  // The dropdown must show only active accounts authorized for the selected country and branch.
  // Display: Account Name, Account Number, Account Type, Country and Branch, Currency, Available Balance.
  // Do not expose accounts belonging to another country or unauthorized branch.
  const sourceLedgerOptions: SearchSelectOption[] = useMemo(() => {
    return ledgers
      .filter((l) => {
        if (!l || !isUuid(l.id)) return false;
        // Exclude the party ledger itself
        if (resolvedPartyAccount.ledgerId && l.id === resolvedPartyAccount.ledgerId) return false;

        // Scope filter: match active country
        if (countryId) {
          const lCountry = l.country_id || l.countryId;
          if (lCountry && lCountry !== countryId) return false;
        }

        // Scope filter: match active branch
        if (branchId) {
          const lBranch = l.city_branch_id || l.cityBranchId || l.country_branch_id || l.countryBranchId;
          if (lBranch && lBranch !== branchId) return false;
        }

        // Allowed account types: Cash, Bank, Mobile Wallet, or Asset/Funded source accounts
        const name = String(l.name || l.accountName || "").toLowerCase();
        const type = String(l.account_type || l.nature || l.type || "").toLowerCase();
        const code = String(l.code || l.accountCode || "").toLowerCase();

        const isFunded =
          name.includes("cash") || type.includes("cash") || code.includes("cash") ||
          name.includes("bank") || type.includes("bank") || code.includes("bank") || l.bank_id != null ||
          name.includes("wallet") || name.includes("easypaisa") || name.includes("jazzcash") || type.includes("wallet") ||
          type.includes("asset") || type.includes("current asset");

        return isFunded;
      })
      .map((l) => {
        const code = l.code || l.accountCode || "";
        const name = l.name || l.accountName || "";
        const branch = l.cityBranchName || l.city_branch_name || l.countryBranchName || l.country_branch_name || branchName;
        const ccy = l.currency || baseCurrency;
        const type = l.account_type || l.nature || (name.toLowerCase().includes("cash") ? "Cash" : name.toLowerCase().includes("bank") ? "Bank" : "Funded");
        const balance = l.available_balance ?? l.balance;
        const balanceStr = balance != null ? ` | Bal: ${Number(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${ccy}` : "";
        const label = `[${type}] ${name} (${code}) — ${branch} | ${ccy}${balanceStr}`;
        return {
          value: l.id,
          label,
          keywords: `${code} ${name} ${branch} ${ccy} ${type}`
        };
      });
  }, [ledgers, resolvedPartyAccount.ledgerId, countryId, branchId, branchName, baseCurrency]);

  // Selected Cash/Bank/Wallet Ledger
  const selectedSourceLedger = useMemo(() => {
    return ledgers.find((l) => (l.id === paymentSourceLedgerId || l.ledgerId === paymentSourceLedgerId)) || null;
  }, [ledgers, paymentSourceLedgerId]);

  // When source ledger is selected, set default currency and pre-detect method
  useEffect(() => {
    if (!selectedSourceLedger) return;

    if (selectedSourceLedger?.currency) {
      setCurrency(String(selectedSourceLedger.currency).toUpperCase());
    }

    const name = String(selectedSourceLedger.name || "").toLowerCase();
    const code = String(selectedSourceLedger.code || "").toLowerCase();
    const type = String(selectedSourceLedger.account_type || selectedSourceLedger.type || "").toLowerCase();

    if (name.includes("cash") || type.includes("cash") || code.includes("cash")) {
      setPaymentMethod("cash");
    } else if (name.includes("bank") || type.includes("bank") || code.includes("bank") || selectedSourceLedger.bank_id != null) {
      if (paymentMethod !== "bank_transfer" && paymentMethod !== "tt_swift" && paymentMethod !== "cheque") {
        setPaymentMethod("bank_transfer");
      }
      if (selectedSourceLedger.bank_id && isUuid(selectedSourceLedger.bank_id) && !bankId) {
        setBankId(selectedSourceLedger.bank_id);
      }
    } else if (name.includes("wallet") || name.includes("easypaisa") || name.includes("jazzcash") || type.includes("wallet")) {
      setPaymentMethod("mobile_wallet");
    }
  }, [selectedSourceLedger]);

  // Load banks scoped to the active country
  useEffect(() => {
    listBanks({ countryId: countryId || undefined, limit: 100 })
      .then((rows) => setAvailableCountryBanks(rows))
      .catch(() => setAvailableCountryBanks([]));
  }, [countryId]);

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

  // Default exchange rate to 1 for UAE AED-to-AED
  const isUaeAed = ((countryName || "").toLowerCase().includes("emirates") || (countryName || "").toLowerCase().includes("uae")) && currency.toUpperCase() === "AED" && baseCurrency.toUpperCase() === "AED";
  const isSameCurrency = currency.toUpperCase() === baseCurrency.toUpperCase() || isUaeAed;

  useEffect(() => {
    if (isSameCurrency) {
      setExchangeRate("1");
    }
  }, [isSameCurrency]);

  // Single Currency Conversion Calculations
  const numericAmount = Number(amountInput || 0);
  const numericRate = isSameCurrency ? 1 : Number(exchangeRate || 1);
  const baseCurrencyAmount = useMemo(() => {
    if (isSameCurrency) return numericAmount;
    return Math.round(numericAmount * (numericRate > 0 ? numericRate : 1) * 100) / 100;
  }, [isSameCurrency, numericAmount, numericRate]);

  // Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // 1. Mandatory Control: Validate Ledger Mapping
    if (!resolvedPartyAccount.hasValidMapping || !resolvedPartyAccount.ledgerId) {
      setErrorMessage(
        `Missing Account Ledger: The account "${resolvedPartyAccount.name} (${resolvedPartyAccount.code})" does not have a valid ledger in the Chart of Accounts. Payment is blocked until this account is setup.`
      );
      return;
    }

    if (!paymentSourceLedgerId || !isUuid(paymentSourceLedgerId)) {
      setErrorMessage("Please select a valid Source Account in Step 2 for the transaction.");
      return;
    }

    if (!numericAmount || numericAmount <= 0) {
      setErrorMessage("Please enter a valid payment amount greater than zero.");
      return;
    }

    // 2. Validate Method-Specific Fields
    if (paymentMethod === "tt_swift" && !ttReference.trim()) {
      setErrorMessage("A valid TT/Transaction Reference number is required for TT / SWIFT payments.");
      return;
    }

    if (paymentMethod === "cheque" && !chequeNumber.trim()) {
      setErrorMessage("Cheque Number is required for Cheque payments.");
      return;
    }

    if (paymentMethod === "mobile_wallet" && !walletAccount.trim()) {
      setErrorMessage("Mobile/Wallet Account Number is required for Mobile Wallet payments.");
      return;
    }

    // 3. Direction of Double-Entry Accounts:
    // Purchase Payment: Supplier/Party = DR, Selected Source = CR
    // Sales Payment: Selected Receiving = DR, Customer = CR
    const debitLedgerId = scope === "purchase" ? resolvedPartyAccount.ledgerId : paymentSourceLedgerId;
    const creditLedgerId = scope === "purchase" ? paymentSourceLedgerId : resolvedPartyAccount.ledgerId;

    if (debitLedgerId === creditLedgerId) {
      setErrorMessage("Debit and Credit accounts must be distinct accounts.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = `DAILY-PAY-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      }

      const methodDetailsPayload: Record<string, any> = {
        method: paymentMethod,
        sourceAccountName: selectedSourceLedger?.name || null,
        sourceAccountCode: selectedSourceLedger?.code || null,
        partyAccountName: resolvedPartyAccount.name,
        partyAccountCode: resolvedPartyAccount.code
      };

      if (paymentMethod === "bank_transfer" || paymentMethod === "tt_swift") {
        methodDetailsPayload.bankId = bankId || selectedBankRecord?.id || null;
        methodDetailsPayload.bankName = selectedBankRecord?.bank_name || null;
        methodDetailsPayload.accountTitle = selectedBankRecord?.account_title || null;
        methodDetailsPayload.accountNumber = selectedBankRecord?.account_number || null;
        methodDetailsPayload.iban = selectedBankRecord?.iban_number || null;
        methodDetailsPayload.swiftBic = selectedBankRecord?.swift_bic || null;
        methodDetailsPayload.transferType = bankTransferType;
        methodDetailsPayload.ttReference = ttReference.trim() || referenceNo.trim() || null;
        methodDetailsPayload.valueDate = valueDate;
        methodDetailsPayload.senderBeneficiaryRef = senderBeneficiaryRef.trim() || null;
      } else if (paymentMethod === "cash") {
        methodDetailsPayload.cashReceiptNo = referenceNo.trim() || null;
      } else if (paymentMethod === "mobile_wallet") {
        methodDetailsPayload.walletProvider = walletProvider;
        methodDetailsPayload.walletAccount = walletAccount.trim();
        methodDetailsPayload.transactionId = transactionId.trim() || referenceNo.trim() || null;
      } else if (paymentMethod === "cheque") {
        methodDetailsPayload.bankId = bankId || null;
        methodDetailsPayload.chequeNumber = chequeNumber.trim();
        methodDetailsPayload.chequeDate = chequeDate;
        methodDetailsPayload.chequePayee = chequePayee.trim() || resolvedPartyAccount.name;
        methodDetailsPayload.chequeStatus = chequeStatus;
      } else if (paymentMethod === "internal_transfer") {
        methodDetailsPayload.internalTransferRef = internalTransferRef.trim() || referenceNo.trim() || null;
      }

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
        referenceNo: referenceNo.trim() || ttReference.trim() || chequeNumber.trim() || transactionId.trim() || null,
        narration: narration.trim() || `${condition.toUpperCase()} Payment via ${paymentMethod.replace("_", " ").toUpperCase()}`,
        methodDetails: methodDetailsPayload
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
      setChequeNumber("");
      setTransactionId("");
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
              <span>{scope === "purchase" ? th("Purchase Payment Voucher") : th("Sales Receipt Voucher")}</span>
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {condition.toUpperCase()}
              </span>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border",
                orderType.includes("local")
                  ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                  : "bg-blue-400/20 text-blue-100 border-blue-300/40"
              )}>
                {orderType === "local_purchase" ? "Local Purchase" : orderType === "purchase_booking" ? "Purchase Booking" : orderType === "local_sales" ? "Local Sales" : "Sales Booking"}
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

        {/* ── STEP 1: INVOICE & DR SETTLEMENT ACCOUNT (AUTO-RESOLVED & LOCKED) ── */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-[11px]">1</span>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {th("Step 1 — Invoice & Settlement Account (Auto-Resolved & Locked)")}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded">
              <Lock className="h-3 w-3" /> {th("Read-Only & Locked")}
            </span>
          </div>

          {/* Row 1: Source & Original Reference Details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                Source Type
              </label>
              <Input
                disabled
                value={orderType === "local_purchase" ? "Local Purchase" : orderType === "purchase_booking" ? "Purchase Booking" : orderType === "local_sales" ? "Local Sales" : "Sales Booking"}
                className="h-8 font-black text-xs text-blue-700 dark:text-blue-400 bg-slate-200/60 dark:bg-slate-800/80 cursor-not-allowed shadow-inner uppercase"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                Original Order / Invoice
              </label>
              <Input
                disabled
                value={`${billNumber} (ID: ${String(order?.id || "").slice(0, 8)}...)`}
                className="h-8 font-mono font-bold text-xs bg-slate-200/60 dark:bg-slate-800/80 cursor-not-allowed shadow-inner"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                Original Posting Ref
              </label>
              <Input
                disabled
                value={order?.journal_serial_no || order?.super_admin_serial_number || order?.superAdminSerialNo || order?.transfer_serial_number || order?.form_data?.workflow?.transferAudit?.referenceNo || "Transferred / Posted"}
                className="h-8 font-mono text-xs bg-slate-200/60 dark:bg-slate-800/80 cursor-not-allowed shadow-inner"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                Payment Condition & Due Date
              </label>
              <Input
                disabled
                value={`${condition.toUpperCase()} • Due: ${orderFormData?.advancePaymentDate || orderFormData?.paymentDueDate || orderFormData?.orderDate || "On Delivery"}`}
                className="h-8 font-bold text-xs bg-slate-200/60 dark:bg-slate-800/80 cursor-not-allowed shadow-inner"
              />
            </div>
          </div>

          {/* Row 2: Account & Balance Details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs pt-1">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                {scope === "purchase" ? `${th("Supplier / Party")} (DR)` : `${th("Customer Account")} (CR)`}
              </label>
              <Input
                disabled
                value={`${resolvedPartyAccount.name} (${resolvedPartyAccount.code})`}
                className="h-8 font-bold text-xs bg-slate-200/60 dark:bg-slate-800/80 cursor-not-allowed shadow-inner"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                {th("Country & Branch")}
              </label>
              <Input
                disabled
                value={`${countryName} • ${branchName}`}
                className="h-8 text-xs bg-slate-200/60 dark:bg-slate-800/80 cursor-not-allowed shadow-inner"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                {th("Account Currency")}
              </label>
              <Input
                disabled
                value={resolvedPartyAccount.currency || baseCurrency}
                className="h-8 font-mono font-bold text-xs bg-slate-200/60 dark:bg-slate-800/80 cursor-not-allowed shadow-inner"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                {th("Invoice Total / Remaining")}
              </label>
              <Input
                disabled
                value={`Total: ${totalOrderAmount.toLocaleString()} • Paid: ${totalPaidSoFar.toLocaleString()} • Due: ${remainingDue.toLocaleString()} ${baseCurrency}`}
                className="h-8 font-mono font-black text-xs text-blue-700 dark:text-blue-400 bg-slate-200/60 dark:bg-slate-800/80 cursor-not-allowed shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* ── STEP 2: USER SELECTS CR SOURCE ACCOUNT (MANUAL SELECTION) ── */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-[11px]">2</span>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {scope === "purchase" ? th("Step 2 — Select CR Source Account (Manual Selection)") : th("Step 2 — Select DR Receiving Account (Manual Selection)")}
              </span>
            </div>
            <span className="text-red-500 font-bold text-xs">* Required</span>
          </div>

          <div className="space-y-1.5">
            <SearchSelect
              label=""
              value={paymentSourceLedgerId}
              onValueChange={setPaymentSourceLedgerId}
              options={sourceLedgerOptions}
              placeholder={
                scope === "purchase"
                  ? `Select authorized ${countryName} / ${branchName} source account (CR)...`
                  : `Select authorized ${countryName} / ${branchName} receiving account (DR)...`
              }
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-slate-500">
              {scope === "purchase"
                ? "Disbursement account where funds leave. Scoped strictly to active country and branch. Direction: CREDIT (CR)."
                : "Collection account where funds are deposited. Scoped strictly to active country and branch. Direction: DEBIT (DR)."}
            </p>
          </div>
        </div>

        {/* ── STEP 3: SELECT PAYMENT METHOD / CHANNEL ── */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-[11px]">3</span>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {th("Step 3 — Select Payment Method & Channel Details")}
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Dynamic Fields Engine</span>
          </div>

          {!paymentSourceLedgerId ? (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Please select the CR Source Account in Step 2 above to proceed with channel fields.</span>
            </div>
          ) : (
            <>
              {/* Method Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { id: "cash", label: th("Cash in Hand"), icon: Wallet },
                  { id: "bank_transfer", label: th("Bank Transfer"), icon: Landmark },
                  { id: "tt_swift", label: th("TT / SWIFT"), icon: Building2 },
                  { id: "mobile_wallet", label: th("Mobile Wallet"), icon: Smartphone },
                  { id: "cheque", label: th("Cheque"), icon: CreditCard },
                  { id: "internal_transfer", label: th("Internal Transfer"), icon: RefreshCw },
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

              {/* ── METHOD 1: CASH IN HAND ── */}
              {paymentMethod === "cash" && (
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs space-y-2 animate-in fade-in">
                  <div className="font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <Wallet className="h-4 w-4" /> {th("Cash in Hand Disbursement")}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Direct branch cash payment. Bank, IBAN, and TT fields are hidden. Currency defaulted to account currency ({currency}).
                  </p>
                </div>
              )}

              {/* ── METHOD 2: BANK TRANSFER ── */}
              {paymentMethod === "bank_transfer" && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3 animate-in fade-in">
                  <div className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-2">
                    <Landmark className="h-4 w-4" />
                    <span>{th("Bank Transfer Details")} ({countryName})</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("Linked Bank Account")}
                      </label>
                      <Input
                        disabled
                        value={
                          selectedBankRecord
                            ? `${selectedBankRecord.account_title || "Primary"} • ${selectedBankRecord.account_number ? `••••${selectedBankRecord.account_number.slice(-4)}` : "—"}`
                            : "Auto-resolved from bank master..."
                        }
                        className="h-8 text-xs font-mono font-bold bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("Transfer Type")}
                      </label>
                      <select
                        value={bankTransferType}
                        onChange={(e) => setBankTransferType(e.target.value)}
                        className="flex h-8 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
                      >
                        <option value="Online Wire / TT">{th("Online Wire / TT")}</option>
                        <option value="Direct Debit">{th("Direct Debit")}</option>
                        <option value="Over The Counter">{th("Over The Counter")}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── METHOD 3: TT / SWIFT TRANSFER ── */}
              {paymentMethod === "tt_swift" && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-3 animate-in fade-in">
                  <div className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> {th("TT / SWIFT Wire Details")}
                    </span>
                    <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                      Manual Reference Mandatory
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("Bank Name")} <span className="text-red-500">*</span>
                      </label>
                      <BankPicker
                        label=""
                        value={bankId}
                        onValueChange={setBankId}
                        countryId={countryId || undefined}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("TT / SWIFT Reference Number")} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        required
                        value={ttReference}
                        onChange={(e) => setTtReference(e.target.value)}
                        placeholder="e.g. TT-984214-DXB (Enter Real Reference)"
                        className="h-8 text-xs font-mono font-black bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("Value Date")}
                      </label>
                      <Input
                        type="date"
                        value={valueDate}
                        onChange={(e) => setValueDate(e.target.value)}
                        className="h-8 text-xs bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      {th("Sender / Beneficiary Reference")}
                    </label>
                    <Input
                      value={senderBeneficiaryRef}
                      onChange={(e) => setSenderBeneficiaryRef(e.target.value)}
                      placeholder="e.g. Beneficiary invoice payment reference"
                      className="h-8 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* ── METHOD 4: MOBILE WALLET ── */}
              {paymentMethod === "mobile_wallet" && (
                <div className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-4 space-y-3 animate-in fade-in">
                  <div className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <span>{th("Mobile Wallet Details")}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("Wallet Provider")} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={walletProvider}
                        onChange={(e) => setWalletProvider(e.target.value)}
                        className="flex h-8 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
                      >
                        <option value="EasyPaisa">{th("EasyPaisa")}</option>
                        <option value="JazzCash">{th("JazzCash")}</option>
                        <option value="e& money">{th("e& money (UAE)")}</option>
                        <option value="PayBy">{th("PayBy / Botim")}</option>
                        <option value="Custom">{th("Custom Provider")}</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("Mobile / Wallet Account Number")} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={walletAccount}
                        onChange={(e) => setWalletAccount(e.target.value)}
                        placeholder="e.g. +971 50 1234567"
                        className="h-8 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("Transaction ID (TxID)")}
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

              {/* ── METHOD 5: CHEQUE ── */}
              {paymentMethod === "cheque" && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3 animate-in fade-in">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> {th("Cheque Details")}
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded">
                      Notice: Pending cheque is not treated as cleared cash
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("Cheque Number")} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        required
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="e.g. CHQ-0045812"
                        className="h-8 text-xs font-mono bg-white dark:bg-slate-900 font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("Cheque Date")} <span className="text-red-500">*</span>
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
                        {th("Payee Name")}
                      </label>
                      <Input
                        value={chequePayee}
                        onChange={(e) => setChequePayee(e.target.value)}
                        placeholder={resolvedPartyAccount.name}
                        className="h-8 text-xs bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("Cheque Status")}
                      </label>
                      <select
                        value={chequeStatus}
                        onChange={(e) => setChequeStatus(e.target.value)}
                        className="flex h-8 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
                      >
                        <option value="Pending">{th("Pending Clearance")}</option>
                        <option value="Cleared">{th("Cleared")}</option>
                        <option value="Post-Dated">{th("Post-Dated Cheque (PDC)")}</option>
                        <option value="Bounced">{th("Bounced")}</option>
                        <option value="Cancelled">{th("Cancelled")}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── METHOD 6: INTERNAL ACCOUNT TRANSFER ── */}
              {paymentMethod === "internal_transfer" && (
                <div className="rounded-xl border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/50 dark:bg-cyan-950/20 p-4 space-y-3 animate-in fade-in">
                  <div className="text-xs font-black uppercase tracking-wider text-cyan-900 dark:text-cyan-300 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    <span>{th("Internal Account Settlement")}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("From Source Account")} (CR)
                      </label>
                      <Input
                        disabled
                        value={selectedSourceLedger?.name || "Selected in Step 2"}
                        className="h-8 bg-white dark:bg-slate-900 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                        {th("To Destination Account")} (DR)
                      </label>
                      <Input
                        disabled
                        value={resolvedPartyAccount.name}
                        className="h-8 bg-white dark:bg-slate-900 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── AMOUNTS, CURRENCY, EXCHANGE RATE (SINGLE CONVERSION) ── */}
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

              {/* ── REFERENCE, ATTACHMENT & REMARKS ── */}
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
                    placeholder="e.g. Settlement for purchase/sales invoice"
                    className="h-9 text-xs bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── DOUBLE-ENTRY VISUAL BALANCING CARD ── */}
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-200 dark:border-indigo-900/40 mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-300">
              Double-Entry Ledger Balancing Status
            </span>
            <span className="bg-emerald-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Balanced
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
            {/* DEBIT (DR) SIDE */}
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-black text-blue-600 block">
                {scope === "purchase" ? "DEBIT (DR) — SUPPLIER SETTLEMENT" : "DEBIT (DR) — RECEIVING ACCOUNT"}
              </span>
              <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                {scope === "purchase" ? resolvedPartyAccount.name : selectedSourceLedger?.name || "Please Select Receiving Account"}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Code: {scope === "purchase" ? resolvedPartyAccount.code : selectedSourceLedger?.code || "—"}
              </div>
            </div>

            {/* CREDIT (CR) SIDE */}
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-black text-rose-600 block">
                {scope === "purchase" ? "CREDIT (CR) — SOURCE ACCOUNT" : "CREDIT (CR) — CUSTOMER SETTLEMENT"}
              </span>
              <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                {scope === "purchase" ? selectedSourceLedger?.name || "Please Select Source Account" : resolvedPartyAccount.name}
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
                onClick={() => {
                  try {
                    openPaymentVoucherPrintReport({
                      data: {
                        id: lastPaymentResult.paymentId || lastPaymentResult.roznamchaEntryId || "VOUCHER",
                        refNo: referenceNo || ttReference || lastPaymentResult.serialNumber || billNumber,
                        orderNo: billNumber,
                        date: paymentDate,
                        flow: scope === "purchase" ? "supplier_payment" : "customer_receipt",
                        module: scope === "purchase" ? "purchase" : "sales",
                        country: countryName || "United Arab Emirates",
                        branch: branchName || "Main Branch",
                        party: `${resolvedPartyAccount.name} (${resolvedPartyAccount.code})`,
                        paymentKind: condition,
                        currency: currency,
                        amount: numericAmount,
                        exchangeRate: numericRate,
                        baseAmount: baseCurrencyAmount,
                        debitLedgerName: scope === "purchase" ? resolvedPartyAccount.name : (selectedSourceLedger?.name || "Cash/Bank Account"),
                        creditLedgerName: scope === "purchase" ? (selectedSourceLedger?.name || "Cash/Bank Account") : resolvedPartyAccount.name,
                        narration: narration || `Daily ${condition.toUpperCase()} Payment via ${paymentMethod.toUpperCase()}`,
                        superAdminSerial: lastPaymentResult.serialNumber?.split(" | ")[0] || null,
                        countrySerial: lastPaymentResult.serialNumber?.split(" | ")[1] || null,
                        branchSerial: lastPaymentResult.serialNumber?.split(" | ")[2] || null,
                        status: "posted",
                        createdBy: "Authorized User",
                        createdAt: new Date().toISOString()
                      },
                      lang: currentLang
                    });
                  } catch {
                    window.print();
                  }
                }}
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

export { StandardizedDailyPaymentForm as InvoicePaymentForm };
