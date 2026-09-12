"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  AlertCircle,
  Ship,
  Briefcase,
  Layers,
  Search,
  Eye,
  Calendar,
  FileText,
  Building2,
  Check,
  Globe,
  Clock,
  ExternalLink,
} from "lucide-react";

type TransferRecord = {
  id: string;
  transfer_no: string;
  global_reference_id?: string;
  source_country_id: string;
  source_country_name?: string;
  dest_country_id: string;
  dest_country_name?: string;
  source_bank_cash_name?: string;
  dest_ledger_name?: string;
  dest_country_account_name?: string;
  src_country_account_name?: string;
  amount: number;
  original_currency: string;
  exchange_rate: number;
  final_currency: string;
  final_amount: number;
  direction: string;
  status: "pending" | "accepted" | "rejected" | "returned" | "cancelled";
  narration?: string;
  remarks?: string;
  sender_name?: string;
  receiver_name?: string;
  accepted_by_name?: string;
  rejected_by_name?: string;
  rejection_reason?: string;
  created_at: string;
  accepted_at?: string;
  rejected_at?: string;
  sender_roznamcha_entry_id?: string;
  receiver_roznamcha_entry_id?: string;
  // First-class reference fields
  bill_number?: string | null;
  container_number?: string | null;
  order_reference?: string | null;
  bl_number?: string | null;
  job_number?: string | null;
  customer_party_name?: string | null;
  reference_date?: string | null;
  claim_category?: "general_business" | "shipping_line" | "trade" | null;
  claim_description?: string | null;
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
  code?: string;
};

type CountryMainAccount = {
  ledgerId: string;
  accountId: string | null;
  code: string;
  name: string;
  currency: string;
  countryId: string;
  countryName: string;
};

type WorkflowTab = "incoming" | "sent" | "pending" | "accepted" | "rejected";

