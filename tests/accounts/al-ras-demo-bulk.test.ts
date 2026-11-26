import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoRequestSchema, demoAccountPayload } from "@/lib/accounts-demo-import";

const stub = vi.hoisted(() => ({
  query: vi.fn(), create: vi.fn(), authorize: vi.fn(), domain: vi.fn(),
  pgAvailable: true,
}));
vi.mock("@/lib/db/local-postgres", () => ({
  withLocalPg: async (fn: Function) => stub.pgAvailable ? fn((strings: unknown) => Array.isArray(strings) && "raw" in strings ? stub.query() : strings) : null,
}));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: stub.authorize }));
vi.mock("@/lib/auth/session", () => ({ sessionInDomain: stub.domain }));
vi.mock("@/app/api/erp/accounting/accounts/route", () => ({ POST: stub.create }));

import { processAlRasDemoBulk } from "@/lib/api/al-ras-demo-bulk";
import type { ErpSession } from "@/lib/auth/session";

const ref = "DEMO-ALRAS-20261126-B-IN-001";
const row = { reference: ref, name: "DEMO Test IN-001", category: "P/S" as const };
const session = { isSuperAdmin: true } as ErpSession;
const branch = { id: "branch", countryId: "UAE", countryBranchId: "main" };
const inMaster = { id: "India", iso2: "IN" };
const request = (action: "preview" | "create", rows = [row]) => ({ mode: "al-ras-demo", action, rows });

function db(countries = [inMaster], matches: unknown[] = []) {
  stub.query.mockResolvedValueOnce([branch]).mockResolvedValueOnce(countries).mockResolvedValueOnce(matches);
}

beforeEach(() => {
  vi.resetAllMocks();
  stub.pgAvailable = true;
  stub.domain.mockReturnValue(true);
});

describe("Al Ras demo import", () => {
  it("rejects repeated references, wrong countries, extra fields, and writes of more than five rows", () => {
    expect(demoRequestSchema.safeParse(request("preview", [row, row])).success).toBe(false);
    expect(demoRequestSchema.safeParse(request("create", [{ ...row, category: "invalid" } as never])).success).toBe(false);
    expect(demoRequestSchema.safeParse({ ...request("create"), rows: [{ ...row, currency: "USD" }] }).success).toBe(false);
    expect(demoRequestSchema.safeParse(request("create", [{ ...row, name: "DEMO Test AE-001" }])).success).toBe(false);
    const six = Array.from({ length: 6 }, (_, i) => ({ ...row, reference: ref.slice(0, -1) + (i + 1), name: "DEMO Test IN-00" + (i + 1) }));
    expect(demoRequestSchema.safeParse(request("preview", six)).success).toBe(true);
    expect(demoRequestSchema.safeParse(request("create", six)).success).toBe(false);
  });

  it("keeps separate operating and address countries, fixed AED, and canonical categories", () => {
    const payload = demoAccountPayload(row, branch, inMaster.id);
    expect(payload).toMatchObject({
      cityBranchId: "branch", countryId: "UAE", countryBranchId: "main", addressCountryId: "India",
      code: "AUTO", openingBalance: 0, currency: "AED", operationalDomain: "business", category: "P/S", kind: "income",
    });
    expect(demoAccountPayload({ ...row, category: "S" }, branch, inMaster.id).kind).toBe("asset");
  });

  it("denies scope and missing database before attempting any creation", async () => {
    expect((await processAlRasDemoBulk({ isSuperAdmin: false } as ErpSession, request("create"))).status).toBe(403);
    stub.domain.mockReturnValueOnce(false);
    expect((await processAlRasDemoBulk(session, request("create"))).status).toBe(403);
    stub.pgAvailable = false;
    expect((await processAlRasDemoBulk(session, request("create"))).status).toBe(503);
    expect(stub.create).not.toHaveBeenCalled();
  });

  it("previews without saving and blocks a missing country instead of using UAE", async () => {
    db();
    const preview = await (await processAlRasDemoBulk(session, request("preview"))).json();
    expect(preview.data.results[0]).toMatchObject({ status: "ready", country: "IN" });
    expect(stub.authorize).toHaveBeenCalledWith(session, expect.objectContaining({ cityBranchId: "branch", action: "create" }));
    db([]);
    const missing = await (await processAlRasDemoBulk(session, request("create"))).json();
    expect(missing.data.results[0].status).toBe("blocked");
    expect(stub.create).not.toHaveBeenCalled();
  });

  it("reconciles a matching existing reference and blocks a mismatched one", async () => {
    const saved = { reference: ref, name: row.name, code: "ACC-000001", category: "P/S", currency: "AED", branch: "branch", domain: "business", address: "India", deleted_at: null };
    db([inMaster], [saved]);
    expect((await (await processAlRasDemoBulk(session, request("create"))).json()).data.results[0]).toMatchObject({ status: "existing", code: saved.code });
    db([inMaster], [{ ...saved, category: "S" }]);
    expect((await (await processAlRasDemoBulk(session, request("create"))).json()).data.results[0].status).toBe("blocked");
    expect(stub.create).not.toHaveBeenCalled();
  });

  it("uses the original creation route and does not repeat an uncertain write", async () => {
    db();
    stub.create.mockResolvedValueOnce(Response.json({ data: { accountNumber: "ACC-000002" } }, { status: 201 }));
    const created = await (await processAlRasDemoBulk(session, request("create"))).json();
    expect(created.data.results[0]).toMatchObject({ status: "created", code: "ACC-000002" });
    expect(await stub.create.mock.calls[0][0].json()).toMatchObject({ category: "P/S", addressCountryId: "India", manualReferenceNumber: ref });
    db();
    stub.create.mockRejectedValueOnce(new Error("response lost"));
    const next = { ...row, reference: ref.slice(0, -1) + "2", name: "DEMO Test IN-002" };
    const response = await (await processAlRasDemoBulk(session, request("create", [row, next]))).json();
    expect(response.data.results).toHaveLength(1);
    expect(response.data.results[0].status).toBe("unknown");
    expect(stub.create).toHaveBeenCalledTimes(2);
  });
});
