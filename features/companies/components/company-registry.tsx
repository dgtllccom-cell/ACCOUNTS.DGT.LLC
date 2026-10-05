"use client";

/**
 * Company Registry — every legal company in the ONE `companies` master (customer companies and
 * our internal / branch companies), scoped to the caller. Real data only: a missing value shows
 * "—". Row actions open Company 360, edit, add a sister company, print, hand over a task, delete.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { AlertTriangle, Building2, Eye, Loader2, MoreVertical, PencilLine, Plus, Search, Send, Trash2, Users } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { pl } from "@/lib/reports/print-label";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { TaskHandoverModal } from "@/features/transfer-center/components/task-handover-modal";
import { COMPANY_STATUS_OPTIONS, COMPANY_TYPES, STATUS_TONE, optionLabel } from "@/features/companies/company-labels";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";

type Row = {
  id: string;
  company_code: string | null;
  name: string;
  legal_name: string | null;
  trade_name: string | null;
  owner_name: string | null;
  owner_person_id: string | null;
  effective_company_type: "customer" | "internal" | null;
  registration_number: string | null;
  tax_number: string | null;
  country_id: string | null;
  country_name: string | null;
  license_expiry_date: string | null;
  company_status: string | null;
};

const PAGE = 15;
const daysTo = (d: string | null) => (d ? Math.round((new Date(d.slice(0, 10) + "T00:00:00Z").getTime() - Date.now()) / 86_400_000) : null);

export function CompanyRegistry({
  onRegisterNew,
  onEditCompany,
  onOpen360,
}: {
  onRegisterNew?: (ownerPersonId?: string) => void;
  onEditCompany?: (companyId: string) => void;
  onOpen360?: (companyId: string) => void;
} = {}) {
  const router = useRouter();
  const s = useErpScreen("creg");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiGet<any>(`/api/erp/companies?lang=${encodeURIComponent(s.lang)}`);
      setRows((r?.companies ?? []) as Row[]);
    } catch (e: any) {
      setError(e?.message || s.t("load_failed", "Companies could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [s]);

  useEffect(() => {
    void load();
  }, [load]);

  const open360 = (id: string) => (onOpen360 ? onOpen360(id) : router.push(`/dashboard/settings/company-setup?view=360&companyId=${id}` as Route));
  const edit = (id: string) => (onEditCompany ? onEditCompany(id) : router.push(`/dashboard/settings/company-setup?companyId=${id}` as Route));
  const addSister = (ownerId?: string) => (onRegisterNew ? onRegisterNew(ownerId) : router.push(`/dashboard/settings/company-setup?action=new` as Route));

  async function remove(r: Row) {
    if (!window.confirm(`${s.t("confirm_delete", "Delete this company record?")}\n${r.legal_name || r.name}`)) return;
    const res = await fetch(`/api/erp/companies/${encodeURIComponent(r.id)}`, { method: "DELETE", credentials: "include" });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      window.alert(body?.error?.message || s.t("delete_failed", "The company could not be deleted."));
      return;
    }
    await load();
  }

  const countries = useMemo(() => [...new Set(rows.map((r) => r.country_name).filter(Boolean) as string[])].sort(), [rows]);
  const status = (r: Row) => r.company_status || "active";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && (r.effective_company_type ?? "unclassified") !== typeFilter) return false;
      if (statusFilter !== "all") {
        const dd = daysTo(r.license_expiry_date);
        if (statusFilter === "expiring") {
          if (dd === null || dd < 0 || dd > 30) return false;
        } else if (status(r) !== statusFilter) return false;
      }
      if (countryFilter !== "all" && r.country_name !== countryFilter) return false;
      if (!term) return true;
      return [r.name, r.legal_name, r.trade_name, r.owner_name, r.company_code, r.registration_number, r.tax_number, r.country_name]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(term));
    });
  }, [rows, q, typeFilter, statusFilter, countryFilter]);

  useEffect(() => setPage(1), [q, typeFilter, statusFilter, countryFilter]);
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const kpi = useMemo(() => {
    const expiring = rows.filter((r) => {
      const dd = daysTo(r.license_expiry_date);
      return dd !== null && dd >= 0 && dd <= 30;
    }).length;
    const expired = rows.filter((r) => {
      const dd = daysTo(r.license_expiry_date);
      return status(r) === "expired" || (dd !== null && dd < 0);
    }).length;
    return {
      total: rows.length,
      customer: rows.filter((r) => r.effective_company_type === "customer").length,
      internal: rows.filter((r) => r.effective_company_type === "internal").length,
      expiring,
      expired,
    };
  }, [rows]);

  const typeLabel = (r: Row) => (r.effective_company_type ? optionLabel(COMPANY_TYPES, r.effective_company_type, s.lang) : s.t("unclassified", "Unclassified"));
  const printRows = filtered.map((r, i) => ({
    sr: i + 1,
    code: r.company_code || "—",
    company: r.legal_name || r.name,
    type: typeLabel(r),
    owner: r.owner_name || "—",
    registration: r.registration_number || "—",
    trn: r.tax_number || "—",
    country: r.country_name || "—",
    expiry: r.license_expiry_date ? r.license_expiry_date.slice(0, 10) : "—",
    status: optionLabel(COMPANY_STATUS_OPTIONS, status(r), s.lang),
  }));

  const select = "h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900";

  return (
    <div dir={s.dir} className="space-y-4 font-sans text-slate-900 dark:text-slate-100">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { k: "total", label: s.t("kpi_total_companies", "Total Companies"), val: kpi.total, icon: Building2, tone: "text-blue-600" },
          { k: "customer", label: s.t("kpi_customer", "Customer Companies"), val: kpi.customer, icon: Users, tone: "text-indigo-600" },
          { k: "internal", label: s.t("kpi_internal", "Internal / Branch Companies"), val: kpi.internal, icon: Building2, tone: "text-teal-600" },
          { k: "expiring", label: s.t("kpi_expiring", "Licenses expiring ≤ 30 days"), val: kpi.expiring, icon: AlertTriangle, tone: "text-amber-600" },
          { k: "expired", label: s.t("kpi_expired", "Expired"), val: kpi.expired, icon: AlertTriangle, tone: "text-rose-600" },
        ].map((c) => (
          <div key={c.k} data-testid={`kpi-${c.k}`} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-500">{c.label}</span>
              <c.icon className={cn("h-4 w-4", c.tone)} />
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums">{c.val}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="registry-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={s.t("search_ph", "Search name, code, registration no., TRN, owner…")}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white ps-8 pe-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <select data-testid="filter-type" className={select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">{s.t("all_types", "All Types")}</option>
          {COMPANY_TYPES.map((o) => (
            <option key={o.value} value={o.value}>{s.tGlobal(o.key, o.en)}</option>
          ))}
          <option value="unclassified">{s.t("unclassified", "Unclassified")}</option>
        </select>
        <select data-testid="filter-status" className={select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{s.t("all_status", "All Status")}</option>
          {COMPANY_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{s.tGlobal(o.key, o.en)}</option>
          ))}
          <option value="expiring">{s.t("expiring_30", "Expiring within 30 days")}</option>
        </select>
        <select className={select} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option value="all">{s.t("all_countries", "All Countries")}</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <JournalPrintButton
          title={s.t("title", "Company Management Registry")}
          columns={[
            { key: "sr", label: "#", align: "center" },
            { key: "code", label: pl("Company Code") },
            { key: "company", label: pl("Company") },
            { key: "type", label: pl("Company Type") },
            { key: "owner", label: pl("Owner") },
            { key: "registration", label: pl("Registration No.") },
            { key: "trn", label: pl("TRN") },
            { key: "country", label: pl("Country") },
            { key: "expiry", label: pl("License Expiry") },
            { key: "status", label: pl("Status") },
          ]}
          rows={printRows}
          filters={[
            ...(q.trim() ? [{ label: s.tGlobal("common.search", "Search"), value: q.trim() }] : []),
            ...(typeFilter !== "all" ? [{ label: pl("Company Type"), value: typeFilter === "unclassified" ? s.t("unclassified", "Unclassified") : optionLabel(COMPANY_TYPES, typeFilter, s.lang) }] : []),
            ...(countryFilter !== "all" ? [{ label: pl("Country"), value: countryFilter }] : []),
          ]}
          orientation="landscape"
        />
        <button type="button" data-testid="registry-new" onClick={() => addSister()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> {s.t("new_company", "New Company")}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table data-testid="company-registry-table" className="w-full min-w-[980px] text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
            <tr>
              {[
                s.t("col_code", "Code"),
                s.t("col_company", "Company"),
                s.t("company_type", "Company Type"),
                s.t("col_owner", "Owner"),
                s.t("col_registration", "Registration No."),
                s.t("col_trn", "TRN"),
                s.t("col_country", "Country"),
                s.t("col_expiry", "License Expiry"),
                s.t("col_status", "Status"),
                s.t("tip_actions", "Actions"),
              ].map((h) => (
                <Th key={h} className={cn("px-3 py-2.5 font-semibold", s.textStart)}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  <Loader2 className="me-2 inline h-4 w-4 animate-spin" /> {s.t("loading", "Loading company registry...")}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-rose-600">{error}</td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">{s.t("no_results", "No company accounts found matching your filters.")}</td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const dd = daysTo(r.license_expiry_date);
                return (
                  <tr key={r.id} data-testid="company-row" className="border-t border-slate-100 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono font-semibold">{r.company_code || "—"}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => open360(r.id)} className="text-start font-semibold text-blue-700 hover:underline dark:text-blue-300">
                        {r.legal_name || r.name}
                      </button>
                      {r.trade_name && r.trade_name !== (r.legal_name || r.name) && <div className="text-[11px] text-slate-500">{r.trade_name}</div>}
                    </td>
                    <td className="px-3 py-2">{typeLabel(r)}</td>
                    <td className="px-3 py-2">{r.owner_name || "—"}</td>
                    <td className="px-3 py-2 font-mono">{r.registration_number || "—"}</td>
                    <td className="px-3 py-2 font-mono">{r.tax_number || "—"}</td>
                    <td className="px-3 py-2">{r.country_name || "—"}</td>
                    <td className="px-3 py-2">
                      {r.license_expiry_date ? (
                        <span className={cn(dd !== null && dd < 0 ? "font-bold text-rose-600" : dd !== null && dd <= 30 ? "font-bold text-amber-600" : "")}>
                          {r.license_expiry_date.slice(0, 10)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded px-1.5 py-0.5 font-semibold ring-1 ring-inset", STATUS_TONE[status(r)] ?? STATUS_TONE.active)}>
                        {optionLabel(COMPANY_STATUS_OPTIONS, status(r), s.lang)}
                      </span>
                    </td>
                    <td className="relative px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button type="button" data-testid="row-360" title={s.t("open_360", "Company 360")} onClick={() => open360(r.id)} className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                          <Eye className="h-3.5 w-3.5 text-blue-600" />
                        </button>
                        <button type="button" data-testid="row-edit" title={s.t("edit", "Edit")} onClick={() => edit(r.id)} className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" title={s.t("tip_actions", "Actions")} onClick={() => setMenuId(menuId === r.id ? null : r.id)} className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {menuId === r.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)} />
                          <div className="absolute end-3 top-10 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            {r.effective_company_type === "customer" && r.owner_person_id && (
                              <button type="button" onClick={() => { setMenuId(null); addSister(r.owner_person_id ?? undefined); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40">
                                <Plus className="h-4 w-4" /> {s.t("add_sister", "Add Sister Company")}
                              </button>
                            )}
                            <button type="button" onClick={() => { setMenuId(null); setHandoff(r); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
                              <Send className="h-4 w-4 text-indigo-600" /> {s.tGlobal("tc.handover_task", "Handover / Delegate Task to User")}
                            </button>
                            <button type="button" data-testid="row-delete" onClick={() => { setMenuId(null); void remove(r); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                              <Trash2 className="h-4 w-4" /> {s.t("delete", "Delete")}
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {s.t("showing", "Showing")} {filtered.length ? (page - 1) * PAGE + 1 : 0} {s.t("to", "to")} {Math.min(page * PAGE, filtered.length)} {s.t("of", "of")} {filtered.length} {s.t("entries", "entries")}
        </span>
        <div className="flex gap-1">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 px-2.5 py-1 disabled:opacity-40 dark:border-slate-700">‹</button>
          <span className="px-2 py-1 tabular-nums">{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 px-2.5 py-1 disabled:opacity-40 dark:border-slate-700">›</button>
        </div>
      </div>

      {handoff && (
        <TaskHandoverModal
          open={Boolean(handoff)}
          onClose={() => setHandoff(null)}
          orderReference={handoff.legal_name || handoff.name}
          sourceTable="companies"
          sourceId={handoff.id}
          targetUrl={`/dashboard/settings/company-setup?view=360&companyId=${handoff.id}`}
          defaultTask={s.tGlobal("tc.please_complete_work", "Please review and complete assigned work.")}
          sourceCountryId={handoff.country_id}
          sourceCountryBranchId={null}
          sourceCityBranchId={null}
          domain="business"
          customerPartyName={handoff.legal_name || handoff.name}
          onSuccess={() => setHandoff(null)}
          lang={s.lang}
        />
      )}
    </div>
  );
}
