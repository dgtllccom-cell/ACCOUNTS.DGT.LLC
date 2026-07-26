"use client";

import React, { useState } from "react";
import {
  Menu, Building2, Calendar, Globe, Languages, Bell, HelpCircle, ChevronDown,
  Save, Check, ArrowRightLeft, Printer, MoreHorizontal, Pencil, Trash2, Upload,
  X, FileText, LayoutDashboard, ShoppingCart, Package, Users, Wallet, BarChart3,
  Settings, Warehouse, Truck,
} from "lucide-react";

/* ---------------- data ---------------- */

const branchDetails = [
  { k: "Country", v: "United Arab Emirates" },
  { k: "Branch", v: "AL.RAS" },
  { k: "Branch Code", v: "ARE-000-001" },
  { k: "Address", v: "Al Ras, Deira, Dubai", sub: "United Arab Emirates" },
  { k: "User", v: "ADMIN" },
  { k: "Role", v: "Country Admin" },
];

const billDetails = [
  { k: "Booking Date", v: "2026-07-23" },
  { k: "Fiscal Year", v: "2025-26" },
  { k: "Booking Branch", v: "AL.RAS" },
  { k: "Status", v: "ACCEPTED", pill: true },
  { k: "System Serial", v: "PB-2026-6789" },
  { k: "Branch Serial", v: "AL.RAS-6789" },
  { k: "Contract No.", v: "PC-2026-6789" },
  { k: "Loading Mode", v: "By Sea" },
  { k: "Origin Country", v: "United Arab Emirates" },
];

const purchaseAccount = [
  { k: "Account Code", v: "ARE-DET-AC-0003", muted: true },
  { k: "Account Name", v: "FAREDULLAH TRADING LLC" },
  { k: "Branch", v: "AL.RAS" },
  { k: "Currency", v: "AED" },
  { k: "Company", v: "DGT LLC" },
];

const salesAccount = [
  { k: "Account Code", v: "UAE-DET-AC-0003", muted: true },
  { k: "Account Name", v: "FAREDULLAH TRADING LLC" },
  { k: "Branch", v: "AL.RAS" },
  { k: "Currency", v: "AED" },
  { k: "Company", v: "DGT LLC" },
];

const goods = [
  { sr: 1, code: "GOOD-0001", name: "Almond Kernel", spec: "California 18-20", unit: "KG", qty: "1,000.00", price: "28.50", gw: "1,050.00", nw: "1,000.00", ga: "28,500.00", disc: "0.00", na: "28,500.00" },
  { sr: 2, code: "GOOD-0002", name: "Pistachio", spec: "Iranian Akbari", unit: "KG", qty: "500.00", price: "52.00", gw: "525.00", nw: "500.00", ga: "26,000.00", disc: "500.00", na: "25,500.00" },
  { sr: 3, code: "GOOD-0003", name: "Walnut", spec: "Chandler", unit: "KG", qty: "750.00", price: "18.00", gw: "780.00", nw: "750.00", ga: "13,500.00", disc: "0.00", na: "13,500.00" },
  { sr: 4, code: "GOOD-0004", name: "Cashew Nut", spec: "W240", unit: "KG", qty: "250.00", price: "32.00", gw: "260.00", nw: "250.00", ga: "8,000.00", disc: "0.00", na: "8,000.00" },
];

const sidebar = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: ShoppingCart, label: "Purchase Management", active: true },
  { icon: Package, label: "Sales Management" },
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
    <div className="flex items-center gap-3">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">{n}</span>
      <h3 className="text-[13px] font-semibold tracking-[0.14em] text-foreground">{label}</h3>
    </div>
  );
}

function StatusPill({ children, tone = "accepted" }: { children: React.ReactNode; tone?: "accepted" | "pending" | "danger" }) {
  const tones = {
    accepted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    danger: "bg-rose-50 text-rose-700 ring-rose-200",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ring-1 ${tones[tone]}`}>{children}</span>
  );
}

function KV({ k, v, muted, pill, sub }: { k: string; v: string; muted?: boolean; pill?: boolean; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-[12px] text-muted-foreground">{k}</span>
      <div className="text-right">
        {pill ? <StatusPill>{v}</StatusPill> : (
          <div className={`text-[13px] font-semibold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{v}</div>
        )}
        {sub ? <div className="text-[11px] text-muted-foreground">{sub}</div> : null}
      </div>
    </div>
  );
}

