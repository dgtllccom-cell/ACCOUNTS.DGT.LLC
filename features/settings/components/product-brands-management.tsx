"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Loader2, X } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { ReportActions } from "@/components/ui/report-actions";

type Brand = {
  id: string;
  countryId: string | null;
  brandCode: string | null;
  brandName: string;
  description: string | null;
  isActive: boolean;
};

const empty = { id: "", brandCode: "", brandName: "", description: "", isActive: true };

export function ProductBrandsManagementView({ lang }: { lang: SupportedLanguage }) {
  const dir = getLanguageDirection(lang);
  const [brands, setBrands] = useState<Brand[]>([]);
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
      const res = await fetch("/api/erp/master-data/brands");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setBrands(json.brands || []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => (b.brandName || "").toLowerCase().includes(q) || (b.brandCode || "").toLowerCase().includes(q));
  }, [brands, query]);

  function startAdd() { setForm(empty); setEditing(true); }
  function startEdit(b: Brand) {
    setForm({ id: b.id, brandCode: b.brandCode ?? "", brandName: b.brandName, description: b.description ?? "", isActive: b.isActive });
    setEditing(true);
  }

  async function save() {
    if (!form.brandName.trim()) { setError("Brand Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        brandCode: form.brandCode.trim() || null,
        brandName: form.brandName.trim(),
        description: form.description.trim() || null,
        isActive: form.isActive,
      };
      const res = form.id
        ? await fetch(`/api/erp/master-data/brands/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/erp/master-data/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setEditing(false);
      setForm(empty);
      await load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm(t(lang, "pb.delete") + "?")) return;
    try {
      const res = await fetch(`/api/erp/master-data/brands/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      await load();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div dir={dir} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{t(lang, "pb.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ReportActions title={t(lang, "pb.title")} rows={filtered} columns={[{ key: "brandCode", label: t(lang, "pb.code") }, { key: "brandName", label: t(lang, "pb.name") }, { key: "description", label: t(lang, "pb.description") }]} />
          <button onClick={startAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
            <Plus className="h-4 w-4" /> {t(lang, "pb.add")}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(lang, "pb.search")}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm dark:border-slate-800 dark:bg-slate-950" />
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-start text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950/60">
            <tr>
              <th className="px-4 py-3 text-start">{t(lang, "pb.code")}</th>
              <th className="px-4 py-3 text-start">{t(lang, "pb.name")}</th>
              <th className="px-4 py-3 text-start">{t(lang, "pb.description")}</th>
              <th className="px-4 py-3 text-start">{t(lang, "pb.active")}</th>
              <th className="px-4 py-3 text-end"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">{t(lang, "pb.empty")}</td></tr>
            ) : filtered.map((b) => (
              <tr key={b.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-bold">{b.brandCode || "-"}</td>
                <td className="px-4 py-3">{b.brandName}</td>
                <td className="px-4 py-3 text-slate-500">{b.description || "-"}</td>
                <td className="px-4 py-3">
                  <span className={b.isActive ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800"}>
                    {b.isActive ? "●" : "○"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(b)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" title={t(lang, "pb.edit")}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(b.id)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title={t(lang, "pb.delete")}><Trash2 className="h-4 w-4" /></button>
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
              <h2 className="text-lg font-black">{form.id ? t(lang, "pb.edit") : t(lang, "pb.add")}</h2>
              <button onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "pb.code")}</span>
                <input value={form.brandCode} onChange={(e) => setForm({ ...form, brandCode: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "pb.name")}</span>
                <input value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "pb.description")}</span>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded" />
                {t(lang, "pb.active")}
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t(lang, "pb.cancel")}</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t(lang, "pb.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
