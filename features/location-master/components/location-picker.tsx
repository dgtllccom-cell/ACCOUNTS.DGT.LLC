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

import { useEffect, useState } from "react";
import { SearchSelect } from "@/components/ui/search-select";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { listCities, type LocationCity } from "@/features/locations/location-api";

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
};

export function LocationPicker({ countryId, transportMode, value, onChange, label, disabled }: LocationPickerProps) {
  const lang = useActiveLanguage();
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [loading, setLoading] = useState(false);

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
        const results = await Promise.all(
          types.map(async (type) => {
            const res = await fetch(`/api/erp/location-master?type=${type}&countryId=${countryId}&status=active`);
            const json = await res.json();
            return (json?.data?.locations || []) as LocationOption[];
          })
        );
        if (cancelled) return;
        setOptions(results.flat());

        if (transportMode === "by_road") {
          const cityRows = await listCities({ countryId });
          if (!cancelled) setCities(cityRows);
        } else {
          setCities([]);
        }
      } catch {
        if (!cancelled) {
          setOptions([]);
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
  }, [countryId, transportMode]);

  const searchOptions = [
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

  return (
    <SearchSelect
      label={label ?? t(lang, "locmaster.picker_label", "Location")}
      value={value ?? ""}
      options={searchOptions}
      loading={loading}
      disabled={disabled || !countryId || !transportMode}
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
        const match = options.find((o) => o.id === val);
        onChange(val, match?.name ?? "");
      }}
    />
  );
}

// ── Companion: Gate / Terminal Picker ─────────────────────────────────────────
export type GatePickerProps = {
  locationId: string | null | undefined;
  value?: string;
  onChange: (gateId: string, name: string) => void;
  label?: string;
  disabled?: boolean;
};

export function GatePicker({ locationId, value, onChange, label, disabled }: GatePickerProps) {
  const lang = useActiveLanguage();
  const [gates, setGates] = useState<Array<{ id: string; name: string; code: string | null; terminal_type: string }>>([]);
  const [loading, setLoading] = useState(false);

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
  }, [locationId]);

  const searchOptions = gates.map((g) => ({
    value: g.id,
    label: g.name,
    description: `${g.terminal_type}${g.code ? ` • ${g.code}` : ""}`
  }));

  return (
    <SearchSelect
      label={label ?? t(lang, "com.customs_gate", "Customs Gate")}
      value={value ?? ""}
      options={searchOptions}
      loading={loading}
      disabled={disabled || !locationId || locationId.startsWith("city:") || searchOptions.length === 0}
      placeholder={
        !locationId
          ? t(lang, "locmaster.picker_placeholder", "Select a location")
          : searchOptions.length === 0
            ? t(lang, "locmaster.empty", "No locations found.")
            : t(lang, "com.customs_gate", "Customs Gate")
      }
      onValueChange={(val) => {
        const match = gates.find((g) => g.id === val);
        onChange(val, match?.name ?? "");
      }}
    />
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
  value?: string;
  onChange: (officeId: string, office: CustomsOfficeRecord | null) => void;
  label?: string;
  disabled?: boolean;
};

export function CustomsOfficePicker({ countryId, locationId, value, onChange, label, disabled }: CustomsOfficePickerProps) {
  const lang = useActiveLanguage();
  const [offices, setOffices] = useState<CustomsOfficeRecord[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, [countryId, locationId]);

  const searchOptions = offices.map((o) => ({
    value: o.id,
    label: o.office_name,
    description: o.office_code || t(lang, "com.customs_clearance_point", "Customs Clearance Point / Port")
  }));

  return (
    <SearchSelect
      label={label ?? t(lang, "com.customs_clearance_point", "Customs Clearance Point / Port")}
      value={value ?? ""}
      options={searchOptions}
      loading={loading}
      disabled={disabled || !countryId || searchOptions.length === 0}
      placeholder={
        !countryId
          ? t(lang, "locmaster.picker_select_country_first", "Select a country first")
          : searchOptions.length === 0
            ? t(lang, "locmaster.empty", "No locations found.")
            : t(lang, "com.customs_clearance_point", "Customs Clearance Point / Port")
      }
      onValueChange={(val) => {
        const match = offices.find((o) => o.id === val);
        onChange(val, match ?? null);
      }}
    />
  );
}
