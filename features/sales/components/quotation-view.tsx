"use client";

/**
 * QuotationView
 * ---------------------------------------------------------------
 * Pure UI component for a professional Sales/Purchase Quotation.
 * Same design language as PurchaseBookingViewRedesign.
 *
 * Requirements: React 18+, Tailwind CSS, lucide-react
 *
 * Usage:
 *   import { QuotationView } from "@/components/quotation-view";
 *   <QuotationView />              // uses sample data
 *   <QuotationView quotation={...} items={...} />
 */
import { useEffect, useRef, useState } from "react";
import {
  Building2, Calendar, Phone, Mail, MapPin, Printer, FileDown, Eye,
  Pencil, Send, Check, FileText, Hash,
} from "lucide-react";
/* ---------------- types ---------------- */
export type QuotationParty = {
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  trn?: string;
};
export type QuotationMeta = {
  quoteNo: string;
  quoteDate: string;
  validUntil: string;
  currency: string;
  reference?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  salesperson?: string;
  status?: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
};
export type QuotationItem = {
  sr: number;
  code: string;
  description: string;
  spec?: string;
  unit: string;
  qty: number;
  price: number;
  discountPct?: number;
  taxPct?: number;
};
export interface QuotationViewProps {
  company?: QuotationParty;
  customer?: QuotationParty;
  meta?: QuotationMeta;
  items?: QuotationItem[];
  notes?: string;
  termsAndConditions?: string[];
  logoUrl?: string;
  chrome?: boolean;
}
/* ---------------- default seed data ---------------- */
const DEFAULT_COMPANY: QuotationParty = {
  name: "DIGITAL DOCK TRADING LLC",
  code: "DGT-LLC",
  address: "Warehouse 12, Al Ras Industrial Area, Dubai, UAE",
  phone: "+971 4 123 4567",
  email: "sales@digitaldock.ae",
  trn: "100234567890003",
};
const DEFAULT_CUSTOMER: QuotationParty = {
  name: "FAREDULLAH TRADING LLC",
  code: "ARE-DET-AC-0003",
  address: "Shop 42, Deira, Dubai, UAE",
  phone: "+971 50 987 6543",
  email: "accounts@faredullah.ae",
  trn: "100987654320003",
};
const DEFAULT_META: QuotationMeta = {
  quoteNo: "QT-2026-0142",
  quoteDate: "2026-07-26",
  validUntil: "2026-08-25",
  currency: "AED",
  reference: "Inquiry #INQ-8891",

  paymentTerms: "30% Advance, 70% on Delivery",
  deliveryTerms: "FOB Jebel Ali — 15 working days",
  salesperson: "Ahmed Khan",
  status: "SENT",
};
const DEFAULT_ITEMS: QuotationItem[] = [
  { sr: 1, code: "RCE-BSM-25", description: "Basmati Rice — Premium", spec: "1121 Sella, 25 kg bag", unit: "Bag", qty: 400, price: 95.00, discountPct: 2, taxPct: 5 },
  { sr: 2, code: "OIL-SUN-05", description: "Sunflower Oil", spec: "Refined, 5 L jerry", unit: "Jerry", qty: 200, price: 42.50, discountPct: 0, taxPct: 5 },
  { sr: 3, code: "SGR-WHT-50", description: "White Sugar ICUMSA 45", spec: "Brazilian origin, 50 kg", unit: "Bag", qty: 300, price: 110.00, discountPct: 1.5, taxPct: 5 },
  { sr: 4, code: "TEA-BLK-01", description: "Black Tea Leaves", spec: "Ceylon, loose, 1 kg pack", unit: "Pack", qty: 500, price: 28.00, discountPct: 0, taxPct: 5 },
];
const DEFAULT_TERMS = [
  "Prices are quoted in AED and exclusive of VAT unless stated otherwise.",
  "This quotation is valid until the date mentioned above.",
  "Delivery time starts from the date of confirmed order and advance payment.",
  "Any changes in specification, quantity, or delivery location may affect pricing.",
  "Goods once dispatched are non-returnable unless found defective.",
  "Disputes shall be subject to the jurisdiction of Dubai Courts, UAE.",
];
/* ---------------- helpers ---------------- */
const fmt = (n: number, ccy: string) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: ccy, minimumFractionDigits: 2 }).format(n);
const calcLine = (it: QuotationItem) => {
  const gross = it.qty * it.price;
  const disc = gross * ((it.discountPct ?? 0) / 100);
  const net = gross - disc;
  const tax = net * ((it.taxPct ?? 0) / 100);
  return { gross, disc, net, tax, total: net + tax };
};
/* ---------------- component ---------------- */
export function QuotationView({
  company = DEFAULT_COMPANY,
  customer = DEFAULT_CUSTOMER,
  meta = DEFAULT_META,
  items = DEFAULT_ITEMS,
  notes = "Thank you for the opportunity. We look forward to your confirmed order.",
  termsAndConditions = DEFAULT_TERMS,
  chrome = true,
}: QuotationViewProps) {
  const [view, setView] = useState<"form" | "print">("form");
  const printRef = useRef<HTMLDivElement>(null);
  const totals = items.reduce(
    (acc, it) => {
      const l = calcLine(it);
      acc.gross += l.gross; acc.disc += l.disc; acc.net += l.net; acc.tax += l.tax; acc.total += l.total;
      return acc;
    },
    { gross: 0, disc: 0, net: 0, tax: 0, total: 0 },
  );
  const handlePrint = () => {
    setView("print");
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => window.print(), 80)));
  };
  useEffect(() => {
    const after = () => setView("form");
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);
  const statusColor: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
    SENT: "bg-blue-50 text-blue-700 ring-blue-200",
    ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
    EXPIRED: "bg-amber-50 text-amber-700 ring-amber-200",
  };
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute; inset: 0; margin: 0; }
          .no-print { display: none !important; }
          section, table, .avoid-break { break-inside: avoid; }
          thead { display: table-header-group; }
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
        .a4-sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; }

        @media (max-width: 820px) { .a4-sheet { width: 100%; min-height: auto; } }
      `}</style>
      {chrome && (
        <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-sm">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">Sales Quotation</div>
                <div className="text-xs text-slate-500">#{meta.quoteNo}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:flex">
                <button onClick={() => setView("form")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === "form" ? "bg-white shadow-sm" : "text-slate-600"}`}>
                  <Pencil className="mr-1 inline h-3.5 w-3.5" /> Form
                </button>
                <button onClick={() => setView("print")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === "print" ? "bg-white shadow-sm" : "text-slate-600"}`}>
                  <Eye className="mr-1 inline h-3.5 w-3.5" /> Preview
                </button>
              </div>
              <button onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
              <button onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
                <FileDown className="h-3.5 w-3.5" /> PDF
              </button>
              <button className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
                <Send className="h-3.5 w-3.5" /> Send to Customer
              </button>
            </div>
          </div>
        </header>
      )}
      <main className="mx-auto max-w-7xl px-2 py-6 sm:px-4">
        <div ref={printRef} className="print-area a4-sheet rounded-xl border border-slate-200 shadow-sm">
          {/* Sheet header */}
          <div className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-lg font-bold tracking-tight">{company.name}</div>
                  <div className="text-xs text-slate-500">{company.code}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-600">
                {company.address && <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {company.address}</div>}
                {company.phone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {company.phone}</div>}
                {company.email && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {company.email}</div>}
                {company.trn && <div className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> TRN: {company.trn}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Quotation</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{meta.quoteNo}</div>
              {meta.status && (
                <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusColor[meta.status]}`}>
                  <Check className="h-3 w-3" /> {meta.status}
                </span>
              )}
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-slate-500">Date</div><div className="font-medium text-right">{meta.quoteDate}</div>
                <div className="text-slate-500">Valid Until</div><div className="font-medium text-right">{meta.validUntil}</div>
                <div className="text-slate-500">Currency</div><div className="font-medium text-right">{meta.currency}</div>
                {meta.reference && (<><div className="text-slate-500">Reference</div><div className="font-medium text-right">{meta.reference}</div></>)}
              </div>
            </div>

          </div>
          {/* Bill To / Terms */}
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <section className="avoid-break rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bill To</div>              <div className="text-base font-semibold text-slate-900">{customer.name}</div>
              {customer.code && <div className="text-xs text-slate-500">{customer.code}</div>}
              <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                {customer.address && <div>{customer.address}</div>}
                {customer.phone && <div>{customer.phone}</div>}
                {customer.email && <div>{customer.email}</div>}
                {customer.trn && <div>TRN: {customer.trn}</div>}
              </div>
            </section>
            <section className="avoid-break rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Terms</div>
              <div className="grid grid-cols-[110px_1fr] gap-y-1 text-xs">
                {meta.paymentTerms && (<><div className="text-slate-500">Payment</div><div className="font-medium">{meta.paymentTerms}</div></>)}
                {meta.deliveryTerms && (<><div className="text-slate-500">Delivery</div><div className="font-medium">{meta.deliveryTerms}</div></>)}
                {meta.salesperson && (<><div className="text-slate-500">Salesperson</div><div className="font-medium">{meta.salesperson}</div></>)}
              </div>
            </section>
          </div>
          {/* Items table */}
          <section className="avoid-break px-6">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">#</th>
                    <th className="px-2 py-2 text-left font-medium">Code</th>
                    <th className="px-2 py-2 text-left font-medium">Description</th>
                    <th className="px-2 py-2 text-right font-medium">Qty</th>
                    <th className="px-2 py-2 text-left font-medium">Unit</th>
                    <th className="px-2 py-2 text-right font-medium">Price</th>
                    <th className="px-2 py-2 text-right font-medium">Disc%</th>
                    <th className="px-2 py-2 text-right font-medium">Tax%</th>
                    <th className="px-2 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((it) => {
                    const l = calcLine(it);
                    return (
                      <tr key={it.sr} className="hover:bg-slate-50">
                        <td className="px-2 py-2 text-slate-500">{it.sr}</td>
                        <td className="px-2 py-2 font-mono text-[11px] text-slate-600">{it.code}</td>
                        <td className="px-2 py-2">
                          <div className="font-medium">{it.description}</div>
                          {it.spec && <div className="text-[11px] text-slate-500">{it.spec}</div>}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{it.qty}</td>
                        <td className="px-2 py-2">{it.unit}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{it.price.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-500">{it.discountPct ?? 0}</td>                        <td className="px-2 py-2 text-right tabular-nums text-slate-500">{it.taxPct ?? 0}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{fmt(l.total, meta.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          {/* Totals + notes */}
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
            <section className="avoid-break sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notes</div>
              <p className="text-xs leading-relaxed text-slate-700">{notes}</p>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Terms & Conditions</div>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11px] leading-relaxed text-slate-600">
                {termsAndConditions.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </section>
            <section className="avoid-break rounded-lg border border-slate-200 bg-white p-4">
              <div className="space-y-1.5 text-xs">
                <Row label="Sub Total" value={fmt(totals.gross, meta.currency)} />
                <Row label="Discount" value={`- ${fmt(totals.disc, meta.currency)}`} muted />
                <Row label="Net" value={fmt(totals.net, meta.currency)} />
                <Row label="VAT" value={fmt(totals.tax, meta.currency)} muted />
                <div className="my-2 border-t border-dashed border-slate-300" />
                <div className="flex items-center justify-between rounded-md bg-slate-900 px-3 py-2 text-white">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Grand Total</span>
                  <span className="text-base font-bold tabular-nums">{fmt(totals.total, meta.currency)}</span>
                </div>
              </div>
            </section>

          </div>
          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 border-t border-slate-200 p-6 pt-8 text-xs">
            <div>
              <div className="mb-10 text-slate-500">Prepared By</div>
              <div className="border-t border-slate-400 pt-1 font-medium">{meta.salesperson}</div>
            </div>
            <div className="text-right">
              <div className="mb-10 text-slate-500">Customer Acceptance</div>
              <div className="border-t border-slate-400 pt-1 font-medium">Signature & Stamp</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-500" : "text-slate-700"}>{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
