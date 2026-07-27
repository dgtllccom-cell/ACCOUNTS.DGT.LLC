"use client";

import React from "react";
import { FileText, Printer, Building2, MapPin, Globe, ShieldCheck } from "lucide-react";

export interface CommercialInvoiceReportProps {
  data?: any;
}

export function CommercialInvoiceReport({ data }: CommercialInvoiceReportProps) {
  const form = data?.form_data?.form || data?.form || {};
  const goods = data?.form_data?.goodsEntries || data?.goodsEntries || [];
  const poNo = data?.purchase_order_no || form.purchaseOrderNo || "PO-EXP-001";
  const contractNo = data?.purchase_contract_no || form.purchaseContractNo || form.contractNo || "CNT-2026-88";
  const manualBillNo = form.manualBillNumber || form.manual_bill_number || form.billNo || "INV-COMM-2026";
  const supplierName = form.salesAccountName || form.supplierName || "DAMAAN GLOBAL TRADING LLC";
  const buyerName = form.customerName || form.buyerName || "DIGITAL DOCK GENERAL TRADING";
  const invoiceDate = form.purchaseDate || form.bookingDate || new Date().toISOString().split("T")[0];
  const currency = data?.currency_code || form.currency || "USD";
  const exRate = Number(data?.exchange_rate || form.exchangeRate || 1);

  const totalQty = goods.reduce((sum: number, g: any) => sum + Number(g.totalQuantity || g.qty || 0), 0);
  const totalAmount = goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || g.amount || 0), 0);
  const totalAmountLC = totalAmount * exRate;

  return (
    <div className="mx-auto max-w-[850px] p-6 bg-slate-100 dark:bg-slate-900 min-h-screen">
      {/* Print Controls */}
      <div className="no-print mb-4 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Commercial Invoice Document (A4 Print Preview)</span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow"
        >
          <Printer className="h-4 w-4" />
          Print Commercial Invoice
        </button>
      </div>

      {/* A4 Printable Sheet */}
      <div className="a4-sheet mx-auto bg-white p-8 shadow-md rounded-xl border border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-slate-800 dark:text-slate-200">
        
        {/* Header Branding */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-7 w-7 text-blue-600" />
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Commercial Invoice</h1>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">Official Export & International Shipping Document</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-black text-blue-600 uppercase">Invoice #: {manualBillNo}</div>
            <div className="text-xs text-slate-500">Date: {invoiceDate}</div>
            <div className="text-xs text-slate-500">PO Ref: {poNo}</div>
            <div className="text-xs text-slate-500">Contract #: {contractNo}</div>
          </div>
        </div>

        {/* Addresses Grid */}
        <div className="my-6 grid grid-cols-2 gap-6 rounded-lg bg-slate-50 p-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Shipper / Exporter:</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{supplierName}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 text-slate-400" /> {form.loadingPort || "Port of Origin, Dubai UAE"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Consignee / Importer:</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{buyerName}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-1">
              <Globe className="h-3 w-3 text-slate-400" /> {form.receivedPort || form.exitPort || "Port of Destination"}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto my-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-y-2 border-slate-900 bg-slate-100 dark:bg-slate-800 dark:border-slate-700">
                <th className="p-3 font-black uppercase text-slate-700 dark:text-slate-200">SR#</th>
                <th className="p-3 font-black uppercase text-slate-700 dark:text-slate-200">Description of Goods</th>
                <th className="p-3 font-black uppercase text-right text-slate-700 dark:text-slate-200">Quantity</th>
                <th className="p-3 font-black uppercase text-right text-slate-700 dark:text-slate-200">Unit Price ({currency})</th>
                <th className="p-3 font-black uppercase text-right text-slate-700 dark:text-slate-200">Total ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {goods.length > 0 ? (
                goods.map((g: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td className="p-3 font-semibold">{i + 1}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{g.goodsName || g.productName || g.description || "Commodity Item"}</td>
                    <td className="p-3 text-right font-semibold">{Number(g.totalQuantity || g.qty || 0).toLocaleString()} {g.unit || "KG"}</td>
                    <td className="p-3 text-right font-mono font-semibold">{Number(g.priceRateC1 || g.price || 0).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{Number(g.totalAmount || g.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400 italic">No goods line items specified.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-50 dark:bg-slate-900 font-bold dark:border-slate-700">
                <td colSpan={2} className="p-3 uppercase">Total Commercial Value:</td>
                <td className="p-3 text-right font-extrabold">{totalQty.toLocaleString()}</td>
                <td className="p-3"></td>
                <td className="p-3 text-right font-mono text-sm text-blue-600 dark:text-blue-400 font-black">{currency} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Currency & Conversion Box */}
        {exRate > 1 && (
          <div className="my-4 flex items-center justify-between rounded-lg bg-blue-50/50 p-3 text-xs border border-blue-100 dark:bg-slate-900 dark:border-blue-900">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Exchange Rate Conversion ({currency} to Local):</span>
            <span className="font-mono font-bold text-blue-700 dark:text-blue-300">1 {currency} = {exRate} PKR/AED | Local Total: {totalAmountLC.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}

        {/* Signatures & Footer */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="h-12 border-b border-dashed border-slate-300 dark:border-slate-700"></div>
            <div className="mt-2 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Authorized Exporter Signature</div>
          </div>
          <div>
            <div className="h-12 border-b border-dashed border-slate-300 dark:border-slate-700"></div>
            <div className="mt-2 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Customs & Shipping Verification</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-[10px] text-slate-400 border-t pt-3 dark:border-slate-800">
          <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-500" /> Certified Commercial Document</span>
          <span>Digital Dock ERP System Generated</span>
        </div>

      </div>
    </div>
  );
}

export default CommercialInvoiceReport;
