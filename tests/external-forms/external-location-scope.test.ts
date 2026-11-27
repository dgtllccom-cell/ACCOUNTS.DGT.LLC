import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as choices } from "@/app/api/public/form-link/[token]/locations/route";
import { POST as submit } from "@/app/api/public/form-link/[token]/route";
import { usesCentralExternalAddress } from "@/lib/services/external-form-address";

const { db, create, list, resolve } = vi.hoisted(() => ({
  db: vi.fn(), create: vi.fn(), list: vi.fn(), resolve: vi.fn(),
}));
vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: db }));
vi.mock("@/lib/services/customers-service", () => ({ customersService: { create } }));
vi.mock("@/lib/services/companies-service", () => ({ companiesService: { create: vi.fn() } }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLanguage: async () => "en" }));
vi.mock("@/lib/i18n/localize-records", () => ({ localizeRecordNames: async (rows: unknown[]) => rows }));
vi.mock("@/lib/services/external-form-address", async (original) => ({
  ...await original<typeof import("@/lib/services/external-form-address")>(),
  listExternalAddressChoices: list, resolveExternalAddress: resolve,
}));

const uae = "b3dad0d2-fe60-497c-ab51-849aa1926205";
const india = "6f6baaf6-7d5c-4467-a7a1-b2c8e406f95d";
const mumbai = "1ee711d8-fdd1-45b4-b7b8-663090294f16";
const maharashtra = "756e3061-9e86-4c80-911c-26f533f0b0ee";
const token = "persisted-test-fixture";
const link = { status: "active", form_type: "customer", central_address: true, country_id: uae, expires_at: null };
const context = { params: Promise.resolve({ token }) };
function submission(data: object) {
  return new NextRequest("http://localhost/api/public/form-link/fixture", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  db.mockResolvedValueOnce(link).mockResolvedValue(undefined);
  resolve.mockResolvedValue({ country: "India", stateProvince: "Maharashtra", city: "Mumbai" });
  create.mockResolvedValue("customer-fixture");
});

describe("Location Management for scoped external forms", () => {
  it("enables only explicitly marked active Customer/Employee links carrying a stored country", () => {
    expect(usesCentralExternalAddress(link)).toBe(true);
    expect(usesCentralExternalAddress({ ...link, form_type: "employee" })).toBe(true);
    for (const ineligible of [{ central_address: undefined }, { country_id: null }, { status: "used" }, { form_type: "company" }]) {
      expect(usesCentralExternalAddress({ ...link, ...ineligible })).toBe(false);
    }
  });
  it("returns only geographic labels and IDs with postal suggestions, not operational metadata", async () => {
    list.mockResolvedValue([{ id: mumbai, name: "Mumbai", postalCode: "400001", internal: "not public" }]);
    const r = await choices(new NextRequest(`http://localhost/form/locations?kind=city&countryId=${india}&stateProvinceId=${maharashtra}`), context);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect((await r.json()).choices).toEqual([{ id: mumbai, name: "Mumbai", postalCode: "400001" }]);
    expect(list).toHaveBeenCalledWith(token, { kind: "city", countryId: india, stateProvinceId: maharashtra });
  });
  it("returns no choices when the persisted gate rejects a link", async () => {
    list.mockResolvedValue(null);
    const r = await choices(new NextRequest("http://localhost/form/locations?kind=country"), context);
    expect(r.status).toBe(404);
    expect((await r.json()).choices).toBeUndefined();
  });
  it("saves foreign residence independently of the Customer link issuing scope", async () => {
    const r = await submit(submission({
      addressCountryId: india, stateProvinceId: maharashtra, cityId: mumbai,
      customerName: "Sample Person", postalCode: "00123",
    }), context);
    expect(r.status).toBe(201);
    expect(resolve).toHaveBeenCalledWith({ addressCountryId: india, stateProvinceId: maharashtra, cityId: mumbai }, uae);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      countryId: uae, addressCountryId: india, stateProvinceId: maharashtra, cityId: mumbai,
      notes: expect.stringContaining('"cityCode":"00123"'),
    }), null);
  });
  it("keeps Employee submissions in the issuing country's existing review flow", async () => {
    const query = vi.fn(async (_template: TemplateStringsArray, ..._values: unknown[]) => [{ id: "employee-review" }]);
    db.mockReset()
      .mockResolvedValueOnce({ ...link, form_type: "employee" })
      .mockImplementationOnce((handle) => handle(Object.assign(query, { json: (value: unknown) => value })))
      .mockResolvedValueOnce(undefined);
    const r = await submit(submission({ addressCountryId: india, stateProvinceId: maharashtra, cityId: mumbai }), context);
    expect(r.status).toBe(201);
    expect(query.mock.calls[0]?.slice(1)).toEqual([
      "employee", token,
      expect.objectContaining({ countryId: uae, addressCountryId: india, city: "Mumbai" }), uae,
    ]);
    expect(create).not.toHaveBeenCalled();
  });
  it("does not create a record when the master cannot validate the chosen geography", async () => {
    resolve.mockResolvedValueOnce(null);
    const r = await submit(submission({ addressCountryId: india, cityId: mumbai }), context);
    expect(r.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
  it("keeps a used link idempotent without revalidating or writing the address", async () => {
    db.mockReset().mockResolvedValueOnce({ ...link, status: "used", submitted_record_id: "previous" });
    const r = await submit(submission({}), context);
    expect(r.status).toBe(200);
    expect((await r.json()).data).toMatchObject({ alreadySubmitted: true, submittedRecordId: "previous" });
    expect(resolve).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
