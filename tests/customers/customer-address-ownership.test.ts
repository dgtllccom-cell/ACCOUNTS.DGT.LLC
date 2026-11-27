import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/erp/customers/route";
import { PATCH } from "@/app/api/erp/customers/[id]/route";
import { CustomersService } from "@/lib/services/customers-service";

const { repository, validate, authorize, session } = vi.hoisted(() => ({
  repository: {
    getById: vi.fn(), getContacts: vi.fn(), getRegistrations: vi.fn(),
    create: vi.fn(), update: vi.fn(), insertContacts: vi.fn(), insertRegistrations: vi.fn(),
  },
  validate: vi.fn(),
  authorize: vi.fn(),
  session: { userId: "actor", countryIds: [] as string[] },
}));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => session }));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: authorize, getScopeFromSearchParams: vi.fn() }));
vi.mock("@/lib/api/audit", () => ({ auditApiAction: vi.fn() }));
vi.mock("@/lib/permissions/truck-trial", () => ({ isTruckTrial: () => false }));
vi.mock("@/lib/repositories/customers-repository", () => ({ customersRepository: repository }));
vi.mock("@/lib/services/geo-hierarchy-validator", () => ({ assertGeoHierarchy: validate }));
vi.mock("@/lib/services/translation-trigger-service", () => ({ translateMasterRecord: vi.fn() }));
vi.mock("@/lib/api/record-change-history", () => ({ writeRecordChangeHistory: vi.fn() }));

const uae = "b3dad0d2-fe60-497c-ab51-849aa1926205";
const india = "6f6baaf6-7d5c-4467-a7a1-b2c8e406f95d";
const mumbai = "1ee711d8-fdd1-45b4-b7b8-663090294f16";
const alRas = "6132c1dd-3fcb-47c2-8783-57d905182df1";
const service = new CustomersService();
function request(method: string, body: object) {
  return new NextRequest("http://localhost/api/erp/customers", {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
const context = { params: Promise.resolve({ id: "customer" }) };

beforeEach(() => {
  vi.resetAllMocks();
  session.countryIds = [uae];
  repository.getById.mockResolvedValue({ country_id: uae, original_language_code: "en" });
  repository.create.mockResolvedValue("customer");
});

describe("Customer physical address vs assigned ERP country", () => {
  it("authorizes the selected operational country/branch and validates a different address country", async () => {
    const result = await POST(request("POST", { countryId: uae, cityBranchId: alRas, addressCountryId: india, cityId: mumbai, customerName: "Fixture" }));
    expect(result.status).toBe(201);
    expect(authorize).toHaveBeenCalledWith(session, expect.objectContaining({ countryId: uae, cityBranchId: alRas }));
    expect(validate).toHaveBeenCalledWith(expect.objectContaining({ countryId: india, cityId: mumbai }));
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ countryId: uae, addressCountryId: india, cityId: mumbai }));
  });
  it("uses the single authorized country without inferring scope from residential country", async () => {
    expect((await POST(request("POST", { addressCountryId: india, customerName: "Fixture" }))).status).toBe(201);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ countryId: uae, addressCountryId: india }));
  });
  it("requires explicit scope when the assigned country is not known", async () => {
    session.countryIds = [];
    expect((await POST(request("POST", { addressCountryId: india, customerName: "Fixture" }))).status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
  });
  it("checks the stored scope on an address edit and never writes a replacement ownership country", async () => {
    const result = await PATCH(request("PATCH", { addressCountryId: india, cityId: mumbai, address: "Street" }), context);
    expect(result.status).toBe(200);
    expect(authorize).toHaveBeenLastCalledWith(session, expect.objectContaining({ countryId: uae, action: "update" }));
    expect(validate).toHaveBeenCalledWith(expect.objectContaining({ countryId: india, cityId: mumbai }));
    expect(repository.update).toHaveBeenCalledWith("customer", { addressCountryId: india, cityId: mumbai, address: "Street" });
  });
  it("does not save address edits when the record's assigned country is outside allowed scope", async () => {
    authorize.mockImplementation((_session, scope) => {
      if (scope.countryId === uae) throw new ApiClientError("Country unavailable", { status: 403 });
    });
    expect((await PATCH(request("PATCH", { addressCountryId: india, cityId: mumbai }), context)).status).toBe(403);
    expect(repository.update).not.toHaveBeenCalled();
  });
  it("does not rewrite an untouched legacy address on identity-only saves", async () => {
    await service.update("customer", { customerName: "Rename" });
    expect(validate).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith("customer", { customerName: "Rename" });
  });
});
