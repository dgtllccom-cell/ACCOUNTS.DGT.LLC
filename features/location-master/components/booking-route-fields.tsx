"use client";

/**
 * Booking route fields — ONE shared Country → Port / Border / Airport picker over the
 * Settings "Route & Location Master" (erp_locations), used by:
 *   Purchase Booking, Sales Booking, Purchase Loading entry and Sales Loading entry.
 *
 * - Shipping mode ("By Sea" / "By Road" / "By Air" / "By Rail" …) maps to the LocationPicker
 *   leg mode, so a country shows its seaports (sea), land borders (road) or airports (air).
 * - Changing the country clears the port/border.
 * - Callers keep saving the NAME fields reports/print/transfer read, plus the master ids.
 * - Legacy records that only carry names are preselected by name match (country by name /
 *   ISO code, location by name); when nothing matches the saved name is still displayed.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SearchSelect } from "@/components/ui/search-select";
import { t, type UiKey } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { LocationPicker, LEGACY_LOCATION_PREFIX, type LegTransportMode } from "./location-picker";

export type RouteLeg = {
  countryId: string;
  countryName: string;
  locationId: string;
  locationName: string;
};

export type RouteCountry = { id: string; name: string; iso2?: string | null; iso3?: string | null };

export const EMPTY_ROUTE_LEG: RouteLeg = { countryId: "", countryName: "", locationId: "", locationName: "" };

/** "By Sea" / "By Ship" → by_sea, "By Road" / truck / local → by_road, "By Air" → by_air, rail/train → by_rail. */
export function shippingModeToLegMode(mode: string | null | undefined): LegTransportMode {
  const m = String(mode ?? "").trim().toLowerCase();
  if (/air|flight/.test(m)) return "by_air";
  if (/rail|train/.test(m)) return "by_rail";
  if (/road|truck|land|local/.test(m)) return "by_road";
  return "by_sea";
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Resolve a country by id first, then by (canonical or localized) name or ISO code. */
export function matchCountry(
  countries: RouteCountry[],
  ref: { id?: string | null; name?: string | null },
  localizedNames: Record<string, string> = {}
): RouteCountry | undefined {
  if (ref.id) {
    const byId = countries.find((c) => c.id === ref.id);
    if (byId) return byId;
  }
  const name = norm(ref.name);
  if (!name) return undefined;
  return countries.find(
    (c) => norm(c.name) === name || norm(localizedNames[c.id]) === name || norm(c.iso2) === name || norm(c.iso3) === name
  );
}

/** Text a route leg carries for the existing NAME readers, plus the new master ids. */
export function routeLegFrom(source: Record<string, unknown> | null | undefined, keys: {
  countryId: string; country: string[]; locationId: string; location: string[];
}): RouteLeg {
  const s = source || {};
  const first = (list: string[]) => list.map((k) => String(s[k] ?? "").trim()).find(Boolean) || "";
  return {
    countryId: String(s[keys.countryId] ?? ""),
    countryName: first(keys.country),
    locationId: String(s[keys.locationId] ?? ""),
    locationName: first(keys.location)
  };
}

type CountryLists = { canonical: RouteCountry[]; localized: Record<string, string> };
const countryCache = new Map<string, Promise<CountryLists>>();

async function fetchCountries(lang: string): Promise<CountryLists> {
  const read = async (l: string) => {
    const res = await fetch(`/api/erp/locations/countries?all=true&limit=500&lang=${l}`);
    const json = await res.json().catch(() => ({}));
    const list = json?.data?.countries || json?.countries;
    return (Array.isArray(list) ? list : []) as RouteCountry[];
  };
  // Canonical (English) names are what the booking saves and what legacy rows hold;
  // the localized list only supplies the display label.
  const [canonical, localizedList] = await Promise.all([read("en"), lang === "en" ? Promise.resolve(null) : read(lang)]);
  const localized: Record<string, string> = {};
  for (const c of localizedList || []) if (c?.id && c?.name) localized[c.id] = c.name;
  return { canonical: canonical.filter((c) => c && c.id), localized };
}

export function loadRouteCountries(lang: string): Promise<CountryLists> {
  let pending = countryCache.get(lang);
  if (!pending) {
    pending = fetchCountries(lang).catch(() => {
      countryCache.delete(lang);
      return { canonical: [], localized: {} };
    });
    countryCache.set(lang, pending);
  }
  return pending;
}

/** Test hook: drop the module-level country cache. */
export function resetRouteCountryCache() {
  countryCache.clear();
}

const LOCATION_LABELS: Record<"loading" | "receiving", Record<LegTransportMode, [UiKey, string]>> = {
  loading: {
    by_sea: ["locmaster.route_loading_port", "Loading Port"],
    by_road: ["locmaster.route_loading_border", "Loading Border"],
    by_air: ["locmaster.route_loading_airport", "Loading Airport"],
    by_rail: ["locmaster.route_loading_rail", "Loading Rail Terminal"]
  },
  receiving: {
    by_sea: ["locmaster.route_receiving_port", "Receiving Port"],
    by_road: ["locmaster.route_receiving_border", "Receiving Border"],
    by_air: ["locmaster.route_receiving_airport", "Receiving Airport"],
    by_rail: ["locmaster.route_receiving_rail", "Receiving Rail Terminal"]
  }
};
const COUNTRY_LABELS: Record<"loading" | "receiving", [UiKey, string]> = {
  loading: ["locmaster.route_loading_country", "Loading Country"],
  receiving: ["locmaster.route_receiving_country", "Receiving Country"]
};

export type BookingRouteFieldsProps = {
  side: "loading" | "receiving";
  shippingMode: string | null | undefined;
  value: RouteLeg;
  onChange: (next: RouteLeg) => void;
  countryLabel?: string;
  locationLabel?: string;
  disabled?: boolean;
  /** Prefix for data-testid hooks ("<prefix>-country", "<prefix>-location"). */
  testId?: string;
  className?: string;
  /** Optional pre-loaded countries (tests / callers that already hold the list). */
  countries?: RouteCountry[];
};

export function BookingRouteFields({
  side,
  shippingMode,
  value,
  onChange,
  countryLabel,
  locationLabel,
  disabled,
  testId,
  className,
  countries: countriesProp
}: BookingRouteFieldsProps) {
  const lang = useActiveLanguage();
  const [lists, setLists] = useState<CountryLists>({ canonical: countriesProp || [], localized: {} });
  const [loading, setLoading] = useState(!countriesProp);
  const mode = shippingModeToLegMode(shippingMode);

  useEffect(() => {
    if (countriesProp) {
      setLists({ canonical: countriesProp, localized: {} });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadRouteCountries(lang).then((next) => {
      if (!cancelled) {
        setLists(next);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lang, countriesProp]);

  const current = value || EMPTY_ROUTE_LEG;
  const matched = useMemo(
    () => matchCountry(lists.canonical, { id: current.countryId, name: current.countryName }, lists.localized),
    [lists, current.countryId, current.countryName]
  );
  const legacyCountry = !matched && current.countryName ? current.countryName : "";
  const countryValue = matched?.id || (legacyCountry ? `${LEGACY_LOCATION_PREFIX}${legacyCountry}` : "");

  // Latest value/onChange for the async legacy-resolution callbacks below.
  const latest = useRef({ current, onChange });
  latest.current = { current, onChange };

  // Legacy name-only bookings: once the master list resolves the saved name, store its id
  // (the saved NAME is kept exactly as it was).
  useEffect(() => {
    if (disabled || !matched || current.countryId === matched.id) return;
    if (current.countryId && lists.canonical.some((c) => c.id === current.countryId)) return;
    latest.current.onChange({ ...latest.current.current, countryId: matched.id });
  }, [disabled, matched, current.countryId, lists.canonical]);

  // Switching the shipping mode (sea → road / air …) invalidates a port picked for the old mode.
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    const { current: leg, onChange: emit } = latest.current;
    if (!disabled && (leg.locationId || leg.locationName)) emit({ ...leg, locationId: "", locationName: "" });
  }, [mode, disabled]);

  const countryOptions = useMemo(() => {
    const opts = lists.canonical
      .map((c) => {
        const display = lists.localized[c.id] || c.name;
        return { value: c.id, label: `${display}${c.iso2 ? ` (${c.iso2})` : ""}`, keywords: [c.name, c.iso2, c.iso3].filter(Boolean).join(" ") };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    if (legacyCountry) {
      opts.unshift({ value: `${LEGACY_LOCATION_PREFIX}${legacyCountry}`, label: legacyCountry, keywords: legacyCountry });
    }
    return opts;
  }, [lists, legacyCountry]);

  const [locKey, locFallback] = LOCATION_LABELS[side][mode];
  const sideCountry = COUNTRY_LABELS[side];

  return (
    <div className={className ?? "grid grid-cols-1 gap-2 sm:grid-cols-2"} data-testid={testId} data-route-mode={mode}>
      <div data-testid={testId ? `${testId}-country` : undefined} className="min-w-0">
        <SearchSelect
          label={countryLabel ?? t(lang, sideCountry[0], sideCountry[1])}
          value={countryValue}
          options={countryOptions}
          loading={loading}
          disabled={disabled}
          placeholder={t(lang, "locmaster.route_select_country", "Select Country")}
          onValueChange={(val) => {
            if (val.startsWith(LEGACY_LOCATION_PREFIX)) return;
            const picked = lists.canonical.find((c) => c.id === val);
            if ((picked?.id || "") === (matched?.id || "") && val) return;
            // A new country always clears the port / border chosen for the old one.
            onChange({ countryId: picked?.id || "", countryName: picked?.name || "", locationId: "", locationName: "" });
          }}
        />
      </div>
      <div className="min-w-0">
        <LocationPicker
          testId={testId ? `${testId}-location` : undefined}
          countryId={matched?.id || ""}
          transportMode={mode}
          value={current.locationId}
          valueName={current.locationId ? undefined : current.locationName}
          canonicalNames
          disabled={disabled}
          label={locationLabel ?? t(lang, locKey, locFallback)}
          onResolveName={
            disabled
              ? undefined
              : (locationId) => latest.current.onChange({ ...latest.current.current, countryId: matched?.id || latest.current.current.countryId, locationId })
          }
          onChange={(locationId, name) => {
            onChange({
              ...current,
              countryId: matched?.id || current.countryId,
              locationId: locationId.startsWith("city:") ? "" : locationId,
              locationName: name
            });
          }}
        />
      </div>
    </div>
  );
}
