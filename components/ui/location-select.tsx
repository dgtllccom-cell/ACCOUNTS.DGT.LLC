"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Search } from "lucide-react";

/**
 * Reusable, ERP-wide World Location selector (single source of truth).
 * Cascading Country -> State/Province -> District (optional) -> City, reading
 * ONLY from the central Location Management master (/api/erp/locations/*).
 * Includes type-to-filter search (find fast, avoid duplicates) and inline
 * "New State / New District / New City" creation that saves under the selected
 * parent and becomes available everywhere instantly. Drop into any form.
 *
 *   <LocationSelect value={loc} onChange={setLoc} />
 *   loc = { countryId, stateProvinceId, districtId, cityId }
 */
export type LocationValue = {
  countryId: string | null;
  stateProvinceId: string | null;
  districtId: string | null;
  cityId: string | null;
};
type Opt = { id: string; name: string; code?: string | null };
type Level = "state" | "district" | "city";

function arr(json: any, key: string): Opt[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.[key])) return json[key];
  if (Array.isArray(json?.data)) return json.data;
  return [];
}
function match(o: Opt, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (o.name || "").toLowerCase().includes(s) || (o.code || "").toLowerCase().includes(s);
}

export function LocationSelect({
  value,
  onChange,
  required = false,
  labels = { country: "Country", state: "State / Province", district: "District", city: "City" },
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  required?: boolean;
  labels?: { country: string; state: string; district: string; city: string };
}) {
  const [countries, setCountries] = useState<Opt[]>([]);
  const [states, setStates] = useState<Opt[]>([]);
  const [districts, setDistricts] = useState<Opt[]>([]);
  const [cities, setCities] = useState<Opt[]>([]);
  const [busy, setBusy] = useState<Level | "">("");
  const [q, setQ] = useState<{ state: string; district: string; city: string }>({ state: "", district: "", city: "" });
  const [adding, setAdding] = useState<Level | "">("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/erp/locations/countries").then((r) => r.json()).then((j) => setCountries(arr(j, "countries"))).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (!value.countryId) { setStates([]); return; }
    setBusy("state");
    fetch(`/api/erp/locations/states?countryId=${value.countryId}`).then((r) => r.json()).then((j) => setStates(arr(j, "states"))).catch(() => setStates([])).finally(() => setBusy(""));
  }, [value.countryId]);

  useEffect(() => {
    if (!value.countryId || !value.stateProvinceId) { setDistricts([]); return; }
    setBusy("district");
    fetch(`/api/erp/locations/districts?countryId=${value.countryId}&stateProvinceId=${value.stateProvinceId}`).then((r) => r.json()).then((j) => setDistricts(arr(j, "districts"))).catch(() => setDistricts([])).finally(() => setBusy(""));
  }, [value.countryId, value.stateProvinceId]);

  useEffect(() => {
    if (!value.countryId || !value.stateProvinceId) { setCities([]); return; }
    setBusy("city");
    const d = value.districtId ? `&districtId=${value.districtId}` : "";
    fetch(`/api/erp/locations/cities?countryId=${value.countryId}&stateProvinceId=${value.stateProvinceId}${d}`).then((r) => r.json()).then((j) => setCities(arr(j, "cities"))).catch(() => setCities([])).finally(() => setBusy(""));
  }, [value.countryId, value.stateProvinceId, value.districtId]);

  const fStates = useMemo(() => states.filter((o) => match(o, q.state)), [states, q.state]);
  const fDistricts = useMemo(() => districts.filter((o) => match(o, q.district)), [districts, q.district]);
  const fCities = useMemo(() => cities.filter((o) => match(o, q.city)), [cities, q.city]);

  async function saveNew() {
    if (!newName.trim()) { setErr("Name is required"); return; }
    setSaving(true); setErr(null);
    try {
      let url = "", payload: any = {}, listUrl = "", key = "";
      if (adding === "state") { url = "/api/erp/locations/states"; payload = { countryId: value.countryId, name: newName.trim(), code: newCode.trim() || null }; listUrl = `/api/erp/locations/states?countryId=${value.countryId}`; key = "states"; }
      else if (adding === "district") { url = "/api/erp/locations/districts"; payload = { countryId: value.countryId, stateProvinceId: value.stateProvinceId, name: newName.trim(), code: newCode.trim() || null }; listUrl = `/api/erp/locations/districts?countryId=${value.countryId}&stateProvinceId=${value.stateProvinceId}`; key = "districts"; }
      else { url = "/api/erp/locations/cities"; payload = { countryId: value.countryId, stateProvinceId: value.stateProvinceId, districtId: value.districtId, name: newName.trim(), code: newCode.trim() || null }; listUrl = `/api/erp/locations/cities?countryId=${value.countryId}&stateProvinceId=${value.stateProvinceId}`; key = "cities"; }
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || j.error || "Failed to add");
      const id = j.id || j[key.slice(0, -1)]?.id || j.data?.id;
      const fresh = arr(await fetch(listUrl).then((r) => r.json()), key);
      if (adding === "state") { setStates(fresh); onChange({ ...value, stateProvinceId: id ?? null, districtId: null, cityId: null }); }
      else if (adding === "district") { setDistricts(fresh); onChange({ ...value, districtId: id ?? null, cityId: null }); }
      else { setCities(fresh); onChange({ ...value, cityId: id ?? null }); }
      setAdding("");
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  const sel = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950";
  const cap = "text-[11px] font-black uppercase tracking-wide text-slate-400";
  const searchBox = (level: "state" | "district" | "city", show: boolean) => show ? (
    <div className="relative mt-1">
      <Search className="pointer-events-none absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
      <input value={q[level]} onChange={(e) => setQ({ ...q, [level]: e.target.value })} placeholder="Search…" className="h-7 w-full rounded-lg border border-slate-200 ps-6 pe-2 text-xs dark:border-slate-800 dark:bg-slate-950" />
    </div>
  ) : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block">
        <span className={cap}>{labels.country}{required ? " *" : ""}</span>
        <select className={sel} value={value.countryId ?? ""} onChange={(e) => onChange({ countryId: e.target.value || null, stateProvinceId: null, districtId: null, cityId: null })}>
          <option value="">—</option>
          {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label className="block">
        <span className={cap}>{labels.state} {busy === "state" ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null}</span>
        {searchBox("state", states.length > 8)}
        <select className={sel} value={value.stateProvinceId ?? ""} disabled={!value.countryId} onChange={(e) => onChange({ ...value, stateProvinceId: e.target.value || null, districtId: null, cityId: null })}>
          <option value="">—</option>
          {fStates.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
        </select>
        {value.countryId && adding !== "state" ? <button type="button" onClick={() => { setAdding("state"); setNewName(""); setNewCode(""); setErr(null); }} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"><Plus className="h-3 w-3" /> New State</button> : null}
      </label>

      <label className="block">
        <span className={cap}>{labels.district} {busy === "district" ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null}</span>
        {searchBox("district", districts.length > 8)}
        <select className={sel} value={value.districtId ?? ""} disabled={!value.stateProvinceId} onChange={(e) => onChange({ ...value, districtId: e.target.value || null, cityId: null })}>
          <option value="">—</option>
          {fDistricts.map((d) => <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ""}</option>)}
        </select>
        {value.stateProvinceId && adding !== "district" ? <button type="button" onClick={() => { setAdding("district"); setNewName(""); setNewCode(""); setErr(null); }} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"><Plus className="h-3 w-3" /> New District</button> : null}
      </label>

      <label className="block">
        <span className={cap}>{labels.city} {busy === "city" ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null}</span>
        {searchBox("city", cities.length > 8)}
        <select className={sel} value={value.cityId ?? ""} disabled={!value.stateProvinceId} onChange={(e) => onChange({ ...value, cityId: e.target.value || null })}>
          <option value="">—</option>
          {fCities.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ""}</option>)}
        </select>
        {value.stateProvinceId && adding !== "city" ? <button type="button" onClick={() => { setAdding("city"); setNewName(""); setNewCode(""); setErr(null); }} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"><Plus className="h-3 w-3" /> New City</button> : null}
      </label>

      {adding ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30 sm:col-span-2 lg:col-span-4">
          <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">New {adding === "state" ? "State / Province" : adding === "district" ? "District" : "City"}</div>
          {err ? <div className="mb-2 text-xs font-semibold text-red-600">{err}</div> : null}
          <div className="flex flex-wrap items-end gap-2">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="h-9 flex-1 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-800 dark:bg-slate-950" />
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Code" className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-800 dark:bg-slate-950" />
            <button type="button" onClick={saveNew} disabled={saving} className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-700 px-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save</button>
            <button type="button" onClick={() => setAdding("")} className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