function InfoCard({ n, title, rows, accent = "bg-primary", watermark, watermarkTone, footer }: {
  n: string; title: string;
  rows: { k: string; v: string; muted?: boolean; pill?: boolean; sub?: string }[];
  accent?: string; watermark?: string; watermarkTone?: "dr" | "cr"; footer?: React.ReactNode;
}) {
  const wmColor = watermarkTone === "dr" ? "text-rose-500/10" : watermarkTone === "cr" ? "text-emerald-500/10" : "text-slate-500/10";
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm">
      {watermark ? (
        <div aria-hidden className={`pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 select-none text-[110px] font-black leading-none tracking-tighter ${wmColor}`}>{watermark}</div>
      ) : null}
      <div className="relative mb-3 flex items-center gap-3 border-b border-border/60 pb-3">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${accent} text-[11px] font-bold text-primary-foreground`}>{n}</span>
        <h3 className="text-[12px] font-semibold tracking-[0.16em] text-foreground">{title}</h3>
      </div>
      <div className="relative divide-y divide-border/50">
        {rows.map((r) => <KV key={r.k} {...r} />)}
      </div>
      {footer ? <div className="relative mt-3 border-t border-border/60 pt-3">{footer}</div> : null}
    </div>
  );
}

function AccountPaymentStrip({ tone, label, amount, paid, balance, status }: {
  tone: "dr" | "cr"; label: string; amount: string; paid: string; balance: string; status: string;
}) {
  const colors = tone === "dr"
    ? { chip: "bg-rose-50 text-rose-700 ring-rose-200", bar: "bg-rose-500", balance: "text-rose-700" }
    : { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500", balance: "text-emerald-700" };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9.5px] font-bold ring-1 ${colors.chip}`}>{status}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["Invoice", amount], ["Paid", paid], ["Balance", balance]].map(([k, v], i) => (
          <div key={i} className="rounded-md bg-slate-50 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className={`text-[11.5px] font-bold ${i === 2 ? colors.balance : "text-foreground"}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${colors.bar}`} style={{ width: "0%" }} />
      </div>
    </div>
  );
}

