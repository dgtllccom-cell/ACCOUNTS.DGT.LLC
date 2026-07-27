"use client";

import React from "react";
import { FileText, Ship, Anchor } from "lucide-react";

export type KVRow = { k: string; v: string; muted?: boolean; pill?: boolean; sub?: string };
export type GoodsRow = {
  sr: number; code: string; name: string; spec: string; unit: string;
  qty: string; price: string; gw: string; nw: string; ga: string; disc: string; na: string;
};
export type PaymentRow = {
  sr: number; term: string; pct: string; mode: string; bank: string;
  ac: string; ccy: string; amt: string; bal: string; date: string;
};

export interface FullPurchaseBookingReportProps {
  branchDetails?: KVRow[];
  billDetails?: KVRow[];
  purchaseAccount?: KVRow[];
  salesAccount?: KVRow[];
  goods?: GoodsRow[];
  paymentSchedule?: PaymentRow[];
}

function StatusPill({
  children,
  tone = "accepted",
}: {
  children: React.ReactNode;
  tone?: "accepted" | "pending" | "danger" | "info";
}) {
  const tones = {
    accepted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    danger: "bg-rose-50 text-rose-700 ring-rose-200",
    info: "bg-sky-50 text-sky-700 ring-sky-200",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function FullPurchaseBookingReport({
  branchDetails = [],
  billDetails = [],
  purchaseAccount = [],
  salesAccount = [],
  goods = [],
  paymentSchedule = [],
}: FullPurchaseBookingReportProps) {
  const findV = (rows: KVRow[], key: string) =>
    rows.find((r) => r.k.toLowerCase() === key.toLowerCase())?.v ?? "—";
  const bookingNo = findV(billDetails, "System Serial");
  const bookingDate = findV(billDetails, "Booking Date");
  const statusRow = billDetails.find((r) => r.pill);
  const status = statusRow?.v ?? "ACCEPTED";

  return (
    <div className="mx-auto max-w-[900px]">
      <style>{`
        .rpt { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0f172a; }
        .rpt .cell { border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 11px; line-height: 1.35; }
        .rpt .lbl  { background: #f1f5f9; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; font-size: 9.5px; white-space: nowrap; width: 34%; }
        .rpt .val  { font-weight: 600; font-size: 11.5px; color: #0f172a; }
        .rpt .sec  { background: #0f172a; color: #fff; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; padding: 5px 8px; border: 1px solid #0f172a; }
        .rpt table { border-collapse: collapse; width: 100%; }
        .rpt .tbl th { background: #0f172a; color: #fff; font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; padding: 5px 6px; border: 1px solid #0f172a; text-align: left; font-weight: 700; }
        .rpt .tbl td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 11px; }
        .rpt .tbl tr:nth-child(even) td { background: #f8fafc; }
        .rpt .tbl tfoot td { background: #e2e8f0 !important; font-weight: 800; font-size: 11px; }
        .rpt .num { text-align: right; font-variant-numeric: tabular-nums; }
        @media print {
          @page { size: A4; margin: 10mm; }
          .rpt { font-size: 10.5px; }
          .rpt .cell, .rpt .tbl td { padding: 3px 6px; }
        }
      `}</style>
      <div className="a4-sheet rpt mx-auto overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        {/* ---------- HEADER ---------- */}
        <div className="border-b-2 border-slate-900 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded bg-slate-900 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Digital Dock ERP</div>
                <div className="text-[15px] font-black uppercase tracking-wider text-slate-900 leading-tight">Purchase Booking — Complete Report</div>
              </div>
            </div>
            <div className="text-right text-[10.5px] leading-tight">
              <div><span className="text-slate-500">Booking No: </span><span className="font-bold text-slate-900">{bookingNo}</span></div>
              <div><span className="text-slate-500">Date: </span><span className="font-semibold">{bookingDate}</span></div>
              <div className="mt-1"><StatusPill>{status}</StatusPill></div>
            </div>
          </div>
        </div>
        <div className="p-3 space-y-2.5">
          {/* ---------- BRANCH & BILL (side-by-side) ---------- */}
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <div>
              <div className="sec">Branch & User Info</div>
              <table>
                <tbody>
                  {branchDetails.map((r) => (
                    <tr key={r.k}><td className="cell lbl">{r.k}</td><td className="cell val">{r.v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="sec">Bill Details</div>
              <table>
                <tbody>
                  {billDetails.map((r) => (
                    <tr key={r.k}>
                      <td className="cell lbl">{r.k}</td>
                      <td className="cell val">{r.pill ? <StatusPill>{r.v}</StatusPill> : r.v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* ---------- ACCOUNTS ---------- */}
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <div className="avoid-break">
              <div className="sec flex items-center justify-between" style={{ background: "#7f1d1d", borderColor: "#7f1d1d" }}>
                <span>Purchase Account</span><span className="rounded bg-white/15 px-1.5 py-0.5 text-[9.5px]">DR</span>
              </div>
              <table>
                <tbody>
                  {purchaseAccount.map((r) => (
                    <tr key={r.k}><td className="cell lbl">{r.k}</td><td className="cell val">{r.v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="avoid-break">
              <div className="sec flex items-center justify-between" style={{ background: "#065f46", borderColor: "#065f46" }}>
                <span>Sales Account</span><span className="rounded bg-white/15 px-1.5 py-0.5 text-[9.5px]">CR</span>
              </div>
              <table>
                <tbody>
                  {salesAccount.map((r) => (
                    <tr key={r.k}><td className="cell lbl">{r.k}</td><td className="cell val">{r.v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* ---------- GOODS ---------- */}
          <div className="avoid-break">
            <div className="sec">Goods Details</div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 26 }}>#</th>
                    <th>Name</th>
                    <th>Spec</th>
                    <th>Unit</th>
                    <th className="num">Qty</th>
                    <th className="num">Gross</th>
                    <th className="num">Net</th>
                    <th className="num">Price</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {goods.map((g) => (
                    <tr key={g.sr}>
                      <td>{g.sr}</td>
                      <td className="font-semibold">{g.name}</td>
                      <td className="text-slate-500">{g.spec}</td>
                      <td>{g.unit}</td>
                      <td className="num">{g.qty}</td>
                      <td className="num">{g.gw}</td>
                      <td className="num">{g.nw}</td>
                      <td className="num">{g.price}</td>
                      <td className="num font-bold text-emerald-700">{g.na}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>TOTAL</td>
                    <td className="num">2,500.00</td>
                    <td className="num">2,615.00</td>
                    <td className="num">2,500.00</td>
                    <td className="num">AED</td>
                    <td className="num text-emerald-700">75,500.00</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          {/* ---------- LOADING / RECEIVING ---------- */}
          <div className="avoid-break grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <div>
              <div className="sec flex items-center gap-1.5" style={{ background: "#92400e", borderColor: "#92400e" }}>
                <Ship className="h-3 w-3" /> Loading / Departure
              </div>
              <table>
                <tbody>
                  <tr><td className="cell lbl">Mode</td><td className="cell val">By Sea</td></tr>
                  <tr><td className="cell lbl">Country</td><td className="cell val">UAE</td></tr>
                  <tr><td className="cell lbl">Port</td><td className="cell val">Jebel Ali</td></tr>
                  <tr><td className="cell lbl">Date</td><td className="cell val">2026-07-30</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <div className="sec flex items-center gap-1.5" style={{ background: "#065f46", borderColor: "#065f46" }}>
                <Anchor className="h-3 w-3" /> Receiving / Arrival
              </div>
              <table>
                <tbody>
                  <tr><td className="cell lbl">Country</td><td className="cell val">Pakistan</td></tr>
                  <tr><td className="cell lbl">Port</td><td className="cell val">Karachi</td></tr>
                  <tr><td className="cell lbl">Date</td><td className="cell val">2026-08-05</td></tr>
                  <tr><td className="cell lbl">Container</td><td className="cell val">40 FT</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          {/* ---------- PAYMENT TERMS ---------- */}
          <div className="avoid-break">
            <div className="sec">Payment Terms</div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 26 }}>#</th>
                    <th>Term</th>
                    <th className="num">%</th>
                    <th>Mode</th>
                    <th>Bank / ATM</th>
                    <th>A/C</th>
                    <th className="num">Amount</th>
                    <th className="num">Balance</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentSchedule.map((r) => (
                    <tr key={r.sr}>
                      <td>{r.sr}</td>
                      <td className="font-semibold">{r.term}</td>
                      <td className="num font-bold text-sky-700">{r.pct}</td>
                      <td>{r.mode}</td>
                      <td className="text-slate-600">{r.bank}</td>
                      <td className="text-slate-500">{r.ac}</td>
                      <td className="num font-semibold">{r.amt}</td>
                      <td className="num text-amber-700">{r.bal}</td>
                      <td className="text-slate-500">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* ---------- REMARKS + FINANCIAL TOTALS ---------- */}
          <div className="avoid-break grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="sec">Remarks & Narration</div>
              <div className="cell" style={{ minHeight: 92 }}>
                Purchase booking for dry fruits. Advance payment scheduled per terms. Quality as per agreement.
                Delivery CIF Karachi. Variance ±2 % acceptable.
              </div>
            </div>
            <div>
              <div className="sec">Financial Totals</div>
              <table>
                <tbody>
                  <tr><td className="cell lbl">Items</td><td className="cell val num">4</td></tr>
                  <tr><td className="cell lbl">Quantity</td><td className="cell val num">2,500.00 KG</td></tr>
                  <tr><td className="cell lbl">Net Weight</td><td className="cell val num">2,500.00 KG</td></tr>
                  <tr><td className="cell lbl">Invoice</td><td className="cell val num">75,500.00</td></tr>
                  <tr><td className="cell lbl">Paid</td><td className="cell val num text-emerald-700">0.00</td></tr>
                  <tr>
                    <td className="cell lbl" style={{ background: "#0f172a", color: "#fff" }}>Balance (AED)</td>
                    <td className="cell val num" style={{ background: "#fef3c7", color: "#78350f", fontWeight: 800 }}>75,500.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {/* ---------- SIGNATURES ---------- */}
          <div className="avoid-break grid grid-cols-3 gap-4 pt-6 pb-2">
            {["Buyer's Signature", "Seller's Signature", "Authorised Signatory"].map((s) => (
              <div key={s} className="text-center">
                <div className="mx-auto mb-1 h-10 border-b border-slate-500" />
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">{s}</div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-slate-300 pt-1.5 text-[9.5px] text-slate-500">
            <span>Digital Dock ERP · Purchase Booking Complete Report</span>
            <span>Generated: {bookingDate} · {bookingNo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FullPurchaseBookingReport;
