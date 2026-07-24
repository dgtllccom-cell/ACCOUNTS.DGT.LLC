import { companiesRepository, type CompanyContact, type CompanyRegistration } from "@/lib/repositories/companies-repository";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { multilingualService } from "@/lib/services/multilingual-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

function translatableFields(input: CompanyInput) {
  return [
    ["name", input.name],
    ["legal_name", input.legalName ?? ""],
    ["owner_name", input.ownerName ?? ""],
    ["business_type", input.businessType ?? ""],
    ["country_name", input.countryName ?? ""],
    ["state_name", input.stateName ?? ""],
    ["district_name", input.districtName ?? ""],
    ["city_name", input.cityName ?? ""],
    ["area_name", input.areaName ?? ""],
    ["address", input.address ?? ""]
  ] as const;
}

function isUuid(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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

    await this.upsertTranslations("companies", companyId, input, actorId ?? null);
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
      const snapshot: CompanyInput = {
        name: input.name ?? company.name,
        legalName: "legalName" in input ? (input.legalName ?? null) : company.legal_name,
        baseCurrency: input.baseCurrency ?? company.base_currency,
        ownerName: "ownerName" in input ? (input.ownerName ?? null) : company.owner_name,
        businessType: "businessType" in input ? (input.businessType ?? null) : company.business_type,
        countryName: "countryName" in input ? (input.countryName ?? null) : company.country_name,
        stateName: "stateName" in input ? (input.stateName ?? null) : company.state_name,
        districtName: "districtName" in input ? (input.districtName ?? null) : company.district_name,
        cityName: "cityName" in input ? (input.cityName ?? null) : company.city_name,
        areaName: "areaName" in input ? (input.areaName ?? null) : company.area_name,
        address: "address" in input ? (input.address ?? null) : company.address,
        originalLanguage: input.originalLanguage ?? "en"
      };
      await this.upsertTranslations("companies", id, snapshot, actorId ?? null);
    }
  }

  async softDelete(id: string) {
    await companiesRepository.softDelete(id);
  }

  private async upsertTranslations(recordTable: string, recordId: string, input: CompanyInput, actorId: string | null) {
    const supabase = createSupabaseAdminClient() as any;
    const correctedBy = isUuid(actorId) ? actorId : null;
    const values = translatableFields(input)
      .filter(([, value]) => Boolean(value && value.trim()))
      .map(([fieldName, value]) => {
        const shell = multilingualService.createAutomaticTranslationShell(value, input.originalLanguage);
        const payload = multilingualService.createRecordTranslationPayload({
          recordTable,
          recordId,
          fieldName,
          text: shell
        });
        return {
          record_table: payload.recordTable,
          record_id: payload.recordId,
          field_name: payload.fieldName,
          original_text: payload.originalText,
          original_language_code: payload.originalLanguageCode,
          english_text: payload.englishText,
          arabic_text: payload.arabicText,
          urdu_text: payload.urduText,
          persian_text: payload.persianText,
          pashto_text: payload.pashtoText,
          source: "manual",
          corrected_by: correctedBy,
          corrected_at: correctedBy ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        };
      });

    if (!values.length) return;

    for (const row of values) {
      const { data: updated, error: updateError } = await supabase
        .from("record_translations")
        .update({
          original_text: row.original_text,
          original_language_code: row.original_language_code,
          english_text: row.english_text,
          arabic_text: row.arabic_text,
          urdu_text: row.urdu_text,
          persian_text: row.persian_text,
          pashto_text: row.pashto_text,
          source: row.source,
          corrected_by: row.corrected_by,
          corrected_at: row.corrected_at,
          updated_at: row.updated_at
        })
        .eq("record_table", row.record_table)
        .eq("record_id", row.record_id)
        .eq("field_name", row.field_name)
        .is("deleted_at", null)
        .select("id");

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (Array.isArray(updated) && updated.length) continue;

      const { error: insertError } = await supabase.from("record_translations").insert(row);
      if (insertError) {
        throw new Error(insertError.message);
      }
    }
  }
}

export const companiesService = new CompaniesService();
