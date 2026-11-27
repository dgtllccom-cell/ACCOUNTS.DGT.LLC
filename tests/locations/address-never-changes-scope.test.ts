import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Owner rule: changing a physical address must never change the assigned ERP branch, ownership, user permissions,
 * currency, ledger or accounting records. For Warehouse (list scoped by country_id) the Location Management picker
 * writes address_country_id only on edit; country_id (user scope / serial numbering) stays untouched.
 */
const state = vi.hoisted(() => ({ updates: [] as Array<Record<string, unknown>>, scopeCalls: [] as any[] }));

vi.mock("@/lib/auth/session", () => ({ requireErpSession: vi.fn(async () => ({ userId: "u1", isSuperAdmin: true, preferredLanguage: "en" })) }));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: (_s: unknown, args: unknown) => { state.scopeCalls.push(args); } }));
vi.mock("@/lib/services/translation-trigger-service", () => ({ translateMasterRecord: vi.fn() }));
vi.mock("@/lib/api/response", () => ({ rethrowIfNextControlFlow: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        single: async () => ({ data: { country_id: "country-ops", warehouse_name: "W" }, error: null }),
        update: (patch: Record<string, unknown>) => { state.updates.push(patch); return chain; },
      };
      return chain;
    },
  }),
}));

import { PATCH } from "@/app/api/erp/master-data/warehouses/[id]/route";

const call = (body: unknown) =>
  PATCH({ json: async () => body } as unknown as Request, { params: Promise.resolve({ id: "w1" }) });

describe("Warehouse address edit", () => {
  beforeEach(() => { state.updates.length = 0; state.scopeCalls.length = 0; });

  it("an address-only edit writes address_country_id and never country_id", async () => {
    await call({ address_country_id: "country-addr", state_province_id: "s1", city_id: "c1", full_address: "Gate 4" });
    const patch = state.updates[0];
    expect(patch.address_country_id).toBe("country-addr");
    expect(patch.state_province_id).toBe("s1");
    expect(patch.city_id).toBe("c1");
    expect(patch.full_address).toBe("Gate 4");
    expect("country_id" in patch).toBe(false);
  });

  it("access is still decided by the operational country, not by the new address country", async () => {
    await call({ address_country_id: "country-addr" });
    expect(state.scopeCalls[0]).toMatchObject({ resource: "warehouses", action: "update", countryId: "country-ops" });
  });
});
