"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Loader2, X } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { LocationHierarchySelect } from "@/features/locations/components/location-hierarchy-select";
import { ReportActions } from "@/components/ui/report-actions";
import { TruckAttachments } from "@/features/clearing-agent/components/truck-attachments";

type Loading = {
  id: string;
  loading_date: string | null;
  loading_serial: string | null;
  truck_id: string | null;
  truck_number: string | null;
  driver_name: string | null;
  driver_mobile_1: string | null;
  vehicle_type: string | null;
  goods_name: string | null;
  quantity: number | null;
  unit: string | null;
  net_weight: number | null;
  gross_weight: number | null;
  destination: string | null;
  remarks: string | null;
};

type TruckOpt = {
  id: string;
  truck_number: string;
  vehicle_type?: string | null;
  truck_type?: string | null;
  driver_name: string | null;
  driver_mobile: string | null;
  owner_name: string | null;
};

const EMPTY: any = { id: "", truck_id: "", loading_date: "", truck_number: "", driver_name: "", driver_mobile_1: "", vehicle_type: "", goods_name: "", quantity: "", unit: "", net_weight: "", gross_weight: "", destination: "", remarks: "", dest_country_id: null, dest_state_province_id: null, dest_district_id: null, dest_city_id: null };

export function TruckLoadingManagementView({ lang }: { lang: SupportedLanguage }) {
  const dir = getLanguageDirection(lang);
  const [rows, setRows] = useState<Loading[]>([]);
  const [trucks, setTrucks] = useState<TruckOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/erp/clearing-agent/truck-loading"),
        fetch("/api/erp/master-data/trucks?selectable=true"),
      ]);
      const j1 = await r1.json(); const j2 = await r2.json();
      if (!r1.ok) throw new Error(j1.error || "Failed to load");
      setRows(j1.records || []);
      setTrucks(r2.ok ? (j2.trucks || []) : []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.truck_number, r.driver_name, r.goods_name, r.loading_serial].some((v) => (v || "").toLowerCase().includes(q)));
  }, [rows, query]);

  function startAdd() { setForm(EMPTY); setEditing(true); }
  function startEdit(r: Loading) { setForm({ ...EMPTY, ...r, quantity: r.quantity ?? "", net_weight: r.net_weight ?? "", gross_weight: r.gross_weight ?? "", loading_date: r.loading_date ?? "" }); setEditing(true); }

  // Auto-fill registered truck details on selection (no re-typing).
  function onSelectTruck(truckId: string) {
    const tr = trucks.find((x) => x.id === truckId);
    setForm((f: any) => ({
      ...f,
      truck_id: truckId,
      truck_number: tr?.truck_number ?? "",
      driver_name: tr?.driver_name ?? "",
      driver_mobile_1: tr?.driver_mobile ?? "",
      vehicle_type: tr?.vehicle_type ?? tr?.truck_type ?? "",
    }));
  }

  async function save() {
    if (!form.truck_id && !String(form.truck_number).trim()) { setError("Select a truck"); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...form }; delete payload.id;
      const res = form.id
        ? await fetch(`/api/erp/clearing-agent/truck-loading/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/erp/clearing-agent/truck-loading", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setEditing(false); setForm(EMPTY); await load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm(t(lang, "tl.delete") + "?")) return;
    try {
      const res = await fetch(`/api/erp/clearing-agent/truck-loading/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      await load();
    } catch (e: any) { setError(e.message); }
  }

  const field = (k: string, label: string, type = "text") => (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</span>
      <input type={type} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" />
    </label>
  );

  return (
    <div dir={dir} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{t(lang, "tl.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ReportActions title={t(lang, "tl.title")} rows={filtered} columns={[{ key: "loading_serial", label: t(lang, "tl.serial") }, { key: "loading_date", label: t(lang, "tl.date") }, { key: "truck_number", label: "Truck" }, { key: "driver_name", label: "Driver" }, { key: "goods_name", label: t(lang, "tl.goods") }, { key: "quantity", label: t(lang, "tl.qty") }, { key: "destination", label: t(lang, "tl.destination") }]} />
          <button onClick={startAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
            <Plus className="h-4 w-4" /> {t(lang, "tl.add")}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(lang, "tl.search")} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm dark:border-slate-800 dark:bg-slate-950" />
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-start text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950/60">
            <tr>
              <th className="px-3 py-3 text-start">{t(lang, "tl.serial")}</th>
              <th className="px-3 py-3 text-start">{t(lang, "tl.date")}</th>
              <th className="px-3 py-3 text-start">Truck</th>
              <th className="px-3 py-3 text-start">{t(lang, "tl.goods")}</th>
              <th className="px-3 py-3 text-start">{t(lang, "tl.qty")}</th>
              <th className="px-3 py-3 text-start">{t(lang, "tl.destination")}</th>
              <th className="px-3 py-3 text-end"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{t(lang, "tl.empty")}</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-3 font-bold">{r.loading_serial || "-"}</td>
                <td className="px-3 py-3">{r.loading_date || "-"}</td>
                <td className="px-3 py-3">{r.truck_number || "-"}</td>
                <td className="px-3 py-3">{r.goods_name || "-"}</td>
                <td className="px-3 py-3">{r.quantity ?? "-"} {r.unit || ""}</td>
                <td className="px-3 py-3">{r.destination || "-"}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(r)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" title={t(lang, "tl.edit")}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(r.id)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title={t(lang, "tl.delete")}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(false)}>
          <div dir={dir} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">{form.id ? t(lang, "tl.edit") : t(lang, "tl.add")}</h2>
              <button onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "tl.select_truck")}</span>
                <select value={form.truck_id ?? ""} onChange={(e) => onSelectTruck(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
                  <option value="">—</option>
                  {trucks.map((tr) => <option key={tr.id} value={tr.id}>{tr.truck_number}{tr.driver_name ? ` — ${tr.driver_name}` : ""}</option>)}
                </select>
              </label>
              {field("loading_date", t(lang, "tl.date"), "date")}
              {field("truck_number", "Truck #")}
              {field("driver_name", "Driver")}
              {field("driver_mobile_1", "Driver Mobile")}
              {field("vehicle_type", "Vehicle Type")}
              {field("goods_name", t(lang, "tl.goods"))}
              {field("quantity", t(lang, "tl.qty"), "number")}
              {field("unit", t(lang, "tl.unit"))}
              {field("net_weight", t(lang, "tl.net_weight"), "number")}
              {field("gross_weight", t(lang, "tl.gross_weight"), "number")}
              {field("destination", t(lang, "tl.destination"))}
              <div className="sm:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "tl.destination")} (central master)</span>
                <div className="mt-1">
                  <LocationHierarchySelect
                    value={{ countryId: form.dest_country_id ?? "", stateProvinceId: form.dest_state_province_id ?? "", districtId: form.dest_district_id ?? "", cityId: form.dest_city_id ?? "" }}
                    onChange={(v) => setForm({ ...form, dest_country_id: v.countryId || null, dest_state_province_id: v.stateProvinceId || null, dest_district_id: v.districtId || null, dest_city_id: v.cityId || null })}
                  />
                </div>
              </div>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "tl.remarks")}</span>
                <textarea value={form.remarks ?? ""} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" />
              </label>
              {form.id ? <div className="sm:col-span-2 border-t border-slate-100 pt-3 dark:border-slate-800"><TruckAttachments entityId={form.id} entityKey="truck_loading" /></div> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t(lang, "tl.cancel")}</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t(lang, "tl.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
