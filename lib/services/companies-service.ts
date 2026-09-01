import { companiesRepository, type CompanyContact, type CompanyRegistration } from "@/lib/repositories/companies-repository";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";
import { assertGeoHierarchy } from "@/lib/services/geo-hierarchy-validator";

export type CompanyInput = {
  name: string;
  legalName?: string | null;
  baseCurrency: string;
  originalLanguage: SupportedLanguage;
  ownerName?: string | null;
  ownerPersonId?: string | null;
  managerPersonId?: string | null;
  businessType?: string | null;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  isBranchOperative?: boolean;
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
  async search(input: { query?: string | null; limit?: number; ownerPersonId?: string | null; countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null; isBranchOperative?: boolean }) {
    return await companiesRepository.search(input);
  }

  async getById(id: string) {
    return await companiesRepository.getById(id);
  }

  async create(input: CompanyInput, actorId?: string | null) {
    await assertGeoHierarchy({
      countryId: input.countryId,
      stateProvinceId: input.stateProvinceId,
      districtId: input.districtId,
      cityId: input.cityId,
      areaLocationId: input.areaLocationId,
    });
    const companyId = await companiesRepository.create({
      name: input.name,
      legalName: input.legalName ?? null,
      baseCurrency: input.baseCurrency,
      ownerName: input.ownerName ?? null,
      ownerPersonId: input.ownerPersonId ?? null,
      managerPersonId: input.managerPersonId ?? null,
      businessType: input.businessType ?? null,
      countryId: input.countryId ?? null,
      countryBranchId: input.countryBranchId ?? null,
      cityBranchId: input.cityBranchId ?? null,
      isBranchOperative: input.isBranchOperative ?? false,
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

    const current = await companiesRepository.getById(companyId);
    await writeRecordChangeHistory({
      recordTable: "companies",
      recordId: companyId,
      action: "create",
      actorId: actorId ?? null,
      countryId: current?.country_id ?? input.countryId ?? null,
      beforeData: null,
      afterData: current ?? null
    });
    return companyId;
  }

  async update(
    id: string,
    input: Partial<CompanyInput> & { originalLanguage?: SupportedLanguage },
    actorId?: string | null
  ) {
    const before = await companiesRepository.getById(id);
    await assertGeoHierarchy({
      countryId: "countryId" in input ? input.countryId : before?.country_id ?? null,
      stateProvinceId: "stateProvinceId" in input ? input.stateProvinceId : before?.state_province_id ?? null,
      districtId: "districtId" in input ? input.districtId : before?.district_id ?? null,
      cityId: "cityId" in input ? input.cityId : before?.city_id ?? null,
      areaLocationId: "areaLocationId" in input ? input.areaLocationId : before?.area_location_id ?? null,
    });
    await companiesRepository.update(id, input);
    const after = await companiesRepository.getById(id);

    await writeRecordChangeHistory({
      recordTable: "companies",
      recordId: id,
      action: "update",
      actorId: actorId ?? null,
      countryId: after?.country_id ?? before?.country_id ?? null,
      beforeData: before ?? null,
      afterData: after ?? null
    });

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
    const before = await companiesRepository.getById(id);
    await companiesRepository.softDelete(id);
    await writeRecordChangeHistory({
      recordTable: "companies",
      recordId: id,
      action: "delete",
      countryId: before?.country_id ?? null,
      beforeData: before ?? null,
      afterData: { deleted_at: new Date().toISOString() }
    });
  }
}

export const companiesService = new CompaniesService();
