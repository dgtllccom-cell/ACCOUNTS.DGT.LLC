"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Search,
  SlidersHorizontal,
  Building2,
  FileText,
  Eye,
  Pencil,
  Printer,
  Mail,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  X,
  RefreshCw,
  Globe,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet } from "@/lib/api/client";
import { listCountries, type LocationCountry, listCities, type LocationCity } from "@/features/locations/location-api";
import { cn } from "@/lib/utils";

type CustomerResult = {
  id: string;
  customer_name: string;
  company_name: string | null;
  email: string | null;
  mobile: string | null;
  whatsapp: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

type RoznamchaResult = {
  id: string;
  type: string;
  voucher_no: string;
  journal_no: string;
  entry_date: string;
  reference_no: string | null;
  narration: string | null;
  status: string;
  super_admin_serial_number: string | null;
  country_transaction_serial_number: string | null;
  branch_transaction_serial_number: string | null;
  created_by: string | null;
  profiles?: { full_name: string } | null;
  approver_profile?: { full_name: string } | null;
  roznamcha_lines?: Array<{
    debit: number;
    credit: number;
    currency: string;
    usd_amount: number;
    ledgers?: { name: string } | null;
  }>;
};

export default function SearchPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"all" | "customers" | "transactions">("all");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filters state
  const [countryId, setCountryId] = useState("");
  const [currency, setCurrency] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [userName, setUserName] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Data state
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [transactions, setTransactions] = useState<RoznamchaResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // Load countries on mount
  useEffect(() => {
    (async () => {
      try {
        const rows = await listCountries();
        setCountries(rows);
      } catch (e) {
        console.error("Failed to load countries", e);
      }
    })();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // 1. Search Customers
      const custParams = new URLSearchParams();
      if (searchQuery) custParams.set("q", searchQuery);
      if (countryId) custParams.set("countryId", countryId);
      custParams.set("limit", "100");

      const custRes = await apiGet<{ customers: CustomerResult[] }>(`/api/erp/customers?${custParams.toString()}`);
      setCustomers(custRes.customers ?? []);

      // 2. Search Transactions
      const transParams = new URLSearchParams();
      if (searchQuery) transParams.set("search", searchQuery);
      if (countryId) transParams.set("countryId", countryId);
      transParams.set("limit", "100");

      const transRes = await apiGet<{ entries: RoznamchaResult[] }>(`/api/erp/roznamcha?${transParams.toString()}`);
      setTransactions(transRes.entries ?? []);

    } catch (err: any) {
      setMessage(err.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  // Apply filters on the client side
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Custom filters
      if (userName && !c.customer_name.toLowerCase().includes(userName.toLowerCase())) return false;
      return true;
    });
  }, [customers, userName]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Apply filters
      if (currency && !t.roznamcha_lines?.some(l => l.currency.toUpperCase() === currency.toUpperCase())) return false;
      if (approvalStatus && t.status !== approvalStatus) return false;
      if (userName && !(t.profiles?.full_name || "").toLowerCase().includes(userName.toLowerCase())) return false;
      if (transactionType && t.type !== transactionType) return false;
      if (dateFrom && t.entry_date < dateFrom) return false;
      if (dateTo && t.entry_date > dateTo) return false;
      return true;
    });
  }, [transactions, currency, approvalStatus, userName, transactionType, dateFrom, dateTo]);

  // Action Triggers
  const handleViewCustomer = (id: string) => {
    router.push(`/dashboard/settings/customers/view?customerId=${id}` as Route);
  };

  const handleEditCustomer = (id: string) => {
    router.push(`/dashboard/settings/customers/setup?customerId=${id}` as Route);
  };

  const handleViewTransaction = (id: string) => {
    router.push(`/dashboard/roznamcha/cash-entry?id=${id}` as Route);
  };

  const handleEditTransaction = (id: string) => {
    router.push(`/dashboard/roznamcha/cash-entry?id=${id}&edit=true` as Route);
  };

  const handlePrint = (title: string, data: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print - ${title}</title>
          <style>
            body { font-family: monospace; padding: 20px; color: #333; }
            h1 { border-bottom: 2px solid #000; padding-bottom: 5px; }
            .row { margin: 10px 0; display: flex; justify-content: space-between; border-bottom: 1px dashed #ccc; padding-bottom: 3px; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          ${Object.entries(data).map(([k, v]) => `
            <div class="row">
              <span class="label">${k}</span>
              <span>${v || "-"}</span>
            </div>
          `).join("")}
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportPDF = (title: string, data: any) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEmail = (email: string, subject: string, body: string) => {
    if (email) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
      alert("No email registered for this record.");
    }
  };

  const handleWhatsApp = (phone: string, text: string) => {
    const clean = phone?.replace(/[^0-9]/g, "");
    if (clean) {
      window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`, "_blank");
    } else {
      alert("No phone/WhatsApp registered for this record.");
    }
  };

  const resetFilters = () => {
    setCountryId("");
    setCurrency("");
    setApprovalStatus("");
    setUserName("");
    setTransactionType("");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-4 md:p-6 bg-slate-50/50 dark:bg-slate-950/20 min-h-screen">
      {/* Top Banner */}
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-5 border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-xs font-bold text-teal-600 uppercase tracking-widest block mb-1">Unified Search Center</span>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Search className="h-7 w-7 text-teal-600" />
            Global ERP Search Engine
          </h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
            Instantly search and filter customers, payments, vouchers, and transactions across countries and branches.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-xs font-semibold gap-1.5 h-9" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="h-4 w-4" />
            {showFilters ? "Hide Filters" : "Advanced Filters"}
          </Button>
          <Button variant="ghost" className="text-xs font-semibold gap-1 h-9 text-slate-500 hover:text-slate-900" onClick={resetFilters}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </section>

      {/* Main Search Bar & Quick Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by name, serial no., voucher no., NTN, reference, mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-11 pr-24 h-12 bg-white text-slate-900 border-slate-200 text-sm rounded-xl shadow-sm focus-visible:ring-teal-505"
            />
            <Button
              className="absolute right-1.5 top-1.5 h-9 bg-teal-600 hover:bg-teal-700 text-xs font-bold px-4 rounded-lg"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>

        {/* Small stats cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border rounded-xl p-3 shadow-sm flex items-center gap-3 dark:bg-slate-900/40 dark:border-slate-800">
            <Building2 className="h-8 w-8 text-teal-600/30" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-black block">Customers</span>
              <strong className="text-lg text-slate-900 dark:text-slate-100">{filteredCustomers.length}</strong>
            </div>
          </div>
          <div className="bg-white border rounded-xl p-3 shadow-sm flex items-center gap-3 dark:bg-slate-900/40 dark:border-slate-800">
            <FileText className="h-8 w-8 text-blue-600/30" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-black block">Transactions</span>
              <strong className="text-lg text-slate-900 dark:text-slate-100">{filteredTransactions.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Drawer */}
      {showFilters && (
        <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-855 dark:bg-slate-950 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
          <CardHeader className="bg-slate-50/50 py-3.5 border-b dark:bg-slate-900/25 dark:border-slate-850">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4 text-teal-600" />
              Search & Filter Criteria
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Country Scope</Label>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
              >
                <option value="">All Countries</option>
                {countries.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Currency</Label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
              >
                <option value="">All Currencies</option>
                <option value="USD">USD - US Dollar</option>
                <option value="PKR">PKR - Pakistan Rupee</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="AFN">AFN - Afghan Afghani</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Approval Status</Label>
              <select
                value={approvalStatus}
                onChange={(e) => setApprovalStatus(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
              >
                <option value="">All Statuses</option>
                <option value="posted">Posted</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Transaction Scope</Label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
              >
                <option value="">All Scopes</option>
                <option value="super_admin">Super Admin</option>
                <option value="country">Country Branch</option>
                <option value="branch">City Branch</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">User / Counterparty Name</Label>
              <Input
                type="text"
                placeholder="User name filter"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="h-9 text-xs bg-white text-slate-900 border-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Start Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-xs bg-white text-slate-900 border-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">End Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-xs bg-white text-slate-900 border-slate-200"
              />
            </div>

            <div className="flex items-end">
              <Button className="w-full text-xs font-bold h-9 bg-slate-950 text-white" onClick={handleSearch} disabled={loading}>
                Apply Search Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs list */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex gap-4">
          {[
            { id: "all", label: "All Results", count: filteredCustomers.length + filteredTransactions.length },
            { id: "customers", label: "Customers Profiles", count: filteredCustomers.length },
            { id: "transactions", label: "Transactions & Serials", count: filteredTransactions.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "pb-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all relative",
                activeTab === tab.id
                  ? "border-teal-600 text-teal-700 dark:text-teal-400"
                  : "border-transparent text-slate-400 hover:text-slate-900"
              )}
            >
              {tab.label}
              <span className="ml-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] px-2 py-0.5 rounded-full font-black text-slate-500">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Results grid */}
      {loading ? (
        <div className="h-[250px] flex items-center justify-center text-xs text-slate-400 font-bold uppercase tracking-widest gap-2">
          <RefreshCw className="animate-spin h-5 w-5 text-teal-600" />
          Performing Global Query scan...
        </div>
      ) : (
        <div className="space-y-6">
          {message && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 rounded-lg">
              {message}
            </div>
          )}

          {/* Customers Tab Content */}
          {(activeTab === "all" || activeTab === "customers") && filteredCustomers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-teal-700 flex items-center gap-1">
                🏢 CUSTOMER REGISTRY MATCHES ({filteredCustomers.length})
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredCustomers.map(c => {
                  let parsed = {} as any;
                  if (c.notes) {
                    try {
                      parsed = JSON.parse(c.notes);
                    } catch {
                      // ignore
                    }
                  }
                  return (
                    <Card key={c.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-950 dark:border-slate-850 hover:border-teal-300 transition-colors">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <strong className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{c.customer_name}</strong>
                            <p className="text-xs text-slate-400 mt-0.5">{parsed.companyBusinessType || "Sole Proprietorship"} · {c.mobile || "No Contact"}</p>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest font-mono bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-200">
                            CUST-{c.id.slice(0, 6).toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 text-xs border-y py-2.5 border-slate-100 dark:border-slate-850">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Account Name</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{parsed.accountName || c.customer_name}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Registration No.</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{parsed.companyRegNo || "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Tax NTN Number</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{parsed.companyTaxNo || "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Manual Ref</span>
                            <span className="font-bold text-slate-850 dark:text-slate-200 font-mono">{parsed.manualReference || "—"}</span>
                          </div>
                        </div>

                        {/* Customer Actions */}
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="View Profile" onClick={() => handleViewCustomer(c.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-600 hover:bg-slate-100" title="Edit Profile" onClick={() => handleEditCustomer(c.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="WhatsApp Share" onClick={() => handleWhatsApp(c.mobile || "", `Hello ${c.customer_name}, please check your customer card code: CUST-${c.id.slice(0,6).toUpperCase()}.`)}>
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Email Profile" onClick={() => handleEmail(c.email || "", "Damaan Group Customer Card", `Customer Profile details for ${c.customer_name}.\nNTN: ${parsed.companyTaxNo || "-"}`)}>
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:bg-amber-50" title="Print Profile" onClick={() => handlePrint(`Customer Card: ${c.customer_name}`, { Name: c.customer_name, Phone: c.mobile, Email: c.email, NTN: parsed.companyTaxNo, "Manual Ref": parsed.manualReference })}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transactions Tab Content */}
          {(activeTab === "all" || activeTab === "transactions") && filteredTransactions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-1">
                📝 TRANSACTION LEDGER & SEQUENCE MATCHES ({filteredTransactions.length})
              </h3>
              <div className="overflow-x-auto border rounded-xl bg-white shadow-sm dark:bg-slate-950 dark:border-slate-850">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 uppercase text-[10px] font-black text-slate-500 border-b dark:bg-slate-900 dark:border-slate-850 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Voucher</th>
                      <th className="px-4 py-3">Triple Sequence Serials</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Lines & Accounts</th>
                      <th className="px-4 py-3 text-right">Debit Amount</th>
                      <th className="px-4 py-3 text-right">Credit Amount</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-850 font-medium text-slate-800 dark:text-slate-200">
                    {filteredTransactions.map(t => {
                      const firstLine = t.roznamcha_lines?.[0];
                      const secondLine = t.roznamcha_lines?.[1];
                      const debitAmount = firstLine?.debit || 0;
                      const creditAmount = firstLine?.credit || 0;
                      const currencyText = firstLine?.currency || "USD";

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                          <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">{t.voucher_no}</td>
                          <td className="px-4 py-3 font-mono text-[10px] text-slate-400">
                            {[t.super_admin_serial_number, t.country_transaction_serial_number, t.branch_transaction_serial_number].filter(Boolean).join(" / ") || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">{t.entry_date}</td>
                          <td className="px-4 py-3 space-y-0.5">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{firstLine?.ledgers?.name || "Counterparty"}</div>
                            <div className="text-[10px] text-slate-400">vs {secondLine?.ledgers?.name || "Cash/Bank Account"}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-600 font-bold">
                            {debitAmount > 0 ? `${fmtAmount(debitAmount)} ${currencyText}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-rose-600 font-bold">
                            {creditAmount > 0 ? `${fmtAmount(creditAmount)} ${currencyText}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                              t.status === "posted" || t.status === "approved"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900"
                                : t.status === "draft"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
                                : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900"
                            )}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" title="View Transaction" onClick={() => handleViewTransaction(t.id)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500" title="Edit Transaction" onClick={() => handleEditTransaction(t.id)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" title="WhatsApp Export" onClick={() => handleWhatsApp("+923001234567", `Transaction Code: ${t.voucher_no} saved. Details: ${t.narration || "-"}`)}>
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600" title="Print Voucher" onClick={() => handlePrint(`Voucher: ${t.voucher_no}`, { "Voucher No": t.voucher_no, Date: t.entry_date, Narration: t.narration, Status: t.status, "Debit Amt": debitAmount, "Credit Amt": creditAmount })}>
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-teal-600" title="Export JSON" onClick={() => handleExportPDF(`Voucher_${t.voucher_no}`, t)}>
                                <DownloadActionIcon className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredCustomers.length === 0 && filteredTransactions.length === 0 && (
            <Card className="rounded-xl border border-dashed border-slate-200 p-12 text-center bg-white dark:bg-slate-950 dark:border-slate-800">
              <CardContent className="space-y-3">
                <SlidersHorizontal className="h-10 w-10 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Query Results Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Try typing a different name, manual reference, NTN number, or clear advanced search filters.
                </p>
                <Button size="sm" variant="outline" className="mt-2 text-xs font-semibold h-8" onClick={resetFilters}>
                  Clear All Filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function fmtAmount(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
