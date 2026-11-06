/**
 * Is a Roznamcha entry inside a From / To date range?
 *
 * Entries arrive with a timestamp ("2026-10-12T00:00:00.000Z") while the range is calendar days
 * ("2026-10-12"). Comparing the raw strings puts a same-day timestamp AFTER the To date, which hides the
 * last day of every range. Both sides are compared as calendar days.
 */
export function isEntryInDateRange(entryDate: string | null | undefined, fromDate?: string | null, toDate?: string | null): boolean {
  const day = String(entryDate ?? "").slice(0, 10);
  if (fromDate && day < fromDate) return false;
  if (toDate && day > toDate) return false;
  return true;
}
