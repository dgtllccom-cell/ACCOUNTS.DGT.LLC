import { customersRepository } from "@/lib/repositories/customers-repository";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";

export type CustomerInput = {
  countryId: string;
  stateProvinceId?: string | null;
  districtId?: string | null;
  cityId?: string | null;
  areaLocationId?: string | null;
  customerName: string;
  firstName?: string | null;
  lastName?: string | null;
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
    const customerId = await customersRepository.create({
      countryId: input.countryId,
      stateProvinceId: input.stateProvinceId ?? null,
      districtId: input.districtId ?? null,
      cityId: input.cityId ?? null,
      areaLocationId: input.areaLocationId ?? null,
      customerName: input.customerName,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
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
    await customersRepository.update(id, {
      stateProvinceId: "stateProvinceId" in input ? input.stateProvinceId ?? null : undefined,
      districtId: "districtId" in input ? input.districtId ?? null : undefined,
      cityId: "cityId" in input ? input.cityId ?? null : undefined,
      areaLocationId: "areaLocationId" in input ? input.areaLocationId ?? null : undefined,
      customerName: "customerName" in input ? input.customerName ?? "" : undefined,
      firstName: "firstName" in input ? input.firstName ?? null : undefined,
      lastName: "lastName" in input ? input.lastName ?? null : undefined,
      gender: "gender" in input ? input.gender ?? null : undefined,
      photoUrl: "photoUrl" in input ? input.photoUrl ?? null : undefined,
      companyName: "companyName" in input ? input.companyName ?? null : undefined,
      contactPerson: "contactPerson" in input ? input.contactPerson ?? null : undefined,
      mobile: "mobile" in input ? input.mobile ?? null : undefined,
      whatsapp: "whatsapp" in input ? input.whatsapp ?? null : undefined,
      email: "email" in input ? input.email ?? null : undefined,
      address: "address" in input ? input.address ?? null : undefined,
      notes: "notes" in input ? input.notes ?? null : undefined,
      originalLanguageCode: "originalLanguage" in input ? (input.originalLanguage ?? "en") : undefined
    });
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
