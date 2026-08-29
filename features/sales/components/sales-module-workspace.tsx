"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  MoreVertical,
  PackageCheck,
  Printer,
  RefreshCw,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openSalesA4ReportWindow } from "@/lib/reports/open-sales-a4-report-window";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type SalesModuleType = "sales" | "stock";

type SalesOrderRow = {
  [key: string]: any;
  id: string;
  sales_order_no?: string | null;
  sales_contract_no?: string | null;
  currency_code?: string | null;
  exchange_rate?: number | null;
  order_total?: number | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  payment_status?: string | null;
  ledger_posting_status?: string | null;
  created_at?: string | null;
  form_data?: any;
};

type OrdersPayload = {
  ok?: boolean;
  data?: { orders?: SalesOrderRow[] };
  salesOrders?: SalesOrderRow[];
  orders?: SalesOrderRow[];
  error?: { message?: string } | string;
};

const countryCurrency: Record<string, string> = {
  "united arab emirates": "AED",
  uae: "AED",
  pakistan: "PKR",
  afghanistan: "AFN",
  india: "INR",
  iran: "IRR"
};

function form(row: SalesOrderRow) {
  return row.form_data?.form || {};
}

function goods(row: SalesOrderRow) {
  const entries = row.form_data?.goodsEntries;
  return Array.isArray(entries) ? entries : [];
}

function country(row: SalesOrderRow) {
  const f = form(row);
  return String(f.branchCountry || f.countryName || f.loadingCountry || f.originCountry || f.destinationCountry || "Unassigned Country");
}

function branch(row: SalesOrderRow) {
  const f = form(row);
  return String(f.branchName || f.purchaseAccountBranch || f.salesAccountBranch || "Unassigned Branch");
}

function currency(row: SalesOrderRow) {
  const f = form(row);
  const explicit = String(f.pricingCurrency || f.currencyType || row.currency_code || f.currency || "").trim().toUpperCase();
  if (explicit) return explicit;
  return countryCurrency[country(row).toLowerCase()] || "USD";
}

function soNumber(row: SalesOrderRow) {
  return row.sales_order_no || form(row).salesOrderNo || form(row).bookingNo || "-";
}

function contractNumber(row: SalesOrderRow) {
  return row.sales_contract_no || form(row).salesContractNo || "-";
}

function customer(row: SalesOrderRow) {
  const f = form(row);
  return f.customerName || f.purchaseAccountName || f.salesAccountName || "-";
}

function product(row: SalesOrderRow) {
  const entries = goods(row);
  return entries.map((item: any) => item.goodsName).filter(Boolean).join(", ") || form(row).goodsName || "-";
}

function quantity(row: SalesOrderRow) {
  const entries = goods(row);
  if (entries.length) return entries.reduce((sum: number, item: any) => sum + Number(item.qtyNo || 0), 0);
  return Number(form(row).qtyNo || 0);
}

function weight(row: SalesOrderRow) {
  const entries = goods(row);
  if (entries.length) return entries.reduce((sum: number, item: any) => sum + Number(item.netWeight || item.grossWeight || 0), 0);
  return Number(form(row).netWeight || form(row).grossWeight || 0);
}

function containers(row: SalesOrderRow) {
  return Number(form(row).containersCount || form(row).containerCount || form(row).totalContainers || 0);
}

function amount(row: SalesOrderRow) {
  const entries = goods(row);
  const total = Number(row.order_total || row.form_data?.totals?.grandFinal || form(row).grandFinal || form(row).totalAmount || 0);
  if (total > 0) return total;
  return entries.reduce((sum: number, item: any) => sum + Number(item.finalAmount || item.localAmount || item.totalAmount || 0), 0);
}

function advance(row: SalesOrderRow) {
  return Number(row.paid_amount || 0);
}

function remaining(row: SalesOrderRow) {
  const explicit = Number(row.remaining_amount || 0);
  if (explicit > 0) return explicit;
  return Math.max(0, amount(row) - advance(row));
}

function status(row: SalesOrderRow) {
  return String(form(row).lifecycleStatus || row.payment_status || row.ledger_posting_status || form(row).status || "Pending");
}

function date(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB");
}

function money(value: number, code: string) {
  return `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`;
}

