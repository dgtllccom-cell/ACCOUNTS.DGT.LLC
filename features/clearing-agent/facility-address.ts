const placeSeparator = " | ";

export function formatFacilityAddress(detail: string, place: string, postalCode: string): string {
  const postalPlace = [place.trim(), postalCode.trim()].filter(Boolean).join(", ");
  return [detail.trim(), postalPlace].filter(Boolean).join(placeSeparator);
}

/** Recover the saved place label while the location picker loads its selected IDs. */
export function savedFacilityPlace(display?: string, detail?: string, postalCode?: string): string {
  if (!display || detail === undefined) return "";
  const prefix = detail ? detail + placeSeparator : "";
  if (detail && !display.startsWith(prefix)) return "";
  const place = display.slice(prefix.length);
  if (!postalCode) return place;
  if (place === postalCode) return "";
  const postalSuffix = ", " + postalCode;
  return place.endsWith(postalSuffix) ? place.slice(0, -postalSuffix.length) : place;
}
