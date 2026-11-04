// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { ErpSession } from "@/lib/auth/session";

const state = vi.hoisted(() => ({ session: {} as any, rows: [] as any[], usePg: true, failPrimary: false, queries: [] as string[] }));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => state.session }));
vi.mock("@/lib/api/response", () => ({
  ApiClientError: class extends Error {},
  handleApiError: (error: Error) => NextResponse.json({ ok: false, error: { message: error.message } }, { status: 403 }),
}));
vi.mock("@/lib/api/branch-scope-guard", () => ({ assertBusinessCityBranch: vi.fn() }));
vi.mock("@/lib/db/local-postgres", () => ({
  withLocalPg: async (fn: any) => state.usePg ? fn(async (strings: TemplateStringsArray) => {
    const query = strings.join("?");
    state.queries.push(query);
    if (state.failPrimary && query.includes("lateral")) throw new Error("Enrichment unavailable");
    return state.rows;
  }) : null,
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: () => {
  const q: any = { then: (resolve: any) => Promise.resolve({ data: state.rows, error: null }).then(resolve) };
  for (const method of ["select", "is", "order", "eq"]) q[method] = () => q;
  return q;
} }) }));
import { GET } from "@/app/api/erp/purchases/local-purchase/route";

const country = "11111111-1111-4111-8111-111111111111";
const main = "22222222-2222-4222-8222-222222222222";
const city = "33333333-3333-4333-8333-333333333333";
const otherCity = "44444444-4444-4444-8444-444444444444";
const otherCountry = "55555555-5555-4555-8555-555555555555";
function session(over: Partial<ErpSession> = {}) {
  return { userId: "u", roles: ["city_branch_admin"], permissions: ["purchases:read"], countryIds: [country],
    countryBranchIds: [main], cityBranchIds: [city], assignments: [], isSuperAdmin: false,
    isGlobalScope: false, operationalDomains: ["business"], ...over } as ErpSession;
}
const row = (id: string, over: Record<string, unknown> = {}) => ({ id, country_id: country, country_branch_id: main,
  city_branch_id: city, status: "posted", final_cost: 100, purchase_currency: "AED", ...over });
async function list(params = "") { const response = await GET(new NextRequest(`http://localhost/api/erp/purchases/local-purchase${params}`)); return { response, body: await response.json() }; }

beforeEach(() => {
  state.session = session(); state.usePg = true; state.failPrimary = false; state.queries = [];
  state.rows = [row("own"), row("sibling", { city_branch_id: otherCity }), row("main-only", { city_branch_id: null }),
    row("foreign", { country_id: otherCountry, country_branch_id: null, city_branch_id: null })];
});
for (const usePg of [true, false]) describe(usePg ? "Postgres registry" : "Supabase registry", () => {
  beforeEach(() => { state.usePg = usePg; });
  it("returns all eight saved rows to Super Admin", async () => {
    state.session = session({ isSuperAdmin: true }); state.rows = Array.from({ length: 8 }, (_, i) => row(String(i)));
    expect((await list()).body.data.purchases).toHaveLength(8);
  });
  it("keeps country admins country-wide with expanded city assignments", async () => {
    state.session = session({ roles: ["country_admin"] });
    expect((await list()).body.data.purchases.map((r: any) => r.id)).toEqual(["own", "sibling", "main-only"]);
  });
  it("does not let a broad explicit country filter bypass branch scope", async () => {
    expect((await list(`?countryId=${country}`)).body.data.purchases.map((r: any) => r.id)).toEqual(["own"]);
  });
  it("intersects every explicit filter even for Super Admin", async () => {
    state.session = session({ isSuperAdmin: true });
    expect((await list(`?countryId=${otherCountry}&cityBranchId=${city}`)).body.data.purchases).toEqual([]);
  });
  it("denies a session with no assignments", async () => {
    state.session = session({ countryIds: [], countryBranchIds: [], cityBranchIds: [] });
    expect((await list()).body.data.purchases).toEqual([]);
  });
  it("rejects shipping-only purchase access", async () => {
    state.session = session({ roles: ["shipping_line_user"], permissions: ["purchases:read"], operationalDomains: ["shipping"] });
    expect((await list()).response.status).toBe(403);
  });
});
it("uses the real countries schema in primary and reduced queries", async () => {
  state.failPrimary = true;
  expect((await list()).body.data.purchases.map((r: any) => r.id)).toEqual(["own"]);
  expect(state.queries).toHaveLength(2);
  for (const query of state.queries) { expect(query).toContain("c.iso3 as country_code"); expect(query).not.toContain("c.iso_code"); }
});
