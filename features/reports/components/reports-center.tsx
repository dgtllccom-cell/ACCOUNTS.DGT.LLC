"use client";

/**
 * Reports Center - the ONE canonical, role-aware register for the Business and the Shipping Line domain.
 *
 * Header: title, the active domain and the signed-in user's name, role, country, branch and access scope.
 * Filter bar: search, report type, country, main branch, city branch, user, dates, status, currency - every list comes from the server and holds
 * only what the login's own scope allows. KPI strip: record count and amounts GROUPED BY CURRENCY (never added across currencies).
 * Register: a compact full-width table with a View button on every row (the read-only document preview).
 * Everything is read from the original saved records; with nothing to show the screen says so - it never invents rows or totals.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Loader2, RefreshCw, RotateCcw, Search } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { translateCountry, translateValue } from "@/lib/i18n/table-values";
import type { CenterDomain, CenterRow, CenterTotal } from "@/lib/reports/center-totals";
import { ReportViewModal, type ViewTarget } from "@/features/reports/components/report-view-modal";

type Options = {
  countries: Array<{ id: string; name: string }>;
  mainBranches: Array<{ id: string; name: string; countryId: string }>;
  cityBranches: Array<{ id: string; name: string; countryId: string; mainBranchId: string | null }>;
  users: Array<{ id: string; name: string; code: string }>;
};
type Viewer = {
  id: string; name: string; roles: string[]; level: "global" | "country" | "main_branch" | "branch" | "own"; scopeLabel: string;
  domains: { business: boolean; shipping: boolean };
  assigned: { countries: string[]; mainBranches: string[]; cityBranches: string[] };
};
type Payload = {
  domain: CenterDomain; rows: CenterRow[]; total: number; page: number; pageSize: number;
  grand: Array<{ currency: string; count: number; amount: number; balance: number }>;
  totals: CenterTotal[]; countsByType: Record<string, number>; truncated: boolean; statuses: string[]; currencies: string[];
  types: Array<{ key: string; labelKey: string; fallback: string }>; options: Options | null; viewer: Viewer;
};

type Filters = { search: string; type: string; countryId: string; mainBranchId: string; branchId: string; userId: string; from: string; to: string; status: string; currency: string };
const EMPTY: Filters = { search: "", type: "", countryId: "", mainBranchId: "", branchId: "", userId: "", from: "", to: "", status: "", currency: "" };
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const humanRole = (r: string) => r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function ReportsCenter({ lang, initialDomain, titleKey = "title", titleFallback = "Reports Center" }: { lang: string; initialDomain?: CenterDomain; titleKey?: string; titleFallback?: string }) {
  const s = useErpScreen("rc", lang as never);
  const [domain, setDomain] = useState<CenterDomain | undefined>(initialDomain);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Payload | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qp = new URLSearchParams();
      if (domain) qp.set("domain", domain);
      const branchId = applied.branchId || applied.mainBranchId;
      const put = (k: string, v: string) => { if (v) qp.set(k, v); };
      put("search", applied.search); put("type", applied.type); put("countryId", applied.countryId); put("branchId", branchId); put("userId", applied.userId);
      put("from", applied.from); put("to", applied.to); put("status", applied.status); put("currency", applied.currency);
      qp.set("page", String(page)); qp.set("pageSize", "25");
      const r = await apiGet<Payload>(`/api/erp/reports/country?${qp.toString()}`);
      setData(r);
      if (r.options) setOptions(r.options);
      if (!domain) setDomain(r.domain);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [applied, domain, page]);

  useEffect(() => { void load(); }, [load]);

  const switchDomain = (d: CenterDomain) => { if (d === domain) return; setDomain(d); setDraft(EMPTY); setApplied(EMPTY); setOptions(null); setPage(1); };
  const apply = () => { setApplied(draft); setPage(1); };
  const reset = () => { setDraft(EMPTY); setApplied(EMPTY); setPage(1); };

  const dom: CenterDomain = domain ?? data?.domain ?? "business";
  const viewer = data?.viewer;
  const typeLabel = useMemo(() => {
    const m = new Map((data?.types ?? []).map((t) => [t.key, t]));
    return (k: string) => { const t = m.get(k); return t ? s.tGlobal(t.labelKey, t.fallback) : k; };
  }, [data?.types, s]);

  const branchesForPicker = useMemo(() => {
    const o = options;
    if (!o) return { main: [], city: [] };
    const main = o.mainBranches.filter((b) => !draft.countryId || b.countryId === draft.countryId);
    const city = o.cityBranches.filter((b) => (!draft.countryId || b.countryId === draft.countryId) && (!draft.mainBranchId || b.mainBranchId === draft.mainBranchId));
    return { main, city };
  }, [options, draft.countryId, draft.mainBranchId]);

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 25)));
  const shipping = dom === "shipping";
  const sel = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const lbl = "mb-0.5 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500";
  const th = "whitespace-nowrap border-b border-slate-200 bg-slate-100 px-1.5 py-2 text-start text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  const td = "whitespace-nowrap border-b border-slate-100 px-1.5 py-1.5 text-xs text-slate-800 dark:border-slate-800 dark:text-slate-100";
  const cols = shipping
    ? ["serial", "view", "date", "type", "entry", "reference", "party", "bl", "container", "truck", "shipment", "clearing", "country", "branch", "currency", "amount", "status"]
    : ["serial", "view", "date", "type", "entry", "reference", "party", "country", "branch", "user", "currency", "amount", "status"];
  const colLabel: Record<string, [string, string]> = {
    serial: ["col.serial", "#"], date: ["col.date", "Date"], type: ["col.type", "Report type"], entry: ["col.entry", "Entry / Bill No."], reference: ["col.reference", "Reference"], party: ["col.party", "Party"],
    bl: ["col.bl", "BL No."], container: ["col.container", "Container"], truck: ["col.truck", "Truck"], shipment: ["col.shipment", "Shipment"], clearing: ["col.clearing", "Clearing status"],
    country: ["col.country", "Country"], branch: ["col.branch", "Branch"], user: ["col.user", "User"], currency: ["col.currency", "Currency"], amount: ["col.amount", "Amount"], status: ["col.status", "Status"], view: ["col.view", "View"]
  };

  return (
    <div dir={s.dir} className="space-y-3" data-testid="reports-center">
      {/* header: title, active domain, who is signed in and what they may see */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900" data-testid="rc-header">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{s.t(titleKey, titleFallback)}</h1>
            <p className="text-xs text-slate-500">{s.t("subtitle", "Saved records for your role and scope. Nothing here can be edited.")}</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800" role="tablist" aria-label={s.t("hdr.domain", "Domain")}>
            {(["business", "shipping"] as const).filter((d) => !viewer || viewer.domains[d]).map((d) => (
              <button key={d} type="button" role="tab" aria-selected={dom === d} data-testid={`rc-domain-${d}`} onClick={() => switchDomain(d)}
                className={cn("rounded-md px-3 py-1.5 text-xs font-bold transition", dom === d ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700")}>
                {s.t(`domain.${d}`, d === "business" ? "Business" : "Shipping Line")}
              </button>
            ))}
          </div>
        </div>
        {viewer ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3 lg:grid-cols-5" data-testid="rc-identity">
            {[
              [s.t("hdr.user", "User"), viewer.name || "—"],
              [s.t("hdr.role", "Role"), viewer.roles.map((r) => translateValue(lang, humanRole(r))).join(", ") || "—"],
              [s.t("hdr.country", "Country"), viewer.assigned.countries.map((c) => translateCountry(c, lang)).join(", ") || (viewer.level === "global" ? s.t("hdr.all_countries", "All countries") : "—")],
              [s.t("hdr.branch", "Branch"), [...viewer.assigned.mainBranches, ...viewer.assigned.cityBranches].join(", ") || (viewer.level === "global" || viewer.level === "country" ? s.t("hdr.all_branches", "All branches") : "—")],
              [s.t("hdr.scope", "Access scope"), s.t(`scope.${viewer.level}`, humanRole(viewer.level))]
            ].map(([k, v]) => (
              <div key={String(k)} className="min-w-0"><dt className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{k}</dt><dd className="truncate font-semibold text-slate-800 dark:text-slate-100" title={String(v)}>{v}</dd></div>
            ))}
          </dl>
        ) : null}
      </section>

      {/* unified filter bar - every list is limited to the login's own scope */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900" data-testid="rc-filters">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          <label className="col-span-2 md:col-span-2"><span className={lbl}>{s.t("f.search", "Search")}</span>
            <span className="relative block"><Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input data-testid="rc-search" className={cn(sel, "ps-7")} value={draft.search} placeholder={s.t("f.search_ph", "Entry no, reference, party…")} onChange={(e) => setDraft({ ...draft, search: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") apply(); }} /></span></label>
          <label><span className={lbl}>{s.t("f.type", "Report type")}</span>
            <select data-testid="rc-type" className={sel} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <option value="">{s.t("f.all_types", "All report types")}</option>
              {(data?.types ?? []).map((t) => <option key={t.key} value={t.key}>{s.tGlobal(t.labelKey, t.fallback)}</option>)}
            </select></label>
          <label><span className={lbl}>{s.t("f.country", "Country")}</span>
            <select data-testid="rc-country" className={sel} value={draft.countryId} onChange={(e) => setDraft({ ...draft, countryId: e.target.value, mainBranchId: "", branchId: "" })}>
              <option value="">{s.t("f.all_countries", "All countries")}</option>
              {(options?.countries ?? []).map((c) => <option key={c.id} value={c.id}>{translateCountry(c.name, lang)}</option>)}
            </select></label>
          <label><span className={lbl}>{s.t("f.main_branch", "Main branch")}</span>
            <select data-testid="rc-main-branch" className={sel} value={draft.mainBranchId} onChange={(e) => setDraft({ ...draft, mainBranchId: e.target.value, branchId: "" })}>
              <option value="">{s.t("f.all_main", "All main branches")}</option>
              {branchesForPicker.main.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></label>
          <label><span className={lbl}>{s.t("f.city_branch", "City branch")}</span>
            <select data-testid="rc-city-branch" className={sel} value={draft.branchId} onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}>
              <option value="">{s.t("f.all_branches", "All city branches")}</option>
              {branchesForPicker.city.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></label>
          <label><span className={lbl}>{s.t("f.user", "User")}</span>
            <select data-testid="rc-user" className={sel} value={draft.userId} onChange={(e) => setDraft({ ...draft, userId: e.target.value })}>
              <option value="">{s.t("f.all_users", "All users")}</option>
              {(options?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}{u.code ? ` (${u.code})` : ""}</option>)}
            </select></label>
          <label><span className={lbl}>{s.t("f.from", "Date from")}</span><input data-testid="rc-from" type="date" dir="ltr" className={sel} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
          <label><span className={lbl}>{s.t("f.to", "Date to")}</span><input data-testid="rc-to" type="date" dir="ltr" className={sel} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
          <label><span className={lbl}>{s.t("f.status", "Status")}</span>
            <select data-testid="rc-status" className={sel} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              <option value="">{s.t("f.all_status", "All statuses")}</option>
              {(data?.statuses ?? []).map((v) => <option key={v} value={v}>{translateValue(lang, v)}</option>)}
            </select></label>
          <label><span className={lbl}>{s.t("f.currency", "Currency")}</span>
            <select data-testid="rc-currency" className={sel} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}>
              <option value="">{s.t("f.all_currency", "All currencies")}</option>
              {(data?.currencies ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
            </select></label>
          <div className="col-span-2 flex items-end gap-1.5 md:col-span-2">
            <button type="button" data-testid="rc-apply" onClick={apply} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700">{s.t("f.apply", "Apply")}</button>
            <button type="button" data-testid="rc-reset" onClick={reset} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RotateCcw className="h-3.5 w-3.5" aria-hidden />{s.t("f.reset", "Reset")}</button>
            <button type="button" data-testid="rc-refresh" onClick={() => void load()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />{s.t("f.refresh", "Refresh")}</button>
          </div>
        </div>
      </section>

      {/* KPI strip: counts and amounts per currency - never added across currencies */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="rc-kpis" aria-label={s.t("kpi.by_currency", "Totals by currency")}>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900" data-testid="rc-kpi-records">
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{s.t("kpi.records", "Records")}</div>
          <div className="text-lg font-black tabular-nums text-slate-900 dark:text-white">{(data?.total ?? 0).toLocaleString("en-US")}</div>
        </div>
        {(data?.grand ?? []).map((g) => (
          <div key={g.currency} className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 dark:border-blue-900/60 dark:bg-blue-950/25" data-testid={`rc-kpi-${g.currency}`}>
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wide text-blue-700 dark:text-blue-300"><span>{g.currency}</span><span className="tabular-nums">{g.count}</span></div>
            <div className="text-sm font-black tabular-nums text-blue-950 dark:text-blue-50" dir="ltr">{fmt(g.amount)}</div>
            {g.balance > 0 ? <div className="text-[10px] font-semibold tabular-nums text-rose-700 dark:text-rose-300" dir="ltr">{s.t("kpi.outstanding", "Outstanding")} {fmt(g.balance)}</div> : null}
          </div>
        ))}
        {(data?.grand ?? []).length === 0 && !loading ? <div className="col-span-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[11px] text-slate-500">{s.t("kpi.no_amount", "No amounts in this selection.")}</div> : null}
      </section>
      <p className="-mt-1 text-[10px] text-slate-500">{s.t("kpi.note", "Amounts are shown per currency and are never added across currencies.")}</p>

      {/* register */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {error ? <div className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800" data-testid="rc-error" role="alert">{error}</div> : null}
        {data?.truncated ? <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">{s.t("truncated", "Showing the newest records of each source - narrow the filters to see more.")}</div> : null}
        <div className="overflow-x-auto">
          <table data-no-cards className="w-full min-w-[980px] border-collapse" data-testid="rc-table">
            <thead><tr>{cols.map((c) => <th key={c} scope="col" className={cn(th, c === "amount" && "text-end")}>{s.t(colLabel[c][0], colLabel[c][1])}</th>)}</tr></thead>
            <tbody>
              {loading && !data ? <tr><td colSpan={cols.length} className={cn(td, "py-8 text-center text-slate-500")}><Loader2 className="me-2 inline h-4 w-4 animate-spin" aria-hidden />{s.t("loading", "Loading…")}</td></tr> : null}
              {!loading && data && data.rows.length === 0 ? (
                <tr><td colSpan={cols.length} className="px-3 py-10 text-center" data-testid="rc-empty">
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{s.t("empty.title", "No records to show")}</div>
                  <div className="mt-1 text-xs text-slate-500">{s.t("empty.hint", "No saved records match your filters and access scope.")}</div>
                </td></tr>
              ) : null}
              {(data?.rows ?? []).map((r, i) => (
                <tr key={r.key} data-testid="rc-row" className={cn(i % 2 ? "bg-slate-50/60 dark:bg-slate-900/60" : "bg-white dark:bg-slate-900", !r.counted && "opacity-60")}>
                  {cols.map((c) => {
                    switch (c) {
                      case "serial": return <td key={c} className={td}>{r.serial}</td>;
                      case "date": return <td key={c} className={td} dir="ltr">{r.date}</td>;
                      case "type": return <td key={c} className={td}><span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{typeLabel(r.type)}</span></td>;
                      case "entry": return <td key={c} className={cn(td, "font-bold")} dir="auto">{r.entryNo || "—"}</td>;
                      case "reference": return <td key={c} className={cn(td, "max-w-[100px] truncate")} title={r.referenceNo} dir="auto">{r.referenceNo || "—"}</td>;
                      case "party": return <td key={c} className={cn(td, "max-w-[130px] truncate")} title={r.party} dir="auto">{r.party || "—"}</td>;
                      case "bl": return <td key={c} className={td} dir="auto">{r.blNumber || "—"}</td>;
                      case "container": return <td key={c} className={td} dir="auto">{r.container || "—"}</td>;
                      case "truck": return <td key={c} className={td} dir="auto">{r.truck || "—"}</td>;
                      case "shipment": return <td key={c} className={cn(td, "max-w-[130px] truncate")} title={r.shipment}>{r.shipment || "—"}</td>;
                      case "clearing": return <td key={c} className={td}>{r.clearingStatus ? translateValue(lang, r.clearingStatus.replace(/_/g, " ")) : "—"}</td>;
                      case "country": return <td key={c} className={td}>{r.countryName ? translateCountry(r.countryName, lang) : "—"}</td>;
                      case "branch": return <td key={c} className={cn(td, "max-w-[100px] truncate")} title={r.branchName}>{r.branchName || "—"}</td>;
                      case "user": return <td key={c} className={cn(td, "max-w-[90px] truncate")} title={r.userName}>{r.userName || "—"}</td>;
                      case "currency": return <td key={c} className={td}>{r.currency || "—"}</td>;
                      case "amount": return <td key={c} className={cn(td, "text-end font-semibold tabular-nums")} dir="ltr">{r.amount == null ? "—" : fmt(r.amount)}</td>;
                      case "status": return <td key={c} className={td}><span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{r.status ? translateValue(lang, r.status) : "—"}</span></td>;
                      default: return (
                        <td key={c} className={td}>
                          <button type="button" data-testid="rc-view" onClick={() => setView({ table: r.source.table, id: r.source.id, entryNo: r.entryNo })} className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                            <Eye className="h-3.5 w-3.5" aria-hidden />{s.t("col.view", "View")}
                          </button>
                        </td>
                      );
                    }
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300" data-testid="rc-pagination">
          <span>{s.t("rows_total", "{n} records").replace("{n}", (data?.total ?? 0).toLocaleString("en-US"))}</span>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2.5 font-bold disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />{s.t("prev", "Previous")}</button>
            <span className="tabular-nums">{s.t("page_of", "Page {page} of {pages}").replace("{page}", String(page)).replace("{pages}", String(pages))}</span>
            <button type="button" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2.5 font-bold disabled:opacity-40 dark:border-slate-700">{s.t("next", "Next")}<ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden /></button>
          </div>
        </div>
      </section>

      {view ? <ReportViewModal target={view} lang={lang} onClose={() => setView(null)} /> : null}
    </div>
  );
}
