"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Plus,
  Ban,
  CheckCircle2,
  Clock,
  CreditCard,
  Calendar,
  Layers
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { DocumentAttachmentIcon } from "@/components/documents/document-attachment-icon";

export interface InsurancePolicyItem {
  id: string;
  order_id: string;
  insurer_name: string;
  insurer_account_id: string | null;
  insurer_account_code?: string | null;
  insurer_account_name?: string | null;
  policy_no: string;
  covered_cargo: string;
  insured_value: number;
  currency: string;
  coverage_from: string;
  coverage_to: string;
  territory: string | null;
  from_leg_no: number;
  to_leg_no: number;
  premium_amount: number | null;
  premium_currency: string | null;
  status: "active" | "cancelled";
  remarks: string | null;
  bill_id: string | null;
  bill_no?: string | null;
  posting_status?: string | null;
  payment_status?: string | null;
  paid_amount?: number | null;
  remaining_balance?: number | null;
  bill_total_amount?: number | null;
  payments?: { id: string; amount: number; payment_date: string; payment_no: string }[];
}

interface Props {
  orderId?: string;
  legs: { legNo: number }[];
  ledgers: { id: string; name: string; code?: string; currency?: string }[];
  lang: SupportedLanguage;
}

export function CustomerOrderInsurancePanel({ orderId, legs, ledgers, lang }: Props) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, ("ins." + key) as never, fallback);

  const [policies, setPolicies] = useState<InsurancePolicyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [insurerName, setInsurerName] = useState("");
  const [insurerAccountId, setInsurerAccountId] = useState("");
  const [policyNo, setPolicyNo] = useState("");
  const [coveredCargo, setCoveredCargo] = useState("");
  const [insuredValue, setInsuredValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [coverageFrom, setCoverageFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [coverageTo, setCoverageTo] = useState("");
  const [territory, setTerritory] = useState("");
  const [fromLegNo, setFromLegNo] = useState(legs[0]?.legNo ?? 1);
  const [toLegNo, setToLegNo] = useState(legs[legs.length - 1]?.legNo ?? 1);
  const [premiumAmount, setPremiumAmount] = useState("");

  const [paymentPolicy, setPaymentPolicy] = useState<InsurancePolicyItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [busyPolicyId, setBusyPolicyId] = useState<string | null>(null);

  const loadPolicies = async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/insurance`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message || json.message || "Failed to load insurance policies");
      setPolicies(json.data?.policies || []);
    } catch (e: any) {
      setError(e.message || "Failed to load insurance policies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) loadPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const resetForm = () => {
    setInsurerName("");
    setInsurerAccountId("");
    setPolicyNo("");
    setCoveredCargo("");
    setInsuredValue("");
    setCoverageTo("");
    setTerritory("");
    setPremiumAmount("");
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) {
      setError(tt("save_order_first", "Please save the Customer Order first before registering an insurance policy."));
      return;
    }
    if (!insurerName.trim() || !policyNo.trim() || !coveredCargo.trim() || !coverageTo) {
      setError(tt("required_fields_missing", "Insurer, policy number, covered cargo and coverage end date are required."));
      return;
    }
    const val = Number(insuredValue);
    if (isNaN(val) || val <= 0) {
      setError(tt("valid_insured_value_required", "Please enter a valid insured value greater than zero."));
      return;
    }
    if (toLegNo < fromLegNo) {
      setError(tt("invalid_leg_range", "The coverage end leg must be the same as or after the start leg."));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/insurance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_policy",
          insurerName: insurerName.trim(),
          insurerAccountId: insurerAccountId || null,
          policyNo: policyNo.trim(),
          coveredCargo: coveredCargo.trim(),
          insuredValue: val,
          currency: currency.toUpperCase(),
          coverageFrom,
          coverageTo,
          territory: territory.trim() || null,
          fromLegNo,
          toLegNo,
          premiumAmount: premiumAmount ? Number(premiumAmount) : null,
          premiumCurrency: currency.toUpperCase()
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message || json.message || "Failed to create insurance policy");
      setSuccessMsg(tt("policy_created_success", "Insurance policy registered."));
      setShowCreateForm(false);
      resetForm();
      await loadPolicies();
    } catch (e: any) {
      setError(e.message || "Failed to create insurance policy");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPolicy = async (policyId: string) => {
    if (!orderId) return;
    setBusyPolicyId(policyId);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/insurance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_policy", policyId })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message || json.message || "Failed to cancel policy");
      await loadPolicies();
    } catch (e: any) {
      setError(e.message || "Failed to cancel policy");
    } finally {
      setBusyPolicyId(null);
    }
  };

  const handleCreateBill = async (policyId: string) => {
    if (!orderId) return;
    setBusyPolicyId(policyId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/insurance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_bill", policyId })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message || json.message || "Failed to create premium bill");
      setSuccessMsg(tt("bill_created_success", "Premium bill prepared in draft/unposted state."));
      await loadPolicies();
    } catch (e: any) {
      setError(e.message || "Failed to create premium bill");
    } finally {
      setBusyPolicyId(null);
    }
  };

  const handleApproveBill = async (billId: string, policyId: string) => {
    if (!orderId) return;
    setBusyPolicyId(policyId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/insurance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_bill", billId })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message || json.message || "Failed to approve premium bill");
      setSuccessMsg(tt("bill_approved_posted", "Premium bill approved and posted to Roznamcha."));
      await loadPolicies();
    } catch (e: any) {
      setError(e.message || "Failed to approve premium bill");
    } finally {
      setBusyPolicyId(null);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !paymentPolicy?.bill_id) return;
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setError(tt("valid_payment_amount", "Please enter a valid payment amount greater than zero."));
      return;
    }
    if (!paymentAccountId) {
      setError(tt("select_payment_ledger", "Please select a payment Cash or Bank account from Account Master."));
      return;
    }
    setSubmittingPayment(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/insurance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record_payment", billId: paymentPolicy.bill_id, amount: amt, paymentAccountId })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message || json.message || "Failed to record payment");
      setSuccessMsg(tt("payment_recorded_success", "Payment recorded and posted to Roznamcha."));
      setPaymentPolicy(null);
      setPaymentAmount("");
      await loadPolicies();
    } catch (e: any) {
      setError(e.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const isExpired = (p: InsurancePolicyItem) => p.status === "active" && p.coverage_to < today;
  const isExpiringSoon = (p: InsurancePolicyItem) => {
    if (p.status !== "active" || isExpired(p)) return false;
    const days = (new Date(p.coverage_to).getTime() - new Date(today).getTime()) / 86400000;
    return days <= 14;
  };

  if (!orderId) return null;

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-3 space-y-3 dark:border-teal-900/50 dark:bg-teal-950/20 shadow-2xs" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 pb-2 dark:border-teal-900/40">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          <span className="text-xs font-black uppercase tracking-wider text-teal-900 dark:text-teal-200">
            {tt("panel_title", "Cargo & Route Insurance")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setError(null);
            setSuccessMsg(null);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-teal-300 bg-white px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:bg-slate-800 dark:text-teal-300 shadow-2xs transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{tt("add_policy_btn", "Register Insurance Policy")}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          {successMsg}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreatePolicy} className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border border-teal-200 bg-white p-3 dark:border-teal-900/50 dark:bg-slate-900">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("insurer_name_label", "Insurer / Underwriter Name")}</label>
            <input value={insurerName} onChange={(e) => setInsurerName(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("insurer_account_label", "Insurer Account (Account Master)")}</label>
            <select value={insurerAccountId} onChange={(e) => setInsurerAccountId(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <option value="">{tt("select_ledger", "Select ledger…")}</option>
              {ledgers.map((l) => (
                <option key={l.id} value={l.id}>{l.code ? `${l.code} — ${l.name}` : l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("policy_no_label", "Policy Number")}</label>
            <input value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("covered_cargo_label", "Covered Cargo / Goods Description")}</label>
            <input value={coveredCargo} onChange={(e) => setCoveredCargo(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("territory_label", "Territory / Transit Route")}</label>
            <input value={territory} onChange={(e) => setTerritory(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("insured_value_label", "Insured Value")}</label>
            <input type="number" min="0" step="0.01" value={insuredValue} onChange={(e) => setInsuredValue(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("currency_label", "Currency")}</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("premium_amount_label", "Premium Amount (optional)")}</label>
            <input type="number" min="0" step="0.01" value={premiumAmount} onChange={(e) => setPremiumAmount(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("coverage_from_label", "Coverage From")}</label>
            <input type="date" value={coverageFrom} onChange={(e) => setCoverageFrom(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("coverage_to_label", "Coverage To")}</label>
            <input type="date" value={coverageTo} onChange={(e) => setCoverageTo(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("from_leg_label", "Covers From Leg #")}</label>
            <select value={fromLegNo} onChange={(e) => setFromLegNo(Number(e.target.value))} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              {legs.map((l) => <option key={l.legNo} value={l.legNo}>#{l.legNo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("to_leg_label", "Covers To Leg #")}</label>
            <select value={toLegNo} onChange={(e) => setToLegNo(Number(e.target.value))} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              {legs.map((l) => <option key={l.legNo} value={l.legNo}>#{l.legNo}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
              {tt("cancel_btn", "Cancel")}
            </button>
            <button type="submit" disabled={loading} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50">
              {tt("save_policy_btn", "Save Policy")}
            </button>
          </div>
        </form>
      )}

      {policies.length === 0 && !loading && (
        <div className="text-[11px] text-slate-500 italic py-1">{tt("no_policies_yet", "No insurance policies registered for this order yet.")}</div>
      )}

      <div className="space-y-2">
        {policies.map((p) => (
          <div key={p.id} className="rounded-lg border border-teal-200 bg-white p-2.5 dark:border-teal-900/50 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{p.insurer_name}</span>
                <span className="text-[10px] text-slate-500">{tt("policy_no_short", "Policy")} #{p.policy_no}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Layers className="h-3 w-3" />
                  {tt("legs_short", "Legs")} {p.from_leg_no === p.to_leg_no ? `#${p.from_leg_no}` : `#${p.from_leg_no}-#${p.to_leg_no}`}
                </span>
                {p.status === "cancelled" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    <Ban className="h-3 w-3" />{tt("status_cancelled", "Cancelled")}
                  </span>
                )}
                {isExpired(p) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    <ShieldAlert className="h-3 w-3" />{tt("status_expired", "Expired")}
                  </span>
                )}
                {!isExpired(p) && isExpiringSoon(p) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Clock className="h-3 w-3" />{tt("status_expiring_soon", "Expiring Soon")}
                  </span>
                )}
                <DocumentAttachmentIcon entityType="clearing_order_insurance_policy" entityId={p.id} />
              </div>
              {p.status === "active" && (
                <button
                  type="button"
                  onClick={() => handleCancelPolicy(p.id)}
                  disabled={busyPolicyId === p.id}
                  className="text-[10px] font-bold text-red-600 hover:underline disabled:opacity-50"
                >
                  {tt("cancel_policy_btn", "Cancel Policy")}
                </button>
              )}
            </div>

            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
              <div><span className="text-slate-400">{tt("cargo_label", "Cargo:")}</span> {p.covered_cargo}</div>
              <div><span className="text-slate-400">{tt("insured_value_short", "Insured:")}</span> {p.currency} {Number(p.insured_value).toLocaleString()}</div>
              <div className="flex items-center gap-1"><Calendar className="h-3 w-3 text-slate-400" />{p.coverage_from} → {p.coverage_to}</div>
              {p.territory && <div><span className="text-slate-400">{tt("territory_short", "Territory:")}</span> {p.territory}</div>}
            </div>

            {p.premium_amount != null && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {tt("premium_label", "Premium:")} {p.premium_currency} {Number(p.premium_amount).toLocaleString()}
                </span>
                {!p.bill_id && p.status === "active" && (
                  <button
                    type="button"
                    onClick={() => handleCreateBill(p.id)}
                    disabled={busyPolicyId === p.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-teal-300 bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700 hover:bg-teal-100 disabled:opacity-50 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-300"
                  >
                    <Plus className="h-3 w-3" />{tt("create_bill_btn", "Create Premium Bill")}
                  </button>
                )}
                {p.bill_id && p.posting_status !== "posted" && (
                  <button
                    type="button"
                    onClick={() => handleApproveBill(p.bill_id as string, p.id)}
                    disabled={busyPolicyId === p.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
                  >
                    <CheckCircle2 className="h-3 w-3" />{tt("approve_post_btn", "Approve & Post")}
                  </button>
                )}
                {p.bill_id && p.posting_status === "posted" && (
                  <>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.payment_status === "paid" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                      {p.payment_status === "paid" ? tt("bill_status_paid", "Paid") : p.payment_status === "partially_paid" ? tt("bill_status_partial", "Partially Paid") : tt("bill_status_pending", "Payment Pending")}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {tt("remaining_short", "Remaining:")} {p.currency} {Number(p.remaining_balance ?? 0).toLocaleString()}
                    </span>
                    {Number(p.remaining_balance ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentPolicy(p);
                          setPaymentAmount(String(p.remaining_balance ?? ""));
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                      >
                        <CreditCard className="h-3 w-3" />{tt("record_payment_btn", "Record Payment")}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {paymentPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPaymentPolicy(null)}>
          <form
            onSubmit={handleRecordPayment}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <h3 className="mb-3 text-sm font-black text-slate-800 dark:text-slate-100">{tt("record_payment_title", "Record Premium Payment")}</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("payment_amount_label", "Amount")}</label>
                <input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("payment_source_ledger", "Pay From (Cash/Bank Account)")}</label>
                <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">{tt("select_ledger", "Select ledger…")}</option>
                  {ledgers.filter((l) => l.id !== paymentPolicy.insurer_account_id).map((l) => (
                    <option key={l.id} value={l.id}>{l.code ? `${l.code} — ${l.name}` : l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setPaymentPolicy(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
                {tt("cancel_btn", "Cancel")}
              </button>
              <button type="submit" disabled={submittingPayment} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50">
                {tt("confirm_payment_btn", "Confirm Payment")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
