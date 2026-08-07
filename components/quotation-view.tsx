"use client";

import { useEffect, useRef, useState } from "react";
import {
import { Th } from "@/components/ui/translated-th";
  Menu, Building2, Calendar, Globe, Languages, Bell, HelpCircle, ChevronDown,
  Save, Check, ArrowRightLeft, Printer, MoreHorizontal, Pencil, Trash2, Upload,
  X, FileText, ShoppingCart, Package, Users, Wallet, BarChart3, Settings, Warehouse,
  Truck, Ship, Eye, Download, FileDown, ClipboardList, Send, Phone, Mail, MapPin
} from "lucide-react";

export type QuotationItem = {
  sr: number;
  code: string;
  name: string;
  spec: string;
  unit: string;
  qty: string;
  price: string;
  discount: string;
  taxRate: string;
  total: string;
};

export type QuotationKV = { k: string; v: string; pill?: boolean; sub?: string };

export interface QuotationViewProps {
  companyName?: string;
  companyAddress?: string;
  companyContact?: string;
  customerDetails?: QuotationKV[];
  quotationMeta?: QuotationKV[];
  items?: QuotationItem[];
  terms?: string[];
  chrome?: boolean;
}

const DEFAULT_CUSTOMER: QuotationKV[] = [
  { k: "Customer Name", v: "AL NOOR TRADING FZE" },
  { k: "Account Code", v: "CUST-UAE-8849" },
  { k: "TRN / Tax ID", v: "100492837400003" },
  { k: "Contact Person", v: "Sheikh Tariq Mansoor" },
  { k: "Phone", v: "+971 4 2234567" },
  { k: "Email", v: "orders@alnoortrading.ae" },
  { k: "Delivery Address", v: "Warehouse 14, Al Quoz Ind. 3, Dubai, UAE" },
];

const DEFAULT_META: QuotationKV[] = [
  { k: "Quotation No.", v: "QT-2026-9042" },
  { k: "Date", v: "2026-07-26" },
  { k: "Valid Until", v: "2026-08-10" },
  { k: "Status", v: "APPROVED", pill: true },
  { k: "Prepared By", v: "ADMIN (Sales Manager)" },
  { k: "Currency", v: "AED" },
  { k: "Payment Terms", v: "30% Advance, 70% on Delivery" },
];

const DEFAULT_ITEMS: QuotationItem[] = [
  { sr: 1, code: "GOOD-0001", name: "Almond Kernel", spec: "California 18-20 Jumbo", unit: "KG", qty: "2,000.00", price: "29.00", discount: "1,000.00", taxRate: "5%", total: "57,000.00" },
  { sr: 2, code: "GOOD-0002", name: "Pistachio", spec: "Iranian Akbari Grade A", unit: "KG", qty: "1,000.00", price: "53.50", discount: "500.00", taxRate: "5%", total: "53,000.00" },
  { sr: 3, code: "GOOD-0003", name: "Walnut", spec: "Chandler In-Shell", unit: "KG", qty: "1,500.00", price: "18.50", discount: "0.00", taxRate: "5%", total: "27,750.00" },
  { sr: 4, code: "GOOD-0004", name: "Cashew Nut", spec: "W240 White Whole", unit: "KG", qty: "500.00", price: "33.00", discount: "0.00", taxRate: "5%", total: "16,500.00" },
];

const DEFAULT_TERMS = [
  "Prices are valid for 15 days from the date of quotation.",
  "Payment terms: 30% advance deposit upon order confirmation and balance prior to dispatch.",
  "Goods once sold per agreed specifications cannot be returned unless damaged during transit.",
  "Subject to Dubai jurisdiction courts."
];

