"use client";

/**
 * Central Route & Location Master Management Console
 * 5-Tier Master Hierarchy:
 *   1. Country Master (countries, allowed branches, 5-language names)
 *   2. Location Master (erp_locations: Sea Port, Border, Airport, Rail, Warehouse, Free Zone, Inland Depot)
 *   3. Gate / Terminal Master (erp_location_terminals under each location)
 *   4. Customs Office & Treatment (erp_customs_treatments under country/location/gate)
 *   5. Route Leg Rules & Blueprints (Sea, Road, Air, Train route rules & templates)
 */

import { useEffect, useMemo, useState } from "react";
import {
  Plus, RefreshCcw, Check, X as XIcon, MapPin, Globe,
  Shield, Route as RouteIcon, Building, ArrowRight,
  Filter, Search, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { Th } from "@/components/ui/translated-th";
import { SearchSelect } from "@/components/ui/search-select";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { ReviewMarker } from "@/components/ui/review-marker";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { RouteTemplatesView } from "@/features/location-master/components/route-templates-view";

const LOCATION_TYPES = [
  "seaport", "land_border", "airport", "railway_terminal",
  "warehouse", "free_zone", "inland_depot", "cross_stuffing"
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
  created_at: string;
  country?: { id: string; name: string; iso2: string | null };
};

type TerminalRow = {
  id: string;
  location_id: string;
  name: string;
  code: string | null;
  terminal_type: string;
  status: "active" | "inactive";
  description: string | null;
  location?: {
    id: string;
    name: string;
    location_type: string;
    country?: { id: string; name: string; iso2: string | null };
  };
};

type CustomsOfficeRow = {
  id: string;
  country_id: string;
  location_id: string | null;
  gate_id: string | null;
  office_name: string;
  office_code: string | null;
  allowed_movements: string[];
  allowed_treatments: string[];
  status: "active" | "inactive";
  description: string | null;
  country?: { id: string; name: string; iso2: string | null };
  location?: { id: string; name: string; location_type: string };
  gate?: { id: string; name: string; code: string | null };
};

export function LocationMasterView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("locmaster", langProp);

  const [activeTab, setActiveTab] = useState<"locations" | "terminals" | "customs" | "routes" | "countries">("locations");
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  // Tab 1: Locations
  const [locationRows, setLocationRows] = useState<LocationRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Modal: New Location
  const [creatingLoc, setCreatingLoc] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);
  const [newLocType, setNewLocType] = useState<LocationType>("land_border");
  const [newLocName, setNewLocName] = useState("");
  const [newLocCode, setNewLocCode] = useState("");
  const [newLocCountryId, setNewLocCountryId] = useState("");

  // Tab 2: Terminals
  const [terminalRows, setTerminalRows] = useState<TerminalRow[]>([]);
  const [terminalLocFilter, setTerminalLocFilter] = useState<string>("");
  const [creatingTerminal, setCreatingTerminal] = useState(false);
  const [savingTerminal, setSavingTerminal] = useState(false);
  const [newTermLocId, setNewTermLocId] = useState("");
  const [newTermName, setNewTermName] = useState("");
  const [newTermCode, setNewTermCode] = useState("");
  const [newTermType, setNewTermType] = useState("gate");

  // Tab 3: Customs
  const [customsRows, setCustomsRows] = useState<CustomsOfficeRow[]>([]);
  const [customsCountryFilter, setCustomsCountryFilter] = useState<string>("");
  const [creatingCustoms, setCreatingCustoms] = useState(false);
  const [savingCustoms, setSavingCustoms] = useState(false);
  const [newCustCountryId, setNewCustCountryId] = useState("");
  const [newCustLocId, setNewCustLocId] = useState("");
  const [newCustGateId, setNewCustGateId] = useState("");
  const [newCustName, setNewCustName] = useState("");
  const [newCustCode, setNewCustCode] = useState("");
  const [newCustMovements, setNewCustMovements] = useState<string[]>(["import", "export", "transit", "re_export"]);
  const [newCustTreatments, setNewCustTreatments] = useState<string[]>([
    "import_duty_paid", "export_clearance", "transit_bonded", "re_export", "local_clearance"
  ]);

  async function loadCountries() {
    try {
      setCountries(await listCountries({ all: true }));
    } catch {
      setCountries([]);
    }
  }

  async function loadLocations() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (typeFilter) qs.set("type", typeFilter);
      if (statusFilter) qs.set("status", statusFilter);
      if (countryFilter) qs.set("countryId", countryFilter);
      if (searchFilter) qs.set("search", searchFilter);
      const res = await fetch(`/api/erp/location-master?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to load locations");
      setLocationRows(json?.data?.locations || []);
    } catch (e: any) {
      setError(e.message || s.t("err_load", "Unable to load locations"));
    } finally {
      setLoading(false);
    }
  }

  async function loadTerminals() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (terminalLocFilter) qs.set("locationId", terminalLocFilter);
      const res = await fetch(`/api/erp/location-terminals?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to load gates/terminals");
      setTerminalRows(json?.data?.terminals || []);
    } catch (e: any) {
      setError(e.message || "Failed to load gates/terminals");
    } finally {
      setLoading(false);
    }
  }

  async function loadCustoms() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (customsCountryFilter) qs.set("countryId", customsCountryFilter);
      const res = await fetch(`/api/erp/customs-treatments?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to load customs offices");
      setCustomsRows(json?.data?.offices || []);
    } catch (e: any) {
      setError(e.message || "Failed to load customs offices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCountries();
  }, []);

  useEffect(() => {
    if (activeTab === "locations") {
      void loadLocations();
    } else if (activeTab === "terminals") {
      void loadTerminals();
    } else if (activeTab === "customs") {
      void loadCustoms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, typeFilter, statusFilter, countryFilter, searchFilter, terminalLocFilter, customsCountryFilter]);

  const countryOptions = useMemo(
    () => countries.map((c) => ({ value: c.id, label: `${c.name} (${c.iso2 || "-"})` })),
    [countries]
  );

  const locationSelectOptions = useMemo(
    () => locationRows.map((l) => ({ value: l.id, label: `${l.name} (${l.location_type})` })),
    [locationRows]
  );

  // Tab 1 Actions
  async function handleCreateLocation() {
    if (!newLocName.trim() || !newLocCountryId) {
      setError(s.t("err_name_country_required", "Name and Country are required."));
      return;
    }
    setSavingLoc(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/location-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationType: newLocType,
          name: newLocName.trim(),
          code: newLocCode.trim() || null,
          countryId: newLocCountryId
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to create location");
      setCreatingLoc(false);
      setSuccessMsg(s.t("status_active", "Active"));
      await loadLocations();
    } catch (e: any) {
      setError(e.message || s.t("err_save", "Unable to save location"));
    } finally {
      setSavingLoc(false);
    }
  }

  async function handleToggleLocationStatus(row: LocationRow) {
    const nextStatus = row.status === "active" ? "inactive" : "active";
    setActingOn(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/erp/location-master/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to update status");
      await loadLocations();
    } catch (e: any) {
      setError(e.message || "Failed to update status");
    } finally {
      setActingOn(null);
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
      await loadLocations();
    } catch (e: any) {
      setError(e.message || s.t("err_approval", "Unable to update approval status"));
    } finally {
      setActingOn(null);
    }
  }

  // Tab 2 Actions (Gate / Terminal)
  async function handleCreateTerminal() {
    if (!newTermLocId || !newTermName.trim()) {
      setError(s.t("err_name_country_required", "Name and Location are required."));
      return;
    }
    setSavingTerminal(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/location-terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: newTermLocId,
          name: newTermName.trim(),
          code: newTermCode.trim() || null,
          terminalType: newTermType
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to create gate/terminal");
      setCreatingTerminal(false);
      setNewTermName("");
      setNewTermCode("");
      await loadTerminals();
    } catch (e: any) {
      setError(e.message || "Unable to save gate/terminal");
    } finally {
      setSavingTerminal(false);
    }
  }

  async function handleToggleTerminalStatus(row: TerminalRow) {
    const nextStatus = row.status === "active" ? "inactive" : "active";
    setActingOn(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/erp/location-terminals/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to update status");
      await loadTerminals();
    } catch (e: any) {
      setError(e.message || "Failed to update status");
    } finally {
      setActingOn(null);
    }
  }

  // Tab 3 Actions (Customs Office)
  async function handleCreateCustoms() {
    if (!newCustCountryId || !newCustName.trim()) {
      setError(s.t("err_name_country_required", "Country and Office Name are required."));
      return;
    }
    setSavingCustoms(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/customs-treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId: newCustCountryId,
          locationId: newCustLocId || null,
          gateId: newCustGateId || null,
          officeName: newCustName.trim(),
          officeCode: newCustCode.trim() || null,
          allowedMovements: newCustMovements,
          allowedTreatments: newCustTreatments
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to create customs office");
      setCreatingCustoms(false);
      setNewCustName("");
      setNewCustCode("");
      await loadCustoms();
    } catch (e: any) {
      setError(e.message || "Unable to save customs office");
    } finally {
      setSavingCustoms(false);
    }
  }

  async function handleToggleCustomsStatus(row: CustomsOfficeRow) {
    const nextStatus = row.status === "active" ? "inactive" : "active";
    setActingOn(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/erp/customs-treatments/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to update status");
      await loadCustoms();
    } catch (e: any) {
      setError(e.message || "Failed to update status");
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
      <div dir={s.dir} className="space-y-4">
        {/* Header Console */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white shadow-xs">
                <MapPin className="h-4 w-4" />
              </div>
              <h1 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                {s.t("title", "Central Location Master")}
              </h1>
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
                {s.t("tab_locations", "Location Master")}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                { key: (r) => s.t(`status_${(r as any).status}`, String((r as any).status ?? "")), label: s.t("col_status", "Status"), align: "center", format: "status" }
              ]}
              rows={locationRows as unknown as Record<string, unknown>[]}
              filters={[
                ...(typeFilter ? [{ label: s.t("col_type", "Type"), value: typeLabel(typeFilter) }] : []),
                ...(statusFilter ? [{ label: s.t("col_status", "Status"), value: s.t(`status_${statusFilter}`, statusFilter) }] : [])
              ]}
            />
            <button
              type="button"
              onClick={() => {
                if (activeTab === "locations") void loadLocations();
                else if (activeTab === "terminals") void loadTerminals();
                else if (activeTab === "customs") void loadCustoms();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> {s.t("refresh", "Refresh")}
            </button>
          </div>
        </div>

        {/* 5-Tier Master Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={() => setActiveTab("locations")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
              activeTab === "locations"
                ? "bg-white text-cyan-700 shadow-xs dark:bg-slate-800 dark:text-cyan-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>{s.t("tab_locations", "Location Master")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("terminals")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
              activeTab === "terminals"
                ? "bg-white text-cyan-700 shadow-xs dark:bg-slate-800 dark:text-cyan-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Building className="h-3.5 w-3.5" />
            <span>{s.t("tab_terminals", "Gate / Terminal Master")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("customs")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
              activeTab === "customs"
                ? "bg-white text-cyan-700 shadow-xs dark:bg-slate-800 dark:text-cyan-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>{s.t("tab_customs", "Customs Office & Treatment")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("routes")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
              activeTab === "routes"
                ? "bg-white text-cyan-700 shadow-xs dark:bg-slate-800 dark:text-cyan-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <RouteIcon className="h-3.5 w-3.5" />
            <span>{s.t("tab_routes", "Route Rules & Templates")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("countries")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
              activeTab === "countries"
                ? "bg-white text-cyan-700 shadow-xs dark:bg-slate-800 dark:text-cyan-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{s.t("tab_countries", "Country Master")}</span>
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: LOCATION MASTER */}
        {/* ========================================================================= */}
        {activeTab === "locations" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder={s.t("col_name", "Name")}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-9 w-40 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                />
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">{s.t("col_country", "Country")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">{s.t("filter_all_types", "All Types")}</option>
                  {LOCATION_TYPES.map((tp) => (
                    <option key={tp} value={tp}>{typeLabel(tp)}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">{s.t("filter_all_status", "All Statuses")}</option>
                  {["pending_approval", "active", "inactive", "rejected"].map((st) => (
                    <option key={st} value={st}>{s.t(`status_${st}`, st)}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewLocType("land_border");
                  setNewLocName("");
                  setNewLocCode("");
                  setNewLocCountryId("");
                  setError(null);
                  setCreatingLoc(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500"
              >
                <Plus className="h-3.5 w-3.5" /> {s.t("request_new", "Request New Location")}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[850px] border-separate border-spacing-0 text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_name", "Name")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_type", "Type")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_country", "Country")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_code", "Code")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_status", "Status")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textEnd}`}>{s.t("col_actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">{s.t("loading", "Loading…")}</td></tr>
                  ) : locationRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">{s.t("empty", "No locations found.")}</td></tr>
                  ) : (
                    locationRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-850/40">
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{row.name}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{typeLabel(row.location_type)}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.country?.name || "—"}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">{row.code || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase ${statusBadge(row.status)}`}>
                            {s.t(`status_${row.status}`, row.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-end">
                          <div className="inline-flex items-center gap-1.5">
                            {row.status === "pending_approval" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={actingOn === row.id}
                                  onClick={() => void handleApproval(row.id, "approve")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                >
                                  <Check className="h-3 w-3" /> {s.t("approve", "Approve")}
                                </button>
                                <button
                                  type="button"
                                  disabled={actingOn === row.id}
                                  onClick={() => void handleApproval(row.id, "reject")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                                >
                                  <XIcon className="h-3 w-3" /> {s.t("reject", "Reject")}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={actingOn === row.id}
                                onClick={() => void handleToggleLocationStatus(row)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                                  row.status === "active"
                                    ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                                    : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                }`}
                              >
                                {row.status === "active" ? s.t("deactivate", "Deactivate") : s.t("activate", "Activate")}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal: New Location */}
            {creatingLoc && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-3 backdrop-blur-xs sm:p-6">
                <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                    <h2 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100">{s.t("request_new", "Request New Location")}</h2>
                    <button type="button" onClick={() => setCreatingLoc(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><XIcon className="h-4 w-4" /></button>
                  </div>

                  <label className="block space-y-1.5 text-xs">
                    <span className="text-[11px] font-black uppercase text-slate-500">{s.t("col_type", "Type")}</span>
                    <select
                      value={newLocType}
                      onChange={(e) => setNewLocType(e.target.value as LocationType)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                    >
                      {LOCATION_TYPES.map((tp) => (
                        <option key={tp} value={tp}>{typeLabel(tp)}</option>
                      ))}
                    </select>
                  </label>

                  <SearchSelect
                    label={s.t("col_country", "Country")}
                    value={newLocCountryId}
                    options={countryOptions}
                    onValueChange={setNewLocCountryId}
                  />

                  <label className="block space-y-1.5 text-xs">
                    <span className="text-[11px] font-black uppercase text-slate-500">{s.t("col_name", "Name")}</span>
                    <input
                      value={newLocName}
                      onChange={(e) => setNewLocName(e.target.value)}
                      placeholder={s.t("col_name", "Name")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                    />
                  </label>

                  <label className="block space-y-1.5 text-xs">
                    <span className="text-[11px] font-black uppercase text-slate-500">{s.t("col_code", "Code")} ({s.t("optional", "optional")})</span>
                    <input
                      value={newLocCode}
                      onChange={(e) => setNewLocCode(e.target.value)}
                      placeholder={s.t("col_code", "Code")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                    />
                  </label>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.t("approval_note", "A new location becomes usable across the ERP only after Super Admin or Country Admin approval.")}</p>

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setCreatingLoc(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">
                      {s.t("cancel", "Cancel")}
                    </button>
                    <button type="button" disabled={savingLoc} onClick={() => void handleCreateLocation()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500 disabled:opacity-50">
                      {s.t("submit_request", "Submit Request")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: GATE / TERMINAL MASTER */}
        {/* ========================================================================= */}
        {activeTab === "terminals" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={terminalLocFilter}
                  onChange={(e) => setTerminalLocFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">{s.t("filter_all_types", "All Types")}</option>
                  {locationSelectOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewTermLocId(terminalLocFilter || (locationRows[0]?.id ?? ""));
                  setNewTermName("");
                  setNewTermCode("");
                  setNewTermType("gate");
                  setCreatingTerminal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500"
              >
                <Plus className="h-3.5 w-3.5" /> {s.t("btn_add_gate", "Add Gate / Terminal")}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[850px] border-separate border-spacing-0 text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_name", "Name")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_code", "Code")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_type", "Type")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("tab_locations", "Location Master")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_status", "Status")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textEnd}`}>{s.t("col_actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">{s.t("loading", "Loading…")}</td></tr>
                  ) : terminalRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">{s.t("empty", "No locations found.")}</td></tr>
                  ) : (
                    terminalRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-850/40">
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{row.name}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">{row.code || "—"}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[11px]">{row.terminal_type}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {row.location?.name || "—"}
                          {row.location?.country?.iso2 ? ` (${row.location.country.iso2})` : ""}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase ${statusBadge(row.status)}`}>
                            {s.t(`status_${row.status}`, row.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-end">
                          <button
                            type="button"
                            disabled={actingOn === row.id}
                            onClick={() => void handleToggleTerminalStatus(row)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                              row.status === "active"
                                ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                            }`}
                          >
                            {row.status === "active" ? s.t("deactivate", "Deactivate") : s.t("activate", "Activate")}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal: New Gate / Terminal */}
            {creatingTerminal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-3 backdrop-blur-xs sm:p-6">
                <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                    <h2 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100">{s.t("btn_add_gate", "Add Gate / Terminal")}</h2>
                    <button type="button" onClick={() => setCreatingTerminal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><XIcon className="h-4 w-4" /></button>
                  </div>

                  <SearchSelect
                    label={s.t("tab_locations", "Location Master")}
                    value={newTermLocId}
                    options={locationSelectOptions}
                    onValueChange={setNewTermLocId}
                  />

                  <label className="block space-y-1.5 text-xs">
                    <span className="text-[11px] font-black uppercase text-slate-500">{s.t("col_name", "Name")}</span>
                    <input
                      value={newTermName}
                      onChange={(e) => setNewTermName(e.target.value)}
                      placeholder={s.t("col_name", "Name")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                    />
                  </label>

                  <label className="block space-y-1.5 text-xs">
                    <span className="text-[11px] font-black uppercase text-slate-500">{s.t("col_code", "Code")} ({s.t("optional", "optional")})</span>
                    <input
                      value={newTermCode}
                      onChange={(e) => setNewTermCode(e.target.value)}
                      placeholder={s.t("col_code", "Code")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                    />
                  </label>

                  <label className="block space-y-1.5 text-xs">
                    <span className="text-[11px] font-black uppercase text-slate-500">{s.t("col_type", "Type")}</span>
                    <select
                      value={newTermType}
                      onChange={(e) => setNewTermType(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                    >
                      <option value="gate">{s.t("opt_gate", "Gate")}</option>
                      <option value="terminal">{s.t("opt_terminal", "Terminal")}</option>
                      <option value="berth">{s.t("opt_berth", "Berth")}</option>
                      <option value="platform">{s.t("opt_platform", "Platform")}</option>
                      <option value="depot_gate">{s.t("opt_depot_gate", "Depot Gate")}</option>
                    </select>
                  </label>

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setCreatingTerminal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">
                      {s.t("cancel", "Cancel")}
                    </button>
                    <button type="button" disabled={savingTerminal} onClick={() => void handleCreateTerminal()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500 disabled:opacity-50">
                      {s.t("submit_request", "Submit Request")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CUSTOMS OFFICE & TREATMENT */}
        {/* ========================================================================= */}
        {activeTab === "customs" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={customsCountryFilter}
                  onChange={(e) => setCustomsCountryFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">{s.t("col_country", "Country")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewCustCountryId(customsCountryFilter || (countries[0]?.id ?? ""));
                  setNewCustLocId("");
                  setNewCustGateId("");
                  setNewCustName("");
                  setNewCustCode("");
                  setCreatingCustoms(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500"
              >
                <Plus className="h-3.5 w-3.5" /> {s.t("btn_add_customs", "Add Customs Station")}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[850px] border-separate border-spacing-0 text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_name", "Name")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_code", "Code")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_country", "Country")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("tab_locations", "Location Master")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_status", "Status")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textEnd}`}>{s.t("col_actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">{s.t("loading", "Loading…")}</td></tr>
                  ) : customsRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">{s.t("empty", "No locations found.")}</td></tr>
                  ) : (
                    customsRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-850/40">
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">
                          {row.office_name}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(row.allowed_movements || []).map((m) => (
                              <span key={m} className="rounded-sm bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                {m}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">{row.office_code || "—"}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.country?.name || "—"}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {row.location?.name || "—"}
                          {row.gate?.name ? ` • ${row.gate.name}` : ""}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase ${statusBadge(row.status)}`}>
                            {s.t(`status_${row.status}`, row.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-end">
                          <button
                            type="button"
                            disabled={actingOn === row.id}
                            onClick={() => void handleToggleCustomsStatus(row)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                              row.status === "active"
                                ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                            }`}
                          >
                            {row.status === "active" ? s.t("deactivate", "Deactivate") : s.t("activate", "Activate")}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal: New Customs Office */}
            {creatingCustoms && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-3 backdrop-blur-xs sm:p-6">
                <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                    <h2 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100">{s.t("btn_add_customs", "Add Customs Station")}</h2>
                    <button type="button" onClick={() => setCreatingCustoms(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><XIcon className="h-4 w-4" /></button>
                  </div>

                  <SearchSelect
                    label={s.t("col_country", "Country")}
                    value={newCustCountryId}
                    options={countryOptions}
                    onValueChange={setNewCustCountryId}
                  />

                  <SearchSelect
                    label={s.t("tab_locations", "Location Master")}
                    value={newCustLocId}
                    options={[{ value: "", label: s.t("optional", "optional") }, ...locationSelectOptions]}
                    onValueChange={setNewCustLocId}
                  />

                  <label className="block space-y-1.5 text-xs">
                    <span className="text-[11px] font-black uppercase text-slate-500">{s.t("col_name", "Name")}</span>
                    <input
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      placeholder={s.t("col_name", "Name")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                    />
                  </label>

                  <label className="block space-y-1.5 text-xs">
                    <span className="text-[11px] font-black uppercase text-slate-500">{s.t("col_code", "Code")} ({s.t("optional", "optional")})</span>
                    <input
                      value={newCustCode}
                      onChange={(e) => setNewCustCode(e.target.value)}
                      placeholder={s.t("col_code", "Code")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                    />
                  </label>

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setCreatingCustoms(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">
                      {s.t("cancel", "Cancel")}
                    </button>
                    <button type="button" disabled={savingCustoms} onClick={() => void handleCreateCustoms()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500 disabled:opacity-50">
                      {s.t("submit_request", "Submit Request")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ROUTE RULES & TEMPLATES */}
        {/* ========================================================================= */}
        {activeTab === "routes" && (
          <div className="space-y-4">
            {/* Visual Route Rules Blueprint Card */}
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-cyan-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-950 dark:text-blue-200">
                {s.t("tab_routes", "Route Rules & Templates")}
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="rounded-xl border border-blue-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <span className="font-bold text-blue-700 dark:text-blue-400">1. Road Mode</span>
                  <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    Country → Border → Gate → Customs
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <span className="font-bold text-indigo-700 dark:text-indigo-400">2. Sea Mode</span>
                  <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    Country → Port → Customs → BL / Vessel
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <span className="font-bold text-cyan-700 dark:text-cyan-400">3. Air Mode</span>
                  <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    Country → Airport → Flight / AWB → Customs
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <span className="font-bold text-purple-700 dark:text-purple-400">4. Rail Mode</span>
                  <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    Country → Rail Terminal → Wagon → Customs
                  </div>
                </div>
              </div>
            </div>

            {/* Embedded Reusable Route Templates */}
            <RouteTemplatesView lang={langProp} />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: COUNTRY MASTER */}
        {/* ========================================================================= */}
        {activeTab === "countries" && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[700px] border-separate border-spacing-0 text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_country", "Country")}</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>ISO2 / ISO3</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>Currency</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>Phone</Th>
                    <Th className={`px-3 py-2.5 ${s.textStart}`}>{s.t("col_status", "Status")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-850/40">
                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{c.name}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {c.iso2 || "—"} / {c.iso3 || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{c.currency_code || "—"}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{c.phone_code || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase ${statusBadge(c.is_active ? "active" : "inactive")}`}>
                          {s.t(c.is_active ? "status_active" : "status_inactive", c.is_active ? "Active" : "Inactive")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ReviewMarker>
  );
}
