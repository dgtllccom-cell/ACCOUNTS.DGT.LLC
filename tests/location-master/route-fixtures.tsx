import React from "react";

/** Fixture Route & Location Master (no database): two countries with sea ports, land borders and an airport. */
export const ROUTE_COUNTRIES = [
  { id: "c-ae", name: "United Arab Emirates", iso2: "AE", iso3: "ARE" },
  { id: "c-pk", name: "Pakistan", iso2: "PK", iso3: "PAK" },
];
export const ROUTE_LOCATIONS: Record<string, Record<string, { id: string; name: string; location_type: string; code: string | null }[]>> = {
  "c-ae": {
    seaport: [{ id: "l-jea", name: "Jebel Ali Port", location_type: "seaport", code: "AEJEA" }],
    land_border: [{ id: "l-hatta", name: "Hatta Border", location_type: "land_border", code: null }],
    airport: [{ id: "l-dxb", name: "Dubai International Airport", location_type: "airport", code: "DXB" }],
  },
  "c-pk": {
    seaport: [{ id: "l-khi", name: "Karachi Port", location_type: "seaport", code: "PKKHI" }],
    land_border: [{ id: "l-tor", name: "Torkham Border", location_type: "land_border", code: null }],
  },
};

/** Returns route-master data for the two endpoints the shared picker reads, or null for anything else. */
export function routeMasterResponse(input: string): Record<string, unknown> | null {
  const url = new URL(input, "http://localhost");
  if (url.pathname.endsWith("/locations/countries")) return { countries: ROUTE_COUNTRIES };
  if (url.pathname.endsWith("/location-master")) {
    const country = url.searchParams.get("countryId") || "";
    const type = url.searchParams.get("type") || "";
    return { locations: ROUTE_LOCATIONS[country]?.[type] || [] };
  }
  return null;
}

/** Plain <select> stand-in for the shared SearchSelect popover so tests can pick options. */
export function NativeSearchSelect(props: {
  label?: string; value: string; placeholder?: string; disabled?: boolean;
  options: { value: string; label: string }[]; onValueChange: (v: string) => void;
}) {
  return (
    <label>
      {props.label}
      <select aria-label={props.label} value={props.value} disabled={props.disabled} onChange={(e) => props.onValueChange(e.target.value)}>
        <option value="">{props.placeholder}</option>
        {props.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
