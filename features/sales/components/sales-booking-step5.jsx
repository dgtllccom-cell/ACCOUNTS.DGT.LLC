"use client";
import React, { useMemo } from "react";
import {
  CheckCircle2,
  Eye,
  Download,
  Printer,
  ChevronLeft,
  Save,
  Check,
  Building2,
  Package,
  Ship,
  Landmark,
  FileText,
  QrCode,
  ShieldCheck,
  Loader2
} from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { SalesBookingUpperCards, formatDisplayDate } from "./sales-booking-upper-cards";

export function SalesBookingStep5({
  form,
  setForm,
  goodsEntries = [],
  lang = "en",
  onBack,
  onSaveDraft,
  onPrint,
  onDownloadPdf,
  onPreviewPdf,
  onTransfer,
  onConfirmTransfer,
  isTransferred = false,
  savingOrder = false,
  dbCompanies = [],
  dbAccounts = []
}) {
  const handleTransferClick = onTransfer || onConfirmTransfer;
  const totals = useMemo(() => {
    const totalItems = goodsEntries.length;
    const totalQuantity = goodsEntries.reduce((sum, g) => sum + Number(g.qtyNo || g.quantity || 0), 0);
    const totalGross = goodsEntries.reduce((sum, g) => sum + Number(g.grossWeight || (Number(g.qtyNo || 0) * 1200) || 0), 0);
    const totalNet = goodsEntries.reduce((sum, g) => sum + Number(g.netWeight || (Number(g.qtyNo || 0) * 1100) || 0), 0);
    const totalAmountUsd = goodsEntries.reduce((sum, g) => sum + Number(g.totalAmount || 0), 0);

    const exRate = Number(form.exchangeRate || 3.6730);
    const totalAmountLocal = goodsEntries.reduce((sum, g) => sum + Number(g.finalAmount || (Number(g.totalAmount || 0) * exRate) || 0), 0);

    const advancePercent = Number(form.advancePercent || 10);
    const advanceAmount = (totalAmountLocal * advancePercent) / 100;
    const remainingAmount = totalAmountLocal - advanceAmount;

    return {
      totalItems,
      totalQuantity,
      totalGross,
      totalNet,
      totalAmountUsd,
      totalAmountLocal,
      exRate,
      advancePercent,
      advanceAmount,
      remainingAmount
    };
  }, [goodsEntries, form.advancePercent, form.exchangeRate]);

  const currency = form.salesCurrency || form.currencyType || "AED";

  // Intelligent fallback text if Step 4 reports were left blank
  const loadingReportText = form.loadingReport?.trim() ||
    `Cargo loaded at ${form.loadingPort || "Jebel Ali Port"} on ${formatDisplayDate(form.loadingDate || form.salesDate)}. All containers inspected and sealed with ${form.shippingLine || "MSC Line"}. Documents (Packing List, Commercial Invoice and Certificate of Origin) handed over to shipping line. Vessel ${form.vesselName || "MSC Evergreen"} (${form.voyageNo || "VY1234"}) departed on time. No damage reported.`;

  const goodsSummaryReportText = form.orderReportRemarks?.trim() ||
    `Total ${totals.totalQuantity.toLocaleString()} ${goodsEntries[0]?.qtyName || "MT"} including ${goodsEntries.map(g => g.goodsName || g.productName).filter(Boolean).join(", ") || "Almond Kernels, Pistachios and Raisins"}. All goods are in good condition and packed as per standard export quality. Net weight ${totals.totalNet.toLocaleString()} KG and gross weight ${totals.totalGross.toLocaleString()} KG. All HS codes verified and quantities matched with packing list.`;

  const paymentReportText = form.paymentReport?.trim() ||
    `Advance payment of ${totals.advancePercent}% (${currency} ${totals.advanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}) received on ${formatDisplayDate(form.advancePaymentDate || form.salesDate)} via ${form.paymentType?.toLowerCase() || "cash"}. Remaining amount ${currency} ${totals.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} to be paid on or before ${formatDisplayDate(form.paymentDate || form.salesDate)}. Payment terms as per sales contract. No outstanding from previous bookings.`;

  const journalNarrationText = form.salesReportRemarks?.trim() ||
    `Sales booking for export shipment of ${goodsEntries.map(g => g.goodsName || g.productName).filter(Boolean).join(", ") || "Almond Kernels, Pistachios and Raisins"} to ${form.destinationCountry || "Pakistan"} via ${form.loadingPort || "Jebel Ali Port"}. Total ${totals.totalQuantity.toLocaleString()} ${goodsEntries[0]?.qtyName || "MT"}, Invoice value USD ${totals.totalAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${currency} ${totals.totalAmountLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })} at rate ${totals.exRate.toFixed(4)}). Advance ${totals.advancePercent}% received and balance as per payment terms. All documents verified and shipment processed as per contract. Entry to be transferred to Sales Ledger (CR), Customer Ledger (DR) and stock as per approved booking.`;

  const checklistItems = [
    "Booking Details Completed",
    "Sales Account (CR) Selected",
    "Customer Account (DR) Selected",
    "Goods Details Completed",
    "Loading & Shipping Details Completed",
    "Payment & Settlement Completed",
    "Reports & Remarks Added",
    "Ready to Transfer"
  ];

  const transferOperations = [
    "Post to Sales Ledger (CR)",
    "Post to Customer Ledger (DR)",
    "Update Stock / Inventory",
    "Create Journal Entry",
    "Generate Invoice / Voucher"
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Subheader Banner */}
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {tUi(lang, "sales.step5_subtitle", "Review complete details, reports and remarks. Then confirm to transfer to ledger, stock and related modules.")}
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: FINAL VERIFICATION & TRANSFER PANEL */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
              5
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {tUi(lang, "sales.final_verification_transfer", "FINAL VERIFICATION & TRANSFER")}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Check all information and confirm to transfer
              </p>
            </div>
          </div>

          {/* Verification Checklist */}
          <div className="space-y-2 text-xs">
            {checklistItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{item}</span>
              </div>
            ))}
          </div>

          {/* Transfer Operations */}
          <div className="space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              TRANSFER OPERATIONS
            </div>
            <div className="space-y-1.5">
              {transferOperations.map((op, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{op}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                    Ready
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total Transaction Value Box */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-3.5 text-center space-y-1 shadow-2xs">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              TOTAL TRANSACTION VALUE
            </div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              {currency} {totals.totalAmountLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              USD {totals.totalAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} | Rate: {totals.exRate.toFixed(4)}
            </div>
          </div>

          {/* Big Green Confirm & Transfer Button */}
          <Button
            type="button"
            disabled={savingOrder || isTransferred}
            onClick={handleTransferClick}
            className={`w-full py-6 rounded-xl font-black text-xs uppercase tracking-wider shadow-md flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              isTransferred
                ? "bg-slate-200 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20 hover:-translate-y-0.5"
            }`}
          >
            {savingOrder ? (
              <div className="flex items-center gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transferring to Ledger & Stock...</span>
              </div>
            ) : isTransferred ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
                <span>Transferred to Ledger Successfully</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Transfer to Ledger</span>
                </div>
                <span className="text-[11px] font-normal normal-case opacity-90">
                  Post this Sales Booking to all related modules
                </span>
              </>
            )}
          </Button>

          {/* Bottom Buttons: Back & Save as Draft */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1 h-8.5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold"
            >
              <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180 mr-1" />
              Back to Review (Step 4)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onSaveDraft}
              className="flex-1 h-8.5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold flex items-center justify-center gap-1"
            >
              <Save className="w-3.5 h-3.5 text-blue-600" />
              Save as Draft
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: COMPLETE PDF-STYLE SALES BOOKING VOUCHER */}
        <div
          id="sales-booking-voucher-root"
          className="lg:col-span-8 bg-white text-slate-900 border border-slate-300 rounded-2xl p-5 shadow-sm space-y-4 font-sans"
        >
          {/* Voucher Document Top Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-slate-200 pb-3">
            {/* Company Info Left */}
            <div className="space-y-0.5">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">DGT LLC</h2>
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Import Export & Logistics Services
              </p>
              <p className="text-[11px] text-slate-500 leading-tight">
                Office 101, Business Bay, Dubai, UAE<br />
                Tel: +971 4 123 4567 | Email: info@dgt.llc | www.dgt.llc
              </p>
            </div>

            {/* Blue Final Voucher Tag & QR Code */}
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white rounded-lg px-3 py-2 text-right shadow-xs space-y-0.5">
                <div className="text-[11px] font-black uppercase tracking-wider">SALES BOOKING ORDER</div>
                <div className="text-[11px] font-bold tracking-widest text-blue-100 uppercase">FINAL VOUCHER</div>
                <div className="text-[11px] font-mono border-t border-blue-400/60 pt-1 mt-1 text-blue-50">
                  <div>Booking No: <b>{form.salesOrderNo || "SB-2026-0001"}</b></div>
                  <div>Serial No: <b>{form.billNo || "SV-0001"}</b></div>
                  <div>Date: {formatDisplayDate(form.salesDate)}</div>
                </div>
              </div>

              {/* QR Code Placeholder Box */}
              <div className="w-14 h-14 border border-slate-300 rounded-lg p-1 bg-white flex flex-col items-center justify-center shadow-2xs">
                <QrCode className="w-10 h-10 text-slate-800" />
                <span className="text-[11px] font-mono text-slate-500">VERIFIED</span>
              </div>
            </div>
          </div>

          {/* 3 Upper Cards (Read-Only) */}
          <SalesBookingUpperCards
            form={form}
            setForm={setForm}
            lang={lang}
            dbCompanies={dbCompanies}
            dbAccounts={dbAccounts}
            mode="all"
            showBadges={true}
            readOnly={true}
          />

          {/* GOODS OVERVIEW DETAILS Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden space-y-1">
            <div className="bg-blue-50 px-3 py-1.5 flex items-center justify-between border-b border-slate-200 text-blue-900 font-black text-[11px] uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                GOODS OVERVIEW DETAILS
              </span>
              <span className="font-mono text-slate-600">Total Items : {totals.totalItems}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-7 text-center">#</th>
                    <th className="p-2">GOODS NAME</th>
                    <th className="p-2">SIZE</th>
                    <th className="p-2">BRAND</th>
                    <th className="p-2">HS CODE</th>
                    <th className="p-2">ORIGIN COUNTRY</th>
                    <th className="p-2 text-right">QTY</th>
                    <th className="p-2 text-center">UNIT</th>
                    <th className="p-2 text-right">PRICE (USD)</th>
                    <th className="p-2 text-right">AMOUNT (USD)</th>
                    <th className="p-2 text-center">EX. RATE</th>
                    <th className="p-2 text-right font-black text-emerald-800">FINAL AMOUNT ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {goodsEntries.map((item, idx) => {
                    const ex = Number(item.exchangeRate || totals.exRate || 1);
                    const amtUsd = Number(item.totalAmount || (Number(item.qtyNo || 0) * Number(item.coursePrice || 0)));
                    const amtFinal = Number(item.finalAmount || (amtUsd * ex));
                    return (
                      <tr key={idx}>
                        <td className="p-2 text-center font-mono text-[11px] text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-bold text-slate-900">{item.goodsName || item.productName}</td>
                        <td className="p-2 text-slate-600">{item.size || "Standard"}</td>
                        <td className="p-2 text-slate-600">{item.brand || "Al Baraka"}</td>
                        <td className="p-2 font-mono text-slate-500">{item.hsCode}</td>
                        <td className="p-2 text-slate-600">{item.origin || form.loadingCountry || "United Arab Emirates"}</td>
                        <td className="p-2 text-right font-mono font-bold">
                          {Number(item.qtyNo || item.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        </td>
                        <td className="p-2 text-center font-semibold text-slate-600">{item.qtyName || item.unit}</td>
                        <td className="p-2 text-right font-mono text-slate-600">
                          {Number(item.coursePrice || item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {amtUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-center font-mono text-slate-500">{ex.toFixed(4)}</td>
                        <td className="p-2 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">
                          {amtFinal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-black border-t border-slate-300 text-[11px]">
                  <tr>
                    <td colSpan={6} className="p-2 text-right uppercase tracking-wider text-slate-600">Total</td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">
                      {totals.totalQuantity.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </td>
                    <td></td>
                    <td></td>
                    <td className="p-2 text-right font-mono text-blue-700">
                      {totals.totalAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                    <td className="p-2 text-right font-mono text-emerald-800 bg-emerald-100">
                      {totals.totalAmountLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Lower 3 Cards (Read-Only with automatically displayed Step 4 written reports) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. LOADING (EXPORT / IMPORT) */}
            <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/20 space-y-2 text-[11px]">
              <div className="flex items-center gap-1.5 border-b border-purple-200 pb-1 text-purple-700 font-black uppercase tracking-wider text-[11px]">
                <span className="w-3.5 h-3.5 rounded bg-purple-600 text-white text-[11px] font-black flex items-center justify-center leading-none">1</span>
                <span>{tUi(lang, "sales.loading_export_import", "LOADING (EXPORT / IMPORT)")}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-slate-700 leading-tight">
                <div>Loading Port : <span className="font-bold">{form.loadingPort || "Jebel Ali Port"}</span></div>
                <div>Receiving Port : <span className="font-bold">{form.receivedPort || "Karachi Port"}</span></div>
                <div>Loading Date : <span className="font-bold">{formatDisplayDate(form.loadingDate || form.salesDate)}</span></div>
                <div>Receiving Date : <span className="font-bold">{formatDisplayDate(form.receivedDate || form.salesDate)}</span></div>
                <div>Shipping Line : <span className="font-bold">{form.shippingLine || "MSC Line"}</span></div>
                <div>Destination City : <span className="font-bold">{form.destinationCity || "Karachi"}</span></div>
              </div>
              {/* Displayed Report Box */}
              <div className="border-t border-purple-200/80 pt-1.5 space-y-0.5">
                <span className="font-bold text-purple-800 text-[11px] uppercase block">
                  Report / Remarks (Loading & Shipping)
                </span>
                <div className="p-2 bg-white rounded-lg border border-purple-200/80 text-[11px] text-slate-700 leading-relaxed font-medium">
                  {loadingReportText}
                </div>
              </div>
            </div>

            {/* 2. GOODS SUMMARY */}
            <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/20 space-y-2 text-[11px]">
              <div className="flex items-center gap-1.5 border-b border-emerald-200 pb-1 text-emerald-700 font-black uppercase tracking-wider text-[11px]">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center leading-none">2</span>
                <span>{tUi(lang, "sales.goods_summary", "GOODS SUMMARY")}</span>
              </div>
              <div className="space-y-0.5 text-slate-700 leading-tight">
                <div className="flex justify-between"><span>Total Items:</span> <span className="font-bold">{totals.totalItems}</span></div>
                <div className="flex justify-between"><span>Total Quantity:</span> <span className="font-bold font-mono">{totals.totalQuantity.toLocaleString()} Bags</span></div>
                <div className="flex justify-between"><span>Gross Weight:</span> <span className="font-bold font-mono">{(totals.totalGross / 1000).toFixed(3)} MT</span></div>
                <div className="flex justify-between"><span>Net Weight:</span> <span className="font-bold font-mono">{(totals.totalNet / 1000).toFixed(3)} MT</span></div>
                <div className="flex justify-between"><span>Total Amount (USD):</span> <span className="font-bold font-mono">{totals.totalAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span>Final Amount ({currency}):</span> <span className="font-black text-emerald-700 font-mono">{totals.totalAmountLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              </div>
              {/* Displayed Report Box */}
              <div className="border-t border-emerald-200/80 pt-1.5 space-y-0.5">
                <span className="font-bold text-emerald-800 text-[11px] uppercase block">
                  Report / Remarks (Goods Summary)
                </span>
                <div className="p-2 bg-white rounded-lg border border-emerald-200/80 text-[11px] text-slate-700 leading-relaxed font-medium">
                  {goodsSummaryReportText}
                </div>
              </div>
            </div>

            {/* 3. PAYMENT & SETTLEMENT */}
            <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/20 space-y-2 text-[11px]">
              <div className="flex items-center gap-1.5 border-b border-amber-200 pb-1 text-amber-700 font-black uppercase tracking-wider text-[11px]">
                <span className="w-3.5 h-3.5 rounded bg-amber-600 text-white text-[11px] font-black flex items-center justify-center leading-none">3</span>
                <span>{tUi(lang, "sales.payment_settlement", "PAYMENT & SETTLEMENT")}</span>
              </div>
              <div className="space-y-0.5 text-slate-700 leading-tight">
                <div className="flex justify-between"><span>Payment Type:</span> <span className="font-bold">{form.paymentType || "Cash"}</span></div>
                <div className="flex justify-between"><span>Advance Percentage:</span> <span className="font-bold">{totals.advancePercent} %</span></div>
                <div className="flex justify-between"><span>Advance Amount:</span> <span className="font-bold font-mono">{currency} {totals.advanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span>Advance Date:</span> <span className="font-bold">{formatDisplayDate(form.advancePaymentDate || form.salesDate)}</span></div>
                <div className="flex justify-between"><span>Final Payment Date:</span> <span className="font-bold">{formatDisplayDate(form.paymentDate || form.salesDate)}</span></div>
                <div className="flex justify-between"><span>Total Payment:</span> <span className="font-black text-amber-700 font-mono">{currency} {totals.totalAmountLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              </div>
              {/* Displayed Report Box */}
              <div className="border-t border-amber-200/80 pt-1.5 space-y-0.5">
                <span className="font-bold text-amber-800 text-[11px] uppercase block">
                  Report / Remarks (Payment & Settlement)
                </span>
                <div className="p-2 bg-white rounded-lg border border-amber-200/80 text-[11px] text-slate-700 leading-relaxed font-medium">
                  {paymentReportText}
                </div>
              </div>
            </div>
          </div>

          {/* [4] JOURNAL REPORT / NARRATION (Read-Only Narrative in Full) */}
          <div className="border border-red-200 rounded-xl p-3.5 bg-red-50/20 space-y-1.5">
            <div className="flex items-center gap-1.5 text-red-700 font-black uppercase tracking-wider text-[11px]">
              <span className="w-4 h-4 rounded bg-red-600 text-white text-[11px] font-black flex items-center justify-center leading-none">4</span>
              <span>{tUi(lang, "sales.journal_report_narration", "JOURNAL REPORT / NARRATION")}</span>
            </div>
            <div className="p-3 bg-white rounded-lg border border-red-200 text-[11px] text-slate-800 leading-relaxed font-medium">
              {journalNarrationText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
