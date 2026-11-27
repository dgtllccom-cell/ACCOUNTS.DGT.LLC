"use client";

/**
 * Mode-aware picker over the Central Location Master (erp_locations).
 * Also exports GatePicker (erp_location_terminals) and CustomsOfficePicker (erp_customs_treatments).
 *
 * Mode mapping:
 *   by_sea  -> seaport, free_zone
 *   by_road -> land_border, warehouse, inland_depot (+ world-hierarchy cities)
 *   by_air  -> airport
 *   by_rail -> railway_terminal
 */

import React, { useEffect, useRef, useState } from "react";
import { SearchSelect } from "@/components/ui/search-select";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { listCities, type LocationCity } from "@/features/locations/location-api";
import {
  QuickLocationModal,
  QuickGateModal,
  QuickCustomsOfficeModal
} from "./quick-location-modals";

export type LegTransportMode = "by_sea" | "by_road" | "by_air" | "by_rail";

const TYPES_BY_MODE: Record<LegTransportMode, string[]> = {
  by_sea: ["seaport", "free_zone"],
  by_road: ["land_border", "warehouse", "inland_depot"],
  by_air: ["airport"],
  by_rail: ["railway_terminal"]
};

type LocationOption = {
  id: string;
  name: string;
  location_type: string;
  code: string | null;
};

export type LocationPickerProps = {
  countryId: string | null | undefined;
  transportMode: LegTransportMode | "" | null | undefined;
  value?: string;
  onChange: (locationId: string, name: string) => void;
  label?: string;
  disabled?: boolean;
  includeCities?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
  enableQuickCreate?: boolean;
  refreshKey?: number | string;
  /**
   * Legacy records that saved only a NAME (no id): the picker preselects the option whose
   * name matches (case-insensitive, canonical or localized) and reports it via onResolveName.
   * If nothing matches, the saved name is still shown so old bookings display unchanged.
   */
  valueName?: string;
  onResolveName?: (locationId: string, name: string) => void;
  /** Report the canonical (unlocalized) master name in onChange instead of the display label. */
  canonicalNames?: boolean;
  testId?: string;
};

export const LEGACY_LOCATION_PREFIX = "legacy:";
const norm = (v: string | null | undefined) => String(v ?? "").trim().toLowerCase();

