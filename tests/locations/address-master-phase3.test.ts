import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { composeFacilityAddress, splitFacilityAddress } from "@/features/clearing-agent/facility-address";

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: (fn: (sql: unknown) => unknown) => fn(mocks.sql) }));

import { GET } from "@/app/api/public/form-link/[token]/locations/route";

const COUNTRY = "11111111-1111-4111-8111-111111111111";
const STATE = "22222222-2222-4222-8222-222222222222";
const req = (query: string) => ({ nextUrl: new URL(`http://x/api/public/form-link/t/locations?${query}`) }) as unknown as NextRequest;
const ctx = (token: string) => ({ params: Promise.resolve({ token }) });

describe("external share form reads the central Location Management Master", () => {
  beforeEach(() => mocks.sql.mockReset());

  it("returns master countries for an active link", async () => {
    mocks.sql
      .mockResolvedValueOnce([{ status: "active", expires_at: null }])
      .mockResolvedValueOnce([{ id: COUNTRY, name: "Pakistan", iso2: "PK" }]);
    const res = await GET(req("level=countries"), ctx("tok_live"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toEqual([{ id: COUNTRY, name: "Pakistan", iso2: "PK" }]);
    // the country query reads public.countries (the master), only active / not deleted
    const sqlText = (mocks.sql.mock.calls[1][0] as TemplateStringsArray).join("?");
    expect(sqlText).toMatch(/from countries/);
    expect(sqlText).toMatch(/is_active = true and deleted_at is null/);
  });

  it("refuses an expired / revoked link", async () => {
    mocks.sql.mockResolvedValueOnce([{ status: "revoked", expires_at: null }]);
    const res = await GET(req("level=countries"), ctx("tok_old"));
    expect(res.status).toBe(403);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it("refuses an unknown link", async () => {
    mocks.sql.mockResolvedValueOnce([]);
    expect((await GET(req("level=countries"), ctx("nope"))).status).toBe(403);
  });

  it("validates level and ids before touching the database", async () => {
    expect((await GET(req("level=planets"), ctx("tok"))).status).toBe(400);
    expect((await GET(req("level=states&countryId=not-a-uuid"), ctx("tok"))).status).toBe(400);
    expect((await GET(req(`level=cities&countryId=${COUNTRY}&stateId=bad`), ctx("tok"))).status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("loads cities of the selected state from public.cities", async () => {
    mocks.sql
      .mockResolvedValueOnce([{ status: "active", expires_at: null }])
      .mockResolvedValueOnce([{ id: "c1", name: "Karachi", zip_code: "74000" }]);
    const res = await GET(req(`level=cities&countryId=${COUNTRY}&stateId=${STATE}`), ctx("tok"));
    expect((await res.json()).data[0].name).toBe("Karachi");
    expect((mocks.sql.mock.calls[1][0] as TemplateStringsArray).join("?")).toMatch(/from cities[\s\S]*state_province_id/);
  });
});

describe("facility (delivery) address text", () => {
  it("joins the detail and the master place line", () => {
    expect(composeFacilityAddress({ detail: "Plot 7, Gate 4", city: "Karachi", state: "Sindh", postalCode: "74000", country: "Pakistan" }))
      .toBe("Plot 7, Gate 4 | Karachi, Sindh, 74000, Pakistan");
  });

  it("reopening returns only the detail, so re-saving never duplicates the place line", () => {
    const saved = composeFacilityAddress({ detail: "Plot 7", city: "Karachi", country: "Pakistan" });
    const { detail, place } = splitFacilityAddress(saved);
    expect(detail).toBe("Plot 7");
    expect(place).toBe("Karachi, Pakistan");
    expect(composeFacilityAddress({ detail, fallbackPlaceLine: place })).toBe(saved);
  });

  it("keeps older free-text rows unchanged", () => {
    expect(splitFacilityAddress("Old yard, Port Qasim")).toEqual({ detail: "Old yard, Port Qasim", place: "" });
    expect(composeFacilityAddress({ detail: "Old yard, Port Qasim" })).toBe("Old yard, Port Qasim");
  });

  it("a user-typed separator cannot fake a place line", () => {
    expect(composeFacilityAddress({ detail: "A | B", city: "Dubai" })).toBe("A B | Dubai");
  });
});
