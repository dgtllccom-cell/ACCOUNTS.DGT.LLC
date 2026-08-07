"use client";

import React from "react";
import type { GoodsRow } from "./full-purchase-booking-report";
import { Th } from "@/components/ui/translated-th";

export interface CompactPurchaseBookingOrderProps {
  goods?: GoodsRow[];
}

export function CompactPurchaseBookingOrder({ goods = [] }: CompactPurchaseBookingOrderProps) {
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="a4-sheet mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-900 px-6 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Digital Dock ERP</div>
              <h2 className="text-lg font-black uppercase tracking-wider">Purchase Booking Order</h2>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-white/60">Order No.</div>
              <div className="text-base font-bold">PB-2026-6789</div>
              <div className="text-[10.5px] text-white/70">2026-07-23</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 border-b border-slate-200 md:grid-cols-2">
          <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
            <div className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Purchase A/C (DR)</div>
            <div className="mt-1 text-[13px] font-bold">FAREDULLAH TRADING LLC</div>
            <div className="text-[11px] text-slate-500">ARE-DET-AC-0003 · AL.RAS · AED</div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Sales A/C (CR)</div>
            <div className="mt-1 text-[13px] font-bold">HIGH END TRADING LLC</div>
            <div className="text-[11px] text-slate-500">UAE-DET-AC-0003 · AL.RAS · AED</div>
          </div>
        </div>

        <div className="p-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="bg-slate-900 text-[10px] uppercase tracking-widest text-white">
                  {["#", "Item", "Spec", "Qty", "Price", "Net Amount"].map((h) => (
                    <Th key={h} className="whitespace-nowrap px-2.5 py-2 text-left font-semibold">{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {goods.map((g) => (
                  <tr key={g.sr} className="border-b border-slate-100 last:border-0 odd:bg-white even:bg-slate-50/40">
                    <td className="px-2.5 py-1.5 text-slate-400">{g.sr}</td>
                    <td className="px-2.5 py-1.5 font-semibold">{g.name}</td>
                    <td className="px-2.5 py-1.5 text-slate-500">{g.spec}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{g.qty} {g.unit}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{g.price}</td>
                    <td className="px-2.5 py-1.5 tabular-nums font-bold text-emerald-700">{g.na}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 text-[11.5px] font-bold">
                  <td className="px-2.5 py-2" colSpan={3}>TOTAL</td>
                  <td className="px-2.5 py-2 tabular-nums">2,500.00 KG</td>
                  <td className="px-2.5 py-2">AED</td>
                  <td className="px-2.5 py-2 tabular-nums text-emerald-700">75,500.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-[11.5px]">
          <div>
            <span className="text-slate-500">Payment Mode:</span> <span className="font-semibold">Bank / Advance 30%</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500">Delivery:</span> <span className="font-semibold">Sea Freight (Jebel Ali → Karachi)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompactPurchaseBookingOrder;
