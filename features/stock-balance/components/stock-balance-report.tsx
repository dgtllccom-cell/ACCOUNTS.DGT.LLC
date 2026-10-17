"use client";

/**
 * Goods Movement & Stock Report — Purchase Bill Journal · Sales Details · Stock Summary · Payment Report · Treatment Report.
 * A reporting interface over the existing Stock Journal / purchase / sales / lot records (no second inventory engine).
 * All figures come from /api/erp/reports/stock-balance (scope enforced in SQL); this file only presents them. Every label goes through
 * the central dictionary (sbr.*) so the whole screen follows EN / UR / AR / FA / PS with RTL; the numbers never change with the language.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle, BarChart3, Boxes, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Download, Eye, FileSpreadsheet, FileText, Filter, Layers, Loader2,
  MoreVertical, Package, Plus, Printer, RefreshCw, Search, ShoppingCart, Truck, Wallet, X, XCircle, Stethoscope,
} from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { localizeUom } from "@/lib/i18n/uom";
import { printStore } from "@/lib/store/print-store";
import { resolveDocumentBranding } from "@/lib/reports/resolve-document-branding";
import { buildStockBalanceHtml, type ReportInput, type ReportKind } from "@/lib/reports/stock-balance/build-report-html";
import type { BalanceBill, BalanceCards, BalanceSale, BalanceTreatment, Perms } from "@/lib/services/stock-balance-report-service";
import type { BalanceEntry, GoodsSummaryRow } from "@/lib/stock-balance/model";
import type { BillSummary, PaymentRow, StockRow } from "@/lib/stock-balance/views";

type TabKey = "bills" | "sales" | "stock" | "payments" | "treatments";
type Opt = { id: string; name: string; country_id?: string | null; country_branch_id?: string | null; company_id?: string | null };
type Options = { countries: Opt[]; branches: Opt[]; cities: Opt[]; companies: Opt[]; warehouses: Opt[]; perms: Perms };
type Filters = { countryId: string; companyId: string; countryBranchId: string; cityBranchId: string; warehouseId: string; billNo: string; salesBillNo: string; lotNo: string; goodsName: string; dateFrom: string; dateTo: string; status: string; type: string };
type ListData = { view: TabKey; cards: BalanceCards; perms: Perms; rows: any[]; unlinkedSalesCount: number; pagination: { page: number; limit: number; totalRecords: number; totalPages: number } };
type BillData = { bill: BalanceBill; cards: BalanceCards; goodsWise: GoodsSummaryRow[]; perms: Perms };
type LotData = { bill: any; lotNo: string; entries: BalanceEntry[]; sales: BalanceSale[]; treatments: BalanceTreatment[]; transfers: any[]; totals: any; perms: Perms };

const EMPTY: Filters = { countryId: "", companyId: "", countryBranchId: "", cityBranchId: "", warehouseId: "", billNo: "", salesBillNo: "", lotNo: "", goodsName: "", dateFrom: "", dateTo: "", status: "", type: "" };
const LIMIT = 100;
const LANGS: Array<{ code: string; label: string }> = [{ code: "en", label: new Intl.DisplayNames(["en"], { type: "language" }).of("en") ?? "en" }, { code: "ar", label: "العربية" }, { code: "ur", label: "اردو" }, { code: "fa", label: "فارسی" }, { code: "ps", label: "پښتو" }];
const nf = (n: number | null | undefined, d = 2) => (n == null || !Number.isFinite(n) ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(n));
const kg = (n: number | null | undefined) => (n == null || !Number.isFinite(n) || n === 0 ? "—" : nf(n));
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const flag = (iso2?: string) => (iso2 && iso2.length === 2 ? String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "");
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`);

async function api<T = any>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; message?: string }> {
  try {
    const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!r.ok || j?.ok === false) return { ok: false, status: r.status, message: j?.error?.message || `Request failed (${r.status})` };
    return { ok: true, status: r.status, data: (j?.data ?? j) as T };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
}

export function StockBalanceReport({ session, initialTab = "bills" }: { session?: { fullName?: string | null; email?: string | null } | null; initialTab?: TabKey }) {
  const s = useErpScreen("sbr");
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [f, setF] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [opts, setOpts] = useState<Options | null>(null);
  const [list, setList] = useState<ListData | null>(null);
  const [bill, setBill] = useState<BillData | null>(null);
  const [billRef, setBillRef] = useState<{ type: string; id: string } | null>(() => { const b = sp?.get("bill"); if (!b) return null; const [type, id] = b.split(":"); return type && id ? { type, id } : null; });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lotRef, setLotRef] = useState<{ type: string; billId: string; lotNo: string } | null>(null);
  const [treatTarget, setTreatTarget] = useState<{ billType: string; billId: string; billNo: string; lotNo: string; entry: BalanceEntry } | null>(null);
  const [editTreat, setEditTreat] = useState<BalanceTreatment | null>(null);
  const [cancelTreat, setCancelTreat] = useState<BalanceTreatment | null>(null);
  const [busyPrint, setBusyPrint] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // rows are only valid for the tab they were fetched for — a stale list from the previous tab must never render with another tab's columns
  const U = (u: string) => localizeUom(s.lang, u);
  const rowsOf = (view: TabKey): any[] => (list && list.view === view ? list.rows : []);
  const perms = list?.perms ?? bill?.perms ?? opts?.perms ?? { view: true, add: false, edit: false, delete: false, print: true, export: false, money: false };
  const money = perms.money;

  const qs = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(applied)) if (v) p.set(k, v);
    p.set("lang", s.lang);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  }, [applied, s.lang]);

  // master-filter options follow the logged-in user's scope
  useEffect(() => { void api<Options>("/api/erp/reports/stock-balance/filters").then((r) => { if (r.ok) setOpts(r.data!); }); }, []);

  const load = useCallback(async (pg = 1) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    if (billRef) {
      const r = await api<BillData>(`/api/erp/reports/stock-balance/bill?type=${billRef.type}&id=${billRef.id}&lang=${s.lang}`, { signal: ac.signal });
      if (ac.signal.aborted) return;
      if (!r.ok) setError(r.message || s.t("load_failed", "The report could not be loaded."));
      else setBill(r.data!);
      setLoading(false);
      return;
    }
    const r = await api<ListData>(`/api/erp/reports/stock-balance?${qs({ view: tab, page: String(pg), limit: String(LIMIT) })}`, { signal: ac.signal });
    if (ac.signal.aborted) return;
    if (!r.ok) setError(r.message || s.t("load_failed", "The report could not be loaded."));
    else { setList(r.data!); setPage(pg); }
    setLoading(false);
  }, [billRef, qs, tab, s]);
  useEffect(() => { void load(1); }, [load]);

  const flash = (m: string) => { setBanner(m); window.setTimeout(() => setBanner(null), 6000); };
  const openBill = (type: string, id: string) => { setBill(null); setLoading(true); setBillRef({ type, id }); router.replace(`?bill=${type}:${id}`, { scroll: false }); };
  const closeBill = () => { setBillRef(null); setBill(null); router.replace("?", { scroll: false }); };
  const goTab = (t: TabKey) => { if (billRef) closeBill(); setLoading(true); setTab(t); setPage(1); };
  const apply = () => { setLoading(true); setApplied({ ...f }); setPage(1); setFiltersOpen(false); };
  const reset = () => { setLoading(true); setF(EMPTY); setApplied(EMPTY); setPage(1); };

  const switchLang = (code: string) => {
    localStorage.setItem("erp_lang", code);
    document.cookie = `erp_lang=${encodeURIComponent(code)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.documentElement.lang = code;
    document.documentElement.dir = ["ur", "ar", "fa", "ps"].includes(code) ? "rtl" : "ltr";
    window.dispatchEvent(new StorageEvent("storage", { key: "erp_lang", newValue: code }));
    window.dispatchEvent(new Event("erp_language_changed"));
    router.refresh();
  };

  // ── printing / PDF / Excel ──
  const scopeLabel = () => {
    const c = opts?.countries.find((x) => x.id === applied.countryId)?.name;
    const co = opts?.companies.find((x) => x.id === applied.companyId)?.name;
    const br = opts?.branches.find((x) => x.id === applied.countryBranchId)?.name;
    const ci = opts?.cities.find((x) => x.id === applied.cityBranchId)?.name;
    return [c, co, br, ci].filter(Boolean).join(" · ") || s.t("all_authorized", "All authorized data");
  };
  const filterLines = () => {
    const l: Array<{ label: string; value: string }> = [];
    if (applied.dateFrom || applied.dateTo) l.push({ label: s.t("f_date", "Date Range"), value: `${applied.dateFrom || "…"} → ${applied.dateTo || "…"}` });
    for (const [k, label] of [["billNo", s.t("f_bill", "Purchase Bill Number")], ["salesBillNo", s.t("f_sales_bill", "Sales Bill Number")], ["lotNo", s.t("f_lot", "Lot Number")], ["goodsName", s.t("f_goods", "Goods Name")], ["status", s.t("f_status", "Stock Status")]] as const) if (applied[k]) l.push({ label, value: applied[k] });
    return l;
  };
  const openReport = async (kind: ReportKind, data: Partial<ReportInput>, titleText: string) => {
    setBusyPrint(true);
    try {
      // one bill/lot → that bill's branding; a multi-bill report only borrows a country when every row belongs to the same one
      const pool = (data.bill ? [data.bill] : data.bills ?? []) as any[];
      const anyBill = pool.length > 0 && pool.every((x) => x.countryId === pool[0].countryId && x.cityBranchId === pool[0].cityBranchId && x.countryBranchId === pool[0].countryBranchId) ? pool[0] : null;
      const branding = await resolveDocumentBranding({ countryId: anyBill?.countryId ?? (applied.countryId || null), countryBranchId: anyBill?.countryBranchId ?? (applied.countryBranchId || null), cityBranchId: anyBill?.cityBranchId ?? (applied.cityBranchId || null) }, s.lang as never).catch(() => null);
      const make = (lang: string) => buildStockBalanceHtml({ kind, lang, branding, generatedBy: session?.fullName || session?.email || "ERP System", scopeLabel: scopeLabel(), money, filters: filterLines(), ...data } as ReportInput);
      printStore.openPrint(make(s.lang), titleText, { lang: s.lang, rebuild: ({ lang }: { lang?: string }) => make(lang || s.lang) } as never);
    } finally { setBusyPrint(false); }
  };
  const fetchAll = async (view: TabKey) => { const r = await api<ListData>(`/api/erp/reports/stock-balance?${qs({ view, page: "1", limit: "2000" })}`); if (!r.ok) throw new Error(r.message); return r.data!; };
  const printCurrent = async (kindOverride?: string) => {
    try {
      const kind = kindOverride || (billRef ? "bill" : tab === "bills" ? "journal" : tab === "sales" ? "sales" : tab === "stock" ? "stock" : tab === "payments" ? "payments" : "treatments");
      if (kind === "bill" && bill) return await openReport("bill", { bill: bill.bill, goodsWise: bill.goodsWise, cards: bill.cards }, `${s.t("rt_bill", "PURCHASE BILL JOURNAL")} ${bill.bill.billNo}`);
      if (kind === "journal") { const [b, st] = await Promise.all([fetchAll("bills"), fetchAll("stock")]); return await openReport("journal", { cards: b.cards, bills: b.rows as BillSummary[], stock: st.rows as StockRow[] }, s.t("rt_journal", "STOCK JOURNAL — PURCHASE, SALES & REMAINING BALANCE")); }
      if (kind === "sales") { const d = await fetchAll("sales"); return await openReport("sales", { cards: d.cards, sales: d.rows as BalanceSale[] }, s.t("rt_sales", "SALES DETAILS REPORT")); }
      if (kind === "stock") { const d = await fetchAll("stock"); return await openReport("stock", { cards: d.cards, stock: d.rows as StockRow[] }, s.t("rt_stock", "STOCK BALANCE REPORT")); }
      if (kind === "payments") { const d = await fetchAll("payments"); return await openReport("payments", { cards: d.cards, payments: d.rows as PaymentRow[] }, s.t("rt_payments", "PURCHASE PAYMENT REPORT")); }
      const d = await fetchAll("treatments");
      return await openReport("treatments", { cards: d.cards, treatments: d.rows as BalanceTreatment[] }, s.t("rt_treatments", "STOCK TREATMENT REPORT"));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const printLot = async (l: LotData) => openReport("lot", { lot: l as never }, `${s.t("rt_lot", "LOT BALANCE REPORT")} ${l.lotNo}`);
  const printSalesBill = async (no: string) => {
    const d = await fetchAll("sales");
    const rows = (d.rows as BalanceSale[]).filter((x) => x.salesBillNo === no);
    return openReport("salesBill", { sales: rows, salesBillNo: no }, `${s.t("rt_sales_bill", "SALES BILL REPORT")} ${no}`);
  };
  const exportExcel = (kind: string) => {
    const p = new URLSearchParams(qs({ kind }));
    if (billRef && (kind === "bill")) { p.set("type", billRef.type); p.set("id", billRef.id); }
    window.location.href = `/api/erp/reports/stock-balance/export?${p.toString()}`;
  };

  // ── pieces ──
  const cards = (billRef ? bill?.cards : list?.cards) ?? null;
  const payTop = cards?.payment;
  const topTxt = (x?: { unit: string; qty: number; more: number }) => (x ? `${nf(x.qty)} ${U(x.unit)}${x.more ? ` +${x.more}` : ""}` : "0");
  const colHead = "px-2.5 py-2 text-start text-[12px] font-extrabold text-slate-700 dark:text-slate-200 whitespace-nowrap bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700";
  const cell = "px-2.5 py-2 text-[13px] border border-slate-100 dark:border-slate-700 align-top";
  const num = `${cell} text-end tabular-nums whitespace-nowrap`;
  const lotLabel = (e: { lotNo: string; entryNo: number }) => `${e.lotNo === "—" ? s.t("not_loaded_lot", "Not loaded") : e.lotNo} / ${s.t("entry", "Entry")} ${e.entryNo}`;
  const statusPill = (st: string) => {
    const m: Record<string, [string, string]> = { available: [s.t("st_available", "Available"), "bg-emerald-100 text-emerald-900"], in_transit: [s.t("st_in_transit", "In transit"), "bg-amber-100 text-amber-900"], not_loaded: [s.t("st_not_loaded", "Not loaded"), "bg-blue-100 text-blue-900"], sold_out: [s.t("st_sold_out", "Sold out"), "bg-slate-200 text-slate-800"], over_sold: [s.t("st_over_sold", "Over-sold"), "bg-red-100 text-red-900"] };
    const [label, cls] = m[st] ?? [st, "bg-slate-100"];
    return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>;
  };
  const saleStatus = (st: string) => ({ completed: s.t("sale_completed", "Completed"), issued: s.t("sale_issued", "Issued"), reserved: s.t("sale_reserved", "Reserved"), cancelled: s.t("sale_cancelled", "Cancelled") } as Record<string, string>)[st] || st;
  const trStatus = (st: string) => ({ pending: s.t("tr_pending", "Pending"), in_progress: s.t("tr_in_progress", "In progress"), completed: s.t("tr_completed", "Completed"), cancelled: s.t("tr_cancelled", "Cancelled") } as Record<string, string>)[st] || st;
  const payStatus = (st: string) => ({ paid: s.t("pay_paid", "Paid"), completed: s.t("pay_paid", "Paid"), partial: s.t("pay_partial", "Part paid"), partially_paid: s.t("pay_partial", "Part paid"), unpaid: s.t("pay_unpaid", "Unpaid"), pending: s.t("pay_unpaid", "Unpaid"), posted: s.t("pay_posted", "Posted"), cancelled: s.t("sale_cancelled", "Cancelled"), none: s.t("pay_none", "No payment yet") } as Record<string, string>)[st] || st;
  const typeLabel = (t: string) => (t === "booking" ? s.t("type_booking", "Booking") : s.t("type_local", "Local"));

  const Card = ({ id, tone, icon: Icon, title, big, a, b, onClick }: { id: string; tone: string; icon: React.ComponentType<any>; title: string; big: string; a: [string, string]; b: [string, string]; onClick: () => void }) => (
    <button type="button" id={id} onClick={onClick} className={`flex min-w-0 flex-col overflow-hidden rounded-xl border-2 bg-white text-center shadow-xs transition hover:shadow-md dark:bg-slate-900 ${tone}`}>
      <span className="flex items-center justify-center gap-2 px-3 pt-2.5"><Icon className="h-5 w-5 shrink-0" /><span className="truncate text-[12px] font-black uppercase tracking-wide">{title}</span></span>
      <span className="px-3 py-1 text-[22px] font-black tabular-nums" dir="ltr">{big}</span>
      <span className="grid grid-cols-2 border-t border-current/20 bg-black/[0.03] text-[12px]">
        <span className="flex flex-col py-1.5"><b className="tabular-nums" dir="ltr">{a[0]}</b><span className="opacity-80">{a[1]}</span></span>
        <span className="flex flex-col border-s border-current/20 py-1.5"><b className="tabular-nums" dir="ltr">{b[0]}</b><span className="opacity-80">{b[1]}</span></span>
      </span>
    </button>
  );

  const CardsRow = () => !cards ? null : (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" data-testid="sbr-cards">
      <Card id="sbr-card-purchase" tone="border-blue-600 text-blue-700" icon={ShoppingCart} title={s.t("card_purchase", "TOTAL PURCHASE")} big={topTxt(cards.purchase.top)} a={[`${nf(cards.purchase.gross)} ${U("KG")}`, s.t("gross", "Gross Weight")]} b={[`${nf(cards.purchase.net)} ${U("KG")}`, s.t("net", "Net Weight")]} onClick={() => goTab("bills")} />
      <Card id="sbr-card-sales" tone="border-green-600 text-green-700" icon={Truck} title={s.t("card_sales", "TOTAL SALES")} big={topTxt(cards.sales.top)} a={[`${nf(cards.sales.gross)} ${U("KG")}`, s.t("gross", "Gross Weight")]} b={[`${nf(cards.sales.net)} ${U("KG")}`, s.t("net", "Net Weight")]} onClick={() => goTab("sales")} />
      <Card id="sbr-card-remaining" tone="border-orange-600 text-orange-700" icon={Package} title={s.t("card_remaining", "REMAINING STOCK")} big={topTxt(cards.remaining.top)} a={[`${nf(cards.remaining.gross)} ${U("KG")}`, s.t("gross", "Gross Weight")]} b={[`${nf(cards.remaining.net)} ${U("KG")}`, s.t("net", "Net Weight")]} onClick={() => goTab("stock")} />
      <Card id="sbr-card-payment" tone="border-purple-600 text-purple-700" icon={Wallet} title={s.t("card_payment", "TOTAL PAYMENT")} big={money && payTop?.total != null ? `${payTop.currency} ${nf(payTop.total)}${payTop.more ? ` +${payTop.more}` : ""}` : s.t("not_shown", "Not Shown")} a={[money && payTop?.paid != null ? nf(payTop.paid) : "—", s.t("paid", "Paid")]} b={[money && payTop?.pending != null ? nf(payTop.pending) : "—", s.t("pending", "Pending")]} onClick={() => goTab("payments")} />
      <Card id="sbr-card-treatment" tone="border-teal-600 text-teal-700" icon={Stethoscope} title={s.t("card_treatment", "STOCK TREATMENT")} big={`${nf(cards.treatment.received)} ${cards.purchase.top.unit}`} a={[nf(cards.treatment.treated), s.t("treated", "Treated")]} b={[nf(cards.treatment.pending), s.t("pending", "Pending")]} onClick={() => goTab("treatments")} />
      <Card id="sbr-card-lots" tone="border-slate-600 text-slate-700" icon={Layers} title={s.t("card_lots", "TOTAL LOTS")} big={`${cards.lots.lots} / ${cards.lots.entries}`} a={[String(cards.lots.bills), s.t("bills", "Purchase Bills")]} b={[String(cards.lots.entries), s.t("entries", "Goods Entries")]} onClick={() => goTab("stock")} />
    </div>
  );

  const Pager = () => list && list.pagination.totalPages > 1 ? (
    <div className="mt-2 flex items-center justify-between rounded-xl border bg-white px-4 py-2.5 text-[13px] font-semibold dark:bg-slate-900">
      <span>{s.t("page", "Page")} {list.pagination.page} / {list.pagination.totalPages} · {list.pagination.totalRecords}</span>
      <span className="flex gap-1.5">
        <button type="button" disabled={page <= 1} onClick={() => void load(page - 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-30" aria-label={s.t("prev", "Previous")}>{s.isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
        <button type="button" disabled={page >= list.pagination.totalPages} onClick={() => void load(page + 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-30" aria-label={s.t("next", "Next")}>{s.isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
      </span>
    </div>
  ) : null;

  const Empty = ({ cols }: { cols: number }) => <tr><td colSpan={cols} className="p-8 text-center text-[13px] text-slate-500">{loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : s.t("empty", "No records match these filters.")}</td></tr>;
  const LotLink = ({ type, billId, lotNo, label }: { type: string; billId: string; lotNo: string; label?: string }) => (
    <button type="button" data-testid="sbr-lot-link" onClick={() => setLotRef({ type, billId, lotNo })} className="font-bold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">{label ?? (lotNo === "—" ? s.t("not_loaded_lot", "Not loaded") : lotNo)}</button>
  );
  const BillLink = ({ type, id, no }: { type: string; id: string; no: string }) => (
    <button type="button" data-testid="sbr-bill-link" onClick={() => openBill(type, id)} className="font-black text-blue-700 underline-offset-2 hover:underline dark:text-blue-300" dir="ltr">{no}</button>
  );

  // ── list views ──
  const BillsTable = () => {
    const rows = (rowsOf(tab) ?? []) as BillSummary[];
    return (
      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
        <table className="w-full min-w-[1100px] border-collapse" data-testid="sbr-bills-table">
          <thead><tr>{[s.t("col_sno", "S.No"), s.t("col_purchase_bill", "Purchase Bill"), s.t("col_date", "Date"), s.t("col_type", "Type"), s.t("col_account", "Purchase Account"), s.t("col_country", "Country"), s.t("col_branch", "Branch"), s.t("col_origin", "Origin Country"), s.t("col_lots", "Lots"), s.t("col_entries", "Entries"), s.t("grp_purchased", "Purchased"), s.t("grp_sold", "Sold"), s.t("grp_remaining", "Remaining"), s.t("col_payment", "Payment"), ""].map((h, i) => <th key={i} className={colHead}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <Empty cols={15} />}
            {rows.map((r, i) => (
              <tr key={r.id} data-testid="sbr-bill-row" className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td className={num}>{(page - 1) * LIMIT + i + 1}</td>
                <td className={cell}><BillLink type={r.type} id={r.id} no={r.billNo} />{r.manualBillNo && <div className="text-[11px] text-slate-500" dir="ltr">{r.manualBillNo}</div>}</td>
                <td className={cell} dir="ltr">{dt(r.date)}</td>
                <td className={cell}><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.type === "booking" ? "bg-blue-100 text-blue-900" : "bg-emerald-100 text-emerald-900"}`}>{typeLabel(r.type)}</span></td>
                <td className={cell}>{r.purchaseAccountName || "—"}</td>
                <td className={cell}>{r.countryName}</td>
                <td className={cell}>{r.branchName}</td>
                <td className={cell}>{r.originCountry || "—"}</td>
                <td className={num}>{r.totals.lots}</td>
                <td className={num}>{r.totals.entries}</td>
                <td className={num}>{nf(r.totals.purchased.qty)}</td>
                <td className={num}>{nf(r.totals.sold.qty)}</td>
                <td className={`${num} font-black`}>{nf(r.totals.remaining.qty)}</td>
                <td className={cell}>{money ? <span className="whitespace-nowrap">{r.paid != null ? nf(r.paid) : "—"} / {r.amount != null ? nf(r.amount) : "—"} {r.currency}</span> : s.t("not_shown", "Not Shown")}</td>
                <td className={cell}><button type="button" data-testid="sbr-view-journal" onClick={() => openBill(r.type, r.id)} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[12px] font-bold text-white hover:bg-blue-700"><Eye className="h-3.5 w-3.5" />{s.t("view_journal", "View Full Journal")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const SalesTable = ({ rows, withBill = true }: { rows: BalanceSale[]; withBill?: boolean }) => {
    const counted = rows.filter((x) => x.status === "completed" || x.status === "issued");
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse" data-testid="sbr-sales-table">
          <thead><tr>{[s.t("col_sno", "S.No"), s.t("col_sales_bill", "Sales Bill No"), s.t("col_sales_date", "Sales Date"), s.t("col_sales_type", "Sales Type"), s.t("col_seller", "Seller Sales Account"), s.t("col_buyer", "Buyer / Customer Account"), s.t("col_truck", "Truck Bill No"), ...(withBill ? [s.t("col_purchase_bill", "Purchase Bill")] : []), s.t("col_lot_entry", "Lot & Entry No"), s.t("col_sold_qty", "Sold Quantity"), s.t("col_gross", "Gross Weight (KG)"), s.t("col_net", "Net Weight (KG)"), ...(money ? [s.t("col_amount", "Amount")] : []), s.t("col_status", "Status"), ""].map((h, i) => <th key={i} className={colHead}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <Empty cols={14} />}
            {rows.map((r, i) => (
              <tr key={r.id} data-testid="sbr-sale-row" className={r.status === "cancelled" ? "opacity-50 line-through" : ""}>
                <td className={num}>{i + 1}</td>
                <td className={`${cell} font-bold`} dir="ltr">{r.salesBillNo}</td>
                <td className={cell} dir="ltr">{dt(r.date)}</td>
                <td className={cell}>{r.saleType}</td>
                <td className={cell}>{r.sellerAccount || "—"}</td>
                <td className={cell}>{r.buyerAccount || "—"}</td>
                <td className={cell}>{r.truckBillNo || "—"}</td>
                {withBill && <td className={cell}>{r.billId && r.billType ? <BillLink type={r.billType} id={r.billId} no={r.billNo ?? ""} /> : <span className="text-amber-700">{s.t("not_linked", "Not linked to a lot")}</span>}</td>}
                <td className={cell}>{r.linked && r.billId && r.billType && r.lotNo !== "—" ? <LotLink type={r.billType} billId={r.billId} lotNo={r.lotNo} label={r.lotEntryLabel} /> : r.linked ? "—" : <span className="text-amber-700">{s.t("not_linked", "Not linked to a lot")}</span>}</td>
                <td className={num}>{nf(r.qty)} {U(r.unit)}</td>
                <td className={num}>{kg(r.gross)}</td>
                <td className={num}>{kg(r.net)}</td>
                {money && <td className={num}>{r.amount != null ? `${nf(r.amount)} ${r.currency}` : "—"}</td>}
                <td className={cell}>{saleStatus(r.status)}</td>
                <td className={cell}><button type="button" onClick={() => void printSalesBill(r.salesBillNo)} title={s.t("print_sales_bill", "Print this sales bill report")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-slate-50"><Printer className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
            {rows.length > 0 && <tr className="bg-green-700 text-white"><td colSpan={withBill ? 9 : 8} className="px-2.5 py-2 text-[13px] font-extrabold">{s.t("total_sales", "TOTAL SALES")} ({counted.length})</td><td className={`${num} font-extrabold text-white`}>{nf(counted.reduce((a, x) => a + x.qty, 0))}</td><td className={`${num} font-extrabold text-white`}>{nf(counted.reduce((a, x) => a + x.gross, 0))}</td><td className={`${num} font-extrabold text-white`}>{nf(counted.reduce((a, x) => a + x.net, 0))}</td>{money && <td />}<td /><td /></tr>}
          </tbody>
        </table>
      </div>
    );
  };

  const BalanceTable = ({ rows, withBill }: { rows: Array<BalanceEntry & Partial<StockRow>>; withBill: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1150px] border-collapse" data-testid="sbr-balance-table">
        <thead>
          <tr>
            <th rowSpan={2} className={colHead}>{s.t("col_sno", "S.No")}</th>
            {withBill && <th rowSpan={2} className={colHead}>{s.t("col_purchase_bill", "Purchase Bill")}</th>}
            <th rowSpan={2} className={colHead}>{s.t("col_lot_entry", "Lot & Entry No")}</th><th rowSpan={2} className={colHead}>{s.t("col_goods", "Goods Name")}</th><th rowSpan={2} className={colHead}>{s.t("col_brand", "Brand")}</th><th rowSpan={2} className={colHead}>{s.t("col_size", "Size")}</th>
            <th colSpan={3} className={`${colHead} text-center`}>{s.t("grp_purchased", "Purchased")}</th><th colSpan={3} className={`${colHead} text-center`}>{s.t("grp_sold", "Sold")}</th><th rowSpan={2} className={colHead}>{s.t("col_adjusted", "Adjusted / Transferred")}</th><th colSpan={3} className={`${colHead} text-center`}>{s.t("grp_remaining", "Remaining")}</th><th rowSpan={2} className={colHead}>{s.t("col_status", "Status")}</th><th rowSpan={2} className={colHead} />
          </tr>
          <tr>{[0, 1, 2].flatMap(() => [s.t("col_qty_short", "Qty"), s.t("col_gross_short", "Gross"), s.t("col_net_short", "Net")]).map((h, i) => <th key={i} className={colHead}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <Empty cols={17} />}
          {rows.map((e, i) => (
            <tr key={e.entryId} data-testid="sbr-balance-row" data-status={e.status}>
              <td className={num}>{i + 1}</td>
              {withBill && <td className={cell}>{e.billId && e.billType ? <BillLink type={e.billType} id={e.billId} no={e.billNo ?? ""} /> : "—"}</td>}
              <td className={cell}>{e.billId && e.billType ? <LotLink type={e.billType} billId={e.billId} lotNo={e.lotNo} label={lotLabel(e)} /> : lotLabel(e)}</td>
              <td className={`${cell} font-bold`}>{e.goodsName}</td><td className={cell}>{e.brand || "—"}</td><td className={cell}>{e.size || "—"}</td>
              <td className={num}>{nf(e.purchased.qty)}</td><td className={num}>{kg(e.purchased.gross)}</td><td className={num}>{kg(e.purchased.net)}</td>
              <td className={num}>{nf(e.sold.qty)}</td><td className={num}>{kg(e.sold.gross)}</td><td className={num}>{kg(e.sold.net)}</td>
              <td className={num}>{nf(e.adjusted.qty + e.transferred.qty)}</td>
              <td className={`${num} font-black text-orange-700`}>{nf(e.remaining.qty)}</td><td className={num}>{kg(e.remaining.gross)}</td><td className={num}>{kg(e.remaining.net)}</td>
              <td className={cell}>{statusPill(e.status)}{e.reservedQty > 0 && <div className="mt-1 text-[11px] text-violet-700">{s.t("reserved", "Reserved")}: {nf(e.reservedQty)}</div>}</td>
              <td className={cell}>{perms.add && e.remaining.qty > 0 && e.billId && e.billType && e.lotNo !== "—" && <button type="button" data-testid="sbr-add-treatment" onClick={() => setTreatTarget({ billType: e.billType!, billId: e.billId!, billNo: e.billNo ?? "", lotNo: e.lotNo, entry: e })} title={s.t("add_treatment", "Record treatment")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50"><Plus className="h-3.5 w-3.5" /></button>}</td>
            </tr>
          ))}
          {rows.length > 0 && (() => { const S = (fn: (x: BalanceEntry) => number) => rows.reduce((a, x) => a + fn(x), 0); return <tr className="bg-orange-600 text-white"><td colSpan={withBill ? 6 : 5} className="px-2.5 py-2 text-[13px] font-extrabold">{s.t("grand_total", "GRAND TOTAL")} ({rows.length})</td>{[S((x) => x.purchased.qty), S((x) => x.purchased.gross), S((x) => x.purchased.net), S((x) => x.sold.qty), S((x) => x.sold.gross), S((x) => x.sold.net), S((x) => x.adjusted.qty + x.transferred.qty), S((x) => x.remaining.qty), S((x) => x.remaining.gross), S((x) => x.remaining.net)].map((v, i) => <td key={i} className={`${num} font-extrabold text-white`}>{nf(v)}</td>)}<td /><td /></tr>; })()}
        </tbody>
      </table>
    </div>
  );

  const TreatmentTable = ({ rows, withBill }: { rows: BalanceTreatment[]; withBill: boolean }) => (
    <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
      <table className="w-full min-w-[1100px] border-collapse" data-testid="sbr-treatment-table">
        <thead><tr>{[s.t("col_goods", "Goods Name"), s.t("col_lot", "Lot Number"), ...(withBill ? [s.t("col_purchase_bill", "Purchase Bill")] : []), s.t("col_treatment_type", "Treatment Type"), s.t("col_treatment_date", "Treatment Date"), s.t("col_tr_received", "Qty Received for Treatment"), s.t("col_tr_treated", "Qty Treated"), s.t("col_tr_pending", "Qty Pending"), s.t("col_tr_loss", "Treatment Loss / Adjustment"), s.t("col_tr_final", "Final Quantity"), s.t("col_wh_branch", "Warehouse / Branch"), s.t("col_tr_status", "Treatment Status"), ""].map((h, i) => <th key={i} className={colHead}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <Empty cols={13} />}
          {rows.map((r) => (
            <tr key={r.id} data-testid="sbr-treatment-row" className={r.status === "cancelled" ? "opacity-50 line-through" : ""}>
              <td className={`${cell} font-bold`}>{r.goodsName}</td><td className={cell}><LotLink type={r.billType} billId={r.billId} lotNo={r.lotNo} /></td>
              {withBill && <td className={cell}><BillLink type={r.billType} id={r.billId} no={r.billNo} /></td>}
              <td className={cell}>{r.treatmentType}</td><td className={cell} dir="ltr">{dt(r.treatmentDate)}</td>
              <td className={num}>{nf(r.received)} {U(r.unit)}</td><td className={num}>{nf(r.treated)}</td><td className={num}>{nf(r.pending)}</td><td className={num}>{nf(r.loss)}</td><td className={num}>{nf(r.finalQty)}</td>
              <td className={cell}>{[r.warehouseName, r.branchName].filter(Boolean).join(" · ") || "—"}</td><td className={cell}>{trStatus(r.status)}</td>
              <td className={cell}><div className="flex gap-1">{perms.edit && r.status !== "cancelled" && <button type="button" data-testid="sbr-edit-treatment" onClick={() => setEditTreat(r)} className="rounded-lg border px-2 py-1 text-[12px] font-bold hover:bg-slate-50">{s.t("update", "Update")}</button>}{perms.delete && r.status !== "cancelled" && <button type="button" data-testid="sbr-cancel-treatment" onClick={() => setCancelTreat(r)} className="rounded-lg border border-red-300 px-2 py-1 text-[12px] font-bold text-red-700 hover:bg-red-50">{s.t("cancel_treatment", "Cancel")}</button>}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const PaymentsTable = () => {
    const rows = (rowsOf(tab) ?? []) as PaymentRow[];
    return (
      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
        <table className="w-full min-w-[1100px] border-collapse" data-testid="sbr-payments-table">
          <thead><tr>{[s.t("col_purchase_bill_no", "Purchase Bill Number"), s.t("col_supplier", "Supplier Account"), s.t("col_purchase_amount", "Purchase Amount"), s.t("col_currency", "Currency"), s.t("col_exchange", "Exchange Rate"), s.t("col_paid", "Paid Amount"), s.t("col_remaining_payable", "Remaining Payable"), s.t("col_pay_date", "Payment Date"), s.t("col_pay_method", "Payment Method"), s.t("col_pay_amount", "Payment"), s.t("col_pay_status", "Payment Status")].map((h, i) => <th key={i} className={colHead}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <Empty cols={11} />}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cell}><BillLink type={r.billType} id={r.billId} no={r.billNo} /></td><td className={cell}>{r.supplierAccount || "—"}</td>
                <td className={num}>{money && r.purchaseAmount != null ? nf(r.purchaseAmount) : money ? "—" : s.t("not_shown", "Not Shown")}</td><td className={cell}>{r.billCurrency}</td><td className={num}>{r.billExchangeRate != null ? nf(r.billExchangeRate, 4) : "—"}</td>
                <td className={num}>{money && r.paidTotal != null ? nf(r.paidTotal) : "—"}</td><td className={num}>{money && r.remainingPayable != null ? nf(r.remainingPayable) : "—"}</td>
                <td className={cell} dir="ltr">{dt(r.date)}</td><td className={cell}>{[r.kind, r.method].filter(Boolean).join(" · ") || "—"}</td><td className={num}>{money && r.status !== "none" ? nf(r.amount) : "—"}</td>
                <td className={cell}>{payStatus(r.status === "none" ? r.billPaymentStatus || "none" : r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── one bill: the journal of the approved design ──
  const BillView = () => {
    if (!bill) return null;
    const b = bill.bill, c = bill.cards;
    const maxBar = Math.max(1, c.purchase.qty, c.sales.qty, c.remaining.qty);
    const bar = (v: number, cls: string, label: string) => (
      <div className="flex flex-1 flex-col items-center justify-end gap-1"><span className="text-[13px] font-black tabular-nums" dir="ltr">{nf(v)}</span><div className={`w-full max-w-[56px] rounded-t ${cls}`} style={{ height: `${Math.max(4, (v / maxBar) * 120)}px` }} /><span className="text-[11px] font-bold text-slate-600">{label}</span></div>
    );
    const kv = (rows: Array<[string, React.ReactNode]>) => <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">{rows.map(([k, v]) => <React.Fragment key={k}><dt className="text-slate-500">{k}</dt><dd className="font-bold text-slate-900 dark:text-slate-100">{v || "—"}</dd></React.Fragment>)}</dl>;
    const panel = (title: string, icon: React.ReactNode, body: React.ReactNode) => <div className="overflow-hidden rounded-xl border border-blue-200 bg-white dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-3 py-2 text-[12px] font-black uppercase tracking-wide text-blue-900 dark:bg-slate-800 dark:text-blue-200">{icon}{title}</div><div className="p-3">{body}</div></div>;
    const sec = (cls: string, title: string, body: React.ReactNode, extra?: React.ReactNode) => <section className="overflow-hidden rounded-xl border bg-white dark:bg-slate-900"><div className={`flex items-center justify-between gap-2 px-3 py-2 text-[14px] font-black text-white ${cls}`}><span>{title}</span>{extra}</div>{body}</section>;
    return (
      <div className="space-y-4" data-testid="sbr-bill-view">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={closeBill} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border bg-white px-3 text-[13px] font-bold hover:bg-slate-50 dark:bg-slate-900">{s.isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}{s.t("back_to_list", "Back to all bills")}</button>
          <h2 className="text-[17px] font-black" dir="ltr">{b.billNo}</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${b.type === "booking" ? "bg-blue-100 text-blue-900" : "bg-emerald-100 text-emerald-900"}`}>{typeLabel(b.type)}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {panel(s.t("p_bill_info", "PURCHASE BILL INFORMATION"), <FileText className="h-4 w-4" />, kv([[s.t("bill_no", "Purchase Bill No"), <span dir="ltr">{b.billNo}{b.manualBillNo ? ` / ${b.manualBillNo}` : ""}</span>], [s.t("bill_date", "Purchase Date"), <span dir="ltr">{dt(b.date)}</span>], [s.t("bill_type", "Purchase Type"), typeLabel(b.type)], [s.t("bill_account", "Purchase Account"), b.purchaseAccountName], [s.t("bill_account_details", "Account Details"), b.purchaseAccountDetails], [s.t("company", "Company"), b.companyName], [s.t("col_country", "Country"), b.countryName], [s.t("col_city", "City"), b.cityName], [s.t("col_branch", "Branch"), b.branchName]]))}
          {panel(s.t("p_origin", "ORIGIN & SUMMARY"), <Boxes className="h-4 w-4" />, kv([[s.t("col_origin", "Origin Country"), b.originCountry ? `${b.originCountry}` : ""], [s.t("t_lots", "Total Lots"), String(b.totals.lots)], [s.t("t_entries", "Total Goods Entries"), String(b.totals.entries)], [s.t("t_purchase_qty", "Total Purchase Quantity"), `${nf(b.totals.purchased.qty)} ${c.purchase.top.unit}`], [s.t("t_gross", "Total Gross Weight"), `${nf(b.totals.purchased.gross)} ${U("KG")}`], [s.t("t_net", "Total Net Weight"), `${nf(b.totals.purchased.net)} ${U("KG")}`]]))}
          {panel(s.t("p_other", "OTHER INFORMATION"), <ClipboardList className="h-4 w-4" />, kv([[s.t("currency", "Currency"), money ? b.currency : s.t("not_shown", "Not Shown")], [s.t("amount", "Amount"), money && b.amount != null ? `${b.currency} ${nf(b.amount)}` : s.t("not_shown", "Not Shown")], [s.t("exchange_rate", "Exchange Rate"), money && b.exchangeRate != null ? nf(b.exchangeRate, 4) : s.t("not_shown", "Not Shown")], [s.t("remarks", "Remarks"), b.remarks]]))}
        </div>
        <CardsRow />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            {sec("bg-blue-700", `1. ${s.t("s_purchase_entries", "PURCHASE GOODS ENTRY DETAILS")}`, (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse" data-testid="sbr-entry-table">
                  <thead><tr>{[s.t("col_sno", "S.No"), s.t("col_lot_entry", "Lot & Entry No"), s.t("col_goods", "Goods Name"), s.t("col_brand", "Brand"), s.t("col_size", "Size"), s.t("col_qty", "Quantity"), s.t("col_gross", "Gross Weight (KG)"), s.t("col_net", "Net Weight (KG)"), ...(money ? [s.t("col_unit_price", "Unit Price"), s.t("col_amount", "Amount")] : []), ""].map((h, i) => <th key={i} className={colHead}>{h}</th>)}</tr></thead>
                  <tbody>
                    {b.entries.length === 0 && <Empty cols={11} />}
                    {b.entries.map((e, i) => (
                      <tr key={e.entryId} data-testid="sbr-entry-row">
                        <td className={num}>{i + 1}</td><td className={cell}><LotLink type={b.type} billId={b.id} lotNo={e.lotNo} label={lotLabel(e)} /></td><td className={`${cell} font-bold`}>{e.goodsName || "—"}</td><td className={cell}>{e.brand || "—"}</td><td className={cell}>{e.size || "—"}</td>
                        <td className={num}>{nf(e.purchased.qty)} {U(e.unit)}</td><td className={num}>{kg(e.purchased.gross)}</td><td className={num}>{kg(e.purchased.net)}</td>
                        {money && <><td className={num}>{e.unitPrice != null ? nf(e.unitPrice) : "—"}</td><td className={num}>{e.amount != null ? nf(e.amount) : "—"}</td></>}
                        <td className={cell}>{perms.add && e.remaining.qty > 0 && e.lotNo !== "—" && <button type="button" data-testid="sbr-add-treatment" onClick={() => setTreatTarget({ billType: b.type, billId: b.id, billNo: b.billNo, lotNo: e.lotNo, entry: e })} title={s.t("add_treatment", "Record treatment")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50"><Stethoscope className="h-3.5 w-3.5" /></button>}</td>
                      </tr>
                    ))}
                    {b.entries.length > 0 && <tr className="bg-blue-700 text-white"><td colSpan={5} className="px-2.5 py-2 text-[13px] font-extrabold">{s.t("grand_total", "GRAND TOTAL")} ({b.entries.length})</td><td className={`${num} font-extrabold text-white`}>{nf(b.totals.purchased.qty)}</td><td className={`${num} font-extrabold text-white`}>{nf(b.totals.purchased.gross)}</td><td className={`${num} font-extrabold text-white`}>{nf(b.totals.purchased.net)}</td>{money && <><td /><td className={`${num} font-extrabold text-white`}>{b.amount != null ? nf(b.amount) : "—"}</td></>}<td /></tr>}
                  </tbody>
                </table>
              </div>
            ))}
            {sec("bg-green-700", `2. ${s.t("s_sales", "SALES DETAILS (AGAINST THIS PURCHASE BILL)")}`, <SalesTable rows={b.sales} withBill={false} />)}
            {sec("bg-orange-600", `3. ${s.t("s_lotwise", "LOT-WISE REMAINING BALANCE (BY ENTRY)")}`, <BalanceTable rows={b.entries} withBill={false} />)}
            {b.treatments.length > 0 && sec("bg-teal-700", s.t("s_treatments", "TREATMENT HISTORY"), <TreatmentTable rows={b.treatments} withBill={false} />)}
          </div>
          <aside className="space-y-4">
            {panel(s.t("p_visual", "VISUAL SUMMARY"), <BarChart3 className="h-4 w-4" />, <div className="flex h-[170px] items-end gap-3 border-b border-slate-200 px-2 pb-1">{bar(c.purchase.qty, "bg-blue-600", s.t("grp_purchased", "Purchased"))}{bar(c.sales.qty, "bg-green-600", s.t("grp_sold", "Sold"))}{bar(c.remaining.qty, "bg-orange-500", s.t("grp_remaining", "Remaining"))}</div>)}
            {panel(s.t("p_goods_wise", "GOODS WISE SUMMARY"), <Boxes className="h-4 w-4" />, <table className="w-full border-collapse text-[12px]"><thead><tr>{[s.t("col_goods", "Goods Name"), s.t("grp_purchased", "Purchased"), s.t("grp_sold", "Sold"), s.t("grp_remaining", "Remaining")].map((h) => <th key={h} className={`${colHead} !px-1.5`}>{h}</th>)}</tr></thead><tbody>{bill.goodsWise.map((g) => <tr key={g.goodsName + U(g.unit)}><td className="px-1.5 py-1">{g.goodsName}</td><td className="px-1.5 py-1 text-end tabular-nums">{nf(g.purchased)}</td><td className="px-1.5 py-1 text-end tabular-nums">{nf(g.sold)}</td><td className="px-1.5 py-1 text-end font-black tabular-nums">{nf(g.remaining)}</td></tr>)}<tr className="bg-slate-100 font-black dark:bg-slate-800"><td className="px-1.5 py-1">{s.t("total", "Total")}</td><td className="px-1.5 py-1 text-end tabular-nums">{nf(bill.goodsWise.reduce((a, g) => a + g.purchased, 0))}</td><td className="px-1.5 py-1 text-end tabular-nums">{nf(bill.goodsWise.reduce((a, g) => a + g.sold, 0))}</td><td className="px-1.5 py-1 text-end tabular-nums">{nf(bill.goodsWise.reduce((a, g) => a + g.remaining, 0))}</td></tr></tbody></table>)}
            {panel(s.t("p_treatment", "TREATMENT SUMMARY"), <Stethoscope className="h-4 w-4" />, kv([[s.t("treated", "Treated"), nf(c.treatment.treated)], [s.t("pending", "Pending"), nf(c.treatment.pending)], [s.t("untreated", "Untreated"), nf(c.treatment.untreated)], [s.t("col_tr_loss", "Treatment Loss / Adjustment"), nf(c.treatment.loss)]]))}
            {panel(s.t("p_payment", "PAYMENT SUMMARY"), <Wallet className="h-4 w-4" />, kv([[s.t("total_amount", "Total Amount"), money && b.amount != null ? `${b.currency} ${nf(b.amount)}` : s.t("not_shown", "Not Shown")], [s.t("paid_amount", "Paid Amount"), money && b.paid != null ? nf(b.paid) : "—"], [s.t("pending_amount", "Pending Amount"), money && b.pending != null ? nf(b.pending) : "—"]]))}
          </aside>
        </div>
      </div>
    );
  };

  const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<any> }> = [
    { key: "bills", label: s.t("tab_bills", "Purchase Bill Journal"), icon: FileText }, { key: "sales", label: s.t("tab_sales", "Sales Details"), icon: Truck }, { key: "stock", label: s.t("tab_stock", "Stock Summary"), icon: Boxes },
    { key: "payments", label: s.t("tab_payments", "Payment Report"), icon: Wallet }, { key: "treatments", label: s.t("tab_treatments", "Treatment Report"), icon: Stethoscope },
  ];
  const input = "min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] dark:border-slate-600 dark:bg-slate-900";
  const lab = (t: string, node: React.ReactNode) => <label className="block space-y-1"><span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{t}</span>{node}</label>;
  const branchOpts = (opts?.branches ?? []).filter((b) => (!f.countryId || b.country_id === f.countryId) && (!f.companyId || b.company_id === f.companyId));
  const cityOpts = (opts?.cities ?? []).filter((c) => (!f.countryBranchId || c.country_branch_id === f.countryBranchId) && (!f.companyId || c.company_id === f.companyId));
  const activeFilterCount = Object.values(applied).filter(Boolean).length;
  const reportDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const kindMenu: Array<[string, string, boolean]> = [
    ["journal", s.t("x_journal", "Complete Stock Journal — A4 Landscape PDF"), true], ["bill", s.t("x_bill", "Individual Purchase Bill Journal — PDF"), !!billRef],
    ["stock", s.t("x_stock", "Country / Company / Branch Stock Report — PDF / Excel"), true], ["payments", s.t("x_payments", "Payment Report — PDF / Excel"), true], ["treatments", s.t("x_treatments", "Treatment Report — PDF / Excel"), true],
  ];

  return (
    <div dir={s.dir} data-testid="stock-balance-report" className="mx-auto max-w-[1920px] space-y-3 p-3 sm:p-5">
      {/* banner */}
      <header className="flex flex-col gap-3 rounded-2xl border bg-white p-3 shadow-xs dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-[17px] font-black text-white">DGT</span><div className="leading-tight"><div className="text-[17px] font-black tracking-tight text-blue-900 dark:text-blue-200">DGT LLC</div><div className="text-[10px] font-bold tracking-widest text-slate-500">{s.t("tagline", "TRADING & LOGISTICS")}</div></div></div>
        <div className="flex-1 rounded-lg bg-blue-800 px-4 py-2 text-center text-white lg:max-w-[560px]"><h1 className="text-[18px] font-black tracking-wide">{s.t("title", "GOODS MOVEMENT & STOCK REPORT")}</h1><p className="text-[10px] font-semibold tracking-[0.2em] opacity-90">{s.t("sub_line", "PURCHASE · SALES · REMAINING · PAYMENT · TREATMENT")}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border px-3 py-1 text-[11px] leading-tight"><div className="text-slate-500">{s.t("report_date", "Report Date")}</div><b dir="ltr">{reportDate}</b><div className="text-slate-500">{s.t("generated_by", "Generated By")}: {session?.fullName || "ERP System"}</div></div>
          {perms.print && <button type="button" data-testid="sbr-print" disabled={busyPrint} onClick={() => void printCurrent()} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-700 px-3 text-[13px] font-bold text-white hover:bg-blue-800"><Printer className="h-4 w-4" />{s.t("print", "Print")}</button>}
          {perms.print && <button type="button" data-testid="sbr-pdf" disabled={busyPrint} onClick={() => void printCurrent()} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border-2 border-blue-700 px-3 text-[13px] font-bold text-blue-800 hover:bg-blue-50"><FileText className="h-4 w-4" />PDF</button>}
          {perms.export && <button type="button" data-testid="sbr-excel" onClick={() => exportExcel(billRef ? "bill" : tab === "bills" ? "journal" : tab)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-green-700 px-3 text-[13px] font-bold text-white hover:bg-green-800"><FileSpreadsheet className="h-4 w-4" />Excel</button>}
          <div className="relative">
            <button type="button" data-testid="sbr-more" onClick={() => setMenuOpen((v) => !v)} aria-label={s.t("more", "More reports")} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-slate-50"><MoreVertical className="h-4 w-4" /></button>
            {menuOpen && <div className="absolute end-0 top-11 z-40 w-80 rounded-xl border bg-white p-1.5 shadow-xl dark:bg-slate-900" onMouseLeave={() => setMenuOpen(false)}>
              {kindMenu.filter(([, , on]) => on).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"><span className="text-[12px] font-semibold">{label}</span><span className="flex gap-1"><button type="button" onClick={() => { setMenuOpen(false); void printCurrent(k); }} className="rounded-md border px-1.5 py-1 text-[11px] font-bold">PDF</button>{perms.export ? <button type="button" onClick={() => { setMenuOpen(false); exportExcel(k); }} className="rounded-md border px-1.5 py-1 text-[11px] font-bold text-green-700">XLS</button> : null}</span></div>
              ))}
            </div>}
          </div>
        </div>
      </header>

      {/* tabs + language */}
      <div className="flex flex-col gap-2 rounded-2xl border bg-white p-2 shadow-xs dark:bg-slate-900 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex min-w-0 gap-1.5 overflow-x-auto" role="tablist">
          {tabs.map((t) => { const Icon = t.icon; return <button key={t.key} role="tab" aria-selected={!billRef && tab === t.key} data-testid={`sbr-tab-${t.key}`} type="button" onClick={() => goTab(t.key)} className={`inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-lg px-4 text-[14px] font-bold transition ${!billRef && tab === t.key ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100"}`}><Icon className="h-4 w-4" />{t.label}</button>; })}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {LANGS.map((l) => <button key={l.code} type="button" data-testid={`sbr-lang-${l.code}`} onClick={() => switchLang(l.code)} className={`min-h-[34px] rounded-lg border px-3 text-[12px] font-bold ${s.lang === l.code ? "border-green-600 bg-green-600 text-white" : "bg-white hover:bg-slate-50 dark:bg-slate-900"}`}>{l.label}</button>)}
        </div>
      </div>

      {/* master filter */}
      <div className="rounded-2xl border bg-white p-2.5 shadow-xs dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" data-testid="sbr-filter-toggle" onClick={() => setFiltersOpen((v) => !v)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-3 text-[13px] font-bold hover:bg-slate-50"><Filter className="h-4 w-4" />{s.t("filters", "Filters")}{activeFilterCount > 0 && <span className="rounded-full bg-blue-700 px-1.5 text-[11px] text-white">{activeFilterCount}</span>}<ChevronDown className={`h-4 w-4 transition ${filtersOpen ? "rotate-180" : ""}`} /></button>
          <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input data-testid="sbr-search" value={f.billNo} onChange={(e) => setF({ ...f, billNo: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") apply(); }} placeholder={s.t("search_ph", "Search purchase bill, goods, lot, brand, origin…")} className={`${input} ps-9`} /></div>
          <button type="button" onClick={() => void load(page)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-3 text-[13px] font-bold hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{s.t("refresh", "Refresh")}</button>
        </div>
        {filtersOpen && (
          <div className="mt-3 border-t pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {lab(s.t("f_country", "Country"), <select value={f.countryId} onChange={(e) => setF({ ...f, countryId: e.target.value, countryBranchId: "", cityBranchId: "" })} className={input}><option value="">{s.t("all", "All")}</option>{opts?.countries.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>)}
              {lab(s.t("f_company", "Company"), <select value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value, countryBranchId: "", cityBranchId: "" })} className={input}><option value="">{s.t("all", "All")}</option>{opts?.companies.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>)}
              {lab(s.t("f_branch", "Branch"), <select value={f.countryBranchId} onChange={(e) => setF({ ...f, countryBranchId: e.target.value, cityBranchId: "" })} className={input}><option value="">{s.t("all", "All")}</option>{branchOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>)}
              {lab(s.t("f_city", "City"), <select value={f.cityBranchId} onChange={(e) => setF({ ...f, cityBranchId: e.target.value })} className={input}><option value="">{s.t("all", "All")}</option>{cityOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>)}
              {lab(s.t("f_warehouse", "Warehouse"), <select value={f.warehouseId} onChange={(e) => setF({ ...f, warehouseId: e.target.value })} className={input}><option value="">{s.t("all", "All")}</option>{opts?.warehouses.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>)}
              {lab(s.t("f_sales_bill", "Sales Bill Number"), <input value={f.salesBillNo} onChange={(e) => setF({ ...f, salesBillNo: e.target.value })} className={input} dir="ltr" />)}
              {lab(s.t("f_lot", "Lot Number"), <input value={f.lotNo} onChange={(e) => setF({ ...f, lotNo: e.target.value })} className={input} dir="ltr" />)}
              {lab(s.t("f_goods", "Goods Name"), <input value={f.goodsName} onChange={(e) => setF({ ...f, goodsName: e.target.value })} className={input} />)}
              {lab(s.t("f_date_from", "From date"), <input type="date" value={f.dateFrom} onChange={(e) => setF({ ...f, dateFrom: e.target.value })} className={input} />)}
              {lab(s.t("f_date_to", "To date"), <input type="date" value={f.dateTo} onChange={(e) => setF({ ...f, dateTo: e.target.value })} className={input} />)}
              {lab(s.t("f_status", "Stock Status"), <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={input}><option value="">{s.t("all", "All")}</option>{["available", "in_transit", "not_loaded", "sold_out", "over_sold"].map((st) => <option key={st} value={st}>{({ available: s.t("st_available", "Available"), in_transit: s.t("st_in_transit", "In transit"), not_loaded: s.t("st_not_loaded", "Not loaded"), sold_out: s.t("st_sold_out", "Sold out"), over_sold: s.t("st_over_sold", "Over-sold") } as Record<string, string>)[st]}</option>)}</select>)}
              {lab(s.t("f_type", "Purchase Type"), <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={input}><option value="">{s.t("all", "All")}</option><option value="booking">{s.t("type_booking", "Booking")}</option><option value="local">{s.t("type_local", "Local")}</option></select>)}
            </div>
            <div className="mt-3 flex gap-2"><button type="button" data-testid="sbr-apply" onClick={apply} className="min-h-[40px] rounded-lg bg-blue-700 px-4 text-[13px] font-bold text-white">{s.t("apply", "Apply filters")}</button><button type="button" onClick={reset} className="min-h-[40px] rounded-lg border px-4 text-[13px] font-bold">{s.t("reset", "Reset")}</button></div>
          </div>
        )}
      </div>

      {banner && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-900"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{banner}</span><button type="button" onClick={() => setBanner(null)} aria-label={s.t("close", "Close")}><X className="h-4 w-4" /></button></div>}
      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-900"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span><button type="button" onClick={() => void load(page)} className="underline">{s.t("retry", "Try again")}</button></div>}

      {/* body */}
      <div aria-busy={loading} className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {billRef ? <BillView /> : (
          <div className="space-y-3">
            <CardsRow />
            {tab === "bills" && <BillsTable />}
            {tab === "sales" && <div className="overflow-hidden rounded-xl border bg-white dark:bg-slate-900"><div className="bg-green-700 px-3 py-2 text-[14px] font-black text-white">{s.t("s_sales_all", "SALES DETAILS")}</div><SalesTable rows={(rowsOf(tab) ?? []) as BalanceSale[]} />{(list?.unlinkedSalesCount ?? 0) > 0 && <p className="border-t bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900">{s.t("unlinked_note", "Sales marked 'Not linked to a lot' exist in the ERP but are not tied to any purchase lot, so they are listed here and never mixed into a purchase bill.")} ({list?.unlinkedSalesCount})</p>}</div>}
            {tab === "stock" && <div className="overflow-hidden rounded-xl border bg-white dark:bg-slate-900"><div className="bg-orange-600 px-3 py-2 text-[14px] font-black text-white">{s.t("s_lotwise", "LOT-WISE REMAINING BALANCE (BY ENTRY)")}</div><BalanceTable rows={(rowsOf(tab) ?? []) as StockRow[]} withBill /></div>}
            {tab === "payments" && <PaymentsTable />}
            {tab === "treatments" && <TreatmentTable rows={(rowsOf(tab) ?? []) as BalanceTreatment[]} withBill />}
            <Pager />
          </div>
        )}
      </div>

      {lotRef && <LotModal s={s} lotRef={lotRef} lang={s.lang} perms={perms} money={money} onClose={() => setLotRef(null)} onPrint={printLot} onBill={(t, id) => { setLotRef(null); openBill(t, id); }} />}
      {treatTarget && <TreatmentModal s={s} target={treatTarget} onClose={() => setTreatTarget(null)} onDone={(m) => { setTreatTarget(null); flash(m); void load(page); }} />}
      {editTreat && <UpdateTreatmentModal s={s} row={editTreat} onClose={() => setEditTreat(null)} onDone={(m) => { setEditTreat(null); flash(m); void load(page); }} />}
      {cancelTreat && <CancelTreatmentModal s={s} row={cancelTreat} onClose={() => setCancelTreat(null)} onDone={(m) => { setCancelTreat(null); flash(m); void load(page); }} />}
    </div>
  );
}

/* ───────────────────────── modals ───────────────────────── */
type S = ReturnType<typeof useErpScreen>;
const inputCls = "min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] dark:border-slate-600 dark:bg-slate-900";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block space-y-1"><span className="text-[13px] font-bold">{label}</span>{children}</label>;
const ErrBox = ({ msg }: { msg: string | null }) => (msg ? <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-[13px] font-semibold text-red-900"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{msg}</div> : null);
const SubmitRow = ({ s, busy, label, onCancel, testId }: { s: S; busy: boolean; label: string; onCancel: () => void; testId: string }) => (
  <div className="flex justify-end gap-2 border-t pt-3"><button type="button" onClick={onCancel} className="min-h-[42px] rounded-lg border px-4 text-[14px] font-bold">{s.t("cancel", "Cancel")}</button><button type="submit" data-testid={testId} disabled={busy} className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-teal-700 px-5 text-[14px] font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{label}</button></div>
);

function LotModal({ s, lotRef, lang, perms, money, onClose, onPrint, onBill }: { s: S; lotRef: { type: string; billId: string; lotNo: string }; lang: string; perms: Perms; money: boolean; onClose: () => void; onPrint: (l: LotData) => Promise<void>; onBill: (type: string, id: string) => void }) {
  const U = (u: string) => localizeUom(s.lang, u);
  const [d, setD] = useState<LotData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { let alive = true; void api<LotData>(`/api/erp/reports/stock-balance/lot?type=${lotRef.type}&billId=${lotRef.billId}&lotNo=${encodeURIComponent(lotRef.lotNo)}&lang=${lang}`).then((r) => { if (!alive) return; if (r.ok) setD(r.data!); else setErr(r.message || ""); }); return () => { alive = false; }; }, [lotRef, lang]);
  const cell = "px-2 py-1.5 text-[12.5px] border border-slate-100 dark:border-slate-700";
  const head = "px-2 py-1.5 text-start text-[11.5px] font-extrabold bg-slate-100 dark:bg-slate-800 border border-slate-200 whitespace-nowrap";
  const tot = d ? d.entries.reduce((a, e) => ({ q: a.q + e.purchased.qty, g: a.g + e.purchased.gross, n: a.n + e.purchased.net, s: a.s + e.sold.qty, r: a.r + e.remaining.qty, rg: a.rg + e.remaining.gross, rn: a.rn + e.remaining.net }), { q: 0, g: 0, n: 0, s: 0, r: 0, rg: 0, rn: 0 }) : null;
  const purpose = (v: string) => ({ own_warehouse: s.t("tf_own_wh", "Own warehouse"), dgt_warehouse: s.t("tf_dgt_wh", "DGT warehouse"), third_party_warehouse: s.t("tf_third_wh", "Third-party warehouse"), local_sale: s.t("tf_local_sale", "Local sale"), export_customer: s.t("tf_export", "Export to customer"), export_dgt_branch: s.t("tf_branch", "Transfer to DGT branch"), hold: s.t("tf_hold", "Hold"), warehouse: s.t("dest_warehouse", "Warehouse Storage"), local_sales: s.t("dest_local", "Local Market Stock"), export: s.t("dest_export", "Export Stock"), direct_sale: s.t("dest_direct", "Direct Sale / Delivery") } as Record<string, string>)[v] || v;
  return (
    <SimpleModal title={`${s.t("rt_lot", "LOT BALANCE REPORT")} — ${lotRef.lotNo === "—" ? s.t("not_loaded_lot", "Not loaded") : lotRef.lotNo}`} onClose={onClose} maxWidth="max-w-6xl">
      <div data-testid="sbr-lot-modal" className="space-y-3">
        {!d && !err && <div className="flex items-center justify-center gap-2 p-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />{s.t("loading", "Loading…")}</div>}
        <ErrBox msg={err} />
        {d && tot && <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px]"><button type="button" onClick={() => onBill(d.bill.type, d.bill.id)} className="font-black text-blue-700 underline-offset-2 hover:underline" dir="ltr">{d.bill.billNo}</button> · {d.bill.type === "booking" ? s.t("type_booking", "Booking") : s.t("type_local", "Local")} · {d.bill.countryName} · {d.bill.branchName}</div>
            {perms.print && <button type="button" data-testid="sbr-lot-print" onClick={() => void onPrint(d)} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-blue-700 px-3 text-[13px] font-bold text-white"><Printer className="h-4 w-4" />{s.t("print", "Print")} / PDF</button>}
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-[13px] dark:bg-slate-800 sm:grid-cols-4">
            {([[s.t("lot_purchase_qty", "Purchase Quantity"), nf(tot.q)], [s.t("lot_gross", "Gross Weight"), `${nf(tot.g)} ${U("KG")}`], [s.t("lot_net", "Net Weight"), `${nf(tot.n)} ${U("KG")}`], [s.t("qty_sold", "Quantity Sold"), nf(tot.s)], [s.t("lot_remaining_qty", "Remaining Available Quantity"), nf(tot.r)], [s.t("remaining_weight", "Remaining Weight"), `${nf(tot.rg)} / ${nf(tot.rn)} ${U("KG")}`], [s.t("current_wh", "Current Warehouse"), [...new Set(d.entries.map((e) => e.warehouseName).filter(Boolean))].join(", ") || "—"], [s.t("status", "Stock Status"), [...new Set(d.entries.map((e) => e.status))].join(" / ")]] as Array<[string, string]>).map(([k, v]) => <div key={k}><div className="text-[11px] font-bold uppercase text-slate-500">{k}</div><div className="font-black" dir="auto">{v}</div></div>)}
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] border-collapse"><thead><tr>{[s.t("col_lot_entry", "Lot & Entry No"), s.t("col_goods", "Goods Name"), s.t("col_brand", "Brand"), s.t("col_size", "Size"), s.t("col_origin", "Origin Country"), s.t("col_qty", "Quantity"), s.t("col_gross", "Gross Weight (KG)"), s.t("col_net", "Net Weight (KG)"), s.t("grp_sold", "Sold"), s.t("grp_remaining", "Remaining")].map((h) => <th key={h} className={head}>{h}</th>)}</tr></thead><tbody>
            {d.entries.map((e) => <tr key={e.entryId}><td className={cell}>{`${e.lotNo === "—" ? s.t("not_loaded_lot", "Not loaded") : e.lotNo} / ${s.t("entry", "Entry")} ${e.entryNo}`}</td><td className={`${cell} font-bold`}>{e.goodsName}</td><td className={cell}>{e.brand || "—"}</td><td className={cell}>{e.size || "—"}</td><td className={cell}>{e.origin || "—"}</td><td className={`${cell} text-end`}>{nf(e.purchased.qty)} {U(e.unit)}</td><td className={`${cell} text-end`}>{kg(e.purchased.gross)}</td><td className={`${cell} text-end`}>{kg(e.purchased.net)}</td><td className={`${cell} text-end`}>{nf(e.sold.qty)}</td><td className={`${cell} text-end font-black`}>{nf(e.remaining.qty)}</td></tr>)}
          </tbody></table></div>
          <h3 className="text-[13px] font-black text-green-800">{s.t("s_related_sales", "RELATED SALES BILLS")}</h3>
          <div className="overflow-x-auto"><table className="w-full min-w-[700px] border-collapse"><thead><tr>{[s.t("col_sales_bill", "Sales Bill No"), s.t("col_sales_date", "Sales Date"), s.t("col_sales_type", "Sales Type"), s.t("col_buyer", "Buyer / Customer Account"), s.t("col_lot_entry", "Lot & Entry No"), s.t("col_sold_qty", "Sold Quantity"), s.t("col_net", "Net Weight (KG)"), s.t("col_status", "Status")].map((h) => <th key={h} className={head}>{h}</th>)}</tr></thead><tbody>
            {d.sales.length === 0 && <tr><td colSpan={8} className={`${cell} text-center text-slate-500`}>{s.t("none", "None")}</td></tr>}
            {d.sales.map((x) => <tr key={x.id} className={x.status === "cancelled" ? "opacity-50 line-through" : ""}><td className={`${cell} font-bold`} dir="ltr">{x.salesBillNo}</td><td className={cell} dir="ltr">{dt(x.date)}</td><td className={cell}>{x.saleType}</td><td className={cell}>{x.buyerAccount || "—"}</td><td className={cell}>{x.lotEntryLabel}</td><td className={`${cell} text-end`}>{nf(x.qty)}</td><td className={`${cell} text-end`}>{kg(x.net)}</td><td className={cell}>{({ completed: s.t("sale_completed", "Completed"), issued: s.t("sale_issued", "Issued"), reserved: s.t("sale_reserved", "Reserved"), cancelled: s.t("sale_cancelled", "Cancelled") } as Record<string, string>)[x.status] || x.status}</td></tr>)}
          </tbody></table></div>
          <h3 className="text-[13px] font-black text-slate-700">{s.t("s_transfers", "STOCK TRANSFERS")}</h3>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-collapse"><thead><tr>{[s.t("col_transfer_no", "Transfer No"), s.t("col_destination", "Purpose / Destination"), s.t("col_from", "From"), s.t("col_to", "To"), s.t("col_qty", "Quantity"), s.t("col_date", "Date"), s.t("col_status", "Status")].map((h) => <th key={h} className={head}>{h}</th>)}</tr></thead><tbody>
            {d.transfers.length === 0 && <tr><td colSpan={7} className={`${cell} text-center text-slate-500`}>{s.t("none", "None")}</td></tr>}
            {d.transfers.map((x: any, i: number) => <tr key={i}><td className={cell} dir="ltr">{x.transfer_no}</td><td className={cell}>{purpose(x.purpose)}</td><td className={cell}>{x.from_wh || "—"}</td><td className={cell}>{x.to_wh || "—"}</td><td className={`${cell} text-end`}>{nf(x.qty)}</td><td className={cell} dir="ltr">{dt(x.completed_at ?? x.created_at)}</td><td className={cell}>{x.status}</td></tr>)}
          </tbody></table></div>
          <h3 className="text-[13px] font-black text-teal-800">{s.t("s_treatments", "TREATMENT HISTORY")}</h3>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-collapse"><thead><tr>{[s.t("col_treatment_type", "Treatment Type"), s.t("col_treatment_date", "Treatment Date"), s.t("col_tr_received", "Qty Received for Treatment"), s.t("col_tr_treated", "Qty Treated"), s.t("col_tr_pending", "Qty Pending"), s.t("col_tr_loss", "Treatment Loss / Adjustment"), s.t("col_tr_status", "Treatment Status")].map((h) => <th key={h} className={head}>{h}</th>)}</tr></thead><tbody>
            {d.treatments.length === 0 && <tr><td colSpan={7} className={`${cell} text-center text-slate-500`}>{s.t("none", "None")}</td></tr>}
            {d.treatments.map((x) => <tr key={x.id}><td className={cell}>{x.treatmentType}</td><td className={cell} dir="ltr">{dt(x.treatmentDate)}</td><td className={`${cell} text-end`}>{nf(x.received)}</td><td className={`${cell} text-end`}>{nf(x.treated)}</td><td className={`${cell} text-end`}>{nf(x.pending)}</td><td className={`${cell} text-end`}>{nf(x.loss)}</td><td className={cell}>{x.status}</td></tr>)}
          </tbody></table></div>
        </>}
        {money === false && null}
      </div>
    </SimpleModal>
  );
}

const TREATMENT_TYPES = ["Fumigation", "Cleaning", "Sorting", "Roasting", "Drying", "Other"];
function TreatmentModal({ s, target, onClose, onDone }: { s: S; target: { billType: string; billId: string; billNo: string; lotNo: string; entry: BalanceEntry }; onClose: () => void; onDone: (m: string) => void }) {
  const U = (u: string) => localizeUom(s.lang, u);
  const [type, setType] = useState(TREATMENT_TYPES[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [received, setReceived] = useState(String(target.entry.remaining.qty));
  const [treated, setTreated] = useState("0");
  const [loss, setLoss] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = useRef(newKey());
  const e = target.entry;
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErr(null);
    const r = Number(received), t = Number(treated), l = Number(loss);
    if (!(r > 0)) return setErr(s.t("err_qty", "Enter a quantity greater than zero."));
    if (t + l > r + 0.0001) return setErr(s.t("err_tr_split", "Treated + loss cannot exceed the quantity received for treatment."));
    setBusy(true);
    const res = await api<any>("/api/erp/reports/stock-balance/treatment", { method: "POST", body: JSON.stringify({ idempotencyKey: key.current, billType: target.billType, billId: target.billId, lotNo: target.lotNo, entryKey: e.entryId.split("::").pop(), treatmentType: type, treatmentDate: date, qtyReceived: r, qtyTreated: t, qtyLoss: l, warehouseId: e.warehouseId, remarks: remarks.trim() || null }) });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(`${s.t("ok_treatment", "Treatment recorded")}: ${res.data?.treatment?.treatment_no ?? ""}`);
  };
  return (
    <SimpleModal title={s.t("add_treatment", "Record treatment")} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-3" data-testid="sbr-treatment-form">
        <div className="rounded-xl bg-slate-50 p-3 text-[13px] font-bold dark:bg-slate-800">{target.billNo} · {target.lotNo} / {s.t("entry", "Entry")} {e.entryNo} · {e.goodsName} · <span dir="ltr">{nf(e.remaining.qty)} {U(e.unit)}</span></div>
        <p className="text-[12px] text-slate-600">{s.t("treatment_note", "Treatment is recorded against the lot only. It does not move, sell or add stock, so treated goods are never counted twice.")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={s.t("col_treatment_type", "Treatment Type")}><select data-testid="sbr-tr-type" value={type} onChange={(x) => setType(x.target.value)} className={inputCls}>{TREATMENT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label={s.t("col_treatment_date", "Treatment Date")}><input type="date" value={date} onChange={(x) => setDate(x.target.value)} className={inputCls} /></Field>
          <Field label={s.t("col_tr_received", "Qty Received for Treatment")}><input data-testid="sbr-tr-received" inputMode="decimal" value={received} onChange={(x) => setReceived(x.target.value)} className={inputCls} dir="ltr" /></Field>
          <Field label={s.t("col_tr_treated", "Qty Treated")}><input data-testid="sbr-tr-treated" inputMode="decimal" value={treated} onChange={(x) => setTreated(x.target.value)} className={inputCls} dir="ltr" /></Field>
          <Field label={s.t("col_tr_loss", "Treatment Loss / Adjustment")}><input data-testid="sbr-tr-loss" inputMode="decimal" value={loss} onChange={(x) => setLoss(x.target.value)} className={inputCls} dir="ltr" /></Field>
          <Field label={s.t("remarks", "Remarks")}><input value={remarks} onChange={(x) => setRemarks(x.target.value)} className={inputCls} /></Field>
        </div>
        <ErrBox msg={err} />
        <SubmitRow s={s} busy={busy} label={s.t("save", "Save")} onCancel={onClose} testId="sbr-tr-submit" />
      </form>
    </SimpleModal>
  );
}

function UpdateTreatmentModal({ s, row, onClose, onDone }: { s: S; row: BalanceTreatment; onClose: () => void; onDone: (m: string) => void }) {
  const U = (u: string) => localizeUom(s.lang, u);
  const [treated, setTreated] = useState(String(row.treated));
  const [loss, setLoss] = useState(String(row.loss));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true); setErr(null);
    const res = await api<any>("/api/erp/reports/stock-balance/treatment", { method: "PATCH", body: JSON.stringify({ id: row.id, qtyTreated: Number(treated), qtyLoss: Number(loss) }) });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(s.t("ok_treatment_updated", "Treatment updated"));
  };
  return (
    <SimpleModal title={`${s.t("update", "Update")} — ${row.treatmentNo}`} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-3" data-testid="sbr-update-form">
        <div className="rounded-xl bg-slate-50 p-3 text-[13px] font-bold dark:bg-slate-800">{row.goodsName} · {row.lotNo} · <span dir="ltr">{nf(row.received)} {U(row.unit)}</span></div>
        <Field label={s.t("col_tr_treated", "Qty Treated")}><input data-testid="sbr-up-treated" inputMode="decimal" value={treated} onChange={(x) => setTreated(x.target.value)} className={inputCls} dir="ltr" /></Field>
        <Field label={s.t("col_tr_loss", "Treatment Loss / Adjustment")}><input data-testid="sbr-up-loss" inputMode="decimal" value={loss} onChange={(x) => setLoss(x.target.value)} className={inputCls} dir="ltr" /></Field>
        <ErrBox msg={err} />
        <SubmitRow s={s} busy={busy} label={s.t("save", "Save")} onCancel={onClose} testId="sbr-up-submit" />
      </form>
    </SimpleModal>
  );
}

function CancelTreatmentModal({ s, row, onClose, onDone }: { s: S; row: BalanceTreatment; onClose: () => void; onDone: (m: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (reason.trim().length < 3) return setErr(s.t("err_reason", "Enter the reason."));
    setBusy(true); setErr(null);
    const res = await api<any>("/api/erp/reports/stock-balance/treatment", { method: "DELETE", body: JSON.stringify({ id: row.id, reason: reason.trim() }) });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(s.t("ok_treatment_cancelled", "Treatment cancelled"));
  };
  return (
    <SimpleModal title={`${s.t("cancel_treatment", "Cancel")} — ${row.treatmentNo}`} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-3" data-testid="sbr-cancel-form">
        <Field label={s.t("reason", "Reason")}><textarea data-testid="sbr-cancel-reason" value={reason} onChange={(x) => setReason(x.target.value)} rows={3} className={`${inputCls} py-2`} /></Field>
        <ErrBox msg={err} />
        <SubmitRow s={s} busy={busy} label={s.t("cancel_treatment", "Cancel")} onCancel={onClose} testId="sbr-cancel-submit" />
      </form>
    </SimpleModal>
  );
}
