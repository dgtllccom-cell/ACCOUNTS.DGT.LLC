"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  ExternalLink,
  FileWarning,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type ContractRow = {
  source_module: "purchase_order" | "sales_order" | "hr_employee";
  source_id: string;
  contract_type: string;
  global_serial: string | null;
  country_serial: string | null;
  branch_serial: string | null;
  contract_no: string | null;
  manual_contract_no: string | null;
  booking_order_no: string | null;
  country_name: string | null;
  main_branch_name: string | null;
  city_branch_name: string | null;
  created_by_name: string | null;
  party_name: string | null;
  party_role: string | null;
  contract_date: string | null;
  start_date: string | null;
  expiry_date: string | null;
  expected_delivery_date: string | null;
  original_currency: string | null;
  original_amount: number | null;
  exchange_rate: number | null;
  final_amount: number | null;
  advance_amount: number | null;
  paid_amount: number | null;
  remaining_balance: number | null;
  contract_status: string;
  payment_status: string | null;
  loading_status: string | null;
  attachment_count: number;
  last_followup_at: string | null;
  next_action_date: string | null;
  watch_status: string;
};

const STATUSES = [
  "Draft", "Pending Verification", "Pending Approval", "Approved",
  "Active", "Partially Completed", "Completed", "Expired", "Cancelled",
];

const STATUS_TONE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  "Pending Verification": "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  "Pending Approval": "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  Approved: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  Active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "Partially Completed": "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  Completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  Expired: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  Cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function fmt(v: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
}

function sourceHref(r: ContractRow): string {
  switch (r.source_module) {
    case "purchase_order":
      return `/dashboard/purchase/purchase-order?id=${r.source_id}`;
    case "sales_order":
      return `/dashboard/sales/sales-order?id=${r.source_id}`;
    case "hr_employee":
      return `/dashboard/general-office/employees?employee=${r.source_id}`;
    default:
      return "#";
  }
}

export function ContractControlCenter({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("contract", langProp);

  const [rows, setRows] = useState<ContractRow[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [riskSummary, setRiskSummary] = useState<{ counts: Record<string, number>; attention: any[] }>({ counts: {}, attention: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [contractType, setContractType] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<{ module: string; id: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "200" });
      if (contractType) qs.set("contractType", contractType);
      if (status) qs.set("status", status);
      if (search) qs.set("search", search);
      if (fromDate) qs.set("fromDate", fromDate);
      if (toDate) qs.set("toDate", toDate);
      const res = await apiGet<{ rows: ContractRow[]; total: number }>(`/api/erp/hr/contracts?${qs.toString()}`);
      setRows(res.rows ?? []);
      setTotal(res.total ?? 0);
      const k = await apiGet<{ kpis: Record<string, number> }>(`/api/erp/hr/contracts/kpis`);
      setKpis(k.kpis ?? {});
      const rs = await apiGet<{ summary: { counts: Record<string, number>; attention: any[] } }>(`/api/erp/hr/contracts/intelligence/summary`);
      setRiskSummary(rs.summary ?? { counts: {}, attention: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [contractType, status, search, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const runReminderSync = useCallback(async () => {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await apiPost<{ created: number }>("/api/erp/hr/contracts/reminders/sync", { daysAhead: 30 });
      setSyncNote(s.t("reminders_created", "reminders created").replace("{n}", String(res.created ?? 0)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }, [s]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.original += Number(r.original_amount) || 0;
        acc.remaining += Number(r.remaining_balance) || 0;
        return acc;
      },
      { original: 0, remaining: 0 },
    );
  }, [rows]);

  const printConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: s.t("all_contracts_register", "All Contracts Consolidated Register"),
    subtitle: s.t("subtitle", "Central Contract Control Center"),
    lang: s.lang,
    orientation: "landscape" as const,
    scope: { dateRange: fromDate && toDate ? `${fromDate} - ${toDate}` : undefined },
    kpis: [
      { label: s.t("k_total", "Total Contracts"), value: String(kpis.total ?? rows.length), color: "blue" as const },
      { label: s.t("k_expiring", "Expiring ≤ 30d"), value: String(kpis.expiring_30d ?? 0), color: "amber" as const },
      { label: s.t("k_pending_payment", "Pending Payment"), value: String(kpis.pending_payment ?? 0), color: "red" as const },
      { label: s.t("col_remaining", "Remaining"), value: fmt(totals.remaining), color: "emerald" as const },
    ],
    columns: [
      { key: "global_serial", label: s.t("col_global_serial", "Global Serial") },
      { key: "contract_no", label: s.t("col_contract_no", "Contract No") },
      { key: "booking_order_no", label: s.t("col_booking_no", "Booking / Order No") },
      { key: "contract_type", label: s.t("col_type", "Type") },
      { key: "party_name", label: s.t("col_party", "Supplier / Customer / Employee") },
      { key: "country_name", label: s.t("col_country", "Country") },
      { key: "contract_date", label: s.t("col_date", "Date"), format: "date" as const },
      { key: "expiry_date", label: s.t("col_expiry", "Expiry"), format: "date" as const },
      { key: "original_currency", label: s.t("col_currency", "Currency") },
      { key: "original_amount", label: s.t("col_amount", "Amount"), align: "right" as const, format: "currency" as const },
      { key: "remaining_balance", label: s.t("col_remaining", "Remaining"), align: "right" as const, format: "currency" as const },
      { key: "contract_status", label: s.t("col_status", "Status") },
    ],
    rows,
    totals: { original_amount: fmt(totals.original), remaining_balance: fmt(totals.remaining) },
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
              {s.t("title", "Central Contract Control Center")}
            </h1>
            <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-500">
              {s.t("blurb", "Every employment, purchase and sales contract in one linked register — each row is a live link to its source module, never a copy.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UniversalPrintActionButton reportConfig={printConfig} />
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {s.t("refresh", "Refresh")}
            </button>
            <button
              type="button"
              onClick={() => void runReminderSync()}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
              {s.t("sync_reminders", "Generate CRM Reminders")}
            </button>
          </div>
        </header>

        {syncNote ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{syncNote}</p>
        ) : null}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label={s.t("k_total", "Total Contracts")} value={kpis.total ?? rows.length} />
          <Kpi label={s.t("k_purchase", "Purchase")} value={kpis.purchase ?? 0} />
          <Kpi label={s.t("k_sales", "Sales")} value={kpis.sales ?? 0} />
          <Kpi label={s.t("k_employment", "Employment")} value={kpis.employment ?? 0} />
          <Kpi label={s.t("k_expiring", "Expiring ≤ 30d")} value={kpis.expiring_30d ?? 0} icon={CalendarClock} tone="text-amber-600" />
          <Kpi label={s.t("k_missing_attachment", "Missing Attachment")} value={kpis.missing_attachment ?? 0} icon={FileWarning} tone="text-rose-600" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label={s.t("k_pending_approval", "Pending Approval")} value={kpis.pending_approval ?? 0} icon={AlertTriangle} tone="text-amber-600" />
          <Kpi label={s.t("k_pending_payment", "Pending Payment")} value={kpis.pending_payment ?? 0} icon={Wallet} tone="text-rose-600" />
          <Kpi label={s.t("k_action_due", "Action Due")} value={kpis.action_due ?? 0} icon={BellRing} tone="text-blue-600" />
        </div>

        {/* Contract Intelligence — portfolio risk summary */}
        <div className={s.textStart}>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            <Sparkles className="h-3 w-3" /> {s.t("intel_portfolio_title", "Contract Intelligence — Portfolio Risk")}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label={s.t("intel_risk_high", "High Risk")} value={riskSummary.counts.high ?? 0} icon={ShieldAlert} tone="text-rose-600" />
            <Kpi label={s.t("intel_risk_medium", "Medium Risk")} value={riskSummary.counts.medium ?? 0} icon={ShieldQuestion} tone="text-amber-600" />
            <Kpi label={s.t("intel_risk_low", "Low Risk")} value={riskSummary.counts.low ?? 0} icon={ShieldCheck} tone="text-emerald-600" />
            <Kpi label={s.t("intel_not_analyzed", "Not Yet Analyzed")} value={riskSummary.counts.not_analyzed ?? 0} icon={ShieldQuestion} tone="text-slate-400" />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-slate-200 px-2 dark:border-slate-700">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={s.t("search", "Search contract no, booking no, party, serial…")}
              className="flex-1 bg-transparent py-1.5 text-xs outline-none"
            />
          </div>
          <select value={contractType} onChange={(e) => setContractType(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
            <option value="">{s.t("all_types", "All Contract Types")}</option>
            <option value="employment">{s.t("type_employment", "Employment Contract")}</option>
            <option value="purchase_booking">{s.t("type_purchase_booking", "New Purchase Booking")}</option>
            <option value="purchase_order">{s.t("type_purchase_order", "Purchase Order")}</option>
            <option value="sales_booking">{s.t("type_sales_booking", "New Sales Booking")}</option>
            <option value="sales_order">{s.t("type_sales_order", "Sales Order")}</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
            <option value="">{s.t("all_status", "All Statuses")}</option>
            {STATUSES.map((st) => (
              <option key={st} value={st}>{s.t(`status_${st.replace(/\s+/g, "_").toLowerCase()}`, st)}</option>
            ))}
          </select>
          <div className="min-w-[15rem]">
            <ErpDatePicker mode="range" lang={s.lang} size="sm"
              value={{ from: fromDate || null, to: toDate || null }}
              onApply={(v) => { setFromDate(v.from ?? ""); setToDate(v.to ?? ""); }} />
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <Th className="px-3 py-2.5">{s.t("col_global_serial", "Global Serial")}</Th>
                <Th className="px-3 py-2.5">{s.t("col_contract_no", "Contract No")}</Th>
                <Th className="px-3 py-2.5">{s.t("col_type", "Type")}</Th>
                <Th className="px-3 py-2.5">{s.t("col_party", "Supplier / Customer / Employee")}</Th>
                <Th className="px-3 py-2.5">{s.t("col_country", "Country / Branch")}</Th>
                <Th className="px-3 py-2.5">{s.t("col_date", "Date")}</Th>
                <Th className="px-3 py-2.5">{s.t("col_expiry", "Expiry")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("col_amount", "Amount")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("col_remaining", "Remaining")}</Th>
                <Th className="px-3 py-2.5">{s.t("col_status", "Status")}</Th>
                <Th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("empty", "No contracts match the current filters.")}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.source_module}:${r.source_id}`} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-500">{r.global_serial || "—"}</td>
                    <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.contract_no || r.booking_order_no || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{s.t(`type_${r.contract_type}`, r.contract_type)}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.party_name || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{[r.country_name, r.city_branch_name || r.main_branch_name].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.contract_date || "—"}</td>
                    <td className={`whitespace-nowrap px-3 py-2 ${r.expiry_date && new Date(r.expiry_date) < new Date() ? "font-bold text-rose-600" : "text-slate-500"}`}>{r.expiry_date || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">{r.original_currency} {fmt(r.original_amount)}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{fmt(r.remaining_balance)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.contract_status] || STATUS_TONE.Draft}`}>
                        {s.t(`status_${r.contract_status.replace(/\s+/g, "_").toLowerCase()}`, r.contract_status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected({ module: r.source_module, id: r.source_id })}
                        className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-slate-50 dark:border-slate-700"
                        title={s.t("open", "Open")}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400">{s.t("row_count", "{n} contracts").replace("{n}", String(total))}</p>
      </div>

      {selected ? (
        <ContractDrawer
          s={s}
          module={selected.module}
          id={selected.id}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); void load(); }}
        />
      ) : null}
    </section>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon?: any; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className={`h-3.5 w-3.5 ${tone || "text-slate-400"}`} /> : null}
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-50">{value}</div>
    </div>
  );
}

function ContractDrawer({
  s, module, id, onClose, onSaved,
}: {
  s: ReturnType<typeof useErpScreen>;
  module: string;
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextNote, setNextNote] = useState("");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    apiGet<{ contract: any }>(`/api/erp/hr/contracts/${module}/${id}`)
      .then((r) => { if (!cancel) setData(r.contract); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [module, id]);

  const save = async () => {
    setSaving(true);
    try {
      await apiPatch(`/api/erp/hr/contracts/${module}/${id}`, {
        followupNote: note || null,
        nextActionDate: nextDate || null,
        nextActionNote: nextNote || null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const c = data;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{s.t("drawer_title", "Contract Detail")}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
        ) : !c ? (
          <p className="py-10 text-center text-xs text-slate-400">{s.t("not_found", "Contract not found.")}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <Field s={s} k="col_contract_no" label="Contract No" v={c.contract_no || c.booking_order_no} />
              <Field s={s} k="col_manual_no" label="Manual Contract No" v={c.manual_contract_no} />
              <Field s={s} k="col_type" label="Type" v={s.t(`type_${c.contract_type}`, c.contract_type)} />
              <Field s={s} k="col_status" label="Status" v={c.contract_status} />
              <Field s={s} k="col_party" label="Party" v={c.party_name} />
              <Field s={s} k="col_country" label="Country" v={c.country_name} />
              <Field s={s} k="col_branch" label="Branch" v={c.city_branch_name || c.main_branch_name} />
              <Field s={s} k="col_created_by" label="Created By" v={c.created_by_name} />
              <Field s={s} k="col_date" label="Contract Date" v={c.contract_date} />
              <Field s={s} k="col_start" label="Start Date" v={c.start_date} />
              <Field s={s} k="col_expiry" label="Expiry Date" v={c.expiry_date} />
              <Field s={s} k="col_delivery" label="Expected Delivery" v={c.expected_delivery_date} />
              <Field s={s} k="col_currency" label="Original Currency" v={c.original_currency} />
              <Field s={s} k="col_amount" label="Original Amount" v={fmt(c.original_amount)} />
              <Field s={s} k="col_rate" label="Exchange Rate" v={c.exchange_rate} />
              <Field s={s} k="col_final_amount" label="Final Amount" v={fmt(c.final_amount)} />
              <Field s={s} k="col_advance" label="Advance" v={fmt(c.advance_amount)} />
              <Field s={s} k="col_paid" label="Paid" v={fmt(c.paid_amount)} />
              <Field s={s} k="col_remaining" label="Remaining Balance" v={fmt(c.remaining_balance)} />
              <Field s={s} k="col_payment_status" label="Payment Status" v={c.payment_status} />
              <Field s={s} k="col_loading_status" label="Loading / Receiving" v={c.loading_status} />
              <Field s={s} k="col_attachments" label="Attachments" v={String(c.attachment_count ?? 0)} />
            </dl>

            <div className="flex flex-wrap gap-2">
              <Link href={sourceHref(c)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                <ExternalLink className="h-3 w-3" /> {s.t("open_source", "Open Source Record")}
              </Link>
              <Link href={`/dashboard/kyc-reports`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                {s.t("view_kyc", "View KYC / QVC")}
              </Link>
              <Link href={`/dashboard/roznamcha/all`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                {s.t("view_journal", "Journal / Roznamcha / Ledger")}
              </Link>
              <Link href={`/dashboard/settlement`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                {s.t("view_settlement", "Settlement Status")}
              </Link>
            </div>

            {c.documents?.length ? (
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("attachments", "Attachments")}</p>
                <ul className="mt-1 space-y-1">
                  {c.documents.map((d: any) => (
                    <li key={d.id} className="text-[11px] text-slate-600 dark:text-slate-300">
                      <a href={d.file_url} target="_blank" rel="noreferrer" className="hover:text-blue-600">{d.title || d.file_name} {d.document_type ? `(${d.document_type})` : ""}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Contract Intelligence */}
            <ContractIntelligencePanel s={s} module={module} id={id} />

            {/* Follow-up */}
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("followup", "Follow-Up")}</p>
              {c.last_followup_at ? (
                <p className="mt-1 text-[11px] text-slate-500">{s.t("last_followup", "Last")}: {new Date(c.last_followup_at).toLocaleString()} — {c.last_followup_note}</p>
              ) : null}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={s.t("followup_ph", "Add a follow-up note…")}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                rows={2}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="text-[11px] text-slate-500">{s.t("next_action", "Next action")}</label>
                <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800" />
                <input value={nextNote} onChange={(e) => setNextNote(e.target.value)} placeholder={s.t("next_action_ph", "note")} className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {s.t("save_followup", "Save Follow-Up")}
              </button>
            </div>

            {/* Audit trail */}
            {c.audit?.length ? (
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("audit_trail", "Audit Trail")}</p>
                <ul className="mt-1 space-y-1">
                  {c.audit.map((a: any) => (
                    <li key={a.id} className="text-[10px] text-slate-500">
                      {new Date(a.created_at).toLocaleString()} — <span className="font-bold">{s.t(`audit_${a.action}`, a.action)}</span>{a.actor_name ? ` · ${a.actor_name}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

const RISK_TONE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  unknown: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

function RiskPill({ level, s }: { level: string | null | undefined; s: ReturnType<typeof useErpScreen> }) {
  const lvl = level || "unknown";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${RISK_TONE[lvl] || RISK_TONE.unknown}`}>
      {s.t(`intel_risk_${lvl}`, lvl)}
    </span>
  );
}

function ContractIntelligencePanel({ s, module, id }: { s: ReturnType<typeof useErpScreen>; module: string; id: string }) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ analysis: any }>(`/api/erp/hr/contracts/${module}/${id}/intelligence`);
      setAnalysis(res.analysis ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [module, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await apiPost<{ analysis: any }>(`/api/erp/hr/contracts/${module}/${id}/intelligence`, {});
      setAnalysis(res.analysis ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const status = analysis?.analysisStatus;
  const hasNoSource = analysis?.sourceKind === "none";

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
          <Sparkles className="h-3.5 w-3.5" /> {s.t("intel_title", "Contract Intelligence")}
        </p>
        {status === "completed" ? <RiskPill level={analysis.overallRiskLevel} s={s} /> : null}
      </div>

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></div>
      ) : hasNoSource ? (
        <p className="mt-2 text-[11px] text-slate-500">
          {s.t("intel_no_source", "No contract document is linked yet. Attach a document to this record, or link a matched Document Intake job, to enable Contract Intelligence.")}
        </p>
      ) : status === "error" ? (
        <p className="mt-2 text-[11px] font-semibold text-rose-600">{analysis?.errorMessage || s.t("intel_error", "Analysis failed.")}</p>
      ) : !analysis || status === "pending" ? (
        <p className="mt-2 text-[11px] text-slate-500">{s.t("intel_pending", "This contract has not been analyzed yet.")}</p>
      ) : (
        <div className="mt-2 space-y-3">
          {analysis.deterministicOnly ? (
            <p className="rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800/60">
              {s.t("intel_deterministic_only", "AI enrichment is not configured — showing deterministic (rule-based) analysis only.")}
            </p>
          ) : null}

          {(analysis.overallRiskLevel === "high" || (analysis.missingClauses?.length ?? 0) > 0 || (analysis.paymentWarnings?.length ?? 0) > 0) ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {s.t("intel_action_needed", "Action needed — this contract has risk factors that need review.")}
            </p>
          ) : null}

          {analysis.riskSummary ? <p className="text-[11px] text-slate-600 dark:text-slate-300">{analysis.riskSummary}</p> : null}

          {(analysis.clauses?.length ?? 0) > 0 ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_clauses", "Clauses Found")}</p>
              <ul className="mt-1 space-y-1">
                {analysis.clauses.map((c: any) => (
                  <li key={c.clauseKey} className="flex items-start gap-2 text-[11px]">
                    <RiskPill level={c.riskLevel} s={s} />
                    <span className="text-slate-600 dark:text-slate-300">
                      <span className="font-bold">{s.t(`clause_${c.clauseKey}_title`, c.clauseKey.replace(/_/g, " "))}</span>
                      {c.explanation ? ` — ${c.explanation}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(analysis.missingClauses?.length ?? 0) > 0 ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_missing_clauses", "Missing Clauses")}</p>
              <ul className="mt-1 space-y-1">
                {analysis.missingClauses.map((m: any) => (
                  <li key={m.clauseKey} className="flex items-start gap-2 text-[11px]">
                    <RiskPill level={m.severity} s={s} />
                    <span className="text-slate-600 dark:text-slate-300">{s.t(`clause_${m.clauseKey}_title`, m.clauseKey.replace(/_/g, " "))}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(analysis.obligations?.length ?? 0) > 0 ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_obligations", "Obligations")}</p>
              <ul className="mt-1 space-y-1">
                {analysis.obligations.map((o: any, i: number) => (
                  <li key={i} className="text-[11px] text-slate-600 dark:text-slate-300">
                    {o.description}{o.responsibleParty ? ` — ${o.responsibleParty}` : ""}{o.dueDate ? ` (${o.dueDate})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.renewal ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_renewal", "Renewal")}</p>
              <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <RiskPill level={analysis.renewal.riskLevel} s={s} /> {analysis.renewal.explanation}
              </p>
            </div>
          ) : null}

          {analysis.termination ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_termination", "Termination")}</p>
              <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <RiskPill level={analysis.termination.riskLevel} s={s} /> {analysis.termination.explanation}
              </p>
            </div>
          ) : null}

          {(analysis.paymentWarnings?.length ?? 0) > 0 ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_payment_warnings", "Payment Warnings")}</p>
              <ul className="mt-1 space-y-1">
                {analysis.paymentWarnings.map((w: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-[11px]">
                    <RiskPill level={w.severity} s={s} /> <span className="text-slate-600 dark:text-slate-300">{w.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(analysis.keyDates?.length ?? 0) > 0 ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_key_dates", "Key Dates")}</p>
              <ul className="mt-1 space-y-1">
                {analysis.keyDates.map((d: any, i: number) => (
                  <li key={i} className="text-[11px] text-slate-600 dark:text-slate-300">{d.label}: <span className="font-mono font-bold">{d.date}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-2 text-[11px] font-semibold text-rose-600">{error}</p> : null}

      {!hasNoSource ? (
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {status === "completed" ? s.t("intel_refresh", "Refresh Analysis") : s.t("intel_run", "Run Analysis")}
        </button>
      ) : null}
    </div>
  );
}

function Field({ s, k, label, v }: { s: ReturnType<typeof useErpScreen>; k: string; label: string; v: any }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t(k, label)}</dt>
      <dd className="font-semibold text-slate-700 dark:text-slate-200">{v === null || v === undefined || v === "" ? "—" : String(v)}</dd>
    </div>
  );
}
