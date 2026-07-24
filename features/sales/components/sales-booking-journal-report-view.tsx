"use client";

import { useEffect, useState, useMemo } from "react";
import { Download, Mail, MoreVertical, Printer, RefreshCcw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openSalesA4ReportWindow } from "@/lib/reports/open-sales-a4-report-window";
import { apiGet } from "@/lib/api/client";

type SalesReport = {
  id: string;
  salesBookingOrderNumber: string;
  salesDate: string;
  bookingDate: string;
  salesAccountName: string;
  salesAccountNumber: string;
  customerName: string;
  productName: string;
  goodsDescription: string;
  quantity: number;
  unit: string;
  totalWeight: number;
  containerCount: number;
  salesRate: number;
  totalSalesAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  branchName: string;
  countryName: string;
  createdAt: string;
  form_data?: any;
  audit: {
    userName: string;
    userId: string;
    branchCode: string;
  };
};

export function SalesBookingJournalReportView() {
  const [reports, setReports] = useState<SalesReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  // Filters
  const [countryId, setCountryId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");

  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    async function loadFilters() {
      try {
        const res = await apiGet<{ countries: any[] }>("/api/erp/locations/countries");
        setCountries(res.countries || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadFilters();
  }, []);

  useEffect(() => {
    if (!countryId) {
      setBranches([]);
      setBranchId("");
      return;
    }
    async function loadBranches() {
      try {
        const res = await apiGet<{ ok: boolean; data: { branches: any[] } }>(`/api/erp/locations/branches/main?countryId=${countryId}`);
        if (res.ok && res.data?.branches) {
          setBranches(res.data.branches);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadBranches();
  }, [countryId]);

  async function loadReports(searchQuery = query) {
    setLoading(true);
    setError("");
    try {
      const qp = new URLSearchParams({ limit: "100" });
      if (searchQuery.trim()) qp.set("q", searchQuery.trim());
      if (countryId) qp.set("countryId", countryId);
      if (branchId) qp.set("countryBranchId", branchId);
      if (status) qp.set("q", status); // Status filter fallback in queries

      const res = await apiGet<{ reports: SalesReport[] }>(`/api/erp/sales/booking-journal-report?${qp.toString()}`);
      setReports(res.reports || []);
    } catch (err: any) {
      setError(err.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports(query).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, branchId, status]);

  const summary = useMemo(() => {
    return {
      total: reports.length,
      amount: reports.reduce((sum, r) => sum + Number(r.totalSalesAmount || 0), 0),
      qty: reports.reduce((sum, r) => sum + Number(r.quantity || 0), 0),
      containers: reports.reduce((sum, r) => sum + Number(r.containerCount || 0), 0)
    };
  }, [reports]);

  function exportCsv() {
    const headers = ["SO Number", "Date", "Customer", "Product Details", "Qty", "Total Weight", "Containers", "Amount", "Status", "Payment", "Delivery"];
    const rows = reports.map((r) => [
      r.salesBookingOrderNumber,
      r.salesDate?.split("T")[0],
      r.customerName,
      r.goodsDescription,
      r.quantity,
      r.totalWeight,
      r.containerCount,
      r.totalSalesAmount,
      r.status,
      r.paymentStatus,
      r.deliveryStatus
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_booking_register.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6 text-foreground">
      
      {/* Search & Filters */}
      <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Search Records</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadReports(query);
              }}
              placeholder="Search sales order #, customer, brand..."
              className="bg-background border-input pl-9 text-xs text-foreground placeholder:text-muted-foreground h-10 shadow-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Country</label>
          <select
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            className="bg-background border border-input rounded-lg px-3 h-10 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
          >
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Branch Scope</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={!countryId}
            className="bg-background border border-input rounded-lg px-3 h-10 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm disabled:opacity-50"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => void loadReports(query)}
            disabled={loading}
            variant="outline"
            className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground h-10 px-3 shadow-sm"
          >
            <RefreshCcw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
          </Button>

          <Button
            onClick={exportCsv}
            disabled={reports.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 text-xs px-4 shadow-sm"
          >
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <span className="text-xs text-muted-foreground font-semibold block uppercase tracking-wider mb-1">Total Sales Orders</span>
          <span className="text-2xl font-extrabold text-foreground">{summary.total}</span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <span className="text-xs text-muted-foreground font-semibold block uppercase tracking-wider mb-1">Total Weight</span>
          <span className="text-2xl font-extrabold text-foreground">{reports.reduce((sum, r) => sum + Number(r.totalWeight || 0), 0).toLocaleString()} <span className="text-xs font-semibold text-muted-foreground">KG</span></span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <span className="text-xs text-muted-foreground font-semibold block uppercase tracking-wider mb-1">Total Containers Booked</span>
          <span className="text-2xl font-extrabold text-primary">{summary.containers}</span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm bg-primary/5">
          <span className="text-xs text-primary font-bold block uppercase tracking-wider mb-1">Gross Sales Amount</span>
          <span className="text-2xl font-extrabold text-primary">{summary.amount.toLocaleString()} <span className="text-xs font-semibold">USD</span></span>
        </div>
      </div>

      {/* Report Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-muted/70 text-muted-foreground border-b border-border uppercase text-[11px] font-bold tracking-wider">
            <tr>
              <th className="px-6 py-3.5">SO Number</th>
              <th className="px-6 py-3.5">Date</th>
              <th className="px-6 py-3.5">Customer Details</th>
              <th className="px-6 py-3.5">Products / Description</th>
              <th className="px-6 py-3.5">Quantity</th>
              <th className="px-6 py-3.5">Weight</th>
              <th className="px-6 py-3.5">Containers</th>
              <th className="px-6 py-3.5">Sales Total</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-center">Print</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-muted-foreground font-medium">Loading sales booking registry...</td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">No sales orders found.</td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-mono">
                    <button
                      type="button"
                      onClick={() => openSalesA4ReportWindow({ title: "Sales Booking Invoice", salesData: r })}
                      className="text-primary hover:underline font-bold text-left"
                    >
                      {r.salesBookingOrderNumber}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{r.salesDate?.split("T")[0]}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground">{r.customerName}</div>
                    <div className="text-[11px] text-muted-foreground">{r.branchName} • {r.countryName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-foreground">{r.productName}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-xs">{r.goodsDescription}</div>
                  </td>
                  <td className="px-6 py-4 text-foreground font-medium">{r.quantity?.toLocaleString()} {r.unit}</td>
                  <td className="px-6 py-4 text-foreground font-medium">{r.totalWeight?.toLocaleString()} KG</td>
                  <td className="px-6 py-4 font-mono font-bold text-primary">{r.containerCount}</td>
                  <td className="px-6 py-4 font-extrabold text-foreground">{r.totalSalesAmount?.toLocaleString()} {r.currency}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      r.status === "Finalized" || r.status === "Confirmed"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button
                      onClick={() => openSalesA4ReportWindow({ title: "Sales Booking Invoice", salesData: r })}
                      variant="outline"
                      size="sm"
                      className="border-input bg-background hover:bg-accent text-foreground text-xs px-2.5 py-1 h-auto shadow-sm"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" /> Print
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
