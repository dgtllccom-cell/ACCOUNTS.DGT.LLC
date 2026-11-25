import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { GET, PATCH, POST } from "@/app/api/erp/sales/loading/route";

const mocks = vi.hoisted(() => ({ query: vi.fn(), allow: vi.fn(), getSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: mocks.getSession }));
vi.mock("@/lib/api/scope-middleware", () => ({
  authorizeApiScope: mocks.allow,
  sessionSqlScope: () => ({ cityBranchIds: ["city-a"] }),
  sqlScopeCondition: (sql: any, scope: { cityBranchIds: string[] }) => sql`o.city_branch_id = any(${scope.cityBranchIds}::uuid[])`,
  recordInSessionScope: () => true,
}));
vi.mock("@/lib/permissions/middleware", () => ({ hasRolePermission: () => true }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLanguage: async () => "en" }));
vi.mock("@/lib/i18n/localize-records", () => ({ localizeJoinedNames: async (r: unknown) => r, localizeRecordNames: async (r: unknown) => r }));
vi.mock("@/lib/db/local-postgres", () => {
  type Fragment = { text: string; values: unknown[] };
  const fragment = (input: unknown): input is Fragment => !!input && typeof input === "object" && "text" in input && "values" in input;
  const sql = (parts: TemplateStringsArray, ...args: unknown[]) => {
    const values = args.flatMap(a => fragment(a) ? a.values : [a]);
    const text = parts.reduce((s, part, i) => !i ? part : s + (fragment(args[i - 1]) ? (args[i - 1] as Fragment).text : "?") + part, "");
    return /^\s*(select id, entry_no|select o.id|select loc\.\*|select l\.loading_date|select goods|insert|update)/i.test(text)
      ? mocks.query(text, values) : { text, values };
  };
  sql.begin = (fn: (conn: typeof sql) => unknown) => fn(sql);
  sql.json = (val: unknown) => JSON.stringify(val);
  return { withReadPg: (fn: (conn: typeof sql) => unknown) => fn(sql), withLocalPg: (fn: (conn: typeof sql) => unknown) => fn(sql) };
});

const id = "278555ce-e7fc-4ad2-81be-61871064b7cf";
const api = "http://test/api/erp/sales/loading";
const existingOrder = { id, sales_order_no: "LS-342", ledger_posting_status: "posted", total_goods_original: 100, paid_amount: 0,
  form_data: { form: { saleSource: "local", paymentType: "Cash" }, transferTrace: { paymentKind: "cash" },
    goodsEntries: [{ goodsName: "Walnuts", qtyNo: 100 }] } };
const localPost = { source: "local", orderId: id, containers: [{ containerNumber: "TEST", containerType: "40 FT", loadingDate: "2026-11-25", receivedDate: null,
  items: [{ line: 0, quantity: 10, gross: 10, net: 9 }] }] };
const write = (method: string, body: unknown) => new NextRequest(api, { method, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: id, fullName: "<tester>", isSuperAdmin: false, canViewFinancials: false });
  mocks.query.mockResolvedValue([]);
});

it("narrows both Local dashboard rows and location choices to eligible transferred Local Sales in the viewer's branch", async () => {
  mocks.query.mockResolvedValueOnce([existingOrder]);
  const response = await GET(new NextRequest(api + "?source=local"));
  expect(response.status).toBe(200);
  expect((await response.json()).data.orders).toMatchObject([{ id, bookingNo: "LS-342", readiness: "ready" }]);
  for (const [sql, values] of [mocks.query.mock.calls[0], mocks.query.mock.calls[2]]) {
    expect(sql).toContain("ledger_posting_status in");
    expect(sql).toContain("city_branch_id = any(?::uuid[])");
    expect(values).toContainEqual(["city-a"]);
    expect(sql).toContain("= 'lot'");
    expect(sql).toContain("<> 'export'");
    expect(values).toContainEqual(expect.arrayContaining(["credit", "cash", "account transfer"]));
    expect(values).toContainEqual(expect.arrayContaining(["invoice"]));
    expect(sql).toContain("i.source_id = o.id and i.source_table = 'sales_orders'");
    expect(sql).toContain("i.status = 'finalized' and i.deleted_at is null");
    expect(sql.indexOf("transferTrace")).toBeLessThan(sql.indexOf("workflow"));
  }
});

it("keeps Booking scope separate while applying the same immediate Cash policy", async () => {
  const unrelated = { ...existingOrder, form_data: { form: { saleSource: "stock", saleMode: "local", paymentType: "Cash" } } };
  mocks.query.mockResolvedValueOnce([unrelated]);
  const response = await GET(new NextRequest(api));
  expect(response.status).toBe(200);
  expect((await response.json()).data.orders[0].readiness).toBe("ready");
  expect(mocks.query.mock.calls[0][0]).toMatch(/and \(not \(/);
  expect(mocks.query.mock.calls[0][1]).toContainEqual(expect.arrayContaining(["credit", "cash", "account transfer"]));
});

it("rejects invalid source, foreign scope or ineligible direct identifiers without writing", async () => {
  expect((await GET(new NextRequest(api + "?source=import"))).status).toBe(422);
  expect(mocks.query).not.toHaveBeenCalled();
  expect((await GET(new NextRequest(api + "?source=local&orderId=" + id))).status).toBe(404);
  expect((await POST(write("POST", localPost))).status).toBe(404);
  expect((await PATCH(write("PATCH", { source: "local", id, receivedDate: null }))).status).toBe(404);
  expect(mocks.query.mock.calls.flat().join(" ")).not.toMatch(/insert into|update public\./);
});

it("saves Local containers against the original Sales order without a receipt, journal or other side effect", async () => {
  mocks.query.mockResolvedValueOnce([existingOrder]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "container" }]);
  const response = await POST(write("POST", localPost));
  expect(response.status).toBe(201);
  expect(mocks.allow.mock.calls.map(([, options]) => options.action)).toEqual(["read", "update"]);
  expect(mocks.query.mock.calls[0][0]).toMatch(/city_branch_id = any[\s\S]+i.status = 'finalized'[\s\S]+for update of o/);
  expect(mocks.query.mock.calls[2][0]).toContain("insert into public.sales_loading_records");
  expect(mocks.query.mock.calls[2][1].slice(0, 2)).toEqual([id, "LS-342"]);
  expect(mocks.query).toHaveBeenCalledTimes(3);
});
