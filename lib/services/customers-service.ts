import { customersRepository } from "@/lib/repositories/customers-repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { multilingualService } from "@/lib/services/multilingual-service";

export type CustomerInput = {
  countryId: string;
  stateProvinceId?: string | null;
  districtId?: string | null;
  cityId?: string | null;
  areaLocationId?: string | null;
  customerName: string;
  companyName?: string | null;
  contactPerson?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  originalLanguage: SupportedLanguage;
  contacts?: Array<{ type: string; value: string; isPrimary?: boolean }>;
  registrations?: Array<{ type: string; value: string }>;
};

function translatableFields(input: CustomerInput) {
  return [
    ["customer_name", input.customerName],
    ["company_name", input.companyName ?? ""],
    ["contact_person", input.contactPerson ?? ""],
    ["address", input.address ?? ""],
    ["notes", input.notes ?? ""]
  ] as const;
}

function isUuid(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export class CustomersService {
  async search(input: { query?: string | null; countryId?: string | null; limit?: number }) {
    return await customersRepository.search(input);
  }

  async getById(id: string) {
    const customer = await customersRepository.getById(id);
    const contacts = await customersRepository.getContacts(id);
    const registrations = await customersRepository.getRegistrations(id);
    return { customer, contacts, registrations };
  }

  async create(input: CustomerInput, actorId?: string | null) {
    const customerId = await customersRepository.create({
      countryId: input.countryId,
      stateProvinceId: input.stateProvinceId ?? null,
      districtId: input.districtId ?? null,
      cityId: input.cityId ?? null,
      areaLocationId: input.areaLocationId ?? null,
      customerName: input.customerName,
      companyName: input.companyName ?? null,
      contactPerson: input.contactPerson ?? null,
      mobile: input.mobile ?? null,
      whatsapp: input.whatsapp ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      originalLanguageCode: input.originalLanguage
    });

    await customersRepository.insertContacts(customerId, input.contacts ?? []);
    await customersRepository.insertRegistrations(customerId, input.registrations ?? []);

    await this.upsertTranslations("customers", customerId, input, actorId ?? null);
    return customerId;
  }

  async update(
    id: string,
    input: Partial<CustomerInput> & { originalLanguage?: SupportedLanguage },
    actorId?: string | null
  ) {
    await customersRepository.update(id, {
      stateProvinceId: "stateProvinceId" in input ? input.stateProvinceId ?? null : undefined,
      districtId: "districtId" in input ? input.districtId ?? null : undefined,
      cityId: "cityId" in input ? input.cityId ?? null : undefined,
      areaLocationId: "areaLocationId" in input ? input.areaLocationId ?? null : undefined,
      customerName: "customerName" in input ? input.customerName ?? "" : undefined,
      companyName: "companyName" in input ? input.companyName ?? null : undefined,
      contactPerson: "contactPerson" in input ? input.contactPerson ?? null : undefined,
      mobile: "mobile" in input ? input.mobile ?? null : undefined,
      whatsapp: "whatsapp" in input ? input.whatsapp ?? null : undefined,
      email: "email" in input ? input.email ?? null : undefined,
      address: "address" in input ? input.address ?? null : undefined,
      notes: "notes" in input ? input.notes ?? null : undefined,
      originalLanguageCode: "originalLanguage" in input ? (input.originalLanguage ?? "en") : undefined,
      isActive: undefined
    });

    if (
      input.customerName ||
      input.companyName ||
      input.contactPerson ||
      input.address ||
      input.notes ||
      input.originalLanguage
    ) {
      const customer = await customersRepository.getById(id);
      const snapshot: CustomerInput = {
        countryId: customer.country_id,
        stateProvinceId: customer.state_province_id,
        districtId: customer.district_id,
        cityId: customer.city_id,
        areaLocationId: customer.area_location_id,
        customerName: input.customerName ?? customer.customer_name,
        companyName: input.companyName ?? customer.company_name,
        contactPerson: input.contactPerson ?? customer.contact_person,
        mobile: input.mobile ?? customer.mobile,
        whatsapp: input.whatsapp ?? customer.whatsapp,
        email: input.email ?? customer.email,
        address: input.address ?? customer.address,
        notes: input.notes ?? customer.notes,
        originalLanguage: (input.originalLanguage ?? (customer.original_language_code as SupportedLanguage) ?? "en") as SupportedLanguage
      };
      await this.upsertTranslations("customers", id, snapshot, actorId ?? null);
    }
  }

  async softDelete(id: string) {
    await customersRepository.softDelete(id);
  }

  private async upsertTranslations(recordTable: string, recordId: string, input: CustomerInput, actorId: string | null) {
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

    // record_translations is a VIEW (fanning out to the 5 per-language tables), not a base
    // table. A plain PostgREST .update()-then-.insert() against it is unreliable (silently
    // wrote nothing for every one of this ERP's existing customers — confirmed via direct DB
    // inspection: 0 of 106 customers had any translation row despite this code running on every
    // create/update). upsert_record_translation() is the RPC every other working translation
    // path in the ERP uses specifically because it handles the view's PARTIAL unique index
    // (WHERE deleted_at IS NULL) correctly — see enterprise-multilingual-service.ts. Route
    // through it here instead of hand-rolling the view write again.
    for (const row of values) {
      const { error: rpcError } = await supabase.rpc("upsert_record_translation", {
        p_record_table: row.record_table,
        p_record_id: row.record_id,
        p_field_name: row.field_name,
        p_original_text: row.original_text,
        p_original_language_code: row.original_language_code,
        p_english: row.english_text,
        p_urdu: row.urdu_text,
        p_arabic: row.arabic_text,
        p_persian: row.persian_text,
        p_pashto: row.pashto_text,
        p_language_texts: {
          en: row.english_text,
          ur: row.urdu_text,
          ar: row.arabic_text,
          fa: row.persian_text,
          ps: row.pashto_text
        },
        p_source: row.source,
        p_translation_status: "complete",
        p_translated_by_engine: "local_dictionary",
        p_actor_id: row.corrected_by
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }
    }
  }
}

export const customersService = new CustomersService();