export function LocationPicker({
  countryId,
  transportMode,
  value,
  onChange,
  label,
  disabled,
  includeCities = false,
  onAddNew,
  addNewLabel,
  enableQuickCreate = true,
  refreshKey,
  valueName,
  onResolveName,
  canonicalNames = false,
  testId
}: LocationPickerProps) {
  const lang = useActiveLanguage();
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [rawNames, setRawNames] = useState<Record<string, string>>({});
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!countryId || !transportMode) {
        setOptions([]);
        setCities([]);
        return;
      }
      setLoading(true);
      try {
        const types = TYPES_BY_MODE[transportMode as LegTransportMode] || [];
        const fetchType = async (type: string, raw: boolean) => {
          const res = await fetch(`/api/erp/location-master?type=${type}&countryId=${countryId}&status=active${raw ? "&raw=1" : ""}`);
          const json = await res.json();
          return (json?.data?.locations || []) as LocationOption[];
        };
        const [results, rawResults] = await Promise.all([
          Promise.all(types.map((type) => fetchType(type, false))),
          canonicalNames && lang !== "en" ? Promise.all(types.map((type) => fetchType(type, true))) : Promise.resolve(null)
        ]);
        if (cancelled) return;
        const flat = results.flat();
        setOptions(flat);
        const names: Record<string, string> = {};
        for (const o of rawResults ? rawResults.flat() : flat) names[o.id] = o.name;
        setRawNames(names);

        if (includeCities && transportMode === "by_road") {
          const cityRows = await listCities({ countryId });
          if (!cancelled) setCities(cityRows);
        } else {
          setCities([]);
        }
      } catch {
        if (!cancelled) {
          setOptions([]);
          setRawNames({});
          setCities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [countryId, transportMode, includeCities, refreshKey, localRefresh, canonicalNames, lang]);

  const nameOf = (o: LocationOption) => (canonicalNames ? rawNames[o.id] || o.name : o.name);
  const legacyName = !value && valueName ? valueName.trim() : "";
  const legacyMatch = legacyName
    ? options.find((o) => norm(o.name) === norm(legacyName) || norm(rawNames[o.id]) === norm(legacyName))
    : undefined;
  const resolvedFor = useRef("");
  useEffect(() => {
    if (!legacyMatch || !onResolveName) return;
    const key = `${legacyName}|${legacyMatch.id}`;
    if (resolvedFor.current === key) return;
    resolvedFor.current = key;
    onResolveName(legacyMatch.id, legacyName);
  }, [legacyMatch, legacyName, onResolveName]);
  const legacyValue = legacyName && !legacyMatch ? `${LEGACY_LOCATION_PREFIX}${legacyName}` : "";
  const effectiveValue = value || legacyMatch?.id || legacyValue;

  const searchOptions = [
    ...(legacyValue
      ? [{ value: legacyValue, label: legacyName, description: t(lang, "locmaster.route_saved_legacy", "Saved name (not in Location Master)") }]
      : []),
    ...options.map((o) => ({
      value: o.id,
      label: o.name,
      description: `${o.location_type}${o.code ? ` • ${o.code}` : ""}`
    })),
    ...cities.map((c) => ({
      value: `city:${c.id}`,
      label: c.name,
      description: t(lang, "locmaster.type_city", "City")
    }))
  ];

  const handleCreateNew = onAddNew
    ? onAddNew
    : enableQuickCreate
      ? () => setQuickCreateOpen(true)
      : undefined;

  const defaultCreateLabel =
    addNewLabel ??
    (transportMode === "by_sea"
      ? t(lang, "locmaster.add_new_port", "+ Add New Port")
      : t(lang, "locmaster.add_new_border", "+ Add New Border / Location"));

  return (
    <>
      <span data-testid={testId} className="contents">
      <SearchSelect
        label={label ?? t(lang, "locmaster.picker_label", "Location")}
        value={effectiveValue ?? ""}
        options={searchOptions}
        loading={loading}
        disabled={disabled || !countryId || !transportMode}
        createButtonPlacement="inside"
        createLabel={defaultCreateLabel}
        onCreateNew={handleCreateNew}
        placeholder={
          !countryId
            ? t(lang, "locmaster.picker_select_country_first", "Select a country first")
            : !transportMode
              ? t(lang, "locmaster.picker_select_mode_first", "Select a transport mode first")
              : t(lang, "locmaster.picker_placeholder", "Select a location")
        }
        onValueChange={(val) => {
          const cityMatch = cities.find((c) => `city:${c.id}` === val);
          if (cityMatch) {
            onChange(val, cityMatch.name);
            return;
          }
          if (val.startsWith(LEGACY_LOCATION_PREFIX)) {
            onChange("", val.slice(LEGACY_LOCATION_PREFIX.length));
            return;
          }
          const match = options.find((o) => o.id === val);
          onChange(val, match ? nameOf(match) : "");
        }}
      />
      </span>

      {quickCreateOpen && (
        <QuickLocationModal
          open={quickCreateOpen}
          onClose={() => setQuickCreateOpen(false)}
          countryId={countryId}
          transportMode={transportMode}
          onSaved={(newLoc) => {
            setLocalRefresh((k) => k + 1);
            onChange(newLoc.id, newLoc.name);
          }}
        />
      )}
    </>
  );
}

// ── Companion: Gate / Terminal Picker ─────────────────────────────────────────
export type GatePickerProps = {
  locationId: string | null | undefined;
  locationName?: string | null;
  value?: string;
  onChange: (gateId: string, name: string) => void;
  label?: string;
  disabled?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
  enableQuickCreate?: boolean;
  refreshKey?: number | string;
};

