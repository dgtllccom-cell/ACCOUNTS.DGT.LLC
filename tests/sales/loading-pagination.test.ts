import { describe, expect, it, vi } from "vitest";
import { loadSalesLoadingPages, SALES_LOADING_MAX_PAGES } from "@/lib/sales/loading-pagination";

const page = (ids: string[], nextCursor: string | null, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ ok: true, data: { orders: ids.map(id => ({ id })), records: [], locations: [], nextCursor, scopeKey: "one", canLoad: true, financials: false, ...extra } }));
const params = new URLSearchParams({ lang: "ur", countryId: "country-one" });
const signal = () => new AbortController().signal;

describe("verified Sales Loading cursor pages", () => {
  it("keeps initial filters on every chunk and completes only on an explicit null terminal cursor", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(page(["first"], "cursor-one"))
      .mockResolvedValueOnce(page(["second"], null));
    const result = await loadSalesLoadingPages(params, signal(), request);
    expect(result.orders.map(order => order.id)).toEqual(["first", "second"]);
    expect(result.complete).toBe(true);
    expect(request.mock.calls[1][0]).toBe("/api/erp/sales/loading?lang=ur&countryId=country-one&cursor=cursor-one");
    expect(request.mock.calls[1][1]?.cache).toBe("no-store");
  });
  it.each([
    ["changed scope", ["second"], null, { scopeKey: "other" }, /scope changed/],
    ["changed permissions", ["second"], null, { canLoad: false }, /scope changed/],
    ["duplicate booking", ["first"], null, {}, /Duplicate/],
    ["stalled cursor", ["second"], "cursor-one", {}, /Stalled/],
    ["unlinked record", ["second"], null, { records: [{ id: "rec", sales_order_id: "foreign" }] }, /container/],
  ] as const)("rejects %s rather than presenting incomplete or mixed totals", async (_scenario, ids, cursor, extra, message) => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(page(["first"], "cursor-one")).mockResolvedValueOnce(page([...ids], cursor, extra));
    await expect(loadSalesLoadingPages(params, signal(), request)).rejects.toThrow(message);
  });
  it("returns an explicit incomplete scope at the cap and does not request another chunk", async () => {
    let seq = 0;
    const request = vi.fn<typeof fetch>().mockImplementation(async () => { seq++; return page([`row-${seq}`], `cursor-${seq}`); });
    const result = await loadSalesLoadingPages(params, signal(), request);
    expect(result).toMatchObject({ complete: false });
    expect(result.orders).toHaveLength(SALES_LOADING_MAX_PAGES);
    expect(request).toHaveBeenCalledTimes(SALES_LOADING_MAX_PAGES);
  });
  it("preserves scoped filter choices when a single server page reached its record cap", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(page([], null, { limitReached: true, locations: [{ countryId: "country-one" }] }));
    const result = await loadSalesLoadingPages(params, signal(), request);
    expect(result).toMatchObject({ complete: false, orders: [], records: [], locations: [{ countryId: "country-one" }] });
  });
});
