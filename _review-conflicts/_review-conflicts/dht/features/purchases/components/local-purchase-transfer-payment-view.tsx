"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, FileText, Search, RefreshCw,
  Coins, Loader2, CheckCircle2, Send, Printer,
  Scale, CreditCard, ArrowDownLeft
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const UAE_COUNTRY_MATCHERS = ["UNITED ARAB", "UAE", "EMIRATES", "AE"];

function isUaeCountryName(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return UAE_COUNTRY_MATCHERS.some(token => normalized.includes(token));
}

function amountToWordsEn(amount: number, currency = "AED") {
  if (!Number.isFinite(amount)) return `${currency} zero only`;
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const chunkToWords = (num: number): string => {
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    const parts: string[] = [];
    if (hundred) parts.push(`${ones[hundred]} hundred`);
    if (rest < 20) {
      if (rest) parts.push(ones[rest]);
    } else {
      const ten = Math.floor(rest / 10);
      const one = rest % 10;
      parts.push(one ? `${tens[ten]}-${ones[one]}` : tens[ten]);
    }
    return parts.join(" ");
  };
  const whole = Math.floor(Math.abs(amount));
  if (whole === 0) return `${currency} zero only`;
  const scales = ["", "thousand", "million", "billion"];
  const parts: string[] = [];
  let remaining = whole;
  let scaleIndex = 0;
  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk) parts.unshift(`${chunkToWords(chunk)} ${scales[scaleIndex]}`.trim());
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }
  return `${currency} ${parts.join(" ")} only`.replace(/\s+/g, " ");
}

interface LocalPurchaseRecord {
  id: string;
  serialNo?: string;
  serial_no?: string;
  billNo?: string;
  bill_no?: string;
  superAdminSerialNo?: string;
  super_admin_serial_no?: string;
  global_serial_no?: string;
  countrySerialNo?: string;
  country_serial_no?: string;
  computedCountrySerial?: string;
  branchSerialNo?: string;
  branch_serial_no?: string;
  computedBranchSerial?: string;
  countryId?: string;
  country_id?: string;
  countryName?: string;
  country_name?: string;
  countryBranchId?: string;
  country_branch_id?: string;
  branchName?: string;
  branch_name?: string;
  goodsName?: string;
  goods_name?: string;
  brand?: string;
  originCountryName?: string;
  origin_country_name?: string;
  chassisCode?: string;
  chassis_code?: string;
  lotNo?: string;
  lot_no?: string;
  quantityKgs?: number;
  quantity_kgs?: number;
  quantityName?: string;
  quantity_name?: string;
  totalGrossWeight?: number;
  total_gross_weight?: number;
  emptyKgs?: number;
  empty_kgs?: number;
  netWeight?: number;
  net_weight?: number;
  purchaseRate?: number;
  purchase_rate?: number;
  purchaseCost?: number;
  purchase_cost?: number;
  taxAmount?: number;
  tax_amount?: number;
  finalCost?: number;
  final_cost?: number;
  localCurrency?: string;
  local_currency?: string;
  paymentMode?: string;
  payment_mode?: string;
  purchaseAccountNo?: string;
  purchase_account_no?: string;
  salesAccountNo?: string;
  sales_account_no?: string;
  brokerAccountNo?: string;
  broker_account_no?: string;
  createdAt?: string;
  created_at?: string;
  form_data?: any;
  status?: string;
  supplierName?: string;
  supplier_name?: string;
  shippingMode?: string;
  shipping_mode?: string;
  warehouseName?: string;
  warehouse_name?: string;
  truckNo?: string;
  truck_no?: string;
  size?: string;
  applyTax?: string;
  apply_tax?: string;
  taxType?: string;
  tax_type?: string;
  taxPercentage?: number;
  tax_percentage?: number;
  remainingBalance?: number;
  remaining_balance?: number;
}

