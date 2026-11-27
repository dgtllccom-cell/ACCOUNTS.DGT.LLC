import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/erp/customers/[id]/route";

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => ({ userId: "actor" }) }));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: vi.fn() }));
vi.mock("@/lib/api/audit", () => ({ auditApiAction: vi.fn() }));
vi.mock("@/lib/services/customers-service", () => ({ customersService: { update } }));

const countryId = "b3dad0d2-fe60-497c-ab51-849aa1926205";
function request(body: object) {
  return new NextRequest("http://localhost/api/erp/customers/fixture", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
const context = { params: Promise.resolve({ id: "fixture" }) };

describe("shared Person Master address edits", () => {
  it("does not erase a saved address when an Employee syncs the person's name", async () => {
    const body = { countryId, customerName: "Fixture Person", firstName: "Fixture", lastName: "Person" };
    expect((await PATCH(request(body), context)).status).toBe(200);
    expect(update).toHaveBeenLastCalledWith("fixture", { customerName: "Fixture Person", firstName: "Fixture", lastName: "Person" }, "actor");
  });

  it("preserves explicit nulls when an address editor clears fields", async () => {
    expect((await PATCH(request({ countryId, districtId: null, cityId: null, address: null }), context)).status).toBe(200);
    expect(update).toHaveBeenLastCalledWith("fixture", { districtId: null, cityId: null, address: null }, "actor");
  });
});
