"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  BadgeDollarSign, 
  Boxes, 
  CheckCircle2, 
  Clock3, 
  Download, 
  Edit3, 
  Eye, 
  FileCheck2, 
  FileText, 
  MoreVertical, 
  Printer, 
  RefreshCcw, 
  Search, 
  SlidersHorizontal, 
  Ship, 
  TrendingUp, 
  Truck 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { openSalesA4ReportWindow } from "@/lib/reports/open-sales-a4-report-window";
import { apiGet, apiPatch } from "@/lib/api/client";

type SalesOrder = {
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
};

const lifecycleTabs = [
  "Dashboard Overview",
  "Draft Sales Bookings",
  "Confirmed Sales",
  "Finalized Orders"
] as const;

type LifecycleTab = (typeof lifecycleTabs)[number];

export function SalesOrderManagementDashboard({ initialStage }: { initialStage?: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LifecycleTab>("Dashboard Overview");
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
      alert("Failed to update sales order status: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // Filtered lists
  const filtered = useMemo(() => {
    if (activeTab === "Dashboard Overview") return orders;
    if (activeTab === "Draft Sales Bookings") return orders.filter(o => o.sales_status === "draft");
    if (activeTab === "Confirmed Sales") return orders.filter(o => o.sales_status === "Confirmed" || o.sales_status === "confirmed");
    if (activeTab === "Finalized Orders") return orders.filter(o => o.sales_status === "Finalized" || o.sales_status === "finalized");
    return orders;
  }, [orders, activeTab]);

  // Aggregated totals matching requested dashboard summary stats
  const dashboardStats = useMemo(() => {
    let totalSalesOrders = orders.length;
    let totalSalesAmount = 0; // Purchase Currency
    let totalInvoiceAmount = 0; // Purchase Currency
    let totalFinalCurrencyAmount = 0; // Final Currency AED
    let totalPaymentsReceived = 0; // Final Currency AED paid
    let outstandingReceivables = 0; // Final Currency AED remaining
    let pendingTransfers = 0;
    let finalizedOrders = 0;

    orders.forEach(o => {
      const raw = o.form_data || {};
      const f = raw.form || {};
      
      const purchaseAmount = Number(o.order_total || 0);
      const exRate = Number(o.exchange_rate || 1);
      const finalAmount = purchaseAmount * exRate;
      
      const invPct = Number(f.invoicePercentage || 100);
      const invoiceAmt = (purchaseAmount * invPct) / 100;
      
      totalSalesAmount += purchaseAmount;
      totalInvoiceAmount += invoiceAmt;
      totalFinalCurrencyAmount += finalAmount;
      
      const paidAmt = Number(o.paid_amount || 0) * exRate;
      totalPaymentsReceived += paidAmt;
      
      const remainingAmt = Math.max(0, finalAmount - paidAmt);
      outstandingReceivables += remainingAmt;

      const st = (o.sales_status || "").toLowerCase();
      if (st === "draft" || st === "pending") {
        pendingTransfers += 1;
      }
      if (st === "finalized" || st === "completed") {
        finalizedOrders += 1;
      }
    });

    return {
      totalSalesOrders,
      totalSalesAmount,
      totalInvoiceAmount,
      totalFinalCurrencyAmount,
      totalPaymentsReceived,
      outstandingReceivables,
      pendingTransfers,
      finalizedOrders
    };
  }, [orders]);

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
        userName: raw.form?.userName || "Admin User",
        userId: raw.form?.userId || "USR-001",
        branchCode: raw.form?.branchCode || "QTA"
      }
    };

    openSalesA4ReportWindow({
      title: "Sales Booking Invoice",
      salesData: reportData
    });
  }

  return (
    <div className="space-y-6 text-slate-800 bg-white min-h-screen pb-16">
      
      {/* Search Header Controls */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-4 items-center justify-between shadow-sm">
        <div className="flex border border-slate-200 bg-white p-1 rounded-xl shadow-xs">
          {lifecycleTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order no, customer..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400"
            />
          </div>
          <Button
            onClick={() => {
              router.push("/dashboard/sales/new-sales-booking-order");
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 rounded-xl shadow-md shadow-blue-100"
          >
            + Create Booking
          </Button>
        </div>
      </div>

      {/* Aggregate Cards with soft colors and proper spacing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sales Orders Count & Pending Transfers */}
        <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/20 border border-blue-100 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Total Sales Orders</span>
            <span className="text-2xl font-black text-blue-700 font-sans">{dashboardStats.totalSalesOrders} Orders</span>
            <span className="text-[9.5px] text-indigo-500 font-bold block">Pending Transfers: {dashboardStats.pendingTransfers}</span>
          </div>
          <div className="bg-blue-100 text-blue-700 p-2.5 rounded-xl">
            <Boxes className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Sales Amount & Invoice Amount */}
        <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/20 border border-emerald-100 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Original Total Sales</span>
            <span className="text-xl font-black text-emerald-700 font-sans">${dashboardStats.totalSalesAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-[9.5px] text-teal-600 font-bold block">Invoice Amount: ${dashboardStats.totalInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl">
            <BadgeDollarSign className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Final Currency & Payments Received */}
        <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/20 border border-purple-100 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Final Currency Value</span>
            <span className="text-xl font-black text-purple-700 font-sans">{dashboardStats.totalFinalCurrencyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
            <span className="text-[9.5px] text-pink-600 font-bold block">Payments Recd: {dashboardStats.totalPaymentsReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
          </div>
          <div className="bg-purple-100 text-purple-700 p-2.5 rounded-xl">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        {/* Card 4: Outstanding Receivables & Finalized Orders */}
        <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/20 border border-amber-100 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Outstanding Receivables</span>
            <span className="text-xl font-black text-amber-700 font-sans">{dashboardStats.outstandingReceivables.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
            <span className="text-[9.5px] text-orange-600 font-bold block">Finalized Orders: {dashboardStats.finalizedOrders}</span>
          </div>
          <div className="bg-amber-100 text-amber-700 p-2.5 rounded-xl">
            <Clock3 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Master Data Grid with grouped header columns */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full text-xs text-left text-slate-700 whitespace-nowrap">
          <thead className="bg-slate-150 text-slate-800 text-[10px] font-black uppercase tracking-wider">
            {/* Group Header Row */}
            <tr className="border-b border-slate-200 text-center">
              <th colSpan={9} className="px-3 py-2.5 bg-blue-50/70 text-blue-900 font-extrabold border-r border-slate-200">General Information</th>
              <th colSpan={2} className="px-3 py-2.5 bg-purple-50/70 text-purple-900 font-extrabold border-r border-slate-200">Account Mappings</th>
              <th colSpan={7} className="px-3 py-2.5 bg-emerald-50/70 text-emerald-900 font-extrabold border-r border-slate-200">Product Details</th>
              <th colSpan={9} className="px-3 py-2.5 bg-indigo-50/70 text-indigo-900 font-extrabold border-r border-slate-200">Financial Metrics</th>
              <th colSpan={1} className="px-3 py-2.5 bg-slate-100 text-slate-800 font-extrabold">Actions</th>
            </tr>
            {/* Column Headers Row */}
            <tr className="bg-slate-50 border-b border-slate-250 text-[9px]">
              {/* General */}
              <th className="px-3 py-2.5 border-r border-slate-200">Journal Serial</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Country Serial</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Branch Serial</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Sales Order No</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Date</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Customer</th>
              <th className="px-3 py-2.5 border-r border-slate-200">User</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Branch</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Country</th>
              
              {/* Accounts */}
              <th className="px-3 py-2.5 border-r border-slate-200">Sales Account</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Purchase Account</th>
              
              {/* Product */}
              <th className="px-3 py-2.5 border-r border-slate-200">Goods Name</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Brand</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Goods Size</th>
              <th className="px-3 py-2.5 text-right border-r border-slate-200">Quantity</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Unit</th>
              <th className="px-3 py-2.5 text-right border-r border-slate-200">Gross Wt (KG)</th>
              <th className="px-3 py-2.5 text-right border-r border-slate-200">Net Wt (KG)</th>

              {/* Financials */}
              <th className="px-3 py-2.5 border-r border-slate-200">Pur Currency</th>
              <th className="px-3 py-2.5 text-right border-r border-slate-200">Ex. Rate</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Final Currency</th>
              <th className="px-3 py-2.5 text-right border-r border-slate-200">Pur Amount</th>
              <th className="px-3 py-2.5 text-right border-r border-slate-200">Invoice %</th>
              <th className="px-3 py-2.5 text-right border-r border-slate-200">Invoice Amount</th>
              <th className="px-3 py-2.5 text-right border-r border-slate-200">Final Invoice Amount</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Payment Status</th>
              <th className="px-3 py-2.5 border-r border-slate-200">Transfer Status</th>

              {/* Actions */}
              <th className="px-3 py-2.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150">
            {loading ? (
              <tr>
                <td colSpan={28} className="px-6 py-12 text-center text-slate-400 font-medium">Loading sales bookings...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={28} className="px-6 py-12 text-center text-slate-500">No sales bookings in this stage.</td>
              </tr>
            ) : (
              filtered.map((order) => {
                const raw = order.form_data || {};
                const f = raw.form || {};
                
                const purchaseAmount = Number(order.order_total || 0);
                const exRate = Number(order.exchange_rate || 1);
                const finalAmount = purchaseAmount * exRate;
                
                const invPct = Number(f.invoicePercentage || 100);
                const invoiceAmt = (purchaseAmount * invPct) / 100;
                const finalInvoiceAmount = invoiceAmt * exRate;

                const branchName = f.branchName || "-";
                const branchCountry = f.branchCountry || "-";
                const userDisplayName = f.userName || "-";

                return (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors duration-150 border-b border-slate-100">
                    {/* General Information */}
                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500 border-r border-slate-150">{order.super_admin_serial_number || raw.traceability?.superAdminSerialNumber || "-"}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500 border-r border-slate-150">{order.country_transaction_serial_number || raw.traceability?.countryTransactionSerialNumber || "-"}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500 border-r border-slate-150">{order.branch_transaction_serial_number || raw.traceability?.branchTransactionSerialNumber || "-"}</td>
                    <td className="px-3 py-2.5 font-mono font-bold text-blue-600 border-r border-slate-150">{order.sales_order_no}</td>
                    <td className="px-3 py-2.5 text-slate-600 border-r border-slate-150 font-mono">{order.order_date}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-800 border-r border-slate-150 truncate max-w-[120px]" title={order.customer_name || "-"}>{order.customer_name || "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600 border-r border-slate-150 truncate max-w-[80px]" title={userDisplayName}>{userDisplayName}</td>
                    <td className="px-3 py-2.5 text-slate-600 border-r border-slate-150 truncate max-w-[80px]" title={branchName}>{branchName}</td>
                    <td className="px-3 py-2.5 text-slate-600 border-r border-slate-150 truncate max-w-[80px]" title={branchCountry}>{branchCountry}</td>
                    
                    {/* Accounts */}
                    <td className="px-3 py-2.5 text-slate-700 font-medium border-r border-slate-150 truncate max-w-[100px]" title={f.salesAccountName || "-"}>{f.salesAccountName || "-"}</td>
                    <td className="px-3 py-2.5 text-slate-700 font-medium border-r border-slate-150 truncate max-w-[100px]" title={f.purchaseAccountName || "-"}>{f.purchaseAccountName || "-"}</td>

                    {/* Product */}
                    <td className="px-3 py-2.5 font-bold text-slate-800 border-r border-slate-150 truncate max-w-[120px]" title={order.product_summary || "-"}>{order.product_summary || "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600 border-r border-slate-150">{f.brand || "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600 border-r border-slate-150">{f.size || "-"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-800 border-r border-slate-150">{order.quantity?.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-slate-600 border-r border-slate-150">{f.qtyName || "Bags"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 border-r border-slate-150">{Number(f.grossWeight || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-blue-600 font-bold border-r border-slate-150">{order.total_weight?.toLocaleString()}</td>

                    {/* Financials */}
                    <td className="px-3 py-2.5 font-black text-slate-800 border-r border-slate-150">{order.original_currency_code || "USD"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 border-r border-slate-150">{exRate.toFixed(4)}</td>
                    <td className="px-3 py-2.5 font-black text-slate-800 border-r border-slate-150">{order.currency_code || "AED"}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-150">${purchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 border-r border-slate-150">{invPct}%</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-150">${invoiceAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-600 border-r border-slate-150">{order.currency_code} {finalInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 border-r border-slate-150">
                      <span className={`px-2 py-0.2 rounded text-[8px] font-bold ${
                        order.payment_status === "pending"
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      }`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-r border-slate-150">
                      <span className={`px-2 py-0.2 rounded text-[8px] font-bold ${
                        order.sales_status === "draft"
                          ? "bg-slate-100 text-slate-500 border border-slate-200"
                          : order.sales_status === "Confirmed" || order.sales_status === "confirmed"
                            ? "bg-blue-50 text-blue-700 border border-blue-150"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      }`}>
                        {order.sales_status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-center space-x-2">
                      <Button
                        onClick={() => handlePrint(order)}
                        variant="outline"
                        className="border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-xs px-2 py-1 h-auto"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      
                      {order.sales_status === "draft" && (
                        <Button
                          disabled={updatingId === order.id}
                          onClick={() => transitionStatus(order.id, "Confirmed")}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 h-auto rounded-lg shadow-sm"
                        >
                          Confirm Booking
                        </Button>
                      )}

                      {(order.sales_status === "Confirmed" || order.sales_status === "confirmed") && (
                        <Button
                          disabled={updatingId === order.id}
                          onClick={() => transitionStatus(order.id, "Finalized")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-1 h-auto rounded-lg shadow-sm"
                        >
                          Finalize & Post GL
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
