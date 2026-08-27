import React from "react";
import { CurrencyService } from "@/lib/services/currency-service";
import { Th } from "@/components/ui/translated-th";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

/**
 * Standardized Purchase Booking Report (Requirement 8)
 * Ensures consistent reporting logic across the ERP for purchase bookings.
 */

type PurchaseOrderReportData = {
  // Purchase Information
  purchaseNumber: string;
  purchaseDate: string;
  supplierName: string;
  buyerName: string;
  countryName: string;
  branchName: string;

  // Financial Information
  purchaseCurrency: string;
  purchaseAmount: number;
  exchangeRate: number;
  localCurrency: string;

  // Goods Information
  items: Array<{
    itemName: string;
    hsCode: string;
    origin: string;
    brand: string;
    size: string;
    quantity: number;
    unitPrice: number;
    amountOriginal: number;
  }>;

  // Loading & Shipment
  loadingDetails?: string;
  shipmentDetails?: string;
  containerDetails?: string;

  // Payment Information
  advancePayment: number;
  remainingPayment: number;
  paymentStatus: string;

  // Notes & Remarks
  userNotes?: string;
  internalNotes?: string;
  finalRemarks?: string;
};

export function PurchaseBookingReport({ data, lang = "en" }: { data: PurchaseOrderReportData; lang?: SupportedLanguage }) {
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  // Business Rule Calculation
  const finalLocalAmount = CurrencyService.calculateFinalLocalAmount(data.purchaseAmount, data.exchangeRate);

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white border border-slate-200 shadow-md rounded-lg text-slate-800 font-sans" dir={isRtl ? "rtl" : "ltr"}>
      <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
        <h1 className="text-3xl font-black uppercase tracking-wider">{tt("pbr.title", "Purchase Booking Report")}</h1>
      </div>

      {/* 1. Purchase Information */}
      <section className="mb-8">
        <h2 className="text-lg font-bold bg-slate-100 p-2 mb-3 border-l-4 border-slate-800">{tt("pbr.sec1", "1. Purchase Information")}</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-semibold text-slate-500">{tt("pbr.purchase_no", "Purchase No:")}</span> {data.purchaseNumber}</div>
          <div><span className="font-semibold text-slate-500">{tt("common.date", "Date")}:</span> {data.purchaseDate}</div>
          <div><span className="font-semibold text-slate-500">{tt("common.supplier", "Supplier")}:</span> {data.supplierName}</div>
          <div><span className="font-semibold text-slate-500">{tt("pbr.buyer", "Buyer:")}</span> {data.buyerName}</div>
          <div><span className="font-semibold text-slate-500">{tt("common.country", "Country")}:</span> {data.countryName}</div>
          <div><span className="font-semibold text-slate-500">{tt("common.branch", "Branch")}:</span> {data.branchName}</div>
        </div>
      </section>

      {/* 2. Financial Information */}
      <section className="mb-8">
        <h2 className="text-lg font-bold bg-slate-100 p-2 mb-3 border-l-4 border-indigo-600">{tt("pbr.sec2", "2. Financial Information")}</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-semibold text-slate-500">{tt("pbr.orig_currency", "Original Currency:")}</span> {data.purchaseCurrency}</div>
          <div><span className="font-semibold text-slate-500">{tt("pbr.orig_amount", "Original Amount:")}</span> {data.purchaseAmount.toLocaleString()}</div>
          <div><span className="font-semibold text-slate-500">{tt("pbr.exchange_rate", "Exchange Rate:")}</span> {data.exchangeRate}</div>
          <div><span className="font-semibold text-slate-500">{tt("pbr.final_local_currency", "Final Local Currency:")}</span> {data.localCurrency}</div>
          <div className="col-span-2 text-right bg-indigo-50 p-2 rounded">
            <span className="font-bold text-indigo-800 text-lg">{tt("pbr.final_amount", "Final Amount:")} {data.localCurrency} {finalLocalAmount.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* 3. Goods Information */}
      <section className="mb-8">
        <h2 className="text-lg font-bold bg-slate-100 p-2 mb-3 border-l-4 border-slate-800">{tt("pbr.sec3", "3. Goods Information")}</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white text-left">
              <Th className="p-2 border border-slate-700">Item</Th>
              <Th className="p-2 border border-slate-700">HS Code</Th>
              <Th className="p-2 border border-slate-700">Origin</Th>
              <Th className="p-2 border border-slate-700">Brand / Size</Th>
              <Th className="p-2 border border-slate-700 text-right">Qty</Th>
              <Th className="p-2 border border-slate-700 text-right">Price ({data.purchaseCurrency})</Th>
              <Th className="p-2 border border-slate-700 text-right">Amount ({data.purchaseCurrency})</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200">
                <td className="p-2 border-l border-slate-200">{item.itemName}</td>
                <td className="p-2">{item.hsCode}</td>
                <td className="p-2">{item.origin}</td>
                <td className="p-2">{item.brand} / {item.size}</td>
                <td className="p-2 text-right">{item.quantity}</td>
                <td className="p-2 text-right">{item.unitPrice.toLocaleString()}</td>
                <td className="p-2 border-r border-slate-200 text-right">{item.amountOriginal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 4. Loading & Shipment */}
      <section className="mb-8">
        <h2 className="text-lg font-bold bg-slate-100 p-2 mb-3 border-l-4 border-slate-800">{tt("pbr.sec4", "4. Loading & Shipment")}</h2>
        <div className="grid grid-cols-1 gap-2 text-sm">
          <div><span className="font-semibold text-slate-500">{tt("pbr.loading_lbl", "Loading:")}</span> {data.loadingDetails || tt("pbr.na", "N/A")}</div>
          <div><span className="font-semibold text-slate-500">{tt("pbr.shipment_lbl", "Shipment:")}</span> {data.shipmentDetails || tt("pbr.na", "N/A")}</div>
          <div><span className="font-semibold text-slate-500">{tt("pbr.container_lbl", "Container:")}</span> {data.containerDetails || tt("pbr.na", "N/A")}</div>
        </div>
      </section>

      {/* 5. Payment Information */}
      <section className="mb-8">
        <h2 className="text-lg font-bold bg-slate-100 p-2 mb-3 border-l-4 border-emerald-600">{tt("pbr.sec5", "5. Payment Information")}</h2>
        <div className="grid grid-cols-3 gap-4 text-sm text-center">
          <div className="p-3 border border-emerald-200 bg-emerald-50 rounded">
            <div className="font-semibold text-emerald-800">{tt("pbr.advance_paid", "Advance Paid")}</div>
            <div className="text-lg font-bold text-emerald-700">{data.advancePayment.toLocaleString()} {data.purchaseCurrency}</div>
          </div>
          <div className="p-3 border border-amber-200 bg-amber-50 rounded">
            <div className="font-semibold text-amber-800">{tt("pbr.remaining_due", "Remaining Due")}</div>
            <div className="text-lg font-bold text-amber-700">{data.remainingPayment.toLocaleString()} {data.purchaseCurrency}</div>
          </div>
          <div className="p-3 border border-slate-200 bg-slate-50 rounded flex flex-col justify-center">
            <div className="font-semibold text-slate-500">{tt("common.status", "Status")}</div>
            <div className="text-md font-bold uppercase tracking-widest">{data.paymentStatus}</div>
          </div>
        </div>
      </section>

      {/* 6. Notes & Remarks */}
      <section className="mb-4">
        <h2 className="text-lg font-bold bg-slate-100 p-2 mb-3 border-l-4 border-slate-800">{tt("pbr.sec6", "6. Notes & Remarks")}</h2>
        <div className="space-y-2 text-sm">
          <div><span className="font-semibold text-slate-500">{tt("pbr.user_notes", "User Notes:")}</span> {data.userNotes || tt("pbr.none", "None")}</div>
          <div><span className="font-semibold text-slate-500">{tt("pbr.internal_notes", "Internal Notes:")}</span> {data.internalNotes || tt("pbr.none", "None")}</div>
          <div><span className="font-semibold text-slate-500">{tt("pbr.final_remarks", "Final Remarks:")}</span> {data.finalRemarks || tt("pbr.none", "None")}</div>
        </div>
      </section>

      <div className="mt-8 text-center text-xs text-slate-400 border-t border-slate-200 pt-4">
        {tt("pbr.footer", "Generated by DGT ERP System")} • {new Date().toLocaleString()}
      </div>
    </div>
  );
}
