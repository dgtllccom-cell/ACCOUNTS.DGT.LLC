import { describe, expect, it } from "vitest";
import { dailyRateEffectiveFrom } from "@/lib/currency/daily-rate-time";

describe("Daily exchange rate operator time", () => {
  it("converts Dubai local time to UTC instead of making the rate effective four hours late", () => {
    expect(dailyRateEffectiveFrom("2026-11-06", "11:10 AM", -240)).toBe("2026-11-06T07:10:00.000Z");
  });
  it("converts Pakistan local time and handles midnight", () => {
    expect(dailyRateEffectiveFrom("2026-11-06", "12:00 AM", -300)).toBe("2026-11-05T19:00:00.000Z");
  });
  it("keeps old clients' UTC interpretation and 24-hour input", () => {
    expect(dailyRateEffectiveFrom("2026-11-06", "13:20")).toBe("2026-11-06T13:20:00.000Z");
    expect(dailyRateEffectiveFrom("2026-11-06", "12:00 PM", 0)).toBe("2026-11-06T12:00:00.000Z");
  });
  it.each([["25:00", 0], ["13:00 PM", 0], ["12:61", 0], ["invalid", 0], ["12:00", 1000], ["12:00", 1.5]])("rejects invalid operator time %s/%s", (time, offset) => {
    expect(() => dailyRateEffectiveFrom("2026-11-06", String(time), Number(offset))).toThrow();
  });
});
