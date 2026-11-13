"use client";

import { pl } from "@/lib/reports/print-label";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, Edit3, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openSalesA4ReportWindow } from "@/lib/reports/open-sales-a4-report-window";
import { apiGet, apiPatch } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { deriveSalesBookingPostingState } from "@/lib/services/sales-booking-posting-state";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { resolveVerifiedTranslation, translationPendingLabel } from "@/lib/i18n/verified-record-translations";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { RecordTranslationCorrectionDialog } from "@/features/translations/components/record-translation-correction-dialog";
import { ERP_TABLE_STYLES } from "@/components/ui/erp-data-table";
import { TradeDocumentCenter } from "@/features/reports/components/trade-document-center";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { AddExpenseBillButton } from "@/features/expenses/components/add-expense-bill-button";
import { PurchasePageTop } from "@/components/purchase-ui/purchase-page-top";
import type { PayRow } from "@/features/purchases/components/purchase-payments-approved-header";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { useUsdRates } from "@/lib/purchase-ui/use-usd-rates";


type SalesOrder = {
  [key: string]: any;
  id: string;
  sales_order_no: string;
  sales_contract_no: string | null;
  order_date: string;
  customer_name: string | null;
  product_summary: string | null;
  quantity: number;
  total_weight: number;
  currency_code: string;
  exchange_rate: number;
  order_total: number;
  paid_amount: number;
  remaining_amount: number;
  sales_status: string;
  payment_status: string;
  delivery_status: string;
  form_data?: any;
  created_at: string;
  translations?: Record<string, Partial<Record<"en" | "ur" | "ar" | "fa" | "ps", string>>>;
};

const lifecycleTabs = [
  "Dashboard Overview",
  "Draft Sales Bookings",
  "Confirmed Sales",
  "Finalized Orders"
] as const;

// Canonical English value -> translation key. The stored/compared tab value stays the
// canonical English string (activeTab is compared against these constants elsewhere);
// only the visible label is translated.
const LIFECYCLE_TAB_LABEL_KEYS: Record<string, string> = {
  "Dashboard Overview": "sales.sodash_tab_dashboard_overview",
  "Draft Sales Bookings": "sales.sodash_tab_draft_bookings",
  "Confirmed Sales": "sales.sodash_tab_confirmed_sales",
  "Finalized Orders": "sales.sodash_tab_finalized_orders",
};

type LifecycleTab = (typeof lifecycleTabs)[number];

/** Lifecycle stage filter (pure). Statuses are matched exactly as the API stores them. */
function filterByTab(list: SalesOrder[], tab: LifecycleTab): SalesOrder[] {
  if (tab === "Dashboard Overview") return list;
  if (tab === "Draft Sales Bookings") return list.filter(o => o.sales_status === "draft");
  if (tab === "Confirmed Sales") return list.filter(o => o.sales_status === "Confirmed" || o.sales_status === "confirmed");
  if (tab === "Finalized Orders") return list.filter(o => o.sales_status === "Finalized" || o.sales_status === "finalized");
  return list;
}

/**
 * Sales rows -> the PayRow shape the shared Purchase Booking page top reads. Money is in the booking (final) currency.
 * order_total is saved ALREADY converted to the final currency (see app/api/erp/sales/orders/route.ts and the payments
 * route, which divides it by the rate to get USD), so total = order_total; paid_amount is kept in the original currency,
 * so paid = paid_amount x exchange_rate.
 * Receipts so far travel in PayRow.advance; the sales list has no advance / remaining / credit split, so those stay 0.
 */
function salesOrdersToPayRows(list: SalesOrder[]): PayRow[] {
  return list.map((o) => {
    const raw = o.form_data || {};
    const f = raw.form || {};
    const rate = Number(o.exchange_rate || 1);
    const total = Number(o.order_total || 0);
    const paid = Number(o.paid_amount || 0) * rate;
    const due = Math.max(0, total - paid);
    return {
      country: String(o.country_name || f.branchCountry || "—"),
      currency: String(o.currency_code || "AED").toUpperCase(),
      total,
      advance: paid,
      remainingPaid: 0,
      credit: 0,
      due,
      settled: due <= 0.01 && total > 0,
    };
  });
}

