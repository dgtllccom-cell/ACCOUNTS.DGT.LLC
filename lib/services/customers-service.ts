import { customersRepository } from "@/lib/repositories/customers-repository";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";
import { assertGeoHierarchy } from "@/lib/services/geo-hierarchy-validator";

export type CustomerInput = {
  countryId: string;
  stateProvinceId?: string | null;
  districtId?: string | null;
  cityId?: string | null;
  areaLocationId?: string | null;
  customerName: string;
  firstName?: string | null;
  lastName?: string | null;
  fatherName?: string | null;
  gender?: string | null;
  photoUrl?: string | null;
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
    await assertGeoHierarchy({
      countryId: input.countryId,
      stateProvinceId: input.stateProvinceId,
      districtId: input.districtId,
      cityId: input.cityId,
      areaLocationId: input.areaLocationId,
    });
    const customerId = await customersRepository.create({
      countryId: input.countryId,
      stateProvinceId: input.stateProvinceId ?? null,
      districtId: input.districtId ?? null,
      cityId: input.cityId ?? null,
      areaLocationId: input.areaLocationId ?? null,
      customerName: input.customerName,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      fatherName: input.fatherName ?? null,
      gender: input.gender ?? null,
      photoUrl: input.photoUrl ?? null,
      companyName: input.companyName ?? null,
      contactPerson: input.contactPerson ?? null,
      mobile: input.mobile ?? null,
      whatsapp: input.whatsapp ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      originalLanguageCode: input.originalLanguage,
      actorId: actorId ?? null
    });

    await customersRepository.insertContacts(customerId, input.contacts ?? []);
    await customersRepository.insertRegistrations(customerId, input.registrations ?? []);

    await translateMasterRecord(
      "customers",
      customerId,
      {
        customer_name: input.customerName,
        company_name: input.companyName ?? null,
        contact_person: input.contactPerson ?? null
      },
      input.originalLanguage,
      actorId ?? null
    );

    const current = await customersRepository.getById(customerId);
    await writeRecordChangeHistory({
      recordTable: "customers",
      recordId: customerId,
      action: "create",
      actorId: actorId ?? null,
      countryId: current?.country_id ?? input.countryId,
      cityBranchId: null,
      beforeData: null,
      afterData: current ?? null
    });
    return customerId;
  }

  async update(
    id: string,
    input: Partial<CustomerInput> & { originalLanguage?: SupportedLanguage },
    actorId?: string | null
  ) {
    const before = await customersRepository.getById(id);
    await assertGeoHierarchy({
      countryId: "countryId" in input ? input.countryId : before?.country_id ?? null,
      stateProvinceId: "stateProvinceId" in input ? input.stateProvinceId : before?.state_province_id ?? null,
      districtId: "districtId" in input ? input.districtId : before?.district_id ?? null,
      cityId: "cityId" in input ? input.cityId : before?.city_id ?? null,
      areaLocationId: "areaLocationId" in input ? input.areaLocationId : before?.area_location_id ?? null,
    });
    // Build the patch with ONLY the keys the caller actually supplied. The previous version
    // always emitted every key (assigning JS `undefined` when a field was absent) — an object
    // literal keeps a key once written, even when its value is `undefined`, so the repository's
    // own `"key" in input` guard saw every field as "present" and forwarded `undefined` into
    // the `postgres` tag, which throws "UNDEFINED_VALUE: Undefined values are not allowed".
    // That crashed any update that legitimately omitted a field (e.g. editing only the
    // address, without first/last name in the request body).
    const patch: Record<string, unknown> = {};
    if ("stateProvinceId" in input) patch.stateProvinceId = input.stateProvinceId ?? null;
    if ("districtId" in input) patch.districtId = input.districtId ?? null;
    if ("cityId" in input) patch.cityId = input.cityId ?? null;
    if ("areaLocationId" in input) patch.areaLocationId = input.areaLocationId ?? null;
    if ("customerName" in input) patch.customerName = input.customerName ?? "";
    if ("firstName" in input) patch.firstName = input.firstName ?? null;
    if ("lastName" in input) patch.lastName = input.lastName ?? null;
    if ("fatherName" in input) patch.fatherName = input.fatherName ?? null;
    if ("gender" in input) patch.gender = input.gender ?? null;
    if ("photoUrl" in input) patch.photoUrl = input.photoUrl ?? null;
    if ("companyName" in input) patch.companyName = input.companyName ?? null;
    if ("contactPerson" in input) patch.contactPerson = input.contactPerson ?? null;
    if ("mobile" in input) patch.mobile = input.mobile ?? null;
    if ("whatsapp" in input) patch.whatsapp = input.whatsapp ?? null;
    if ("email" in input) patch.email = input.email ?? null;
    if ("address" in input) patch.address = input.address ?? null;
    if ("notes" in input) patch.notes = input.notes ?? null;
    if ("originalLanguage" in input) patch.originalLanguageCode = input.originalLanguage ?? "en";
    await customersRepository.update(id, patch);
    const after = await customersRepository.getById(id);

    await writeRecordChangeHistory({
      recordTable: "customers",
      recordId: id,
      action: "update",
      actorId: actorId ?? null,
      countryId: after?.country_id ?? before?.country_id ?? null,
      cityBranchId: null,
      beforeData: before ?? null,
      afterData: after ?? null
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
      if (customer) {
        const resolvedLang = (input.originalLanguage ?? (customer.original_language_code as SupportedLanguage) ?? "en") as SupportedLanguage;
        await translateMasterRecord(
          "customers",
          id,
          {
            customer_name: input.customerName ?? customer.customer_name,
            company_name: input.companyName ?? customer.company_name,
            contact_person: input.contactPerson ?? customer.contact_person
          },
          resolvedLang,
          actorId ?? null
        );
      }
    }
  }

  async softDelete(id: string) {
    const before = await customersRepository.getById(id);
    await customersRepository.softDelete(id);
    await writeRecordChangeHistory({
      recordTable: "customers",
      recordId: id,
      action: "delete",
      actorId: null,
      countryId: before?.country_id ?? null,
      cityBranchId: null,
      beforeData: before ?? null,
      afterData: { deleted_at: new Date().toISOString() }
    });
  }
}

export const customersService = new CustomersService();
