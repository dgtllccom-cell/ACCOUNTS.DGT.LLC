"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";

/**
 * Reusable, ERP-wide Location selector (single source of truth).
 * Cascading Country -> State/Province -> City, reading ONLY from the central
 * Location Management master (/api/erp/locations/*). Includes inline "New State"
 * and "New City" creation that saves under the selected parent and immediately
 * becomes available everywhere. Drop this into any form — no module keeps its
 * own location list.
 *
 * Usage:
 *   <LocationSelect value={loc} onChange={setLoc} />
 *   where loc = { countryId, stateProvinceId, cityId }
 */
export type LocationValue = { countryId: string | null; stateProvinceId: string | null; cityId: string | null };
type Opt = { id: string; name: string; code?: string | null; iso2?: string | null };

function arr(json: any, key: string): Opt[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.[key])) return json[key];
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

export function LocationSelect({
  value,
  onChange,
  required = false,
  labels = { country: "Country", state: "State / Province", city: "City" },
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  required?: boolean;
  labels?: { country: string; state: string; city: string };
}) {
  const [countries, setCountries] = useState<Opt[]>([]);
  const [states, setStates] = useState<Opt[]>([]);
  const [cities, setCities] = useState<Opt[]>([]);
  const [busy, setBusy] = useState<"" | "states" | "cities">("");
  const [adding, setAdding] = useState<"" | "state" | "city">("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/erp/locations/countries").then((r) => r.json()).then((j) => setCountries(arr(j, "countries"))).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (!value.countryId) { setStates([]); return; }
    setBusy("states");
    fetch(`/api/erp/locations/states?countryId=${value.countryId}`).then((r) => r.json())
      .then((j) => setStates(arr(j, "states"))).catch(() => setStates([])).finally(() => setBusy(""));
  }, [value.countryId]);

  useEffect(() => {
    if (!value.countryId || !value.stateProvinceId) { setCities([]); return; }
    setBusy("cities");
    fetch(`/api/erp/locations/cities?countryId=${value.countryId}&stateProvinceId=${value.stateProvinceId}`).then((r) => r.json())
      .then((j) => setCities(arr(j, "cities"))).catch(() => setCities([])).finally(() => setBusy(""));
  }, [value.countryId, value.stateProvinceId]);

  function beginAdd(kind: "state" | "city") { setAdding(kind); setNewName(""); setNewCode(""); setErr(null); }

  async function saveNew() {
    if (!newName.trim()) { setErr("Name is required"); return; }
    setSaving(true); setErr(null);
    try {
      if (adding === "state") {
        const res = await fetch("/api/erp/locations/states", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryId: value.countryId, name: newName.trim(), code: newCode.trim() || null }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error?.message || j.error || "Failed to add state");
        const id = j.id || j.state?.id || j.data?.id;
        const r2 = await fetch(`/api/erp/locations/states?countryId=${value.countryId}`).then((r) => r.json());
        setStates(arr(r2, "states"));
        onChange({ ...value, stateProvinceId: id ?? null, cityId: null });
      } else if (adding === "city") {
        const res = await fetch("/api/erp/locations/cities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryId: value.countryId, stateProvinceId: value.stateProvinceId, name: newName.trim(), code: newCode.trim() || null }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error?.message || j.error || "Failed to add city");
        const id = j.id || j.city?.id || j.data?.id;
        const r2 = await fetch(`/api/erp/locations/cities?countryId=${value.countryId}&stateProvinceId=${value.stateProvinceId}`).then((r) => r.json());
        setCities(arr(r2, "cities"));
        onChange({ ...value, cityId: id ?? null });
      }
      setAdding("");
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  const sel = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950";
  const cap = "text-[11px] font-black uppercase tracking-wide text-slate-400";

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block">
        <span className={cap}>{labels.country}{required ? " *" : ""}</span>
        <select className={sel} value={value.countryId ?? ""} onChange={(e) => onChange({ countryId: e.target.value || null, stateProvinceId: null, cityId: null })}>
          <option value="">—</option>
          {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label className="block">
        <span className={cap}>{labels.state} {busy === "states" ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null}</span>
        <select className={sel} value={value.stateProvinceId ?? ""} disabled={!value.countryId} onChange={(e) => onChange({ ...value, stateProvinceId: e.target.value || null, cityId: null })}>
          <option value="">—</option>
          {states.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
        </select>
        {value.countryId && adding !== "state" ? (
          <button type="button" onClick={() => beginAdd("state")} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"><Plus className="h-3 w-3" /> New State</button>
        ) : null}
      </label>

      <label className="block">
        <span className={cap}>{labels.city} {busy === "cities" ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null}</span>
        <select className={sel} value={value.cityId ?? ""} disabled={!value.stateProvinceId} onChange={(e) => onChange({ ...value, cityId: e.target.value || null })}>
          <option value="">—</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ""}</option>)}
        </select>
        {value.stateProvinceId && adding !== "city" ? (
          <button type="button" onClick={() => beginAdd("city")} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"><Plus className="h-3 w-3" /> New City</button>
        ) : null}
      </label>

      {adding ? (
        <div className="sm:col-span-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">New {adding === "state" ? "State / Province" : "City"}</div>
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
