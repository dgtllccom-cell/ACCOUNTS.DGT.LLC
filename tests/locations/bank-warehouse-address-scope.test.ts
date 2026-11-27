import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiClientError } from "@/lib/api/response";
import {
  assertAssignedCountryUnchanged,
  geographyCountryForValidation,
  physicalAddressCountryId,
} from "@/lib/services/physical-address-scope";

// India address on a record assigned to UAE / Al Ras / AED.
const uae = "b3dad0d2-fe60-497c-ab51-849aa1926205";
const india = "6f6baaf6-7d5c-4467-a7a1-b2c8e406f95d";
const mumbai = "1ee711d8-fdd1-45b4-b7b8-663090294f16";
const maharashtra = "0b0d6a8e-62a1-4b0e-a8fa-0b6e6d2b0a11";
const dubai = "5d2a4e8b-0a3c-4f53-9a3c-1f1e6c2b7d21";

const { session, validate, sqlCalls, bankRow, wh } = vi.hoisted(() => ({
  session: { userId: "actor", isSuperAdmin: false, countryIds: [] as string[], preferredLanguage: "en", assignments: [] },
  validate: vi.fn(),
  sqlCalls: [] as Array<{ text: string; values: unknown[] }>,
  bankRow: { current: {} as Record<string, unknown> },
  wh: { existing: {} as Record<string, unknown>, inserted: null as Record<string, unknown> | null, patch: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => session }));
vi.mock("@/lib/api/scope-middleware", () => ({
  authorizeApiScope: (s: typeof session, scope: { countryId?: string | null }) => {
    if (!s.isSuperAdmin && scope.countryId && !s.countryIds.includes(scope.countryId)) {
      throw new ApiClientError("Not authorized for this country", { status: 403 });
    }
  },
}));
vi.mock("@/lib/services/geo-hierarchy-validator", () => ({ assertGeoHierarchy: validate }));
vi.mock("@/lib/services/translation-trigger-service", () => ({ translateMasterRecord: vi.fn() }));
vi.mock("@/lib/services/form-serials", () => ({ allocateFormSerials: vi.fn(async () => ({})) }));
vi.mock("@/lib/i18n/record-translation-sync", () => ({ syncRecordTranslations: vi.fn(async () => undefined) }));
vi.mock("@/lib/api/record-change-history", () => ({ writeRecordChangeHistory: vi.fn(async () => undefined) }));
vi.mock("@/lib/i18n/localize-records", () => ({
  localizeRecordFields: async (rows: unknown[]) => rows,
  localizeJoinedNames: async (rows: unknown[]) => rows,
  localizeRecordNames: async (rows: unknown[]) => rows,
  wantsRawRecord: () => true,
  searchRecordIdsByTranslation: async () => [],
}));
vi.mock("@/lib/db/local-postgres", () => {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    sqlCalls.push({ text, values });
    if (/^\s*UPDATE public\.banks/.test(text)) {
      // Apply the CASE/COALESCE semantics the route relies on.
      return Promise.resolve([]);
    }
    if (/INSERT INTO public\.banks/.test(text)) return Promise.resolve([{ ...bankRow.current, id: "bank-new" }]);
    if (/next_entity_serial/.test(text)) return Promise.resolve([{ code: "ACC-1" }]);
    return Promise.resolve([bankRow.current]);
  };
  return { withLocalPg: async (fn: (s: typeof sql) => unknown) => fn(sql), withReadPg: async (fn: (s: typeof sql) => unknown) => fn(sql) };
});
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    const chain: Record<string, unknown> = {};
    let mode: "select" | "update" | "insert" = "select";
    Object.assign(chain, {
      from: () => { mode = "select"; return chain; },
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      insert: (row: Record<string, unknown>) => { mode = "insert"; wh.inserted = row; return chain; },
      update: (patch: Record<string, unknown>) => { mode = "update"; wh.patch = patch; return chain; },
      single: async () => ({
        data: mode === "select" ? wh.existing : { id: "wh", warehouse_name: "Fixture", ...(wh.inserted ?? {}), ...wh.existing, ...(wh.patch ?? {}) },
        error: null,
      }),
    });
    return chain;
  },
}));

import { POST as createBank } from "@/app/api/erp/banks/route";
import { PUT as updateBank } from "@/app/api/erp/banks/[id]/route";
import { POST as createWarehouse } from "@/app/api/erp/master-data/warehouses/route";
import { PATCH as updateWarehouse } from "@/app/api/erp/master-data/warehouses/[id]/route";

function request(method: string, body: object) {
  return new NextRequest("http://localhost/api/test", {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "8e7a3b0e-3c55-4c1a-9d8e-0a6f1d2c3b4a" }) };
const lastBankUpdate = () => sqlCalls.filter((c) => /^\s*UPDATE public\.banks SET/.test(c.text)).at(-1);

