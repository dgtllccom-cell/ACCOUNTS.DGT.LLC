// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const countryId = "ace69ef9-8c3b-479c-bdb7-7953ddf8629d";
const branchId = "fcc3aec9-1d4b-4830-8ea8-85afefd97139";
const state = vi.hoisted(() => ({
  row: null as any,
  session: { roles: ["city_branch_admin"], permissions: ["roznamcha:read"], countryIds: ["ace69ef9-8c3b-479c-bdb7-7953ddf8629d"], countryBranchIds: ["fcc3aec9-1d4b-4830-8ea8-85afefd97139"], cityBranchIds: ["0a2ad08c-63aa-4e86-9f19-c8bc0e08acad"], operationalDomains: ["shipping"], assignments: [], isSuperAdmin: false } as any,
  rpc: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => state.session }));
vi.mock("@/lib/api/supabase", () => ({ createApiSupabaseClient: async () => ({ rpc: state.rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: state.admin }));
vi.mock("@/lib/api/response", () => ({
  ApiClientError: class extends Error {},
  apiOk: (data: any) => NextResponse.json({ ok: true, data }),
  handleApiError: (error: Error & { status?: number }) => NextResponse.json({ error: error.message }, { status: error.status ?? 400 }),
}));
import { GET } from "@/app/api/erp/currency/daily-rate/route";
import { POST } from "@/app/api/erp/currency/daily-rates/route";
const request = (country = countryId, branch = branchId) => new NextRequest(`http://localhost/api/erp/currency/daily-rate?countryId=${country}&countryBranchId=${branch}&date=2026-11-06`);
beforeEach(() => {
  state.row = { rate_date: "2026-11-06", buying_rate: 288, selling_rate: 287, credit_rate: 287, debit_rate: 288, currency_code: "PKR" };
  state.rpc.mockReset().mockImplementation(async () => ({ data: state.row ? [state.row] : [], error: null }));
  state.admin.mockReset();
});
describe("Chaman Shipping exact-date rate lookup", () => {
  it("reads the assigned Pakistan branch rate with the normal scope checks", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ found: true, debitRate: 288, creditRate: 287 });
    expect(state.rpc).toHaveBeenCalledWith("get_daily_rate", { p_country_id: countryId, p_country_branch_id: branchId, p_date: "2026-11-06" });
  });
  it("blocks the stale October rate actually returned by Production for November 6", async () => {
    state.row.rate_date = "2026-10-28";
    expect((await (await GET(request())).json()).data).toMatchObject({ found: false, status: "PENDING_MISSING", debitRate: null, creditRate: null });
  });
  it("keeps missing rates pending", async () => {
    state.row = null;
    expect((await (await GET(request())).json()).data.found).toBe(false);
  });
  it("does not accept zero rates", async () => {
    state.row = { rate_date: "2026-11-06", buying_rate: 0, selling_rate: 0, credit_rate: 0, debit_rate: 0 };
    expect((await (await GET(request())).json()).data.found).toBe(false);
  });
  it("rejects a different country before querying rates", async () => {
    expect((await GET(request("11111111-1111-4111-8111-111111111111"))).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("rejects a different main branch before querying rates", async () => {
    expect((await GET(request(countryId, "11111111-1111-4111-8111-111111111111"))).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("does not give the Shipping branch admin permission to write country rates", async () => {
    const response = await POST(new NextRequest("http://localhost/api/erp/currency/daily-rates", {
      method: "POST", body: JSON.stringify({ countryId, rateDate: "2026-11-06", debitRate: 288, creditRate: 287 }),
    }));
    expect(response.status).toBe(403);
    expect(state.admin).not.toHaveBeenCalled();
  });
});
