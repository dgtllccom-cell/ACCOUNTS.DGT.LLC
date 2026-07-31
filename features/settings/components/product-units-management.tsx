"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Loader2, X } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { ReportActions } from "@/components/ui/report-actions";

type Unit = {
  id: string;
  unitCode: string;
  unitName: string;
  baseUnitCode: string | null;
  conversionFactor: number;
  isActive: boolean;
};

const empty = { id: "", unitCode: "", unitName: "", baseUnitCode: "", conversionFactor: "1", isActive: true };

export function ProductUnitsManagementView({ lang }: { lang: SupportedLanguage }) {
  const dir = getLanguageDirection(lang);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<typeof empty>(empty);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/master-data/units");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setUnits(json.units || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) => (u.unitName || "").toLowerCase().includes(q) || (u.unitCode || "").toLowerCase().includes(q));
  }, [units, query]);

  function startAdd() { setForm(empty); setEditing(true); }
  function startEdit(u: Unit) {
    setForm({ id: u.id, unitCode: u.unitCode, unitName: u.unitName, baseUnitCode: u.baseUnitCode ?? "", conversionFactor: String(u.conversionFactor ?? 1), isActive: u.isActive });
    setEditing(true);
  }

  async function save() {
    if (!form.unitCode.trim() || !form.unitName.trim()) { setError("Unit Code and Unit Name are required"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        unitCode: form.unitCode.trim().toUpperCase(),
        unitName: form.unitName.trim(),
        baseUnitCode: form.baseUnitCode.trim() || null,
        conversionFactor: Number(form.conversionFactor) || 1,
        isActive: form.isActive,
      };
      const res = form.id
        ? await fetch(`/api/erp/master-data/units/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/erp/master-data/units", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setEditing(false);
      setForm(empty);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t(lang, "pu.delete") + "?")) return;
    try {
      const res = await fetch(`/api/erp/master-data/units/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      await load();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div dir={dir} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{t(lang, "pu.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ReportActions title={t(lang, "pu.title")} rows={filtered} columns={[{ key: "unitCode", label: t(lang, "pu.code") }, { key: "unitName", label: t(lang, "pu.name") }, { key: "baseUnitCode", label: t(lang, "pu.base") }, { key: "conversionFactor", label: t(lang, "pu.factor") }]} />
          <button onClick={startAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
            <Plus className="h-4 w-4" /> {t(lang, "pu.add")}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(lang, "pu.search")}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm dark:border-slate-800 dark:bg-slate-950" />
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-start text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950/60">
            <tr>
              <th className="px-4 py-3 text-start">{t(lang, "pu.code")}</th>
              <th className="px-4 py-3 text-start">{t(lang, "pu.name")}</th>
              <th className="px-4 py-3 text-start">{t(lang, "pu.base")}</th>
              <th className="px-4 py-3 text-start">{t(lang, "pu.factor")}</th>
              <th className="px-4 py-3 text-start">{t(lang, "pu.active")}</th>
              <th className="px-4 py-3 text-end"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{t(lang, "pu.empty")}</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-bold">{u.unitCode}</td>
                <td className="px-4 py-3">{u.unitName}</td>
                <td className="px-4 py-3">{u.baseUnitCode || "-"}</td>
                <td className="px-4 py-3">{u.conversionFactor}</td>
                <td className="px-4 py-3">
                  <span className={u.isActive ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800"}>
                    {u.isActive ? "●" : "○"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(u)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" title={t(lang, "pu.edit")}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(u.id)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title={t(lang, "pu.delete")}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(false)}>
          <div dir={dir} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">{form.id ? t(lang, "pu.edit") : t(lang, "pu.add")}</h2>
              <button onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "pu.code")}</span>
                <input value={form.unitCode} onChange={(e) => setForm({ ...form, unitCode: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase dark:border-slate-800 dark:bg-slate-950" />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "pu.name")}</span>
                <input value={form.unitName} onChange={(e) => setForm({ ...form, unitName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "pu.base")}</span>
                  <input value={form.baseUnitCode} onChange={(e) => setForm({ ...form, baseUnitCode: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase dark:border-slate-800 dark:bg-slate-950" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "pu.factor")}</span>
                  <input type="number" step="any" value={form.conversionFactor} onChange={(e) => setForm({ ...form, conversionFactor: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded" />
                {t(lang, "pu.active")}
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t(lang, "pu.cancel")}</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t(lang, "pu.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
