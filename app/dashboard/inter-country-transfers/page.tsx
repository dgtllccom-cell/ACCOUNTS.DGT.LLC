"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import {
  Send,
  CheckCircle2,
  XCircle,
  Edit,
  Printer,
  RefreshCw,
  ArrowRightLeft,
  DollarSign,
  AlertCircle,
} from "lucide-react";

type TransferRecord = {
  id: string;
  transfer_no: string;
  source_country_id: string;
  source_country_name?: string;
  dest_country_id: string;
  dest_country_name?: string;
  amount: number;
  original_currency: string;
  exchange_rate: number;
  final_currency: string;
  final_amount: number;
  direction: string;
  status: "pending" | "accepted" | "rejected" | "returned" | "cancelled";
  narration?: string;
  sender_name?: string;
  receiver_name?: string;
  rejection_reason?: string;
  created_at: string;
  sender_roznamcha_entry_id?: string;
  receiver_roznamcha_entry_id?: string;
};

type Country = {
  id: string;
  name: string;
  currency_code: string;
};

type Ledger = {
  id: string;
  name: string;
  currency: string;
  country_id?: string;
};

export default function InterCountryTransfersPage() {
  const language = useActiveLanguage();
  const t = (k: string) => translateHeader(language, k);

  const [activeTab, setActiveTab] = useState<"send" | "register">("send");
  const [countries, setCountries] = useState<Country[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form state
  const [sourceCountryId, setSourceCountryId] = useState("");
  const [destCountryId, setDestCountryId] = useState("");
  const [sourceBankCashLedgerId, setSourceBankCashLedgerId] = useState("");
  const [sourcePartyLedgerId, setSourcePartyLedgerId] = useState("");
  const [destBankCashLedgerId, setDestBankCashLedgerId] = useState("");
  const [destPartyLedgerId, setDestPartyLedgerId] = useState("");
  const [amount, setAmount] = useState("");
  const [originalCurrency, setOriginalCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [finalCurrency, setFinalCurrency] = useState("USD");
  const [direction, setDirection] = useState<"debit" | "credit">("debit");
  const [narration, setNarration] = useState("");

  // Modal / Action state
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null);
  const [actionModal, setActionModal] = useState<"accept" | "reject" | "edit" | null>(null);
  const [acceptDebitLedgerId, setAcceptDebitLedgerId] = useState("");
  const [acceptCreditLedgerId, setAcceptCreditLedgerId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [editBankLedgerId, setEditBankLedgerId] = useState("");
  const [editPartyLedgerId, setEditPartyLedgerId] = useState("");

  const finalCalculatedAmount = (Number(amount || 0) * Number(exchangeRate || 1)).toFixed(2);

  const fetchCountriesAndLedgers = useCallback(async () => {
    try {
      const [cRes, lRes] = await Promise.all([
        fetch("/api/erp/locations"),
        fetch("/api/erp/accounting/ledgers"),
      ]);
      if (cRes.ok) {
        const cData = await cRes.json();
        setCountries(cData.countries || cData || []);
      }
      if (lRes.ok) {
        const lData = await lRes.json();
        setLedgers(lData.ledgers || lData || []);
      }
    } catch (e) {
      console.warn("Failed to load locations/ledgers", e);
    }
  }, []);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/accounting/inter-country-transfers");
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.transfers || []);
      }
    } catch (e) {
      console.warn("Failed to load transfers", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountriesAndLedgers();
    fetchTransfers();
  }, [fetchCountriesAndLedgers, fetchTransfers]);

  const handleSendTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!sourceCountryId || !destCountryId) {
      setFeedback({ type: "error", message: "Please select both Source and Destination countries." });
      return;
    }
    if (sourceCountryId === destCountryId) {
      setFeedback({ type: "error", message: "Source and Destination countries must be different." });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid positive amount." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/erp/accounting/inter-country-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCountryId,
          destCountryId,
          sourceBankCashLedgerId: sourceBankCashLedgerId || null,
          sourcePartyLedgerId: sourcePartyLedgerId || null,
          destBankCashLedgerId: destBankCashLedgerId || null,
          destPartyLedgerId: destPartyLedgerId || null,
          amount: Number(amount),
          originalCurrency,
          exchangeRate: Number(exchangeRate || 1),
          finalCurrency,
          finalAmount: Number(finalCalculatedAmount),
          direction,
          narration,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create transfer");
      }

      setFeedback({
        type: "success",
        message: `Transfer ${data.transferNo || "created"} successfully sent! Ready for destination acceptance.`,
      });

      // Reset form
      setAmount("");
      setNarration("");
      fetchTransfers();
      setActiveTab("register");
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "An unexpected error occurred." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!selectedTransfer || !acceptDebitLedgerId || !acceptCreditLedgerId) {
      setFeedback({ type: "error", message: "Please select both Debit and Credit ledgers to accept." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/erp/accounting/inter-country-transfers/${selectedTransfer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          debitLedgerId: acceptDebitLedgerId,
          creditLedgerId: acceptCreditLedgerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to accept transfer");
      setFeedback({ type: "success", message: `Transfer ${selectedTransfer.transfer_no} successfully accepted and posted!` });
      setActionModal(null);
      fetchTransfers();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Acceptance failed" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTransfer || !rejectReason.trim()) {
      setFeedback({ type: "error", message: "A rejection reason is required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/erp/accounting/inter-country-transfers/${selectedTransfer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          reason: rejectReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject transfer");
      setFeedback({ type: "success", message: `Transfer ${selectedTransfer.transfer_no} rejected.` });
      setActionModal(null);
      fetchTransfers();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Rejection failed" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditLedger = async () => {
    if (!selectedTransfer) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/erp/accounting/inter-country-transfers/${selectedTransfer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_ledger",
          destBankCashLedgerId: editBankLedgerId || null,
          destPartyLedgerId: editPartyLedgerId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update ledger");
      setFeedback({ type: "success", message: `Receiving ledger updated for ${selectedTransfer.transfer_no}.` });
      setActionModal(null);
      fetchTransfers();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Edit failed" });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintRegister = () => {
    openUniversalPrintReport({
      title: "Inter-Country Transfers Register",
      reportType: "register",
      scope: {
        company: "General Brand",
      },
      columns: [
        { key: "transfer_no", label: t("TRANSFER NO"), width: "14%" },
        { key: "source_country_name", label: t("SOURCE COUNTRY"), width: "14%" },
        { key: "dest_country_name", label: t("DESTINATION COUNTRY"), width: "14%" },
        { key: "amount", label: t("AMOUNT"), align: "right", width: "12%" },
        { key: "original_currency", label: t("CURRENCY"), width: "8%" },
        { key: "exchange_rate", label: t("EXCHANGE RATE"), align: "right", width: "10%" },
        { key: "final_amount", label: t("FINAL AMOUNT"), align: "right", width: "12%" },
        { key: "status", label: t("STATUS"), width: "10%" },
        { key: "created_at", label: t("DATE"), width: "10%" },
      ],
      rows: transfers.map((tr) => ({
        ...tr,
        amount: Number(tr.amount).toFixed(2),
        final_amount: Number(tr.final_amount).toFixed(2),
        status: tr.status.toUpperCase(),
        created_at: new Date(tr.created_at).toLocaleDateString(),
      })),
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            {t("INTER-COUNTRY TRANSFERS")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("Secure cross-country funds and party balance transfers with idempotent acceptance")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTransfers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("REFRESH")}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintRegister}>
            <Printer className="h-4 w-4 mr-1" />
            {t("PRINT REGISTER")}
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {feedback.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("send")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "send"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Send className="inline-block h-4 w-4 mr-1" />
          {t("SEND TRANSFER")}
        </button>
        <button
          onClick={() => setActiveTab("register")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "register"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowRightLeft className="inline-block h-4 w-4 mr-1" />
          {t("TRANSFERS REGISTER & QUEUE")} ({transfers.length})
        </button>
      </div>

      {/* Tab: Send */}
      {activeTab === "send" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("CREATE NEW INTER-COUNTRY TRANSFER")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendTransfer} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Source Section */}
                <div className="space-y-4 p-4 rounded-lg bg-muted/40 border border-border">
                  <h3 className="font-semibold text-sm text-primary flex items-center gap-1.5">
                    <Send className="h-4 w-4" /> {t("SOURCE COUNTRY & ACCOUNTS")}
                  </h3>
                  <div className="space-y-2">
                    <Label>{t("SOURCE COUNTRY")} *</Label>
                    <select
                      value={sourceCountryId}
                      onChange={(e) => {
                        setSourceCountryId(e.target.value);
                        const c = countries.find((x) => x.id === e.target.value);
                        if (c?.currency_code) setOriginalCurrency(c.currency_code);
                      }}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      required
                    >
                      <option value="">-- {t("SELECT COUNTRY")} --</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.currency_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("SOURCE LEDGER")} (Bank / Cash)</Label>
                    <select
                      value={sourceBankCashLedgerId}
                      onChange={(e) => setSourceBankCashLedgerId(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">-- {t("Select Source Ledger")} --</option>
                      {ledgers
                        .filter((l) => !sourceCountryId || l.country_id === sourceCountryId)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.currency})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("SOURCE PARTY")} (Party / Inter-Country Ledger)</Label>
                    <select
                      value={sourcePartyLedgerId}
                      onChange={(e) => setSourcePartyLedgerId(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">-- {t("Select Party Ledger")} --</option>
                      {ledgers
                        .filter((l) => !sourceCountryId || l.country_id === sourceCountryId)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.currency})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Destination Section */}
                <div className="space-y-4 p-4 rounded-lg bg-muted/40 border border-border">
                  <h3 className="font-semibold text-sm text-primary flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> {t("DESTINATION COUNTRY & ACCOUNTS")}
                  </h3>
                  <div className="space-y-2">
                    <Label>{t("DESTINATION COUNTRY")} *</Label>
                    <select
                      value={destCountryId}
                      onChange={(e) => {
                        setDestCountryId(e.target.value);
                        const c = countries.find((x) => x.id === e.target.value);
                        if (c?.currency_code) setFinalCurrency(c.currency_code);
                      }}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      required
                    >
                      <option value="">-- {t("SELECT COUNTRY")} --</option>
                      {countries
                        .filter((c) => c.id !== sourceCountryId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.currency_code})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("DESTINATION LEDGER")} (Optional - Receiver can assign)</Label>
                    <select
                      value={destBankCashLedgerId}
                      onChange={(e) => setDestBankCashLedgerId(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">-- {t("Select Destination Ledger")} --</option>
                      {ledgers
                        .filter((l) => !destCountryId || l.country_id === destCountryId)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.currency})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("DESTINATION PARTY")} (Optional - Receiver can assign)</Label>
                    <select
                      value={destPartyLedgerId}
                      onChange={(e) => setDestPartyLedgerId(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">-- {t("Select Destination Party")} --</option>
                      {ledgers
                        .filter((l) => !destCountryId || l.country_id === destCountryId)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.currency})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Amount, Currencies & Exchange Rate */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/20 border border-border">
                <div className="space-y-2">
                  <Label>{t("TRANSFER AMOUNT")} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("ORIGINAL CURRENCY")}</Label>
                  <Input
                    value={originalCurrency}
                    onChange={(e) => setOriginalCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("EXCHANGE RATE")} (1 {originalCurrency} = ? {finalCurrency})</Label>
                  <Input
                    type="number"
                    step="0.00000001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("FINAL AMOUNT")} ({finalCurrency})</Label>
                  <div className="h-10 px-3 rounded-md bg-background flex items-center border border-input font-semibold text-primary">
                    {finalCalculatedAmount} {finalCurrency}
                  </div>
                </div>
              </div>

              {/* Direction & Narration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("ENTRY TYPE")}</Label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as "debit" | "credit")}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="debit">{t("DEBIT (DR)")} - Payment Sent</option>
                    <option value="credit">{t("CREDIT (CR)")} - Funds Credited</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t("DESCRIPTION / PARTICULARS")}</Label>
                  <Input
                    placeholder={t("TRANSFER MEMO, REFERENCE DETAILS, PURPOSE...")}
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="submit" disabled={submitting}>
                  <Send className="h-4 w-4 mr-1.5" />
                  {submitting ? t("LOADING...") : t("SEND TRANSFER")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab: Register */}
      {activeTab === "register" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t("INTER-COUNTRY TRANSFERS REGISTER")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-y border-border">
                  <tr>
                    <th className="py-3 px-4 text-left font-semibold">{t("TRANSFER NO")}</th>
                    <th className="py-3 px-4 text-left font-semibold">{t("SOURCE COUNTRY")}</th>
                    <th className="py-3 px-4 text-left font-semibold">{t("DESTINATION COUNTRY")}</th>
                    <th className="py-3 px-4 text-right font-semibold">{t("AMOUNT")}</th>
                    <th className="py-3 px-4 text-right font-semibold">{t("FINAL AMOUNT")}</th>
                    <th className="py-3 px-4 text-center font-semibold">{t("STATUS")}</th>
                    <th className="py-3 px-4 text-left font-semibold">{t("DATE")}</th>
                    <th className="py-3 px-4 text-center font-semibold">{t("ACTIONS")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        {loading ? t("LOADING ACCOUNTS...") : t("NO LEDGER TRANSACTIONS FOUND FOR THE SELECTED PERIOD.")}
                      </td>
                    </tr>
                  ) : (
                    transfers.map((tr) => (
                      <tr key={tr.id} className="hover:bg-muted/30">
                        <td className="py-3 px-4 font-mono font-medium">{tr.transfer_no}</td>
                        <td className="py-3 px-4">{tr.source_country_name || tr.source_country_id}</td>
                        <td className="py-3 px-4">{tr.dest_country_name || tr.dest_country_id}</td>
                        <td className="py-3 px-4 text-right font-semibold">
                          {Number(tr.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                          <span className="text-xs text-muted-foreground">{tr.original_currency}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-primary">
                          {Number(tr.final_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                          <span className="text-xs text-muted-foreground">{tr.final_currency}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              tr.status === "accepted"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : tr.status === "pending"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {tr.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {new Date(tr.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {tr.status === "pending" ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                onClick={() => {
                                  setSelectedTransfer(tr);
                                  setActionModal("accept");
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {t("ACCEPT")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setSelectedTransfer(tr);
                                  setActionModal("edit");
                                }}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                {t("EDIT")}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setSelectedTransfer(tr);
                                  setActionModal("reject");
                                }}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                {t("REJECT")}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {tr.status === "accepted" ? "Posted" : "Closed"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accept Modal */}
      {actionModal === "accept" && selectedTransfer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg p-6 max-w-md w-full border border-border shadow-xl space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> {t("ACCEPT TRANSFER")} {selectedTransfer.transfer_no}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("SELECT DESTINATION RECEIVING LEDGERS TO POST INTO LOCAL ACCOUNTS.")}
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t("Destination Debit Ledger")} *</Label>
                <select
                  value={acceptDebitLedgerId}
                  onChange={(e) => setAcceptDebitLedgerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">-- {t("Select Debit Ledger")} --</option>
                  {ledgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>{t("Destination Credit Ledger")} *</Label>
                <select
                  value={acceptCreditLedgerId}
                  onChange={(e) => setAcceptCreditLedgerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">-- {t("Select Credit Ledger")} --</option>
                  {ledgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.currency})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setActionModal(null)} disabled={submitting}>
                {t("CANCEL")}
              </Button>
              <Button onClick={handleAccept} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting ? "Processing..." : t("ACCEPT TRANSFER")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {actionModal === "reject" && selectedTransfer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg p-6 max-w-md w-full border border-border shadow-xl space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-rose-600">
              <XCircle className="h-5 w-5" /> Reject Transfer {selectedTransfer.transfer_no}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("Please enter the reason for rejecting this transfer:")}
            </p>

            <div className="space-y-2">
              <Label>{t("REJECTION REASON")} *</Label>
              <Input
                placeholder={t("INCORRECT AMOUNT, WRONG PARTY, NOT AUTHORIZED...")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setActionModal(null)} disabled={submitting}>
                {t("CANCEL")}
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={submitting}>
                {submitting ? "Processing..." : t("REJECT TRANSFER")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {actionModal === "edit" && selectedTransfer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg p-6 max-w-md w-full border border-border shadow-xl space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
              <Edit className="h-5 w-5" /> {t("Edit Destination Accounts")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("Modify the assigned receiving ledger before accepting:")}
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t("DESTINATION BANK/CASH LEDGER")}</Label>
                <select
                  value={editBankLedgerId}
                  onChange={(e) => setEditBankLedgerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">{t("-- SELECT BANK/CASH LEDGER --")}</option>
                  {ledgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>{t("DESTINATION PARTY LEDGER")}</Label>
                <select
                  value={editPartyLedgerId}
                  onChange={(e) => setEditPartyLedgerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">-- {t("Select Party Ledger")} --</option>
                  {ledgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.currency})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setActionModal(null)} disabled={submitting}>
                {t("CANCEL")}
              </Button>
              <Button onClick={handleEditLedger} disabled={submitting}>
                {submitting ? "Saving..." : t("SAVE")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
