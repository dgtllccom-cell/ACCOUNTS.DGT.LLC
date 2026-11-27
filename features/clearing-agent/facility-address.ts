/**
 * Display text of an "other / third-party" facility (delivery / loading) address.
 *
 * The facility's Country / State / City come from the Location Management Master and are stored as ids
 * (clearing_customer_order_loading_allocations.source_*_id). The row also keeps one display text, built as
 *
 *     "<detailed address typed by the user> | <city>, <state>, <postal code>, <country>"
 *
 * so lists, reports and older readers keep showing a complete address. When the row is reopened the text is split
 * at the LAST " | " and only the detail goes back into the input — the place line is rebuilt from the master, so
 * re-saving never duplicates it. Older rows (no separator) are pure detail text.
 */

export const FACILITY_ADDRESS_SEPARATOR = " | ";

export function composeFacilityAddress(input: {
  detail?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  /** previously saved place line, used when the master names have not been (re)loaded */
  fallbackPlaceLine?: string | null;
}): string {
  const clean = (v?: string | null) => (v ?? "").replace(/\s*\|\s*/g, " ").replace(/\s+/g, " ").trim();
  const detail = clean(input.detail);
  const parts = [input.city, input.state, input.postalCode, input.country].map(clean).filter(Boolean);
  const place = parts.length ? parts.join(", ") : clean(input.fallbackPlaceLine);
  if (detail && place) return `${detail}${FACILITY_ADDRESS_SEPARATOR}${place}`;
  return detail || place;
}

export function splitFacilityAddress(text: string | null | undefined): { detail: string; place: string } {
  const value = (text ?? "").trim();
  const at = value.lastIndexOf(FACILITY_ADDRESS_SEPARATOR);
  if (at < 0) return { detail: value, place: "" };
  return { detail: value.slice(0, at).trim(), place: value.slice(at + FACILITY_ADDRESS_SEPARATOR.length).trim() };
}
