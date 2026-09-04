"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, Suspense } from "react";
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
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { Th } from "@/components/ui/translated-th";
import { deriveSalesBookingPostingState } from "@/lib/services/sales-booking-posting-state";
import { resolveSalesBookingPaymentRoute } from "@/lib/services/sales-booking-routing";
import { fetchBranding, brandingName } from "@/lib/branding/client";

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

function statusLabel(s: string, lang: string) {
  const lower = String(s || "").toLowerCase();
  if (lower === "partial") return t(lang, "sales.ster_partial_advance_paid", "Partial Advance Paid");
  if (lower === "pending") return t(lang, "log.seg_pending", "Pending");
  return s;
}

/* ─────────────────────── sub-components ─────────────────────── */

function SectionCard({
  icon,
  title,
  badge,
  lang,
  children
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  lang: string;
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
            {statusLabel(badge, lang)}
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

function SalesTransferErpReportViewContent({
  purchaseData: initialData
}: {
  purchaseData?: any;
}) {
  const lang = useActiveLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [reportData, setReportData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData && Boolean(idParam));
  const [error, setError] = useState<string | null>(null);
  const [brandCompany, setBrandCompany] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchBranding(null)
      .then((b) => {
        if (!alive) return;
        setBrandCompany(brandingName(b, lang) || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang]);

  const brandLine = brandCompany || t(lang, "acct.brand_short", "Digital Dock ERP");

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
        if (!cancelled) setError(err?.message || t(lang, "sales.ster_err_load_sales_record", "Failed to load sales order record."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [idParam, initialData]);

  /* ── Derived values ────────────────────────────────────────── */

  const d = reportData;
  const bookingPostingState = useMemo(() => deriveSalesBookingPostingState(d || {}), [d]);

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
  const paymentRoute = useMemo(() => resolveSalesBookingPaymentRoute(form.paymentType || d?.payment_type || "Advance Payment"), [form.paymentType, d?.payment_type]);
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
          paymentKind: paymentRoute.paymentKind,
          paymentType: form.paymentType || paymentRoute.paymentLabel,
          advancePaid: 0
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || json?.error || t(lang, "sales.ster_err_transfer_payment", "Failed to process transfer payment."));
      }
      setTransferSuccess("✅ Booking Transfer successfully posted! Supplier ledger and inventory balances have been automatically updated.");
      
      setReportData((prev: any) => ({
        ...prev,
        ledger_posting_status: "posted",
        payment_status: json.data?.paymentStatus || "pending",
        payment_kind: json.data?.paymentKind || paymentRoute.paymentKind,
        advance_paid: 0,
        remaining_due: totalSalesAmountPkr
      }));
    } catch (err: any) {
      setTransferError(err?.message || t(lang, "sales.ster_err_processing_transfer", "Error processing transfer payment."));
    } finally {
      setTransferring(false);
    }
  }

  /* ── Print ─────────────────────────────────────────────────── */
  async function handlePrint() {
    const { printDomFragmentViaModal } = await import("@/lib/reports/print-dom-fragment");
    if (!printDomFragmentViaModal("erp-sales-transfer-sheet", t(lang, "sales.ster_report_title", "Sales Transfer — ERP Report"), { lang })) {
      window.print();
    }
  }

  /* ── Render states ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold">{t(lang, "ster.loading_report", "Loading ERP Transaction Report…")}</p>
        </div>
      </div>
    );
  }

  if (error || !d) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center max-w-md">
          <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-rose-800">{error || t(lang, "sales.ster_sales_record_not_found", "Sales order record not found.")}</p>
          <Button onClick={() => router.back()} variant="outline" size="sm" className="mt-4">
            {t(lang, "ster.go_back_arrow", "← Go Back")}
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
            <span className="text-[10px] font-bold uppercase">{t(lang, "pter.back_to_report", "Back to Report")}</span>
          </Button>
          <div className="h-4 w-px bg-white/20" />
          <div>
            <p className="text-[8px] font-bold uppercase tracking-widest text-blue-200">{t(lang, "nav.sales_transfer_payment", "Sales Transfer Payment")}</p>
            <p className="text-xs font-black text-white">{d.salesBookingOrderNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span className={`hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusColor(d.payment_status || d.status || "Pending")}`}>
            {statusLabel(d.payment_status || d.status || "Pending", lang)}
          </span>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handlePrint}
            className="h-8 text-white hover:bg-white/10 gap-1.5 px-2.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase hidden sm:inline">{t(lang, "purchase.pmw_print_pdf", "Print / PDF")}</span>
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
            <span className="text-[10px] font-bold uppercase hidden sm:inline">{t(lang, "sales.ster_edit_booking", "Edit Booking")}</span>
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
      <main id="erp-sales-transfer-sheet" className="mx-auto max-w-[900px] py-6 px-4 space-y-4 print:py-0 print:px-0 print:max-w-none">

        {/* Document Branding Header */}
        <div className="rounded-xl bg-[#0f2942] text-white p-5 shadow-md print:rounded-none">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-blue-200">{brandLine} — {t(lang, "ster.enterprise_erp", "Enterprise ERP")}</p>
              <h1 className="text-xl font-black tracking-tight mt-0.5">{t(lang, "pter.erp_report_title", "ERP Transaction Report")}</h1>
              <p className="text-[10px] text-blue-200 font-semibold mt-0.5">{t(lang, "ster.sales_transfer_audit_doc", "Sales Transfer Payment — Official Audit Document")}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200">{t(lang, "pter.journal_number", "Journal Number")}</p>
              <p className="text-sm font-black font-mono">{journalNumber}</p>
              <p className="text-[10px] text-blue-300 font-mono mt-0.5">{journalDate}</p>
            </div>
          </div>
        </div>

        {/* ── 1. HEADER INFORMATION ─────────────────────── */}
        <SectionCard lang={lang} icon={<FileText className="h-4 w-4" />} title={t(lang, "pter.sec_txn_header", "Transaction Header")} badge={d.payment_status || d.status}>
          <div className="grid sm:grid-cols-2 gap-x-8">
            <div>
              <InfoRow label={t(lang, "pter.booking_ref", "Booking Reference")} value={d.salesBookingOrderNumber} mono />
              <InfoRow label={t(lang, "sales.ster_sales_date", "Sales Date")} value={fmtDate(d.salesDate)} />
              <InfoRow label={t(lang, "purchase.f_booking_date", "Booking Date")} value={fmtDate(d.bookingDate || d.createdAt)} />
              <InfoRow label={t(lang, "pter.transaction_status", "Transaction Status")} value={d.payment_status || d.status || "-"} />
            </div>
            <div>
              <InfoRow label={t(lang, "pter.booking_user", "Booking User")} value={d.audit?.userName || "Admin"} />
              <InfoRow label={t(lang, "purchase.f_user_id", "User ID")} value={d.audit?.userId || "-"} mono />
              <InfoRow label={t(lang, "cdash.col_branch_name", "Branch Name")} value={d.branchName || "-"} />
              <InfoRow label={t(lang, "report.country", "Country")} value={d.countryName || "-"} />
            </div>
          </div>
        </SectionCard>

        {/* ── 2. SELLER & CUSTOMER INFORMATION ──────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <SectionCard lang={lang} icon={<User className="h-4 w-4" />} title={t(lang, "sales.ster_seller_information", "Seller Information")}>
            <InfoRow label={t(lang, "sales.ster_seller_code", "Seller Code")} value={d.salesAccountNumber || "BUY-001"} mono />
            <InfoRow label={t(lang, "sales.ster_seller_name", "Seller Name")} value={d.buyerName || "-"} />
            <InfoRow
              label={t(lang, "pter.contact_number", "Contact Number")}
              value={form.buyerPhone || form.buyerContact || "-"}
            />
            <InfoRow
              label={t(lang, "purchase.dd_email", "Email")}
              value={form.buyerEmail || "-"}
            />
            <InfoRow label={t(lang, "report.country", "Country")} value={form.receivedCountry || d.branchName || "-"} />
          </SectionCard>

          <SectionCard lang={lang} icon={<Building2 className="h-4 w-4" />} title={t(lang, "acct.sec_customer_info", "Customer Information")}>
            <InfoRow label={t(lang, "acct.customer_code", "Customer Code")} value={d.purchaseAccountNumber || "SUP-001"} mono />
            <InfoRow label={t(lang, "acct.customer_name", "Customer Name")} value={d.supplierName || "-"} />
            <InfoRow
              label={t(lang, "pter.contact_number", "Contact Number")}
              value={form.supplierPhone || form.contactPhone || d.form_data?.supplier?.phone || "-"}
            />
            <InfoRow
              label={t(lang, "purchase.dd_email", "Email")}
              value={form.supplierEmail || form.contactEmail || d.form_data?.supplier?.email || "-"}
            />
            <InfoRow label={t(lang, "report.country", "Country")} value={d.countryName || form.loadingCountry || "-"} />
          </SectionCard>
        </div>

        {/* ── 4. GOODS DETAILS ──────────────────────────── */}
        <SectionCard lang={lang} icon={<Package className="h-4 w-4" />} title={t(lang, "purchase.goods_details_title", "Goods Details")}>
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
                  <td colSpan={7} className="px-3 py-2.5 text-right text-slate-600 uppercase tracking-wider">{t(lang, "report.builder_grand_total", "Grand Total")}</td>
                  <td className="px-3 py-2.5 text-right text-[#0f2942] font-black text-sm font-mono">
                    {money(totalSalesAmountUsd)} {currency}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>

        {/* ── 5. LOADING & TRANSPORT ────────────────────── */}
        <SectionCard lang={lang} icon={<Ship className="h-4 w-4" />} title={t(lang, "sales.ster_loading_transport_info", "Loading & Transport Information")}>
          <div className="grid sm:grid-cols-2 gap-x-8">
            <div>
              <InfoRow label={t(lang, "purchase.loading_country_label", "Loading Country")} value={form.loadingCountry || d.countryName || "-"} />
              <InfoRow label={t(lang, "purchase.loading_port_label", "Loading Port")} value={form.loadingPort || "-"} />
              <InfoRow label={t(lang, "purchase.loading_date_label", "Loading Date")} value={fmtDate(form.loadingDate)} />
              <InfoRow label={t(lang, "plr.vessel_name", "Vessel Name")} value={form.vesselName || form.shipName || "-"} />
            </div>
            <div>
              <InfoRow label={t(lang, "purchase.receiving_country_label", "Receiving Country")} value={form.receivedCountry || "-"} />
              <InfoRow label={t(lang, "purchase.receiving_port_label", "Receiving Port")} value={form.receivedPort || form.exitPort || "-"} />
              <InfoRow label={t(lang, "sales.ster_container_number", "Container Number")} value={form.containerNo || form.containerNumber || `CONT-${d.containerCount || 0} containers`} mono />
              <InfoRow label={t(lang, "plr.col_bl", "BL Number")} value={form.blNo || form.billOfLadingNo || "-"} mono />
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
            <SectionCard lang={lang} icon={<CreditCard className="h-4 w-4" />} title={t(lang, "pter.sec_payment_info", "Payment Information")} badge={bookingPostingState.label}>
              <div className="grid sm:grid-cols-2 gap-x-8">
                <div>
                  <InfoRow label={t(lang, "pb_register.total_purchase_amount", "Total Purchase Amount")} value={`${money(totalSalesAmountUsd)} ${currencySymbol} / ${money(totalSalesAmountPkr)} ${localCurrencySymbol}`} mono />
                  <InfoRow label={t(lang, "sales.ster_advance_percentage", "Advance Percentage")} value={`${form.advancePercent || 0}%`} mono />
                  <InfoRow label={t(lang, "sed.f_advance_paid", "Advance Paid")} value={`${money(displayAdvanceUsd)} ${currencySymbol} / ${money(displayAdvancePkr)} ${localCurrencySymbol}`} mono />
                  <InfoRow label={t(lang, "purchase.pmw_remaining_balance", "Remaining Balance")} value={`${money(displayRemainingUsd)} ${currencySymbol} / ${money(displayRemainingPkr)} ${localCurrencySymbol}`} mono />
                </div>
                <div>
                  <InfoRow label={t(lang, "hr.p_payment_status", "Payment Status")} value={statusLabel(bookingPostingState.label === "BLACK" ? "completed" : d.payment_status || d.status || "-", lang)} />
                  <InfoRow label={t(lang, "sales.ster_selected_mode", "Selected Mode")} value={form.paymentType || "-"} />
                  <InfoRow label={t(lang, "sales.ster_payment_route", "Payment Route")} value={paymentRoute.paymentLabel} />
                  <InfoRow label={t(lang, "bankroz.due_date", "Due Date")} value={fmtDate(form.dueDate || form.loadingDate)} />
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
        <SectionCard lang={lang} icon={<BookOpen className="h-4 w-4" />} title={t(lang, "pter.sec_accounting", "Accounting / Ledger Impact")}>
          {/* Journal meta */}
          <div className="grid sm:grid-cols-3 gap-x-8 mb-4">
            <InfoRow label={t(lang, "pter.journal_number", "Journal Number")} value={journalNumber} mono />
            <InfoRow label={t(lang, "pter.journal_date", "Journal Date")} value={journalDate} />
            <InfoRow label={t(lang, "report.col_posting_status", "Posting Status")} value={d.ledger_posting_status || t(lang, "log.seg_pending", "Pending")} />
          </div>

          {/* Balance validation badge */}
          <div className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
            isBalanced
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}>
            <CheckCircle2 className="h-4 w-4" /> {t(lang, "ster.journal_balanced", "Journal Entry Balanced — Total Debit equals Total Credit")}
          </div>

          <div className="space-y-6">
            {/* Booking Transfer Stage Preview */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">1. Booking Transfer Stage (GL Impact)</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-650 border-b border-slate-200">
                      <Th className="px-4 py-2.5 text-left">{t(lang, "pter.col_gl_code", "GL Code")}</Th>
                      <Th className="px-4 py-2.5 text-left">{t(lang, "purchase.f_account_name", "Account Name")}</Th>
                      <Th className="px-4 py-2.5 text-right">{t(lang, "cdash.col_debit", "Debit")}</Th>
                      <Th className="px-4 py-2.5 text-right">{t(lang, "cdash.col_credit", "Credit")}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-blue-50/40 hover:bg-blue-50/70">
                      <td className="px-4 py-3 font-mono font-black text-[#0f2942]">{form.purchaseAccountNo || d.purchaseAccountNumber || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{form.purchaseAccountName || d.purchaseAccountName || t(lang, "sales.ster_customer_account_debit_fallback", "Customer Account (Debit)")} (DR)</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">{money(debitAmount)} {localCurrencySymbol}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-400">-</td>
                    </tr>
                    <tr className="bg-emerald-50/40 hover:bg-emerald-50/70">
                      <td className="px-4 py-3 font-mono font-black text-[#0f2942]">{form.salesAccountNo || d.salesAccountNumber || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{form.salesAccountName || d.salesAccountName || t(lang, "sales.ster_sales_account_credit_fallback", "Sales Account (Credit)")} (CR)</td>
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
            <p className="font-black text-slate-600 uppercase text-[9px] tracking-wider mb-1">{t(lang, "ster.accounting_flow_stage", "Accounting Flow — Purchase Transfer Stage")}</p>
            <p>
              <span className="text-blue-700 font-black">{t(lang, "pter.debit_label", "DEBIT:")}</span>{" "}
              Customer Account ({form.purchaseAccountNo || d.purchaseAccountNumber || "—"}) = Goods received at purchase cost
            </p>
            <p>
              <span className="text-emerald-700 font-black">{t(lang, "pter.credit_label", "CREDIT:")}</span>{" "}
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
              <p className="text-xs font-black text-emerald-900">{t(lang, "ster.ready_to_process_transfer", "Ready to process payment transfer?")}</p>
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
            <span>{brandLine}</span>
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

export function SalesTransferErpReportView(props: { purchaseData?: any }) {
  const lang = useActiveLanguage();
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-semibold text-slate-500">{t(lang, "sales.ster_loading_verification", "Loading Sales Verification...")}</div>}>
      <SalesTransferErpReportViewContent {...props} />
    </Suspense>
  );
}
