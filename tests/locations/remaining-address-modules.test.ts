import { beforeEach, describe, expect, it, vi } from "vitest";

// A UAE-scoped record with an India / Maharashtra / Mumbai physical address.
const uae = "b3dad0d2-fe60-497c-ab51-849aa1926205";
const india = "6f6baaf6-7d5c-4467-a7a1-b2c8e406f95d";
const maharashtra = "0b0d6a8e-62a1-4b0e-a8fa-0b6e6d2b0a11";
const mumbai = "1ee711d8-fdd1-45b4-b7b8-663090294f16";
const truckId = "7c9d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const branchId = "2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d";

const h = vi.hoisted(() => ({
  session: { userId: "actor", isSuperAdmin: true, countryIds: [] as string[], cityBranchIds: [] as string[], roles: ["super_admin"], preferredLanguage: "en" },
  existing: {} as Record<string, unknown>,
  patches: [] as Record<string, unknown>[],
  inserts: [] as { text: string; values: unknown[] }[],
}));

vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => h.session, sessionInDomain: () => true }));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: vi.fn() }));
vi.mock("@/lib/services/enterprise-multilingual-service", () => ({ saveVerifiedEnterpriseRecordTranslations: vi.fn(async () => undefined) }));
vi.mock("@/lib/i18n/record-translation-sync", () => ({ syncRecordTranslations: vi.fn(async () => undefined) }));
vi.mock("@/lib/db/local-postgres", () => {
  const sql: any = (strings: TemplateStringsArray | Record<string, unknown>, ...values: unknown[]) => {
    if (!Array.isArray(strings)) { h.patches.push(strings as Record<string, unknown>); return strings; }
    const text = (strings as TemplateStringsArray).join("?");
    if (/^\s*(insert|INSERT)/.test(text)) { h.inserts.push({ text, values }); return Promise.resolve([{ id: "new" }]); }
    if (/^\s*(update|UPDATE)/.test(text)) return Promise.resolve([{ id: "updated", ...h.existing }]);
    if (/count\(\*\)/i.test(text)) return Promise.resolve([{ c: 0 }]);
    return Promise.resolve([h.existing]);
  };
  return { withLocalPg: async (fn: (s: typeof sql) => unknown) => fn(sql), withReadPg: async (fn: (s: typeof sql) => unknown) => fn(sql) };
});

import { PATCH as patchTruck } from "@/app/api/erp/master-data/trucks/[id]/route";

const json = (body: unknown) => new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeEach(() => {
  h.patches.length = 0;
  h.inserts.length = 0;
  h.existing = {};
});

describe("Truck / Driver registration — driver address from Location Management", () => {
  it("saves the driver's master ids and street line, never the truck's scope", async () => {
    h.existing = { country_id: uae, country_branch_id: null, city_branch_id: null };
    const res = await patchTruck(json({
      driver_country_id: india, driver_state_province_id: maharashtra, driver_city_id: mumbai,
      driver_district_id: "not-a-uuid", driver_address: "  Plot 4, Andheri  ", country_id: india,
    }) as any, { params: Promise.resolve({ id: truckId }) });
    expect(res.status).toBe(200);
    const patch = h.patches.at(-1)!;
    expect(patch).toMatchObject({ driver_country_id: india, driver_state_province_id: maharashtra, driver_city_id: mumbai, driver_district_id: null, driver_address: "Plot 4, Andheri" });
    // the address never re-scopes the truck
    expect(patch).not.toHaveProperty("country_id");
    expect(patch).not.toHaveProperty("country_branch_id");
    expect(patch).not.toHaveProperty("city_branch_id");
  });
});

describe("Branch address edits cannot move the branch to another country", () => {
  it("country main branch: refuses a country change with 409 ASSIGNED_COUNTRY_LOCKED", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => { throw new Error("must stop before any write"); } }));
    vi.doMock("@/features/branch-management/validation", async (orig) => {
      const real: any = await orig();
      return { ...real, createCountryBranchSchema: { safeParse: (b: any) => ({ success: true, data: { ...b, permissionGrants: [] } }) } };
    });
    const { PUT } = await import("@/app/api/branch-management/country-branches/route");
    h.existing = { country_id: uae };
    const res = await PUT(new Request("http://localhost/x", { method: "PUT", body: JSON.stringify({ id: branchId, countryId: india, name: "Dubai Main", code: "AE-1" }) }));
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).toContain("ASSIGNED_COUNTRY_LOCKED");
    expect(h.inserts).toHaveLength(0);
  });
});

describe("Shipping agent office location", () => {
  it("stores Location Management ids next to the report names and drops non-ids", async () => {
    vi.resetModules();
    const mod = await import("@/app/api/erp/shipping-line/agent-entry/route");
    const res = await mod.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({
      agent_name: "Fixture Agent", city_name: "Mumbai", country_name: "India",
      address_country_id: india, state_province_id: maharashtra, city_id: "Mumbai",
    }) }) as any);
    expect(res.status).toBeLessThan(500);
    const insert = h.inserts.find((i) => /shipping_agent_entries/.test(i.text))!;
    expect(insert.text).toMatch(/address_country_id, state_province_id, city_id/);
    expect(insert.values).toContain(india);
    expect(insert.values).toContain(maharashtra);
    // "Mumbai" is a name, not a master id: the city id column gets null, the name column keeps "Mumbai"
    expect(insert.values.filter((v) => v === "Mumbai")).toHaveLength(1);
  });
});
