"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Loader2, X } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { LocationSelect, type LocationValue } from "@/components/ui/location-select";

type Truck = {
  id: string;
  truck_number: string;
  registration_number: string | null;
  truck_type: string | null;
  make: string | null;
  model: string | null;
  manufacturing_year: number | null;
  color: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  capacity: string | null;
  owner_name: string | null;
  owner_mobile: string | null;
  transport_company: string | null;
  driver_name: string | null;
  driver_mobile: string | null;
  driver_cnic_passport: string | null;
  registration_expiry_date: string | null;
  insurance_expiry_date: string | null;
  status: string;
  notes: string | null;
};

const EMPTY: any = { id: "", truck_number: "", registration_number: "", truck_type: "", make: "", model: "", manufacturing_year: "", color: "", chassis_number: "", engine_number: "", capacity: "", owner_name: "", owner_mobile: "", transport_company: "", driver_name: "", driver_mobile: "", driver_cnic_passport: "", registration_expiry_date: "", insurance_expiry_date: "", status: "active", notes: "", registration_country_id: null, base_state_province_id: null, base_district_id: null, base_city_id: null };

const STATUSES = ["active", "inactive", "suspended", "expired"];

function daysLeft(date: string | null): number | null {
  if (!date) return null;
  const d = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return Number.isFinite(d) ? d : null;
}

export function TruckRegistrationManagementView({ lang }: { lang: SupportedLanguage }) {
  const dir = getLanguageDirection(lang);
  const [rows, setRows] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/erp/master-data/trucks");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setRows(json.trucks || []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.truck_number, r.registration_number, r.owner_name, r.driver_name, r.transport_company].some((v) => (v || "").toLowerCase().includes(q)));
  }, [rows, query]);

  function startAdd() { setForm(EMPTY); setEditing(true); }
  function startEdit(r: Truck) { setForm({ ...EMPTY, ...r, manufacturing_year: r.manufacturing_year ?? "", registration_expiry_date: r.registration_expiry_date ?? "", insurance_expiry_date: r.insurance_expiry_date ?? "" }); setEditing(true); }

  async function save() {
    if (!String(form.truck_number).trim()) { setError("Truck Number is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...form };
      delete payload.id;
      const res = form.id
        ? await fetch(`/api/erp/master-data/trucks/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/erp/master-data/trucks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setEditing(false); setForm(EMPTY); await load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm(t(lang, "tr.delete") + "?")) return;
    try {
      const res = await fetch(`/api/erp/master-data/trucks/${id}`, { method: "DELETE" });
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
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{t(lang, "tr.title")}</h1>
        <button onClick={startAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
          <Plus className="h-4 w-4" /> {t(lang, "tr.add")}
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(lang, "tr.search")} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm dark:border-slate-800 dark:bg-slate-950" />
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-start text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950/60">
            <tr>
              <th className="px-3 py-3 text-start">{t(lang, "tr.number")}</th>
              <th className="px-3 py-3 text-start">{t(lang, "tr.reg_no")}</th>
              <th className="px-3 py-3 text-start">{t(lang, "tr.owner")}</th>
              <th className="px-3 py-3 text-start">{t(lang, "tr.driver")}</th>
              <th className="px-3 py-3 text-start">{t(lang, "tr.status")}</th>
              <th className="px-3 py-3 text-start">{t(lang, "tr.reg_expiry")}</th>
              <th className="px-3 py-3 text-start">{t(lang, "tr.ins_expiry")}</th>
              <th className="px-3 py-3 text-end"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">{t(lang, "tr.empty")}</td></tr>
            ) : filtered.map((r) => {
              const rd = daysLeft(r.registration_expiry_date); const idd = daysLeft(r.insurance_expiry_date);
              const exp = (d: number | null) => d != null && d <= 30 ? "text-red-600 font-bold dark:text-red-400" : "";
              return (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-3 font-bold">{r.truck_number}</td>
                  <td className="px-3 py-3">{r.registration_number || "-"}</td>
                  <td className="px-3 py-3">{r.owner_name || "-"}</td>
                  <td className="px-3 py-3">{r.driver_name || "-"}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{r.status}</span></td>
                  <td className={"px-3 py-3 " + exp(rd)}>{r.registration_expiry_date || "-"}</td>
                  <td className={"px-3 py-3 " + exp(idd)}>{r.insurance_expiry_date || "-"}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startEdit(r)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" title={t(lang, "tr.edit")}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(r.id)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title={t(lang, "tr.delete")}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(false)}>
          <div dir={dir} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">{form.id ? t(lang, "tr.edit") : t(lang, "tr.add")}</h2>
              <button onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field("truck_number", t(lang, "tr.number"))}
              {field("registration_number", t(lang, "tr.reg_no"))}
              {field("truck_type", t(lang, "tr.type"))}
              {field("make", "Make")}
              {field("model", "Model")}
              {field("manufacturing_year", "Year", "number")}
              {field("color", "Color")}
              {field("capacity", "Capacity")}
              {field("chassis_number", "Chassis No")}
              {field("engine_number", "Engine No")}
              {field("owner_name", t(lang, "tr.owner"))}
              {field("owner_mobile", t(lang, "tr.owner_mobile"))}
              {field("transport_company", t(lang, "tr.company"))}
              {field("driver_name", t(lang, "tr.driver"))}
              {field("driver_mobile", t(lang, "tr.driver_mobile"))}
              {field("driver_cnic_passport", "CNIC / Passport")}
              {field("registration_expiry_date", t(lang, "tr.reg_expiry"), "date")}
              {field("insurance_expiry_date", t(lang, "tr.ins_expiry"), "date")}
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t(lang, "tr.status")}</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div className="sm:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Base Location (central master)</span>
                <div className="mt-1">
                  <LocationSelect
                    value={{ countryId: form.registration_country_id ?? null, stateProvinceId: form.base_state_province_id ?? null, districtId: form.base_district_id ?? null, cityId: form.base_city_id ?? null } as LocationValue}
                    onChange={(v) => setForm({ ...form, registration_country_id: v.countryId, base_state_province_id: v.stateProvinceId, base_district_id: v.districtId, base_city_id: v.cityId })}
                  />
                </div>
              </div>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Notes</span>
                <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t(lang, "tr.cancel")}</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t(lang, "tr.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
