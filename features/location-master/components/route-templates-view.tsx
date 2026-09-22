"use client";

/**
 * Reusable Route Templates — ordered leg blueprints (from/to country+location,
 * transport mode, clearance type) that can be applied to a real Customer Order
 * and edited per-order. Table-First, mirrors location-master-view.tsx.
 *
 * TEMPORARY REVIEW MARKER — see components/ui/review-marker.tsx.
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, Trash2, X as XIcon, Route as RouteIcon, GripVertical } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { Th } from "@/components/ui/translated-th";
import { SearchSelect } from "@/components/ui/search-select";
import { ReviewMarker } from "@/components/ui/review-marker";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { LocationPicker, type LegTransportMode } from "@/features/location-master/components/location-picker";

type TemplateLegDraft = {
  key: string;
  legNo: number;
  fromCountryId: string;
  fromLocationId: string;
  fromLocationName: string;
  toCountryId: string;
  toLocationId: string;
  toLocationName: string;
  transportMode: LegTransportMode | "";
  clearanceType: "import" | "export" | "transit" | "";
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  legs: Array<Record<string, any>>;
  created_at: string;
};

function emptyLeg(legNo: number): TemplateLegDraft {
  return {
    key: Math.random().toString(36).slice(2),
    legNo,
    fromCountryId: "",
    fromLocationId: "",
    fromLocationName: "",
    toCountryId: "",
    toLocationId: "",
    toLocationName: "",
    transportMode: "",
    clearanceType: ""
  };
}

const MODES: LegTransportMode[] = ["by_sea", "by_road", "by_air", "by_rail"];

export function RouteTemplatesView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("rtpl", langProp);

  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<LocationCountry[]>([]);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [legs, setLegs] = useState<TemplateLegDraft[]>([emptyLeg(1)]);

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/route-templates");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to load");
      setRows(json?.data?.templates || []);
    } catch (e: any) {
      setError(e.message || s.t("err_load", "Unable to load route templates"));
    } finally {
      setLoading(false);
    }
  }

  async function loadCountries() {
    try {
      setCountries(await listCountries({ all: true }));
    } catch {
      setCountries([]);
    }
  }

  useEffect(() => {
    void loadRows();
    void loadCountries();
  }, []);

  const countryOptions = useMemo(() => countries.map((c) => ({ value: c.id, label: c.name })), [countries]);

  function openNew() {
    setName("");
    setDescription("");
    setLegs([emptyLeg(1)]);
    setError(null);
    setEditing(true);
  }

  function updateLeg(key: string, patch: Partial<TemplateLegDraft>) {
    setLegs((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLeg() {
    setLegs((prev) => [...prev, emptyLeg(prev.length + 1)]);
  }

  function removeLeg(key: string) {
    setLegs((prev) => prev.filter((l) => l.key !== key).map((l, idx) => ({ ...l, legNo: idx + 1 })));
  }

  function moveLeg(key: string, direction: -1 | 1) {
    setLegs((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((l, i) => ({ ...l, legNo: i + 1 }));
    });
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(s.t("err_name_required", "Template name is required."));
      return;
    }
    const invalidLeg = legs.find((l) => !l.fromCountryId || !l.toCountryId || !l.transportMode);
    if (invalidLeg) {
      setError(s.t("err_leg_incomplete", "Every leg needs a From Country, To Country, and Transport Mode."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/route-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          legs: legs.map((l) => ({
            legNo: l.legNo,
            fromCountryId: l.fromCountryId,
            fromLocationId: l.fromLocationId || null,
            toCountryId: l.toCountryId,
            toLocationId: l.toLocationId || null,
            transportMode: l.transportMode,
            clearanceType: l.clearanceType || null
          }))
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to save");
      setEditing(false);
      await loadRows();
    } catch (e: any) {
      setError(e.message || s.t("err_save", "Unable to save route template"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(s.t("confirm_delete", "Delete this route template?"))) return;
    try {
      const res = await fetch(`/api/erp/route-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      await loadRows();
    } catch {
      setError(s.t("err_delete", "Unable to delete route template"));
    }
  }

  const countryName = (id: string) => countries.find((c) => c.id === id)?.name || id;

  return (
    <ReviewMarker label={s.t("review_marker", "NEW: Dynamic Location & Route Management")}>
      <div dir={s.dir} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-sm font-black uppercase text-slate-900 dark:text-slate-100">
              <RouteIcon className="h-4 w-4 text-cyan-600" /> {s.t("title", "Reusable Route Templates")}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {s.t("subtitle", "Save common multi-country routes once, then apply and edit them per Customer Order")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadRows()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <RefreshCcw className="h-3.5 w-3.5" /> {s.t("refresh", "Refresh")}
            </button>
            <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500">
              <Plus className="h-3.5 w-3.5" /> {s.t("new_template", "New Route Template")}
            </button>
          </div>
        </div>

        {error && !editing ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <Th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_name", "Name")}</Th>
                <Th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_route", "Route")}</Th>
                <Th className={`px-3 py-2 text-end`}>{s.t("col_legs", "Legs")}</Th>
                <Th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_status", "Status")}</Th>
                <Th className={`px-3 py-2 text-end`}>{s.t("col_actions", "Actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">{s.t("loading", "Loading…")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">{s.t("empty", "No route templates saved yet.")}</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{row.name}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {(row.legs || []).map((l: any) => countryName(l.fromCountryId)).filter(Boolean).concat(
                        row.legs?.length ? [countryName(row.legs[row.legs.length - 1]?.toCountryId)] : []
                      ).join(" → ")}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">{row.legs?.length || 0}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        {s.t(`status_${row.status}`, row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-end">
                      <button type="button" onClick={() => handleDelete(row.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <h2 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100">{s.t("new_template", "New Route Template")}</h2>
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><XIcon className="h-4 w-4" /></button>
              </div>

              {error ? <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div> : null}

              <label className="block space-y-1.5 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-500">{s.t("col_name", "Name")}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={s.t("name_placeholder", "e.g. Tajikistan → Afghanistan → Pakistan → Saudi Arabia")} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950" />
              </label>

              <label className="block space-y-1.5 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-500">{s.t("col_description", "Description")} ({s.t("optional", "optional")})</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950" />
              </label>

              <div className="space-y-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500">{s.t("legs", "Route Legs")}</span>
                  <button type="button" onClick={addLeg} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300">
                    <Plus className="h-3 w-3" /> {s.t("add_leg", "Add Leg")}
                  </button>
                </div>

                {legs.map((leg, idx) => (
                  <div key={leg.key} className="space-y-1.5 rounded-lg border border-slate-100 p-2 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500">
                        <GripVertical className="h-3 w-3" /> {s.t("leg_no", "Leg")} {idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button type="button" disabled={idx === 0} onClick={() => moveLeg(leg.key, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">↑</button>
                        <button type="button" disabled={idx === legs.length - 1} onClick={() => moveLeg(leg.key, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">↓</button>
                        <button type="button" disabled={legs.length === 1} onClick={() => removeLeg(leg.key)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-950/40">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <SearchSelect label={s.t("leg_from_country", "From Country")} value={leg.fromCountryId} options={countryOptions} onValueChange={(v) => updateLeg(leg.key, { fromCountryId: v, fromLocationId: "", fromLocationName: "" })} />
                      <SearchSelect label={s.t("leg_to_country", "To Country")} value={leg.toCountryId} options={countryOptions} onValueChange={(v) => updateLeg(leg.key, { toCountryId: v, toLocationId: "", toLocationName: "" })} />
                    </div>

                    <label className="block space-y-1 text-[11px]">
                      <span className="text-[10px] font-black uppercase text-slate-500">{s.t("leg_transport_mode", "Transport Mode")}</span>
                      <select
                        value={leg.transportMode}
                        onChange={(e) => updateLeg(leg.key, { transportMode: e.target.value as LegTransportMode, fromLocationId: "", toLocationId: "" })}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold dark:border-slate-800 dark:bg-slate-950"
                      >
                        <option value="">{s.t("select_mode", "Select mode")}</option>
                        {MODES.map((m) => (
                          <option key={m} value={m}>{s.t(`mode_${m}`, m)}</option>
                        ))}
                      </select>
                    </label>

                    <div className="grid grid-cols-2 gap-1.5">
                      <LocationPicker
                        countryId={leg.fromCountryId}
                        transportMode={leg.transportMode}
                        value={leg.fromLocationId}
                        onChange={(id, nm) => updateLeg(leg.key, { fromLocationId: id, fromLocationName: nm })}
                        label={s.t("leg_from_location", "From Location")}
                      />
                      <LocationPicker
                        countryId={leg.toCountryId}
                        transportMode={leg.transportMode}
                        value={leg.toLocationId}
                        onChange={(id, nm) => updateLeg(leg.key, { toLocationId: id, toLocationName: nm })}
                        label={s.t("leg_to_location", "To Location")}
                      />
                    </div>

                    <label className="block space-y-1 text-[11px]">
                      <span className="text-[10px] font-black uppercase text-slate-500">{s.t("leg_clearance_type", "Import / Export / Transit")}</span>
                      <select
                        value={leg.clearanceType}
                        onChange={(e) => updateLeg(leg.key, { clearanceType: e.target.value as any })}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold dark:border-slate-800 dark:bg-slate-950"
                      >
                        <option value="">{s.t("select_clearance", "Select")}</option>
                        <option value="import">{s.t("clearance_import", "Import")}</option>
                        <option value="export">{s.t("clearance_export", "Export")}</option>
                        <option value="transit">{s.t("clearance_transit", "Transit")}</option>
                      </select>
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">
                  {s.t("cancel", "Cancel")}
                </button>
                <button type="button" disabled={saving} onClick={() => void handleSave()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500 disabled:opacity-50">
                  {s.t("save_template", "Save Template")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ReviewMarker>
  );
}
