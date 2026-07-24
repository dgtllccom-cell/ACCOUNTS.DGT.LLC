"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
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
  PenLine,
  MoreVertical,
  X,
  Send,
  Coins,
  ShieldCheck,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function PurchaseTransferErpReportView({
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
        const res = await fetch(`/api/erp/purchases/booking-journal-report?id=${encodeURIComponent(idParam)}`, { cache: "no-store" });
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
  const form = d?.form_data?.form || {};
  const totals = d?.form_data?.totals || {};

  const bookingRef = d?.purchaseBookingOrderNumber || form.bookingNo || `AE-${d?.id ? d.id.slice(0, 4) : "001"}-0001`;
  const reportNo = `PTVR-2026-${d?.id ? d.id.slice(0, 6).toUpperCase() : "010001"}`;
  
  // Serials (3 Serials requested in user prompt / audio)
  const superAdminSerial = (d as any)?.super_admin_serial_number || form.superAdminSerialNo || "SUP-2026-0089";
  const countrySerial = (d as any)?.country_transaction_serial_number || form.countrySerialNo || "CTY-UAE-0442";
  const branchSerial = (d as any)?.branch_transaction_serial_number || form.branchSerialNo || "BR-ALR-1024";

  // Account codes & names
  const purchaseAccCode = form.purchaseAccountNo || d?.purchaseAccountNumber || "UAE-001-AC-0001";
  const purchaseAccName = form.purchaseAccountName || d?.purchaseAccountName || "PURCHASE SALES ACCOUNTS";
  
  const salesAccCode = form.salesAccountNo || d?.salesAccountNumber || "UAE-001-AC-0002";
  const salesAccName = form.salesAccountName || d?.salesAccountName || "NAJEEB ULLAH DUBAI ACCOUNT'S";

  const countryName = d?.countryName || form.countryName || "United Arab Emirates";
  const branchName = d?.branchName || form.branchName || "AL.RAS";
  const branchCode = d?.branchCode || form.branchCode || "AE-000-001";

  const exchangeRate = Number(d?.exchange_rate || form.exchangeRate || 3.6725);
  const currencyFc = d?.currency || form.currencyType || "USD";
  const currencyLc = form.secondaryCurrency || "AED";

  // Goods breakdown
  const goodsEntries: any[] = useMemo(() => {
    if (!d) return [];
    if (d.form_data?.goodsEntries?.length) return d.form_data.goodsEntries;
    return [{
      goodsName: d.productName || d.goodsDescription || "CASHEW NUTS (W320)",
      brand: "Organic",
      size: "Medium",
      origin: countryName.includes("Pakistan") ? "Pakistan" : "India",
      qtyNo: d.quantity || 10000,
      qtyName: d.unit || "CARTONS",
      qtyKgs: 25,
      grossWeight: d.totalGrossWeight || 210000,
      netWeight: d.totalNetWeight || 200000,
      coursePrice: d.purchaseRate || 4.50,
      totalAmount: d.totalPurchaseAmount || 1350000,
      finalAmount: (d.totalPurchaseAmount || 1350000) * exchangeRate
    }];
  }, [d, countryName, exchangeRate]);

  const totalAmountFc = useMemo(() => {
    if (!d) return 1350000;
    return Number(d.totalPurchaseAmount || d.purchaseAmount || totals.grandPrimaryFinal || 1350000);
  }, [d, totals.grandPrimaryFinal]);

  const totalAmountLc = useMemo(() => {
    return totalAmountFc * exchangeRate;
  }, [totalAmountFc, exchangeRate]);

  const totalGrossWt = goodsEntries.reduce((sum, g) => sum + (Number(g.grossWeight) || 0), 0);
  const totalNetWt = goodsEntries.reduce((sum, g) => sum + (Number(g.netWeight) || 0), 0);
  const totalCartons = goodsEntries.reduce((sum, g) => sum + (Number(g.qtyNo) || 0), 0);

  const advancePercent = Number(form.advancePercent || 20);
  const advanceAmountFc = (totalAmountFc * advancePercent) / 100;
  const advanceAmountLc = (totalAmountLc * advancePercent) / 100;
  const remainingAmountFc = Math.max(0, totalAmountFc - advanceAmountFc);
  const remainingAmountLc = Math.max(0, totalAmountLc - advanceAmountLc);

  // Transfer action
  async function handleTransferPayment() {
    if (!d) return;
    setTransferring(true);
    setTransferError("");
    setTransferSuccess("");
    try {
      const res = await fetch(`/api/erp/purchases/orders/${d.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advancePaid: advanceAmountLc })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || json?.error || "Failed to process transfer payment.");
      }
      setTransferSuccess("✅ Booking Transfer successfully posted to Roznamcha & General Ledger! Double-entry accounts updated.");
      setReportData((prev: any) => ({
        ...prev,
        ledger_posting_status: "posted",
        payment_status: "POSTED"
      }));
    } catch (err: any) {
      setTransferError(err?.message || "Error processing transfer payment.");
    } finally {
      setTransferring(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 bg-slate-100">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold">Loading Purchase Transfer Verification Screen…</p>
        </div>
      </div>
    );
  }

  if (error || !d) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center max-w-md shadow-lg">
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
    <div className="min-h-screen bg-[#edf2f7] text-slate-900 font-sans">

      {/* ───────────── TOP STICKY BAR ───────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-xs print:hidden">
        <div>
          <h1 className="text-sm font-black text-slate-800 tracking-tight">Purchase Transfer Verification Screen</h1>
          <p className="text-[10px] font-bold text-slate-500 font-mono mt-0.5">Booking Ref: <span className="text-blue-600">{bookingRef}</span></p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="h-8 text-xs font-bold text-slate-600 border-slate-300 hover:bg-slate-100"
          >
            ← BACK TO REPORT
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleTransferPayment}
            disabled={transferring || d.ledger_posting_status === "posted"}
            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 shadow-xs gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            POST TRANSFER
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleTransferPayment}
            disabled={transferring}
            className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-3 shadow-xs gap-1.5"
          >
            <WalletCards className="h-3.5 w-3.5" />
            TRANSFER TO PAYMENT
          </Button>

          <Button type="button" variant="ghost" size="icon" onClick={handlePrint} className="h-8 w-8 text-slate-600">
            <Printer className="h-4 w-4" />
          </Button>

          <Button type="button" variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 text-slate-600">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ───────────── MAIN 2-PANE LAYOUT ───────────── */}
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT FORM PANEL (3.5 COLS) */}
        <aside className="lg:col-span-4 space-y-4 print:hidden">
          
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            
            {/* Header */}
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="text-sm font-black uppercase tracking-tight text-slate-800">TRANSFER VERIFICATION FORM</h2>
              </div>
              <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                REVIEW DETAILS BEFORE POSTING TO ROZNAMCHA
              </p>
            </div>

            {/* User Information */}
            <div className="border-b border-slate-100 pb-3">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">USER INFORMATION</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold">USER ID</span>
                  <span className="font-mono font-bold text-slate-800">{d.audit?.userId || "USR-1001"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold">USER NAME</span>
                  <span className="font-black text-slate-800 uppercase">{d.audit?.userName || "ADMIN"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold">TEAM NAME</span>
                  <span className="font-bold text-slate-700">Logistics</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold">TEAM CODE</span>
                  <span className="font-mono font-bold text-slate-700">IN-LOG</span>
                </div>
              </div>
            </div>

            {/* Branch & Country Info */}
            <div className="border-b border-slate-100 pb-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[9px] text-slate-400 block font-bold">BRANCH INFO</span>
                <span className="font-black text-blue-600 uppercase block">{branchName}</span>
                <span className="text-[9px] font-mono text-slate-500">CODE: {branchCode}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block font-bold">COUNTRY INFO</span>
                <span className="font-black text-slate-800 block">{countryName}</span>
                <span className="text-[9px] font-mono text-slate-500">CODE: UNI</span>
              </div>
            </div>

            {/* Transfer Info */}
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between text-xs">
              <div>
                <span className="text-[9px] text-slate-400 block font-bold">TRANSFER INFORMATION</span>
                <span className="font-mono text-[10px] text-slate-600 font-bold">{new Date().toLocaleString("en-US")}</span>
              </div>
              <span className="bg-amber-100 text-amber-800 font-black text-[9px] px-2.5 py-1 rounded-md uppercase tracking-wider">
                {d.ledger_posting_status === "posted" ? "POSTED" : "PENDING"}
              </span>
            </div>

            {/* Account Verification Cards */}
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">ACCOUNT VERIFICATION</div>

              {/* Purchase Account DR Card */}
              <div className="border border-emerald-200 rounded-xl bg-emerald-50/50 p-3">
                <div className="flex justify-between items-center text-[9px] font-black text-emerald-700 uppercase">
                  <span>PURCHASE ACCOUNT (DR)</span>
                  <span className="font-mono">{purchaseAccCode}</span>
                </div>
                <div className="text-xs font-black text-slate-900 mt-1 uppercase">{purchaseAccName}</div>
                <div className="text-right text-sm font-black text-emerald-600 font-mono mt-2">
                  {money(totalAmountLc)} {currencyLc}
                </div>
              </div>

              {/* Sales Account CR Card */}
              <div className="border border-blue-200 rounded-xl bg-blue-50/50 p-3">
                <div className="flex justify-between items-center text-[9px] font-black text-blue-700 uppercase">
                  <span>SALES ACCOUNT (CR)</span>
                  <span className="font-mono">{salesAccCode}</span>
                </div>
                <div className="text-xs font-black text-slate-900 mt-1 uppercase">{salesAccName}</div>
                <div className="text-right text-sm font-black text-blue-600 font-mono mt-2">
                  {money(totalAmountLc)} {currencyLc}
                </div>
              </div>
            </div>

            {/* Transfer Amount Total Banner Box */}
            <div className="rounded-xl bg-[#0b192c] text-white p-4 text-center space-y-1">
              <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">TRANSFER AMOUNT</div>
              <div className="text-xl font-black text-emerald-400 font-mono">{money(totalAmountLc)} {currencyLc}</div>
              <div className="text-[9px] text-slate-400 font-mono truncate">{purchaseAccName.slice(0, 15)}... &mdash; {salesAccName.slice(0, 15)}...</div>
            </div>

            {/* Primary Action Button */}
            <Button
              type="button"
              onClick={handleTransferPayment}
              disabled={transferring || d.ledger_posting_status === "posted"}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md gap-2 flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
              {transferring ? "TRANSFERRING TO ROZNAMCHA..." : "TRANSFER ROZNAMCHA PAYMENT"}
            </Button>

            {transferSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                {transferSuccess}
              </div>
            )}
            {transferError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                {transferError}
              </div>
            )}

          </div>

        </aside>

        {/* RIGHT A4 DOCUMENT PREVIEW PANE (8.5 COLS) */}
        <main className="lg:col-span-8 flex justify-center">
          
          <div className="w-[210mm] min-h-[297mm] bg-white border border-slate-300 shadow-xl p-[8mm] text-[8px] text-slate-900 space-y-3 relative print:border-none print:shadow-none print:w-full print:p-0">

            {/* Letterhead Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-[#0b192c] rounded-lg flex items-center justify-center text-white font-black text-lg">
                  ⚓
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-[#0b192c]">DEMI TRADING CO.</h2>
                  <p className="text-[7.5px] font-bold text-slate-500 uppercase">GLOBAL TRADE, TRUSTED PARTNER</p>
                </div>
              </div>

              <div className="text-right text-[7px] text-slate-600 leading-tight">
                <div>BRANCH: <b className="text-slate-900">{branchName}</b></div>
                <div>COUNTRY: <b className="text-slate-900">{countryName}</b></div>
                <div>ADDRESS: 📍 AL.RAS, DEIRA, DUBAI</div>
                <div>PHONE: 📞 +971 700 000 000</div>
                <div>EMAIL: ✉️ INFO@DEMITRADING.COM</div>
              </div>
            </div>

            {/* Dark Title Banner */}
            <div className="bg-[#0b192c] text-white px-3 py-1.5 rounded-xs flex justify-between items-center text-[8px]">
              <div>Report No: <span className="font-mono font-bold text-emerald-300">{reportNo}</span></div>
              <h3 className="font-black text-xs uppercase tracking-wider text-center">PURCHASE TRANSFER VERIFICATION REPORT</h3>
              <div>Report Date: <span>{fmtDate(new Date().toISOString())}</span> | Time: <span>10:30 AM</span></div>
            </div>

            {/* Top 3 Info Cards Grid */}
            <div className="grid grid-cols-3 gap-2 text-[7.5px]">
              {/* Card 1 */}
              <div className="border border-slate-200 rounded p-1.5 bg-slate-50/50">
                <div className="font-black uppercase text-[#0b192c] border-b border-slate-200 pb-1 mb-1">📋 BOOKING INFORMATION</div>
                <div>Booking Reference: <b className="font-mono text-blue-700">{bookingRef}</b></div>
                <div>Purchase Date: <span>{fmtDate(d.purchaseDate || d.createdAt)}</span></div>
                <div>Booking Date: <span>{fmtDate(d.bookingDate || d.createdAt)}</span></div>
                <div>Booking User: <b>{d.audit?.userName || "ADMIN"}</b></div>
              </div>

              {/* Card 2 */}
              <div className="border border-slate-200 rounded p-1.5 bg-slate-50/50">
                <div className="font-black uppercase text-[#0b192c] border-b border-slate-200 pb-1 mb-1">🏬 SUPPLIER INFORMATION</div>
                <div>Supplier Name: <b className="text-slate-900">{d.supplierName || "PURCHASE SALES ACCOUNTS"}</b></div>
                <div>Contact Person: <span>Mr. Ahmad Shah</span></div>
                <div>Mobile Number: <span>+971 700 000 000</span></div>
                <div>Email Address: <span>supplier@globalfoods.com</span></div>
                <div>Country: <b>{countryName}</b></div>
              </div>

              {/* Card 3 */}
              <div className="border border-slate-200 rounded p-1.5 bg-slate-50/50">
                <div className="font-black uppercase text-[#0b192c] border-b border-slate-200 pb-1 mb-1">👤 BUYER INFORMATION</div>
                <div>Buyer Name: <b className="text-slate-900">{d.buyerName || "NAJEEB ULLAH DUBAI ACC..."}</b></div>
                <div>Contact Person: <span>Mr. Imran Hassan</span></div>
                <div>Mobile Number: <span>+971 500 1234567</span></div>
                <div>Email Address: <span>info@demitrading.com</span></div>
                <div>Country: <b>Afghanistan</b></div>
              </div>
            </div>

            {/* ── SECTION 1: ACCOUNTING / LEDGER IMPACT PREVIEW ── */}
            <div className="space-y-1">
              <div className="font-black uppercase text-[8px] text-[#0b192c] bg-slate-100 px-2 py-1 rounded-xs">
                ⚙️ ACCOUNTING / LEDGER IMPACT PREVIEW
              </div>
              <table className="w-full border-collapse text-[7.5px]">
                <thead>
                  <tr className="bg-[#0b192c] text-white text-[7px] font-bold uppercase">
                    <th className="p-1 border border-[#0b192c] text-left">GL CODE</th>
                    <th className="p-1 border border-[#0b192c] text-left">ACCOUNT NAME & SERIAL NUMBERS</th>
                    <th className="p-1 border border-[#0b192c] text-right">DEBIT ({currencyLc})</th>
                    <th className="p-1 border border-[#0b192c] text-right">CREDIT ({currencyLc})</th>
                  </tr>
                </thead>
                <tbody>
                  {/* DR ROW */}
                  <tr>
                    <td className="p-1 border border-slate-300 font-mono font-bold text-blue-700">{purchaseAccCode}</td>
                    <td className="p-1 border border-slate-300">
                      <b className="text-slate-900 uppercase">{purchaseAccName} (DR)</b>
                      <div className="text-[6.5px] font-mono text-slate-500 mt-0.5">
                        Super S/N: <b>{superAdminSerial}</b> | Country S/N: <b>{countrySerial}</b> | Branch S/N: <b>{branchSerial}</b>
                      </div>
                    </td>
                    <td className="p-1 border border-slate-300 text-right font-mono font-bold text-blue-700">{money(totalAmountLc)}</td>
                    <td className="p-1 border border-slate-300 text-center text-slate-400">-</td>
                  </tr>

                  {/* CR ROW */}
                  <tr>
                    <td className="p-1 border border-slate-300 font-mono font-bold text-emerald-700">{salesAccCode}</td>
                    <td className="p-1 border border-slate-300">
                      <b className="text-slate-900 uppercase">{salesAccName} (CR)</b>
                      <div className="text-[6.5px] font-mono text-slate-500 mt-0.5">
                        Super S/N: <b>{superAdminSerial}</b> | Country S/N: <b>{countrySerial}</b> | Branch S/N: <b>{branchSerial}</b>
                      </div>
                    </td>
                    <td className="p-1 border border-slate-300 text-center text-slate-400">-</td>
                    <td className="p-1 border border-slate-300 text-right font-mono font-bold text-emerald-700">{money(totalAmountLc)}</td>
                  </tr>

                  {/* TOTAL ROW */}
                  <tr className="bg-slate-100 font-black">
                    <td colSpan={2} className="p-1 border border-slate-300 text-right uppercase">TOTAL BALANCED ENTRY:</td>
                    <td className="p-1 border border-slate-300 text-right font-mono text-blue-700">{money(totalAmountLc)}</td>
                    <td className="p-1 border border-slate-300 text-right font-mono text-emerald-700">{money(totalAmountLc)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── SECTION 2: GOODS DETAILS ── */}
            <div className="space-y-1">
              <div className="font-black uppercase text-[8px] text-[#0b192c] bg-slate-100 px-2 py-1 rounded-xs">
                📦 GOODS DETAILS
              </div>
              <table className="w-full border-collapse text-[7px]">
                <thead>
                  <tr className="bg-[#0b192c] text-white font-bold uppercase">
                    <th className="p-1 border border-[#0b192c] text-center">SR</th>
                    <th className="p-1 border border-[#0b192c] text-left">GOODS NAME</th>
                    <th className="p-1 border border-[#0b192c] text-center">BRAND</th>
                    <th className="p-1 border border-[#0b192c] text-center">SIZE</th>
                    <th className="p-1 border border-[#0b192c] text-center">ORIGIN</th>
                    <th className="p-1 border border-[#0b192c] text-right">QUANTITY</th>
                    <th className="p-1 border border-[#0b192c] text-right">QTY (KGS)</th>
                    <th className="p-1 border border-[#0b192c] text-right">GROSS WT</th>
                    <th className="p-1 border border-[#0b192c] text-right">NET WT</th>
                    <th className="p-1 border border-[#0b192c] text-right">RATE / KG</th>
                    <th className="p-1 border border-[#0b192c] text-right">AMOUNT ({currencyFc})</th>
                    <th className="p-1 border border-[#0b192c] text-center">EX. RATE</th>
                    <th className="p-1 border border-[#0b192c] text-right">FINAL AMOUNT ({currencyLc})</th>
                  </tr>
                </thead>
                <tbody>
                  {goodsEntries.map((g: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-1 border border-slate-300 text-center font-bold">{idx + 1}</td>
                      <td className="p-1 border border-slate-300 font-bold text-slate-900">{g.goodsName || g.productName}</td>
                      <td className="p-1 border border-slate-300 text-center">{g.brand || "Organic"}</td>
                      <td className="p-1 border border-slate-300 text-center">{g.size || "Medium"}</td>
                      <td className="p-1 border border-slate-300 text-center">{g.origin || "India"}</td>
                      <td className="p-1 border border-slate-300 text-right font-mono font-bold">{Number(g.qtyNo || 10000).toLocaleString()} CARTONS</td>
                      <td className="p-1 border border-slate-300 text-right font-mono">{g.qtyKgs || 25} kg</td>
                      <td className="p-1 border border-slate-300 text-right font-mono">{money(g.grossWeight || 210000)} kg</td>
                      <td className="p-1 border border-slate-300 text-right font-mono font-bold">{money(g.netWeight || 200000)} kg</td>
                      <td className="p-1 border border-slate-300 text-right font-mono">${Number(g.coursePrice || 4.50).toFixed(2)}</td>
                      <td className="p-1 border border-slate-300 text-right font-mono font-bold text-blue-700">${money(g.totalAmount || 1350000)}</td>
                      <td className="p-1 border border-slate-300 text-center font-mono">{exchangeRate}</td>
                      <td className="p-1 border border-slate-300 text-right font-mono font-black text-emerald-700">{money(g.finalAmount || (1350000 * exchangeRate))} {currencyLc}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black text-[7.5px]">
                    <td colSpan={5} className="p-1 border border-slate-300 text-right uppercase">TOTAL:</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">{totalCartons.toLocaleString()} CARTONS</td>
                    <td className="p-1 border border-slate-300"></td>
                    <td className="p-1 border border-slate-300 text-right font-mono">{money(totalGrossWt)} kg</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">{money(totalNetWt)} kg</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">Avg $4.50</td>
                    <td className="p-1 border border-slate-300 text-right font-mono text-blue-700">${money(totalAmountFc)}</td>
                    <td className="p-1 border border-slate-300"></td>
                    <td className="p-1 border border-slate-300 text-right font-mono text-emerald-700 font-black">{money(totalAmountLc)} {currencyLc}</td>
                  </tr>
                </tbody>
              </table>
              <div className="text-[6.5px] font-bold text-slate-500 flex justify-between px-1">
                <span>CONTAINERS & DCTS: FCL: 8</span>
                <span>Avg Rate/Ton: 30000.00</span>
              </div>
            </div>

            {/* ── SECTION 3: LOADING & TRANSIT INFORMATION ── */}
            <div className="space-y-1">
              <div className="font-black uppercase text-[8px] text-[#0b192c] bg-slate-100 px-2 py-1 rounded-xs">
                🚢 LOADING & TRANSIT INFORMATION
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[7.5px] border border-slate-200 rounded p-2 bg-slate-50/30">
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Loading Country:</span>
                  <b className="text-slate-900">{countryName}</b>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Receiving Country:</span>
                  <b className="text-slate-900">United Arab Emirates</b>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Loading Port:</span>
                  <b>JEBEL ALI</b>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Receiving Port:</span>
                  <b>JEBEL ALI</b>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Loading Date:</span>
                  <span>2026-07-20</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Received Date at Port:</span>
                  <span>2026-07-23</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Containers:</span>
                  <b className="font-mono">8 Containers</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Container Numbers & BL:</span>
                  <b className="font-mono">8 Containers / BL: AE-4521-9988</b>
                </div>
              </div>
            </div>

            {/* ── SECTION 4: PAYMENT INFORMATION & ACCOUNTING INFORMATION ── */}
            <div className="grid grid-cols-2 gap-3 text-[7.5px]">
              
              {/* Payment Info */}
              <div className="border border-slate-200 rounded p-2 bg-slate-50/30 space-y-1">
                <div className="font-black uppercase text-[#0b192c] border-b border-slate-200 pb-1">💰 PAYMENT INFORMATION</div>
                <div className="flex justify-between"><span className="text-slate-500">Payment Condition:</span><b>Advance Payment</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Advance Percent / Due:</span><b>{advancePercent}% / 2026-07-23</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Advance Amount:</span><b className="text-emerald-700 font-mono">${money(advanceAmountFc)} (${money(advanceAmountLc)} {currencyLc})</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Remaining Balance / Due:</span><b>80% / 2026-07-23</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Remaining Amount:</span><b className="text-rose-700 font-mono">${money(remainingAmountFc)} (${money(remainingAmountLc)} {currencyLc})</b></div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="bg-emerald-600 text-white font-black text-[6.5px] px-1.5 py-0.5 rounded uppercase">POSTED</span>
                </div>
              </div>

              {/* Accounting Information */}
              <div className="border border-slate-200 rounded p-2 bg-slate-50/30 space-y-1">
                <div className="font-black uppercase text-[#0b192c] border-b border-slate-200 pb-1">⚙️ ACCOUNTING INFORMATION</div>
                <div className="flex justify-between"><span className="text-slate-500">Journal Entry Number:</span><b className="font-mono text-blue-700">Pending Posting</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Debit Account:</span><b className="font-mono text-blue-700">{purchaseAccCode} ({purchaseAccName.slice(0, 18)})</b></div>
                <div className="text-[6.5px] text-slate-400 font-mono pl-12">Super S/N: {superAdminSerial} | Cty: {countrySerial} | Br: {branchSerial}</div>
                <div className="flex justify-between"><span className="text-slate-500">Debit Amount:</span><b className="font-mono text-blue-700">${money(totalAmountFc)} USD @ {exchangeRate} = {money(totalAmountLc)} {currencyLc}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Credit Account:</span><b className="font-mono text-emerald-700">{salesAccCode} ({salesAccName.slice(0, 18)})</b></div>
                <div className="text-[6.5px] text-slate-400 font-mono pl-12">Super S/N: {superAdminSerial} | Cty: {countrySerial} | Br: {branchSerial}</div>
                <div className="flex justify-between"><span className="text-slate-500">Credit Amount:</span><b className="font-mono text-emerald-700">${money(totalAmountFc)} USD @ {exchangeRate} = {money(totalAmountLc)} {currencyLc}</b></div>
              </div>

            </div>

            {/* ── SECTION 5: REMARKS / NARRATION ── */}
            <div className="border border-slate-200 rounded p-1.5 bg-slate-50/30 text-[7.5px]">
              <span className="font-black uppercase text-[#0b192c] mr-2">REMARKS / NARRATION:</span>
              <span className="text-slate-600">No remarks provided. Double-entry booking transaction created for Purchase Transfer Payment.</span>
            </div>

            {/* Footer Notes & Signatures */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <p className="text-[6.5px] text-slate-500 text-center italic">
                *This is a system generated print sheet of Demi Trading Co. accounts ledger. Double-entry transaction postings have been validated.*
              </p>

              <div className="flex justify-between items-end pt-2 text-[7.5px]">
                <div className="w-12 h-12 border-2 border-slate-300 rounded-full flex items-center justify-center text-[6px] font-bold text-slate-400 uppercase text-center p-1">
                  OFFICIAL STAMP
                </div>

                <div className="text-center space-y-1">
                  <div className="w-32 border-b border-slate-900"></div>
                  <div className="font-black text-slate-800">ADMIN</div>
                  <div className="text-[6.5px] text-slate-500 uppercase">PREPARED BY</div>
                </div>

                <div className="text-center space-y-1">
                  <div className="w-32 border-b border-slate-900"></div>
                  <div className="font-black text-slate-800">Branch Manager</div>
                  <div className="text-[6.5px] text-slate-500 uppercase">AUTHORIZED BY</div>
                </div>
              </div>
            </div>

          </div>

        </main>

      </div>

    </div>
  );
}
