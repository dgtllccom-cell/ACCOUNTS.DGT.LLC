"use client";

/**
 * Mode-aware picker over the Central Location Master (erp_locations). Given a
 * country + transport mode, shows only the relevant location types per the
 * Dynamic Location & Route Management spec:
 *   by_sea  -> seaport
 *   by_road -> land_border, warehouse  (+ Cities via the existing world-hierarchy
 *              city endpoint, see below — cities are NOT duplicated into
 *              erp_locations, see supabase/migrations/20260922_dynamic_location_route_master.sql)
 *   by_air  -> airport
 *   by_rail -> railway_terminal
 *
 * Mirrors WarehousePicker's as-is-reuse convention (features/warehouses/components/warehouse-picker.tsx).
 */

import { useEffect, useState } from "react";
import { SearchSelect } from "@/components/ui/search-select";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { listCities, type LocationCity } from "@/features/locations/location-api";

export type LegTransportMode = "by_sea" | "by_road" | "by_air" | "by_rail";

const TYPES_BY_MODE: Record<LegTransportMode, string[]> = {
  by_sea: ["seaport"],
  by_road: ["land_border", "warehouse"],
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

        // "By Road" also offers real Cities from the existing world-hierarchy
        // endpoint (not duplicated into erp_locations — see module doc comment).
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
