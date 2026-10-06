"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  FileText,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Plus,
  CreditCard,
  Send,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Receipt,
  FileCheck,
  Ban
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export interface RouteLegPartnerBillItem {
  id: string;
  order_id: string;
  leg_id: string;
  bill_no: string;
  order_no?: string;
  agent_name: string;
  invoice_ref: string | null;
  expense_category: string | null;
  country_of_service: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_balance: number;
  currency_code: string;
  exchange_rate: number;
  payment_status: "pending" | "partially_paid" | "paid";
  posting_status: "draft" | "unposted" | "posted" | "void";
  roznamcha_entry_id: string | null;
  roznamcha_voucher_no?: string | null;
  roznamcha_journal_no?: string | null;
  posted_at: string | null;
  provider_account_id: string | null;
  provider_account_code?: string | null;
  provider_account_name?: string | null;
  expense_account_id: string | null;
  expense_account_code?: string | null;
  expense_account_name?: string | null;
  customs_duty?: number;
  port_charges?: number;
  demurrage_charges?: number;
  clearance_fee?: number;
  freight_charges?: number;
  other_charges?: number;
  supporting_documents?: any[];
  remarks?: string | null;
  created_at?: string;
  payments?: {
    id: string;
    payment_serial: number;
    payment_no: string;
    payment_date: string;
    amount: number;
    currency_code: string;
    exchange_rate: number;
    payment_method: string;
    reference_no: string | null;
    narration: string | null;
    payment_account_id: string;
    payment_account_code?: string | null;
    payment_account_name?: string | null;
    roznamcha_voucher_no?: string | null;
    created_at: string;
  }[];
}

interface CustomerOrderPartnerBillsPanelProps {
  orderId?: string;
  orderNo?: string;
  legId?: string;
  legNo: number;
  handlerType?: string;
  partnerType?: string;
  partnerName?: string;
  partnerAccountId?: string;
  partnerAccountNumber?: string;
  partnerCountryName?: string;
  ledgers: { id: string; name: string; code?: string; currency?: string }[];
  lang: SupportedLanguage;
  onRefreshLegs?: () => void;
}

