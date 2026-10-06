// Shared fuzzy person-name matcher, extracted from party-360-service.ts so the same
// logic backs both the "ERP Links" viewer's name-fallback matching (for entities that
// don't yet have a real person_id FK, e.g. banks) and the Person Picker's duplicate-
// warning check before creating a new Person Master row.

export function normalizeNameStem(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(ullah|ollah|ulla|olla|khan|abdullah|jan|sahib)/g, "");
}

export function nameMatches(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const cleanA = a.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const cleanB = b.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  const stemA = normalizeNameStem(a);
  const stemB = normalizeNameStem(b);
  if (stemA && stemB && (stemA === stemB || stemA.includes(stemB) || stemB.includes(stemA))) return true;
  return false;
}
