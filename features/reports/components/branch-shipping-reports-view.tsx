"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  FileText,
  Ship,
  Compass,
  CreditCard,
  Wallet,
  Receipt,
  Search,
  Printer,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Filter,
  DollarSign,
  Activity,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { headerLabel, translateHeader } from "@/lib/i18n/table-headers";

export type BranchReportBranch = {
  id: string;
  name: string;
  code: string;
  currency: string;
  cityName?: string;
  countryName?: string;
};

export type BranchReportData = {
  branch: BranchReportBranch;
  shipments: {
    id: string;
    blNumber: string;
    containerNo: string;
    vesselName: string;
    destinationPort: string;
    status: string;
    consignee: string;
    eta?: string;
    date?: string;
  }[];
  tracking: {
    id: string;
    containerNo: string;
    blNumber: string;
    vesselName: string;
    status: string;
    port: string;
    eta?: string;
  }[];
  roznamcha: {
    id: string;
    voucherNo: string;
    date: string;
    type: string;
    debit: number;
    credit: number;
    remarks: string;
    status: string;
  }[];
  expenses: {
    id: string;
    voucherNo: string;
    date: string;
    category: string;
    amount: number;
    currency: string;
    remarks: string;
  }[];
  ledgers: {
    id: string;
    accountTitle: string;
    accountCode: string;
    currency: string;
    currentBalance: number;
    type: "customer" | "supplier" | "cash_bank" | "expense" | "other";
  }[];
};

type TabType = "operations" | "tracking" | "payments" | "expenses" | "cash_bank" | "ledgers" | "transactions";

