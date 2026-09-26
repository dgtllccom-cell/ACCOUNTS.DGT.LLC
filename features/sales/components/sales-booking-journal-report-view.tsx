"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Download, Mail, MoreVertical, Printer, RefreshCcw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import { translateHeader } from "@/lib/i18n/table-headers";
import { apiGet } from "@/lib/api/client";
import { UnifiedErpRegisterBar, UnifiedRegisterKpiData } from "@/components/reports/unified-erp-register-bar";
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
  const router = useRouter();
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

  const draftReports = useMemo(() => reports.filter(r => {
    const s = (r.status || "").toLowerCase();
    return s === "draft" || s === "open";
  }), [reports]);

  const acceptedReports = useMemo(() => reports.filter(r => {
    const s = (r.status || "").toLowerCase();
    return s === "accepted" || s === "confirmed";
  }), [reports]);

  const transferredReports = useMemo(() => reports.filter(r => {
    const s = (r.status || "").toLowerCase();
    return s === "transferred" || s === "posted";
  }), [reports]);

  const completedReports = useMemo(() => reports.filter(r => {
    const s = (r.status || "").toLowerCase();
    return s === "completed" || s === "finalized";
  }), [reports]);

  const acceptedAmount = useMemo(() => acceptedReports.reduce((sum, r) => sum + Number(r.totalSalesAmount || 0), 0), [acceptedReports]);
  const transferredAmount = useMemo(() => transferredReports.reduce((sum, r) => sum + Number(r.totalSalesAmount || 0), 0), [transferredReports]);
  const completedAmount = useMemo(() => completedReports.reduce((sum, r) => sum + Number(r.totalSalesAmount || 0), 0), [completedReports]);

  const kpiSummary: UnifiedRegisterKpiData = useMemo(() => ({
    totalRecords: reports.length,
    draftCount: draftReports.length,
    acceptedCount: acceptedReports.length,
    transferredCount: transferredReports.length,
    completedCount: completedReports.length,
    currency: reports[0]?.currency || "USD",
    totalAmount: summary.amount,
    acceptedAmount,
    transferredAmount,
    completedAmount,
    totalBranches: Math.max(branches.length, 1),
    activeBranches: Math.max(branches.length, 1),
    inactiveBranches: 0,
    thisMonthCreated: reports.length,
    thisMonthAmount: summary.amount,
    thisMonthTransferred: transferredReports.length,
    thisMonthCompleted: completedReports.length,
    quickInfo: {
      currency: reports[0]?.currency || "USD",
      exchangeRate: "1.0000",
      company: "DGT LLC",
      financialYear: "2026",
      userName: reports[0]?.audit?.userName || "Sales User",
      branchName: reports[0]?.branchName || "Main Branch",
    }
  }), [reports, draftReports, acceptedReports, transferredReports, completedReports, summary.amount, acceptedAmount, transferredAmount, completedAmount, branches]);

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
      <UnifiedErpRegisterBar
        title={t(activeLang, "sales.sbjr_title", "Sales Booking Journal Report")}
        subtitle={t(activeLang, "sales.sbjr_subtitle", "Master Sales Register & Country Scope Overview")}
        countries={countries}
        branches={branches}
        selectedCountry={countryId}
        selectedBranch={branchId}
        selectedStatus={status}
        onCountryChange={setCountryId}
        onBranchChange={setBranchId}
        onStatusChange={setStatus}
        searchText={query}
        onSearchChange={setQuery}
        searchPlaceholder={t(activeLang, "sales.sbjr_search_ph", "Search sales order #, customer, brand...")}
        onPrint={printSalesRegister}
        onResetRefresh={() => {
          setCountryId("");
          setBranchId("");
          setStatus("");
          setQuery("");
          void loadReports("");
        }}
        primaryAction={{
          label: t(activeLang, "sales.new_sales_booking", "+ New Sales Booking"),
          onClick: () => router.push("/dashboard/sales/new-sales-booking-order"),
        }}
        extraActions={[
          {
            label: t(activeLang, "sales.sbjr_export_csv", "Export CSV"),
            onClick: exportCsv,
          },
        ]}
        kpiSummary={kpiSummary}
        recordTypeName="Sales Orders"
      />

      {/* Report Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 uppercase text-[11px] font-bold tracking-wider">
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
