import type { LoadingOrder, LoadingRecord } from "@/lib/sales/loading-workflow";

export const SALES_LOADING_PAGE_SIZE = 200;
export const SALES_LOADING_MAX_PAGES = 10;
export const SALES_LOADING_MAX_RECORDS = 5000;

export type LoadingRegisterOrder = LoadingOrder & { readiness: string; canLoad?: boolean };
export type LoadingRegisterLocation = { countryId: string; country: string; mainBranchId: string; mainBranch: string; cityBranchId: string; cityBranch: string };
export type LoadingRegisterPage = {
  orders: LoadingRegisterOrder[];
  records: LoadingRecord[];
  locations: LoadingRegisterLocation[] | null;
  nextCursor: string | null;
  scopeKey: string;
  limitReached?: boolean;
  canLoad: boolean;
  financials: boolean;
};
export type LoadingRegisterData = Omit<LoadingRegisterPage, "nextCursor" | "scopeKey" | "locations" | "limitReached"> & {
  locations: LoadingRegisterLocation[];
  complete: boolean;
};

/** Validate page completeness before any rows become visible; never mix sessions or stale pages. */
export async function loadSalesLoadingPages(
  base: URLSearchParams,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<LoadingRegisterData> {
  let cursor: string | null = null;
  let first: LoadingRegisterPage | undefined;
  const seenOrders = new Set<string>();
  const seenRecords = new Set<string>();
  const seenCursors = new Set<string>();
  const orders: LoadingRegisterOrder[] = [];
  const records: LoadingRecord[] = [];
  for (let i = 0; i < SALES_LOADING_MAX_PAGES; i++) {
    signal.throwIfAborted();
    const params = new URLSearchParams(base);
    if (cursor) params.set("cursor", cursor);
    const res = await request(`/api/erp/sales/loading?${params}`, { cache: "no-store", signal });
    const json = await res.json();
    signal.throwIfAborted();
    if (!res.ok || !json.ok) throw new Error("Sales Loading request failed");
    const page = json.data as LoadingRegisterPage | undefined;
    if (!page || !Array.isArray(page.orders) || !Array.isArray(page.records)
      || page.orders.length > SALES_LOADING_PAGE_SIZE || typeof page.scopeKey !== "string" || !page.scopeKey
      || typeof page.canLoad !== "boolean" || typeof page.financials !== "boolean"
      || !(page.nextCursor === null || (typeof page.nextCursor === "string" && page.nextCursor.length > 0))) {
      throw new Error("Invalid Sales Loading page");
    }
    if (!first) {
      if (!Array.isArray(page.locations)) throw new Error("Missing scoped Sales Loading locations");
      first = page;
    } else if (page.scopeKey !== first.scopeKey || page.canLoad !== first.canLoad || page.financials !== first.financials) {
      throw new Error("Sales Loading scope changed");
    }
    if (page.limitReached) break;
    if (page.nextCursor && (page.orders.length === 0 || seenCursors.has(page.nextCursor))) throw new Error("Stalled Sales Loading cursor");
    const currentIDs = new Set<string>();
    for (const row of page.orders) {
      if (!row?.id || seenOrders.has(row.id)) throw new Error("Duplicate Sales Loading booking");
      seenOrders.add(row.id);
      currentIDs.add(row.id);
    }
    for (const row of page.records) {
      if (!row?.id || seenRecords.has(row.id) || !currentIDs.has(row.sales_order_id)) throw new Error("Invalid Sales Loading container");
      seenRecords.add(row.id);
    }
    if (records.length + page.records.length > SALES_LOADING_MAX_RECORDS) break;
    orders.push(...page.orders);
    records.push(...page.records);
    cursor = page.nextCursor;
    if (!cursor) return { orders, records, locations: first.locations ?? [], canLoad: first.canLoad, financials: first.financials, complete: true };
    seenCursors.add(cursor);
  }
  if (!first) throw new Error("Sales Loading did not return a page");
  return { orders, records, locations: first.locations ?? [], canLoad: first.canLoad, financials: first.financials, complete: false };
}
