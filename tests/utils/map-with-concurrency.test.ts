import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency";

/**
 * Regression guard for the Roznamcha list: an unbounded per-row fan-out exhausted the database
 * connection pool. The helper must keep at most `limit` calls in flight and keep input order.
 */
describe("mapWithConcurrency", () => {
  it("never has more than `limit` calls in flight and keeps input order", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 25 }, (_, i) => i);
    const out = await mapWithConcurrency(items, 4, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2 + (n % 3)));
      inFlight--;
      return n * 10;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
    expect(out).toEqual(items.map((n) => n * 10));
  });

  it("handles an empty list without calling the mapper", async () => {
    let calls = 0;
    const out = await mapWithConcurrency([] as number[], 3, async () => { calls++; return 1; });
    expect(out).toEqual([]);
    expect(calls).toBe(0);
  });

  it("runs every item when the limit is larger than the list", async () => {
    const out = await mapWithConcurrency(["a", "b"], 10, async (s) => s.toUpperCase());
    expect(out).toEqual(["A", "B"]);
  });

  it("propagates a rejected mapper so the caller can handle it", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => { if (n === 2) throw new Error("boom"); return n; }),
    ).rejects.toThrow("boom");
  });
});
