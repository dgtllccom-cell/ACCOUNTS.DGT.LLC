"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Printer } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { DateRange } from "./employee-date-toolbar";
import { openMasterProfileReportWindow } from "@/lib/reports/open-master-profile-report-window";

type FieldType = "text" | "date" | "time" | "number" | "select" | "employee";
export type OfficeField = {
  key: string;               // payload key (camelCase)
  labelKey: string;          // central i18n key
  labelFallback: string;
  type: FieldType;
  options?: { value: string; labelKey: string; labelFallback: string }[];
  required?: boolean;
  inTable?: boolean;         // show as a table column
  render?: (row: any) => string; // custom table cell
};

export type OfficeModuleConfig = {
  module: "attendance" | "leave" | "assets";
  endpoint: string;          // /api/erp/general-office/xxx
  listKey: string;           // response key
  titleKey: string; titleFallback: string;
  descKey: string; descFallback: string;
  addKey: string; addFallback: string;
  fields: OfficeField[];
  statusOptions?: { value: string; labelKey: string; labelFallback: string }[];
};

type EmployeeOpt = { id: string; employee_code?: string; name: string; country_id?: string | null; city_branch_id?: string | null };

export function OfficeHrModule({ config, lang, dateRange, employees, canWrite }: {
  config: OfficeModuleConfig;
  lang: SupportedLanguage;
  dateRange: DateRange;
  employees: EmployeeOpt[];
  canWrite: boolean;
}) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (k: string, f: string) => t(lang, k as never, f);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qp = new URLSearchParams();
      if (dateRange.mode !== "all") { if (dateRange.from) qp.set("from", dateRange.from); if (dateRange.to) qp.set("to", dateRange.to); }
      const res = await apiGet<any>(`${config.endpoint}?${qp.toString()}`);
      setRows(res[config.listKey] ?? []);
    } catch (e: any) { setError(e?.message || "Failed to load"); }
    finally { setLoading(false); }
  }, [config.endpoint, config.listKey, dateRange]);

  useEffect(() => { void load(); }, [load]);

  const setF = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    setSaving(true); setError(null);
    try {
      // attach the selected employee's scope where available
      const emp = employees.find((e) => e.id === form.employeeId || e.id === form.assignedEmployeeId);
      const payload: Record<string, any> = { ...form };
      if (emp) { payload.countryId = emp.country_id ?? null; payload.cityBranchId = emp.city_branch_id ?? null; }
      // numeric coercion
      config.fields.forEach((f) => { if (f.type === "number" && payload[f.key] != null && payload[f.key] !== "") payload[f.key] = Number(payload[f.key]); });
      await apiPost(config.endpoint, payload);
      setShowAdd(false); setForm({});
      await load();
    } catch (e: any) { setError(e?.message || "Save failed"); }
    finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: string) {
    try { await apiPatch(`${config.endpoint}/${id}`, { status }); await load(); }
    catch (e: any) { setError(e?.message || "Update failed"); }
  }
  async function remove(id: string) {
    try { await apiDelete(`${config.endpoint}/${id}`); await load(); }
    catch (e: any) { setError(e?.message || "Delete failed"); }
  }

  function printList() {
    openMasterProfileReportWindow({
      lang,
      title: tt(config.titleKey, config.titleFallback),
      subtitle: dateRange.mode === "all" ? tt("god.all_dates", "All Dates") : `${dateRange.from || "…"} → ${dateRange.to || "…"}`,
      meta: [{ label: tt("report.records_found", "Records"), value: String(rows.length) }],
      sections: [{
        title: tt(config.titleKey, config.titleFallback),
        rows: rows.slice(0, 60).map((r, i) => ({
          label: `${i + 1}. ${r.employee_name || r.assigned_name || r.asset_name || "-"}`,
          value: config.fields.filter((f) => f.inTable).map((f) => (f.render ? f.render(r) : r[colName(f.key)])).filter(Boolean).join(" · ")
        }))
      }]
    });
  }

  const tableFields = config.fields.filter((f) => f.inTable);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-bold">{tt(config.titleKey, config.titleFallback)}</h2>
          <p className="text-xs text-muted-foreground">{tt(config.descKey, config.descFallback)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={printList} disabled={rows.length === 0} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
            <Printer className="h-3.5 w-3.5" /> {tt("bankroz.print_pdf", "Print / PDF")}
          </button>
          {canWrite && (
            <button type="button" onClick={() => { setForm({}); setShowAdd(true); }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">
              <Plus className="h-3.5 w-3.5" /> {tt(config.addKey, config.addFallback)}
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-muted font-bold border-b">
            <tr>
              <th className="px-3 py-2.5 text-start">{tt("rozrep.sno", "Sr")}</th>
              <th className="px-3 py-2.5 text-start">{tt("sae.entry_name", "Employee")}</th>
              {tableFields.map((f) => <th key={f.key} className="px-3 py-2.5 text-start">{tt(f.labelKey, f.labelFallback)}</th>)}
              {canWrite && <th className="px-3 py-2.5 text-end">{tt("form.actions", "Actions")}</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={tableFields.length + 3} className="px-3 py-8 text-center text-muted-foreground">{tt("sae.loading", "Loading...")}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={tableFields.length + 3} className="px-3 py-8 text-center text-muted-foreground">{tt("report.builder_no_records", "No records found")}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id}>
                <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2.5 font-semibold">{r.employee_name || r.assigned_name || "-"}<div className="text-[10px] font-mono text-muted-foreground">{r.employee_code || r.assigned_code || ""}</div></td>
                {tableFields.map((f) => (
                  <td key={f.key} className="px-3 py-2.5">
                    {f.key === "status"
                      ? <span className={statusClass(String(r.status))}>{translateVal(tt, config, r.status)}</span>
                      : (f.render ? f.render(r) : (r[colName(f.key)] ?? "-"))}
                  </td>
                ))}
                {canWrite && (
                  <td className="px-3 py-2.5 text-end">
                    <div className="inline-flex items-center gap-1">
                      {config.statusOptions && (
                        <select value={r.status || ""} onChange={(e) => updateStatus(r.id, e.target.value)} className="h-7 rounded border border-slate-200 bg-background px-1 text-[11px] dark:border-slate-700">
                          {config.statusOptions.map((o) => <option key={o.value} value={o.value}>{tt(o.labelKey, o.labelFallback)}</option>)}
                        </select>
                      )}
                      <button type="button" onClick={() => remove(r.id)} className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" aria-label={tt("common.delete", "Delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowAdd(false)} />
          <div className={`fixed top-0 z-50 h-full w-full max-w-md overflow-auto bg-white p-5 shadow-2xl dark:bg-slate-900 ${isRtl ? "left-0" : "right-0"}`} dir={isRtl ? "rtl" : "ltr"}>
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black">{tt(config.addKey, config.addFallback)}</h3>
              <button type="button" onClick={() => setShowAdd(false)} className="rounded bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">✕</button>
            </div>
            <div className="space-y-3">
              {config.fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">{tt(f.labelKey, f.labelFallback)}{f.required ? " *" : ""}</label>
                  {f.type === "employee" ? (
                    <select value={form[f.key] || ""} onChange={(e) => setF(f.key, e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-background px-2 text-xs dark:border-slate-700">
                      <option value="">{tt("hr.f_select_person", "Select employee")}</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.name}{e.employee_code ? ` (${e.employee_code})` : ""}</option>)}
                    </select>
                  ) : f.type === "select" ? (
                    <select value={form[f.key] || (f.options?.[0]?.value ?? "")} onChange={(e) => setF(f.key, e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-background px-2 text-xs dark:border-slate-700">
                      {(f.options || []).map((o) => <option key={o.value} value={o.value}>{tt(o.labelKey, o.labelFallback)}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} value={form[f.key] ?? ""} onChange={(e) => setF(f.key, e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-background px-3 text-xs dark:border-slate-700" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={submit} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? tt("common.saving", "Saving...") : tt("common.save", "Save")}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{tt("common.cancel", "Cancel")}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function colName(key: string): string {
  // camelCase payload key -> snake_case db column returned by the API
  return key.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}
function statusClass(s: string) {
  const v = s.toLowerCase();
  const base = "rounded-full px-2 py-0.5 text-[10px] font-bold ";
  if (/present|approved|active|in use|available/.test(v)) return base + "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (/pending|late|half|repair/.test(v)) return base + "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  if (/absent|rejected|retired/.test(v)) return base + "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  return base + "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}
function translateVal(tt: (k: string, f: string) => string, config: OfficeModuleConfig, val: string) {
  const opt = config.statusOptions?.find((o) => o.value === val);
  return opt ? tt(opt.labelKey, opt.labelFallback) : (val || "-");
}
