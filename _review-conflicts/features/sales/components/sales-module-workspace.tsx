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

type SalesModuleType = "sales" | "stock";

type SalesOrderRow = {
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
    <div className="w-full space-y-3 px-2 py-2 sm:px-4 text-slate-100 min-h-screen">
      <section className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 px-2 border-slate-800 bg-slate-900 text-white hover:bg-slate-800" onClick={() => window.history.back()}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-sm font-black text-white sm:text-base">{title}</h1>
                <span className="rounded-full bg-cyan-600/10 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-400 border border-cyan-900/30">Spreadsheet Dashboard</span>
              </div>
              <p className="truncate text-[11px] text-slate-400">{description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SO, Customer..." className="h-8 w-56 rounded-lg border border-slate-800 bg-slate-950 pl-7 pr-2 text-xs outline-none focus:border-cyan-500 text-white placeholder-slate-600" />
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 border-slate-800 bg-slate-900 text-white hover:bg-slate-800" onClick={() => setFiltersOpen((value) => !value)}>
              <Filter className="h-3.5 w-3.5" /> Filter
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 border-slate-800 bg-slate-900 text-white hover:bg-slate-800" onClick={() => { setQuery(""); setCountryFilter(""); setStatusFilter(""); void loadOrders(); }}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Reset & Refresh
            </Button>
            <span className="hidden h-8 items-center gap-1 rounded-lg border border-slate-800 px-2 text-[10px] font-bold text-slate-400 lg:inline-flex"><CalendarDays className="h-3.5 w-3.5" /> {reportNow ? `${reportNow.date}, ${reportNow.time}` : "-"}</span>
            <div className="relative">
              <Button type="button" variant="outline" size="icon" className="h-8 w-8 border-slate-800 bg-slate-900 text-white hover:bg-slate-800" onClick={() => setActionsOpen((value) => !value)} aria-label="Actions"><MoreVertical className="h-4 w-4" /></Button>
              {actionsOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs shadow-xl text-slate-300">
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-900" onClick={() => exportCsv(rows, title)}><FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" /> Export Excel</button>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-900" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 text-cyan-500" /> Print / PDF</button>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-900" onClick={() => exportCsv(rows, title)}><Download className="h-3.5 w-3.5 text-slate-400" /> Download CSV</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {filtersOpen ? (
          <div className="mt-3 grid gap-2 border-t border-slate-800 pt-3 sm:grid-cols-3">
            <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} className="h-8 rounded-lg border border-slate-800 bg-slate-950 px-2 text-xs text-white">
              <option value="">All Countries</option>
              {countries.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-8 rounded-lg border border-slate-800 bg-slate-950 px-2 text-xs text-white">
              <option value="">All Status</option>
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input type="date" className="h-8 rounded-lg border border-slate-800 bg-slate-950 px-2 text-xs text-white" />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/20 p-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-850 pb-2 text-[11px] font-bold uppercase text-slate-500">
          <span>Branch Name: <b className="text-slate-200">{rows[0] ? branch(rows[0]) : "All Branches"}</b></span>
          <span>User Name: <b className="text-slate-200">Super Admin</b></span>
          <span>Date: <b className="text-slate-200">{reportNow?.date || "-"}</b></span>
          <span>Time: <b className="text-slate-200">{reportNow?.time || "-"}</b></span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {countryCards.length ? countryCards.map((countryCard) => (
            <div key={countryCard.country} className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between border-b border-slate-850 pb-2">
                <div className="font-black uppercase tracking-wide text-cyan-400">{countryCard.country}</div>
                <span className="rounded-full bg-cyan-600/10 border border-cyan-800 px-2 py-0.5 text-[10px] font-black text-cyan-400">{countryCard.totalOrders} SOs</span>
              </div>
              
              <div className="space-y-4">
                {countryCard.currencies.map(curr => (
                  <div key={curr.currency} className="space-y-2">
                    <div className="text-[11px] font-black uppercase text-slate-400">{curr.currency} <span className="font-semibold lowercase text-slate-500">({curr.count} SOs)</span></div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800"><span className="block text-slate-500">Total Sales</span><b className="text-slate-200">{money(curr.invoice, curr.currency)}</b></div>
                      <div className="rounded-lg bg-emerald-950/30 p-2 border border-emerald-900/40"><span className="block text-emerald-400">Paid</span><b className="text-emerald-300">{money(curr.advance, curr.currency)}</b></div>
                      <div className="col-span-2 rounded-lg bg-rose-950/30 p-2 text-rose-400 border border-rose-900/40"><span className="block text-slate-500">Receivable Balance</span><b className="text-[11px]">{money(curr.remaining, curr.currency)}</b></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )) : (
            <div className="col-span-full rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">No sales records found for this dashboard scope.</div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/20 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-white">Quantity / Items Report</h2>
            <p className="text-[11px] text-slate-400">Containers, quantity, weight, and workflow totals.</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 border-slate-800 bg-slate-900 text-white hover:bg-slate-800">View Full Report</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <MiniStat label="Sales Bookings" value={totals.orders.toLocaleString()} />
          <MiniStat label="Total Quantity" value={totals.quantity.toLocaleString()} />
          <MiniStat label="Total Containers" value={totals.containers.toLocaleString()} />
          <MiniStat label="Total Weight" value={`${totals.weight.toLocaleString()} KG`} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/20 p-0 shadow-sm overflow-hidden">
        <div className="flex items-center justify-center border-b border-slate-800 px-3 py-3 text-center bg-slate-950/50">
          <div>
            <h2 className="text-sm font-black text-white">Confirmed Sales Bookings</h2>
            <p className="text-[11px] text-slate-400">Spreadsheet report for this sales workflow stage</p>
          </div>
        </div>
        {error ? <div className="m-3 rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-xs font-semibold text-rose-400">{error}</div> : null}
        <div className="overflow-auto">
          <table className="w-full min-w-[1320px] border-collapse text-xs text-slate-350">
            <thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-800">
              <tr>
                {["Order ID", "Super S/N", "Cty S/N", "Br. S/N", "Contract & Date", "Branch & Country", "Customer Account", "Sales Account", "Goods & Brand", "Weights & Qty", "Total & Exchange", "Paid Details", "Receivable Balance", "Action"].map((head) => (
                  <th key={head} className="px-3 py-3 text-left font-black border-slate-800">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {loading ? (
                <tr><td colSpan={14} className="px-3 py-8 text-center text-slate-500">Loading sales records...</td></tr>
              ) : rows.length ? rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-900/30">
                  <td className="px-3 py-3 font-mono font-black text-white">{soNumber(row)}</td>
                  <td className="px-3 py-3 font-mono text-[9px] font-bold text-teal-400">{row.super_admin_serial_number || "-"}</td>
                  <td className="px-3 py-3 font-mono text-[9px] font-bold text-amber-400">{row.country_transaction_serial_number || "-"}</td>
                  <td className="px-3 py-3 font-mono text-[9px] font-bold text-sky-400">{row.branch_transaction_serial_number || "-"}</td>
                  <td className="px-3 py-3"><b>{contractNumber(row)}</b><br /><span className="text-slate-500">{date(row.created_at)}</span></td>
                  <td className="px-3 py-3"><b>{branch(row)}</b><br /><span className="text-slate-500">{country(row)}</span></td>
                  <td className="px-3 py-3"><b>{form(row).purchaseAccountName || customer(row)}</b><br /><span className="text-slate-500">{form(row).purchaseAccountNo || "-"}</span></td>
                  <td className="px-3 py-3"><b>{form(row).salesAccountName || "-"}</b><br /><span className="text-slate-500">{form(row).salesAccountNo || "-"}</span></td>
                  <td className="px-3 py-3"><b>{product(row)}</b><br /><span className="text-slate-500">{goods(row)[0]?.brand || "-"}</span></td>
                  <td className="px-3 py-3">Qty: <b>{quantity(row).toLocaleString()}</b><br />Net: <b>{weight(row).toLocaleString()} KG</b></td>
                  <td className="px-3 py-3"><b>{money(amount(row), currency(row))}</b><br /><span className="text-slate-500">Rate: {Number(row.exchange_rate || form.exchangeRate || 1)}</span></td>
                  <td className="px-3 py-3"><b>{money(advance(row), currency(row))}</b><br /><span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold", statusClass(status(row)))}>{status(row)}</span></td>
                  <td className="px-3 py-3 font-black text-cyan-400">{money(remaining(row), currency(row))}</td>
                  <td className="px-3 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
                      title="View & Post Payments"
                      onClick={() => router.push(`/dashboard/sales/sales-order/view?id=${row.id}`)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={14} className="px-3 py-8 text-center text-slate-500">No live sales records found for this stage.</td></tr>
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
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-600/10 text-cyan-400 border border-cyan-900/30"><PackageCheck className="h-4 w-4" /></div>
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400">{label}</div>
          <div className="text-sm font-black text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}
