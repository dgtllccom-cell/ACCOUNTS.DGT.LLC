import { describe, expect, it } from "vitest";
import { isEntryInDateRange } from "@/lib/roznamcha/entry-date-range";

/**
 * Regression: a range ending on a day must keep that day's entries. Entries carry a timestamp,
 * the range carries a calendar day.
 */
describe("isEntryInDateRange", () => {
  it("keeps entries on the last day of the range (the bug hid them)", () => {
    expect(isEntryInDateRange("2026-10-12T00:00:00.000Z", "2026-10-12", "2026-10-12")).toBe(true);
    expect(isEntryInDateRange("2026-10-12T00:00:00.000Z", "2026-10-01", "2026-10-12")).toBe(true);
  });

  it("keeps entries on the first day of the range", () => {
    expect(isEntryInDateRange("2026-10-01T00:00:00.000Z", "2026-10-01", "2026-10-31")).toBe(true);
  });

  it("excludes entries before the start and after the end", () => {
    expect(isEntryInDateRange("2026-09-30T23:59:59.000Z", "2026-10-01", "2026-10-31")).toBe(false);
    expect(isEntryInDateRange("2026-11-01T00:00:00.000Z", "2026-10-01", "2026-10-31")).toBe(false);
  });

  it("with no range set, every entry passes", () => {
    expect(isEntryInDateRange("2029-01-01T00:00:00.000Z", null, null)).toBe(true);
    expect(isEntryInDateRange(null, "", "")).toBe(true);
  });
});
