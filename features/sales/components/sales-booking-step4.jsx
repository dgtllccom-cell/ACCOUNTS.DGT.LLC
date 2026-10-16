"use client";
import React, { useMemo } from "react";
import {
  Package,
  Ship,
  Landmark,
  FileText,
  Save,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Truck,
  CheckCircle2,
  DollarSign
} from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { SalesBookingUpperCards, formatDisplayDate } from "./sales-booking-upper-cards";

export function SalesBookingStep4({
  form,
  setForm,
  goodsEntries = [],
  lang = "en",
  onNext,
  onBack,
  onSaveDraft,
  onPrint,
  onDownloadPdf,
  dbCompanies = [],
  dbAccounts = []
}) {
  const totals = useMemo(() => {
    const totalItems = goodsEntries.length;
    const totalQuantity = goodsEntries.reduce((sum, g) => sum + Number(g.qtyNo || g.quantity || 0), 0);
    const totalGross = goodsEntries.reduce((sum, g) => sum + Number(g.grossWeight || (Number(g.qtyNo || 0) * 1200) || 0), 0);
    const totalNet = goodsEntries.reduce((sum, g) => sum + Number(g.netWeight || (Number(g.qtyNo || 0) * 1100) || 0), 0);
    const totalAmountUsd = goodsEntries.reduce((sum, g) => sum + Number(g.totalAmount || 0), 0);

    const exRate = Number(form.exchangeRate || 1);
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

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Subheader Banner */}
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {tUi(lang, "sales.step4_subtitle", "Please review all details below before saving. You can add reports/remarks in each section.")}
      </div>

      {/* Top 3 Read-Only Upper Reports */}
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

      {/* Middle: GOODS OVERVIEW DETAILS Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            {tUi(lang, "sales.goods_overview_details", "GOODS OVERVIEW DETAILS")}
          </h3>
          <span className="text-[10px] font-bold text-slate-500 font-mono">
            Total Items: {totals.totalItems}
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-2.5 w-8 text-center">#</th>
                <th className="p-2.5">GOODS NAME</th>
                <th className="p-2.5">SIZE</th>
                <th className="p-2.5">BRAND</th>
                <th className="p-2.5">HS CODE</th>
                <th className="p-2.5">ORIGIN COUNTRY</th>
                <th className="p-2.5 text-right">QTY</th>
                <th className="p-2.5 text-center">UNIT</th>
                <th className="p-2.5 text-right">PRICE (USD)</th>
                <th className="p-2.5 text-right">AMOUNT (USD)</th>
                <th className="p-2.5 text-center">EX. RATE</th>
                <th className="p-2.5 text-right font-black text-emerald-700 dark:text-emerald-400">FINAL AMOUNT ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {goodsEntries.map((item, idx) => {
                const ex = Number(item.exchangeRate || totals.exRate || 1);
                const amtUsd = Number(item.totalAmount || (Number(item.qtyNo || 0) * Number(item.coursePrice || 0)));
                const amtFinal = Number(item.finalAmount || (amtUsd * ex));
                return (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-2.5 text-center font-mono text-[10px] text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{item.goodsName || item.productName}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{item.size || "Standard"}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{item.brand || "Al Baraka"}</td>
                    <td className="p-2.5 font-mono text-slate-500">{item.hsCode}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{item.origin || form.loadingCountry || "United Arab Emirates"}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {Number(item.qtyNo || item.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </td>
                    <td className="p-2.5 text-center font-semibold text-slate-600 dark:text-slate-400">{item.qtyName || item.unit}</td>
                    <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                      {Number(item.coursePrice || item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {amtUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-center font-mono text-slate-500">{ex.toFixed(4)}</td>
                    <td className="p-2.5 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20">
                      {amtFinal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
              {goodsEntries.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-slate-400 text-xs italic">
                    No items in overview table.
                  </td>
                </tr>
              )}
            </tbody>
            {goodsEntries.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-950 font-black border-t-2 border-slate-200 dark:border-slate-800">
                <tr>
                  <td colSpan={6} className="p-2.5 text-right text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Total
                  </td>
                  <td className="p-2.5 text-right font-mono text-xs text-slate-900 dark:text-slate-100">
                    {totals.totalQuantity.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </td>
                  <td></td>
                  <td></td>
                  <td className="p-2.5 text-right font-mono text-xs text-blue-700 dark:text-blue-400">
                    {totals.totalAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td></td>
                  <td className="p-2.5 text-right font-mono text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30">
                    {totals.totalAmountLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Lower Row: 3 Lower Reports with independent Remarks/Report fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. LOADING (EXPORT / IMPORT) */}
        <div className="bg-white dark:bg-slate-900 border border-purple-200/80 dark:border-purple-900/60 rounded-xl p-3 shadow-xs space-y-2.5 text-[10px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-purple-100 dark:border-purple-900/40 pb-1.5 text-purple-700 dark:text-purple-400 font-black uppercase tracking-wider">
              <span className="w-4 h-4 rounded bg-purple-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">1</span>
              <span>{tUi(lang, "sales.loading_export_import", "LOADING (EXPORT / IMPORT)")}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300 leading-tight">
              {/* Left Column: Loading */}
              <div className="space-y-1">
                <div><span className="text-slate-400 font-medium">Loading Port: </span><span className="font-bold">{form.loadingPort || "Jebel Ali Port"}</span></div>
                <div><span className="text-slate-400 font-medium">Loading Date: </span><span className="font-bold">{formatDisplayDate(form.loadingDate || form.salesDate)}</span></div>
                <div><span className="text-slate-400 font-medium">Shipping Line: </span><span className="font-bold">{form.shippingLine || "MSC Line"}</span></div>
                <div><span className="text-slate-400 font-medium">Vessel Name: </span><span className="font-bold">{form.vesselName || "MSC Evergreen"}</span></div>
                <div><span className="text-slate-400 font-medium">Voyage No.: </span><span className="font-mono font-bold">{form.voyageNo || "VY1234"}</span></div>
              </div>

              {/* Right Column: Receiving */}
              <div className="space-y-1 border-l border-slate-100 dark:border-slate-800 pl-2">
                <div className="font-black text-[9px] uppercase text-purple-600 mb-0.5">RECEIVING DETAILS</div>
                <div><span className="text-slate-400 font-medium">Receiving Country: </span><span className="font-bold">{form.receivedCountry || "Pakistan"}</span></div>
                <div><span className="text-slate-400 font-medium">Receiving Port: </span><span className="font-bold">{form.receivedPort || "Karachi Port"}</span></div>
                <div><span className="text-slate-400 font-medium">Receiving Date: </span><span className="font-bold">{formatDisplayDate(form.receivedDate || form.salesDate)}</span></div>
                <div><span className="text-slate-400 font-medium">Destination City: </span><span className="font-bold">{form.destinationCity || "Karachi"}</span></div>
              </div>
            </div>
          </div>

          {/* Independent Remarks Field */}
          <div className="space-y-1 pt-2 border-t border-purple-100 dark:border-purple-900/40">
            <label className="block font-black text-[9.5px] uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Remarks / Notes (Loading & Shipping)
            </label>
            <textarea
              rows={3}
              value={form.loadingReport || ""}
              onChange={(e) => setForm((p) => ({ ...p, loadingReport: e.target.value }))}
              placeholder="Type your loading / shipping report here..."
              className="w-full p-2 text-xs bg-purple-50/30 dark:bg-slate-950 border border-purple-200 dark:border-purple-900 rounded-lg outline-none focus:border-purple-500 font-medium resize-none text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* 2. GOODS SUMMARY */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 rounded-xl p-3 shadow-xs space-y-2.5 text-[10px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-emerald-100 dark:border-emerald-900/40 pb-1.5 text-emerald-700 dark:text-emerald-400 font-black uppercase tracking-wider">
              <span className="w-4 h-4 rounded bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">2</span>
              <span>{tUi(lang, "sales.goods_summary", "GOODS SUMMARY")}</span>
            </div>

            <div className="space-y-1 text-slate-700 dark:text-slate-300 leading-tight">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Total Items:</span>
                <span className="font-bold font-mono">: {totals.totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Total Quantity:</span>
                <span className="font-bold font-mono">: {totals.totalQuantity.toLocaleString()} Bags</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Gross Weight:</span>
                <span className="font-bold font-mono">: {(totals.totalGross / 1000).toFixed(3)} MT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Net Weight:</span>
                <span className="font-bold font-mono">: {(totals.totalNet / 1000).toFixed(3)} MT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Total Amount (USD):</span>
                <span className="font-bold font-mono">: {totals.totalAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Exchange Rate:</span>
                <span className="font-bold font-mono">: {totals.exRate.toFixed(4)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1">
                <span className="text-slate-500 font-bold">Final Amount ({currency}):</span>
                <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono">: {totals.totalAmountLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Independent Remarks Field */}
          <div className="space-y-1 pt-2 border-t border-emerald-100 dark:border-emerald-900/40">
            <label className="block font-black text-[9.5px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Remarks / Notes (Goods Summary)
            </label>
            <textarea
              rows={3}
              value={form.orderReportRemarks || ""}
              onChange={(e) => setForm((p) => ({ ...p, orderReportRemarks: e.target.value }))}
              placeholder="Type your goods summary report here..."
              className="w-full p-2 text-xs bg-emerald-50/30 dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900 rounded-lg outline-none focus:border-emerald-500 font-medium resize-none text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* 3. PAYMENT & SETTLEMENT */}
        <div className="bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 rounded-xl p-3 shadow-xs space-y-2.5 text-[10px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-amber-100 dark:border-amber-900/40 pb-1.5 text-amber-700 dark:text-amber-400 font-black uppercase tracking-wider">
              <span className="w-4 h-4 rounded bg-amber-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">3</span>
              <span>{tUi(lang, "sales.payment_settlement", "PAYMENT & SETTLEMENT")}</span>
            </div>

            <div className="space-y-1 text-slate-700 dark:text-slate-300 leading-tight">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Payment Type:</span>
                <span className="font-bold">: {form.paymentType || "Cash"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Advance Percentage:</span>
                <span className="font-bold">: {totals.advancePercent} %</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Advance Amount:</span>
                <span className="font-bold font-mono">: {currency} {totals.advanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Advance Date:</span>
                <span className="font-bold">: {formatDisplayDate(form.advancePaymentDate || form.salesDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Final Payment Date:</span>
                <span className="font-bold">: {formatDisplayDate(form.paymentDate || form.salesDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Final Payment Amount:</span>
                <span className="font-bold font-mono">: {currency} {totals.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1">
                <span className="text-slate-500 font-bold">Total Payment:</span>
                <span className="font-black text-amber-700 dark:text-amber-400 font-mono">: {currency} {totals.totalAmountLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Independent Remarks Field */}
          <div className="space-y-1 pt-2 border-t border-amber-100 dark:border-amber-900/40">
            <label className="block font-black text-[9.5px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Remarks / Notes (Payment & Settlement)
            </label>
            <textarea
              rows={3}
              value={form.paymentReport || ""}
              onChange={(e) => setForm((p) => ({ ...p, paymentReport: e.target.value }))}
              placeholder="Type your payment report here..."
              className="w-full p-2 text-xs bg-amber-50/30 dark:bg-slate-950 border border-amber-200 dark:border-amber-900 rounded-lg outline-none focus:border-amber-500 font-medium resize-none text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Large Journal Report / Narration at the Bottom */}
      <div className="bg-white dark:bg-slate-900 border border-red-200/80 dark:border-red-900/60 rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-black text-xs uppercase tracking-wider">
          <FileText className="w-4 h-4" />
          <span>{tUi(lang, "sales.journal_report_narration", "JOURNAL REPORT / NARRATION")}</span>
        </div>
        <textarea
          rows={3}
          value={form.salesReportRemarks || ""}
          onChange={(e) => setForm((p) => ({ ...p, salesReportRemarks: e.target.value }))}
          placeholder="Type overall journal report / narration here..."
          className="w-full p-3 text-xs bg-red-50/20 dark:bg-slate-950 border border-red-200 dark:border-red-900 rounded-xl outline-none focus:border-red-500 font-medium resize-none text-slate-800 dark:text-slate-200"
        />
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-10 px-5 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          Cancel / Back
        </Button>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            className="h-10 px-4 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-blue-600" />
            Save as Draft
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDownloadPdf}
            className="h-10 px-4 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            Download PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onPrint}
            className="h-10 px-4 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Print Voucher
          </Button>
          <Button
            type="button"
            onClick={onNext}
            className="h-10 px-6 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-xl uppercase tracking-wider flex items-center gap-1.5"
          >
            Next
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}
