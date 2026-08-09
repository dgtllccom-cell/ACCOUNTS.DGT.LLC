"use client";

/**
 * PurchaseBookingViewRedesign
 * ---------------------------------------------------------------
 * Pure UI / layout component for the Purchase Booking module.
 * No business logic, API calls, or state mutations — safe to drop
 * into any React project (Next.js, TanStack Start, Vite, CRA).
 *
 * Requirements:
 *   - React 18+
 *   - Tailwind CSS (v3 or v4)
 *   - lucide-react
 *
 * Usage:
 *   import { PurchaseBookingViewRedesign } from "@/components/purchase-booking-view-redesign";
 *   <PurchaseBookingViewRedesign />
 *
 * Optional props let host apps swap seed data / labels without
 * touching the layout.
 */
import { useEffect, useRef, useState } from "react";
import {
  Menu, Building2, Calendar, Globe, Languages, Bell, HelpCircle, ChevronDown,
  Save, Check, ArrowRightLeft, Printer, MoreHorizontal, Pencil, Trash2, Upload,
  X, FileText, LayoutDashboard, ShoppingCart, Package, Users, Wallet, BarChart3,
  Settings, Warehouse, Truck, Ship, Anchor, Eye, Download, FileDown, ClipboardList,
  Container,
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";
import { Th } from "@/components/ui/translated-th";
/* ---------------- types ---------------- */
export type KVRow = { k: string; v: string; muted?: boolean; pill?: boolean; sub?: string };
export type GoodsRow = {
  sr: number; code: string; name: string; spec: string; unit: string;
  qty: string; price: string; gw: string; nw: string; ga: string; disc: string; na: string;
};
export type PaymentRow = {
  sr: number; term: string; pct: string; mode: string; bank: string;
  ac: string; ccy: string; amt: string; bal: string; date: string;
};
export interface PurchaseBookingViewRedesignProps {
  branchDetails?: KVRow[];
  billDetails?: KVRow[];
  purchaseAccount?: KVRow[];
  salesAccount?: KVRow[];
  goods?: GoodsRow[];
  paymentSchedule?: PaymentRow[];
  /** Hide the app chrome (sidebar/header) when embedding inside an existing shell. */
  chrome?: boolean;
}
/* ---------------- default seed data (demo only) ---------------- */
const DEFAULT_BRANCH: KVRow[] = [
  { k: "Country", v: "United Arab Emirates" },
  { k: "Branch", v: "AL.RAS" },
  { k: "Branch Code", v: "ARE-000-001" },
  { k: "User", v: "ADMIN" },
  { k: "Role", v: "Country Admin" },
];
const DEFAULT_BILL: KVRow[] = [
  { k: "Booking Date", v: "2026-07-23" },
  { k: "Fiscal Year", v: "2025-26" },
  { k: "Booking Branch", v: "AL.RAS" },
  { k: "Status", v: "ACCEPTED", pill: true },
  { k: "System Serial", v: "PB-2026-6789" },
  { k: "Contract No.", v: "PC-2026-6789" },
  { k: "Loading Mode", v: "By Sea" },
];
const DEFAULT_PURCHASE: KVRow[] = [
  { k: "Account Code", v: "ARE-DET-AC-0003", muted: true },
  { k: "Account Name", v: "FAREDULLAH TRADING LLC" },
  { k: "Branch", v: "AL.RAS" },
  { k: "Currency", v: "AED" },
  { k: "Company", v: "DGT LLC" },
];
const DEFAULT_SALES: KVRow[] = [
  { k: "Account Code", v: "UAE-DET-AC-0003", muted: true },
  { k: "Account Name", v: "HIGH END TRADING LLC" },
  { k: "Branch", v: "AL.RAS" },
  { k: "Currency", v: "AED" },
  { k: "Company", v: "DGT LLC" },
];
const DEFAULT_GOODS: GoodsRow[] = [
  { sr: 1, code: "GOOD-0001", name: "Almond Kernel", spec: "California 18-20", unit: "KG", qty: "1,000.00", price: "28.50", gw: "1,050.00", nw: "1,000.00", ga: "28,500.00", disc: "0.00", na: "28,500.00" },
  { sr: 2, code: "GOOD-0002", name: "Pistachio", spec: "Iranian Akbari", unit: "KG", qty: "500.00", price: "52.00",
 gw: "525.00", nw: "500.00", ga: "26,000.00", disc: "500.00", na: "25,500.00" },
  { sr: 3, code: "GOOD-0003", name: "Walnut", spec: "Chandler", unit: "KG", qty: "750.00", price: "18.00", gw: "780.00", nw: "750.00", ga: "13,500.00", disc: "0.00", na: "13,500.00" },
  { sr: 4, code: "GOOD-0004", name: "Cashew Nut", spec: "W240", unit: "KG", qty: "250.00", price: "32.00", gw: "260.00", nw: "250.00", ga: "8,000.00", disc: "0.00", na: "8,000.00" },
];
const DEFAULT_PAYMENTS: PaymentRow[] = [
  { sr: 1, term: "Advance", pct: "30 %", mode: "Bank Transfer", bank: "Emirates NBD — Deira Br.", ac: "1023-4567-89-01", ccy: "AED", amt: "22,650.00", bal: "52,850.00", date: "2026-07-23" },
  { sr: 2, term: "On Loading", pct: "40 %", mode: "ATM / Card", bank: "ADCB ATM — Al Ras", ac: "9911-2288-33-04", ccy: "AED", amt: "30,200.00", bal: "22,650.00", date: "2026-07-30" },
  { sr: 3, term: "On Delivery", pct: "30 %", mode: "Cash", bank: "Cash Counter — HO", ac: "—", ccy: "AED", amt: "22,650.00", bal: "0.00", date: "2026-08-05" },
];
const SIDEBAR = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: ShoppingCart, label: "Purchase", active: true },
  { icon: Package, label: "Sales" },
  { icon: Warehouse, label: "Inventory" },
  { icon: Truck, label: "Logistics" },
  { icon: Users, label: "Customers" },
  { icon: Wallet, label: "Finance" },
  { icon: BarChart3, label: "Reports" },
  { icon: Settings, label: "Settings" },
];
/* ---------------- primitives ---------------- */
function SectionBadge({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[10.5px] font-bold text-primary-foreground">
        {n}
      </span>
      <h3 className="text-[12px] font-semibold tracking-[0.14em] text-foreground">{label}</h3>
    </div>
  );
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
function KV({ k, v, muted, pill, sub }: KVRow) {
  const activeLang = useActiveLanguage();
  const tr = (text: string) => {
    if (!text || text === "-") return text;
    const res = autoTranslate5Languages(text);
    return res[activeLang] || text;
  };
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[11.5px] text-muted-foreground">{tr(k)}</span>
      <div className="min-w-0 text-right">
        {pill ? (
          <StatusPill>{tr(v)}</StatusPill>
        ) : (
          <div className={`truncate text-[12.5px] font-semibold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{tr(v)}</div>
        )}
        {sub ? <div className="text-[10.5px] text-muted-foreground">{tr(sub)}</div> : null}
      </div>
    </div>
  );
}
function InfoCard({
  n, title, rows, accent = "bg-primary", watermark, watermarkTone, footer,
}: {
  n: string; title: string; rows: KVRow[]; accent?: string;
  watermark?: string; watermarkTone?: "dr" | "cr"; footer?: React.ReactNode;
}) {
  const activeLang = useActiveLanguage();
  const tr = (text: string) => {
    if (!text || text === "-") return text;
    const res = autoTranslate5Languages(text);
    return res[activeLang] || text;
  };
  const wmColor = watermarkTone === "dr" ? "text-rose-500/10"
    : watermarkTone === "cr" ? "text-emerald-500/10" : "text-slate-500/10";
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-3.5 shadow-sm">
      {watermark ? (
        <div aria-hidden className={`pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 select-none text-[96px] font-black leading-none tracking-tighter ${wmColor}`}>
          {watermark}
        </div>
      ) : null}
      <div className="relative mb-2.5 flex items-center gap-2.5 border-b border-border/60 pb-2.5">
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${accent} text-[10.5px] font-bold text-primary-foreground`}>{n}</span>
        <h3 className="text-[11.5px] font-semibold tracking-[0.14em] text-foreground">{tr(title)}</h3>
      </div>
      <div className="relative flex-1 divide-y divide-border/50">
        {rows.map((r) => <KV key={r.k} {...r} />)}
      </div>
      {footer ? <div className="relative mt-3 border-t border-border/60 pt-2.5">{footer}</div> : null}
    </div>
  );
}
function AccountPaymentStrip({
  tone, amount, paid, balance, status,
}: { tone: "dr" | "cr"; amount: string; paid: string; balance: string; status: string }) {
  const activeLang = useActiveLanguage();
  const tr = (text: string) => {
    if (!text || text === "-") return text;
    const res = autoTranslate5Languages(text);
    return res[activeLang] || text;
  };
  const colors = tone === "dr"
    ? { chip: "bg-rose-50 text-rose-700 ring-rose-200", bar: "bg-rose-500", balance: "text-rose-700" }
    : { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500", balance: "text-emerald-700" };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground">{tr("Payment Summary")}</span>
        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1 ${colors.chip}`}>{tr(status)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[[tr("Invoice"), amount], [tr("Paid"), paid], [tr("Balance"), balance]].map(([k, v], i) => (
          <div key={i} className="rounded-md bg-slate-50 py-1">
            <div className="text-[8.5px] uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className={`text-[10.5px] font-bold ${i === 2 ? colors.balance : "text-foreground"}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${colors.bar}`} style={{ width: "0%" }} />
      </div>
    </div>
  );
}
function TopButton({
  icon: Icon, children, variant = "ghost", onClick,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  variant?: "ghost" | "primary" | "success" | "dark" | "amber";
  onClick?: () => void;
}) {
  const styles = {
    ghost: "bg-card text-foreground border border-border hover:bg-muted",
    primary: "bg-sky-500 text-white border border-sky-500 hover:bg-sky-600",
    success: "bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600",
    dark: "bg-slate-900 text-white border border-slate-900 hover:bg-slate-800",
    amber: "bg-amber-500 text-white border border-amber-500 hover:bg-amber-600",
  } as const;
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${styles[variant]}`}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}
function Chip({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11.5px] text-foreground hover:bg-muted">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{children}</span>
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  const activeLang = useActiveLanguage();
  const tr = (text: string) => {
    if (!text || text === "-") return text;
    const res = autoTranslate5Languages(text);
    return res[activeLang] || text;
  };
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tr(label)}</span>
      {children}
    </label>
  );
}
const inputCls = "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[12.5px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
/* ---------------- main component ---------------- */
type View = "form" | "full" | "compact";

