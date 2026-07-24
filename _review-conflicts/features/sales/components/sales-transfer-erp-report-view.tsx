"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  WalletCards,
  Building2,
  Package,
  Ship,
  CreditCard,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  User,
  Globe,
  Calendar,
  Hash,
  TrendingUp,
  FileText,
  PenLine
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─────────────────────── helpers ─────────────────────── */

function money(value: unknown, decimals = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function fmtDate(value: string | null | undefined) {
  if (!value || value === "-") return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB");
}

function statusColor(s: string) {
  const lower = String(s || "").toLowerCase();
  if (lower.includes("paid") || lower.includes("confirmed") || lower.includes("posted") || lower.includes("full") || lower.includes("completed")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (lower.includes("partial") || lower.includes("advance")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (lower.includes("pending") || lower.includes("draft")) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function statusLabel(s: string) {
  const lower = String(s || "").toLowerCase();
  if (lower === "partial") return "Partial Advance Paid";
  return s;
}

/* ─────────────────────── sub-components ─────────────────────── */

function SectionCard({
  icon,
  title,
  badge,
  children
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden print:border print:shadow-none">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[#0f2942]">{icon}</span>
          <h2 className="text-[11px] font-black uppercase tracking-wider text-[#0f2942]">{title}</h2>
        </div>
        {badge && (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusColor(badge)}`}>
            {statusLabel(badge)}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5 last:border-b-0 text-xs">
      <span className="font-semibold text-slate-500 min-w-[140px]">{label}</span>
      <span className={`font-bold text-slate-800 text-right ${mono ? "font-mono" : ""}`}>{value || "-"}</span>
    </div>
  );
}

/* ─────────────────────── GL entry type ─────────────────────── */

type GLEntry = {
  glCode: string;
  accountName: string;
  debit: number;
  credit: number;
  type: "debit" | "credit";
};

/* ─────────────────────── main component ─────────────────────── */

export function SalesTransferErpReportView({
  purchaseData: initialData
}: {
  purchaseData?: any;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [reportData, setReportData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData && Boolean(idParam));
  const [error, setError] = useState<string | null>(null);

  const [transferring, setTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState("");
  const [transferError, setTransferError] = useState("");

  /* Fetch if only ID was passed */
  useEffect(() => {
    if (initialData || !idParam) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/erp/sales/booking-journal-report?id=${encodeURIComponent(idParam)}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        const row = json?.data?.reports?.[0] || json?.data?.selected || json?.reports?.[0] || json;
        setReportData(row);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load purchase record.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [idParam, initialData]);

  /* ── Derived values ────────────────────────────────────────── */

  const d = reportData;

  const goodsEntries: any[] = useMemo(() => {
    if (!d) return [];
    if (d.form_data?.goodsEntries?.length) return d.form_data.goodsEntries;
    return [{
      goodsName: d.productName || d.goodsDescription || "-",
      qtyNo: d.quantity || 0,
      qtyName: d.unit || "Units",
      grossWeight: d.totalGrossWeight || d.totalWeight || 0,
      netWeight: d.totalNetWeight || 0,
      coursePrice: d.purchaseRate || 0,
      totalAmount: d.totalSalesAmount || d.purchaseAmount || 0,
    }];
  }, [d]);

  const form = d?.form_data?.form || {};
  const totals = d?.form_data?.totals || {};
  const exchangeRate = Number(d?.exchange_rate || form.exchangeRate || 1);
  const currency = d?.currency || form.currencyType || "USD";

  // USD / Booking Currency calculations
  const totalSalesAmountUsd = useMemo(() => {
    if (!d) return 0;
    return Number(d.totalSalesAmount || d.purchaseAmount || totals.grandPrimaryFinal || 0);
  }, [d, totals.grandPrimaryFinal]);

  const advanceAmountUsd = useMemo(() => {
    if (!d) return 0;
    const purchaseBooking = d.form_data?.purchaseBooking || {};
    const directAdvance = Number(purchaseBooking.advancePaymentAmount || form.advanceAmount || form.advancePaid || 0);
    if (directAdvance > 0) return directAdvance;

    const advPercent = form.advancePercent !== undefined ? Number(form.advancePercent) : 10;
    return (totalSalesAmountUsd * advPercent) / 100;
  }, [d, form, totalSalesAmountUsd]);

  const remainingBalanceUsd = Math.max(0, totalSalesAmountUsd - advanceAmountUsd);

  // PKR / Secondary Currency calculations
  const totalSalesAmountPkr = useMemo(() => {
    if (!d) return 0;
    return Number(d.finalAmount || d.order_total || totals.grandFinal || (totalSalesAmountUsd * exchangeRate));
  }, [d, totals.grandFinal, totalSalesAmountUsd, exchangeRate]);

  const advanceAmountPkr = useMemo(() => {
    const advPercent = form.advancePercent !== undefined ? Number(form.advancePercent) : 10;
    return (totalSalesAmountPkr * advPercent) / 100;
  }, [form.advancePercent, totalSalesAmountPkr]);

  const remainingBalancePkr = Math.max(0, totalSalesAmountPkr - advanceAmountPkr);

  // Actual Ledger Posted Amounts (which are stored in database columns in PKR)
  const actualAdvancePaidPkr = Number(d?.advance_paid ?? 0);
  const actualAdvancePaidUsd = actualAdvancePaidPkr / exchangeRate;

  const actualRemainingDuePkr = d?.ledger_posting_status === "posted" 
    ? Number(d?.remaining_due ?? 0)
    : remainingBalancePkr;
  const actualRemainingDueUsd = actualRemainingDuePkr / exchangeRate;

  const debitCurrency = form.purchaseAccountCurrency || form.currencyType || d?.currency || "USD";
  const creditCurrency = form.salesAccountCurrency || form.secondaryCurrency || (debitCurrency !== "USD" ? debitCurrency : null) || "PKR";
  const localCurrency = form.secondaryCurrency || creditCurrency || "PKR";

function getCurrencySymbol(c: string) {
  if (!c) return "";
  const upper = c.toUpperCase();
  if (upper === "USD") return "$";
  if (upper === "AED") return "د.إ";
  if (upper === "PKR") return "₨";
  if (upper === "AFN") return "؋";
  if (upper === "INR") return "₹";
  return upper;
}

  const currencySymbol = getCurrencySymbol(currency);
  const localCurrencySymbol = getCurrencySymbol(localCurrency);
  const debitCurrencySymbol = getCurrencySymbol(debitCurrency);
  const creditCurrencySymbol = getCurrencySymbol(creditCurrency);

  const debitAmount = totalSalesAmountPkr;
  const creditAmount = totalSalesAmountPkr;

  const isBalanced = true;

  const journalNumber = useMemo(() => {
    if (!d) return "-";
    return `JV-${d.salesBookingOrderNumber || "000"}`;
  }, [d]);

  const journalDate = useMemo(() => fmtDate(d?.bookingDate || d?.salesDate || d?.createdAt), [d]);

  /* ── Transfer Payment ────────────────────────────────────── */
  async function handleTransferPayment() {
    if (!d) return;
    setTransferring(true);
    setTransferError("");
    setTransferSuccess("");
    try {
      const res = await fetch(`/api/erp/sales/orders/${d.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advancePaid: 0
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || json?.error || "Failed to process transfer payment.");
      }
      setTransferSuccess("✅ Booking Transfer successfully posted! Supplier ledger and inventory balances have been automatically updated.");
      
      setReportData((prev: any) => ({
        ...prev,
        ledger_posting_status: "posted",
        payment_status: json.data?.paymentStatus || "pending",
        advance_paid: 0,
        remaining_due: totalSalesAmountPkr
      }));
    } catch (err: any) {
      setTransferError(err?.message || "Error processing transfer payment.");
    } finally {
      setTransferring(false);
    }
  }

  /* ── Print ─────────────────────────────────────────────────── */
  function handlePrint() {
    window.print();
  }

  /* ── Render states ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold">Loading ERP Transaction Report…</p>
        </div>
      </div>
    );
  }

  if (error || !d) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center max-w-md">
          <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-rose-800">{error || "Purchase record not found."}</p>
          <Button onClick={() => router.back()} variant="outline" size="sm" className="mt-4">
            ← Go Back
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">

      {/* ───────────── STICKY TOOLBAR (print:hidden) ───────────── */}
      <header className="sticky top-0 z-50 bg-[#0f2942] text-white px-4 py-2.5 flex items-center justify-between shadow-lg print:hidden">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-8 text-white hover:bg-white/10 gap-1.5 px-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase">Back to Report</span>
          </Button>
          <div className="h-4 w-px bg-white/20" />
          <div>
            <p className="text-[8px] font-bold uppercase tracking-widest text-blue-200">Sales Transfer Payment</p>
            <p className="text-xs font-black text-white">{d.salesBookingOrderNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span className={`hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusColor(d.payment_status || d.status || "Pending")}`}>
            {statusLabel(d.payment_status || d.status || "Pending")}
          </span>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handlePrint}
            className="h-8 text-white hover:bg-white/10 gap-1.5 px-2.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase hidden sm:inline">Print / PDF</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/dashboard/purchase/new-purchase-booking-order?id=${encodeURIComponent(d.id)}&purchaseOrderNo=${encodeURIComponent(d.salesBookingOrderNumber)}`)}
            disabled={d.ledger_posting_status === "posted" || d.ledger_posting_status === "transferred"}
            className="h-8 text-white hover:bg-white/10 gap-1.5 px-2.5 disabled:opacity-50"
          >
            <PenLine className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase hidden sm:inline">Edit Booking</span>
          </Button>

          {/* ★ PRIMARY: Transfer Payment button */}
          <Button
            type="button"
            size="sm"
            onClick={handleTransferPayment}
            disabled={transferring || (d.ledger_posting_status === "posted" && !d.is_edited_since_transfer)}
            className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wide px-3 shadow-md gap-1.5 border-none disabled:opacity-50"
          >
            <WalletCards className="h-3.5 w-3.5" />
            {transferring ? "Transferring..." : "Transfer Payment"}
          </Button>
        </div>
      </header>

      {/* ───────────── A4 CONTENT AREA ───────────── */}
      <main className="mx-auto max-w-[900px] py-6 px-4 space-y-4 print:py-0 print:px-0 print:max-w-none">

        {/* Document Branding Header */}
        <div className="rounded-xl bg-[#0f2942] text-white p-5 shadow-md print:rounded-none">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-blue-200">Daman Business Group — Enterprise ERP</p>
              <h1 className="text-xl font-black tracking-tight mt-0.5">ERP Transaction Report</h1>
              <p className="text-[10px] text-blue-200 font-semibold mt-0.5">Sales Transfer Payment — Official Audit Document</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200">Journal Number</p>
              <p className="text-sm font-black font-mono">{journalNumber}</p>
              <p className="text-[10px] text-blue-300 font-mono mt-0.5">{journalDate}</p>
            </div>
          </div>
        </div>

        {/* ── 1. HEADER INFORMATION ─────────────────────── */}
        <SectionCard icon={<FileText className="h-4 w-4" />} title="Transaction Header" badge={d.payment_status || d.status}>
          <div className="grid sm:grid-cols-2 gap-x-8">
            <div>
              <InfoRow label="Booking Reference" value={d.salesBookingOrderNumber} mono />
              <InfoRow label="Sales Date" value={fmtDate(d.salesDate)} />
              <InfoRow label="Booking Date" value={fmtDate(d.bookingDate || d.createdAt)} />
              <InfoRow label="Transaction Status" value={d.payment_status || d.status || "-"} />
            </div>
            <div>
              <InfoRow label="Booking User" value={d.audit?.userName || "Admin"} />
              <InfoRow label="User ID" value={d.audit?.userId || "-"} mono />
              <InfoRow label="Branch Name" value={d.branchName || "-"} />
              <InfoRow label="Country" value={d.countryName || "-"} />
            </div>
          </div>
        </SectionCard>

        {/* ── 2. SELLER & CUSTOMER INFORMATION ──────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <SectionCard icon={<User className="h-4 w-4" />} title="Seller Information">
            <InfoRow label="Seller Code" value={d.salesAccountNumber || "BUY-001"} mono />
            <InfoRow label="Seller Name" value={d.buyerName || "-"} />
            <InfoRow
              label="Contact Number"
              value={form.buyerPhone || form.buyerContact || "-"}
            />
            <InfoRow
              label="Email"
              value={form.buyerEmail || "-"}
            />
            <InfoRow label="Country" value={form.receivedCountry || d.branchName || "-"} />
          </SectionCard>

          <SectionCard icon={<Building2 className="h-4 w-4" />} title="Customer Information">
            <InfoRow label="Customer Code" value={d.purchaseAccountNumber || "SUP-001"} mono />
            <InfoRow label="Customer Name" value={d.supplierName || "-"} />
            <InfoRow
              label="Contact Number"
              value={form.supplierPhone || form.contactPhone || d.form_data?.supplier?.phone || "-"}
            />
            <InfoRow
              label="Email"
              value={form.supplierEmail || form.contactEmail || d.form_data?.supplier?.email || "-"}
            />
            <InfoRow label="Country" value={d.countryName || form.loadingCountry || "-"} />
          </SectionCard>
        </div>

        {/* ── 4. GOODS DETAILS ──────────────────────────── */}
        <SectionCard icon={<Package className="h-4 w-4" />} title="Goods Details">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#0f2942] text-white text-[10px] font-black uppercase tracking-wider">
                  {["#", "Product Name", "Qty", "Unit", "Gross Wt (kg)", "Net Wt (kg)", "Rate", "Total Amount"].map((h) => (
                    <th key={h} className="px-3 py-2 text-right first:text-left border-r border-white/10 last:border-r-0 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {goodsEntries.map((g: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-800 text-left max-w-[180px]">
                      {g.goodsName || g.productName || "-"}
                      {g.brand ? <span className="block text-[9px] text-slate-400 font-medium">{g.brand}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold">{Number(g.qtyNo || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{g.qtyName || "Units"}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{money(g.grossWeight)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{money(g.netWeight)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{money(g.coursePrice || g.rate, 3)} {currency}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-slate-900">{money(g.totalAmount)} {currency}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-black text-[11px]">
                  <td colSpan={7} className="px-3 py-2.5 text-right text-slate-600 uppercase tracking-wider">Grand Total</td>
                  <td className="px-3 py-2.5 text-right text-[#0f2942] font-black text-sm font-mono">
                    {money(totalSalesAmountUsd)} {currency}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>

        {/* ── 5. LOADING & TRANSPORT ────────────────────── */}
        <SectionCard icon={<Ship className="h-4 w-4" />} title="Loading & Transport Information">
          <div className="grid sm:grid-cols-2 gap-x-8">
            <div>
              <InfoRow label="Loading Country" value={form.loadingCountry || d.countryName || "-"} />
              <InfoRow label="Loading Port" value={form.loadingPort || "-"} />
              <InfoRow label="Loading Date" value={fmtDate(form.loadingDate)} />
              <InfoRow label="Vessel Name" value={form.vesselName || form.shipName || "-"} />
            </div>
            <div>
              <InfoRow label="Receiving Country" value={form.receivedCountry || "-"} />
              <InfoRow label="Receiving Port" value={form.receivedPort || form.exitPort || "-"} />
              <InfoRow label="Container Number" value={form.containerNo || form.containerNumber || `CONT-${d.containerCount || 0} containers`} mono />
              <InfoRow label="BL Number" value={form.blNo || form.billOfLadingNo || "-"} mono />
            </div>
          </div>
        </SectionCard>

        {/* ── 6. PAYMENT INFORMATION ───────────────────── */}
        {(() => {
          const isPosted = d.ledger_posting_status === "posted";
          const displayAdvanceUsd = isPosted ? actualAdvancePaidUsd : advanceAmountUsd;
          const displayAdvancePkr = isPosted ? actualAdvancePaidPkr : advanceAmountPkr;
          const displayRemainingUsd = isPosted ? actualRemainingDueUsd : remainingBalanceUsd;
          const displayRemainingPkr = isPosted ? actualRemainingDuePkr : remainingBalancePkr;
          return (
            <SectionCard icon={<CreditCard className="h-4 w-4" />} title="Payment Information" badge={d.payment_status || d.status}>
              <div className="grid sm:grid-cols-2 gap-x-8">
                <div>
                  <InfoRow label="Total Purchase Amount" value={`${money(totalSalesAmountUsd)} ${currencySymbol} / ${money(totalSalesAmountPkr)} ${localCurrencySymbol}`} mono />
                  <InfoRow label="Advance Percentage" value={`${form.advancePercent || 0}%`} mono />
                  <InfoRow label="Advance Paid" value={`${money(displayAdvanceUsd)} ${currencySymbol} / ${money(displayAdvancePkr)} ${localCurrencySymbol}`} mono />
                  <InfoRow label="Remaining Balance" value={`${money(displayRemainingUsd)} ${currencySymbol} / ${money(displayRemainingPkr)} ${localCurrencySymbol}`} mono />
                </div>
                <div>
                  <InfoRow label="Payment Status" value={statusLabel(d.payment_status || d.status || "-")} />
                  <InfoRow label="Payment Type" value={form.paymentType || "-"} />
                  <InfoRow label="Due Date" value={fmtDate(form.dueDate || form.loadingDate)} />
                </div>
              </div>

              {/* Payment summary bar */}
              <div className="mt-4 grid grid-cols-4 gap-3">
                {[
                  { label: "Total Amount", value: `${money(totalSalesAmountUsd)} ${currencySymbol}`, subValue: `${money(totalSalesAmountPkr)} ${localCurrencySymbol}`, color: "text-[#0f2942]" },
                  { label: "Advance Percentage", value: `${form.advancePercent || 0}%`, color: "text-blue-600" },
                  { label: "Advance Paid", value: `${money(displayAdvanceUsd)} ${currencySymbol}`, subValue: `${money(displayAdvancePkr)} ${localCurrencySymbol}`, color: "text-emerald-600" },
                  { label: "Remaining Due", value: `${money(displayRemainingUsd)} ${currencySymbol}`, subValue: `${money(displayRemainingPkr)} ${localCurrencySymbol}`, color: "text-rose-600" }
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-slate-50 p-3 text-center dark:bg-slate-900/40">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                    <p className={`text-sm font-black mt-1 font-mono ${item.color}`}>{item.value}</p>
                    {item.subValue && <p className="text-[10px] font-bold font-mono text-slate-500 mt-0.5">{item.subValue}</p>}
                  </div>
                ))}
              </div>
            </SectionCard>
          );
        })()}

        {/* ── 7. ACCOUNTING / LEDGER IMPACT ────────────── */}
        <SectionCard icon={<BookOpen className="h-4 w-4" />} title="Accounting / Ledger Impact">
          {/* Journal meta */}
          <div className="grid sm:grid-cols-3 gap-x-8 mb-4">
            <InfoRow label="Journal Number" value={journalNumber} mono />
            <InfoRow label="Journal Date" value={journalDate} />
            <InfoRow label="Posting Status" value={d.ledger_posting_status || "Pending"} />
          </div>

          {/* Balance validation badge */}
          <div className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
            isBalanced
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}>
            <CheckCircle2 className="h-4 w-4" /> Journal Entry Balanced — Total Debit equals Total Credit
          </div>

          <div className="space-y-6">
            {/* Booking Transfer Stage Preview */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">1. Booking Transfer Stage (GL Impact)</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-650 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left">GL Code</th>
                      <th className="px-4 py-2.5 text-left">Account Name</th>
                      <th className="px-4 py-2.5 text-right">Debit</th>
                      <th className="px-4 py-2.5 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-blue-50/40 hover:bg-blue-50/70">
                      <td className="px-4 py-3 font-mono font-black text-[#0f2942]">{form.purchaseAccountNo || d.purchaseAccountNumber || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{form.purchaseAccountName || d.purchaseAccountName || "Customer Account (Debit)"} (DR)</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">{money(debitAmount)} {localCurrencySymbol}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-400">-</td>
                    </tr>
                    <tr className="bg-emerald-50/40 hover:bg-emerald-50/70">
                      <td className="px-4 py-3 font-mono font-black text-[#0f2942]">{form.salesAccountNo || d.salesAccountNumber || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{form.salesAccountName || d.salesAccountName || "Sales Account (Credit)"} (CR)</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-400">-</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{money(creditAmount)} {localCurrencySymbol}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>


          </div>

          {/* Accounting flow note */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] font-semibold text-slate-500 space-y-1">
            <p className="font-black text-slate-600 uppercase text-[9px] tracking-wider mb-1">Accounting Flow — Purchase Transfer Stage</p>
            <p>
              <span className="text-blue-700 font-black">DEBIT:</span>{" "}
              Customer Account ({form.purchaseAccountNo || d.purchaseAccountNumber || "—"}) = Goods received at purchase cost
            </p>
            <p>
              <span className="text-emerald-700 font-black">CREDIT:</span>{" "}
              Sales/Credit Account ({form.salesAccountNo || d.salesAccountNumber || "—"}) = Receivable recorded against customer
            </p>

          </div>
        </SectionCard>

        {/* ── 8. TRANSFER TO PAYMENT CTA ───────────────── */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-900">Ready to process payment transfer?</p>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                This will automatically generate double-entry ledgers, post to general/supplier/cash accounts, and update status.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleTransferPayment}
            disabled={transferring || d.ledger_posting_status === "posted"}
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wide px-5 shadow-md gap-2 border-none shrink-0 disabled:opacity-50"
          >
            <WalletCards className="h-4 w-4" />
            {transferring ? "Transferring..." : "Transfer Payment"}
          </Button>
        </div>

        {/* Feedback messages */}
        {transferSuccess && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 text-xs font-bold text-emerald-800 animate-in fade-in duration-300">
            {transferSuccess}
          </div>
        )}
        {transferError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-bold text-destructive animate-in fade-in duration-300">
            {transferError}
          </div>
        )}

        {/* Footer */}
        <footer className="rounded-xl bg-[#0f2942] text-white py-3 px-5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider print:rounded-none">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" />
            <span>Daman Business Group</span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <Hash className="h-3.5 w-3.5" />
            <span>{d.salesBookingOrderNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>Generated: {new Date().toLocaleDateString("en-GB")}</span>
          </div>
        </footer>

        {/* Print-only Transfer To Payment notice */}
        <div className="hidden print:block border-t border-slate-300 pt-4 mt-2 text-center text-[10px] font-semibold text-slate-500">
          This is an official ERP transaction document. Transfer to payment must be processed via the ERP system.
        </div>
      </main>

      {/* Print CSS */}
      <style>{`
        @media print {
          html, body { background: white !important; padding: 0 !important; margin: 0 !important; }
          header.sticky { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
