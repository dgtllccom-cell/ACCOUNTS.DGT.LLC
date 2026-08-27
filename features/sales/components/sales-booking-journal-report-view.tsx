"use client";

import { useEffect, useState, useMemo } from "react";
import { Download, Mail, MoreVertical, Printer, RefreshCcw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import { translateHeader } from "@/lib/i18n/table-headers";
import { apiGet } from "@/lib/api/client";
import { ReportKpiCards } from "@/features/reports/components/report-kpi-cards";
import { ReportPagination } from "@/features/reports/components/report-pagination";
import { ReportStatusLegend } from "@/features/reports/components/report-status-legend";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { resolveVerifiedTranslation, translationPendingLabel } from "@/lib/i18n/verified-record-translations";
import { t } from "@/lib/i18n/ui";
import { RecordTranslationCorrectionDialog } from "@/features/translations/components/record-translation-correction-dialog";
type SalesReport = {
  [key: string]: any;
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
  translations?: Record<string, Partial<Record<"en" | "ur" | "ar" | "fa" | "ps", string>>>;
  audit: {
    userName: string;
    userId: string;
    branchCode: string;
  };
};

export function SalesBookingJournalReportView() {
  const activeLang = useActiveLanguage();
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

  const localized = (row: SalesReport, field: string, fallback: string) =>
    resolveVerifiedTranslation(row.translations?.[field], activeLang) || fallback || translationPendingLabel(activeLang);

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
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_booking_register.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function printSalesRegister() {
    const tr = (label: string) => translateHeader(activeLang, label);

    openUniversalPrintReport({
      title: tr("Sales Booking Confirmation Register"),
      subtitle: `${tr("Total Records")}: ${reports.length}`,
      lang: activeLang,
      moduleType: "sales_invoice",
      orientation: "landscape",
      scope: {
        scopeLevel: "Sales Booking Register",
        userName: "ERP User",
      },
      kpis: [
        { label: tr("Total Sales Amount"), value: summary.amount, color: "blue" },
        { label: tr("Total Quantity"), value: summary.qty, color: "emerald" },
        { label: tr("Total Containers"), value: summary.containers, color: "purple" },
        { label: tr("Total Orders"), value: summary.total, color: "amber" },
      ],
      filters: [
        ...(query ? [{ label: tr("Search Query"), value: query }] : []),
        ...(countryId ? [{ label: tr("Country"), value: countries.find(c => c.id === countryId)?.name || countryId }] : []),
        ...(branchId ? [{ label: tr("Branch"), value: branches.find(b => b.id === branchId)?.name || branchId }] : []),
        ...(status ? [{ label: tr("Status"), value: status }] : []),
      ],
      columns: [
        { key: "salesBookingOrderNumber", label: tr("SO Number"), width: "12%" },
        { key: "salesDate", label: tr("Date"), format: "date", width: "9%" },
        { key: "customerName", label: tr("Customer"), width: "15%" },
        { key: "goodsDescription", label: tr("Goods / Description"), width: "18%" },
        { key: "quantity", label: tr("Quantity"), align: "right", format: "number", width: "7%" },
        { key: "unit", label: tr("Unit"), align: "center", width: "5%" },
        { key: "currency", label: tr("Currency"), align: "center", width: "6%" },
        { key: "totalSalesAmount", label: tr("Total Amount"), align: "right", format: "currency", width: "13%" },
        { key: "status", label: tr("Status"), align: "center", format: "badge", width: "8%" },
        { key: "paymentStatus", label: tr("Payment"), align: "center", format: "badge", width: "7%" },
      ],
      rows: reports.map(r => ({
        salesBookingOrderNumber: r.salesBookingOrderNumber || "-",
        salesDate: r.salesDate || r.bookingDate || r.createdAt,
        customerName: r.customerName || "-",
        goodsDescription: r.goodsDescription || r.productName || "-",
        quantity: r.quantity || 0,
        unit: r.unit || "BAGS",
        currency: r.currency || "USD",
        totalSalesAmount: r.totalSalesAmount || r.salesAmount || 0,
        status: r.status || "CONFIRMED",
        paymentStatus: r.paymentStatus || "PENDING",
      })),
      totals: {
        totalSalesAmount: summary.amount,
        quantity: summary.qty,
      },
      autoPrint: false,
    });
  }


  return (
    <div className="space-y-6 text-foreground">
      
      {/* Search & Filters */}
      <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{t(activeLang, "sales.sbjr_search_records", "Search Records")}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadReports(query);
              }}
              placeholder={t(activeLang, "sales.sbjr_search_ph", "Search sales order #, customer, brand...")}
              className="bg-background border-input pl-9 text-xs text-foreground placeholder:text-muted-foreground h-10 shadow-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{t(activeLang, "report.country", "Country")}</label>
          <select
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            className="bg-background border border-input rounded-lg px-3 h-10 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
          >
            <option value="">{t(activeLang, "common.all_countries", "All Countries")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{t(activeLang, "sales.sbjr_branch_scope", "Branch Scope")}</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={!countryId}
            className="bg-background border border-input rounded-lg px-3 h-10 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm disabled:opacity-50"
          >
            <option value="">{t(activeLang, "common.all_branches", "All Branches")}</option>
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
            onClick={printSalesRegister}
            disabled={reports.length === 0}
            variant="outline"
            className="border-input bg-background text-foreground font-bold h-10 text-xs px-4 shadow-sm gap-1.5"
          >
            <Printer className="h-4 w-4 text-blue-600" /> {t(activeLang, "common.print", "Print Report")}
          </Button>

          <Button
            onClick={exportCsv}
            disabled={reports.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 text-xs px-4 shadow-sm"
          >
            <Download className="h-4 w-4 mr-2" /> {t(activeLang, "sales.sbjr_export_csv", "Export CSV")}
          </Button>
        </div>
      </div>


      {/* Top 5 KPI Summary Cards Grid */}
      <ReportKpiCards
        lang="en"
        reportType="sales"
        currency="USD"
        isLoading={loading}
        summary={{
          records: summary.total,
          totalSales: summary.amount,
          totalAmount: summary.amount,
          draft: reports.filter(r => r.status === "Draft" || r.status === "Open").length,
          accepted: reports.filter(r => r.status === "Accepted" || r.status === "Confirmed").length,
          transferred: reports.filter(r => r.status === "Transferred" || r.status === "Posted").length,
          completed: reports.filter(r => r.status === "Completed" || r.status === "Finalized").length,
          totalBranches: countries.length > 0 ? countries.length * 2 : 10,
          activeBranches: countries.length > 0 ? countries.length * 2 : 10,
          quickInfo: { currency: "USD", exchangeRate: "1.0000", company: "DGT LLC", financialYear: "2025-26" }
        }}
      />

      {/* Report Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-muted/70 text-muted-foreground border-b border-border uppercase text-[11px] font-bold tracking-wider">
            <tr>
              <Th className="px-6 py-3.5">SO Number</Th>
              <Th className="px-6 py-3.5">Date</Th>
              <Th className="px-6 py-3.5">Customer Details</Th>
              <Th className="px-6 py-3.5">Products / Description</Th>
              <Th className="px-6 py-3.5">Quantity</Th>
              <Th className="px-6 py-3.5">Weight</Th>
              <Th className="px-6 py-3.5">Containers</Th>
              <Th className="px-6 py-3.5">Sales Total</Th>
              <Th className="px-6 py-3.5">Status</Th>
              <Th className="px-6 py-3.5 text-center">Print</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-muted-foreground font-medium">{t(activeLang, "sales.sbjr_loading_registry", "Loading sales booking registry...")}</td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">{t(activeLang, "sales.sbjr_no_orders_found", "No sales orders found.")}</td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        const totalAmt = Number(r.totalSalesAmount || r.salesAmount || 0);
                        const qty = Number(r.quantity || 0);
                        openUniversalPrintReport({
                          title: translateHeader(activeLang, "Sales Booking Invoice"),
                          subtitle: `${translateHeader(activeLang, "SO Ref")}: ${r.salesBookingOrderNumber || "-"}`,
                          documentNo: r.salesBookingOrderNumber || "SO-DOC",
                          reportType: "single_document",
                          moduleType: "sales_invoice",
                          orientation: "portrait",
                          lang: activeLang,
                          scope: {
                            scopeLevel: "Sales Booking Invoice",
                            country: r.countryName || "All Countries",
                            branch: r.branchName || "Main Branch",
                            currency: r.currency || "USD",
                            userName: r.audit?.userName || "ERP User",
                          },
                          partyDetails: {
                            type: "customer",
                            name: r.customerName || "-",
                            address: r.countryName || "-",
                            departmentOrBranch: r.branchName || "-",
                          },
                          kpis: [
                            { label: translateHeader(activeLang, "Total Amount"), value: totalAmt, color: "blue" },
                            { label: translateHeader(activeLang, "Quantity"), value: `${qty.toLocaleString()} ${r.unit || "BAGS"}`, color: "emerald" },
                            { label: translateHeader(activeLang, "Containers"), value: r.containerCount || 0, color: "purple" },
                            { label: translateHeader(activeLang, "Status"), value: r.status || "PENDING", color: "amber" },
                          ],
                          columns: [
                            { key: "item", label: translateHeader(activeLang, "Goods / Description"), width: "35%" },
                            { key: "quantity", label: translateHeader(activeLang, "Quantity"), align: "right", format: "number", width: "15%" },
                            { key: "rate", label: translateHeader(activeLang, "Unit Rate"), align: "right", format: "currency", width: "20%" },
                            { key: "total", label: translateHeader(activeLang, "Total Amount"), align: "right", format: "currency", width: "30%" },
                          ],
                          rows: [{
                            item: r.productName || r.goodsDescription || "Standard Goods",
                            quantity: qty,
                            rate: Number(r.salesRate || (qty > 0 ? totalAmt / qty : 0)),
                            total: totalAmt,
                          }],
                          totals: { total: totalAmt, quantity: qty },
                          showSignatures: true,
                          signatureBlocks: [
                            { title: translateHeader(activeLang, "Prepared By"), subtitle: r.audit?.userName || "Sales Officer" },
                            { title: translateHeader(activeLang, "Verified & Audited"), subtitle: "Accounts Department" },
                            { title: translateHeader(activeLang, "Authorized Signature"), subtitle: "Managing Director" },
                          ],
                          autoPrint: false,
                        });
                      }}
                      className="text-primary hover:underline font-bold text-left"
                    >
                      {r.salesBookingOrderNumber}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{r.salesDate?.split("T")[0]}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground">{localized(r, "customerName", r.customerName)}</div>
                    <div className="text-[11px] text-muted-foreground">{localized(r, "branchName", r.branchName)} "  {localized(r, "countryName", r.countryName)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-foreground">{localized(r, "productName", r.productName)}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-xs">{localized(r, "goodsDescription", r.goodsDescription)}</div>
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
                    <RecordTranslationCorrectionDialog recordTable="sales_orders" recordId={r.id} onSaved={() => loadReports(query)} />
                    <Button
                      onClick={() => {
                      const totalAmt = Number(r.totalSalesAmount || r.salesAmount || 0);
                      const qty = Number(r.quantity || 0);
                      openUniversalPrintReport({
                        title: translateHeader(activeLang, "Sales Booking Invoice"),
                        subtitle: `${translateHeader(activeLang, "SO Ref")}: ${r.salesBookingOrderNumber || "-"}`,
                        documentNo: r.salesBookingOrderNumber || "SO-DOC",
                        reportType: "single_document",
                        moduleType: "sales_invoice",
                        orientation: "portrait",
                        lang: activeLang,
                        scope: {
                          scopeLevel: "Sales Booking Invoice",
                          country: r.countryName || "All Countries",
                          branch: r.branchName || "Main Branch",
                          currency: r.currency || "USD",
                          userName: r.audit?.userName || "ERP User",
                        },
                        partyDetails: {
                          type: "customer",
                          name: r.customerName || "-",
                          address: r.countryName || "-",
                          departmentOrBranch: r.branchName || "-",
                        },
                        kpis: [
                          { label: translateHeader(activeLang, "Total Amount"), value: totalAmt, color: "blue" },
                          { label: translateHeader(activeLang, "Quantity"), value: `${qty.toLocaleString()} ${r.unit || "BAGS"}`, color: "emerald" },
                          { label: translateHeader(activeLang, "Containers"), value: r.containerCount || 0, color: "purple" },
                          { label: translateHeader(activeLang, "Status"), value: r.status || "PENDING", color: "amber" },
                        ],
                        columns: [
                          { key: "item", label: translateHeader(activeLang, "Goods / Description"), width: "35%" },
                          { key: "quantity", label: translateHeader(activeLang, "Quantity"), align: "right", format: "number", width: "15%" },
                          { key: "rate", label: translateHeader(activeLang, "Unit Rate"), align: "right", format: "currency", width: "20%" },
                          { key: "total", label: translateHeader(activeLang, "Total Amount"), align: "right", format: "currency", width: "30%" },
                        ],
                        rows: [{
                          item: r.productName || r.goodsDescription || "Standard Goods",
                          quantity: qty,
                          rate: Number(r.salesRate || (qty > 0 ? totalAmt / qty : 0)),
                          total: totalAmt,
                        }],
                        totals: { total: totalAmt, quantity: qty },
                        showSignatures: true,
                        signatureBlocks: [
                          { title: translateHeader(activeLang, "Prepared By"), subtitle: r.audit?.userName || "Sales Officer" },
                          { title: translateHeader(activeLang, "Verified & Audited"), subtitle: "Accounts Department" },
                          { title: translateHeader(activeLang, "Authorized Signature"), subtitle: "Managing Director" },
                        ],
                        autoPrint: false,
                      });
                    }}
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

      {/* Standardized Pagination */}
      <ReportPagination
        totalCount={reports.length}
        page={1}
        pageSize={50}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />

      {/* Standardized Status Legend */}
      <ReportStatusLegend
        statuses={["Draft", "Accepted", "Transferred", "Completed"]}
        notes={[
          "Confirmed / Accepted: Bill is confirmed and ready for posting.",
          "Finalized / Transferred: Bill has been posted to ledger."
        ]}
      />
    </div>
  );
}
