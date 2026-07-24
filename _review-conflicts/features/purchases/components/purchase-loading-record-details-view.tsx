"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, Download, MapPin, Truck, Building2, User, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErpPageActions } from "@/components/layout/erp-page-actions";
import { cn } from "@/lib/utils";
import { LoadingSlipViewer } from "@/components/reports/loading-slip-viewer";
import { createPortal } from "react-dom";
import { numberToWords } from "@/lib/utils/number-to-words";

export function PurchaseLoadingRecordDetailsView({ recordId }: { recordId: string }) {
  const searchParams = useSearchParams();
  const shouldPrint = searchParams.get("print") === "true";

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    async function fetchRecord() {
      try {
        const res = await fetch("/api/erp/purchases/loading-records");
        const json = await res.json();
        const found = json.data?.find((r: any) => r.id === recordId);
        setRecord(found);
      } catch (e) {
        console.error("Error fetching record:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchRecord();
  }, [recordId]);

  useEffect(() => {
    if (!loading && record && shouldPrint) {
      setPrintMode(true);
    }
  }, [loading, record, shouldPrint]);

  if (loading) {
    return <div className="flex h-[400px] items-center justify-center text-muted-foreground">Loading details...</div>;
  }

  if (!record) {
    return <div className="flex h-[400px] items-center justify-center text-destructive">Record not found.</div>;
  }

  const poData = (Array.isArray(record.purchase_orders) ? record.purchase_orders[0] : record.purchase_orders)?.form_data || {};
  const form = poData.form || {};
  const supplierName = form.supplierName || form.vendorName || poData.supplier?.accountName || "-";
  const goods = poData.goodsEntries || [];
  const currency = form.secondaryCurrency?.split(" ")?.[0] || form.currency || "-";
  
  let totalQuantity = 0;
  let totalNetWeight = 0;
  let totalGrossWeight = 0;
  let totalAmount = 0;

  const items = goods.map((g: any, index: number) => {
    const qty = Number(g.quantity) || 0;
    const rate = Number(g.purchasedPrice) || Number(g.unitPrice) || 0;
    const amount = Number(g.totalPrice) || (qty * rate);
    
    totalQuantity += qty;
    totalAmount += amount;
    
    return {
      srNo: index + 1,
      description: g.goodsName || g.name || "-",
      hsCode: g.chsCode || "-",
      rate: rate,
      quantity: qty,
      units: g.unit || "-",
      amount: amount,
      netWeight: Number(g.netWeight) || 0,
      grossWeight: Number(g.grossWeight) || 0
    };
  });
  
  const loadingSlipData = {
    companyName: "DGT LLC",
    companyAddress: "123 Business Street, Trade Center, Dubai",
    companyPhone: "+971 50 123 4567",
    companyEmail: "info@dgtllc.com",
    companyWebsite: "www.dgtllc.com",
    invoiceNo: record.loading_no || "LOAD-" + record.id.slice(0, 8).toUpperCase(),
    invoiceDate: new Date(record.created_at).toLocaleDateString(),
    referenceNo: record.purchase_order_no || "-",
    referenceDate: form.purchaseDate || form.bookingDate || "-",
    exporterName: supplierName,
    exporterAddress: form.supplierDetails || poData.accountDetail || "-",
    consigneeName: "DGT LLC",
    consigneeAddress: (record.country_branches?.name || "") + " " + (record.city_branches?.name || ""),
    notifyParty: "SAME AS CONSIGNEE",
    originCountry: form.loadingCountry || form.originCountry || "-",
    destinationCountry: form.receivedCountry || "-",
    portOfLoading: form.portOfLoading || "-",
    portOfDischarge: form.portOfDischarge || "-",
    finalDestination: record.receiving_location || form.receivedCountry || "-",
    containerNo: form.containerNumber || record.container_no || "-",
    vesselFlightNo: form.vesselFlightNo || "-",
    items,
    totalQuantity,
    totalNetWeight,
    totalGrossWeight,
    totalAmount,
    currency,
    amountInWords: totalAmount > 0 ? numberToWords(totalAmount) : "ZERO",
    remarks: record.remarks || form.remarks || "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
  };

  return (
    <div className="space-y-6">
      <ErpPageActions
        backLink={`/dashboard/purchase/purchase-loading-records?openRecordId=${recordId}`}
        title="Loading Record Details"
        subtitle="Comprehensive view of loading, purchase, sales, and goods."
      >
        <Button variant="outline" size="sm" onClick={() => setPrintMode(true)} className="print:hidden">
          <Printer className="mr-2 h-4 w-4" /> Print Loading Slip
        </Button>
        <Button variant="outline" size="sm" className="print:hidden" onClick={() => setPrintMode(true)}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </ErpPageActions>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Purchase & Sales Details */}
        <Card className="md:col-span-1 shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <FileText className="h-4 w-4" />
              Purchase & Sales Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between border-b border-dashed pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Purchase Booking No</span>
              <span className="text-xs font-bold">{record.purchase_order_no || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-dashed pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Purchase Date</span>
              <span className="text-xs font-bold">{form.purchaseDate || form.bookingDate || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-dashed pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Sales Order No</span>
              <span className="text-xs font-bold">{form.salesOrderNo || "-"}</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Sales Account</span>
              <span className="text-xs font-bold truncate max-w-[150px]" title={form.salesAccountName || "-"}>{form.salesAccountName || "-"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Branch Details */}
        <Card className="md:col-span-1 shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Building2 className="h-4 w-4" />
              Branch Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between border-b border-dashed pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Country Branch</span>
              <span className="text-xs font-bold">{record.country_branches?.name || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-dashed pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">City Branch</span>
              <span className="text-xs font-bold">{record.city_branches?.name || "-"}</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Target Location</span>
              <span className="text-xs font-bold">{record.receiving_location || form.receivedCountry || "-"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Supplier Details */}
        <Card className="md:col-span-1 shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <User className="h-4 w-4" />
              Supplier / Vendor Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between border-b border-dashed pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Supplier Name</span>
              <span className="text-xs font-bold truncate max-w-[150px]" title={supplierName}>{supplierName}</span>
            </div>
            <div className="flex justify-between border-b border-dashed pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Account Detail</span>
              <span className="text-xs font-bold truncate max-w-[150px]" title={form.supplierDetails || poData.accountDetail || "-"}>{form.supplierDetails || poData.accountDetail || "-"}</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Origin Country</span>
              <span className="text-xs font-bold">{form.loadingCountry || form.originCountry || "-"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goods Table */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b bg-slate-50">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
            <FileText className="h-4 w-4" />
            Goods Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-xs text-slate-500 uppercase">Goods Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs text-slate-500 uppercase">Details (Brand/Size)</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs text-slate-500 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs text-slate-500 uppercase">Net Weight</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs text-slate-500 uppercase">Gross Weight</th>
                  <th className="px-4 py-3 text-right font-semibold text-xs text-slate-500 uppercase">Unit Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-xs text-slate-500 uppercase">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {goods.length > 0 ? goods.map((g: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">{g.goodsName || g.item_name || "-"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{g.brand || g.size || g.item_details || "-"}</td>
                    <td className="px-4 py-2 font-mono">{g.qtyNo || g.quantity || "-"}</td>
                    <td className="px-4 py-2 font-mono">{g.netWeight || "-"}</td>
                    <td className="px-4 py-2 font-mono">{g.grossWeight || "-"}</td>
                    <td className="px-4 py-2 font-mono text-right">{g.unitPrice || g.purchaseRate || "-"}</td>
                    <td className="px-4 py-2 font-mono text-right font-semibold">{g.finalAmount || g.totalAmount || "-"} {currency}</td>
                  </tr>
                )) : (
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">{form.itemName || "-"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{form.itemDetails || "-"}</td>
                    <td className="px-4 py-2 font-mono">{form.quantity || "-"}</td>
                    <td className="px-4 py-2 font-mono">{form.netWeight || "-"}</td>
                    <td className="px-4 py-2 font-mono">{form.grossWeight || "-"}</td>
                    <td className="px-4 py-2 font-mono text-right">{form.purchaseRate || "-"}</td>
                    <td className="px-4 py-2 font-mono text-right font-semibold">{form.totalAmount || form.finalAmount || "-"} {currency}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Loading Details */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Truck className="h-4 w-4" />
              Loading & Logistics
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Loading Record No</p>
                <p className="text-sm font-bold text-primary">{record.loading_record_no}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Status</p>
                <p className="text-sm font-bold capitalize">{record.loading_status || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Container Number</p>
                <p className="text-sm font-bold">{record.container_number || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Container Type</p>
                <p className="text-sm font-bold">{record.container_type || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Loading Port / Country</p>
                <p className="text-sm font-bold">{record.loading_location || form.loadingPort || "-"} / {form.loadingCountry || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Receiving Port / Country</p>
                <p className="text-sm font-bold">{record.receiving_location || form.receivedPort || "-"} / {form.receivedCountry || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Loading Date</p>
                <p className="text-sm font-bold">{record.loaded_at ? new Date(record.loaded_at).toLocaleDateString() : (form.loadingDate || "-")}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Carrier Name</p>
                <p className="text-sm font-bold">{record.carrier_name || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial & Payment Details */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b bg-emerald-50/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Financial & Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Total Purchase Amount</p>
                <p className="text-sm font-bold">{form.totalAmount || form.finalAmount || "-"} {currency}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Advance Percent</p>
                <p className="text-sm font-bold">{form.advancePercent || "0"}%</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Advance Amount Paid</p>
                <p className="text-sm font-bold text-emerald-600">{form.advanceAmount || "0"} {currency}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Remaining Balance</p>
                <p className="text-sm font-bold text-amber-600">{Number(form.totalAmount || form.finalAmount || 0) - Number(form.advanceAmount || 0)} {currency}</p>
              </div>
              <div className="col-span-2 pt-2 border-t border-dashed mt-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Payment / Clearing Status</p>
                <p className="text-sm font-semibold text-emerald-700">Advance Cleared / Payment Nil Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {printMode && typeof document !== "undefined" && createPortal(
        <LoadingSlipViewer
          data={loadingSlipData}
          onClose={() => setPrintMode(false)}
        />,
        document.body
      )}
    </div>
  );
}
