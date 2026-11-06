import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { assertRoznamchaCityBranch } from "@/lib/api/roznamcha-branch-guard";

const db = vi.hoisted(() => ({ branch: null as any, error: null as any, direct: false }));
vi.mock("@/lib/db/local-postgres", () => ({
  getDbUrl: () => db.direct ? "mock-test-db" : "",
  withLocalPg: async (fn: any) => fn(async () => db.branch ? [db.branch] : []),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => {
  const q: any = { from: () => q, select: () => q, eq: () => q, is: () => q,
    maybeSingle: async () => ({ data: db.branch, error: db.error }) };
  return q;
} }));
vi.mock("@/lib/api/response", () => ({ ApiClientError: class extends Error {
  constructor(message: string, options: any) { super(message); Object.assign(this, options); }
} }));

const PK = "11111111-1111-4111-8111-111111111111";
const MAIN = "22222222-2222-4222-8222-222222222222";
const CHAMAN = "33333333-3333-4333-8333-333333333333";
const scope = { countryId: PK, countryBranchId: MAIN, cityBranchId: CHAMAN };
const login = (domains = ["shipping"]) => ({ isSuperAdmin: false, roles: ["city_branch_admin"],
  permissions: ["roznamcha:post"], operationalDomains: domains, countryIds: [PK],
  countryBranchIds: [MAIN], cityBranchIds: [CHAMAN], assignments: [scope] }) as ErpSession;

describe.each([false, true])("Shipping Cash Entry branch guard (direct PG=%s)", (direct) => {
  beforeEach(() => { db.direct = direct; db.error = null; db.branch = { is_business_branch: false, operational_domain: "shipping" }; });
  const check = async (session: ErpSession, selected = scope) => {
    authorizeApiScope(session, { resource: "roznamcha", action: "post", ...selected });
    await assertRoznamchaCityBranch(session, selected.cityBranchId);
  };
  it("allows authorized Chaman Shipping admin in own shipping branch", async () => {
    await expect(check(login())).resolves.toBeUndefined();
  });
  it("keeps posting permission mandatory", async () => {
    const s = login(); s.permissions = ["roznamcha:read"];
    await expect(check(s)).rejects.toThrow("Missing permission");
  });
  it("rejects another city branch", async () => {
    await expect(check(login(), { ...scope, cityBranchId: "other" })).rejects.toThrow("City branch scope");
  });
  it("rejects another country", async () => {
    await expect(check(login(), { ...scope, countryId: "other" })).rejects.toThrow("Country scope");
  });
  it("rejects Business login in Shipping branch", async () => {
    await expect(check(login(["business"]))).rejects.toThrow("accounting domain");
  });
  it("rejects Shipping login in Business branch", async () => {
    db.branch = { is_business_branch: true, operational_domain: "business" };
    await expect(check(login())).rejects.toThrow("accounting domain");
    await expect(check(login(["business"]))).resolves.toBeUndefined();
  });
  it("does not admit unclassified agent branches", async () => {
    db.branch.operational_domain = null;
    await expect(check(login())).rejects.toThrow("accounting domain");
  });
  it("fails closed for missing or deleted branch", async () => {
    db.branch = null;
    await expect(check(login())).rejects.toThrow("unavailable");
  });
});

it("fails closed on a branch lookup error", async () => {
  db.direct = false; db.error = { message: "lookup failed" };
  await expect(assertRoznamchaCityBranch(login(), CHAMAN)).rejects.toThrow("lookup failed");
});