export function LocalPurchaseTransferPaymentView({ session }: { session: any }) {
  const router = useRouter();
  const [purchases, setPurchases] = useState<LocalPurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowForVoucher, setSelectedRowForVoucher] = useState<LocalPurchaseRecord | null>(null);
  const [transferringId, setTransferringId] = useState<string | null>(null);

  // Fetch local purchases
  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/purchases/local-purchase");
      const payload = await res.json();
      if (payload.ok && payload.data?.purchases) {
        const raw = payload.data.purchases as LocalPurchaseRecord[];
        // Filter in memory: keep only accepted status entries for transfer payments
        const filtered = raw.filter(p => p.status === "accepted");
        setPurchases(filtered);
      }
    } catch (err) {
      console.error("Failed to load local purchase transfers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  // Filter purchases by search query
  const filteredPurchases = useMemo(() => {
    let result = purchases;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        (p.goodsName || p.goods_name || "").toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (p.serialNo || p.serial_no || p.billNo || "").toLowerCase().includes(q) ||
        (p.branchName || p.branch_name || "").toLowerCase().includes(q) ||
        (p.countryName || p.country_name || "").toLowerCase().includes(q) ||
        (p.supplierName || p.supplier_name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [purchases, searchQuery]);

  // Financial KPI totals
  const totalPendingAmount = useMemo(() => {
    return filteredPurchases.reduce((acc, p) => acc + Number(p.finalCost || p.final_cost || p.purchaseCost || p.purchase_cost || 0), 0);
  }, [filteredPurchases]);

  return (
    <div className="space-y-6 p-4 sm:p-6 text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-950 min-h-screen">
      
      {/* Top Banner: Branch, User & Date Time Bar */}
      <div className="flex flex-wrap items-center justify-between text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs gap-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">BRANCH NAME:</span>
          <span className="text-blue-600 dark:text-blue-400 font-extrabold">{session.branchName || "UNITED ARAB EMIRATES MAIN BRANCH"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">USER NAME:</span>
          <span className="text-slate-900 dark:text-white font-extrabold">{session.fullName || session.email || "SUPER ADMIN"}</span>
        </div>
        <div className="flex items-center gap-3 font-mono" suppressHydrationWarning>
          <div>DATE: <span className="text-slate-800 dark:text-slate-200 font-bold">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span></div>
          <div>TIME: <span className="text-slate-800 dark:text-slate-200 font-bold">{new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></div>
        </div>
      </div>

      {/* Page Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-amber-600" />
            <h1 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
              Local Purchase Transfer Payment
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Verify and post accepted local purchases to the General Ledger & Roznamcha
          </p>
        </div>

        {/* Global Quick Search & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search serial, item, vendor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 text-xs outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadReports()}
            className="h-9 text-xs font-bold border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            Sync Pending
          </Button>
        </div>
      </div>

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-2xl">
          <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800/60 flex flex-row items-center gap-2">
            <Send className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
              Pending GL Transfers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-extrabold text-amber-600 font-mono">
              {filteredPurchases.length}
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase">
              Accepted bills awaiting verification
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-2xl">
          <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800/60 flex flex-row items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
              Total Pending Value
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-extrabold text-emerald-600 font-mono">
              {totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase">
              Aggregate unposted purchase cost
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-2xl">
          <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800/60 flex flex-row items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
              Authorized Branch
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col justify-center">
            <div className="text-sm font-black text-slate-700 dark:text-slate-350 uppercase">
              {session.branchName || "Global Head Office"}
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase">
              Posting role: <span className="text-blue-500 font-bold">{session.role || "Administrator"}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden animate-in fade-in">
        <CardHeader className="bg-amber-500/10 border-b border-slate-200 dark:border-slate-800 p-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              PENDING GENERAL LEDGER TRANSFERS
            </CardTitle>
          </div>
          <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
            Ready to Post: {filteredPurchases.length}
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
            <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white text-[9px] font-extrabold uppercase tracking-wider border-b border-slate-700">
                <tr>
                  <th className="p-2.5 border-r border-slate-700 text-center">VOUCHER NO</th>
                  <th className="p-2.5 border-r border-slate-700">DATE</th>
                  <th className="p-2.5 border-r border-slate-700">BRANCH NAME</th>
                  <th className="p-2.5 border-r border-slate-700">PURCHASE ACC (DR)</th>
                  <th className="p-2.5 border-r border-slate-700">SALES ACC (CR)</th>
                  <th className="p-2.5 border-r border-slate-700">GOODS NAME</th>
                  <th className="p-2.5 border-r border-slate-700">BRAND</th>
                  <th className="p-2.5 border-r border-slate-700 text-right">QTY</th>
                  <th className="p-2.5 border-r border-slate-700 text-right font-black">TOTAL COST</th>
                  <th className="p-2.5 border-r border-slate-700 text-center">PAY MODE</th>
                  <th className="p-2.5 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-[10px]">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="p-10 text-center text-slate-400 font-sans">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-600 mb-2" />
                      Fetching pending GL transfers...
                    </td>
                  </tr>
                ) : filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-10 text-center text-slate-400 font-sans">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                      <p className="font-bold text-slate-700">All accepted purchases have been successfully posted to Ledger</p>
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map(row => {
                    const totalCost = Number(row.finalCost || row.final_cost || row.purchaseCost || row.purchase_cost || 0);
                    const curr = row.localCurrency || row.local_currency || "PKR";
                    const voucherCode = row.serialNo || row.serial_no || row.billNo || row.bill_no || `LP-2026-${row.id?.slice(0, 4) || "1001"}`;

                    return (
                      <tr key={row.id} className="hover:bg-amber-50/20 dark:hover:bg-amber-950/10 transition-colors">
                        <td className="p-2 font-mono font-bold text-blue-600 dark:text-blue-400 border-r border-slate-150 dark:border-slate-800">{voucherCode}</td>
                        <td className="p-2 font-mono text-slate-500 border-r border-slate-150 dark:border-slate-800">{new Date(row.createdAt || row.created_at || "").toLocaleDateString("en-GB")}</td>
                        <td className="p-2 font-semibold border-r border-slate-150 dark:border-slate-800">{row.branchName || row.branch_name || "-"}</td>
                        <td className="p-2 font-mono text-[9px] font-bold text-blue-600 border-r border-slate-150 dark:border-slate-800">{row.purchaseAccountNo || row.purchase_account_no || "PK-CHM-AC-0001"}</td>
                        <td className="p-2 font-mono text-[9px] font-bold text-purple-600 border-r border-slate-150 dark:border-slate-800">{row.salesAccountNo || row.sales_account_no || "PK-CHM-AC-0002"}</td>
                        <td className="p-2 font-bold text-slate-900 border-r border-slate-150 dark:border-slate-800">{row.goodsName || row.goods_name || "-"}</td>
                        <td className="p-2 text-slate-500 border-r border-slate-150 dark:border-slate-800">{row.brand || "-"}</td>
                        <td className="p-2 text-right font-mono font-bold border-r border-slate-150 dark:border-slate-800">{Number(row.quantityKgs || row.quantity_kgs || 0).toLocaleString()} {row.quantityName || row.quantity_name}</td>
                        <td className="p-2 text-right font-mono font-black text-emerald-600 border-r border-slate-150 dark:border-slate-800">{curr} {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-2 text-center font-bold border-r border-slate-150 dark:border-slate-800">{row.paymentMode || row.payment_mode || "Cash"}</td>
                        <td className="p-2 text-center space-x-2">
                          <Button
                            size="sm"
                            disabled={transferringId === row.id}
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to verify and post local purchase ${voucherCode} to General Ledger?`)) return;
                              setTransferringId(row.id);
                              try {
                                const res = await fetch("/api/erp/purchases/local-purchase/transfer", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ purchaseId: row.id })
                                });
                                const data = await res.json();
                                if (!res.ok || !data.ok) throw new Error(data.error?.message || "Transfer failed.");
                                alert("Success: Posted to general ledger & roznamcha successfully!");
                                await loadReports();
                              } catch (err: any) {
                                alert(err.message || "An error occurred.");
                              } finally {
                                setTransferringId(null);
                              }
                            }}
                            className="h-6 px-2 text-[9px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-md"
                          >
                            {transferringId === row.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Verify & Post to GL"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRowForVoucher(row)}
                            className="h-6 px-2 text-[9px] font-bold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-md"
                          >
                            View Voucher
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Printable A4 Voucher Modal */}
      {selectedRowForVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 print:hidden">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" /> VOUCHER DETAILS FOR LP-{selectedRowForVoucher.id?.slice(0, 5).toUpperCase()}
              </h3>
              <div className="flex gap-2">
                {selectedRowForVoucher.status === "accepted" && (
                  <Button
                    disabled={transferringId === selectedRowForVoucher.id}
                    onClick={async () => {
                      if (!confirm("Are you sure you want to transfer this verified bill to general ledger? This will post all accounting journal and roznamcha entries.")) return;
                      setTransferringId(selectedRowForVoucher.id);
                      try {
                        const res = await fetch("/api/erp/purchases/local-purchase/transfer", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ purchaseId: selectedRowForVoucher.id })
                        });
                        const data = await res.json();
                        if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to transfer.");
                        alert("Accounting Entries Posted Successfully to:\n- Cash Entry / Daily Payment\n- Business Roznamcha\n- General Ledger\n- Journal (Debit/Credit Serials generated)");
                        
                        setSelectedRowForVoucher(prev => prev ? { ...prev, status: "posted" } : null);
                        await loadReports();
                      } catch (err: any) {
                        alert(err.message || "An error occurred during transfer.");
                      } finally {
                        setTransferringId(null);
                      }
                    }}
                    className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 shadow-sm"
                  >
                    {transferringId === selectedRowForVoucher.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> Transfer & Post to GL
                      </>
                    )}
                  </Button>
                )}
                <Button
                  onClick={() => {
                    const printContents = document.getElementById("printable-modal-voucher")?.innerHTML;
                    if (!printContents) return;
                    const originalContents = document.body.innerHTML;
                    document.body.innerHTML = printContents;
                    window.print();
                    document.body.innerHTML = originalContents;
                    window.location.reload(); // Refresh to restore react state
                  }}
                  className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedRowForVoucher(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            <div id="printable-modal-voucher" className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 font-sans text-xs">
              {(() => {
                const rowCountry = selectedRowForVoucher.countryName || selectedRowForVoucher.country_name || session?.branchName || "";
                const isUAE = isUaeCountryName(rowCountry);
                const rowFinalCost = Number(selectedRowForVoucher.finalCost || selectedRowForVoucher.final_cost || 0);
                const rowTaxAmt = Number(selectedRowForVoucher.taxAmount || selectedRowForVoucher.tax_amount || 0);
                const rowSubtotal = Math.max(rowFinalCost - rowTaxAmt, 0);
                const rowGrossWt = Number(selectedRowForVoucher.totalGrossWeight || selectedRowForVoucher.total_gross_weight || selectedRowForVoucher.quantityKgs || selectedRowForVoucher.quantity_kgs || 0);
                const rowNetWt = Number(selectedRowForVoucher.netWeight || selectedRowForVoucher.net_weight || 0);
                const rowQty = Number(selectedRowForVoucher.quantityKgs || selectedRowForVoucher.quantity_kgs || 0);
                const rowDate = new Date(selectedRowForVoucher.createdAt || selectedRowForVoucher.created_at || Date.now()).toLocaleDateString("en-GB");
                const rowCurrency = selectedRowForVoucher.localCurrency || selectedRowForVoucher.local_currency || "AED";
                const rowVatPercent = Number(selectedRowForVoucher.taxPercentage || selectedRowForVoucher.tax_percentage || 5);
                const rowFreight = 0;
                const rowRoundOff = 0;
                const rowGrandTotal = rowFinalCost + rowFreight + rowRoundOff;
                const rowUnit = selectedRowForVoucher.quantityName || selectedRowForVoucher.quantity_name || "Bags";
                const rowUnitPrice = Number(selectedRowForVoucher.purchaseRate || selectedRowForVoucher.purchase_rate || 0);
                const voucherRef = selectedRowForVoucher.serialNo || selectedRowForVoucher.serial_no || selectedRowForVoucher.journal_serial_no || `LP-${selectedRowForVoucher.id?.slice(0, 5).toUpperCase()}`;
                const companyName = "DAMAAN Trading Company LLC";
                const branchName = selectedRowForVoucher.branchName || selectedRowForVoucher.branch_name || "UAE Branch";
                const officeAddress = "United Arab Emirates";
                const officePhone = "N/A";
                const officeEmail = "N/A";
                const trnNumber = "N/A";
                const supplierName = selectedRowForVoucher.supplierName || selectedRowForVoucher.supplier_name || "Local Vendor";
                const paymentMethod = selectedRowForVoucher.paymentMode || selectedRowForVoucher.payment_mode || "Cash";
                const shippingMode = selectedRowForVoucher.shippingMode || selectedRowForVoucher.shipping_mode || "Local Purchase";
                const goodsName = selectedRowForVoucher.goodsName || selectedRowForVoucher.goods_name || "Local Purchase Goods";
                const hsCode = selectedRowForVoucher.chassisCode || selectedRowForVoucher.chassis_code || "-";
                const brandName = selectedRowForVoucher.brand || "-";
                const sizeName = selectedRowForVoucher.size || "-";

                if (isUAE) {
                  return (
                    <div className="mx-auto max-w-[794px] space-y-4 bg-white text-[10px] text-slate-800 print:max-w-none print:text-[9px]">
                      <div className="overflow-hidden rounded-2xl border border-slate-300">
                        <div className="grid grid-cols-[88px_1fr_210px] gap-4 bg-slate-950 p-5 text-white">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-950">LOGO</div>
                          <div className="space-y-1">
                            <h2 className="text-xl font-black uppercase tracking-[0.18em]">Tax Invoice</h2>
                            <p className="text-sm font-extrabold uppercase tracking-wide">{companyName}</p>
                            <p className="text-[10px] text-slate-300">{branchName}</p>
                            <p className="max-w-lg text-[10px] leading-4 text-slate-300">{officeAddress}</p>
                          </div>
                          <div className="space-y-1 text-right text-[10px]">
                            <p>Invoice No: <span className="font-mono font-black text-white">{voucherRef}</span></p>
                            <p>Invoice Date: <span className="font-mono font-bold">{rowDate}</span></p>
                            <p>Payment Method: <span className="font-bold">{paymentMethod}</span></p>
                            <p>Phone: <span className="font-bold">{officePhone}</span></p>
                            <p>Email: <span className="font-bold">{officeEmail}</span></p>
                            <p className="rounded-lg bg-white/10 px-2 py-1 font-bold text-blue-100">TRN / VAT: {trnNumber}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-b border-slate-200 bg-slate-50 p-4">
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Supplier Details</p>
                            <p className="text-sm font-black text-slate-900">{supplierName}</p>
                            <p className="mt-1 text-slate-500">Country: United Arab Emirates</p>
                            <p className="text-slate-500">Invoice Currency: <span className="font-bold text-slate-800">{rowCurrency}</span></p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Delivery / Warehouse</p>
                            <p>Transaction Type: <span className="font-bold">{shippingMode}</span></p>
                            <p>Warehouse: <span className="font-bold">{selectedRowForVoucher.warehouseName || selectedRowForVoucher.warehouse_name || "-"}</span></p>
                            <p>Truck No: <span className="font-mono font-bold text-indigo-700">{selectedRowForVoucher.truckNo || selectedRowForVoucher.truck_no || "-"}</span></p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Invoice Control</p>
                            <p>Branch: <span className="font-bold">{branchName}</span></p>
                            <p>Document Ref: <span className="font-mono font-bold">{voucherRef}</span></p>
                            <p>Status: <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">{selectedRowForVoucher.status === "posted" ? "Posted" : "Accepted"}</span></p>
                          </div>
                        </div>

                        <div className="p-4">
                          <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 text-[9px]">
                            <thead className="bg-slate-900 text-white">
                              <tr>
                                <th className="border border-slate-800 p-2 text-left">Sr.</th>
                                <th className="border border-slate-800 p-2 text-left">Goods Name</th>
                                <th className="border border-slate-800 p-2 text-left">HS Code</th>
                                <th className="border border-slate-800 p-2 text-left">Brand</th>
                                <th className="border border-slate-800 p-2 text-left">Size</th>
                                <th className="border border-slate-800 p-2 text-right">Quantity</th>
                                <th className="border border-slate-800 p-2 text-left">Unit</th>
                                <th className="border border-slate-800 p-2 text-right">Unit Price</th>
                                <th className="border border-slate-800 p-2 text-right">Taxable Amount</th>
                                <th className="border border-slate-800 p-2 text-right">VAT %</th>
                                <th className="border border-slate-800 p-2 text-right">VAT Amount</th>
                                <th className="border border-slate-800 p-2 text-right">Total Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="align-top">
                                <td className="border border-slate-200 p-2">1</td>
                                <td className="border border-slate-200 p-2 font-bold text-slate-900">
                                  {goodsName}
                                  <div className="mt-1 text-[8px] font-semibold text-slate-500">Gross WT: {rowGrossWt.toLocaleString()} kg | Net WT: {rowNetWt.toLocaleString()} kg</div>
                                </td>
                                <td className="border border-slate-200 p-2 font-mono">{hsCode}</td>
                                <td className="border border-slate-200 p-2">{brandName}</td>
                                <td className="border border-slate-200 p-2">{sizeName}</td>
                                <td className="border border-slate-200 p-2 text-right font-mono">{rowQty.toLocaleString()}</td>
                                <td className="border border-slate-200 p-2">{rowUnit}</td>
                                <td className="border border-slate-200 p-2 text-right font-mono">{rowUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="border border-slate-200 p-2 text-right font-mono">{rowSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="border border-slate-200 p-2 text-right font-mono">{rowVatPercent}%</td>
                                <td className="border border-slate-200 p-2 text-right font-mono text-red-650">{rowTaxAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="border border-slate-200 p-2 text-right font-mono font-black text-emerald-700">{rowCurrency} {rowFinalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </tr>
                            </tbody>
                          </table>

                          <div className="mt-4 grid grid-cols-[1fr_310px] gap-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Amount In Words</p>
                              <p className="text-sm font-black capitalize text-slate-900">{amountToWordsEn(rowGrandTotal, rowCurrency)}</p>
                              <div className="mt-4 grid grid-cols-2 gap-3 text-[9px]">
                                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
                                  <p className="font-black uppercase text-slate-500">QR Code</p>
                                  <p className="mt-2 text-slate-400 font-bold">QR Reference: UAE e-invoice standard.</p>
                                </div>
                                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
                                  <p className="font-black uppercase text-slate-500">Company Stamp</p>
                                  <p className="mt-2 text-slate-400 font-bold">Authorized Stamp Space</p>
                                </div>
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-slate-300 text-[10px]">
                              <div className="bg-slate-100 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-700">Summary</div>
                              <div className="space-y-2 p-3">
                                <div className="flex justify-between"><span>Sub Total</span><span className="font-mono font-bold">{rowCurrency} {rowSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between text-red-650"><span>VAT Total</span><span className="font-mono font-bold">{rowCurrency} {rowTaxAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-black text-emerald-700"><span>Grand Total</span><span className="font-mono">{rowCurrency} {rowGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-slate-200 bg-slate-50 p-4 text-[9px]">
                          <div className="space-y-1">
                            <p className="font-black uppercase tracking-[0.14em] text-blue-800">Bank Details</p>
                            <p>Bank Name: -</p>
                            <p>Account Name: {companyName}</p>
                            <p>IBAN: -</p>
                          </div>
                          <div className="space-y-1">
                            <p className="font-black uppercase tracking-[0.14em] text-slate-700">Terms & Conditions</p>
                            <p>1. Goods received in good condition are subject to company purchase policy.</p>
                            <p>2. VAT and taxable amounts are calculated according to UAE tax invoice requirements.</p>
                            <p>3. This invoice is generated from the ERP local purchase module.</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 p-5 text-center text-[9px] font-bold text-slate-600">
                          <div className="border-t border-slate-700 pt-2">Prepared By</div>
                          <div className="border-t border-slate-700 pt-2">Checked By</div>
                          <div className="border-t border-slate-700 pt-2">Authorized Signature</div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Non-UAE standard voucher
                return (
                  <div className="space-y-4 text-xs">
                    <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3">
                      <div>
                        <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">LOCAL PURCHASE BILL VOUCHER</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">
                          {selectedRowForVoucher.branchName || selectedRowForVoucher.branch_name || "Global System Branch"}
                        </p>
                      </div>
                      <div className="text-right text-xs font-mono">
                        <span className="font-black text-blue-600 block text-sm">LP-{selectedRowForVoucher.id?.slice(0, 5).toUpperCase()}</span>
                        <span className="text-[9px] text-slate-500 block">Date: {new Date(selectedRowForVoucher.createdAt || selectedRowForVoucher.created_at || Date.now()).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Supplier / Vendor:</span>
                        <span className="font-bold text-slate-800 text-xs">{selectedRowForVoucher.supplierName || selectedRowForVoucher.supplier_name || "-"}</span>
                        <span className="text-[9px] text-emerald-600 block font-bold mt-1 uppercase font-mono">
                          Payment Mode: {selectedRowForVoucher.paymentMode || selectedRowForVoucher.payment_mode || "Cash"}
                        </span>
                        {selectedRowForVoucher.paymentMode === "Advance" && (
                          <div className="text-[9px] text-red-500 font-bold uppercase mt-1 font-mono">
                            Remaining Bal: {rowCurrency} {Number(selectedRowForVoucher.remainingBalance || selectedRowForVoucher.remaining_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-[10px] space-y-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Shipping & Logistics:</span>
                        <div className="font-semibold text-slate-700">Mode: <span className="font-bold">{selectedRowForVoucher.shippingMode || selectedRowForVoucher.shipping_mode || "Loading"}</span></div>
                        <div className="font-semibold text-slate-700">Warehouse: <span className="font-bold">{selectedRowForVoucher.warehouseName || selectedRowForVoucher.warehouse_name || "-"}</span></div>
                        <div className="font-semibold text-slate-700">Truck No: <span className="font-bold font-mono text-indigo-600">{selectedRowForVoucher.truckNo || selectedRowForVoucher.truck_no || "-"}</span></div>
                      </div>
                    </div>

                    <div>
                      <table className="w-full text-left text-xs border border-slate-200">
                        <thead className="bg-slate-100 text-slate-700 text-[9px] font-bold uppercase">
                          <tr>
                            <th className="p-2 border-b">Goods Item</th>
                            <th className="p-2 border-b">Brand/Origin</th>
                            <th className="p-2 border-b text-right">Qty</th>
                            <th className="p-2 border-b text-right">Net Weight</th>
                            <th className="p-2 border-b text-right">Rate</th>
                            <th className="p-2 border-b text-right font-black">Final Amount</th>
                          </tr>
                        </thead>
                        <tbody className="text-[10px]">
                          <tr className="border-b">
                            <td className="p-2 font-bold text-slate-800">
                              {goodsName}
                              {(selectedRowForVoucher.chassisCode || selectedRowForVoucher.chassis_code || selectedRowForVoucher.lotNo || selectedRowForVoucher.lot_no) && (
                                <div className="text-[8px] text-slate-500 font-bold uppercase mt-0.5 font-mono">
                                  Chs: {selectedRowForVoucher.chassisCode || selectedRowForVoucher.chassis_code || "-"} | Lot: {selectedRowForVoucher.lotNo || selectedRowForVoucher.lot_no || "-"}
                                </div>
                              )}
                              {(selectedRowForVoucher.applyTax === "Yes" || selectedRowForVoucher.apply_tax === "Yes") && (
                                <div className="text-[8px] text-indigo-650 font-bold uppercase mt-0.5">
                                  Tax: {selectedRowForVoucher.taxType || selectedRowForVoucher.tax_type || "VAT"} ({selectedRowForVoucher.taxPercentage || selectedRowForVoucher.tax_percentage || 0}%) - ${Number(selectedRowForVoucher.taxAmount || selectedRowForVoucher.tax_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-slate-500 font-medium">
                              {brandName} / {selectedRowForVoucher.originCountryName || selectedRowForVoucher.origin_country_name || "Local"}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {rowQty.toLocaleString()} {rowUnit}
                            </td>
                            <td className="p-2 text-right font-mono text-blue-600 font-bold">
                              {rowNetWt.toLocaleString()} kg
                            </td>
                            <td className="p-2 text-right font-mono">
                              ${rowUnitPrice.toLocaleString()}
                            </td>
                            <td className="p-2 text-right font-mono font-black text-emerald-650">
                              {rowCurrency} {rowFinalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-900 text-white rounded-lg p-3 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-350 uppercase">Total Bill Amount:</span>
                      <span className="font-mono text-base font-black text-emerald-400">
                        {rowCurrency} {rowFinalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