export function PurchaseBookingViewRedesign({
  branchDetails = DEFAULT_BRANCH,
  billDetails = DEFAULT_BILL,
  purchaseAccount = DEFAULT_PURCHASE,
  salesAccount = DEFAULT_SALES,
  goods = DEFAULT_GOODS,
  paymentSchedule = DEFAULT_PAYMENTS,
  chrome = true,
}: PurchaseBookingViewRedesignProps = {}) {
  const [view, setView] = useState<View>("form");
  const prevViewRef = useRef<View>("form");
  // Restore previous view after the print dialog closes (Print / PDF flow).
  useEffect(() => {
    const onAfter = () => {
      if (prevViewRef.current && prevViewRef.current !== view) {
        setView(prevViewRef.current);
        prevViewRef.current = view;
      }
    };
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, [view]);
  const handlePrint = (which: "full" | "compact") => {
    prevViewRef.current = view;
    setView(which);
    // wait two frames so React commits + layout settles, then print
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(() => window.print(), 80)),
    );
  };
  const shared = { branchDetails, billDetails, purchaseAccount, salesAccount, goods, paymentSchedule };
  const printMode: "" | "print-full" | "print-compact" =
    view === "full" ? "print-full" : view === "compact" ? "print-compact" : "";
  return (
    <div className={`min-h-screen bg-slate-50 text-foreground ${printMode}`}>
      <style>{`
        /* ---------- On-screen A4 preview sizing ---------- */
        .a4-sheet {
          /* A4 = 210mm × 297mm. Keep readable on screen; shrink on small viewports. */
          width: 210mm;
          min-height: 297mm;
          max-width: 100%;
          margin-inline: auto;
          background: white;
        }
        @media (max-width: 820px) {
          .a4-sheet { width: 100%; min-height: 0; }
        }
        /* Force color fidelity for status pills / dark headers / accent bars */
        .a4-sheet,
        .a4-sheet * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        /* ---------- Print rules ---------- */
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area {
            position: absolute !important;
            inset: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .no-print, .no-print * { display: none !important; visibility: hidden !important; }
          .print-area, .print-area * { box-shadow: none !important; }
          .a4-sheet {
            width: 100% !important;
            min-height: 0 !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          /* Sturdy page-break control */
          .avoid-break,
          section, table, thead, tbody, tr, .info-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          thead { display: table-header-group; }

          tfoot { display: table-footer-group; }
          h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
          .page-break-before { break-before: page; page-break-before: always; }
          a[href]::after { content: ""; }
        }
      `}</style>
      {chrome && (
        <header className="no-print sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4">
            <button className="rounded-md p-1.5 hover:bg-muted"><Menu className="h-4 w-4" /></button>
            <nav className="hidden items-center gap-1 text-[12px] md:flex">
              <Chip icon={Building2}>Purchase</Chip>
              <span className="text-muted-foreground">/</span>
              <span className="rounded-md px-2 py-1 text-muted-foreground">Booking</span>
              <span className="text-muted-foreground">/</span>
              <span className="rounded-md px-2 py-1 font-semibold text-sky-600">New Purchase Booking Order</span>
            </nav>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <div className="hidden lg:flex items-center gap-2">
                <Chip icon={Globe}>All Countries</Chip>
                <Chip icon={Calendar}>Jul 14, 2026</Chip>
                <Chip icon={Languages}>English</Chip>
              </div>
              <button className="relative rounded-md p-2 hover:bg-muted">
                <Bell className="h-4 w-4" />
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
              </button>
              <button className="hidden rounded-md p-2 hover:bg-muted sm:block"><HelpCircle className="h-4 w-4" /></button>
              <div className="ml-1 flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">A</div>
                <div className="hidden pr-1 text-right leading-tight sm:block">
                  <div className="text-[12px] font-semibold">ADMIN</div>
                  <div className="text-[10px] text-muted-foreground">Super Admin</div>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}
      <div className="flex">
        {chrome && (
          <aside className="no-print sticky top-14 hidden h-[calc(100vh-3.5rem)] w-52 shrink-0 border-r border-border bg-white xl:block">
            <div className="p-3">
              <div className="px-2 pb-3 pt-1">
                <div className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground">DIGITAL DOCK</div>
                <div className="text-sm font-semibold">ERP Suite</div>
              </div>
              <nav className="space-y-0.5">
                {SIDEBAR.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a key={item.label} href="#"
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] transition-colors ${item.active ? "bg-sky-50 font-semibold text-sky-700" : "text-foreground/80 hover:bg-muted"}`}>
                      <Icon className={`h-4 w-4 ${item.active ? "text-sky-600" : "text-muted-foreground"}`} />
                      {item.label}
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>
        )}
        <main className="print-area min-w-0 flex-1 px-3 pb-16 pt-4 sm:px-5 lg:px-6">
          <div className="no-print mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">New Purchase Booking Order</h1>
              <p className="text-[12px] text-muted-foreground">Standard ERP layout · responsive · print-ready A4 templates</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <TopButton icon={Save}>Save Draft</TopButton>
              <TopButton icon={Check} variant="success">Accept</TopButton>
              <TopButton icon={ArrowRightLeft} variant="primary">Verify</TopButton>
              <TopButton icon={ArrowRightLeft} variant="dark">Register</TopButton>
              <TopButton icon={MoreHorizontal}>More</TopButton>
            </div>
          </div>
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
            <div className="inline-flex rounded-lg bg-muted p-1">
              {([
                { k: "form", label: "Form", icon: ClipboardList },
                { k: "full", label: "Full Report", icon: FileText },
                { k: "compact", label: "Compact Order", icon: FileDown },
              ] as { k: View; label: string; icon: React.ComponentType<{ className?: string }> }[]).map((t) => {
                const Icon = t.icon;
                return (

                  <button key={t.k} onClick={() => setView(t.k)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${view === t.k ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    <Icon className="h-3.5 w-3.5" />{t.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <TopButton icon={Eye} onClick={() => setView("full")}>Preview Full</TopButton>
              <TopButton icon={Eye} onClick={() => setView("compact")}>Preview Compact</TopButton>
              <TopButton icon={Printer} variant="dark" onClick={() => handlePrint("full")}>Print Full</TopButton>
              <TopButton icon={Printer} variant="dark" onClick={() => handlePrint("compact")}>Print Compact</TopButton>
              <TopButton icon={Download} variant="amber" onClick={() => handlePrint("full")}>PDF</TopButton>
            </div>
          </div>
          {view === "form" && <FormView {...shared} />}
          {view === "full" && <FullReport {...shared} />}
          {view === "compact" && <CompactOrder goods={goods} />}
          <footer className="no-print mt-6 text-center text-[11px] text-muted-foreground">
            © 2026 <span className="font-semibold text-foreground">Digital Dock ERP</span> — All Rights Reserved.
          </footer>
        </main>
      </div>
    </div>
  );
}
export default PurchaseBookingViewRedesign;
/* ================================================================
   FORM VIEW
   ================================================================ */
function FormView({
  branchDetails, billDetails, purchaseAccount, salesAccount, goods, paymentSchedule,
}: Required<Omit<PurchaseBookingViewRedesignProps, "chrome">>) {
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard n="01" title="BRANCH DETAILS" rows={branchDetails} />
        <InfoCard n="02" title="BILL DETAILS" rows={billDetails} accent="bg-sky-500" />
        <InfoCard n="03" title="PURCHASE ACCOUNT (DR)" rows={purchaseAccount} accent="bg-rose-500"
          watermark="DR" watermarkTone="dr"
          footer={<AccountPaymentStrip tone="dr" amount="75,500" paid="0" balance="75,500" status="PENDING" />} />
        <InfoCard n="04" title="SALES ACCOUNT (CR)" rows={salesAccount} accent="bg-emerald-500"
          watermark="CR" watermarkTone="cr"
          footer={<AccountPaymentStrip tone="cr" amount="75,500" paid="0" balance="75,500" status="PENDING" />} />
      </section>
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[10.5px] font-bold text-white">S</span>
            <h3 className="text-[12px] font-semibold tracking-[0.14em]">SHIPPING & LOCATION</h3>
          </div>
          <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Ship className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-[10.5px] font-bold uppercase tracking-widest text-amber-800">Loading / Departure</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Shipping Mode"><select className={inputCls} defaultValue="Sea"><option>By Sea</option><option>By Air</option><option>By Road</option></select></Field>
              <Field label="Loading Country"><select className={inputCls} defaultValue="UAE"><option>UAE</option><option>KSA</option></select></Field>
              <Field label="Loading Port"><select className={inputCls} defaultValue="Jebel Ali"><option>Jebel Ali</option><option>Port Rashid</option></select></Field>
              <Field label="Loading Date"><input type="date" className={inputCls} defaultValue="2026-07-30" /></Field>
            </div>
          </div>
          <div className="mt-3 rounded-lg border-l-4 border-emerald-500 bg-emerald-50/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Anchor className="h-3.5 w-3.5 text-emerald-700" />
              <span className="text-[10.5px] font-bold uppercase tracking-widest text-emerald-800">Receiving / Arrival</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Field label="Receiving Country"><select className={inputCls} defaultValue="PK"><option>Pakistan</option><option>India</option></select></Field>
              <Field label="Receiving Port"><select className={inputCls} defaultValue="Karachi"><option>Karachi</option><option>Port Qasim</option></select></Field>
              <Field label="Receiving Date"><input type="date" className={inputCls} defaultValue="2026-08-05" /></Field>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-4">

          <div className="mb-3 flex items-center gap-2.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sky-500 text-[10.5px] font-bold text-white">A</span>
            <h3 className="text-[12px] font-semibold tracking-[0.14em]">ADVANCE & PAYMENT TERMS</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Payment Type"><select className={inputCls} defaultValue="Advance"><option>Advance</option><option>Credit</option><option>On Delivery</option></select></Field>
            <Field label="Advance %"><input type="number" className={inputCls} defaultValue={30} /></Field>
            <Field label="Advance Date"><input type="date" className={inputCls} defaultValue="2026-07-23" /></Field>
            <Field label="Final Payment Date"><input type="date" className={inputCls} defaultValue="2026-08-05" /></Field>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-3">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-700 text-[10.5px] font-bold text-white">C</span>
            <h3 className="text-[12px] font-semibold tracking-[0.14em]">CONTAINER</h3>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Field label="Container No."><input className={inputCls} placeholder="e.g. ABCU1234567" /></Field>
            <Field label="Container Type / Size"><select className={inputCls} defaultValue="40FT"><option>20 FT</option><option>40 FT</option><option>40 FT HC</option></select></Field>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-muted-foreground">
            <Container className="h-3.5 w-3.5" />Optional — leave blank if road delivery.
          </div>
        </div>
      </section>
      <GoodsTable goods={goods} />
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <PaymentTable paymentSchedule={paymentSchedule} />
        <LoadingTable />
      </section>
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Remarks & Narration</label>
          <textarea className="mt-2 min-h-[110px] w-full resize-none rounded-lg border border-border bg-background p-3 text-[12.5px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            defaultValue="Purchase booking for dry fruits. Advance payment scheduled. Quality as per agreement." />        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Attachments <span className="text-muted-foreground/70">(Max 5 MB each)</span>
          </label>
          <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-[12.5px]">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-600" />
              <span className="font-medium">Contract_PC-2026-6789.pdf</span>
              <span className="text-muted-foreground">(1.2 MB)</span>
            </div>
            <button className="text-muted-foreground hover:text-rose-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-[12px] text-muted-foreground">
            <Upload className="h-4 w-4" />Drag & drop files here or click to browse
          </div>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button className="rounded-xl border border-border bg-white py-2.5 text-[12.5px] font-semibold text-foreground hover:bg-muted">← Back</button>
        <button className="rounded-xl bg-sky-500 py-2.5 text-[12.5px] font-semibold text-white hover:bg-sky-600">Save Draft</button>
        <button className="rounded-xl bg-emerald-500 py-2.5 text-[12.5px] font-semibold text-white hover:bg-emerald-600">Accept & Verify</button>
        <button className="rounded-xl bg-slate-900 py-2.5 text-[12.5px] font-semibold text-white hover:bg-slate-800">Register →</button>
      </section>
    </div>
  );
}
/* ---- shared tables ---- */
function GoodsTable({ goods }: { goods: GoodsRow[] }) {
  return (
    <section className="avoid-break overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-3.5">
        <SectionBadge n="G" label="GOODS DETAILS" />
        <span className="text-[11px] text-muted-foreground">Currency: <span className="font-semibold text-foreground">AED</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">

          <thead>
            <tr className="border-b border-border/60 bg-slate-50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              {["#", "Code", "Name", "Spec / Size", "Unit", "Qty", "Price", "Gross Wt", "Net Wt", "Gross Amt", "Disc.", "Net Amt"].map((h) => (
                <Th key={h} className="whitespace-nowrap px-2.5 py-2.5 text-left font-semibold">{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goods.map((g) => (
              <tr key={g.sr} className="border-b border-border/40 last:border-0 hover:bg-slate-50/60">
                <td className="px-2.5 py-2 text-muted-foreground">{g.sr}</td>
                <td className="px-2.5 py-2 font-medium">{g.code}</td>
                <td className="px-2.5 py-2">{g.name}</td>
                <td className="px-2.5 py-2 text-muted-foreground">{g.spec}</td>
                <td className="px-2.5 py-2">{g.unit}</td>
                <td className="px-2.5 py-2 tabular-nums">{g.qty}</td>
                <td className="px-2.5 py-2 tabular-nums">{g.price}</td>
                <td className="px-2.5 py-2 tabular-nums">{g.gw}</td>
                <td className="px-2.5 py-2 tabular-nums">{g.nw}</td>
                <td className="px-2.5 py-2 tabular-nums font-semibold">{g.ga}</td>
                <td className="px-2.5 py-2 tabular-nums text-rose-600">{g.disc}</td>
                <td className="px-2.5 py-2 tabular-nums font-semibold text-emerald-700">{g.na}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-border/60 bg-slate-50/60 p-3 sm:grid-cols-4 xl:grid-cols-7">
        {[["Items", "4"], ["Total Qty", "2,500.00"], ["Gross Wt", "2,615.00"], ["Net Wt", "2,500.00"], ["Gross Amt", "76,000.00"], ["Discount", "500.00"], ["Net Amt", "75,500.00"]].map(([k, v]) => (
          <div key={k}>
            <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="text-[12.5px] font-bold text-sky-700 tabular-nums">{v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
function PaymentTable({ paymentSchedule }: { paymentSchedule: PaymentRow[] }) {
  return (
    <section className="avoid-break overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 p-3.5">
        <SectionBadge n="P" label="PAYMENT SCHEDULE" />
        <span className="text-[11px] text-muted-foreground">AED</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border/60 bg-slate-50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              {["#", "Term", "%", "Mode", "Bank / ATM", "Amount", "Balance", "Date"].map((h) => (
                <Th key={h} className="whitespace-nowrap px-2.5 py-2.5 text-left font-semibold">{h}</Th>
              ))}
              <Th className="px-2.5 py-2.5"></Th>
            </tr>
          </thead>
          <tbody>
            {paymentSchedule.map((r) => (
              <tr key={r.sr} className="border-b border-border/40 last:border-0 hover:bg-slate-50/60">
                <td className="px-2.5 py-2 text-muted-foreground">{r.sr}</td>
                <td className="px-2.5 py-2 font-medium">{r.term}</td>
                <td className="px-2.5 py-2 tabular-nums font-bold text-sky-700">{r.pct}</td>
                <td className="px-2.5 py-2">{r.mode}</td>
                <td className="px-2.5 py-2 text-muted-foreground">{r.bank}</td>
                <td className="px-2.5 py-2 tabular-nums font-semibold">{r.amt}</td>
                <td className="px-2.5 py-2 tabular-nums text-amber-700">{r.bal}</td>
                <td className="px-2.5 py-2 text-muted-foreground">{r.date}</td>
                <td className="px-2.5 py-2">
                  <div className="flex gap-1">
                    <button className="rounded-md border border-sky-200 bg-sky-50 p-1 text-sky-600 hover:bg-sky-100"><Pencil className="h-3 w-3" /></button>
                    <button className="rounded-md border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function LoadingTable() {
  return (
    <section className="avoid-break overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 p-3.5">
        <SectionBadge n="L" label="LOADING SUMMARY" />
        <StatusPill tone="pending">PENDING</StatusPill>

      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border/60 bg-slate-50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              {["#", "Mode", "Vessel", "Loading", "Discharge", "ETD", "ETA", "Loaded", "Balance"].map((h) => (
                <Th key={h} className="whitespace-nowrap px-2.5 py-2.5 text-left font-semibold">{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-slate-50/60">
              <td className="px-2.5 py-2 text-muted-foreground">1</td>
              <td className="px-2.5 py-2 font-medium">By Sea</td>
              <td className="px-2.5 py-2">MSC AL RAS</td>
              <td className="px-2.5 py-2">Jebel Ali</td>
              <td className="px-2.5 py-2">Karachi</td>
              <td className="px-2.5 py-2">2026-07-30</td>
              <td className="px-2.5 py-2">2026-08-05</td>
              <td className="px-2.5 py-2 tabular-nums text-muted-foreground">0.00</td>
              <td className="px-2.5 py-2 tabular-nums font-semibold text-amber-700">2,500.00</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
/* ================================================================
   FULL REPORT — Template 1 (A4-ready)
   ================================================================ */
function FullReport({
  branchDetails, billDetails, purchaseAccount, salesAccount, goods, paymentSchedule,
}: Required<Omit<PurchaseBookingViewRedesignProps, "chrome">>) {
  // Pull a few common fields off the bill for the header (safe fallbacks).
  const findV = (rows: KVRow[], key: string) =>
    rows.find((r) => r.k.toLowerCase() === key.toLowerCase())?.v ?? "—";
  const bookingNo = findV(billDetails, "System Serial");
  const bookingDate = findV(billDetails, "Booking Date");
  const statusRow = billDetails.find((r) => r.pill);
  const status = statusRow?.v ?? "ACCEPTED";
  const doPrint = () => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(() => window.print(), 60)),
    );
  };
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="no-print mb-3 flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={doPrint}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        <button
          onClick={doPrint}
          title="Use your browser's Save as PDF option in the print dialog"
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-amber-600"
        >
          <Download className="h-3.5 w-3.5" /> Download PDF
        </button>
      </div>
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
                    <Th style={{ width: 26 }}>#</Th>
                    <Th>Name</Th>
                    <Th>Spec</Th>
                    <Th>Unit</Th>
                    <Th className="num">Qty</Th>
                    <Th className="num">Gross</Th>

                    <Th className="num">Net</Th>
                    <Th className="num">Price</Th>
                    <Th className="num">Amount</Th>
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
                    <Th style={{ width: 26 }}>#</Th>
                    <Th>Term</Th>
                    <Th className="num">%</Th>
                    <Th>Mode</Th>
                    <Th>Bank / ATM</Th>
                    <Th>A/C</Th>
                    <Th className="num">Amount</Th>
                    <Th className="num">Balance</Th>
                    <Th>Date</Th>
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
/* ================================================================
   COMPACT ORDER — Template 2
   ================================================================ */
function CompactOrder({ goods }: { goods: GoodsRow[] }) {
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="a4-sheet mx-auto overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
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
        <div className="grid grid-cols-1 gap-0 border-b border-border md:grid-cols-2">
          <div className="border-b border-border p-4 md:border-b-0 md:border-r">
            <div className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Purchase A/C (DR)</div>
            <div className="mt-1 text-[13px] font-bold">FAREDULLAH TRADING LLC</div>
            <div className="text-[11px] text-muted-foreground">ARE-DET-AC-0003 · AL.RAS · AED</div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Sales A/C (CR)</div>
            <div className="mt-1 text-[13px] font-bold">HIGH END TRADING LLC</div>
            <div className="text-[11px] text-muted-foreground">UAE-DET-AC-0003 · AL.RAS · AED</div>
          </div>
        </div>
        <div className="p-4">

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="bg-slate-100 text-[10px] uppercase tracking-widest text-slate-700">
                  {["#", "Item", "Qty", "Price", "Amount", "Ex.Rate", "Final (AED)"].map((h) => (
                    <Th key={h} className="whitespace-nowrap px-2.5 py-2 text-left font-semibold">{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {goods.map((g) => (
                  <tr key={g.sr} className="border-b border-border/40 last:border-0">
                    <td className="px-2.5 py-1.5 text-muted-foreground">{g.sr}</td>
                    <td className="px-2.5 py-1.5 font-semibold">{g.name}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{g.qty}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{g.price}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{g.ga}</td>
                    <td className="px-2.5 py-1.5 tabular-nums text-muted-foreground">1.0000</td>
                    <td className="px-2.5 py-1.5 tabular-nums font-bold text-emerald-700">{g.na}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Items", "4"], ["Total Qty", "2,500 KG"], ["Invoice", "75,500"], ["Balance", "75,500"]].map(([k, v], i) => (
              <div key={k} className={`rounded-lg border border-border p-2 text-center ${i === 3 ? "bg-amber-50" : "bg-slate-50"}`}>
                <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className={`text-[13px] font-bold tabular-nums ${i === 3 ? "text-amber-700" : "text-foreground"}`}>{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-border bg-slate-50/60 p-3 text-[11.5px] leading-5">
            <span className="font-bold">Remarks: </span>
            Purchase booking for dry fruits. Advance 30 %, on-loading 40 %, on-delivery 30 %. Delivery by sea, Jebel Ali → Karachi.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-border bg-slate-50/60 px-6 py-5">
          {["Prepared By", "Authorised Signatory"].map((s) => (
            <div key={s} className="text-center">
              <div className="mx-auto mb-1.5 h-10 w-36 border-b-2 border-slate-400" />
              <div className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