beforeEach(() => {
  vi.clearAllMocks();
  sqlCalls.length = 0;
  session.isSuperAdmin = false;
  session.countryIds = [uae];
  bankRow.current = {
    id: "bank", bank_name: "Fixture Bank", currency: "AED", country_id: uae, address_country_id: null,
    state_province_id: null, district_id: null, city_id: dubai, is_active: true,
  };
  wh.existing = { country_id: uae, address_country_id: null, state_province_id: null, district_id: null, city_id: dubai };
  wh.inserted = null;
  wh.patch = null;
});

describe("physical-address-scope helpers", () => {
  it("allows omitting or repeating the assigned country, rejects moving it", () => {
    expect(() => assertAssignedCountryUnchanged(uae, undefined)).not.toThrow();
    expect(() => assertAssignedCountryUnchanged(uae, uae)).not.toThrow();
    expect(() => assertAssignedCountryUnchanged(uae, india)).toThrow(/assigned country/);
    expect(() => assertAssignedCountryUnchanged(uae, null)).toThrow(/assigned country/);
  });
  it("reads legacy rows' address country only when they carry saved geography", () => {
    expect(physicalAddressCountryId({ country_id: uae, address_country_id: india })).toBe(india);
    expect(physicalAddressCountryId({ country_id: uae, city_id: dubai })).toBe(uae);
    expect(physicalAddressCountryId({ country_id: uae })).toBe("");
  });
  it("validates geography against the physical country, falling back to the assigned one", () => {
    expect(geographyCountryForValidation(india, uae)).toBe(india);
    expect(geographyCountryForValidation(null, uae)).toBe(uae);
  });
});

describe("Bank: India branch address on a UAE / AED bank", () => {
  it("creates the bank under the assigned UAE scope with an India physical address", async () => {
    const res = await createBank(request("POST", {
      bankName: "Fixture Bank", countryId: uae, addressCountryId: india,
      stateProvinceId: maharashtra, cityId: mumbai, currencyCode: "AED",
    }));
    expect(res.status).toBeLessThan(300);
    expect(validate).toHaveBeenCalledWith(expect.objectContaining({ countryId: india, cityId: mumbai }));
    const insert = sqlCalls.find((c) => /INSERT INTO public\.banks/.test(c.text))!;
    expect(insert.text).toMatch(/country_id, address_country_id, state_province_id/);
    const countryIdx = insert.values.indexOf(uae);
    expect(countryIdx).toBeGreaterThan(-1);
    expect(insert.values[countryIdx + 1]).toBe(india);
    expect(insert.values).toContain("AED");
  });

  it("edits the address to India without touching country_id, currency or ownership", async () => {
    const res = await updateBank(request("PUT", { addressCountryId: india, stateProvinceId: maharashtra, cityId: mumbai, fullAddress: "BKC, Mumbai" }), ctx);
    expect(res.status).toBe(200);
    const update = lastBankUpdate()!;
    expect(update.text).not.toMatch(/\bcountry_id = COALESCE/);
    expect(update.text).not.toMatch(/(^|[^_])country_id =/);
    expect(update.text).toMatch(/address_country_id = CASE/);
    expect(update.values).toContain(india);
    expect(update.values).not.toContain(uae);
    expect(validate).toHaveBeenCalledWith(expect.objectContaining({ countryId: india, cityId: mumbai }));
  });

  it("refuses an edit that tries to move the bank to another assigned country", async () => {
    const res = await updateBank(request("PUT", { countryId: india, addressCountryId: india, cityId: mumbai }), ctx);
    expect(res.status).toBe(409);
    expect(lastBankUpdate()).toBeUndefined();
  });
});

describe("Warehouse: India facility address on a UAE warehouse", () => {
  it("creates under the assigned UAE scope with an India physical address", async () => {
    const res = await createWarehouse(request("POST", {
      warehouse_name: "Fixture WH", country_id: uae, address_country_id: india, state_province_id: maharashtra, city_id: mumbai,
    }));
    expect(res.status).toBe(200);
    expect(wh.inserted).toMatchObject({ country_id: uae, address_country_id: india, city_id: mumbai });
    expect(validate).toHaveBeenCalledWith(expect.objectContaining({ countryId: india, cityId: mumbai }));
  });

  it("refuses creating a warehouse under a country outside the user's scope", async () => {
    const res = await createWarehouse(request("POST", { warehouse_name: "Fixture WH", country_id: india }));
    expect(res.status).toBe(403);
    expect(wh.inserted).toBeNull();
  });

  it("edits the address to India and never writes country_id", async () => {
    const res = await updateWarehouse(request("PATCH", { address_country_id: india, state_province_id: maharashtra, city_id: mumbai, full_address: "Bhiwandi" }), ctx);
    expect(res.status).toBe(200);
    expect(wh.patch).toMatchObject({ address_country_id: india, city_id: mumbai });
    expect(wh.patch).not.toHaveProperty("country_id");
  });

  it("refuses an edit that tries to move the warehouse to another assigned country", async () => {
    const res = await updateWarehouse(request("PATCH", { country_id: india, city_id: mumbai }), ctx);
    expect(res.status).toBe(409);
    expect(wh.patch).toBeNull();
  });
});