function statusClass(value: string) {
  const s = value.toLowerCase();
  if (s.includes("confirm") || s.includes("paid") || s.includes("posted") || s.includes("complete")) return "border-emerald-250 bg-emerald-950/20 text-emerald-400";
  if (s.includes("loading") || s.includes("transit")) return "border-blue-850 bg-blue-950/20 text-blue-400";
  if (s.includes("partial") || s.includes("pending")) return "border-amber-850 bg-amber-950/20 text-amber-400";
  return "border-slate-850 bg-slate-950/20 text-slate-400";
}

function stageMatches(row: SalesOrderRow, title: string, type: SalesModuleType) {
  const haystack = `${title} ${status(row)} ${form(row).currentStep || ""} ${form(row).nextStep || ""} ${form(row).containerStatus || ""} ${form(row).inventoryStatus || ""}`.toLowerCase();
  if (type === "stock") return true;
  if (title.toLowerCase().includes("tracking")) return true;
  if (title.toLowerCase().includes("finalized")) return haystack.includes("final") || haystack.includes("complete") || haystack.includes("closed");
  if (title.toLowerCase().includes("confirm")) return haystack.includes("confirm");
  return true;
}

function exportCsv(rows: SalesOrderRow[], title: string) {
  const headers = ["SO Number", "Contract/Bill", "Date", "Country", "Branch", "Customer", "Goods", "Quantity", "Weight", "Containers", "Currency", "Amount", "Paid", "Remaining", "Status"];
  const csv = [
    headers.join(","),
    ...rows.map((row) => [
      soNumber(row), contractNumber(row), date(row.created_at), country(row), branch(row), customer(row), product(row), String(quantity(row)), String(weight(row)), String(containers(row)), currency(row), String(amount(row)), String(advance(row)), String(remaining(row)), status(row)
    ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "sales-report"}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SalesModuleWorkspace({
  title,
  description,
  type = "sales"
}: {
  title: string;
  description: string;
  type?: SalesModuleType;
}) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  const lang = activeLang;
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportNow, setReportNow] = useState<{ date: string; time: string } | null>(null);

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/erp/sales/orders?limit=300", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as OrdersPayload;
      if (!response.ok || body.ok === false) {
        const message = typeof body.error === "string" ? body.error : body.error?.message;
        throw new Error(message || "Sales records could not be loaded.");
      }
      let rows: SalesOrderRow[] = [];
      if (Array.isArray(body?.salesOrders)) {
        rows = body.salesOrders;
      } else if (Array.isArray(body?.data)) {
        rows = body.data as any;
      } else if (Array.isArray(body?.orders)) {
        rows = body.orders;
      }
      setOrders(rows);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "Sales records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
    const now = new Date();
    setReportNow({
      date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase(),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toUpperCase()
    });
  }, []);

  const stageRows = useMemo(() => orders.filter((row) => stageMatches(row, title, type)), [orders, title, type]);
  const countries = useMemo(() => Array.from(new Set(stageRows.map(country))).sort(), [stageRows]);
  const columns = useMemo(() => [
    { key: "sales_order_no", label: "SO Number" },
    { key: "sales_contract_no", label: "Contract No" },
    { key: "created_at", label: "Date" },
    { key: "countryName", label: "Country" },
    { key: "branchName", label: "Branch" },
    { key: "customerName", label: "Customer" },
    { key: "productName", label: "Goods" },
    { key: "quantity", label: "Qty" },
    { key: "order_total", label: "Total Amount" },
    { key: "payment_status", label: "Status" }
  ], []);
  const statuses = useMemo(() => Array.from(new Set(stageRows.map(status))).sort(), [stageRows]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stageRows.filter((row) => {
      if (countryFilter && country(row) !== countryFilter) return false;
      if (statusFilter && status(row) !== statusFilter) return false;
      if (!q) return true;
      return [soNumber(row), contractNumber(row), customer(row), product(row), branch(row), country(row), status(row)]
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [countryFilter, query, stageRows, statusFilter]);

  const countryCards = useMemo(() => {
    const map = new Map<string, { country: string; totalOrders: number; currencies: Map<string, { currency: string; count: number; invoice: number; advance: number; remaining: number }> }>();
    rows.forEach((row) => {
      const cntry = country(row) || "Unknown Country";
      const curr = currency(row) || "USD";
      
      if (!map.has(cntry)) {
        map.set(cntry, { country: cntry, totalOrders: 0, currencies: new Map() });
      }
      
      const countryData = map.get(cntry)!;
      countryData.totalOrders += 1;
      
      if (!countryData.currencies.has(curr)) {
        countryData.currencies.set(curr, { currency: curr, count: 0, invoice: 0, advance: 0, remaining: 0 });
      }
      
      const currData = countryData.currencies.get(curr)!;
      currData.count += 1;
      currData.invoice += amount(row);
      currData.advance += advance(row);
      currData.remaining += remaining(row);
    });
    
    return Array.from(map.values()).map(c => ({
      ...c,
      currencies: Array.from(c.currencies.values()).sort((a, b) => a.currency.localeCompare(b.currency))
    })).sort((a, b) => a.country.localeCompare(b.country));
  }, [rows]);

  const totals = useMemo(() => ({
    orders: rows.length,
    quantity: rows.reduce((sum, row) => sum + quantity(row), 0),
    weight: rows.reduce((sum, row) => sum + weight(row), 0),
    containers: rows.reduce((sum, row) => sum + containers(row), 0)
  }), [rows]);

  return (
    <div className="w-full max-w-[1600px] mx-auto p-2 sm:p-4 md:p-6 space-y-6 text-slate-900 dark:text-slate-100 font-sans min-h-screen">
      
      {/* Header Banner — Standard ERP Gradient Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white rounded-3xl border border-slate-800 p-5 sm:p-7 shadow-lg">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" variant="outline" size="sm" className="h-9 px-3 border-slate-700 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-bold transition" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {t(lang, "common.back", "Back")}
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl sm:text-2xl md:text-3xl font-black text-white">{title}</h1>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-400 border border-emerald-500/30">{t(lang, "purchase.pmw_spreadsheet_dashboard", "Spreadsheet Dashboard")}</span>
              </div>
              <p className="truncate text-xs sm:text-sm text-slate-300 font-medium mt-0.5">{description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JournalPrintButton
              title={`${title} Journal`}
              fetchFullData={async () => rows as Record<string, unknown>[]}
              columns={[
                { key: "sales_order_no", label: "SO Number" },
                { key: "sales_contract_no", label: "Contract No" },
                { key: "created_at", label: "Date" },
                { key: "countryName", label: "Country" },
                { key: "branchName", label: "Branch" },
                { key: "customerName", label: "Customer" },
                { key: "productName", label: "Goods" },
                { key: "quantity", label: "Qty", align: "right" },
                { key: "order_total", label: "Total Amount", align: "right" },
                { key: "payment_status", label: "Status" },
              ]}
              className="h-9 font-extrabold shadow-md"
            />
          </div>
        </div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Toolbar & Filters */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(lang, "sales.smw_search_placeholder", "Search SO, Customer, Goods, Branch...")}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-10 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 font-bold px-3.5 rounded-xl" onClick={() => setFiltersOpen((value) => !value)}>
              <Filter className="h-4 w-4 mr-1.5 text-slate-500" /> {t(lang, "purchase.pmw_filter", "Filter")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-10 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 font-bold px-3.5 rounded-xl" onClick={() => { setQuery(""); setCountryFilter(""); setStatusFilter(""); void loadOrders(); }}>
              <RefreshCw className={cn("h-4 w-4 mr-1.5 text-slate-500", loading && "animate-spin")} /> {t(lang, "common.refresh", "Refresh")}
            </Button>
            <span className="hidden h-10 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-600 dark:text-slate-400 lg:inline-flex">
              <CalendarDays className="h-4 w-4 text-emerald-500" /> {reportNow ? `${reportNow.date}, ${reportNow.time}` : "-"}
            </span>
            <div className="relative">
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 rounded-xl" onClick={() => setActionsOpen((value) => !value)} aria-label={t(lang, "common.actions", "Actions")}>
                <MoreVertical className="h-4 w-4" />
              </Button>
              {actionsOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-1.5 text-xs shadow-xl text-slate-800 dark:text-slate-200 font-medium">
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-bold hover:bg-slate-100 dark:hover:bg-slate-900" onClick={() => exportCsv(rows, title)}>
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> {t(lang, "purchase.pmw_export_excel", "Export Excel")}
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-bold hover:bg-slate-100 dark:hover:bg-slate-900" onClick={() => { import("@/lib/reports/open-generic-erp-report").then(({ openGenericErpReport }) => { openGenericErpReport({ title: title || "Sales Report", lang, orientation: "landscape", columns: columns.map(c => ({ key: c.key, label: c.label })), rows: rows as Record<string, unknown>[] }); }); }}>
                    <Printer className="h-4 w-4 text-cyan-500" /> {t(lang, "purchase.pmw_print_pdf", "Print / PDF")}
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-bold hover:bg-slate-100 dark:hover:bg-slate-900" onClick={() => exportCsv(rows, title)}>
                    <Download className="h-4 w-4 text-slate-400" /> {t(lang, "purchase.pmw_download_csv", "Download CSV")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {filtersOpen ? (
          <div className="mt-3 grid gap-3 border-t border-slate-200 dark:border-slate-800 pt-3 sm:grid-cols-3">
            <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-semibold">
              <option value="">{t(lang, "common.all_countries", "All Countries")}</option>
              {countries.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-semibold">
              <option value="">{t(lang, "common.all_status", "All Status")}</option>
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input type="date" className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-semibold" />
          </div>
        ) : null}
      </section>

      {/* Country Breakdown Cards */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
          <span>{t(lang, "purchase.pmw_branch_name_label", "Branch Name:")} <b className="text-slate-900 dark:text-slate-100">{rows[0] ? branch(rows[0]) : t(lang, "common.all_branches", "All Branches")}</b></span>
          <span>{t(lang, "purchase.pmw_user_name_label", "User Name:")} <b className="text-slate-900 dark:text-slate-100">{t(lang, "purchase.pmw_super_admin", "Super Admin")}</b></span>
          <span>{t(lang, "common.date", "Date")}: <b className="text-slate-900 dark:text-slate-100">{reportNow?.date || "-"}</b></span>
          <span>{t(lang, "common.time", "Time")}: <b className="text-slate-900 dark:text-slate-100">{reportNow?.time || "-"}</b></span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-2">
          {countryCards.length ? countryCards.map((countryCard) => (
            <div key={countryCard.country} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 p-4 shadow-xs">
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="font-black uppercase tracking-wide text-cyan-600 dark:text-cyan-400">{countryCard.country}</div>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-300 dark:border-cyan-800 px-2.5 py-0.5 text-[10px] font-black text-cyan-700 dark:text-cyan-400">{countryCard.totalOrders} SOs</span>
              </div>
              
              <div className="space-y-4">
                {countryCard.currencies.map(curr => (
                  <div key={curr.currency} className="space-y-2">
                    <div className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">{curr.currency} <span className="font-bold lowercase text-slate-400">({curr.count} SOs)</span></div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                      <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-800"><span className="block text-slate-400 font-bold uppercase text-[9px]">{t(lang, "sales.smw_total_sales", "Total Sales")}</span><b className="text-slate-900 dark:text-slate-100 font-mono">{money(curr.invoice, curr.currency)}</b></div>
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-2.5 border border-emerald-200 dark:border-emerald-900/40"><span className="block text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[9px]">{t(lang, "sales.smw_paid", "Paid")}</span><b className="text-emerald-700 dark:text-emerald-300 font-mono">{money(curr.advance, curr.currency)}</b></div>
                      <div className="col-span-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-2.5 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40"><span className="block text-slate-400 font-bold uppercase text-[9px]">{t(lang, "sales.smw_receivable_balance", "Receivable Balance")}</span><b className="text-xs font-mono font-black">{money(curr.remaining, curr.currency)}</b></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )) : (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center text-sm font-medium text-slate-500">{t(lang, "sales.smw_no_dashboard_records", "No sales records found for this dashboard scope.")}</div>
          )}
        </div>
      </section>

      {/* Mini Stats Summary Cards */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100">{t(lang, "sales.smw_quantity_items_summary", "Quantity / Items Summary")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t(lang, "purchase.pmw_quantity_report_subtitle", "Containers, quantity, weight, and workflow totals.")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 font-bold text-xs rounded-xl" onClick={() => exportCsv(rows, title)}>
            {t(lang, "purchase.pmw_view_full_report", "View Full Report")}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Sales Bookings" value={totals.orders.toLocaleString()} />
          <MiniStat label="Total Quantity" value={totals.quantity.toLocaleString()} />
          <MiniStat label="Total Containers" value={totals.containers.toLocaleString()} />
          <MiniStat label="Total Weight" value={`${totals.weight.toLocaleString()} KG`} />
        </div>
      </section>

      {/* Confirmed Sales Bookings Spreadsheet Table */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-950">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100">{title} — {t(lang, "sales.smw_spreadsheet_register", "Spreadsheet Register")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t(lang, "sales.smw_live_records_subtitle", "Live sales workflow records and transaction details")}</p>
          </div>
          <span className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold font-mono">
            {rows.length} {t(lang, "sales.smw_records_word", "Records")}
          </span>
        </div>

        {error ? <div className="m-4 rounded-xl border border-rose-300 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div> : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-xs sm:text-sm text-left text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 uppercase font-black text-[11px] sm:text-xs border-b border-slate-200 dark:border-slate-800">
              <tr>
                {["Order ID", "Super S/N", "Cty S/N", "Br. S/N", "Contract & Date", "Branch & Country", "Customer Account", "Sales Account", "Goods & Brand", "Weights & Qty", "Total & Exchange", "Paid Details", "Receivable Balance", "Action"].map((head) => (
                  <Th key={head} className="px-4 py-3.5 text-left font-black">{head}</Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr><td colSpan={14} className="px-4 py-12 text-center text-slate-500 font-medium">{t(lang, "sales.smw_loading", "Loading sales records...")}</td></tr>
              ) : rows.length ? rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">{soNumber(row)}</td>
                  <td className="px-4 py-3.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{row.super_admin_serial_number || "-"}</td>
                  <td className="px-4 py-3.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">{row.country_transaction_serial_number || "-"}</td>
                  <td className="px-4 py-3.5 font-mono text-[10px] font-bold text-cyan-600 dark:text-cyan-400">{row.branch_transaction_serial_number || "-"}</td>
                  <td className="px-4 py-3.5"><b>{contractNumber(row)}</b><br /><span className="text-slate-400 text-[11px]">{date(row.created_at)}</span></td>
                  <td className="px-4 py-3.5"><b>{branch(row)}</b><br /><span className="text-slate-400 text-[11px]">{country(row)}</span></td>
                  <td className="px-4 py-3.5"><b>{form(row).purchaseAccountName || customer(row)}</b><br /><span className="text-slate-400 text-[11px]">{form(row).purchaseAccountNo || "-"}</span></td>
                  <td className="px-4 py-3.5"><b>{form(row).salesAccountName || "-"}</b><br /><span className="text-slate-400 text-[11px]">{form(row).salesAccountNo || "-"}</span></td>
                  <td className="px-4 py-3.5"><b>{product(row)}</b><br /><span className="text-slate-400 text-[11px]">{goods(row)[0]?.brand || "-"}</span></td>
                  <td className="px-4 py-3.5">{t(lang, "purchase.pmw_qty_label", "Qty:")} <b>{quantity(row).toLocaleString()}</b><br />{t(lang, "purchase.pmw_net_label", "Net:")} <b>{weight(row).toLocaleString()} KG</b></td>
                  <td className="px-4 py-3.5 font-mono"><b>{money(amount(row), currency(row))}</b><br /><span className="text-slate-400 text-[11px]">Rate: {Number(row.exchange_rate || form(row).exchangeRate || 1)}</span></td>
                  <td className="px-4 py-3.5 font-mono">
                    <b>{money(advance(row), currency(row))}</b><br />
                    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase mt-1", statusClass(status(row)))}>
                      {status(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono font-black text-cyan-600 dark:text-cyan-400">{money(remaining(row), currency(row))}</td>
                  <td className="px-4 py-3.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 rounded-xl"
                      title={t(lang, "sales.smw_view_post_payments_title", "View & Post Payments")}
                      onClick={() => router.push(`/dashboard/sales/sales-order/view?id=${row.id}`)}
                    >
                      <Eye className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={14} className="px-4 py-12 text-center text-slate-500 font-medium">{t(lang, "sales.smw_no_live_records", "No live sales records found for this stage.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 p-3.5 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/30">
          <PackageCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400">{label}</div>
          <div className="text-base font-black text-slate-900 dark:text-slate-100 font-mono">{value}</div>
        </div>
      </div>
    </div>
  );
}
