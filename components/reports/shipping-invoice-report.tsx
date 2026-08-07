"use client";

import React from "react";
import { Ship, Printer, MapPin, Globe, Compass, ShieldCheck } from "lucide-react";
import { Th } from "@/components/ui/translated-th";

export interface ShippingInvoiceReportProps {
  data?: any;
}

export function ShippingInvoiceReport({ data }: ShippingInvoiceReportProps) {
  const form = data?.form_data?.form || data?.form || {};
  const goods = data?.form_data?.goodsEntries || data?.goodsEntries || [];
  const poNo = data?.purchase_order_no || form.purchaseOrderNo || "PO-EXP-001";
  const contractNo = data?.purchase_contract_no || form.purchaseContractNo || form.contractNo || "CNT-2026-88";
  const shippingInvNo = form.shippingInvoiceNo || form.manualBillNumber || "SHP-INV-2026";
  const supplierName = form.salesAccountName || form.supplierName || "DAMAAN GLOBAL TRADING LLC";
  const buyerName = form.customerName || form.buyerName || "DIGITAL DOCK GENERAL TRADING";
  const shippingDate = form.purchaseDate || form.bookingDate || new Date().toISOString().split("T")[0];
  const currency = data?.currency_code || form.currency || "USD";

  const totalQty = goods.reduce((sum: number, g: any) => sum + Number(g.totalQuantity || g.qty || 0), 0);
  const totalAmount = goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || g.amount || 0), 0);
  const freightCharges = Number(form.freightCharges || form.shippingCost || 0);
  const grandTotal = totalAmount + freightCharges;

  return (
    <div className="mx-auto max-w-[850px] p-6 bg-slate-100 dark:bg-slate-900 min-h-screen">
      {/* Print Controls */}
      <div className="no-print mb-4 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Ship className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Ocean Shipping & Bill of Lading Document (A4 Print Preview)</span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition shadow"
        >
          <Printer className="h-4 w-4" />
          Print Shipping Invoice
        </button>
      </div>

      {/* A4 Sheet */}
      <div className="a4-sheet mx-auto bg-white p-8 shadow-md rounded-xl border border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-slate-800 dark:text-slate-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <Ship className="h-7 w-7 text-indigo-600" />
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Shipping Invoice</h1>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">Ocean Freight & Container Shipping Statement</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-black text-indigo-600 uppercase">Shipping Inv #: {shippingInvNo}</div>
            <div className="text-xs text-slate-500">Date: {shippingDate}</div>
            <div className="text-xs text-slate-500">PO Ref: {poNo}</div>
            <div className="text-xs text-slate-500">Contract #: {contractNo}</div>
          </div>
        </div>

        {/* Ports & Vessel Metadata */}
        <div className="my-6 grid grid-cols-2 gap-6 rounded-lg bg-slate-50 p-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Loading Port (POL):</div>
            <div className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-indigo-500" /> {form.loadingPort || "Jebel Ali Port, Dubai UAE"}
            </div>
            <div className="text-slate-600 dark:text-slate-400 mt-2">
              <span className="font-semibold">Shipper:</span> {supplierName}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Discharge Port (POD):</div>
            <div className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
              <Globe className="h-3.5 w-3.5 text-indigo-500" /> {form.receivedPort || form.exitPort || "Karachi Port / Port Qasim"}
            </div>
            <div className="text-slate-600 dark:text-slate-400 mt-2">
              <span className="font-semibold">Consignee:</span> {buyerName}
            </div>
          </div>
        </div>

        {/* Container Specs */}
        <div className="my-4 rounded-lg bg-indigo-50/50 p-3 text-xs border border-indigo-100 dark:bg-slate-900 dark:border-indigo-900 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <Compass className="h-4 w-4 text-indigo-600" />
            <span>Container #: {form.containerNo || form.containerNumber || "MSCU-884920-1"}</span>
          </div>
          <div className="text-indigo-700 dark:text-indigo-300 font-semibold">
            Vessel: {form.vesselName || form.shipName || "MSC ALEXANDRA"} | Voyage: {form.voyageNo || "2026-V8"}
          </div>
        </div>

        {/* Shipping Items Table */}
        <div className="overflow-x-auto my-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-y-2 border-slate-900 bg-slate-100 dark:bg-slate-800 dark:border-slate-700">
                <Th className="p-3 font-black uppercase text-slate-700 dark:text-slate-200">SR#</Th>
                <Th className="p-3 font-black uppercase text-slate-700 dark:text-slate-200">Freight Particulars</Th>
                <Th className="p-3 font-black uppercase text-right text-slate-700 dark:text-slate-200">Quantity</Th>
                <Th className="p-3 font-black uppercase text-right text-slate-700 dark:text-slate-200">Amount ({currency})</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {goods.length > 0 ? (
                goods.map((g: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td className="p-3 font-semibold">{i + 1}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{g.goodsName || g.productName || g.description || "Containerized Ocean Freight"}</td>
                    <td className="p-3 text-right font-semibold">{Number(g.totalQuantity || g.qty || 0).toLocaleString()} {g.unit || "KG"}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{Number(g.totalAmount || g.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400 italic">No shipping items recorded.</td>
                </tr>
              )}
              {freightCharges > 0 && (
                <tr className="bg-indigo-50/30 dark:bg-slate-900 font-semibold">
                  <td className="p-3">#</td>
                  <td className="p-3">Ocean Freight & Terminal Handling Charges (THC)</td>
                  <td className="p-3 text-right">-</td>
                  <td className="p-3 text-right font-mono font-bold text-indigo-600">{freightCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-50 dark:bg-slate-900 font-bold dark:border-slate-700">
                <td colSpan={2} className="p-3 uppercase">Total Shipping Charges:</td>
                <td className="p-3 text-right font-extrabold">{totalQty.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-sm text-indigo-600 dark:text-indigo-400 font-black">{currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Signatures */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="h-12 border-b border-dashed border-slate-300 dark:border-slate-700"></div>
            <div className="mt-2 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Shipping Line Master Signature</div>
          </div>
          <div>
            <div className="h-12 border-b border-dashed border-slate-300 dark:border-slate-700"></div>
            <div className="mt-2 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Port Customs Stamp</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-[10px] text-slate-400 border-t pt-3 dark:border-slate-800">
          <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-500" /> Ocean Freight & Shipping Document</span>
          <span>Digital Dock ERP System Generated</span>
        </div>

      </div>
    </div>
  );
}

export default ShippingInvoiceReport;
