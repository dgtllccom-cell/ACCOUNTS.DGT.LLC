import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCity, resolveCountryUuid } = vi.hoisted(() => ({
  createCity: vi.fn(async () => ({ id: "created" })),
  resolveCountryUuid: vi.fn(async () => "pk"),
}));
vi.mock("@/lib/auth/session", () => ({
  requireErpSession: async () => ({ isSuperAdmin: false, countryIds: ["pk"], userId: "actor" }),
}));
vi.mock("@/lib/repositories/locations-repository", () => ({
  locationsRepository: { createCity, resolveCountryUuid },
}));
vi.mock("@/lib/i18n/localize-records", () => ({ localizeRecordNames: vi.fn() }));

import { POST } from "@/app/api/erp/locations/cities/route";
const request = (code?: string) => new NextRequest("http://localhost/api/erp/locations/cities", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ countryId: "pk", name: "Example", code, zipCode: "10000" }),
});

beforeEach(() => vi.clearAllMocks());
describe("city code is required by the shared create endpoint", () => {
  it.each([undefined, "", "  "])("rejects %s before any repository call even when ZIP exists", async (code) => {
    const res = await POST(request(code));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "CITY_CODE_REQUIRED" } });
    expect(resolveCountryUuid).not.toHaveBeenCalled();
    expect(createCity).not.toHaveBeenCalled();
  });
  it("stores the trimmed code separately from ZIP", async () => {
    expect((await POST(request(" EX "))).status).toBe(200);
    expect(createCity).toHaveBeenCalledWith(expect.objectContaining({ code: "EX", zipCode: "10000" }));
  });
});
