"use client";

import { useState } from "react";
import {
  Menu, Building2, Calendar, Globe, Languages, Bell, HelpCircle, ChevronDown,
  Save, Check, ArrowRightLeft, Printer, MoreHorizontal, Pencil, Trash2, Upload,
  X, FileText, LayoutDashboard, ShoppingCart, Package, Users, Wallet, BarChart3,
  Container, Warehouse, Truck, Settings, Ship, Anchor, ClipboardList, FileDown,
  Eye, Download,
} from "lucide-react";
import { FullPurchaseBookingReport } from "./reports/full-purchase-booking-report";
import { CompactPurchaseBookingOrder } from "./reports/compact-purchase-booking-order";

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
  defaultView?: View;
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
  { sr: 2, code: "GOOD-0002", name: "Pistachio", spec: "Iranian Akbari", unit: "KG", qty: "500.00", price: "52.00", gw: "525.00", nw: "500.00", ga: "26,000.00", disc: "500.00", na: "25,500.00" },
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
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[11.5px] text-muted-foreground">{k}</span>
      <div className="min-w-0 text-right">
        {pill ? (
          <StatusPill>{v}</StatusPill>
        ) : (
          <div className={`truncate text-[12.5px] font-semibold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{v}</div>
        )}
        {sub ? <div className="text-[10.5px] text-muted-foreground">{sub}</div> : null}
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
        <h3 className="text-[11.5px] font-semibold tracking-[0.14em] text-foreground">{title}</h3>
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
  const colors = tone === "dr"
    ? { chip: "bg-rose-50 text-rose-700 ring-rose-200", bar: "bg-rose-500", balance: "text-rose-700" }
    : { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500", balance: "text-emerald-700" };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground">Payment Summary</span>
        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1 ${colors.chip}`}>{status}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[["Invoice", amount], ["Paid", paid], ["Balance", balance]].map(([k, v], i) => (
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
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
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
  defaultView = "full",
}: PurchaseBookingViewRedesignProps = {}) {
  const [view, setView] = useState<View>(defaultView);

  const handlePrint = (which: "full" | "compact") => {
    setView(which);
    requestAnimationFrame(() => setTimeout(() => window.print(), 60));
  };

  const shared = { branchDetails, billDetails, purchaseAccount, salesAccount, goods, paymentSchedule };

  return (
    <div className="min-h-screen bg-slate-50 text-foreground">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { padding: 0 !important; }
          .print-area, .print-area * { box-shadow: none !important; }
          .a4-sheet { width: 100% !important; max-width: none !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
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
          {view === "full" && <FullPurchaseBookingReport {...shared} />}
          {view === "compact" && <CompactPurchaseBookingOrder goods={goods} />}

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
            defaultValue="Purchase booking for dry fruits. Advance payment scheduled. Quality as per agreement." />
        </div>
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
                <th key={h} className="whitespace-nowrap px-2.5 py-2.5 text-left font-semibold">{h}</th>
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
                <th key={h} className="whitespace-nowrap px-2.5 py-2.5 text-left font-semibold">{h}</th>
              ))}
              <th className="px-2.5 py-2.5"></th>
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
                <th key={h} className="whitespace-nowrap px-2.5 py-2.5 text-left font-semibold">{h}</th>
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
