"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Truck,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Search,
  Filter,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  Download,
  CreditCard,
  Plus,
  History,
  X,
  ExternalLink,
  Phone,
  User,
  Building2,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { Th } from "@/components/ui/translated-th";
import { BankPicker } from "@/features/banks/components/bank-picker";
import { printStore } from "@/lib/store/print-store";

export type TransportBookingRecord = {
  id: string;
  loadingRecordNo: string;
  purchaseOrderId: string | null;
  purchaseOrderNo: string;
  billInvoiceNo: string;
  supplierAccount: string;
  goodsName: string;
  country: string;
  branch: string;
  createdAt: string;
  loadedAt: string | null;
  loadingLocation: string;
  receivingLocation: string;
  transportMode: string;
  transporterName: string;
  truckNo: string;
  driverName: string;
  driverMobile: string;
  transportCurrency: string;
  transportCharges: number;
  transportPaid: number;
  transportBalance: number;
  isFullyPaid: boolean;
  paymentStatus: "Fully Paid" | "Partially Paid" | "Unpaid";
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    paymentDate: string;
    paymentMethod: string;
    bankOrCashAccountName?: string | null;
    transporterName?: string | null;
    referenceNo?: string | null;
    receiptNo?: string | null;
    narration?: string | null;
    createdBy?: string | null;
    createdAt?: string;
  }>;
  // Purchase bill details kept separate
  purchaseBillTotal: number;
  purchaseTotalPaid: number;
  purchaseRemainingDue: number;
  purchasePaymentStatus: string;
};