function TopButton({ icon: Icon, children, variant = "ghost" }: {
  icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode;
  variant?: "ghost" | "primary" | "success" | "dark";
}) {
  const styles = {
    ghost: "bg-card text-foreground border border-border hover:bg-muted",
    primary: "bg-sky-500 text-white border border-sky-500 hover:bg-sky-600",
    success: "bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600",
    dark: "bg-slate-900 text-white border border-slate-900 hover:bg-slate-800",
  } as const;
  return (
    <button className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors ${styles[variant]}`}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

function Chip({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] text-foreground hover:bg-muted">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{children}</span>
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}

/* ---------------- component ---------------- */

export function PurchaseBookingViewRedesign() {
  return (
    <div className="min-h-screen bg-slate-50 text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <button className="rounded-md p-1.5 hover:bg-muted"><Menu className="h-4 w-4" /></button>
          <nav className="flex items-center gap-1 text-[12px]">
            <Chip icon={Building2}>Purchase Management</Chip>
            <span className="text-muted-foreground">/</span>
            <span className="rounded-md px-2 py-1 text-muted-foreground">Purchase Booking</span>
            <span className="text-muted-foreground">/</span>
            <span className="rounded-md px-2 py-1 font-semibold text-sky-600">New Purchase Booking Order</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Chip icon={Globe}>All Countries</Chip>
            <Chip icon={Calendar}>Jul 1 – Jul 14, 2026</Chip>
            <Chip icon={Languages}>English – English</Chip>
            <button className="relative rounded-md p-2 hover:bg-muted">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>
            <button className="rounded-md p-2 hover:bg-muted"><HelpCircle className="h-4 w-4" /></button>
            <div className="ml-1 flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">A</div>
              <div className="pr-1 text-right leading-tight">
                <div className="text-[12px] font-semibold">ADMIN</div>
                <div className="text-[10px] text-muted-foreground">Super Admin</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-border bg-white lg:block">
          <div className="p-3">
            <div className="px-2 pb-3 pt-1">
              <div className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground">DIGITAL DOCK</div>
              <div className="text-sm font-semibold">ERP Suite</div>
            </div>
            <nav className="space-y-0.5">
              {sidebar.map((item) => {
                const Icon = item.icon;
                return (
                  <a key={item.label} href="#" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] transition-colors ${item.active ? "bg-sky-50 font-semibold text-sky-700" : "text-foreground/80 hover:bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${item.active ? "text-sky-600" : "text-muted-foreground"}`} />
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-16 pt-4 sm:px-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button className="mt-1 rounded-md p-1.5 hover:bg-muted lg:hidden"><Menu className="h-4 w-4" /></button>
              <div>
                <h1 className="text-xl font-bold tracking-tight">New Purchase Booking Order</h1>
                <p className="text-[12.5px] text-muted-foreground">Create and manage purchase booking orders</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TopButton icon={Save}>Save as Draft</TopButton>
              <TopButton icon={Check} variant="success">Accept</TopButton>
              <TopButton icon={ArrowRightLeft} variant="primary">Transfer</TopButton>
              <TopButton icon={Printer}>Print</TopButton>
              <TopButton icon={MoreHorizontal}>···</TopButton>
              <TopButton icon={ChevronDown}>More</TopButton>
            </div>
          </div>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard n="01" title="BRANCH DETAILS" rows={branchDetails} />
            <InfoCard n="02" title="BILL DETAILS" rows={billDetails} accent="bg-emerald-500" />
            <InfoCard n="03" title="PURCHASE ACCOUNT (DR)" rows={purchaseAccount} accent="bg-rose-500" watermark="DR" watermarkTone="dr"
              footer={<AccountPaymentStrip tone="dr" label="Payment Summary" amount="75,500.00" paid="0.00" balance="75,500.00" status="PENDING" />} />
            <InfoCard n="04" title="SALES ACCOUNT (CR)" rows={salesAccount} accent="bg-emerald-500" watermark="CR" watermarkTone="cr"
              footer={<AccountPaymentStrip tone="cr" label="Receipt Summary" amount="75,500.00" paid="0.00" balance="75,500.00" status="PENDING" />} />
          </section>

          <section className="mt-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 p-4">
              <SectionBadge n="G" label="GOODS DETAILS REPORT" />
              <span className="text-[11px] text-muted-foreground">Currency: <span className="font-semibold text-foreground">AED</span></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-border/60 bg-slate-50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {["Sr.#", "Item Code", "Item Name", "Specification / Size", "Unit", "Quantity", "Unit Price (AED)", "Gross Weight (KG)", "Net Weight (KG)", "Gross Amount (AED)", "Discount (AED)", "Net Amount (AED)"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {goods.map((g) => (
                    <tr key={g.sr} className="border-b border-border/40 last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-3 text-muted-foreground">{g.sr}</td>
                      <td className="px-3 py-3 font-medium">{g.code}</td>
                      <td className="px-3 py-3">{g.name}</td>
                      <td className="px-3 py-3 text-muted-foreground">{g.spec}</td>
                      <td className="px-3 py-3">{g.unit}</td>
                      <td className="px-3 py-3 tabular-nums">{g.qty}</td>
                      <td className="px-3 py-3 tabular-nums">{g.price}</td>
                      <td className="px-3 py-3 tabular-nums">{g.gw}</td>
                      <td className="px-3 py-3 tabular-nums">{g.nw}</td>
                      <td className="px-3 py-3 tabular-nums font-semibold">{g.ga}</td>
                      <td className="px-3 py-3 tabular-nums text-rose-600">{g.disc}</td>
                      <td className="px-3 py-3 tabular-nums font-semibold text-emerald-700">{g.na}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border/60 bg-slate-50/60 p-4 md:grid-cols-4 xl:grid-cols-7">
              <div><div className="text-[10px] font-bold tracking-widest text-muted-foreground">TOTAL</div></div>
              {[["Total Items","4"],["Total Quantity","2,500.00 KG"],["Total Gross Weight","2,615.00 KG"],["Total Net Weight","2,500.00 KG"],["Total Gross Amount","76,000.00 AED"],["Total Discount","500.00 AED"],["Total Net Amount","75,500.00 AED"]].map(([k,v])=>(
                <div key={k}>
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{k}</div>
                  <div className="text-[13px] font-bold text-sky-700">{v}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 p-4">
              <SectionBadge n="P" label="PAYMENT SUMMARY REPORT" />
              <span className="text-[11px] text-muted-foreground">Currency: <span className="font-semibold text-foreground">AED</span></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-border/60 bg-slate-50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {["Sr.#","Payment Term","Payment Mode","Currency","Exchange Rate","Invoice Amount (AED)","Paid Amount (AED)","Balance Amount (AED)","Payment Date","Actions"].map((h)=>(
                      <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/40 hover:bg-slate-50/60">
                    <td className="px-3 py-3 text-muted-foreground">1</td>
                    <td className="px-3 py-3">Advance Payment</td>
                    <td className="px-3 py-3">Bank Transfer</td>
                    <td className="px-3 py-3">AED</td>
                    <td className="px-3 py-3 tabular-nums">1.0000</td>
                    <td className="px-3 py-3 tabular-nums font-semibold">75,500.00</td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">0.00</td>
                    <td className="px-3 py-3 tabular-nums font-semibold text-amber-700">75,500.00</td>
                    <td className="px-3 py-3 text-muted-foreground">Advance for goods booking</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1.5">
                        <button className="rounded-md border border-sky-200 bg-sky-50 p-1.5 text-sky-600 hover:bg-sky-100"><Pencil className="h-3.5 w-3.5" /></button>
                        <button className="rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border/60 bg-slate-50/60 p-4 md:grid-cols-4">
              {[["Total Invoice Amount","75,500.00 AED","text-foreground"],["Total Invoice Amount","75,500.00 AED","text-foreground"],["Total Paid Amount","0.00 AED","text-muted-foreground"],["Total Balance Amount","75,500.00 AED","text-amber-700"]].map(([k,v,cls],i)=>(
                <div key={i}>
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{k}</div>
                  <div className={`text-[13px] font-bold ${cls}`}>{v}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 p-4">
              <SectionBadge n="L" label="LOADING SUMMARY REPORT" />
              <span className="text-[11px] text-muted-foreground">Currency: <span className="font-semibold text-foreground">AED</span></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-border/60 bg-slate-50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {["Sr.#","Contract No.","Loading Mode","Port of Loading","Port of Discharge","Ship / Vessel","ETD (Date)","ETA (Date)","Loaded Qty (KG)","Remaining Qty (KG)","Status","Remarks","Actions"].map((h)=>(
                      <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/40 hover:bg-slate-50/60">
                    <td className="px-3 py-3 text-muted-foreground">1</td>
                    <td className="px-3 py-3 font-medium">PC-2026-6789</td>
                    <td className="px-3 py-3">By Sea</td>
                    <td className="px-3 py-3">Jebel Ali Port</td>
                    <td className="px-3 py-3">Karachi Port</td>
                    <td className="px-3 py-3">MSC AL RAS</td>
                    <td className="px-3 py-3">2026-07-30</td>
                    <td className="px-3 py-3">2026-08-05</td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">0.00</td>
                    <td className="px-3 py-3 tabular-nums font-semibold">2,500.00</td>
                    <td className="px-3 py-3"><StatusPill tone="pending">PENDING</StatusPill></td>
                    <td className="px-3 py-3 text-muted-foreground">Not Loaded Yet</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1.5">
                        <button className="rounded-md border border-sky-200 bg-sky-50 p-1.5 text-sky-600 hover:bg-sky-100"><Pencil className="h-3.5 w-3.5" /></button>
                        <button className="rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 gap-4 border-t border-border/60 bg-slate-50/60 p-4 md:grid-cols-3">
              {[["Total Loaded Qty","0.00 KG","text-muted-foreground"],["Total Remaining Qty","2,500.00 KG","text-amber-700"],["Total Contract Qty","2,500.00 KG","text-sky-700"]].map(([k,v,cls],i)=>(
                <div key={i} className="text-center">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{k}</div>
                  <div className={`text-[13px] font-bold ${cls}`}>{v}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 p-4">
              <SectionBadge n="F" label="FINAL BOOKING SUMMARY REPORT" />
              <span className="text-[11px] text-muted-foreground">Currency: <span className="font-semibold text-foreground">AED</span></span>
            </div>
            <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4 xl:grid-cols-8">
              {[["Total Items","4"],["Total Quantity","2,500.00 KG"],["Total Gross Weight","2,615.00 KG"],["Total Net Weight","2,500.00 KG"],["Total Invoice Amount","75,500.00 AED"],["Total Paid Amount","0.00 AED"],["Balance Amount","75,500.00 AED"],["Status","ACCEPTED (NOT TRANSFERRED)","pill"]].map(([k,v,kind],i)=>(
                <div key={i}>
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{k}</div>
                  {kind==="pill" ? <div className="mt-1"><StatusPill tone="danger">{v}</StatusPill></div> : <div className="text-[13px] font-bold">{v}</div>}
                </div>
              ))}
            </div>
          </section>

          {/* CONTRACT REPORT */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="relative border-b-2 border-slate-900 bg-gradient-to-br from-slate-50 to-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white"><FileText className="h-6 w-6" /></div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Digital Dock ERP</div>
                    <h2 className="text-lg font-black uppercase tracking-wider text-slate-900">Purchase Contract Report</h2>
                    <div className="text-[11px] text-muted-foreground">Contract for Sale of Goods — Legally Binding Document</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Contract No.</div>
                  <div className="text-base font-bold text-slate-900">PC-2026-6789</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">Booking Date: <span className="font-semibold text-foreground">2026-07-23</span></div>
                  <div className="mt-1"><StatusPill>ACCEPTED</StatusPill></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-0 border-b border-border md:grid-cols-3">
              {[
                { role:"PURCHASER / BUYER", tone:"bg-sky-50 text-sky-700 ring-sky-200", name:"HIGH END TRADING LLC", code:"UAE-BUY-AC-0021", addr:"Warehouse 12, Al Quoz Industrial Area 3, Dubai, UAE", reg:"TRN 100234567800003", contact:"Mr. Abdullah Rahim  •  +971 50 123 4567" },
                { role:"SELLER / SUPPLIER", tone:"bg-rose-50 text-rose-700 ring-rose-200", name:"FAREDULLAH TRADING LLC", code:"ARE-DET-AC-0003", addr:"Shop 22, Al Ras, Deira, Dubai, UAE", reg:"TRN 100987654300003", contact:"Mr. Faredullah  •  +971 55 987 6543" },
                { role:"BROKER / NOTE PARTY", tone:"bg-amber-50 text-amber-700 ring-amber-200", name:"AL NOKHBA COMMISSION AGENTS", code:"UAE-BRK-AC-0007", addr:"Office 4B, Naif Road, Deira, Dubai, UAE", reg:"Commission: 1.50 % of Net Amount", contact:"Mr. Kareem Iqbal  •  +971 52 445 7788" },
              ].map((p, i) => (
                <div key={p.role} className={`p-5 ${i < 2 ? "border-b md:border-b-0 md:border-r border-border" : ""}`}>
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-widest ring-1 ${p.tone}`}>{p.role}</span>
                  <div className="mt-2 text-[14px] font-bold text-slate-900">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">Account: <span className="font-semibold text-foreground">{p.code}</span></div>
                  <div className="mt-2 text-[12px] text-foreground">{p.addr}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{p.reg}</div>
                  <div className="mt-2 border-t border-dashed border-border pt-2 text-[11.5px] text-muted-foreground">{p.contact}</div>
                </div>
              ))}
            </div>

            <div className="border-b border-border bg-slate-50/60 p-5">
              <SectionBadge n="R" label="RECITALS & AGREEMENT" />
              <ol className="mt-3 space-y-2 text-[12.5px] text-foreground">
                <li><span className="font-bold">1. Agreement of Sale.</span> Seller agrees to sell and Buyer agrees to purchase <span className="font-semibold">2,500.00 KG</span> of assorted dry fruits (as itemised in the Goods Report below) for a total Net Amount of <span className="font-semibold">AED 75,500.00</span>.</li>
                <li><span className="font-bold">2. Payment.</span> Payment shall be effected in the mode, currency, and schedule detailed in the Payment Report. Advance payment forms part of this contract.</li>
                <li><span className="font-bold">3. Delivery.</span> Delivery shall be executed by <span className="font-semibold">Sea Freight</span>, from <span className="font-semibold">Jebel Ali Port, UAE</span> to <span className="font-semibold">Karachi Port, PK</span>, as per the Loading Report.</li>
                <li><span className="font-bold">4. Brokerage.</span> Brokerage/commission is payable to the Broker at the rate stated in the Parties block.</li>
              </ol>
            </div>

            <div className="border-b border-border p-5">
              <SectionBadge n="G" label="CONTRACT — GOODS DETAILS REPORT" />
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-slate-900 text-[10.5px] uppercase tracking-widest text-white">
                      {["Sr.#","Goods Name","Specification","Unit","Quantity","Gross Wt.","Net Wt.","Unit Price","Currency","Net Amount"].map((h)=>(
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {goods.map((g) => (
                      <tr key={g.sr} className="border-b border-border/40 last:border-0 odd:bg-white even:bg-slate-50/40">
                        <td className="px-3 py-2.5 text-muted-foreground">{g.sr}</td>
                        <td className="px-3 py-2.5 font-semibold">{g.name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{g.spec}</td>
                        <td className="px-3 py-2.5">{g.unit}</td>
                        <td className="px-3 py-2.5 tabular-nums">{g.qty}</td>
                        <td className="px-3 py-2.5 tabular-nums">{g.gw}</td>
                        <td className="px-3 py-2.5 tabular-nums">{g.nw}</td>
                        <td className="px-3 py-2.5 tabular-nums">{g.price}</td>
                        <td className="px-3 py-2.5">AED</td>
                        <td className="px-3 py-2.5 tabular-nums font-bold text-emerald-700">{g.na}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 text-[12px] font-bold">
                      <td className="px-3 py-2.5" colSpan={4}>TOTAL</td>
                      <td className="px-3 py-2.5 tabular-nums">2,500.00</td>
                      <td className="px-3 py-2.5 tabular-nums">2,615.00</td>
                      <td className="px-3 py-2.5 tabular-nums">2,500.00</td>
                      <td className="px-3 py-2.5" colSpan={2}>Currency: AED</td>
                      <td className="px-3 py-2.5 tabular-nums text-emerald-700">75,500.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-b border-border bg-slate-50/40 p-5">
              <SectionBadge n="P" label="CONTRACT — PAYMENT DETAILS REPORT" />
              <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-white">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-slate-900 text-[10.5px] uppercase tracking-widest text-white">
                      {["Sr.#","Payment Term","% of Invoice","Payment Mode","Bank / ATM","Bank A/C No.","Currency","Amount Given","Balance","Date"].map((h)=>(
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { sr:1, term:"Advance", pct:"30 %", mode:"Bank Transfer", bank:"Emirates NBD — Deira Br.", ac:"1023-4567-89-01", ccy:"AED", amt:"22,650.00", bal:"52,850.00", date:"2026-07-23" },
                      { sr:2, term:"On Loading", pct:"40 %", mode:"ATM / Card", bank:"ADCB ATM — Al Ras", ac:"9911-2288-33-04", ccy:"AED", amt:"30,200.00", bal:"22,650.00", date:"2026-07-30" },
                      { sr:3, term:"On Delivery", pct:"30 %", mode:"Cash", bank:"Cash Counter — HO", ac:"—", ccy:"AED", amt:"22,650.00", bal:"0.00", date:"2026-08-05" },
                    ].map((r) => (
                      <tr key={r.sr} className="border-b border-border/40 last:border-0 odd:bg-white even:bg-slate-50/40">
                        <td className="px-3 py-2.5 text-muted-foreground">{r.sr}</td>
                        <td className="px-3 py-2.5 font-semibold">{r.term}</td>
                        <td className="px-3 py-2.5 tabular-nums font-bold text-sky-700">{r.pct}</td>
                        <td className="px-3 py-2.5">{r.mode}</td>
                        <td className="px-3 py-2.5">{r.bank}</td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.ac}</td>
                        <td className="px-3 py-2.5">{r.ccy}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold">{r.amt}</td>
                        <td className="px-3 py-2.5 tabular-nums text-amber-700">{r.bal}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.date}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 text-[12px] font-bold">
                      <td className="px-3 py-2.5" colSpan={2}>TOTAL</td>
                      <td className="px-3 py-2.5 tabular-nums">100 %</td>
                      <td className="px-3 py-2.5" colSpan={4}>Invoice: AED 75,500.00</td>
                      <td className="px-3 py-2.5 tabular-nums text-emerald-700">75,500.00</td>
                      <td className="px-3 py-2.5 tabular-nums">0.00</td>
                      <td className="px-3 py-2.5"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-b border-border p-5">
              <SectionBadge n="L" label="CONTRACT — LOADING DETAILS REPORT" />
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-slate-900 text-[10.5px] uppercase tracking-widest text-white">
                      {["Sr.#","Loading Mode","Vessel / Truck","Port of Loading","Port of Discharge","ETD","ETA","Loaded Qty","Balance Qty","Status"].map((h)=>(
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/40 odd:bg-white even:bg-slate-50/40">
                      <td className="px-3 py-2.5 text-muted-foreground">1</td>
                      <td className="px-3 py-2.5 font-semibold">By Sea</td>
                      <td className="px-3 py-2.5">MSC AL RAS</td>
                      <td className="px-3 py-2.5">Jebel Ali Port, UAE</td>
                      <td className="px-3 py-2.5">Karachi Port, PK</td>
                      <td className="px-3 py-2.5">2026-07-30</td>
                      <td className="px-3 py-2.5">2026-08-05</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">0.00 KG</td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold text-amber-700">2,500.00 KG</td>
                      <td className="px-3 py-2.5"><StatusPill tone="pending">PENDING</StatusPill></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-0 lg:grid-cols-3">
              <div className="border-b border-border p-5 lg:col-span-2 lg:border-b-0 lg:border-r">
                <SectionBadge n="F" label="FINAL CONTRACT REPORT / REMARKS" />
                <div className="mt-3 rounded-lg border border-border bg-slate-50/60 p-4 text-[12.5px] leading-6 text-foreground">
                  <p><span className="font-bold">Note:</span> This Purchase Contract is executed between the parties named above for the sale and delivery of goods as itemised. All quantities, weights, unit prices and totals shall be considered final upon acceptance. Any variance in weight up to <span className="font-semibold">±2 %</span> is acceptable. Payment schedule is binding as per the Payment Report. Goods shall be delivered CIF Karachi Port. Disputes, if any, shall be settled under Dubai Commercial Jurisdiction.</p>
                  <p className="mt-2 text-muted-foreground">Custom remarks entered from the software are auto-populated in this section.</p>
                </div>
              </div>
              <div className="p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Grand Summary</div>
                <div className="mt-2 space-y-1.5 rounded-lg border border-border p-3 text-[12px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Items</span><span className="font-semibold">4</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Quantity</span><span className="font-semibold tabular-nums">2,500.00 KG</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Net Weight</span><span className="font-semibold tabular-nums">2,500.00 KG</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Invoice Amount</span><span className="font-semibold tabular-nums">75,500.00</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-semibold tabular-nums text-emerald-700">0.00</span></div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1.5"><span className="font-bold">Balance (AED)</span><span className="font-black tabular-nums text-amber-700">75,500.00</span></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 border-t border-border bg-slate-50/60 px-6 py-6 md:grid-cols-3">
              {["Buyer's Signature","Seller's Signature","Broker's Signature"].map((s) => (
                <div key={s} className="text-center">
                  <div className="mx-auto mb-2 h-12 w-40 border-b-2 border-slate-400" />
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{s}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Booking Remarks / Terms</label>
              <textarea className="mt-2 min-h-[110px] w-full resize-none rounded-lg border border-border bg-background p-3 text-[12.5px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                defaultValue="This is a purchase booking order for dry fruits. Payment advance. Quality as per agreement." />
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Attachments <span className="text-muted-foreground/70">(Max 5MB each)</span></label>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-[12.5px]">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-600" />
                  <span className="font-medium">Contract_PC-2026-6789.pdf</span>
                  <span className="text-muted-foreground">(1.2 MB)</span>
                </div>
                <button className="text-muted-foreground hover:text-rose-600"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-[12px] text-muted-foreground">
                <Upload className="h-4 w-4" /> Drag & drop files here or click to browse
              </div>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <button className="rounded-xl bg-sky-500 py-3 text-[13px] font-semibold text-white shadow-sm hover:bg-sky-600">Save as Draft</button>
            <button className="rounded-xl bg-emerald-500 py-3 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-600">Accept Booking</button>
            <button className="rounded-xl bg-slate-900 py-3 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800">Cancel Booking</button>
          </section>

          <footer className="mt-6 text-center text-[11px] text-muted-foreground">
            © 2026 <span className="font-semibold text-foreground">Digital Dock ERP</span> — All Rights Reserved.
          </footer>
        </main>
      </div>
    </div>
  );
}