export function CustomerOrderPartnerBillsPanel({
  orderId,
  orderNo,
  legId,
  legNo,
  handlerType,
  partnerType,
  partnerName,
  partnerAccountId,
  partnerAccountNumber,
  partnerCountryName,
  ledgers,
  lang,
  onRefreshLegs
}: CustomerOrderPartnerBillsPanelProps) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, ("comv." + key) as never, fallback);

  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState<RouteLegPartnerBillItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bill Creation Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newInvoiceRef, setNewInvoiceRef] = useState("");
  const [newTotalAmount, setNewTotalAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newExchangeRate, setNewExchangeRate] = useState("1.0");
  const [newExpenseCategory, setNewExpenseCategory] = useState("customs_clearance");
  const [newExpenseAccountId, setNewExpenseAccountId] = useState("");
  const [newSupportingDoc, setNewSupportingDoc] = useState("");
  const [newRemarks, setNewRemarks] = useState("");
  const [newCustomsDuty, setNewCustomsDuty] = useState("");
  const [newFreightCharges, setNewFreightCharges] = useState("");
  const [newPortCharges, setNewPortCharges] = useState("");
  const [newClearanceFee, setNewClearanceFee] = useState("");
  const [newOtherCharges, setNewOtherCharges] = useState("");

  // Payment Recording State
  const [paymentBill, setPaymentBill] = useState<RouteLegPartnerBillItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNarration, setPaymentNarration] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [approvingBillId, setApprovingBillId] = useState<string | null>(null);

  const providerLedger = ledgers.find((l) => l.id === partnerAccountId);

  // Fetch partner bills for this order
  const loadBills = async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/partner-bills`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || json.message || "Failed to load partner bills");
      }
      const allBills: RouteLegPartnerBillItem[] = json.data?.bills || [];
      // Filter for this leg if legId is present, or leg_no match
      const matching = allBills.filter(
        (b) => (legId && b.leg_id === legId) || (!legId && b.agent_name === partnerName)
      );
      setBills(matching);
    } catch (e: any) {
      setError(e.message || "Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId && handlerType === "external_partner") {
      loadBills();
    }
  }, [orderId, legId, handlerType]);

  // Handle Create Draft Bill
  const handleCreateDraftBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) {
      setError(tt("save_order_first_bill", "Please save the Customer Order first before creating a partner bill."));
      return;
    }
    if (!legId) {
      setError(tt("save_legs_first", "Route leg must be saved before issuing a partner bill."));
      return;
    }
    if (!partnerAccountId) {
      setError(tt("partner_account_required_bill", "A registered provider account from Account Master is required to create a bill."));
      return;
    }
    const amt = Number(newTotalAmount);
    if (isNaN(amt) || amt <= 0) {
      setError(tt("valid_amount_required", "Please enter a valid bill amount greater than 0."));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        action: "create_bill",
        legId,
        providerAccountId: partnerAccountId,
        expenseAccountId: newExpenseAccountId || null,
        agentName: partnerName || "External Partner",
        countryOfService: partnerCountryName || null,
        invoiceRef: newInvoiceRef.trim() || null,
        expenseCategory: newExpenseCategory,
        totalAmount: amt,
        currencyCode: newCurrency.toUpperCase(),
        exchangeRate: Number(newExchangeRate) || 1,
        remarks: newRemarks.trim() || null,
        supportingDocuments: newSupportingDoc.trim()
          ? [{ name: newSupportingDoc.trim(), url: newSupportingDoc.trim() }]
          : [],
        customsDuty: Number(newCustomsDuty) || 0,
        portCharges: Number(newPortCharges) || 0,
        demurrageCharges: 0,
        clearanceFee: Number(newClearanceFee) || 0,
        freightCharges: Number(newFreightCharges) || 0,
        otherCharges: Number(newOtherCharges) || 0
      };

      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/partner-bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || json.message || "Failed to create partner bill");
      }

      setSuccessMsg(tt("bill_created_success", "Partner bill prepared in draft/unposted state. Review and approve to post Roznamcha entry."));
      setShowCreateForm(false);
      setNewInvoiceRef("");
      setNewTotalAmount("");
      setNewRemarks("");
      setNewSupportingDoc("");
      await loadBills();
      onRefreshLegs?.();
    } catch (e: any) {
      setError(e.message || "Failed to create bill");
    } finally {
      setLoading(false);
    }
  };

  // Handle Approve & Post Bill to Roznamcha
  const handleApproveBill = async (billId: string) => {
    if (!orderId) return;
    setApprovingBillId(billId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/partner-bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_bill", billId })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || json.message || "Failed to approve partner bill");
      }

      const voucher = json.data?.voucherNo ? ` (${json.data.voucherNo})` : "";
      setSuccessMsg(
        tt("bill_approved_posted", "Partner bill approved and posted to Roznamcha successfully!") + voucher
      );
      await loadBills();
      onRefreshLegs?.();
    } catch (e: any) {
      setError(e.message || "Failed to approve bill");
    } finally {
      setApprovingBillId(null);
    }
  };

  // Handle Record Partial Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !paymentBill) return;
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setError(tt("valid_payment_amount", "Please enter a valid payment amount greater than zero."));
      return;
    }
    if (amt > Number(paymentBill.remaining_balance)) {
      setError(
        `${tt("overpayment_prevented", "Payment amount cannot exceed the remaining balance")} (${paymentBill.currency_code} ${paymentBill.remaining_balance.toLocaleString()}).`
      );
      return;
    }
    if (!paymentAccountId) {
      setError(tt("select_payment_ledger", "Please select a payment Cash or Bank account from Account Master."));
      return;
    }
    if (paymentAccountId === paymentBill.provider_account_id) {
      setError(tt("diff_payment_account", "Payment source account must be different from the provider payable account."));
      return;
    }

    setSubmittingPayment(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        action: "record_payment",
        billId: paymentBill.id,
        amount: amt,
        paymentAccountId,
        paymentDate,
        paymentMethod,
        referenceNo: paymentRef.trim() || null,
        narration: paymentNarration.trim() || null
      };

      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/partner-bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || json.message || "Failed to record payment");
      }

      const voucher = json.data?.voucherNo ? ` (Voucher: ${json.data.voucherNo})` : "";
      setSuccessMsg(
        `${tt("payment_recorded_success", "Payment recorded and posted to Roznamcha!")} ${voucher} ${tt("new_balance", "Remaining Due:")} ${paymentBill.currency_code} ${(paymentBill.remaining_balance - amt).toLocaleString()}`
      );
      setPaymentBill(null);
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNarration("");
      await loadBills();
      onRefreshLegs?.();
    } catch (e: any) {
      setError(e.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // If leg is not handled by an external partner, do not display partner bill tools
  if (handlerType !== "external_partner") {
    return null;
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 space-y-3 dark:border-indigo-900/50 dark:bg-indigo-950/20 shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2 dark:border-indigo-900/40">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
            {tt("partner_bills_title", "External Partner Bills & Roznamcha Postings")} (Leg #{legNo})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {orderId && legId && partnerAccountId && (
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setError(null);
                setSuccessMsg(null);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-800 dark:text-indigo-300 shadow-2xs transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{tt("create_partner_bill_btn", "Enter Partner Bill")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Provider & Account Master Ledger Status */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
        <div className="rounded-lg bg-white p-2 border border-indigo-100 dark:bg-slate-900 dark:border-indigo-900/40">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">{tt("partner_name_label", "Provider / Partner")}</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{partnerName || tt("not_specified", "Not Specified")}</span>
          <span className="text-[10px] text-slate-500 block">
            {partnerType ? partnerType.replace(/_/g, " ").toUpperCase() : ""} {partnerCountryName ? `• ${partnerCountryName}` : ""}
          </span>
        </div>

        <div className="rounded-lg bg-white p-2 border border-indigo-100 dark:bg-slate-900 dark:border-indigo-900/40 col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase">{tt("account_master_ledger", "Account Master Ledger (Payable)")}</span>
            <a
              href="/dashboard/accounts/setup"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:underline"
            >
              <span>{tt("open_account_master", "Account Master")}</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          {partnerAccountId ? (
            <div className="flex items-center gap-2 mt-0.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                {providerLedger?.code ? `[${providerLedger.code}] ` : ""}
                {providerLedger?.name || partnerAccountNumber || partnerAccountId}
              </span>
              {providerLedger?.currency && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 font-mono text-emerald-700">
                  {providerLedger.currency}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5 text-amber-700 dark:text-amber-400 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <span>
                {tt("missing_provider_account_notice", "No Account Master ledger selected. A registered payable account is required before bills can be posted to Roznamcha.")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Draft Bill Entry Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateDraftBill} className="rounded-xl border border-indigo-200 bg-white p-3 space-y-3 dark:border-indigo-800 dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <span className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-200">
              {tt("enter_partner_invoice_bill", "Enter Actual External Provider Bill / Invoice")}
            </span>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("invoice_ref_label", "Invoice / Bill Ref No *")}</label>
              <input
                type="text"
                required
                placeholder="e.g. AF-KBL-8921"
                value={newInvoiceRef}
                onChange={(e) => setNewInvoiceRef(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("bill_amount_label", "Total Bill Amount *")}</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="1000.00"
                value={newTotalAmount}
                onChange={(e) => setNewTotalAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("currency_label", "Currency")}</label>
              <select
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="USD">USD</option>
                <option value="AED">AED</option>
                <option value="AFN">AFN</option>
                <option value="PKR">PKR</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("historical_rate_label", "Historical Exchange Rate")}</label>
              <input
                type="number"
                step="0.0001"
                value={newExchangeRate}
                onChange={(e) => setNewExchangeRate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("expense_category_label", "Expense Category")}</label>
              <select
                value={newExpenseCategory}
                onChange={(e) => setNewExpenseCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="customs_clearance">{tt("cat_customs_clearance", "Customs Clearance & Duties")}</option>
                <option value="freight_transport">{tt("cat_freight_transport", "Freight & Road Transportation")}</option>
                <option value="port_terminal">{tt("cat_port_terminal", "Port & Terminal Handling")}</option>
                <option value="demurrage_detention">{tt("cat_demurrage_detention", "Demurrage / Detention")}</option>
                <option value="border_transit">{tt("cat_border_transit", "Border Transit & Escort")}</option>
                <option value="documentation">{tt("cat_documentation", "Documentation & Consular Fee")}</option>
                <option value="other_services">{tt("cat_other_services", "Other Partner Services")}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("expense_ledger_label", "Debit Expense Ledger (Account Master)")}</label>
              <select
                value={newExpenseAccountId}
                onChange={(e) => setNewExpenseAccountId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">{tt("default_expense_ledger", "4002 - Customs Clearing Charges (Default)")}</option>
                {ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code ? `[${l.code}] ` : ""}{l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Detailed optional charges breakdown */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-[9px] text-slate-400 uppercase font-bold">{tt("charge_customs_duty", "Customs Duty")}</label>
              <input
                type="number"
                placeholder="0"
                value={newCustomsDuty}
                onChange={(e) => setNewCustomsDuty(e.target.value)}
                className="w-full rounded border border-slate-200 p-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 uppercase font-bold">{tt("charge_freight", "Freight Charges")}</label>
              <input
                type="number"
                placeholder="0"
                value={newFreightCharges}
                onChange={(e) => setNewFreightCharges(e.target.value)}
                className="w-full rounded border border-slate-200 p-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 uppercase font-bold">{tt("charge_port", "Port Charges")}</label>
              <input
                type="number"
                placeholder="0"
                value={newPortCharges}
                onChange={(e) => setNewPortCharges(e.target.value)}
                className="w-full rounded border border-slate-200 p-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 uppercase font-bold">{tt("charge_clearance", "Clearance Fee")}</label>
              <input
                type="number"
                placeholder="0"
                value={newClearanceFee}
                onChange={(e) => setNewClearanceFee(e.target.value)}
                className="w-full rounded border border-slate-200 p-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 uppercase font-bold">{tt("charge_other", "Other Charges")}</label>
              <input
                type="number"
                placeholder="0"
                value={newOtherCharges}
                onChange={(e) => setNewOtherCharges(e.target.value)}
                className="w-full rounded border border-slate-200 p-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("supporting_doc_ref", "Supporting Document Ref / Filename")}</label>
              <input
                type="text"
                placeholder="e.g. invoice_afghan_agent_8921.pdf"
                value={newSupportingDoc}
                onChange={(e) => setNewSupportingDoc(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("remarks_label", "Remarks / Notes")}</label>
              <input
                type="text"
                placeholder="e.g. Afghanistan border clearance fee and transit guarantee"
                value={newRemarks}
                onChange={(e) => setNewRemarks(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {tt("cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs"
            >
              <FileCheck className="h-3.5 w-3.5" />
              <span>{tt("save_draft_bill_btn", "Save Draft Bill (Unposted)")}</span>
            </button>
          </div>
        </form>
      )}

      {/* Existing Bills List */}
      <div className="space-y-2.5">
        {bills.length === 0 ? (
          <div className="rounded-lg border border-dashed border-indigo-200 bg-white/70 p-4 text-center dark:border-indigo-900/60 dark:bg-slate-900/40">
            <Receipt className="mx-auto h-6 w-6 text-indigo-400 mb-1" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {tt("no_partner_bills_yet", "No partner bills recorded for this leg yet.")}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {partnerAccountId
                ? tt("click_enter_bill_hint", "Click 'Enter Partner Bill' once the actual provider invoice is received.")
                : tt("assign_ledger_first_hint", "Select an Account Master ledger above before entering or posting bills.")}
            </p>
          </div>
        ) : (
          bills.map((bill) => (
            <div
              key={bill.id}
              className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs"
            >
              {/* Bill Status Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                    {bill.bill_no}
                  </span>
                  {bill.invoice_ref && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Ref: {bill.invoice_ref}
                    </span>
                  )}
                  {bill.expense_category && (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {bill.expense_category.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Posting Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      bill.posting_status === "posted"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {bill.posting_status === "posted" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{tt("status_posted", "Posted Roznamcha")}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>{tt("status_unposted_draft", "Unposted Draft")}</span>
                      </>
                    )}
                  </span>

                  {/* Payment Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      bill.payment_status === "paid"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : bill.payment_status === "partially_paid"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {bill.payment_status === "paid"
                      ? tt("status_fully_paid", "Fully Paid")
                      : bill.payment_status === "partially_paid"
                      ? tt("status_partially_paid", "Partially Paid")
                      : tt("status_unpaid", "Unpaid")}
                  </span>
                </div>
              </div>

              {/* Financial Balance Summary (Bill Total, Paid, Remaining Due) */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 bg-slate-50/70 p-2.5 rounded-lg dark:bg-slate-800/40 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{tt("bill_total_label", "Bill Total")}</span>
                  <span className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">
                    {bill.currency_code} {Number(bill.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  {bill.exchange_rate && bill.exchange_rate !== 1 && (
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Rate: {bill.exchange_rate}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block dark:text-emerald-400">{tt("paid_amount_label", "Paid Amount")}</span>
                  <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                    {bill.currency_code} {Number(bill.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-rose-700 uppercase block dark:text-rose-400">{tt("remaining_due_label", "Remaining Due")}</span>
                  <span className="font-mono text-sm font-black text-rose-700 dark:text-rose-400">
                    {bill.currency_code} {Number(bill.remaining_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Accounting Ledgers & Roznamcha Ref */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    <strong className="text-slate-700 dark:text-slate-300">{tt("provider_payable", "Payable:")}</strong>{" "}
                    {bill.provider_account_name || bill.provider_account_code || partnerName}
                  </span>
                  <span>
                    <strong className="text-slate-700 dark:text-slate-300">{tt("expense_debit", "Expense:")}</strong>{" "}
                    {bill.expense_account_name || bill.expense_account_code || "4002 Customs Clearing"}
                  </span>
                  {bill.roznamcha_voucher_no && (
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      Voucher: {bill.roznamcha_voucher_no}
                    </span>
                  )}
                </div>

                {/* Actions for this bill */}
                <div className="flex items-center gap-2">
                  {bill.posting_status !== "posted" && (
                    <button
                      type="button"
                      disabled={approvingBillId === bill.id}
                      onClick={() => handleApproveBill(bill.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-2xs transition"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        {approvingBillId === bill.id
                          ? tt("posting_dots", "Posting...")
                          : tt("approve_and_post_btn", "Approve & Post to Roznamcha")}
                      </span>
                    </button>
                  )}

                  {bill.posting_status === "posted" && Number(bill.remaining_balance) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentBill(bill);
                        setPaymentAmount(String(bill.remaining_balance));
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-700 shadow-2xs transition"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>{tt("record_payment_btn", "Record Payment")}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Payments History Table */}
              {bill.payments && bill.payments.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    {tt("payments_history", "Payments History")} ({bill.payments.length})
                  </span>
                  <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[9px]">
                        <tr>
                          <th className="px-2 py-1">#</th>
                          <th className="px-2 py-1">{tt("col_date", "Date")}</th>
                          <th className="px-2 py-1">{tt("col_amount", "Amount")}</th>
                          <th className="px-2 py-1">{tt("col_method", "Method")}</th>
                          <th className="px-2 py-1">{tt("col_account", "Paid From Account")}</th>
                          <th className="px-2 py-1">{tt("col_voucher", "Roznamcha Voucher")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {bill.payments.map((p, pIdx) => (
                          <tr key={p.id || pIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-2 py-1 font-mono">{p.payment_serial || pIdx + 1}</td>
                            <td className="px-2 py-1 font-mono">{p.payment_date?.split("T")[0]}</td>
                            <td className="px-2 py-1 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              {p.currency_code} {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-1 uppercase text-[10px]">{p.payment_method?.replace(/_/g, " ")}</td>
                            <td className="px-2 py-1 font-semibold">{p.payment_account_name || p.payment_account_code || p.payment_account_id}</td>
                            <td className="px-2 py-1 font-mono text-indigo-600 dark:text-indigo-400">{p.roznamcha_voucher_no || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Record Payment Modal / Flyout */}
      {paymentBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleRecordPayment}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-black uppercase text-slate-800 dark:text-slate-100">
                  {tt("record_bill_payment_title", "Record External Partner Payment")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentBill(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Bill Summary Banner */}
            <div className="rounded-lg bg-indigo-50 p-3 text-xs dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">{tt("bill_number", "Bill No:")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{paymentBill.bill_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{tt("provider_label", "Provider:")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{paymentBill.agent_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{tt("bill_total_label", "Bill Total:")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {paymentBill.currency_code} {Number(paymentBill.total_amount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-indigo-200/50 dark:border-indigo-800/50">
                <span className="font-bold text-rose-700 dark:text-rose-400">{tt("outstanding_due", "Outstanding Due:")}</span>
                <span className="font-mono font-black text-rose-700 dark:text-rose-400">
                  {paymentBill.currency_code} {Number(paymentBill.remaining_balance).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Fields */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">
                  {tt("payment_amount_label", "Payment Amount *")} (Max: {paymentBill.currency_code} {paymentBill.remaining_balance.toLocaleString()})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={paymentBill.remaining_balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">
                  {tt("payment_source_ledger", "Payment Source Account (Bank / Cash) *")}
                </label>
                <select
                  required
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">{tt("select_account_ph", "-- Select Cash or Bank Account --")}</option>
                  {ledgers
                    .filter((l) => l.id !== paymentBill.provider_account_id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code ? `[${l.code}] ` : ""}{l.name} {l.currency ? `(${l.currency})` : ""}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("payment_date_label", "Payment Date")}</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("payment_method_label", "Method")}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="bank_transfer">{tt("method_bank_transfer", "Bank Transfer")}</option>
                    <option value="cash">{tt("method_cash", "Cash")}</option>
                    <option value="cheque">{tt("method_cheque", "Cheque")}</option>
                    <option value="online">{tt("method_online", "Online Payment")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("ref_cheque_no", "Reference / Cheque No.")}</label>
                <input
                  type="text"
                  placeholder="e.g. TRF-90812 or CHQ-00192"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("narration_label", "Narration / Memo")}</label>
                <input
                  type="text"
                  placeholder="e.g. Partial payment for Afghanistan customs clearance"
                  value={paymentNarration}
                  onChange={(e) => setPaymentNarration(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPaymentBill(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {tt("cancel", "Cancel")}
              </button>
              <button
                type="submit"
                disabled={submittingPayment}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
                <span>
                  {submittingPayment ? tt("submitting_dots", "Submitting...") : tt("confirm_and_post_payment", "Post Payment to Roznamcha")}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