export function TransportPaymentBookingWorkspace() {
  const activeLang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(activeLang, key as never, fallback);

  const [records, setRecords] = useState<TransportBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "outstanding" | "paid">("all");
  const [selectedRecordForPayment, setSelectedRecordForPayment] = useState<TransportBookingRecord | null>(null);
  const [selectedRecordForHistory, setSelectedRecordForHistory] = useState<TransportBookingRecord | null>(null);
  const [selectedRecordForCharges, setSelectedRecordForCharges] = useState<TransportBookingRecord | null>(null);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("USD");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [bankOrCashAccount, setBankOrCashAccount] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [narration, setNarration] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [actionError, setActionError] = useState("");

  // Charges form state
  const [chargesAmount, setChargesAmount] = useState("");
  const [chargesCurrency, setChargesCurrency] = useState("USD");
  const [transporterInput, setTransporterInput] = useState("");
  const [truckNoInput, setTruckNoInput] = useState("");
  const [driverNameInput, setDriverNameInput] = useState("");
  const [driverMobileInput, setDriverMobileInput] = useState("");
  const [transportModeInput, setTransportModeInput] = useState("By Road");
  const [submittingCharges, setSubmittingCharges] = useState(false);

  async function loadRecords() {
    setLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/erp/purchases/transport-payments");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to load transport bookings");
      setRecords(json?.data?.records || json?.records || []);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter === "outstanding" && r.isFullyPaid) return false;
      if (statusFilter === "paid" && !r.isFullyPaid) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        r.purchaseOrderNo.toLowerCase().includes(q) ||
        r.billInvoiceNo.toLowerCase().includes(q) ||
        r.loadingRecordNo.toLowerCase().includes(q) ||
        r.transporterName.toLowerCase().includes(q) ||
        r.truckNo.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        r.supplierAccount.toLowerCase().includes(q)
      );
    });
  }, [records, statusFilter, query]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCount = records.length;
    const outstandingCount = records.filter((r) => !r.isFullyPaid).length;
    const fullyPaidCount = records.filter((r) => r.isFullyPaid).length;
    const totalPayable = records.reduce((sum, r) => sum + r.transportCharges, 0);
    const totalPaid = records.reduce((sum, r) => sum + r.transportPaid, 0);
    const totalRemaining = records.reduce((sum, r) => sum + r.transportBalance, 0);
    return { totalCount, outstandingCount, fullyPaidCount, totalPayable, totalPaid, totalRemaining };
  }, [records]);

  function openPaymentModal(r: TransportBookingRecord) {
    setSelectedRecordForPayment(r);
    setPaymentAmount(r.transportBalance > 0 ? String(r.transportBalance) : "");
    setPaymentCurrency(r.transportCurrency || "USD");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("Bank Transfer");
    setBankOrCashAccount("");
    setReferenceNo(`TR-${Date.now().toString().slice(-6)}`);
    setNarration(`Transport freight payment for PO #${r.purchaseOrderNo} / Truck ${r.truckNo}`);
    setActionError("");
  }

  function openChargesModal(r: TransportBookingRecord) {
    setSelectedRecordForCharges(r);
    setChargesAmount(String(r.transportCharges || ""));
    setChargesCurrency(r.transportCurrency || "USD");
    setTransporterInput(r.transporterName !== "-" ? r.transporterName : "");
    setTruckNoInput(r.truckNo !== "-" ? r.truckNo : "");
    setDriverNameInput(r.driverName !== "-" ? r.driverName : "");
    setDriverMobileInput(r.driverMobile !== "-" ? r.driverMobile : "");
    setTransportModeInput(r.transportMode || "By Road");
    setActionError("");
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRecordForPayment) return;
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      setActionError("Please enter a valid payment amount.");
      return;
    }

    setSubmittingPayment(true);
    setActionError("");
    try {
      const res = await fetch("/api/erp/purchases/transport-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loadingRecordId: selectedRecordForPayment.id,
          amount: amt,
          currency: paymentCurrency,
          paymentDate,
          paymentMethod,
          bankOrCashAccountName: bankOrCashAccount || "Main Cash / Bank Account",
          transporterName: selectedRecordForPayment.transporterName,
          truckNo: selectedRecordForPayment.truckNo,
          driverName: selectedRecordForPayment.driverName,
          referenceNo,
          narration
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to record payment");

      setSelectedRecordForPayment(null);
      await loadRecords();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to record transport payment");
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function handleUpdateCharges(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRecordForCharges) return;

    setSubmittingCharges(true);
    setActionError("");
    try {
      const res = await fetch("/api/erp/purchases/transport-payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loadingRecordId: selectedRecordForCharges.id,
          transportCharges: Number(chargesAmount || 0),
          currency: chargesCurrency,
          transporterName: transporterInput,
          truckNo: truckNoInput,
          driverName: driverNameInput,
          driverMobile: driverMobileInput,
          transportMode: transportModeInput
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to update charges");

      setSelectedRecordForCharges(null);
      await loadRecords();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to update transport charges");
    } finally {
      setSubmittingCharges(false);
    }
  }

  function handlePrintReceipt(record: TransportBookingRecord, payment: any) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Transport Payment Receipt - ${payment.referenceNo || record.purchaseOrderNo}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; color: #0f172a; margin: 20px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; }
          .title { font-size: 20px; font-weight: 900; text-transform: uppercase; color: #0f172a; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #0f172a; color: #fff; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
          .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
          .box-label { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .box-val { font-size: 13px; font-weight: 700; color: #0f172a; }
          .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          .table th, .table td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
          .table th { background: #f8fafc; font-size: 10px; font-weight: 800; text-transform: uppercase; }
          .total-box { margin-top: 16px; border: 2px solid #0f172a; border-radius: 6px; padding: 12px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Transport Freight Payment Receipt</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">DIGITAL DOCK ERP — LOGISTICS & TRANSPORT ACCOUNTING</div>
          </div>
          <div style="text-align: right;">
            <span class="badge">WORKFLOW STAGE 4</span>
            <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Receipt: ${payment.receiptNo || "TR-REC"}</div>
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-label">Purchase Booking & Order</div>
            <div class="box-val">PO #${record.purchaseOrderNo}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Bill / Invoice: <b>${record.billInvoiceNo}</b></div>
            <div style="font-size: 11px; color: #64748b;">Loading Record: <b>${record.loadingRecordNo}</b></div>
          </div>
          <div class="box">
            <div class="box-label">Transporter & Vehicle Details</div>
            <div class="box-val">${record.transporterName}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Truck / Vehicle No: <b>${record.truckNo}</b></div>
            <div style="font-size: 11px; color: #64748b;">Driver: <b>${record.driverName}</b> (${record.driverMobile})</div>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Payment Date</th>
              <th>Reference No</th>
              <th>Payment Method</th>
              <th>Account Paid From</th>
              <th>Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>${payment.paymentDate || new Date().toISOString().slice(0, 10)}</b></td>
              <td><b>${payment.referenceNo || "-"}</b></td>
              <td>${payment.paymentMethod || "Bank Transfer"}</td>
              <td>${payment.bankOrCashAccountName || "Cash/Bank"}</td>
              <td style="font-size: 14px; font-weight: 900; color: #0f172a;">${Number(payment.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${payment.currency || "USD"}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-box">
          <div>
            <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Transport Charges Reconciliation</div>
            <div style="font-size: 11px; margin-top: 4px;">Total Transport Charge: <b>${record.transportCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${record.transportCurrency}</b></div>
            <div style="font-size: 11px;">Total Paid to Date: <b>${record.transportPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${record.transportCurrency}</b></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Balance Remaining</div>
            <div style="font-size: 18px; font-weight: 900; color: ${record.transportBalance <= 0.005 ? '#0f172a' : '#e11d48'};">
              ${record.transportBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${record.transportCurrency}
            </div>
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase;">
              ${record.transportBalance <= 0.005 ? 'Fully Paid' : 'Balance Outstanding'}
            </div>
          </div>
        </div>

        <div style="margin-top: 14px; font-size: 10px; color: #64748b; font-style: italic;">
          * Note: Transport and freight charges are accounted separately from purchase bill settlements.
        </div>

        <div class="footer">
          <div>Prepared By: ${payment.createdBy || "Admin"}</div>
          <div>Transporter Signature: __________________</div>
          <div>Authorized Signatory: __________________</div>
        </div>
      </body>
      </html>
    `;
    printStore.openPrint(html, `Transport-Receipt-${record.purchaseOrderNo}`);
  }

  function exportCsv() {
    const headers = [
      "Booking No",
      "Bill / Invoice No",
      "Loading Record No",
      "Account Name",
      "Country",
      "Transporter",
      "Truck / Container No",
      "Driver Name",
      "Driver Mobile",
      "Transport Currency",
      "Transport Payable",
      "Transport Paid",
      "Transport Remaining",
      "Transport Status",
      "Purchase Bill Total",
      "Purchase Total Paid",
      "Purchase Remaining",
      "Purchase Status"
    ];

    const rows = filteredRecords.map((r) => [
      r.purchaseOrderNo,
      r.billInvoiceNo,
      r.loadingRecordNo,
      r.supplierAccount,
      r.country,
      r.transporterName,
      r.truckNo,
      r.driverName,
      r.driverMobile,
      r.transportCurrency,
      r.transportCharges,
      r.transportPaid,
      r.transportBalance,
      r.isFullyPaid ? "Fully Paid" : "Outstanding",
      r.purchaseBillTotal,
      r.purchaseTotalPaid,
      r.purchaseRemainingDue,
      r.purchasePaymentStatus
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transport-payment-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full space-y-4 px-2 py-3 sm:px-4">
      {/* Top Workflow Stage Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-4 text-white shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-300 border border-blue-400/30">
              Workflow Stage 4
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
              Purchase Booking Module
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl flex items-center gap-2">
            <Truck className="h-6 w-6 text-blue-400" />
            Transport Payment Booking
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Track and settle freight charges and payments linked to each booking and transporter. Transport accounts remain strictly separate from purchase bill settlements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="h-9 border-slate-700 bg-slate-800/80 text-xs font-bold text-white hover:bg-slate-700"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-emerald-400" /> Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadRecords()}
            className="h-9 border-slate-700 bg-slate-800/80 text-xs font-bold text-white hover:bg-slate-700"
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-muted-foreground">Total Transport Bookings</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">{stats.totalCount}</span>
            <span className="text-[11px] font-bold text-muted-foreground">
              {stats.fullyPaidCount} settled / {stats.outstandingCount} due
            </span>
          </div>
        </Card>

        <Card className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-muted-foreground">Total Transport Payable</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-foreground">
              {stats.totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        <Card className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Total Transport Paid</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        <Card className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400">Transport Balance Due</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-600">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-700 dark:text-rose-400">
              {stats.totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
              stats.totalRemaining <= 0.005 ? "bg-slate-900 text-white" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
            )}>
              {stats.totalRemaining <= 0.005 ? "Fully Settled" : "Outstanding"}
            </span>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PO, Truck, Transporter, Driver..."
              className="h-8 w-64 pl-8 text-xs rounded-lg"
            />
          </div>

          <div className="flex items-center rounded-lg border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors",
                statusFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Bookings ({records.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("outstanding")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors flex items-center gap-1",
                statusFilter === "outstanding" ? "bg-rose-600 text-white shadow-sm" : "text-rose-600 hover:text-rose-700"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              Outstanding ({stats.outstandingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("paid")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors flex items-center gap-1",
                statusFilter === "paid" ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900" : "text-slate-700 hover:text-foreground"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-slate-900 dark:bg-slate-100" />
              Fully Paid ({stats.fullyPaidCount})
            </button>
          </div>
        </div>

        <div className="text-[11px] font-semibold text-muted-foreground">
          Showing <b>{filteredRecords.length}</b> of <b>{records.length}</b> records
        </div>
      </div>

      {/* Main Table */}
      <section className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full min-w-[1400px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-900/80 dark:text-slate-400">
              <tr>
                <Th className="border-b px-3 py-3 text-left font-black">Booking No</Th>
                <Th className="border-b px-3 py-3 text-left font-black">Bill / Invoice & Date</Th>
                <Th className="border-b px-3 py-3 text-left font-black">Relevant Account</Th>
                <Th className="border-b px-3 py-3 text-left font-black">Transporter & Mode</Th>
                <Th className="border-b px-3 py-3 text-left font-black">Truck / Container No</Th>
                <Th className="border-b px-3 py-3 text-left font-black">Driver & Mobile</Th>
                <Th className="border-b px-3 py-3 text-right font-black">Transport Payable</Th>
                <Th className="border-b px-3 py-3 text-right font-black">Transport Paid</Th>
                <Th className="border-b px-3 py-3 text-right font-black">Transport Remaining</Th>
                <Th className="border-b px-3 py-3 text-left font-black">Transport Payment Status</Th>
                <Th className="border-b px-3 py-3 text-left font-black">Purchase Bill Position</Th>
                <Th className="border-b px-3 py-3 text-center font-black">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin mb-2 text-primary" />
                    Loading transport payment booking records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                    <Truck className="mx-auto h-6 w-6 text-slate-400 mb-2" />
                    No transport payment booking records found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const curr = r.transportCurrency || "USD";
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-3 font-mono font-black text-primary">
                        {r.purchaseOrderNo}
                        <div className="text-[9px] font-mono text-muted-foreground">{r.loadingRecordNo}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-foreground">{r.billInvoiceNo}</div>
                        <div className="text-[10px] text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-foreground">{r.supplierAccount}</div>
                        <div className="text-[10px] text-muted-foreground">{r.country} &bull; {r.branch}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-foreground">{r.transporterName}</div>
                        <span className="inline-flex rounded bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 text-[9px] font-black uppercase text-blue-700 dark:text-blue-300">
                          {r.transportMode}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-foreground">
                        {r.truckNo}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-foreground">{r.driverName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{r.driverMobile}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-foreground">
                        {r.transportCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                        {r.transportPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}
                      </td>
                      <td className={cn(
                        "px-3 py-3 text-right font-black",
                        r.isFullyPaid ? "text-slate-900 dark:text-white" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {r.transportBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}
                      </td>
                      <td className="px-3 py-3">
                        {r.isFullyPaid ? (
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-slate-950 text-white border border-slate-900 shadow-sm dark:bg-white dark:text-slate-950">
                              <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-slate-950" />
                              Fully Paid
                            </span>
                            <span className="text-[9px] font-bold text-slate-500">Remaining: 0.00 {curr}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 shadow-sm">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                              {r.paymentStatus}
                            </span>
                            <span className="text-[10px] font-black text-rose-600 dark:text-rose-400">
                              Due: {r.transportBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {/* Clear separate display of purchase bill payments vs transport payments */}
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-1.5 text-[10px] border border-slate-200/60 dark:border-slate-800">
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Bill Total:</span>
                            <span className="font-bold">{r.purchaseBillTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Bill Paid:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">{r.purchaseTotalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between gap-2 border-t pt-0.5 mt-0.5">
                            <span className="text-muted-foreground">Bill Due:</span>
                            <span className={cn("font-black", r.purchaseRemainingDue <= 0.005 ? "text-slate-900 dark:text-white" : "text-rose-600 dark:text-rose-400")}>
                              {r.purchaseRemainingDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() => openPaymentModal(r)}
                            className="h-7 px-2.5 text-[10px] font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                            title="Record Transport Payment"
                          >
                            <CreditCard className="mr-1 h-3 w-3" /> Pay
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openChargesModal(r)}
                            className="h-7 px-2 text-[10px] font-semibold"
                            title="Edit Charges / Truck"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRecordForHistory(r)}
                            className="h-7 px-2 text-[10px] font-semibold"
                            title="Payment History"
                          >
                            <History className="h-3 w-3 text-blue-600" />
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
      </section>

      {/* Record Transport Payment Modal */}
      {selectedRecordForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  Workflow Stage 4 &bull; Payment
                </span>
                <h3 className="text-base font-black text-foreground mt-0.5">Record Transport Payment</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedRecordForPayment(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3">
              {/* Linked Booking Header info */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking / PO No:</span>
                  <span className="font-mono font-black text-primary">{selectedRecordForPayment.purchaseOrderNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transporter & Truck:</span>
                  <span className="font-bold">{selectedRecordForPayment.transporterName} &bull; {selectedRecordForPayment.truckNo}</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-muted-foreground">Transport Charges / Paid:</span>
                  <span>
                    <b>{selectedRecordForPayment.transportCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b> / Paid: <b className="text-emerald-700">{selectedRecordForPayment.transportPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b> {selectedRecordForPayment.transportCurrency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-bold">Transport Balance Due:</span>
                  <span className="font-black text-rose-600 text-sm">
                    {selectedRecordForPayment.transportBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedRecordForPayment.transportCurrency}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Payment Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    className="h-9 font-mono font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Currency</Label>
                  <Input
                    value={paymentCurrency}
                    onChange={(e) => setPaymentCurrency(e.target.value.toUpperCase())}
                    className="h-9 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Payment Date</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Payment Method</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Hawala">Hawala / Exchange</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Paid From Account / Bank</Label>
                <Input
                  value={bankOrCashAccount}
                  onChange={(e) => setBankOrCashAccount(e.target.value)}
                  placeholder="e.g. Emirates NBD / Main Cash Drawer"
                  className="h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Reference / Voucher No</Label>
                  <Input
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="h-9 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Narration / Notes</Label>
                  <Input
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder="Optional notes"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRecordForPayment(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingPayment}
                  className="bg-primary text-primary-foreground font-black px-4"
                >
                  {submittingPayment ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Confirm & Post Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Charges & Transporter Modal */}
      {selectedRecordForCharges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Configure Charges
                </span>
                <h3 className="text-base font-black text-foreground mt-0.5">Transport & Transporter Setup</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedRecordForCharges(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleUpdateCharges} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Total Transport Charges *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={chargesAmount}
                    onChange={(e) => setChargesAmount(e.target.value)}
                    required
                    className="h-9 font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Currency</Label>
                  <Input
                    value={chargesCurrency}
                    onChange={(e) => setChargesCurrency(e.target.value.toUpperCase())}
                    className="h-9 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Transporter / Transport Company</Label>
                <Input
                  value={transporterInput}
                  onChange={(e) => setTransporterInput(e.target.value)}
                  placeholder="e.g. Al-Fahad Logistics"
                  className="h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Truck / Vehicle No</Label>
                  <Input
                    value={truckNoInput}
                    onChange={(e) => setTruckNoInput(e.target.value)}
                    placeholder="e.g. TRK-9872"
                    className="h-9 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Transport Mode</Label>
                  <select
                    value={transportModeInput}
                    onChange={(e) => setTransportModeInput(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs"
                  >
                    <option value="By Road">By Road</option>
                    <option value="By Sea">By Sea</option>
                    <option value="By Air">By Air</option>
                    <option value="By Rail">By Rail</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Driver Name</Label>
                  <Input
                    value={driverNameInput}
                    onChange={(e) => setDriverNameInput(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Driver Mobile</Label>
                  <Input
                    value={driverMobileInput}
                    onChange={(e) => setDriverMobileInput(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRecordForCharges(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingCharges}
                  className="bg-primary text-primary-foreground font-black px-4"
                >
                  {submittingCharges ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Save Charges
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment History Dialog */}
      {selectedRecordForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  Payment History & Receipts
                </span>
                <h3 className="text-base font-black text-foreground mt-0.5">
                  Transport Payments — PO #{selectedRecordForHistory.purchaseOrderNo}
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedRecordForHistory(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="my-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 border text-xs grid grid-cols-3 gap-2">
              <div>
                <span className="block text-muted-foreground text-[10px] uppercase font-bold">Total Charge</span>
                <b className="text-sm font-mono">{selectedRecordForHistory.transportCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedRecordForHistory.transportCurrency}</b>
              </div>
              <div>
                <span className="block text-muted-foreground text-[10px] uppercase font-bold text-emerald-700">Total Paid</span>
                <b className="text-sm font-mono text-emerald-700">{selectedRecordForHistory.transportPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedRecordForHistory.transportCurrency}</b>
              </div>
              <div>
                <span className="block text-muted-foreground text-[10px] uppercase font-bold text-rose-700">Remaining</span>
                <b className={cn("text-sm font-mono", selectedRecordForHistory.isFullyPaid ? "text-slate-900" : "text-rose-600")}>
                  {selectedRecordForHistory.transportBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedRecordForHistory.transportCurrency}
                </b>
              </div>
            </div>

            <div className="overflow-auto flex-1">
              {selectedRecordForHistory.payments.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <CreditCard className="mx-auto h-6 w-6 text-slate-400 mb-2" />
                  No payment vouchers recorded for this booking yet.
                </div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-600 dark:bg-slate-900/80">
                    <tr>
                      <th className="p-2 text-left font-black">Date</th>
                      <th className="p-2 text-left font-black">Reference</th>
                      <th className="p-2 text-left font-black">Paid From</th>
                      <th className="p-2 text-right font-black">Amount</th>
                      <th className="p-2 text-center font-black">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRecordForHistory.payments.map((p) => (
                      <tr key={p.id} className="border-b hover:bg-muted/40">
                        <td className="p-2 font-mono">{p.paymentDate}</td>
                        <td className="p-2 font-mono font-bold text-primary">{p.referenceNo || "-"}</td>
                        <td className="p-2">{p.bankOrCashAccountName || p.paymentMethod || "Bank"}</td>
                        <td className="p-2 text-right font-mono font-black text-emerald-700">
                          {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {p.currency}
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] font-bold"
                            onClick={() => handlePrintReceipt(selectedRecordForHistory, p)}
                          >
                            <Printer className="mr-1 h-3 w-3" /> Print
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-3 flex justify-end border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecordForHistory(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
