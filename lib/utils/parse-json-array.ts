/**
 * Normalise a jsonb array column that may arrive as:
 *  - a real array (the correct storage shape),
 *  - a JSON-encoded string (what `JSON.stringify(x)::jsonb` stores through the
 *    postgres driver: the value is kept as a jsonb string scalar, not an array),
 *  - null / undefined / anything else.
 * Always returns an array and never throws, so callers can `.filter` safely.
 */
export function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
