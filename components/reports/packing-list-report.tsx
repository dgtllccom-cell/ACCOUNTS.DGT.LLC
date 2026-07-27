"use client";

import React from "react";
import { Package, Printer, Truck, Anchor, ShieldCheck } from "lucide-react";

export interface PackingListReportProps {
  data?: any;
}

export function PackingListReport({ data }: PackingListReportProps) {
  const form = data?.form_data?.form || data?.form || {};
  const goods = data?.form_data?.goodsEntries || data?.goodsEntries || [];
  const poNo = data?.purchase_order_no || form.purchaseOrderNo || "PO-EXP-001";
  const contractNo = data?.purchase_contract_no || form.purchaseContractNo || form.contractNo || "CNT-2026-88";
  const packingListNo = form.packingListNo || form.manualBillNumber || "PKL-2026-001";
  const supplierName = form.salesAccountName || form.supplierName || "DAMAAN GLOBAL TRADING LLC";
  const buyerName = form.customerName || form.buyerName || "DIGITAL DOCK GENERAL TRADING";
  const packingDate = form.purchaseDate || form.bookingDate || new Date().toISOString().split("T")[0];

  const totalQty = goods.reduce((sum: number, g: any) => sum + Number(g.totalQuantity || g.qty || 0), 0);
  const totalGrossWeight = goods.reduce((sum: number, g: any) => sum + Number(g.grossWeight || (Number(g.totalQuantity || 0) * 1.05) || 0), 0);
  const totalNetWeight = goods.reduce((sum: number, g: any) => sum + Number(g.netWeight || g.totalQuantity || 0), 0);

  return (
    <div className="mx-auto max-w-[850px] p-6 bg-slate-100 dark:bg-slate-900 min-h-screen">
      {/* Print Controls */}
      <div className="no-print mb-4 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Official Packing List Document (A4 Print Preview)</span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow"
        >
          <Printer className="h-4 w-4" />
          Print Packing List
        </button>
      </div>

      {/* A4 Sheet */}
      <div className="a4-sheet mx-auto bg-white p-8 shadow-md rounded-xl border border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-slate-800 dark:text-slate-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-7 w-7 text-emerald-600" />
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Packing List</h1>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">Cargo Manifest & Container Weight Specification</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-black text-emerald-600 uppercase">Packing List #: {packingListNo}</div>
            <div className="text-xs text-slate-500">Date: {packingDate}</div>
            <div className="text-xs text-slate-500">PO Ref: {poNo}</div>
            <div className="text-xs text-slate-500">Contract #: {contractNo}</div>
          </div>
        </div>

        {/* Cargo Metadata Grid */}
        <div className="my-6 grid grid-cols-2 gap-6 rounded-lg bg-slate-50 p-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Shipper / Sender:</div>
            <div className="font-bold text-slate-900 dark:text-white mt-0.5">{supplierName}</div>
            <div className="text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
              <Truck className="h-3 w-3 text-slate-400" /> Mode of Transport: {form.shippingMode || "Sea Cargo Container"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Consignee / Receiver:</div>
            <div className="font-bold text-slate-900 dark:text-white mt-0.5">{buyerName}</div>
            <div className="text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
              <Anchor className="h-3 w-3 text-slate-400" /> Vessel / Voyage: {form.vesselName || form.shipName || "Global Carrier"}
            </div>
          </div>
        </div>

        {/* Packing Manifest Table */}
        <div className="overflow-x-auto my-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-y-2 border-slate-900 bg-slate-100 dark:bg-slate-800 dark:border-slate-700">
                <th className="p-3 font-black uppercase text-slate-700 dark:text-slate-200">Package #</th>
                <th className="p-3 font-black uppercase text-slate-700 dark:text-slate-200">Item Description</th>
                <th className="p-3 font-black uppercase text-right text-slate-700 dark:text-slate-200">Total Packages</th>
                <th className="p-3 font-black uppercase text-right text-slate-700 dark:text-slate-200">Net Weight (KG)</th>
                <th className="p-3 font-black uppercase text-right text-slate-700 dark:text-slate-200">Gross Weight (KG)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {goods.length > 0 ? (
                goods.map((g: any, i: number) => {
                  const qty = Number(g.totalQuantity || g.qty || 0);
                  const net = Number(g.netWeight || qty);
                  const gross = Number(g.grossWeight || (net * 1.05));
                  return (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="p-3 font-semibold">PKG-00{i + 1}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{g.goodsName || g.productName || g.description || "Cargo Commodity"}</td>
                      <td className="p-3 text-right font-semibold">{qty.toLocaleString()} {g.unit || "Bags"}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400 italic">No packing entries recorded.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-50 dark:bg-slate-900 font-bold dark:border-slate-700">
                <td colSpan={2} className="p-3 uppercase">Total Cargo Weight Summary:</td>
                <td className="p-3 text-right font-extrabold">{totalQty.toLocaleString()}</td>
                <td className="p-3 text-right font-mono font-black">{totalNetWeight.toLocaleString(undefined, { minimumFractionDigits: 2 })} KG</td>
                <td className="p-3 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400 font-black">{totalGrossWeight.toLocaleString(undefined, { minimumFractionDigits: 2 })} KG</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Signatures */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="h-12 border-b border-dashed border-slate-300 dark:border-slate-700"></div>
            <div className="mt-2 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Warehouse Supervisor Signature</div>
          </div>
          <div>
            <div className="h-12 border-b border-dashed border-slate-300 dark:border-slate-700"></div>
            <div className="mt-2 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Freight Forwarder Stamp</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-[10px] text-slate-400 border-t pt-3 dark:border-slate-800">
          <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-500" /> Verified Cargo Weight Manifest</span>
          <span>Digital Dock ERP System Generated</span>
        </div>

      </div>
    </div>
  );
}

export default PackingListReport;
