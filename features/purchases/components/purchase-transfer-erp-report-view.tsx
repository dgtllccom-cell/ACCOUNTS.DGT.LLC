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
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { Th } from "@/components/ui/translated-th";

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
  const lower = s.toLowerCase();
  if (lower.includes("paid") || lower.includes("confirmed") || lower.includes("posted") || lower.includes("full")) {
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
            {badge}
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

export function PurchaseTransferErpReportView({
  purchaseData: initialData
}: {
  purchaseData?: any;
}) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  const isRtl = ["ur","ar","fa","ps"].includes(activeLang);
  const tt = (key: string, fb: string) => t(activeLang, key as never, fb);
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [reportData, setReportData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData && Boolean(idParam));
  const [error, setError] = useState<string | null>(null);

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
        // Support both wrapped and unwrapped responses
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
      totalAmount: d.totalPurchaseAmount || d.purchaseAmount || 0,
    }];
  }, [d]);

  const totalPurchaseAmount = useMemo(() => {
    if (!d) return 0;
    return Number(d.totalPurchaseAmount || d.purchaseAmount || 0);
  }, [d]);

  const advanceAmount = useMemo(() => {
    if (!d) return 0;
    const form = d.form_data?.form || {};
    const purchaseBooking = d.form_data?.purchaseBooking || {};
    const directAdvance = Number(purchaseBooking.advancePaymentAmount || form.advanceAmount || form.advancePaid || 0);
    if (directAdvance > 0) return directAdvance;

    const ps = String(d.paymentStatus || d.status || "").toLowerCase();
    if (ps.includes("full")) return totalPurchaseAmount;
    if (ps.includes("advance") || ps.includes("paid")) return totalPurchaseAmount * 0.3;
    return 0;
  }, [d, totalPurchaseAmount]);

  const remainingBalance = Math.max(0, totalPurchaseAmount - advanceAmount);

  /* GL / Accounting entries */
  const glEntries: GLEntry[] = useMemo(() => {
    if (!d) return [];
    const amt = totalPurchaseAmount;
    const purchaseAccNo = d.purchaseAccountNumber || "INV-001";
    const purchaseAccName = d.purchaseAccountName || "Purchase Inventory Account";
    const supplierAccNo = "AP-" + (d.purchaseBookingOrderNumber?.slice(-3) || "001");
    const supplierAccName = `${d.supplierName || "Supplier"} Payable Account`;

    return [
      { glCode: purchaseAccNo, accountName: purchaseAccName, debit: amt, credit: 0, type: "debit" },
      { glCode: supplierAccNo, accountName: supplierAccName, debit: 0, credit: amt, type: "credit" }
    ];
  }, [d, totalPurchaseAmount]);

  const totalDebit = glEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = glEntries.reduce((s, e) => s + e.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const journalNumber = useMemo(() => {
    if (!d) return "-";
    return `JV-${d.purchaseBookingOrderNumber || "000"}`;
  }, [d]);

  const journalDate = useMemo(() => fmtDate(d?.bookingDate || d?.purchaseDate || d?.createdAt), [d]);

  const [transferring, setTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState("");
  const [transferError, setTransferError] = useState("");

  /* ── Transfer to Payment ────────────────────────────────────── */
  async function handleTransferPayment() {
    if (!d) return;
    setTransferring(true);
    setTransferError("");
    setTransferSuccess("");
    try {
      const res = await fetch(`/api/erp/purchases/orders/${d.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advancePaid: advanceAmount
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || json?.error || "Failed to process transfer payment.");
      }
      setTransferSuccess(`✅ Booking Transfer and Payment of ${money(advanceAmount)} successfully posted! Supplier ledger and cash/bank balances have been automatically updated.`);
      
      // Update local state to reflect the posted transaction immediately
      setReportData((prev: any) => ({
        ...prev,
        ledger_posting_status: "posted",
        payment_status: json.data?.paymentStatus || (remainingBalance === 0 ? "completed" : "partial"),
        advance_paid: advanceAmount,
        remaining_due: remainingBalance
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

  const form = d.form_data?.form || {};
  const currency = d.currency || "USD";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" dir={isRtl ? "rtl" : "ltr"}>

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
            <span className="text-[10px] font-bold uppercase">{tt("pter.back_to_report","Back to Report")}</span>
          </Button>
          <div className="h-4 w-px bg-white/20" />
          <div>
            <p className="text-[8px] font-bold uppercase tracking-widest text-blue-200">{tt("pter.transfer_payment","Purchase Transfer Payment")}</p>
            <p className="text-xs font-black text-white">{d.purchaseBookingOrderNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span className={`hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusColor(d.status || "Pending")}`}>
            {d.status || "Pending"}
          </span>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handlePrint}
            className="h-8 text-white hover:bg-white/10 gap-1.5 px-2.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase hidden sm:inline">{tt("pter.print_pdf","Print / PDF")}</span>
          </Button>

          {/* ★ PRIMARY: Transfer Payment button */}
          <Button
            type="button"
            size="sm"
            onClick={handleTransferPayment}
            disabled={transferring || d.ledger_posting_status === "posted"}
            className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wide px-3 shadow-md gap-1.5 border-none disabled:opacity-50"
          >
            <WalletCards className="h-3.5 w-3.5" />
            {transferring ? tt("pter.transferring","Transferring...") : tt("pter.btn_transfer","Transfer Payment")}
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
              <h1 className="text-xl font-black tracking-tight mt-0.5">{tt("pter.erp_report_title","ERP Transaction Report")}</h1>
              <p className="text-[10px] text-blue-200 font-semibold mt-0.5">{tt("pter.official_audit_doc","Purchase Transfer Payment — Official Audit Document")}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200">{tt("pter.journal_number","Journal Number")}</p>
              <p className="text-sm font-black font-mono">{journalNumber}</p>
              <p className="text-[10px] text-blue-300 font-mono mt-0.5">{journalDate}</p>
            </div>
          </div>
        </div>

        {/* ── 1. HEADER INFORMATION ─────────────────────── */}
        <SectionCard icon={<FileText className="h-4 w-4" />} title={tt("pter.sec_txn_header","Transaction Header")} badge={d.status}>
          <div className="grid sm:grid-cols-2 gap-x-8">
            <div>
              <InfoRow label={tt("pter.booking_ref","Booking Reference")} value={d.purchaseBookingOrderNumber} mono />
              <InfoRow label={tt("pter.purchase_date","Purchase Date")} value={fmtDate(d.purchaseDate)} />
              <InfoRow label={tt("pter.booking_date","Booking Date")} value={fmtDate(d.bookingDate || d.createdAt)} />
              <InfoRow label={tt("pter.transaction_status","Transaction Status")} value={d.status || "-"} />
            </div>
            <div>
              <InfoRow label={tt("pter.booking_user","Booking User")} value={d.audit?.userName || "Admin"} />
              <InfoRow label={tt("pter.user_id","User ID")} value={d.audit?.userId || "-"} mono />
              <InfoRow label={tt("common.branch","Branch Name")} value={d.branchName || "-"} />
              <InfoRow label={tt("common.country","Country")} value={d.countryName || "-"} />
            </div>
          </div>
        </SectionCard>

        {/* ── 2. SUPPLIER INFORMATION ───────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <SectionCard icon={<Building2 className="h-4 w-4" />} title={tt("pter.sec_supplier_info","Supplier Information")}>
            <InfoRow label={tt("pter.supplier_code","Supplier Code")} value={d.purchaseAccountNumber || "SUP-001"} mono />
            <InfoRow label={tt("pter.supplier_name","Supplier Name")} value={d.supplierName || "-"} />
            <InfoRow
              label={tt("pter.contact_number","Contact Number")}
              value={form.supplierPhone || form.contactPhone || d.form_data?.supplier?.phone || "-"}
            />
            <InfoRow
              label={tt("lpjr.inv_email","Email")}
              value={form.supplierEmail || form.contactEmail || d.form_data?.supplier?.email || "-"}
            />
            <InfoRow label={tt("common.country","Country")} value={d.countryName || form.loadingCountry || "-"} />
          </SectionCard>

          {/* ── 3. BUYER INFORMATION ─────────────────────── */}
          <SectionCard icon={<User className="h-4 w-4" />} title={tt("pter.sec_buyer_info","Buyer Information")}>
            <InfoRow label={tt("pter.buyer_code","Buyer Code")} value={d.salesAccountNumber || "BUY-001"} mono />
            <InfoRow label={tt("pter.buyer_name","Buyer Name")} value={d.buyerName || "-"} />
            <InfoRow
              label={tt("pter.contact_number","Contact Number")}
              value={form.buyerPhone || form.buyerContact || "-"}
            />
            <InfoRow
              label={tt("lpjr.inv_email","Email")}
              value={form.buyerEmail || "-"}
            />
            <InfoRow label={tt("common.country","Country")} value={form.receivedCountry || d.branchName || "-"} />
          </SectionCard>
        </div>

        {/* ── 4. GOODS DETAILS ──────────────────────────── */}
        <SectionCard icon={<Package className="h-4 w-4" />} title={tt("pter.sec_goods_details","Goods Details")}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#0f2942] text-white text-[10px] font-black uppercase tracking-wider">
                  {["#", "Product Name", "Qty", "Unit", "Gross Wt (kg)", "Net Wt (kg)", "Rate", "Total Amount"].map((h) => (
                    <Th key={h} className="px-3 py-2 text-right first:text-left border-r border-white/10 last:border-r-0 whitespace-nowrap">
                      {h}
                    </Th>
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
                  <td colSpan={7} className="px-3 py-2.5 text-right text-slate-600 uppercase tracking-wider">{tt("pter.grand_total","Grand Total")}</td>
                  <td className="px-3 py-2.5 text-right text-[#0f2942] font-black text-sm font-mono">
                    {money(totalPurchaseAmount)} {currency}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>

        {/* ── 5. LOADING & TRANSPORT ─────────�        {/* ── 6. PAYMENT INFORMATION ───────────────────── */}
        <SectionCard icon={<CreditCard className="h-4 w-4" />} title={tt("pter.sec_payment_info","Payment Information")} badge={d.paymentStatus || d.status}>
          <div className="grid sm:grid-cols-2 gap-x-8">
            <div>
              <InfoRow label={tt("pter.total_purchase_amt","Total Purchase Amount")} value={`${money(totalPurchaseAmount)} ${currency}`} mono />
              <InfoRow label={tt("pter.advance_paid","Advance Paid")} value={`${money(advanceAmount)} ${currency}`} mono />
              <InfoRow label={tt("pter.remaining_balance","Remaining Balance")} value={`${money(remainingBalance)} ${currency}`} mono />
            </div>
            <div>
              <InfoRow label={tt("pter.payment_status","Payment Status")} value={d.paymentStatus || d.status || "-"} />
              <InfoRow label={tt("pter.payment_type","Payment Type")} value={form.paymentType || "-"} />
              <InfoRow label={tt("pter.due_date","Due Date")} value={fmtDate(form.dueDate || form.loadingDate)} />
            </div>
          </div>

          {/* Payment summary bar */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: tt("pter.lbl_total_amount","Total Amount"), value: `${money(totalPurchaseAmount)} ${currency}`, color: "text-[#0f2942]" },
              { label: tt("pter.lbl_advance_paid","Advance Paid"), value: `${money(advanceAmount)} ${currency}`, color: "text-emerald-600" },
              { label: tt("pter.lbl_remaining_due","Remaining Due"), value: `${money(remainingBalance)} ${currency}`, color: "text-rose-600" }
            ].map((item) => (
              <div key={item.label} className="rounded-lg border bg-slate-50 p-3 text-center dark:bg-slate-900/40">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                <p className={`text-sm font-black mt-1 font-mono ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── 7. ACCOUNTING / LEDGER IMPACT ────────────── */}
        <SectionCard icon={<BookOpen className="h-4 w-4" />} title={tt("pter.sec_accounting","Accounting / Ledger Impact")}>
          {/* Journal meta */}
          <div className="grid sm:grid-cols-3 gap-x-8 mb-4">
            <InfoRow label={tt("pter.journal_number","Journal Number")} value={journalNumber} mono />
            <InfoRow label={tt("pter.journal_date","Journal Date")} value={journalDate} />
            <InfoRow label={tt("pter.posting_status","Posting Status")} value={d.ledger_posting_status || "Pending"} />
          </div>

          {/* Balance validation badge */}
          <div className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
            isBalanced
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}>
            {isBalanced ? (
              <><CheckCircle2 className="h-4 w-4" /> {tt("pter.balanced_msg","Journal Entry Balanced — Total Debit equals Total Credit")}</>
            ) : (
              <><AlertTriangle className="h-4 w-4" /> {tt("pter.unbalanced_msg","Journal Entry Not Balanced — Please verify accounting entries")}</>
            )}
          </div>

          <div className="space-y-6">
            {/* Booking Transfer Stage Preview */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">{tt("pter.stage1_gl","1. Booking Transfer Stage (GL Impact)")}</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-650 border-b border-slate-200">
                      <Th className="px-4 py-2.5 text-left">{tt("pter.col_gl_code","GL Code")}</Th>
                      <Th className="px-4 py-2.5 text-left">{tt("pter.col_account_name","Account Name")}</Th>
                      <Th className="px-4 py-2.5 text-right">{tt("pter.col_debit","Debit")} ({currency})</Th>
                      <Th className="px-4 py-2.5 text-right">{tt("pter.col_credit","Credit")} ({currency})</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-blue-50/40 hover:bg-blue-50/70">
                      <td className="px-4 py-3 font-mono font-black text-[#0f2942]">{d.purchaseAccountNumber || "INV-001"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{d.purchaseAccountName || "Purchase Inventory Account"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">{money(totalPurchaseAmount)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-400">-</td>
                    </tr>
                    <tr className="bg-emerald-50/40 hover:bg-emerald-50/70">
                      <td className="px-4 py-3 font-mono font-black text-[#0f2942]">{"AP-" + (d.purchaseBookingOrderNumber?.slice(-3) || "001")}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{`${d.supplierName || "Supplier"} Payable Account`}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-400">-</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{money(totalPurchaseAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Advance Payment Stage Preview */}
            {advanceAmount > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400">{tt("pter.stage2_gl","2. Advance Payment Stage (GL Impact)")}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-650 border-b border-slate-200">
                        <Th className="px-4 py-2.5 text-left">{tt("pter.col_gl_code","GL Code")}</Th>
                        <Th className="px-4 py-2.5 text-left">{tt("pter.col_account_name","Account Name")}</Th>
                        <Th className="px-4 py-2.5 text-right">Debit ({currency})</Th>
                        <Th className="px-4 py-2.5 text-right">Credit ({currency})</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="bg-blue-50/40 hover:bg-blue-50/70">
                        <td className="px-4 py-3 font-mono font-black text-[#0f2942]">{"AP-" + (d.purchaseBookingOrderNumber?.slice(-3) || "001")}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{`${d.supplierName || "Supplier"} Payable Account`}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">{money(advanceAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-400">-</td>
                      </tr>
                      <tr className="bg-emerald-50/40 hover:bg-emerald-50/70">
                        <td className="px-4 py-3 font-mono font-black text-[#0f2942]">{"CASH-001"}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">Cash / Bank Account</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-400">-</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{money(advanceAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Accounting flow note */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] font-semibold text-slate-500 space-y-1">
            <p className="font-black text-slate-600 uppercase text-[9px] tracking-wider mb-1">{tt("pter.accounting_flow","Accounting Flow — Purchase Transfer Stage")}</p>
            <p>
              <span className="text-blue-700 font-black">DEBIT:</span>{" "}
              Purchase Inventory Account (INV) = Goods received into inventory at purchase cost
            </p>
            <p>
              <span className="text-emerald-700 font-black">CREDIT:</span>{" "}
              Supplier Payable Account (AP) = Liability created against supplier for payment due
            </p>
            {advanceAmount > 0 && (
              <div className="border-t border-slate-200 pt-1.5 mt-1.5">
                <p className="font-black text-slate-600 uppercase text-[9px] tracking-wider mb-1">{tt("pter.payment_stage","Payment Posting Stage (on Transfer Payment)")}</p>
                <p>
                  <span className="text-blue-700 font-black">DEBIT:</span>{" "}
                  Supplier Payable Account (AP) = Clears the supplier liability
                </p>
                <p>
                  <span className="text-emerald-700 font-black">CREDIT:</span>{" "}
                  Cash / Bank Account = Cash outflow recorded
                </p>
              </div>
            )}
          </div>
        </SectionCard>
        {/* ── 8. TRANSFER TO PAYMENT CTA ───────────────── */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-900">{tt("pter.cta_ready","Ready to process payment transfer?")}</p>
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
            <span>{d.purchaseBookingOrderNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>{tt("pter.generated","Generated")}: {new Date().toLocaleDateString("en-GB")}</span>
          </div>
        </footer>

        {/* Print-only Transfer To Payment notice */}
        <div className="hidden print:block border-t border-slate-300 pt-4 mt-2 text-center text-[10px] font-semibold text-slate-500">
          {tt("pter.print_notice","This is an official ERP transaction document. Transfer to payment must be processed via the ERP system.")}
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

