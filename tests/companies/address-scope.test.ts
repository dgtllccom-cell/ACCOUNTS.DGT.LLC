import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompaniesService } from "@/lib/services/companies-service";
import { companyUpdateSchema } from "@/lib/api/erp-validation";

const { repository, assertGeoHierarchy } = vi.hoisted(() => ({
  repository: { getById: vi.fn(), create: vi.fn(), update: vi.fn(), updateLegalProfile: vi.fn() },
  assertGeoHierarchy: vi.fn(),
}));
vi.mock("@/lib/repositories/companies-repository", () => ({ companiesRepository: repository }));
vi.mock("@/lib/services/geo-hierarchy-validator", () => ({ assertGeoHierarchy }));
vi.mock("@/lib/services/translation-trigger-service", () => ({ translateMasterRecord: vi.fn() }));
vi.mock("@/lib/api/record-change-history", () => ({ writeRecordChangeHistory: vi.fn() }));

const uae = "b3dad0d2-fe60-497c-ab51-849aa1926205";
const india = "6f6baaf6-7d5c-4467-a7a1-b2c8e406f95d";
const mumbai = "1ee711d8-fdd1-45b4-b7b8-663090294f16";
const alRas = "6132c1dd-3fcb-47c2-8783-57d905182df1";
const service = new CompaniesService();

describe("registered company address vs operational scope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repository.getById.mockResolvedValue({ country_id: uae, city_branch_id: alRas, base_currency: "AED" });
    repository.create.mockResolvedValue("company");
  });

  it("creates an India registered address for a UAE-scoped company without changing its branch or currency", async () => {
    await service.create({ name: "Company", originalLanguage: "en", baseCurrency: "AED", countryId: uae, cityBranchId: alRas, addressCountryId: india, cityId: mumbai });
    expect(assertGeoHierarchy).toHaveBeenCalledWith(expect.objectContaining({ countryId: india, cityId: mumbai }));
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      countryId: uae, cityBranchId: alRas, baseCurrency: "AED", addressCountryId: india, cityId: mumbai,
    }));
  });

  it("validates the new address against saved child IDs before writing", async () => {
    repository.getById.mockResolvedValue({ country_id: uae, city_id: mumbai });
    assertGeoHierarchy.mockRejectedValueOnce(new Error("Country mismatch"));
    await expect(service.update("company", { addressCountryId: uae })).rejects.toThrow("Country mismatch");
    expect(assertGeoHierarchy).toHaveBeenCalledWith(expect.objectContaining({ countryId: uae, cityId: mumbai }));
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("clears old descendants explicitly without sending changes to the operational scope", async () => {
    repository.getById.mockResolvedValue({ country_id: uae, city_id: mumbai, address_country_id: india });
    const patch = companyUpdateSchema.parse({ addressCountryId: uae, cityId: null, stateProvinceId: null, zipCode: "12345" });
    await service.update("company", patch);
    expect(assertGeoHierarchy).toHaveBeenCalledWith(expect.objectContaining({ countryId: uae, cityId: null, stateProvinceId: null }));
    expect(repository.update).toHaveBeenCalledWith("company", { addressCountryId: uae, cityId: null, stateProvinceId: null, zipCode: "12345" });
  });

  it("doesn't fill or rewrite a legacy geography during an unrelated change", async () => {
    await service.update("company", { name: "Updated Company" });
    expect(assertGeoHierarchy).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith("company", { name: "Updated Company" });
  });
});
