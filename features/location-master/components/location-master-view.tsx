"use client";

/**
 * Central Location Master — Table-First register + "Request New Location" +
 * approval workflow. Indexes the existing ports/warehouses tables (see
 * supabase/migrations/20260922_dynamic_location_route_master.sql); this screen
 * is the ERP-side surface for that master, not a second one.
 *
 * TEMPORARY REVIEW MARKER: red border/badge on this whole screen — see
 * components/ui/review-marker.tsx. Remove after owner approval (Phase 5 note).
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, Check, X as XIcon, MapPin } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { Th } from "@/components/ui/translated-th";
import { SearchSelect } from "@/components/ui/search-select";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { ReviewMarker } from "@/components/ui/review-marker";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";

const LOCATION_TYPES = [
  "seaport", "airport", "land_border", "railway_terminal",
  "warehouse", "cross_stuffing", "city", "state", "country"
] as const;
type LocationType = (typeof LOCATION_TYPES)[number];

type LocationRow = {
  id: string;
  location_type: LocationType;
  name: string;
  code: string | null;
  country_id: string;
  status: "pending_approval" | "active" | "inactive" | "rejected";
  requested_by: string | null;
  approved_by: string | null;
  rejected_reason: string | null;
  legacy_port_id: string | null;
  legacy_warehouse_id: string | null;
  created_at: string;
  country?: { id: string; name: string; iso2: string | null };
};

export function LocationMasterView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("locmaster", langProp);

  const [rows, setRows] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<LocationCountry[]>([]);

  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState<LocationType>("warehouse");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCountryId, setNewCountryId] = useState("");
  const [actingOn, setActingOn] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (typeFilter) qs.set("type", typeFilter);
      if (statusFilter) qs.set("status", statusFilter);
      const res = await fetch(`/api/erp/location-master?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to load");
      setRows(json?.data?.locations || []);
    } catch (e: any) {
      setError(e.message || s.t("err_load", "Unable to load locations"));
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
    void loadCountries();
  }, []);
  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  const countryOptions = useMemo(
    () => countries.map((c) => ({ value: c.id, label: c.name })),
    [countries]
  );

  function openNew() {
    setNewType("warehouse");
    setNewName("");
    setNewCode("");
    setNewCountryId("");
    setError(null);
    setCreating(true);
  }

  async function handleCreate() {
    if (!newName.trim() || !newCountryId) {
      setError(s.t("err_name_country_required", "Name and Country are required."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/location-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationType: newType, name: newName.trim(), code: newCode.trim() || null, countryId: newCountryId })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to create location");
      setCreating(false);
      await loadRows();
    } catch (e: any) {
      setError(e.message || s.t("err_save", "Unable to save location"));
    } finally {
      setSaving(false);
    }
  }

  async function handleApproval(id: string, action: "approve" | "reject") {
    setActingOn(id);
    setError(null);
    try {
      const reason = action === "reject" ? window.prompt(s.t("reject_reason_prompt", "Reason for rejection (optional)")) : undefined;
      const res = await fetch(`/api/erp/location-master/${id}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason || undefined })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      await loadRows();
    } catch (e: any) {
      setError(e.message || s.t("err_approval", "Unable to update approval status"));
    } finally {
      setActingOn(null);
    }
  }

  const typeLabel = (type: string) => s.t(`type_${type}`, type.replace(/_/g, " "));
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending_approval: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
      active: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
      inactive: "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
      rejected: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
    };
    return map[status] || map.inactive;
  };

  return (
    <ReviewMarker label={s.t("review_marker", "NEW: Dynamic Location & Route Management")}>
      <div dir={s.dir} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-sm font-black uppercase text-slate-900 dark:text-slate-100">
              <MapPin className="h-4 w-4 text-cyan-600" /> {s.t("title", "Central Location Master")}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {s.t("subtitle", "Seaports, Airports, Land Borders, Railway Terminals, Warehouses and Cross-Stuffing locations used across Shipping, Clearing and Route Management")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <JournalPrintButton
              title={s.t("title", "Central Location Master")}
              columns={[
                { key: "name", label: s.t("col_name", "Name") },
                { key: (r) => typeLabel(String((r as any).location_type ?? "")), label: s.t("col_type", "Type") },
                { key: (r) => (r as any).country?.name ?? "", label: s.t("col_country", "Country") },
                { key: "code", label: s.t("col_code", "Code"), align: "center" },
                { key: (r) => s.t(`status_${(r as any).status}`, String((r as any).status ?? "")), label: s.t("col_status", "Status"), align: "center", format: "status" },
              ]}
              rows={rows as unknown as Record<string, unknown>[]}
              filters={[
                ...(typeFilter ? [{ label: s.t("col_type", "Type"), value: typeLabel(typeFilter) }] : []),
                ...(statusFilter ? [{ label: s.t("col_status", "Status"), value: s.t(`status_${statusFilter}`, statusFilter) }] : []),
              ]}
            />
            <button type="button" onClick={() => void loadRows()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <RefreshCcw className="h-3.5 w-3.5" /> {s.t("refresh", "Refresh")}
            </button>
            <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500">
              <Plus className="h-3.5 w-3.5" /> {s.t("request_new", "Request New Location")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950">
            <option value="">{s.t("filter_all_types", "All Types")}</option>
            {LOCATION_TYPES.map((tp) => (
              <option key={tp} value={tp}>{typeLabel(tp)}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950">
            <option value="">{s.t("filter_all_status", "All Statuses")}</option>
            {["pending_approval", "active", "inactive", "rejected"].map((st) => (
              <option key={st} value={st}>{s.t(`status_${st}`, st)}</option>
            ))}
          </select>
        </div>

        {error && !creating ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <Th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_name", "Name")}</Th>
                <Th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_type", "Type")}</Th>
                <Th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_country", "Country")}</Th>
                <Th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_code", "Code")}</Th>
                <Th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_status", "Status")}</Th>
                <Th className={`px-3 py-2 ${s.textEnd}`}>{s.t("col_actions", "Actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">{s.t("loading", "Loading…")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">{s.t("empty", "No locations found.")}</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{row.name}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{typeLabel(row.location_type)}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.country?.name || "—"}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.code || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusBadge(row.status)}`}>
                        {s.t(`status_${row.status}`, row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-end">
                      {row.status === "pending_approval" ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={actingOn === row.id}
                            onClick={() => void handleApproval(row.id, "approve")}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            <Check className="h-3 w-3" /> {s.t("approve", "Approve")}
                          </button>
                          <button
                            type="button"
                            disabled={actingOn === row.id}
                            onClick={() => void handleApproval(row.id, "reject")}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                          >
                            <XIcon className="h-3 w-3" /> {s.t("reject", "Reject")}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {creating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <h2 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100">{s.t("request_new", "Request New Location")}</h2>
                <button type="button" onClick={() => setCreating(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><XIcon className="h-4 w-4" /></button>
              </div>

              {error ? <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div> : null}

              <label className="block space-y-1.5 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-500">{s.t("col_type", "Type")}</span>
                <select value={newType} onChange={(e) => setNewType(e.target.value as LocationType)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950">
                  {LOCATION_TYPES.map((tp) => (
                    <option key={tp} value={tp}>{typeLabel(tp)}</option>
                  ))}
                </select>
              </label>

              <SearchSelect
                label={s.t("col_country", "Country")}
                value={newCountryId}
                options={countryOptions}
                onValueChange={setNewCountryId}
              />

              <label className="block space-y-1.5 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-500">{s.t("col_name", "Name")}</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950" />
              </label>

              <label className="block space-y-1.5 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-500">{s.t("col_code", "Code")} ({s.t("optional", "optional")})</span>
                <input value={newCode} onChange={(e) => setNewCode(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950" />
              </label>

              <p className="text-[10px] text-slate-500 dark:text-slate-400">{s.t("approval_note", "A new location becomes usable across the ERP only after Super Admin or Country Admin approval.")}</p>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">
                  {s.t("cancel", "Cancel")}
                </button>
                <button type="button" disabled={saving} onClick={() => void handleCreate()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500 disabled:opacity-50">
                  {s.t("submit_request", "Submit Request")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ReviewMarker>
  );
}