export function GatePicker({
  locationId,
  locationName,
  value,
  onChange,
  label,
  disabled,
  onAddNew,
  addNewLabel,
  enableQuickCreate = true,
  refreshKey
}: GatePickerProps) {
  const lang = useActiveLanguage();
  const [gates, setGates] = useState<Array<{ id: string; name: string; code: string | null; terminal_type: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!locationId || locationId.startsWith("city:")) {
        setGates([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/erp/location-terminals?locationId=${locationId}&status=active`);
        const json = await res.json();
        if (!cancelled) setGates(json?.data?.terminals || []);
      } catch {
        if (!cancelled) setGates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [locationId, refreshKey, localRefresh]);

  const searchOptions = gates.map((g) => ({
    value: g.id,
    label: g.name,
    description: `${g.terminal_type}${g.code ? ` • ${g.code}` : ""}`
  }));

  const handleCreateNew = onAddNew
    ? onAddNew
    : enableQuickCreate
      ? () => setQuickCreateOpen(true)
      : undefined;

  const defaultCreateLabel = addNewLabel ?? t(lang, "locmaster.add_new_gate", "+ Add New Gate / Terminal");

  return (
    <>
      <SearchSelect
        label={label ?? t(lang, "com.customs_gate", "Customs Gate")}
        value={value ?? ""}
        options={searchOptions}
        loading={loading}
        disabled={disabled || !locationId || locationId.startsWith("city:") || (searchOptions.length === 0 && !handleCreateNew)}
        createButtonPlacement="inside"
        createLabel={defaultCreateLabel}
        onCreateNew={handleCreateNew}
        placeholder={
          !locationId
            ? t(lang, "locmaster.picker_placeholder", "Select a location")
            : searchOptions.length === 0 && !handleCreateNew
              ? t(lang, "locmaster.empty", "No locations found.")
              : t(lang, "com.customs_gate", "Customs Gate / Terminal")
        }
        onValueChange={(val) => {
          const match = gates.find((g) => g.id === val);
          onChange(val, match?.name ?? "");
        }}
      />

      {quickCreateOpen && (
        <QuickGateModal
          open={quickCreateOpen}
          onClose={() => setQuickCreateOpen(false)}
          locationId={locationId}
          locationName={locationName}
          onSaved={(newGate) => {
            setLocalRefresh((k) => k + 1);
            onChange(newGate.id, newGate.name);
          }}
        />
      )}
    </>
  );
}

// ── Companion: Customs Office Picker ──────────────────────────────────────────
export type CustomsOfficeRecord = {
  id: string;
  office_name: string;
  office_code: string | null;
  allowed_movements: string[];
  allowed_treatments: string[];
};

export type CustomsOfficePickerProps = {
  countryId: string | null | undefined;
  locationId?: string | null | undefined;
  locationName?: string | null;
  value?: string;
  onChange: (officeId: string, office: CustomsOfficeRecord | null) => void;
  label?: string;
  disabled?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
  enableQuickCreate?: boolean;
  refreshKey?: number | string;
};

export function CustomsOfficePicker({
  countryId,
  locationId,
  locationName,
  value,
  onChange,
  label,
  disabled,
  onAddNew,
  addNewLabel,
  enableQuickCreate = true,
  refreshKey
}: CustomsOfficePickerProps) {
  const lang = useActiveLanguage();
  const [offices, setOffices] = useState<CustomsOfficeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!countryId) {
        setOffices([]);
        return;
      }
      setLoading(true);
      try {
        const qs = new URLSearchParams({ countryId, status: "active" });
        if (locationId && !locationId.startsWith("city:")) {
          qs.set("locationId", locationId);
        }
        const res = await fetch(`/api/erp/customs-treatments?${qs.toString()}`);
        const json = await res.json();
        let list: CustomsOfficeRecord[] = json?.data?.offices || [];
        // If no office found for specific location, fall back to country-wide customs
        if (list.length === 0 && locationId) {
          const resFallback = await fetch(`/api/erp/customs-treatments?countryId=${countryId}&status=active`);
          const jsonFallback = await resFallback.json();
          list = jsonFallback?.data?.offices || [];
        }
        if (!cancelled) setOffices(list);
      } catch {
        if (!cancelled) setOffices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [countryId, locationId, refreshKey, localRefresh]);

  const searchOptions = offices.map((o) => ({
    value: o.id,
    label: o.office_name,
    description: o.office_code || t(lang, "com.customs_clearance_point", "Customs Clearance Point / Port")
  }));

  const handleCreateNew = onAddNew
    ? onAddNew
    : enableQuickCreate
      ? () => setQuickCreateOpen(true)
      : undefined;

  const defaultCreateLabel = addNewLabel ?? t(lang, "locmaster.add_new_customs_office", "+ Add New Customs Office");

  return (
    <>
      <SearchSelect
        label={label ?? t(lang, "com.customs_clearance_point", "Customs Clearance Point / Port")}
        value={value ?? ""}
        options={searchOptions}
        loading={loading}
        disabled={disabled || !countryId || (searchOptions.length === 0 && !handleCreateNew)}
        createButtonPlacement="inside"
        createLabel={defaultCreateLabel}
        onCreateNew={handleCreateNew}
        placeholder={
          !countryId
            ? t(lang, "locmaster.picker_select_country_first", "Select a country first")
            : searchOptions.length === 0 && !handleCreateNew
              ? t(lang, "locmaster.empty", "No locations found.")
              : t(lang, "com.customs_clearance_point", "Customs Clearance Point / Port")
        }
        onValueChange={(val) => {
          const match = offices.find((o) => o.id === val);
          onChange(val, match ?? null);
        }}
      />

      {quickCreateOpen && (
        <QuickCustomsOfficeModal
          open={quickCreateOpen}
          onClose={() => setQuickCreateOpen(false)}
          countryId={countryId}
          locationId={locationId}
          locationName={locationName}
          onSaved={(newOffice) => {
            setLocalRefresh((k) => k + 1);
            onChange(newOffice.id, {
              id: newOffice.id,
              office_name: newOffice.office_name,
              office_code: newOffice.office_code,
              allowed_movements: ["import", "export", "transit", "re_export"],
              allowed_treatments: []
            });
          }}
        />
      )}
    </>
  );
}