export default function InterCountryTransfersPage() {
  const language = useActiveLanguage();
  const t = (k: string) => translateHeader(language, k);

  // Workflow Tabs: Incoming, Sent, Pending, Accepted, Rejected
  const [activeTab, setActiveTab] = useState<WorkflowTab>("incoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [countries, setCountries] = useState<Country[]>([]);
  const [countryAccounts, setCountryAccounts] = useState<CountryMainAccount[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [pendingIncomingCount, setPendingIncomingCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Active user / country session context
  const [activeCountryId, setActiveCountryId] = useState<string>("");

  // Modal / Drawer state for creating new claim
  const [showNewModal, setShowNewModal] = useState(false);
  const [claimCategory, setClaimCategory] = useState<"general_business" | "shipping_line">("general_business");
  const [sourceCountryId, setSourceCountryId] = useState("");
  const [destCountryId, setDestCountryId] = useState("");
  const [sourceBankCashLedgerId, setSourceBankCashLedgerId] = useState("");
  const [amount, setAmount] = useState("");
  const [originalCurrency, setOriginalCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [finalCurrency, setFinalCurrency] = useState("USD");
  const [direction, setDirection] = useState<"debit" | "credit">("debit");

  // Reference fields for new claim
  const [billNumber, setBillNumber] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [blNumber, setBlNumber] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [orderReference, setOrderReference] = useState("");
  const [customerPartyName, setCustomerPartyName] = useState("");
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [claimDescription, setClaimDescription] = useState("");
  const [remarks, setRemarks] = useState("");

  // Modal states for reviewing/accepting/rejecting
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null);
  const [actionModal, setActionModal] = useState<"accept" | "reject" | "details" | null>(null);
  const [acceptLocalLedgerId, setAcceptLocalLedgerId] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [acceptNote, setAcceptNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const finalCalculatedAmount = (Number(amount || 0) * Number(exchangeRate || 1)).toFixed(2);

  // Fetch reference metadata: countries, ledgers, authoritative 4 country accounts
  const fetchMetadata = useCallback(async () => {
    try {
      const [cRes, lRes, aRes] = await Promise.all([
        fetch("/api/erp/locations"),
        fetch("/api/erp/accounting/ledgers"),
        fetch("/api/erp/accounting/inter-country-transfers?action=country-accounts"),
      ]);
      if (cRes.ok) {
        const cData = await cRes.json();
        const rawCountries = cData.countries || cData || [];
        setCountries(rawCountries);
      }
      if (lRes.ok) {
        const lData = await lRes.json();
        setLedgers(lData.ledgers || lData || []);
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        setCountryAccounts(aData.countryAccounts || []);
      }
    } catch (e) {
      console.warn("Failed to load metadata", e);
    }
  }, []);

  // Fetch transfers filtered by active tab
  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("tab", activeTab);
      if (activeCountryId) params.set("countryId", activeCountryId);

      const res = await fetch(`/api/erp/accounting/inter-country-transfers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.transfers || []);
        if (typeof data.pendingIncomingCount === "number") {
          setPendingIncomingCount(data.pendingIncomingCount);
        }
      }
    } catch (e) {
      console.warn("Failed to load transfers", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeCountryId]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // Set default source country when countries load
  useEffect(() => {
    if (countries.length > 0 && !sourceCountryId) {
      // Prefer UAE/Dubai or Pakistan if available as default
      const defaultC = countries.find((c) => c.name.toLowerCase().includes("emirates") || c.name.toLowerCase().includes("dubai")) || countries[0];
      if (defaultC) {
        setSourceCountryId(defaultC.id);
        setOriginalCurrency(defaultC.currency_code || "USD");
        // default destination to Pakistan
        const pak = countries.find((c) => c.name.toLowerCase().includes("pakistan") && c.id !== defaultC.id);
        if (pak) {
          setDestCountryId(pak.id);
          setFinalCurrency(pak.currency_code || "PKR");
        }
      }
    }
  }, [countries, sourceCountryId]);

  // Handle destination country account hint
  const destAccount = useMemo(() => {
    return countryAccounts.find((ca) => ca.countryId === destCountryId);
  }, [countryAccounts, destCountryId]);

  const sourceAccount = useMemo(() => {
    return countryAccounts.find((ca) => ca.countryId === sourceCountryId);
  }, [countryAccounts, sourceCountryId]);

  // Filtered transfers based on search & category
  const filteredTransfers = useMemo(() => {
    return transfers.filter((tr) => {
      if (categoryFilter !== "all") {
        if ((tr.claim_category || "general_business") !== categoryFilter) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        tr.transfer_no?.toLowerCase().includes(q) ||
        tr.bill_number?.toLowerCase().includes(q) ||
        tr.container_number?.toLowerCase().includes(q) ||
        tr.bl_number?.toLowerCase().includes(q) ||
        tr.job_number?.toLowerCase().includes(q) ||
        tr.order_reference?.toLowerCase().includes(q) ||
        tr.customer_party_name?.toLowerCase().includes(q) ||
        tr.source_country_name?.toLowerCase().includes(q) ||
        tr.dest_country_name?.toLowerCase().includes(q) ||
        tr.narration?.toLowerCase().includes(q) ||
        tr.remarks?.toLowerCase().includes(q)
      );
    });
  }, [transfers, searchQuery, categoryFilter]);

  // Local ledgers eligible for receiver acceptance
  const eligibleLocalLedgers = useMemo(() => {
    if (!selectedTransfer) return [];
    return ledgers.filter((l) => {
      // Must match receiving country if specified
      if (l.country_id && l.country_id !== selectedTransfer.dest_country_id) return false;
      if (!ledgerSearch.trim()) return true;
      const q = ledgerSearch.toLowerCase();
      return l.name.toLowerCase().includes(q) || (l.code && l.code.toLowerCase().includes(q));
    });
  }, [ledgers, selectedTransfer, ledgerSearch]);

  // Submit New Claim / Transfer
  const handleCreateTransfer = async (e: React.FormEvent) => {
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
          amount: Number(amount),
          originalCurrency,
          exchangeRate: Number(exchangeRate || 1),
          finalCurrency,
          finalAmount: Number(finalCalculatedAmount),
          direction,
          claimCategory,
          billNumber: billNumber.trim() || null,
          containerNumber: containerNumber.trim() || null,
          blNumber: blNumber.trim() || null,
          jobNumber: jobNumber.trim() || null,
          orderReference: orderReference.trim() || null,
          customerPartyName: customerPartyName.trim() || null,
          referenceDate: referenceDate || null,
          claimDescription: claimDescription.trim() || null,
          remarks: remarks.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create claim/transfer");
      }

      setFeedback({
        type: "success",
        message: `Claim ${data.transferNo || "created"} submitted against ${destAccount?.countryName || "destination"}! It is now pending their acceptance.`,
      });

      // Reset form & close modal
      setAmount("");
      setBillNumber("");
      setContainerNumber("");
      setBlNumber("");
      setJobNumber("");
      setOrderReference("");
      setCustomerPartyName("");
      setClaimDescription("");
      setRemarks("");
      setShowNewModal(false);
      setActiveTab("sent");
      fetchTransfers();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "An unexpected error occurred." });
    } finally {
      setSubmitting(false);
    }
  };

  // Accept Claim
  const handleAcceptClaim = async () => {
    if (!selectedTransfer || !acceptLocalLedgerId) {
      setFeedback({ type: "error", message: "Please select a local ledger/party in your country to accept this claim." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/erp/accounting/inter-country-transfers/${selectedTransfer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          selectedLocalLedgerId: acceptLocalLedgerId,
          note: acceptNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to accept transfer");

      setFeedback({
        type: "success",
        message: `Claim ${selectedTransfer.transfer_no} successfully accepted! Roznamcha entry posted against ${selectedTransfer.src_country_account_name || "Originating Country Account"}.`,
      });
      setActionModal(null);
      setSelectedTransfer(null);
      setAcceptLocalLedgerId("");
      setAcceptNote("");
      fetchTransfers();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Acceptance failed" });
    } finally {
      setSubmitting(false);
    }
  };

  // Reject Claim
  const handleRejectClaim = async () => {
    if (!selectedTransfer || !rejectReason.trim()) {
      setFeedback({ type: "error", message: "A specific rejection reason is required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/erp/accounting/inter-country-transfers/${selectedTransfer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          reason: rejectReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject transfer");

      setFeedback({
        type: "success",
        message: `Claim ${selectedTransfer.transfer_no} rejected and returned to sender with reason recorded.`,
      });
      setActionModal(null);
      setSelectedTransfer(null);
      setRejectReason("");
      fetchTransfers();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Rejection failed" });
    } finally {
      setSubmitting(false);
    }
  };

  // Print Register
  const handlePrintRegister = () => {
    openUniversalPrintReport({
      title: `Inter-Country Transfers & Claims (${activeTab.toUpperCase()})`,
      reportType: "register",
      scope: {
        company: "Daman Business Group",
      },
      columns: [
        { key: "transfer_no", label: t("TRANSFER NO"), width: "12%" },
        { key: "claim_category", label: t("CATEGORY"), width: "10%" },
        { key: "source_country_name", label: t("ORIGIN"), width: "10%" },
        { key: "dest_country_name", label: t("DESTINATION"), width: "10%" },
        { key: "references", label: t("REFERENCES (BILL/CONT/BL)"), width: "18%" },
        { key: "customer_party_name", label: t("PARTY"), width: "12%" },
        { key: "amount", label: t("AMOUNT"), align: "right", width: "10%" },
        { key: "status", label: t("STATUS"), width: "8%" },
        { key: "created_at", label: t("DATE"), width: "10%" },
      ],
      rows: filteredTransfers.map((tr) => {
        const refs = [
          tr.bill_number ? `Bill: ${tr.bill_number}` : null,
          tr.container_number ? `Cont: ${tr.container_number}` : null,
          tr.bl_number ? `BL: ${tr.bl_number}` : null,
          tr.order_reference ? `Ord: ${tr.order_reference}` : null,
        ].filter(Boolean).join(", ") || "-";

        return {
          ...tr,
          claim_category: tr.claim_category === "shipping_line" ? "Shipping Line" : "General Business",
          references: refs,
          customer_party_name: tr.customer_party_name || "-",
          amount: `${Number(tr.amount).toFixed(2)} ${tr.original_currency}`,
          status: tr.status.toUpperCase(),
          created_at: new Date(tr.created_at).toLocaleDateString(),
        };
      }),
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      {/* ─── HEADER & ACTIONS ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ArrowRightLeft className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {t("INTER-COUNTRY TRANSFERS & CLAIMS")}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                {t("Country-to-country transfer, claim & settlement across Pakistan, Afghanistan, India & Dubai")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTransfers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {t("REFRESH")}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintRegister}>
            <Printer className="h-4 w-4 mr-1.5" />
            {t("PRINT REGISTER")}
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90"
            onClick={() => setShowNewModal(true)}
          >
            <Send className="h-4 w-4 mr-1.5" />
            {t("NEW TRANSFER / CLAIM")}
          </Button>
        </div>
      </div>

      {/* ─── TOP NOTIFICATION / ALERT BANNER ─────────────────────────── */}
      {pendingIncomingCount > 0 && activeTab !== "incoming" && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/90 dark:bg-amber-950/40 dark:border-amber-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Incoming Claims Awaiting Action ({pendingIncomingCount})
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                You have {pendingIncomingCount} incoming country transfer/claim requiring verification & Roznamcha acceptance.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs px-3 py-1.5 shrink-0"
            onClick={() => setActiveTab("incoming")}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Review Incoming Claims
          </Button>
        </div>
      )}

      {/* ─── FEEDBACK MESSAGES ────────────────────────────────────────── */}
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs underline hover:opacity-80">
            Dismiss
          </button>
        </div>
      )}

      {/* ─── 4 AUTHORITATIVE COUNTRY ACCOUNTS BAR ────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { code: "PAK", name: "Pakistan Country Account", ledger: "PAK-CORP-GEN-001", flag: "🇵🇰", currency: "PKR" },
          { code: "AFG", name: "Afghanistan Country Account", ledger: "AFG-CORP-GEN-001", flag: "🇦🇫", currency: "AFN" },
          { code: "IND", name: "India Country Account", ledger: "IND-CORP-GEN-001", flag: "🇮🇳", currency: "INR" },
          { code: "UAE", name: "Dubai / UAE Country Account", ledger: "UAE-CORP-GEN-001", flag: "🇦🇪", currency: "AED" },
        ].map((item) => {
          const liveAcct = countryAccounts.find((a) => a.code?.toUpperCase().includes(item.code) || a.countryName?.toUpperCase().includes(item.name.split(" ")[0].toUpperCase()));
          return (
            <div
              key={item.code}
              className="p-3 rounded-lg border border-border bg-card/60 backdrop-blur-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-base">{item.flag}</span> {item.name}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono font-bold">
                  {liveAcct?.currency || item.currency}
                </span>
              </div>
              <div className="text-xs font-mono font-semibold text-foreground truncate" title={liveAcct?.name || item.ledger}>
                {liveAcct?.code || item.ledger}
              </div>
              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                {liveAcct?.name || "Authoritative Clearing Ledger"}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 5 WORKFLOW TABS ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border gap-3 pb-2">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "incoming", label: "Incoming Claims", count: pendingIncomingCount, icon: ArrowRightLeft, badgeColor: "bg-amber-500 text-white" },
            { id: "sent", label: "Sent Claims", icon: Send },
            { id: "pending", label: "Pending", icon: Clock },
            { id: "accepted", label: "Accepted & Settled", icon: CheckCircle2 },
            { id: "rejected", label: "Rejected", icon: XCircle },
          ].map((tItem) => {
            const isSelected = activeTab === tItem.id;
            const Icon = tItem.icon;
            return (
              <button
                key={tItem.id}
                onClick={() => setActiveTab(tItem.id as WorkflowTab)}
                className={`relative px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t(tItem.label.toUpperCase())}</span>
                {typeof tItem.count === "number" && tItem.count > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected ? "bg-white text-primary" : tItem.badgeColor || "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {tItem.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters: Search & Category */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("Filter by bill, cont, BL, party...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-2 rounded-md border border-input bg-background text-xs"
          >
            <option value="all">All Categories</option>
            <option value="general_business">General Business / Trade</option>
            <option value="shipping_line">Shipping Line</option>
          </select>
        </div>
      </div>

      {/* ─── TRANSFERS & CLAIMS TABLE ────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/50">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span>
              {activeTab === "incoming" && "Incoming Claims Requiring Review"}
              {activeTab === "sent" && "Claims Sent to Other Countries"}
              {activeTab === "pending" && "All Pending Verification"}
              {activeTab === "accepted" && "Accepted & Balanced in Roznamcha"}
              {activeTab === "rejected" && "Rejected Claims & Audit Records"}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-normal">
              {filteredTransfers.length} records
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-medium">
                <tr>
                  <th className="py-3 px-3 text-left">{t("TRANSFER NO")}</th>
                  <th className="py-3 px-3 text-left">{t("CATEGORY")}</th>
                  <th className="py-3 px-3 text-left">{t("FROM / ORIGIN")}</th>
                  <th className="py-3 px-3 text-left">{t("TO / TARGET")}</th>
                  <th className="py-3 px-3 text-left">{t("REFERENCES")}</th>
                  <th className="py-3 px-3 text-left">{t("CUSTOMER / PARTY")}</th>
                  <th className="py-3 px-3 text-right">{t("AMOUNT")}</th>
                  <th className="py-3 px-3 text-center">{t("STATUS")}</th>
                  <th className="py-3 px-3 text-left">{t("DATE")}</th>
                  <th className="py-3 px-3 text-center">{t("ACTIONS")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                          <span>{t("Loading claims...")}</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-medium">{t("No transfer claims found in this tab.")}</p>
                          <p className="text-xs text-muted-foreground">
                            {activeTab === "incoming"
                              ? "No incoming claims are waiting for your country's review."
                              : "No records match the current filters."}
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((tr) => {
                    const isShipping = tr.claim_category === "shipping_line";
                    const isIncomingForMe = activeTab === "incoming" || tr.status === "pending";

                    return (
                      <tr key={tr.id} className="hover:bg-muted/20 transition-colors">
                        {/* Transfer No */}
                        <td className="py-3 px-3">
                          <div className="font-mono font-semibold text-primary">{tr.transfer_no}</div>
                          {tr.sender_name && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                              by {tr.sender_name}
                            </div>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-3">
                          {isShipping ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300">
                              <Ship className="h-3 w-3" /> Shipping Line
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300">
                              <Briefcase className="h-3 w-3" /> General Business
                            </span>
                          )}
                        </td>

                        {/* Origin Country */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground">{tr.source_country_name || tr.source_country_id}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {tr.src_country_account_name || "Country Account"}
                          </div>
                        </td>

                        {/* Destination Country */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground">{tr.dest_country_name || tr.dest_country_id}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {tr.dest_country_account_name || "Country Account"}
                          </div>
                        </td>

                        {/* Supporting References (Bill / Container / BL / Order) */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5 text-xs">
                            {tr.bill_number && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Bill:</span>
                                <span className="font-mono font-medium">{tr.bill_number}</span>
                              </div>
                            )}
                            {tr.container_number && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Cont:</span>
                                <span className="font-mono font-medium text-blue-600 dark:text-blue-400">{tr.container_number}</span>
                              </div>
                            )}
                            {tr.bl_number && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">BL:</span>
                                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{tr.bl_number}</span>
                              </div>
                            )}
                            {tr.job_number && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Job:</span>
                                <span className="font-mono font-medium">{tr.job_number}</span>
                              </div>
                            )}
                            {tr.order_reference && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Ord:</span>
                                <span className="font-mono font-medium">{tr.order_reference}</span>
                              </div>
                            )}
                            {!tr.bill_number && !tr.container_number && !tr.bl_number && !tr.job_number && !tr.order_reference && (
                              <span className="text-muted-foreground text-xs italic">-</span>
                            )}
                          </div>
                        </td>

                        {/* Customer / Party */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground">{tr.customer_party_name || "-"}</div>
                          {tr.narration && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[150px]" title={tr.narration}>
                              {tr.narration}
                            </div>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-3 text-right">
                          <div className="font-semibold text-foreground">
                            {Number(tr.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                            <span className="text-xs font-normal text-muted-foreground">{tr.original_currency}</span>
                          </div>
                          {tr.final_currency !== tr.original_currency && (
                            <div className="text-[11px] text-primary font-medium">
                              ≈ {Number(tr.final_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {tr.final_currency}
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                              tr.status === "accepted"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : tr.status === "pending"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {tr.status}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {tr.reference_date || new Date(tr.created_at).toLocaleDateString()}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {tr.status === "pending" ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                                onClick={() => {
                                  setSelectedTransfer(tr);
                                  setActionModal("accept");
                                }}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                {t("ACCEPT")}
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
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                {t("REJECT")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setSelectedTransfer(tr);
                                  setActionModal("details");
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setSelectedTransfer(tr);
                                setActionModal("details");
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                          )}
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

      {/* ─── MODAL: NEW INTER-COUNTRY CLAIM / TRANSFER ──────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background rounded-xl p-6 max-w-2xl w-full border border-border shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  {t("NEW INTER-COUNTRY TRANSFER / CLAIM")}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record claim against destination country using authoritative 4 Country Accounts
                </p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-5">
              {/* Category Toggle: General Business vs Shipping Line */}
              <div className="p-1 bg-muted rounded-lg flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setClaimCategory("general_business")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all ${
                    claimCategory === "general_business"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Briefcase className="h-4 w-4 text-primary" />
                  General Business / Trade
                </button>
                <button
                  type="button"
                  onClick={() => setClaimCategory("shipping_line")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all ${
                    claimCategory === "shipping_line"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Ship className="h-4 w-4 text-blue-600" />
                  Shipping Line Settlement
                </button>
              </div>

              {/* Source & Destination Countries */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Source Country */}
                <div className="space-y-2 p-3.5 rounded-lg border border-border bg-muted/20">
                  <Label className="text-xs font-semibold text-primary flex items-center gap-1">
                    <Send className="h-3.5 w-3.5" /> {t("SOURCE COUNTRY (ORIGIN)")} *
                  </Label>
                  <select
                    value={sourceCountryId}
                    onChange={(e) => {
                      setSourceCountryId(e.target.value);
                      const c = countries.find((x) => x.id === e.target.value);
                      if (c?.currency_code) setOriginalCurrency(c.currency_code);
                    }}
                    className="w-full h-9 px-2.5 rounded-md border border-input bg-background text-xs"
                    required
                  >
                    <option value="">-- {t("Select Source Country")} --</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.currency_code})
                      </option>
                    ))}
                  </select>

                  <div className="space-y-1 pt-1">
                    <Label className="text-[11px] text-muted-foreground">{t("Paid via (Source Bank / Cash)")}</Label>
                    <select
                      value={sourceBankCashLedgerId}
                      onChange={(e) => setSourceBankCashLedgerId(e.target.value)}
                      className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                    >
                      <option value="">-- {t("Select Bank or Cash Account")} --</option>
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

                {/* Destination Country */}
                <div className="space-y-2 p-3.5 rounded-lg border border-border bg-muted/20">
                  <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t("DESTINATION COUNTRY (CLAIM TARGET)")} *
                  </Label>
                  <select
                    value={destCountryId}
                    onChange={(e) => {
                      setDestCountryId(e.target.value);
                      const c = countries.find((x) => x.id === e.target.value);
                      if (c?.currency_code) setFinalCurrency(c.currency_code);
                    }}
                    className="w-full h-9 px-2.5 rounded-md border border-input bg-background text-xs"
                    required
                  >
                    <option value="">-- {t("Select Destination Country")} --</option>
                    {countries
                      .filter((c) => c.id !== sourceCountryId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.currency_code})
                        </option>
                      ))}
                  </select>

                  <div className="pt-1">
                    <div className="p-2 rounded bg-background border border-border text-[11px]">
                      <span className="text-muted-foreground">Target Country Account:</span>
                      <div className="font-mono font-semibold text-foreground truncate mt-0.5">
                        {destAccount?.code || "Country Account"} - {destAccount?.name || "Clearing Ledger"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Specific Supporting References */}
              <div className="p-4 rounded-lg border border-border bg-muted/10 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Supporting References & Payment Reason
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("Bill Number")}</Label>
                    <Input
                      placeholder="e.g. BILL-9021"
                      value={billNumber}
                      onChange={(e) => setBillNumber(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t("Container Number")}</Label>
                    <Input
                      placeholder="e.g. MSCU1234567"
                      value={containerNumber}
                      onChange={(e) => setContainerNumber(e.target.value.toUpperCase())}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t("Reference Date")}</Label>
                    <Input
                      type="date"
                      value={referenceDate}
                      onChange={(e) => setReferenceDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Shipping-specific fields */}
                  {claimCategory === "shipping_line" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-blue-600 font-semibold">{t("BL Number (Bill of Lading)")} *</Label>
                        <Input
                          placeholder="e.g. MAEU987654321"
                          value={blNumber}
                          onChange={(e) => setBlNumber(e.target.value.toUpperCase())}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-blue-600 font-semibold">{t("Job Number")}</Label>
                        <Input
                          placeholder="e.g. JOB-KHI-2026"
                          value={jobNumber}
                          onChange={(e) => setJobNumber(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">{t("Order / Purchase Ref")}</Label>
                    <Input
                      placeholder="e.g. PO-8872"
                      value={orderReference}
                      onChange={(e) => setOrderReference(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">{t("Customer / Party Name")}</Label>
                    <Input
                      placeholder="e.g. Al-Faisal Traders / Global Logistics"
                      value={customerPartyName}
                      onChange={(e) => setCustomerPartyName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-xs">{t("Remarks / Payment Reason")}</Label>
                  <Input
                    placeholder="e.g. Paid THC & freight charges on behalf of Pakistan container shipment"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Amount, Currencies & Exchange Rate */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-lg border border-border bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{t("CLAIM AMOUNT")} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-9 text-xs font-semibold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("CURRENCY")}</Label>
                  <Input
                    value={originalCurrency}
                    onChange={(e) => setOriginalCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("EXCHANGE RATE")}</Label>
                  <Input
                    type="number"
                    step="0.00000001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("DEST AMOUNT")}</Label>
                  <div className="h-9 px-2.5 rounded-md bg-background flex items-center border border-input text-xs font-bold text-primary">
                    {finalCalculatedAmount} {finalCurrency}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewModal(false)}
                  disabled={submitting}
                >
                  {t("CANCEL")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-primary text-primary-foreground font-semibold"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {submitting ? t("SUBMITTING...") : t("SUBMIT CLAIM / TRANSFER")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: REVIEW & ACCEPT CLAIM ──────────────────────────── */}
      {actionModal === "accept" && selectedTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background rounded-xl p-6 max-w-lg w-full border border-border shadow-2xl space-y-5 my-8">
            <div className="border-b border-border pb-3">
              <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                {t("ACCEPT & POST CLAIM")} {selectedTransfer.transfer_no}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign local party/account. Roznamcha entry will balance against {selectedTransfer.src_country_account_name || "Origin Country Account"}.
              </p>
            </div>

            {/* Claim Summary Card */}
            <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2 text-xs">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-muted-foreground">Amount:</span>
                <span className="text-base text-foreground font-bold font-mono">
                  {Number(selectedTransfer.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedTransfer.original_currency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Submitted by:</span>
                <span className="font-medium text-foreground">
                  {selectedTransfer.source_country_name} ({selectedTransfer.sender_name || "Agent"})
                </span>
              </div>
              {selectedTransfer.bill_number && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bill No:</span>
                  <span className="font-mono font-medium">{selectedTransfer.bill_number}</span>
                </div>
              )}
              {selectedTransfer.container_number && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Container No:</span>
                  <span className="font-mono font-medium text-blue-600">{selectedTransfer.container_number}</span>
                </div>
              )}
              {selectedTransfer.bl_number && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">BL No:</span>
                  <span className="font-mono font-medium text-emerald-600">{selectedTransfer.bl_number}</span>
                </div>
              )}
              {selectedTransfer.customer_party_name && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Party / Customer:</span>
                  <span className="font-medium">{selectedTransfer.customer_party_name}</span>
                </div>
              )}
              {selectedTransfer.remarks && (
                <div className="pt-1 text-muted-foreground border-t border-border/50 italic">
                  &ldquo;{selectedTransfer.remarks}&rdquo;
                </div>
              )}
            </div>

            {/* Destination Local Ledger Selection */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  {t("Select Local Account / Party in Your Country")} *
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Choose the local customer, job, or expense ledger in your country to be debited.
                </p>
                <div className="space-y-1">
                  <Input
                    placeholder="Search local ledgers..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="h-8 text-xs mb-1.5"
                  />
                  <select
                    value={acceptLocalLedgerId}
                    onChange={(e) => setAcceptLocalLedgerId(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md border border-input bg-background text-xs font-medium"
                    required
                  >
                    <option value="">-- {t("Select Local Ledger")} --</option>
                    {eligibleLocalLedgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.currency}) {l.code ? `[${l.code}]` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Roznamcha Balance Preview */}
              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 text-xs space-y-1 text-emerald-900 dark:text-emerald-200">
                <div className="font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Automatic Balanced Roznamcha Entry:
                </div>
                <div className="font-mono text-[11px] pl-4">
                  <div>Debit (DR): [Selected Local Ledger]</div>
                  <div>Credit (CR): {selectedTransfer.src_country_account_name || "Source Country Account"}</div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t("Acceptance Note (Optional)")}</Label>
                <Input
                  placeholder="e.g. Verified against container loading bill"
                  value={acceptNote}
                  onChange={(e) => setAcceptNote(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionModal(null);
                  setSelectedTransfer(null);
                }}
                disabled={submitting}
              >
                {t("CANCEL")}
              </Button>
              <Button
                size="sm"
                onClick={handleAcceptClaim}
                disabled={submitting || !acceptLocalLedgerId}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Check className="h-4 w-4 mr-1.5" />
                {submitting ? "Posting Roznamcha..." : "Accept & Post to Roznamcha"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: REJECT CLAIM ───────────────────────────────────── */}
      {actionModal === "reject" && selectedTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl p-6 max-w-md w-full border border-border shadow-2xl space-y-4">
            <div className="border-b border-border pb-3">
              <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Reject Claim {selectedTransfer.transfer_no}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                The claim will be returned to {selectedTransfer.source_country_name} with your reason.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("REJECTION REASON")} *</Label>
              <textarea
                placeholder={t("Explain why this claim cannot be accepted (e.g. Incorrect container number, already settled, wrong party, amount discrepancy)...")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full p-2.5 rounded-md border border-input bg-background text-xs"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionModal(null);
                  setSelectedTransfer(null);
                }}
                disabled={submitting}
              >
                {t("CANCEL")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRejectClaim}
                disabled={submitting || !rejectReason.trim()}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                {submitting ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: VIEW DETAILS ───────────────────────────────────── */}
      {actionModal === "details" && selectedTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background rounded-xl p-6 max-w-lg w-full border border-border shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Transfer & Claim Details [{selectedTransfer.transfer_no}]
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {selectedTransfer.global_reference_id || selectedTransfer.id}
                </span>
              </div>
              <button
                onClick={() => {
                  setActionModal(null);
                  setSelectedTransfer(null);
                }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <span className="text-muted-foreground">Source Country:</span>
                  <div className="font-semibold">{selectedTransfer.source_country_name}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">{selectedTransfer.src_country_account_name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Destination Country:</span>
                  <div className="font-semibold">{selectedTransfer.dest_country_name}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">{selectedTransfer.dest_country_account_name}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <div className="font-bold text-base text-primary">
                    {Number(selectedTransfer.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedTransfer.original_currency}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-1">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        selectedTransfer.status === "accepted"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : selectedTransfer.status === "pending"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      }`}
                    >
                      {selectedTransfer.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* All References */}
              <div className="p-3 rounded-lg border border-border space-y-1.5">
                <div className="font-semibold text-muted-foreground uppercase text-[10px]">Reference Audit</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {selectedTransfer.bill_number && (
                    <div><span className="text-muted-foreground">Bill No:</span> <span className="font-mono font-medium">{selectedTransfer.bill_number}</span></div>
                  )}
                  {selectedTransfer.container_number && (
                    <div><span className="text-muted-foreground">Container No:</span> <span className="font-mono font-medium text-blue-600">{selectedTransfer.container_number}</span></div>
                  )}
                  {selectedTransfer.bl_number && (
                    <div><span className="text-muted-foreground">BL No:</span> <span className="font-mono font-medium text-emerald-600">{selectedTransfer.bl_number}</span></div>
                  )}
                  {selectedTransfer.job_number && (
                    <div><span className="text-muted-foreground">Job No:</span> <span className="font-mono font-medium">{selectedTransfer.job_number}</span></div>
                  )}
                  {selectedTransfer.order_reference && (
                    <div><span className="text-muted-foreground">Order Ref:</span> <span className="font-mono font-medium">{selectedTransfer.order_reference}</span></div>
                  )}
                  {selectedTransfer.customer_party_name && (
                    <div><span className="text-muted-foreground">Party:</span> <span className="font-medium">{selectedTransfer.customer_party_name}</span></div>
                  )}
                </div>
              </div>

              {/* Roznamcha Vouchers */}
              {(selectedTransfer.sender_roznamcha_entry_id || selectedTransfer.receiver_roznamcha_entry_id) && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                  <div className="font-semibold text-[10px] text-primary uppercase">Roznamcha Posting Audit</div>
                  {selectedTransfer.sender_roznamcha_entry_id && (
                    <div className="text-[11px] font-mono">
                      Sender Voucher ID: <span className="font-bold">{selectedTransfer.sender_roznamcha_entry_id}</span>
                    </div>
                  )}
                  {selectedTransfer.receiver_roznamcha_entry_id && (
                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                      Receiver Voucher ID: <span className="font-bold">{selectedTransfer.receiver_roznamcha_entry_id}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedTransfer.rejection_reason && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300">
                  <div className="font-semibold text-[11px]">Rejection Reason:</div>
                  <div className="text-xs mt-0.5">{selectedTransfer.rejection_reason}</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionModal(null);
                  setSelectedTransfer(null);
                }}
              >
                {t("CLOSE")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
