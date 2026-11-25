import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/erp/sales/orders/route";

const mocks = vi.hoisted(() => ({
  requireErpSession: vi.fn(),
  authorizeApiScope: vi.fn(),
  assertFinancialAccess: vi.fn(),
  query: vi.fn(),
  localize: vi.fn(),
}));

vi.mock("@/lib/auth/session", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireErpSession: mocks.requireErpSession,
  getCurrentErpSession: async () => null,
}));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: mocks.authorizeApiScope }));
vi.mock("@/lib/permissions/middleware", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/permissions/middleware")>()),
  assertFinancialAccess: mocks.assertFinancialAccess,
}));
vi.mock("@/lib/db/local-postgres", () => {
  type Fragment = { text: string; values: unknown[] };
  const isFragment = (input: unknown): input is Fragment => !!input && typeof input === "object" && "text" in input && "values" in input;
  const sql = (parts: TemplateStringsArray, ...params: unknown[]) => {
    const text = parts.reduce((str, part, idx) => {
      if (!idx) return part;
      const param = params[idx - 1];
      return str + (isFragment(param) ? param.text : "?") + part;
    }, "");
    const values = params.flatMap(param => isFragment(param) ? param.values : [param]);
    return /from public\.sales_orders/.test(text) ? mocks.query({ text, values }) : { text, values };
  };
  return { withReadPg: (fn: (arg: typeof sql) => unknown) => fn(sql) };
});
vi.mock("@/lib/i18n/localize-records", () => ({ localizeRecordNames: mocks.localize }));

const request = (params: string) => new NextRequest(`http://test/api/erp/sales/orders?transferred=1&${params}`);
const countryId = "b8a757e4-6e95-4ac7-956d-6b9d61aa961b";
const branchId = "adaa53d0-18ae-4ac8-9fcf-154b2a9ddf14";

describe("Sales Transfer pages", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireErpSession.mockResolvedValue({ isSuperAdmin: false, roles: ["city_branch_admin"], countryIds: [countryId], countryBranchIds: [], cityBranchIds: [branchId] });
    mocks.localize.mockImplementation(async rows => rows);
  });

  it("gets one extra matching row after scope/date/search, and never localizes or returns the sentinel", async () => {
    mocks.query.mockResolvedValue([{ id: "o-1" }, { id: "o-2" }, { id: "sentinel" }]);
    const response = await GET(request(`limit=2&offset=200&countryId=${countryId}&bookingDate=2026-11-25&dateFrom=2026-11-01&q=SB-0099`));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ salesOrders: [{ id: "o-1" }, { id: "o-2" }], nextOffset: 202 });
    expect(mocks.authorizeApiScope).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ resource: "sales", action: "read", countryId }));
    expect(mocks.assertFinancialAccess).toHaveBeenCalledTimes(1);
    const [{ text, values }] = mocks.query.mock.calls[0];
    expect(text).toMatch(/order_date = \?::date[\s\S]+order_date >= \?::date[\s\S]+city_branch_id = any\(\?::uuid\[\]\)[\s\S]+order by created_at desc, id desc\s+limit \? offset \?/);
    expect(values).toEqual(expect.arrayContaining(["%SB-0099%", "2026-11-25", "2026-11-01", [branchId], 3, 200]));
    expect(mocks.localize.mock.calls[0][0]).toEqual([{ id: "o-1" }, { id: "o-2" }]);
  });

  it("returns null nextOffset for an exactly full last page and an empty later page", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "o-1" }, { id: "o-2" }]).mockResolvedValueOnce([]);
    expect((await (await GET(request("limit=2"))).json()).data.nextOffset).toBeNull();
    expect((await (await GET(request("limit=2&offset=400"))).json()).data).toEqual({ salesOrders: [], nextOffset: null });
  });

  it("keeps microsecond precision, using a keyset boundary so new earlier rows cannot shift the active page", async () => {
    const timestamp = "2026-11-25T08:15:20.123456Z";
    const id = "c4e61e96-0191-43da-9568-d32d9d913039";
    const cursor = `${timestamp}~${id}`;
    mocks.query.mockResolvedValueOnce([{ id, transfer_cursor_at: timestamp }, { id: "sentinel" }]).mockResolvedValueOnce([]);
    const first = await GET(request("limit=1"));
    expect((await first.json()).data).toEqual({ salesOrders: [{ id }], nextOffset: 1, nextCursor: cursor });
    const second = await GET(request(`limit=1&offset=1&cursor=${encodeURIComponent(cursor)}`));
    expect(second.status).toBe(200);
    const { text, values } = mocks.query.mock.calls[1][0];
    expect(text).toContain("(created_at,id) < (?::timestamptz,?::uuid)");
    expect(values.slice(-4)).toEqual([timestamp, id, 2, 0]);
  });

  it("rejects invalid cursors before reading", async () => {
    expect((await GET(request("offset=1&cursor=invalid"))).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns only scoped facet choices and does not apply row pagination to the choice catalog", async () => {
    const choice = { field: "countryId", value: countryId, label: "Country outside page one" };
    mocks.query.mockResolvedValue([choice]);
    const response = await GET(request(`facets=1&countryId=${countryId}&limit=1&offset=200`));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ facets: [choice] });
    const [{ text, values }] = mocks.query.mock.calls[0];
    expect(text).toMatch(/city_branch_id = any\(\?::uuid\[\]\)/);
    expect(text).toMatch(/group by field, value/);
    expect(text).not.toMatch(/\blimit\b|\boffset\b/);
    expect(values).toContainEqual([branchId]);
    expect(mocks.assertFinancialAccess).toHaveBeenCalledTimes(1);
    expect(mocks.localize).not.toHaveBeenCalled();
  });

  it("rejects impossible and reversed booking dates before reading", async () => {
    expect((await GET(request("bookingDate=2026-02-30"))).status).toBe(400);
    expect((await GET(request("dateFrom=2026-11-30&dateTo=2026-11-01"))).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("applies Local Sales source to both the register and facets before paging independently of branch scope", async () => {
    mocks.query.mockResolvedValue([]);
    await GET(request("source=local&limit=2"));
    await GET(request("source=local&facets=1"));
    const queries: string[] = mocks.query.mock.calls.map(([query]) => query.text);
    expect(queries).toHaveLength(2);
    for (const text of queries) {
      expect(text).toContain("{form,saleSource}");
      expect(text).toContain("{form,saleMode}");
      expect(text).toContain("city_branch_id = any");
    }
    expect(queries[0].indexOf("{form,saleSource}")).toBeLessThan(queries[0].indexOf("limit ? offset ?"));
  });
});
