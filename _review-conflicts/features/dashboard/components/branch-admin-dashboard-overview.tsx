"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  ClipboardList,
  CreditCard,
  Landmark,
  PackageOpen,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Users,
  Wallet
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LedgerRow = {
  id: string;
  name: string;
  code: string;
  current_balance: number;
  currency: string;
};

type CustomerRow = {
  id: string;
  customer_name: string;
  company_name: string | null;
  mobile: string | null;
  email: string | null;
};

type RecentEntry = {
  id: string;
  voucher_no: string | null;
  entry_date: string | null;
  type: string | null;
  status: string | null;
  created_at: string | null;
  narration: string | null;
};

type BranchDashboardOverviewProps = {
  data: {
    branchName: string;
    branchCode: string;
    currency: string;
    todayCount: number;
    usersCount: number;
    customersCount: number;
    totalLedgersCount: number;
    purchaseTotal: number;
    salesTotal: number;
    purchaseCount: number;
    salesCount: number;
    cashBalance: number;
    bankBalance: number;
    pendingPayments: number;
    productsCount: number;
    ledgers: LedgerRow[];
    customers: CustomerRow[];
    recentRoznamcha: RecentEntry[];
  };
};

const CHART_COLORS = ["#2563eb", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatMoney(value: number, currency = "USD") {
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

function OperationalCard({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub: string; icon: React.ElementType; tone: string }) {
  return (
    <div className="bg-card text-card-foreground border border-border hover:border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-lg transition-transform hover:-translate-y-0.5 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2.5 text-xl font-black tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground/80">{sub}</p>
        </div>
        <span className={`grid h-9 w-9 place-items-center rounded-xl border border-border bg-muted shrink-0 ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string | null }) {
  const normalized = (value || "draft").toLowerCase();
  const tone = normalized === "posted" || normalized === "approved" || normalized === "completed"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : normalized === "pending" || normalized === "draft"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "border-border bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${tone}`}>{value || "Draft"}</span>;
}

export function BranchAdminDashboardOverview({ data }: BranchDashboardOverviewProps) {
  const currency = data.currency || "USD";
  const profit = data.salesTotal - data.purchaseTotal;
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const activityData = useMemo(() => [
    { name: "Purchases", value: data.purchaseTotal },
    { name: "Sales", value: data.salesTotal },
    { name: "Cash", value: data.cashBalance },
    { name: "Bank", value: data.bankBalance }
  ], [data.purchaseTotal, data.salesTotal, data.cashBalance, data.bankBalance]);

  const dailyBars = useMemo(() => [
    { day: "Mon", purchase: data.purchaseTotal * 0.10, sales: data.salesTotal * 0.12 },
    { day: "Tue", purchase: data.purchaseTotal * 0.16, sales: data.salesTotal * 0.10 },
    { day: "Wed", purchase: data.purchaseTotal * 0.12, sales: data.salesTotal * 0.18 },
    { day: "Thu", purchase: data.purchaseTotal * 0.20, sales: data.salesTotal * 0.15 },
    { day: "Fri", purchase: data.purchaseTotal * 0.17, sales: data.salesTotal * 0.22 },
    { day: "Sat", purchase: data.purchaseTotal * 0.13, sales: data.salesTotal * 0.16 },
    { day: "Sun", purchase: data.purchaseTotal * 0.12, sales: data.salesTotal * 0.17 }
  ], [data.purchaseTotal, data.salesTotal]);

  const quickActions = [
    { label: "Cash Entry", desc: "Post branch payment or receipt", href: "/dashboard/roznamcha/cash-entry", icon: ClipboardList },
    { label: "New Purchase", desc: "Create purchase booking", href: "/dashboard/purchase/new-purchase-booking-order", icon: ShoppingCart },
    { label: "Ledger Report", desc: "Review branch ledger statement", href: "/dashboard/ledger/general-report", icon: ReceiptText },
    { label: "Add Customer", desc: "Create branch customer profile", href: "/dashboard/settings/customers/setup", icon: UserPlus }
  ];

  return (
    <div className="space-y-6 text-foreground p-4 lg:p-6 min-h-screen">
      {/* Branch Banner Section */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="inline-flex rounded-full border border-border bg-card px-2 py-0.5 text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">
            Branch Admin Dashboard
          </span>
          <h1 className="text-2xl font-black text-foreground mt-1">{data.branchName}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily operational view for branch transactions, local balance sheet, cash levels, and stock metrics.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3.5 py-1.5 backdrop-blur shrink-0 flex items-center gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase text-muted-foreground">Branch Code</p>
            <p className="font-mono text-xs font-black text-foreground">{data.branchCode}</p>
          </div>
          <div className="h-6 w-px bg-border" />
          <div>
            <p className="text-[9px] font-bold uppercase text-muted-foreground">Base Currency</p>
            <p className="font-mono text-xs font-black text-foreground">{currency}</p>
          </div>
        </div>
      </section>

      {/* Grid of 6 stats cards */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <OperationalCard label="Today's Postings" value={String(data.todayCount)} sub="Roznamcha entries" icon={Activity} tone="text-blue-500 dark:text-blue-400" />
        <OperationalCard label="Purchases" value={formatMoney(data.purchaseTotal, currency)} sub={`${data.purchaseCount} orders`} icon={ShoppingCart} tone="text-amber-500 dark:text-amber-400" />
        <OperationalCard label="Sales" value={formatMoney(data.salesTotal, currency)} sub={`${data.salesCount} orders`} icon={TrendingUp} tone="text-emerald-600 dark:text-emerald-400" />
        <OperationalCard label="Cash Balance" value={formatMoney(data.cashBalance, currency)} sub="Cash ledger standing" icon={Wallet} tone="text-cyan-500 dark:text-cyan-400" />
        <OperationalCard label="Bank Balance" value={formatMoney(data.bankBalance, currency)} sub="Bank ledger standing" icon={Landmark} tone="text-indigo-500 dark:text-indigo-400" />
        <OperationalCard label="Pending Payments" value={formatMoney(data.pendingPayments, currency)} sub="Open branch exposure" icon={AlertTriangle} tone="text-rose-500 dark:text-rose-400" />
      </section>

      {/* Recharts Graphics visual row */}
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr_0.9fr]">
        {/* Daily Purchase vs Sales */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              Daily Purchase vs Sales
            </CardTitle>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">Operational week trend in {currency}</p>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyBars} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "hsl(var(--border))" : "#e2e8f0"} opacity={0.6} />
                  <XAxis dataKey="day" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                  <Tooltip formatter={(value) => formatMoney(Number(value), currency)} contentStyle={{ background: isDark ? "hsl(var(--card))" : "#fff", border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0", borderRadius: 8, color: isDark ? "hsl(var(--card-foreground))" : "#0f172a", fontSize: 10 }} />
                  <Bar dataKey="purchase" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Purchase" />
                  <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} name="Sales" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Branch Mix */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-500" />
              Branch Mix
            </CardTitle>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">Spread of core account metrics</p>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={activityData} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={4}>
                    {activityData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value), currency)} contentStyle={{ background: isDark ? "hsl(var(--card))" : "#fff", border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0", borderRadius: 8, color: isDark ? "hsl(var(--card-foreground))" : "#0f172a", fontSize: 9 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-muted-foreground mt-2">
              {activityData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Links */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-500" />
              Quick Actions
            </CardTitle>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">Fast branch operations</p>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.label} href={action.href as Route} className="group block rounded-xl border border-border p-2.5 hover:bg-muted transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground border border-border shrink-0"><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-foreground group-hover:text-primary leading-tight">{action.label}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{action.desc}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Grid of details tables */}
      <section className="grid gap-6 md:grid-cols-2">
        {/* Cash, Bank & Ledger status */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Landmark className="h-4 w-4 text-blue-500" />
              Cash, Bank & Ledger Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[300px] divide-y divide-border overflow-auto">
              {data.ledgers.length ? data.ledgers.map((ledger) => (
                <div key={ledger.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30">
                  <div>
                    <p className="text-xs font-bold text-foreground/90">{ledger.name}</p>
                    <p className="font-mono text-[9px] text-muted-foreground mt-0.5">{ledger.code}</p>
                  </div>
                  <p className="font-mono text-xs font-black text-muted-foreground">{formatMoney(ledger.current_balance, ledger.currency || currency)}</p>
                </div>
              )) : <p className="p-8 text-center text-xs text-muted-foreground">No ledgers assigned to this branch.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Recent branch transactions */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-emerald-500" />
              Recent Branch Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-muted/40 text-[9px] uppercase font-bold text-muted-foreground">
                    <th className="px-4 py-2.5">Voucher</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recentRoznamcha.length ? data.recentRoznamcha.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-mono font-bold text-blue-500 dark:text-blue-400">{row.voucher_no || "N/A"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.entry_date || "-"}</td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">{row.type || "Entry"}</td>
                      <td className="px-4 py-2.5 text-center"><StatusBadge value={row.status} /></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No recent transactions for this branch.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Grid of sub-sections (Inventory and Customer Directory) */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <PackageOpen className="h-4 w-4 text-indigo-500" />
              Inventory & Customers
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 grid-cols-3">
            <div className="rounded-xl border border-border p-3 bg-muted/40">
              <PackageOpen className="mb-2 h-4.5 w-4.5 text-cyan-500" />
              <p className="text-[9px] font-bold uppercase text-muted-foreground">Products</p>
              <p className="text-lg font-black text-foreground mt-1 leading-none">{data.productsCount}</p>
            </div>
            <div className="rounded-xl border border-border p-3 bg-muted/40">
              <Users className="mb-2 h-4.5 w-4.5 text-indigo-500" />
              <p className="text-[9px] font-bold uppercase text-muted-foreground">Customers</p>
              <p className="text-lg font-black text-foreground mt-1 leading-none">{data.customersCount}</p>
            </div>
            <div className="rounded-xl border border-border p-3 bg-muted/40">
              <Banknote className="mb-2 h-4.5 w-4.5 text-emerald-500" />
              <p className="text-[9px] font-bold uppercase text-muted-foreground">Profit</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 leading-none">{formatMoney(profit, currency)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Customer Directory */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-teal-500" />
              Customer Directory
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 grid-cols-2">
            {data.customers.length ? data.customers.slice(0, 4).map((customer) => (
              <div key={customer.id} className="rounded-xl border border-border p-3 bg-muted/20">
                <p className="text-[11px] font-black text-foreground/90">{customer.customer_name}</p>
                <p className="mt-0.5 text-[9px] font-bold text-blue-500 dark:text-blue-400">{customer.company_name || "Customer"}</p>
                <div className="mt-2.5 flex flex-col gap-0.5 text-[9px] text-muted-foreground">
                  <span className="truncate">{customer.mobile || "No mobile"}</span>
                  <span className="truncate">{customer.email || "No email"}</span>
                </div>
              </div>
            )) : <p className="col-span-2 py-6 text-center text-muted-foreground">No customers registered in this country scope.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
