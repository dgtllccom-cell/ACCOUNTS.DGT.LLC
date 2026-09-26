"use client";

import React, { useMemo, useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  Globe,
  ChevronDown,
  ChevronRight,
  Eye,
  Package,
  Loader2,
  CheckCircle2,
  Clock,
  Send,
  Printer,
  X,
  Truck,
  Warehouse,
  Flag,
  FileText,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { UnifiedErpRegisterBar, type UnifiedRegisterKpiData } from "@/components/reports/unified-erp-register-bar";
import { printDomFragmentViaModal } from "@/lib/reports/print-dom-fragment";

type Stage = "warehouse_transfer" | "loading" | "export";

const UAE_COUNTRY_MATCHERS = ["UNITED ARAB", "UAE", "EMIRATES", "AE"];

function isUaeCountryName(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return UAE_COUNTRY_MATCHERS.some((token) => normalized.includes(token));
}

function amountToWordsEn(amount: number, currency = "AED") {
  if (!Number.isFinite(amount)) return `${currency} zero only`;
  const ones = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen"
  ];
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

export interface LocalPurchaseDestinationRecord {
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
  status?: string;
  journal_serial_no?: string;
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
  size?: string;
  purchaseCost?: number;
  purchase_cost?: number;
  taxAmount?: number;
  tax_amount?: number;
  taxPercentage?: number;
  tax_percentage?: number;
  finalCost?: number;
  final_cost?: number;
  localCurrency?: string;
  local_currency?: string;
  paymentMode?: string;
  payment_mode?: string;
  shippingMode?: string;
  shipping_mode?: string;
  supplierName?: string;
  supplier_name?: string;
  warehouseName?: string;
  warehouse_name?: string;
  warehousePlotNo?: string;
  warehouse_plot_no?: string;
  truckNo?: string;
  truck_no?: string;
  driverName?: string;
  driver_name?: string;
  transferDate?: string;
  transfer_date?: string;
  remainingBalance?: number;
  remaining_balance?: number;
  applyTax?: boolean;
  apply_tax?: boolean;
  taxType?: string;
  tax_type?: string;
  purchaseAccountNo?: string;
  purchase_account_no?: string;
  salesAccountNo?: string;
  sales_account_no?: string;
  brokerAccountNo?: string;
  broker_account_no?: string;
  createdAt?: string;
  created_at?: string;
  warehouse_transfer_status?: string | null;
  loading_status?: string | null;
  export_status?: string | null;
  form_data?: any;
}

const STAGE_CONFIG: Record<
  Stage,
  {
    shippingMode: string;
    statusField: "warehouse_transfer_status" | "loading_status" | "export_status";
    icon: React.ComponentType<{ className?: string }>;
    defaultTitle: string;
    pendingLabel: string;
    completedLabel: string;
    actionLabel: string;
    confirmMessage: string;
  }
> = {
  warehouse_transfer: {
    shippingMode: "Transfer Layout",
    statusField: "warehouse_transfer_status",
    icon: Warehouse,
    defaultTitle: "Local Purchase Warehouse Transfer Queue",
    pendingLabel: "Pending Transfer",
    completedLabel: "Transferred",
    actionLabel: "Mark Transfer Completed",
    confirmMessage: "Confirm this bill's stock has been physically transferred to the warehouse?",
  },
  loading: {
    shippingMode: "Loading",
    statusField: "loading_status",
    icon: Truck,
    defaultTitle: "Local Purchase Loading Queue",
    pendingLabel: "Pending Loading",
    completedLabel: "Loaded",
    actionLabel: "Mark Loaded",
    confirmMessage: "Confirm this bill has been loaded onto the truck?",
  },
  export: {
    shippingMode: "Export",
    statusField: "export_status",
    icon: Flag,
    defaultTitle: "Local Purchase Export Queue",
    pendingLabel: "Pending Export",
    completedLabel: "Exported",
    actionLabel: "Confirm Export Handover",
    confirmMessage: "Confirm this bill has been handed over to the Export/Shipping module?",
  },
};

export function LocalPurchaseDestinationQueueView({
  stage,
  session,
}: {
  stage: Stage;
  session?: any;
}) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  const th = (label: string) => translateHeader(activeLang, label);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);
  const tt = (key: string, fb: string) => t(activeLang, key as never, fb);

  const [purchases, setPurchases] = useState<LocalPurchaseDestinationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedRowForVoucher, setSelectedRowForVoucher] = useState<LocalPurchaseDestinationRecord | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const config = STAGE_CONFIG[stage];

  const countries = useMemo(
    () =>
      Array.from(
        new Set(
          purchases
            .map((p) => p.countryName || p.country_name)
            .filter(Boolean) as string[]
        )
      ),
    [purchases]
  );

  const branches = useMemo(
    () =>
      Array.from(
        new Set(
          purchases
            .map((p) => p.branchName || p.branch_name)
            .filter(Boolean) as string[]
        )
      ),
    [purchases]
  );

  // Fetch local purchases for destination queue
  const loadPurchases = async () => {
    setLoading(true);
    try {
      let query = "/api/erp/purchases/local-purchase";
      const params = new URLSearchParams();
      if (selectedCountry) params.append("countryId", selectedCountry);
      if (selectedBranch) params.append("countryBranchId", selectedBranch);
      query += `?${params.toString()}`;

      const res = await fetch(query);
      const payload = await res.json();
      if (payload.ok && payload.data?.purchases) {
        const raw = payload.data.purchases as LocalPurchaseDestinationRecord[];
        const filtered = raw.filter((p) => {
          // Allow posted, accepted, completed records
          if (p.status === "draft") return false;
          const mode = (p.shipping_mode || p.shippingMode || "").toLowerCase().trim();
          const target = config.shippingMode.toLowerCase().trim();
          // Match if shipping mode contains target (e.g. "loading" in "Loading" or "Truck Loading")
          // or if specific stage status is set
          return mode.includes(target) || mode === target || Boolean((p as any)[config.statusField]);
        });
        setPurchases(filtered);
      }
    } catch (err) {
      console.error("Failed to load local purchase destination queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, selectedCountry, selectedBranch]);

  // Filter purchases by search query and status
  const filteredPurchases = useMemo(() => {
    let result = purchases;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          (p.goodsName || p.goods_name || "").toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q) ||
          (p.serialNo || p.serial_no || p.billNo || "").toLowerCase().includes(q) ||
          (p.superAdminSerialNo || p.super_admin_serial_no || "").toLowerCase().includes(q) ||
          (p.branchName || p.branch_name || "").toLowerCase().includes(q) ||
          (p.countryName || p.country_name || "").toLowerCase().includes(q) ||
          (p.supplierName || p.supplier_name || "").toLowerCase().includes(q) ||
          (p.truckNo || p.truck_no || "").toLowerCase().includes(q) ||
          (p.driverName || p.driver_name || "").toLowerCase().includes(q) ||
          (p.warehouseName || p.warehouse_name || "").toLowerCase().includes(q)
      );
    }
    if (selectedStatus) {
      if (selectedStatus === "completed") {
        result = result.filter((p) => (p as any)[config.statusField] === "completed");
      } else if (selectedStatus === "pending") {
        result = result.filter((p) => (p as any)[config.statusField] !== "completed");
      }
    }
    return result;
  }, [purchases, searchQuery, selectedStatus, config.statusField]);

  // Group by Country & Branch Breakdown
  const countryGroups = useMemo(() => {
    const map: Record<
      string,
      {
        countryName: string;
        currency: string;
        records: LocalPurchaseDestinationRecord[];
        totalPurchase: number;
        totalTax: number;
        totalPosted: number;
        branchesMap: Record<
          string,
          {
            branchName: string;
            totalBills: number;
            totalPurchase: number;
            postedAmount: number;
            remainingBalance: number;
          }
        >;
      }
    > = {};

    filteredPurchases.forEach((p) => {
      const cName = p.countryName || p.country_name || session?.countryName || "—";
      const bName = p.branchName || p.branch_name || session?.branchName || "—";
      const curr =
        p.localCurrency ||
        p.local_currency ||
        (cName.toUpperCase().includes("UAE")
          ? "AED"
          : cName.toUpperCase().includes("AFG")
          ? "AFN"
          : "PKR");
      const cost = Number(
        p.finalCost || p.final_cost || p.purchaseCost || p.purchase_cost || 0
      );
      const tax = Number(p.taxAmount || p.tax_amount || 0);

      if (!map[cName]) {
        map[cName] = {
          countryName: cName,
          currency: curr,
          records: [],
          totalPurchase: 0,
          totalTax: 0,
          totalPosted: 0,
          branchesMap: {},
        };
      }

      map[cName].records.push(p);
      map[cName].totalPurchase += cost;
      map[cName].totalTax += tax;
      map[cName].totalPosted += cost;

      if (!map[cName].branchesMap[bName]) {
        map[cName].branchesMap[bName] = {
          branchName: bName,
          totalBills: 0,
          totalPurchase: 0,
          postedAmount: 0,
          remainingBalance: 0,
        };
      }
      map[cName].branchesMap[bName].totalBills += 1;
      map[cName].branchesMap[bName].totalPurchase += cost;
      map[cName].branchesMap[bName].postedAmount += cost;
    });

    return Object.values(map).map((cg) => ({
      ...cg,
      branches: Object.values(cg.branchesMap),
    }));
  }, [filteredPurchases, session]);

  // Flat print rows: same records, same order and same values as the on-screen table.
  const printRows = useMemo(
    () =>
      countryGroups.flatMap((cg) =>
        cg.records.map((row) => {
          const pkgCount = Number(row.quantityKgs || row.quantity_kgs || 0);
          const empKgs = Number(row.emptyKgs || row.empty_kgs || 0);
          const netWt = Number(row.netWeight || row.net_weight || 0);
          const grossWt = Number(row.totalGrossWeight || row.total_gross_weight || netWt + pkgCount * empKgs);
          const rate = Number(row.purchaseRate || row.purchase_rate || 0);
          const totalCost = Number(row.finalCost || row.final_cost || row.purchaseCost || row.purchase_cost || 0);
          return {
            super_sn: row.superAdminSerialNo || row.super_admin_serial_no || row.global_serial_no || "",
            country_sn: row.countrySerialNo || row.country_serial_no || row.computedCountrySerial || "",
            branch_sn: row.branchSerialNo || row.branch_serial_no || row.computedBranchSerial || "",
            voucher_no: row.serialNo || row.serial_no || row.journal_serial_no || row.billNo || "",
            date: row.createdAt || row.created_at || "",
            branch_name: row.branchName || row.branch_name || "",
            country_name: row.countryName || row.country_name || "",
            purchase_acc: row.purchaseAccountNo || row.purchase_account_no || "",
            sales_acc: row.salesAccountNo || row.sales_account_no || row.brokerAccountNo || row.broker_account_no || "",
            goods_name: row.goodsName || row.goods_name || "",
            brand: row.brand || "",
            origin: row.originCountryName || row.origin_country_name || "Local",
            qty: pkgCount,
            unit: row.quantityName || row.quantity_name || "",
            gross_wt: grossWt,
            net_wt: netWt,
            price: rate,
            currency: row.localCurrency || row.local_currency || cg.currency,
            total_cost: totalCost,
            destination:
              stage === "loading"
                ? [row.truckNo || row.truck_no, row.driverName || row.driver_name].filter(Boolean).join(" / ")
                : stage === "warehouse_transfer"
                ? [row.warehouseName || row.warehouse_name, row.warehousePlotNo || row.warehouse_plot_no].filter(Boolean).join(" ")
                : row.warehousePlotNo || row.warehouse_plot_no || "Export",
            status: th(((row as any)[config.statusField] === "completed" ? config.completedLabel : config.pendingLabel).toUpperCase()),
          } as Record<string, unknown>;
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countryGroups, stage, activeLang, config]
  );

  // Financial & Operational Metrics
  const grandTotalEntries = filteredPurchases.length;
  const grandTotalPurchase = useMemo(
    () =>
      filteredPurchases.reduce(
        (acc, p) =>
          acc +
          Number(
            p.finalCost || p.final_cost || p.purchaseCost || p.purchase_cost || 0
          ),
        0
      ),
    [filteredPurchases]
  );
  const completedPurchases = useMemo(
    () => filteredPurchases.filter((p) => (p as any)[config.statusField] === "completed"),
    [filteredPurchases, config.statusField]
  );
  const pendingPurchases = useMemo(
    () => filteredPurchases.filter((p) => (p as any)[config.statusField] !== "completed"),
    [filteredPurchases, config.statusField]
  );
  const completedAmount = useMemo(
    () =>
      completedPurchases.reduce(
        (acc, p) => acc + Number(p.finalCost || p.final_cost || 0),
        0
      ),
    [completedPurchases]
  );
  const pendingAmount = useMemo(
    () =>
      pendingPurchases.reduce(
        (acc, p) => acc + Number(p.finalCost || p.final_cost || 0),
        0
      ),
    [pendingPurchases]
  );

  const kpiSummary: UnifiedRegisterKpiData = useMemo(
    () => ({
      totalRecords: purchases.length,
      draftCount: 0,
      acceptedCount: pendingPurchases.length,
      transferredCount: completedPurchases.length,
      completedCount: completedPurchases.length,
      currency: "AED",
      totalAmount: grandTotalPurchase,
      acceptedAmount: pendingAmount,
      transferredAmount: completedAmount,
      completedAmount: completedAmount,
      totalBranches: Math.max(branches.length, 1),
      activeBranches: Math.max(branches.length, 1),
      inactiveBranches: 0,
      thisMonthCreated: grandTotalEntries,
      thisMonthAmount: grandTotalPurchase,
      thisMonthTransferred: completedPurchases.length,
      thisMonthCompleted: completedPurchases.length,
      quickInfo: {
        currency: "AED",
        exchangeRate: "3.6725",
        company: "DGT LLC",
        financialYear: "2026",
        userName: session?.fullName || session?.email || "—",
        branchName: session?.branchName || "—",
      },
    }),
    [
      purchases,
      grandTotalPurchase,
      pendingPurchases,
      completedPurchases,
      pendingAmount,
      completedAmount,
      branches,
      grandTotalEntries,
      session,
    ]
  );

  // Mark Destination Stage Complete (e.g. Loaded)
  async function markComplete(purchaseId: string) {
    if (!confirm(config.confirmMessage)) return;

    setActingId(purchaseId);
    try {
      const res = await fetch("/api/erp/purchases/local-purchase/destination-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId, stage }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || "Action failed.");
      await loadPurchases();
    } catch (err: any) {
      alert(err?.message || "Action failed.");
    } finally {
      setActingId(null);
    }
  }

  const pageTitle =
    stage === "loading"
      ? th("LOCAL PURCHASE LOADING QUEUE")
      : config.defaultTitle;

  const tableTitle =
    stage === "loading"
      ? th("TRANSACTION LOG & SEARCH REPORT (LOCAL PURCHASE LOADING)")
      : `TRANSACTION LOG & SEARCH REPORT (${config.defaultTitle.toUpperCase()})`;

  return (
    <div
      className="space-y-5 p-4 sm:p-6 text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-950 min-h-screen"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* 5 KPI Summary Cards & Unified Filter Bar (matching Local Purchase Journal Report) */}
      <UnifiedErpRegisterBar
        title={pageTitle}
        subtitle={tt("lpjr.subtitle", "ERP Master Console — Multi-Country Reporting")}
        countries={countries}
        branches={branches}
        selectedCountry={selectedCountry}
        selectedBranch={selectedBranch}
        selectedStatus={selectedStatus}
        onCountryChange={setSelectedCountry}
        onBranchChange={setSelectedBranch}
        onStatusChange={setSelectedStatus}
        searchText={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={tt("lpdest.search_placeholder", "Search booking, supplier, branch, truck...")}
        onResetRefresh={() => {
          setSelectedCountry("");
          setSelectedBranch("");
          setSelectedStatus("");
          setSearchQuery("");
          void loadPurchases();
        }}
        primaryAction={{
          label: tt("lpjr.new_local_purchase", "New Local Purchase"),
          onClick: () => router.push("/dashboard/purchase/local-purchase"),
        }}
        kpiSummary={kpiSummary}
        recordTypeName={
          stage === "loading" ? th("TOTAL LOADING BILLS") : th("TOTAL LOCAL BILLS")
        }
      />

      {/* Country Specific Cards Grid (When records exist) */}
      {countryGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {countryGroups.map((cg) => (
            <Card
              key={cg.countryName}
              className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden"
            >
              <CardHeader className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="font-black text-xs uppercase text-slate-800 dark:text-slate-100">
                    {cg.countryName}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  {cg.branches.length} {th("BRANCHES")}
                </span>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="space-y-1.5 font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-400">CURRENCY:</span>{" "}
                    <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                      {cg.currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{th("TOTAL PURCHASE")}:</span>{" "}
                    <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                      {cg.totalPurchase.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{th("TOTAL TRANSFERRED")}:</span>{" "}
                    <span className="font-mono font-black text-emerald-600">
                      {cg.totalPosted.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5">
                    <span className="text-slate-400">{th("REMAINING BALANCE")}:</span>{" "}
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      0.00
                    </span>
                  </div>
                </div>

                {/* Branch Breakdown Section */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {th("BRANCH BREAKDOWN")}
                  </span>
                  <div className="space-y-1.5">
                    {cg.branches.map((b) => (
                      <div
                        key={b.branchName}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-[11px]"
                      >
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {b.branchName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[10px]">
                            {b.totalBills} bills
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {b.totalPurchase.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Destination Report Table (Matching Local Purchase Journal Report) */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {tableTitle}
              </CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <JournalPrintButton
                title={tableTitle}
                columns={[
                  { key: "super_sn", label: th("SUPER S/N"), align: "center" },
                  { key: "country_sn", label: th("CTY S/N"), align: "center" },
                  { key: "branch_sn", label: th("BR S/N"), align: "center" },
                  { key: "voucher_no", label: th("VOUCHER NO"), align: "center" },
                  { key: "date", label: th("DATE"), align: "center", format: "date" },
                  { key: "branch_name", label: th("BRANCH NAME") },
                  { key: "country_name", label: th("COUNTRY") },
                  { key: "purchase_acc", label: "PURCHASE ACC (DR)", align: "center" },
                  { key: "sales_acc", label: "SALES ACC (CR)", align: "center" },
                  { key: "goods_name", label: th("GOODS NAME") },
                  { key: "brand", label: th("BRAND") },
                  { key: "origin", label: th("ORIGIN") },
                  { key: "qty", label: th("QTY"), align: "right", format: "number" },
                  { key: "unit", label: th("UNIT") },
                  { key: "gross_wt", label: th("GROSS WT"), align: "right", format: "number" },
                  { key: "net_wt", label: th("NET WT"), align: "right", format: "number" },
                  { key: "price", label: th("PRICE"), align: "right", format: "number" },
                  { key: "currency", label: th("CURRENCY"), align: "center" },
                  { key: "total_cost", label: th("TOTAL COST"), align: "right", format: "number" },
                  { key: "destination", label: stage === "loading" ? th("TRUCK / DRIVER") : stage === "warehouse_transfer" ? th("WAREHOUSE") : th("DESTINATION") },
                  { key: "status", label: th("STATUS"), align: "center" },
                ]}
                rows={printRows}
                filters={[
                  ...(selectedCountry ? [{ label: th("COUNTRY"), value: (countries.find((c: any) => (typeof c === "string" ? c : c.id) === selectedCountry) as any)?.name ?? selectedCountry }] : []),
                  ...(selectedBranch ? [{ label: th("BRANCH NAME"), value: (branches.find((b: any) => (typeof b === "string" ? b : b.id) === selectedBranch) as any)?.name ?? selectedBranch }] : []),
                  ...(selectedStatus ? [{ label: th("STATUS"), value: selectedStatus }] : []),
                  ...(searchQuery.trim() ? [{ label: "Search", value: searchQuery.trim() }] : []),
                ]}
                orientation="landscape"
              />
              <span className="text-[10px] font-mono font-bold text-slate-500">
                Total Scoped Entries: {filteredPurchases.length}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
            <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 text-[9px] font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <Th className="p-2.5 text-center border-r border-slate-200 dark:border-slate-700 w-8"></Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-center">
                    {th("SUPER S/N")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-center">
                    {th("CTY S/N")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-center">
                    {th("BR S/N")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    {th("VOUCHER NO")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    {th("DATE")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    {th("BRANCH NAME")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    {th("COUNTRY")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    PURCHASE ACC (DR)
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    SALES ACC (CR)
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    {th("GOODS NAME")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    {th("BRAND")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    {th("ORIGIN")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-right">
                    {th("QTY")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    {th("UNIT")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-right">
                    {th("GROSS WT")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-right">
                    {th("NET WT")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-right">
                    {th("PRICE")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-right font-black">
                    {th("TOTAL COST")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700">
                    {stage === "loading"
                      ? th("TRUCK / DRIVER")
                      : stage === "warehouse_transfer"
                      ? th("WAREHOUSE")
                      : th("DESTINATION")}
                  </Th>
                  <Th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-center">
                    {th("STATUS")}
                  </Th>
                  <Th className="p-2.5 text-center">{th("ACTIONS")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-[10px]">
                {loading ? (
                  <tr>
                    <td colSpan={22} className="p-8 text-center text-slate-400 font-mono">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                      {th("LOADING PURCHASE RECORDS")}
                    </td>
                  </tr>
                ) : filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={22} className="p-12 text-center text-slate-400 font-sans">
                      <Package className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                      <p className="font-bold text-slate-700 dark:text-slate-300">
                        {tt("lpjr.no_transactions", "No local purchase transactions found")}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Posted bills routed to this destination will appear in this queue.
                      </p>
                    </td>
                  </tr>
                ) : (
                  countryGroups.map((cg) => (
                    <Fragment key={cg.countryName}>
                      {/* Country Group Header Row */}
                      <tr className="bg-slate-100 dark:bg-slate-800/80 font-black text-slate-800 dark:text-slate-200 text-[10px]">
                        <td
                          colSpan={22}
                          className="px-4 py-2 uppercase tracking-wider border-y border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              {cg.countryName} ({cg.records.length} RECORDS)
                            </span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              TOTAL: {cg.currency}{" "}
                              {cg.totalPurchase.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {cg.records.map((row, idx) => {
                        const pkgCount = Number(row.quantityKgs || row.quantity_kgs || 0);
                        const empKgs = Number(row.emptyKgs || row.empty_kgs || 0);
                        const calculatedTotalTare = pkgCount * empKgs;
                        const grossWt = Number(
                          row.totalGrossWeight ||
                            row.total_gross_weight ||
                            (row.netWeight || row.net_weight || 0) + calculatedTotalTare
                        );
                        const netWt = Number(row.netWeight || row.net_weight || 0);
                        const rate = Number(row.purchaseRate || row.purchase_rate || 0);
                        const totalCost = Number(
                          row.finalCost ||
                            row.final_cost ||
                            row.purchaseCost ||
                            row.purchase_cost ||
                            0
                        );
                        const curr = row.localCurrency || row.local_currency || cg.currency;

                        const superSerial =
                          row.superAdminSerialNo ||
                          row.super_admin_serial_no ||
                          row.global_serial_no ||
                          "—";
                        const countrySerial =
                          row.countrySerialNo ||
                          row.country_serial_no ||
                          row.computedCountrySerial ||
                          "—";
                        const branchSerial =
                          row.branchSerialNo ||
                          row.branch_serial_no ||
                          row.computedBranchSerial ||
                          "—";
                        const voucherCode =
                          row.serialNo ||
                          row.serial_no ||
                          row.journal_serial_no ||
                          row.billNo ||
                          `LP-${row.id?.slice(0, 5).toUpperCase()}`;

                        const isCompleted = (row as any)[config.statusField] === "completed";
                        const isExpanded = !!expandedRows[row.id];

                        return (
                          <Fragment key={row.id}>
                            <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                              {/* Expand toggle */}
                              <td className="p-2 text-center border-r border-slate-150 dark:border-slate-800">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedRows((prev) => ({
                                      ...prev,
                                      [row.id]: !prev[row.id],
                                    }))
                                  }
                                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </td>

                              <td className="p-2 font-mono text-center border-r border-slate-150 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                                {superSerial}
                              </td>
                              <td className="p-2 font-mono text-center border-r border-slate-150 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                                {countrySerial}
                              </td>
                              <td className="p-2 font-mono text-center border-r border-slate-150 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                                {branchSerial}
                              </td>
                              <td className="p-2 font-mono font-bold text-blue-600 dark:text-blue-400 border-r border-slate-150 dark:border-slate-800">
                                {voucherCode}
                              </td>
                              <td className="p-2 font-mono text-slate-500 border-r border-slate-150 dark:border-slate-800">
                                {new Date(
                                  row.createdAt || row.created_at || Date.now()
                                ).toLocaleDateString("en-GB")}
                              </td>
                              <td className="p-2 font-semibold border-r border-slate-150 dark:border-slate-800">
                                {row.branchName || row.branch_name || "-"}
                              </td>
                              <td className="p-2 border-r border-slate-150 dark:border-slate-800">
                                {row.countryName || row.country_name || "-"}
                              </td>
                              <td className="p-2 font-mono text-[9px] font-bold text-blue-600 dark:text-blue-400 border-r border-slate-150 dark:border-slate-800">
                                {row.purchaseAccountNo || row.purchase_account_no || "—"}
                              </td>
                              <td className="p-2 font-mono text-[9px] font-bold text-purple-600 dark:text-purple-400 border-r border-slate-150 dark:border-slate-800">
                                {row.salesAccountNo ||
                                  row.sales_account_no ||
                                  row.brokerAccountNo ||
                                  row.broker_account_no ||
                                  "—"}
                              </td>
                              <td className="p-2 font-bold text-slate-900 dark:text-slate-100 border-r border-slate-150 dark:border-slate-800">
                                {row.goodsName || row.goods_name || "-"}
                              </td>
                              <td className="p-2 text-slate-600 dark:text-slate-400 border-r border-slate-150 dark:border-slate-800">
                                {row.brand || "-"}
                              </td>
                              <td className="p-2 border-r border-slate-150 dark:border-slate-800">
                                {row.originCountryName ||
                                  row.origin_country_name ||
                                  "Local"}
                              </td>
                              <td className="p-2 text-right font-mono font-bold border-r border-slate-150 dark:border-slate-800">
                                {pkgCount.toLocaleString()}
                              </td>
                              <td className="p-2 border-r border-slate-150 dark:border-slate-800">
                                {row.quantityName || row.quantity_name || "—"}
                              </td>
                              <td className="p-2 text-right font-mono border-r border-slate-150 dark:border-slate-800">
                                {grossWt.toLocaleString()} kg
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-blue-600 dark:text-blue-400 border-r border-slate-150 dark:border-slate-800">
                                {netWt.toLocaleString()} kg
                              </td>
                              <td className="p-2 text-right font-mono border-r border-slate-150 dark:border-slate-800">
                                {rate > 0 ? `${rate.toFixed(2)} ${curr}` : "-"}
                              </td>
                              <td className="p-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 border-r border-slate-150 dark:border-slate-800">
                                {curr}{" "}
                                {totalCost.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>

                              {/* Truck / Driver / Destination info */}
                              <td className="p-2 border-r border-slate-150 dark:border-slate-800 text-[10px]">
                                {stage === "loading" ? (
                                  <div>
                                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                      {row.truckNo || row.truck_no || "—"}
                                    </div>
                                    <div className="text-slate-500 text-[9px]">
                                      {row.driverName || row.driver_name || "—"}
                                    </div>
                                  </div>
                                ) : stage === "warehouse_transfer" ? (
                                  <div>
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                      {row.warehouseName || row.warehouse_name || "—"}
                                    </div>
                                    <div className="text-slate-400 text-[9px]">
                                      {row.warehousePlotNo || row.warehouse_plot_no || ""}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-slate-700 dark:text-slate-300">
                                    {row.warehousePlotNo || row.warehouse_plot_no || "Export"}
                                  </div>
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="p-2 text-center border-r border-slate-150 dark:border-slate-800">
                                {isCompleted ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    <CheckCircle2 className="h-2.5 w-2.5" />{" "}
                                    {th(config.completedLabel.toUpperCase())}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                    <Clock className="h-2.5 w-2.5" />{" "}
                                    {th(config.pendingLabel.toUpperCase())}
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {!isCompleted && (
                                    <Button
                                      size="sm"
                                      disabled={actingId === row.id}
                                      onClick={() => void markComplete(row.id)}
                                      className="h-6 px-2 text-[9px] font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-md flex items-center gap-1 shadow-xs"
                                    >
                                      {actingId === row.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Send className="h-3 w-3" />
                                      )}
                                      {th(config.actionLabel.toUpperCase())}
                                    </Button>
                                  )}

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedRowForVoucher(row)}
                                    className="h-6 px-2 text-[9px] font-bold text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950 rounded-md"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    {th("View Voucher")}
                                  </Button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Detail Panel */}
                            {isExpanded && (
                              <tr className="bg-slate-50/60 dark:bg-slate-850/60">
                                <td colSpan={22} className="p-4 border-b border-slate-200 dark:border-slate-800">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px]">
                                    <div>
                                      <span className="font-bold text-slate-400 block mb-1">
                                        SUPPLIER DETAILS
                                      </span>
                                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                                        {row.supplierName || row.supplier_name || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="font-bold text-slate-400 block mb-1">
                                        LOGISTICS & DESTINATION
                                      </span>
                                      <p className="text-slate-700 dark:text-slate-300">
                                        Mode: {row.shippingMode || row.shipping_mode || "Loading"}
                                      </p>
                                      {row.truckNo && (
                                        <p className="text-slate-700 dark:text-slate-300 font-mono">
                                          Truck: {row.truckNo}
                                        </p>
                                      )}
                                      {row.driverName && (
                                        <p className="text-slate-700 dark:text-slate-300">
                                          Driver: {row.driverName}
                                        </p>
                                      )}
                                    </div>
                                    <div>
                                      <span className="font-bold text-slate-400 block mb-1">
                                        PAYMENT & TAX
                                      </span>
                                      <p className="text-slate-700 dark:text-slate-300">
                                        Payment Mode: {row.paymentMode || row.payment_mode || "Cash"}
                                      </p>
                                      <p className="text-slate-700 dark:text-slate-300">
                                        Tax: {row.taxAmount ? `${curr} ${Number(row.taxAmount).toFixed(2)} (${row.taxPercentage || 0}%)` : "No Tax"}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="font-bold text-slate-400 block mb-1">
                                        CHASSIS / LOT / SIZE
                                      </span>
                                      <p className="text-slate-700 dark:text-slate-300">
                                        Size: {row.size || "—"}
                                      </p>
                                      <p className="text-slate-700 dark:text-slate-300 font-mono">
                                        Lot: {row.lotNo || row.lot_no || "—"}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Printable A4 Voucher Modal (Identical to Local Purchase Journal Report) */}
      {selectedRowForVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 print:hidden">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" /> VOUCHER DETAILS FOR{" "}
                {selectedRowForVoucher.serialNo ||
                  selectedRowForVoucher.serial_no ||
                  `LP-${selectedRowForVoucher.id?.slice(0, 5).toUpperCase()}`}
              </h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => printDomFragmentViaModal("printable-modal-voucher", "Voucher")}
                  className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="h-3.5 w-3.5" /> {th("Print")}
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedRowForVoucher(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-colors"
                >
                  {th("Close")}
                </button>
              </div>
            </div>

            <div
              id="printable-modal-voucher"
              className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 font-sans text-xs"
            >
              {(() => {
                const rowCountry =
                  selectedRowForVoucher.countryName ||
                  selectedRowForVoucher.country_name ||
                  session?.branchName ||
                  "";
                const isUAE = isUaeCountryName(rowCountry);
                const rowFinalCost = Number(
                  selectedRowForVoucher.finalCost ||
                    selectedRowForVoucher.final_cost ||
                    0
                );
                const rowTaxAmt = Number(
                  selectedRowForVoucher.taxAmount ||
                    selectedRowForVoucher.tax_amount ||
                    0
                );
                const rowSubtotal = Math.max(rowFinalCost - rowTaxAmt, 0);
                const rowGrossWt = Number(
                  selectedRowForVoucher.totalGrossWeight ||
                    selectedRowForVoucher.total_gross_weight ||
                    selectedRowForVoucher.quantityKgs ||
                    selectedRowForVoucher.quantity_kgs ||
                    0
                );
                const rowNetWt = Number(
                  selectedRowForVoucher.netWeight ||
                    selectedRowForVoucher.net_weight ||
                    0
                );
                const rowQty = Number(
                  selectedRowForVoucher.quantityKgs ||
                    selectedRowForVoucher.quantity_kgs ||
                    0
                );
                const rowDate = new Date(
                  selectedRowForVoucher.createdAt ||
                    selectedRowForVoucher.created_at ||
                    Date.now()
                ).toLocaleDateString("en-GB");
                const rowCurrency =
                  selectedRowForVoucher.localCurrency ||
                  selectedRowForVoucher.local_currency ||
                  "AED";
                const rowVatPercent = Number(
                  selectedRowForVoucher.taxPercentage ||
                    selectedRowForVoucher.tax_percentage ||
                    5
                );
                const rowGrandTotal = rowFinalCost;
                const rowUnit =
                  selectedRowForVoucher.quantityName ||
                  selectedRowForVoucher.quantity_name ||
                  "Bags";
                const rowUnitPrice = Number(
                  selectedRowForVoucher.purchaseRate ||
                    selectedRowForVoucher.purchase_rate ||
                    0
                );
                const voucherRef =
                  selectedRowForVoucher.serialNo ||
                  selectedRowForVoucher.serial_no ||
                  selectedRowForVoucher.journal_serial_no ||
                  `LP-${selectedRowForVoucher.id?.slice(0, 5).toUpperCase()}`;
                const _row = selectedRowForVoucher as any;
                const companyName =
                  _row.companyName ||
                  _row.company_name ||
                  _row.branding_company_name ||
                  _row.countryName ||
                  _row.country_name ||
                  "DGT LLC";
                const branchName =
                  _row.branchName ||
                  _row.branch_name ||
                  _row.cityBranchName ||
                  _row.city_branch_name ||
                  "";
                const officeAddress = _row.branding_address || _row.address || "";
                const officePhone = _row.branding_phone || _row.phone || "";
                const officeEmail = _row.branding_email || _row.email || "";
                const trnNumber = _row.tax_number || _row.trn || "100234567800003";
                const supplierName =
                  selectedRowForVoucher.supplierName ||
                  selectedRowForVoucher.supplier_name ||
                  "—";
                const paymentMethod =
                  selectedRowForVoucher.paymentMode ||
                  selectedRowForVoucher.payment_mode ||
                  "Cash";
                const shippingMode =
                  selectedRowForVoucher.shippingMode ||
                  selectedRowForVoucher.shipping_mode ||
                  "Loading";
                const goodsName =
                  selectedRowForVoucher.goodsName ||
                  selectedRowForVoucher.goods_name ||
                  "Local Purchase Goods";
                const hsCode =
                  selectedRowForVoucher.chassisCode ||
                  selectedRowForVoucher.chassis_code ||
                  "-";
                const brandName = selectedRowForVoucher.brand || "-";
                const sizeName = selectedRowForVoucher.size || "-";

                if (isUAE) {
                  return (
                    <div className="overflow-x-auto print:overflow-visible">
                      <div className="mx-auto max-w-[794px] space-y-4 bg-white text-[10px] text-slate-800 print:max-w-none print:text-[9px]">
                        <div className="overflow-hidden rounded-2xl border border-slate-300">
                          <div className="grid grid-cols-[88px_1fr_210px] gap-4 bg-slate-950 p-5 text-white">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-950">
                              {th("LOGO")}
                            </div>
                            <div className="space-y-1">
                              <h2 className="text-xl font-black uppercase tracking-[0.18em]">
                                {tt("lpjr.inv_tax_invoice", "Tax Invoice")}
                              </h2>
                              <p className="text-sm font-extrabold uppercase tracking-wide">
                                {companyName}
                              </p>
                              <p className="text-[10px] text-slate-300">{branchName}</p>
                              <p className="max-w-lg text-[10px] leading-4 text-slate-300">
                                {officeAddress}
                              </p>
                            </div>
                            <div className="space-y-1 text-right text-[10px]">
                              <p>
                                {tt("lpjr.inv_invoice_no", "Invoice No")}:{" "}
                                <span className="font-mono font-black text-white">
                                  {voucherRef}
                                </span>
                              </p>
                              <p>
                                {tt("lpjr.inv_inv_date", "Invoice Date")}:{" "}
                                <span className="font-mono font-bold">{rowDate}</span>
                              </p>
                              <p>
                                {tt("lpjr.inv_payment_method", "Payment Method")}:{" "}
                                <span className="font-bold">{paymentMethod}</span>
                              </p>
                              <p>
                                {tt("lpjr.inv_phone", "Phone")}:{" "}
                                <span className="font-bold">{officePhone}</span>
                              </p>
                              <p>
                                {tt("lpjr.inv_email", "Email")}:{" "}
                                <span className="font-bold">{officeEmail}</span>
                              </p>
                              <p className="rounded-lg bg-white/10 px-2 py-1 font-bold text-blue-100">
                                {tt("lpjr.inv_trn_vat", "TRN / VAT")}: {trnNumber}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 border-b border-slate-200 bg-slate-50 p-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                {tt("lpjr.inv_supplier_details", "Supplier Details")}
                              </p>
                              <p className="text-sm font-black text-slate-900">
                                {supplierName}
                              </p>
                              <p className="mt-1 text-slate-500">
                                {th("COUNTRY")}: United Arab Emirates
                              </p>
                              <p className="text-slate-500">
                                {tt("lpjr.inv_invoice_currency", "Invoice Currency")}:{" "}
                                <span className="font-bold text-slate-800">
                                  {rowCurrency}
                                </span>
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                {tt("lpjr.inv_delivery_wh", "Delivery / Warehouse")}
                              </p>
                              <p>
                                {tt("lpjr.inv_transaction_type", "Transaction Type")}:{" "}
                                <span className="font-bold">{shippingMode}</span>
                              </p>
                              <p>
                                {tt("lpjr.inv_warehouse", "Warehouse")}:{" "}
                                <span className="font-bold">
                                  {selectedRowForVoucher.warehouseName ||
                                    selectedRowForVoucher.warehouse_name ||
                                    "-"}
                                </span>
                              </p>
                              <p>
                                {tt("lpjr.inv_truck_no", "Truck No")}:{" "}
                                <span className="font-mono font-bold text-indigo-700">
                                  {selectedRowForVoucher.truckNo ||
                                    selectedRowForVoucher.truck_no ||
                                    "-"}
                                </span>
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                {tt("lpjr.inv_invoice_control", "Invoice Control")}
                              </p>
                              <p>
                                {tt("common.branch", "Branch")}:{" "}
                                <span className="font-bold">{branchName}</span>
                              </p>
                              <p>
                                {tt("lpjr.inv_doc_ref", "Document Ref")}:{" "}
                                <span className="font-mono font-bold">{voucherRef}</span>
                              </p>
                              <p>
                                Status:{" "}
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                                  {selectedRowForVoucher.status === "posted"
                                    ? tt("lpjr.inv_posted", "Posted")
                                    : tt("lpjr.inv_accepted", "Accepted")}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="p-4">
                            <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 text-[9px]">
                              <thead className="bg-slate-900 text-white">
                                <tr>
                                  <Th className="border border-slate-800 p-2 text-left">
                                    {tt("lpjr.inv_sr", "Sr.")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-left">
                                    {tt("lpjr.inv_goods_name", "Goods Name")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-left">
                                    {tt("lpjr.inv_hs_code", "HS Code")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-left">
                                    {tt("lpjr.inv_brand", "Brand")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-left">
                                    {tt("lpjr.inv_size", "Size")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-right">
                                    {tt("lpjr.inv_quantity", "Quantity")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-left">
                                    {tt("lpjr.inv_unit", "Unit")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-right">
                                    {tt("lpjr.inv_unit_price", "Unit Price")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-right">
                                    {tt("lpjr.inv_taxable_amt", "Taxable Amount")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-right">
                                    {tt("lpjr.inv_vat_pct", "VAT %")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-right">
                                    {tt("lpjr.inv_vat_amt", "VAT Amount")}
                                  </Th>
                                  <Th className="border border-slate-800 p-2 text-right">
                                    {tt("lpjr.inv_total_amt", "Total Amount")}
                                  </Th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="align-top">
                                  <td className="border border-slate-200 p-2">1</td>
                                  <td className="border border-slate-200 p-2 font-bold text-slate-900">
                                    {goodsName}
                                    <div className="mt-1 text-[8px] font-semibold text-slate-500">
                                      {tt("lpjr.inv_gross_wt", "Gross WT")}:{" "}
                                      {rowGrossWt.toLocaleString()} kg |{" "}
                                      {tt("lpjr.inv_net_wt_label", "Net WT")}:{" "}
                                      {rowNetWt.toLocaleString()} kg
                                    </div>
                                  </td>
                                  <td className="border border-slate-200 p-2 font-mono">
                                    {hsCode}
                                  </td>
                                  <td className="border border-slate-200 p-2">{brandName}</td>
                                  <td className="border border-slate-200 p-2">{sizeName}</td>
                                  <td className="border border-slate-200 p-2 text-right font-mono">
                                    {rowQty.toLocaleString()}
                                  </td>
                                  <td className="border border-slate-200 p-2">{rowUnit}</td>
                                  <td className="border border-slate-200 p-2 text-right font-mono">
                                    {rowUnitPrice.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="border border-slate-200 p-2 text-right font-mono">
                                    {rowSubtotal.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="border border-slate-200 p-2 text-right font-mono">
                                    {rowVatPercent}%
                                  </td>
                                  <td className="border border-slate-200 p-2 text-right font-mono text-red-650">
                                    {rowTaxAmt.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="border border-slate-200 p-2 text-right font-mono font-black text-emerald-700">
                                    {rowCurrency}{" "}
                                    {rowFinalCost.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                </tr>
                              </tbody>
                            </table>

                            <div className="mt-4 grid grid-cols-[1fr_310px] gap-4">
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                  {tt("lpjr.inv_amount_words", "Amount In Words")}
                                </p>
                                <p className="text-sm font-black capitalize text-slate-900">
                                  {amountToWordsEn(rowGrandTotal, rowCurrency)}
                                </p>
                                <div className="mt-4 grid grid-cols-2 gap-3 text-[9px]">
                                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
                                    <p className="font-black uppercase text-slate-500">
                                      {tt("lpjr.inv_qr_code", "QR Code")}
                                    </p>
                                    <p className="mt-2 text-slate-400 font-bold">
                                      {tt("lpjr.inv_qr_ref", "QR Reference: UAE e-invoice standard.")}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
                                    <p className="font-black uppercase text-slate-500">
                                      {tt("lpjr.inv_company_stamp", "Company Stamp")}
                                    </p>
                                    <p className="mt-2 text-slate-400 font-bold">
                                      {tt("lpjr.inv_stamp_space", "Authorized Stamp Space")}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="overflow-hidden rounded-xl border border-slate-300 text-[10px]">
                                <div className="bg-slate-100 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-700">
                                  {tt("lpjr.inv_summary", "Summary")}
                                </div>
                                <div className="space-y-2 p-3">
                                  <div className="flex justify-between">
                                    <span>{tt("lpjr.inv_sub_total", "Sub Total")}</span>
                                    <span className="font-mono font-bold">
                                      {rowCurrency}{" "}
                                      {rowSubtotal.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-red-650">
                                    <span>{tt("lpjr.inv_vat_total", "VAT Total")}</span>
                                    <span className="font-mono font-bold">
                                      {rowCurrency}{" "}
                                      {rowTaxAmt.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-black text-emerald-700">
                                    <span>{tt("lpjr.inv_grand_total", "Grand Total")}</span>
                                    <span className="font-mono">
                                      {rowCurrency}{" "}
                                      {rowGrandTotal.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // International / Non-UAE voucher layout
                return (
                  <div className="space-y-4">
                    <div className="border-b pb-3">
                      <div className="flex justify-between">
                        <div>
                          <h2 className="text-base font-bold text-slate-900">
                            {companyName}
                          </h2>
                          <p className="text-slate-500">{branchName}</p>
                          <p className="text-slate-500">{rowCountry}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-blue-600">
                            {voucherRef}
                          </p>
                          <p className="text-slate-500">{rowDate}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <p className="font-bold text-slate-700">Supplier</p>
                        <p>{supplierName}</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-700">
                          {stage === "loading" ? "Truck & Driver" : "Destination"}
                        </p>
                        <p>
                          {selectedRowForVoucher.truckNo || selectedRowForVoucher.truck_no || "—"}
                          {selectedRowForVoucher.driverName ? ` (${selectedRowForVoucher.driverName})` : ""}
                        </p>
                      </div>
                    </div>

                    <table className="w-full border text-[11px]">
                      <thead className="bg-slate-100 font-bold">
                        <tr>
                          <th className="p-2 border text-left">Goods</th>
                          <th className="p-2 border text-left">Brand</th>
                          <th className="p-2 border text-right">Quantity</th>
                          <th className="p-2 border text-right">Rate</th>
                          <th className="p-2 border text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-2 border font-bold">{goodsName}</td>
                          <td className="p-2 border">{brandName}</td>
                          <td className="p-2 border text-right font-mono">
                            {rowQty.toLocaleString()} {rowUnit}
                          </td>
                          <td className="p-2 border text-right font-mono">
                            {rowUnitPrice.toFixed(2)}
                          </td>
                          <td className="p-2 border text-right font-mono font-bold text-emerald-600">
                            {rowCurrency} {rowFinalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