export function QuotationView({
  companyName = "DIGITAL DOCK TRADING LLC",
  companyAddress = "Al Ras Wholesale Market, Deira, P.O. Box 41209, Dubai, UAE",
  companyContact = "Tel: +971 4 2261188 | Email: sales@digitaldock.ae | TRN: 100384729100003",
  customerDetails = DEFAULT_CUSTOMER,
  quotationMeta = DEFAULT_META,
  items = DEFAULT_ITEMS,
  terms = DEFAULT_TERMS,
  chrome = true,
}: QuotationViewProps) {
  const [view, setView] = useState<"form" | "full" | "compact">("full");

  const handlePrint = () => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(() => window.print(), 80))
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-foreground">
      <style>{`
        .a4-sheet {
          width: 210mm;
          min-height: 297mm;
          max-width: 100%;
          margin-inline: auto;
          background: white;
        }
        @media (max-width: 820px) {
          .a4-sheet { width: 100%; min-height: 0; }
        }
        .a4-sheet, .a4-sheet * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { background: white !important; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area {
            position: absolute !important;
            inset: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .no-print { display: none !important; }
          .a4-sheet {
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {chrome && (
        <header className="no-print sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4">
            <button className="rounded-md p-1.5 hover:bg-muted"><Menu className="h-4 w-4" /></button>
            <nav className="hidden items-center gap-1 text-[12px] md:flex">
              <span className="text-muted-foreground">Sales</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">Quotations</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold text-emerald-600">Quotation Preview (A4)</span>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={handlePrint} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-slate-800">
                <Printer className="h-3.5 w-3.5" /> Print / PDF
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="print-area min-w-0 flex-1 px-3 pb-16 pt-4 sm:px-5 lg:px-6">
        <div className="no-print mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Sales Quotation A4 Template</h1>
            <p className="text-[12px] text-muted-foreground">Official business quotation · print-ready & PDF exportable</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-amber-600">
              <Download className="h-4 w-4" /> Download PDF
            </button>
          </div>
        </div>

        <div className="a4-sheet mx-auto overflow-hidden rounded-xl border border-slate-300 bg-white p-6 shadow-md">
          {/* Header section */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700">Digital Dock ERP</div>
              <h1 className="text-2xl font-black uppercase text-slate-900">{companyName}</h1>
              <p className="mt-1 text-[11px] text-slate-500 max-w-md">{companyAddress}</p>
              <p className="text-[10.5px] font-medium text-slate-600">{companyContact}</p>
            </div>
            <div className="text-right">
              <div className="inline-block rounded-lg bg-emerald-50 px-3 py-1 text-right border border-emerald-200">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">Commercial Quotation</div>
                <div className="text-lg font-black text-slate-900">QT-2026-9042</div>
              </div>
              <div className="mt-2 text-[11px] text-slate-600">
                <div><span className="text-slate-400">Date:</span> <span className="font-semibold text-slate-800">2026-07-26</span></div>
                <div><span className="text-slate-400">Valid Until:</span> <span className="font-semibold text-amber-700">2026-08-10</span></div>
              </div>
            </div>
          </div>

          {/* Customer & Quote Metadata */}
          <div className="my-5 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Quotation For (Customer)</div>
              {customerDetails.map((c) => (
                <div key={c.k} className="flex justify-between py-0.5 text-[11.5px]">
                  <span className="text-slate-500">{c.k}:</span>
                  <span className="font-semibold text-slate-800">{c.v}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Quotation Details</div>
              {quotationMeta.map((m) => (
                <div key={m.k} className="flex justify-between py-0.5 text-[11.5px]">
                  <span className="text-slate-500">{m.k}:</span>
                  <span className="font-semibold text-slate-800">{m.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Items Table */}
          <div className="my-5 overflow-hidden rounded-lg border border-slate-300">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                  <Th className="px-3 py-2 text-left">#</Th>
                  <Th className="px-3 py-2 text-left">Item Description</Th>
                  <Th className="px-3 py-2 text-left">Spec</Th>
                  <Th className="px-3 py-2 text-right">Qty</Th>
                  <Th className="px-3 py-2 text-right">Unit Price</Th>
                  <Th className="px-3 py-2 text-right">Disc</Th>
                  <Th className="px-3 py-2 text-right">Total (AED)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.sr} className="odd:bg-white even:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-500">{item.sr}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{item.name} <span className="text-[10px] text-slate-400">({item.code})</span></td>
                    <td className="px-3 py-2 text-slate-600">{item.spec}</td>
                    <td className="px-3 py-2 text-right font-medium">{item.qty} {item.unit}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{item.price}</td>
                    <td className="px-3 py-2 text-right text-rose-600">{item.discount}</td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-800">{item.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={3} className="px-3 py-2 text-left">Subtotal Amount</td>
                  <td className="px-3 py-2 text-right">4,500.00 KG</td>
                  <td colSpan={2}></td>
                  <td className="px-3 py-2 text-right text-emerald-800">154,250.00 AED</td>
                </tr>
                <tr className="bg-emerald-50 text-slate-900 font-black text-[12.5px]">
                  <td colSpan={6} className="px-3 py-2.5 text-right uppercase tracking-wider text-emerald-900">Grand Total (Inclusive of VAT 5%):</td>
                  <td className="px-3 py-2.5 text-right text-emerald-700">161,962.50 AED</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Terms & Bank details */}
          <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-200 text-[11px]">
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Terms & Conditions</div>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                {terms.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Bank Transfer Details</div>
              <div className="text-slate-600 space-y-0.5">
                <div><span className="text-slate-400">Bank:</span> Emirates NBD Bank PJSC</div>
                <div><span className="text-slate-400">Branch:</span> Deira Main Branch, Dubai</div>
                <div><span className="text-slate-400">A/C Title:</span> Digital Dock Trading LLC</div>
                <div><span className="text-slate-400">IBAN:</span> AE49 0260 0000 1023 4567 8901</div>
                <div><span className="text-slate-400">SWIFT:</span> EBILAEAD</div>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-12 flex justify-between text-center text-[11px]">
            <div>
              <div className="w-40 border-b border-slate-400 mb-1" />
              <div className="font-semibold text-slate-700">Prepared By</div>
              <div className="text-slate-400 text-[10px]">Sales Executive</div>
            </div>
            <div>
              <div className="w-40 border-b border-slate-400 mb-1" />
              <div className="font-semibold text-slate-700">Authorized Stamp & Sign</div>
              <div className="text-slate-400 text-[10px]">Digital Dock Trading LLC</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default QuotationView;