export function SalesOrderManagementDashboard({ initialStage }: { initialStage?: string }) {
  const activeLang = useActiveLanguage();
  const router = useRouter();
  const scope = useErpScope();
  const usdRates = useUsdRates();
  const [activeTab, setActiveTab] = useState<LifecycleTab>("Dashboard Overview");
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [tradeDocsOrder, setTradeDocsOrder] = useState<SalesOrder | null>(null);
  const localized = (order: SalesOrder, field: string, fallback: string) =>
    resolveVerifiedTranslation(order.translations?.[field], activeLang) || fallback || translationPendingLabel(activeLang);
  const tr = (label: string) => translateHeader(activeLang, label);
  const pageTitle = t(activeLang, "nav.sales_order_management", "Sales Order Management");

  // Load orders
  async function loadOrders() {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (search.trim()) qp.set("q", search.trim());
      const res = await apiGet<{ salesOrders: SalesOrder[] }>(`/api/erp/sales/orders?${qp.toString()}`);
      setOrders(res.salesOrders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (initialStage === "booking") {
      setActiveTab("Draft Sales Bookings");
    } else if (initialStage === "confirm") {
      setActiveTab("Confirmed Sales");
    }
  }, [initialStage]);

  // Transition Stage Actions
  async function transitionStatus(orderId: string, nextStatus: string) {
    setUpdatingId(orderId);
    try {
      await apiPatch(`/api/erp/sales/orders/${orderId}`, {
        salesStatus: nextStatus
      });
      await loadOrders();
    } catch (err: any) {
      alert(t(activeLang, "sales.sodash_err_update_status", "Failed to update sales order status: ") + err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // Filtered lists
  const applyTabFilter = (list: SalesOrder[]) => filterByTab(list, activeTab);
  const filtered = useMemo(() => applyTabFilter(orders),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, activeTab]);
  const pageRows = useMemo(() => salesOrdersToPayRows(filtered), [filtered]);

  // Flat print row mirroring the on-screen table columns.
  const toPrintRow = (order: SalesOrder): Record<string, unknown> => {
    const raw = order.form_data || {};
    const f = raw.form || {};
    const exRate = Number(order.exchange_rate || 1);
    // order_total is in the final currency; the original-currency amount is order_total / rate
    const purchaseAmount = Number(order.order_total || 0) / exRate;
    const invPct = Number(f.invoicePercentage || 100);
    const invoiceAmt = (purchaseAmount * invPct) / 100;
    const postingState = deriveSalesBookingPostingState(order as any);
    return {
      journal_serial: order.super_admin_serial_number || raw.traceability?.superAdminSerialNumber || "",
      country_serial: order.country_transaction_serial_number || raw.traceability?.countryTransactionSerialNumber || "",
      branch_serial: order.branch_transaction_serial_number || raw.traceability?.branchTransactionSerialNumber || "",
      sales_order_no: order.sales_order_no,
      order_date: order.order_date,
      customer: localized(order, "customer_name", order.customer_name || ""),
      user: f.userName || "",
      branch: localized(order, "branch_name", f.branchName || ""),
      country: localized(order, "country_name", f.branchCountry || ""),
      sales_account: localized(order, "sales_account_name", f.salesAccountName || ""),
      purchase_account: localized(order, "purchase_account_name", f.purchaseAccountName || ""),
      goods: localized(order, "product_name", order.product_summary || ""),
      brand: f.brand || "",
      size: f.size || "",
      quantity: order.quantity,
      unit: f.qtyName || "Bags",
      gross_weight: Number(f.grossWeight || 0),
      net_weight: order.total_weight,
      pur_currency: order.original_currency_code || "USD",
      exchange_rate: exRate.toFixed(4),
      final_currency: order.currency_code || "AED",
      pur_amount: purchaseAmount,
      invoice_pct: `${invPct}%`,
      invoice_amount: invoiceAmt,
      final_invoice_amount: invoiceAmt * exRate,
      payment_status: postingState.label,
      transfer_status: postingState.visualStatus === "red" ? "Pending" : order.sales_status,
    };
  };

  // API returns at most 200 orders per request (no paging); print re-queries with that
  // maximum, same search term and same lifecycle-tab filter as the screen.
  async function fetchAllOrdersForPrint(): Promise<Record<string, unknown>[]> {
    const qp = new URLSearchParams();
    if (search.trim()) qp.set("q", search.trim());
    qp.set("limit", "200");
    const res = await apiGet<{ salesOrders: SalesOrder[] }>(`/api/erp/sales/orders?${qp.toString()}`);
    return applyTabFilter(res.salesOrders || []).map(toPrintRow);
  }

  // Print helper
  function handlePrint(order: SalesOrder) {
    const raw = order.form_data || {};
    const reportData = {
      id: order.id,
      salesBookingOrderNumber: order.sales_order_no,
      salesDate: order.order_date,
      bookingDate: order.created_at,
      salesAccountName: raw.form?.salesAccountName || "-",
      salesAccountNumber: raw.form?.salesAccountNo || "-",
      purchaseAccountName: raw.form?.purchaseAccountName || "-",
      purchaseAccountNumber: raw.form?.purchaseAccountNo || "-",
      supplierName: raw.form?.supplierName || "-",
      customerName: order.customer_name || raw.form?.customerName || "-",
      productName: order.product_summary || "-",
      goodsDescription: raw.form?.goodsName ? `${raw.form.goodsName} / ${raw.form.brand}` : "-",
      quantity: order.quantity,
      unit: raw.form?.qtyName || "BAGS",
      totalWeight: order.total_weight,
      containerCount: raw.form?.containerCount || 0,
      salesRate: raw.form?.coursePrice || 0,
      totalSalesAmount: order.order_total,
      currency: order.currency_code,
      status: order.sales_status,
      paymentStatus: order.payment_status,
      branchName: raw.form?.branchName || "-",
      countryName: raw.form?.branchCountry || "-",
      createdAt: order.created_at,
      form_data: order.form_data,
      audit: {
        userName: raw.form?.userName || t(activeLang, "sales.sodash_admin_user", "Admin User"),
        userId: raw.form?.userId || "USR-001",
        branchCode: raw.form?.branchCode || "QTA"
      }
    };

    openSalesA4ReportWindow({
      title: t(activeLang, "sales.sodash_booking_invoice_title", "Sales Booking Invoice"),
      salesData: reportData
    });
  }

  // Toolbar / filter dialog: Reset clears the search and returns to the Dashboard Overview stage; Apply closes the dialog and reloads.
  const resetFilters = () => { setSearch(""); setActiveTab("Dashboard Overview"); };
  const applyFilters = () => { setFiltersOpen(false); void loadOrders(); };

  // Menu slot of the page toolbar: the register's print / PDF / Excel menu and the create action.
  const toolbarMenu = (
    <div className="flex items-center gap-2">
      <JournalPrintButton
        variant="menu"
        title={pageTitle}
        subtitle={t(activeLang, LIFECYCLE_TAB_LABEL_KEYS[activeTab] as never, activeTab)}
        columns={[
          { key: "journal_serial", label: pl("Journal Serial"), align: "center" },
          { key: "country_serial", label: pl("Country Serial"), align: "center" },
          { key: "branch_serial", label: pl("Branch Serial"), align: "center" },
          { key: "sales_order_no", label: pl("Sales Order No"), align: "center" },
          { key: "order_date", label: pl("Date"), format: "date" },
          { key: "customer", label: pl("Customer") },
          { key: "user", label: pl("User") },
          { key: "branch", label: pl("Branch") },
          { key: "country", label: pl("Country") },
          { key: "sales_account", label: pl("Sales Account") },
          { key: "purchase_account", label: pl("Purchase Account") },
          { key: "goods", label: pl("Goods Name") },
          { key: "brand", label: pl("Brand") },
          { key: "size", label: pl("Goods Size") },
          { key: "quantity", label: pl("Quantity"), align: "right", format: "number" },
          { key: "unit", label: pl("Unit"), align: "center" },
          { key: "gross_weight", label: pl("Gross Wt (KG)"), align: "right", format: "number" },
          { key: "net_weight", label: pl("Net Wt (KG)"), align: "right", format: "number" },
          { key: "pur_currency", label: pl("Pur Currency"), align: "center" },
          { key: "exchange_rate", label: pl("Ex. Rate"), align: "right" },
          { key: "final_currency", label: pl("Final Currency"), align: "center" },
          { key: "pur_amount", label: pl("Pur Amount"), align: "right", format: "number" },
          { key: "invoice_pct", label: pl("Invoice %"), align: "right" },
          { key: "invoice_amount", label: pl("Invoice Amount"), align: "right", format: "number" },
          { key: "final_invoice_amount", label: pl("Final Invoice Amount"), align: "right", format: "number" },
          { key: "payment_status", label: pl("Payment Status"), align: "center", format: "status" },
          { key: "transfer_status", label: pl("Transfer Status"), align: "center", format: "status" },
        ]}
        rows={filtered.map(toPrintRow)}
        fetchFullData={fetchAllOrdersForPrint}
        filters={[
          ...(search.trim() ? [{ label: t(activeLang, "sales.sodash_search_ph" as never, "Search"), value: search.trim() }] : []),
          { label: "Status", value: t(activeLang, LIFECYCLE_TAB_LABEL_KEYS[activeTab] as never, activeTab) },
        ]}
        orientation="landscape"
      />
      <Button
        onClick={() => router.push("/dashboard/sales/new-sales-booking-order")}
        className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 rounded-lg shadow-md shadow-blue-100"
      >
        + {t(activeLang, "sales.sodash_create_booking", "Create Booking")}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4 text-slate-800 bg-white dark:bg-slate-950 dark:text-slate-100 min-h-screen pb-16">

      {/* Approved Purchase Booking page top (title, one toolbar, reports panel, and the Summary / Booking Status / Country Wise
          cards). Every figure is computed from the rows this page loaded, in the booking (final) currency. */}
      <PurchasePageTop
        lang={activeLang}
        title={pageTitle}
        superAdmin={scope.isSuperAdmin}
        icon={BadgeDollarSign}
        breadcrumb={[tr("Dashboard"), tr("Sales & Trade"), pageTitle]}
        rows={pageRows}
        rates={usdRates}
        reports={[
          { label: tr("Sales Booking"), href: "/dashboard/sales/sales-order" },
          { label: tr("Sales Booking Journal"), href: "/dashboard/sales/sales-booking-journal-report" },
          { label: tr("Sales Confirm"), href: "/dashboard/sales/sales-confirm" },
          { label: tr("Local Sales"), href: "/dashboard/sales/local-sales" },
        ]}
        labels={{
          summary: tr("Sales Booking Summary"),
          totalBills: tr("Total Orders"),
          totalAmount: tr("Total Sales"),
          totalPaid: tr("Total Received"),
          balance: tr("Balance (To Be Received)"),
          countryTitle: tr("Country Wise Sales Booking"),
          countryAmount: tr("Sales Amount"),
        }}
        search={search}
        onSearch={setSearch}
        searchPlaceholder={t(activeLang, "sales.sodash_search_ph", "Search order no, customer...")}
        filterCount={activeTab === "Dashboard Overview" ? 0 : 1}
        onOpenFilters={() => setFiltersOpen(true)}
        onReset={resetFilters}
        onRefresh={() => { void loadOrders(); }}
        onApply={applyFilters}
        loading={loading}
        menu={toolbarMenu}
      />

      {/* FILTER DIALOG (opened from the page toolbar): stage selector with counts, Reset / Apply */}
      {filtersOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onClick={() => setFiltersOpen(false)} role="presentation">
          <div role="dialog" aria-modal="true" aria-label={tr("Filter")} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.45),0_2px_0_0_#e2e8f0] dark:border-slate-800 dark:from-slate-950 dark:to-slate-900 animate-in fade-in duration-200">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">{tr("Filter")}</span>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label={tr("Close")} className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer dark:bg-slate-800 dark:text-slate-300">×</button>
            </div>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{tr("Select Stage")}</span>
              <select value={activeTab} onChange={(e) => setActiveTab(e.target.value as LifecycleTab)} aria-label={tr("Select Stage")}
                className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                {lifecycleTabs.map((tab) => (
                  <option key={tab} value={tab}>
                    {t(activeLang, LIFECYCLE_TAB_LABEL_KEYS[tab] as never, tab)} ({filterByTab(orders, tab).length})
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={resetFilters} className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-700 cursor-pointer dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">{tr("Reset")}</button>
              <button type="button" onClick={applyFilters} className="h-8 px-4 rounded-lg bg-[#2563eb] text-white text-[11px] font-bold shadow-[0_3px_0_0_#1e40af] cursor-pointer">{tr("Apply")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Register: the same section frame as the Purchase Booking table */}
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-4 space-y-4">
        <div className="flex flex-col items-center justify-center text-center w-full py-3 border-b border-slate-100 dark:border-slate-800/60">
          <h2 className="text-sm font-black tracking-widest text-slate-800 dark:text-slate-100 uppercase">{tr("Transaction Log & Search Report")}</h2>
          <p className="text-[11px] text-slate-400 mt-1.5 font-medium tracking-wide">{t(activeLang, "sales.sodash_subtitle", "Real-time sales order tracking across every country and branch.")}</p>
        </div>

      {/* Master Data Grid with grouped header columns */}
      <div className={ERP_TABLE_STYLES.container}>
        <div className={ERP_TABLE_STYLES.scrollWrapper}>
          <table className={ERP_TABLE_STYLES.table}>
            <thead className={ERP_TABLE_STYLES.thead}>
              {/* Group Header Row */}
              <tr className="border-b border-slate-200 dark:border-slate-800 text-center">
                <Th colSpan={9} className="px-3 py-2 bg-blue-50/70 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300 font-extrabold border-r border-slate-200 dark:border-slate-800">General Information</Th>
                <Th colSpan={2} className="px-3 py-2 bg-purple-50/70 text-purple-900 dark:bg-purple-950/40 dark:text-purple-300 font-extrabold border-r border-slate-200 dark:border-slate-800">Account Mappings</Th>
                <Th colSpan={7} className="px-3 py-2 bg-emerald-50/70 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 font-extrabold border-r border-slate-200 dark:border-slate-800">Product Details</Th>
                <Th colSpan={9} className="px-3 py-2 bg-indigo-50/70 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 font-extrabold border-r border-slate-200 dark:border-slate-800">Financial Metrics</Th>
                <Th colSpan={1} className="px-3 py-2 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-extrabold">Actions</Th>
              </tr>
              {/* Column Headers Row */}
              <tr className="bg-slate-50/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                {/* General */}
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Journal Serial</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Country Serial</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Branch Serial</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Sales Order No</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Date</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Customer</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">User</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Branch</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Country</Th>
                
                {/* Accounts */}
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Sales Account</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Purchase Account</Th>
                
                {/* Product */}
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Goods Name</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Brand</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Goods Size</Th>
                <Th className="px-3 py-2 text-right border-r border-slate-200 dark:border-slate-800">Quantity</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Unit</Th>
                <Th className="px-3 py-2 text-right border-r border-slate-200 dark:border-slate-800">Gross Wt (KG)</Th>
                <Th className="px-3 py-2 text-right border-r border-slate-200 dark:border-slate-800">Net Wt (KG)</Th>

                {/* Financials */}
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Pur Currency</Th>
                <Th className="px-3 py-2 text-right border-r border-slate-200 dark:border-slate-800">Ex. Rate</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Final Currency</Th>
                <Th className="px-3 py-2 text-right border-r border-slate-200 dark:border-slate-800">Pur Amount</Th>
                <Th className="px-3 py-2 text-right border-r border-slate-200 dark:border-slate-800">Invoice %</Th>
                <Th className="px-3 py-2 text-right border-r border-slate-200 dark:border-slate-800">Invoice Amount</Th>
                <Th className="px-3 py-2 text-right border-r border-slate-200 dark:border-slate-800">Final Invoice Amount</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Payment Status</Th>
                <Th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Transfer Status</Th>

                {/* Actions */}
                <Th className="px-3 py-2 text-center">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={28} className="px-6 py-12 text-center text-slate-400 font-medium">{t(activeLang, "sales.sodash_loading_bookings", "Loading sales bookings...")}</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={28} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">{t(activeLang, "sales.sodash_no_bookings_stage", "No sales bookings in this stage.")}</td>
                </tr>
              ) : (
                filtered.map((order) => {
                  const raw = order.form_data || {};
                  const f = raw.form || {};
                  
                  const exRate = Number(order.exchange_rate || 1);
                  // order_total is in the final currency; the original-currency amount is order_total / rate
                  const purchaseAmount = Number(order.order_total || 0) / exRate;
                  const finalAmount = purchaseAmount * exRate;

                  const invPct = Number(f.invoicePercentage || 100);
                  const invoiceAmt = (purchaseAmount * invPct) / 100;
                  const finalInvoiceAmount = invoiceAmt * exRate;
                  const postingState = deriveSalesBookingPostingState(order as any);

                  const branchName = f.branchName || "—";
                  const branchCountry = f.branchCountry || "—";
                  const userDisplayName = f.userName || "—";

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800/80">
                      {/* General Information */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">{order.super_admin_serial_number || raw.traceability?.superAdminSerialNumber || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">{order.country_transaction_serial_number || raw.traceability?.countryTransactionSerialNumber || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">{order.branch_transaction_serial_number || raw.traceability?.branchTransactionSerialNumber || "—"}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">{order.sales_order_no}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 font-mono">{order.order_date}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 border-r border-slate-100 dark:border-slate-800 truncate max-w-[120px]" title={order.customer_name || "-"}>{localized(order, "customer_name", order.customer_name || "—")}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 truncate max-w-[80px]" title={userDisplayName}>{userDisplayName}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 truncate max-w-[80px]" title={branchName}>{localized(order, "branch_name", branchName)}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 truncate max-w-[80px]" title={branchCountry}>{localized(order, "country_name", branchCountry)}</td>
                      
                      {/* Accounts */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 font-medium border-r border-slate-100 dark:border-slate-800 truncate max-w-[100px]" title={f.salesAccountName || "-"}>{localized(order, "sales_account_name", f.salesAccountName || "—")}</td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 font-medium border-r border-slate-100 dark:border-slate-800 truncate max-w-[100px]" title={f.purchaseAccountName || "-"}>{localized(order, "purchase_account_name", f.purchaseAccountName || "—")}</td>

                      {/* Product */}
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 border-r border-slate-100 dark:border-slate-800 truncate max-w-[120px]" title={order.product_summary || "-"}>{localized(order, "product_name", order.product_summary || "—")}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">{f.brand || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">{f.size || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">{order.quantity?.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">{f.qtyName || "Bags"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">{Number(f.grossWeight || 0).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-blue-600 dark:text-blue-400 font-bold border-r border-slate-100 dark:border-slate-800">{order.total_weight?.toLocaleString()}</td>

                      {/* Financials */}
                      <td className="px-3 py-2.5 font-black text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">{order.original_currency_code || "USD"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">{exRate.toFixed(4)}</td>
                      <td className="px-3 py-2.5 font-black text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">{order.currency_code || "AED"}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">${purchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">{invPct}%</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">${invoiceAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 border-r border-slate-100 dark:border-slate-800">{order.currency_code} {finalInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5 border-r border-slate-100 dark:border-slate-800 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                          postingState.visualStatus === "red"
                            ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40"
                            : "bg-[#0F172A] text-white border border-slate-900 dark:bg-slate-800 dark:text-slate-100"
                        }`}>
                          {postingState.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-100 dark:border-slate-800 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                          postingState.visualStatus === "red"
                            ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40"
                            : order.sales_status === "draft"
                            ? "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                            : order.sales_status === "Confirmed" || order.sales_status === "confirmed"
                              ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                        }`}>
                          {postingState.visualStatus === "red" ? "Pending" : order.sales_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <RecordTranslationCorrectionDialog recordTable="sales_orders" recordId={order.id} onSaved={loadOrders} />
                          <AddExpenseBillButton sourceId={order.id} lang={activeLang} size="icon" variant="outline" className="h-8 w-8 p-0" />
                          {!["transferred", "finalized", "completed"].includes(String(order.sales_status || "").toLowerCase()) && (
                            <Button
                              onClick={() => router.push(`/dashboard/sales/new-sales-booking-order?id=${encodeURIComponent(order.id)}`)}
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                              title={t(activeLang, "common.edit", "Edit Sales Order")}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            onClick={() => handlePrint(order)}
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                            title={t(activeLang, "sales.sodash_print_sales_order_title", "Print Sales Order")}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={() => setTradeDocsOrder(order)}
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                            title={t(activeLang, "tdoc.center_title", "Commercial Document Center")}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          
                          {order.sales_status === "draft" && (
                            <Button
                              disabled={updatingId === order.id}
                              onClick={() => transitionStatus(order.id, "Confirmed")}
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 rounded-lg shadow-sm"
                            >{t(activeLang, "sales.sodash_confirm_booking_btn", "Confirm Booking")}</Button>
                          )}

                          {(order.sales_status === "Confirmed" || order.sales_status === "confirmed") && (
                            <Button
                              disabled={updatingId === order.id}
                              onClick={() => transitionStatus(order.id, "Finalized")}
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 rounded-lg shadow-sm"
                            >{t(activeLang, "sales.sodash_finalize_post_gl_btn", "Finalize & Post GL")}</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
        </div>
      </div>
      </section>

      {tradeDocsOrder && (
        <TradeDocumentCenter
          open={!!tradeDocsOrder}
          onClose={() => setTradeDocsOrder(null)}
          txnKind="sales"
          record={tradeDocsOrder as any}
          companyId={(tradeDocsOrder as any).form_data?.form?.salesCompanyId || (tradeDocsOrder as any).seller_company_id || (tradeDocsOrder as any).company_id || null}
          scope={{
            countryId: (tradeDocsOrder as any).country_id || null,
            countryBranchId: (tradeDocsOrder as any).country_branch_id || null,
            cityBranchId: (tradeDocsOrder as any).city_branch_id || null,
            countryName: (tradeDocsOrder as any).country_name || null,
            branchName: (tradeDocsOrder as any).branch_name || null,
          }}
        />
      )}
    </div>
  );
}
