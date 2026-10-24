// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fixtures = vi.hoisted(() => ({ session: {} as any, branches: {} as Record<string, any>, writes: [] as Array<{ table: string; value: any }>, createUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => fixtures.session, resolveEffectiveAccessForUser: vi.fn() }));
vi.mock("@/lib/api/audit", () => ({ auditApiAction: vi.fn() }));
vi.mock("@/lib/branch-network/duplicate-guard", () => ({ assertNoDuplicateAssignment: vi.fn(), assertNoDuplicateUser: vi.fn() }));
vi.mock("@/lib/api/response", () => {
  class ApiClientError extends Error { status: number; constructor(message: string, opts?: {status?: number}) { super(message); this.status = opts?.status ?? 400; } }
  return { ApiClientError, apiCreated: (data: unknown) => Response.json({ ok: true, data }, { status: 201 }), apiOk: (data: unknown) => Response.json({ ok: true, data }),
    handleApiError: (error: any) => Response.json({ ok: false, error: { message: error.message } }, { status: error.status ?? 500 }) };
});
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  auth: { admin: { createUser: fixtures.createUser } },
  from: (table: string) => {
    let columns = "";
    let id = "";
    const query: any = { data: null, error: null,
      select: (value: string) => { columns = value; return query; },
      eq: (key: string, value: string) => { if (key === "id") id = value; return query; },
      is: () => query,
      maybeSingle: async () => ({ data: columns === "permission_grants" ? null : fixtures.branches[id] ?? null, error: null }),
      upsert: async (value: any) => { fixtures.writes.push({ table, value }); return { error: null }; },
      insert: (value: any) => { fixtures.writes.push({ table, value }); return query; },
    };
    return query;
  },
}) }));
import { POST } from "@/app/api/erp/users/route";

const PK = "11111111-1111-4111-8111-111111111111";
const UAE = "22222222-2222-4222-8222-222222222222";
const MAIN = "33333333-3333-4333-8333-333333333333";
const CHAMAN = "44444444-4444-4444-8444-444444444444";
const ALRAS = "55555555-5555-4555-8555-555555555555";
const NEW_USER = "66666666-6666-4666-8666-666666666666";
const assignment = { role: "city_branch_admin", countryId: PK, countryBranchId: MAIN, cityBranchId: CHAMAN, operationalDomain: "shipping" };
const base = { role: "staff_user", fullName: "DEV Test Staff", email: "test@example.invalid", password: "local-test-only", userCode: "DEV-STAFF", countryId: PK, countryBranchId: MAIN, cityBranchId: CHAMAN, operationalDomain: "shipping", permissions: ["customers:read"] };
async function post(patch: Record<string, unknown> = {}) {
  return POST(new NextRequest("http://localhost/api/erp/users", { method: "POST", body: JSON.stringify({ ...base, ...patch }), headers: { "Content-Type": "application/json" } }));
}
beforeEach(() => {
  fixtures.writes = [];
  fixtures.createUser.mockReset().mockResolvedValue({ data: { user: { id: NEW_USER } }, error: null });
  fixtures.session = { userId: NEW_USER, isSuperAdmin: false, roles: ["city_branch_admin"], countryIds: [PK], countryBranchIds: [MAIN], cityBranchIds: [CHAMAN], operationalDomains: ["shipping"], assignments: [assignment], permissions: ["users:create", "customers:read"], canViewFinancials: false };
  fixtures.branches = { [CHAMAN]: { id: CHAMAN, country_id: PK, country_branch_id: MAIN, operational_domain: "shipping" }, [MAIN]: { id: MAIN, country_id: PK } };
});

describe("registration POST security with mocked storage (no DEV/Production connection)", () => {
  it("creates delegated staff and persists the shipping branch and capped permissions", async () => {
    expect((await post({ permissions: ["customers:read", "users:delete", "route:/dashboard/super-admin"] })).status).toBe(201);
    expect(fixtures.createUser).toHaveBeenCalledOnce();
    expect(fixtures.writes.find((w) => w.table === "user_role_assignments")?.value).toMatchObject({ role: "staff", city_branch_id: CHAMAN, country_id: PK, operational_domain: "shipping" });
    expect(fixtures.writes.find((w) => w.table === "user_permission_sets")?.value.permissions).toEqual(["customers:read"]);
  });
  it.each(["country_admin", "super_admin", "main_branch_admin", "city_branch_admin"])("rejects %s before creating an Auth user", async (role) => {
    expect((await post({ role })).status).toBe(403);
    expect(fixtures.createUser).not.toHaveBeenCalled();
    expect(fixtures.writes).toEqual([]);
  });
  it.each([{ countryId: UAE }, { cityBranchId: ALRAS }, { operationalDomain: "business" }, { operationalDomain: "both" }, { accessProfile: "operations" }, { mode: "assign_scope", assignExistingUserId: NEW_USER }])("rejects forbidden target %o", async (patch) => {
    expect((await post(patch)).status).toBe(403);
    expect(fixtures.createUser).not.toHaveBeenCalled();
    expect(fixtures.writes).toEqual([]);
  });
  it("rejects a city admin without an authoritative delegation grant", async () => {
    fixtures.session.permissions = ["users:read"];
    expect((await post()).status).toBe(403);
    expect(fixtures.writes).toEqual([]);
  });
  it.each(["city_branch_admin", "staff_user"])("allows UAE Country Admin to create %s", async (role) => {
    fixtures.session = { ...fixtures.session, roles: ["country_admin"], countryIds: [UAE], cityBranchIds: [ALRAS], operationalDomains: ["business"], assignments: [{ ...assignment, role: "country_admin", countryId: UAE, countryBranchId: null, cityBranchId: null, operationalDomain: "business" }] };
    fixtures.branches[ALRAS] = { id: ALRAS, country_id: UAE, country_branch_id: null, operational_domain: "business" };
    expect((await post({ role, countryId: UAE, countryBranchId: null, cityBranchId: ALRAS, operationalDomain: "business" })).status).toBe(201);
  });
  it("rejects a forged country even when a country admin supplies its own country in the payload", async () => {
    fixtures.session = { ...fixtures.session, roles: ["country_admin"], assignments: [{ ...assignment, role: "country_admin", cityBranchId: null, countryBranchId: null }] };
    fixtures.branches[CHAMAN].country_id = UAE;
    expect((await post()).status).toBe(403);
    expect(fixtures.createUser).not.toHaveBeenCalled();
    expect(fixtures.writes).toEqual([]);
  });
  it("rejects a saved branch with the wrong operational domain", async () => {
    fixtures.branches[CHAMAN].operational_domain = "business";
    expect((await post()).status).toBe(422);
    expect(fixtures.createUser).not.toHaveBeenCalled();
    expect(fixtures.writes).toEqual([]);
  });
});
