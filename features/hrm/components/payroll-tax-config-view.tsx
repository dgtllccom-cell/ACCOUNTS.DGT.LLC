"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, X, RefreshCw } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Row = Record<string, any>;
const INP = "w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700";
const NUM = (v: any) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(v) || 0);

const COMPONENTS = [
  "income_tax", "social_security_employee", "social_security_employer",
  "pension_employee", "pension_employer", "other_employee_deduction", "other_employer_contribution",
];

export function PayrollTaxConfigView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [tab, setTab] = useState<"config" | "report">("config");
  const [rows, setRows] = useState<Row[]>([]);
  const [report, setReport] = useState<Row[]>([]);
  const [countries, setCountries] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "config") {
        const r = await apiGet<{ rows: Row[] }>("/api/erp/hr/payroll-tax");
        setRows(r.rows ?? []);
      } else {
        const r = await apiGet<{ rows: Row[] }>(`/api/erp/hr/payroll-tax/report${period ? `?periodMonth=${period}` : ""}`);
        setReport(r.rows ?? []);
      }
      if (countries.length === 0) {
        try {
          const c = await apiGet<{ countries?: Row[]; rows?: Row[] }>("/api/erp/locations/countries?all=true&limit=100");
          setCountries(c.countries ?? c.rows ?? []);
        } catch { /* optional */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tab, period, countries.length]);

  useEffect(() => { void load(); }, [load]);

  const save = async (payload: Row) => {
    if (editing?.id) await apiPatch(`/api/erp/hr/payroll-tax/${editing.id}`, payload);
    else await apiPost("/api/erp/hr/payroll-tax", payload);
    setShowForm(false);
    setEditing(null);
    await load();
  };
  const remove = async (r: Row) => {
    if (!window.confirm(s.t("confirm_delete", "Delete this record?"))) return;
    try { await apiDelete(`/api/erp/hr/payroll-tax/${r.id}`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const printConfig = () => ({
    moduleType: "hr_payroll" as const,
    reportType: "register" as const,
    title: tab === "config" ? s.t("ptax_title", "Payroll Tax Configuration") : s.t("ptax_report", "Payroll Tax Report"),
    subtitle: s.t("ptax_subtitle", "Per-country payroll tax and statutory contributions — separate from VAT"),
    lang: s.lang,
    orientation: "landscape" as const,
    columns: tab === "config"
      ? [
          { key: "country_name", label: s.t("country", "Country") },
          { key: "name", label: s.t("name", "Name") },
          { key: "component_type", label: s.t("ptax_component", "Component") },
          { key: "payer", label: s.t("ptax_payer", "Payer") },
          { key: "calc_method", label: s.t("ptax_method", "Method") },
          { key: "rate_percent", label: s.t("ptax_rate", "Rate %"), align: "right" as const },
          { key: "currency", label: s.t("currency", "Ccy") },
          { key: "effective_from", label: s.t("ptax_from", "Effective From"), format: "date" as const },
        ]
      : [
          { key: "run_no", label: s.t("payroll_run_no", "Run No") },
          { key: "period_month", label: s.t("payroll_period", "Period") },
          { key: "country_name", label: s.t("country", "Country") },
          { key: "employees", label: s.t("payroll_emp_count", "Employees"), align: "right" as const },
          { key: "employee_tax", label: s.t("ptax_employee_tax", "Employee Tax"), align: "right" as const, format: "number" as const },
          { key: "employer_contributions", label: s.t("ptax_employer", "Employer Contributions"), align: "right" as const, format: "number" as const },
          { key: "total_statutory", label: s.t("ptax_total", "Total Statutory"), align: "right" as const, format: "number" as const },
        ],
    rows: tab === "config" ? rows : report,
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-5">
        <header className={s.textStart}>
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("ptax_title", "Payroll Tax Configuration")}</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            {s.t("ptax_blurb", "Per-country income tax, social security and pension rules that the payroll engine applies. Flat %, fixed amount or progressive slabs. Salary tax has its own payable ledgers and its own report — it never enters a VAT return.")}
          </p>
        </header>

        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {(["config", "report"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-t-lg px-3 py-2 text-xs font-bold ${tab === t ? "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              {s.t(`ptax_tab_${t}`, t)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UniversalPrintActionButton reportConfig={printConfig} />
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}
          </button>
          {tab === "config" ? (
            <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
              <Plus className="h-3.5 w-3.5" />{s.t("ptax_add", "Add Rule")}
            </button>
          ) : (
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
          )}
        </div>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {tab === "config" ? (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left">
                  <Th className="px-3 py-2.5">{s.t("country", "Country")}</Th>
                  <Th className="px-3 py-2.5">{s.t("name", "Name")}</Th>
                  <Th className="px-3 py-2.5">{s.t("ptax_component", "Component")}</Th>
                  <Th className="px-3 py-2.5">{s.t("ptax_payer", "Payer")}</Th>
                  <Th className="px-3 py-2.5">{s.t("ptax_method", "Method")}</Th>
                  <Th className="px-3 py-2.5 text-right">{s.t("ptax_rate", "Rate / Amount")}</Th>
                  <Th className="px-3 py-2.5">{s.t("ptax_from", "Effective From")}</Th>
                  <Th className="px-3 py-2.5">{s.t("active", "Active")}</Th>
                  <Th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("ptax_empty", "No payroll tax rules configured. The payroll engine falls back to the employee's fixed tax deduction.")}</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.country_name || "—"}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{r.name}</td>
                      <td className="px-3 py-2 text-slate-500">{s.t(`ptax_c_${r.component_type}`, r.component_type)}</td>
                      <td className="px-3 py-2 text-slate-500">{s.t(`ptax_payer_${r.payer}`, r.payer)}</td>
                      <td className="px-3 py-2 text-slate-500">{s.t(`ptax_m_${r.calc_method}`, r.calc_method)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {r.calc_method === "fixed_amount" ? `${NUM(r.fixed_amount)} ${r.currency}` : r.calc_method === "slab" ? s.t("ptax_slab_n", "{n} slabs").replace("{n}", String((r.slabs ?? []).length)) : `${NUM(r.rate_percent)}%`}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.effective_from?.slice?.(0, 10) || r.effective_from}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.is_active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{r.is_active ? s.t("yes", "Yes") : s.t("no", "No")}</span></td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => { setEditing(r); setShowForm(true); }} className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-slate-50 dark:border-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => void remove(r)} className="rounded-lg border border-slate-200 p-1 text-rose-500 hover:bg-rose-50 dark:border-slate-700"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left">
                  <Th className="px-3 py-2.5">{s.t("payroll_run_no", "Run No")}</Th>
                  <Th className="px-3 py-2.5">{s.t("payroll_period", "Period")}</Th>
                  <Th className="px-3 py-2.5">{s.t("country", "Country")}</Th>
                  <Th className="px-3 py-2.5 text-right">{s.t("payroll_emp_count", "Employees")}</Th>
                  <Th className="px-3 py-2.5 text-right">{s.t("ptax_employee_tax", "Employee Tax")}</Th>
                  <Th className="px-3 py-2.5 text-right">{s.t("ptax_employer", "Employer Contributions")}</Th>
                  <Th className="px-3 py-2.5 text-right">{s.t("ptax_total", "Total Statutory")}</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
                ) : report.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("ptax_report_empty", "No posted payroll runs for this period.")}</td></tr>
                ) : (
                  report.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.run_no}</td>
                      <td className="px-3 py-2 text-slate-500">{r.period_month}</td>
                      <td className="px-3 py-2 text-slate-500">{r.country_name || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.employees}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{NUM(r.employee_tax)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{NUM(r.employer_contributions)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-slate-100">{NUM(r.total_statutory)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm ? <TaxForm s={s} initial={editing} countries={countries} onClose={() => { setShowForm(false); setEditing(null); }} onSave={save} /> : null}
    </section>
  );
}

function TaxForm({
  s, initial, countries, onClose, onSave,
}: {
  s: ReturnType<typeof useErpScreen>;
  initial: Row | null;
  countries: Row[];
  onClose: () => void;
  onSave: (payload: Row) => Promise<void>;
}) {
  const [f, setF] = useState<Row>(() =>
    initial
      ? { ...initial, slabsText: JSON.stringify(initial.slabs ?? [], null, 0) }
      : { countryId: "", name: "", componentType: "income_tax", payer: "employee", calcMethod: "flat_percent", appliesTo: "gross", ratePercent: 0, fixedAmount: 0, currency: "USD", effectiveFrom: new Date().toISOString().slice(0, 10), isActive: true, slabsText: "[]" },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload: Row = {
        countryId: f.country_id ?? f.countryId,
        name: (f.name ?? "").trim(),
        componentType: f.component_type ?? f.componentType,
        payer: f.payer,
        calcMethod: f.calc_method ?? f.calcMethod,
        appliesTo: f.applies_to ?? f.appliesTo,
        ratePercent: Number(f.rate_percent ?? f.ratePercent) || 0,
        fixedAmount: Number(f.fixed_amount ?? f.fixedAmount) || 0,
        monthlyExemption: Number(f.monthly_exemption ?? f.monthlyExemption) || 0,
        currency: (f.currency ?? "USD").trim(),
        effectiveFrom: f.effective_from?.slice?.(0, 10) ?? f.effectiveFrom,
        isActive: f.is_active ?? f.isActive ?? true,
        sourceReference: f.source_reference ?? f.sourceReference ?? null,
        notes: f.notes ?? null,
      };
      if (payload.calcMethod === "slab") {
        try { payload.slabs = JSON.parse(f.slabsText || "[]"); }
        catch { throw new Error(s.t("ptax_slab_bad", "Slabs must be valid JSON, e.g. [{\"up_to\":50000,\"percent\":5}]")); }
      }
      await onSave(payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const method = f.calc_method ?? f.calcMethod;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{initial ? s.t("edit", "Edit") : s.t("ptax_add", "Add Rule")}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}
        <div className="mt-4 space-y-3">
          <L label={s.t("country", "Country")}>
            <select value={f.country_id ?? f.countryId ?? ""} onChange={(e) => set("countryId", e.target.value)} className={INP}>
              <option value="">{s.t("select_country", "Select country…")}</option>
              {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </L>
          <L label={s.t("name", "Name")}><input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} className={INP} /></L>
          <div className="grid grid-cols-2 gap-2">
            <L label={s.t("ptax_component", "Component")}>
              <select value={f.component_type ?? f.componentType} onChange={(e) => set("componentType", e.target.value)} className={INP}>
                {COMPONENTS.map((c) => <option key={c} value={c}>{s.t(`ptax_c_${c}`, c)}</option>)}
              </select>
            </L>
            <L label={s.t("ptax_payer", "Payer")}>
              <select value={f.payer} onChange={(e) => set("payer", e.target.value)} className={INP}>
                {["employee", "employer"].map((c) => <option key={c} value={c}>{s.t(`ptax_payer_${c}`, c)}</option>)}
              </select>
            </L>
            <L label={s.t("ptax_method", "Method")}>
              <select value={method} onChange={(e) => set("calcMethod", e.target.value)} className={INP}>
                {["flat_percent", "fixed_amount", "slab"].map((c) => <option key={c} value={c}>{s.t(`ptax_m_${c}`, c)}</option>)}
              </select>
            </L>
            <L label={s.t("ptax_applies", "Applies To")}>
              <select value={f.applies_to ?? f.appliesTo} onChange={(e) => set("appliesTo", e.target.value)} className={INP}>
                {["gross", "basic", "taxable"].map((c) => <option key={c} value={c}>{s.t(`ptax_a_${c}`, c)}</option>)}
              </select>
            </L>
          </div>
          {method === "flat_percent" ? (
            <L label={s.t("ptax_rate", "Rate %")}><input type="number" step="0.01" value={f.rate_percent ?? f.ratePercent ?? 0} onChange={(e) => set("ratePercent", e.target.value)} className={INP} /></L>
          ) : method === "fixed_amount" ? (
            <L label={s.t("ptax_fixed", "Fixed Amount")}><input type="number" step="0.01" value={f.fixed_amount ?? f.fixedAmount ?? 0} onChange={(e) => set("fixedAmount", e.target.value)} className={INP} /></L>
          ) : (
            <L label={s.t("ptax_slabs", "Slabs (JSON)")}>
              <textarea value={f.slabsText ?? "[]"} onChange={(e) => set("slabsText", e.target.value)} rows={4} className={`${INP} font-mono`} placeholder='[{"up_to":50000,"percent":0},{"up_to":100000,"percent":5}]' />
            </L>
          )}
          <div className="grid grid-cols-2 gap-2">
            <L label={s.t("ptax_exemption", "Monthly Exemption")}><input type="number" value={f.monthly_exemption ?? f.monthlyExemption ?? 0} onChange={(e) => set("monthlyExemption", e.target.value)} className={INP} /></L>
            <L label={s.t("currency", "Currency")}><input value={f.currency ?? "USD"} onChange={(e) => set("currency", e.target.value)} className={INP} /></L>
            <L label={s.t("ptax_from", "Effective From")}><input type="date" value={f.effective_from?.slice?.(0, 10) ?? f.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} className={INP} /></L>
          </div>
          <L label={s.t("ptax_source", "Source Reference")}><input value={f.source_reference ?? f.sourceReference ?? ""} onChange={(e) => set("sourceReference", e.target.value)} className={INP} /></L>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><input type="checkbox" checked={f.is_active ?? f.isActive ?? true} onChange={(e) => set("isActive", e.target.checked)} />{s.t("active", "Active")}</label>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => void submit()} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("save", "Save")}</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}
