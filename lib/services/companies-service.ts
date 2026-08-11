import { companiesRepository, type CompanyContact, type CompanyRegistration } from "@/lib/repositories/companies-repository";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

export type CompanyInput = {
  name: string;
  legalName?: string | null;
  baseCurrency: string;
  originalLanguage: SupportedLanguage;
  ownerName?: string | null;
  businessType?: string | null;
  countryId?: string | null;
  stateProvinceId?: string | null;
  districtId?: string | null;
  cityId?: string | null;
  areaLocationId?: string | null;
  countryName?: string | null;
  stateName?: string | null;
  districtName?: string | null;
  cityName?: string | null;
  areaName?: string | null;
  zipCode?: string | null;
  address?: string | null;
  contacts?: CompanyContact[];
  registrations?: CompanyRegistration[];
  ownerIds?: CompanyRegistration[];
};

export class CompaniesService {
  async search(input: { query?: string | null; limit?: number }) {
    return await companiesRepository.search(input);
  }

  async getById(id: string) {
    return await companiesRepository.getById(id);
  }

  async create(input: CompanyInput, actorId?: string | null) {
    const companyId = await companiesRepository.create({
      name: input.name,
      legalName: input.legalName ?? null,
      baseCurrency: input.baseCurrency,
      ownerName: input.ownerName ?? null,
      businessType: input.businessType ?? null,
      countryId: input.countryId ?? null,
      stateProvinceId: input.stateProvinceId ?? null,
      districtId: input.districtId ?? null,
      cityId: input.cityId ?? null,
      areaLocationId: input.areaLocationId ?? null,
      countryName: input.countryName ?? null,
      stateName: input.stateName ?? null,
      districtName: input.districtName ?? null,
      cityName: input.cityName ?? null,
      areaName: input.areaName ?? null,
      zipCode: input.zipCode ?? null,
      address: input.address ?? null,
      contacts: input.contacts ?? [],
      registrations: input.registrations ?? [],
      ownerIds: input.ownerIds ?? []
    });

    await translateMasterRecord(
      "companies",
      companyId,
      {
        name: input.name,
        legal_name: input.legalName ?? null,
        owner_name: input.ownerName ?? null,
        country_name: input.countryName ?? null,
        state_name: input.stateName ?? null,
        district_name: input.districtName ?? null,
        city_name: input.cityName ?? null,
        area_name: input.areaName ?? null
      },
      input.originalLanguage,
      actorId ?? null
    );
    return companyId;
  }

  async update(
    id: string,
    input: Partial<CompanyInput> & { originalLanguage?: SupportedLanguage },
    actorId?: string | null
  ) {
    await companiesRepository.update(id, input);

    if (input.name || input.legalName || input.ownerName || input.businessType || input.address || input.originalLanguage) {
      const company = await companiesRepository.getById(id);
      const resolvedLang = input.originalLanguage ?? ((company as any).original_language_code as SupportedLanguage) ?? "en";
      await translateMasterRecord(
        "companies",
        id,
        {
          name: input.name ?? company.name,
          legal_name: "legalName" in input ? (input.legalName ?? null) : company.legal_name,
          owner_name: "ownerName" in input ? (input.ownerName ?? null) : company.owner_name,
          country_name: "countryName" in input ? (input.countryName ?? null) : company.country_name,
          state_name: "stateName" in input ? (input.stateName ?? null) : company.state_name,
          district_name: "districtName" in input ? (input.districtName ?? null) : company.district_name,
          city_name: "cityName" in input ? (input.cityName ?? null) : company.city_name,
          area_name: "areaName" in input ? (input.areaName ?? null) : company.area_name
        },
        resolvedLang,
        actorId ?? null
      );
    }
  }

  async softDelete(id: string) {
    await companiesRepository.softDelete(id);
  }
}

export const companiesService = new CompaniesService();
