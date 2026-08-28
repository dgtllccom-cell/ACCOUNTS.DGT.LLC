"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, X, RefreshCw } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Kind = "department" | "designation";

type Row = Record<string, any>;

const NUM = (v: any) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(v) || 0);

const INP = "w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700";

export function HrMastersManager({ kind, lang }: { kind: Kind; lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const isDept = kind === "department";
  const endpoint = isDept ? "/api/erp/hr/departments" : "/api/erp/hr/designations";

  const [rows, setRows] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await apiGet<{ rows: Row[] }>(`${endpoint}${qs}`);
      setRows(res.rows ?? []);
      if (!isDept) {
        const d = await apiGet<{ rows: Row[] }>("/api/erp/hr/departments");
        setDepartments(d.rows ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [endpoint, search, isDept]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (r: Row) => { setEditing(r); setShowForm(true); };

  const save = async (payload: Row) => {
    if (editing?.id) await apiPatch(`${endpoint}/${editing.id}`, payload);
    else await apiPost(endpoint, payload);
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const remove = async (r: Row) => {
    if (!window.confirm(s.t("confirm_delete", "Delete this record?"))) return;
    try {
      await apiDelete(`${endpoint}/${r.id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const title = isDept ? s.t("departments", "Departments") : s.t("designations", "Designations");

  const printConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title,
    subtitle: s.t("masters_subtitle", "HRM Master Data"),
    lang: s.lang,
    orientation: "portrait" as const,
    columns: isDept
      ? [
          { key: "code", label: s.t("code", "Code") },
          { key: "name", label: s.t("name", "Name") },
          { key: "country_name", label: s.t("country", "Country") },
          { key: "head_employee_code", label: s.t("head", "Head") },
          { key: "employee_count", label: s.t("employees", "Employees"), align: "right" as const },
          { key: "monthly_budget", label: s.t("budget", "Monthly Budget"), align: "right" as const, format: "number" as const },
          { key: "budget_currency", label: s.t("currency", "Currency") },
        ]
      : [
          { key: "code", label: s.t("code", "Code") },
          { key: "title", label: s.t("title_col", "Title") },
          { key: "department_name", label: s.t("department", "Department") },
          { key: "pay_grade", label: s.t("pay_grade", "Pay Grade") },
          { key: "min_basic_salary", label: s.t("min_salary", "Min Basic"), align: "right" as const, format: "number" as const },
          { key: "max_basic_salary", label: s.t("max_salary", "Max Basic"), align: "right" as const, format: "number" as const },
          { key: "salary_currency", label: s.t("currency", "Currency") },
          { key: "employee_count", label: s.t("employees", "Employees"), align: "right" as const },
        ],
    rows,
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {isDept
                ? s.t("dept_blurb", "Corporate departments, assigned heads, budgets and employee distribution. The employee free-text field keeps working; this master is additive.")
                : s.t("desig_blurb", "Designation grades, titles and base salary scales. Additive to the employee free-text designation.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UniversalPrintActionButton reportConfig={printConfig} />
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}
            </button>
            <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
              <Plus className="h-3.5 w-3.5" />{isDept ? s.t("add_department", "Add Department") : s.t("add_designation", "Add Designation")}
            </button>
          </div>
        </header>

        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-900 sm:max-w-xs">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={s.t("search", "Search…")} className="flex-1 bg-transparent py-2 text-xs outline-none" />
        </div>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <Th className="px-3 py-2.5">{s.t("code", "Code")}</Th>
                <Th className="px-3 py-2.5">{isDept ? s.t("name", "Name") : s.t("title_col", "Title")}</Th>
                <Th className="px-3 py-2.5">{isDept ? s.t("country", "Country") : s.t("department", "Department")}</Th>
                {isDept ? <Th className="px-3 py-2.5">{s.t("head", "Head")}</Th> : <Th className="px-3 py-2.5">{s.t("pay_grade", "Pay Grade")}</Th>}
                <Th className="px-3 py-2.5 text-right">{isDept ? s.t("budget", "Monthly Budget") : s.t("salary_range", "Basic Salary Range")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("employees", "Employees")}</Th>
                <Th className="px-3 py-2.5">{s.t("active", "Active")}</Th>
                <Th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("empty", "No records found.")}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-mono text-slate-500">{r.code}</td>
                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{isDept ? r.name : r.title}</td>
                    <td className="px-3 py-2 text-slate-500">{isDept ? (r.country_name || "—") : (r.department_name || "—")}</td>
                    <td className="px-3 py-2 text-slate-500">{isDept ? (r.head_employee_code || "—") : (r.pay_grade || "—")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {isDept
                        ? `${NUM(r.monthly_budget)} ${r.budget_currency || ""}`
                        : `${NUM(r.min_basic_salary)} – ${NUM(r.max_basic_salary)} ${r.salary_currency || ""}`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-slate-100">{r.employee_count ?? 0}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.is_active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                        {r.is_active ? s.t("yes", "Yes") : s.t("no", "No")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => openEdit(r)} className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-slate-50 dark:border-slate-700" title={s.t("edit", "Edit")}><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => void remove(r)} className="rounded-lg border border-slate-200 p-1 text-rose-500 hover:bg-rose-50 dark:border-slate-700" title={s.t("delete", "Delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm ? (
        <MasterForm
          s={s}
          isDept={isDept}
          initial={editing}
          departments={departments}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={save}
        />
      ) : null}
    </section>
  );
}

function MasterForm({
  s, isDept, initial, departments, onClose, onSave,
}: {
  s: ReturnType<typeof useErpScreen>;
  isDept: boolean;
  initial: Row | null;
  departments: Row[];
  onClose: () => void;
  onSave: (payload: Row) => Promise<void>;
}) {
  const [form, setForm] = useState<Row>(() =>
    initial
      ? { ...initial }
      : isDept
        ? { name: "", code: "", monthlyBudget: 0, budgetCurrency: "USD", isActive: true }
        : { title: "", code: "", minBasicSalary: 0, maxBasicSalary: 0, salaryCurrency: "USD", rankOrder: 0, isActive: true },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload: Row = isDept
        ? {
            code: form.code?.trim() || undefined,
            name: (form.name ?? "").trim(),
            countryId: form.country_id ?? form.countryId ?? null,
            monthlyBudget: Number(form.monthly_budget ?? form.monthlyBudget) || 0,
            budgetCurrency: (form.budget_currency ?? form.budgetCurrency ?? "USD").trim(),
            description: form.description?.trim() || null,
            isActive: form.is_active ?? form.isActive ?? true,
          }
        : {
            code: form.code?.trim() || undefined,
            title: (form.title ?? "").trim(),
            departmentId: form.department_id ?? form.departmentId ?? null,
            payGrade: form.pay_grade?.trim() || form.payGrade?.trim() || null,
            minBasicSalary: Number(form.min_basic_salary ?? form.minBasicSalary) || 0,
            maxBasicSalary: Number(form.max_basic_salary ?? form.maxBasicSalary) || 0,
            salaryCurrency: (form.salary_currency ?? form.salaryCurrency ?? "USD").trim(),
            rankOrder: Number(form.rank_order ?? form.rankOrder) || 0,
            description: form.description?.trim() || null,
            isActive: form.is_active ?? form.isActive ?? true,
          };
      await onSave(payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
            {initial ? s.t("edit", "Edit") : s.t("add", "Add")} — {isDept ? s.t("department", "Department") : s.t("designation", "Designation")}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}

        <div className="mt-4 space-y-3">
          <Field label={s.t("code", "Code")}>
            <input value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} placeholder={s.t("code_auto", "auto")} className={INP} />
          </Field>
          {isDept ? (
            <Field label={s.t("name", "Name")} required>
              <input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} className={INP} />
            </Field>
          ) : (
            <>
              <Field label={s.t("title_col", "Title")} required>
                <input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} className={INP} />
              </Field>
              <Field label={s.t("department", "Department")}>
                <select value={form.department_id ?? form.departmentId ?? ""} onChange={(e) => set("departmentId", e.target.value || null)} className={INP}>
                  <option value="">{s.t("none", "None")}</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label={s.t("pay_grade", "Pay Grade")}>
                <input value={form.pay_grade ?? form.payGrade ?? ""} onChange={(e) => set("payGrade", e.target.value)} className={INP} />
              </Field>
            </>
          )}

          {isDept ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label={s.t("budget", "Monthly Budget")}>
                <input type="number" value={form.monthly_budget ?? form.monthlyBudget ?? 0} onChange={(e) => set("monthlyBudget", e.target.value)} className={INP} />
              </Field>
              <Field label={s.t("currency", "Currency")}>
                <input value={form.budget_currency ?? form.budgetCurrency ?? "USD"} onChange={(e) => set("budgetCurrency", e.target.value)} className={INP} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Field label={s.t("min_salary", "Min Basic")}>
                <input type="number" value={form.min_basic_salary ?? form.minBasicSalary ?? 0} onChange={(e) => set("minBasicSalary", e.target.value)} className={INP} />
              </Field>
              <Field label={s.t("max_salary", "Max Basic")}>
                <input type="number" value={form.max_basic_salary ?? form.maxBasicSalary ?? 0} onChange={(e) => set("maxBasicSalary", e.target.value)} className={INP} />
              </Field>
              <Field label={s.t("currency", "Currency")}>
                <input value={form.salary_currency ?? form.salaryCurrency ?? "USD"} onChange={(e) => set("salaryCurrency", e.target.value)} className={INP} />
              </Field>
            </div>
          )}

          <Field label={s.t("description", "Description / Notes")}>
            <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} className={INP} />
          </Field>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={form.is_active ?? form.isActive ?? true} onChange={(e) => set("isActive", e.target.checked)} />
            {s.t("active", "Active")}
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => void submit()} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("save", "Save")}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}{required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}