export function BranchShippingReportsView({ data }: { data: BranchReportData }) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tr = (s: string) => translateHeader(lang, s);

  const [activeTab, setActiveTab] = useState<TabType>("operations");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { branch, shipments, tracking, roznamcha, expenses, ledgers } = data;

  // Filtered operations
  const filteredShipments = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return shipments.filter((s) => {
      const matchSearch =
        !q ||
        s.blNumber.toLowerCase().includes(q) ||
        s.containerNo.toLowerCase().includes(q) ||
        s.vesselName.toLowerCase().includes(q) ||
        s.consignee.toLowerCase().includes(q) ||
        s.destinationPort.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all" ||
        s.status.toLowerCase().includes(statusFilter.toLowerCase());

      return matchSearch && matchStatus;
    });
  }, [shipments, searchTerm, statusFilter]);

  // Filtered tracking
  const filteredTracking = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return tracking.filter((trk) => {
      const matchSearch =
        !q ||
        trk.containerNo.toLowerCase().includes(q) ||
        trk.blNumber.toLowerCase().includes(q) ||
        trk.vesselName.toLowerCase().includes(q) ||
        trk.port.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all" ||
        trk.status.toLowerCase().includes(statusFilter.toLowerCase());

      return matchSearch && matchStatus;
    });
  }, [tracking, searchTerm, statusFilter]);

  // Filtered roznamcha
  const filteredRoznamcha = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return roznamcha.filter((r) => {
      return (
        !q ||
        r.voucherNo.toLowerCase().includes(q) ||
        r.remarks.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    });
  }, [roznamcha, searchTerm]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return expenses.filter((e) => {
      return (
        !q ||
        e.voucherNo.toLowerCase().includes(q) ||
        e.remarks.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [expenses, searchTerm]);

  // Cash & Bank vs other ledgers
  const cashBankLedgers = useMemo(() => {
    return ledgers.filter((l) =>
      l.type === "cash_bank" ||
      l.accountTitle.toLowerCase().includes("cash") ||
      l.accountTitle.toLowerCase().includes("bank")
    );
  }, [ledgers]);

  const filteredCashBank = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return cashBankLedgers.filter((l) => {
      return (
        !q ||
        l.accountTitle.toLowerCase().includes(q) ||
        l.accountCode.toLowerCase().includes(q)
      );
    });
  }, [cashBankLedgers, searchTerm]);

  const filteredLedgers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return ledgers.filter((l) => {
      return (
        !q ||
        l.accountTitle.toLowerCase().includes(q) ||
        l.accountCode.toLowerCase().includes(q)
      );
    });
  }, [ledgers, searchTerm]);

  // Metrics
  const totalDebit = useMemo(
    () => roznamcha.reduce((sum, r) => sum + (Number(r.debit) || 0), 0),
    [roznamcha]
  );
  const totalCredit = useMemo(
    () => roznamcha.reduce((sum, r) => sum + (Number(r.credit) || 0), 0),
    [roznamcha]
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses]
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    let rows: Record<string, any>[] = [];
    let filename = `branch_report_${activeTab}_${branch.code}.csv`;

    if (activeTab === "operations") {
      rows = filteredShipments;
    } else if (activeTab === "tracking") {
      rows = filteredTracking;
    } else if (activeTab === "payments" || activeTab === "transactions") {
      rows = filteredRoznamcha;
    } else if (activeTab === "expenses") {
      rows = filteredExpenses;
    } else if (activeTab === "cash_bank") {
      rows = filteredCashBank;
    } else if (activeTab === "ledgers") {
      rows = filteredLedgers;
    }

    if (rows.length === 0) return;

    const keys = Object.keys(rows[0]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        keys.join(","),
        ...rows.map((row) =>
          keys
            .map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`)
            .join(",")
        )
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-foreground p-3 sm:p-5 lg:p-6 min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      {/* 1. Header Bar: Title + Department Links */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-600 text-white shadow-md shadow-amber-600/20 shrink-0">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {tr("Shipping Line Branch Reports")}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                <Ship className="h-3 w-3" />
                {branch.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tr("Official reports for branch shipments, container tracking, roznamcha vouchers, expenses, and ledger balances.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-slate-200 bg-white font-bold text-xs hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 me-1.5" />
            <span>{tr("Print A4")}</span>
          </Button>

          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-slate-200 bg-white font-bold text-xs hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 me-1.5" />
            <span>{tr("Export CSV")}</span>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-blue-200 bg-blue-50/60 font-bold text-xs hover:bg-blue-100 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300 shadow-xs"
          >
            <Link href={`/dashboard/city/shipping-line?branchId=${branch.id}` as Route}>
              <Ship className="h-3.5 w-3.5 text-blue-600 me-1.5" />
              <span>{tr("Branch Dashboard")}</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* 2. Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-900/20 bg-gradient-to-r from-[#181102] via-[#2c1d04] to-[#452d06] p-6 text-white shadow-xl">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
          style={{ backgroundImage: `url('/images/maritime_hero.jpg')` }}
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 ring-1 ring-inset ring-amber-400/30">
              <Building2 className="h-3.5 w-3.5" />
              {branch.name} • {branch.code}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {tr("Branch Operational & Financial Reports")}
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
              {tr("Real-time verified records covering container operations, live tracking status, cash voucher postings, branch expenses, and customer ledgers.")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur-md min-w-[110px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">{tr("Shipments")}</p>
              <p className="text-xl font-black text-white">{shipments.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur-md min-w-[110px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">{tr("Vouchers")}</p>
              <p className="text-xl font-black text-white">{roznamcha.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur-md min-w-[110px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">{tr("Ledgers")}</p>
              <p className="text-xl font-black text-white">{ledgers.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Report Categories Navigation Tabs */}
      <section className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/80">
        {[
          { id: "operations", label: headerLabel("Operations & Shipments"), icon: Ship, count: shipments.length },
          { id: "tracking", label: headerLabel("Shipping Tracking"), icon: Compass, count: tracking.length },
          { id: "payments", label: headerLabel("Daily Payments (Roznamcha)"), icon: CreditCard, count: roznamcha.length },
          { id: "expenses", label: headerLabel("Operational Expenses"), icon: Receipt, count: expenses.length },
          { id: "cash_bank", label: headerLabel("Cash & Bank Balances"), icon: Wallet, count: cashBankLedgers.length },
          { id: "ledgers", label: headerLabel("Account Ledgers"), icon: Layers, count: ledgers.length },
          { id: "transactions", label: headerLabel("Transactions Journal"), icon: Activity, count: roznamcha.length }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20"
                  : "bg-card hover:bg-accent border border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tr(tab.label)}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </section>

      {/* 4. Filter Bar */}
      <section className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/80">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={tr("Filter report records...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-xs rounded-xl"
          />
        </div>

        {(activeTab === "operations" || activeTab === "tracking") && (
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[11px] font-bold text-muted-foreground">{tr("Status:")}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none cursor-pointer"
            >
              <option value="all">{tr("All Statuses")}</option>
              <option value="transit">{tr("In Transit")}</option>
              <option value="arrived">{tr("Arrived")}</option>
              <option value="pending">{tr("Pending")}</option>
            </select>
          </div>
        )}
      </section>

      {/* 5. Data Tables by Tab */}
      <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {activeTab === "operations" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-black text-[10px] uppercase border-b border-border">
                  <tr>
                    <th className="p-3.5">{tr("BL Number")}</th>
                    <th className="p-3.5">{tr("Container No")}</th>
                    <th className="p-3.5">{tr("Vessel / Voyage")}</th>
                    <th className="p-3.5">{tr("Destination Port")}</th>
                    <th className="p-3.5">{tr("Consignee")}</th>
                    <th className="p-3.5">{tr("ETA")}</th>
                    <th className="p-3.5 text-end">{tr("Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredShipments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        {tr("No shipment operations found.")}
                      </td>
                    </tr>
                  ) : (
                    filteredShipments.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-foreground">{s.blNumber}</td>
                        <td className="p-3.5 font-mono text-muted-foreground">{s.containerNo || "-"}</td>
                        <td className="p-3.5 font-semibold text-foreground">{s.vesselName || "-"}</td>
                        <td className="p-3.5 text-muted-foreground">{s.destinationPort || "-"}</td>
                        <td className="p-3.5 font-medium text-foreground">{s.consignee || "-"}</td>
                        <td className="p-3.5 text-muted-foreground">{s.eta || "-"}</td>
                        <td className="p-3.5 text-end">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              s.status.toLowerCase().includes("arrived")
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : s.status.toLowerCase().includes("transit")
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "tracking" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-black text-[10px] uppercase border-b border-border">
                  <tr>
                    <th className="p-3.5">{tr("Container No")}</th>
                    <th className="p-3.5">{tr("BL Number")}</th>
                    <th className="p-3.5">{tr("Vessel")}</th>
                    <th className="p-3.5">{tr("Current Port")}</th>
                    <th className="p-3.5">{tr("ETA")}</th>
                    <th className="p-3.5 text-end">{tr("Tracking Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTracking.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        {tr("No tracking records available.")}
                      </td>
                    </tr>
                  ) : (
                    filteredTracking.map((trk) => (
                      <tr key={trk.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-foreground">{trk.containerNo}</td>
                        <td className="p-3.5 font-mono text-muted-foreground">{trk.blNumber}</td>
                        <td className="p-3.5 font-semibold text-foreground">{trk.vesselName || "-"}</td>
                        <td className="p-3.5 text-muted-foreground">{trk.port || "-"}</td>
                        <td className="p-3.5 text-muted-foreground">{trk.eta || "-"}</td>
                        <td className="p-3.5 text-end">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                            <Compass className="h-3 w-3" />
                            {trk.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {(activeTab === "payments" || activeTab === "transactions") && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-black text-[10px] uppercase border-b border-border">
                  <tr>
                    <th className="p-3.5">{tr("Voucher No")}</th>
                    <th className="p-3.5">{tr("Date")}</th>
                    <th className="p-3.5">{tr("Type")}</th>
                    <th className="p-3.5">{tr("Remarks")}</th>
                    <th className="p-3.5 text-end">{tr("Debit")}</th>
                    <th className="p-3.5 text-end">{tr("Credit")}</th>
                    <th className="p-3.5 text-end">{tr("Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRoznamcha.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        {tr("No payment vouchers recorded.")}
                      </td>
                    </tr>
                  ) : (
                    filteredRoznamcha.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-foreground">{r.voucherNo}</td>
                        <td className="p-3.5 text-muted-foreground">{r.date}</td>
                        <td className="p-3.5 font-semibold uppercase text-foreground">{r.type}</td>
                        <td className="p-3.5 text-muted-foreground">{r.remarks || "-"}</td>
                        <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-end">
                          {r.debit > 0 ? `${branch.currency} ${r.debit.toLocaleString()}` : "-"}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-rose-600 dark:text-rose-400 text-end">
                          {r.credit > 0 ? `${branch.currency} ${r.credit.toLocaleString()}` : "-"}
                        </td>
                        <td className="p-3.5 text-end">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {r.status || "Posted"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "expenses" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-black text-[10px] uppercase border-b border-border">
                  <tr>
                    <th className="p-3.5">{tr("Voucher No")}</th>
                    <th className="p-3.5">{tr("Date")}</th>
                    <th className="p-3.5">{tr("Expense Category")}</th>
                    <th className="p-3.5">{tr("Remarks")}</th>
                    <th className="p-3.5 text-end">{tr("Amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        {tr("No branch expenses recorded.")}
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-foreground">{e.voucherNo}</td>
                        <td className="p-3.5 text-muted-foreground">{e.date}</td>
                        <td className="p-3.5 font-semibold text-foreground">{e.category}</td>
                        <td className="p-3.5 text-muted-foreground">{e.remarks || "-"}</td>
                        <td className="p-3.5 font-mono font-bold text-foreground text-end">
                          {e.currency} {e.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "cash_bank" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-black text-[10px] uppercase border-b border-border">
                  <tr>
                    <th className="p-3.5">{tr("Account Code")}</th>
                    <th className="p-3.5">{tr("Account Title")}</th>
                    <th className="p-3.5">{tr("Currency")}</th>
                    <th className="p-3.5 text-end">{tr("Current Running Balance")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredCashBank.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        {tr("No cash or bank accounts found.")}
                      </td>
                    </tr>
                  ) : (
                    filteredCashBank.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-foreground">{l.accountCode}</td>
                        <td className="p-3.5 font-semibold text-foreground">{l.accountTitle}</td>
                        <td className="p-3.5 font-mono text-muted-foreground">{l.currency}</td>
                        <td
                          className={`p-3.5 font-mono font-bold text-end ${
                            l.currentBalance >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {l.currency} {l.currentBalance.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "ledgers" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-black text-[10px] uppercase border-b border-border">
                  <tr>
                    <th className="p-3.5">{tr("Account Code")}</th>
                    <th className="p-3.5">{tr("Account Title")}</th>
                    <th className="p-3.5">{tr("Category")}</th>
                    <th className="p-3.5">{tr("Currency")}</th>
                    <th className="p-3.5 text-end">{tr("Current Balance")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLedgers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        {tr("No ledger accounts found.")}
                      </td>
                    </tr>
                  ) : (
                    filteredLedgers.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-foreground">{l.accountCode}</td>
                        <td className="p-3.5 font-semibold text-foreground">{l.accountTitle}</td>
                        <td className="p-3.5 uppercase text-[10px] text-muted-foreground font-bold">{l.type}</td>
                        <td className="p-3.5 font-mono text-muted-foreground">{l.currency}</td>
                        <td
                          className={`p-3.5 font-mono font-bold text-end ${
                            l.currentBalance >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {l.currency} {l.currentBalance.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
